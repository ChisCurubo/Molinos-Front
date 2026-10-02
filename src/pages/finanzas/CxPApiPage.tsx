import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosCxpApi, type CxpCuenta, type CategoriaCxp } from '@/api/pagosCxp'
import { pagosApi, type Proveedor } from '@/api/pagos'

// Igual que en Anticipos: los transportadores de mula no se pagan desde finanzas genérico.
const CATEGORIA_MULA = 'Transporte_Mula'
function useProveedoresPagables() {
  const [data, setData] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  return useMemo(() => data.filter(p => p.categoria !== CATEGORIA_MULA), [data])
}

const cop = formatCOP

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_OPTS = [
  { value: 'todos',     label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial',   label: 'Parcial' },
  { value: 'pagado',    label: 'Pagado' },
]
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

type PageTab = 'cuentas' | 'categorias'

export function CxPApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const [tab, setTab] = useState<PageTab>('cuentas')

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
  const [fEstado, setFEstado] = useState('todos')
  const [page, setPage] = useState(1)

  const [resp, setResp] = useState<{ cuentas: CxpCuenta[]; pagination: { page: number; limit: number; total: number; total_pages: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxpApi.getMensual({ mes, anio, id_categoria: fCategoria || undefined, estado: fEstado !== 'todos' ? fEstado : undefined, page, limit: 50 })
      .then(setResp)
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio, fCategoria, fEstado, page])
  useEffect(() => { setPage(1) }, [mes, anio, fCategoria, fEstado])
  useEffect(() => { load() }, [load])

  const cuentas = resp?.cuentas ?? []
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
        title="Cuentas por pagar"
        subtitle="Listado maestro de CxP de todos los módulos (Material, Flete, Agua, Mulas, Anticipos…) por mes."
        actions={canWrite && tab === 'cuentas' && <Button icon={<Plus size={18} />} onClick={abrirNueva}>Nueva cuenta suelta</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
        <span>
          Este listado es genérico: junta las CxP de <strong>todos</strong> los módulos, pero desde aquí solo se puede pagar a <strong>proveedores</strong>.
          Mineros y dueños de volqueta se pagan desde su módulo dedicado (Pago de material / Flete / Agua), y los transportadores de mula —aunque
          son proveedores— solo se pagan desde Pago de mulas, para no saltarse esa cascada. "Pagar" aquí suma directo al saldo, sin dejar
          historial de abonos individuales — úsalo solo para cuentas sueltas de proveedor sin módulo propio.
        </span>
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'cuentas'} className={`segment__btn ${tab === 'cuentas' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas')}>Cuentas</button>
        <button role="tab" aria-selected={tab === 'categorias'} className={`segment__btn ${tab === 'categorias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
      </div>

      {tab === 'cuentas' && (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Cuentas" value={resp?.pagination.total ?? 0} icon={<Wallet size={16} />} accent="emerald" />
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
            <select className="field__select" style={{ maxWidth: '11rem' }} value={fEstado} onChange={e => setFEstado(e.target.value)}>
              {ESTADO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
          </div>

          <Card title={`Cuentas por pagar (${resp?.pagination.total ?? 0})`}>
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
                    <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin cuentas para {MESES[mes - 1]} {anio}.</td></tr>
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
