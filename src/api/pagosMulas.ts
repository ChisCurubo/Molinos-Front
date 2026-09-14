// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Pago de MULAS (despachos de concentrado a proveedor transportador)
// Prefijo: /api/v1/pagos/mulas · Requiere token (inyectado en client.ts).
//
// Modelo (2026-09-13, revisado): cada DESPACHO es su propia Cuenta_Por_Pagar
// (no se agrupan por mes), pero el ABONO ya NO se registra por despacho — se
// registra a nivel PROVEEDOR (`/proveedor/:idProveedor/abonos`) y se aplica en
// cascada sobre todas las cuentas abiertas de ese proveedor (despacho más viejo
// primero), igual que flete/agua. Si sobra plata, genera Saldo_A_Favor (no error).
// `valor` del despacho = lo que se debe pagar (la deuda). El concepto de
// valor_correcto/diferencia se retiró del módulo; el comprobante ahora vive
// únicamente en el abono, no en el despacho.
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"): usa num() de
// '@/api/material' en la UI.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export type EstadoCuentaPago = 'pendiente' | 'parcial' | 'pagado' | 'anulado'
export type MetodoPagoMula = 'efectivo' | 'consignacion' | 'transferencia' | 'nequi' | 'descuento_nomina' | 'otro'

// ─── Despacho (un registro de Mulas) ──────────────────────────────────────────
export interface MulaDespacho {
  id: number
  id_proveedor: number
  proveedor?: string | null
  valor: Dec
  fecha: string
  id_viaje?: number | null
  numero_viaje?: Dec
  concepto?: string | null
  factura_num?: string | null
  foto_factura_url?: string | null
  pct_retencion?: Dec
  retencion?: Dec
  abono_neto?: Dec
  total_pagado?: Dec
  saldo_pendiente?: Dec
  estado_pago?: EstadoCuentaPago | string
}

// ─── KPIs (/resumen) ───────────────────────────────────────────────────────────
export interface MulasResumen {
  total_despachos: number
  valor_facturado_total: Dec
  retencion_total: Dec
  abono_neto_total: Dec
  total_pagado: Dec
  total_pendiente: Dec
}

// ─── Abono ─────────────────────────────────────────────────────────────────────
export interface AbonoMula {
  id: number
  id_cuenta_pagar?: number
  fecha_abono: string
  valor: Dec
  metodo_pago: string | null
  comprobante_url: string | null
  observaciones: string | null
  created_at?: string
  // ── Solo presentes en el reporte de historial (endpoint 10) ──
  concepto?: string
  id_proveedor?: number
  proveedor?: string
}

