import type { ReactNode } from 'react'

interface CardRowProps {
  title: ReactNode
  subtitle?: ReactNode
  plate?: string
  tons?: ReactNode
  status?: ReactNode
  extra?: ReactNode
  onClick?: () => void
}

/**
 * Fila táctil grande para vistas principales.
 * chip de placa café + toneladas + badge de estado.
 */
export function CardRow({ title, subtitle, plate, tons, status, extra, onClick }: CardRowProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper className="card-row" onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="card-row__main">
        <span className="card-row__title">{title}</span>
        {subtitle && <span className="card-row__sub">{subtitle}</span>}
      </div>
      <div className="card-row__meta">
        {plate && <span className="plate-chip">{plate}</span>}
        {tons != null && <span className="card-row__tons">{tons}</span>}
        {status}
        {extra}
      </div>
    </Wrapper>
  )
}

export function CardList({ children }: { children: ReactNode }) {
  return <div className="card-list">{children}</div>
}
