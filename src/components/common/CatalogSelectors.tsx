// Selectores reutilizables de catálogo (mina, minero, zona, volqueta, dueño).
// Cada uno consume su catálogo vía hook con caché compartida, muestra estados
// de carga/error, y expone value/onChange con el id como number (o '' vacío).

import { Select } from '@/components/ui'
import { num } from '@/api/material'
import {
  useMinas, useMineros, useZonas, useVolquetas, useDuenos, useTiposMaterial,
} from '@/hooks/useMaterialCatalogos'

interface BaseSelectorProps {
  label?: string
  value: number | ''
  onChange: (id: number | '') => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

function useSelectHandler(onChange: (id: number | '') => void) {
  return (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    onChange(v === '' ? '' : Number(v))
  }
}

// ── Mina ─────────────────────────────────────────────────────────────────────
export function MinaSelect({ label = 'Mina', value, onChange, placeholder = '— Seleccionar mina —', required, disabled }: BaseSelectorProps) {
  const { data, loading, error } = useMinas()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(m => ({
        value: String(m.id),
        label: `${m.nombre}${m.minero ? ` · ${m.minero_alias ?? m.minero}` : ''}`,
      }))}
    />
  )
}

// ── Minero ───────────────────────────────────────────────────────────────────
export function MineroSelect({ label = 'Minero', value, onChange, placeholder = '— Seleccionar minero —', required, disabled }: BaseSelectorProps) {
  const { data, loading, error } = useMineros()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(m => ({
        value: String(m.id),
        label: `${m.nombre}${m.alias && m.alias !== m.nombre ? ` (${m.alias})` : ''}`,
      }))}
    />
  )
}

// ── Zona ─────────────────────────────────────────────────────────────────────
export function ZonaSelect({ label = 'Zona', value, onChange, placeholder = '— Sin zona —', required, disabled, showTarifa = true }: BaseSelectorProps & { showTarifa?: boolean }) {
  const { data, loading, error } = useZonas()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(z => {
        const t = num(z.tarifa)
        return {
          value: String(z.id),
          label: showTarifa
            ? `${z.nombre}${t > 0 ? ` · ${t.toLocaleString('es-CO')}/t` : ' · sin tarifa'}`
            : z.nombre,
        }
      })}
    />
  )
}

// ── Volqueta ─────────────────────────────────────────────────────────────────
export function VolquetaSelect({ label = 'Volqueta', value, onChange, placeholder = '— Seleccionar volqueta —', required, disabled }: BaseSelectorProps) {
  const { data, loading, error } = useVolquetas()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(v => ({
        value: String(v.id),
        label: `${v.placa}${v.dueno ?? v.dueno_nombre ? ` · ${v.dueno ?? v.dueno_nombre}` : ''}`,
      }))}
    />
  )
}

// ── Tipo de material ─────────────────────────────────────────────────────────
export function TipoMaterialSelect({ label = 'Tipo de material', value, onChange, placeholder = '— Seleccionar tipo —', required, disabled }: BaseSelectorProps) {
  const { data, loading, error } = useTiposMaterial()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(t => ({ value: String(t.id), label: t.nombre }))}
    />
  )
}

// ── Dueño de volqueta ────────────────────────────────────────────────────────
export function DuenoSelect({ label = 'Dueño', value, onChange, placeholder = '— Sin asignar —', required, disabled }: BaseSelectorProps) {
  const { data, loading, error } = useDuenos()
  return (
    <Select
      label={label} required={required}
      disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={useSelectHandler(onChange)}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(d => ({
        value: String(d.id),
        label: `${d.nombre}${d.alias && d.alias !== d.nombre ? ` (${d.alias})` : ''}`,
      }))}
    />
  )
}
