import type { ReactNode } from 'react'
import { Lock, Inbox } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page__header row row--between" style={{ alignItems: 'flex-start' }}>
      <div>
        <h1 className="page__title">{title}</h1>
        {subtitle && <p className="page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function ReadOnlyBanner() {
  return (
    <div className="readonly-banner" role="note">
      <Lock size={16} aria-hidden="true" />
      Su rol tiene acceso de solo lectura. Puede consultar la información pero no modificarla.
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <Inbox className="empty__icon" size={40} aria-hidden="true" />
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  )
}
