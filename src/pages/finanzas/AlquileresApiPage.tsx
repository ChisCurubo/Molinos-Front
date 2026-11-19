import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2, CalendarDays, CalendarRange, ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, ScrollText, Tag, Trash2, Wallet, X,
} from 'lucide-react'
import { Badge, Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { CuentaBancariaSelect } from '@/components/common/CatalogSelectors'
import { ComprobanteInput } from '@/components/common/ComprobanteInput'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO, mesActualISO, nombreMes } from '@/utils/format'
import { pagosApi, type Proveedor } from '@/api/pagos'
import {
  pagosAlquileresApi,
  type Alquiler, type AlquilerPayload, type TipoAlquiler, type EstadoAlquiler,
  type AbonoAlquiler, type EstadoPagoAlquiler,
  type ContratoAlquiler, type ContratoPayload,
} from '@/api/pagosAlquileres'
import { abrirUrl } from '@/utils/safeUrl'

const mesActual = mesActualISO

interface FiltroContrato { id: number; concepto: string }

const cop = formatCOP

const ESTADO_BADGE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  pendiente: { label: 'Pendiente', tone: 'danger'  },
  parcial:   { label: 'Parcial',   tone: 'warning' },
  pagado:    { label: 'Pagado',    tone: 'success' },
  anulado:   { label: 'Anulado',   tone: 'neutral' },
}
const estadoInfo = (e?: EstadoAlquiler) => ESTADO_BADGE[e ?? 'pendiente'] ?? { label: e ?? 'Pendiente', tone: 'neutral' as const }

const METODO_OPTS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi',         label: 'Nequi' },
  { value: 'consignacion',  label: 'Consignación' },
  { value: 'otro',          label: 'Otro' },
]

type PageTab = 'alquileres' | 'contratos' | 'tipos'

