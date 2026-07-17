import { ArrowDownCircle, ArrowUpCircle, Landmark } from 'lucide-react'
import { InfoCallout, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { BarChartCard, LineChartCard, PieChartCard } from '@/components/charts/Charts'
import { useData } from '@/context/DataContext'
import { formatCOP } from '@/utils/format'

const TIPO_LABEL: Record<string, string> = {
  flete: 'Flete', material: 'Material', proveedor: 'Proveedores', gasto: 'Gastos', alquiler: 'Alquileres',
}

export function InformesFinanzasPage() {
  const { porPagar, porCobrar, prestamos } = useData()

  // Composición de gastos por tipo (por pagar)
  const gastosPorTipo = Object.entries(
    porPagar.reduce<Record<string, number>>((acc, p) => {
      acc[p.tipo] = (acc[p.tipo] ?? 0) + p.monto
      return acc
    }, {}),
  ).map(([k, v]) => ({ name: TIPO_LABEL[k] ?? k, value: v }))

  // Deudas: automáticas vs manuales
  const deudas = [
    { name: 'Automáticas', valor: porPagar.filter((p) => p.origen === 'automatico').reduce((s, p) => s + p.monto, 0) },
    { name: 'Manuales', valor: porPagar.filter((p) => p.origen === 'manual').reduce((s, p) => s + p.monto, 0) },
  ]

  // Flujo de caja por mes (ingresos = por cobrar, egresos = por pagar + cuotas préstamo)
  const meses = ['2026-06', '2026-07', '2026-08']
  const cuotaPrestamos = prestamos.reduce((s, p) => s + p.cuotaMensual, 0)
  const flujo = meses.map((m) => {
    const ingresos = porCobrar.filter((c) => c.fechaVencimiento.startsWith(m)).reduce((s, c) => s + c.monto, 0)
    const egresos =
      porPagar.filter((p) => p.fechaVencimiento.startsWith(m)).reduce((s, p) => s + p.monto, 0) + cuotaPrestamos
    return { name: m.replace('2026-', ''), Ingresos: ingresos, Egresos: egresos }
  })

  const totalPagar = porPagar.reduce((s, p) => s + p.monto, 0)
  const totalCobrar = porCobrar.reduce((s, p) => s + p.monto, 0)

  return (
    <div className="page">
      <PageHeader
        title="Informes de finanzas"
        subtitle="Deudas, flujo de caja y composición de gastos (simulación tipo Power BI)."
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total por pagar" value={formatCOP(totalPagar)} icon={<ArrowUpCircle size={16} />} accent="rose" />
        <KpiTile label="Total por cobrar" value={formatCOP(totalCobrar)} icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Cuota préstamos / mes" value={formatCOP(cuotaPrestamos)} icon={<Landmark size={16} />} accent="brown" />
      </div>

      <InfoCallout>Los gráficos consolidan cuentas por pagar, por cobrar y préstamos del sistema.</InfoCallout>

      <div className="grid grid--charts" style={{ marginTop: '1.125rem' }}>
        <LineChartCard
          title="Flujo de caja"
          hint="Ingresos vs. egresos por mes"
          data={flujo}
          bars={[{ key: 'Ingresos', label: 'Ingresos' }, { key: 'Egresos', label: 'Egresos' }]}
          formatter={(v) => formatCOP(v)}
        />
        <PieChartCard title="Composición de gastos" hint="Cuentas por pagar por tipo" data={gastosPorTipo} formatter={(v) => formatCOP(v)} />
        <BarChartCard title="Deudas totales" hint="Automáticas vs. manuales" data={deudas} formatter={(v) => formatCOP(v)} />
      </div>
    </div>
  )
}
