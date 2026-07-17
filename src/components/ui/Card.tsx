import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** aplica padding directo en vez de header/body */
  flush?: boolean
}

export function Card({ title, actions, children, className = '', flush }: CardProps) {
  if (!title && flush) {
    return <div className={`card card--pad ${className}`}>{children}</div>
  }
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card__header">
          <h3 className="card__title">{title}</h3>
          {actions && <div className="row spacer" style={{ justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </div>
  )
}
