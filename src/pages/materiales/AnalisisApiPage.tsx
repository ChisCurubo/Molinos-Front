import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { AnalisisCabezaModal, EditAnalisisModal } from '@/components/materiales/analisisModals'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { useEntradas, getAnalisisDeEntradaCached, invalidateAnalisisCache, invalidateEntradas } from '@/hooks/useEntradas'
import { apiError } from '@/api/client'
import { materialApi, num, type EntradaRow, type AnalisisResumen, type LoteConcentradoRow } from '@/api/material'

const CODE_MSG: Record<string, string> = {
  ANALISIS_NO_ELIMINABLE: 'No se puede borrar: la entrada ya está en viaje o pagada.',
}

type TipoFiltro = 'todos' | 'cabeza' | 'concentrado'

// Análisis + referencia a su entrada (para mostrar mina / N° volqueta / fecha)
type AnalisisConEntrada = AnalisisResumen & { _entrada: EntradaRow }

// Vista unificada de una fila de análisis (cabeza de entrada o de un lote de concentrado).
interface AnalisisView {
  key: string
  kind: 'cabeza' | 'concentrado'
  tipoLabel: string
  ref: string
  refSub: string | null
  numero: string
  humedadPct: number | null
  seco: number | null
  auTotal: number | null
  tenorReal: number | null
  tenorFalso: number | null
  estadoPago: string | null
  cabezaId?: number
}

