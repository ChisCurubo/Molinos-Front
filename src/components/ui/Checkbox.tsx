import { useId, type InputHTMLAttributes } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function Checkbox({ label, id, ...rest }: CheckboxProps) {
  const autoId = useId()
  const cbId = id ?? autoId
  return (
    <label className="checkbox" htmlFor={cbId}>
      <input id={cbId} type="checkbox" {...rest} />
      <span className="checkbox__label">{label}</span>
    </label>
  )
}
