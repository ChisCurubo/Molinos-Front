import { useState, type Dispatch, type SetStateAction } from 'react'
import { Archive, Boxes, History, Layers, Plus, Truck } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  lotesConcentrado, kardexMock, viajesMock, materialesMock,
  type LoteConcentrado, type KardexRow, type ViajeRow, type MaterialRow,
} from '@/data/mock'

const cop = formatCOP

const ESTADO_LOTE: Record<string, { label: string; badge: string }> = {
  en_proceso:           { label: 'En proceso',           badge: 'badge--warning' },
  en_canoa:             { label: 'En canoa',             badge: 'badge--info'    },
  parcialmente_enviado: { label: 'Parcialmente enviado', badge: 'badge--warning' },
  enviado_completo:     { label: 'Enviado completo',     badge: 'badge--success' },
}

const TIPO_MOV_COLOR: Record<string, string> = {
  ENTRADA_PLANTA:      'var(--green-700)',
  ENTRADA_CONCENTRADO: 'var(--emerald-700)',
  SALIDA_VIAJE:        'var(--rose-600)',
  SALIDA_PROCESO:      'var(--amber-700)',
  AJUSTE_MERMA:        'var(--slate-500)',
}

type Tab = 'lotes' | 'inventario' | 'movimientos' | 'viajes'

const TABS: { key: Tab; label: string; icon: typeof Boxes }[] = [
  { key: 'lotes',       label: 'Lotes concentrado',    icon: Boxes   },
  { key: 'inventario',  label: 'Inventario',           icon: Archive },
  { key: 'movimientos', label: 'Kardex / Movimientos', icon: History },
  { key: 'viajes',      label: 'Viajes de material',   icon: Truck   },
]

// ── Sub-tab: Lotes concentrado ─────────────────────────────────────
interface LotesTabProps {
  materiales: MaterialRow[]
  setMateriales: Dispatch<SetStateAction<MaterialRow[]>>
  lotes: LoteConcentrado[]
  setLotes: Dispatch<SetStateAction<LoteConcentrado[]>>
}

