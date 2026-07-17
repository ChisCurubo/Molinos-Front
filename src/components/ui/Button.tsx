import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  /** Para botones de solo ícono es obligatorio por accesibilidad */
  'aria-label'?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  iconRight,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const iconOnly = !children && (icon || iconRight)
  const cls = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    iconOnly ? 'btn--icon-only' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={cls} {...rest}>
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
      {iconRight && <span className="btn__icon">{iconRight}</span>}
    </button>
  )
}