// ─── Detalle (mula + cuenta CxP + abonos) ─────────────────────────────────────
export interface CuentaMula {
  id?: number
  concepto?: string
  valor_total?: Dec
  pagado?: Dec
  saldo?: Dec
  estado?: EstadoCuentaPago | string
}
export interface MulaDetalle extends MulaDespacho {
  cuenta: CuentaMula
  abonos: AbonoMula[]
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
export interface CrearMulaPayload {
  id_proveedor: number
  valor: number
  fecha?: string
  id_viaje?: number
  concepto?: string
  factura_num?: string
  foto_factura_url?: string
}
export interface EditarMulaPayload {
  id_viaje?: number | null
  fecha?: string
  concepto?: string
  factura_num?: string
  foto_factura_url?: string
  valor?: number
}

// Abono a nivel PROVEEDOR: se aplica en cascada (despacho más viejo primero)
// sobre todas las cuentas abiertas de ese proveedor.
export interface CrearAbonoMulaProveedorPayload {
  valor: number
  comprobante_url: string
  fecha_abono?: string
  metodo_pago?: MetodoPagoMula | string
}
export interface CuentaAplicada {
  id_cuenta: number
  periodo?: string
  aplicado: Dec
  estado: EstadoCuentaPago | string
}
export interface AbonoMulaProveedorResultado {
  aplicado_a: CuentaAplicada[]
  total_aplicado: Dec
  saldo_a_favor_generado?: Dec
}

// Edición/eliminación de un abono puntual ya creado (sin cambios de contrato).
export interface EditarAbonoMulaPayload {
  valor?: number
  comprobante_url?: string
  fecha_abono?: string
  metodo_pago?: MetodoPagoMula | string
  observaciones?: string
}
export interface EditarAbonoMulaResultado {
  abono: AbonoMula
  cuenta: CuentaMula
}
export interface EliminarAbonoMulaResultado {
  message?: string
  data: CuentaMula
}

// ─── Filtros ───────────────────────────────────────────────────────────────────
export interface ListaMulasFiltro {
  id_proveedor?: number
  id_viaje?: number
  estado?: EstadoCuentaPago | string
}
export interface ResumenMulasFiltro {
  desde?: string
  hasta?: string
  id_proveedor?: number
}
export interface HistorialMulasFiltro {
  id_proveedor?: number
  desde?: string
  hasta?: string
  metodo_pago?: string
  page?: number
  limit?: number
}
export interface Paginacion {
  page: number
  limit: number
  total: number
  total_pages: number
}
export interface HistorialMulasResponse {
  abonos: AbonoMula[]
  pagination: Paginacion
}

// ─── Trazabilidad por viaje (/pagos/mulas/viajes) ─────────────────────────────
export interface AbonoMulaViajeResumen {
  id: number
  valor: Dec
  comprobante_url?: string | null
}
export interface MulaViajeTrazabilidad {
  id_mula: number
  id_viaje: number
  numero_viaje: Dec
  proveedor: string
  valor: Dec
  id_cuenta_pagar: number
  valor_total: Dec
  valor_pagado: Dec
  saldo: Dec
  estado: EstadoCuentaPago | string
  abonos: AbonoMulaViajeResumen[]
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

// ════════════════════════════════════════════════════════════════════════════
// API
// ════════════════════════════════════════════════════════════════════════════

export const pagosMulasApi = {
  // Registrar un despacho (id_proveedor + valor requeridos).
  crearDespacho: (body: CrearMulaPayload) => apiPost<MulaDespacho>('/pagos/mulas', body),

  // KPIs del período (todos los filtros opcionales).
  getResumen: (filtro?: ResumenMulasFiltro) =>
    apiFetch<MulasResumen>(`/pagos/mulas/resumen${qs({
      desde: filtro?.desde, hasta: filtro?.hasta, id_proveedor: filtro?.id_proveedor,
    })}`),

  // Listar despachos (cada uno ya trae proveedor, retención, abono_neto, saldo, estado).
  listar: (filtro?: ListaMulasFiltro) =>
    apiFetch<MulaDespacho[]>(`/pagos/mulas${qs({
      id_proveedor: filtro?.id_proveedor, id_viaje: filtro?.id_viaje, estado: filtro?.estado,
    })}`),

  // Detalle de un despacho: mula + cuenta (CxP) + abonos.
  getDetalle: (id: number) => apiFetch<MulaDetalle>(`/pagos/mulas/${id}`),

  // Editar un despacho (si cambia `valor`, recalcula el neto de la cuenta).
  editarDespacho: (id: number, body: EditarMulaPayload) => apiPatch<MulaDespacho>(`/pagos/mulas/${id}`, body),

  // Eliminar un despacho completo. 409 si ya tiene abonos.
  eliminarDespacho: (id: number) => apiDelete<{ message?: string }>(`/pagos/mulas/${id}`),

  // Registrar abono a nivel PROVEEDOR: cascada sobre todas sus cuentas abiertas
  // (despacho más viejo primero). 409 si el proveedor no tiene deuda pendiente.
  crearAbonoProveedor: (idProveedor: number, body: CrearAbonoMulaProveedorPayload) =>
    apiPost<AbonoMulaProveedorResultado>(`/pagos/mulas/proveedor/${idProveedor}/abonos`, body),

  // Editar un abono existente.
  editarAbono: (idAbono: number, body: EditarAbonoMulaPayload) =>
    apiPatch<EditarAbonoMulaResultado>(`/pagos/mulas/abonos/${idAbono}`, body),

  // Eliminar un abono. 409 si el sobrepago que generó ya se usó.
  eliminarAbono: (idAbono: number) => apiDelete<EliminarAbonoMulaResultado>(`/pagos/mulas/abonos/${idAbono}`),

  // Historial/reporte general de abonos (paginado, tope 50 por página).
  getHistorial: (filtro?: HistorialMulasFiltro) =>
    apiFetch<HistorialMulasResponse>(`/pagos/mulas/abonos${qs({
      id_proveedor: filtro?.id_proveedor, desde: filtro?.desde, hasta: filtro?.hasta,
      metodo_pago: filtro?.metodo_pago, page: filtro?.page, limit: filtro?.limit,
    })}`),

  // Trazabilidad: cada mula vinculada a un viaje, con su proveedor, cuenta y abonos.
  getViajesTrazabilidad: () => apiFetch<MulaViajeTrazabilidad[]>('/pagos/mulas/viajes'),
}
