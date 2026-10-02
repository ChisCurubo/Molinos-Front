// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Préstamos financieros (créditos bancarios de la empresa)
// Prefijo: /api/v1/pagos/prestamos-financieros
//
// CRUD simple, sin motor de abonos propio (a diferencia de Material/Flete/Agua/
// Mulas/Anticipos): no hay tabla de Abonos ni historial con comprobante — el
// "pago de una cuota" se simula editando `saldo_pendiente` vía PUT/PATCH.
// DELETE devuelve 409 si `saldo_pendiente !== monto_principal` (ya tuvo abonos).
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export interface PrestamoFinanciero {
  id: number
  nombre_prestamo: string
  fecha_adquisicion: string
  monto_principal: Dec
  tasa_interes: Dec
  saldo_pendiente: Dec
  activo?: number | boolean
}

export interface PrestamoPayload {
  nombre_prestamo: string
  fecha_adquisicion: string
  monto_principal: number
  tasa_interes: number
  saldo_pendiente: number
  activo?: boolean
}

export const pagosPrestamosApi = {
  crear: (body: PrestamoPayload) => apiPost<PrestamoFinanciero>('/pagos/prestamos-financieros', body),
  listar: () => apiFetch<PrestamoFinanciero[]>('/pagos/prestamos-financieros'),
  getDetalle: (id: number) => apiFetch<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`),
  actualizar: (id: number, body: Partial<PrestamoPayload>) => apiPut<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`, body),
  actualizarParcial: (id: number, body: Partial<PrestamoPayload>) => apiPatch<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`, body),
  // 409 si saldo_pendiente !== monto_principal (el préstamo ya tuvo abonos).
  eliminar: (id: number) => apiDelete<{ message?: string }>(`/pagos/prestamos-financieros/${id}`),
}
