import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FlaskConical, Layers, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { type LoteConcentrado, type MaterialRow, type AnalisisRow } from '@/data/mock'
import { useMateriales } from '@/context/MaterialesContext'

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

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

type Tab = 'lotes' | 'procesamiento'

// ── Tab A: Lotes de concentrado ────────────────────────────────────
function LotesTab() {
  const canWrite = useCanWrite('materiales')
  const { lotes, setLotes, materiales, setMateriales, analisis, setAnalisis } = useMateriales()

  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Filters
  const [fBusqueda,   setFBusqueda]   = useState('')
  const [fEstado,     setFEstado]     = useState('todos')
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')

  // Modals
  const [crearOpen,    setCrearOpen]    = useState(false)
  const [vincularLote, setVincularLote] = useState<LoteConcentrado | null>(null)
  const [cerrarLote,   setCerrarLote]   = useState<LoteConcentrado | null>(null)
  const [editarLote,   setEditarLote]   = useState<LoteConcentrado | null>(null)
  const [analisisLote, setAnalisisLote] = useState<LoteConcentrado | null>(null)

  // Forms
  const [formCrear, setFormCrear] = useState({
    codigo: '', fecha_inicio: todayISO(),
    hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false,
  })
  const [selVincular, setSelVincular] = useState<Set<number>>(new Set())
  const [tonVincular, setTonVincular] = useState('')
  const [formCerrar,  setFormCerrar]  = useState({ ton_humedo: '', porcentaje_humedad: '13', fecha_fin: todayISO(), ubicacion_canoa: '' })
  const [formEditar,  setFormEditar]  = useState({ codigo: '', fecha_inicio: '', ubicacion_canoa: '', comentarios: '' })
  const [formAnalisis, setFormAnalisis] = useState({ numero_analisis: '', au_concentrado: '', ag_concentrado: '' })

  const disponibles = materiales.filter(m => (m.estado === 'pagada' || m.estado === 'pendiente') && m.lote === null)

  // Filtered lotes
  const lotesFiltrados = lotes.filter(l => {
    if (fBusqueda && !l.codigo.toUpperCase().includes(fBusqueda.toUpperCase())) return false
    if (fEstado !== 'todos' && l.estado !== fEstado) return false
    if (fFechaDesde && l.fecha_inicio < fFechaDesde) return false
    if (fFechaHasta && l.fecha_inicio > fFechaHasta) return false
    return true
  })

  const totalSelSec = [...selVincular].reduce((s, id) => {
    const m = materiales.find(x => x.id === id)
    return m ? s + m.total_material_seco : s
  }, 0)
  const totalSelHum = [...selVincular].reduce((s, id) => {
    const m = materiales.find(x => x.id === id)
    return m ? s + m.peso_llegada_planta : s
  }, 0)

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleSel = (id: number) =>
    setSelVincular(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const guardarCrear = () => {
    if (!formCrear.codigo.trim()) return
    const nuevo: LoteConcentrado = {
      id: Date.now(), codigo: formCrear.codigo.trim(),
      fecha_inicio: formCrear.fecha_inicio, fecha_fin: null,
      hizo_molienda: formCrear.hizo_molienda, hizo_flotacion: formCrear.hizo_flotacion,
      hizo_relave: formCrear.hizo_relave, hizo_filtroprensa: formCrear.hizo_filtroprensa,
      toneladas_humedo: 0, porcentaje_humedad: 0, toneladas_seco: 0, toneladas_disponibles: 0,
      ubicacion_canoa: null, precio_maquila_por_ton: 300000, maquila_total: 0,
      material_seco_procesado: 0, estado: 'en_proceso', comentarios: null,
    }
    setLotes(prev => [nuevo, ...prev])
    setCrearOpen(false)
    setFormCrear({ codigo: '', fecha_inicio: todayISO(), hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false })
  }

  const abrirVincular = (l: LoteConcentrado) => {
    setVincularLote(l)
    setSelVincular(new Set())
    setTonVincular('')
  }

  const guardarVincular = () => {
    if (!vincularLote || selVincular.size === 0) return
    const tonFinal = tonVincular ? Math.min(Number(tonVincular), totalSelSec) : totalSelSec
    setMateriales(prev => prev.map(m =>
      selVincular.has(m.id) ? { ...m, estado: 'en_proceso' as const, lote: vincularLote.codigo } : m
    ))
    setLotes(prev => prev.map(l =>
      l.id === vincularLote.id
        ? { ...l, material_seco_procesado: (l.material_seco_procesado ?? 0) + tonFinal }
        : l
    ))
    setVincularLote(null)
  }

  const abrirCerrar = (l: LoteConcentrado) => {
    setCerrarLote(l)
    setFormCerrar({ ton_humedo: '', porcentaje_humedad: '13', fecha_fin: todayISO(), ubicacion_canoa: '' })
  }

  const guardarCerrar = () => {
    if (!cerrarLote || !formCerrar.ton_humedo) return
    const tonHum = Number(formCerrar.ton_humedo)
    const hum    = Number(formCerrar.porcentaje_humedad) / 100
    const tonSec = tonHum * (1 - hum)
    const matSec = cerrarLote.material_seco_procesado ?? 0
    const maquila = matSec * (cerrarLote.precio_maquila_por_ton ?? 300000)
    setLotes(prev => prev.map(l =>
      l.id === cerrarLote.id ? {
        ...l, toneladas_humedo: tonHum, porcentaje_humedad: hum, toneladas_seco: tonSec,
        toneladas_disponibles: tonHum, fecha_fin: formCerrar.fecha_fin,
        ubicacion_canoa: formCerrar.ubicacion_canoa || null,
        maquila_total: maquila, estado: 'en_canoa' as const,
      } : l
    ))
    setCerrarLote(null)
  }

  const abrirEditar = (l: LoteConcentrado) => {
    setEditarLote(l)
    setFormEditar({ codigo: l.codigo, fecha_inicio: l.fecha_inicio, ubicacion_canoa: l.ubicacion_canoa ?? '', comentarios: l.comentarios ?? '' })
  }

  const guardarEditar = () => {
    if (!editarLote) return
    setLotes(prev => prev.map(l =>
      l.id === editarLote.id ? {
        ...l, codigo: formEditar.codigo || l.codigo,
        fecha_inicio: formEditar.fecha_inicio,
        ubicacion_canoa: formEditar.ubicacion_canoa || null,
        comentarios: formEditar.comentarios || null,
      } : l
    ))
    setEditarLote(null)
  }

  const abrirAnalisis = (l: LoteConcentrado) => {
    const existing = analisis.find(a => a.id_material_concentrado === l.id)
    setAnalisisLote(l)
    setFormAnalisis({
      numero_analisis: existing?.numero_analisis ?? '',
      au_concentrado:  existing?.au_concentrado != null ? String(existing.au_concentrado) : '',
      ag_concentrado:  existing?.ag_concentrado != null ? String(existing.ag_concentrado) : '',
    })
  }

  const guardarAnalisis = () => {
    if (!analisisLote || !formAnalisis.au_concentrado) return

    const tonSec = analisisLote.estado === 'en_proceso'
      ? (analisisLote.material_seco_procesado ?? 0)
      : analisisLote.toneladas_seco

    const auTotal = Number(formAnalisis.au_concentrado)
    const agTotal = formAnalisis.ag_concentrado ? Number(formAnalisis.ag_concentrado) : null
    const auGrT   = tonSec > 0 ? auTotal / tonSec : 0
    const agGrT   = (agTotal != null && tonSec > 0) ? agTotal / tonSec : null

    const existing = analisis.find(a => a.id_material_concentrado === analisisLote.id)

    if (existing) {
      setAnalisis(prev => prev.map(a =>
        a.id === existing.id ? {
          ...a,
          numero_analisis:  formAnalisis.numero_analisis || a.numero_analisis,
          au_concentrado:   auTotal,
          ag_concentrado:   agTotal,
          au_gr_x_ton:      auGrT,
          ag_gr_x_ton:      agGrT,
          toneladas_secas:  tonSec,
          toneladas_humedas: analisisLote.toneladas_humedo || null,
          porcentaje_humedad: analisisLote.porcentaje_humedad,
        } : a
      ))
    } else {
      const nueva: AnalisisRow = {
        id: Date.now(),
        id_entrada: null,
        id_material_concentrado: analisisLote.id,
        numero_analisis: formAnalisis.numero_analisis || `AN-CONC-${String(Date.now()).slice(-4)}`,
        ton: analisisLote.toneladas_humedo || null,
        porcentaje_humedad: analisisLote.porcentaje_humedad,
        toneladas_humedas: analisisLote.toneladas_humedo || null,
        toneladas_secas: tonSec,
        au_gr_x_ton: auGrT,
        au_falso: 0,
        ag_gr_x_ton: agGrT,
        au_concentrado: auTotal,
        ag_concentrado: agTotal,
        fecha_salida: null,
        comentarios: null,
        estado_pago: 'no_aplica',
      }
      setAnalisis(prev => [...prev, nueva])
    }

    setAnalisisLote(null)
    setFormAnalisis({ numero_analisis: '', au_concentrado: '', ag_concentrado: '' })
  }

  const desvincularMaterial = (m: MaterialRow, lote: LoteConcentrado) => {
    if (lote.estado !== 'en_proceso') {
      alert(`No se puede desvincular: el lote ${lote.codigo} ya fue cerrado (${ESTADO_LOTE[lote.estado]?.label}).`)
      return
    }
    if (!confirm(`¿Desvincular Vol. ${m.numero_volqueta} (${m.mina}) del lote ${lote.codigo}?`)) return
    setMateriales(prev => prev.map(x =>
      x.id === m.id ? { ...x, estado: 'pagada' as const, lote: null } : x
    ))
    setLotes(prev => prev.map(l =>
      l.id === lote.id
        ? { ...l, material_seco_procesado: Math.max(0, (l.material_seco_procesado ?? 0) - m.total_material_seco) }
        : l
    ))
  }

  const eliminarLote = (l: LoteConcentrado) => {
    const matVin = materiales.filter(m => m.lote === l.codigo)
    if (matVin.length > 0) {
      alert(`No se puede eliminar: el lote tiene ${matVin.length} material(es) vinculado(s). Desvincula primero.`)
      return
    }
    if (!confirm(`¿Eliminar lote ${l.codigo}? Esta acción no se puede deshacer.`)) return
    setLotes(prev => prev.filter(x => x.id !== l.id))
  }

  const kpiEnProceso = lotes.filter(l => l.estado === 'en_proceso').length
  const kpiEnCanoa   = lotes.filter(l => l.estado === 'en_canoa').length
  const kpiEnviados  = lotes.filter(l => l.estado === 'enviado_completo').length
  const totalDisp    = lotes.reduce((s, l) => s + l.toneladas_disponibles, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="En proceso"       value={kpiEnProceso}                  accent="amber"   />
        <KpiTile label="En canoa"         value={kpiEnCanoa}                    accent="green"   />
        <KpiTile label="Enviados"         value={kpiEnviados}                   accent="emerald" />
        <KpiTile label="Total disponible" value={`${totalDisp.toFixed(2)} t`}   accent="brown"   />
      </div>

      <Card title={`Lotes de concentrado (${lotesFiltrados.length} / ${lotes.length})`}
        actions={canWrite && (
          <Button size="sm" icon={<Plus size={15}/>} onClick={() => setCrearOpen(true)}>Nuevo lote</Button>
        )}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por código…"
            value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} style={{ maxWidth: '14rem' }} />
          <input className="field__input" type="date" placeholder="Desde"
            value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" placeholder="Hasta"
            value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
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
                <th style={{ width: '1.5rem' }}></th>
                <th>Código</th>
                <th>Estado</th>
                <th>Fechas</th>
                <th>Proceso</th>
                <th style={{ textAlign: 'right' }}>Mat. procesado</th>
                <th style={{ textAlign: 'right' }}>Concentrado</th>
                <th style={{ textAlign: 'right' }}>Tenor real</th>
                <th style={{ textAlign: 'right' }}>Costo maquila</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.length === 0 && (
                <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              )}
              {lotesFiltrados.map(l => {
                const isExp  = expanded.has(l.id)
                const matVin = materiales.filter(m => m.lote === l.codigo)
                const analExist = analisis.find(a => a.id_material_concentrado === l.id)
                return (
                  <React.Fragment key={l.id}>
                    <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                      onClick={() => toggleExpand(l.id)}>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </td>
                      <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                      <td>
                        <span className={`badge ${ESTADO_LOTE[l.estado]?.badge ?? 'badge--neutral'}`}>
                          {ESTADO_LOTE[l.estado]?.label ?? l.estado}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }} className="mono">
                        {fmtDMY(l.fecha_inicio)} <span style={{ color: 'var(--text-faint)' }}>→</span> {l.fecha_fin ? fmtDMY(l.fecha_fin) : '—'}
                      </td>
                      <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {[l.hizo_molienda && 'Mol', l.hizo_flotacion && 'Flot', l.hizo_filtroprensa && 'Fil'].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {(l.material_seco_procesado ?? 0) > 0 ? `${(l.material_seco_procesado ?? 0).toFixed(3)} t` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: l.toneladas_humedo > 0 ? 700 : undefined, color: l.toneladas_humedo > 0 ? 'var(--emerald-700)' : undefined }} className="mono">
                        {l.toneladas_humedo > 0 ? `${l.toneladas_humedo.toFixed(2)} t` : '—'}
                        {l.toneladas_disponibles > 0 && l.toneladas_disponibles !== l.toneladas_humedo && (
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400 }}>disp {l.toneladas_disponibles.toFixed(2)}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: analExist ? 'var(--amber-700)' : undefined }} className="mono">
                        {analExist ? `${analExist.au_gr_x_ton.toFixed(2)} g/t` : <em style={{ color: 'var(--text-faint)', fontWeight: 400 }}>—</em>}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {l.maquila_total > 0
                          ? cop(l.maquila_total)
                          : (l.material_seco_procesado ?? 0) > 0
                            ? <span style={{ color: 'var(--text-muted)' }}>{cop((l.material_seco_procesado ?? 0) * (l.precio_maquila_por_ton ?? 300000))}</span>
                            : '—'}
                      </td>
                      {canWrite && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={13}/>} onClick={() => abrirEditar(l)} />
                            <Button variant="secondary" size="sm" icon={<FlaskConical size={13}/>}
                              title={analExist ? 'Actualizar análisis concentrado' : 'Agregar análisis concentrado'}
                              onClick={() => abrirAnalisis(l)} />
                            {l.estado === 'en_proceso' && (
                              <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} onClick={() => eliminarLote(l)} />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {isExp && (
                      <tr style={{ background: 'var(--slate-50)' }}>
                        <td colSpan={canWrite ? 10 : 9} style={{ padding: '0.75rem 1rem 1rem 2rem' }}>
                          <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                            Materiales procesados ({matVin.length}):
                          </p>
                          {matVin.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                              No hay materiales vinculados aún.
                            </p>
                          ) : (
                            <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
                              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                                <thead>
                                  <tr>
                                    <th>Vol.</th><th>Mina</th><th>Fecha</th>
                                    <th style={{ textAlign: 'right' }}>T. Húm.</th>
                                    <th style={{ textAlign: 'right' }}>T. Seco</th>
                                    <th style={{ textAlign: 'right' }}>Tenor</th>
                                    {canWrite && l.estado === 'en_proceso' && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {matVin.map(m => (
                                    <tr key={m.id}>
                                      <td className="mono">{m.numero_volqueta}</td>
                                      <td>{m.mina}</td>
                                      <td>{formatDate(m.fecha)}</td>
                                      <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{m.total_material_seco.toFixed(4)} t</td>
                                      <td style={{ textAlign: 'right' }} className="mono">
                                        {m.tenor > 0 ? `${m.tenor.toFixed(1)} gr/t` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}
                                      </td>
                                      {canWrite && l.estado === 'en_proceso' && (
                                        <td>
                                          <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>}
                                            title="Desvincular del lote"
                                            onClick={() => desvincularMaterial(m, l)} />
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ fontWeight: 700 }}>
                                    <td colSpan={3}>Total ({matVin.length})</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{matVin.reduce((s, m) => s + m.peso_llegada_planta, 0).toFixed(3)} t</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{matVin.reduce((s, m) => s + m.total_material_seco, 0).toFixed(4)} t</td>
                                    <td />
                                    {canWrite && l.estado === 'en_proceso' && <td />}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                          {(l.material_seco_procesado ?? 0) > 0 && (
                            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                              Mat. seco procesado: <strong>{(l.material_seco_procesado ?? 0).toFixed(3)} t</strong>
                              {' · '}Maquila estimada: <strong>{cop((l.material_seco_procesado ?? 0) * (l.precio_maquila_por_ton ?? 300000))}</strong>
                              {' ('}${cop(l.precio_maquila_por_ton ?? 300000)}/t{')'}
                            </p>
                          )}
                          {analExist && (
                            <div className="callout" style={{ marginBottom: '0.5rem', fontSize: 'var(--fs-sm)' }}>
                              <FlaskConical size={13} style={{ marginRight: '0.4rem', verticalAlign: 'middle', color: 'var(--green-700)' }} />
                              <strong>Análisis {analExist.numero_analisis}:</strong>
                              {' '}Au {analExist.au_gr_x_ton.toFixed(2)} gr/t
                              {analExist.ag_gr_x_ton != null && <> · Ag {analExist.ag_gr_x_ton.toFixed(1)} gr/t</>}
                              {' · '}Au total: <strong>{analExist.au_concentrado?.toFixed(1)} g</strong>
                              {analExist.ag_concentrado != null && <> · Ag total: <strong>{analExist.ag_concentrado.toFixed(1)} g</strong></>}
                            </div>
                          )}
                          {canWrite && (
                            <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                              {l.estado === 'en_proceso' && (
                                <Button size="sm" variant="secondary" icon={<Plus size={14}/>} onClick={() => abrirVincular(l)}>
                                  Vincular materiales
                                </Button>
                              )}
                              <Button size="sm" variant="secondary" icon={<FlaskConical size={14}/>} onClick={() => abrirAnalisis(l)}>
                                {analExist ? 'Actualizar análisis' : 'Agregar análisis'}
                              </Button>
                              {l.estado === 'en_proceso' && matVin.length > 0 && (
                                <Button size="sm" icon={<Zap size={14}/>} onClick={() => abrirCerrar(l)}>
                                  Cerrar lote
                                </Button>
                              )}
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
          <Button onClick={guardarCrear} disabled={!formCrear.codigo.trim()}>Crear</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Código del lote" placeholder="LC-2026-002" required
            value={formCrear.codigo} onChange={e => setFormCrear(f => ({...f, codigo: e.target.value}))} />
          <Input label="Fecha inicio" type="date"
            value={formCrear.fecha_inicio} onChange={e => setFormCrear(f => ({...f, fecha_inicio: e.target.value}))} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Procesos aplicados:</p>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            {([['hizo_molienda', 'Molienda'], ['hizo_flotacion', 'Flotación'], ['hizo_relave', 'Relave'], ['hizo_filtroprensa', 'Filtroprensa']] as [keyof typeof formCrear, string][]).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                <input type="checkbox" checked={formCrear[k] as boolean}
                  onChange={e => setFormCrear(f => ({...f, [k]: e.target.checked}))} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          El lote queda en estado <strong>En proceso</strong>.
        </p>
      </Modal>

      {/* ── Modal: Vincular materiales ── */}
      <Modal open={!!vincularLote} title={`Vincular materiales → ${vincularLote?.codigo ?? ''}`}
        onClose={() => setVincularLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setVincularLote(null)}>Cancelar</Button>
          <Button onClick={guardarVincular} disabled={selVincular.size === 0}>
            Vincular ({selVincular.size})
          </Button>
        </>}>
        {vincularLote && (
          <>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Materiales disponibles (estado pagada/pendiente sin lote asignado):
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
                    {disponibles.map(m => {
                      const sel = selVincular.has(m.id)
                      return (
                        <tr key={m.id} style={{ cursor: 'pointer', ...(sel ? { background: 'var(--green-50)' } : {}) }}
                          onClick={() => toggleSel(m.id)}>
                          <td><input type="checkbox" checked={sel} onChange={() => toggleSel(m.id)} onClick={e => e.stopPropagation()} /></td>
                          <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                          <td style={{ fontWeight: 600 }}>{m.mina}</td>
                          <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                          <td style={{ textAlign: 'right', fontWeight: sel ? 700 : undefined, color: sel ? 'var(--green-700)' : undefined }} className="mono">{m.total_material_seco.toFixed(4)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{m.tenor > 0 ? `${m.tenor.toFixed(1)}` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
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
          <Button onClick={guardarCerrar} disabled={!formCerrar.ton_humedo}>Cerrar lote</Button>
        </>}>
        {cerrarLote && (
          <>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              Materia procesada: <strong>{(cerrarLote.material_seco_procesado ?? 0).toFixed(3)} t seco</strong>
              {' · '}Maquila estimada: <strong>{cop((cerrarLote.material_seco_procesado ?? 0) * (cerrarLote.precio_maquila_por_ton ?? 300000))}</strong>
            </div>
            <div className="grid grid--form">
              <Input label="Toneladas húmedas producidas" type="number" step="0.001" required placeholder="0.000"
                value={formCerrar.ton_humedo} onChange={e => setFormCerrar(f => ({...f, ton_humedo: e.target.value}))} />
              <Input label="Humedad del concentrado (%)" type="number" step="0.1" placeholder="13"
                value={formCerrar.porcentaje_humedad} onChange={e => setFormCerrar(f => ({...f, porcentaje_humedad: e.target.value}))} />
              <Input label="Fecha fin proceso" type="date"
                value={formCerrar.fecha_fin} onChange={e => setFormCerrar(f => ({...f, fecha_fin: e.target.value}))} />
              <Input label="Ubicación canoa" placeholder="Canoa Principal"
                value={formCerrar.ubicacion_canoa} onChange={e => setFormCerrar(f => ({...f, ubicacion_canoa: e.target.value}))} />
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
        footer={<>
          <Button variant="secondary" onClick={() => setEditarLote(null)}>Cancelar</Button>
          <Button onClick={guardarEditar}>Guardar</Button>
        </>}>
        {editarLote && (() => {
          const matVin = materiales.filter(m => m.lote === editarLote.codigo)
          return (
            <>
              <div className="grid grid--form">
                <Input label="Código" value={formEditar.codigo} onChange={e => setFormEditar(f => ({...f, codigo: e.target.value}))} />
                <Input label="Fecha inicio" type="date" value={formEditar.fecha_inicio} onChange={e => setFormEditar(f => ({...f, fecha_inicio: e.target.value}))} />
                <Input label="Ubicación canoa" placeholder="Canoa Principal" value={formEditar.ubicacion_canoa} onChange={e => setFormEditar(f => ({...f, ubicacion_canoa: e.target.value}))} />
                <Input label="Comentarios" value={formEditar.comentarios} onChange={e => setFormEditar(f => ({...f, comentarios: e.target.value}))} style={{ gridColumn: '1/-1' }} />
              </div>

              {/* Materiales vinculados */}
              <div style={{ marginTop: '1.25rem' }}>
                <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                  Materiales vinculados ({matVin.length}):
                </p>
                {matVin.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Sin materiales vinculados.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                      <thead>
                        <tr>
                          <th>N.° Vol.</th><th>Mina</th><th>Fecha</th>
                          <th style={{ textAlign: 'right' }}>T. Seco</th>
                          {canWrite && editarLote.estado === 'en_proceso' && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {matVin.map(m => (
                          <tr key={m.id}>
                            <td className="mono">{m.numero_volqueta}</td>
                            <td style={{ fontWeight: 600 }}>{m.mina}</td>
                            <td>{formatDate(m.fecha)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{m.total_material_seco.toFixed(4)} t</td>
                            {canWrite && editarLote.estado === 'en_proceso' && (
                              <td>
                                <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>}
                                  title={`Quitar Vol. ${m.numero_volqueta} del lote`}
                                  onClick={() => {
                                    if (!confirm(`¿Quitar Vol. ${m.numero_volqueta} del lote ${editarLote.codigo}?`)) return
                                    setMateriales(prev => prev.map(x =>
                                      x.id === m.id ? { ...x, estado: 'pagada' as const, lote: null } : x
                                    ))
                                    setLotes(prev => prev.map(l =>
                                      l.id === editarLote.id
                                        ? { ...l, material_seco_procesado: Math.max(0, (l.material_seco_procesado ?? 0) - m.total_material_seco) }
                                        : l
                                    ))
                                  }} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700 }}>
                          <td colSpan={3}>Total</td>
                          <td style={{ textAlign: 'right' }} className="mono">{matVin.reduce((s, m) => s + m.total_material_seco, 0).toFixed(4)} t</td>
                          {canWrite && editarLote.estado === 'en_proceso' && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {canWrite && (
                  editarLote.estado === 'en_proceso' ? (
                    <Button size="sm" variant="secondary" icon={<Plus size={14}/>} style={{ marginTop: '0.75rem' }}
                      onClick={() => { setEditarLote(null); abrirVincular(editarLote) }}>
                      + Agregar más materiales
                    </Button>
                  ) : (
                    <div style={{ marginTop: '0.75rem' }}>
                      <Button size="sm" variant="secondary" icon={<Plus size={14}/>}
                        onClick={() => {
                          if (!confirm(`El lote ${editarLote.codigo} está cerrado (${ESTADO_LOTE[editarLote.estado]?.label}). ¿Reabrirlo para agregar materiales? Podrás volver a cerrarlo después.`)) return
                          const lote = { ...editarLote, estado: 'en_proceso' as const }
                          setLotes(prev => prev.map(l => l.id === editarLote.id ? lote : l))
                          setEditarLote(null)
                          abrirVincular(lote)
                        }}>
                        Reabrir lote y agregar materiales
                      </Button>
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        El lote está <strong>{ESTADO_LOTE[editarLote.estado]?.label}</strong>. Reabrirlo lo pone «En proceso» para poder vincular más materiales.
                      </p>
                    </div>
                  )
                )}
              </div>
            </>
          )
        })()}
      </Modal>

      {/* ── Modal: Análisis concentrado ── */}
      <Modal open={!!analisisLote} title={`${analisis.find(a => a.id_material_concentrado === analisisLote?.id) ? 'Actualizar' : 'Agregar'} análisis — ${analisisLote?.codigo ?? ''}`}
        onClose={() => setAnalisisLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAnalisisLote(null)}>Cancelar</Button>
          <Button onClick={guardarAnalisis} disabled={!formAnalisis.au_concentrado}>Guardar análisis</Button>
        </>}>
        {analisisLote && (() => {
          const tonSec = analisisLote.estado === 'en_proceso'
            ? (analisisLote.material_seco_procesado ?? 0)
            : analisisLote.toneladas_seco
          const auTotal = Number(formAnalisis.au_concentrado) || 0
          const agTotal = Number(formAnalisis.ag_concentrado) || 0
          const auGrT   = tonSec > 0 && auTotal > 0 ? (auTotal / tonSec).toFixed(2) : null
          const agGrT   = tonSec > 0 && agTotal > 0 ? (agTotal / tonSec).toFixed(1) : null
          return (
            <>
              <div className="callout" style={{ marginBottom: '1rem' }}>
                Lote <strong>{analisisLote.codigo}</strong>
                {' · '}T. secas base: <strong>{tonSec.toFixed(4)} t</strong>
                {analisisLote.estado === 'en_proceso' && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(material seco procesado acumulado)</span>
                )}
              </div>
              <div className="grid grid--form">
                <Input label="N.° análisis" placeholder="AN-CONC-001"
                  value={formAnalisis.numero_analisis} onChange={e => setFormAnalisis(f => ({...f, numero_analisis: e.target.value}))} />
                <div />
                <Input label="Au total (gramos)" type="number" step="0.1" required placeholder="Ej: 245.5 g"
                  value={formAnalisis.au_concentrado} onChange={e => setFormAnalisis(f => ({...f, au_concentrado: e.target.value}))}
                  helper={auGrT ? `→ ${auGrT} Au gr/t` : undefined} />
                <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
                  value={formAnalisis.ag_concentrado} onChange={e => setFormAnalisis(f => ({...f, ag_concentrado: e.target.value}))}
                  helper={agGrT ? `→ ${agGrT} Ag gr/t` : undefined} />
              </div>
              {auGrT && (
                <div className="callout" style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                  Au: <strong>{auGrT} gr/t</strong>
                  {agGrT && <> · Ag: <strong>{agGrT} gr/t</strong></>}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    = total g ÷ {tonSec.toFixed(4)} t seco
                  </span>
                </div>
              )}
            </>
          )
        })()}
      </Modal>
    </>
  )
}

// ── Tab B: Procesamiento material ──────────────────────────────────
function ProcesamientoTab() {
  const canWrite = useCanWrite('materiales')
  const { lotes, materiales, setMateriales, analisis } = useMateriales()

  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const procesados = materiales.filter(m => m.lote !== null)
  const totalHum   = procesados.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalSec   = procesados.reduce((s, m) => s + m.total_material_seco, 0)

  const desvincular = (m: MaterialRow) => {
    const lote = lotes.find(l => l.codigo === m.lote)
    if (lote && lote.estado !== 'en_proceso') {
      alert(`No se puede desvincular: el lote ${lote.codigo} ya fue cerrado (${ESTADO_LOTE[lote.estado]?.label}).`)
      return
    }
    if (!confirm(`¿Desvincular Vol. ${m.numero_volqueta} del lote ${m.lote}?`)) return
    setMateriales(prev => prev.map(x =>
      x.id === m.id ? { ...x, estado: 'pagada' as const, lote: null } : x
    ))
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Vinculaciones"   value={procesados.length}           accent="brown"   />
        <KpiTile label="T. húmedo total" value={`${totalHum.toFixed(2)} t`} accent="green"   />
        <KpiTile label="T. seco total"   value={`${totalSec.toFixed(2)} t`} accent="emerald" />
        <KpiTile label="Lotes activos"   value={lotes.filter(l => l.estado === 'en_proceso').length} accent="amber" />
      </div>

      <Card title={`Procesamiento de material (${procesados.length} vínculos)`}>
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
              {procesados.map(m => {
                const lote = lotes.find(l => l.codigo === m.lote)
                const isExp = expandedRow === m.id
                const anals = analisis.filter(a => a.id_entrada === m.id)
                return (
                  <React.Fragment key={m.id}>
                  <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                    onClick={() => setExpandedRow(isExp ? null : m.id)}>
                    <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                    <td style={{ fontWeight: 700 }} className="mono">{m.lote}</td>
                    <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                    <td style={{ fontWeight: 600 }}>{m.mina}</td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{m.total_material_seco.toFixed(4)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.tenor > 0 ? `${m.tenor.toFixed(1)} gr/t` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}
                    </td>
                    <td>
                      {lote
                        ? <span className={`badge ${ESTADO_LOTE[lote.estado]?.badge ?? 'badge--neutral'}`}>{ESTADO_LOTE[lote.estado]?.label}</span>
                        : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    {canWrite && (
                      <td onClick={e => e.stopPropagation()}>
                        {lote?.estado === 'en_proceso' && (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} title="Desvincular del lote"
                            onClick={() => desvincular(m)} />
                        )}
                      </td>
                    )}
                  </tr>

                  {isExp && (
                    <tr>
                      <td colSpan={canWrite ? 10 : 9} style={{ padding: '0.85rem 1.25rem', background: '#fafaf9' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.25rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <FlaskConical size={14}/> Análisis del material ({anals.length})
                            </div>
                            {anals.length === 0 ? (
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
                                  {anals.map(a => {
                                    const tipo = a.tipo ?? 'cabeza'
                                    const col = tipo === 'sulfuros' ? '#065f46' : tipo === 'colas' ? '#9f1239' : '#0c4a6e'
                                    return (
                                      <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '3px 6px' }}><span style={{ fontWeight: 700, color: col, textTransform: 'capitalize' }}>{tipo}</span></td>
                                        <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)' }}>{a.numero_analisis}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.toneladas_secas != null ? a.toneladas_secas.toFixed(4) : '—'}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{a.au_gr_x_ton.toFixed(2)}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.ag_gr_x_ton != null ? a.ag_gr_x_ton.toFixed(0) : '—'}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.au_concentrado != null ? `${a.au_concentrado.toFixed(1)} g` : '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: 'var(--amber-800)' }}>Detalle</div>
                            <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Lote</span><strong className="mono">{m.lote}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Peso húmedo</span><strong className="mono">{m.peso_llegada_planta.toFixed(3)} t</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Humedad</span><strong className="mono">{m.porcentaje_humedad > 0 ? `${(m.porcentaje_humedad * 100).toFixed(1)}%` : 'S/A'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Ton secas</span><strong className="mono">{m.total_material_seco.toFixed(4)} t</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Tenor Au</span><strong className="mono">{m.tenor > 0 ? `${m.tenor.toFixed(2)} g/t` : 'S/A'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Estado lote</span><span>{lote ? <span className={`badge ${ESTADO_LOTE[lote.estado]?.badge ?? 'badge--neutral'}`}>{ESTADO_LOTE[lote.estado]?.label}</span> : '—'}</span>
                            </div>
                          </div>
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
                <td colSpan={5}>Total ({procesados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalHum.toFixed(3)} t</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalSec.toFixed(4)} t</td>
                <td colSpan={canWrite ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

// ── Página principal ───────────────────────────────────────────────
export function ProcesamientoPage() {
  const [tab, setTab] = useState<Tab>('lotes')

  return (
    <div className="page">
      <PageHeader
        title="Procesamiento"
        subtitle="Lotes de concentrado, vinculación de materiales y cierre de proceso."
      />

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'lotes'}
          className={`segment__btn ${tab === 'lotes' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('lotes')}>
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Lotes concentrado
        </button>
        <button role="tab" aria-selected={tab === 'procesamiento'}
          className={`segment__btn ${tab === 'procesamiento' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('procesamiento')}>
          Procesamiento material
        </button>
      </div>

      {tab === 'lotes'         && <LotesTab />}
      {tab === 'procesamiento' && <ProcesamientoTab />}
    </div>
  )
}
