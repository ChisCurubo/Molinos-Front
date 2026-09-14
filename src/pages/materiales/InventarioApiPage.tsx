import { Fragment, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight, Package, Layers, RefreshCw } from 'lucide-react'
import { Button, Card, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { apiError } from '@/api/client'
import { formatCOP } from '@/utils/format'
import {
  materialApi, num,
  type InvCrudoRow, type InvConcentradoRow, type EntradaRow, type InventarioResumen,
  type InventarioLoteResumen,
} from '@/api/material'

const cop = formatCOP

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}
const g = (n: number | null, d = 1) => (n != null && n > 0 ? `${n.toFixed(d)} g/t` : '—')

export function InventarioApiPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'material' | 'concentrado'>('material')

  const [crudo, setCrudo] = useState<InvCrudoRow[]>([])
  const [concentrado, setConcentrado] = useState<InvConcentradoRow[]>([])
  const [resumen, setResumen] = useState<InventarioResumen | null>(null)
  const [entradaMap, setEntradaMap] = useState<Record<number, EntradaRow>>({})
  const [minasMap, setMinasMap] = useState<Record<number, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fila de concentrado expandida → resumen de inventario del lote (endpoint /inventario/lote/:id).
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loteResumen, setLoteResumen] = useState<Record<number, InventarioLoteResumen | null>>({})

  const toggleExpand = async (id: number) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    if (loteResumen[id] === undefined) {
      try {
        const r = await materialApi.getInventarioLote(id)
        setLoteResumen(prev => ({ ...prev, [id]: r }))
      } catch {
        setLoteResumen(prev => ({ ...prev, [id]: null }))
      }
    }
  }

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getInventarioResumen().then(setResumen).catch(() => setResumen(null))
    Promise.all([
      materialApi.getInventarioCrudo(),
      materialApi.getInventarioConcentrado(),
      materialApi.getEntradas({ limit: 2000 }).catch(() => [] as EntradaRow[]),
    ])
      .then(async ([c, k, ents]) => {
        setCrudo(c); setConcentrado(k)
        const em: Record<number, EntradaRow> = {}
        for (const e of ents) em[e.id] = e
        setEntradaMap(em)
        // Minas de origen por lote: del detalle si el backend no las manda en la fila.
        const necesitaDetalle = k.filter(l => l.minas == null)
        if (necesitaDetalle.length) {
          const detalles = await Promise.all(necesitaDetalle.map(l =>
            materialApi.getConcentrado(l.id)
              .then(d => [l.id, d.materiales.map(m => m.mina).filter(Boolean) as string[]] as const)
              .catch(() => [l.id, [] as string[]] as const)))
          const mm: Record<number, string[]> = {}
          for (const [id, minas] of detalles) mm[id] = [...new Set(minas)]
          setMinasMap(mm)
        }
      })
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // ── Derivados por fila (usan campo del backend si existe, si no fallback) ──
  const crAuReal   = (m: InvCrudoRow) => num(m.au_real ?? m.tenor)
  const crAgReal   = (m: InvCrudoRow) => (m.ag_real != null ? num(m.ag_real) : null)
  const crFalso    = (m: InvCrudoRow) => (m.tenor_falso != null ? num(m.tenor_falso) : null)
  const crPagado   = (m: InvCrudoRow) => num(m.pagado_material ?? entradaMap[m.id_entrada]?.total_material)
  const kMinas     = (l: InvConcentradoRow): string[] =>
    Array.isArray(l.minas) ? l.minas
    : typeof l.minas === 'string' ? l.minas.split(',').map(s => s.trim()).filter(Boolean)
    : (minasMap[l.id] ?? [])

  const totalCrudoHum = crudo.reduce((s, m) => s + num(m.toneladas_humedo), 0)
  const totalCrudoSec = crudo.reduce((s, m) => s + num(m.total_material_seco), 0)
  const totalCrudoPag = crudo.reduce((s, m) => s + crPagado(m), 0)
  const totalConcHum  = concentrado.reduce((s, l) => s + num(l.toneladas_disponibles), 0)

  // KPIs desde el endpoint /material/inventario/resumen, con fallback a lo calculado en el front.
  const kEntradasSinLote = resumen?.entradas_sin_lote ?? crudo.length
  const kCrudoHum        = resumen ? num(resumen.crudo_humedo_total) : totalCrudoHum
  const kLotesEnCanoa    = resumen?.lotes_en_canoa ?? concentrado.length
  const kConcHumDisp     = resumen ? num(resumen.concentrado_humedo_disponible) : totalConcHum
  const kMaquilaTotal    = resumen ? num(resumen.concentrado_maquila_total) : concentrado.reduce((s, l) => s + num(l.maquila_total), 0)

  return (
    <div className="page">
      <PageHeader
        title="Inventario"
        subtitle="Material crudo disponible y concentrado en canoa listo para despacho."
        actions={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>}
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Entradas sin lote"     value={kEntradasSinLote}                 accent="amber"   />
        <KpiTile label="T. húm. crudo"         value={`${kCrudoHum.toFixed(2)} t`}       accent="brown"   />
        <KpiTile label="Lotes en canoa"        value={kLotesEnCanoa}                    accent="green"   />
        <KpiTile label="Conc. húm. disponible" value={`${kConcHumDisp.toFixed(2)} t`}    accent="emerald" />
        <KpiTile label="Maquila concentrado"   value={cop(kMaquilaTotal)}               accent="brown"   />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'material'}
          className={`segment__btn ${tab === 'material' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('material')}>
          <Package size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Material crudo ({crudo.length})
        </button>
        <button role="tab" aria-selected={tab === 'concentrado'}
          className={`segment__btn ${tab === 'concentrado' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('concentrado')}>
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Concentrado ({concentrado.length})
        </button>
      </div>

      {error && (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>
          {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
        </p></Card>
      )}

      {!error && tab === 'material' && (
        <Card
          title={`Material crudo pendiente (${crudo.length})`}
          actions={
            <Button size="sm" variant="secondary" icon={<Layers size={14}/>}
              onClick={() => navigate('/materiales/procesamiento-api')}>
              Ir a Procesamiento
              <ArrowRight size={13} style={{ marginLeft: 4 }} />
            </Button>
          }>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Cargando…</p>
          ) : crudo.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No hay material crudo pendiente de procesar.
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vol.</th><th>Mina</th><th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>T. Húm.</th>
                      <th style={{ textAlign: 'right' }}>T. Seco</th>
                      <th style={{ textAlign: 'right' }}>Au real</th>
                      <th style={{ textAlign: 'right' }}>Ag real</th>
                      <th style={{ textAlign: 'right' }}>Tenor falso</th>
                      <th style={{ textAlign: 'right' }}>Pagado material</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crudo.map(m => {
                      const pag = crPagado(m)
                      return (
                        <tr key={m.id_entrada}>
                          <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                          <td style={{ fontWeight: 600 }}>{m.mina ?? '—'}</td>
                          <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha_llegada)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{num(m.toneladas_humedo).toFixed(3)} t</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{num(m.total_material_seco).toFixed(4)} t</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{g(crAuReal(m), 2)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{g(crAgReal(m), 0)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{g(crFalso(m), 2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{pag > 0 ? cop(pag) : '—'}</td>
                          <td><span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>{m.estado}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={3}>Total ({crudo.length})</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalCrudoHum.toFixed(3)} t</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalCrudoSec.toFixed(4)} t</td>
                      <td colSpan={3} />
                      <td style={{ textAlign: 'right' }} className="mono">{totalCrudoPag > 0 ? cop(totalCrudoPag) : '—'}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <strong>Au real</strong> = tenor del análisis · <strong>Pagado material</strong> = valor pagado por la entrada.
                El <strong>Ag real</strong> y el <strong>tenor falso</strong> aparecen cuando el backend los incluya en el inventario (el análisis de cabeza hoy es solo Au).
              </p>
            </>
          )}
        </Card>
      )}

      {!error && tab === 'concentrado' && (
        <Card
          title={`Concentrado disponible (${concentrado.length} lotes)`}
          actions={
            <Button size="sm" icon={<Package size={14}/>}
              onClick={() => navigate('/materiales/viajes-material-api')}>
              Crear viaje
              <ArrowRight size={13} style={{ marginLeft: 4 }} />
            </Button>
          }>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Cargando…</p>
          ) : concentrado.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No hay concentrado disponible en canoa.
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '1.5rem' }}></th>
                      <th>Código</th><th>Canoa</th><th>Mina(s) de origen</th>
                      <th style={{ textAlign: 'right' }}>T. Húm. Disp.</th>
                      <th style={{ textAlign: 'right' }}>Au real</th>
                      <th style={{ textAlign: 'right' }}>Ag real</th>
                      <th style={{ textAlign: 'right' }}>Pagado material</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concentrado.map(l => {
                      const disp = num(l.toneladas_disponibles)
                      const pag = l.pagado_material != null ? num(l.pagado_material) : null
                      const minas = kMinas(l)
                      const isExp = expanded.has(l.id)
                      const res = loteResumen[l.id]
                      return (
                        <Fragment key={l.id}>
                        <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }} onClick={() => toggleExpand(l.id)}>
                          <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                          <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                          <td style={{ fontSize: 'var(--fs-sm)' }}>{l.ubicacion_canoa ?? '—'}</td>
                          <td style={{ fontSize: 'var(--fs-xs)' }}>
                            {minas.length === 0 ? <span style={{ color: 'var(--text-faint)' }}>{loading ? '…' : '—'}</span>
                              : <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{minas.map(mn => <span key={mn} className="badge badge--neutral" style={{ fontSize: '0.6rem' }}>{mn}</span>)}</div>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{disp.toFixed(2)} t</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{g(l.tenor_au != null ? num(l.tenor_au) : null, 2)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{g(l.tenor_ag != null ? num(l.tenor_ag) : null, 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{pag != null && pag > 0 ? cop(pag) : '—'}</td>
                          <td>
                            <span className={`badge ${
                              l.estado === 'en_canoa' ? 'badge--info'
                              : l.estado === 'parcialmente_enviado' ? 'badge--warning'
                              : 'badge--neutral'
                            }`}>
                              {l.estado === 'en_canoa' ? 'En canoa'
                                : l.estado === 'parcialmente_enviado' ? 'Parcial'
                                : l.estado}
                            </span>
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ background: 'var(--slate-50)' }}>
                            <td colSpan={9} style={{ padding: '0.75rem 1rem 1rem 2rem' }}>
                              {res === undefined ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>Cargando inventario del lote…</p>
                              ) : res === null ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', margin: 0 }}>No se pudo cargar el inventario de este lote.</p>
                              ) : (
                                <div className="callout" style={{ fontSize: 'var(--fs-sm)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: 0 }}>
                                  <span>Materiales procesados: <strong>{res.num_materiales}</strong></span>
                                  <span>Total seco procesado: <strong>{num(res.total_seco_procesado).toFixed(4)} t</strong></span>
                                  <span>Inventario disponible: <strong style={{ color: 'var(--emerald-700)' }}>{num(res.inventario_disponible).toFixed(2)} t</strong></span>
                                  <span>Estado inventario: <strong style={{ textTransform: 'capitalize' }}>{res.inventario_estado}</strong></span>
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
                      <td colSpan={4}>Total ({concentrado.length})</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalConcHum.toFixed(2)} t</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <strong>Au/Ag real</strong> = tenor del análisis del lote · <strong>Mina(s)</strong> = orígenes del material que compone el lote.
                El <strong>pagado del material</strong> aparece cuando el backend lo agregue al inventario de concentrado.
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
