import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { type ViajeRow, type LineaViaje, type LoteConcentrado } from '@/data/mock'
import { useMateriales } from '@/context/MaterialesContext'

const cop = formatCOP

const thisMonth = new Date().toISOString().slice(0, 7)

type PageTab = 'viajes' | 'trazabilidad'
type WizardStep = 0 | 1 | 2

interface SelLinea {
  loteId: number
  codigo: string
  concepto: string
  concentrado_humedo: string
  concentrado_seco: string
  costo_maquila: string
  valor_total: string
  checked: boolean
}

export function ViajesMaterialPage() {
  const canWrite = useCanWrite('materiales')
  const { viajes, setViajes, lotes, setLotes, materiales, analisis } = useMateriales()

  const [pageTab,    setPageTab]   = useState<PageTab>('viajes')
  const [expanded,   setExpanded]  = useState<Set<number>>(new Set())

  // Filtros viajes
  const [fNumViaje,   setFNumViaje]   = useState('')
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fLote,       setFLote]       = useState('')

  // Wizard
  const [wStep,      setWStep]     = useState<WizardStep>(0)
  const [formDatos,  setFormDatos] = useState({ numero_viaje: '', fecha: todayISO() })
  const [selLineas,  setSelLineas] = useState<SelLinea[]>([])

  // Edit
  const [editViaje,  setEditViaje] = useState<ViajeRow | null>(null)
  const [formEdit,   setFormEdit]  = useState({ fecha: '' })
  const [formEditLineas, setFormEditLineas] = useState<Array<{
    id: number; lote: string; concepto: string
    humedo_s: string; maquila_s: string; valor_s: string
  }>>([])

  const abrirEdit = (v: ViajeRow) => {
    setEditViaje(v)
    setAddOpen(false)
    setFormEdit({ fecha: v.fecha })
    setFormEditLineas(v.lineas.map(l => ({
      id: l.id, lote: l.lote, concepto: l.concepto,
      humedo_s: String(l.concentrado_humedo),
      maquila_s: String(l.costo_maquila),
      valor_s: String(l.valor_total),
    })))
  }

  const updEditLinea = (idx: number, field: 'humedo_s' | 'maquila_s' | 'valor_s' | 'concepto', val: string) =>
    setFormEditLineas(prev => prev.map((fl, i) => i === idx ? { ...fl, [field]: val } : fl))
  const removeEditLinea = (idx: number) =>
    setFormEditLineas(prev => prev.filter((_, i) => i !== idx))

  // Agregar lotes al viaje en edición vía modal de selección (como al crear).
  const [addOpen, setAddOpen] = useState(false)
  const [addSel, setAddSel] = useState<{ id: number; codigo: string; disp: number; auT: number; checked: boolean; humedo_s: string }[]>([])
  const abrirAgregarLotes = () => {
    const disp = lotes.filter(l => l.toneladas_disponibles > 0 && !formEditLineas.some(fl => fl.lote === l.codigo))
    setAddSel(disp.map(l => {
      const an = analisis.find(a => a.id_material_concentrado === l.id)
      return { id: l.id, codigo: l.codigo, disp: l.toneladas_disponibles, auT: an ? an.au_gr_x_ton : 0, checked: false, humedo_s: l.toneladas_disponibles.toFixed(2) }
    }))
    setAddOpen(true)
  }
  const updAddSel = (id: number, patch: Partial<{ checked: boolean; humedo_s: string }>) =>
    setAddSel(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const confirmarAgregarLotes = () => {
    const nuevos = addSel.filter(s => s.checked).map(s => ({
      id: Date.now() + s.id, lote: s.codigo, concepto: s.codigo,
      humedo_s: s.humedo_s || s.disp.toFixed(2), maquila_s: '0', valor_s: '0',
    }))
    setFormEditLineas(prev => [...prev, ...nuevos])
    setAddOpen(false)
  }

  // Delete confirm
  const [delViaje,   setDelViaje]  = useState<ViajeRow | null>(null)

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── KPIs ──────────────────────────────────────────────
  const estesMes    = viajes.filter(v => v.fecha.startsWith(thisMonth)).length
  const totalMaquila  = viajes.reduce((s, v) => s + v.maquila, 0)
  const totalMaterial = viajes.reduce((s, v) => s + v.total_costo_material, 0)
  const totalTon      = viajes.reduce((s, v) => s + v.lineas.reduce((ls, l) => ls + l.concentrado_humedo, 0), 0)

  // Au/Ag que lleva un viaje = ley del análisis del concentrado del lote × toneladas secas de la línea.
  const auAgViaje = (lineas: LineaViaje[]) => {
    let au = 0, ag = 0, seco = 0
    for (const ln of lineas) {
      const lote = lotes.find(l => l.codigo === ln.lote)
      if (!lote) continue
      const an = analisis.find(a => a.id_material_concentrado === lote.id)
      seco += ln.concentrado_seco
      if (an) { au += (an.au_gr_x_ton || 0) * ln.concentrado_seco; ag += (an.ag_gr_x_ton || 0) * ln.concentrado_seco }
    }
    return { au, ag, seco, auTenor: seco > 0 ? au / seco : 0, agTenor: seco > 0 ? ag / seco : 0 }
  }
  const auPromedio = viajes.length ? viajes.reduce((s, v) => s + auAgViaje(v.lineas).au, 0) / viajes.length : 0
  const agPromedio = viajes.length ? viajes.reduce((s, v) => s + auAgViaje(v.lineas).ag, 0) / viajes.length : 0

  // ── Wizard ─────────────────────────────────────────────
  const abrirWizard = () => {
    setFormDatos({ numero_viaje: '', fecha: todayISO() })
    const disponibles = lotes.filter(l => l.toneladas_disponibles > 0)
    setSelLineas(disponibles.map(l => ({
      loteId: l.id, codigo: l.codigo, concepto: '',
      concentrado_humedo: l.toneladas_disponibles.toFixed(2),
      concentrado_seco:   (l.toneladas_disponibles * (1 - l.porcentaje_humedad)).toFixed(4),
      costo_maquila:      l.maquila_total.toFixed(0),
      valor_total:        '0', checked: false,
    })))
    setWStep(1)
  }

  const updLinea = (idx: number, field: keyof SelLinea, val: string | boolean) => {
    setSelLineas(prev => {
      const next = [...prev]
      const row  = { ...next[idx], [field]: val }
      if (field === 'concentrado_humedo') {
        const lote = lotes.find(l => l.id === row.loteId)
        const hum  = lote ? lote.porcentaje_humedad : 0.13
        row.concentrado_seco = (Number(val) * (1 - hum)).toFixed(4)
      }
      next[idx] = row
      return next
    })
  }

  const seleccionadas = selLineas.filter(s => s.checked)

  const guardarViaje = () => {
    if (!formDatos.numero_viaje || seleccionadas.length === 0) return
    const lineas: LineaViaje[] = seleccionadas.map((s, i) => ({
      id: Date.now() + i, concepto: s.concepto || s.codigo, lote: s.codigo,
      concentrado_humedo: Number(s.concentrado_humedo), concentrado_seco: Number(s.concentrado_seco),
      costo_maquila: Number(s.costo_maquila), valor_total: Number(s.valor_total),
    }))
    const nuevo: ViajeRow = {
      id: Date.now(), numero_viaje: formDatos.numero_viaje, fecha: formDatos.fecha,
      maquila: lineas.reduce((s, l) => s + l.costo_maquila, 0),
      total_costo_material: lineas.reduce((s, l) => s + l.valor_total, 0), lineas,
    }
    setLotes(prev => prev.map(l => {
      const sel = seleccionadas.find(s => s.loteId === l.id)
      if (!sel) return l
      const restante = Math.max(0, l.toneladas_disponibles - Number(sel.concentrado_humedo))
      const estado: LoteConcentrado['estado'] = restante === 0 ? 'enviado_completo' : 'parcialmente_enviado'
      return { ...l, toneladas_disponibles: restante, estado }
    }))
    setViajes(prev => [nuevo, ...prev])
    setWStep(0)
  }

  const guardarEdit = () => {
    if (!editViaje) return
    // Reconcilia por lote: devuelve lo que ya no se usa y descuenta lo nuevo (soporta
    // agregar/quitar lotes). Un lote que sale del viaje vuelve a "en canoa".
    setLotes(prev => prev.map(l => {
      const oldTaken = editViaje.lineas.filter(ln => ln.lote === l.codigo).reduce((s, ln) => s + ln.concentrado_humedo, 0)
      const newTaken = formEditLineas.filter(fl => fl.lote === l.codigo).reduce((s, fl) => s + (Number(fl.humedo_s) || 0), 0)
      if (oldTaken === 0 && newTaken === 0) return l
      const newDisp = Math.max(0, l.toneladas_disponibles + oldTaken - newTaken)
      const newEstado: LoteConcentrado['estado'] =
        newTaken === 0 ? 'en_canoa' : newDisp <= 0 ? 'enviado_completo' : 'parcialmente_enviado'
      return { ...l, toneladas_disponibles: newDisp, estado: newEstado }
    }))
    const newLineas: LineaViaje[] = formEditLineas.map(fl => {
      const lote = lotes.find(l => l.codigo === fl.lote)
      const hum = lote?.porcentaje_humedad ?? 0.13
      const humQty = Number(fl.humedo_s) || 0
      const seco = humQty * (1 - hum)
      return {
        id: fl.id, concepto: fl.concepto || fl.lote, lote: fl.lote,
        concentrado_humedo: humQty,
        concentrado_seco: seco,
        costo_maquila: Math.round(seco * (lote?.precio_maquila_por_ton ?? 300000)), // maquila automática
        valor_total: Number(fl.valor_s) || 0,
      }
    })
    setViajes(prev => prev.map(v => v.id === editViaje.id ? {
      ...v, fecha: formEdit.fecha, lineas: newLineas,
      maquila: newLineas.reduce((s, l) => s + l.costo_maquila, 0),
      total_costo_material: newLineas.reduce((s, l) => s + l.valor_total, 0),
    } : v))
    setEditViaje(null); setAddOpen(false)
  }

  const confirmarDel = () => {
    if (!delViaje) return
    setLotes(prev => prev.map(l => {
      const linea = delViaje.lineas.find(ln => ln.lote === l.codigo)
      if (!linea) return l
      const nueva = l.toneladas_disponibles + linea.concentrado_humedo
      return { ...l, toneladas_disponibles: nueva, estado: 'en_canoa' as const }
    }))
    setViajes(prev => prev.filter(v => v.id !== delViaje.id))
    setDelViaje(null)
  }

  // ── Viajes filtrados ──────────────────────────────────
  const viajesFiltrados = viajes.filter(v => {
    if (fNumViaje && !v.numero_viaje.toUpperCase().includes(fNumViaje.toUpperCase())) return false
    if (fFechaDesde && v.fecha < fFechaDesde) return false
    if (fFechaHasta && v.fecha > fFechaHasta) return false
    if (fLote) {
      const q = fLote.toUpperCase()
      if (!v.lineas.some(l => l.lote.toUpperCase().includes(q) || l.concepto.toUpperCase().includes(q))) return false
    }
    return true
  })

  // ── Tab: Trazabilidad ──────────────────────────────────
  function TrazabilidadTab() {
    return (
      <div className="stack">
        {/* Usa los mismos filtros de fecha/lote del tab viajes */}
        {viajesFiltrados.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>No hay viajes que coincidan con los filtros.</p>
        )}
        {viajesFiltrados.map(v => {
          const totHum = v.lineas.reduce((s, l) => s + l.concentrado_humedo, 0)
          return (
            <Card key={v.id}
              title={`Viaje ${v.numero_viaje} — ${formatDate(v.fecha)} · ${totHum.toFixed(2)} t húm.`}>
              <div className="stack">
                {v.lineas.map(linea => {
                  const lote       = lotes.find(l => l.codigo === linea.lote)
                  const matVin     = materiales.filter(m => m.lote === linea.lote)
                  return (
                    <div key={linea.id} style={{ border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
                      {/* Header linea */}
                      <div style={{ background: 'var(--surface-sunken)', padding: '0.625rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', borderBottom: '1px solid var(--border-default)', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{linea.lote}</span>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{linea.concepto}</span>
                        <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{linea.concentrado_humedo.toFixed(2)} t húm.</span>
                        {linea.costo_maquila > 0 && (
                          <span className="mono" style={{ color: 'var(--green-700)' }}>Maquila: {cop(linea.costo_maquila)}</span>
                        )}
                        {lote && (
                          <span className={`badge badge--${lote.estado === 'enviado_completo' ? 'success' : 'warning'}`}>
                            {lote.estado === 'enviado_completo' ? 'Enviado completo' : 'Parcial'}
                          </span>
                        )}
                      </div>
                      {/* Materiales del lote */}
                      {matVin.length > 0 ? (
                        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                          <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                            <thead>
                              <tr>
                                <th>N.° Vol.</th><th>Mina</th><th>Fecha</th>
                                <th style={{ textAlign: 'right' }}>T. Húm.</th>
                                <th style={{ textAlign: 'right' }}>T. Seco</th>
                                <th style={{ textAlign: 'right' }}>Tenor Au</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matVin.map(m => (
                                <tr key={m.id}>
                                  <td className="mono">{m.numero_volqueta}</td>
                                  <td style={{ fontWeight: 600 }}>{m.mina}</td>
                                  <td>{formatDate(m.fecha)}</td>
                                  <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{m.total_material_seco.toFixed(4)} t</td>
                                  <td style={{ textAlign: 'right' }} className="mono">
                                    {m.tenor > 0 ? `${m.tenor.toFixed(1)} gr/t` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={3}>Total ({matVin.length})</td>
                                <td style={{ textAlign: 'right' }} className="mono">{matVin.reduce((s, m) => s + m.peso_llegada_planta, 0).toFixed(3)} t</td>
                                <td style={{ textAlign: 'right' }} className="mono">{matVin.reduce((s, m) => s + m.total_material_seco, 0).toFixed(4)} t</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                          No hay materiales de entrada vinculados a este lote.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
        {viajes.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>No hay viajes registrados.</p>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader title="Viajes material" subtitle="Registro de despachos de concentrado a compradores." />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Viajes este mes"      value={estesMes}                   accent="green"   />
        <KpiTile label="T. despachadas total" value={`${totalTon.toFixed(2)} t`} accent="emerald" />
        <KpiTile label="Total maquila"        value={cop(totalMaquila)}           accent="brown"   />
        <KpiTile label="Total material"       value={cop(totalMaterial)}          accent="amber"   />
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

      {pageTab === 'trazabilidad' && <TrazabilidadTab />}

      {pageTab === 'viajes' && (
        <Card title={`Viajes de concentrado (${viajesFiltrados.length} / ${viajes.length})`}
          actions={canWrite && (
            <Button size="sm" icon={<Plus size={15}/>} onClick={abrirWizard}>Nuevo viaje</Button>
          )}>
          {/* Filtros */}
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
                  <th style={{ textAlign: 'right' }}>T. Húm.</th>
                  <th style={{ textAlign: 'right' }}>Maquila</th>
                  <th style={{ textAlign: 'right' }}>Valor material</th>
                  <th style={{ textAlign: 'right' }}>Au (g)</th>
                  <th style={{ textAlign: 'right' }}>Ag (g)</th>
                  <th>Lotes</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {viajesFiltrados.length === 0 && (
                  <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
                )}
                {viajesFiltrados.map(v => {
                  const isExp  = expanded.has(v.id)
                  const totHum = v.lineas.reduce((s, l) => s + l.concentrado_humedo, 0)
                  const aa = auAgViaje(v.lineas)
                  return (
                    <React.Fragment key={v.id}>
                      <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                        onClick={() => toggleExpand(v.id)}>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </td>
                        <td style={{ fontWeight: 700 }} className="mono">{v.numero_viaje}</td>
                        <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(v.fecha)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{totHum.toFixed(2)} t</td>
                        <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{cop(v.maquila)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {v.total_costo_material > 0 ? cop(v.total_costo_material) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{aa.au > 0 ? aa.au.toFixed(1) : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{aa.ag > 0 ? aa.ag.toFixed(0) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {v.lineas.map(l => <span key={l.id} className="badge badge--neutral" style={{ fontSize: '0.6rem' }}>{l.lote}</span>)}
                          </div>
                        </td>
                        {canWrite && (
                          <td onClick={e => e.stopPropagation()}>
                            <div className="row" style={{ gap: 4 }}>
                              <Button variant="secondary" size="sm" icon={<Pencil size={13}/>}
                                onClick={() => abrirEdit(v)} />
                              <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>}
                                onClick={() => setDelViaje(v)} />
                            </div>
                          </td>
                        )}
                      </tr>

                      {isExp && (
                        <tr style={{ background: 'var(--slate-50)' }}>
                          <td colSpan={canWrite ? 10 : 9} style={{ padding: '0.75rem 1rem 1rem 2rem' }}>
                            <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                              Líneas del viaje ({v.lineas.length}):
                            </p>
                            <div className="table-wrap">
                              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                                <thead>
                                  <tr>
                                    <th>Lote</th><th>Concepto</th>
                                    <th style={{ textAlign: 'right' }}>T. Húm.</th>
                                    <th style={{ textAlign: 'right' }}>T. Seco</th>
                                    <th style={{ textAlign: 'right' }}>Maquila</th>
                                    <th style={{ textAlign: 'right' }}>Valor mat.</th>
                                    <th style={{ textAlign: 'right' }}>Au (g)</th>
                                    <th style={{ textAlign: 'right' }}>Ag (g)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.lineas.map(l => {
                                    const lote = lotes.find(x => x.codigo === l.lote)
                                    const an = lote ? analisis.find(a => a.id_material_concentrado === lote.id) : undefined
                                    const auL = an ? (an.au_gr_x_ton || 0) * l.concentrado_seco : 0
                                    const agL = an ? (an.ag_gr_x_ton || 0) * l.concentrado_seco : 0
                                    return (
                                    <tr key={l.id}>
                                      <td style={{ fontWeight: 700 }} className="mono">{l.lote}</td>
                                      <td>{l.concepto}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{l.concentrado_humedo.toFixed(2)} t</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{l.concentrado_seco.toFixed(4)} t</td>
                                      <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">
                                        {l.costo_maquila > 0 ? cop(l.costo_maquila) : '—'}
                                      </td>
                                      <td style={{ textAlign: 'right' }} className="mono">
                                        {l.valor_total > 0 ? cop(l.valor_total) : '—'}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{auL > 0 ? auL.toFixed(1) : '—'}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{agL > 0 ? agL.toFixed(0) : '—'}</td>
                                    </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={2}>Total</td>
                                    <td style={{ textAlign: 'right' }} className="mono">
                                      {v.lineas.reduce((s, l) => s + l.concentrado_humedo, 0).toFixed(2)} t
                                    </td>
                                    <td style={{ textAlign: 'right' }} className="mono">
                                      {v.lineas.reduce((s, l) => s + l.concentrado_seco, 0).toFixed(4)} t
                                    </td>
                                    <td style={{ textAlign: 'right' }} className="mono">{cop(v.maquila)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">
                                      {v.total_costo_material > 0 ? cop(v.total_costo_material) : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{auAgViaje(v.lineas).au.toFixed(1)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{auAgViaje(v.lineas).ag.toFixed(0)}</td>
                                  </tr>
                                </tfoot>
                              </table>
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
            <Button onClick={guardarViaje} disabled={seleccionadas.length === 0}>
              Guardar viaje ({seleccionadas.length} lote{seleccionadas.length !== 1 ? 's' : ''})
            </Button>
          </>
        )}>
        {wStep === 1 && (
          <div className="grid grid--form">
            <Input label="N.° de viaje" required placeholder="13-4"
              value={formDatos.numero_viaje} onChange={e => setFormDatos(f => ({...f, numero_viaje: e.target.value}))} />
            <Input label="Fecha" type="date"
              value={formDatos.fecha} onChange={e => setFormDatos(f => ({...f, fecha: e.target.value}))} />
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
                      <th style={{ textAlign: 'right' }}>Disp. (t)</th>
                      <th style={{ textAlign: 'right' }}>A despachar (t)</th>
                      <th style={{ textAlign: 'right' }}>Maquila ($)</th>
                      <th style={{ textAlign: 'right' }}>Valor mat. ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selLineas.map((s, i) => {
                      const lote = lotes.find(l => l.id === s.loteId)
                      const inp = (val: string, field: keyof SelLinea, w = '5rem') => (
                        <input type="number" step="0.01" disabled={!s.checked}
                          style={{ fontSize: 'var(--fs-sm)', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', width: w, background: s.checked ? undefined : 'var(--slate-50)' }}
                          value={val} onChange={e => updLinea(i, field, e.target.value)} />
                      )
                      return (
                        <tr key={s.loteId} style={{ background: s.checked ? 'var(--green-50)' : undefined }}>
                          <td><input type="checkbox" checked={s.checked} onChange={e => updLinea(i, 'checked', e.target.checked)} /></td>
                          <td style={{ fontWeight: 700 }} className="mono">{s.codigo}</td>
                          <td>
                            <input type="text" placeholder="Descripción / mineros" disabled={!s.checked}
                              style={{ fontSize: 'var(--fs-sm)', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 4, width: '100%', minWidth: '10rem', background: s.checked ? undefined : 'var(--slate-50)' }}
                              value={s.concepto} onChange={e => updLinea(i, 'concepto', e.target.value)} />
                          </td>
                          <td style={{ textAlign: 'right' }} className="mono">{lote?.toneladas_disponibles.toFixed(2)}</td>
                          <td>{inp(s.concentrado_humedo, 'concentrado_humedo', '5rem')}</td>
                          <td>{inp(s.costo_maquila, 'costo_maquila', '7rem')}</td>
                          <td>{inp(s.valor_total, 'valor_total', '7rem')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {seleccionadas.length > 0 && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                <strong>{seleccionadas.length} lote{seleccionadas.length !== 1 ? 's' : ''}</strong>
                {' · '}T. húm.: <strong>{seleccionadas.reduce((s, l) => s + Number(l.concentrado_humedo), 0).toFixed(2)} t</strong>
                {' · '}Maquila: <strong>{cop(seleccionadas.reduce((s, l) => s + Number(l.costo_maquila), 0))}</strong>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Editar viaje ── */}
      <Modal open={!!editViaje} title={`Editar viaje — ${editViaje?.numero_viaje ?? ''}`}
        onClose={() => setEditViaje(null)}
        footer={<><Button variant="secondary" onClick={() => setEditViaje(null)}>Cancelar</Button><Button onClick={guardarEdit}>Guardar cambios</Button></>}>
        {editViaje && (() => {
          const disponiblesAgregar = lotes.filter(l => l.toneladas_disponibles > 0 && !formEditLineas.some(fl => fl.lote === l.codigo))
          return (
          <>
            <div className="grid grid--form" style={{ marginBottom: '1rem' }}>
              <Input label="Fecha" type="date" value={formEdit.fecha} onChange={e => setFormEdit(f => ({...f, fecha: e.target.value}))} />
            </div>

            <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>Lotes del viaje</p>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th style={{ textAlign: 'right' }}>T. Húm. tomada</th>
                    <th style={{ textAlign: 'right' }}>Valor mat. ($)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formEditLineas.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Sin lotes. Agrega uno abajo.</td></tr>
                  )}
                  {formEditLineas.map((fl, i) => {
                    const lote = lotes.find(l => l.codigo === fl.lote)
                    const origHum = editViaje.lineas.find(ln => ln.id === fl.id)?.concentrado_humedo ?? 0
                    const dispTotal = (lote?.toneladas_disponibles ?? 0) + origHum
                    return (
                      <tr key={fl.id}>
                        <td style={{ fontWeight: 700 }} className="mono">{fl.lote}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <input type="number" step="0.01" max={dispTotal}
                              style={{ fontSize: 'var(--fs-sm)', padding: '0.25rem 0.5rem', border: '1px solid var(--border-default)', borderRadius: 6, textAlign: 'right', width: '6.5rem' }}
                              value={fl.humedo_s} onChange={e => updEditLinea(i, 'humedo_s', e.target.value)} />
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Disp {dispTotal.toFixed(2)} t</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input type="number" step="1000"
                            style={{ fontSize: 'var(--fs-sm)', padding: '0.25rem 0.5rem', border: '1px solid var(--border-default)', borderRadius: 6, textAlign: 'right', width: '8rem' }}
                            value={fl.valor_s} onChange={e => updEditLinea(i, 'valor_s', e.target.value)} />
                        </td>
                        <td style={{ textAlign: 'center' }}><Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Quitar lote del viaje" onClick={() => removeEditLinea(i)} /></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formEditLineas.reduce((s, fl) => s + (Number(fl.humedo_s) || 0), 0).toFixed(2)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(formEditLineas.reduce((s, fl) => s + (Number(fl.valor_s) || 0), 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Agregar lotes — abre modal de selección (como al crear) */}
            <div style={{ marginTop: '1rem' }}>
              <Button size="sm" variant="secondary" icon={<Plus size={14}/>} disabled={disponiblesAgregar.length === 0} onClick={abrirAgregarLotes}>
                Agregar lotes{disponiblesAgregar.length > 0 ? ` (${disponiblesAgregar.length} disponibles)` : ''}
              </Button>
              {disponiblesAgregar.length === 0 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>No hay más lotes con concentrado disponible.</span>}
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Solo eliges qué lotes van y cuánto tomas de cada uno (parcial permitido). La maquila se calcula sola; la info del lote se edita en <strong>Procesamiento</strong>.
            </p>
          </>
          )
        })()}
      </Modal>

      {/* ── Modal: Agregar lotes (selección, como al crear) ── */}
      <Modal open={addOpen} title="Agregar lotes al viaje" onClose={() => setAddOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button onClick={confirmarAgregarLotes} disabled={!addSel.some(s => s.checked)}>
            Agregar ({addSel.filter(s => s.checked).length})
          </Button>
        </>}>
        {addSel.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No hay lotes con concentrado disponible.</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '22rem' }}>
            <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}></th>
                  <th>Lote</th>
                  <th style={{ textAlign: 'right' }}>Disponible</th>
                  <th style={{ textAlign: 'right' }}>Au (g/t)</th>
                  <th style={{ textAlign: 'right' }}>A despachar (t)</th>
                </tr>
              </thead>
              <tbody>
                {addSel.map(s => (
                  <tr key={s.id} style={{ background: s.checked ? 'var(--green-50)' : undefined, cursor: 'pointer' }}
                    onClick={() => updAddSel(s.id, { checked: !s.checked })}>
                    <td><input type="checkbox" checked={s.checked} onChange={e => updAddSel(s.id, { checked: e.target.checked })} onClick={e => e.stopPropagation()} /></td>
                    <td style={{ fontWeight: 700 }} className="mono">{s.codigo}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{s.disp.toFixed(2)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">{s.auT > 0 ? s.auT.toFixed(1) : '—'}</td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <input type="number" step="0.01" max={s.disp} disabled={!s.checked}
                        style={{ fontSize: 'var(--fs-sm)', padding: '0.25rem 0.5rem', border: '1px solid var(--border-default)', borderRadius: 6, textAlign: 'right', width: '6.5rem', background: s.checked ? undefined : 'var(--slate-50)' }}
                        value={s.humedo_s} onChange={e => updAddSel(s.id, { humedo_s: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ── Confirm: Eliminar viaje ── */}
      <Modal open={!!delViaje} title="Eliminar viaje" onClose={() => setDelViaje(null)}
        footer={<><Button variant="secondary" onClick={() => setDelViaje(null)}>Cancelar</Button><Button variant="danger" onClick={confirmarDel}>Eliminar</Button></>}>
        {delViaje && (
          <>
            <p style={{ marginBottom: '0.75rem' }}>
              ¿Eliminar el viaje <strong>{delViaje.numero_viaje}</strong> del {formatDate(delViaje.fecha)}?
            </p>
            <div className="callout">
              <p style={{ fontSize: 'var(--fs-sm)' }}>Las toneladas de los lotes serán restauradas:</p>
              <ul style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)', paddingLeft: '1.25rem' }}>
                {delViaje.lineas.map(l => (
                  <li key={l.id}><strong>{l.lote}</strong> → +{l.concentrado_humedo.toFixed(2)} t húm.</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
