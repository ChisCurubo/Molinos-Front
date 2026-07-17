import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon?: ReactNode
  helper?: string
  error?: string
  /** Modo monoespaciado para placas, IDs y montos */
  mono?: boolean
  required?: boolean
}

export function Input({
  label,
  icon,
  helper,
  error,
  mono,
  required,
  id,
  className = '',
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`

  return (
    <div className={`field ${icon ? 'field--with-icon' : ''} ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required && <span className="field__req" aria-hidden="true">*</span>}
      </label>
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={inputId}
          className={`field__input ${mono ? 'mono' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          aria-required={required}
          {...rest}
        />
      </div>
      {error ? (
        <span className="field__error" id={errorId}>
          <AlertCircle size={15} aria-hidden="true" /> {error}
        </span>
      ) : (
        helper && (
          <span className="field__helper" id={helperId}>
            {helper}
          </span>
        )
      )}
    </div>
  )
}
