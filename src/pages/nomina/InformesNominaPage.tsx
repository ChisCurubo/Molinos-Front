import { Clock, TrendingDown, Users2 } from 'lucide-react'
import { InfoCallout, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { BarChartCard, PieChartCard } from '@/components/charts/Charts'
import { useData } from '@/context/DataContext'
import { formatCOP } from '@/utils/format'

const VALOR_HORA = 8000
const RECARGO_NOCTURNO = 1.35

export function InformesNominaPage() {
  const { turnos, empleados } = useData()

  // Horas trabajadas por empleado
  const horasPorEmpleado = empleados.map((e) => ({
    name: e.nombre.split(' ')[0],
    valor: turnos.filter((t) => t.empleadoId === e.id && t.presente).reduce((s, t) => s + t.horas, 0),
  }))

  // Costo por quincena
  const costoQuincena = (['q1', 'q2'] as const).map((q) => {
    const filtro = turnos.filter((t) => {
      if (!t.presente) return false
      const dia = Number(t.fecha.slice(8, 10))
      return q === 'q1' ? dia <= 15 : dia >= 16
    })
    const valor = filtro.reduce((s, t) => s + t.horas * VALOR_HORA * (t.tipo === 'nocturno' ? RECARGO_NOCTURNO : 1), 0)
    return { name: q === 'q1' ? '1ª quincena' : '2ª quincena', valor: Math.round(valor) }
  })

  // Ausentismo
  const presentes = turnos.filter((t) => t.presente).length
  const ausentes = turnos.filter((t) => !t.presente).length
  const ausentismo = [
    { name: 'Presentes', value: presentes },
    { name: 'Ausencias', value: ausentes },
  ]

  const totalHoras = turnos.filter((t) => t.presente).reduce((s, t) => s + t.horas, 0)
  const totalCosto = costoQuincena.reduce((s, c) => s + c.valor, 0)
  const tasaAusentismo = turnos.length ? Math.round((ausentes / turnos.length) * 100) : 0

  return (
    <div className="page">
      <PageHeader
        title="Informes de nómina"
        subtitle="Horas trabajadas, costo por quincena y ausentismo (simulación tipo Power BI)."
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Horas trabajadas" value={totalHoras} icon={<Clock size={16} />} accent="green" />
        <KpiTile label="Costo de turnos" value={formatCOP(totalCosto)} icon={<Users2 size={16} />} accent="brown" />
        <KpiTile label="Tasa de ausentismo" value={`${tasaAusentismo}%`} icon={<TrendingDown size={16} />} accent="rose" />
      </div>

      <InfoCallout>Los datos provienen de los turnos registrados de la quincena, con recargo nocturno del 35%.</InfoCallout>

      <div className="grid grid--charts" style={{ marginTop: '1.125rem' }}>
        <BarChartCard title="Horas trabajadas por empleado" data={horasPorEmpleado} formatter={(v) => `${v} h`} />
        <BarChartCard title="Costo por quincena" data={costoQuincena} formatter={(v) => formatCOP(v)} />
        <PieChartCard title="Ausentismo" hint="Turnos presentes vs. ausencias" data={ausentismo} formatter={(v) => `${v} turnos`} />
      </div>
    </div>
  )
}
