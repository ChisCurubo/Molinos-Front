// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Combustible (ACPM)
// Prefijo: /api/v1/pagos/combustible
//
// 1. Registro de consumo: CRUD completo (2026-09-16). Un registro que ya viene
//    de material/flete/agua (trae id_material_planta_entrada / id_flete / id_agua)
//    no se puede editar/eliminar aquí — el backend responde 400. Solo los
//    registros manuales (tanqueo/suministro cargado por este módulo) son editables.
// 2. Reportes/KPIs: resumen mensual y dashboard de KPIs.
// 3. Pago a la gasolinera (línea de crédito): cascada por gasolinera + mes,
//    igual patrón que Flete/Agua/Mulas.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete } from './client'

type Dec = number | string | null

export type TipoConsumoCombustible = 'vehiculo' | 'planta' | 'maquinaria' | 'otro'
export type FormaPagoCombustible = 'efectivo' | 'credito'
export type EstadoCuentaPago = 'pendiente' | 'parcial' | 'pagado' | 'anulado'
export type MetodoPagoCombustible = 'efectivo' | 'transferencia' | 'nequi' | 'deposito' | 'consignacion' | 'otro'

// ─── Registro de consumo ───────────────────────────────────────────────────────
export interface CombustibleRegistro {
  id: number
  fecha: string
  tipo_consumo?: TipoConsumoCombustible | string | null
  forma_pago?: FormaPagoCombustible | string | null
  id_gasolinera?: number | null
  gasolinera?: string | null
  id_planta?: number | null
  planta?: string | null
  id_dueno_volqueta?: number | null
  dueno_volqueta?: string | null
  id_vehiculo?: number | null
  vehiculo?: string | null
  placa?: string | null
  valor?: Dec
  galones?: Dec
  descripcion?: string | null
  observaciones?: string | null
  comprobante_url?: string | null
  // Presentes solo si el registro fue generado por otro módulo (referencia informativa).
  id_material_planta_entrada?: number | null
  id_flete?: number | null
  id_agua?: number | null
  // Estado de pago (2026-09-18): efectivo siempre "pagado"; crédito según los
  // abonos reales de su cuenta con la gasolinera.
  estado_pago?: EstadoCuentaPago | string | null
  total_pagado?: Dec
  saldo_pendiente?: Dec
}

/** Editable/eliminable en este módulo solo si su cuenta con la gasolinera sigue "pendiente"
 *  (sin agrupar ni abonar). El backend responde 409 para cualquier otro estado. */
export function esConsumoEditable(r: CombustibleRegistro): boolean {
  return r.estado_pago === 'pendiente'
}

export interface CombustibleFiltro {
  desde?: string
  hasta?: string
  id_gasolinera?: number
  id_dueno_volqueta?: number
  tipo_consumo?: string
  forma_pago?: string
}

export interface CrearCombustiblePayload {
  tipo_consumo?: TipoConsumoCombustible
  forma_pago?: FormaPagoCombustible
  id_gasolinera?: number
  id_planta?: number
  id_dueno_volqueta?: number
  id_vehiculo?: number
  fecha?: string
  descripcion?: string
  valor: number
  comprobante_url?: string
}
export type EditarCombustiblePayload = Partial<CrearCombustiblePayload>

export interface NetoFleteDueno {
  id_dueno_volqueta: number
  dueno_volqueta?: string
  flete_bruto?: Dec
  acpm_total?: Dec
  flete_neto?: Dec
}

// ─── Reportes / KPIs ────────────────────────────────────────────────────────────
export interface ResumenMensualCombustible {
  periodo: string // "YYYY-MM"
  cantidad: number
  total: Dec
  total_efectivo: Dec
  total_credito: Dec
  total_vehiculo: Dec
  total_planta: Dec
  total_maquinaria?: Dec
  total_otro: Dec
}

export interface TopGasolineraKpi {
  id_gasolinera: number
  gasolinera?: string
  total: Dec
  cantidad: number
}
export interface TopDuenoAdelantoKpi {
  id_dueno_volqueta: number
  dueno_volqueta?: string
  total_adelantado: Dec
  cantidad: number
}
export interface KpisCombustible {
  mes_actual: ResumenMensualCombustible
  mes_anterior: ResumenMensualCombustible
  variacion_pct: number
  promedio_mensual_ultimos_12: Dec
  total_historico_efectivo: Dec
  total_historico_credito: Dec
  top_gasolineras: TopGasolineraKpi[]
  top_duenos_adelanto: TopDuenoAdelantoKpi[]
  meses: ResumenMensualCombustible[]
}

// ─── Pago a la gasolinera (línea de crédito) ───────────────────────────────────
export interface GasolineraDeuda {
  id: number
  nombre: string
  alias?: string | null
  total_credito: Dec
  abonado: Dec
  saldo_pendiente: Dec
  credito_sobrepago?: Dec
}

export interface AbonoGasolinera {
  id: number
  id_gasopago?: number
  fecha_abono: string
  valor: Dec
  metodo_pago: string | null
  comprobante_url: string | null
  observaciones: string | null
  created_at?: string
  // ── Solo presentes en el reporte de historial ──
  concepto?: string
  id_gasolinera?: number
  gasolinera?: string
}

