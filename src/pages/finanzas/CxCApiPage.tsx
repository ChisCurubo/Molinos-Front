import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownCircle, Banknote, ChevronLeft, ChevronRight, FileText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosCxcApi, type CxcCuenta, type CategoriaCxc, type CrearCxcPayload, type AbonoCxcPayload } from '@/api/pagosCxc'
import { pagosIngresosApi, type Ingreso, type IngresoPayload, type CategoriaIngreso } from '@/api/pagosIngresos'
import { pagosApi, type Proveedor } from '@/api/pagos'
import { MineroSelect, DuenoSelect } from '@/components/common/CatalogSelectors'
import { ComprobanteInput } from '@/components/common/ComprobanteInput'
import { useEmpleados, EmpleadoSelect } from '@/pages/nomina/empleadosShared'
import { invalidateBalanceTesoreria } from '@/hooks/useBalanceTesoreria'
import { CuentasBancariasTab } from './CuentasBancariasTab'
import { ImpuestosInfoTab } from './ImpuestosInfoTab'
import { useCuentasBancarias } from '@/hooks/useCuentasBancarias'
import { abrirUrl } from '@/utils/safeUrl'

const cop = formatCOP
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
// ── Orden de tabla por columna, clic para alternar asc/desc — reusado en
// las pestañas Ingresos y Cuentas. ──
type SortDir = 'asc' | 'desc'
interface SortState { key: string; dir: SortDir }
function toggleSort(current: SortState, key: string): SortState {
  return current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
}
function SortTh({ label, sortKey, sort, onSort, align }: { label: string; sortKey: string; sort: SortState; onSort: (k: string) => void; align?: 'right' }) {
  const active = sort.key === sortKey
  return (
    <th style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => onSort(sortKey)}>
      {label}
      {active && <span style={{ fontSize: '0.7em', marginLeft: 3 }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
}

type TipoDeudor = '' | 'minero' | 'dueno' | 'empleado' | 'proveedor'
const TIPO_DEUDOR_OPTS = [
  { value: '',          label: '— Sin deudor asignado —' },
  { value: 'minero',    label: 'Minero' },
  { value: 'dueno',     label: 'Dueño de volqueta' },
  { value: 'empleado',  label: 'Empleado' },
  { value: 'proveedor', label: 'Proveedor' },
]
function deudorToPayload(tipo: TipoDeudor, id: number | ''): DeudorPayload {
  if (id === '') return {}
  if (tipo === 'minero') return { id_minero: id }
  if (tipo === 'dueno') return { id_dueno_volqueta: id }
  if (tipo === 'empleado') return { id_empleado: id }
  if (tipo === 'proveedor') return { id_proveedor: id }
  return {}
}
type DeudorPayload = Pick<CrearCxcPayload, 'id_minero' | 'id_dueno_volqueta' | 'id_empleado' | 'id_proveedor'>
function deudorDesdeCuenta(c: CxcCuenta): { tipo: TipoDeudor; id: number | '' } {
  if (c.id_minero != null) return { tipo: 'minero', id: c.id_minero }
  if (c.id_dueno_volqueta != null) return { tipo: 'dueno', id: c.id_dueno_volqueta }
  if (c.id_empleado != null) return { tipo: 'empleado', id: c.id_empleado }
  if (c.id_proveedor != null) return { tipo: 'proveedor', id: c.id_proveedor }
  return { tipo: '', id: '' }
}

function useProveedoresTodos() {
  const [data, setData] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  return data
}

// Selector del deudor: tipo + catálogo correspondiente, según lo que pidió el
// usuario (minero/dueño de volqueta/empleado/proveedor — exactamente los 4
// campos reales de /pagos/cxc, confirmados por el backend).
function DeudorPicker({ tipo, id, onTipo, onId }: { tipo: TipoDeudor; id: number | ''; onTipo: (t: TipoDeudor) => void; onId: (id: number | '') => void }) {
  const empleados = useEmpleados()
  const proveedores = useProveedoresTodos()
  return (
    <>
      <Select label="Deudor" style={{ gridColumn: '1 / -1' }} value={tipo} onChange={e => { onTipo(e.target.value as TipoDeudor); onId('') }} options={TIPO_DEUDOR_OPTS} />
      {tipo === 'minero' && <MineroSelect value={id} onChange={onId} />}
      {tipo === 'dueno' && <DuenoSelect value={id} onChange={onId} />}
      {tipo === 'empleado' && <EmpleadoSelect empleados={empleados.data} value={id} onChange={onId} />}
      {tipo === 'proveedor' && (
        <Select label="Proveedor" placeholder="— Seleccionar proveedor —" value={id === '' ? '' : String(id)}
          onChange={e => onId(e.target.value === '' ? '' : Number(e.target.value))}
          options={proveedores.map(p => ({ value: String(p.id), label: p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre }))} />
      )}
    </>
  )
}

function useCategoriasIngreso() {
  const [data, setData] = useState<CategoriaIngreso[]>([])
  useEffect(() => { pagosIngresosApi.getCategorias().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  return data
}

function useCategoriasCxc() {
  const [data, setData] = useState<CategoriaCxc[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosCxcApi.getCategorias().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

type PageTab = 'ingresos' | 'cuentas' | 'categorias' | 'cuentas_bancarias' | 'impuestos'

export function CxCApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const [tab, setTab] = useState<PageTab>('ingresos')

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()

  const categorias = useCategoriasCxc()
  const [page, setPage] = useState(1)
  const [fCategoriaCxc, setFCategoriaCxc] = useState<number | ''>('')
  const [cuentaSubTab, setCuentaSubTab] = useState<'pendientes' | 'cobradas'>('pendientes')
  const [buscaCxc, setBuscaCxc] = useState('')
  const [sortCxc, setSortCxc] = useState<SortState>({ key: 'fecha', dir: 'desc' })
  const [resp, setResp] = useState<{ cuentas: CxcCuenta[]; pagination: { page: number; total: number; total_pages: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxcApi.getMensual({ mes, anio, id_categoria: fCategoriaCxc || undefined, estado: cuentaSubTab === 'cobradas' ? 'pagado' : undefined, page, limit: 50 })
      .then(setResp)
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio, fCategoriaCxc, cuentaSubTab, page])
  useEffect(() => { setPage(1) }, [mes, anio, fCategoriaCxc, cuentaSubTab])
  useEffect(() => { load() }, [load])

  // En "Pendientes" el backend trae todos los estados (igual que antes con el
  // filtro "Todos") — se ocultan las ya cobradas acá para no duplicar con la
  // pestaña "Cobradas", que sí filtra por estado=pagado en el servidor.
  const cuentas = useMemo(() => {
    const todas = resp?.cuentas ?? []
    return cuentaSubTab === 'pendientes' ? todas.filter(c => c.estado !== 'pagado') : todas
  }, [resp, cuentaSubTab])
  const cuentasVisibles = useMemo(() => {
    let list = cuentas
    if (buscaCxc.trim()) {
      const q = buscaCxc.trim().toLowerCase()
      list = list.filter(c => (c.concepto ?? '').toLowerCase().includes(q) || (c.deudor ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortCxc.key === 'concepto') cmp = (a.concepto ?? '').localeCompare(b.concepto ?? '')
      else if (sortCxc.key === 'saldo') cmp = num(a.saldo) - num(b.saldo)
      else if (sortCxc.key === 'estado') cmp = a.estado.localeCompare(b.estado)
      else if (sortCxc.key === 'fecha') cmp = (a.fecha_creacion ?? '').localeCompare(b.fecha_creacion ?? '')
      return sortCxc.dir === 'asc' ? cmp : -cmp
    })
  }, [cuentas, buscaCxc, sortCxc])
  const totalSaldo = cuentasVisibles.reduce((s, c) => s + num(c.saldo), 0)

  // ── Nueva cuenta por cobrar ────────────────────────────────────
  const [nuevaModal, setNuevaModal] = useState(false)
  const [nForm, setNForm] = useState({ tipoDeudor: '' as TipoDeudor, idDeudor: '' as number | '', concepto: '', valor_total: '', id_categoria: '' as number | '', fecha_creacion: todayISO() })
  const [savingNueva, setSavingNueva] = useState(false)
  const abrirNueva = () => { setNForm({ tipoDeudor: '', idDeudor: '', concepto: '', valor_total: '', id_categoria: '', fecha_creacion: todayISO() }); setNuevaModal(true) }
  const guardarNueva = async () => {
    if (!nForm.concepto.trim() || !(Number(nForm.valor_total) > 0)) { toast.error('Concepto y valor son obligatorios'); return }
    if (nForm.id_categoria === '') { toast.error('Selecciona una categoría'); return }
    setSavingNueva(true)
    try {
      await pagosCxcApi.crear({
        ...deudorToPayload(nForm.tipoDeudor, nForm.idDeudor),
        concepto: nForm.concepto.trim(), valor_total: Number(nForm.valor_total),
        id_categoria: nForm.id_categoria,
        fecha_creacion: nForm.fecha_creacion || undefined,
      })
      toast.success('Cuenta creada'); setNuevaModal(false); load(); invalidateBalanceTesoreria()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingNueva(false) }
  }

  // ── Editar cuenta ────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<CxcCuenta | null>(null)
  const [eForm, setEForm] = useState({ tipoDeudor: '' as TipoDeudor, idDeudor: '' as number | '', concepto: '', valor_total: '', id_categoria: '' as number | '', fecha_creacion: todayISO() })
  const [savingEdit, setSavingEdit] = useState(false)
  const abrirEditar = (c: CxcCuenta) => {
    const { tipo, id } = deudorDesdeCuenta(c)
    setEForm({ tipoDeudor: tipo, idDeudor: id, concepto: c.concepto ?? '', valor_total: String(num(c.valor_total)), id_categoria: c.id_categoria ?? '', fecha_creacion: c.fecha_creacion?.slice(0, 10) ?? todayISO() })
    setEditTarget(c)
  }
  const guardarEdit = async () => {
    if (!editTarget) return
    setSavingEdit(true)
    try {
      await pagosCxcApi.actualizar(editTarget.id, {
        ...deudorToPayload(eForm.tipoDeudor, eForm.idDeudor),
        concepto: eForm.concepto.trim(), valor_total: Number(eForm.valor_total),
        id_categoria: eForm.id_categoria === '' ? undefined : eForm.id_categoria, fecha_creacion: eForm.fecha_creacion || undefined,
      })
      toast.success('Cuenta actualizada'); setEditTarget(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingEdit(false) }
  }

  // ── Anular cuenta ────────────────────────────────────────────
  const [delCuenta, setDelCuenta] = useState<CxcCuenta | null>(null)
  const [anulando, setAnulando] = useState(false)
  const confirmAnular = async () => {
    if (!delCuenta) return
    setAnulando(true)
    try { await pagosCxcApi.anular(delCuenta.id); toast.success('Cuenta anulada'); setDelCuenta(null); load() }
    catch (e) { toast.error(apiError(e).message); setDelCuenta(null) } finally { setAnulando(false) }
  }

  // ── Abonar (cobro) ───────────────────────────────────────────
  const [abonoTarget, setAbonoTarget] = useState<CxcCuenta | null>(null)
  const [aForm, setAForm] = useState({ valor: '', fecha_cobro: todayISO(), metodo: 'transferencia', comprobante: null as File | null })
  const [savingAbono, setSavingAbono] = useState(false)
  const abrirAbono = (c: CxcCuenta) => { setAForm({ valor: String(num(c.saldo)), fecha_cobro: todayISO(), metodo: 'transferencia', comprobante: null }); setAbonoTarget(c) }
  const guardarAbono = async () => {
    if (!abonoTarget) return
    const valor = Number(aForm.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingAbono(true)
    try {
      const body: AbonoCxcPayload = { valor, fecha_cobro: aForm.fecha_cobro, metodo: aForm.metodo }
      await pagosCxcApi.abonar(abonoTarget.id, body, aForm.comprobante)
      toast.success('Cobro registrado'); setAbonoTarget(null); load(); invalidateBalanceTesoreria()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingAbono(false) }
  }

  return (
    <div className="page">
      <PageHeader title="Ingresos" subtitle="Dinero que entra: ingresos directos, cuentas por cobrar pendientes y sus categorías."
        actions={canWrite && tab === 'cuentas' && <Button icon={<Plus size={18} />} onClick={abrirNueva}>Nueva cuenta por cobrar</Button>} />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'ingresos'} className={`segment__btn ${tab === 'ingresos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('ingresos')}>Ingresos</button>
        <button role="tab" aria-selected={tab === 'cuentas'} className={`segment__btn ${tab === 'cuentas' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas')}>Cuentas</button>
        <button role="tab" aria-selected={tab === 'categorias'} className={`segment__btn ${tab === 'categorias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
        <button role="tab" aria-selected={tab === 'cuentas_bancarias'} className={`segment__btn ${tab === 'cuentas_bancarias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas_bancarias')}>Cuentas bancarias</button>
        <button role="tab" aria-selected={tab === 'impuestos'} className={`segment__btn ${tab === 'impuestos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('impuestos')}>Impuestos</button>
      </div>

      {tab === 'ingresos' && <IngresosDirectosTab canWrite={canWrite} />}

      {tab === 'cuentas_bancarias' && <CuentasBancariasTab canWrite={canWrite} />}

      {tab === 'impuestos' && <ImpuestosInfoTab modulo="ingresos" />}

      {tab === 'cuentas' && (
        <>
          <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
            <span>
              Cuentas por cobrar a clientes (ej. venta de concentrado). Una cuenta nace pendiente — usa "Abonar" para registrar cada cobro con su
              comprobante, igual que en Cuentas por pagar.
            </span>
          </div>

          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Cuentas" value={cuentas.length} icon={<ArrowDownCircle size={16} />} accent="emerald" />
            <KpiTile label="Saldo por cobrar" value={cop(totalSaldo)} accent="rose" />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontWeight: 700, minWidth: '11rem', textAlign: 'center' }}>{MESES[mes - 1]} {anio}{esMesActual && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Actual</span>}</span>
              <button type="button" onClick={() => shiftMonth(1)} disabled={esMesActual} title="Mes siguiente"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: esMesActual ? 'not-allowed' : 'pointer', color: esMesActual ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={{ width: 1, height: 30, background: '#e5e7eb' }} />
            <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoriaCxc} onChange={e => setFCategoriaCxc(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas las categorías</option>
              {categorias.data.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <div className="segment" role="tablist" style={{ padding: '0.15rem' }}>
              <button role="tab" aria-selected={cuentaSubTab === 'pendientes'} className={`segment__btn ${cuentaSubTab === 'pendientes' ? 'segment__btn--active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--fs-sm)', minHeight: 'auto' }} onClick={() => setCuentaSubTab('pendientes')}>Pendientes</button>
              <button role="tab" aria-selected={cuentaSubTab === 'cobradas'} className={`segment__btn ${cuentaSubTab === 'cobradas' ? 'segment__btn--active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--fs-sm)', minHeight: 'auto' }} onClick={() => setCuentaSubTab('cobradas')}>Cobradas</button>
            </div>
            <Input label="Buscar" placeholder="Concepto o deudor…" value={buscaCxc} onChange={e => setBuscaCxc(e.target.value)} style={{ maxWidth: '16rem' }} />
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
          </div>

          <Card title={`Cuentas por cobrar — ${cuentaSubTab === 'cobradas' ? 'Cobradas' : 'Pendientes'} (${cuentasVisibles.length})`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <SortTh label="Concepto" sortKey="concepto" sort={sortCxc} onSort={k => setSortCxc(s => toggleSort(s, k))} />
                  <SortTh label="Saldo · Total" sortKey="saldo" sort={sortCxc} onSort={k => setSortCxc(s => toggleSort(s, k))} align="right" />
                  <SortTh label="Estado · Fecha" sortKey="fecha" sort={sortCxc} onSort={k => setSortCxc(s => toggleSort(s, k))} />
                  {canWrite && <th style={{ minWidth: '10rem' }}></th>}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
                  ) : error ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                      {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                    </td></tr>
                  ) : cuentasVisibles.length === 0 ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Sin cuentas {cuentaSubTab === 'cobradas' ? 'cobradas' : 'pendientes'} para {MESES[mes - 1]} {anio}.
                    </td></tr>
                  ) : cuentasVisibles.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{c.concepto || `Cuenta #${c.id}`}</span>
                          {c.categoria && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{c.categoria}</span>}
                        </div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{c.deudor ?? '—'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 'var(--fs-base)' }} className="mono">{cop(num(c.saldo))}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">de {cop(num(c.valor_total))} · cobrado {cop(num(c.valor_cobrado))}</div>
                      </td>
                      <td>
                        <span className="badge badge--neutral">{c.estado}</span>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>{c.fecha_creacion ? formatDate(c.fecha_creacion) : '—'}</div>
                      </td>
                      {canWrite && (
                        <td>
                          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                            {num(c.saldo) > 0.01 && <Button size="sm" icon={<Banknote size={13} />} onClick={() => abrirAbono(c)}>Abonar</Button>}
                            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => abrirEditar(c)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelCuenta(c)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resp && resp.pagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span style={{ fontSize: 'var(--fs-sm)' }}>Página {resp.pagination.page} de {resp.pagination.total_pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= resp.pagination.total_pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'categorias' && <CategoriasCxcTab canWrite={canWrite} categorias={categorias} />}

      {/* ── Modal: Nueva cuenta por cobrar ── */}
      <Modal open={nuevaModal} title="Nueva cuenta por cobrar" onClose={() => setNuevaModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setNuevaModal(false)}>Cancelar</Button>
          <Button onClick={guardarNueva} disabled={savingNueva || !nForm.concepto.trim() || !(Number(nForm.valor_total) > 0) || nForm.id_categoria === ''}>{savingNueva ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="grid grid--form">
          <DeudorPicker tipo={nForm.tipoDeudor} id={nForm.idDeudor} onTipo={t => setNForm(s => ({ ...s, tipoDeudor: t }))} onId={id => setNForm(s => ({ ...s, idDeudor: id }))} />
          <Input label="Concepto" required style={{ gridColumn: '1 / -1' }} value={nForm.concepto} onChange={e => setNForm(s => ({ ...s, concepto: e.target.value }))} />
          <Input label="Valor" type="number" mono step="1000" required value={nForm.valor_total} onChange={e => setNForm(s => ({ ...s, valor_total: e.target.value }))} />
          <Select label="Categoría" required placeholder="— Elige una categoría —" value={nForm.id_categoria === '' ? '' : String(nForm.id_categoria)}
            onChange={e => setNForm(s => ({ ...s, id_categoria: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={categorias.data.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={nForm.fecha_creacion} onChange={e => setNForm(s => ({ ...s, fecha_creacion: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Editar cuenta ── */}
      <Modal open={editTarget != null} title={`Editar — ${editTarget?.concepto ?? ''}`} onClose={() => setEditTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancelar</Button>
          <Button onClick={guardarEdit} disabled={savingEdit || !eForm.concepto.trim() || !(Number(eForm.valor_total) > 0)}>{savingEdit ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="grid grid--form">
          <DeudorPicker tipo={eForm.tipoDeudor} id={eForm.idDeudor} onTipo={t => setEForm(s => ({ ...s, tipoDeudor: t }))} onId={id => setEForm(s => ({ ...s, idDeudor: id }))} />
          <Input label="Concepto" required style={{ gridColumn: '1 / -1' }} value={eForm.concepto} onChange={e => setEForm(s => ({ ...s, concepto: e.target.value }))} />
          <Input label="Valor total" type="number" mono step="1000" required value={eForm.valor_total} onChange={e => setEForm(s => ({ ...s, valor_total: e.target.value }))} />
          <Select label="Categoría (opcional)" placeholder="— Sin categoría —" value={eForm.id_categoria === '' ? '' : String(eForm.id_categoria)}
            onChange={e => setEForm(s => ({ ...s, id_categoria: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={categorias.data.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={eForm.fecha_creacion} onChange={e => setEForm(s => ({ ...s, fecha_creacion: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Abonar (cobro) ── */}
      <Modal open={abonoTarget != null} title={`Abonar — ${abonoTarget?.concepto ?? ''}`} onClose={() => setAbonoTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarAbono} disabled={savingAbono || !(Number(aForm.valor) > 0)}>{savingAbono ? 'Guardando…' : 'Registrar cobro'}</Button>
        </>}>
        {abonoTarget && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente: <strong style={{ color: 'var(--rose-700)' }}>{cop(num(abonoTarget.saldo))}</strong>
          </div>
        )}
        <div className="grid grid--form">
          <Input label="Valor cobrado" type="number" mono step="1000" required style={{ gridColumn: '1 / -1' }} value={aForm.valor} onChange={e => setAForm(s => ({ ...s, valor: e.target.value }))} />
          <Select label="Método de pago" value={aForm.metodo} onChange={e => setAForm(s => ({ ...s, metodo: e.target.value }))}
            options={[{ value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'nequi', label: 'Nequi' }, { value: 'deposito', label: 'Depósito' }, { value: 'otro', label: 'Otro' }]} />
          <Input label="Fecha" type="date" value={aForm.fecha_cobro} onChange={e => setAForm(s => ({ ...s, fecha_cobro: e.target.value }))} />
          <ComprobanteInput style={{ gridColumn: '1 / -1' }} value={aForm.comprobante} onChange={file => setAForm(s => ({ ...s, comprobante: file }))} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delCuenta} title="Anular cuenta por cobrar" itemLabel={delCuenta?.concepto ?? undefined} loading={anulando} onCancel={() => setDelCuenta(null)} onConfirm={confirmAnular} />
    </div>
  )
}

// ── Ingresos (Ingreso Directo — Ingresos_Tesoreria) ──────────────
// Mismo registro/API que la pestaña "Tesorería" usa (pagosIngresosApi) — se
// repite acá a propósito, como pidió el usuario, para que "Ingresos" en este
// módulo sea un único lugar: directos + cuentas por cobrar cobradas (pestaña
// "Cuentas" al lado). Ver TesoreriaApiPage.tsx para la otra superficie.
const emptyIngresoForm = () => ({ id_categoria: '' as number | '', concepto: '', valor: '', fecha: todayISO(), comprobante: null as File | null })

function IngresosDirectosTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const categorias = useCategoriasIngreso()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`

  const [fCategoria, setFCategoria] = useState<number | ''>('')
  const [fCuentaBancaria, setFCuentaBancaria] = useState<number | ''>('')
  const cuentasBancarias = useCuentasBancarias()
  const [busca, setBusca] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'fecha', dir: 'desc' })

  const [data, setData] = useState<Ingreso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosIngresosApi.listar({ desde, hasta, id_categoria: fCategoria || undefined, id_cuenta_bancaria: fCuentaBancaria || undefined })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [desde, hasta, fCategoria, fCuentaBancaria])
  useEffect(() => { load() }, [load])

  const visibles = useMemo(() => {
    let list = data
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      list = list.filter(i => i.concepto.toLowerCase().includes(q) || (i.categoria ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sort.key === 'concepto') cmp = a.concepto.localeCompare(b.concepto)
      else if (sort.key === 'categoria') cmp = (a.categoria ?? '').localeCompare(b.categoria ?? '')
      else if (sort.key === 'fecha') cmp = a.fecha.localeCompare(b.fecha)
      else if (sort.key === 'valor') cmp = num(a.valor) - num(b.valor)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, busca, sort])
  const total = useMemo(() => visibles.reduce((s, i) => s + num(i.valor), 0), [visibles])

  const [modal, setModal] = useState<null | 'nuevo' | Ingreso>(null)
  const [form, setForm] = useState(emptyIngresoForm())
  const [saving, setSaving] = useState(false)
  const abrirNuevo = () => { setForm(emptyIngresoForm()); setModal('nuevo') }
  const abrirEdit = (i: Ingreso) => { setForm({ id_categoria: i.id_categoria, concepto: i.concepto, valor: String(num(i.valor)), fecha: i.fecha?.slice(0, 10) ?? todayISO(), comprobante: null }); setModal(i) }
  const guardar = async () => {
    if (!form.concepto.trim() || !form.valor || form.id_categoria === '') { toast.error('Concepto, categoría y valor son obligatorios'); return }
    const body: IngresoPayload = { id_categoria: form.id_categoria, concepto: form.concepto.trim(), valor: Number(form.valor), fecha: form.fecha }
    setSaving(true)
    try {
      if (modal === 'nuevo') { await pagosIngresosApi.crear(body, form.comprobante); toast.success('Ingreso registrado') }
      else if (modal) { await pagosIngresosApi.actualizar(modal.id, body); toast.success('Ingreso actualizado') }
      setModal(null); load(); invalidateBalanceTesoreria()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [borrando, setBorrando] = useState<Ingreso | null>(null)
  const [borrandoLoading, setBorrandoLoading] = useState(false)
  const confirmBorrar = async () => {
    if (!borrando) return
    setBorrandoLoading(true)
    try { await pagosIngresosApi.eliminar(borrando.id); toast.success('Ingreso eliminado'); setBorrando(null); load(); invalidateBalanceTesoreria() }
    catch (e) { toast.error(apiError(e).message); setBorrando(null) } finally { setBorrandoLoading(false) }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Ingresos" value={visibles.length} icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Total del mes" value={cop(total)} accent="green" />
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: 700, minWidth: '11rem', textAlign: 'center' }}>{MESES[mes - 1]} {anio}{esMesActual && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Actual</span>}</span>
          <button type="button" onClick={() => shiftMonth(1)} disabled={esMesActual} title="Mes siguiente"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: esMesActual ? 'not-allowed' : 'pointer', color: esMesActual ? 'var(--text-faint)' : 'var(--text)' }}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div style={{ width: 1, height: 30, background: '#e5e7eb' }} />
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoria} onChange={e => setFCategoria(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCuentaBancaria}
          onChange={e => setFCuentaBancaria(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas las cuentas</option>
          {cuentasBancarias.data.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <Input label="Buscar" placeholder="Concepto…" value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: '16rem' }} />
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrirNuevo} style={{ marginLeft: 'auto' }}>Nuevo ingreso</Button>}
      </div>

      <Card title={`Ingresos de ${MESES[mes - 1]} ${anio} (${visibles.length} de ${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <SortTh label="Concepto" sortKey="concepto" sort={sort} onSort={k => setSort(s => toggleSort(s, k))} />
              <SortTh label="Categoría" sortKey="categoria" sort={sort} onSort={k => setSort(s => toggleSort(s, k))} />
              <SortTh label="Fecha" sortKey="fecha" sort={sort} onSort={k => setSort(s => toggleSort(s, k))} />
              <th>Cuenta bancaria</th>
              <SortTh label="Valor" sortKey="valor" sort={sort} onSort={k => setSort(s => toggleSort(s, k))} align="right" />
              <th>Comprobante</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : visibles.length === 0 ? (
                <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin ingresos para {MESES[mes - 1]} {anio}.</td></tr>
              ) : visibles.map(i => {
                const automatico = i.id_prestamo_fin != null
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.concepto} {automatico && <span className="badge badge--info" style={{ marginLeft: '0.3rem', fontSize: '0.65rem' }}>Automático</span>}</td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{i.categoria ?? '—'}</td>
                    <td>{formatDate(i.fecha)}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{i.cuenta_bancaria ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{cop(num(i.valor))}</td>
                    <td>
                      {i.comprobante_url
                        ? <Button variant="ghost" size="sm" icon={<FileText size={13} />} onClick={() => abrirUrl(i.comprobante_url)} />
                        : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    {canWrite && (
                      <td>
                        {!automatico && (
                          <div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => abrirEdit(i)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setBorrando(i)} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo ingreso' : 'Editar ingreso'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={guardar} disabled={saving || !form.concepto.trim() || !form.valor || form.id_categoria === ''}>{saving ? 'Guardando…' : 'Guardar'}</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" required placeholder="Aporte socio, cobro a tercero…" style={{ gridColumn: '1 / -1' }} value={form.concepto} onChange={e => setForm(s => ({ ...s, concepto: e.target.value }))} />
          <Select label="Categoría" required placeholder="— Elige una categoría —" value={form.id_categoria === '' ? '' : String(form.id_categoria)}
            onChange={e => setForm(s => ({ ...s, id_categoria: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={categorias.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          <Input label="Valor (COP)" type="number" mono step="1000" required style={{ gridColumn: '1 / -1' }} value={form.valor} onChange={e => setForm(s => ({ ...s, valor: e.target.value }))} />
          <ComprobanteInput style={{ gridColumn: '1 / -1' }} value={form.comprobante} existingUrl={modal && modal !== 'nuevo' ? modal.comprobante_url : null}
            onChange={file => setForm(s => ({ ...s, comprobante: file }))}
            helper={modal && modal !== 'nuevo' ? 'Editar no reemplaza el comprobante del ingreso.' : undefined} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!borrando} title="Eliminar ingreso" itemLabel={borrando?.concepto} loading={borrandoLoading} onCancel={() => setBorrando(null)} onConfirm={confirmBorrar} />
    </>
  )
}

function CategoriasCxcTab({ canWrite, categorias }: { canWrite: boolean; categorias: ReturnType<typeof useCategoriasCxc> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nueva' | CategoriaCxc>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const openNueva = () => { setNombre(''); setModal('nueva') }
  const openEdit = (c: CategoriaCxc) => { setNombre(c.nombre); setModal(c) }
  const save = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nueva') { await pagosCxcApi.createCategoria(nombre.trim()); toast.success('Categoría creada') }
      else if (modal) { await pagosCxcApi.updateCategoria(modal.id, nombre.trim()); toast.success('Categoría actualizada') }
      setModal(null); categorias.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delCat, setDelCat] = useState<CategoriaCxc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delCat) return
    setDeleting(true)
    try { await pagosCxcApi.deleteCategoria(delCat.id); toast.success('Categoría eliminada'); setDelCat(null); categorias.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Esta categoría tiene cuentas asociadas y no se puede eliminar.' : message)
      setDelCat(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Categorías (${categorias.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNueva}>Nueva categoría</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {categorias.loading ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : categorias.data.length === 0 ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin categorías</td></tr>
              ) : categorias.data.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(c)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelCat(c)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nueva' ? 'Nueva categoría' : 'Editar categoría'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !nombre.trim()}>Guardar</Button></>}>
        <Input label="Nombre" required value={nombre} onChange={e => setNombre(e.target.value)} />
      </Modal>

      <ConfirmDeleteModal open={!!delCat} title="Eliminar categoría" itemLabel={delCat?.nombre} loading={deleting} onCancel={() => setDelCat(null)} onConfirm={confirmDelete} />
    </>
  )
}
