// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Préstamos financieros (créditos bancarios de la empresa)
// Prefijo: /api/v1/pagos/prestamos-financieros
//
// (2026-10-22) Motor real de abonos + interés, confirmado contra el backend:
// crear el préstamo abre una CxP persistente (categoría "Préstamo financiero",
// visible en /pagos/cxp/mensual como cualquier otra deuda — no hace falta
// tratarla distinto ahí). Reemplaza el simulado anterior (PATCH saldo_pendiente
// + localStorage) que quedó obsoleto.
// DELETE sigue dando 409 si saldo_pendiente !== monto_principal (ya tuvo
// actividad: abonos o interés capitalizado).
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete, apiPostComprobante } from './client'

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

export type TipoMovimientoPrestamo = 'interes' | 'abono'
export interface MovimientoPrestamo {
  id: number
  id_prestamo_fin: number
  tipo: TipoMovimientoPrestamo
  fecha: string
  valor: Dec
  saldo_resultante: Dec
  id_abono_cxp: number | null
  observaciones?: string | null
}

export interface AbonoPrestamoPayload {
  valor: number
  fecha_abono?: string
  metodo_pago?: string
  observaciones?: string
  // Si se manda y la cuenta no está exenta, el backend cobra el 4×1000 solo.
  id_cuenta_bancaria?: number
}

export interface ProyeccionInteresPrestamo {
  id_prestamo_fin: number
  saldo_actual: Dec
  meses_a_acumular: number
  interes_proyectado: Dec
  saldo_si_se_acumula: Dec
}

export const pagosPrestamosApi = {
  crear: (body: PrestamoPayload) => apiPost<PrestamoFinanciero>('/pagos/prestamos-financieros', body),
  listar: () => apiFetch<PrestamoFinanciero[]>('/pagos/prestamos-financieros'),
  getDetalle: (id: number) => apiFetch<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`),
  actualizar: (id: number, body: Partial<PrestamoPayload>) => apiPut<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`, body),
  actualizarParcial: (id: number, body: Partial<PrestamoPayload>) => apiPatch<PrestamoFinanciero>(`/pagos/prestamos-financieros/${id}`, body),
  // 409 si saldo_pendiente !== monto_principal (el préstamo ya tuvo actividad).
  eliminar: (id: number) => apiDelete<{ message?: string }>(`/pagos/prestamos-financieros/${id}`),

  // Abono real (pago de cuota) — 409 si valor > saldo pendiente.
  abonar: (id: number, body: AbonoPrestamoPayload, comprobante?: File | null) =>
    apiPostComprobante<MovimientoPrestamo>(`/pagos/prestamos-financieros/${id}/abonos`, body, comprobante),
  // Solo consulta, no persiste — mostrar antes de capitalizar para que el
  // usuario vea cuántos meses hay acumulados y no se entere por el 409.
  getProyeccionInteres: (id: number, fecha?: string) =>
    apiFetch<ProyeccionInteresPrestamo>(`/pagos/prestamos-financieros/${id}/interes/proyeccion${fecha ? `?fecha=${fecha}` : ''}`),
  // 409 si no ha pasado un mes completo desde el último movimiento (abono o interés).
  capitalizarInteres: (id: number, fecha?: string) => apiPost<MovimientoPrestamo>(`/pagos/prestamos-financieros/${id}/interes`, fecha ? { fecha } : undefined),
  getMovimientos: (id: number) => apiFetch<MovimientoPrestamo[]>(`/pagos/prestamos-financieros/${id}/movimientos`),
}
