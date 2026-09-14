import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronRight, FileText, FlaskConical, HandCoins, Pencil, Plus,
  RefreshCw, Trash2,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MineroSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { materialApi, num, type EntradaRow, type EntradaDetalle } from '@/api/material'
import {
  pagosMaterialApi,
  type CuentaMaterialRow, type CuentaMaterialDetalle, type CuentaVolqueta, type AnalisisVolqueta,
  type AbonoCxP, type EstadoCxP, type MetodoPago,
} from '@/api/pagosMaterial'

const cop = formatCOP

// ── Etiquetas ─────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<EstadoCxP, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',       cls: 'badge--success' },
  parcial:   { label: 'Pago parcial', cls: 'badge--info'    },
  pendiente: { label: 'Pendiente',    cls: 'badge--warning' },
}
const METODO_OPTS: { value: MetodoPago; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi',         label: 'Nequi' },
  { value: 'deposito',      label: 'Depósito' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'otro',          label: 'Otro' },
]
const METODO_LABEL = (m: string | null) => METODO_OPTS.find(o => o.value === m)?.label ?? (m ?? '—')

// ── Accesores tolerantes al shape del backend ─────────────────────────────────
const cuentaValor  = (c: CuentaMaterialRow) => num(c.valor_total)
const cuentaPagado = (c: CuentaMaterialRow) => num(c.valor_pagado)
const cuentaSaldo  = (c: CuentaMaterialRow) => (c.saldo != null ? num(c.saldo) : cuentaValor(c) - cuentaPagado(c))
const volValor  = (v: CuentaVolqueta) => num(v.precio_total ?? v.monto_aplicado)
const volPagado = (v: CuentaVolqueta) => num(v.pagado_volqueta)
const volSaldo  = (v: CuentaVolqueta) => (v.saldo_volqueta != null ? num(v.saldo_volqueta) : volValor(v) - volPagado(v))
const mineroLabel = (c: CuentaMaterialRow) =>
  c.minero ? (c.minero_alias && c.minero_alias !== c.minero ? `${c.minero} (${c.minero_alias})` : c.minero) : `Minero #${c.id_minero ?? '—'}`
const primerAnalisis = (v: CuentaVolqueta): AnalisisVolqueta | undefined => {
  const a = v.analisis
  if (!a) return undefined
  return Array.isArray(a) ? a[0] : a
}
const metodoPrecioLabel = (m?: string | null) =>
  m === 'por_tonelada' ? 'Por tonelada ($/t)' : m === 'por_gramo' ? 'Por gramo ($/g)' : (m ?? '—')

// ── Estado de formularios ─────────────────────────────────────────────────────
interface AbonoForm { valor: string; fecha_abono: string; metodo_pago: MetodoPago; comprobante_url: string; observaciones: string }
const emptyAbono = (): AbonoForm => ({ valor: '', fecha_abono: todayISO(), metodo_pago: 'transferencia', comprobante_url: '', observaciones: '' })

interface CuentaForm { concepto: string; fecha_limite: string }

