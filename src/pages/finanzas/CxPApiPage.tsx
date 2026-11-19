import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, FileText, Pencil, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { CHART_COLORS } from '@/components/charts/Charts'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosCxpApi, type CxpCuenta, type CategoriaCxp, type LibroGastoItem } from '@/api/pagosCxp'
import { pagosApi, type Proveedor } from '@/api/pagos'
import { pagosGastosDirectosApi, type GastoDirectoPayload, type MetodoPagoGastoDirecto } from '@/api/pagosGastosDirectos'
import { invalidateBalanceTesoreria } from '@/hooks/useBalanceTesoreria'
import { CuentasBancariasTab } from './CuentasBancariasTab'
import { ImpuestosInfoTab } from './ImpuestosInfoTab'
import { InversionPlantaTab } from './InversionPlantaTab'
import { CuentaBancariaSelect } from '@/components/common/CatalogSelectors'
import { ComprobanteInput } from '@/components/common/ComprobanteInput'
import { useCuentasBancarias } from '@/hooks/useCuentasBancarias'
import { abrirUrl } from '@/utils/safeUrl'

const CATEGORIA_GASTO_DIRECTO = 'Gasto Directo'

// Igual que en Anticipos: los transportadores de mula no se pagan desde finanzas genérico.
const CATEGORIA_MULA = 'Transporte_Mula'
function useProveedoresPagables() {
  const [data, setData] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  return useMemo(() => data.filter(p => p.categoria !== CATEGORIA_MULA), [data])
}

const cop = formatCOP

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',    cls: 'badge--success' },
  parcial:   { label: 'Parcial',   cls: 'badge--info'    },
  pendiente: { label: 'Pendiente', cls: 'badge--warning' },
}

// Juliana solo paga proveedores desde este listado genérico — mineros y dueños de
// volqueta ya tienen su módulo dedicado (Pago de material / Flete / Agua). Los
// transportadores de mula, aunque técnicamente son proveedores, tampoco se pagan
// aquí: van solo por el módulo dedicado de Pago de mulas (cascada por proveedor).
function puedePagarAqui(c: CxpCuenta): boolean {
  return c.id_proveedor != null && (c.categoria ?? '').toLowerCase() !== 'mula'
}