export interface GasolineraConsumoResumen {
  id_combustible: number
  fecha: string
  tipo_consumo?: string | null
  descripcion?: string | null
  monto_aplicado: Dec
  pagado?: Dec
  saldo?: Dec
}

export interface GasolineraCuentaMes {
  id_cuenta: number
  concepto: string
  periodo: string
  valor_total: Dec
  valor_pagado?: Dec
  saldo?: Dec
  estado: EstadoCuentaPago | string
  num_consumos?: number
  consumos: GasolineraConsumoResumen[]
  abonos: AbonoGasolinera[]
}

export interface GasolineraResumenDetalle {
  total_credito: Dec
  total_pagado: Dec
  saldo_pendiente: Dec
  credito_sobrepago?: Dec
}

export interface GasolineraEstadoCuenta {
  id_gasolinera: number
  resumen: GasolineraResumenDetalle
  meses: GasolineraCuentaMes[]
}

export interface CrearAbonoGasolineraPayload {
  valor: number
  metodo_pago?: MetodoPagoCombustible | string
  comprobante_url: string
  fecha_abono?: string
}
export interface EditarAbonoGasolineraPayload extends Partial<CrearAbonoGasolineraPayload> {
  observaciones?: string
}

export interface CuentaAplicada {
  id_cuenta: number
  periodo?: string
  aplicado: Dec
  estado: EstadoCuentaPago | string
}
export interface AbonoGasolineraResultado {
  aplicado_a: CuentaAplicada[]
  total_aplicado: Dec
  saldo_a_favor_generado?: Dec
}

export interface EditarAbonoGasolineraResultado {
  abono: AbonoGasolinera
  cuenta: { id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }
}

export interface Paginacion {
  page: number
  limit: number
  total: number
  total_pages: number
}
export interface HistorialAbonosGasolineraFiltro {
  id_gasopago?: number
  page?: number
  limit?: number
}
export interface HistorialAbonosGasolineraResponse {
  abonos: AbonoGasolinera[]
  pagination: Paginacion
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosCombustibleApi = {
  // ── 1. Registro de consumo (CRUD) ──────────────────────────────────────────
  listar: (filtro?: CombustibleFiltro) =>
    apiFetch<CombustibleRegistro[]>(`/pagos/combustible${qs({
      desde: filtro?.desde, hasta: filtro?.hasta, id_gasolinera: filtro?.id_gasolinera,
      id_dueno_volqueta: filtro?.id_dueno_volqueta, tipo_consumo: filtro?.tipo_consumo,
      forma_pago: filtro?.forma_pago,
    })}`),
  crear: (body: CrearCombustiblePayload) => apiPost<CombustibleRegistro>('/pagos/combustible', body),
  getDetalle: (id: number) => apiFetch<CombustibleRegistro>(`/pagos/combustible/${id}`),
  editar: (id: number, body: EditarCombustiblePayload) => apiPut<CombustibleRegistro>(`/pagos/combustible/${id}`, body),
  eliminar: (id: number) => apiDelete<{ message?: string }>(`/pagos/combustible/${id}`),
  getNetoFleteDueno: (idDueno: number) => apiFetch<NetoFleteDueno>(`/pagos/combustible/dueno/${idDueno}/neto-flete`),

  // ── 2. Reportes / KPIs ────────────────────────────────────────────────────
  getResumenMensual: (anio?: number) =>
    apiFetch<ResumenMensualCombustible[]>(`/pagos/combustible/resumen-mensual${qs({ anio })}`),
  getKpis: () => apiFetch<KpisCombustible>('/pagos/combustible/kpis'),

  // ── 3. Pago a la gasolinera (línea de crédito) ───────────────────────────
  getDeuda: () => apiFetch<GasolineraDeuda[]>('/pagos/combustible/pagos/deuda'),
  getGasolineraDetalle: (id: number) => apiFetch<GasolineraEstadoCuenta>(`/pagos/combustible/pagos/gasolinera/${id}`),
  crearAbonoGasolinera: (id: number, body: CrearAbonoGasolineraPayload) =>
    apiPost<AbonoGasolineraResultado>(`/pagos/combustible/pagos/gasolinera/${id}/abonos`, body),
  getHistorialAbonos: (filtro?: HistorialAbonosGasolineraFiltro) =>
    apiFetch<HistorialAbonosGasolineraResponse>(`/pagos/combustible/pagos/abonos${qs({
      id_gasopago: filtro?.id_gasopago, page: filtro?.page, limit: filtro?.limit,
    })}`),
  editarAbonoGasolinera: (idAbono: number, body: EditarAbonoGasolineraPayload) =>
    apiPatch<EditarAbonoGasolineraResultado>(`/pagos/combustible/pagos/abonos/${idAbono}`, body),
  eliminarAbonoGasolinera: (idAbono: number) =>
    apiDelete<{ id: number; concepto: string; valor_pagado: Dec; saldo: Dec; estado: string }>(`/pagos/combustible/pagos/abonos/${idAbono}`),
}
