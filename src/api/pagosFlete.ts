// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Pago de FLETE de volquetas (cuentas mensuales por dueño + abonos)
// Prefijo: /api/v1/pagos/flete · Requiere token (inyectado en client.ts).
//
// Mismo motor que pagosAgua.ts (ver ese archivo para el modelo mental completo):
// cuenta mensual por dueño, abonos en cascada (mes más viejo primero), flete
// NETO = costo_volqueta − ACPM (con arrastre de crédito de gasolina entre
// viajes). No hay endpoint para gastar credito_sobrepago aquí (solo material).
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"): usa num() de
// '@/api/material' en la UI.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export type EstadoCuentaPago = 'pendiente' | 'parcial' | 'pagado' | 'anulado'
export type MetodoPagoFlete = 'transferencia' | 'nequi' | 'deposito' | 'efectivo' | 'otro'

// ─── Dashboard (fila = un dueño con saldo o crédito) ──────────────────────────
export interface DuenoFleteResumen {
  id: number
  nombre: string
  alias?: string | null
  banco?: string | null
  numero_cuenta?: string | null
  flete_bruto_total: Dec
  acpm_total: Dec
  flete_neto_total: Dec
  abonado: Dec
  credito_gasolina?: Dec
  credito_sobrepago?: Dec
}

// ─── Un viaje dentro de una cuenta mensual ─────────────────────────────────────
export interface FleteViajePago {
  id_entrada: number
  numero_volqueta: number | null
  fecha_llegada: string
  placa?: string | null
  flete_bruto: Dec
  acpm: Dec
  flete_neto: Dec
  estado_pago_flete: EstadoCuentaPago | string
  pagado_flete: Dec
  saldo_flete: Dec
}

// ─── Abono aplicado a una cuenta (mes) ────────────────────────────────────────
export interface AbonoPagoFlete {
  id: number
  id_cuenta_pagar?: number
  fecha_abono: string
  valor: Dec
  metodo_pago: string | null
  comprobante_url: string | null
  observaciones: string | null
  created_at?: string
  // ── Solo presentes en el reporte de historial (endpoint 6) ──
  concepto?: string
  id_dueno_volqueta?: number
  dueno_volqueta?: string
}

// ─── Una cuenta mensual dentro del detalle de un dueño ────────────────────────
export interface FleteCuentaMes {
  id_cuenta: number
  concepto: string
  periodo: string
  valor_total: Dec
  pagado?: Dec
  estado: EstadoCuentaPago | string
  num_registros?: number
  viajes: FleteViajePago[]
  abonos: AbonoPagoFlete[]
}

export interface FleteDuenoResumenDetalle {
  flete_bruto_total: Dec
  acpm_total: Dec
  flete_neto_total: Dec
  total_pagado: Dec
  credito_gasolina?: Dec
  credito_sobrepago?: Dec
}

export interface FleteDuenoDetalle {
  id_dueno: number
  resumen: FleteDuenoResumenDetalle
  meses: FleteCuentaMes[]
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
export interface CrearAbonoFletePayload {
  valor: number
  fecha_abono: string
  metodo_pago?: MetodoPagoFlete | string
  comprobante_url?: string
  observaciones?: string
}
export type EditarAbonoFletePayload = Partial<CrearAbonoFletePayload>

export interface CuentaAplicada {
  id_cuenta: number
  periodo: string
  aplicado: Dec
  estado: EstadoCuentaPago | string
}
export interface AbonoFleteResultado {
  aplicado_a: CuentaAplicada[]
  total_aplicado: Dec
  saldo_a_favor_generado?: Dec
}

export interface EditarAbonoFleteResultado {
  abono: AbonoPagoFlete
  cuenta: { id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }
}

// ─── Historial (reporte plano paginado) ───────────────────────────────────────
export interface HistorialFleteFiltro {
  id_dueno_volqueta?: number
  page?: number
  limit?: number
}
export interface Paginacion {
  page: number
  limit: number
  total: number
  total_pages: number
}
export interface HistorialFleteResponse {
  abonos: AbonoPagoFlete[]
  pagination: Paginacion
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

export const pagosFleteApi = {
  // Dashboard: solo dueños con saldo_pendiente > 0 o algún crédito.
  getDashboard: () => apiFetch<DuenoFleteResumen[]>('/pagos/flete/deuda'),

  // Estado de cuenta de un dueño. mes/anio opcionales para filtrar.
  getDuenoDetalle: (id: number, filtro?: { mes?: number; anio?: number }) =>
    apiFetch<FleteDuenoDetalle>(`/pagos/flete/dueno/${id}${qs({ mes: filtro?.mes, anio: filtro?.anio })}`),

  // Registrar abono (se aplica en cascada, mes más viejo primero). 409 si no hay deuda.
  crearAbono: (idDueno: number, body: CrearAbonoFletePayload) =>
    apiPost<AbonoFleteResultado>(`/pagos/flete/dueno/${idDueno}/abonos`, body),

  // Editar un abono existente.
  editarAbono: (idAbono: number, body: EditarAbonoFletePayload) =>
    apiPatch<EditarAbonoFleteResultado>(`/pagos/flete/abonos/${idAbono}`, body),

  // Eliminar un abono.
  eliminarAbono: (idAbono: number) =>
    apiDelete<{ id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }>(`/pagos/flete/abonos/${idAbono}`),

  // Historial/reporte general de abonos (paginado, tope 50 por página).
  getHistorial: (filtro?: HistorialFleteFiltro) =>
    apiFetch<HistorialFleteResponse>(`/pagos/flete/abonos${qs({
      id_dueno_volqueta: filtro?.id_dueno_volqueta, page: filtro?.page, limit: filtro?.limit,
    })}`),
}