function fmtDMY(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function AnalisisApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  // Entradas desde la caché compartida (no se vuelven a pedir si ya se cargaron).
  const { data: entradas, loading: entradasLoading, error: entradasError, reload: reloadEntradas } = useEntradas()
  const [rows, setRows] = useState<AnalisisConEntrada[]>([])
  const [aggLoading, setAggLoading] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')

  // Análisis de concentrado: se derivan de los lotes (cada lote con análisis trae su tenor).
  const [lotesConc, setLotesConc] = useState<LoteConcentradoRow[]>([])
  useEffect(() => {
    materialApi.getConcentradoLotes()
      .then(ls => setLotesConc(ls.filter(l => l.au_gr_x_ton != null || l.numero_analisis != null)))
      .catch(() => setLotesConc([]))
  }, [])

  const [analisisEntrada, setAnalisisEntrada] = useState<number | null>(null)
  const [editAnalisis, setEditAnalisis] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Agrega los análisis de las entradas que tienen cabeza (con caché por entrada).
  useEffect(() => {
    let cancel = false
    const conAnalisis = entradas.filter(e => num(e.tiene_analisis_cabeza))
    if (conAnalisis.length === 0) { setRows([]); return }
    setAggLoading(true)
    Promise.all(conAnalisis.map(e =>
      getAnalisisDeEntradaCached(e.id).then(as => as.map(a => ({ ...a, _entrada: e })))
    )).then(listas => { if (!cancel) setRows(listas.flat()) })
      .finally(() => { if (!cancel) setAggLoading(false) })
    return () => { cancel = true }
  }, [entradas])

  const loading = entradasLoading || aggLoading
  const error = entradasError
  // Recarga todo (entradas + análisis) invalidando la caché.
  const refresh = () => { invalidateAnalisisCache(); invalidateEntradas(); reloadEntradas() }

  // Vistas de cabeza (desde entradas) y de concentrado (desde lotes).
  const vistaCabeza = useMemo<AnalisisView[]>(() => rows.map(a => {
    const h = num(a.porcentaje_humedad)
    return {
      key: `c-${a.id}`, kind: 'cabeza', tipoLabel: a.tipo_analisis || 'Cabeza',
      ref: `${a._entrada.mina ?? '—'} · N° ${a._entrada.numero_volqueta}`,
      refSub: fmtDMY(a._entrada.fecha_llegada),
      numero: a.numero_analisis,
      humedadPct: h <= 1 ? h * 100 : h,
      seco: a.toneladas_secas != null ? num(a.toneladas_secas) : null,
      auTotal: a.au_gramos_totales != null ? num(a.au_gramos_totales) : null,
      tenorReal: a.tenor_real != null ? num(a.tenor_real) : null,
      tenorFalso: a.tenor_falso != null ? num(a.tenor_falso) : null,
      estadoPago: a.estado_pago,
      cabezaId: a.id,
    }
  }), [rows])

  const vistaConcentrado = useMemo<AnalisisView[]>(() => lotesConc.map(l => ({
    key: `l-${l.id}`, kind: 'concentrado', tipoLabel: 'Concentrado',
    ref: l.codigo, refSub: fmtDMY(l.fecha_fin ?? l.fecha_inicio),
    numero: l.numero_analisis ?? '—',
    humedadPct: l.porcentaje_humedad != null ? num(l.porcentaje_humedad) * 100 : null,
    seco: l.toneladas_seco != null ? num(l.toneladas_seco) : null,
    auTotal: l.au_concentrado != null ? num(l.au_concentrado) : null,
    tenorReal: l.au_gr_x_ton != null ? num(l.au_gr_x_ton) : null,
    tenorFalso: null, estadoPago: null,
  })), [lotesConc])

  const filtrados = useMemo(() => {
    const base = tipoFiltro === 'cabeza' ? vistaCabeza
      : tipoFiltro === 'concentrado' ? vistaConcentrado
      : [...vistaCabeza, ...vistaConcentrado]
    if (!busqueda) return base
    const q = busqueda.toUpperCase()
    return base.filter(v => v.numero.toUpperCase().includes(q) || v.ref.toUpperCase().includes(q))
  }, [tipoFiltro, vistaCabeza, vistaConcentrado, busqueda])

  const conTenor = filtrados.filter(v => v.tenorReal != null)
  const avgTenor = conTenor.length ? conTenor.reduce((s, v) => s + (v.tenorReal ?? 0), 0) / conTenor.length : 0
  const totalAu = filtrados.reduce((s, v) => s + (v.auTotal ?? 0), 0)
  const sinAnalisis = entradas.filter(e => !num(e.tiene_analisis_cabeza))

  const confirmDelete = async () => {
    if (delId == null) return
    setDeleting(true)
    try { await materialApi.deleteAnalisis(delId); toast.success('Análisis borrado'); setDelId(null); refresh() }
    catch (e) { const { code, message } = apiError(e); toast.error(code ? (CODE_MSG[code] ?? message) : message); setDelId(null) }
    finally { setDeleting(false) }
  }

  const cols = canWrite ? 9 : 8

  return (
    <div className="page">
      <PageHeader title="Análisis y laboratorio" subtitle="Análisis de cabeza (material) y de concentrado (lotes) registrados en el backend." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Análisis registrados" value={filtrados.length} icon={<FlaskConical size={16} />} accent="brown" />
        <KpiTile label="Entradas sin análisis" value={sinAnalisis.length} accent="rose" />
        <KpiTile label="Au total (g)" value={totalAu.toFixed(1)} accent="emerald" />
        <KpiTile label="Tenor Au prom." value={`${avgTenor.toFixed(1)} gr/t`} accent="amber" />
      </div>

      <Card title={`Análisis (${filtrados.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={15} />} onClick={() => setPickerOpen(true)}>Nuevo análisis</Button>}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por N.° análisis, mina, N.° volqueta o lote…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '22rem' }} />
          <div className="segment">
            {([['todos', 'Todos'], ['cabeza', 'Cabeza'], ['concentrado', 'Concentrado']] as [TipoFiltro, string][]).map(([k, l]) => {
              const cnt = k === 'todos' ? vistaCabeza.length + vistaConcentrado.length
                : k === 'cabeza' ? vistaCabeza.length : vistaConcentrado.length
              return (
                <button key={k} className={`segment__btn ${tipoFiltro === k ? 'segment__btn--active' : ''}`} onClick={() => setTipoFiltro(k)}>
                  {l}{cnt > 0 && <span style={{ marginLeft: 4, fontSize: 'var(--fs-xs)', opacity: 0.75 }}>({cnt})</span>}
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
                <th style={{ textAlign: 'right' }}>Humedad</th>
                <th style={{ textAlign: 'right' }}>Seco (t)</th>
                <th style={{ textAlign: 'right' }}>Au total (g)</th>
                <th style={{ textAlign: 'right' }}>Tenor real</th>
                <th style={{ textAlign: 'right' }}>Tenor falso</th>
                <th>Estado pago</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              : error ? <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>{error} · <button onClick={refresh} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></td></tr>
              : filtrados.length === 0 ? <tr><td colSpan={cols} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              : filtrados.map(v => {
                const badgeStyle = v.kind === 'concentrado'
                  ? { background: '#d1fae5', color: '#065f46' }
                  : { background: '#e0f2fe', color: '#0c4a6e' }
                return (
                  <tr key={v.key}>
                    <td>
                      <span className="badge" style={{ ...badgeStyle, fontWeight: 700, textTransform: 'capitalize' }}>{v.tipoLabel}</span>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{v.ref}</div>
                      {v.refSub && <div style={{ fontSize: '0.6rem', color: 'var(--text-faint)' }}>{v.refSub}</div>}
                    </td>
                    <td style={{ fontWeight: 700 }} className="mono">{v.numero}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{v.humedadPct != null ? `${v.humedadPct.toFixed(1)}%` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">{v.seco != null ? v.seco.toFixed(4) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-800)' }} className="mono">{v.auTotal != null ? v.auTotal.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--amber-700)' }} className="mono">{v.tenorReal != null ? v.tenorReal.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{v.tenorFalso != null ? v.tenorFalso.toFixed(2) : '—'}</td>
                    <td>{v.estadoPago != null
                      ? <span className={`badge badge--${v.estadoPago === 'pagado' ? 'success' : v.estadoPago === 'pendiente' ? 'warning' : 'neutral'}`}>{v.estadoPago === 'pagado' ? 'Pagado' : v.estadoPago === 'pendiente' ? 'Pendiente' : 'N/A'}</span>
                      : <span className="badge badge--neutral">N/A</span>}</td>
                    {canWrite && (
                      <td>
                        {v.kind === 'cabeza' && v.cabezaId != null && (
                          <div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditAnalisis(v.cabezaId!)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelId(v.cabezaId!)} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Picker: elegir entrada sin análisis para registrar cabeza */}
      <Modal open={pickerOpen} title="Elegir entrada para el análisis" onClose={() => setPickerOpen(false)}
        footer={<Button variant="secondary" onClick={() => setPickerOpen(false)}>Cerrar</Button>}>
        {sinAnalisis.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>Todas las entradas ya tienen análisis de cabeza.</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '18rem' }}>
            <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
              <thead><tr><th>N.° Vol.</th><th>Mina</th><th>Fecha</th><th style={{ textAlign: 'right' }}>T. Húm.</th></tr></thead>
              <tbody>
                {sinAnalisis.map(m => (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => { setPickerOpen(false); setAnalisisEntrada(m.id) }}>
                    <td className="mono">{m.numero_volqueta}</td>
                    <td style={{ fontWeight: 600 }}>{m.mina ?? '—'}</td>
                    <td>{fmtDMY(m.fecha_llegada)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{num(m.peso_llegada_planta).toFixed(3)} t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <AnalisisCabezaModal idEntrada={analisisEntrada} onClose={() => setAnalisisEntrada(null)} onSaved={refresh} />
      <EditAnalisisModal id={editAnalisis} onClose={() => setEditAnalisis(null)} onSaved={refresh} />
      <ConfirmDeleteModal open={delId != null} title="Borrar análisis" itemLabel="este análisis"
        loading={deleting} onCancel={() => setDelId(null)} onConfirm={confirmDelete} />
    </div>
  )
}
