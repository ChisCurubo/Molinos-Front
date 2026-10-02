// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Anticipos a terceros (adelantos a minero / dueño de volqueta /
// proveedor — incluye "adelanto a proveedores", no hay endpoint separado)
// Prefijo: /api/v1/pagos/anticipos
//
// Al crear: se paga de inmediato como CxP (genera su abono con comprobante) y
// además crea un espejo en Saldo_A_Favor (origen='anticipo') — ese crédito se
// descuenta luego de pagos futuros al mismo tercero (consumo aún no integrado
// en material/flete/agua/mulas: hoy se aplicaría manualmente con
// metodo_pago:"saldo_a_favor" en el abono correspondiente).
//
// ⚠️ La doc no muestra el shape exacto de la respuesta (solo el body de POST):
// los campos abajo son la mejor inferencia — si algo no calza en vivo, avisar.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiDelete } from './client'

type Dec = number | string | null

export type TerceroAnticipo = 'minero' | 'dueno_volqueta' | 'proveedor'
export type EstadoAnticipo = 'activo' | 'usado' | 'anulado' | string

export interface Anticipo {
  id: number
  tercero: TerceroAnticipo
  id_tercero: number
  tercero_nombre?: string | null
  monto: Dec
  monto_usado?: Dec
  saldo_disponible?: Dec
  comprobante_url?: string | null
  fecha?: string
  metodo_pago?: string | null
  descripcion?: string | null
  observaciones?: string | null
  estado?: EstadoAnticipo
}

export interface AnticipoDescuento {
  id: number
  fecha: string
  valor: Dec
  concepto?: string | null
}

export interface AnticipoDetalle extends Anticipo {
  descuentos?: AnticipoDescuento[]
}

export interface CrearAnticipoPayload {
  tercero: TerceroAnticipo
  id: number
  monto: number
  comprobante_url: string
  fecha?: string
  metodo_pago?: string
  descripcion?: string
  observaciones?: string
}

export interface AnticiposFiltro {
  tercero?: TerceroAnticipo
  id?: number
  estado?: string
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosAnticiposApi = {
  crear: (body: CrearAnticipoPayload) => apiPost<Anticipo>('/pagos/anticipos', body),
  listar: (filtro?: AnticiposFiltro) =>
    apiFetch<Anticipo[]>(`/pagos/anticipos${qs({ tercero: filtro?.tercero, id: filtro?.id, estado: filtro?.estado })}`),
  getDetalle: (id: number) => apiFetch<AnticipoDetalle>(`/pagos/anticipos/${id}`),
  // Solo si monto_usado = 0 (nunca se descontó nada).
  anular: (id: number) => apiDelete<{ message?: string }>(`/pagos/anticipos/${id}`),
}
