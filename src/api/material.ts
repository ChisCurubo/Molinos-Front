// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Módulo Material (Molinos de Colombia)
// Base URL y token se inyectan en client.ts (VITE_API_URL + Bearer).
// Una función por endpoint, con tipos de request y response.
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"). Usa `num()`
//    para convertirlos antes de calcular/formatear.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete } from './client'

/** Convierte decimales-string de MySQL (`"120.0000"`) a number. */
export function num(v: unknown): number {
  if (v == null || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Igual que `num()` pero preserva `null` (para campos opcionales). */
export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Un decimal puede llegar como number, string o null desde el backend.
type Dec = number | string | null

// ─── Tipos compartidos ──────────────────────────────────────────────────────

export type MetodoCalculo = 'por_gramo' | 'por_tonelada'
export type EstadoEntrada = 'pendiente' | 'en_proceso' | 'incluida_viaje' | 'pagada' | 'cancelada'
export type EstadoPagoFlete = 'pendiente' | 'parcial' | 'pagado' | 'no_aplica'
export type AlcancePrecio = 'minero' | 'zona' | 'general'

// ════════════════════════════════════════════════════════════════════════════
// 2.1 · ZONAS (con tarifa de flete)
// ════════════════════════════════════════════════════════════════════════════

export interface Zona {
  id: number
  nombre: string
  /** Flete vigente por tonelada. Puede ser null. */
  tarifa: Dec | null
}

export interface ZonaDetalle {
  id: number
  nombre: string
  descripcion: string | null
}

export interface ZonaCreatePayload {
  nombre: string
  descripcion?: string
  /** Flete inicial por tonelada (alias: `tarifa`). */
  valor_tonelada?: number
  tarifa?: number
}

/** Editar zona. Cambiar la tarifa versiona el historial: NO enviar otras claves junto a ella. */
export interface ZonaUpdatePayload {
  nombre?: string
  descripcion?: string
  valor_tonelada?: number
  tarifa?: number
}

// ════════════════════════════════════════════════════════════════════════════
// 2.2 · MINEROS
// ════════════════════════════════════════════════════════════════════════════

export interface Minero {
  id: number
  nombre: string // MAYÚSCULAS
  alias: string | null
  metodo_calculo: MetodoCalculo
  estado: string
}

export interface MineroConMinas extends Minero {
  minas: {
    id: number
    nombre: string
    ubicacion: string | null
    estado: string
    zona_id: number | null
    zona: string | null
  }[]
}

export interface MineroCreatePayload {
  nombre: string
  alias?: string
  metodo_calculo?: MetodoCalculo // default 'por_gramo'
}

export interface MineroUpdatePayload {
  nombre?: string
  alias?: string
  metodo_calculo?: MetodoCalculo
  estado?: string
}

// ════════════════════════════════════════════════════════════════════════════
// 2.3 · MINAS
// ════════════════════════════════════════════════════════════════════════════

export interface Mina {
  id: number
  nombre: string
  ubicacion: string | null
  estado: string
  minero_id: number | null
  minero: string | null
  minero_alias: string | null
  zona: string | null
  zona_id: number | null
}

export interface MinaDetalle extends Mina {
  metodo_calculo: MetodoCalculo | null
  banco: string | null
  numero_cuenta: string | null
  nequi: boolean | number | null
  tarifa_flete_tonelada: Dec | null
}

export interface MinaCreatePayload {
  nombre: string
  id_minero?: number
  id_zona?: number
  ubicacion?: string
  estado?: string // default 'activa'
}

/** Editar mina. Solo columnas reales (ignora alias del GET). */
export interface MinaUpdatePayload {
  nombre?: string
  id_minero?: number
  id_zona?: number
  ubicacion?: string
  estado?: string
}

export interface MinaEntrada {
  id: number
  numero_volqueta: number
  fecha_llegada: string
  placa: string | null
  peso_llegada_planta: Dec
  total_material_seco: Dec | null
  tenor: Dec | null
  precio_total: Dec | null
  estado: EstadoEntrada
}

export interface MinaResumen {
  mina: string
  minero: string | null
  total_entradas: number
  total_bruto_ton: Dec
  total_seco_ton: Dec
  tenor_promedio: Dec
  total_gramos_au: Dec
  total_pagado_minero: Dec
  total_flete: Dec
  total_material: Dec
}

// ════════════════════════════════════════════════════════════════════════════
// 2.4 · DUEÑOS DE VOLQUETA
// ════════════════════════════════════════════════════════════════════════════

export interface DuenoVolqueta {
  id: number
  nombre: string
  titular: string | null
  cc: string | null
  banco: string | null
  numero_cuenta: string | null
  alias: string | null
  telefono: string | null
  ciudad: string | null
  nequi: boolean | number | null
  estado: string
}

export interface DuenoCreatePayload {
  nombre: string
  titular?: string
  cc?: string
  banco?: string
  numero_cuenta?: string
  alias?: string
  telefono?: string
  ciudad?: string
  nequi?: boolean
  estado?: string
}

export type DuenoUpdatePayload = Partial<DuenoCreatePayload>

export interface VehiculoDeDueno {
  id: number
  placa: string
  tipo_vehiculo: string | null
  estado_pago: string | null
  activo: boolean | number
}

// ════════════════════════════════════════════════════════════════════════════
// 2.5 · VOLQUETAS (vehículos)
// ════════════════════════════════════════════════════════════════════════════

export interface Volqueta {
  id: number
  placa: string
  tipo_vehiculo: string | null
  conductor: string | null
  capacidad_ton: Dec | null
  estado_pago: string | null
  activo: boolean | number
  dueno_id: number | null
  dueno: string | null
  dueno_nombre: string | null
  dueno_alias: string | null
}

export interface VolquetaDetalle {
  id: number
  placa: string
  tipo_vehiculo: string | null
  conductor: string | null
  conductor_cc: string | null
  capacidad_ton: Dec | null
  estado_pago: string | null
  activo: boolean | number
  created_at: string
  dueno_id: number | null
  dueno: string | null
  alias: string | null
  banco: string | null
  numero_cuenta: string | null
  nequi: boolean | number | null
}

export interface VolquetaCreatePayload {
  id_dueno_volqueta: number
  placa: string
  tipo_vehiculo?: string
  conductor?: string
  conductor_cc?: string
  capacidad_ton?: number
  activo?: 0 | 1 // default 1
}

export type VolquetaUpdatePayload = Partial<Omit<VolquetaCreatePayload, 'id_dueno_volqueta'>> & {
  id_dueno_volqueta?: number
}

// ════════════════════════════════════════════════════════════════════════════
// 2.6 · PRECIOS DE MATERIAL POR TENOR (pago al minero)
// ════════════════════════════════════════════════════════════════════════════

export interface Precio {
  id: number
  id_minero: number | null
  id_zona: number | null
  metodo: MetodoCalculo
  precio_por_gramo: Dec | null
  precio_por_tonelada: Dec | null
  intervalo_tenor_min: Dec
  intervalo_tenor_max: Dec
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean | number
  minero: string | null
  zona: string | null
  alcance: AlcancePrecio
}

export interface PreciosFiltro {
  id_minero?: number
  id_zona?: number
  alcance?: 'general'
  activo?: boolean
}

export interface PrecioCalcularQuery {
  idMinero?: number
  metodo: MetodoCalculo
  tenorFalso: number
  fechaEntrada: string
}

export interface PrecioCalculado {
  id: number
  metodo: MetodoCalculo
  precio_por_gramo: Dec | null
  precio_por_tonelada: Dec | null
  intervalo_tenor_min: Dec
  intervalo_tenor_max: Dec
}

export interface PrecioIntervalo {
  min: number
  max: number
  precio_por_gramo?: number
  precio_por_tonelada?: number
}

export interface PrecioLotePayload {
  id_minero?: number
  id_zona?: number
  metodo: MetodoCalculo
  fecha_inicio: string
  fecha_fin?: string
  intervalos: PrecioIntervalo[]
}

export interface PrecioUpdatePayload {
  min?: number
  max?: number
  precio_por_gramo?: number
  precio_por_tonelada?: number
  metodo?: MetodoCalculo
  id_minero?: number
  id_zona?: number
  fecha_inicio?: string
}

// ════════════════════════════════════════════════════════════════════════════
// 3 · MATERIAL (entradas / llegadas)
// ════════════════════════════════════════════════════════════════════════════

export interface NuevaVolquetaInline {
  placa: string
  conductor?: string
  conductor_cc?: string
  id_dueno?: number
  tipo_vehiculo?: string
  capacidad_ton?: number
}

export interface EntradaCreatePayload {
  numero_volqueta: number
  id_mina: number
  /** id del vehículo existente, o `null` si se crea inline con `nueva_volqueta`. */
  id_vehiculo: number | null
  id_tipo_material: number
  fecha_llegada?: string
  peso_llegada_planta: number
  comentarios?: string
  nueva_volqueta?: NuevaVolquetaInline
}

export interface EntradaUpdatePayload {
  numero_volqueta?: number
  id_mina?: number
  id_vehiculo?: number
  id_tipo_material?: number
  fecha_llegada?: string
  peso_llegada_planta?: number
  comentarios?: string
}

export interface EntradasQuery {
  fechaDesde?: string
  fechaHasta?: string
  estado?: EstadoEntrada
  limit?: number
  offset?: number
}

/** Fila de la tabla principal de entradas (más nuevo → más viejo). */
export interface EntradaRow {
  id: number
  numero_volqueta: number
  fecha_llegada: string
  mina: string | null
  minero: string | null
  minero_alias: string | null
  placa: string | null
  dueno_volqueta: string | null
  tipo_material: string | null
  peso_llegada_planta: Dec
  total_material_seco: Dec | null
  tenor: Dec | null
  precio_total: Dec | null
  total_material: Dec | null
  estado: EstadoEntrada
  estado_pago_flete: EstadoPagoFlete
  tiene_analisis_cabeza: boolean | number
}

export interface AnalisisResumen {
  id: number
  tipo_analisis: string
  numero_analisis: string
  porcentaje_humedad: Dec
  toneladas_secas: Dec | null
  ton_secas?: Dec | null
  tenor_real: Dec | null
  au_gr_t_real?: Dec | null
  au_gramos_totales: Dec | null
  tenor_falso: Dec | null
  au_concentrado: Dec | null
  estado_pago: string
  created_at: string
}

export interface EntradaDetalleResumen {
  peso_humedo: Dec
  humedad_pct: Dec
  ton_secas: Dec
  tenor_au: Dec
  flete: Dec
  acpm_adelantado: Dec
  gastos_operativos: Dec
  valor_material: Dec
  estado_pago: string
}

export interface EntradaDetalle {
  id: number
  numero_volqueta: number
  fecha_llegada: string
  estado: EstadoEntrada
  estado_pago_flete: EstadoPagoFlete
  mina_id: number | null
  mina: string | null
  zona_id: number | null
  minero_id: number | null
  minero: string | null
  minero_alias: string | null
  metodo_calculo: MetodoCalculo | null
  minero_banco: string | null
  minero_cuenta: string | null
  minero_nequi: boolean | number | null
  vehiculo_id: number | null
  placa: string | null
  dueno_id: number | null
  dueno: string | null
  dueno_alias: string | null
  tipo_material: string | null
  peso_llegada_planta: Dec
  porcentaje_humedad: Dec | null
  gramos_humedad: Dec | null
  total_material_seco: Dec | null
  tenor: Dec | null
  total_gramos: Dec | null
  id_precio: number | null
  precio_por_gramo: Dec | null
  precio_por_tonelada: Dec | null
  precio_total: Dec | null
  excedente_calculado: Dec | null
  costo_cargue: Dec | null
  costo_bascula: Dec | null
  costo_maquila: Dec | null
  costo_adicional: Dec | null
  costo_volqueta: Dec | null
  total_costos_operativos: Dec | null
  total_material: Dec | null
  comentarios: string | null
  created_at: string
  updated_at: string
  analisis: AnalisisResumen[]
  detalle: EntradaDetalleResumen
}

export interface EntradasStats {
  total_registros: number
  sin_procesar: number
  ton_humedo_pendiente: Dec
  volquetas_activas: number
}

export interface EntradaPendienteAnalisis {
  id: number
  numero_volqueta: number
  fecha_llegada: string
  mina: string | null
  minero: string | null
  placa: string | null
  peso_llegada_planta: Dec
  tipo_material_id: number | null
  tipo_material: string | null
  dias_sin_analisis: number
}

export interface CreatedResponse {
  message?: string
  id?: number
}

// ════════════════════════════════════════════════════════════════════════════
// 4 · ANÁLISIS
// ════════════════════════════════════════════════════════════════════════════

export interface AnalisisCabezaPayload {
  id_entrada: number
  numero_analisis?: string // null → autogenera AN-{mina}-{numero_volqueta}
  porcentaje_humedad: number // acepta 45 o 0.45 (se normaliza a fracción)
  au_concentrado: number
  au_falso?: number
  ag_concentrado?: number
  toneladas?: number // sin este valor usa el peso de llegada
  comentarios?: string
}

export interface AnalisisDetalle {
  id: number
  id_entrada: number
  id_tipo_analisis: number
  tipo_analisis: string
  numero_analisis: string
  ton: Dec | null
  porcentaje_humedad: Dec
  toneladas_humedas: Dec | null
  toneladas_secas: Dec | null
  tenor_real: Dec | null
  au_gramos_totales: Dec | null
  tenor_falso: Dec | null
  au_concentrado: Dec | null
  ag_concentrado: Dec | null
  ag_gr_x_ton: Dec | null
  valor_analisis: Dec | null
  estado_pago: string
  comentarios: string | null
  created_at: string
}

export interface AnalisisUpdatePayload {
  porcentaje_humedad?: number
  au_falso?: number
  au_concentrado?: number
  ag_concentrado?: number
  toneladas?: number
  id_entrada?: number
  numero_analisis?: string
}

// ─── Helper de querystring ───────────────────────────────────────────────────
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

export const materialApi = {
  // ── 2.1 Zonas ──────────────────────────────────────────────────────────────
  getZonas: () => apiFetch<Zona[]>('/material/mina/catalogo/zonas'),
  createZona: (body: ZonaCreatePayload) => apiPost<ZonaDetalle>('/material/mina/zona', body),
  updateZona: (id: number, body: ZonaUpdatePayload) => apiPut<ZonaDetalle>(`/material/mina/zona/${id}`, body),
  deleteZona: (id: number) => apiDelete<boolean>(`/material/mina/zona/${id}`),

  // ── 2.2 Mineros ────────────────────────────────────────────────────────────
  getMineros: () => apiFetch<Minero[]>('/material/mina/catalogo/mineros'),
  getMinerosConMinas: () => apiFetch<MineroConMinas[]>('/material/mina/catalogo/mineros-con-minas'),
  createMinero: (body: MineroCreatePayload) => apiPost<Minero>('/material/mina/minero', body),
  updateMinero: (id: number, body: MineroUpdatePayload) => apiPut<Minero>(`/material/mina/minero/${id}`, body),
  deleteMinero: (id: number) => apiDelete<boolean>(`/material/mina/minero/${id}`),

  // ── 2.3 Minas ──────────────────────────────────────────────────────────────
  getMinas: () => apiFetch<Mina[]>('/material/mina'),
  getMina: (id: number) => apiFetch<MinaDetalle>(`/material/mina/${id}`),
  createMina: (body: MinaCreatePayload) => apiPost<MinaDetalle>('/material/mina', body),
  updateMina: (id: number, body: MinaUpdatePayload) => apiPut<MinaDetalle>(`/material/mina/${id}`, body),
  deleteMina: (id: number) => apiDelete<boolean>(`/material/mina/${id}`),
  getMinaEntradas: (id: number) => apiFetch<MinaEntrada[]>(`/material/mina/${id}/entradas`),
  getMinaResumen: (id: number) => apiFetch<MinaResumen>(`/material/mina/${id}/resumen`),

  // ── 2.4 Dueños de volqueta ───────────────────────────────────────────────────
  getDuenos: () => apiFetch<DuenoVolqueta[]>('/material/volqueta/dueno'),
  createDueno: (body: DuenoCreatePayload) => apiPost<DuenoVolqueta>('/material/volqueta/dueno', body),
  updateDueno: (id: number, body: DuenoUpdatePayload) => apiPut<DuenoVolqueta>(`/material/volqueta/dueno/${id}`, body),
  deleteDueno: (id: number) => apiDelete<{ message?: string }>(`/material/volqueta/dueno/${id}`),
  getVehiculosDeDueno: (idDueno: number) => apiFetch<VehiculoDeDueno[]>(`/material/volqueta/dueno/${idDueno}`),

  // ── 2.5 Volquetas (vehículos) ────────────────────────────────────────────────
  getVolquetas: (todas = false) => apiFetch<Volqueta[]>(`/material/volqueta${todas ? '?todas=true' : ''}`),
  getVolqueta: (id: number) => apiFetch<VolquetaDetalle>(`/material/volqueta/${id}`),
  createVolqueta: (body: VolquetaCreatePayload) => apiPost<Volqueta>('/material/volqueta', body),
  updateVolqueta: (id: number, body: VolquetaUpdatePayload) => apiPut<Volqueta>(`/material/volqueta/${id}`, body),
  deleteVolqueta: (id: number) => apiDelete<boolean>(`/material/volqueta/${id}`),
  getVolquetaEntradas: (id: number) => apiFetch<EntradaRow[]>(`/material/volqueta/${id}/entradas`),
  getVolquetaEntradasPendientes: (id: number) => apiFetch<EntradaRow[]>(`/material/volqueta/${id}/entradas/pendientes`),

  // ── 2.6 Precios de material ──────────────────────────────────────────────────
  getPrecios: (filtro?: PreciosFiltro) =>
    apiFetch<Precio[]>(`/material/precios${qs({
      id_minero: filtro?.id_minero,
      id_zona: filtro?.id_zona,
      alcance: filtro?.alcance,
      activo: filtro?.activo,
    })}`),
  calcularPrecio: (q: PrecioCalcularQuery) =>
    apiFetch<PrecioCalculado | null>(`/material/precio/calcular${qs({
      idMinero: q.idMinero,
      metodo: q.metodo,
      tenorFalso: q.tenorFalso,
      fechaEntrada: q.fechaEntrada,
    })}`),
  createPreciosLote: (body: PrecioLotePayload) => apiPost<CreatedResponse>('/material/precios/lote', body),
  updatePrecio: (id: number, body: PrecioUpdatePayload) => apiPut<CreatedResponse>(`/material/precios/${id}`, body),

  // ── 3 Entradas ───────────────────────────────────────────────────────────────
  createEntrada: (body: EntradaCreatePayload) => apiPost<CreatedResponse>('/material/entrada', body),
  getEntradas: (query?: EntradasQuery) =>
    apiFetch<EntradaRow[]>(`/material/entradas${qs({
      fechaDesde: query?.fechaDesde,
      fechaHasta: query?.fechaHasta,
      estado: query?.estado,
      limit: query?.limit,
      offset: query?.offset,
    })}`),
  getEntrada: (id: number) => apiFetch<EntradaDetalle>(`/material/entradas/${id}`),
  updateEntrada: (id: number, body: EntradaUpdatePayload) => apiPut<EntradaDetalle>(`/material/entradas/${id}`, body),
  deleteEntrada: (id: number) => apiDelete<{ deleted: boolean }>(`/material/entradas/${id}`),
  cancelarEntrada: (id: number, motivo: string) =>
    apiPatch<{ cancelled: boolean }>(`/material/entradas/${id}/cancelar`, { motivo }),
  setEstadoEntrada: (id: number, estado: EstadoEntrada) =>
    apiPatch<{ updated: boolean }>(`/material/entradas/${id}/estado`, { estado }),
  getEntradasStats: () => apiFetch<EntradasStats>('/material/entradas/stats'),
  getEntradasPendientesAnalisis: () => apiFetch<EntradaPendienteAnalisis[]>('/material/entradas/pendientes-analisis'),
  // Listados alternos (mismo shape que la lista)
  getEntradasPorMinero: (id: number) => apiFetch<EntradaRow[]>(`/material/entradas/minero/${id}`),
  getEntradasPorMina: (id: number) => apiFetch<EntradaRow[]>(`/material/entradas/mina/${id}`),
  getEntradasPorVehiculo: (id: number) => apiFetch<EntradaRow[]>(`/material/entradas/vehiculo/${id}`),
  getEntradasPorDueno: (id: number) => apiFetch<EntradaRow[]>(`/material/entradas/dueno/${id}`),
  getEntradasPorFecha: (fecha: string) => apiFetch<EntradaRow[]>(`/material/entradas/fecha/${fecha}`),

  // ── 4 Análisis ───────────────────────────────────────────────────────────────
  createAnalisisCabeza: (body: AnalisisCabezaPayload) => apiPost<CreatedResponse>('/material/analisis/cabeza', body),
  getAnalisisPorEntrada: (idEntrada: number) => apiFetch<AnalisisResumen[]>(`/material/analisis/entrada/${idEntrada}`),
  getAnalisisCabeza: (idEntrada: number) => apiFetch<AnalisisDetalle>(`/material/analisis/entrada/${idEntrada}/cabeza`),
  getAnalisis: (id: number) => apiFetch<AnalisisDetalle>(`/material/analisis/${id}`),
  updateAnalisis: (id: number, body: AnalisisUpdatePayload) => apiPut<CreatedResponse>(`/material/analisis/${id}`, body),
  deleteAnalisis: (id: number) => apiDelete<{ message?: string }>(`/material/analisis/${id}`),
  setValorAnalisis: (id: number, valor_analisis: number) =>
    apiPatch<CreatedResponse>(`/material/analisis/${id}/valor`, { valor_analisis }),
  setPagoAnalisis: (id: number, estado: string) =>
    apiPatch<{ updated: boolean }>(`/material/analisis/${id}/pago`, { estado }),
  getAnalisisPorMinero: (id: number) => apiFetch<AnalisisResumen[]>(`/material/analisis/minero/${id}`),
  getAnalisisPorMina: (id: number) => apiFetch<AnalisisResumen[]>(`/material/analisis/mina/${id}`),
  getAnalisisPorFecha: (fecha: string) => apiFetch<AnalisisResumen[]>(`/material/analisis/fecha/${fecha}`),
}
