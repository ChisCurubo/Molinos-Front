import type { MaterialRow } from '@/data/mock'

// ── Abono a un minero por su material ─────────────────────────
export interface AbonoMinero {
  id: number
  minero: string        // = MaterialRow.mina (clave de la entidad)
  fecha: string
  monto: number
  tipo: 'transferencia' | 'deposito' | 'efectivo' | 'otro'
  comprobante_img?: string // base64 comprimida
  nota?: string
  materiales_ids?: number[] // materiales que cubre este pago (si es pago por selección)
}

export const LS_MATERIAL_PAGOS = 'material_pagos_mineros_v1'

export function loadAbonosMinero(): AbonoMinero[] {
  try { const r = localStorage.getItem(LS_MATERIAL_PAGOS); return r ? JSON.parse(r) : [] } catch { return [] }
}
export function saveAbonosMinero(list: AbonoMinero[]) {
  try { localStorage.setItem(LS_MATERIAL_PAGOS, JSON.stringify(list)) } catch { /* quota */ }
}

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado'

/**
 * Calcula cuánto se ha pagado de cada material.
 * - Los abonos con `materiales_ids` se aplican SOLO a esos materiales (pago por selección).
 * - Los abonos sin `materiales_ids` (pago general) se aplican a todos los del minero.
 * En ambos casos el dinero se reparte del material más antiguo al más nuevo,
 * lo que permite pagos parciales. Solo cuentan los materiales valorizados (valor > 0).
 */
export function montoPagadoPorMaterial(
  materiales: MaterialRow[],
  abonos: AbonoMinero[],
  valorOf: (m: MaterialRow) => number | null,
): Map<number, number> {
  const paid = new Map<number, number>()
  const valOf = (m: MaterialRow) => { const v = valorOf(m); return v != null && v > 0 ? v : 0 }

  const byMinero = new Map<string, MaterialRow[]>()
  for (const m of materiales) {
    if (valOf(m) <= 0) continue
    if (!byMinero.has(m.mina)) byMinero.set(m.mina, [])
    byMinero.get(m.mina)!.push(m)
  }

  for (const [minero, mats] of byMinero) {
    const sorted = [...mats].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const abs = abonos.filter(a => a.minero === minero).sort((a, b) => a.fecha.localeCompare(b.fecha))
    for (const ab of abs) {
      let rem = ab.monto
      const pool = ab.materiales_ids && ab.materiales_ids.length
        ? sorted.filter(m => ab.materiales_ids!.includes(m.id))
        : sorted
      for (const m of pool) {
        if (rem <= 0) break
        const cap = valOf(m) - (paid.get(m.id) ?? 0)
        if (cap <= 0) continue
        const put = Math.min(rem, cap)
        paid.set(m.id, (paid.get(m.id) ?? 0) + put)
        rem -= put
      }
      // sobrante (pago de más o sin capacidad): cuenta al saldo del minero, no a un material
    }
  }
  return paid
}

/**
 * Desglose de cada abono: a qué materiales fue su dinero y cuánto a cada uno.
 * Devuelve Map<idAbono, [{ id_material, monto }]>. Útil para "ver qué pagué con este abono".
 */
export function desglosePorAbono(
  materiales: MaterialRow[],
  abonos: AbonoMinero[],
  valorOf: (m: MaterialRow) => number | null,
): Map<number, { id_material: number; monto: number }[]> {
  const res = new Map<number, { id_material: number; monto: number }[]>()
  const valOf = (m: MaterialRow) => { const v = valorOf(m); return v != null && v > 0 ? v : 0 }
  const paid = new Map<number, number>()

  const byMinero = new Map<string, MaterialRow[]>()
  for (const m of materiales) {
    if (valOf(m) <= 0) continue
    if (!byMinero.has(m.mina)) byMinero.set(m.mina, [])
    byMinero.get(m.mina)!.push(m)
  }

  for (const [minero, mats] of byMinero) {
    const sorted = [...mats].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const abs = abonos.filter(a => a.minero === minero).sort((a, b) => a.fecha.localeCompare(b.fecha))
    for (const ab of abs) {
      let rem = ab.monto
      const detalle: { id_material: number; monto: number }[] = []
      const pool = ab.materiales_ids && ab.materiales_ids.length
        ? sorted.filter(m => ab.materiales_ids!.includes(m.id))
        : sorted
      for (const m of pool) {
        if (rem <= 0) break
        const cap = valOf(m) - (paid.get(m.id) ?? 0)
        if (cap <= 0) continue
        const put = Math.min(rem, cap)
        paid.set(m.id, (paid.get(m.id) ?? 0) + put)
        detalle.push({ id_material: m.id, monto: put })
        rem -= put
      }
      res.set(ab.id, detalle)
    }
  }
  return res
}

/** Estado de pago por material, derivado de lo pagado vs su valor. */
export function estadoPagoMap(
  materiales: MaterialRow[],
  abonos: AbonoMinero[],
  valorOf: (m: MaterialRow) => number | null,
): Map<number, EstadoPago> {
  const paid = montoPagadoPorMaterial(materiales, abonos, valorOf)
  const map = new Map<number, EstadoPago>()
  for (const m of materiales) {
    const v = valorOf(m)
    if (v == null || v <= 0) continue
    const p = paid.get(m.id) ?? 0
    map.set(m.id, p >= v - 0.01 ? 'pagado' : p > 0 ? 'parcial' : 'pendiente')
  }
  return map
}
