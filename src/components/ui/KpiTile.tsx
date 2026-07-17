import type { ReactNode } from 'react'

type Accent = 'green' | 'brown' | 'emerald' | 'rose' | 'amber'

interface KpiTileProps {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  accent?: Accent
}

export function KpiTile({ label, value, hint, icon, accent = 'green' }: KpiTileProps) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <span className="kpi__label">
        {icon}
        {label}
      </span>
      <span className="kpi__value">{value}</span>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  )
}
