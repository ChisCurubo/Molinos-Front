import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FlaskConical, Lock, Pencil, Plus, RefreshCw, RotateCcw, Send, Trash2, Truck } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP, todayISO } from '@/utils/format'
import {
  materialApi, num,
  type ViajeMaterial, type ViajeMaterialLinea, type ViajeMaterialResumen, type InvConcentradoRow,
  type ViajeTrazabilidad, type TrazaLinea,
} from '@/api/material'
import { viajesMaterialMock, type ViajeEstado, type ViajeMetaMock } from '@/api/viajesMaterialMock'

const cop = formatCOP
const thisMonth = new Date().toISOString().slice(0, 7)

// Fecha corta dd/mm/aa para las tablas.
function fmtDMY(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

// Estado del viaje (mock): etiqueta + clase de badge.
const ESTADO_VIAJE: Record<ViajeEstado, { label: string; badge: string }> = {
  abierto:  { label: 'Abierto',  badge: 'badge--warning' },
  cerrado:  { label: 'Cerrado',  badge: 'badge--info'    },
  enviado:  { label: 'Enviado',  badge: 'badge--success' },
}
const META_DEFAULT: ViajeMetaMock = { estado: 'abierto', fecha_salida: null, analisis: [] }

// Tenor de oro del despacho (g Au por tonelada seca de concentrado).
const tenorAu = (auGramos: number, toneladasSeco: number) => (toneladasSeco > 0 ? auGramos / toneladasSeco : 0)

const ESTADO_LOTE_BADGE: Record<string, string> = {
  en_proceso: 'badge--warning', en_canoa: 'badge--info',
  parcialmente_enviado: 'badge--warning', enviado_completo: 'badge--success',
}

// Fila key-value del desglose de un material.
const Dato = ({ k, v, color }: { k: string; v: React.ReactNode; color?: string }) => (
  <span>{k}: <strong style={color ? { color } : undefined}>{v}</strong></span>
)

// Tabla de materiales de origen de un lote (aporte proporcional). Cada material
// se despliega y muestra su desglose de costos (el backend lo trae por material).
function MaterialesTraza({ lineas, conLote }: { lineas: TrazaLinea[]; conLote?: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const rows = lineas.flatMap(ln => ln.materiales.map(m => ({ ...m, _lote: ln.codigo_lote })))
  if (rows.length === 0) return <p style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Sin materiales de origen.</p>
  const totAport = rows.reduce((s, m) => s + num(m.toneladas_aportadas), 0)
  const totConc = rows.reduce((s, m) => s + num(m.concentrado_proporcional), 0)
  const totMat = rows.reduce((s, m) => s + num(m.total_material), 0)
  const totMaq = rows.reduce((s, m) => s + num(m.maquila_proporcional ?? m.maquila), 0)
  const cols = (conLote ? 1 : 0) + 10 // chevron + [lote?] + 9 columnas
  const cop2 = (v: unknown) => num(v) > 0 ? cop(num(v)) : '—'
  return (
    <div className="table-wrap table-wrap--fit" style={{ border: 'none', borderRadius: 0 }}>
      <table className="data-table data-table--fit" style={{ fontSize: 'var(--fs-xs)' }}>
        <thead><tr>
          <th style={{ width: '1.4rem' }}></th>
          {conLote && <th>Lote</th>}
          <th>Vol.</th><th>Mina</th><th>Minero</th><th>Fecha</th>
          <th style={{ textAlign: 'right' }}>Tenor</th>
          <th style={{ textAlign: 'right' }}>T. aport.</th>
          <th style={{ textAlign: 'right' }}>Conc. aportado</th>
          <th style={{ textAlign: 'right' }}>Total material</th>
          <th style={{ textAlign: 'right' }}>Maquila</th>
        </tr></thead>
        <tbody>
          {rows.map(m => {
            const k = `${m._lote}-${m.id_entrada}`
            const isOpen = open.has(k)
            return (
              <React.Fragment key={k}>
                <tr style={{ cursor: 'pointer', ...(isOpen ? { background: 'var(--slate-50)' } : {}) }} onClick={() => toggle(k)}>
                  <td style={{ color: 'var(--text-muted)' }}>{isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}</td>
                  {conLote && <td style={{ fontWeight: 700 }} className="mono">{m._lote}</td>}
                  <td className="mono">{m.numero_volqueta}</td>
                  <td style={{ fontWeight: 600 }}>{m.mina ?? '—'}</td>
                  <td>{m.minero ?? '—'}</td>
                  <td>{fmtDMY(m.fecha_llegada)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{num(m.tenor) > 0 ? num(m.tenor).toFixed(1) : '—'}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{num(m.toneladas_aportadas).toFixed(3)} t</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{num(m.concentrado_proporcional).toFixed(4)} t</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{cop2(m.total_material)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{cop2(m.maquila_proporcional ?? m.maquila)}</td>
                </tr>
                {isOpen && (
                  <tr style={{ background: 'var(--slate-50)' }}>
                    <td colSpan={cols} style={{ padding: '0.4rem 0.85rem 0.7rem 2rem' }}>
                      <div className="callout" style={{ margin: 0, display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                        <Dato k="Seco aportado" v={`${num(m.toneladas_seco_aportadas).toFixed(4)} t`} />
                        <Dato k="% aporte" v={m.porcentaje_aporte != null ? `${m.porcentaje_aporte.toFixed(1)}%` : '—'} />
                        <Dato k="Costo material" v={cop2(m.costo_material)} />
                        <Dato k="Gastos operativos" v={cop2(m.gastos_operativos)} />
                        <Dato k="Total material" v={cop2(m.total_material)} color="var(--emerald-700)" />
                        <Dato k="Excedente" v={cop2(m.excedente)} />
                        <Dato k="Maquila" v={cop2(m.maquila_proporcional ?? m.maquila)} color="var(--green-700)" />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={conLote ? 7 : 6}>Total ({rows.length})</td>
            <td style={{ textAlign: 'right' }} className="mono">{totAport.toFixed(3)} t</td>
            <td style={{ textAlign: 'right' }} className="mono">{totConc.toFixed(4)} t</td>
            <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">{totMat > 0 ? cop(totMat) : '—'}</td>
            <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{totMaq > 0 ? cop(totMaq) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

type PageTab = 'viajes' | 'trazabilidad'
type WizardStep = 0 | 1 | 2

interface SelLinea {
  loteId: number
  codigo: string
  concepto: string
  disp: number       // disponible húmedo (referencia)
  secoDisp: number   // seco del lote (referencia; se despacha en seco)
  auT: number
  concentrado_seco: string  // seco a despachar; '' = todo lo disponible
  checked: boolean
}

export function ViajesMaterialApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [viajes, setViajes] = useState<ViajeMaterial[]>([])
  const [resumen, setResumen] = useState<ViajeMaterialResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pageTab, setPageTab] = useState<PageTab>('viajes')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Filtros
  const [fNumViaje, setFNumViaje] = useState('')
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fLote, setFLote] = useState('')

  // Lotes disponibles (para el wizard / agregar líneas)
  const [lotesDisp, setLotesDisp] = useState<InvConcentradoRow[]>([])

  // Wizard nuevo viaje
  const [wStep, setWStep] = useState<WizardStep>(0)
  const [formDatos, setFormDatos] = useState({ numero_viaje: '', fecha: todayISO(), comentarios: '' })
  const [selLineas, setSelLineas] = useState<SelLinea[]>([])
  const [saving, setSaving] = useState(false)

  // Agregar lotes inline (dentro de la fila expandida, como en Procesamiento)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addSel, setAddSel] = useState<SelLinea[]>([])

  // Estado / pago / análisis del viaje (MOCK — ver docs/viajes_material_mock.md)
  const [metaMap, setMetaMap] = useState<Record<number, ViajeMetaMock>>({})
  const metaOf = (id: number): ViajeMetaMock => metaMap[id] ?? META_DEFAULT

  // Análisis del viaje (mock)
  const [analisisViaje, setAnalisisViaje] = useState<ViajeMaterial | null>(null)
  const [formAnalisis, setFormAnalisis] = useState({ numero_analisis: '', porcentaje_humedad: '13', au_gr_x_ton: '', ag_gr_x_ton: '', comentarios: '' })

  // Editar cabecera (PATCH /material/viajes/:id)
  const [editHdr, setEditHdr] = useState<ViajeMaterial | null>(null)
  const [formHdr, setFormHdr] = useState({ numero_viaje: '', fecha: '', comentarios: '' })

  // Eliminar
  const [delViaje, setDelViaje] = useState<ViajeMaterial | null>(null)

  // Trazabilidad (se pide por viaje al expandir; se cachea en un mapa)
  const [trazaExp, setTrazaExp] = useState<Set<number>>(new Set())
  const [trazaMap, setTrazaMap] = useState<Record<number, ViajeTrazabilidad>>({})
  const [trazaLoad, setTrazaLoad] = useState<Set<number>>(new Set())
  const [trazaLoteExp, setTrazaLoteExp] = useState<Set<string>>(new Set()) // clave `${viajeId}:${loteId}`

  const toggleTrazaLote = (key: string) =>
    setTrazaLoteExp(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleTraza = async (id: number) => {
    setTrazaExp(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    if (!trazaMap[id]) {
      setTrazaLoad(prev => new Set(prev).add(id))
      try {
        const t = await materialApi.getViajeTrazabilidad(id)
        setTrazaMap(prev => ({ ...prev, [id]: t }))
      } catch (e) { toast.error(apiError(e).message) }
      finally { setTrazaLoad(prev => { const n = new Set(prev); n.delete(id); return n }) }
    }
  }

  const load = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([
      materialApi.getViajesMaterial({ limit: 1000 }),
      materialApi.getViajesMaterialResumen(),
    ])
      .then(([vs, r]) => { setViajes(vs); setResumen(r) })
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // Carga la meta (estado/pago/análisis) de los viajes que aún no la tienen.
  useEffect(() => {
    viajes.forEach(v => {
      if (metaMap[v.id] === undefined) {
        viajesMaterialMock.getMeta(v.id).then(m => setMetaMap(prev => ({ ...prev, [v.id]: m })))
      }
    })
  }, [viajes]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLotesDisp = useCallback(() => {
    materialApi.getInventarioConcentrado()
      .then(rows => setLotesDisp(rows.filter(l => num(l.toneladas_disponibles) > 0)))
      .catch(e => toast.error(apiError(e).message))
  }, [toast])

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── KPIs (del resumen del backend, con fallback a lo cargado) ──
  const estesMes = viajes.filter(v => (v.fecha ?? '').startsWith(thisMonth)).length
  const totalTon = resumen ? num(resumen.toneladas_humedo) : viajes.reduce((s, v) => s + num(v.total_concentrado_humedo), 0)
  const totalMaquila = resumen ? num(resumen.maquila_total) : viajes.reduce((s, v) => s + num(v.maquila_total), 0)
  const totalMaterial = resumen ? num(resumen.valor_material_total) : viajes.reduce((s, v) => s + num(v.valor_material_total), 0)
  const auPromedio = resumen ? num(resumen.au_promedio_viaje) : 0
  const agPromedio = resumen ? num(resumen.ag_promedio_viaje) : 0

  // ── Filtro cliente (idéntico a la versión local) ──
  const viajesFiltrados = useMemo(() => viajes.filter(v => {
    if (fNumViaje && !(v.numero_viaje ?? '').toUpperCase().includes(fNumViaje.toUpperCase())) return false
    const fecha = (v.fecha ?? '').slice(0, 10)
    if (fFechaDesde && fecha < fFechaDesde) return false
    if (fFechaHasta && fecha > fFechaHasta) return false
    if (fLote) {
      const q = fLote.toUpperCase()
      if (!v.lineas.some(l => (l.codigo_lote ?? '').toUpperCase().includes(q) || (l.concepto ?? '').toUpperCase().includes(q))) return false
    }
    return true
  }), [viajes, fNumViaje, fFechaDesde, fFechaHasta, fLote])

  // ── Wizard ──
  const abrirWizard = () => {
    setFormDatos({ numero_viaje: '', fecha: todayISO(), comentarios: '' })
    setSelLineas([])
    loadLotesDisp()
    setWStep(1)
  }
  useEffect(() => {
    if (wStep === 2 && selLineas.length === 0 && lotesDisp.length > 0) {
      setSelLineas(lotesDisp.map(l => ({
        loteId: l.id, codigo: l.codigo, concepto: '',
        disp: num(l.toneladas_disponibles), secoDisp: num(l.toneladas_seco), auT: num(l.tenor_au),
        concentrado_seco: '', checked: false,
      })))
    }
  }, [wStep, lotesDisp, selLineas.length])

  const updLinea = (idx: number, field: keyof SelLinea, val: string | boolean) =>
    setSelLineas(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  const seleccionadas = selLineas.filter(s => s.checked)

  const guardarViaje = async () => {
    if (!formDatos.numero_viaje || seleccionadas.length === 0) return
    setSaving(true)
    try {
      const created = await materialApi.createViaje({
        numero_viaje: formDatos.numero_viaje, fecha: formDatos.fecha,
        comentarios: formDatos.comentarios.trim() || undefined,
      })
      const idViaje = created.id
      if (idViaje == null) throw new Error('El servidor no devolvió el id del viaje')
      for (const s of seleccionadas) {
        await materialApi.addViajeLinea(idViaje, {
          id_material_concentrado: s.loteId,
          concentrado_seco: Number(s.concentrado_seco) || undefined, // vacío = todo lo disponible
          concepto: s.concepto.trim() || undefined,
        })
      }
      toast.success('Viaje registrado')
      setWStep(0); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Agregar / quitar líneas (inline en la fila expandida) ──
  const quitarLinea = async (v: ViajeMaterial, l: ViajeMaterialLinea) => {
    if (!confirm(`¿Quitar el lote ${l.codigo_lote ?? ''} del viaje ${v.numero_viaje}? Se devuelve el concentrado al lote.`)) return
    try {
      await materialApi.deleteViajeLinea(v.id, l.id)
      toast.success('Lote quitado del viaje'); load()
    } catch (e) { toast.error(apiError(e).message) }
  }
  const abrirAgregarInline = (v: ViajeMaterial) => { setAddingId(v.id); setAddSel([]); loadLotesDisp() }
  const cancelarAgregarInline = () => { setAddingId(null); setAddSel([]) }
  useEffect(() => {
    if (addingId != null && addSel.length === 0 && lotesDisp.length > 0) {
      const v = viajes.find(x => x.id === addingId)
      const yaEn = new Set(v?.lineas.map(l => l.id_material_concentrado) ?? [])
      setAddSel(lotesDisp.filter(l => !yaEn.has(l.id)).map(l => ({
        loteId: l.id, codigo: l.codigo, concepto: '',
        disp: num(l.toneladas_disponibles), secoDisp: num(l.toneladas_seco), auT: num(l.tenor_au),
        concentrado_seco: '', checked: false,
      })))
    }
  }, [addingId, lotesDisp, viajes, addSel.length])
  const updAddSel = (idx: number, patch: Partial<SelLinea>) =>
    setAddSel(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  const confirmarAgregarInline = async () => {
    if (addingId == null) return
    const sel = addSel.filter(s => s.checked)
    if (sel.length === 0) return
    setSaving(true)
    try {
      for (const s of sel) {
        await materialApi.addViajeLinea(addingId, {
          id_material_concentrado: s.loteId,
          concentrado_seco: Number(s.concentrado_seco) || undefined, // vacío = todo lo disponible
          concepto: s.concepto.trim() || undefined,
        })
      }
      toast.success('Lotes agregados'); setAddingId(null); setAddSel([]); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Estado del viaje (MOCK). El pago del material va aparte (módulo material). ──
  const cambiarEstado = async (v: ViajeMaterial, estado: ViajeEstado) => {
    try {
      const m = await viajesMaterialMock.setEstado(v.id, estado)
      setMetaMap(prev => ({ ...prev, [v.id]: m }))
      toast.success(`Viaje ${ESTADO_VIAJE[estado].label.toLowerCase()}`)
    } catch (e) { toast.error(apiError(e).message) }
  }

  // ── Editar cabecera (PATCH real) ──
  const abrirEditarHdr = (v: ViajeMaterial) => {
    setFormHdr({ numero_viaje: v.numero_viaje, fecha: (v.fecha ?? '').slice(0, 10), comentarios: v.comentarios ?? '' })
    setEditHdr(v)
  }
  const guardarEditarHdr = async () => {
    if (!editHdr || !formHdr.numero_viaje.trim()) return
    setSaving(true)
    try {
      await materialApi.updateViaje(editHdr.id, {
        numero_viaje: formHdr.numero_viaje.trim(),
        fecha: formHdr.fecha || undefined,
        comentarios: formHdr.comentarios.trim() || undefined,
      })
      toast.success('Viaje actualizado'); setEditHdr(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Análisis del viaje (MOCK) ──
  const abrirAnalisis = (v: ViajeMaterial) => {
    setFormAnalisis({ numero_analisis: '', porcentaje_humedad: '13', au_gr_x_ton: '', ag_gr_x_ton: '', comentarios: '' })
    setAnalisisViaje(v)
  }
  const guardarAnalisis = async () => {
    if (!analisisViaje) return
    const au = Number(formAnalisis.au_gr_x_ton)
    if (!formAnalisis.au_gr_x_ton || Number.isNaN(au) || au < 0) { toast.error('El Au (gr/t) debe ser un número ≥ 0'); return }
    setSaving(true)
    try {
      const m = await viajesMaterialMock.addAnalisis(analisisViaje.id, {
        numero_analisis: formAnalisis.numero_analisis.trim() || `AN-${analisisViaje.numero_viaje}`,
        porcentaje_humedad: formAnalisis.porcentaje_humedad ? Number(formAnalisis.porcentaje_humedad) / 100 : null,
        au_gr_x_ton: au,
        ag_gr_x_ton: formAnalisis.ag_gr_x_ton ? Number(formAnalisis.ag_gr_x_ton) : null,
        comentarios: formAnalisis.comentarios.trim() || null,
      })
      setMetaMap(prev => ({ ...prev, [analisisViaje.id]: m }))
      toast.success('Análisis agregado (mock)')
      setAnalisisViaje(null)
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const eliminarAnalisis = async (viajeId: number, analisisId: number) => {
    try {
      const m = await viajesMaterialMock.deleteAnalisis(viajeId, analisisId)
      setMetaMap(prev => ({ ...prev, [viajeId]: m }))
    } catch (e) { toast.error(apiError(e).message) }
  }

  const confirmarDel = async () => {
    if (!delViaje) return
    try {
      await materialApi.deleteViaje(delViaje.id)
      toast.success('Viaje eliminado')
      setDelViaje(null); load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  // ── Trazabilidad tab ──
  // Tabla de viajes con resumen (lotes, maquila, valor, Au/Ag, ton húm/seca, tenor Au).
  // Expandir un viaje muestra el resumen por lote (mismas columnas); expandir un lote
  // muestra los materiales de origen (traza /viajes/:id/trazabilidad, con aporte proporcional).
  const NUM_COLS_TRAZA = 11

  function TrazabilidadTab() {
    return (
      <Card title={`Resumen de trazabilidad (${viajesFiltrados.length} / ${viajes.length})`}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="N.° viaje…"
            value={fNumViaje} onChange={e => setFNumViaje(e.target.value)} style={{ maxWidth: '10rem' }} />
          <input className="field__input" type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" placeholder="Lote o concepto…"
            value={fLote} onChange={e => setFLote(e.target.value)} style={{ maxWidth: '13rem' }} />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '1.5rem' }}></th>
                <th>N.° viaje</th><th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Lotes</th>
                <th style={{ textAlign: 'right' }}>T. Húm.</th>
                <th style={{ textAlign: 'right' }}>T. Seca</th>
                <th style={{ textAlign: 'right' }}>Tenor Au (g/t)</th>
                <th style={{ textAlign: 'right' }}>Au (g)</th>
                <th style={{ textAlign: 'right' }}>Ag (g)</th>
                <th style={{ textAlign: 'right' }}>Maquila</th>
                <th style={{ textAlign: 'right' }}>Valor material</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={NUM_COLS_TRAZA} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando…</td></tr>
              ) : viajesFiltrados.length === 0 ? (
                <tr><td colSpan={NUM_COLS_TRAZA} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  {viajes.length === 0 ? 'No hay viajes registrados.' : 'No hay viajes que coincidan con los filtros.'}
                </td></tr>
              ) : viajesFiltrados.map(v => {
                const isOpen = trazaExp.has(v.id)
                const t = trazaMap[v.id]
                const cargando = trazaLoad.has(v.id)
                const totHum = num(v.total_concentrado_humedo), totSeco = num(v.total_concentrado_seco)
                const au = num(v.au_gramos_total), ag = num(v.ag_gramos_total)
                const maquila = num(v.maquila_total), material = num(v.valor_material_total)
                return (
                  <React.Fragment key={v.id}>
                    <tr style={{ cursor: 'pointer', ...(isOpen ? { background: 'var(--slate-50)' } : {}) }}
                      onClick={() => toggleTraza(v.id)}>
                      <td style={{ color: 'var(--text-muted)' }}>{isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                      <td style={{ fontWeight: 700 }} className="mono">{v.numero_viaje}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(v.fecha)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{v.lineas.length}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{totHum.toFixed(2)} t</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totSeco.toFixed(4)} t</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{tenorAu(au, totSeco).toFixed(1)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{au > 0 ? au.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{ag > 0 ? ag.toFixed(0) : '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{cop(maquila)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{material > 0 ? cop(material) : '—'}</td>
                    </tr>

                    {isOpen && (
                      <tr style={{ background: 'var(--slate-50)' }}>
                        <td colSpan={NUM_COLS_TRAZA} style={{ padding: '0.5rem 1rem 1rem 2rem' }}>
                          {/* Agregados de venta de la cabecera del viaje */}
                          <div className="callout" style={{ marginBottom: '0.75rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                            <Dato k="Costo material" v={cop(num(v.total_costo_material ?? v.valor_material_total))} />
                            <Dato k="Maquila" v={cop(num(v.maquila ?? v.maquila_total))} color="var(--green-700)" />
                            <Dato k="Total viaje" v={cop(v.total_viaje != null ? num(v.total_viaje) : material + maquila)} color="var(--emerald-700)" />
                            <Dato k="Tenor Au venta" v={v.tenor_au_venta != null ? `${num(v.tenor_au_venta).toFixed(2)} g/t` : '—'} color="var(--amber-700)" />
                            <Dato k="Tenor Ag" v={v.tenor_ag != null ? `${num(v.tenor_ag).toFixed(1)} g/t` : '—'} />
                            <Dato k="Grs Au vendidos" v={v.total_grs_au_venta != null ? `${num(v.total_grs_au_venta).toFixed(1)} g` : '—'} />
                            <Dato k="Grs Ag vendidos" v={v.total_grs_ag_venta != null ? `${num(v.total_grs_ag_venta).toFixed(0)} g` : '—'} />
                            <Dato k="Au prom. compra" v={v.au_promedio_compra != null ? `${num(v.au_promedio_compra).toFixed(2)} g/t` : '—'} />
                          </div>
                          {cargando ? (
                            <p style={{ color: 'var(--text-muted)', padding: '0.75rem 0', textAlign: 'center' }}>Cargando trazabilidad…</p>
                          ) : v.lineas.length === 0 ? (
                            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Este viaje no tiene lotes.</em>
                          ) : (
                            <div className="table-wrap" style={{ background: '#fff' }}>
                              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '1.5rem' }}></th>
                                    <th>Lote</th><th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>T. Húm.</th>
                                    <th style={{ textAlign: 'right' }}>T. Seca</th>
                                    <th style={{ textAlign: 'right' }}>Tenor Au (g/t)</th>
                                    <th style={{ textAlign: 'right' }}>Au (g)</th>
                                    <th style={{ textAlign: 'right' }}>Ag (g)</th>
                                    <th style={{ textAlign: 'right' }}>Maquila</th>
                                    <th style={{ textAlign: 'right' }}>Valor mat.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.lineas.map(l => {
                                    const key = `${v.id}:${l.id}`
                                    const loteOpen = trazaLoteExp.has(key)
                                    const humL = num(l.concentrado_humedo), secoL = num(l.concentrado_seco)
                                    const auL = num(l.au_gramos), agL = num(l.ag_gramos)
                                    const trazaLn = t?.lineas.find(x => x.id_lote === l.id_material_concentrado || x.codigo_lote === l.codigo_lote)
                                    const estadoLote = trazaLn?.estado_lote
                                    return (
                                      <React.Fragment key={l.id}>
                                        <tr style={{ cursor: 'pointer', ...(loteOpen ? { background: 'var(--slate-50)' } : {}) }}
                                          onClick={() => toggleTrazaLote(key)}>
                                          <td style={{ color: 'var(--text-muted)' }}>{loteOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</td>
                                          <td style={{ fontWeight: 700 }} className="mono">{l.codigo_lote}</td>
                                          <td>{estadoLote ? <span className={`badge ${ESTADO_LOTE_BADGE[estadoLote] ?? 'badge--neutral'}`}>{estadoLote}</span> : '—'}</td>
                                          <td style={{ textAlign: 'right' }} className="mono">{humL.toFixed(2)} t</td>
                                          <td style={{ textAlign: 'right' }} className="mono">{secoL.toFixed(4)} t</td>
                                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{tenorAu(auL, secoL).toFixed(1)}</td>
                                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{auL > 0 ? auL.toFixed(1) : '—'}</td>
                                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{agL > 0 ? agL.toFixed(0) : '—'}</td>
                                          <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{num(l.costo_maquila) > 0 ? cop(num(l.costo_maquila)) : '—'}</td>
                                          <td style={{ textAlign: 'right' }} className="mono">{num(l.valor_total) > 0 ? cop(num(l.valor_total)) : '—'}</td>
                                        </tr>
                                        {loteOpen && (
                                          <tr style={{ background: '#fff' }}>
                                            <td colSpan={10} style={{ padding: '0 0 0.5rem 1.5rem' }}>
                                              <p style={{ fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '0.4rem 0' }}>Materiales de origen</p>
                                              {trazaLn
                                                ? <MaterialesTraza lineas={[trazaLn]} />
                                                : <p style={{ padding: '0.4rem 0', color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin detalle de materiales de origen.</p>}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td></td><td colSpan={2}>Total</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{totHum.toFixed(2)} t</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{totSeco.toFixed(4)} t</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{tenorAu(au, totSeco).toFixed(1)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{au.toFixed(1)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{ag.toFixed(0)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{cop(maquila)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{material > 0 ? cop(material) : '—'}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // ── Render ──
  return (
    <div className="page">
      <PageHeader title="Viajes material" subtitle="Registro de despachos de concentrado a compradores."
        actions={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>} />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Viajes este mes"      value={estesMes}                    accent="green"   />
        <KpiTile label="T. despachadas total" value={`${totalTon.toFixed(2)} t`}   accent="emerald" />
        <KpiTile label="Total maquila"        value={cop(totalMaquila)}            accent="brown"   />
        <KpiTile label="Total material"       value={cop(totalMaterial)}           accent="amber"   />
        <KpiTile label="Au prom/viaje"        value={`${auPromedio.toFixed(1)} g`} accent="amber"   />
        <KpiTile label="Ag prom/viaje"        value={`${agPromedio.toFixed(0)} g`} accent="brown"   />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={pageTab === 'viajes'}
          className={`segment__btn ${pageTab === 'viajes' ? 'segment__btn--active' : ''}`}
          onClick={() => setPageTab('viajes')}>
          <Truck size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Viajes ({viajes.length})
        </button>
        <button role="tab" aria-selected={pageTab === 'trazabilidad'}
          className={`segment__btn ${pageTab === 'trazabilidad' ? 'segment__btn--active' : ''}`}
          onClick={() => setPageTab('trazabilidad')}>
          Trazabilidad de material
        </button>
      </div>

      {error ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
          {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
        </p></Card>
      ) : pageTab === 'trazabilidad' ? <TrazabilidadTab /> : (
        <Card title={`Viajes de concentrado (${viajesFiltrados.length} / ${viajes.length})`}
          actions={canWrite && (
            <Button size="sm" icon={<Plus size={15}/>} onClick={abrirWizard}>Nuevo viaje</Button>
          )}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="field__input" placeholder="N.° viaje…"
              value={fNumViaje} onChange={e => setFNumViaje(e.target.value)} style={{ maxWidth: '10rem' }} />
            <input className="field__input" type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
            <input className="field__input" type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
            <input className="field__input" placeholder="Lote o concepto…"
              value={fLote} onChange={e => setFLote(e.target.value)} style={{ maxWidth: '13rem' }} />
          </div>

          <div className="table-wrap table-wrap--fit">
            <table className="data-table data-table--fit">
              <thead>
                <tr>
                  <th style={{ width: '1.5rem' }}></th>
                  <th>N.° viaje</th><th>Fechas</th><th>Estado</th>
                  <th style={{ textAlign: 'right' }}>T. Húm.</th>
                  <th style={{ textAlign: 'right' }}>Material</th>
                  <th style={{ textAlign: 'right' }}>Maquila</th>
                  <th style={{ textAlign: 'right' }}>Total viaje</th>
                  <th style={{ textAlign: 'right' }}>Au (g)</th>
                  <th style={{ textAlign: 'right' }}>Ag (g)</th>
                  <th>Lotes</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={canWrite ? 12 : 11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando…</td></tr>
                ) : viajesFiltrados.length === 0 ? (
                  <tr><td colSpan={canWrite ? 12 : 11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
                ) : viajesFiltrados.map(v => {
                  const isExp = expanded.has(v.id)
                  const totHum = num(v.total_concentrado_humedo)
                  const au = num(v.au_gramos_total), ag = num(v.ag_gramos_total)
                  // Prefiere los nuevos agregados del backend. total_viaje = material + maquila (total real).
                  const maquila = num(v.maquila ?? v.maquila_total)
                  const material = num(v.total_costo_material ?? v.valor_material_total)
                  const totalViaje = v.total_viaje != null ? num(v.total_viaje) : material + maquila
                  const meta = metaOf(v.id)
                  const editable = meta.estado === 'abierto'
                  const analisis = meta.analisis
                  return (
                    <React.Fragment key={v.id}>
                      <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                        onClick={() => toggleExpand(v.id)}>
                        <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                        <td style={{ fontWeight: 700 }} className="mono">{v.numero_viaje}</td>
                        <td style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }} className="mono">
                          <div title="Fecha de creación del viaje"><span className="date-tag date-tag--e">C</span>{fmtDMY(v.fecha)}</div>
                          <div title="Fecha de salida (al marcar enviado)"><span className="date-tag date-tag--s">S</span>{meta.fecha_salida ? fmtDMY(meta.fecha_salida) : <em style={{ color: 'var(--text-faint)', fontStyle: 'normal' }}>—</em>}</div>
                        </td>
                        <td><span className={`badge ${ESTADO_VIAJE[meta.estado].badge}`}>{ESTADO_VIAJE[meta.estado].label}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{totHum.toFixed(2)} t</td>
                        <td style={{ textAlign: 'right' }} className="mono">{material > 0 ? cop(material) : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{maquila > 0 ? cop(maquila) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{totalViaje > 0 ? cop(totalViaje) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{au > 0 ? au.toFixed(1) : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{ag > 0 ? ag.toFixed(0) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {v.lineas.map(l => <span key={l.id} className="badge badge--neutral" style={{ fontSize: '0.6rem' }}>{l.codigo_lote}</span>)}
                          </div>
                        </td>
                        {canWrite && (
                          <td onClick={e => e.stopPropagation()}>
                            <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <Button variant="secondary" size="sm" icon={<Pencil size={13}/>} title="Editar cabecera" onClick={() => abrirEditarHdr(v)} />
                              {meta.estado === 'abierto' && (
                                <Button variant="secondary" size="sm" icon={<Lock size={13}/>} title="Cerrar viaje" onClick={() => cambiarEstado(v, 'cerrado')} />
                              )}
                              {meta.estado === 'cerrado' && <>
                                <Button variant="secondary" size="sm" icon={<RotateCcw size={13}/>} title="Reabrir viaje" onClick={() => cambiarEstado(v, 'abierto')} />
                                <Button size="sm" icon={<Send size={13}/>} title="Marcar como enviado" onClick={() => cambiarEstado(v, 'enviado')} />
                              </>}
                              {meta.estado === 'enviado' && (
                                <Button variant="secondary" size="sm" icon={<RotateCcw size={13}/>} title="Revertir envío" onClick={() => cambiarEstado(v, 'cerrado')} />
                              )}
                              <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title={editable ? 'Eliminar viaje' : 'Solo se puede eliminar un viaje abierto'} disabled={!editable} onClick={() => setDelViaje(v)} />
                            </div>
                          </td>
                        )}
                      </tr>

                      {isExp && (
                        <tr style={{ background: 'var(--slate-50)' }}>
                          <td colSpan={canWrite ? 12 : 11} style={{ padding: '0.75rem 1rem 1rem 2rem' }}>
                            <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                              Líneas del viaje ({v.lineas.length}):
                            </p>
                            <div className="table-wrap table-wrap--fit">
                              <table className="data-table data-table--fit" style={{ fontSize: 'var(--fs-sm)' }}>
                                <thead>
                                  <tr>
                                    <th>Lote</th><th>Concepto</th>
                                    <th style={{ textAlign: 'right' }}>T. Húm.</th>
                                    <th style={{ textAlign: 'right' }}>T. Seco</th>
                                    <th style={{ textAlign: 'right' }}>Maquila</th>
                                    <th style={{ textAlign: 'right' }}>Valor mat.</th>
                                    <th style={{ textAlign: 'right' }}>Au (g)</th>
                                    <th style={{ textAlign: 'right' }}>Ag (g)</th>
                                    {canWrite && editable && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.lineas.length === 0 && (
                                    <tr><td colSpan={canWrite && editable ? 9 : 8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Sin lotes. Agrégalos abajo.</td></tr>
                                  )}
                                  {v.lineas.map(l => {
                                    const auL = num(l.au_gramos), agL = num(l.ag_gramos)
                                    return (
                                      <tr key={l.id}>
                                        <td style={{ fontWeight: 700 }} className="mono">{l.codigo_lote}</td>
                                        <td>{l.concepto ?? '—'}</td>
                                        <td style={{ textAlign: 'right' }} className="mono">{num(l.concentrado_humedo).toFixed(2)} t</td>
                                        <td style={{ textAlign: 'right' }} className="mono">{num(l.concentrado_seco).toFixed(4)} t</td>
                                        <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{num(l.costo_maquila) > 0 ? cop(num(l.costo_maquila)) : '—'}</td>
                                        <td style={{ textAlign: 'right' }} className="mono">{num(l.valor_total) > 0 ? cop(num(l.valor_total)) : '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{auL > 0 ? auL.toFixed(1) : '—'}</td>
                                        <td style={{ textAlign: 'right' }} className="mono">{agL > 0 ? agL.toFixed(0) : '—'}</td>
                                        {canWrite && editable && (
                                          <td style={{ textAlign: 'center' }}>
                                            <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Quitar lote del viaje" onClick={() => quitarLinea(v, l)} />
                                          </td>
                                        )}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={2}>Total</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{totHum.toFixed(2)} t</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{num(v.total_concentrado_seco).toFixed(4)} t</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{cop(maquila)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{material > 0 ? cop(material) : '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{au.toFixed(1)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{ag.toFixed(0)}</td>
                                    {canWrite && editable && <td />}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Agregar lotes inline (solo viaje abierto) */}
                            {canWrite && editable && (
                              <div style={{ marginTop: '0.85rem' }}>
                                {addingId !== v.id ? (
                                  <Button size="sm" variant="secondary" icon={<Plus size={14}/>} onClick={() => abrirAgregarInline(v)}>Agregar lotes</Button>
                                ) : (
                                  <div className="callout" style={{ background: '#fff' }}>
                                    <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>Concentrado disponible en canoa</p>
                                    {addSel.length === 0 ? (
                                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', padding: '0.5rem 0' }}>No hay lotes con concentrado disponible.</p>
                                    ) : (
                                      <div className="table-wrap table-wrap--fit" style={{ maxHeight: '18rem', overflowY: 'auto' }}>
                                        <table className="data-table data-table--fit" style={{ fontSize: 'var(--fs-sm)' }}>
                                          <thead>
                                            <tr>
                                              <th style={{ width: '2rem' }}></th>
                                              <th>Lote</th>
                                              <th style={{ textAlign: 'right' }}>Seco disp. (t)</th>
                                              <th style={{ textAlign: 'right' }}>Au (g/t)</th>
                                              <th style={{ textAlign: 'right' }}>Seco a despachar (t)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {addSel.map((s, i) => (
                                              <tr key={s.loteId} style={{ background: s.checked ? 'var(--green-50)' : undefined, cursor: 'pointer' }}
                                                onClick={() => updAddSel(i, { checked: !s.checked })}>
                                                <td><input type="checkbox" checked={s.checked} onChange={e => updAddSel(i, { checked: e.target.checked })} onClick={e => e.stopPropagation()} /></td>
                                                <td style={{ fontWeight: 700 }} className="mono">{s.codigo}</td>
                                                <td style={{ textAlign: 'right' }} className="mono">{s.secoDisp.toFixed(4)}</td>
                                                <td style={{ textAlign: 'right' }} className="mono">{s.auT > 0 ? s.auT.toFixed(1) : '—'}</td>
                                                <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                  <input type="number" step="0.0001" max={s.secoDisp || undefined} disabled={!s.checked} placeholder="todo"
                                                    style={{ fontSize: 'var(--fs-sm)', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', width: '6.5rem', background: s.checked ? undefined : 'var(--slate-50)' }}
                                                    value={s.concentrado_seco} onChange={e => updAddSel(i, { concentrado_seco: e.target.value })} />
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                    <div className="row" style={{ gap: 8, marginTop: '0.75rem' }}>
                                      <Button size="sm" variant="secondary" onClick={cancelarAgregarInline}>Cancelar</Button>
                                      <Button size="sm" onClick={confirmarAgregarInline} disabled={!addSel.some(s => s.checked) || saving}>
                                        {saving ? 'Agregando…' : `Agregar (${addSel.filter(s => s.checked).length})`}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Análisis del viaje (MOCK) */}
                            <div style={{ marginTop: '1rem' }}>
                              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: '0.5rem' }}>
                                <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', margin: 0 }}>
                                  <FlaskConical size={14} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--green-700)' }} />
                                  Análisis del viaje ({analisis.length})
                                </p>
                                <span className="badge badge--neutral" style={{ fontSize: '0.58rem' }}>mock</span>
                                <div style={{ flex: 1 }} />
                                {canWrite && <Button size="sm" variant="secondary" icon={<Plus size={14}/>} onClick={() => abrirAnalisis(v)}>Agregar análisis</Button>}
                              </div>
                              {analisis.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>Sin análisis registrados para este viaje.</p>
                              ) : (
                                <div className="table-wrap table-wrap--fit" style={{ background: '#fff' }}>
                                  <table className="data-table data-table--fit" style={{ fontSize: 'var(--fs-sm)' }}>
                                    <thead>
                                      <tr>
                                        <th>N.° análisis</th>
                                        <th style={{ textAlign: 'right' }}>Au (g/t)</th>
                                        <th style={{ textAlign: 'right' }}>Ag (g/t)</th>
                                        <th style={{ textAlign: 'right' }}>Humedad</th>
                                        <th>Comentarios</th>
                                        {canWrite && <th></th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {analisis.map(a => (
                                        <tr key={a.id}>
                                          <td className="mono">{a.numero_analisis}</td>
                                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{a.au_gr_x_ton != null ? a.au_gr_x_ton.toFixed(2) : '—'}</td>
                                          <td style={{ textAlign: 'right' }} className="mono">{a.ag_gr_x_ton != null ? a.ag_gr_x_ton.toFixed(0) : '—'}</td>
                                          <td style={{ textAlign: 'right' }} className="mono">{a.porcentaje_humedad != null ? `${(a.porcentaje_humedad * 100).toFixed(1)}%` : '—'}</td>
                                          <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{a.comentarios ?? '—'}</td>
                                          {canWrite && (
                                            <td style={{ textAlign: 'center' }}>
                                              <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Eliminar análisis" onClick={() => eliminarAnalisis(v.id, a.id)} />
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Wizard: Nuevo viaje ── */}
      <Modal open={wStep > 0} title={`Nuevo viaje — Paso ${wStep} de 2`} onClose={() => setWStep(0)}
        footer={wStep === 1 ? (
          <>
            <Button variant="secondary" onClick={() => setWStep(0)}>Cancelar</Button>
            <Button onClick={() => setWStep(2)} disabled={!formDatos.numero_viaje}>Siguiente →</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setWStep(1)}>← Atrás</Button>
            <Button onClick={guardarViaje} disabled={seleccionadas.length === 0 || saving}>
              {saving ? 'Guardando…' : `Guardar viaje (${seleccionadas.length} lote${seleccionadas.length !== 1 ? 's' : ''})`}
            </Button>
          </>
        )}>
        {wStep === 1 && (
          <div className="grid grid--form">
            <Input label="N.° de viaje" required placeholder="13-4"
              value={formDatos.numero_viaje} onChange={e => setFormDatos(f => ({...f, numero_viaje: e.target.value}))} />
            <Input label="Fecha" type="date"
              value={formDatos.fecha} onChange={e => setFormDatos(f => ({...f, fecha: e.target.value}))} />
            <Input label="Comentarios (opcional)" value={formDatos.comentarios}
              onChange={e => setFormDatos(f => ({...f, comentarios: e.target.value}))} style={{ gridColumn: '1/-1' }} />
          </div>
        )}
        {wStep === 2 && (
          <>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Selecciona los lotes a despachar y ajusta las cantidades:
            </p>
            {selLineas.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No hay concentrado disponible en canoa.</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '22rem' }}>
                <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '2rem' }}></th>
                      <th>Lote</th><th>Concepto / Mineros</th>
                      <th style={{ textAlign: 'right' }}>Seco disp. (t)</th>
                      <th style={{ textAlign: 'right' }}>Seco a despachar (t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selLineas.map((s, i) => (
                      <tr key={s.loteId} style={{ background: s.checked ? 'var(--green-50)' : undefined }}>
                        <td><input type="checkbox" checked={s.checked} onChange={e => updLinea(i, 'checked', e.target.checked)} /></td>
                        <td style={{ fontWeight: 700 }} className="mono">{s.codigo}</td>
                        <td>
                          <input type="text" placeholder="Descripción / mineros" disabled={!s.checked}
                            style={{ fontSize: 'var(--fs-sm)', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, width: '100%', minWidth: '10rem', background: s.checked ? undefined : 'var(--slate-50)' }}
                            value={s.concepto} onChange={e => updLinea(i, 'concepto', e.target.value)} />
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">{s.secoDisp.toFixed(4)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input type="number" step="0.0001" max={s.secoDisp || undefined} disabled={!s.checked} placeholder="todo"
                            style={{ fontSize: 'var(--fs-sm)', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', width: '6.5rem', background: s.checked ? undefined : 'var(--slate-50)' }}
                            value={s.concentrado_seco} onChange={e => updLinea(i, 'concentrado_seco', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {seleccionadas.length > 0 && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                <strong>{seleccionadas.length} lote{seleccionadas.length !== 1 ? 's' : ''}</strong>
                {' · '}Se despacha en <strong>seco</strong>; vacío = todo lo disponible.
                {' · '}Maquila y valor los calcula el servidor.
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Editar cabecera del viaje ── */}
      <Modal open={!!editHdr} title={`Editar viaje — ${editHdr?.numero_viaje ?? ''}`}
        onClose={() => setEditHdr(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditHdr(null)}>Cancelar</Button>
          <Button onClick={guardarEditarHdr} disabled={!formHdr.numero_viaje.trim() || saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        {editHdr && (
          <div className="grid grid--form">
            <Input label="N.° de viaje" required value={formHdr.numero_viaje}
              onChange={e => setFormHdr(f => ({ ...f, numero_viaje: e.target.value }))} />
            <Input label="Fecha" type="date" value={formHdr.fecha}
              onChange={e => setFormHdr(f => ({ ...f, fecha: e.target.value }))} />
            <Input label="Comentarios" value={formHdr.comentarios}
              onChange={e => setFormHdr(f => ({ ...f, comentarios: e.target.value }))} style={{ gridColumn: '1/-1' }} />
          </div>
        )}
      </Modal>

      {/* ── Modal: Agregar análisis al viaje (MOCK) ── */}
      <Modal open={!!analisisViaje} title={`Agregar análisis — Viaje ${analisisViaje?.numero_viaje ?? ''}`}
        onClose={() => setAnalisisViaje(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAnalisisViaje(null)}>Cancelar</Button>
          <Button onClick={guardarAnalisis} disabled={!formAnalisis.au_gr_x_ton || saving}>{saving ? 'Guardando…' : 'Guardar análisis'}</Button>
        </>}>
        {analisisViaje && (
          <>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              <strong>Función simulada (mock).</strong> Se guarda localmente mientras el backend expone los análisis del viaje. Ver <em>docs/viajes_material_mock.md</em>.
            </div>
            <div className="grid grid--form">
              <Input label="N.° análisis" placeholder={`AN-${analisisViaje.numero_viaje}`}
                value={formAnalisis.numero_analisis} onChange={e => setFormAnalisis(f => ({ ...f, numero_analisis: e.target.value }))} />
              <Input label="Humedad (%)" type="number" step="0.1" placeholder="13"
                value={formAnalisis.porcentaje_humedad} onChange={e => setFormAnalisis(f => ({ ...f, porcentaje_humedad: e.target.value }))} />
              <Input label="Au (gr/t)" type="number" step="0.01" required placeholder="Ej: 45.5"
                value={formAnalisis.au_gr_x_ton} onChange={e => setFormAnalisis(f => ({ ...f, au_gr_x_ton: e.target.value }))} />
              <Input label="Ag (gr/t, opcional)" type="number" step="1" placeholder="Ej: 120"
                value={formAnalisis.ag_gr_x_ton} onChange={e => setFormAnalisis(f => ({ ...f, ag_gr_x_ton: e.target.value }))} />
              <Input label="Comentarios (opcional)" value={formAnalisis.comentarios}
                onChange={e => setFormAnalisis(f => ({ ...f, comentarios: e.target.value }))} style={{ gridColumn: '1/-1' }} />
            </div>
          </>
        )}
      </Modal>

      {/* ── Confirm: Eliminar viaje ── */}
      <Modal open={!!delViaje} title="Eliminar viaje" onClose={() => setDelViaje(null)}
        footer={<><Button variant="secondary" onClick={() => setDelViaje(null)}>Cancelar</Button><Button variant="danger" onClick={confirmarDel}>Eliminar</Button></>}>
        {delViaje && (
          <>
            <p style={{ marginBottom: '0.75rem' }}>
              ¿Eliminar el viaje <strong>{delViaje.numero_viaje}</strong> del {fmtDMY(delViaje.fecha)}?
            </p>
            <div className="callout">
              <p style={{ fontSize: 'var(--fs-sm)' }}>El concentrado de los lotes será restaurado en el servidor:</p>
              <ul style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)', paddingLeft: '1.25rem' }}>
                {delViaje.lineas.map(l => (
                  <li key={l.id}><strong>{l.codigo_lote}</strong> → +{num(l.concentrado_humedo).toFixed(2)} t húm.</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
