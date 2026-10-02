import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FileText, HandCoins, ImageIcon, Pencil, Plus, RefreshCw, Trash2, Truck,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { materialApi, num, type ViajeDisponibleMula } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosApi, type Proveedor, type ProveedorPayload, type ProveedoresFiltro, type CategoriaProveedor } from '@/api/pagos'
import {
  pagosMulasApi,
  type MulaDespacho, type MulaDetalle, type MulasResumen, type AbonoMula,
  type MetodoPagoMula, type EstadoCuentaPago, type MulaViajeTrazabilidad,
} from '@/api/pagosMulas'

const cop = formatCOP

// ── Helpers período ───────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodoLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}
function periodoEndDate(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const METODO_OPTS: { value: MetodoPagoMula; label: string }[] = [
  { value: 'transferencia',     label: 'Transferencia' },
  { value: 'nequi',             label: 'Nequi' },
  { value: 'consignacion',      label: 'Consignación' },
  { value: 'efectivo',          label: 'Efectivo' },
  { value: 'descuento_nomina',  label: 'Descuento de nómina' },
  { value: 'otro',              label: 'Otro' },
]
const METODO_LABEL = (m: string | null | undefined) => METODO_OPTS.find(o => o.value === m)?.label ?? (m ?? '—')
const ESTADO_OPTS: { value: EstadoCuentaPago | 'todos'; label: string }[] = [
  { value: 'todos',    label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial',   label: 'Parcial' },
  { value: 'pagado',    label: 'Pagado' },
  { value: 'anulado',   label: 'Anulado' },
]
const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',    cls: 'badge--success' },
  parcial:   { label: 'Parcial',   cls: 'badge--info'    },
  pendiente: { label: 'Pendiente', cls: 'badge--warning' },
  anulado:   { label: 'Anulado',   cls: 'badge--neutral' },
}

// ── Comprobante: chip clicable (abre en pestaña nueva) o texto muted si no hay ──
function ComprobanteLink({ url }: { url?: string | null }) {
  if (!url) return <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin comprobante</span>
  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '0.2rem 0.55rem', borderRadius: 999,
        border: '1px solid #fde68a', background: '#fffbeb',
        color: 'var(--amber-700)', fontSize: 'var(--fs-xs)', fontWeight: 600,
        cursor: 'pointer', lineHeight: 1.4, whiteSpace: 'nowrap',
      }}
    >
      <FileText size={12} /> Ver comprobante
    </button>
  )
}

interface AbonoForm { valor: string; fecha_abono: string; metodo_pago: MetodoPagoMula; comprobante_url: string }
const emptyAbono = (valor = ''): AbonoForm => ({ valor, fecha_abono: todayISO(), metodo_pago: 'transferencia', comprobante_url: '' })

interface EditAbonoForm extends AbonoForm { observaciones: string }
const emptyEditAbono = (): EditAbonoForm => ({ ...emptyAbono(), observaciones: '' })

interface DespachoForm {
  id_proveedor: number | ''
  valor: string
  fecha: string
  id_viaje: string
  concepto: string
  factura_num: string
  foto_factura_url: string
}
const emptyDespacho = (idProveedor: number | '' = ''): DespachoForm => ({
  id_proveedor: idProveedor, valor: '', fecha: todayISO(),
  id_viaje: '', concepto: '', factura_num: '', foto_factura_url: '',
})

// ── Catálogo de proveedores (fetch local, sin caché compartida: solo esta página lo usa) ──
function useProveedores(filtro?: ProveedoresFiltro) {
  const [data, setData] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosApi.getProveedores(filtro)
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro?.id_categoria, filtro?.estado, filtro?.q])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function useCategoriasProveedor() {
  const [data, setData] = useState<CategoriaProveedor[]>([])
  useEffect(() => { pagosApi.getCategoriasProveedor().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  return data
}

function proveedorLabel(p: Proveedor) { return p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre }

function ProveedorSelect({ label = 'Proveedor', value, onChange, placeholder = '— Seleccionar proveedor —', required, disabled }: {
  label?: string; value: number | ''; onChange: (id: number | '') => void; placeholder?: string; required?: boolean; disabled?: boolean
}) {
  const { data, loading, error } = useProveedores()
  return (
    <Select
      label={label} required={required} disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={e => { const v = e.target.value; onChange(v === '' ? '' : Number(v)) }}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(p => ({ value: String(p.id), label: proveedorLabel(p) }))}
    />
  )
}

// ── Selector de viaje disponible para despachar (GET /material/viajes/disponibles-mula) ──
// Solo lista viajes `almacenado` con líneas cargadas. Al crear un despacho con id_viaje, el
// backend lo marca `despachado` y desaparece de aquí; al desvincular/borrar vuelve a aparecer.
function ViajeMulaSelect({ value, onChange, currentLabel }: {
  value: number | ''; onChange: (id: number | '') => void; currentLabel?: string
}) {
  const [data, setData] = useState<ViajeDisponibleMula[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    materialApi.getViajesDisponiblesMula()
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])

  const options = useMemo(() => {
    const opts = data.map(v => ({
      value: String(v.id),
      label: `${v.numero_viaje} · ${formatDate(v.fecha)} · ${num(v.toneladas_seco).toFixed(2)} t (${v.num_lineas} línea${v.num_lineas === 1 ? '' : 's'})`,
    }))
    // El viaje ya vinculado a este despacho no sale en "disponibles" (está despachado) — lo agregamos igual para que se vea seleccionado.
    if (value !== '' && !opts.some(o => o.value === String(value))) {
      opts.unshift({ value: String(value), label: currentLabel ?? `Viaje #${value} (vinculado actualmente)` })
    }
    return opts
  }, [data, value, currentLabel])

  return (
    <Select
      label="Viaje vinculado (opcional)" disabled={loading}
      value={value === '' ? '' : String(value)}
      onChange={e => { const v = e.target.value; onChange(v === '' ? '' : Number(v)) }}
      placeholder={loading ? 'Cargando…' : '— Sin vincular —'}
      error={error ?? undefined}
      helper="Solo viajes almacenados con material cargado, listos para salir."
      options={options}
    />
  )
}

