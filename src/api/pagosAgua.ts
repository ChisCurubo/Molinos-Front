// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Pago de AGUA (cuentas mensuales por dueño de volqueta + abonos)
// Prefijo: /api/v1/pagos/agua · Requiere token (inyectado en client.ts).
//
// Modelo: cada dueño acumula una cuenta mensual (Cuenta_Por_Pagar). Los abonos se
// registran a nivel de DUEÑO (no de mes) y el backend los aplica en cascada
// (mes más viejo primero). Cada registro de agua ya trae su ACPM descontado
// (neto). Si el ACPM adelantado superó la deuda, queda como credito_gasolina; si
// el dueño paga de más, el excedente queda como credito_sobrepago (solo se
// muestra; no hay endpoint para gastarlo aquí — eso es exclusivo de material).
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"): usa num() de
// '@/api/material' en la UI.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export type EstadoCuentaPago = 'pendiente' | 'parcial' | 'pagado' | 'anulado'
export type MetodoPagoAgua = 'transferencia' | 'nequi' | 'deposito' | 'efectivo' | 'otro'

// ─── Dashboard (fila = un dueño con saldo o crédito) ──────────────────────────
export interface DuenoAguaResumen {
  id: number
  nombre: string
  alias?: string | null
  banco?: string | null
  numero_cuenta?: string | null
  bruto_total: Dec
  acpm_total: Dec
  neto_total: Dec
  abonado: Dec
  credito_gasolina?: Dec
  credito_sobrepago?: Dec
}

// ─── Un registro de agua dentro de una cuenta mensual ─────────────────────────
export interface AguaRegistroPago {
  id_agua: number
  fecha: string
  valor_viaje?: Dec
  cantidad_viajes?: Dec
  bruto?: Dec
  acpm: Dec
  neto: Dec
  estado_pago: EstadoCuentaPago | string
  pagado: Dec
  saldo: Dec
}

// ─── Abono aplicado a una cuenta (mes) ────────────────────────────────────────
export interface AbonoPagoAgua {
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
export interface AguaCuentaMes {
  id_cuenta: number
  concepto: string
  periodo: string
  valor_total: Dec
  pagado?: Dec
  estado: EstadoCuentaPago | string
  num_registros?: number
  registros: AguaRegistroPago[]
  abonos: AbonoPagoAgua[]
}

export interface AguaDuenoResumenDetalle {
  bruto_total: Dec
  acpm_total: Dec
  neto_total: Dec
  total_pagado: Dec
  credito_gasolina?: Dec
  credito_sobrepago?: Dec
}

export interface AguaDuenoDetalle {
  id_dueno: number
  resumen: AguaDuenoResumenDetalle
  meses: AguaCuentaMes[]
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
export interface CrearAbonoAguaPayload {
  valor: number
  fecha_abono: string
  metodo_pago?: MetodoPagoAgua | string
  comprobante_url?: string
  observaciones?: string
}
export type EditarAbonoAguaPayload = Partial<CrearAbonoAguaPayload>

export interface CuentaAplicada {
  id_cuenta: number
  periodo: string
  aplicado: Dec
  estado: EstadoCuentaPago | string
}
export interface AbonoAguaResultado {
  aplicado_a: CuentaAplicada[]
  total_aplicado: Dec
  saldo_a_favor_generado?: Dec
}

export interface EditarAbonoAguaResultado {
  abono: AbonoPagoAgua
  cuenta: { id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }
}

// ─── Historial (reporte plano paginado) ───────────────────────────────────────
export interface HistorialAguaFiltro {
  id_dueno_volqueta?: number
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
export interface HistorialAguaResponse {
  abonos: AbonoPagoAgua[]
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

export const pagosAguaApi = {
  // Dashboard: solo dueños con saldo_pendiente > 0 o algún crédito.
  getDashboard: () => apiFetch<DuenoAguaResumen[]>('/pagos/agua/deuda'),

  // Estado de cuenta de un dueño. mes/anio opcionales para filtrar.
  getDuenoDetalle: (id: number, filtro?: { mes?: number; anio?: number }) =>
    apiFetch<AguaDuenoDetalle>(`/pagos/agua/dueno/${id}${qs({ mes: filtro?.mes, anio: filtro?.anio })}`),

  // Registrar abono (se aplica en cascada, mes más viejo primero). 409 si no hay deuda.
  crearAbono: (idDueno: number, body: CrearAbonoAguaPayload) =>
    apiPost<AbonoAguaResultado>(`/pagos/agua/dueno/${idDueno}/abonos`, body),

  // Editar un abono existente.
  editarAbono: (idAbono: number, body: EditarAbonoAguaPayload) =>
    apiPatch<EditarAbonoAguaResultado>(`/pagos/agua/abonos/${idAbono}`, body),

  // Eliminar un abono.
  eliminarAbono: (idAbono: number) =>
    apiDelete<{ id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }>(`/pagos/agua/abonos/${idAbono}`),

  // Historial/reporte general de abonos (paginado, tope 50 por página).
  getHistorial: (filtro?: HistorialAguaFiltro) =>
    apiFetch<HistorialAguaResponse>(`/pagos/agua/abonos${qs({
      id_dueno_volqueta: filtro?.id_dueno_volqueta, desde: filtro?.desde, hasta: filtro?.hasta,
      metodo_pago: filtro?.metodo_pago, page: filtro?.page, limit: filtro?.limit,
    })}`),
}
