import type { ReactElement, ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from '@/components/ui'

// Paleta de la marca para las series (sin azul, sin morados)
export const CHART_COLORS = ['#86af08', '#c88e34', '#12a150', '#e39a1c', '#1f7a7a', '#b82c2c', '#719400']

const axisStyle = { fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--border-default)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
}

function ChartFrame({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card title={title} className="chart-card">
      {hint && <p className="field__helper" style={{ marginBottom: '0.5rem' }}>{hint}</p>}
      <div className="chart-card__frame">
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

interface Datum {
  name: string
  [key: string]: string | number
}

interface SeriesChartProps {
  title: string
  hint?: string
  data: Datum[]
  bars?: { key: string; label: string }[]
  formatter?: (v: number) => string
}

export function BarChartCard({ title, hint, data, bars = [{ key: 'valor', label: 'Valor' }], formatter }: SeriesChartProps) {
  return (
    <ChartFrame title={title} hint={hint}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} tickFormatter={formatter} />
        <Tooltip contentStyle={tooltipStyle} formatter={formatter ? (v) => formatter(Number(v)) : undefined} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} />
        ))}
      </BarChart>
    </ChartFrame>
  )
}

export function LineChartCard({ title, hint, data, bars = [{ key: 'valor', label: 'Valor' }], formatter }: SeriesChartProps) {
  return (
    <ChartFrame title={title} hint={hint}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} tickFormatter={formatter} />
        <Tooltip contentStyle={tooltipStyle} formatter={formatter ? (v) => formatter(Number(v)) : undefined} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
        {bars.map((b, i) => (
          <Line
            key={b.key}
            type="monotone"
            dataKey={b.key}
            name={b.label}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ChartFrame>
  )
}

interface PieChartProps {
  title: string
  hint?: string
  data: { name: string; value: number }[]
  formatter?: (v: number) => string
}

export function PieChartCard({ title, hint, data, formatter }: PieChartProps) {
  return (
    <ChartFrame title={title} hint={hint}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="78%" innerRadius="45%" paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={formatter ? (v) => formatter(Number(v)) : undefined} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
      </PieChart>
    </ChartFrame>
  )
}
