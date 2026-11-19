// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Impuestos (solo lectura). Prefijo: /api/v1/pagos/impuestos
//
// No hay POST para "aplicar" un impuesto manualmente — siempre se genera solo
// en el backend cuando un abono/pago manda `id_cuenta_bancaria` de una cuenta
// que no está exenta.
//
// ✅ Shape de /impuestos/aplicados CONFIRMADO en vivo (2026-10-31, probado
// contra el backend real tras un abono con id_cuenta_bancaria):
// { id, id_impuesto, id_abono_cxp, id_cuenta_bancaria, valor_base, valor_impuesto,
//   fecha, created_at, impuesto: "4x1000", cuenta_bancaria: "<nombre ya resuelto>" }
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch } from './client'

type Dec = number | string | null

export interface ImpuestoCatalogo {
  id: number
  nombre: string
  tasa: Dec
}

export interface ImpuestoAplicado {
  id: number
  id_impuesto: number
  id_abono_cxp: number
  id_cuenta_bancaria: number
  valor_base: Dec
  valor_impuesto: Dec
  fecha: string
  created_at?: string
  // Nombre del impuesto (ej. "4x1000") y nombre de la cuenta ya resueltos por el backend.
  impuesto: string
  cuenta_bancaria: string
}

export interface ImpuestosAplicadosFiltro {
  id_cuenta_bancaria?: number
  desde?: string
  hasta?: string
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosImpuestosApi = {
  getCatalogo: () => apiFetch<ImpuestoCatalogo[]>('/pagos/impuestos'),
  getAplicados: (filtro?: ImpuestosAplicadosFiltro) =>
    apiFetch<ImpuestoAplicado[]>(`/pagos/impuestos/aplicados${qs({
      id_cuenta_bancaria: filtro?.id_cuenta_bancaria, desde: filtro?.desde, hasta: filtro?.hasta,
    })}`),
}