function LotesTab({ materiales, setMateriales, lotes, setLotes }: LotesTabProps) {
  const canWrite = useCanWrite('materiales')

  // Modal: ver detalle
  const [detalle, setDetalle] = useState<LoteConcentrado | null>(null)

  // Modal: crear lote
  const [crearOpen, setCrearOpen] = useState(false)
  const [formCrear, setFormCrear] = useState({
    codigo: '', fecha_inicio: todayISO(),
    hizo_molienda: false, hizo_flotacion: false, hizo_relave: false, hizo_filtroprensa: false,
  })

  // Modal: procesar materiales (vincular entradas al lote)
  const [procesarLote, setProcesarLote] = useState<LoteConcentrado | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [tonAProcesar, setTonAProcesar] = useState('')

  // Modal: cerrar lote (el molino terminó)
  const [cerrarLote, setCerrarLote] = useState<LoteConcentrado | null>(null)
  const [formCerrar, setFormCerrar] = useState({
    ton_humedo: '', porcentaje_humedad: '13', fecha_fin: todayISO(), ubicacion_canoa: '',
  })

  // Modal: análisis concentrado (tipo 2)
  const [analisisLote, setAnalisisLote] = useState<LoteConcentrado | null>(null)
  const [formAnalisis, setFormAnalisis] = useState({
    numero_analisis: '', porcentaje_humedad: '13', au_gr_x_ton: '', ag_gr_x_ton: '',
  })

  // Materiales disponibles: pagada o pendiente, sin lote asignado
  const disponibles = materiales.filter(
    m => (m.estado === 'pagada' || m.estado === 'pendiente') && m.lote === null
  )

  const totalSelHum = [...seleccionados].reduce((s, id) => {
    const m = materiales.find(x => x.id === id)
    return m ? s + m.peso_llegada_planta : s
  }, 0)
  const totalSelSec = [...seleccionados].reduce((s, id) => {
    const m = materiales.find(x => x.id === id)
    return m ? s + m.total_material_seco : s
  }, 0)

  // ── Handlers ──
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

  const abrirProcesar = (l: LoteConcentrado) => {
    setProcesarLote(l)
    setSeleccionados(new Set())
    setTonAProcesar('')
  }

  const guardarProcesar = () => {
    if (!procesarLote || seleccionados.size === 0) return
    const tonFinal = tonAProcesar ? Math.min(Number(tonAProcesar), totalSelSec) : totalSelSec
    const proporcion = tonFinal / totalSelSec

    setMateriales(prev => prev.map(m =>
      seleccionados.has(m.id)
        ? { ...m, estado: 'en_proceso' as const, lote: procesarLote.codigo }
        : m
    ))
    setLotes(prev => prev.map(l =>
      l.id === procesarLote.id
        ? { ...l, material_seco_procesado: (l.material_seco_procesado ?? 0) + tonFinal }
        : l
    ))
    // Log proporciones en consola para trazabilidad
    const items = [...seleccionados].map(id => {
      const m = materiales.find(x => x.id === id)!
      return { id, seco: Math.round(m.total_material_seco * proporcion * 10000) / 10000 }
    })
    console.info('[Procesamiento]', procesarLote.codigo, items)

    setProcesarLote(null)
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
      l.id === cerrarLote.id
        ? {
          ...l, toneladas_humedo: tonHum, porcentaje_humedad: hum, toneladas_seco: tonSec,
          toneladas_disponibles: tonHum,                  // SIEMPRE en húmedas
          fecha_fin: formCerrar.fecha_fin,
          ubicacion_canoa: formCerrar.ubicacion_canoa || null,
          maquila_total: maquila, estado: 'en_canoa' as const,
        }
        : l
    ))
    setCerrarLote(null)
  }

  const guardarAnalisis = () => {
    if (!analisisLote || !formAnalisis.au_gr_x_ton) return
    // En la integración real: POST /material/analisis con id_material_concentrado + id_tipo_analisis=2
    console.info('[Análisis concentrado]', {
      id_material_concentrado: analisisLote.id,
      id_tipo_analisis: 2,
      numero_analisis: formAnalisis.numero_analisis,
      porcentaje_humedad: Number(formAnalisis.porcentaje_humedad) / 100,
      au_gr_x_ton: Number(formAnalisis.au_gr_x_ton),
      ag_gr_x_ton: formAnalisis.ag_gr_x_ton ? Number(formAnalisis.ag_gr_x_ton) : null,
    })
    setAnalisisLote(null)
    setFormAnalisis({ numero_analisis: '', porcentaje_humedad: '13', au_gr_x_ton: '', ag_gr_x_ton: '' })
  }

  const toggleSel = (id: number) =>
    setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const kpiEnProceso = lotes.filter(l => l.estado === 'en_proceso').length
  const kpiEnCanoa   = lotes.filter(l => l.estado === 'en_canoa').length
  const totalMaquila = lotes.reduce((s, l) => s + l.maquila_total, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total lotes"   value={lotes.length}      icon={<Boxes size={16}/>}  accent="brown"   />
        <KpiTile label="En proceso"    value={kpiEnProceso}      icon={<Layers size={16}/>} accent="amber"   />
        <KpiTile label="En canoa"      value={kpiEnCanoa}                                   accent="green"   />
        <KpiTile label="Maquila total" value={cop(totalMaquila)}                            accent="emerald" />
      </div>

      <Card title={`Lotes de concentrado (${lotes.length})`}
        actions={canWrite && (
          <Button size="sm" icon={<Plus size={15}/>} onClick={() => setCrearOpen(true)}>
            Crear lote
          </Button>
        )}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Estado</th><th>F. inicio</th><th>F. fin</th>
                <th style={{textAlign:'right'}}>T. Húm.</th>
                <th style={{textAlign:'right'}}>T. Seco</th>
                <th style={{textAlign:'right'}}>Mat. procesado</th>
                <th style={{textAlign:'right'}}>Disponible</th>
                <th style={{textAlign:'right'}}>Maquila</th>
                <th>Proceso</th><th>Canoa</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => (
                <tr key={l.id} style={
                  l.estado === 'en_proceso' ? { background: 'var(--amber-50)' }
                  : l.toneladas_disponibles > 0 ? { background: 'var(--green-50)' }
                  : undefined
                }>
                  <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                  <td>
                    <span className={`badge ${ESTADO_LOTE[l.estado]?.badge ?? 'badge--neutral'}`}>
                      {ESTADO_LOTE[l.estado]?.label ?? l.estado}
                    </span>
                  </td>
                  <td style={{ fontSize:'var(--fs-sm)' }}>{formatDate(l.fecha_inicio)}</td>
                  <td style={{ fontSize:'var(--fs-sm)' }}>{l.fecha_fin ? formatDate(l.fecha_fin) : '—'}</td>
                  <td style={{ textAlign:'right' }} className="mono">
                    {l.toneladas_humedo > 0 ? `${l.toneladas_humedo.toFixed(2)} t` : '—'}
                  </td>
                  <td style={{ textAlign:'right' }} className="mono">
                    {l.toneladas_seco > 0 ? `${l.toneladas_seco.toFixed(4)} t` : '—'}
                  </td>
                  <td style={{ textAlign:'right' }} className="mono">
                    {(l.material_seco_procesado ?? 0) > 0
                      ? `${(l.material_seco_procesado ?? 0).toFixed(3)} t`
                      : '—'}
                  </td>
                  <td style={{ textAlign:'right', fontWeight: l.toneladas_disponibles > 0 ? 700 : undefined, color: l.toneladas_disponibles > 0 ? 'var(--emerald-700)' : undefined }} className="mono">
                    {l.toneladas_disponibles > 0 ? `${l.toneladas_disponibles.toFixed(2)} t` : '—'}
                  </td>
                  <td style={{ textAlign:'right' }} className="mono">
                    {l.maquila_total > 0 ? cop(l.maquila_total) : '—'}
                  </td>
                  <td style={{ fontSize:'var(--fs-xs)', color:'var(--text-muted)' }}>
                    {[l.hizo_molienda && 'Mol', l.hizo_flotacion && 'Flot', l.hizo_filtroprensa && 'Fil']
                      .filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td style={{ fontSize:'var(--fs-sm)' }}>{l.ubicacion_canoa ?? '—'}</td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {l.estado === 'en_proceso' && <>
                          <Button variant="secondary" size="sm" onClick={() => abrirProcesar(l)}>Procesar</Button>
                          <Button variant="secondary" size="sm" onClick={() => abrirCerrar(l)}>Cerrar</Button>
                        </>}
                        {l.estado === 'en_canoa' && (
                          <Button variant="secondary" size="sm" onClick={() => {
                            setAnalisisLote(l)
                            setFormAnalisis({ numero_analisis: '', porcentaje_humedad: String((l.porcentaje_humedad * 100).toFixed(1)), au_gr_x_ton: '', ag_gr_x_ton: '' })
                          }}>Análisis</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setDetalle(l)}>Ver</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal: Crear lote ── */}
      <Modal open={crearOpen} title="Crear lote de concentrado" onClose={() => setCrearOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setCrearOpen(false)}>Cancelar</Button>
          <Button onClick={guardarCrear} disabled={!formCrear.codigo.trim()}>Crear</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Código del lote" placeholder="LC-2026-001" required
            value={formCrear.codigo} onChange={e => setFormCrear(f => ({...f, codigo: e.target.value}))} />
          <Input label="Fecha inicio" type="date"
            value={formCrear.fecha_inicio} onChange={e => setFormCrear(f => ({...f, fecha_inicio: e.target.value}))} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)', marginBottom:'0.5rem', fontWeight:600 }}>
            Procesos aplicados:
          </p>
          <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap' }}>
            {([
              ['hizo_molienda',    'Molienda'],
              ['hizo_flotacion',   'Flotación'],
              ['hizo_relave',      'Relave'],
              ['hizo_filtroprensa','Filtroprensa'],
            ] as [keyof typeof formCrear, string][]).map(([k, label]) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', fontSize:'var(--fs-sm)' }}>
                <input type="checkbox" checked={formCrear[k] as boolean}
                  onChange={e => setFormCrear(f => ({...f, [k]: e.target.checked}))} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <p style={{ fontSize:'var(--fs-xs)', color:'var(--text-muted)', marginTop:'0.75rem' }}>
          El lote queda en estado <strong>En proceso</strong>. Vincula materiales con "Procesar" y ciérralo cuando el molino termine.
        </p>
      </Modal>

      {/* ── Modal: Procesar materiales ── */}
      <Modal open={!!procesarLote}
        title={`Vincular materiales → ${procesarLote?.codigo ?? ''}`}
        onClose={() => setProcesarLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setProcesarLote(null)}>Cancelar</Button>
          <Button onClick={guardarProcesar} disabled={seleccionados.size === 0}>
            Vincular al lote ({seleccionados.size})
          </Button>
        </>}>
        {procesarLote && (
          <>
            <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)', marginBottom:'0.75rem' }}>
              Selecciona los materiales que entran a este lote (estado pagada/pendiente sin lote asignado):
            </p>

            {disponibles.length === 0 ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'1.5rem' }}>
                No hay material disponible sin lote asignado.
              </p>
            ) : (
              <div className="table-wrap" style={{ maxHeight:'18rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width:'2.5rem' }}></th>
                      <th>Mina</th><th>Fecha</th>
                      <th style={{textAlign:'right'}}>Húmedo (t)</th>
                      <th style={{textAlign:'right'}}>Seco (t)</th>
                      <th style={{textAlign:'right'}}>Tenor gr/t</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disponibles.map(m => {
                      const sel = seleccionados.has(m.id)
                      return (
                        <tr key={m.id}
                          style={{ cursor:'pointer', ...(sel ? { background:'var(--green-50)' } : {}) }}
                          onClick={() => toggleSel(m.id)}>
                          <td>
                            <input type="checkbox" checked={sel}
                              onChange={() => toggleSel(m.id)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.mina}</td>
                          <td style={{ fontSize:'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                          <td style={{ textAlign:'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)}</td>
                          <td style={{ textAlign:'right', fontWeight: sel ? 700 : undefined, color: sel ? 'var(--green-700)' : undefined }} className="mono">
                            {m.total_material_seco.toFixed(4)}
                          </td>
                          <td style={{ textAlign:'right' }} className="mono">
                            {m.tenor > 0
                              ? `${m.tenor.toFixed(1)}`
                              : <em style={{ color:'var(--text-faint)' }}>S/A</em>}
                          </td>
                          <td>
                            <span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>
                              {m.estado}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {seleccionados.size > 0 && (
              <div className="callout" style={{ marginTop:'0.75rem' }}>
                <strong>Total seleccionado:</strong>{' '}
                {totalSelHum.toFixed(3)} t húmedo · <strong>{totalSelSec.toFixed(4)} t seco</strong>
                <div style={{ marginTop:'0.625rem' }}>
                  <Input label="Toneladas a procesar (opcional)"
                    type="number" step="0.001"
                    placeholder={`Máx ${totalSelSec.toFixed(3)} t seco — vacío = 100%`}
                    value={tonAProcesar}
                    onChange={e => setTonAProcesar(e.target.value)}
                    helper="Dejar vacío para usar el 100% de los seleccionados. Si es menor, se distribuye proporcionalmente." />
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Cerrar lote ── */}
      <Modal open={!!cerrarLote}
        title={`Cerrar lote — ${cerrarLote?.codigo ?? ''}`}
        onClose={() => setCerrarLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setCerrarLote(null)}>Cancelar</Button>
          <Button onClick={guardarCerrar} disabled={!formCerrar.ton_humedo}>Cerrar lote</Button>
        </>}>
        {cerrarLote && (
          <>
            <div className="callout" style={{ marginBottom:'1rem' }}>
              Materia prima procesada: <strong>{(cerrarLote.material_seco_procesado ?? 0).toFixed(3)} t seco</strong>
              {' · '}Maquila estimada:{' '}
              <strong>{cop((cerrarLote.material_seco_procesado ?? 0) * (cerrarLote.precio_maquila_por_ton ?? 300000))}</strong>
              {' '}({cop(cerrarLote.precio_maquila_por_ton ?? 300000)}/t)
            </div>
            <div className="grid grid--form">
              <Input label="Toneladas concentrado (húmedo)" type="number" step="0.001" required
                placeholder="0.000"
                value={formCerrar.ton_humedo}
                onChange={e => setFormCerrar(f => ({...f, ton_humedo: e.target.value}))} />
              <Input label="Humedad del concentrado (%)" type="number" step="0.1" placeholder="13"
                value={formCerrar.porcentaje_humedad}
                onChange={e => setFormCerrar(f => ({...f, porcentaje_humedad: e.target.value}))} />
              <Input label="Fecha fin proceso" type="date"
                value={formCerrar.fecha_fin}
                onChange={e => setFormCerrar(f => ({...f, fecha_fin: e.target.value}))} />
              <Input label="Ubicación canoa" placeholder="Canoa Principal"
                value={formCerrar.ubicacion_canoa}
                onChange={e => setFormCerrar(f => ({...f, ubicacion_canoa: e.target.value}))} />
            </div>
            {formCerrar.ton_humedo && formCerrar.porcentaje_humedad && (
              <div className="callout" style={{ marginTop:'0.75rem' }}>
                T. seco: <strong>{(Number(formCerrar.ton_humedo) * (1 - Number(formCerrar.porcentaje_humedad) / 100)).toFixed(4)} t</strong>
                {' · '}Disponible en canoa: <strong>{Number(formCerrar.ton_humedo).toFixed(2)} t húm.</strong>
                {' · '}Maquila final: <strong>{cop(
                  (cerrarLote.material_seco_procesado ?? 0) * (cerrarLote.precio_maquila_por_ton ?? 300000)
                )}</strong>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Análisis concentrado (tipo 2) ── */}
      <Modal open={!!analisisLote}
        title={`Análisis concentrado — ${analisisLote?.codigo ?? ''}`}
        onClose={() => setAnalisisLote(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAnalisisLote(null)}>Cancelar</Button>
          <Button onClick={guardarAnalisis} disabled={!formAnalisis.au_gr_x_ton}>Guardar análisis</Button>
        </>}>
        {analisisLote && (
          <>
            <div className="callout" style={{ marginBottom:'1rem' }}>
              Lote <strong>{analisisLote.codigo}</strong>{' · '}
              {analisisLote.toneladas_humedo.toFixed(2)} t húm.{' · '}
              Canoa: {analisisLote.ubicacion_canoa ?? '—'}
            </div>
            <div className="grid grid--form">
              <Input label="N.° análisis" placeholder="AN-CONC-001"
                value={formAnalisis.numero_analisis}
                onChange={e => setFormAnalisis(f => ({...f, numero_analisis: e.target.value}))} />
              <Input label="Humedad (%)" type="number" step="0.1" placeholder="13"
                value={formAnalisis.porcentaje_humedad}
                onChange={e => setFormAnalisis(f => ({...f, porcentaje_humedad: e.target.value}))} />
              <Input label="Au gr/t (tenor)" type="number" step="0.1" required
                value={formAnalisis.au_gr_x_ton}
                onChange={e => setFormAnalisis(f => ({...f, au_gr_x_ton: e.target.value}))} />
              <Input label="Ag gr/t (opcional)" type="number" step="1"
                value={formAnalisis.ag_gr_x_ton}
                onChange={e => setFormAnalisis(f => ({...f, ag_gr_x_ton: e.target.value}))} />
            </div>
            {formAnalisis.au_gr_x_ton && formAnalisis.porcentaje_humedad && (
              <div className="callout" style={{ marginTop:'0.75rem' }}>
                Au concentrado estimado:{' '}
                <strong>
                  {(
                    analisisLote.toneladas_humedo
                    * (1 - Number(formAnalisis.porcentaje_humedad) / 100)
                    * Number(formAnalisis.au_gr_x_ton)
                  ).toFixed(2)} gr Au
                </strong>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Ver detalle lote ── */}
      <Modal open={!!detalle} title={detalle?.codigo ?? ''} onClose={() => setDetalle(null)}
        footer={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}>
        {detalle && (
          <div className="grid grid--form">
            {([
              ['Estado',                ESTADO_LOTE[detalle.estado]?.label ?? detalle.estado],
              ['Fecha inicio',          formatDate(detalle.fecha_inicio)],
              ['Fecha fin',             detalle.fecha_fin ? formatDate(detalle.fecha_fin) : '—'],
              ['T. húmedo',            detalle.toneladas_humedo > 0 ? `${detalle.toneladas_humedo.toFixed(2)} t` : '—'],
              ['Humedad',               detalle.porcentaje_humedad > 0 ? `${(detalle.porcentaje_humedad * 100).toFixed(1)}%` : '—'],
              ['T. seco',              detalle.toneladas_seco > 0 ? `${detalle.toneladas_seco.toFixed(4)} t` : '—'],
              ['Mat. seco procesado',   `${(detalle.material_seco_procesado ?? 0).toFixed(3)} t`],
              ['T. disponibles',        `${detalle.toneladas_disponibles.toFixed(2)} t húm.`],
              ['Maquila/ton',           cop(detalle.precio_maquila_por_ton ?? 0)],
              ['Maquila total',         detalle.maquila_total > 0 ? cop(detalle.maquila_total) : '—'],
              ['Proceso',               [detalle.hizo_molienda&&'Molienda',detalle.hizo_flotacion&&'Flotación',detalle.hizo_filtroprensa&&'Filtroprensa'].filter(Boolean).join(', ') || '—'],
              ['Canoa',                 detalle.ubicacion_canoa ?? '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>{k}</p>
                <p style={{ fontWeight: 600 }}>{v}</p>
              </div>
            ))}
            {detalle.comentarios && (
              <div style={{ gridColumn:'1/-1' }}>
                <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>Comentarios</p>
                <p>{detalle.comentarios}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Sub-tab: Inventario ────────────────────────────────────────────
function InventarioTab({ materiales, lotes }: { materiales: MaterialRow[]; lotes: LoteConcentrado[] }) {
  const crudo       = materiales.filter(m => (m.estado === 'pagada' || m.estado === 'pendiente') && m.lote === null)
  const concentrado = lotes.filter(l => l.toneladas_disponibles > 0)

  const totalCrudoHum = crudo.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalCrudoSec = crudo.reduce((s, m) => s + m.total_material_seco, 0)
  const totalConcHum  = concentrado.reduce((s, l) => s + l.toneladas_disponibles, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Material crudo"      value={`${crudo.length} entr.`}           accent="brown"   />
        <KpiTile label="T. crudo disponible" value={`${totalCrudoSec.toFixed(2)} t seco`} accent="green" />
        <KpiTile label="Lotes en canoa"      value={concentrado.length}                 accent="emerald" />
        <KpiTile label="Conc. disponible"    value={`${totalConcHum.toFixed(2)} t húm`} accent="amber"   />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', alignItems:'start' }}>
        {/* Panel A: material crudo */}
        <Card title={`Material crudo en planta (${crudo.length})`}>
          {crudo.length === 0 ? (
            <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'1.25rem 0' }}>
              No hay material crudo disponible.
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mina</th><th>Fecha</th>
                      <th style={{textAlign:'right'}}>Húm.</th>
                      <th style={{textAlign:'right'}}>Seco</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crudo.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.mina}</td>
                        <td style={{ fontSize:'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                        <td style={{ textAlign:'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                        <td style={{ textAlign:'right', fontWeight: 700, color:'var(--green-700)' }} className="mono">
                          {m.total_material_seco.toFixed(3)} t
                        </td>
                        <td>
                          <span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>
                            {m.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={2}>Total</td>
                      <td style={{ textAlign:'right' }} className="mono">{totalCrudoHum.toFixed(3)} t</td>
                      <td style={{ textAlign:'right' }} className="mono">{totalCrudoSec.toFixed(3)} t</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Panel B: concentrado disponible */}
        <Card title={`Concentrado en canoa (${concentrado.length})`}>
          {concentrado.length === 0 ? (
            <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'1.25rem 0' }}>
              No hay concentrado disponible para despachar.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lote</th><th>Canoa</th>
                    <th style={{textAlign:'right'}}>Disponible</th>
                    <th style={{textAlign:'right'}}>Maquila</th>
                  </tr>
                </thead>
                <tbody>
                  {concentrado.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                      <td style={{ fontSize:'var(--fs-sm)' }}>{l.ubicacion_canoa ?? '—'}</td>
                      <td style={{ textAlign:'right', fontWeight: 700, color:'var(--emerald-700)' }} className="mono">
                        {l.toneladas_disponibles.toFixed(2)} t
                      </td>
                      <td style={{ textAlign:'right' }} className="mono">
                        {l.maquila_total > 0
                          ? cop(l.maquila_total)
                          : <em style={{ color:'var(--text-faint)' }}>$0</em>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Total</td>
                    <td style={{ textAlign:'right' }} className="mono">{totalConcHum.toFixed(2)} t</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

// ── Sub-tab: Kardex / Movimientos ──────────────────────────────────
function MovimientosTab() {
  const [kardex] = useState<KardexRow[]>(kardexMock)

  const entradas = kardex.filter(k => k.tipo_movimiento.startsWith('ENTRADA'))
  const salidas  = kardex.filter(k => k.tipo_movimiento.startsWith('SALIDA'))
  const totalEnt = entradas.reduce((s, k) => s + k.toneladas_movidas, 0)
  const totalSal = salidas.reduce((s, k) => s + k.toneladas_movidas, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Movimientos" value={kardex.length}                                           accent="brown"   />
        <KpiTile label="Entradas"    value={`${entradas.length} reg · ${totalEnt.toFixed(2)} t`}     accent="green"   />
        <KpiTile label="Salidas"     value={`${salidas.length} reg · ${totalSal.toFixed(2)} t`}      accent="rose"    />
        <KpiTile label="Ajustes"     value={kardex.filter(k => k.tipo_movimiento === 'AJUSTE_MERMA').length} accent="amber" />
      </div>

      <Card title={`Kardex de movimientos (${kardex.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Lote</th><th>Fecha</th><th>Tipo movimiento</th>
                <th style={{textAlign:'right'}}>Toneladas</th><th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {kardex.map(k => (
                <tr key={k.id}>
                  <td className="mono" style={{ color:'var(--text-muted)' }}>{k.id_lote}</td>
                  <td style={{ fontSize:'var(--fs-sm)' }}>{formatDate(k.fecha)}</td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize:'var(--fs-sm)', color: TIPO_MOV_COLOR[k.tipo_movimiento] ?? 'inherit' }}>
                      {k.tipo_movimiento.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign:'right', fontWeight: 700 }} className="mono">
                    {k.toneladas_movidas.toFixed(4)}
                  </td>
                  <td style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>
                    {k.destino_referencia ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

// ── Sub-tab: Viajes de material ────────────────────────────────────
interface ViajesTabProps {
  lotes: LoteConcentrado[]
  setLotes: Dispatch<SetStateAction<LoteConcentrado[]>>
  viajes: ViajeRow[]
  setViajes: Dispatch<SetStateAction<ViajeRow[]>>
}

function ViajesTab({ lotes, setLotes, viajes, setViajes }: ViajesTabProps) {
  const canWrite = useCanWrite('materiales')

  // Detalle viaje
  const [detalle, setDetalle] = useState<ViajeRow | null>(null)

  // Wizard nuevo viaje: 0=cerrado 1=paso1 2=paso2
  const [wStep, setWStep] = useState<0 | 1 | 2>(0)
  const [formViaje, setFormViaje] = useState({ numero_viaje: '', fecha: todayISO(), comentarios: '' })
  const [cantidades, setCantidades] = useState<Record<number, string>>({})

  // Prompt remanente
  const [remanentePendiente, setRemanentePendiente] = useState<{ lote: LoteConcentrado; sobra: number } | null>(null)

  const lotesDisponibles = lotes.filter(l => l.toneladas_disponibles > 0)

  const totalMaquila  = viajes.reduce((s, v) => s + v.maquila, 0)
  const totalMaterial = viajes.reduce((s, v) => s + v.total_costo_material, 0)

  const resumen = lotesDisponibles.reduce((s, l) => {
    const ton = Number(cantidades[l.id] ?? 0)
    return {
      humedo:  s.humedo  + ton,
      maquila: s.maquila + (ton > 0 ? l.maquila_total : 0),
    }
  }, { humedo: 0, maquila: 0 })

  const abrirWizard = () => {
    setFormViaje({ numero_viaje: '', fecha: todayISO(), comentarios: '' })
    setCantidades({})
    setWStep(1)
  }

  const guardarViaje = () => {
    const lineas = lotesDisponibles
      .filter(l => Number(cantidades[l.id] ?? 0) > 0)
      .map((l, i) => {
        const tonHum = Number(cantidades[l.id])
        const tonSec = tonHum * (1 - l.porcentaje_humedad)
        return {
          id: Date.now() + i, lote: l.codigo, concepto: l.codigo,
          concentrado_humedo: tonHum, concentrado_seco: tonSec,
          costo_maquila: l.maquila_total, valor_total: 0,
        }
      })

    if (lineas.length === 0) return

    const nuevoViaje: ViajeRow = {
      id: Date.now(), numero_viaje: formViaje.numero_viaje,
      fecha: formViaje.fecha, maquila: resumen.maquila,
      total_costo_material: 0, lineas,
    }
    setViajes(prev => [...prev, nuevoViaje])

    // Decrementar disponibles y actualizar estados
    const parciales: { lote: LoteConcentrado; sobra: number }[] = []
    setLotes(prev => prev.map(l => {
      const salida = Number(cantidades[l.id] ?? 0)
      if (salida <= 0) return l
      const nuevaDisp = Math.max(0, l.toneladas_disponibles - salida)
      const nuevoEstado: LoteConcentrado['estado'] =
        nuevaDisp <= 0 ? 'enviado_completo' : 'parcialmente_enviado'
      if (nuevaDisp > 0) parciales.push({ lote: l, sobra: nuevaDisp })
      return { ...l, toneladas_disponibles: nuevaDisp, estado: nuevoEstado }
    }))

    setWStep(0)

    // Si quedaron toneladas en algún lote, ofrecer crear remanente
    if (parciales.length > 0) setRemanentePendiente(parciales[0])
  }

  const crearRemanente = () => {
    if (!remanentePendiente) return
    const { lote, sobra } = remanentePendiente
    const nuevoLote: LoteConcentrado = {
      id: Date.now(),
      codigo: `LC-REM-${lote.codigo}`,
      fecha_inicio: todayISO(), fecha_fin: todayISO(),
      hizo_molienda: lote.hizo_molienda, hizo_flotacion: lote.hizo_flotacion,
      hizo_relave: lote.hizo_relave, hizo_filtroprensa: lote.hizo_filtroprensa,
      toneladas_humedo: sobra, porcentaje_humedad: lote.porcentaje_humedad,
      toneladas_seco: sobra * (1 - lote.porcentaje_humedad),
      toneladas_disponibles: sobra,             // HÚMEDAS siempre
      ubicacion_canoa: lote.ubicacion_canoa,
      precio_maquila_por_ton: 0, maquila_total: 0,  // maquila ya cobrada en el viaje original
      material_seco_procesado: 0,
      estado: 'en_canoa',                       // directo a en_canoa, sin pasar por en_proceso
      comentarios: `Remanente de ${lote.codigo}`,
    }
    setLotes(prev => [nuevoLote, ...prev])
    setRemanentePendiente(null)
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Viajes"          value={viajes.length}               icon={<Truck size={16}/>} accent="brown"   />
        <KpiTile label="Total material"  value={cop(totalMaterial)}                                    accent="green"   />
        <KpiTile label="Total maquila"   value={cop(totalMaquila)}                                     accent="emerald" />
        <KpiTile label="Total combinado" value={cop(totalMaterial + totalMaquila)}                     accent="amber"   />
      </div>

      <Card title={`Viajes de material (${viajes.length})`}
        actions={canWrite && (
          <Button size="sm" icon={<Plus size={15}/>} onClick={abrirWizard}>Nuevo viaje</Button>
        )}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Viaje</th><th>Fecha</th>
                <th style={{textAlign:'right'}}>Costo material</th>
                <th style={{textAlign:'right'}}>Maquila</th>
                <th>Líneas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {viajes.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700 }} className="mono">#{v.numero_viaje}</td>
                  <td>{formatDate(v.fecha)}</td>
                  <td style={{ textAlign:'right' }} className="mono">{cop(v.total_costo_material)}</td>
                  <td style={{ textAlign:'right' }} className="mono">{cop(v.maquila)}</td>
                  <td style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>
                    {v.lineas.length} lotes
                  </td>
                  <td><Button variant="ghost" size="sm" onClick={() => setDetalle(v)}>Detalle</Button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2}>Total ({viajes.length} viajes)</td>
                <td style={{ textAlign:'right' }} className="mono">{cop(totalMaterial)}</td>
                <td style={{ textAlign:'right' }} className="mono">{cop(totalMaquila)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Wizard: Paso 1 — datos del viaje ── */}
      <Modal open={wStep === 1} title="Nuevo viaje — Paso 1 de 2" onClose={() => setWStep(0)}
        footer={<>
          <Button variant="secondary" onClick={() => setWStep(0)}>Cancelar</Button>
          <Button onClick={() => setWStep(2)} disabled={!formViaje.numero_viaje.trim()}>
            Siguiente → Seleccionar concentrados
          </Button>
        </>}>
        <div className="grid grid--form">
          <Input label="N.° viaje" placeholder="14-1" required
            value={formViaje.numero_viaje}
            onChange={e => setFormViaje(f => ({...f, numero_viaje: e.target.value}))} />
          <Input label="Fecha" type="date"
            value={formViaje.fecha}
            onChange={e => setFormViaje(f => ({...f, fecha: e.target.value}))} />
          <Input label="Comentarios"
            value={formViaje.comentarios}
            onChange={e => setFormViaje(f => ({...f, comentarios: e.target.value}))}
            style={{ gridColumn:'1/-1' }} />
        </div>
      </Modal>

      {/* ── Wizard: Paso 2 — seleccionar concentrados ── */}
      <Modal open={wStep === 2}
        title={`Viaje #${formViaje.numero_viaje} — Paso 2 de 2: Seleccionar concentrados`}
        onClose={() => setWStep(0)}
        footer={<>
          <Button variant="secondary" onClick={() => setWStep(1)}>← Atrás</Button>
          <Button onClick={guardarViaje} disabled={resumen.humedo <= 0}>
            Crear viaje ({resumen.humedo.toFixed(2)} t)
          </Button>
        </>}>

        {lotesDisponibles.length === 0 ? (
          <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'1.5rem' }}>
            No hay concentrado disponible en canoa para despachar.
          </p>
        ) : (
          <>
            <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)', marginBottom:'0.75rem' }}>
              Ingresa cuántas toneladas (húmedas) salen de cada lote. Dejar en blanco = no sale.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lote</th><th>Canoa</th>
                    <th style={{textAlign:'right'}}>Disponible</th>
                    <th style={{textAlign:'right'}}>Maquila</th>
                    <th style={{textAlign:'right'}}>¿Cuánto sale?</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesDisponibles.map(l => {
                    const ton = Number(cantidades[l.id] ?? 0)
                    return (
                      <tr key={l.id} style={ton > 0 ? { background:'var(--green-50)' } : undefined}>
                        <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                        <td style={{ fontSize:'var(--fs-sm)' }}>{l.ubicacion_canoa ?? '—'}</td>
                        <td style={{ textAlign:'right' }} className="mono">
                          {l.toneladas_disponibles.toFixed(2)} t
                        </td>
                        <td style={{ textAlign:'right' }} className="mono">
                          {l.maquila_total > 0
                            ? cop(l.maquila_total)
                            : <em style={{ color:'var(--text-faint)' }}>$0 — libre</em>}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <input
                            className="field__input"
                            type="number" step="0.01" min="0"
                            max={l.toneladas_disponibles}
                            placeholder={`Máx ${l.toneladas_disponibles.toFixed(2)}`}
                            value={cantidades[l.id] ?? ''}
                            onChange={e => setCantidades(v => ({...v, [l.id]: e.target.value}))}
                            style={{ width:'8rem', textAlign:'right' }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {resumen.humedo > 0 && (
              <div className="callout" style={{ marginTop:'0.75rem' }}>
                <strong>Resumen:</strong>{' '}
                {resumen.humedo.toFixed(2)} t húmedo total
                {resumen.maquila > 0 && <> · Maquila: <strong>{cop(resumen.maquila)}</strong></>}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Prompt remanente ── */}
      <Modal open={!!remanentePendiente}
        title="¿Crear lote remanente?"
        onClose={() => setRemanentePendiente(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setRemanentePendiente(null)}>No, gestionar después</Button>
          <Button onClick={crearRemanente}>Sí, crear remanente</Button>
        </>}>
        {remanentePendiente && (
          <div>
            <p>
              Quedan <strong>{remanentePendiente.sobra.toFixed(2)} t</strong> en el lote{' '}
              <strong className="mono">{remanentePendiente.lote.codigo}</strong>.
            </p>
            <p style={{ marginTop:'0.5rem', fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>
              Se creará el lote <strong>LC-REM-{remanentePendiente.lote.codigo}</strong>{' '}
              directamente en estado <em>En canoa</em> con maquila $0 (ya fue cobrada en este viaje).
            </p>
          </div>
        )}
      </Modal>

      {/* ── Modal: Detalle viaje ── */}
      <Modal open={!!detalle}
        title={`Viaje #${detalle?.numero_viaje ?? ''} — ${detalle ? formatDate(detalle.fecha) : ''}`}
        onClose={() => setDetalle(null)}
        footer={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}>
        {detalle && (
          <>
            <div className="grid grid--form" style={{ marginBottom:'1rem' }}>
              <div>
                <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>Costo material</p>
                <p style={{ fontWeight: 700, fontSize:'var(--fs-lg)' }}>{cop(detalle.total_costo_material)}</p>
              </div>
              <div>
                <p style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>Maquila</p>
                <p style={{ fontWeight: 700, fontSize:'var(--fs-lg)' }}>{cop(detalle.maquila)}</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lote</th><th>Concepto</th>
                    <th style={{textAlign:'right'}}>T. Húm.</th>
                    <th style={{textAlign:'right'}}>T. Seco</th>
                    <th style={{textAlign:'right'}}>Maquila</th>
                    <th style={{textAlign:'right'}}>Valor mat.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.lineas.map(l => (
                    <tr key={l.id}>
                      <td className="mono" style={{ fontSize:'var(--fs-sm)', fontWeight:700 }}>{l.lote}</td>
                      <td style={{ fontSize:'var(--fs-sm)', color:'var(--text-muted)' }}>{l.concepto}</td>
                      <td style={{ textAlign:'right' }} className="mono">{l.concentrado_humedo.toFixed(2)}</td>
                      <td style={{ textAlign:'right' }} className="mono">{l.concentrado_seco.toFixed(2)}</td>
                      <td style={{ textAlign:'right' }} className="mono">
                        {l.costo_maquila > 0 ? cop(l.costo_maquila) : <em style={{ color:'var(--text-faint)' }}>—</em>}
                      </td>
                      <td style={{ textAlign:'right', fontWeight: 700 }} className="mono">
                        {l.valor_total > 0 ? cop(l.valor_total) : <em style={{ color:'var(--text-faint)' }}>—</em>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Total</td>
                    <td style={{ textAlign:'right' }} className="mono">
                      {detalle.lineas.reduce((s, l) => s + l.concentrado_humedo, 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign:'right' }} className="mono">
                      {detalle.lineas.reduce((s, l) => s + l.concentrado_seco, 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign:'right' }} className="mono">{cop(detalle.maquila)}</td>
                    <td style={{ textAlign:'right' }} className="mono">{cop(detalle.total_costo_material)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

// ── Página principal ───────────────────────────────────────────────
export function ConcentradoPage() {
  const [tab, setTab] = useState<Tab>('lotes')

  // Estado compartido entre tabs: materiales y lotes se modifican en LotesTab
  // y se leen en InventarioTab; viajes se modifican en ViajesTab
  const [materiales, setMateriales] = useState<MaterialRow[]>(materialesMock)
  const [lotes, setLotes]           = useState<LoteConcentrado[]>(lotesConcentrado)
  const [viajes, setViajes]         = useState<ViajeRow[]>(viajesMock)

  return (
    <div className="page">
      <PageHeader
        title="Procesamiento y concentrado"
        subtitle="Lotes de concentrado, inventario, kardex de movimientos y viajes de material."
      />

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>
            <t.icon size={15} style={{ verticalAlign:'middle', marginRight:'0.375rem' }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lotes' && (
        <LotesTab
          materiales={materiales} setMateriales={setMateriales}
          lotes={lotes} setLotes={setLotes}
        />
      )}
      {tab === 'inventario'  && <InventarioTab materiales={materiales} lotes={lotes} />}
      {tab === 'movimientos' && <MovimientosTab />}
      {tab === 'viajes' && (
        <ViajesTab lotes={lotes} setLotes={setLotes} viajes={viajes} setViajes={setViajes} />
      )}
    </div>
  )
}
