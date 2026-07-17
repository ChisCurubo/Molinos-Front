import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

interface InfoCalloutProps {
  children: ReactNode
  accent?: boolean
}

export function InfoCallout({ children, accent }: InfoCalloutProps) {
  return (
    <div className={`callout ${accent ? 'callout--accent' : ''}`}>
      <span className="callout__icon" aria-hidden="true">
        <Info size={16} />
      </span>
      <span>{children}</span>
    </div>
  )
}
