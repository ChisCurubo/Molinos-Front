import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Select } from '@/components/ui'
import { mineros as mineroCatalog, MINA_A_MINERO, MINA_A_ZONA } from '@/data/mock'

const LS_EXTRA = 'molinos_mineros_extra_v1'
function loadExtra(): string[] {
  try { const r = localStorage.getItem(LS_EXTRA); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveExtra(list: string[]) {
  try { localStorage.setItem(LS_EXTRA, JSON.stringify(list)) } catch { /* quota */ }
}

/** Nombres base del sistema: catálogo de mineros + llaves de los mapas mina→zona/minero. */
export function baseMineroNames(): string[] {
  return [
    ...mineroCatalog.map(m => m.nombre),
    ...Object.keys(MINA_A_MINERO),
    ...Object.keys(MINA_A_ZONA),
  ].map(n => n.toUpperCase())
}

const NEW = '__nuevo__'

interface Props {
  label?: string
  value: string
  onChange: (name: string) => void
  /** Nombres adicionales presentes en los registros actuales. */
  extraKnown?: string[]
  required?: boolean
}

/**
 * Selector de mina/minero con la lista de mineros existentes en el sistema
 * y opción de crear uno nuevo en el mismo campo (se persiste en localStorage).
 * Devuelve el nombre en mayúsculas para ser consistente con los mapas de precio/zona.
 */
export function MineroField({ label = 'Mina / Minero', value, onChange, extraKnown = [], required }: Props) {
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo]     = useState('')
  const [extras, setExtras]   = useState<string[]>(loadExtra)

  const names = useMemo(() => {
    const set = new Set<string>()
    for (const n of [...baseMineroNames(), ...extras, ...extraKnown]) {
      const t = n?.trim()
      if (t) set.add(t.toUpperCase())
    }
    if (value?.trim()) set.add(value.trim().toUpperCase())
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [extras, extraKnown, value])

  const options = [
    { value: '', label: '— Sin asignar —' },
    ...names.map(n => ({ value: n, label: n })),
    { value: NEW, label: '➕ Nuevo minero…' },
  ]

  const agregar = () => {
    const t = nuevo.trim().toUpperCase()
    if (!t) return
    if (!extras.includes(t) && !baseMineroNames().includes(t)) {
      const next = [...extras, t]; setExtras(next); saveExtra(next)
    }
    onChange(t)
    setNuevo(''); setCreando(false)
  }

  return (
    <div>
      <Select label={label} required={required}
        value={creando ? NEW : (value ? value.toUpperCase() : '')}
        options={options}
        onChange={e => {
          if (e.target.value === NEW) { setCreando(true); setNuevo('') }
          else { setCreando(false); onChange(e.target.value) }
        }} />
      {creando && (
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
          <input className="field__input" autoFocus placeholder="Nombre del nuevo minero"
            value={nuevo} onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
            style={{ flex: 1, textTransform: 'uppercase' }} />
          <button type="button" onClick={agregar} disabled={!nuevo.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--amber-600)', color: '#fff', padding: '0 0.75rem', cursor: nuevo.trim() ? 'pointer' : 'not-allowed', fontSize: 'var(--fs-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Plus size={14}/> Agregar
          </button>
          <button type="button" onClick={() => { setCreando(false); setNuevo('') }}
            style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', padding: '0 0.6rem', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
