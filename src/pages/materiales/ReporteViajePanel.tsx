import { useEffect, useMemo, useState } from 'react'
import { Check, Download, FileBarChart, AlertTriangle, Search } from 'lucide-react'
import { Button, Card, Input, KpiTile, Select, useToast } from '@/components/ui'
import { EmptyState } from '@/components/common/Page'
import { apiError } from '@/api/client'
import { materialApi, type ViajeMaterial } from '@/api/material'
import { reporteViajeApi, type ModoMaquila, type ReporteViajes, type Detallado } from '@/api/reporteViaje'
import { descargarReporteViajes } from '@/api/plantillasExcel'
import { cop } from '@/utils/format'
import './reporteViaje.css'

type Vista = 'inf' | 'costeo' | 'detallado'
const n = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }))
const dia = (s: string) => s.slice(0, 10)
const hoy = new Date()
const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
const rangoMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return { desde: `${ym}-01`, hasta: `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
}
const signo = (v: number) => (v < 0 ? 'num neg' : 'num')

export function ReporteViajePanel() {
  const toast = useToast()
  const [viajes, setViajes] = useState<ViajeMaterial[]>([])
  const [modo, setModo] = useState<'viajes' | 'mes'>('viajes')
  const [ids, setIds] = useState<number[]>([])
  const [buscar, setBuscar] = useState('')
  const [mes, setMes] = useState(mesActual)
  const [maquila, setMaquila] = useState<ModoMaquila>('proporcional')
  const [vista, setVista] = useState<Vista>('inf')
  const [rep, setRep] = useState<ReporteViajes | null>(null)
  const [cargando, setCargando] = useState(false)
  const [bajando, setBajando] = useState(false)

  useEffect(() => {
    materialApi.getViajesMaterial().then((v) => setViajes([...v].sort((a, b) => b.fecha.localeCompare(a.fecha)))).catch((e) => toast.error(apiError(e).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return q ? viajes.filter((v) => v.numero_viaje.toLowerCase().includes(q) || dia(v.fecha).includes(q)) : viajes
  }, [viajes, buscar])

  const generar = async () => {
    if (modo === 'viajes' && !ids.length) return toast.error('Selecciona al menos un viaje')
    setCargando(true)
    try {
      setRep(await reporteViajeApi.viajes({ ...(modo === 'viajes' ? { ids } : rangoMes(mes)), maquila, detallado: true }))
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setCargando(false)
    }
  }

  const descargar = async () => {
    if (modo === 'viajes' && !ids.length) return toast.error('Selecciona al menos un viaje')
    setBajando(true)
    try {
      await descargarReporteViajes({ ...(modo === 'viajes' ? { ids } : rangoMes(mes)), maquila })
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setBajando(false)
    }
  }

  const alternar = (id: number) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const k = rep?.consolidado.costeo
  const advertencias = rep?.viajes.flatMap((v) => v.advertencias.map((a) => `${v.viaje.numero_viaje}: ${a}`)) ?? []

  return (
    <div className="rv">
      <Card title="¿Qué viajes quieres reportar?">
        <div className="rv-pick">
          <div className="rv-pick__top">
            <div className="segment" role="tablist" aria-label="Tipo de selección">
              {([['viajes', 'Viajes puntuales'], ['mes', 'Un mes completo']] as const).map(([v, t]) => (
                <button key={v} role="tab" aria-selected={modo === v} className={`segment__btn ${modo === v ? 'segment__btn--active' : ''}`} onClick={() => setModo(v)}>{t}</button>
              ))}
            </div>
            {modo === 'mes' && <Input label="Mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />}
            <Select label="Maquila" value={maquila} onChange={(e) => setMaquila(e.target.value as ModoMaquila)}
              options={[{ value: 'proporcional', label: 'Proporcional al vendido' }, { value: 'guardada', label: 'Guardada' }]} />
            <span className="spacer" />
            <Button icon={<FileBarChart size={16} />} onClick={generar} disabled={cargando}>{cargando ? 'Generando…' : 'Generar reporte'}</Button>
            <Button variant="secondary" icon={<Download size={16} />} disabled={bajando} onClick={descargar}>{bajando ? 'Descargando…' : 'Descargar Excel'}</Button>
          </div>

          {modo === 'viajes' && (
            <div className="rv-list">
              <div className="rv-list__bar">
                <div className="rv-search"><Input label="Buscar viaje" icon={<Search size={16} />} placeholder="N° de viaje o fecha" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></div>
                <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                  <span className="rv-count" aria-live="polite">{ids.length} de {viajes.length} seleccionados</span>
                  <Button size="sm" variant="ghost" onClick={() => setIds((p) => [...new Set([...p, ...visibles.map((v) => v.id)])])}>Todos</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIds([])} disabled={!ids.length}>Limpiar</Button>
                </div>
              </div>
              <div className="rv-chips" role="group" aria-label="Viajes disponibles">
                {visibles.map((v) => (
                  <button key={v.id} type="button" className="rv-chip" aria-pressed={ids.includes(v.id)} onClick={() => alternar(v.id)}>
                    {ids.includes(v.id) && <Check size={14} aria-hidden="true" />}
                    <span>{v.numero_viaje}</span><small>{dia(v.fecha)}</small>
                  </button>
                ))}
                {!visibles.length && <span className="rv-count">Sin viajes que coincidan</span>}
              </div>
            </div>
          )}
        </div>
      </Card>

      {!rep ? (
        <EmptyState title="Elige viajes o un mes y pulsa «Generar reporte»" />
      ) : rep.total_viajes === 0 ? (
        <EmptyState title="No hay viajes en esa selección" />
      ) : (
        <>
          {advertencias.length > 0 && (
            <div className="rv-warn" role="alert">
              {advertencias.map((a, i) => <div key={i}><AlertTriangle size={16} aria-hidden="true" /><span>{a}</span></div>)}
            </div>
          )}

          {k && (
            <div className="rv-kpis">
              <KpiTile label="Viajes" value={rep.total_viajes} />
              <KpiTile label="Concentrado seco (t)" value={n(k.concentrado_t, 3)} accent="emerald" />
              <KpiTile label="Material con gastos" value={cop(k.valor_con_gastos)} />
              <KpiTile label="Maquila" value={cop(k.maquila)} accent="brown" />
              <KpiTile label="Total" value={cop(k.total)} accent="brown" />
              <KpiTile label="Gramos Au vendidos" value={n(k.gramos_au_venta)} hint={`Recuperación ${n(rep.consolidado.inf.conciliacion.pct_recuperacion_au, 1)} %`} accent="amber" />
            </div>
          )}

          <div className="segment" role="tablist" aria-label="Vista del reporte" style={{ justifySelf: 'start' }}>
            {(['inf', 'costeo', 'detallado'] as Vista[]).map((t) => (
              <button key={t} role="tab" aria-selected={vista === t} className={`segment__btn ${vista === t ? 'segment__btn--active' : ''}`} onClick={() => setVista(t)}>
                {t === 'inf' ? 'INF' : t === 'costeo' ? 'COSTEO' : 'DETALLADOS'}
              </button>
            ))}
          </div>

          <div className="rv-stack">
            {vista === 'inf' && rep.viajes.map((v) => (
              <Card key={v.viaje.id} title={`Viaje ${v.viaje.numero_viaje} · ${dia(v.viaje.fecha)}`}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Lote</th><th>N° análisis</th><th className="num">Au g/t</th><th className="num">Ag g/t</th><th className="num">Ton húmedas</th><th className="num">Humedad</th><th className="num">Ton secas</th><th className="num">Au g</th><th className="num">Ag g</th></tr></thead>
                    <tbody>
                      {v.inf.lotes.map((l) => (
                        <tr key={l.codigo_lote}>
                          <td>{l.codigo_lote}</td><td>{l.numero_analisis ?? '—'}</td><td className="num">{n(l.au_gr_t)}</td><td className="num">{n(l.ag_gr_t)}</td>
                          <td className="num">{n(l.ton_humedas, 3)}</td><td className="num">{n(l.humedad * 100, 1)} %</td><td className="num">{n(l.ton_secas, 3)}</td><td className="num">{n(l.gramos_au)}</td><td className="num">{n(l.gramos_ag)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th>Total / promedio</th><th></th><th className="num">{n(v.inf.promedio_ponderado.au_gr_t)}</th><th className="num">{n(v.inf.promedio_ponderado.ag_gr_t)}</th>
                        <th className="num">{n(v.inf.totales.ton_humedas, 3)}</th><th></th><th className="num">{n(v.inf.totales.ton_secas, 3)}</th><th className="num">{n(v.inf.totales.gramos_au)}</th><th className="num">{n(v.inf.totales.gramos_ag)}</th></tr>
                    </tfoot>
                  </table>
                </div>
                <p className="rv-note">
                  <span>Au comprado <b>{n(v.inf.conciliacion.gramos_au_comprados)} g</b></span>
                  <span>Salió <b>{n(v.inf.conciliacion.gramos_au_vendidos)} g</b></span>
                  <span>Merma <b>{n(v.inf.conciliacion.merma_au)} g</b></span>
                  <span>Recuperación <b>{n(v.inf.conciliacion.pct_recuperacion_au, 1)} %</b></span>
                  {v.inf.planta_vs_sgs?.sgs && <span>SGS <b>{n(v.inf.planta_vs_sgs.sgs.au)} g/t</b> (dif. {n(v.inf.planta_vs_sgs.diferencia?.au)})</span>}
                </p>
              </Card>
            ))}

            {vista === 'costeo' && rep.viajes.map((v) => (
              <Card key={v.viaje.id} title={`Viaje ${v.viaje.numero_viaje} · ${dia(v.viaje.fecha)}`}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Lote</th><th className="num">Material primario (t)</th><th className="num">Concentrado seco (t)</th><th className="num">Valor con gastos</th><th className="num">Excedente</th><th className="num">Au prom. compra</th><th className="num">Tenor Au venta</th><th className="num">Gramos Au</th><th className="num">Maquila</th><th className="num">Total</th></tr></thead>
                    <tbody>
                      {v.costeo.filas.map((f) => (
                        <tr key={f.codigo_lote}>
                          <td>{f.codigo_lote}</td><td className="num">{n(f.material_primario_t, 3)}</td><td className="num">{n(f.concentrado_t, 3)}</td><td className="num">{cop(f.valor_con_gastos)}</td><td className="num">{cop(f.excedente)}</td>
                          <td className="num">{n(f.au_promedio_compra)}</td><td className="num">{n(f.tenor_au_venta)}</td><td className="num">{n(f.gramos_au_venta)}</td><td className="num">{cop(f.maquila)}</td><td className="num">{cop(f.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th>Total viaje</th><th className="num">{n(v.costeo.totales.material_primario_t, 3)}</th><th className="num">{n(v.costeo.totales.concentrado_t, 3)}</th><th className="num">{cop(v.costeo.totales.valor_con_gastos)}</th><th className="num">{cop(v.costeo.totales.excedente)}</th>
                        <th></th><th></th><th className="num">{n(v.costeo.totales.gramos_au_venta)}</th><th className="num">{cop(v.costeo.totales.maquila)}</th><th className="num">{cop(v.costeo.totales.total_viaje)}</th></tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            ))}

            {vista === 'detallado' && (rep.detallados ?? []).map((d) => <DetalladoCard key={d.lote.id} d={d} />)}
          </div>
        </>
      )}
    </div>
  )
}

function DetalladoCard({ d }: { d: Detallado }) {
  const t = d.totales_volquetas, p = d.parametros_reparto, m = d.merma
  return (
    <Card title={`Lote ${d.lote.codigo} · ${d.lote.estado.replace(/_/g, ' ')}`}>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Volqueta</th><th>Fecha</th><th>Minero</th><th className="num">Peso (t)</th><th className="num">Humedad</th><th className="num">Tenor</th><th className="num">Seco (t)</th><th className="num">Gramos</th><th className="num">Precio total</th><th className="num">Excedente</th><th className="num">Flete</th><th className="num">Cargue</th><th className="num">Pesada</th><th className="num">Total</th></tr></thead>
          <tbody>
            {d.volquetas.map((v) => (
              <tr key={v.numero_volqueta}>
                <td>{v.numero_volqueta}</td><td>{dia(v.fecha)}</td><td>{v.minero}</td><td className="num">{n(v.peso)}</td><td className="num">{n(v.humedad * 100, 1)} %</td><td className="num">{n(v.tenor)}</td><td className="num">{n(v.ton_seca, 3)}</td><td className="num">{n(v.gramos)}</td>
                <td className="num">{cop(v.precio_total)}</td><td className="num">{cop(v.excedente)}</td><td className="num">{cop(v.flete)}</td><td className="num">{cop(v.cargue)}</td><td className="num">{cop(v.pesada)}</td><td className="num">{cop(v.total_material)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th colSpan={3}>Total</th><th className="num">{n(t.peso)}</th><th></th><th></th><th className="num">{n(t.ton_seca, 3)}</th><th className="num">{n(t.gramos)}</th><th className="num">{cop(t.precio_total)}</th><th className="num">{cop(t.excedente)}</th><th className="num">{cop(t.flete)}</th><th className="num">{cop(t.cargue)}</th><th className="num">{cop(t.pesada)}</th><th className="num">{cop(t.total_material)}</th></tr>
          </tfoot>
        </table>
      </div>

      <p className="rv-sub">Reparto entre viajes · {n(p.material_primario_seco_t, 3)} t de material → {n(p.denominador_concentrado_t, 3)} t de concentrado ({n(p.material_primario_por_t_concentrado)} t por t) · costo {cop(p.costo_por_t_concentrado)}/t · maquila {cop(p.maquila_por_t_concentrado)}/t</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Viaje</th><th>Fecha</th><th className="num">Vendido (t)</th><th className="num">Costo</th><th className="num">Maquila</th><th className="num">Total</th><th className="num">Gramos Au</th><th className="num">Merma Au (g)</th><th className="num">% merma</th></tr></thead>
          <tbody>
            {d.reparto.map((r) => (
              <tr key={r.id_linea}>
                <td>{r.viaje}{r.es_remanente && ' (remanente)'}</td><td>{dia(r.fecha)}</td><td className="num">{n(r.vendido_t, 3)}</td><td className="num">{cop(r.costo)}</td><td className="num">{cop(r.maquila)}</td><td className="num">{cop(r.total)}</td>
                <td className="num">{n(r.gramos_au)}</td><td className={signo(r.merma_au)}>{n(r.merma_au)}</td><td className={signo(r.pct_merma_au)}>{n(r.pct_merma_au, 1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rv-note">
        <span>Comprados <b>{n(m.gramos_au_comprados)} g</b></span>
        <span>Vendidos <b>{n(m.gramos_au_vendidos)} g</b></span>
        <span>Quedan <b>{n(m.gramos_au_quedan)} g</b></span>
        <span>Merma <b>{n(m.merma_au)} g ({n(m.pct_merma_au, 1)} %)</b></span>
        <span>Saldo <b>{n(d.saldo.ton_secas, 3)} t</b></span>
      </p>
    </Card>
  )
}