type PageTab = 'despachos' | 'proveedores' | 'viajes'

export function PagoMulasApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()
  const [tab, setTab] = useState<PageTab>('despachos')

  // ── Navegación de mes ────────────────────────────────────────
  const currentMonth = todayISO().slice(0, 7)
  const [selMonth, setSelMonth] = useState(currentMonth)
  const mesStart = `${selMonth}-01`
  const mesEnd = periodoEndDate(selMonth)
  const shiftMonth = (delta: number) => {
    const [y, m] = selMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── Filtros ──────────────────────────────────────────────────
  const [fProveedor, setFProveedor] = useState<number | ''>('')
  const [fEstado, setFEstado] = useState<EstadoCuentaPago | 'todos'>('todos')

  // ── KPIs del período (/resumen) ──────────────────────────────
  const [resumen, setResumen] = useState<MulasResumen | null>(null)
  const [loadingResumen, setLoadingResumen] = useState(true)
  const loadResumen = useCallback(() => {
    setLoadingResumen(true)
    pagosMulasApi.getResumen({ desde: mesStart, hasta: mesEnd, id_proveedor: fProveedor || undefined })
      .then(setResumen)
      .catch(e => toast.error(apiError(e).message))
      .finally(() => setLoadingResumen(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesStart, mesEnd, fProveedor])
  useEffect(() => { loadResumen() }, [loadResumen])

  // ── Listado de despachos ──────────────────────────────────────
  const [despachos, setDespachos] = useState<MulaDespacho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosMulasApi.listar({
      id_proveedor: fProveedor || undefined,
      estado: fEstado !== 'todos' ? fEstado : undefined,
    })
      .then(rows => setDespachos(Array.isArray(rows) ? rows : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [fProveedor, fEstado])
  useEffect(() => { load() }, [load])

  const refreshAll = () => { load(); loadResumen() }

  // Filtro de mes (la API no soporta desde/hasta en el listado; se filtra en cliente).
  const despachosMes = useMemo(() => despachos.filter(d => {
    const f = (d.fecha ?? '').slice(0, 10)
    return f >= mesStart && f <= mesEnd
  }), [despachos, mesStart, mesEnd])

  // Agrupado por proveedor (cada despacho es su propia cuenta; se agrupa solo para la vista).
  const grupos = useMemo(() => {
    const map = new Map<number, { id_proveedor: number; proveedor: string; despachos: MulaDespacho[] }>()
    for (const d of despachosMes) {
      if (!map.has(d.id_proveedor)) map.set(d.id_proveedor, { id_proveedor: d.id_proveedor, proveedor: d.proveedor || `Proveedor #${d.id_proveedor}`, despachos: [] })
      map.get(d.id_proveedor)!.despachos.push(d)
    }
    return [...map.values()].map(g => {
      const totalFacturado = g.despachos.reduce((s, d) => s + num(d.valor), 0)
      const totalPagado     = g.despachos.reduce((s, d) => s + num(d.total_pagado), 0)
      const totalPendiente  = g.despachos.reduce((s, d) => s + num(d.saldo_pendiente), 0)
      return { ...g, totalFacturado, totalPagado, totalPendiente }
    }).sort((a, b) => b.totalPendiente - a.totalPendiente)
  }, [despachosMes])

  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // ── Abonos por proveedor (para la sub-lista "Abonos registrados" del período) ──
  // El backend limita el historial a 50 registros por página, así que cada proveedor
  // trae su propio paginador (raro que se necesite, pero un proveedor muy activo en
  // un mes podría superar 50 abonos).
  interface AbonosPagina { abonos: AbonoMula[]; page: number; totalPages: number; total: number }
  const [abonosCache, setAbonosCache] = useState<Map<number, AbonosPagina>>(new Map())
  const [loadingAbonos, setLoadingAbonos] = useState<Set<number>>(new Set())
  const loadAbonosProveedor = useCallback((idProveedor: number, page = 1) => {
    setLoadingAbonos(p => new Set(p).add(idProveedor))
    pagosMulasApi.getHistorial({ id_proveedor: idProveedor, desde: mesStart, hasta: mesEnd, page, limit: 50 })
      .then(r => setAbonosCache(p => new Map(p).set(idProveedor, {
        abonos: r.abonos ?? [], page: r.pagination?.page ?? 1,
        totalPages: r.pagination?.total_pages ?? 1, total: r.pagination?.total ?? (r.abonos?.length ?? 0),
      })))
      .catch(e => toast.error(apiError(e).message))
      .finally(() => setLoadingAbonos(p => { const n = new Set(p); n.delete(idProveedor); return n }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesStart, mesEnd])
  useEffect(() => { setAbonosCache(new Map()); setExpanded(new Set()) }, [mesStart, mesEnd])
  const invalidateAbonos = () => { setAbonosCache(new Map()); expanded.forEach(id => loadAbonosProveedor(id)) }

  const toggleExpand = (id: number) => setExpanded(p => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else { n.add(id); if (!abonosCache.has(id)) loadAbonosProveedor(id) }
    return n
  })

  // ── Despacho: crear / editar ──────────────────────────────────
  const [despachoModal, setDespachoModal] = useState(false)
  const [editDespacho, setEditDespacho] = useState<MulaDespacho | null>(null)
  const [form, setForm] = useState<DespachoForm>(emptyDespacho())
  const [savingDespacho, setSavingDespacho] = useState(false)
  const f = (k: keyof DespachoForm, v: string | number) => setForm(s => ({ ...s, [k]: v as never }))

  const abrirNuevoDespacho = (idProveedor?: number) => { setEditDespacho(null); setForm(emptyDespacho(idProveedor ?? '')); setDespachoModal(true) }
  const abrirEditarDespacho = (d: MulaDespacho) => {
    setEditDespacho(d)
    setForm({
      id_proveedor: d.id_proveedor, valor: String(num(d.valor)),
      fecha: (d.fecha ?? '').slice(0, 10) || todayISO(),
      id_viaje: d.id_viaje != null ? String(d.id_viaje) : '',
      concepto: d.concepto ?? '', factura_num: d.factura_num ?? '',
      foto_factura_url: d.foto_factura_url ?? '',
    })
    setDespachoModal(true)
  }
  const guardarDespacho = async () => {
    if (!editDespacho && form.id_proveedor === '') { toast.error('Selecciona el proveedor'); return }
    if (!(Number(form.valor) > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingDespacho(true)
    try {
      if (editDespacho) {
        await pagosMulasApi.editarDespacho(editDespacho.id, {
          fecha: form.fecha || undefined,
          concepto: form.concepto.trim() || undefined,
          factura_num: form.factura_num.trim() || undefined,
          foto_factura_url: form.foto_factura_url.trim() || undefined,
          valor: Number(form.valor),
          id_viaje: form.id_viaje ? Number(form.id_viaje) : null,
        })
        toast.success('Despacho actualizado')
      } else {
        await pagosMulasApi.crearDespacho({
          id_proveedor: Number(form.id_proveedor), valor: Number(form.valor),
          fecha: form.fecha || undefined,
          id_viaje: form.id_viaje ? Number(form.id_viaje) : undefined,
          concepto: form.concepto.trim() || undefined,
          factura_num: form.factura_num.trim() || undefined,
          foto_factura_url: form.foto_factura_url.trim() || undefined,
        })
        toast.success('Despacho registrado')
      }
      setDespachoModal(false); setEditDespacho(null); refreshAll()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingDespacho(false) }
  }

  const [delDespacho, setDelDespacho] = useState<MulaDespacho | null>(null)
  const [deletingDespacho, setDeletingDespacho] = useState(false)
  const confirmEliminarDespacho = async () => {
    if (!delDespacho) return
    setDeletingDespacho(true)
    try {
      await pagosMulasApi.eliminarDespacho(delDespacho.id)
      toast.success('Despacho eliminado'); setDelDespacho(null); refreshAll()
    } catch (e) {
      toast.error(apiError(e).message); setDelDespacho(null)
    } finally { setDeletingDespacho(false) }
  }

  // ── Detalle de un despacho (cuenta + abonos) ─────────────────
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<MulaDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const abrirDetalle = async (d: MulaDespacho) => {
    setDetalleId(d.id); setDetalle(null); setLoadingDetalle(true)
    try { setDetalle(await pagosMulasApi.getDetalle(d.id)) }
    catch (e) { toast.error(apiError(e).message) } finally { setLoadingDetalle(false) }
  }
  const reloadDetalle = useCallback(async () => {
    if (detalleId == null) return
    try { setDetalle(await pagosMulasApi.getDetalle(detalleId)) }
    catch (e) { toast.error(apiError(e).message) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalleId])

  // ── Abono: registrar (a nivel proveedor, cascada sobre sus despachos abiertos) ──
  interface AbonoProveedorTarget { id_proveedor: number; proveedor: string; totalPendiente: number }
  const [abonoTarget, setAbonoTarget] = useState<AbonoProveedorTarget | null>(null)
  const [abonoForm, setAbonoForm] = useState<AbonoForm>(emptyAbono())
  const [savingAbono, setSavingAbono] = useState(false)
  const abrirAbono = (target: AbonoProveedorTarget) => {
    setAbonoTarget(target)
    setAbonoForm(emptyAbono(target.totalPendiente > 0 ? String(Math.round(target.totalPendiente)) : ''))
  }
  const guardarAbono = async () => {
    if (!abonoTarget) return
    const valor = Number(abonoForm.valor)
    if (!(valor > 0)) { toast.error('El valor del abono debe ser mayor a 0'); return }
    if (!abonoForm.comprobante_url.trim()) { toast.error('El comprobante es obligatorio'); return }
    setSavingAbono(true)
    try {
      const res = await pagosMulasApi.crearAbonoProveedor(abonoTarget.id_proveedor, {
        valor, comprobante_url: abonoForm.comprobante_url.trim(),
        fecha_abono: abonoForm.fecha_abono, metodo_pago: abonoForm.metodo_pago,
      })
      const nCuentas = res.aplicado_a?.length ?? 0
      const aFavor = num(res.saldo_a_favor_generado)
      toast.success(`Abono aplicado a ${nCuentas} despacho${nCuentas === 1 ? '' : 's'} por ${cop(num(res.total_aplicado) || valor)}${aFavor > 0 ? ` · ${cop(aFavor)} quedó a favor` : ''}`)
      setAbonoTarget(null)
      refreshAll()
      invalidateAbonos()
      if (detalleId != null) reloadDetalle()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingAbono(false) }
  }

  // ── Abono: editar / eliminar (desde el modal de detalle) ─────
  const [editAbono, setEditAbono] = useState<AbonoMula | null>(null)
  const [editAbonoForm, setEditAbonoForm] = useState<EditAbonoForm>(emptyEditAbono())
  const [savingEditAbono, setSavingEditAbono] = useState(false)
  const abrirEditAbono = (a: AbonoMula) => {
    setEditAbono(a)
    setEditAbonoForm({
      valor: String(num(a.valor)), fecha_abono: (a.fecha_abono ?? todayISO()).slice(0, 10),
      metodo_pago: (a.metodo_pago as MetodoPagoMula) || 'transferencia',
      comprobante_url: a.comprobante_url ?? '', observaciones: a.observaciones ?? '',
    })
  }
  const guardarEditAbono = async () => {
    if (!editAbono) return
    const valor = Number(editAbonoForm.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingEditAbono(true)
    try {
      await pagosMulasApi.editarAbono(editAbono.id, {
        valor, fecha_abono: editAbonoForm.fecha_abono, metodo_pago: editAbonoForm.metodo_pago,
        comprobante_url: editAbonoForm.comprobante_url.trim() || undefined,
        observaciones: editAbonoForm.observaciones.trim() || undefined,
      })
      toast.success('Abono actualizado')
      setEditAbono(null); await reloadDetalle(); refreshAll(); invalidateAbonos()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingEditAbono(false) }
  }
  const eliminarAbono = async (idAbono: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    try { await pagosMulasApi.eliminarAbono(idAbono); toast.success('Abono eliminado'); await reloadDetalle(); refreshAll(); invalidateAbonos() }
    catch (e) { toast.error(apiError(e).message) }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader
        title="Pago de mulas"
        subtitle="Despachos de concentrado por proveedor transportador — el abono se aplica en cascada sobre los despachos más antiguos del proveedor."
        actions={canWrite && tab === 'despachos' && <Button icon={<Plus size={18} />} onClick={() => abrirNuevoDespacho()}>Registrar despacho</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'despachos'}
          className={`segment__btn ${tab === 'despachos' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('despachos')}>Despachos y pagos</button>
        <button role="tab" aria-selected={tab === 'proveedores'}
          className={`segment__btn ${tab === 'proveedores' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('proveedores')}>Proveedores</button>
        <button role="tab" aria-selected={tab === 'viajes'}
          className={`segment__btn ${tab === 'viajes' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('viajes')}>Por viaje</button>
      </div>

      {tab === 'despachos' && (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Despachos"  value={loadingResumen ? '…' : (resumen?.total_despachos ?? 0)} icon={<Truck size={16} />} accent="emerald" />
            <KpiTile label="Facturado"  value={cop(num(resumen?.valor_facturado_total))} accent="green" />
            <KpiTile label="Pagado"     value={cop(num(resumen?.total_pagado))} accent="brown" />
            <KpiTile label="Pendiente"  value={cop(num(resumen?.total_pendiente))} accent="rose" icon={<AlertCircle size={16} />} />
          </div>

          {resumen && num(resumen.retencion_total) > 0 && (
            <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
              Retención del período: <strong>{cop(num(resumen.retencion_total))}</strong>
            </div>
          )}

          {/* Navegador de mes + filtros */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
              {periodoLabel(selMonth)}{selMonth === currentMonth && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Mes actual</span>}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer', color: 'var(--text)' }}>
                <ChevronLeft size={18} />
              </button>
              <input className="field__input" type="month" value={selMonth} max={currentMonth} onChange={e => { if (e.target.value) setSelMonth(e.target.value) }} style={{ maxWidth: '10rem' }} />
              <button type="button" onClick={() => shiftMonth(1)} disabled={selMonth >= currentMonth} title="Mes siguiente"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth >= currentMonth ? 'not-allowed' : 'pointer', color: selMonth >= currentMonth ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronRight size={18} />
              </button>
              {selMonth !== currentMonth && <button type="button" onClick={() => setSelMonth(currentMonth)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline' }}>Hoy</button>}
            </div>
            <div style={{ width: 1, height: 30, background: '#e5e7eb' }} />
            <div style={{ minWidth: '13rem' }}>
              <ProveedorSelect value={fProveedor} onChange={setFProveedor} placeholder="Todos los proveedores" />
            </div>
            <select className="field__select" style={{ maxWidth: '11rem' }} value={fEstado} onChange={e => setFEstado(e.target.value as EstadoCuentaPago | 'todos')}>
              {ESTADO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={refreshAll} style={{ marginLeft: 'auto' }}>Refrescar</Button>
          </div>

          {loading ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
          ) : error ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
              {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
            </p></Card>
          ) : grupos.length === 0 ? (
            <Card title={periodoLabel(selMonth)}>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin despachos en {periodoLabel(selMonth)}.</p>
            </Card>
          ) : grupos.map(g => {
            const isOpen = expanded.has(g.id_proveedor)
            const sc = g.totalPendiente
            const semaforo = sc <= 0.01 ? '#16a34a' : g.totalPagado === 0 ? '#dc2626' : '#f59e0b'
            const pct = g.totalFacturado > 0 ? Math.min(g.totalPagado / g.totalFacturado, 1) : (g.totalPagado > 0 ? 1 : 0)
            return (
              <div key={g.id_proveedor} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
                  onClick={() => toggleExpand(g.id_proveedor)}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={sc <= 0.01 ? 'Pagado' : g.totalPagado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                  <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{g.proveedor}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{g.despachos.length} despacho{g.despachos.length === 1 ? '' : 's'}</span>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                    <span>Facturado <strong>{cop(g.totalFacturado)}</strong></span>
                    <span style={{ color: '#15803d' }}>Pagado <strong>{cop(g.totalPagado)}</strong></span>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: sc > 0.01 ? '#b45309' : '#15803d', minWidth: 96, textAlign: 'right' }} className="mono">
                      {sc <= 0.01 ? 'Al día' : cop(sc)}
                      <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{sc > 0.01 ? 'por pagar' : ''}</div>
                    </span>
                    {canWrite && (
                      <span onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="secondary" icon={<Plus size={13} />} title="Registrar despacho" onClick={() => abrirNuevoDespacho(g.id_proveedor)} />
                        {sc > 0.01 && (
                          <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono({ id_proveedor: g.id_proveedor, proveedor: g.proveedor, totalPendiente: g.totalPendiente })}>Abonar</Button>
                        )}
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                        <thead><tr>
                          <th>Fecha</th><th>Concepto</th><th>Factura</th>
                          <th style={{ textAlign: 'right' }}>Valor</th>
                          <th style={{ textAlign: 'right' }}>Retención</th>
                          <th style={{ textAlign: 'right' }}>Pagado</th>
                          <th style={{ textAlign: 'right' }}>Saldo</th>
                          <th>Estado</th>
                          {canWrite && <th></th>}
                        </tr></thead>
                        <tbody>
                          {g.despachos.map(d => {
                            const eb = ESTADO_BADGE[d.estado_pago ?? 'pendiente'] ?? { label: d.estado_pago ?? '—', cls: 'badge--neutral' }
                            return (
                              <tr key={d.id}>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(d.fecha)}</td>
                                <td>
                                  <button className="link-btn" style={{ fontWeight: 600 }} onClick={() => abrirDetalle(d)}>{d.concepto || `Despacho #${d.id}`}</button>
                                  {d.numero_viaje != null && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Viaje #{String(d.numero_viaje)}</div>}
                                </td>
                                <td>
                                  {d.factura_num && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>{d.factura_num} </span>}
                                  {d.foto_factura_url && <a href={d.foto_factura_url} target="_blank" rel="noreferrer" title="Ver factura" style={{ color: 'var(--amber-700)' }}><ImageIcon size={13} style={{ verticalAlign: 'middle' }} /></a>}
                                  {!d.factura_num && !d.foto_factura_url && <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                </td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(num(d.valor))}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{num(d.retencion) > 0 ? cop(num(d.retencion)) : '—'}</td>
                                <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(num(d.total_pagado))}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: num(d.saldo_pendiente) > 0.01 ? '#b45309' : '#15803d' }} className="mono">{num(d.saldo_pendiente) > 0.01 ? cop(num(d.saldo_pendiente)) : 'Al día'}</td>
                                <td><span className={`badge ${eb.cls}`}>{eb.label}</span></td>
                                {canWrite && (
                                  <td>
                                    <div className="row" style={{ gap: 4 }}>
                                      <Button variant="secondary" size="sm" icon={<Pencil size={12} />} title="Editar" onClick={() => abrirEditarDespacho(d)} />
                                      <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} title="Eliminar" onClick={() => setDelDespacho(d)} />
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={3}>Total</td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(g.despachos.reduce((s, d) => s + num(d.valor), 0))}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(g.despachos.reduce((s, d) => s + num(d.retencion), 0))}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(g.totalPagado)}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(g.totalPendiente)}</td>
                            <td colSpan={canWrite ? 2 : 1} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div style={{ marginTop: '0.85rem' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HandCoins size={13} /> Abonos registrados en {periodoLabel(selMonth)}
                      </div>
                      {loadingAbonos.has(g.id_proveedor) ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Cargando…</p>
                      ) : (abonosCache.get(g.id_proveedor)?.abonos.length ?? 0) === 0 ? (
                        <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos registrados este mes.</em>
                      ) : (
                        <>
                          <div className="table-wrap">
                            <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                              <thead><tr><th>Fecha</th><th>Método</th><th style={{ textAlign: 'right' }}>Valor</th><th>Comprobante</th></tr></thead>
                              <tbody>
                                {abonosCache.get(g.id_proveedor)!.abonos.map(a => (
                                  <tr key={a.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                                    <td>{METODO_LABEL(a.metodo_pago)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                                    <td><ComprobanteLink url={a.comprobante_url} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {abonosCache.get(g.id_proveedor)!.totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                              <Button size="sm" variant="secondary"
                                disabled={abonosCache.get(g.id_proveedor)!.page <= 1}
                                onClick={() => loadAbonosProveedor(g.id_proveedor, abonosCache.get(g.id_proveedor)!.page - 1)}>
                                Anterior
                              </Button>
                              <span style={{ fontSize: 'var(--fs-xs)' }}>
                                Página {abonosCache.get(g.id_proveedor)!.page} de {abonosCache.get(g.id_proveedor)!.totalPages}
                              </span>
                              <Button size="sm" variant="secondary"
                                disabled={abonosCache.get(g.id_proveedor)!.page >= abonosCache.get(g.id_proveedor)!.totalPages}
                                onClick={() => loadAbonosProveedor(g.id_proveedor, abonosCache.get(g.id_proveedor)!.page + 1)}>
                                Siguiente
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === 'proveedores' && <ProveedoresTab canWrite={canWrite} />}

      {tab === 'viajes' && <ViajesTrazabilidadTab />}

      {/* ── Modal: Registrar / Editar despacho ── */}
      <Modal open={despachoModal} title={editDespacho ? `Editar despacho #${editDespacho.id}` : 'Registrar despacho'}
        onClose={() => { setDespachoModal(false); setEditDespacho(null) }}
        footer={<>
          <Button variant="secondary" onClick={() => { setDespachoModal(false); setEditDespacho(null) }}>Cancelar</Button>
          <Button onClick={guardarDespacho} disabled={savingDespacho || !(Number(form.valor) > 0) || (!editDespacho && form.id_proveedor === '')}>
            {savingDespacho ? 'Guardando…' : 'Guardar'}
          </Button>
        </>}>
        <div className="grid grid--form">
          {editDespacho ? (
            <Input label="Proveedor" value={editDespacho.proveedor ?? `Proveedor #${editDespacho.id_proveedor}`} disabled />
          ) : (
            <ProveedorSelect required value={form.id_proveedor} onChange={v => f('id_proveedor', v)} />
          )}
          <Input label="Fecha" type="date" required value={form.fecha} onChange={e => f('fecha', e.target.value)} />
          <Input label="Valor (lo que debemos pagar)" type="number" mono step="1000" required placeholder="850000"
            value={form.valor} onChange={e => f('valor', e.target.value)} />
          <Input label="Concepto (opcional)" placeholder="Se autogenera si se deja vacío" style={{ gridColumn: '1 / -1' }}
            value={form.concepto} onChange={e => f('concepto', e.target.value)} />
          <Input label="N.° de factura" placeholder="FA-1023" value={form.factura_num} onChange={e => f('factura_num', e.target.value)} />
          <ViajeMulaSelect
            value={form.id_viaje === '' ? '' : Number(form.id_viaje)}
            onChange={v => setForm(s => ({ ...s, id_viaje: v === '' ? '' : String(v) }))}
            currentLabel={editDespacho?.numero_viaje != null ? `Viaje ${editDespacho.numero_viaje} (vinculado actualmente)` : undefined}
          />
          <Input label="Foto de factura (URL, opcional)" placeholder="https://…/factura.png" value={form.foto_factura_url} onChange={e => f('foto_factura_url', e.target.value)} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delDespacho} title="Eliminar despacho" itemLabel={delDespacho ? (delDespacho.concepto || `despacho #${delDespacho.id}`) : undefined}
        loading={deletingDespacho} onCancel={() => setDelDespacho(null)} onConfirm={confirmEliminarDespacho} />

      {/* ── Modal: Registrar abono (a nivel proveedor, cascada) ── */}
      <Modal open={abonoTarget != null} title={`Registrar abono — ${abonoTarget?.proveedor ?? ''}`}
        onClose={() => setAbonoTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarAbono} disabled={savingAbono || !(Number(abonoForm.valor) > 0) || !abonoForm.comprobante_url.trim()}>
            {savingAbono ? 'Guardando…' : 'Registrar abono'}
          </Button>
        </>}>
        {abonoTarget && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente (todos los despachos): <strong style={{ color: 'var(--rose-700)' }}>{cop(Math.max(0, abonoTarget.totalPendiente))}</strong>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              Se aplica en cascada, empezando por el despacho más antiguo con deuda. Si sobra, queda como crédito a favor del proveedor.
            </div>
          </div>
        )}
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required placeholder="500000"
            value={abonoForm.valor} onChange={e => setAbonoForm(s => ({ ...s, valor: e.target.value }))} />
          <Input label="Fecha del abono" type="date" required
            value={abonoForm.fecha_abono} onChange={e => setAbonoForm(s => ({ ...s, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={abonoForm.metodo_pago} onChange={e => setAbonoForm(s => ({ ...s, metodo_pago: e.target.value as MetodoPagoMula }))} />
          <Input label="Comprobante (URL)" required placeholder="https://…/comprobante.png"
            value={abonoForm.comprobante_url} onChange={e => setAbonoForm(s => ({ ...s, comprobante_url: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Editar abono ── */}
      <Modal open={editAbono != null} title="Editar abono" onClose={() => setEditAbono(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditAbono(null)}>Cancelar</Button>
          <Button onClick={guardarEditAbono} disabled={savingEditAbono || !(Number(editAbonoForm.valor) > 0)}>{savingEditAbono ? 'Guardando…' : 'Guardar cambios'}</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required
            value={editAbonoForm.valor} onChange={e => setEditAbonoForm(s => ({ ...s, valor: e.target.value }))} />
          <Input label="Fecha del abono" type="date" required
            value={editAbonoForm.fecha_abono} onChange={e => setEditAbonoForm(s => ({ ...s, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={editAbonoForm.metodo_pago} onChange={e => setEditAbonoForm(s => ({ ...s, metodo_pago: e.target.value as MetodoPagoMula }))} />
          <Input label="Comprobante (URL)" value={editAbonoForm.comprobante_url} onChange={e => setEditAbonoForm(s => ({ ...s, comprobante_url: e.target.value }))} />
          <Input label="Observaciones" value={editAbonoForm.observaciones} onChange={e => setEditAbonoForm(s => ({ ...s, observaciones: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Detalle del despacho (cuenta + abonos) ── */}
      <Modal open={detalleId != null} title={detalle ? (detalle.concepto || `Despacho #${detalle.id}`) : 'Despacho'}
        onClose={() => { setDetalleId(null); setDetalle(null) }}>
        {loadingDetalle || !detalle ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando…</p>
        ) : (
          <>
            <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: 'var(--fs-sm)' }}>
              <span>Proveedor: <strong>{detalle.proveedor ?? `#${detalle.id_proveedor}`}</strong></span>
              <span>Fecha: <strong>{formatDate(detalle.fecha)}</strong></span>
              <span>Valor: <strong>{cop(num(detalle.valor))}</strong></span>
              {num(detalle.retencion) > 0 && <span>Retención: <strong>{cop(num(detalle.retencion))}</strong></span>}
              <span style={{ fontWeight: 800, color: num(detalle.saldo_pendiente) > 0.01 ? 'var(--rose-700)' : 'var(--green-700)' }}>
                Saldo: {num(detalle.saldo_pendiente) > 0.01 ? cop(num(detalle.saldo_pendiente)) : 'Al día'}
              </span>
            </div>

            {canWrite && num(detalle.saldo_pendiente) > 0.01 && detalle.estado_pago !== 'anulado' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <Button size="sm" icon={<HandCoins size={13} />}
                  onClick={() => abrirAbono({ id_proveedor: detalle.id_proveedor, proveedor: detalle.proveedor ?? `#${detalle.id_proveedor}`, totalPendiente: num(detalle.saldo_pendiente) })}>
                  Abonar al proveedor
                </Button>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.35rem' }}>
                  El abono se aplica en cascada a todos los despachos pendientes de este proveedor, no solo a este.
                </p>
              </div>
            )}

            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Abonos ({detalle.abonos?.length ?? 0})
            </div>
            {(detalle.abonos?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos.</em> : (
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                  <thead><tr><th>Fecha</th><th>Método</th><th style={{ textAlign: 'right' }}>Valor</th><th>Comprobante</th>{canWrite && <th></th>}</tr></thead>
                  <tbody>
                    {detalle.abonos.map(a => (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                        <td>{METODO_LABEL(a.metodo_pago)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                        <td><ComprobanteLink url={a.comprobante_url} /></td>
                        {canWrite && (
                          <td>
                            <div className="row" style={{ gap: 4 }}>
                              <Button variant="ghost" size="sm" icon={<Pencil size={12} />} title="Editar" onClick={() => abrirEditAbono(a)} />
                              <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} title="Eliminar" onClick={() => eliminarAbono(a.id)} />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// POR VIAJE — trazabilidad (GET /pagos/mulas/viajes): cada despacho vinculado
// a un viaje, con su cuenta y los abonos aplicados sobre esa cuenta.
// ════════════════════════════════════════════════════════════════════════════
function ViajesTrazabilidadTab() {
  const [data, setData] = useState<MulaViajeTrazabilidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosMulasApi.getViajesTrazabilidad()
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return data
    return data.filter(v => String(v.numero_viaje).toLowerCase().includes(term) || (v.proveedor ?? '').toLowerCase().includes(term))
  }, [data, q])

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="field__input" placeholder="Buscar por N.° de viaje o proveedor…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: '18rem' }} />
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
      </div>
      <Card title={`Viajes despachados (${filtered.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Viaje</th><th>Proveedor</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th style={{ textAlign: 'right' }}>Pagado</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
              <th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin viajes despachados todavía.</td></tr>
              ) : filtered.map(v => {
                const isOpen = expanded.has(v.id_mula)
                const eb = ESTADO_BADGE[v.estado ?? 'pendiente'] ?? { label: String(v.estado ?? '—'), cls: 'badge--neutral' }
                return (
                  <Fragment key={v.id_mula}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(v.id_mula)}>
                      <td style={{ fontWeight: 700 }}>#{String(v.numero_viaje)}</td>
                      <td>{v.proveedor}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.valor_total))}</td>
                      <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(num(v.valor_pagado))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: num(v.saldo) > 0.01 ? '#b45309' : '#15803d' }} className="mono">
                        {num(v.saldo) > 0.01 ? cop(num(v.saldo)) : 'Al día'}
                      </td>
                      <td><span className={`badge ${eb.cls}`}>{eb.label}</span></td>
                      <td>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ background: '#fafaf9', padding: '0.6rem 1rem' }}>
                          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Abonos aplicados a esta cuenta ({v.abonos?.length ?? 0})
                          </div>
                          {(v.abonos?.length ?? 0) === 0 ? (
                            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos aplicados todavía.</em>
                          ) : (
                            <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                              <thead><tr><th style={{ textAlign: 'right' }}>Valor</th><th>Comprobante</th></tr></thead>
                              <tbody>
                                {v.abonos.map(a => (
                                  <tr key={a.id}>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                                    <td><ComprobanteLink url={a.comprobante_url} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROVEEDORES — catálogo (nombre, categoría, contacto) usado por los despachos
// ════════════════════════════════════════════════════════════════════════════
const emptyProveedorForm = () => ({ nombre: '', id_categoria: '' as number | '', alias: '', contacto: '', telefono: '', ciudad: '', compra_realizada: '', nequi: false, estado: 'activo' })

function ProveedoresTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [fCategoria, setFCategoria] = useState<number | ''>('')
  const [fEstado, setFEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [q, setQ] = useState('')
  const categorias = useCategoriasProveedor()
  const { data, loading, error, reload } = useProveedores({ id_categoria: fCategoria || undefined, estado: fEstado !== 'todos' ? fEstado : undefined, q: q || undefined })

  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyProveedorForm())
  const f = (k: keyof ReturnType<typeof emptyProveedorForm>, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyProveedorForm()); setModal('nuevo') }
  const openEdit = (p: Proveedor) => {
    setForm({
      nombre: p.nombre, id_categoria: p.id_categoria ?? '', alias: p.alias ?? '', contacto: p.contacto ?? '',
      telefono: p.telefono ?? '', ciudad: p.ciudad ?? '', compra_realizada: p.compra_realizada ?? '',
      nequi: !!num(p.nequi), estado: p.estado ?? 'activo',
    })
    setModal(p.id)
  }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    const body: ProveedorPayload = {
      nombre: form.nombre.trim(), id_categoria: form.id_categoria === '' ? undefined : form.id_categoria,
      alias: form.alias.trim() || undefined, contacto: form.contacto.trim() || undefined,
      telefono: form.telefono.trim() || undefined, ciudad: form.ciudad.trim() || undefined,
      compra_realizada: form.compra_realizada.trim() || undefined, nequi: form.nequi, estado: form.estado,
    }
    try {
      if (modal === 'nuevo') { await pagosApi.createProveedor(body); toast.success('Proveedor creado') }
      else if (typeof modal === 'number') { await pagosApi.updateProveedor(modal, body); toast.success('Proveedor actualizado') }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [delProveedor, setDelProveedor] = useState<Proveedor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delProveedor) return
    setDeleting(true)
    try { await pagosApi.deleteProveedor(delProveedor.id); toast.success('Proveedor eliminado'); setDelProveedor(null); reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este proveedor tiene registros asociados (despachos, pagos) y no se puede eliminar.' : message)
      setDelProveedor(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="field__input" placeholder="Buscar por nombre o alias…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: '16rem' }} />
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoria} onChange={e => setFCategoria(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="segment">
          {(['todos', 'activo', 'inactivo'] as const).map(k => (
            <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>{k === 'todos' ? 'Todos' : k === 'activo' ? 'Activos' : 'Inactivos'}</button>
          ))}
        </div>
      </div>

      <Card title={`Proveedores (${data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nuevo proveedor</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Categoría</th><th>Alias</th><th>Contacto</th><th>Teléfono</th><th>Ciudad</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={reload} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin proveedores</td></tr>
              ) : data.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.nombre}</td>
                  <td>{p.categoria ?? '—'}</td>
                  <td>{p.alias ?? '—'}</td>
                  <td>{p.contacto ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{p.telefono ?? '—'}</td>
                  <td>{p.ciudad ?? '—'}</td>
                  <td><span className={`badge badge--${p.estado === 'inactivo' ? 'neutral' : 'success'}`}>{p.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</span></td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelProveedor(p)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre / razón social" required value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          <Select label="Categoría (opcional)" placeholder="— Sin categoría —" value={form.id_categoria === '' ? '' : String(form.id_categoria)}
            onChange={e => f('id_categoria', e.target.value === '' ? '' : Number(e.target.value))}
            options={categorias.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Alias (opcional)" value={form.alias} onChange={e => f('alias', e.target.value)} />
          <Input label="Contacto (opcional)" placeholder="Nombre de la persona de contacto" value={form.contacto} onChange={e => f('contacto', e.target.value)} />
          <Input label="Teléfono" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
          <Input label="Ciudad" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          <Input label="Compra realizada (opcional)" placeholder="Transporte de concentrado…" style={{ gridColumn: '1 / -1' }}
            value={form.compra_realizada} onChange={e => f('compra_realizada', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="proveedor-nequi" checked={form.nequi} onChange={e => f('nequi', e.target.checked)} />
            <label htmlFor="proveedor-nequi" style={{ cursor: 'pointer', userSelect: 'none' }}>Usa Nequi</label>
          </div>
          {typeof modal === 'number' && (
            <Select label="Estado" value={form.estado} onChange={e => f('estado', e.target.value)}
              options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          )}
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delProveedor} title="Eliminar proveedor" itemLabel={delProveedor?.nombre}
        loading={deleting} onCancel={() => setDelProveedor(null)} onConfirm={confirmDelete} />
    </>
  )
}
