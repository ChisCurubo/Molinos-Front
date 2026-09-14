// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Pago de MATERIAL (cuentas por pagar agrupadas por minero + abonos)
// Prefijo: /api/v1/pagos · Requiere token (inyectado en client.ts).
//
// Modelo: se agrupan varias volquetas del MISMO minero en una Cuenta_Por_Pagar
// (valor_total = Σ precio_total del material, sin gastos) y se le hacen muchos
// Abonos_CxP hasta cubrir el total. Estado/saldo se recalculan solos en el
// backend tras cada abono/edición. Cada volqueta se paga al mismo % del grupo
// (prorrateo). El comprobante_url es OBLIGATORIO por abono.
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"): usa num().
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

// Un decimal puede llegar como number, string o null desde el backend.
type Dec = number | string | null

export type EstadoCxP = 'pendiente' | 'parcial' | 'pagado'
export type MetodoPago = 'transferencia' | 'nequi' | 'deposito' | 'efectivo' | 'otro'

// ─── Tablero de deudas (fila = una cuenta) ────────────────────────────────────
export interface CuentaMaterialRow {
  id: number
  id_minero: number | null
  minero: string | null
  minero_alias?: string | null
  concepto: string | null
  fecha_limite: string | null
  valor_total: Dec
  valor_pagado: Dec
  saldo: Dec
  estado: EstadoCxP
  num_volquetas?: number
  num_abonos?: number
  created_at?: string
}

/** Análisis anidado de la volqueta (tenor real, oro/plata). */
export interface AnalisisVolqueta {
  numero_analisis?: string | null
  tipo_analisis?: string | null
  porcentaje_humedad?: Dec
  tenor_real?: Dec
  au_gr_x_ton?: Dec
  au_falso?: Dec
  ag_gr_x_ton?: Dec
  au_gramos_totales?: Dec
}

// ─── Detalle: volqueta prorrateada dentro de una cuenta ───────────────────────
export interface CuentaVolqueta {
  /** id de la entrada (material_planta_entrada). Se usa en quitar_entradas. */
  id_entrada: number
  numero_volqueta: number | null
  mina: string | null
  fecha_llegada?: string | null
  fecha?: string | null
  peso_humedo?: Dec
  peso_seco?: Dec
  toneladas_secas?: Dec
  porcentaje_humedad?: Dec
  tenor?: Dec
  gramos_oro?: Dec
  /** 'por_gramo' | 'por_tonelada' (cómo se calculó el precio del material). */
  metodo_precio?: string | null
  precio_unitario?: Dec
  /** Valor del material de la volqueta (precio_total sin gastos) = monto_aplicado. */
  precio_total?: Dec
  monto_aplicado?: Dec
  pagado_volqueta?: Dec
  saldo_volqueta?: Dec
  /** Análisis anidado (puede venir como objeto o lista). */
  analisis?: AnalisisVolqueta[] | AnalisisVolqueta | null
}

// ─── Abono (transferencia) de una cuenta ──────────────────────────────────────
export interface AbonoCxP {
  id: number
  valor: Dec
  fecha_abono: string
  metodo_pago: string | null
  comprobante_url: string | null
  observaciones: string | null
  created_at?: string
}

export interface CuentaMaterialDetalle extends CuentaMaterialRow {
  volquetas: CuentaVolqueta[]
  abonos: AbonoCxP[]
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
export interface CrearCuentaPayload {
  /** ids de entradas a agrupar (mismo minero, precio_total > 0). */
  entradas: number[]
  concepto?: string
  fecha_limite?: string
}

export interface EditarCuentaPayload {
  agregar_entradas?: number[]
  quitar_entradas?: number[]
  concepto?: string
  fecha_limite?: string
}

export interface CrearAbonoPayload {
  valor: number
  fecha_abono: string
  metodo_pago?: MetodoPago | string
  /** OBLIGATORIO: cada abono lleva su soporte. */
  comprobante_url: string
  observaciones?: string
}

export type EditarAbonoPayload = Partial<CrearAbonoPayload>

// ─── Deuda del minero (vista prorrateada v_estado_pago_material) ──────────────
export interface DeudaMinero {
  id_minero: number
  minero?: string | null
  total_material?: Dec
  total_pagado?: Dec
  saldo?: Dec
  [k: string]: unknown
}

// ─── Helper querystring ───────────────────────────────────────────────────────
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export interface CuentasFiltro {
  id_minero?: number
  estado?: EstadoCxP
}

export interface CreatedCuentaResponse {
  id?: number
  message?: string
}

// ════════════════════════════════════════════════════════════════════════════
// API
// ════════════════════════════════════════════════════════════════════════════

export const pagosMaterialApi = {
  // Tablero de deudas (cuentas de pago). Filtros: id_minero, estado.
  getCuentas: (filtro?: CuentasFiltro) =>
    apiFetch<CuentaMaterialRow[]>(`/pagos/material${qs({ id_minero: filtro?.id_minero, estado: filtro?.estado })}`),

  // Detalle: totales + volquetas con prorrateo + lista de abonos.
  getCuenta: (id: number) => apiFetch<CuentaMaterialDetalle>(`/pagos/material/${id}`),

  // Crear cuenta agrupada (valor_total = Σ precio_total; el minero se deriva).
  crearCuenta: (body: CrearCuentaPayload) => apiPost<CreatedCuentaResponse>('/pagos/material', body),

  // Editar cuenta: agregar/quitar volquetas, concepto, fecha_limite.
  editarCuenta: (id: number, body: EditarCuentaPayload) => apiPatch<CuentaMaterialDetalle>(`/pagos/material/${id}`, body),

  // Anular (borrado lógico). 409 si ya tiene abonos.
  anularCuenta: (id: number) => apiDelete<{ message?: string }>(`/pagos/material/${id}`),

  // Registrar un abono (comprobante_url OBLIGATORIO; valor > 0 y ≤ saldo).
  crearAbono: (idCuenta: number, body: CrearAbonoPayload) =>
    apiPost<CreatedCuentaResponse>(`/pagos/material/${idCuenta}/abonos`, body),

  // Editar un abono (recalcula la cuenta; no deja pasar del valor_total).
  editarAbono: (idAbono: number, body: EditarAbonoPayload) =>
    apiPatch<{ message?: string }>(`/pagos/material/abonos/${idAbono}`, body),

  // Eliminar un abono (la cuenta vuelve a parcial/pendiente).
  eliminarAbono: (idAbono: number) => apiDelete<{ message?: string }>(`/pagos/material/abonos/${idAbono}`),

  // Deuda del minero desde la vista prorrateada.
  getDeudaMinero: (idMinero: number) => apiFetch<DeudaMinero>(`/pagos/deuda/material/minero/${idMinero}`),
}
