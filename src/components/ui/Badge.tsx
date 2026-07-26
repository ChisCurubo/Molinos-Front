import type { ReactNode } from 'react'
import { CheckCircle2, Clock, XCircle, Search, Circle } from 'lucide-react'
import type { EstadoGeneral } from '@/types'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  )
}

// Mapea el estado del dominio a color + ícono + texto en español.
const ESTADO_MAP: Record<EstadoGeneral, { tone: Tone; icon: ReactNode; label: string }> = {
  aprobado: { tone: 'success', icon: <CheckCircle2 size={15} aria-hidden="true" />, label: 'Aprobado' },
  pendiente: { tone: 'warning', icon: <Clock size={15} aria-hidden="true" />, label: 'Pendiente' },
  rechazado: { tone: 'danger',  icon: <XCircle size={15} aria-hidden="true" />, label: 'Rechazado' },
  revision:  { tone: 'info',    icon: <Search size={15} aria-hidden="true" />, label: 'En revisión' },
  pagado:    { tone: 'success', icon: <CheckCircle2 size={15} aria-hidden="true" />, label: 'Pagado' },
}

export function EstadoBadge({ estado }: { estado: EstadoGeneral }) {
  const cfg = ESTADO_MAP[estado] ?? { tone: 'neutral' as Tone, icon: <Circle size={15} />, label: estado }
  return (
    <Badge tone={cfg.tone} icon={cfg.icon}>
      {cfg.label}
    </Badge>
  )
}