export function PagoMaterialApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [cuentas, setCuentas] = useState<CuentaMaterialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fMinero, setFMinero] = useState<number | ''>('')
  const [fEstado, setFEstado] = useState<'todos' | EstadoCxP>('todos')

  // Detalle lazy por cuenta
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [detalles, setDetalles] = useState<Record<number, CuentaMaterialDetalle>>({})
  const [detLoading, setDetLoading] = useState<Set<number>>(new Set())
  const [cardTab, setCardTab] = useState<Record<number, 'volquetas' | 'abonos'>>({})
  // Detalle autoritativo de cada entrada (tenor, humedad, peso, precio, costos, análisis).
  const [entradaDet, setEntradaDet] = useState<Record<number, EntradaDetalle>>({})
  const [openVol, setOpenVol] = useState<Set<number>>(new Set())
  const toggleVol = (idEntrada: number) =>
    setOpenVol(prev => { const n = new Set(prev); n.has(idEntrada) ? n.delete(idEntrada) : n.add(idEntrada); return n })

  // Modal: nueva cuenta
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [nuevaMinero, setNuevaMinero] = useState<number | ''>('')
  const [entradasMinero, setEntradasMinero] = useState<EntradaRow[]>([])
  const [loadingEntradas, setLoadingEntradas] = useState(false)
  const [selEntradas, setSelEntradas] = useState<Set<number>>(new Set())
  const [nuevaForm, setNuevaForm] = useState<CuentaForm>({ concepto: '', fecha_limite: '' })
  const [savingCuenta, setSavingCuenta] = useState(false)

  // Modal: abono (crear/editar)
  const [abonoCuenta, setAbonoCuenta] = useState<number | null>(null)
  const [abonoEdit, setAbonoEdit] = useState<AbonoCxP | null>(null)
  const [abonoForm, setAbonoForm] = useState<AbonoForm>(emptyAbono)
  const [savingAbono, setSavingAbono] = useState(false)

  // Modal: editar cuenta
  const [editCuenta, setEditCuenta] = useState<CuentaMaterialRow | null>(null)
  const [editForm, setEditForm] = useState<CuentaForm>({ concepto: '', fecha_limite: '' })
  const [quitarSel, setQuitarSel] = useState<Set<number>>(new Set())
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Cargar tablero ──────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosMaterialApi.getCuentas({
      id_minero: fMinero === '' ? undefined : fMinero,
      estado: fEstado === 'todos' ? undefined : fEstado,
    })
      .then(rows => setCuentas(Array.isArray(rows) ? rows : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [fMinero, fEstado])
  useEffect(() => { load() }, [load])

  const reloadDetalle = useCallback(async (id: number) => {
    try {
      const det = await pagosMaterialApi.getCuenta(id)
      setDetalles(prev => ({ ...prev, [id]: det }))
      // Enriquecer cada volqueta con el detalle autoritativo de su entrada
      // (tenor, humedad, peso, gramos, precio y análisis), en paralelo.
      const ids = (det.volquetas ?? []).map(v => v.id_entrada).filter(Boolean)
      if (ids.length) {
        const results = await Promise.allSettled(ids.map(eid => materialApi.getEntrada(eid)))
        const add: Record<number, EntradaDetalle> = {}
        results.forEach((r, i) => { if (r.status === 'fulfilled') add[ids[i]] = r.value })
        if (Object.keys(add).length) setEntradaDet(prev => ({ ...prev, ...add }))
      }
    } catch (e) { toast.error(apiError(e).message) }
  }, [toast])

  const toggleExpand = async (id: number) => {
    const isOpen = expanded.has(id)
    setExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(id) : n.add(id); return n })
    if (!isOpen && !detalles[id]) {
      setDetLoading(prev => new Set(prev).add(id))
      await reloadDetalle(id)
      setDetLoading(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  const totalPorPagar = cuentas.reduce((s, c) => s + Math.max(0, cuentaSaldo(c)), 0)
  const totalPagado   = cuentas.reduce((s, c) => s + cuentaPagado(c), 0)
  const conSaldo      = cuentas.filter(c => cuentaSaldo(c) > 0.01).length

  // ── Nueva cuenta ────────────────────────────────────────────
  const abrirNueva = () => {
    setNuevaMinero(''); setEntradasMinero([]); setSelEntradas(new Set())
    setNuevaForm({ concepto: '', fecha_limite: '' }); setNuevaOpen(true)
  }
  const cargarEntradasMinero = useCallback((idMinero: number) => {
    setLoadingEntradas(true); setSelEntradas(new Set())
    materialApi.getEntradasPorMinero(idMinero)
      .then(rows => setEntradasMinero(rows.filter(r => num(r.precio_total) > 0)))
      .catch(e => { toast.error(apiError(e).message); setEntradasMinero([]) })
      .finally(() => setLoadingEntradas(false))
  }, [toast])
  useEffect(() => {
    if (nuevaOpen && nuevaMinero !== '') cargarEntradasMinero(nuevaMinero)
    else setEntradasMinero([])
  }, [nuevaOpen, nuevaMinero, cargarEntradasMinero])

  const toggleSelEntrada = (id: number) =>
    setSelEntradas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const sumSelEntradas = entradasMinero.filter(e => selEntradas.has(e.id)).reduce((s, e) => s + num(e.precio_total), 0)

  const guardarNueva = async () => {
    if (selEntradas.size === 0) { toast.error('Selecciona al menos una volqueta'); return }
    setSavingCuenta(true)
    try {
      await pagosMaterialApi.crearCuenta({
        entradas: [...selEntradas],
        concepto: nuevaForm.concepto.trim() || undefined,
        fecha_limite: nuevaForm.fecha_limite || undefined,
      })
      toast.success('Cuenta de pago creada')
      setNuevaOpen(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingCuenta(false) }
  }

  // ── Abonos ──────────────────────────────────────────────────
  const abrirAbono = (idCuenta: number, saldo: number) => {
    setAbonoCuenta(idCuenta); setAbonoEdit(null)
    setAbonoForm({ ...emptyAbono(), valor: saldo > 0 ? String(Math.round(saldo)) : '' })
  }
  const abrirEditAbono = (idCuenta: number, a: AbonoCxP) => {
    setAbonoCuenta(idCuenta); setAbonoEdit(a)
    setAbonoForm({
      valor: String(num(a.valor)), fecha_abono: (a.fecha_abono ?? todayISO()).slice(0, 10),
      metodo_pago: (a.metodo_pago as MetodoPago) || 'transferencia',
      comprobante_url: a.comprobante_url ?? '', observaciones: a.observaciones ?? '',
    })
  }
  const guardarAbono = async () => {
    if (abonoCuenta == null) return
    const valor = Number(abonoForm.valor)
    if (!(valor > 0)) { toast.error('El valor del abono debe ser mayor a 0'); return }
    if (!abonoForm.comprobante_url.trim()) { toast.error('El comprobante es obligatorio'); return }
    setSavingAbono(true)
    try {
      if (abonoEdit) {
        await pagosMaterialApi.editarAbono(abonoEdit.id, {
          valor, fecha_abono: abonoForm.fecha_abono, metodo_pago: abonoForm.metodo_pago,
          comprobante_url: abonoForm.comprobante_url.trim(), observaciones: abonoForm.observaciones.trim() || undefined,
        })
        toast.success('Abono actualizado')
      } else {
        await pagosMaterialApi.crearAbono(abonoCuenta, {
          valor, fecha_abono: abonoForm.fecha_abono, metodo_pago: abonoForm.metodo_pago,
          comprobante_url: abonoForm.comprobante_url.trim(), observaciones: abonoForm.observaciones.trim() || undefined,
        })
        toast.success('Abono registrado')
      }
      const id = abonoCuenta
      setAbonoCuenta(null)
      await reloadDetalle(id); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingAbono(false) }
  }
  const eliminarAbono = async (idCuenta: number, idAbono: number) => {
    if (!confirm('¿Eliminar este abono? La cuenta volverá a parcial/pendiente.')) return
    try {
      await pagosMaterialApi.eliminarAbono(idAbono)
      toast.success('Abono eliminado')
      await reloadDetalle(idCuenta); load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  // ── Editar / anular cuenta ──────────────────────────────────
  const abrirEditCuenta = (c: CuentaMaterialRow) => {
    setEditCuenta(c); setQuitarSel(new Set())
    setEditForm({ concepto: c.concepto ?? '', fecha_limite: (c.fecha_limite ?? '').slice(0, 10) })
  }
  const guardarEditCuenta = async () => {
    if (!editCuenta) return
    setSavingEdit(true)
    try {
      await pagosMaterialApi.editarCuenta(editCuenta.id, {
        concepto: editForm.concepto.trim() || undefined,
        fecha_limite: editForm.fecha_limite || undefined,
        quitar_entradas: quitarSel.size ? [...quitarSel] : undefined,
      })
      toast.success('Cuenta actualizada')
      const id = editCuenta.id
      setEditCuenta(null)
      await reloadDetalle(id); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingEdit(false) }
  }
  const anularCuenta = async (c: CuentaMaterialRow) => {
    if (!confirm(`¿Anular la cuenta de ${mineroLabel(c)}? Si tiene abonos, elimínalos primero.`)) return
    try {
      await pagosMaterialApi.anularCuenta(c.id)
      toast.success('Cuenta anulada')
      load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  const editDetalle = editCuenta ? detalles[editCuenta.id] : undefined

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader
        title="Pago de material"
        subtitle="Cuentas por pagar agrupadas por minero, con abonos y prorrateo por volqueta."
        actions={canWrite && <Button icon={<Plus size={18} />} onClick={abrirNueva}>Nueva cuenta de pago</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Cuentas con saldo" value={conSaldo} accent="rose" icon={<AlertCircle size={16} />} />
        <KpiTile label="Total por pagar"   value={cop(totalPorPagar)} accent="amber" />
        <KpiTile label="Total pagado"      value={cop(totalPagado)}   accent="green" />
        <KpiTile label="Cuentas"           value={cuentas.length}     accent="brown" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <div style={{ minWidth: '13rem' }}>
          <MineroSelect label="Minero" value={fMinero} onChange={setFMinero} placeholder="Todos los mineros" />
        </div>
        <div className="segment">
          {(['todos', 'pendiente', 'parcial', 'pagado'] as const).map(k => (
            <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>
              {k === 'todos' ? 'Todos' : ESTADO_BADGE[k].label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
      </div>

      {loading ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
      ) : error ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
          {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
        </p></Card>
      ) : cuentas.length === 0 ? (
        <Card title="Sin cuentas de pago">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            No hay cuentas de pago. Crea una agrupando volquetas de un mismo minero.
          </p>
        </Card>
      ) : cuentas.map(c => {
        const valor = cuentaValor(c), pagado = cuentaPagado(c), saldo = cuentaSaldo(c)
        const isOpen = expanded.has(c.id)
        const det = detalles[c.id]
        const tab = cardTab[c.id] ?? 'volquetas'
        const semaforo = saldo <= 0.01 ? '#16a34a' : pagado === 0 ? '#dc2626' : '#f59e0b'
        const pct = valor > 0 ? Math.min(pagado / valor, 1) : (pagado > 0 ? 1 : 0)
        return (
          <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
              onClick={() => toggleExpand(c.id)}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={saldo <= 0.01 ? 'Pagado' : pagado === 0 ? 'Sin abonos' : 'Abono parcial'} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{mineroLabel(c)}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  {c.concepto || `Cuenta #${c.id}`}
                  {c.num_volquetas != null && ` · ${c.num_volquetas} vol.`}
                  {c.fecha_limite && ` · vence ${formatDate(c.fecha_limite)}`}
                </span>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                <span>Valor <strong>{cop(valor)}</strong></span>
                <span style={{ color: '#15803d' }}>Pagado <strong>{cop(pagado)}</strong></span>
                <div style={{ minWidth: 110 }}>
                  <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: saldo > 0.01 ? '#b45309' : '#15803d', minWidth: 96, textAlign: 'right' }} className="mono">
                  {saldo <= 0.01 ? 'Al día' : cop(saldo)}
                  <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{saldo > 0.01 ? 'por pagar' : ''}</div>
                </span>
                <span className={`badge ${ESTADO_BADGE[c.estado]?.cls ?? ''}`}>{ESTADO_BADGE[c.estado]?.label ?? c.estado}</span>
                {canWrite && saldo > 0.01 && (
                  <span onClick={e => e.stopPropagation()}>
                    <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(c.id, saldo)}>Abonar</Button>
                  </span>
                )}
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                {detLoading.has(c.id) || !det ? (
                  <p style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>Cargando detalle…</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div className="segment">
                        {(['volquetas', 'abonos'] as const).map(t => (
                          <button key={t} className={`segment__btn ${tab === t ? 'segment__btn--active' : ''}`}
                            onClick={() => setCardTab(s => ({ ...s, [c.id]: t }))}>
                            {t === 'volquetas' ? `Volquetas (${det.volquetas?.length ?? 0})` : `Abonos (${det.abonos?.length ?? 0})`}
                          </button>
                        ))}
                      </div>
                      {canWrite && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => abrirEditCuenta(c)}>Editar cuenta</Button>
                          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => anularCuenta(c)}>Anular</Button>
                        </div>
                      )}
                    </div>

                    {tab === 'volquetas' ? (
                      (det.volquetas?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin volquetas.</em> : (
                        <div className="table-wrap">
                          <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                            <thead><tr>
                              <th style={{ width: '1.5rem' }}></th>
                              <th>Fecha</th><th>N.° Vol. / Mina</th>
                              <th style={{ textAlign: 'right' }}>Ton secas</th>
                              <th style={{ textAlign: 'right' }}>Tenor</th>
                              <th style={{ textAlign: 'right' }}>Valor material</th>
                              <th style={{ textAlign: 'right' }}>Pagado</th>
                              <th style={{ textAlign: 'right' }}>Saldo</th>
                            </tr></thead>
                            <tbody>
                              {det.volquetas.map(v => {
                                const e = entradaDet[v.id_entrada]
                                const ana = primerAnalisis(v)
                                const anaE = e?.analisis?.[0]
                                const isVolOpen = openVol.has(v.id_entrada)
                                const ton = num(v.toneladas_secas ?? v.peso_seco) || num(e?.total_material_seco)
                                const tenor = num(v.tenor) || num(e?.tenor)
                                const pesoHum = num(v.peso_humedo) || num(e?.peso_llegada_planta)
                                const humedadRaw = num(v.porcentaje_humedad ?? ana?.porcentaje_humedad) || num(e?.porcentaje_humedad ?? anaE?.porcentaje_humedad)
                                const humedad = humedadRaw <= 1 ? humedadRaw * 100 : humedadRaw
                                const gramos = num(v.gramos_oro ?? ana?.au_gramos_totales) || num(e?.total_gramos ?? anaE?.au_gramos_totales)
                                const metodo = v.metodo_precio ?? (num(e?.precio_por_tonelada) > 0 ? 'por_tonelada' : num(e?.precio_por_gramo) > 0 ? 'por_gramo' : e?.metodo_calculo ?? null)
                                const precioUnit = num(v.precio_unitario) || (metodo === 'por_tonelada' ? num(e?.precio_por_tonelada) : num(e?.precio_por_gramo)) || num(e?.precio_por_gramo) || num(e?.precio_por_tonelada)
                                const numAna = ana?.numero_analisis ?? anaE?.numero_analisis
                                const auReal = num(ana?.au_gr_x_ton ?? ana?.tenor_real) || num(anaE?.tenor_real)
                                const auPago = num(ana?.au_falso) || num(anaE?.tenor_falso)
                                const ag = num(ana?.ag_gr_x_ton)
                                // Costos y totales (fuente: detalle de la entrada)
                                const valorMat = num(e?.precio_total) || volValor(v)
                                const cargue = num(e?.costo_cargue), bascula = num(e?.costo_bascula)
                                const maquila = num(e?.costo_maquila), adicional = num(e?.costo_adicional), flete = num(e?.costo_volqueta)
                                const totalCostos = num(e?.total_costos_operativos) || (cargue + bascula + maquila + adicional + flete)
                                const totalMaterial = num(e?.total_material) || (valorMat + totalCostos)
                                const excedente = num(e?.excedente_calculado ?? e?.detalle?.excedente)
                                const costoRows: [string, number][] = [
                                  ['Cargue', cargue], ['Báscula', bascula], ['Maquila', maquila], ['Adicional', adicional], ['Flete (volqueta)', flete],
                                ]
                                return (
                                  <Fragment key={v.id_entrada}>
                                    <tr style={{ cursor: 'pointer', ...(isVolOpen ? { background: 'var(--slate-50)' } : {}) }} onClick={() => toggleVol(v.id_entrada)}>
                                      <td>{isVolOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate((v.fecha_llegada ?? v.fecha ?? e?.fecha_llegada ?? '') as string)}</td>
                                      <td style={{ fontWeight: 600 }}>#{v.numero_volqueta ?? e?.numero_volqueta ?? '—'}{(v.mina ?? e?.mina) ? ` · ${v.mina ?? e?.mina}` : ''}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{ton > 0 ? ton.toFixed(4) : '—'}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{tenor > 0 ? `${tenor.toFixed(2)} g/t` : 'S/A'}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(valorMat)}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{volPagado(v) > 0 ? cop(volPagado(v)) : '—'}</td>
                                      <td style={{ textAlign: 'right', color: volSaldo(v) > 0.01 ? '#b45309' : '#15803d' }} className="mono">{volSaldo(v) > 0.01 ? cop(volSaldo(v)) : 'Al día'}</td>
                                    </tr>
                                    {isVolOpen && (
                                      <tr>
                                        <td colSpan={8} style={{ background: '#fff', padding: '0.75rem 1rem 1rem 2.5rem' }}>
                                          {!e ? (
                                            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Cargando datos del material…</em>
                                          ) : (
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))', gap: '1rem 2rem' }}>
                                            {/* Columna 1: datos del material */}
                                            <div>
                                              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Material</div>
                                              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.75rem', fontSize: 'var(--fs-xs)' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Peso húmedo</span><strong className="mono">{pesoHum > 0 ? `${pesoHum.toFixed(4)} t` : '—'}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Peso seco</span><strong className="mono">{ton > 0 ? `${ton.toFixed(4)} t` : '—'}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Humedad</span><strong className="mono">{humedad > 0 ? `${humedad.toFixed(1)}%` : '—'}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Tenor Au</span><strong className="mono">{tenor > 0 ? `${tenor.toFixed(2)} g/t` : 'S/A'}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Gramos de oro</span><strong className="mono">{gramos > 0 ? `${gramos.toFixed(2)} g` : '—'}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Método</span><strong>{metodoPrecioLabel(metodo)}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}>Precio unitario</span><strong className="mono">{precioUnit > 0 ? cop(precioUnit) : '—'}</strong>
                                              </div>
                                              {(numAna || auReal > 0) && (
                                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FlaskConical size={11} style={{ color: 'var(--amber-600)' }} />{numAna && <strong style={{ color: 'var(--text)' }}>{numAna}</strong>}</span>
                                                  {auReal > 0 && <span>Au real <strong style={{ color: 'var(--text)' }}>{auReal.toFixed(2)}</strong></span>}
                                                  {auPago > 0 && <span style={{ color: 'var(--amber-700)' }}>Au pago <strong>{auPago.toFixed(2)}</strong></span>}
                                                  {ag > 0 && <span>Ag <strong style={{ color: 'var(--text)' }}>{ag.toFixed(0)}</strong></span>}
                                                </div>
                                              )}
                                            </div>
                                            {/* Columna 2: desglose de costo real */}
                                            <div>
                                              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>¿Cuánto sale el material?</div>
                                              <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                  <tr style={{ fontWeight: 700 }}>
                                                    <td style={{ padding: '0.15rem 0' }}>Valor del material</td>
                                                    <td style={{ padding: '0.15rem 0', textAlign: 'right', color: 'var(--text)' }} className="mono">{cop(valorMat)}</td>
                                                  </tr>
                                                  {costoRows.map(([label, val]) => (
                                                    <tr key={label} style={{ color: 'var(--text-muted)' }}>
                                                      <td style={{ padding: '0.15rem 0' }}>+ {label}</td>
                                                      <td style={{ padding: '0.15rem 0', textAlign: 'right' }} className="mono">{val > 0 ? cop(val) : '—'}</td>
                                                    </tr>
                                                  ))}
                                                  <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    <td style={{ padding: '0.25rem 0' }}>Total costos operativos</td>
                                                    <td style={{ padding: '0.25rem 0', textAlign: 'right' }} className="mono">{cop(totalCostos)}</td>
                                                  </tr>
                                                  <tr style={{ borderTop: '2px solid #d6d3d1', fontWeight: 800, color: 'var(--text-muted)' }}>
                                                    <td style={{ padding: '0.3rem 0' }}>Costo total del material</td>
                                                    <td style={{ padding: '0.3rem 0', textAlign: 'right' }} className="mono">{cop(totalMaterial)}</td>
                                                  </tr>
                                                  {excedente > 0 && (
                                                    <tr style={{ color: 'var(--text-muted)' }}>
                                                      <td style={{ padding: '0.2rem 0' }}>Excedente (aparte)</td>
                                                      <td style={{ padding: '0.2rem 0', textAlign: 'right' }} className="mono">{cop(excedente)}</td>
                                                    </tr>
                                                  )}
                                                </tbody>
                                              </table>
                                              <div style={{ marginTop: '0.35rem', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
                                                Al minero se le paga el <strong>valor del material</strong>; los costos operativos son gasto de la planta.
                                              </div>
                                            </div>
                                          </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700 }}>
                                <td colSpan={5}>Total</td>
                                <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(valor)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(pagado)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(saldo)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    ) : (
                      (det.abonos?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos.</em> : (
                        <div className="table-wrap">
                          <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                            <thead><tr>
                              <th>Fecha</th><th>Método</th>
                              <th style={{ textAlign: 'right' }}>Valor</th>
                              <th>Observaciones</th>
                              <th style={{ textAlign: 'center' }}>Comp.</th>
                              {canWrite && <th></th>}
                            </tr></thead>
                            <tbody>
                              {det.abonos.map(a => (
                                <tr key={a.id}>
                                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                                  <td>{METODO_LABEL(a.metodo_pago)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                                  <td style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{a.observaciones || '—'}</td>
                                  <td style={{ textAlign: 'center' }}>{a.comprobante_url
                                    ? <Button variant="ghost" size="sm" icon={<FileText size={13} />} title="Abrir comprobante" onClick={() => window.open(a.comprobante_url!, '_blank', 'noopener,noreferrer')} />
                                    : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                                  {canWrite && (
                                    <td>
                                      <div className="row" style={{ gap: 4 }}>
                                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} title="Editar abono" onClick={() => abrirEditAbono(c.id, a)} />
                                        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} title="Eliminar abono" onClick={() => eliminarAbono(c.id, a.id)} />
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700 }}>
                                <td colSpan={2}>Total abonado</td>
                                <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(pagado)}</td>
                                <td colSpan={canWrite ? 3 : 2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Modal: Nueva cuenta ── */}
      <Modal open={nuevaOpen} title="Nueva cuenta de pago" onClose={() => setNuevaOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setNuevaOpen(false)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarNueva} disabled={savingCuenta || selEntradas.size === 0}>
            {savingCuenta ? 'Creando…' : `Crear cuenta${selEntradas.size ? ` (${selEntradas.size})` : ''}`}
          </Button>
        </>}>
        <div className="grid grid--form" style={{ marginBottom: '0.75rem' }}>
          <MineroSelect label="Minero" required value={nuevaMinero} onChange={setNuevaMinero} />
          <Input label="Concepto (opcional)" placeholder="Material — Agosto"
            value={nuevaForm.concepto} onChange={e => setNuevaForm(f => ({ ...f, concepto: e.target.value }))} />
          <Input label="Fecha límite (opcional)" type="date"
            value={nuevaForm.fecha_limite} onChange={e => setNuevaForm(f => ({ ...f, fecha_limite: e.target.value }))} />
        </div>

        {nuevaMinero === '' ? (
          <div className="callout">Selecciona un minero para ver sus volquetas valorizadas y disponibles.</div>
        ) : loadingEntradas ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando volquetas…</p>
        ) : entradasMinero.length === 0 ? (
          <div className="callout">Este minero no tiene volquetas con precio de material asignado.</div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
              <thead><tr>
                <th style={{ width: '2rem' }}></th>
                <th>Fecha</th><th>N.° Vol. / Mina</th>
                <th style={{ textAlign: 'right' }}>Ton secas</th>
                <th style={{ textAlign: 'right' }}>Tenor</th>
                <th style={{ textAlign: 'right' }}>Valor material</th>
              </tr></thead>
              <tbody>
                {entradasMinero.map(e => {
                  const ton = num(e.total_material_seco), tenor = num(e.tenor)
                  return (
                    <tr key={e.id} style={{ cursor: 'pointer', ...(selEntradas.has(e.id) ? { background: '#fffbeb' } : {}) }} onClick={() => toggleSelEntrada(e.id)}>
                      <td onClick={ev => ev.stopPropagation()}><input type="checkbox" checked={selEntradas.has(e.id)} onChange={() => toggleSelEntrada(e.id)} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.fecha_llegada)}</td>
                      <td style={{ fontWeight: 600 }}>#{e.numero_volqueta}{e.mina ? ` · ${e.mina}` : ''}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{ton > 0 ? ton.toFixed(4) : '—'}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{tenor > 0 ? `${tenor.toFixed(2)} g/t` : 'S/A'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(e.precio_total))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {selEntradas.size > 0 && (
          <div className="callout" style={{ marginTop: '0.75rem' }}>
            <strong>{selEntradas.size}</strong> volqueta(s) · valor total <strong style={{ color: 'var(--green-700)' }}>{cop(sumSelEntradas)}</strong>
          </div>
        )}
      </Modal>

      {/* ── Modal: Abono (crear/editar) ── */}
      {(() => {
        const det = abonoCuenta != null ? detalles[abonoCuenta] : undefined
        const saldoActual = det ? cuentaSaldo(det) : 0
        const valorNum = Number(abonoForm.valor) || 0
        return (
          <Modal open={abonoCuenta != null} title={`${abonoEdit ? 'Editar' : 'Registrar'} abono${det ? ` — ${mineroLabel(det)}` : ''}`}
            onClose={() => setAbonoCuenta(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setAbonoCuenta(null)}>Cancelar</Button>
              <Button icon={<Banknote size={16} />} onClick={guardarAbono} disabled={savingAbono || !(valorNum > 0) || !abonoForm.comprobante_url.trim()}>
                {savingAbono ? 'Guardando…' : abonoEdit ? 'Guardar cambios' : 'Registrar abono'}
              </Button>
            </>}>
            {det && !abonoEdit && (
              <div className="callout" style={{ marginBottom: '1rem' }}>
                Valor total: <strong>{cop(cuentaValor(det))}</strong> · <span style={{ fontWeight: 700, color: 'var(--rose-700)' }}>Saldo: {cop(saldoActual)}</span>
              </div>
            )}
            <div className="grid grid--form">
              <Input label="Valor (COP)" type="number" mono step="1000" required placeholder="2000000"
                value={abonoForm.valor} onChange={e => setAbonoForm(f => ({ ...f, valor: e.target.value }))}
                helper="Puede ser mayor al saldo; el excedente queda a favor del minero." />
              <Input label="Fecha del abono" type="date" required
                value={abonoForm.fecha_abono} onChange={e => setAbonoForm(f => ({ ...f, fecha_abono: e.target.value }))} />
              <Select label="Método de pago" options={METODO_OPTS}
                value={abonoForm.metodo_pago} onChange={e => setAbonoForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPago }))} />
              <Input label="Comprobante (URL)" required placeholder="https://…/comprobante.png"
                value={abonoForm.comprobante_url} onChange={e => setAbonoForm(f => ({ ...f, comprobante_url: e.target.value }))}
                helper="Obligatorio: enlace al soporte de la transferencia." />
              <Input label="Observaciones (opcional)" placeholder="Abono parcial"
                value={abonoForm.observaciones} onChange={e => setAbonoForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
            {det && !abonoEdit && valorNum > 0 && (() => {
              const restante = saldoActual - valorNum
              const aFavor = restante < -0.01 ? -restante : 0
              return (
                <div className="callout" style={{ marginTop: '0.75rem' }}>
                  Saldo tras el abono: <strong style={{ color: restante > 0.01 ? 'var(--rose-700)' : 'var(--green-700)' }}>{cop(Math.max(0, restante))}</strong>
                  {aFavor > 0 && (
                    <div style={{ marginTop: '0.35rem' }}>
                      <span style={{ color: 'var(--green-700)', fontWeight: 700 }}>Queda a favor: {cop(aFavor)}</span>
                      <span style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}> — crédito para futuras cuentas del minero (pendiente de soporte en el backend).</span>
                    </div>
                  )}
                </div>
              )
            })()}
          </Modal>
        )
      })()}

      {/* ── Modal: Editar cuenta ── */}
      <Modal open={editCuenta != null} title={`Editar cuenta${editCuenta ? ` — ${mineroLabel(editCuenta)}` : ''}`}
        onClose={() => setEditCuenta(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditCuenta(null)}>Cancelar</Button>
          <Button onClick={guardarEditCuenta} disabled={savingEdit}>{savingEdit ? 'Guardando…' : 'Guardar cambios'}</Button>
        </>}>
        <div className="grid grid--form" style={{ marginBottom: '0.75rem' }}>
          <Input label="Concepto" value={editForm.concepto} onChange={e => setEditForm(f => ({ ...f, concepto: e.target.value }))} />
          <Input label="Fecha límite" type="date" value={editForm.fecha_limite} onChange={e => setEditForm(f => ({ ...f, fecha_limite: e.target.value }))} />
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
          Quitar volquetas <span style={{ fontWeight: 400 }}>(el total no puede bajar de lo ya abonado)</span>
        </div>
        {!editDetalle ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Cargando volquetas…</p>
        ) : (editDetalle.volquetas?.length ?? 0) === 0 ? (
          <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin volquetas.</em>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
              <thead><tr>
                <th style={{ width: '2rem' }}></th>
                <th>N.° Vol. / Mina</th>
                <th style={{ textAlign: 'right' }}>Valor material</th>
              </tr></thead>
              <tbody>
                {editDetalle.volquetas.map(v => (
                  <tr key={v.id_entrada} style={quitarSel.has(v.id_entrada) ? { background: 'var(--rose-50)', textDecoration: 'line-through' } : undefined}>
                    <td><input type="checkbox" checked={quitarSel.has(v.id_entrada)}
                      onChange={() => setQuitarSel(prev => { const n = new Set(prev); n.has(v.id_entrada) ? n.delete(v.id_entrada) : n.add(v.id_entrada); return n })} /></td>
                    <td>#{v.numero_volqueta ?? '—'}{v.mina ? ` · ${v.mina}` : ''}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(volValor(v))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {quitarSel.size > 0 && (
          <div className="callout" style={{ marginTop: '0.75rem' }}>Se quitarán <strong>{quitarSel.size}</strong> volqueta(s) de la cuenta.</div>
        )}
      </Modal>
    </div>
  )
}
