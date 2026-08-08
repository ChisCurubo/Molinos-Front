import { useMemo, useState } from 'react'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatDate, todayISO } from '@/utils/format'
import { type AnalisisRow, type MaterialRow, type LoteConcentrado } from '@/data/mock'
import { useMateriales } from '@/context/MaterialesContext'

const ESTADO_PAGO_OPTS = [
  { value: 'no_aplica', label: 'No aplica' },
  { value: 'pendiente', label: 'Pendiente'  },
  { value: 'pagado',    label: 'Pagado'     },
]

type NuevoTab = 'sin_analisis' | 'cabeza' | 'concentrado'
type TipoBusqueda = 'mina' | 'volqueta' | 'id'
type TipoTab = 'todos' | 'cabeza' | 'sulfuros' | 'colas' | 'concentrado'

function fmtDMY(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function AnalisisPage() {
  const canWrite = useCanWrite('materiales')
  const { analisis, setAnalisis, materiales: materialesList, setMateriales, lotes: lotesConc } = useMateriales()
  const [busqueda,    setBusqueda]    = useState('')
  const [tipoFiltro, setTipoFiltro]  = useState<TipoTab>('todos')

  // ── Modal editar ────────────────────────────────────────
  const [editA, setEditA] = useState<AnalisisRow | null>(null)
  const [fp, setFp] = useState({
    numero_analisis: '', au_concentrado: '', ag_concentrado: '', au_falso: '',
    porcentaje_humedad: '', fecha_salida: '', comentarios: '',
    estado_pago: 'no_aplica' as 'no_aplica' | 'pendiente' | 'pagado',
  })

  const openEdit = (a: AnalisisRow) => {
    setEditA(a)
    setFp({
      numero_analisis:    a.numero_analisis,
      au_concentrado:     a.au_concentrado != null ? String(a.au_concentrado) : '',
      ag_concentrado:     a.ag_concentrado != null ? String(a.ag_concentrado) : '',
      au_falso:           String(a.au_falso),
      porcentaje_humedad: String((a.porcentaje_humedad * 100).toFixed(2)),
      fecha_salida:       a.fecha_salida ?? '',
      comentarios:        a.comentarios ?? '',
      estado_pago:        a.estado_pago,
    })
  }

  const save = () => {
    if (!editA) return
    const humPct = Number(fp.porcentaje_humedad)
    const tonHum = editA.ton ?? editA.toneladas_humedas ?? 0
    const tonSec = tonHum * (1 - humPct / 100)
    const auConc = Number(fp.au_concentrado) || 0
    const agConc = fp.ag_concentrado ? Number(fp.ag_concentrado) : null
    const auGrT  = tonSec > 0 && auConc > 0 ? auConc / tonSec : editA.au_gr_x_ton
    const agGrT  = tonSec > 0 && agConc != null && agConc > 0 ? agConc / tonSec : null

    setAnalisis(prev => prev.map(a => a.id !== editA.id ? a : {
      ...a,
      numero_analisis:    fp.numero_analisis || a.numero_analisis,
      au_concentrado:     auConc || a.au_concentrado,
      ag_concentrado:     agConc,
      au_falso:           Number(fp.au_falso) || a.au_falso,
      au_gr_x_ton:        auGrT,
      ag_gr_x_ton:        agGrT,
      porcentaje_humedad: humPct / 100,
      toneladas_secas:    tonSec || a.toneladas_secas,
      fecha_salida:       fp.fecha_salida || null,
      comentarios:        fp.comentarios || null,
      estado_pago:        fp.estado_pago,
    }))

    // Sync back to MaterialRow — only for cabeza analyses (sulfuros/colas have different semantics)
    if (editA.id_entrada != null && (editA.tipo == null || editA.tipo === 'cabeza')) {
      const auFalso = Number(fp.au_falso) || 0
      setMateriales(prev => prev.map(m => m.id === editA.id_entrada ? {
        ...m,
        porcentaje_humedad:  humPct / 100,
        total_material_seco: tonSec > 0 ? tonSec : m.total_material_seco,
        tenor:               auFalso > 0 ? auFalso : (auGrT ?? m.tenor) ?? 0,
      } : m))
    }
    setEditA(null)
  }

  const del = (id: number) => {
    if (!confirm('¿Eliminar este análisis?')) return
    setAnalisis(prev => prev.filter(a => a.id !== id))
  }

  const f = (k: keyof typeof fp, v: string) => setFp(s => ({ ...s, [k]: v }))

  // ── Modal nuevo análisis ─────────────────────────────────
  const [nuevoOpen,    setNuevoOpen]    = useState(false)
  const [nuevoTab,     setNuevoTab]     = useState<NuevoTab>('sin_analisis')
  const [tipoBusqueda, setTipoBusqueda] = useState<TipoBusqueda>('mina')
  const [qMat,         setQMat]         = useState('')
  const [matSel,       setMatSel]       = useState<MaterialRow | null>(null)
  const [qLote,        setQLote]        = useState('')
  const [loteSel,      setLoteSel]      = useState<LoteConcentrado | null>(null)
  const [fpN, setFpN] = useState({
    numero_analisis: '', porcentaje_humedad: '',
    au_concentrado: '', ag_concentrado: '', au_falso: '',
    fecha_salida: todayISO(),
    estado_pago: 'no_aplica' as 'no_aplica' | 'pendiente' | 'pagado',
  })

  // Materiales sin análisis de cabeza
  const sinAnalisis = useMemo(() =>
    materialesList.filter(m => !analisis.some(a => a.id_entrada === m.id && (a.tipo == null || a.tipo === 'cabeza')))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [materialesList, analisis]
  )

  const abrirNuevo = (mat?: MaterialRow) => {
    setNuevoTab(mat ? 'cabeza' : 'sin_analisis')
    setTipoBusqueda('mina')
    setQMat('')
    setMatSel(mat ?? null)
    setQLote('')
    setLoteSel(null)
    setFpN({
      numero_analisis: '', porcentaje_humedad: mat ? String((mat.porcentaje_humedad * 100).toFixed(1)) : '',
      au_concentrado: '', ag_concentrado: '', au_falso: mat && mat.tenor > 0 ? String(mat.tenor) : '',
      fecha_salida: todayISO(), estado_pago: 'no_aplica',
    })
    setNuevoOpen(true)
  }

  const fn = (k: keyof typeof fpN, v: string) => setFpN(s => ({ ...s, [k]: v }))

  const matResultados: MaterialRow[] = qMat.trim()
    ? materialesList.filter(m => {
        const q = qMat.trim().toUpperCase()
        if (tipoBusqueda === 'mina')     return m.mina.toUpperCase().includes(q)
        if (tipoBusqueda === 'volqueta') return String(m.numero_volqueta).includes(q)
        if (tipoBusqueda === 'id')       return String(m.id).includes(q)
        return false
      }).slice(0, 10)
    : []

  const loteResultados: LoteConcentrado[] = qLote.trim()
    ? lotesConc.filter(l => {
        const q = qLote.trim().toUpperCase()
        return l.codigo.toUpperCase().includes(q) || String(l.id).includes(q)
      }).slice(0, 10)
    : []

  // Preview calculado en tiempo real
  const getPreview = () => {
    const humPct  = Number(fpN.porcentaje_humedad) || 0
    const auConc  = Number(fpN.au_concentrado) || 0
    const agConc  = Number(fpN.ag_concentrado) || 0
    let tonHum = 0
    if ((nuevoTab === 'cabeza' || nuevoTab === 'sin_analisis') && matSel) {
      tonHum = matSel.peso_llegada_planta
    } else if (nuevoTab === 'concentrado' && loteSel) {
      tonHum = loteSel.toneladas_humedo || 0
      // If lote has no ton yet (en_proceso), use material_seco_procesado as ton_seco directly
      if (tonHum === 0 && loteSel.material_seco_procesado) {
        const tonSec2 = loteSel.material_seco_procesado
        return {
          tonHum: null, tonSec: tonSec2,
          auGrT: tonSec2 > 0 && auConc > 0 ? auConc / tonSec2 : null,
          agGrT: tonSec2 > 0 && agConc > 0 ? agConc / tonSec2 : null,
        }
      }
    }
    const tonSec = tonHum > 0 ? tonHum * (1 - humPct / 100) : 0
    return {
      tonHum,
      tonSec,
      auGrT: tonSec > 0 && auConc > 0 ? auConc / tonSec : null,
      agGrT: tonSec > 0 && agConc > 0 ? agConc / tonSec : null,
    }
  }

  const guardarNuevo = () => {
    const isConcentrado = nuevoTab === 'concentrado'
    if (!isConcentrado && !matSel)   return
    if (isConcentrado && !loteSel)   return
    if (!fpN.au_concentrado) return

    const humPct  = Number(fpN.porcentaje_humedad) || 0
    const auConc  = Number(fpN.au_concentrado)
    const agConc  = fpN.ag_concentrado ? Number(fpN.ag_concentrado) : null
    let tonHum = 0, tonSec = 0

    if (!isConcentrado && matSel) {
      tonHum = matSel.peso_llegada_planta
      tonSec = humPct > 0 ? tonHum * (1 - humPct / 100) : matSel.total_material_seco
    } else if (loteSel) {
      tonHum = loteSel.toneladas_humedo
      tonSec = loteSel.toneladas_seco || (loteSel.material_seco_procesado ?? 0)
    }

    const auGrT = tonSec > 0 ? auConc / tonSec : 0
    const agGrT = tonSec > 0 && agConc != null && agConc > 0 ? agConc / tonSec : null

    const nuevo: AnalisisRow = {
      id:                      Date.now(),
      numero_analisis:         fpN.numero_analisis || `AN-${Date.now()}`,
      id_entrada:              !isConcentrado ? (matSel?.id ?? null) : null,
      id_material_concentrado: isConcentrado  ? (loteSel?.id ?? null) : null,
      ton:                     tonHum,
      toneladas_humedas:       tonHum,
      toneladas_secas:         tonSec,
      porcentaje_humedad:      humPct / 100,
      au_concentrado:          auConc,
      ag_concentrado:          agConc,
      au_gr_x_ton:             auGrT,
      au_falso:                Number(fpN.au_falso) || 0,
      ag_gr_x_ton:             agGrT,
      fecha_salida:            fpN.fecha_salida || null,
      comentarios:             null,
      estado_pago:             fpN.estado_pago,
    }
    setAnalisis(prev => [nuevo, ...prev])

    // Sync analysis results back to material so EntradasPage shows updated values
    if (!isConcentrado && matSel) {
      const auFalso = Number(fpN.au_falso) || 0
      setMateriales(prev => prev.map(m => m.id === matSel.id ? {
        ...m,
        porcentaje_humedad:  humPct / 100,
        total_material_seco: tonSec > 0 ? tonSec : m.total_material_seco,
        tenor:               auFalso > 0 ? auFalso : auGrT,
      } : m))
    }
    setNuevoOpen(false)
  }

  // ── Filtros y KPIs ──────────────────────────────────────
  const filtrados = analisis.filter(a => {
    if (tipoFiltro === 'concentrado' && a.id_material_concentrado == null) return false
    if (tipoFiltro === 'cabeza'      && !(a.id_entrada != null && (a.tipo == null || a.tipo === 'cabeza'))) return false
    if (tipoFiltro === 'sulfuros'    && a.tipo !== 'sulfuros')             return false
    if (tipoFiltro === 'colas'       && a.tipo !== 'colas')                return false
    if (busqueda) {
      const q = busqueda.toUpperCase()
      if (!a.numero_analisis.toUpperCase().includes(q) && !(a.comentarios?.toUpperCase().includes(q))) return false
    }
    return true
  })

  const totalTon = filtrados.reduce((s, a) => s + (a.ton ?? 0), 0)
  const avgTenor = filtrados.length ? filtrados.reduce((s, a) => s + a.au_gr_x_ton, 0) / filtrados.length : 0

  const preview = getPreview()

  const disabled_guardar = (() => {
    if (!fpN.au_concentrado) return true
    if (nuevoTab === 'concentrado') return !loteSel
    return !matSel
  })()

  return (
    <div className="page">
      <PageHeader title="Análisis y laboratorio" subtitle="Registro completo de análisis de material y concentrado." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total registros"      value={filtrados.length}                                               icon={<FlaskConical size={16}/>} accent="brown"   />
        <KpiTile label="Análisis planta"      value={analisis.filter(a => a.id_entrada != null).length}              accent="green"   />
        <KpiTile label="Análisis concentrado" value={analisis.filter(a => a.id_material_concentrado != null).length} accent="emerald" />
        <KpiTile label="Sin análisis"         value={sinAnalisis.length}                                             accent="rose"    />
        <KpiTile label="Tenor Au prom."       value={`${avgTenor.toFixed(1)} gr/t`}                                  accent="amber"   />
      </div>

      <Card title={`Análisis (${filtrados.length})`}
        actions={canWrite && (
          <Button size="sm" icon={<Plus size={15}/>} onClick={() => abrirNuevo()}>Nuevo análisis</Button>
        )}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por N.° análisis o comentario…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '20rem' }} />
          <div className="segment">
            {([
              ['todos',        'Todos'],
              ['cabeza',       'Cabeza'],
              ['sulfuros',     'Sulfuros'],
              ['colas',        'Colas'],
              ['concentrado',  'Concentrado'],
            ] as [TipoTab, string][]).map(([k, l]) => {
              const cnt = k === 'todos' ? analisis.length
                : k === 'concentrado'  ? analisis.filter(a => a.id_material_concentrado != null).length
                : k === 'cabeza'       ? analisis.filter(a => a.id_entrada != null && (a.tipo == null || a.tipo === 'cabeza')).length
                :                        analisis.filter(a => a.tipo === k).length
              return (
                <button key={k}
                  className={`segment__btn ${tipoFiltro === k ? 'segment__btn--active' : ''}`}
                  onClick={() => setTipoFiltro(k)}>
                  {l}
                  {cnt > 0 && <span style={{ marginLeft: 4, fontSize: 'var(--fs-xs)', opacity: 0.75 }}>({cnt})</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo / Referencia</th>
                <th>N.° Análisis</th>
                <th style={{ textAlign: 'right' }}>T. Húm.</th>
                <th style={{ textAlign: 'right' }}>Seco (t)</th>
                <th style={{ textAlign: 'right' }}>Au conc. (g)</th>
                <th style={{ textAlign: 'right' }}>Ag conc. (g)</th>
                <th style={{ textAlign: 'right' }}>Au gr/t</th>
                <th style={{ textAlign: 'right' }}>Ag gr/t</th>
                <th>Fecha salida</th>
                <th>Estado pago</th>
                <th style={{ maxWidth: '10rem' }}>Comentarios</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 12 : 11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map(a => {
                const matRef  = a.id_entrada != null ? materialesList.find(m => m.id === a.id_entrada) : null
                const loteRef = a.id_material_concentrado != null ? lotesConc.find(l => l.id === a.id_material_concentrado) : null
                const tipoBadge = a.id_material_concentrado != null
                  ? { label: 'Concentrado', style: { background: '#d1fae5', color: '#065f46' } }
                  : a.tipo === 'sulfuros'
                  ? { label: 'Sulfuros',    style: { background: '#d1fae5', color: '#065f46' } }
                  : a.tipo === 'colas'
                  ? { label: 'Colas',       style: { background: '#ffe4e6', color: '#9f1239' } }
                  : { label: 'Cabeza',      style: { background: '#e0f2fe', color: '#0c4a6e' } }
                const ref = loteRef?.codigo ?? (matRef ? `${matRef.mina} #${matRef.numero_volqueta}` : null)
                return (
                  <tr key={a.id}>
                    <td>
                      <span className="badge" style={{ ...tipoBadge.style, fontWeight: 700 }}>{tipoBadge.label}</span>
                      {ref && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{ref}</div>}
                      {matRef && <div style={{ fontSize: '0.6rem', color: 'var(--text-faint)' }}>{fmtDMY(matRef.fecha)}</div>}
                    </td>
                    <td style={{ fontWeight: 700 }} className="mono">{a.numero_analisis}</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {(a.toneladas_humedas ?? a.ton) != null
                        ? <>{(a.toneladas_humedas ?? a.ton)!.toFixed(3)}<div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{(a.porcentaje_humedad * 100).toFixed(1)}% hum.</div></>
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">{a.toneladas_secas?.toFixed(4) ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-800)' }} className="mono">
                      {a.au_concentrado != null ? a.au_concentrado.toFixed(2) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {a.ag_concentrado != null ? a.ag_concentrado.toFixed(1) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--amber-700)' }} className="mono">{a.au_gr_x_ton.toFixed(1)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{a.ag_gr_x_ton?.toFixed(0) ?? '—'}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', fontWeight: a.fecha_salida ? 600 : 400, color: a.fecha_salida ? 'var(--text)' : 'var(--text-faint)' }}>
                      {fmtDMY(a.fecha_salida)}
                    </td>
                    <td>
                      <span className={`badge badge--${a.estado_pago === 'pagado' ? 'success' : a.estado_pago === 'pendiente' ? 'warning' : 'neutral'}`}>
                        {a.estado_pago === 'pagado' ? 'Pagado' : a.estado_pago === 'pendiente' ? 'Pendiente' : 'N/A'}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.comentarios ?? '—'}
                    </td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(a)} />
                          <Button variant="ghost"     size="sm" icon={<Trash2  size={14}/>} onClick={() => del(a.id)} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalTon.toFixed(2)} t</td>
                <td colSpan={canWrite ? 9 : 8} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Modal editar ── */}
      <Modal open={!!editA} title={`Editar análisis — ${editA?.numero_analisis ?? ''}`}
        onClose={() => setEditA(null)}
        footer={<><Button variant="secondary" onClick={() => setEditA(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        {editA && (() => {
          const humPct = Number(fp.porcentaje_humedad) || 0
          const tonHum = editA.ton ?? editA.toneladas_humedas ?? 0
          const tonSec = tonHum * (1 - humPct / 100)
          const auConc = Number(fp.au_concentrado) || 0
          const agConc = Number(fp.ag_concentrado) || 0
          const auGrT  = tonSec > 0 && auConc > 0 ? auConc / tonSec : null
          const agGrT  = tonSec > 0 && agConc > 0 ? agConc / tonSec : null
          return (
            <>
              {editA.id_entrada != null && (
                <div className="callout" style={{ marginBottom: '0.75rem' }}>
                  Tipo: <strong>Cabeza (planta)</strong> · Toneladas: <strong>{tonHum.toFixed(3)} t húm.</strong>
                </div>
              )}
              {editA.id_material_concentrado != null && (
                <div className="callout" style={{ marginBottom: '0.75rem' }}>
                  Tipo: <strong>Concentrado</strong> · {lotesConc.find(l => l.id === editA.id_material_concentrado)?.codigo ?? `Lote #${editA.id_material_concentrado}`}
                </div>
              )}
              <div className="grid grid--form">
                <Input label="N.° Análisis" value={fp.numero_analisis} onChange={e => f('numero_analisis', e.target.value)} />
                <Input label="Humedad (%)" type="number" step="0.01" placeholder="Ej: 5.9" helper="Ej: 5.9 para 5.9%"
                  value={fp.porcentaje_humedad} onChange={e => f('porcentaje_humedad', e.target.value)} />
                <Input label="Au total (gramos)" type="number" step="0.1" required placeholder="Ej: 245.5 g"
                  value={fp.au_concentrado} onChange={e => f('au_concentrado', e.target.value)}
                  helper={auGrT ? `→ ${auGrT.toFixed(2)} Au gr/t (real)` : undefined} />
                <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
                  value={fp.ag_concentrado} onChange={e => f('ag_concentrado', e.target.value)}
                  helper={agGrT ? `→ ${agGrT.toFixed(1)} Ag gr/t` : undefined} />
                <Input label="Au falso (tenor para pago)" type="number" step="0.1" required placeholder="Ej: 4.5 gr/t"
                  value={fp.au_falso} onChange={e => f('au_falso', e.target.value)}
                  helper="Tenor que se reporta al minero y genera el pago" />
                <Input label="Fecha de salida" type="date"
                  value={fp.fecha_salida} onChange={e => f('fecha_salida', e.target.value)} />
                <Select label="Estado de pago" options={ESTADO_PAGO_OPTS} value={fp.estado_pago}
                  onChange={e => f('estado_pago', e.target.value as typeof fp.estado_pago)} />
                <Input label="Comentarios" value={fp.comentarios} onChange={e => f('comentarios', e.target.value)} style={{ gridColumn: '1/-1' }} />
              </div>
              {auGrT && (
                <div className="callout" style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                  Au real: <strong>{auGrT.toFixed(2)} gr/t</strong>
                  {fp.au_falso && <> · Au falso (pago): <strong style={{ color: 'var(--amber-700)' }}>{Number(fp.au_falso).toFixed(1)} gr/t</strong></>}
                  {agGrT && <> · Ag: <strong>{agGrT.toFixed(1)} gr/t</strong></>}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (toneladas secas: {tonSec.toFixed(4)} t)
                  </span>
                </div>
              )}
            </>
          )
        })()}
      </Modal>

      {/* ── Modal nuevo análisis ── */}
      <Modal open={nuevoOpen} title="Nuevo análisis"
        onClose={() => setNuevoOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
          <Button onClick={guardarNuevo} disabled={disabled_guardar}>Guardar análisis</Button>
        </>}>

        {/* Tabs */}
        <div className="segment" role="tablist" style={{ marginBottom: '1rem' }}>
          <button role="tab" aria-selected={nuevoTab === 'sin_analisis'}
            className={`segment__btn ${nuevoTab === 'sin_analisis' ? 'segment__btn--active' : ''}`}
            onClick={() => { setNuevoTab('sin_analisis'); setMatSel(null); setQMat('') }}>
            Sin análisis
            {sinAnalisis.length > 0 && (
              <span style={{ marginLeft: '0.4rem', background: 'var(--rose-600)', color: '#fff', borderRadius: '1rem', padding: '0 0.4rem', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>
                {sinAnalisis.length}
              </span>
            )}
          </button>
          <button role="tab" aria-selected={nuevoTab === 'cabeza'}
            className={`segment__btn ${nuevoTab === 'cabeza' ? 'segment__btn--active' : ''}`}
            onClick={() => { setNuevoTab('cabeza'); setMatSel(null); setQMat('') }}>
            Material (Cabeza)
          </button>
          <button role="tab" aria-selected={nuevoTab === 'concentrado'}
            className={`segment__btn ${nuevoTab === 'concentrado' ? 'segment__btn--active' : ''}`}
            onClick={() => { setNuevoTab('concentrado'); setLoteSel(null); setQLote('') }}>
            Concentrado
          </button>
        </div>

        {/* Tab: Sin análisis */}
        {nuevoTab === 'sin_analisis' && (
          <>
            {sinAnalisis.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                Todos los materiales ya tienen análisis asignado.
              </p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '14rem', marginBottom: '0.75rem' }}>
                <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr><th>N.° Vol.</th><th>Mina/Minero</th><th>Fecha</th><th style={{textAlign:'right'}}>T. Húm.</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {sinAnalisis.map(m => (
                      <tr key={m.id} style={{ cursor: 'pointer', ...(matSel?.id === m.id ? { background: 'var(--green-50)' } : {}) }}
                        onClick={() => {
                          setMatSel(m)
                          setNuevoTab('cabeza')
                          setFpN(f2 => ({ ...f2, porcentaje_humedad: m.porcentaje_humedad > 0 ? String((m.porcentaje_humedad * 100).toFixed(1)) : '' }))
                        }}>
                        <td className="mono">{m.numero_volqueta}</td>
                        <td style={{ fontWeight: 600 }}>{m.mina}</td>
                        <td>{formatDate(m.fecha)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                        <td><span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>{m.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              Haz click en un material para seleccionarlo y completar el análisis.
            </p>
          </>
        )}

        {/* Tab: Cabeza — buscar material */}
        {nuevoTab === 'cabeza' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <div className="segment" style={{ flexShrink: 0 }}>
                {([['mina', 'Mina/Minero'], ['volqueta', 'N.° Volqueta'], ['id', 'ID']] as [TipoBusqueda, string][]).map(([k, l]) => (
                  <button key={k} className={`segment__btn ${tipoBusqueda === k ? 'segment__btn--active' : ''}`}
                    onClick={() => { setTipoBusqueda(k); setQMat('') }}>
                    {l}
                  </button>
                ))}
              </div>
              <input className="field__input" placeholder={`Buscar por ${tipoBusqueda}…`}
                value={qMat} onChange={e => setQMat(e.target.value)}
                style={{ flex: 1, minWidth: '10rem' }} />
            </div>

            {matResultados.length > 0 && !matSel && (
              <div className="table-wrap" style={{ maxHeight: '12rem', marginBottom: '0.75rem' }}>
                <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                  <thead><tr><th>ID</th><th>N.° Vol.</th><th>Mina/Minero</th><th>Fecha</th><th style={{textAlign:'right'}}>T. Húm.</th><th style={{textAlign:'right'}}>T. Seco</th></tr></thead>
                  <tbody>
                    {matResultados.map(m => (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => {
                        setMatSel(m)
                        setFpN(f2 => ({ ...f2, porcentaje_humedad: m.porcentaje_humedad > 0 ? String((m.porcentaje_humedad * 100).toFixed(1)) : '' }))
                      }}>
                        <td className="mono" style={{ color: 'var(--text-muted)' }}>{m.id}</td>
                        <td className="mono">{m.numero_volqueta}</td>
                        <td style={{ fontWeight: 600 }}>{m.mina}</td>
                        <td>{formatDate(m.fecha)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                        <td style={{ textAlign: 'right' }} className="mono">{m.total_material_seco > 0 ? `${m.total_material_seco.toFixed(4)} t` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {matSel && (
              <div className="callout" style={{ marginBottom: '0.75rem' }}>
                <strong>Seleccionado:</strong> N.° {matSel.numero_volqueta} · {matSel.mina} · {formatDate(matSel.fecha)}
                {' · '}{matSel.peso_llegada_planta.toFixed(3)} t húm.
                <Button size="sm" variant="ghost" onClick={() => { setMatSel(null); setQMat('') }}
                  style={{ marginLeft: '0.5rem', fontSize: 'var(--fs-xs)' }}>Cambiar</Button>
              </div>
            )}

            {qMat && matResultados.length === 0 && !matSel && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: '0.75rem' }}>Sin resultados.</p>
            )}
          </>
        )}

        {/* Tab: Concentrado — buscar lote */}
        {nuevoTab === 'concentrado' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <input className="field__input" placeholder="Buscar por código o ID de lote…"
                value={qLote} onChange={e => setQLote(e.target.value)} style={{ flex: 1 }} />
            </div>

            {loteResultados.length > 0 && !loteSel && (
              <div className="table-wrap" style={{ maxHeight: '10rem', marginBottom: '0.75rem' }}>
                <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                  <thead><tr><th>Código</th><th>Estado</th><th style={{textAlign:'right'}}>T. Húm.</th><th>Canoa</th></tr></thead>
                  <tbody>
                    {loteResultados.map(l => (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setLoteSel(l)}>
                        <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                        <td><span className={`badge badge--${l.estado === 'en_canoa' ? 'info' : 'neutral'}`}>{l.estado}</span></td>
                        <td style={{ textAlign: 'right' }} className="mono">{l.toneladas_humedo.toFixed(2)} t</td>
                        <td style={{ fontSize: 'var(--fs-xs)' }}>{l.ubicacion_canoa ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {loteSel && (
              <div className="callout" style={{ marginBottom: '0.75rem' }}>
                <strong>Seleccionado:</strong> {loteSel.codigo}
                {' · '}{loteSel.toneladas_humedo.toFixed(2)} t húm. · Canoa: {loteSel.ubicacion_canoa ?? '—'}
                <Button size="sm" variant="ghost" onClick={() => { setLoteSel(null); setQLote('') }}
                  style={{ marginLeft: '0.5rem', fontSize: 'var(--fs-xs)' }}>Cambiar</Button>
              </div>
            )}

            {qLote && loteResultados.length === 0 && !loteSel && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: '0.75rem' }}>Sin resultados.</p>
            )}
          </>
        )}

        {/* Campos del análisis — comunes */}
        {(matSel || loteSel) && (
          <div className="grid grid--form" style={{ marginTop: '0.75rem' }}>
            <Input label="N.° análisis laboratorio" placeholder="AN-LAB-001"
              value={fpN.numero_analisis} onChange={e => fn('numero_analisis', e.target.value)} />
            <Input label="Humedad (%)" type="number" step="0.1" placeholder="Ej: 5.9"
              value={fpN.porcentaje_humedad} onChange={e => fn('porcentaje_humedad', e.target.value)}
              helper="Ej: 5.9 para 5.9%" />
            <Input label="Au total (gramos)" type="number" step="0.1" required placeholder="Ej: 245.5 g"
              value={fpN.au_concentrado} onChange={e => fn('au_concentrado', e.target.value)}
              helper={preview.auGrT ? `→ ${preview.auGrT.toFixed(2)} Au gr/t (real)` : undefined} />
            <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
              value={fpN.ag_concentrado} onChange={e => fn('ag_concentrado', e.target.value)}
              helper={preview.agGrT ? `→ ${preview.agGrT.toFixed(1)} Ag gr/t` : undefined} />
            <Input label="Au falso (tenor para pago)" type="number" step="0.1" required placeholder="Ej: 4.5 gr/t"
              value={fpN.au_falso} onChange={e => fn('au_falso', e.target.value)}
              helper="Tenor que se reporta al minero y genera el pago" />
            <Input label="Fecha de salida" type="date"
              value={fpN.fecha_salida} onChange={e => fn('fecha_salida', e.target.value)} />
            <Select label="Estado de pago" options={ESTADO_PAGO_OPTS} value={fpN.estado_pago}
              onChange={e => fn('estado_pago', e.target.value as typeof fpN.estado_pago)} />
          </div>
        )}

        {/* Preview en tiempo real */}
        {fpN.au_concentrado && (matSel || loteSel) && (
          <div className="callout" style={{ marginTop: '0.75rem' }}>
            {preview.tonSec > 0 && (
              <>
                Ton. secas: <strong>{preview.tonSec.toFixed(4)} t</strong>
                {preview.tonHum != null && preview.tonHum > 0 && <> ({Number(fpN.porcentaje_humedad) || 0}% hum)</>}
                {' · '}
              </>
            )}
            {preview.auGrT != null && (
              <>Au gr/t real: <strong>{preview.auGrT.toFixed(2)} gr/t</strong></>
            )}
            {fpN.au_falso && (
              <> · <strong>Au falso (pago): <span style={{ color: 'var(--amber-700)' }}>{Number(fpN.au_falso).toFixed(1)} gr/t</span></strong></>
            )}
            {preview.agGrT != null && (
              <> · Ag gr/t: <strong>{preview.agGrT.toFixed(1)} gr/t</strong></>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