function useCategoriasCxp() {
  const [data, setData] = useState<CategoriaCxp[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosCxpApi.getCategorias().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

type PageTab = 'cuentas' | 'categorias' | 'gastos' | 'cuentas_bancarias' | 'impuestos' | 'inversion'

export function CxPApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const [tab, setTab] = useState<PageTab>('gastos')

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()

  const categorias = useCategoriasCxp()
  const proveedoresPagables = useProveedoresPagables()
  const [fCategoria, setFCategoria] = useState<number | ''>('')
  const [cuentaSubTab, setCuentaSubTab] = useState<'pendientes' | 'abonadas'>('pendientes')
  const [page, setPage] = useState(1)

  const [resp, setResp] = useState<{ cuentas: CxpCuenta[]; pagination: { page: number; limit: number; total: number; total_pages: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxpApi.getMensual({ mes, anio, id_categoria: fCategoria || undefined, estado: cuentaSubTab === 'abonadas' ? 'pagado' : undefined, page, limit: 50 })
      .then(setResp)
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio, fCategoria, cuentaSubTab, page])
  useEffect(() => { setPage(1) }, [mes, anio, fCategoria, cuentaSubTab])
  useEffect(() => { load() }, [load])

  // En "Pendientes" el backend trae todos los estados (igual que antes con el
  // filtro "Todos") — se ocultan las ya pagadas acá para no duplicar con la
  // pestaña "Abonadas", que sí filtra por estado=pagado en el servidor.
  const cuentas = useMemo(() => {
    const todas = resp?.cuentas ?? []
    return cuentaSubTab === 'pendientes' ? todas.filter(c => c.estado !== 'pagado') : todas
  }, [resp, cuentaSubTab])
  const totales = useMemo(() => ({
    total: cuentas.reduce((s, c) => s + num(c.valor_total), 0),
    pagado: cuentas.reduce((s, c) => s + num(c.valor_pagado), 0),
    saldo: cuentas.reduce((s, c) => s + num(c.saldo), 0),
  }), [cuentas])

  // ── Nueva cuenta suelta ──────────────────────────────────────
  const [nuevaModal, setNuevaModal] = useState(false)
  const [nForm, setNForm] = useState({ id_proveedor: '' as number | '', concepto: '', valor_total: '', id_categoria: '' as number | '', fecha_creacion: todayISO() })
  const [savingNueva, setSavingNueva] = useState(false)
  const abrirNueva = () => { setNForm({ id_proveedor: '', concepto: '', valor_total: '', id_categoria: '', fecha_creacion: todayISO() }); setNuevaModal(true) }
  const guardarNueva = async () => {
    if (nForm.id_proveedor === '') { toast.error('Selecciona el proveedor'); return }
    if (!nForm.concepto.trim() || !(Number(nForm.valor_total) > 0)) { toast.error('Concepto y valor son obligatorios'); return }
    setSavingNueva(true)
    try {
      await pagosCxpApi.crear({
        id_proveedor: nForm.id_proveedor,
        concepto: nForm.concepto.trim(), valor_total: Number(nForm.valor_total),
        id_categoria: nForm.id_categoria === '' ? undefined : nForm.id_categoria,
        fecha_creacion: nForm.fecha_creacion || undefined,
      })
      toast.success('Cuenta creada'); setNuevaModal(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingNueva(false) }
  }

  // ── Pagar (pago rápido, sin abono individual) ─────────────────
  const [pagoTarget, setPagoTarget] = useState<CxpCuenta | null>(null)
  const [pagoValor, setPagoValor] = useState('')
  const [savingPago, setSavingPago] = useState(false)
  const abrirPago = (c: CxpCuenta) => { setPagoTarget(c); setPagoValor(String(num(c.saldo))) }
  const guardarPago = async () => {
    if (!pagoTarget) return
    const valor = Number(pagoValor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingPago(true)
    try {
      await pagosCxpApi.pagar(pagoTarget.id, valor)
      toast.success('Pago registrado'); setPagoTarget(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingPago(false) }
  }

  return (
    <div className="page">
      <PageHeader
        title="Gastos"
        subtitle="Dinero que sale: gastos reales ya pagados, cuentas por pagar pendientes y sus categorías."
        actions={canWrite && tab === 'cuentas' && <Button icon={<Plus size={18} />} onClick={abrirNueva}>Nueva cuenta suelta</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'gastos'} className={`segment__btn ${tab === 'gastos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('gastos')}>Gastos</button>
        <button role="tab" aria-selected={tab === 'cuentas'} className={`segment__btn ${tab === 'cuentas' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas')}>Cuentas</button>
        <button role="tab" aria-selected={tab === 'categorias'} className={`segment__btn ${tab === 'categorias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
        <button role="tab" aria-selected={tab === 'cuentas_bancarias'} className={`segment__btn ${tab === 'cuentas_bancarias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas_bancarias')}>Cuentas bancarias</button>
        <button role="tab" aria-selected={tab === 'impuestos'} className={`segment__btn ${tab === 'impuestos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('impuestos')}>Impuestos</button>
        <button role="tab" aria-selected={tab === 'inversion'} className={`segment__btn ${tab === 'inversion' ? 'segment__btn--active' : ''}`} onClick={() => setTab('inversion')}>Inversión Planta</button>
      </div>

      {tab === 'impuestos' && <ImpuestosInfoTab modulo="gastos" />}

      {tab === 'cuentas' && (
        <>
          <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
            <span>
              Este listado es genérico: junta las CxP de <strong>todos</strong> los módulos, pero desde aquí solo se puede pagar a <strong>proveedores</strong>.
              Mineros y dueños de volqueta se pagan desde su módulo dedicado (Pago de material / Flete / Agua), y los transportadores de mula —aunque
              son proveedores— solo se pagan desde Pago de mulas, para no saltarse esa cascada. "Pagar" aquí suma directo al saldo, sin dejar
              historial de abonos individuales — úsalo solo para cuentas sueltas de proveedor sin módulo propio.
            </span>
          </div>

          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Cuentas" value={cuentas.length} icon={<Wallet size={16} />} accent="emerald" />
            <KpiTile label="Total"   value={cop(totales.total)} accent="green" />
            <KpiTile label="Pagado"  value={cop(totales.pagado)} accent="brown" />
            <KpiTile label="Saldo"   value={cop(totales.saldo)} accent="rose" />
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
              {categorias.data.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <div className="segment" role="tablist" style={{ padding: '0.15rem' }}>
              <button role="tab" aria-selected={cuentaSubTab === 'pendientes'} className={`segment__btn ${cuentaSubTab === 'pendientes' ? 'segment__btn--active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--fs-sm)', minHeight: 'auto' }} onClick={() => setCuentaSubTab('pendientes')}>Pendientes</button>
              <button role="tab" aria-selected={cuentaSubTab === 'abonadas'} className={`segment__btn ${cuentaSubTab === 'abonadas' ? 'segment__btn--active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--fs-sm)', minHeight: 'auto' }} onClick={() => setCuentaSubTab('abonadas')}>Abonadas</button>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
          </div>

          <Card title={`Cuentas por pagar — ${cuentaSubTab === 'abonadas' ? 'Abonadas' : 'Pendientes'} (${cuentas.length})`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th style={{ minWidth: '16rem' }}>Concepto</th>
                  <th style={{ textAlign: 'right', minWidth: '10rem' }}>Saldo · Total</th>
                  <th style={{ minWidth: '8rem' }}>Estado · Fecha</th>
                  {canWrite && <th style={{ minWidth: '8rem' }}></th>}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
                  ) : error ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                      {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                    </td></tr>
                  ) : cuentas.length === 0 ? (
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Sin cuentas {cuentaSubTab === 'abonadas' ? 'abonadas' : 'pendientes'} para {MESES[mes - 1]} {anio}.
                    </td></tr>
                  ) : cuentas.map(c => {
                    const eb = ESTADO_BADGE[c.estado] ?? { label: c.estado, cls: 'badge--neutral' }
                    const saldo = num(c.saldo)
                    const pct = num(c.valor_total) > 0 ? Math.min(num(c.valor_pagado) / num(c.valor_total), 1) : (num(c.valor_pagado) > 0 ? 1 : 0)
                    return (
                      <tr key={c.id}>
                        {/* Concepto + categoría + beneficiario */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{c.concepto || `Cuenta #${c.id}`}</span>
                            {c.categoria && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{c.categoria}</span>}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{c.beneficiario ?? '—'}</div>
                        </td>

                        {/* Saldo + total/pagado + barra */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 'var(--fs-base)', color: saldo > 0.01 ? '#b45309' : '#15803d' }} className="mono">
                            {saldo > 0.01 ? cop(saldo) : 'Al día'}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">
                            de {cop(num(c.valor_total))} · pagado {cop(num(c.valor_pagado))}
                          </div>
                          <div style={{ height: 3, background: 'var(--slate-100, #f1f5f9)', borderRadius: 999, marginTop: '0.3rem', width: '6rem', marginLeft: 'auto' }}>
                            <div style={{ height: '100%', width: `${pct * 100}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 999 }} />
                          </div>
                        </td>

                        {/* Estado + fecha */}
                        <td>
                          <span className={`badge ${eb.cls}`}>{eb.label}</span>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
                            {c.fecha_creacion ? formatDate(c.fecha_creacion) : '—'}
                          </div>
                        </td>

                        {canWrite && (
                          <td>
                            {saldo > 0.01 && (
                              puedePagarAqui(c) ? (
                                <Button size="sm" icon={<Banknote size={13} />} onClick={() => abrirPago(c)}>Pagar</Button>
                              ) : (
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} title="Este tipo de cuenta se paga desde su módulo dedicado">
                                  Módulo dedicado
                                </span>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
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

      {tab === 'categorias' && <CategoriasCxpTab canWrite={canWrite} categorias={categorias} />}

      {tab === 'gastos' && <LibroGastosTab canWrite={canWrite} />}

      {tab === 'cuentas_bancarias' && <CuentasBancariasTab canWrite={canWrite} />}

      {tab === 'inversion' && <InversionPlantaTab canWrite={canWrite} />}

      {/* ── Modal: Nueva cuenta suelta ── */}
      <Modal open={nuevaModal} title="Nueva cuenta por pagar a proveedor (suelta)" onClose={() => setNuevaModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setNuevaModal(false)}>Cancelar</Button>
          <Button onClick={guardarNueva} disabled={savingNueva || nForm.id_proveedor === '' || !nForm.concepto.trim() || !(Number(nForm.valor_total) > 0)}>{savingNueva ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="grid grid--form">
          <Select label="Proveedor" required placeholder="— Seleccionar —" style={{ gridColumn: '1 / -1' }}
            helper="Los transportadores de mula no aparecen aquí — usa Pago de mulas."
            value={nForm.id_proveedor === '' ? '' : String(nForm.id_proveedor)}
            onChange={e => setNForm(s => ({ ...s, id_proveedor: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={proveedoresPagables.map(p => ({ value: String(p.id), label: p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre }))} />
          <Input label="Concepto" required style={{ gridColumn: '1 / -1' }} value={nForm.concepto} onChange={e => setNForm(s => ({ ...s, concepto: e.target.value }))} />
          <Input label="Valor" type="number" mono step="1000" required value={nForm.valor_total} onChange={e => setNForm(s => ({ ...s, valor_total: e.target.value }))} />
          <Select label="Categoría (opcional)" placeholder="— Sin categoría —" value={nForm.id_categoria === '' ? '' : String(nForm.id_categoria)}
            onChange={e => setNForm(s => ({ ...s, id_categoria: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={categorias.data.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={nForm.fecha_creacion} onChange={e => setNForm(s => ({ ...s, fecha_creacion: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Pagar ── */}
      <Modal open={pagoTarget != null} title={`Pagar — ${pagoTarget?.concepto ?? ''}`} onClose={() => setPagoTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setPagoTarget(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarPago} disabled={savingPago || !(Number(pagoValor) > 0)}>{savingPago ? 'Guardando…' : 'Registrar pago'}</Button>
        </>}>
        {pagoTarget && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente: <strong style={{ color: 'var(--rose-700)' }}>{cop(num(pagoTarget.saldo))}</strong>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              Este pago se suma directo al saldo — no queda registrado como un abono individual con comprobante.
            </div>
          </div>
        )}
        <Input label="Valor a pagar" type="number" mono step="1000" required value={pagoValor} onChange={e => setPagoValor(e.target.value)} />
      </Modal>
    </div>
  )
}

// ── Gastos (Libro de Gastos) ──────────────────────────────────────
// Ledger transaccional de TODOS los módulos (material/flete/agua/mulas/
// alquiler/nómina/préstamos/gasto directo…) vía /pagos/vistas/libro-gastos —
// cualquier CxP con abono ya es un gasto real, sin importar la categoría.
// "Gasto directo" (antes Caja Menor) no es un caso especial: es solo una CxP
// + su abono creados en el mismo paso, por eso ya aparece aquí solo.
const METODO_GASTO_OPTS: { value: MetodoPagoGastoDirecto; label: string }[] = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi',         label: 'Nequi' },
  { value: 'deposito',      label: 'Depósito' },
  { value: 'otro',          label: 'Otro' },
]
const emptyGastoDirectoForm = () => ({ concepto: '', monto: '', comprobante: null as File | null, fecha: todayISO(), metodo_pago: 'efectivo' as MetodoPagoGastoDirecto, observaciones: '', id_cuenta_bancaria: '' as number | '' })

function colorCategoria(categoria: string, color?: string | null, idx = 0): string {
  if (color) return color
  let hash = 0
  for (let i = 0; i < categoria.length; i++) hash = (hash * 31 + categoria.charCodeAt(i)) | 0
  return CHART_COLORS[Math.abs(hash || idx) % CHART_COLORS.length]
}

function LibroGastosTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const [fCategoria, setFCategoria] = useState('')
  const [fCuentaBancaria, setFCuentaBancaria] = useState<number | ''>('')
  const cuentasBancarias = useCuentasBancarias()
  const [data, setData] = useState<LibroGastoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxpApi.getLibroGastos(mes, anio, fCuentaBancaria || undefined)
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio, fCuentaBancaria])
  useEffect(() => { load() }, [load])

  // El `id` que trae /pagos/vistas/libro-gastos para una fila "Gasto Directo"
  // es en realidad el id del Abono_CxP (`id_abono`), no el id real del gasto
  // directo — PATCH/DELETE contra /pagos/gastos-directos/:id con ese id dan
  // 404 (confirmado en vivo). Hay que cruzar por `id_abono` para resolverlo.
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`
  const [idRealPorAbono, setIdRealPorAbono] = useState<Map<number, number>>(new Map())
  const [idsListos, setIdsListos] = useState(false)
  useEffect(() => {
    setIdsListos(false)
    pagosGastosDirectosApi.listar({ desde, hasta })
      .then(r => setIdRealPorAbono(new Map((Array.isArray(r) ? r : []).map(gd => [gd.id_abono, gd.id]))))
      .catch(() => setIdRealPorAbono(new Map()))
      .finally(() => setIdsListos(true))
  }, [desde, hasta])

  // ⚠️ Bug de backend detectado en vivo (2026-10-23): /pagos/vistas/libro-gastos
  // (y también /pagos/vistas/flujo-caja) NO excluyen un Gasto Directo anulado —
  // sigue apareciendo con su monto completo aunque DELETE ya lo haya borrado de
  // /pagos/gastos-directos. Se filtra acá cruzando contra esa lista real (sí la
  // excluye) para que esta tabla y su total no muestren gastos anulados; el
  // balance del TopBar (que lee flujo-caja directo) sigue mal hasta que el
  // backend lo corrija — no se puede arreglar desde el front.
  const visibles = useMemo(() => {
    if (!idsListos) return data
    return data.filter(g => g.categoria !== CATEGORIA_GASTO_DIRECTO || idRealPorAbono.has(g.id))
  }, [data, idsListos, idRealPorAbono])

  const categoriasPresentes = useMemo(() => Array.from(new Set(visibles.map(g => g.categoria))).sort(), [visibles])
  const filtrados = useMemo(() => fCategoria ? visibles.filter(g => g.categoria === fCategoria) : visibles, [visibles, fCategoria])
  const total = useMemo(() => filtrados.reduce((s, g) => s + num(g.monto), 0), [filtrados])

  // ── Nuevo gasto directo ──────────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | LibroGastoItem>(null)
  const [form, setForm] = useState(emptyGastoDirectoForm())
  const [saving, setSaving] = useState(false)
  const abrirNuevo = () => { setForm(emptyGastoDirectoForm()); setModal('nuevo') }
  const abrirEdit = (g: LibroGastoItem) => {
    const idReal = idRealPorAbono.get(g.id)
    if (idReal == null) { toast.error('No se pudo identificar este gasto directo — refresca e intenta de nuevo.'); return }
    setForm({ concepto: g.concepto, monto: String(num(g.monto)), comprobante: null, fecha: g.fecha.slice(0, 10), metodo_pago: g.metodo_pago as MetodoPagoGastoDirecto, observaciones: g.observaciones ?? '', id_cuenta_bancaria: '' })
    setModal({ ...g, id: idReal })
  }
  const guardar = async () => {
    if (!form.concepto.trim() || !(Number(form.monto) > 0)) {
      toast.error('Concepto y monto son obligatorios'); return
    }
    const body: GastoDirectoPayload = {
      concepto: form.concepto.trim(), monto: Number(form.monto),
      fecha: form.fecha || undefined, metodo_pago: form.metodo_pago, observaciones: form.observaciones.trim() || undefined,
      id_cuenta_bancaria: form.metodo_pago === 'efectivo' || form.id_cuenta_bancaria === '' ? undefined : form.id_cuenta_bancaria,
    }
    setSaving(true)
    try {
      if (modal === 'nuevo') { await pagosGastosDirectosApi.crear(body, form.comprobante); toast.success('Gasto directo registrado') }
      else if (modal) { await pagosGastosDirectosApi.actualizar(modal.id, body, form.comprobante); toast.success('Gasto directo actualizado') }
      setModal(null); load(); invalidateBalanceTesoreria()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [delGasto, setDelGasto] = useState<LibroGastoItem | null>(null)
  const [anulando, setAnulando] = useState(false)
  const confirmAnular = async () => {
    if (!delGasto) return
    setAnulando(true)
    try { await pagosGastosDirectosApi.anular(delGasto.id); toast.success('Gasto directo anulado'); setDelGasto(null); load(); invalidateBalanceTesoreria() }
    catch (e) { toast.error(apiError(e).message); setDelGasto(null) } finally { setAnulando(false) }
  }

  return (
    <>
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
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categoriasPresentes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCuentaBancaria}
          onChange={e => setFCuentaBancaria(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas las cuentas</option>
          {cuentasBancarias.data.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrirNuevo} style={{ marginLeft: 'auto' }}>Nuevo gasto directo</Button>}
      </div>

      <Card title={`Gastos de ${MESES[mes - 1]} ${anio} (${filtrados.length})`} actions={<strong className="mono">Total: {cop(total)}</strong>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Fecha</th><th>Categoría</th><th style={{ minWidth: '14rem' }}>Concepto</th><th>Beneficiario</th><th>Cuenta bancaria</th>
              <th style={{ textAlign: 'right' }}>Monto</th><th>Comprobante</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin gastos para {MESES[mes - 1]} {anio}.</td></tr>
              ) : filtrados.map((g, i) => (
                <tr key={g.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(g.fecha)}</td>
                  <td><span className="badge" style={{ background: colorCategoria(g.categoria, g.color, i) + '22', color: colorCategoria(g.categoria, g.color, i) }}>{g.categoria}</span></td>
                  <td>{g.concepto}</td>
                  <td style={{ color: 'var(--text-faint)' }}>{g.beneficiario ?? '—'}</td>
                  <td style={{ color: 'var(--text-faint)' }}>{g.cuenta_bancaria ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--rose-600)' }} className="mono">{cop(num(g.monto))}</td>
                  <td>
                    {g.comprobante_url
                      ? <Button variant="ghost" size="sm" icon={<FileText size={13} />} onClick={() => abrirUrl(g.comprobante_url)} />
                      : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  {canWrite && (
                    <td>
                      {g.categoria === CATEGORIA_GASTO_DIRECTO && (
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => abrirEdit(g)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => {
                            const idReal = idRealPorAbono.get(g.id)
                            if (idReal == null) { toast.error('No se pudo identificar este gasto directo — refresca e intenta de nuevo.'); return }
                            setDelGasto({ ...g, id: idReal })
                          }} />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal: Nuevo/editar gasto directo ── */}
      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo gasto directo' : 'Editar gasto directo'} onClose={() => setModal(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || !form.concepto.trim() || !(Number(form.monto) > 0)}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
          Gasto ya pagado en el momento (parqueadero, peaje, lavado…) — se crea como cuenta por pagar ya cancelada, con su abono, en un solo paso.
        </div>
        <div className="grid grid--form">
          <Input label="Concepto" required style={{ gridColumn: '1 / -1' }} placeholder="Peaje, parqueadero, lavado de volqueta…" value={form.concepto} onChange={e => setForm(s => ({ ...s, concepto: e.target.value }))} />
          <Input label="Monto" type="number" mono step="1000" required value={form.monto} onChange={e => setForm(s => ({ ...s, monto: e.target.value }))} />
          <Select label="Método de pago" value={form.metodo_pago} onChange={e => setForm(s => ({ ...s, metodo_pago: e.target.value as MetodoPagoGastoDirecto }))} options={METODO_GASTO_OPTS} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          {form.metodo_pago !== 'efectivo' && (
            <CuentaBancariaSelect value={form.id_cuenta_bancaria} onChange={id => setForm(s => ({ ...s, id_cuenta_bancaria: id }))}
              helper="Si la cuenta no está exenta, el banco cobra el 4×1000 automático sobre este monto." />
          )}
          <ComprobanteInput style={{ gridColumn: '1 / -1' }} value={form.comprobante}
            existingUrl={modal && modal !== 'nuevo' ? modal.comprobante_url : null}
            onChange={file => setForm(s => ({ ...s, comprobante: file }))} />
          <Input label="Observaciones (opcional)" style={{ gridColumn: '1 / -1' }} value={form.observaciones} onChange={e => setForm(s => ({ ...s, observaciones: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delGasto} title="Anular gasto directo" itemLabel={delGasto?.concepto} loading={anulando} onCancel={() => setDelGasto(null)} onConfirm={confirmAnular} />
    </>
  )
}

// ── Categorías ──────────────────────────────────────────────────
function CategoriasCxpTab({ canWrite, categorias }: { canWrite: boolean; categorias: ReturnType<typeof useCategoriasCxp> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nueva' | CategoriaCxp>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const openNueva = () => { setNombre(''); setModal('nueva') }
  const openEdit = (c: CategoriaCxp) => { setNombre(c.nombre); setModal(c) }
  const save = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nueva') { await pagosCxpApi.createCategoria(nombre.trim()); toast.success('Categoría creada') }
      else if (modal) { await pagosCxpApi.updateCategoria(modal.id, nombre.trim()); toast.success('Categoría actualizada') }
      setModal(null); categorias.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delCat, setDelCat] = useState<CategoriaCxp | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delCat) return
    setDeleting(true)
    try { await pagosCxpApi.deleteCategoria(delCat.id); toast.success('Categoría eliminada'); setDelCat(null); categorias.reload() }
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
