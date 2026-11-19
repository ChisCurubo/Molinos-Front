// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Cuentas bancarias de la empresa (de dónde sale/entra la plata)
// Prefijo: /api/v1/pagos/cuentas
//
// DELETE es borrado FÍSICO (no "anular" como el resto del sistema) — da 409 si
// la cuenta ya tiene movimientos o impuestos asociados (FK).
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export type TipoCuentaBancaria = 'ahorros' | 'corriente' | 'nequi' | 'otro' | string
export type PropietarioCuenta = 'empresa' | 'empleado' | string

export interface CuentaBancaria {
  id: number
  nombre: string
  banco: string
  numero_cuenta: string
  tipo_cuenta: TipoCuentaBancaria
  propietario: PropietarioCuenta
  id_empleado?: number | null
  exento_4x1000?: boolean | number
  activa?: boolean | number
}

export interface CuentaBancariaPayload {
  nombre: string
  banco: string
  numero_cuenta: string
  tipo_cuenta: TipoCuentaBancaria
  propietario: PropietarioCuenta
  id_empleado?: number
  exento_4x1000?: boolean
}

export interface SaldoCuenta {
  id_cuenta_bancaria?: number
  id?: number
  nombre?: string
  ingresos?: Dec
  egresos?: Dec
  impuestos?: Dec
  saldo: Dec
}

export const pagosCuentasApi = {
  listar: () => apiFetch<CuentaBancaria[]>('/pagos/cuentas'),
  obtener: (id: number) => apiFetch<CuentaBancaria>(`/pagos/cuentas/${id}`),
  crear: (body: CuentaBancariaPayload) => apiPost<CuentaBancaria>('/pagos/cuentas', body),
  actualizar: (id: number, body: Partial<CuentaBancariaPayload> & { activa?: boolean }) =>
    apiPatch<CuentaBancaria>(`/pagos/cuentas/${id}`, body),
  // 409 si la cuenta ya tiene movimientos o impuestos asociados.
  eliminar: (id: number) => apiDelete<{ message?: string }>(`/pagos/cuentas/${id}`),
  getSaldo: (id: number) => apiFetch<SaldoCuenta>(`/pagos/cuentas/${id}/saldo`),
  getSaldos: () => apiFetch<SaldoCuenta[]>('/pagos/cuentas/saldos'),
}
