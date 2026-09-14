import React, { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FlaskConical, Layers, Pencil, Plus, RefreshCw, Trash2, Zap } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP, todayISO } from '@/utils/format'
import {
  materialApi, num,
  type LoteConcentradoRow, type LoteConcentradoDetalle,
  type AnalisisConcentrado, type ConcentradoResumen, type InvCrudoRow, type ProcesamientoMaterialRow,
  type ConcentradoProcesarResult, type MermaPayload,
} from '@/api/material'

const cop = formatCOP

const ESTADO_LOTE: Record<string, { label: string; badge: string }> = {
  en_proceso:           { label: 'En proceso',           badge: 'badge--warning' },
  en_canoa:             { label: 'En canoa',             badge: 'badge--info'    },
  parcialmente_enviado: { label: 'Parcialmente enviado', badge: 'badge--warning' },
  enviado_completo:     { label: 'Enviado completo',     badge: 'badge--success' },
}

const GROUP_TH: React.CSSProperties = {
  textAlign: 'center', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'var(--text-muted)', background: '#f6f5f3', borderBottom: '1px solid #e5e7eb',
  fontWeight: 700, padding: '4px 6px',
}

// Procesos aplicados a un lote (checkboxes reutilizados en Crear/Editar/Cerrar).
const PROCESOS: [keyof ProcesosState, string][] = [
  ['hizo_molienda', 'Molienda'],
  ['hizo_flotacion', 'Flotación'],
  ['hizo_relave', 'Relave'],
  ['hizo_filtroprensa', 'Filtroprensa'],
]
interface ProcesosState {
  hizo_molienda: boolean
  hizo_flotacion: boolean
  hizo_relave: boolean
  hizo_filtroprensa: boolean
}
const procesosFrom = (l: { hizo_molienda?: boolean | number; hizo_flotacion?: boolean | number; hizo_relave?: boolean | number; hizo_filtroprensa?: boolean | number }): ProcesosState => ({
  hizo_molienda: !!l.hizo_molienda, hizo_flotacion: !!l.hizo_flotacion,
  hizo_relave: !!l.hizo_relave, hizo_filtroprensa: !!l.hizo_filtroprensa,
})

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}
// Prefiere la fecha ya formateada del backend (dd/mm/aa); si no, formatea el ISO.
const fechaFmt = (fmt: string | null | undefined, iso: string | null | undefined) =>
  fmt || (iso ? fmtDMY(iso) : '—')

type Tab = 'lotes' | 'procesamiento'

