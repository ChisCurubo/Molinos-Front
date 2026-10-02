import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircleDollarSign, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { getCatalogos, type CatalogosMinero, type CatalogosDueno } from '@/api/catalogos'
import { pagosApi, type Proveedor, type CategoriaProveedor } from '@/api/pagos'
import {
  pagosAnticiposApi,
  type Anticipo, type AnticipoDetalle, type TerceroAnticipo,
} from '@/api/pagosAnticipos'

const cop = formatCOP

// Los proveedores de transporte de mula se pagan solo desde el módulo dedicado
// (Pago de mulas, bajo Materiales — fuera del alcance de Juliana/finanzas): no
// se pueden elegir para un anticipo NUEVO, aunque si ya tienen uno histórico sí
// se ve en el listado (visibilidad completa de saldo a favor por tercero).
const CATEGORIA_MULA = 'Transporte_Mula'

const TERCERO_OPTS: { value: TerceroAnticipo; label: string }[] = [
  { value: 'minero',         label: 'Minero' },
  { value: 'dueno_volqueta', label: 'Dueño de volqueta' },
  { value: 'proveedor',      label: 'Proveedor' },
]
const TERCERO_LABEL = (t: string) => TERCERO_OPTS.find(o => o.value === t)?.label ?? t
const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  activo:  { label: 'Activo',  cls: 'badge--warning' },
  usado:   { label: 'Usado',   cls: 'badge--success' },
  anulado: { label: 'Anulado', cls: 'badge--neutral' },
}
const METODO_OPTS = [
  { value: 'efectivo',       label: 'Efectivo' },
  { value: 'transferencia',  label: 'Transferencia' },
  { value: 'nequi',          label: 'Nequi' },
  { value: 'consignacion',   label: 'Consignación' },
  { value: 'otro',           label: 'Otro' },
]

