import { useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  icon?: ReactNode
  options: Option[]
  helper?: string
  error?: string
  placeholder?: string
  required?: boolean
}

export function Select({
  label,
  icon,
  options,
  helper,
  error,
  placeholder,
  required,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const helperId = `${selectId}-helper`
  const errorId = `${selectId}-error`

  return (
    <div className={`field ${icon ? 'field--with-icon' : ''} ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={selectId}>
        {label}
        {required && <span className="field__req" aria-hidden="true">*</span>}
      </label>
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <select
          id={selectId}
          className={`field__select ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          aria-required={required}
          required={required}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="field__chevron" aria-hidden="true">
          <ChevronDown size={20} />
        </span>
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