function useTiposAlquiler() {
  const [data, setData] = useState<TipoAlquiler[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosAlquileresApi.getTipos().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

export function AlquileresApiPage() {
  const canWrite = useCanWrite('finanzas')
  const [tab, setTab] = useState<PageTab>('alquileres')
  const tipos = useTiposAlquiler()

  // Puente entre pestañas: "Ver meses" en Contratos salta a Alquileres filtrado por ese contrato.
  const [filtroContrato, setFiltroContrato] = useState<FiltroContrato | null>(null)
  const verMesesDeContrato = (c: FiltroContrato) => { setFiltroContrato(c); setTab('alquileres') }

  return (
    <div className="page">
      <PageHeader
        title="Alquileres"
        subtitle="Gastos fijos de arriendo — vehículos, maquinaria, herramientas. Conectado a /pagos/alquileres."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'alquileres'} className={`segment__btn ${tab === 'alquileres' ? 'segment__btn--active' : ''}`} onClick={() => setTab('alquileres')}>Alquileres</button>
        <button role="tab" aria-selected={tab === 'contratos'} className={`segment__btn ${tab === 'contratos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('contratos')}>Contratos</button>
        <button role="tab" aria-selected={tab === 'tipos'} className={`segment__btn ${tab === 'tipos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('tipos')}>Tipos</button>
      </div>

      {tab === 'alquileres' && (
        <AlquileresTab canWrite={canWrite} tipos={tipos}
          filtroContrato={filtroContrato} onClearFiltroContrato={() => setFiltroContrato(null)} />
      )}
      {tab === 'contratos' && <ContratosTab canWrite={canWrite} tipos={tipos} onVerMeses={verMesesDeContrato} />}
      {tab === 'tipos' && <TiposAlquilerTab canWrite={canWrite} tipos={tipos} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ALQUILERES
// ════════════════════════════════════════════════════════════════════════════
const emptyForm = () => ({
  concepto: '', id_tipo: '' as number | '', id_proveedor: '' as number | '', fecha_inicio: todayISO(), valor: '',
  valor_iva: '', retencion_fuente_manual: '', reteiva_manual: '',
})

function AlquileresTab({ canWrite, tipos, filtroContrato, onClearFiltroContrato }: {
  canWrite: boolean; tipos: ReturnType<typeof useTiposAlquiler>
  filtroContrato: FiltroContrato | null; onClearFiltroContrato: () => void
}) {
  const toast = useToast()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setProveedores(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  const nombreProveedor = useCallback((id?: number | null) => id ? proveedores.find(p => p.id === id)?.nombre ?? `Proveedor #${id}` : null, [proveedores])

  const [fTipo, setFTipo] = useState<number | 'todos'>('todos')
  const [fEstado, setFEstado] = useState<'todos' | EstadoAlquiler>('todos')
  const [q, setQ] = useState('')

  // Selector mensual: viendo un contrato completo → sin tope (trazabilidad);
  // viendo "mes a mes" suelto → arranca en el mes actual y nunca deja ir a futuro.
  const [mesSel, setMesSel] = useState<string>(filtroContrato ? '' : mesActual())
  useEffect(() => { setMesSel(filtroContrato ? '' : mesActual()) }, [filtroContrato])
  const [anioMes, mesMes] = mesSel ? mesSel.split('-').map(Number) : [undefined, undefined]

  const [data, setData] = useState<Alquiler[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosAlquileresApi.listar({
      id_tipo: fTipo !== 'todos' ? fTipo : undefined, estado: fEstado !== 'todos' ? fEstado : undefined,
      id_contrato: filtroContrato?.id, mes: mesMes, anio: anioMes,
    })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [fTipo, fEstado, filtroContrato, mesMes, anioMes])
  useEffect(() => { load() }, [load])

  const dataFiltrada = useMemo(() => {
    if (!q.trim()) return data
    const needle = q.trim().toLowerCase()
    return data.filter(a => a.concepto.toLowerCase().includes(needle) || (nombreProveedor(a.id_proveedor) ?? '').toLowerCase().includes(needle))
  }, [data, q, nombreProveedor])

  // ── Estado de pago por fila — se pide al backend (crea la CxP sola la primera vez) ──
  const [estados, setEstados] = useState<Record<number, EstadoPagoAlquiler>>({})
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const cargarEstado = useCallback((id: number) => {
    pagosAlquileresApi.getEstadoPago(id).then(r => setEstados(prev => ({ ...prev, [id]: r }))).catch(() => {})
  }, [])
  // Carga el estado de cada fila visible para que los KPIs y el saldo de la tabla sean reales.
  useEffect(() => { dataFiltrada.forEach(a => cargarEstado(a.id)) }, [dataFiltrada, cargarEstado])

  const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id)

  const kpis = useMemo(() => {
    const valores = dataFiltrada.map(a => ({ a, e: estados[a.id] }))
    const activos = valores.filter(({ a }) => (a.estado ?? estados[a.id]?.estado) !== 'anulado')
    const totalValor = activos.reduce((s, { a, e }) => s + (e ? num(e.valor_total) : num(a.valor)), 0)
    const totalSaldo = activos.reduce((s, { a, e }) => s + (e ? num(e.saldo) : num(a.valor)), 0)
    const pagados = activos.filter(({ e }) => e?.estado === 'pagado').length
    return { totalValor, totalSaldo, pagados, activos: activos.length }
  }, [dataFiltrada, estados])

  // ── Nuevo / Editar ───────────────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | Alquiler>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const f = (k: keyof ReturnType<typeof emptyForm>, v: string) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyForm()); setModal('nuevo') }
  const openEdit = (a: Alquiler) => {
    setForm({
      concepto: a.concepto, id_tipo: a.id_tipo ?? '', id_proveedor: a.id_proveedor ?? '',
      fecha_inicio: a.fecha_inicio?.slice(0, 10) ?? todayISO(), valor: String(num(a.valor)),
      valor_iva: a.valor_iva != null ? String(num(a.valor_iva)) : '',
      retencion_fuente_manual: a.retencion_fuente_manual != null ? String(num(a.retencion_fuente_manual)) : '',
      reteiva_manual: a.reteiva_manual != null ? String(num(a.reteiva_manual)) : '',
    })
    setModal(a)
  }
  const save = async () => {
    if (!form.concepto.trim() || !form.valor) return
    setSaving(true)
    const body: AlquilerPayload = {
      concepto: form.concepto.trim(), fecha_inicio: form.fecha_inicio, valor: Number(form.valor),
      id_tipo: form.id_tipo === '' ? undefined : form.id_tipo,
      id_proveedor: form.id_proveedor === '' ? undefined : form.id_proveedor,
      valor_iva: form.valor_iva === '' ? undefined : Number(form.valor_iva),
      retencion_fuente_manual: modal === 'nuevo'
        ? (form.retencion_fuente_manual === '' ? undefined : Number(form.retencion_fuente_manual))
        : (form.retencion_fuente_manual === '' ? null : Number(form.retencion_fuente_manual)),
      reteiva_manual: modal === 'nuevo'
        ? (form.reteiva_manual === '' ? undefined : Number(form.reteiva_manual))
        : (form.reteiva_manual === '' ? null : Number(form.reteiva_manual)),
    }
    try {
      if (modal === 'nuevo') { await pagosAlquileresApi.crear(body); toast.success('Alquiler creado') }
      else if (modal) { await pagosAlquileresApi.actualizar(modal.id, body); toast.success('Alquiler actualizado') }
      setModal(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Anular (soft delete) ──────────────────────────────────────
  const [anulando, setAnulando] = useState<Alquiler | null>(null)
  const [anulandoLoading, setAnulandoLoading] = useState(false)
  const confirmAnular = async () => {
    if (!anulando) return
    setAnulandoLoading(true)
    try { await pagosAlquileresApi.anular(anulando.id); toast.success('Alquiler anulado'); setAnulando(null); load() }
    catch (e) { toast.error(apiError(e).message); setAnulando(null) }
    finally { setAnulandoLoading(false) }
  }

  // ── Abonar ─────────────────────────────────────────────────────
  const [abonando, setAbonando] = useState<Alquiler | null>(null)
  const [formAbono, setFormAbono] = useState({ fecha: todayISO(), valor: '', metodo_pago: 'efectivo', nota: '', comprobante: null as File | null, id_cuenta_bancaria: '' as number | '' })
  const [guardandoAbono, setGuardandoAbono] = useState(false)
  const abrirAbono = (a: Alquiler) => { setAbonando(a); setFormAbono({ fecha: todayISO(), valor: '', metodo_pago: 'efectivo', nota: '', comprobante: null, id_cuenta_bancaria: '' }) }
  const guardarAbono = async () => {
    if (!abonando) return
    const monto = Number(formAbono.valor) || 0
    const saldoActual = num(estados[abonando.id]?.saldo ?? abonando.valor)
    if (monto <= 0) { toast.error('Ingresa el valor del abono'); return }
    if (monto > saldoActual) { toast.error(`El abono no puede superar el saldo pendiente (${cop(saldoActual)}).`); return }
    setGuardandoAbono(true)
    try {
      await pagosAlquileresApi.crearAbono(abonando.id, {
        valor: monto, fecha: formAbono.fecha, metodo_pago: formAbono.metodo_pago,
        observaciones: formAbono.nota.trim() || undefined,
        id_cuenta_bancaria: formAbono.metodo_pago === 'efectivo' || formAbono.id_cuenta_bancaria === '' ? undefined : formAbono.id_cuenta_bancaria,
      }, formAbono.comprobante)
      toast.success('Abono registrado')
      setAbonando(null); cargarEstado(abonando.id); load()
    } catch (e) {
      toast.error(apiError(e).message)
    } finally { setGuardandoAbono(false) }
  }

  // ── Corregir / eliminar un abono del historial — el abono no trae el id del
  // alquiler (solo id_cuenta_pagar), así que viaja aparte desde la fila. ──────
  const [corrigiendo, setCorrigiendo] = useState<{ ab: AbonoAlquiler; idAlquiler: number } | null>(null)
  const [formCorregir, setFormCorregir] = useState({ valor: '', fecha: '', metodo_pago: 'efectivo' })
  const abrirCorregir = (ab: AbonoAlquiler, idAlquiler: number) => { setCorrigiendo({ ab, idAlquiler }); setFormCorregir({ valor: String(num(ab.valor)), fecha: ab.fecha_abono?.slice(0, 10) ?? '', metodo_pago: ab.metodo_pago ?? 'efectivo' }) }
  const guardarCorreccion = async () => {
    if (!corrigiendo) return
    try {
      await pagosAlquileresApi.corregirAbono(corrigiendo.ab.id, { valor: Number(formCorregir.valor), fecha: formCorregir.fecha, metodo_pago: formCorregir.metodo_pago })
      toast.success('Abono corregido')
      cargarEstado(corrigiendo.idAlquiler); setCorrigiendo(null); load()
    } catch (e) { toast.error(apiError(e).message) }
  }
  const [borrandoAbono, setBorrandoAbono] = useState<{ ab: AbonoAlquiler; idAlquiler: number } | null>(null)
  const [borrandoAbonoLoading, setBorrandoAbonoLoading] = useState(false)
  const confirmarEliminarAbono = async () => {
    if (!borrandoAbono) return
    setBorrandoAbonoLoading(true)
    try {
      await pagosAlquileresApi.eliminarAbono(borrandoAbono.ab.id)
      toast.success('Abono eliminado')
      cargarEstado(borrandoAbono.idAlquiler); setBorrandoAbono(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setBorrandoAbonoLoading(false) }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Valor total (activos)" value={cop(kpis.totalValor)} icon={<Building2 size={16} />} accent="brown" />
        <KpiTile label="Saldo por pagar"        value={cop(kpis.totalSaldo)} icon={<Wallet size={16} />}    accent="rose"  />
        <KpiTile label="Pagados"                value={kpis.pagados}         icon={<RefreshCw size={16} />} accent="emerald" />
        <KpiTile label="Alquileres activos"     value={kpis.activos}         icon={<Tag size={16} />}       accent="green" />
      </div>

      {filtroContrato && (
        <div className="callout" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <ScrollText size={15} />
          Viendo solo el contrato <strong>{filtroContrato.concepto}</strong> — historial completo, sin límite de mes.
          <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={onClearFiltroContrato} style={{ marginLeft: 'auto' }}>Quitar filtro</Button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <Input label="Mes" type="month" icon={<CalendarRange size={16} />} value={mesSel} max={mesActual()}
          disabled={!!filtroContrato} onChange={e => setMesSel(e.target.value)} style={{ maxWidth: '11rem' }}
          helper={filtroContrato ? undefined : 'No se puede elegir un mes futuro.'} />
        {!filtroContrato && mesSel && (
          <Button size="sm" variant="secondary" onClick={() => setMesSel('')}>Ver todos los meses</Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="field__input" placeholder="Buscar por concepto o proveedor…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: '16rem' }} />
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fTipo} onChange={e => setFTipo(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
          <option value="todos">Todos los tipos</option>
          {tipos.data.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <div className="segment">
          {(['todos', 'pendiente', 'parcial', 'pagado', 'anulado'] as const).map(k => (
            <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>{k === 'todos' ? 'Todos' : estadoInfo(k).label}</button>
          ))}
        </div>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo alquiler</Button>}
      </div>

      <Card title={mesSel ? `Alquileres de ${nombreMes(mesSel)} (${dataFiltrada.length})` : `Alquileres (${dataFiltrada.length})`}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p>
        ) : error ? (
          <p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>
            {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
          </p>
        ) : dataFiltrada.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin alquileres registrados.</p>
        ) : dataFiltrada.map(a => {
          const estadoPago = estados[a.id]
          const valor = estadoPago ? num(estadoPago.valor_total) : num(a.valor)
          const saldo = estadoPago ? num(estadoPago.saldo) : valor
          const abonado = valor - saldo
          const pct = valor > 0 ? Math.min(100, Math.round((abonado / valor) * 100)) : 0
          const estado = estadoPago?.estado ?? a.estado ?? 'pendiente'
          const info = estadoInfo(estado)
          const anulado = estado === 'anulado'
          const expanded = expandedId === a.id
          const proveedorNombre = nombreProveedor(a.id_proveedor)

          return (
            <div key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem', opacity: anulado ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '12rem' }}>
                  <p style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {a.concepto}
                    {a.tipo && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{a.tipo}</span>}
                    {a.id_contrato != null && <span className="badge badge--info" style={{ fontSize: '0.65rem' }}>{a.contrato ?? `Contrato #${a.id_contrato}`}</span>}
                  </p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>
                    {proveedorNombre ? `${proveedorNombre} · ` : ''}Desde {formatDate(a.fecha_inicio)}
                  </p>
                  {estadoPago && (num(estadoPago.valor_retenido) > 0 || num(estadoPago.valor_iva) > 0) && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--amber-700)', margin: '0.125rem 0 0' }}>
                      {num(estadoPago.valor_retenido) > 0 && <>Retención {cop(num(estadoPago.valor_retenido))}</>}
                      {num(estadoPago.valor_retenido) > 0 && num(estadoPago.valor_iva) > 0 && ' · '}
                      {num(estadoPago.valor_iva) > 0 && <>IVA factura {cop(num(estadoPago.valor_iva))}</>}
                    </p>
                  )}
                </div>

                <div style={{ minWidth: '8rem', flex: '0 0 10rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>
                    <span>Pagado</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--slate-100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', transition: 'width 0.3s' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: '7rem' }}>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Saldo</p>
                  <p style={{ fontWeight: 800, color: 'var(--rose-600)', margin: 0 }} className="mono">{cop(saldo)}</p>
                  {saldo !== valor && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', margin: 0 }} className="mono">de {cop(valor)}</p>}
                </div>

                <Badge tone={info.tone}>{info.label}</Badge>

                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {canWrite && !anulado && saldo > 0.01 && <Button size="sm" onClick={() => abrirAbono(a)}>Abonar</Button>}
                  {canWrite && !anulado && <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEdit(a)} />}
                  {canWrite && !anulado && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setAnulando(a)} />}
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(a.id)}>{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</Button>
                </div>
              </div>

              {expanded && (
                <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem' }}>
                  {estadoPago && estadoPago.abonos.length > 0 ? (
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr><th>Fecha</th><th style={{ textAlign: 'right' }}>Abono</th><th>Método</th><th>Comprobante</th>{canWrite && <th></th>}</tr>
                      </thead>
                      <tbody>
                        {estadoPago.abonos.map(ab => (
                          <tr key={ab.id}>
                            <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(ab.fecha_abono)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{cop(num(ab.valor))}</td>
                            <td style={{ fontSize: 'var(--fs-sm)', textTransform: 'capitalize' }}>{ab.metodo_pago ?? '—'}</td>
                            <td style={{ fontSize: 'var(--fs-sm)' }}>{ab.comprobante_url
                              ? <span style={{ color: 'var(--emerald-700)', cursor: 'pointer' }} onClick={() => abrirUrl(ab.comprobante_url)}>✓ Ver</span>
                              : <em style={{ color: 'var(--text-faint)' }}>Sin adjunto</em>}</td>
                            {canWrite && (
                              <td>
                                <div className="row" style={{ gap: 4 }}>
                                  <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => abrirCorregir(ab, a.id)} />
                                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setBorrandoAbono({ ab, idAlquiler: a.id })} />
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700 }}>
                          <td>Total abonado</td>
                          <td style={{ textAlign: 'right' }} className="mono">{cop(abonado)}</td>
                          <td colSpan={canWrite ? 3 : 2} />
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin abonos registrados aún.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* ── Modal: Nuevo / Editar alquiler ── */}
      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo alquiler' : 'Editar alquiler'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.concepto.trim() || !form.valor}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" required placeholder="Alquiler camioneta octubre — FAC 500" style={{ gridColumn: '1 / -1' }} value={form.concepto} onChange={e => f('concepto', e.target.value)} />
          <Select label="Tipo" placeholder="— Sin tipo —" value={form.id_tipo === '' ? '' : String(form.id_tipo)}
            onChange={e => f('id_tipo', e.target.value)} options={tipos.data.map(t => ({ value: String(t.id), label: t.nombre }))} />
          <Select label="Proveedor (opcional)" placeholder="— Sin proveedor —" value={form.id_proveedor === '' ? '' : String(form.id_proveedor)}
            onChange={e => f('id_proveedor', e.target.value)} options={proveedores.map(p => ({ value: String(p.id), label: p.nombre }))}
            helper="Si lo dejas vacío, no podrás abonar — el backend lo exige para pagar." />
          <Input label="Fecha" type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} />
          <Input label="Valor (COP)" type="number" mono step="1000" required value={form.valor} onChange={e => f('valor', e.target.value)} />
          <Input label="IVA de la factura (opcional)" type="number" mono step="1000" placeholder="0"
            value={form.valor_iva} onChange={e => f('valor_iva', e.target.value)}
            helper="Si lo llenas, el backend calcula ReteIVA (15%) sobre este valor." />
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', marginTop: '0.25rem' }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Retención manual (opcional)</p>
            <div className="grid grid--form" style={{ gridColumn: '1 / -1' }}>
              <Input label="ReteFuente manual" type="number" mono step="1" placeholder="Auto: 4% arrendamiento"
                value={form.retencion_fuente_manual} onChange={e => f('retencion_fuente_manual', e.target.value)}
                helper="Vacío = se calcula sola. 0 = fuerza que no aplique." />
              <Input label="ReteIVA manual" type="number" mono step="1" placeholder="Auto: 15% del IVA"
                value={form.reteiva_manual} onChange={e => f('reteiva_manual', e.target.value)}
                helper="Vacío = se calcula sola. 0 = fuerza que no aplique." />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Registrar abono ── */}
      {(() => {
        const saldoActual = abonando ? num(estados[abonando.id]?.saldo ?? abonando.valor) : 0
        const montoNum = Number(formAbono.valor) || 0
        return (
          <Modal open={!!abonando} title={`Registrar abono — ${abonando?.concepto ?? ''}`} onClose={() => setAbonando(null)}
            footer={<><Button variant="secondary" onClick={() => setAbonando(null)}>Cancelar</Button><Button onClick={guardarAbono} disabled={guardandoAbono || !formAbono.valor}>Registrar abono</Button></>}>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--rose-700)' }}>Saldo pendiente: {cop(saldoActual)}</span>
            </div>
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={formAbono.fecha} onChange={e => setFormAbono(v => ({ ...v, fecha: e.target.value }))} />
              <Input label="Valor abonado (COP)" type="number" mono step="1000" required placeholder="500000" value={formAbono.valor}
                onChange={e => setFormAbono(v => ({ ...v, valor: e.target.value }))} helper={`Máximo ${cop(saldoActual)}.`} />
              <Select label="Método de pago" value={formAbono.metodo_pago} onChange={e => setFormAbono(v => ({ ...v, metodo_pago: e.target.value }))} options={METODO_OPTS} />
              {formAbono.metodo_pago !== 'efectivo' && (
                <CuentaBancariaSelect value={formAbono.id_cuenta_bancaria} onChange={id => setFormAbono(v => ({ ...v, id_cuenta_bancaria: id }))} />
              )}
              <Input label="Nota (opcional)" value={formAbono.nota} onChange={e => setFormAbono(v => ({ ...v, nota: e.target.value }))} />
              <ComprobanteInput style={{ gridColumn: '1 / -1' }} value={formAbono.comprobante}
                onChange={file => setFormAbono(v => ({ ...v, comprobante: file }))}
                helper="Comprobante del pago (opcional)." />
            </div>
            {montoNum > 0 && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                Saldo tras el abono: <strong style={{ color: (saldoActual - montoNum) > 0 ? 'var(--rose-700)' : 'var(--green-700)' }}>{cop(Math.max(0, saldoActual - montoNum))}</strong>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ── Modal: Corregir abono ── */}
      <Modal open={!!corrigiendo} title="Corregir abono" onClose={() => setCorrigiendo(null)}
        footer={<><Button variant="secondary" onClick={() => setCorrigiendo(null)}>Cancelar</Button><Button onClick={guardarCorreccion}>Guardar corrección</Button></>}>
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono value={formCorregir.valor} onChange={e => setFormCorregir(v => ({ ...v, valor: e.target.value }))} />
          <Input label="Fecha" type="date" value={formCorregir.fecha} onChange={e => setFormCorregir(v => ({ ...v, fecha: e.target.value }))} />
          <Select label="Método de pago" value={formCorregir.metodo_pago} onChange={e => setFormCorregir(v => ({ ...v, metodo_pago: e.target.value }))} options={METODO_OPTS} />
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          El backend recalcula el saldo/estado del alquiler automáticamente. No puede quedar un total abonado mayor al valor del alquiler.
        </p>
      </Modal>

      <ConfirmDeleteModal open={!!anulando} title="Anular alquiler" itemLabel={anulando?.concepto}
        confirmWord="anular" confirmLabel="Anular alquiler"
        message={<>El registro queda marcado como <strong>anulado</strong> (no se borra, para mantener trazabilidad).</>}
        loading={anulandoLoading} onCancel={() => setAnulando(null)} onConfirm={confirmAnular} />

      <ConfirmDeleteModal open={!!borrandoAbono} title="Eliminar abono" itemLabel={borrandoAbono ? cop(num(borrandoAbono.ab.valor)) : undefined}
        message="El saldo del alquiler vuelve atrás."
        loading={borrandoAbonoLoading} onCancel={() => setBorrandoAbono(null)} onConfirm={confirmarEliminarAbono} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CONTRATOS — gasto recurrente mes a mes, historial/trazabilidad por período
// ════════════════════════════════════════════════════════════════════════════
type EstadoContratoCalc = 'vigente' | 'vencido' | 'anulado'
const ESTADO_CONTRATO_BADGE: Record<EstadoContratoCalc, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  vigente: { label: 'Vigente', tone: 'success' },
  vencido: { label: 'Vencido', tone: 'neutral' },
  anulado: { label: 'Anulado', tone: 'danger' },
}
// Si el backend expone `estado` se respeta; si no, se calcula por fecha_fin —
// esto es lo que da la trazabilidad de "ya no está pero estuvo" sin depender
// de que el backend separe vigentes/históricos (⚠️ ver nota en pagosAlquileres.ts).
function estadoContratoCalc(c: ContratoAlquiler): EstadoContratoCalc {
  if (c.estado === 'anulado') return 'anulado'
  if (c.fecha_fin && c.fecha_fin.slice(0, 10) < todayISO()) return 'vencido'
  return 'vigente'
}

function useContratos() {
  const [data, setData] = useState<ContratoAlquiler[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosAlquileresApi.getContratos()
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

const emptyContratoForm = () => ({ concepto: '', id_tipo: '' as number | '', id_proveedor: '' as number | '', fecha_inicio: todayISO(), fecha_fin: todayISO(), valor_mensual: '' })

function ContratosTab({ canWrite, tipos, onVerMeses }: {
  canWrite: boolean; tipos: ReturnType<typeof useTiposAlquiler>; onVerMeses: (c: FiltroContrato) => void
}) {
  const toast = useToast()
  const contratos = useContratos()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setProveedores(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  const nombreProveedor = useCallback((id?: number | null) => id ? proveedores.find(p => p.id === id)?.nombre ?? `Proveedor #${id}` : null, [proveedores])

  const [fEstado, setFEstado] = useState<'todos' | EstadoContratoCalc>('todos')
  const dataFiltrada = useMemo(
    () => fEstado === 'todos' ? contratos.data : contratos.data.filter(c => estadoContratoCalc(c) === fEstado),
    [contratos.data, fEstado]
  )

  const kpis = useMemo(() => {
    const vigentes = contratos.data.filter(c => estadoContratoCalc(c) === 'vigente')
    return {
      vigentes: vigentes.length,
      comprometido: vigentes.reduce((s, c) => s + num(c.valor_mensual), 0),
      vencidos: contratos.data.filter(c => estadoContratoCalc(c) === 'vencido').length,
      total: contratos.data.length,
    }
  }, [contratos.data])

  // ── Nuevo / Editar contrato ──────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | ContratoAlquiler>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyContratoForm())
  const f = (k: keyof ReturnType<typeof emptyContratoForm>, v: string) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyContratoForm()); setModal('nuevo') }
  const openEdit = (c: ContratoAlquiler) => {
    setForm({
      concepto: c.concepto, id_tipo: c.id_tipo ?? '', id_proveedor: c.id_proveedor ?? '',
      fecha_inicio: c.fecha_inicio?.slice(0, 10) ?? todayISO(), fecha_fin: c.fecha_fin?.slice(0, 10) ?? todayISO(),
      valor_mensual: String(num(c.valor_mensual)),
    })
    setModal(c)
  }
  const save = async () => {
    if (!form.concepto.trim() || !form.valor_mensual || !form.fecha_fin) return
    if (form.id_proveedor === '') { toast.error('El backend exige proveedor en los contratos — selecciona uno.'); return }
    setSaving(true)
    const body: ContratoPayload = {
      concepto: form.concepto.trim(), fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      valor_mensual: Number(form.valor_mensual), id_proveedor: form.id_proveedor,
      id_tipo: form.id_tipo === '' ? undefined : form.id_tipo,
    }
    try {
      if (modal === 'nuevo') { await pagosAlquileresApi.crearContrato(body); toast.success('Contrato creado — se generó un alquiler por cada mes del período') }
      else if (modal) { await pagosAlquileresApi.actualizarContrato(modal.id, body); toast.success('Contrato actualizado') }
      setModal(null); contratos.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Anular contrato ───────────────────────────────────────────
  const [anulando, setAnulando] = useState<ContratoAlquiler | null>(null)
  const [anulandoLoading, setAnulandoLoading] = useState(false)
  const confirmAnular = async () => {
    if (!anulando) return
    setAnulandoLoading(true)
    try { await pagosAlquileresApi.anularContrato(anulando.id); toast.success('Contrato anulado'); setAnulando(null); contratos.reload() }
    catch (e) { toast.error(apiError(e).message); setAnulando(null) }
    finally { setAnulandoLoading(false) }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Contratos vigentes"      value={kpis.vigentes}       icon={<ScrollText size={16} />}  accent="green"   />
        <KpiTile label="Comprometido mensual"    value={cop(kpis.comprometido)} icon={<Wallet size={16} />}   accent="brown"   />
        <KpiTile label="Vencidos"                value={kpis.vencidos}       icon={<RefreshCw size={16} />}   accent="amber"   />
        <KpiTile label="Total histórico"         value={kpis.total}          icon={<Tag size={16} />}         accent="emerald" />
      </div>

      <div className="callout" style={{ marginBottom: '1rem' }}>
        Un contrato genera automáticamente un alquiler por cada mes del período — cada mes se abona individual desde la pestaña "Alquileres" (clic en "Ver meses").
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="segment">
          {(['todos', 'vigente', 'vencido', 'anulado'] as const).map(k => (
            <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>
              {k === 'todos' ? 'Todos' : ESTADO_CONTRATO_BADGE[k].label}
            </button>
          ))}
        </div>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo contrato</Button>}
      </div>

      <Card title={`Contratos (${dataFiltrada.length})`}>
        {contratos.loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p>
        ) : contratos.error ? (
          <p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>
            {contratos.error} · <button onClick={contratos.reload} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
          </p>
        ) : dataFiltrada.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin contratos registrados.</p>
        ) : dataFiltrada.map(c => {
          const estado = estadoContratoCalc(c)
          const info = ESTADO_CONTRATO_BADGE[estado]
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem', opacity: estado === 'anulado' ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: '14rem' }}>
                <p style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {c.concepto}
                  {c.tipo && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{c.tipo}</span>}
                </p>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>
                  {nombreProveedor(c.id_proveedor) ? `${nombreProveedor(c.id_proveedor)} · ` : ''}{formatDate(c.fecha_inicio)} – {formatDate(c.fecha_fin)}
                </p>
              </div>

              <div style={{ textAlign: 'right', minWidth: '8rem' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Valor mensual</p>
                <p style={{ fontWeight: 800, margin: 0 }} className="mono">{cop(num(c.valor_mensual))}</p>
              </div>

              <Badge tone={info.tone}>{info.label}</Badge>

              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <Button size="sm" variant="secondary" icon={<CalendarDays size={13} />} onClick={() => onVerMeses({ id: c.id, concepto: c.concepto })}>Ver meses</Button>
                {canWrite && estado !== 'anulado' && <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEdit(c)} />}
                {canWrite && estado !== 'anulado' && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setAnulando(c)} />}
              </div>
            </div>
          )
        })}
      </Card>

      {/* ── Modal: Nuevo / Editar contrato ── */}
      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo contrato' : 'Editar contrato'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.concepto.trim() || !form.valor_mensual || !form.fecha_fin || form.id_proveedor === ''}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" required placeholder="Arriendo bodega planta — contrato 2026" style={{ gridColumn: '1 / -1' }} value={form.concepto} onChange={e => f('concepto', e.target.value)} />
          <Select label="Tipo" placeholder="— Sin tipo —" value={form.id_tipo === '' ? '' : String(form.id_tipo)}
            onChange={e => f('id_tipo', e.target.value)} options={tipos.data.map(t => ({ value: String(t.id), label: t.nombre }))} />
          <Select label="Proveedor" required placeholder="— Elige un proveedor —" value={form.id_proveedor === '' ? '' : String(form.id_proveedor)}
            onChange={e => f('id_proveedor', e.target.value)} options={proveedores.map(p => ({ value: String(p.id), label: p.nombre }))}
            helper="A diferencia de un alquiler suelto, el contrato sí exige proveedor." />
          <Input label="Fecha de inicio" type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} />
          <Input label="Fecha de fin" type="date" required value={form.fecha_fin} onChange={e => f('fecha_fin', e.target.value)}
            helper="El día de inicio se ancla cada mes; si un mes no lo tiene (ej. 31 en febrero), se recorta al último día de ese mes." />
          <Input label="Valor mensual (COP)" type="number" mono step="1000" required value={form.valor_mensual} onChange={e => f('valor_mensual', e.target.value)} style={{ gridColumn: '1 / -1' }} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!anulando} title="Anular contrato" itemLabel={anulando?.concepto}
        confirmWord="anular" confirmLabel="Anular contrato"
        message={<>Los meses ya generados quedan <strong>intactos</strong> (no se tocan ni se borran) — solo se anula el contrato para que no genere más meses.</>}
        loading={anulandoLoading} onCancel={() => setAnulando(null)} onConfirm={confirmAnular} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TIPOS DE ALQUILER
// ════════════════════════════════════════════════════════════════════════════
function TiposAlquilerTab({ canWrite, tipos }: { canWrite: boolean; tipos: ReturnType<typeof useTiposAlquiler> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nuevo' | TipoAlquiler>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const openNuevo = () => { setNombre(''); setModal('nuevo') }
  const openEdit = (t: TipoAlquiler) => { setNombre(t.nombre); setModal(t) }
  const save = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nuevo') { await pagosAlquileresApi.crearTipo(nombre.trim()); toast.success('Tipo creado') }
      else if (modal) { await pagosAlquileresApi.actualizarTipo(modal.id, nombre.trim()); toast.success('Tipo actualizado') }
      setModal(null); tipos.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delTipo, setDelTipo] = useState<TipoAlquiler | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delTipo) return
    setDeleting(true)
    try { await pagosAlquileresApi.eliminarTipo(delTipo.id); toast.success('Tipo eliminado'); setDelTipo(null); tipos.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este tipo tiene alquileres asociados y no se puede eliminar.' : message)
      setDelTipo(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Tipos de alquiler (${tipos.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nuevo tipo</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {tipos.loading ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : tipos.data.length === 0 ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin tipos — ej. Vehículos, Maquinaria pesada, Herramientas…</td></tr>
              ) : tipos.data.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(t)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelTipo(t)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo tipo' : 'Editar tipo'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !nombre.trim()}>Guardar</Button></>}>
        <Input label="Nombre" placeholder="Ej: Maquinaria pesada" required value={nombre} onChange={e => setNombre(e.target.value)} />
      </Modal>

      <ConfirmDeleteModal open={!!delTipo} title="Eliminar tipo" itemLabel={delTipo?.nombre} loading={deleting} onCancel={() => setDelTipo(null)} onConfirm={confirmDelete} />
    </>
  )
}
