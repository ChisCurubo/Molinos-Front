// Utilidades de formato en español (Colombia)

const _cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatCOP(value: number): string {
  return _cop.format(value || 0)
}
/** Alias corto para componentes nuevos */
export const cop = (n: number | null | undefined) => _cop.format(n ?? 0)

const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
export function formatNum(value: number): string {
  return num.format(value || 0)
}

export function formatTon(value: number): string {
  return `${formatNum(value)} t`
}
/** Alias corto: toneladas con decimales configurables */
export const ton = (n: number | null | undefined, d = 4) => `${(n ?? 0).toFixed(d)} t`

/** Porcentaje (0.11 → "11.0%") */
export const pct = (n: number | null | undefined) => `${((n ?? 0) * 100).toFixed(1)}%`

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
/** Alias corto para fecha ISO */
export const fecha = (s: string) => formatDate(s)

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Devuelve el precio aplicable según tenor y (opcionalmente) mineroId.
 *  Prioriza el precio específico del minero sobre el general. */
export function getPrecioAplicable(
  tenor: number,
  mineroId: number | undefined,
  precios: Array<{ id: number; tenor_min: number; tenor_max: number; id_minero?: number; metodo: string; precio_por_tonelada?: number; precio_por_gramo?: number }>,
) {
  const candidatos = precios.filter(
    (p) => p.tenor_min <= tenor && p.tenor_max >= tenor && (!p.id_minero || p.id_minero === mineroId),
  )
  // Priorizar precio específico del minero (tiene id_minero) sobre el general
  candidatos.sort((a, b) => (b.id_minero ?? 0) - (a.id_minero ?? 0))
  return candidatos[0] ?? null
}

/** Alias de calc4x1000Inverso para compatibilidad con código nuevo */
export const calc4x1000inv = (neto: number) => {
  const bruto = Math.round(neto / 0.996)
  return { neto, bruto, impuesto: bruto - neto }
}