// ── Catálogo combinado de terceros — visibilidad completa (minero + dueño + proveedor) ──
function useTerceros() {
  const [mineros, setMineros] = useState<CatalogosMinero[]>([])
  const [duenos, setDuenos] = useState<CatalogosDueno[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [categoriasProveedor, setCategoriasProveedor] = useState<CategoriaProveedor[]>([])
  useEffect(() => {
    getCatalogos().then(c => { setMineros(c.mineros ?? []); setDuenos(c.duenos ?? []) }).catch(() => {})
    pagosApi.getProveedores().then(r => setProveedores(Array.isArray(r) ? r : [])).catch(() => {})
    pagosApi.getCategoriasProveedor().then(r => setCategoriasProveedor(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const nombreDe = useCallback((tercero: TerceroAnticipo, id: number): string => {
    if (tercero === 'minero') return mineros.find(m => m.id === id)?.nombre ?? `Minero #${id}`
    if (tercero === 'dueno_volqueta') return duenos.find(d => d.id === id)?.nombre ?? `Dueño #${id}`
    return proveedores.find(p => p.id === id)?.nombre ?? `Proveedor #${id}`
  }, [mineros, duenos, proveedores])

  // Solo para CREAR: proveedores sin los transportadores de mula.
  const proveedoresPagables = useMemo(() => proveedores.filter(p => p.categoria !== CATEGORIA_MULA), [proveedores])
  const opcionesProveedorPagable = useMemo(
    () => proveedoresPagables.map(p => ({ value: String(p.id), label: p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre })),
    [proveedoresPagables]
  )

  // Categoría del proveedor dueño de un id (para filtrar el listado).
  const categoriaProveedorDe = useCallback((idProveedor: number) => proveedores.find(p => p.id === idProveedor)?.id_categoria ?? null, [proveedores])

  return { mineros, duenos, proveedores, categoriasProveedor, nombreDe, opcionesProveedorPagable, categoriaProveedorDe }
}

interface NuevoForm {
  id: number | ''
  monto: string
  comprobante_url: string
  fecha: string
  metodo_pago: string
  descripcion: string
  observaciones: string
}
const emptyNuevo = (): NuevoForm => ({ id: '', monto: '', comprobante_url: '', fecha: todayISO(), metodo_pago: 'efectivo', descripcion: '', observaciones: '' })

export function AnticiposApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const terceros = useTerceros()

  const [fTercero, setFTercero] = useState<TerceroAnticipo | 'todos'>('todos')
  const [fCategoriaProveedor, setFCategoriaProveedor] = useState<number | ''>('')
  const [fEstado, setFEstado] = useState<'todos' | string>('todos')

  const [data, setData] = useState<Anticipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosAnticiposApi.listar({ tercero: fTercero !== 'todos' ? fTercero : undefined, estado: fEstado !== 'todos' ? fEstado : undefined })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [fTercero, fEstado])
  useEffect(() => { load() }, [load])

  // Filtro por categoría de proveedor — el backend no lo soporta, se aplica en cliente.
  const dataFiltrada = useMemo(() => {
    if (fTercero !== 'proveedor' || fCategoriaProveedor === '') return data
    return data.filter(a => terceros.categoriaProveedorDe(a.id_tercero) === fCategoriaProveedor)
  }, [data, fTercero, fCategoriaProveedor, terceros])

  const kpis = useMemo(() => ({
    total: dataFiltrada.length,
    monto: dataFiltrada.reduce((s, a) => s + num(a.monto), 0),
    disponible: dataFiltrada.reduce((s, a) => s + (a.saldo_disponible != null ? num(a.saldo_disponible) : Math.max(0, num(a.monto) - num(a.monto_usado))), 0),
  }), [dataFiltrada])

  // ── Nuevo anticipo (solo proveedores, sin transportadores de mula) ──────
  const [nuevoModal, setNuevoModal] = useState(false)
  const [form, setForm] = useState<NuevoForm>(emptyNuevo())
  const [saving, setSaving] = useState(false)
  const abrirNuevo = () => { setForm(emptyNuevo()); setNuevoModal(true) }
  const guardar = async () => {
    if (form.id === '') { toast.error('Selecciona el proveedor'); return }
    if (!(Number(form.monto) > 0)) { toast.error('El monto debe ser mayor a 0'); return }
    if (!form.comprobante_url.trim()) { toast.error('El comprobante es obligatorio'); return }
    setSaving(true)
    try {
      await pagosAnticiposApi.crear({
        tercero: 'proveedor', id: Number(form.id), monto: Number(form.monto),
        comprobante_url: form.comprobante_url.trim(), fecha: form.fecha || undefined,
        metodo_pago: form.metodo_pago || undefined,
        descripcion: form.descripcion.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      })
      toast.success('Anticipo registrado'); setNuevoModal(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Detalle ─────────────────────────────────────────────────
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<AnticipoDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const abrirDetalle = async (a: Anticipo) => {
    setDetalleId(a.id); setDetalle(null); setLoadingDetalle(true)
    try { setDetalle(await pagosAnticiposApi.getDetalle(a.id)) }
    catch (e) { toast.error(apiError(e).message) } finally { setLoadingDetalle(false) }
  }

  // ── Anular ──────────────────────────────────────────────────
  const [delTarget, setDelTarget] = useState<Anticipo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmAnular = async () => {
    if (!delTarget) return
    setDeleting(true)
    try { await pagosAnticiposApi.anular(delTarget.id); toast.success('Anticipo anulado'); setDelTarget(null); load() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este anticipo ya tiene descuentos aplicados y no se puede anular.' : message)
      setDelTarget(null)
    } finally { setDeleting(false) }
  }

  return (
    <div className="page">
      <PageHeader
        title="Adelantos a terceros"
        subtitle="Saldo a favor y anticipos de mineros, dueños de volqueta y proveedores — solo se pueden registrar nuevos para proveedores."
        actions={canWrite && <Button icon={<Plus size={18} />} onClick={abrirNuevo}>Nuevo anticipo a proveedor</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
        <span>
          Esta vista muestra el saldo a favor y los anticipos de <strong>todos</strong> los terceros (minero, dueño de volqueta, proveedor),
          pero solo se pueden <strong>registrar nuevos anticipos a proveedores</strong> (ni mineros/dueños ni transportadores de mula
          aparecen al crear uno — esos últimos se manejan solo desde Pago de mulas). El descuento automático del saldo a favor contra pagos
          futuros todavía no está integrado en los módulos dedicados — hoy se aplica manualmente eligiendo "Saldo a favor" como método de
          pago en el abono correspondiente.
        </span>
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Anticipos" value={kpis.total} icon={<CircleDollarSign size={16} />} accent="emerald" />
        <KpiTile label="Monto total" value={cop(kpis.monto)} accent="green" />
        <KpiTile label="Saldo a favor" value={cop(kpis.disponible)} accent="rose" />
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <div className="segment">
          <button className={`segment__btn ${fTercero === 'todos' ? 'segment__btn--active' : ''}`} onClick={() => setFTercero('todos')}>Todos</button>
          {TERCERO_OPTS.map(o => (
            <button key={o.value} className={`segment__btn ${fTercero === o.value ? 'segment__btn--active' : ''}`} onClick={() => { setFTercero(o.value); if (o.value !== 'proveedor') setFCategoriaProveedor('') }}>{o.label}</button>
          ))}
        </div>
        {fTercero === 'proveedor' && (
          <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoriaProveedor} onChange={e => setFCategoriaProveedor(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Todas las categorías</option>
            {terceros.categoriasProveedor.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        <select className="field__select" style={{ maxWidth: '11rem' }} value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="usado">Usado</option>
          <option value="anulado">Anulado</option>
        </select>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
      </div>

      <Card title={`Anticipos (${dataFiltrada.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th style={{ minWidth: '14rem' }}>Tercero</th>
              <th style={{ textAlign: 'right', minWidth: '11rem' }}>Saldo a favor · Monto</th>
              <th style={{ minWidth: '8rem' }}>Estado · Fecha</th>
              {canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : dataFiltrada.length === 0 ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin anticipos registrados.</td></tr>
              ) : dataFiltrada.map(a => {
                const disponible = a.saldo_disponible != null ? num(a.saldo_disponible) : Math.max(0, num(a.monto) - num(a.monto_usado))
                const eb = ESTADO_BADGE[a.estado ?? 'activo'] ?? { label: a.estado ?? '—', cls: 'badge--neutral' }
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <button className="link-btn" style={{ fontWeight: 600 }} onClick={() => abrirDetalle(a)}>
                          {a.tercero_nombre ?? terceros.nombreDe(a.tercero, a.id_tercero)}
                        </button>
                        <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{TERCERO_LABEL(a.tercero)}</span>
                      </div>
                      {a.descripcion && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{a.descripcion}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#15803d' }} className="mono">{cop(disponible)}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">de {cop(num(a.monto))} · usado {cop(num(a.monto_usado))}</div>
                    </td>
                    <td>
                      <span className={`badge ${eb.cls}`}>{eb.label}</span>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>{a.fecha ? formatDate(a.fecha) : '—'}</div>
                    </td>
                    {canWrite && (
                      <td>
                        {num(a.monto_usado) === 0 && a.estado !== 'anulado' && (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} title="Anular" onClick={() => setDelTarget(a)} />
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

      {/* ── Modal: Nuevo anticipo (solo proveedor) ── */}
      <Modal open={nuevoModal} title="Nuevo anticipo a proveedor" onClose={() => setNuevoModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setNuevoModal(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || form.id === '' || !(Number(form.monto) > 0) || !form.comprobante_url.trim()}>{saving ? 'Guardando…' : 'Registrar anticipo'}</Button>
        </>}>
        <div className="grid grid--form">
          <Select label="Proveedor" required value={form.id === '' ? '' : String(form.id)}
            onChange={e => setForm(s => ({ ...s, id: e.target.value === '' ? '' : Number(e.target.value) }))}
            placeholder="— Seleccionar —"
            helper="Los transportadores de mula no aparecen en esta lista."
            options={terceros.opcionesProveedorPagable} />
          <Input label="Monto" type="number" mono step="1000" required value={form.monto} onChange={e => setForm(s => ({ ...s, monto: e.target.value }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS} value={form.metodo_pago} onChange={e => setForm(s => ({ ...s, metodo_pago: e.target.value }))} />
          <Input label="Comprobante (URL)" required placeholder="https://…/comprobante.png" value={form.comprobante_url} onChange={e => setForm(s => ({ ...s, comprobante_url: e.target.value }))} />
          <Input label="Descripción (opcional)" style={{ gridColumn: '1 / -1' }} value={form.descripcion} onChange={e => setForm(s => ({ ...s, descripcion: e.target.value }))} />
          <Input label="Observaciones (opcional)" style={{ gridColumn: '1 / -1' }} value={form.observaciones} onChange={e => setForm(s => ({ ...s, observaciones: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Detalle ── */}
      <Modal open={detalleId != null} title={detalle ? `Anticipo #${detalle.id}` : 'Anticipo'} onClose={() => { setDetalleId(null); setDetalle(null) }}>
        {loadingDetalle || !detalle ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando…</p>
        ) : (
          <>
            <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: 'var(--fs-sm)' }}>
              <span>Tercero: <strong>{detalle.tercero_nombre ?? terceros.nombreDe(detalle.tercero, detalle.id_tercero)}</strong> ({TERCERO_LABEL(detalle.tercero)})</span>
              <span>Monto: <strong>{cop(num(detalle.monto))}</strong></span>
              <span>Usado: <strong>{cop(num(detalle.monto_usado))}</strong></span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Descuentos aplicados ({detalle.descuentos?.length ?? 0})
            </div>
            {(detalle.descuentos?.length ?? 0) === 0 ? (
              <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin descuentos aplicados todavía — crédito completo disponible.</em>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                  <thead><tr><th>Fecha</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                  <tbody>
                    {detalle.descuentos!.map(d => (
                      <tr key={d.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(d.fecha)}</td>
                        <td>{d.concepto ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(d.valor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDeleteModal open={!!delTarget} title="Anular anticipo"
        itemLabel={delTarget ? `el anticipo de ${delTarget.tercero_nombre ?? terceros.nombreDe(delTarget.tercero, delTarget.id_tercero)}` : undefined}
        confirmWord="anular" confirmLabel="Anular definitivamente"
        loading={deleting} onCancel={() => setDelTarget(null)} onConfirm={confirmAnular} />
    </div>
  )
}
