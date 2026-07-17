import { BarChart3, Droplets, Package, TrendingUp } from 'lucide-react'
import { InfoCallout, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { BarChartCard, LineChartCard, PieChartCard } from '@/components/charts/Charts'
import { useData } from '@/context/DataContext'
import { PRECIO_AU_GRAMO } from '@/utils/liquidacion'
import { formatCOP, formatTon } from '@/utils/format'

export function InformesMaterialPage() {
  const { entradas, minas, volquetas, viajesAgua } = useData()
  const analizadas = entradas.filter((e) => e.toneladasSecas != null)

  // Producción por mina (toneladas secas)
  const produccionPorMina = minas.map((m) => ({
    name: m.nombre,
    valor: +analizadas.filter((e) => e.minaId === m.id).reduce((s, e) => s + (e.toneladasSecas ?? 0), 0).toFixed(2),
  }))

  // Excedente por viaje = valor Au − liquidación − flete
  const excedentePorViaje = analizadas.map((e) => {
    const valorAu = (e.au ?? (e.toneladasSecas ?? 0) * (e.tenor ?? 0)) * PRECIO_AU_GRAMO
    return {
      name: volquetas.find((v) => v.id === e.volquetaId)?.placa ?? e.id,
      valor: Math.round(valorAu - (e.liquidacion ?? 0) - (e.flete ?? 0)),
    }
  })

  // Ley de mineral (tenor g/t) por entrada
  const leyMineral = analizadas.map((e) => ({
    name: minas.find((m) => m.id === e.minaId)?.nombre ?? e.id,
    valor: e.tenor ?? 0,
  }))

  // Composición de viajes de agua por destino
  const aguaPorDestino = Object.entries(
    viajesAgua.reduce<Record<string, number>>((acc, v) => {
      acc[v.destino] = (acc[v.destino] ?? 0) + v.volumenM3
      return acc
    }, {}),
  ).map(([name, value]) => ({ name, value }))

  const totalTon = analizadas.reduce((s, e) => s + (e.toneladasSecas ?? 0), 0)
  const totalExcedente = excedentePorViaje.reduce((s, e) => s + e.valor, 0)

  return (
    <div className="page">
      <PageHeader
        title="Informes de material"
        subtitle="Tableros de producción, excedente y ley de mineral (simulación tipo Power BI)."
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Producción total" value={formatTon(totalTon)} icon={<Package size={16} />} accent="green" />
        <KpiTile label="Excedente estimado" value={formatCOP(totalExcedente)} icon={<TrendingUp size={16} />} accent="emerald" />
        <KpiTile label="Viajes analizados" value={analizadas.length} icon={<BarChart3 size={16} />} accent="brown" />
        <KpiTile label="Agua transportada" value={`${viajesAgua.reduce((s, v) => s + v.volumenM3, 0)} m³`} icon={<Droplets size={16} />} accent="amber" />
      </div>

      <InfoCallout>Los gráficos usan los datos reales del sistema: entradas, análisis de laboratorio y viajes.</InfoCallout>

      <div className="grid grid--charts" style={{ marginTop: '1.125rem' }}>
        <BarChartCard title="Producción por mina" hint="Toneladas secas acumuladas" data={produccionPorMina} formatter={(v) => `${v} t`} />
        <BarChartCard title="Excedente por viaje" hint="Ganancia estimada por volqueta" data={excedentePorViaje} formatter={(v) => formatCOP(v)} />
        <LineChartCard title="Ley de mineral" hint="Tenor (g/t) por entrada analizada" data={leyMineral} formatter={(v) => `${v} g/t`} />
        <PieChartCard title="Agua por destino" hint="Volumen (m³) transportado" data={aguaPorDestino} formatter={(v) => `${v} m³`} />
      </div>
    </div>
  )
}