// ── Tab A: Lotes de concentrado ────────────────────────────────────
function LotesTab() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [lotes, setLotes] = useState<LoteConcentradoRow[]>([])
  const [resumen, setResumen] = useState<ConcentradoResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [detalle, setDetalle] = useState<Record<number, LoteConcentradoDetalle>>({})
  const [analisisMap, setAnalisisMap] = useState<Record<number, AnalisisConcentrado[]>>({})

  // Filtros
  const [fBusqueda, setFBusqueda] = useState('')
  const [fEstado, setFEstado] = useState('todos')
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')

  // Material crudo disponible (para vincular)
  const [crudo, setCrudo] = useState<InvCrudoRow[]>([])

  // Modals
  const [crearOpen, setCrearOpen] = useState(false)
  const [vincularLote, setVincularLote] = useState<LoteConcentradoRow | null>(null)
  const [cerrarLote, setCerrarLote] = useState<LoteConcentradoRow | null>(null)
  const [editarLote, setEditarLote] = useState<LoteConcentradoRow | null>(null)
  const [analisisLote, setAnalisisLote] = useState<LoteConcentradoRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Forms
  const [formCrear, setFormCrear] = useState({ codigo: '', fecha_inicio: todayISO(), hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false })
  const [selVincular, setSelVincular] = useState<Set<number>>(new Set())
  const [tonVincular, setTonVincular] = useState('')
  const [vincResult, setVincResult] = useState<ConcentradoProcesarResult | null>(null)
  const [formCerrar, setFormCerrar] = useState({ ton_humedo: '', porcentaje_humedad: '13', fecha_fin: todayISO(), ubicacion_canoa: '', hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false })
  const [formEditar, setFormEditar] = useState({ codigo: '', fecha_inicio: '', ubicacion_canoa: '', comentarios: '', ton_humedo: '', porcentaje_humedad: '13', merma_au: '', merma_ag: '', hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false })
  // Merma original del lote (para detectar cambios al guardar en Editar).
  const [mermaOrig, setMermaOrig] = useState({ au: '', ag: '' })
  const [formAnalisis, setFormAnalisis] = useState({ numero_analisis: '', porcentaje_humedad: '13', au_concentrado: '', ag_concentrado: '' })

  const load = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([materialApi.getConcentradoLotes(), materialApi.getConcentradoResumen()])
      .then(([ls, r]) => { setLotes(ls); setResumen(r) })
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const toggleExpand = async (id: number) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    if (!detalle[id]) {
      try {
        const [d, an] = await Promise.all([materialApi.getConcentrado(id), materialApi.getAnalisisConcentrado(id).catch(() => [])])
        setDetalle(prev => ({ ...prev, [id]: d }))
        setAnalisisMap(prev => ({ ...prev, [id]: an }))
      } catch (e) { toast.error(apiError(e).message) }
    }
  }

  const lotesFiltrados = lotes.filter(l => {
    if (fBusqueda && !l.codigo.toUpperCase().includes(fBusqueda.toUpperCase())) return false
    if (fEstado !== 'todos' && l.estado !== fEstado) return false
    const fi = (l.fecha_inicio ?? '').slice(0, 10)
    if (fFechaDesde && fi < fFechaDesde) return false
    if (fFechaHasta && fi > fFechaHasta) return false
    return true
  })

  // Selección por ÍNDICE de fila (el `id` de /inventario/crudo no es único por
  // fila; usar el id marcaba varias filas a la vez). El id real se resuelve al guardar.
  const disponibles = crudo
  const totalSelSec = [...selVincular].reduce((s, i) => { const m = disponibles[i]; return m ? s + num(m.disponible_seco || m.total_material_seco) : s }, 0)
  const totalSelHum = [...selVincular].reduce((s, i) => { const m = disponibles[i]; return m ? s + num(m.toneladas_humedo) : s }, 0)
  const toggleSel = (i: number) => setSelVincular(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })

  // ── Writes ──
  const guardarCrear = async () => {
    if (!formCrear.codigo.trim()) return
    setSaving(true)
    try {
      await materialApi.createConcentrado({
        codigo: formCrear.codigo.trim(), fecha_inicio: formCrear.fecha_inicio,
        hizo_molienda: formCrear.hizo_molienda ? 1 : 0, hizo_flotacion: formCrear.hizo_flotacion ? 1 : 0,
        hizo_relave: formCrear.hizo_relave ? 1 : 0, hizo_filtroprensa: formCrear.hizo_filtroprensa ? 1 : 0,
      })
      toast.success('Lote creado')
      setCrearOpen(false)
      setFormCrear({ codigo: '', fecha_inicio: todayISO(), hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false })
      load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const abrirVincular = (l: LoteConcentradoRow) => {
    setVincularLote(l); setSelVincular(new Set()); setTonVincular(''); setVincResult(null)
    materialApi.getInventarioCrudo().then(setCrudo).catch(e => toast.error(apiError(e).message))
  }
  const guardarVincular = async () => {
    if (!vincularLote || selVincular.size === 0) return
    setSaving(true)
    try {
      const ton = tonVincular ? Math.min(Number(tonVincular), totalSelSec) : totalSelSec
      const idEntradas = [...selVincular].map(i => disponibles[i]?.id_entrada).filter((x): x is number => x != null)
      const res = await materialApi.procesarConcentrado(vincularLote.id, { id_entradas: idEntradas, toneladas_procesadas_seco: ton })
      setVincResult(res)
      // Refresca inventario y detalle; deja el modal abierto para ver el acumulado.
      setSelVincular(new Set()); setTonVincular('')
      materialApi.getInventarioCrudo().then(setCrudo).catch(() => {})
      setDetalle(prev => { const n = { ...prev }; delete n[vincularLote.id]; return n }); load()
      toast.success(`Vinculado · acumulado ${num(res.material_seco_procesado).toFixed(3)} t seco`)
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const abrirCerrar = (l: LoteConcentradoRow) => {
    setCerrarLote(l)
    // Si el lote ya tiene análisis con humedad, precárgala (no re-digitarla).
    const anHum = analisisMap[l.id]?.find(a => a.porcentaje_humedad != null)?.porcentaje_humedad
    const humFrac = anHum != null ? num(anHum) : (l.porcentaje_humedad != null ? num(l.porcentaje_humedad) : null)
    setFormCerrar({ ton_humedo: '', porcentaje_humedad: humFrac != null ? String(humFrac * 100) : '13', fecha_fin: todayISO(), ubicacion_canoa: '',
      hizo_molienda: !!l.hizo_molienda, hizo_flotacion: !!l.hizo_flotacion, hizo_relave: !!l.hizo_relave, hizo_filtroprensa: !!l.hizo_filtroprensa })
  }
  const guardarCerrar = async () => {
    if (!cerrarLote || !formCerrar.ton_humedo) return
    setSaving(true)
    try {
      await materialApi.cerrarConcentrado(cerrarLote.id, {
        toneladas_humedo: Number(formCerrar.ton_humedo),
        // Humedad opcional: si se deja vacía, el backend usa la conocida (p.ej. del análisis).
        porcentaje_humedad: formCerrar.porcentaje_humedad ? Number(formCerrar.porcentaje_humedad) / 100 : undefined,
        fecha_fin: formCerrar.fecha_fin,
        hizo_molienda: formCerrar.hizo_molienda, hizo_flotacion: formCerrar.hizo_flotacion,
        hizo_relave: formCerrar.hizo_relave, hizo_filtroprensa: formCerrar.hizo_filtroprensa,
        ubicacion_canoa: formCerrar.ubicacion_canoa || undefined,
      })
      toast.success('Lote cerrado')
      setCerrarLote(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const abrirEditar = (l: LoteConcentradoRow) => {
    setEditarLote(l)
    setMermaOrig({ au: '', ag: '' })
    setFormEditar({
      codigo: l.codigo, fecha_inicio: (l.fecha_inicio ?? '').slice(0, 10),
      ubicacion_canoa: l.ubicacion_canoa ?? '', comentarios: l.comentarios ?? '',
      ton_humedo: l.toneladas_humedo != null ? String(num(l.toneladas_humedo)) : '',
      porcentaje_humedad: l.porcentaje_humedad != null ? String(num(l.porcentaje_humedad) * 100) : '13',
      merma_au: '', merma_ag: '',
      ...procesosFrom(l),
    })
    // Carga la merma actual del lote para precargarla y detectar cambios al guardar.
    materialApi.getConcentradoMerma(l.id).then(mz => {
      const au = mz.merma_au != null ? String(num(mz.merma_au)) : ''
      const ag = mz.merma_ag != null ? String(num(mz.merma_ag)) : ''
      setMermaOrig({ au, ag })
      setFormEditar(f => ({ ...f, merma_au: au, merma_ag: ag }))
    }).catch(() => {})
  }
  const guardarEditar = async () => {
    if (!editarLote) return
    const l = editarLote
    // Datos generales del lote (código, fechas, procesos, ubicación, comentarios).
    const generalChanged =
      formEditar.codigo !== l.codigo ||
      formEditar.fecha_inicio !== (l.fecha_inicio ?? '').slice(0, 10) ||
      formEditar.ubicacion_canoa !== (l.ubicacion_canoa ?? '') ||
      formEditar.comentarios !== (l.comentarios ?? '') ||
      formEditar.hizo_molienda !== !!l.hizo_molienda ||
      formEditar.hizo_flotacion !== !!l.hizo_flotacion ||
      formEditar.hizo_relave !== !!l.hizo_relave ||
      formEditar.hizo_filtroprensa !== !!l.hizo_filtroprensa
    // Concentrado producido (solo lotes en canoa): compara con lo que había.
    const origTon = l.toneladas_humedo != null ? String(num(l.toneladas_humedo)) : ''
    const origHum = l.porcentaje_humedad != null ? String(num(l.porcentaje_humedad) * 100) : '13'
    const concentradoChanged = l.estado === 'en_canoa' && !!formEditar.ton_humedo &&
      (formEditar.ton_humedo !== origTon || formEditar.porcentaje_humedad !== origHum)
    // Merma (gramos de metal): solo se registra si cambió respecto a lo cargado.
    const mermaChanged = formEditar.merma_au !== mermaOrig.au || formEditar.merma_ag !== mermaOrig.ag

    if ((formEditar.merma_au && Number(formEditar.merma_au) < 0) || (formEditar.merma_ag && Number(formEditar.merma_ag) < 0)) {
      toast.error('La merma debe ser un número ≥ 0'); return
    }
    if (!generalChanged && !concentradoChanged && !mermaChanged) { setEditarLote(null); return }
    setSaving(true)
    try {
      if (generalChanged) {
        await materialApi.updateConcentrado(l.id, {
          codigo: formEditar.codigo || undefined,
          fecha_inicio: formEditar.fecha_inicio || undefined,
          ubicacion_canoa: formEditar.ubicacion_canoa || undefined,
          comentarios: formEditar.comentarios || undefined,
          hizo_molienda: formEditar.hizo_molienda, hizo_flotacion: formEditar.hizo_flotacion,
          hizo_relave: formEditar.hizo_relave, hizo_filtroprensa: formEditar.hizo_filtroprensa,
        })
      }
      if (concentradoChanged) {
        await materialApi.corregirConcentrado(l.id, {
          toneladas_humedo: Number(formEditar.ton_humedo),
          porcentaje_humedad: Number(formEditar.porcentaje_humedad) / 100,
          ubicacion_canoa: formEditar.ubicacion_canoa || undefined,
        })
      }
      if (mermaChanged) {
        // Enviar solo lo que cambió (vacío → 0).
        const body: MermaPayload = {}
        if (formEditar.merma_au !== mermaOrig.au) body.merma_au = formEditar.merma_au ? Number(formEditar.merma_au) : 0
        if (formEditar.merma_ag !== mermaOrig.ag) body.merma_ag = formEditar.merma_ag ? Number(formEditar.merma_ag) : 0
        await materialApi.updateConcentradoMerma(l.id, body)
      }
      // Recargar el detalle para mostrar maquila/concentrado recalculados por el back.
      setDetalle(prev => { const n = { ...prev }; delete n[l.id]; return n })
      toast.success(mermaChanged ? 'Lote actualizado · merma registrada' : concentradoChanged ? 'Lote actualizado · concentrado corregido' : 'Lote actualizado · maquila recalculada')
      setEditarLote(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const abrirAnalisis = (l: LoteConcentradoRow) => {
    setAnalisisLote(l)
    setFormAnalisis({
      numero_analisis: l.numero_analisis ?? '',
      porcentaje_humedad: l.porcentaje_humedad != null ? String(num(l.porcentaje_humedad) * 100) : '13',
      au_concentrado: l.au_concentrado != null ? String(num(l.au_concentrado)) : '',
      ag_concentrado: l.ag_concentrado != null ? String(num(l.ag_concentrado)) : '',
    })
  }
  const guardarAnalisis = async () => {
    if (!analisisLote || !formAnalisis.au_concentrado) return
    setSaving(true)
    try {
      await materialApi.createAnalisisConcentrado({
        id_material_concentrado: analisisLote.id,
        numero_analisis: formAnalisis.numero_analisis || undefined,
        porcentaje_humedad: Number(formAnalisis.porcentaje_humedad) / 100,
        au_concentrado: Number(formAnalisis.au_concentrado),
        ag_concentrado: formAnalisis.ag_concentrado ? Number(formAnalisis.ag_concentrado) : undefined,
      })
      toast.success('Análisis guardado')
      setAnalisisLote(null); setDetalle(prev => { const n = { ...prev }; delete n[analisisLote.id]; return n })
      setAnalisisMap(prev => { const n = { ...prev }; delete n[analisisLote.id]; return n }); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const desvincularMaterial = async (idEntrada: number, lote: LoteConcentradoRow) => {
    if (lote.estado !== 'en_proceso') { toast.error(`No se puede desvincular: el lote ${lote.codigo} ya fue cerrado.`); return }
    if (!confirm(`¿Desvincular material del lote ${lote.codigo}? Se devuelve su stock.`)) return
    try {
      await materialApi.deleteConcentradoMaterial(lote.id, idEntrada)
      setDetalle(prev => { const n = { ...prev }; delete n[lote.id]; return n }); load()
      toast.success('Material desvinculado')
    } catch (e) { toast.error(apiError(e).message) }
  }

  const eliminarLote = async (l: LoteConcentradoRow) => {
    if (!confirm(`¿Eliminar lote ${l.codigo}? Esta acción no se puede deshacer.`)) return
    try {
      await materialApi.deleteConcentrado(l.id)
      setDetalle(prev => { const n = { ...prev }; delete n[l.id]; return n })
      setEditarLote(null)
      toast.success('Lote eliminado'); load()
    } catch (e) {
      // 409: el lote ya está en un viaje despachado → mostrar el mensaje del back.
      toast.error(apiError(e).message)
    }
  }

  const kpiEnProceso = resumen?.en_proceso ?? lotes.filter(l => l.estado === 'en_proceso').length
  const kpiEnCanoa   = resumen?.en_canoa ?? lotes.filter(l => l.estado === 'en_canoa').length
  const kpiEnviados  = resumen?.enviado_completo ?? lotes.filter(l => l.estado === 'enviado_completo').length
  const totalDisp    = resumen ? num(resumen.toneladas_disponibles_total) : lotes.reduce((s, l) => s + num(l.toneladas_disponibles), 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="En proceso"       value={kpiEnProceso}                  accent="amber"   />
        <KpiTile label="En canoa"         value={kpiEnCanoa}                    accent="green"   />
        <KpiTile label="Enviados"         value={kpiEnviados}                   accent="emerald" />
        <KpiTile label="Total disponible" value={`${totalDisp.toFixed(2)} t`}   accent="brown"   />
      </div>

      <Card title={`Lotes de concentrado (${lotesFiltrados.length} / ${lotes.length})`}
        actions={<div className="row" style={{ gap: 8 }}>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={load}>Refrescar</Button>
          {canWrite && <Button size="sm" icon={<Plus size={15}/>} onClick={() => setCrearOpen(true)}>Nuevo lote</Button>}
        </div>}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por código…"
            value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} style={{ maxWidth: '14rem' }} />
          <input className="field__input" type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
          <div className="segment">
            {([['todos','Todos'],['en_proceso','En proceso'],['en_canoa','En canoa'],['parcialmente_enviado','Parcial'],['enviado_completo','Enviado']] as [string,string][]).map(([k,l]) => (
              <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap table-wrap--fit">
          <table className="data-table data-table--fit">
            <thead>
              <tr>
                <th style={{ width: '1.5rem' }}></th>
                <th>Código</th><th>Estado</th><th>Fechas</th><th>Proceso</th>
                <th style={{ textAlign: 'right' }}>Mat. procesado</th>
                <th style={{ textAlign: 'right' }}>Concentrado</th>
                <th style={{ textAlign: 'right' }}>Tenor real</th>
                <th style={{ textAlign: 'right' }}>Costo maquila</th>
                <th style={{ textAlign: 'right' }}>Precio total</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem' }}>{error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></td></tr>
              ) : lotesFiltrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : lotesFiltrados.map(l => {
                const isExp = expanded.has(l.id)
                const det = detalle[l.id]
                const matVin = det?.materiales ?? []
                const tieneAnalisis = l.au_gr_x_ton != null
                const matSeco = num(l.material_seco_procesado)
                const maquilaEst = matSeco * num(l.precio_maquila_por_ton || 300000)
                return (
                  <React.Fragment key={l.id}>
                    <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }} onClick={() => toggleExpand(l.id)}>
                      <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                      <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                      <td><span className={`badge ${ESTADO_LOTE[l.estado]?.badge ?? 'badge--neutral'}`}>{ESTADO_LOTE[l.estado]?.label ?? l.estado}</span></td>
                      <td style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }} className="mono">
                        <div title="Entrada / inicio de proceso"><span className="date-tag date-tag--e">E</span>{fechaFmt(l.fecha_inicio_fmt, l.fecha_inicio)}</div>
                        <div title="Salida / fin de proceso"><span className="date-tag date-tag--s">S</span>{(l.fecha_fin_fmt || l.fecha_fin) ? fechaFmt(l.fecha_fin_fmt, l.fecha_fin) : <em style={{ color: 'var(--text-faint)', fontStyle: 'normal' }}>—</em>}</div>
                      </td>
                      <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {[l.hizo_molienda && 'Mol', l.hizo_flotacion && 'Flot', l.hizo_relave && 'Rel', l.hizo_filtroprensa && 'Fil'].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{matSeco > 0 ? `${matSeco.toFixed(3)} t` : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: num(l.toneladas_humedo) > 0 ? 700 : undefined, color: num(l.toneladas_humedo) > 0 ? 'var(--emerald-700)' : undefined }} className="mono">
                        {num(l.toneladas_humedo) > 0 ? `${num(l.toneladas_humedo).toFixed(2)} t` : '—'}
                        {num(l.toneladas_disponibles) > 0 && num(l.toneladas_disponibles) !== num(l.toneladas_humedo) && (
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400 }}>disp {num(l.toneladas_disponibles).toFixed(2)}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: tieneAnalisis ? 'var(--amber-700)' : undefined }} className="mono">
                        {tieneAnalisis ? `${num(l.au_gr_x_ton).toFixed(2)} g/t`
                          : num(l.tenor) > 0 ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{`${num(l.tenor).toFixed(2)} g/t`}</span>
                          : <em style={{ color: 'var(--text-faint)', fontWeight: 400 }}>—</em>}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {num(l.maquila_total) > 0 ? cop(num(l.maquila_total)) : matSeco > 0 ? <span style={{ color: 'var(--text-muted)' }}>{cop(maquilaEst)}</span> : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: num(l.precio_total_material) > 0 ? 'var(--emerald-700)' : undefined }} className="mono">
                        {num(l.precio_total_material) > 0 ? cop(num(l.precio_total_material)) : '—'}
                      </td>
                      {canWrite && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={13}/>} title="Editar lote" onClick={() => abrirEditar(l)} />
                            <Button variant="secondary" size="sm" icon={<FlaskConical size={13}/>} title={tieneAnalisis ? 'Actualizar análisis' : 'Agregar análisis'} onClick={() => abrirAnalisis(l)} />
                          </div>
                        </td>
                      )}
                    </tr>

                    {isExp && (
                      <tr style={{ background: 'var(--slate-50)' }}>
                        <td colSpan={canWrite ? 11 : 10} style={{ padding: '0.75rem 1rem 1rem 2rem' }}>
                          {det && (
                            <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                              <span>Mat. seco: <strong>{num(det.material_seco_procesado).toFixed(3)} t</strong></span>
                              <span>Maquila x ton: <strong>{det.precio_maquila_por_ton != null ? cop(num(det.precio_maquila_por_ton)) : '—'}</strong></span>
                              <span>Maquila total: <strong>{num(det.maquila_total) > 0 ? cop(num(det.maquila_total)) : '—'}</strong></span>
                              <span>Precio total material: <strong style={{ color: 'var(--emerald-700)' }}>{num(det.precio_total_material) > 0 ? cop(num(det.precio_total_material)) : '—'}</strong></span>
                              {num(det.total_material_con_costos) > 0 && <span>Total con costos: <strong>{cop(num(det.total_material_con_costos))}</strong></span>}
                            </div>
                          )}
                          <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                            Materiales procesados ({det ? matVin.length : '…'}):
                          </p>
                          {!det ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Cargando…</p>
                          ) : matVin.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>No hay materiales vinculados aún.</p>
                          ) : (
                            <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
                              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                                <thead>
                                  <tr>
                                    <th>Vol.</th><th>Mina</th><th>Fecha</th>
                                    <th style={{ textAlign: 'right' }}>T. Seco aport.</th>
                                    <th style={{ textAlign: 'right' }}>Tenor</th>
                                    <th style={{ textAlign: 'right' }}>Concentrado aport.</th>
                                    <th style={{ textAlign: 'right' }}>Precio material</th>
                                    {canWrite && l.estado === 'en_proceso' && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {matVin.map(m => {
                                    const secoAport = m.toneladas_seco_aportadas != null ? num(m.toneladas_seco_aportadas) : num(m.total_material_seco)
                                    return (
                                    <tr key={m.id}>
                                      <td className="mono">{m.numero_volqueta}</td>
                                      <td>{m.mina ?? '—'}</td>
                                      <td>{fmtDMY(m.fecha_llegada)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{secoAport.toFixed(4)} t</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{num(m.tenor) > 0 ? `${num(m.tenor).toFixed(1)} gr/t` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: num(m.concentrado_proporcional) > 0 ? 'var(--emerald-700)' : undefined }} className="mono">{m.concentrado_proporcional != null ? `${num(m.concentrado_proporcional).toFixed(4)} t` : '—'}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{m.precio_material_lote != null ? cop(num(m.precio_material_lote)) : '—'}</td>
                                      {canWrite && l.estado === 'en_proceso' && (
                                        <td><Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Desvincular del lote" onClick={() => desvincularMaterial(m.id, l)} /></td>
                                      )}
                                    </tr>
                                  )})}
                                </tbody>
                                <tfoot>
                                  <tr style={{ fontWeight: 700 }}>
                                    <td colSpan={3}>Total material</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{num(det.material_seco_procesado) > 0 ? `${num(det.material_seco_procesado).toFixed(4)} t` : '—'}</td>
                                    <td />
                                    <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">{(() => { const c = matVin.reduce((s, m) => s + num(m.concentrado_proporcional), 0); return c > 0 ? `${c.toFixed(4)} t` : '—' })()}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">{num(det.precio_total_material) > 0 ? cop(num(det.precio_total_material)) : '—'}</td>
                                    {canWrite && l.estado === 'en_proceso' && <td />}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                          {(analisisMap[l.id]?.length ?? 0) > 0 && (
                            <div className="callout" style={{ marginBottom: '0.5rem', fontSize: 'var(--fs-sm)' }}>
                              <FlaskConical size={13} style={{ marginRight: '0.4rem', verticalAlign: 'middle', color: 'var(--green-700)' }} />
                              {analisisMap[l.id].map(a => (
                                <span key={a.id}>
                                  <strong>Análisis {a.numero_analisis}:</strong> Au {num(a.au_gr_x_ton).toFixed(2)} gr/t
                                  {a.ag_gr_x_ton != null && <> · Ag {num(a.ag_gr_x_ton).toFixed(1)} gr/t</>}
                                </span>
                              ))}
                            </div>
                          )}
                          {canWrite && (
                            <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                              {l.estado === 'en_proceso' && <Button size="sm" variant="secondary" icon={<Plus size={14}/>} onClick={() => abrirVincular(l)}>Vincular materiales</Button>}
                              <Button size="sm" variant="secondary" icon={<FlaskConical size={14}/>} onClick={() => abrirAnalisis(l)}>{tieneAnalisis ? 'Actualizar análisis' : 'Agregar análisis'}</Button>
                              {l.estado === 'en_proceso' && matVin.length > 0 && <Button size="sm" icon={<Zap size={14}/>} onClick={() => abrirCerrar(l)}>Cerrar lote</Button>}
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

      {/* ── Modal: Crear lote ── */}
      <Modal open={crearOpen} title="Nuevo lote de concentrado" onClose={() => setCrearOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setCrearOpen(false)}>Cancelar</Button>
          <Button onClick={guardarCrear} disabled={!formCrear.codigo.trim() || saving}>{saving ? 'Creando…' : 'Crear'}</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Código del lote" placeholder="LC-2026-002" required
            value={formCrear.codigo} onChange={e => setFormCrear(f => ({...f, codigo: e.target.value}))} />
          <Input label="Fecha inicio" type="date"
            value={formCrear.fecha_inicio} onChange={e => setFormCrear(f => ({...f, fecha_inicio: e.target.value}))} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Procesos aplicados (Relave ya incluye Filtroprensa):</p>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            {PROCESOS.map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                <input type="checkbox" checked={formCrear[k]} onChange={e => setFormCrear(f => ({...f, [k]: e.target.checked}))} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          El lote queda en estado <strong>En proceso</strong>. La maquila la calcula el sistema.
        </p>
      </Modal>

      {/* ── Modal: Vincular materiales ── */}
      <Modal open={!!vincularLote} title={`Vincular materiales → ${vincularLote?.codigo ?? ''}`}
        onClose={() => setVincularLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setVincularLote(null)}>Cancelar</Button>
          <Button onClick={guardarVincular} disabled={selVincular.size === 0 || saving}>Vincular ({selVincular.size})</Button>
        </>}>
        {vincularLote && (
          <>
            {vincResult && (
              <div className="callout" style={{ marginBottom: '0.75rem', background: 'var(--green-50)', borderColor: 'var(--green-200)' }}>
                <strong>Acumulado del lote:</strong> {num(vincResult.material_seco_procesado).toFixed(3)} t seco
                {' · '}Maquila x ton: <strong>{vincResult.precio_maquila_por_ton != null ? cop(num(vincResult.precio_maquila_por_ton)) : '—'}</strong>
                {' · '}Maquila provisional: <strong>{vincResult.maquila_total != null ? cop(num(vincResult.maquila_total)) : '—'}</strong>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Último lote agregado: {num(vincResult.total_seco_agregado).toFixed(3)} t seco. Puedes vincular más material o cerrar.
                </div>
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Material crudo disponible (pendiente sin lote):
            </p>
            {disponibles.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No hay material disponible.</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '18rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '2rem' }}></th>
                      <th>Vol.</th><th>Mina</th><th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Seco (t)</th>
                      <th style={{ textAlign: 'right' }}>Tenor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disponibles.map((m, i) => {
                      const sel = selVincular.has(i)
                      return (
                        <tr key={i} style={{ cursor: 'pointer', ...(sel ? { background: 'var(--green-50)' } : {}) }} onClick={() => toggleSel(i)}>
                          <td><input type="checkbox" checked={sel} onChange={() => toggleSel(i)} onClick={e => e.stopPropagation()} /></td>
                          <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                          <td style={{ fontWeight: 600 }}>{m.mina ?? '—'}</td>
                          <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha_llegada)}</td>
                          <td style={{ textAlign: 'right', fontWeight: sel ? 700 : undefined, color: sel ? 'var(--green-700)' : undefined }} className="mono">{num(m.disponible_seco || m.total_material_seco).toFixed(4)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{num(m.tenor) > 0 ? num(m.tenor).toFixed(1) : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                          <td><span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>{m.estado}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selVincular.size > 0 && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                <strong>Seleccionado:</strong> {totalSelHum.toFixed(3)} t húm · {totalSelSec.toFixed(4)} t seco
                <div style={{ marginTop: '0.5rem' }}>
                  <Input label="Toneladas a procesar (opcional)" type="number" step="0.001"
                    placeholder={`Máx ${totalSelSec.toFixed(3)} t — vacío = 100%`}
                    value={tonVincular} onChange={e => setTonVincular(e.target.value)}
                    helper="Si es menor, se distribuye proporcionalmente entre los seleccionados" />
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Cerrar lote ── */}
      <Modal open={!!cerrarLote} title={`Cerrar lote — ${cerrarLote?.codigo ?? ''}`}
        onClose={() => setCerrarLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setCerrarLote(null)}>Cancelar</Button>
          <Button onClick={guardarCerrar} disabled={!formCerrar.ton_humedo || saving}>{saving ? 'Cerrando…' : 'Cerrar lote'}</Button>
        </>}>
        {cerrarLote && (
          <>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              Materia procesada: <strong>{num(cerrarLote.material_seco_procesado).toFixed(3)} t seco</strong>
            </div>
            <div className="grid grid--form">
              <Input label="Toneladas húmedas producidas" type="number" step="0.001" required placeholder="0.000"
                value={formCerrar.ton_humedo} onChange={e => setFormCerrar(f => ({...f, ton_humedo: e.target.value}))} />
              <Input label="Humedad del concentrado (%)" type="number" step="0.1" placeholder="13"
                value={formCerrar.porcentaje_humedad} onChange={e => setFormCerrar(f => ({...f, porcentaje_humedad: e.target.value}))}
                helper={cerrarLote.au_gr_x_ton != null ? 'Precargada del análisis del lote; ajústala solo si difiere.' : undefined} />
              <Input label="Fecha fin proceso" type="date"
                value={formCerrar.fecha_fin} onChange={e => setFormCerrar(f => ({...f, fecha_fin: e.target.value}))} />
              <Input label="Ubicación canoa" placeholder="Canoa Principal"
                value={formCerrar.ubicacion_canoa} onChange={e => setFormCerrar(f => ({...f, ubicacion_canoa: e.target.value}))} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Procesos aplicados (Relave ya incluye Filtroprensa):</p>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                {([['hizo_molienda','Molienda'],['hizo_flotacion','Flotación'],['hizo_relave','Relave'],['hizo_filtroprensa','Filtroprensa']] as [keyof typeof formCerrar, string][]).map(([k, label]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                    <input type="checkbox" checked={formCerrar[k] as boolean} onChange={e => setFormCerrar(f => ({...f, [k]: e.target.checked}))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {formCerrar.ton_humedo && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                T. seco: <strong>{(Number(formCerrar.ton_humedo) * (1 - Number(formCerrar.porcentaje_humedad) / 100)).toFixed(4)} t</strong>
                {' · '}Disponible en canoa: <strong>{Number(formCerrar.ton_humedo).toFixed(2)} t húm.</strong>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Editar lote ── */}
      <Modal open={!!editarLote} title={`Editar lote — ${editarLote?.codigo ?? ''}`}
        onClose={() => setEditarLote(null)}
        footer={<div className="row" style={{ justifyContent: 'space-between', width: '100%', gap: 8 }}>
          {editarLote && (editarLote.estado === 'en_proceso' || editarLote.estado === 'en_canoa')
            ? <Button variant="ghost" icon={<Trash2 size={14}/>} onClick={() => eliminarLote(editarLote)}
                style={{ color: 'var(--rose-600)' }}>Eliminar lote</Button>
            : <span />}
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={() => setEditarLote(null)}>Cancelar</Button>
            <Button onClick={guardarEditar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>}>
        {editarLote && (
          <>
            <div className="grid grid--form">
              <Input label="Código" value={formEditar.codigo} onChange={e => setFormEditar(f => ({...f, codigo: e.target.value}))} />
              <Input label="Fecha inicio" type="date" value={formEditar.fecha_inicio} onChange={e => setFormEditar(f => ({...f, fecha_inicio: e.target.value}))} />
              <Input label="Ubicación canoa" placeholder="Canoa Principal" value={formEditar.ubicacion_canoa} onChange={e => setFormEditar(f => ({...f, ubicacion_canoa: e.target.value}))} />
              <Input label="Maquila por tonelada" value={editarLote.precio_maquila_por_ton != null ? cop(num(editarLote.precio_maquila_por_ton)) : '—'} readOnly disabled helper="Derivado de los procesos (solo lectura)" />
              <Input label="Comentarios" value={formEditar.comentarios} onChange={e => setFormEditar(f => ({...f, comentarios: e.target.value}))} style={{ gridColumn: '1/-1' }} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Procesos aplicados (Relave ya incluye Filtroprensa):</p>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                {PROCESOS.map(([k, label]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                    <input type="checkbox" checked={formEditar[k]} onChange={e => setFormEditar(f => ({...f, [k]: e.target.checked}))} />
                    {label}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Cambiar los procesos recalcula la maquila en el servidor al guardar.
              </p>
            </div>

            {editarLote.estado === 'en_canoa' && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #e5e7eb)' }}>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Concentrado producido:
                </p>
                <div className="grid grid--form">
                  <Input label="Toneladas húmedas" type="number" step="0.001" placeholder="0.000"
                    value={formEditar.ton_humedo} onChange={e => setFormEditar(f => ({...f, ton_humedo: e.target.value}))} />
                  <Input label="Humedad del concentrado (%)" type="number" step="0.1" placeholder="13"
                    value={formEditar.porcentaje_humedad} onChange={e => setFormEditar(f => ({...f, porcentaje_humedad: e.target.value}))} />
                </div>
                {formEditar.ton_humedo && (
                  <div className="callout" style={{ marginTop: '0.75rem' }}>
                    T. seco: <strong>{(Number(formEditar.ton_humedo) * (1 - Number(formEditar.porcentaje_humedad) / 100)).toFixed(4)} t</strong>
                  </div>
                )}
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Ajusta el concentrado si te equivocaste al cerrar el lote. Solo se corrige si cambias estos valores.
                </p>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #e5e7eb)' }}>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Merma (gramos de metal perdidos):
              </p>
              <div className="grid grid--form">
                <Input label="Merma Au (g)" type="number" step="0.01" min="0" placeholder="0"
                  value={formEditar.merma_au} onChange={e => setFormEditar(f => ({...f, merma_au: e.target.value}))} />
                <Input label="Merma Ag (g)" type="number" step="0.01" min="0" placeholder="0"
                  value={formEditar.merma_ag} onChange={e => setFormEditar(f => ({...f, merma_ag: e.target.value}))} />
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Gramos de metal perdidos en el proceso. Se registra al guardar solo si cambias estos valores.
              </p>
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal: Análisis concentrado ── */}
      <Modal open={!!analisisLote} title={`${analisisLote?.numero_analisis ? 'Actualizar' : 'Agregar'} análisis — ${analisisLote?.codigo ?? ''}`}
        onClose={() => setAnalisisLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAnalisisLote(null)}>Cancelar</Button>
          <Button onClick={guardarAnalisis} disabled={!formAnalisis.au_concentrado || saving}>{saving ? 'Guardando…' : 'Guardar análisis'}</Button>
        </>}>
        {analisisLote && (
          <>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              Lote <strong>{analisisLote.codigo}</strong>. El servidor calcula el tenor (gr/t) a partir del total de gramos y las toneladas secas.
            </div>
            <div className="grid grid--form">
              <Input label="N.° análisis" placeholder="AN-CONC-001"
                value={formAnalisis.numero_analisis} onChange={e => setFormAnalisis(f => ({...f, numero_analisis: e.target.value}))} />
              <Input label="Humedad (%)" type="number" step="0.1" placeholder="13"
                value={formAnalisis.porcentaje_humedad} onChange={e => setFormAnalisis(f => ({...f, porcentaje_humedad: e.target.value}))} />
              <Input label="Au total (gramos)" type="number" step="0.1" required placeholder="Ej: 245.5 g"
                value={formAnalisis.au_concentrado} onChange={e => setFormAnalisis(f => ({...f, au_concentrado: e.target.value}))} />
              <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
                value={formAnalisis.ag_concentrado} onChange={e => setFormAnalisis(f => ({...f, ag_concentrado: e.target.value}))} />
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

// ── Tab B: Procesamiento material ──────────────────────────────────
function ProcesamientoTab() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [rows, setRows] = useState<ProcesamientoMaterialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  // Filtros
  const [fLote, setFLote] = useState('')
  const [fEstado, setFEstado] = useState('todos')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getConcentradoProcesamiento()
      .then(setRows).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const filtrados = rows.filter(m => {
    if (fLote && !((m.codigo_lote ?? '').toUpperCase().includes(fLote.toUpperCase()))) return false
    if (fEstado !== 'todos' && m.estado_lote !== fEstado) return false
    return true
  })
  const totalHum = filtrados.reduce((s, m) => s + num(m.peso_llegada_planta), 0)
  const totalSec = filtrados.reduce((s, m) => s + num(m.total_material_seco), 0)
  const lotesActivos = new Set(rows.filter(m => m.estado_lote === 'en_proceso').map(m => m.id_lote)).size

  const desvincular = async (m: ProcesamientoMaterialRow) => {
    if (m.estado_lote !== 'en_proceso') { toast.error(`No se puede desvincular: el lote ${m.codigo_lote} ya fue cerrado.`); return }
    if (m.id_lote == null) return
    if (!confirm(`¿Desvincular Vol. ${m.numero_volqueta} del lote ${m.codigo_lote}?`)) return
    try {
      await materialApi.deleteConcentradoMaterial(m.id_lote, m.id_entrada)
      toast.success('Material desvinculado'); load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Vinculaciones"   value={filtrados.length}          accent="brown"   />
        <KpiTile label="T. húmedo total" value={`${totalHum.toFixed(2)} t`} accent="green"   />
        <KpiTile label="T. seco total"   value={`${totalSec.toFixed(2)} t`} accent="emerald" />
        <KpiTile label="Lotes activos"   value={lotesActivos}              accent="amber"   />
      </div>

      <Card title={`Procesamiento de material (${filtrados.length} vínculos)`}
        actions={<Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={load}>Refrescar</Button>}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Lote…" value={fLote} onChange={e => setFLote(e.target.value)} style={{ maxWidth: '12rem' }} />
          <div className="segment">
            {([['todos','Todos'],['en_proceso','En proceso'],['en_canoa','En canoa'],['parcialmente_enviado','Parcial'],['enviado_completo','Enviado']] as [string,string][]).map(([k,l]) => (
              <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ background: '#f6f5f3', borderBottom: '1px solid #e5e7eb' }}></th>
                <th colSpan={4} style={GROUP_TH}>Identificación</th>
                <th colSpan={3} style={GROUP_TH}>Pesos y ley</th>
                <th style={GROUP_TH}>Estado</th>
                {canWrite && <th style={{ background: '#f6f5f3', borderBottom: '1px solid #e5e7eb' }}></th>}
              </tr>
              <tr>
                <th style={{ width: '1.5rem' }}></th>
                <th>Lote</th><th>Vol.</th><th>Mina</th><th>Fecha</th>
                <th style={{ textAlign: 'right' }}>T. Aportadas</th>
                <th style={{ textAlign: 'right' }}>T. Seco</th>
                <th style={{ textAlign: 'right' }}>Tenor</th>
                <th>Est. lote</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem' }}>{error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map(m => {
                const isExp = expandedRow === m.id_entrada
                return (
                  <React.Fragment key={m.id_entrada}>
                    <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }} onClick={() => setExpandedRow(isExp ? null : m.id_entrada)}>
                      <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                      <td style={{ fontWeight: 700 }} className="mono">{m.codigo_lote}</td>
                      <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                      <td style={{ fontWeight: 600 }}>{m.mina ?? '—'}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha_llegada)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(m.peso_llegada_planta).toFixed(3)} t</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{num(m.total_material_seco).toFixed(4)} t</td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(m.tenor) > 0 ? `${num(m.tenor).toFixed(1)} gr/t` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                      <td>{m.estado_lote ? <span className={`badge ${ESTADO_LOTE[m.estado_lote]?.badge ?? 'badge--neutral'}`}>{ESTADO_LOTE[m.estado_lote]?.label}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                      {canWrite && (
                        <td onClick={e => e.stopPropagation()}>
                          {m.estado_lote === 'en_proceso' && <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Desvincular del lote" onClick={() => desvincular(m)} />}
                        </td>
                      )}
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={canWrite ? 10 : 9} style={{ padding: '0.85rem 1.25rem', background: '#fafaf9' }}>
                          <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FlaskConical size={14}/> Análisis del material ({m.analisis.length})
                          </div>
                          {m.analisis.length === 0 ? (
                            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin análisis registrado para este material.</em>
                          ) : (
                            <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                              <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '2px 6px' }}>Tipo</th>
                                <th style={{ padding: '2px 6px' }}>N.° análisis</th>
                                <th style={{ padding: '2px 6px', textAlign: 'right' }}>T. seco</th>
                                <th style={{ padding: '2px 6px', textAlign: 'right' }}>Au gr/t</th>
                                <th style={{ padding: '2px 6px', textAlign: 'right' }}>Ag gr/t</th>
                                <th style={{ padding: '2px 6px', textAlign: 'right' }}>Au total</th>
                              </tr></thead>
                              <tbody>
                                {m.analisis.map(a => (
                                  <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '3px 6px' }}><span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{a.tipo ?? 'cabeza'}</span></td>
                                    <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)' }}>{a.numero_analisis}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.toneladas_secas != null ? num(a.toneladas_secas).toFixed(4) : '—'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{num(a.au_gr_x_ton).toFixed(2)}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.ag_gr_x_ton != null ? num(a.ag_gr_x_ton).toFixed(0) : '—'}</td>
                                    <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.au_concentrado != null ? `${num(a.au_concentrado).toFixed(1)} g` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            {!loading && !error && filtrados.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={5}>Total ({filtrados.length})</td>
                  <td style={{ textAlign: 'right' }} className="mono">{totalHum.toFixed(3)} t</td>
                  <td style={{ textAlign: 'right' }} className="mono">{totalSec.toFixed(4)} t</td>
                  <td colSpan={canWrite ? 3 : 2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  )
}

// ── Página principal ───────────────────────────────────────────────
export function ProcesamientoApiPage() {
  const canWrite = useCanWrite('materiales')
  const [tab, setTab] = useState<Tab>('lotes')

  return (
    <div className="page">
      <PageHeader title="Procesamiento" subtitle="Lotes de concentrado, vinculación de materiales y cierre de proceso." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'lotes'}
          className={`segment__btn ${tab === 'lotes' ? 'segment__btn--active' : ''}`} onClick={() => setTab('lotes')}>
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Lotes concentrado
        </button>
        <button role="tab" aria-selected={tab === 'procesamiento'}
          className={`segment__btn ${tab === 'procesamiento' ? 'segment__btn--active' : ''}`} onClick={() => setTab('procesamiento')}>
          Procesamiento material
        </button>
      </div>

      {tab === 'lotes' ? <LotesTab /> : <ProcesamientoTab />}
    </div>
  )
}
