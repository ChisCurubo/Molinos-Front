// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Gasto Directo (reemplaza Caja Menor)
// Prefijo: /api/v1/pagos/gastos-directos
//
// Cada gasto pagado en el momento (parqueadero, peaje, etc.) es su propia
// Cuenta_Por_Pagar ya pagada, creada en un solo paso (CxP + Abonos_CxP server-side).
// comprobante_url es obligatorio.
//
// ⚠️ Shape CONFIRMADO en vivo (2026-10-23, probado contra el backend real) —
// reemplaza lo que se había asumido al escribir el cliente:
// - NO trae `estado` ('activo'/'anulado' no existe en la respuesta).
// - Sí trae `id_abono` — el id del Abono_CxP asociado. Importante: el `id`
//   que devuelve GET /pagos/vistas/libro-gastos para una fila de categoría
//   "Gasto Directo" es justamente ese `id_abono`, NO el `id` real del gasto
//   directo — hay que resolverlo cruzando por `id_abono` antes de llamar
//   PATCH/DELETE (ver LibroGastosTab en CxPApiPage.tsx). Usar `g.id` del
//   libro-gastos directo contra /pagos/gastos-directos/:id da 404.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

export type MetodoPagoGastoDirecto = 'efectivo' | 'transferencia' | 'nequi' | 'deposito' | 'otro'

export interface GastoDirecto {
  id: number
  concepto: string
  monto: number | string
  comprobante_url: string
  fecha: string
  metodo_pago: MetodoPagoGastoDirecto
  observaciones?: string | null
  id_abono: number
  created_at?: string
}

export interface GastoDirectoPayload {
  concepto: string
  monto: number
  comprobante_url: string
  fecha?: string
  metodo_pago?: MetodoPagoGastoDirecto
  observaciones?: string
}

export interface GastoDirectoFiltro {
  desde?: string
  hasta?: string
}

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosGastosDirectosApi = {
  listar: (filtro?: GastoDirectoFiltro) =>
    apiFetch<GastoDirecto[]>(`/pagos/gastos-directos${qs({ desde: filtro?.desde, hasta: filtro?.hasta })}`),
  obtener: (id: number) => apiFetch<GastoDirecto>(`/pagos/gastos-directos/${id}`),
  crear: (body: GastoDirectoPayload) => apiPost<GastoDirecto>('/pagos/gastos-directos', body),
  actualizar: (id: number, body: Partial<GastoDirectoPayload>) => apiPatch<GastoDirecto>(`/pagos/gastos-directos/${id}`, body),
  anular: (id: number) => apiDelete<{ message?: string }>(`/pagos/gastos-directos/${id}`),
}
