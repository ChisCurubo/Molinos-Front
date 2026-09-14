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
// 2.7 · TARIFAS DE FLETE POR ZONA (Tarifa_Zona)
// CRUD de la tarifa base por tonelada de cada zona. Al crear una activa, el
// backend cierra la tarifa vigente anterior de esa zona (una activa por zona).
// El flete de cada entrada (costo_volqueta) se calcula aparte al editar la
// entrada; esta pantalla solo administra las tarifas base.
// ════════════════════════════════════════════════════════════════════════════

export interface TarifaZona {
  id: number
  id_zona: number
  zona: string | null
  valor_tonelada: Dec
  vigente_desde: string | null
  vigente_hasta: string | null
  activo: boolean | number
  created_at: string
}

export interface TarifaZonaCreatePayload {
  id_zona: number
  valor_tonelada: number
  vigente_desde?: string
  vigente_hasta?: string
  activo?: boolean
}

/** Editar tarifa (parcial). Acepta alias `tarifa` por `valor_tonelada`. */
export interface TarifaZonaUpdatePayload {
  id_zona?: number
  valor_tonelada?: number
  tarifa?: number
  vigente_desde?: string
  vigente_hasta?: string
  activo?: boolean
}

// ════════════════════════════════════════════════════════════════════════════
// 2.8 · PRECIOS DE MATERIAL (Precio_Material) — tabla referencial
// CRUD de consulta; NO afecta cálculos. El precio de compra se asigna manual
// en el flujo de entrada; esta pantalla es solo administración/referencia.
// ════════════════════════════════════════════════════════════════════════════

export interface PrecioMaterial {
  id: number
  id_minero: number | null
  minero: string | null
  id_zona: number | null
  zona: string | null
  metodo: MetodoCalculo
  precio_por_gramo: Dec | null
  precio_por_tonelada: Dec | null
  intervalo_tenor_min: Dec | null
  intervalo_tenor_max: Dec | null
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean | number
  created_at: string
}

export interface PrecioMaterialCreatePayload {
  id_minero?: number
  id_zona?: number
  metodo: MetodoCalculo
  precio_por_gramo?: number
  precio_por_tonelada?: number
  intervalo_tenor_min?: number
  intervalo_tenor_max?: number
  fecha_inicio: string
  fecha_fin?: string
  activo?: boolean
}

export type PrecioMaterialUpdatePayload = Partial<PrecioMaterialCreatePayload>

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
  /** ACPM adelantado al conductor (COP); se descuenta del flete al pagar. */
  acpm_adelantado?: number
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
  acpm_adelantado?: number
  comentarios?: string
}

/** PATCH precio de la entrada (Fase 3: se digita el precio pactado por entrada).
 *  Enviar SOLO una de las dos claves según el método de pago. */
export interface EntradaPrecioPayload {
  precio_por_gramo?: number
  precio_por_tonelada?: number
}

// ─── Gastos operativos (columnas de la entrada) ──────────────────────────────
/** GET /entradas/:id/gastos-operativos — los 5 costos + totales recalculados.
 *  total_material = precio_total + total_costos_operativos. */
export interface GastosOperativos {
  costo_cargue: Dec | null
  costo_bascula: Dec | null
  costo_maquila: Dec | null
  costo_adicional: Dec | null
  costo_volqueta: Dec | null
  total_costos_operativos: Dec | null
  total_material: Dec | null
}

/** PATCH /entradas/:id/gastos-operativos — manda solo los costos que cambian. */
export interface GastosOperativosPayload {
  costo_cargue?: number
  costo_bascula?: number
  costo_maquila?: number
  costo_adicional?: number
  costo_volqueta?: number
}

// ─── Excedente (tabla aparte, upsert 1:1) ────────────────────────────────────
/** GET /entradas/:id/excedente — el registro actual o `null` si no existe. */
export interface Excedente {
  valor: Dec | null
  distribuido: Dec | null
  saldo: Dec | null
  estado: string | null
  fecha_calculo: string | null
  notas: string | null
}

/** PUT /entradas/:id/excedente — crea o actualiza (no toca total_material).
 *  `excedente` es el FACTOR multiplicador (número por el que el backend
 *  multiplica las ton secas), NO el valor total ya calculado. */
export interface ExcedentePayload {
  excedente: number
  fecha_calculo?: string
  notas?: string
}

// ─── Tipos de material (selector cacheable) ──────────────────────────────────
export interface TipoMaterial {
  id: number
  nombre: string
  descripcion: string | null
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
  /** Opcional: el backend puede incluirlo en el listado. */
  acpm_adelantado?: Dec | null
  zona?: string | null
  flete?: Dec | null
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
  // Desglose que el backend ahora incluye en data.detalle (Fase 3).
  costo_cargue?: Dec | null
  costo_bascula?: Dec | null
  costo_maquila?: Dec | null
  costo_adicional?: Dec | null
  costo_volqueta?: Dec | null
  total_costos_operativos?: Dec | null
  precio_total?: Dec | null
  excedente?: Dec | null
  total_material?: Dec | null
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
  tipo_material_id: number | null
  tipo_material: string | null
  peso_llegada_planta: Dec
  porcentaje_humedad: Dec | null
  gramos_humedad: Dec | null
  total_material_seco: Dec | null
  tenor: Dec | null
  total_gramos: Dec | null
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

// ════════════════════════════════════════════════════════════════════════════
// 5 · VIAJES DE AGUA (agua planta)
// El valor_total lo calcula el backend: valor_viaje * cantidad_viajes - acpm.
// ════════════════════════════════════════════════════════════════════════════

export interface AguaRangoQuery {
  desde: string // YYYY-MM-DD
  hasta: string // YYYY-MM-DD
}

/** Campos de texto del alta (se envían como multipart junto con la foto). */
export interface AguaCreatePayload {
  id_dueno_volqueta: number
  fecha: string
  valor_viaje: number
  cantidad_viajes: number
  acpm?: number
  // El comprobante NO va aquí: se adjunta como archivo (foto) y el servidor
  // lo sube a MinIO/blob y setea `comprobante_url` internamente.
}

/** Editar: no cambia el vehículo (ya conocido) ni el comprobante. */
export interface AguaUpdatePayload {
  fecha?: string
  valor_viaje?: number
  cantidad_viajes?: number
  acpm?: number
}

/** Fila del historial de viajes de agua. */
export interface AguaViaje {
  id: number
  id_dueno_volqueta: number | null
  fecha: string
  dueno: string | null
  dueno_alias: string | null
  valor_viaje: Dec
  cantidad_viajes: number
  acpm: Dec | null
  valor_total: Dec
  comprobante_url: string | null
}

/** Resumen agrupado por dueño (liquidación), con la lista de viajes embebida. */
export interface AguaResumenDueno {
  id_dueno: number
  dueno: string
  dueno_alias: string | null
  total_registros: number
  total_viajes: number
  total_pagar: Dec
  /** Viajes del dueño dentro del período consultado. */
  viajes: AguaViaje[]
}

/** El detalle de un dueño tiene la misma forma que su fila de resumen. */
export type AguaDuenoDetalle = AguaResumenDueno

// ─── Reporte mensual (agrupado por dueño con arrastre de saldo) ───────────────
export interface AguaReporteViaje {
  id: number
  fecha: string
  cantidad_viajes: number
  valor_viaje: Dec
  bruto: Dec        // valor_viaje * cantidad_viajes
  acpm: Dec
  neto: Dec         // = valor_total (bruto - acpm)
}

export interface AguaReporteResumen {
  total_viajes: number
  bruto: Dec
  acpm: Dec
  neto_mes: Dec
  saldo_inicio: Dec // arrastre de netos de meses anteriores
  abonado: Dec      // 0 por ahora (sin abonos)
  saldo_fin: Dec    // saldo_inicio + neto_mes - abonado
}

export interface AguaReporteDueno {
  id_dueno: number
  dueno: string
  alias: string | null
  resumen: AguaReporteResumen
  viajes: AguaReporteViaje[]
}

export interface AguaReporteMensual {
  periodo: { desde: string; hasta: string }
  duenos: AguaReporteDueno[]
}

export interface AguaReporteQuery {
  mes?: number
  anio?: number
  desde?: string
  hasta?: string
}

// ════════════════════════════════════════════════════════════════════════════
// 6 · PROCESAMIENTO (concentrado) · INVENTARIO · VIAJES DE MATERIAL
// GET de lectura (listados con filtros, detalle, trazabilidad y resúmenes).
// Ver docs/endpoints_pendientes_material.md. Decimales llegan como string.
// ════════════════════════════════════════════════════════════════════════════

export type EstadoLote = 'en_proceso' | 'en_canoa' | 'parcialmente_enviado' | 'enviado_completo'

// ─── 6.1 Inventario ───────────────────────────────────────────────────────────
export interface InvCrudoRow {
  /** ⚠️ El backend expone el id de la entrada como `id_entrada` (no `id`).
   *  Es el que se manda en `id_entradas` al procesar un lote. */
  id_entrada: number
  numero_volqueta: number
  id_mina?: number | null
  mina: string | null
  id_tipo_material: number | null
  tipo_material: string | null
  fecha_llegada: string
  toneladas_humedo: Dec
  total_material_seco: Dec | null
  porcentaje_humedad: Dec | null
  tenor: Dec | null
  estado: EstadoEntrada
  ya_procesado_seco: Dec | null
  disponible_seco: Dec | null
  // Opcionales: el backend puede agregarlos al endpoint; si no vienen, el front
  // los completa (pagado vía getEntradas, au real vía `tenor`).
  au_real?: Dec | null
  ag_real?: Dec | null
  tenor_falso?: Dec | null
  pagado_material?: Dec | null
}

export interface InvConcentradoRow {
  id: number
  codigo: string
  estado: EstadoLote
  ubicacion_canoa: string | null
  fecha_inicio: string
  fecha_fin: string | null
  porcentaje_humedad: Dec | null
  toneladas_humedo: Dec | null
  toneladas_seco: Dec | null
  toneladas_disponibles: Dec
  material_seco_procesado: Dec | null
  maquila_total: Dec | null
  precio_maquila_por_ton: Dec | null
  tenor_au: Dec | null
  tenor_ag: Dec | null
  // Opcionales: si el backend los agrega al endpoint se usan directo; si no, el
  // front toma las minas del detalle del lote (materiales[].mina).
  pagado_material?: Dec | null
  minas?: string[] | string | null
}

export interface InventarioResumen {
  lotes_en_canoa: number
  concentrado_humedo_disponible: Dec
  concentrado_maquila_total: Dec
  entradas_sin_lote: number
  crudo_humedo_total: Dec
  crudo_seco_total: Dec
}

/** `GET /material/inventario/lote/:id` — resumen del inventario de un lote. */
export interface InventarioLoteResumen {
  id?: number
  num_materiales: number
  total_seco_procesado: Dec
  inventario_disponible: Dec
  inventario_estado: string
}

// ─── 6.2 Procesamiento / lotes de concentrado ─────────────────────────────────
export interface LoteConcentradoRow {
  id: number
  codigo: string
  estado: EstadoLote
  fecha_inicio: string
  fecha_fin: string | null
  hizo_molienda: boolean | number
  hizo_flotacion: boolean | number
  hizo_relave: boolean | number
  hizo_filtroprensa: boolean | number
  material_seco_procesado: Dec | null
  toneladas_humedo: Dec | null
  porcentaje_humedad: Dec | null
  toneladas_seco: Dec | null
  toneladas_disponibles: Dec
  ubicacion_canoa: string | null
  precio_maquila_por_ton: Dec | null
  maquila_total: Dec | null
  comentarios: string | null
  num_materiales: number
  numero_analisis: string | null
  au_gr_x_ton: Dec | null
  ag_gr_x_ton: Dec | null
  au_concentrado: Dec | null
  ag_concentrado: Dec | null
  // Fechas ya formateadas (dd/mm/aa) y precio total del lote (§7/§8).
  fecha_inicio_fmt?: string | null
  fecha_fin_fmt?: string | null
  precio_total_material?: Dec | null
  total_material_con_costos?: Dec | null
  tenor?: Dec | null
}

export interface LoteMaterialVinculado {
  id: number
  numero_volqueta: number
  mina: string | null
  fecha_llegada: string
  peso_llegada_planta: Dec
  porcentaje_humedad: Dec | null
  total_material_seco: Dec | null
  tenor: Dec | null
  toneladas_aportadas: Dec | null
  toneladas_seco_aportadas: Dec | null
  // Aporte proporcional dentro del lote (§7).
  fraccion_procesada?: Dec | null
  concentrado_proporcional?: Dec | null   // concentrado que aportó este material
  maquila_proporcional?: Dec | null
  costo_maquila?: Dec | null
  precio_material_lote?: Dec | null        // precio de ese material dentro del lote
}

export interface LoteConcentradoDetalle extends LoteConcentradoRow {
  created_at: string
  updated_at: string
  materiales: LoteMaterialVinculado[]
  analisis?: AnalisisConcentrado[]
}

/** Análisis del concentrado de un lote (tenor real). */
export interface AnalisisConcentrado {
  id: number
  tipo?: string
  numero_analisis: string
  toneladas_secas: Dec | null
  au_gr_x_ton: Dec | null
  ag_gr_x_ton: Dec | null
  au_concentrado: Dec | null
  ag_concentrado: Dec | null
  porcentaje_humedad: Dec | null
}

/** Fila de la pestaña "Procesamiento material" (materiales vinculados a lotes). */
export interface ProcesamientoMaterialRow {
  id_entrada: number
  codigo_lote: string | null
  id_lote: number | null
  estado_lote: EstadoLote | null
  numero_volqueta: number
  mina: string | null
  fecha_llegada: string
  peso_llegada_planta: Dec
  porcentaje_humedad: Dec | null
  total_material_seco: Dec | null
  tenor: Dec | null
  analisis: AnalisisConcentrado[]
}

export interface ConcentradoResumen {
  en_proceso: number
  en_canoa: number
  parcialmente_enviado: number
  enviado_completo: number
  toneladas_disponibles_total: Dec
}

export interface ConcentradoQuery {
  codigo?: string
  estado?: EstadoLote
  desde?: string
  hasta?: string
  limit?: number
  offset?: number
}

export interface ProcesamientoQuery {
  id_lote?: number
  codigo_lote?: string
  id_mina?: number
  desde?: string
  hasta?: string
  estado_lote?: EstadoLote
  limit?: number
  offset?: number
}

// ─── Escrituras de concentrado (payloads) ─────────────────────────────────────
export interface ConcentradoCreatePayload {
  codigo: string
  fecha_inicio: string
  hizo_molienda?: boolean | number
  hizo_flotacion?: boolean | number
  hizo_relave?: boolean | number
  hizo_filtroprensa?: boolean | number
}

export interface ConcentradoProcesarPayload {
  id_entradas: number[]
  toneladas_procesadas_seco: number
}

/** Respuesta de `POST .../:id/procesar`: incluye el acumulado tras vincular. */
export interface ConcentradoProcesarResult {
  filas?: unknown[]
  total_seco_agregado: Dec
  material_seco_procesado: Dec           // ACUMULADO seco del lote
  precio_maquila_por_ton: Dec | null
  maquila_total: Dec | null              // provisional
}

/** Corregir el concentrado de un lote YA cerrado (en_canoa). */
export interface ConcentradoCorregirPayload {
  toneladas_humedo: number
  porcentaje_humedad: number
  ubicacion_canoa?: string
}

export interface ConcentradoCerrarPayload {
  toneladas_humedo: number
  /** Opcional: si no se envía, el backend usa la humedad conocida (p.ej. del análisis). */
  porcentaje_humedad?: number
  fecha_fin: string
  hizo_molienda?: boolean
  hizo_flotacion?: boolean
  hizo_relave?: boolean
  hizo_filtroprensa?: boolean
  ubicacion_canoa?: string
}

export interface ConcentradoUpdatePayload {
  codigo?: string
  fecha_inicio?: string
  comentarios?: string
  hizo_molienda?: boolean
  hizo_flotacion?: boolean
  hizo_relave?: boolean
  hizo_filtroprensa?: boolean
  ubicacion_canoa?: string
  precio_maquila_por_ton?: number
}

/** Análisis del concentrado (POST): se hace después de cerrar el lote. */
export interface AnalisisConcentradoPayload {
  id_material_concentrado: number
  numero_analisis?: string
  porcentaje_humedad: number
  au_concentrado: number
  ag_concentrado?: number
}

/** GET /material/concentrado/:id/merma — merma en gramos de metal del lote. */
export interface MermaConcentrado {
  id: number
  codigo: string
  merma_au: Dec | null
  merma_ag: Dec | null
}

/** PATCH /material/concentrado/:id/merma — enviar solo lo que cambie (número ≥ 0). */
export interface MermaPayload {
  merma_au?: number
  merma_ag?: number
}

// ─── 6.3 Viajes de material ───────────────────────────────────────────────────
export interface ViajeMaterialLinea {
  id: number
  id_viaje: number
  id_material_concentrado: number
  codigo_lote: string | null
  concepto: string | null
  concentrado_humedo: Dec
  porcentaje_humedad: Dec | null
  concentrado_seco: Dec
  costo_maquila: Dec | null
  valor_total: Dec | null
  au_gr_x_ton: Dec | null
  ag_gr_x_ton: Dec | null
  au_gramos: Dec | null
  ag_gramos: Dec | null
}

export interface ViajeMaterial {
  id: number
  numero_viaje: string
  fecha: string
  comentarios: string | null
  total_concentrado_humedo: Dec
  total_concentrado_seco: Dec
  maquila_total: Dec
  valor_material_total: Dec
  au_gramos_total: Dec
  ag_gramos_total: Dec
  // Nuevos agregados de la cabecera (el backend ya los devuelve).
  // ⚠️ total_costo_material NO incluye maquila; el total real es total_viaje.
  total_costo_material?: Dec        // solo material (sin maquila)
  maquila?: Dec                     // maquila del viaje
  total_viaje?: Dec                 // material + maquila (total real)
  tenor_au_venta?: Dec
  tenor_ag?: Dec
  total_grs_au_venta?: Dec
  total_grs_ag_venta?: Dec
  au_promedio_compra?: Dec
  lineas: ViajeMaterialLinea[]
}

export interface ViajeMaterialResumen {
  total_viajes: number
  toneladas_humedo: Dec
  toneladas_seco: Dec
  maquila_total: Dec
  valor_material_total: Dec
  au_gramos_total: Dec
  ag_gramos_total: Dec
  au_promedio_viaje: Dec
  ag_promedio_viaje: Dec
}

/** Trazabilidad: en qué viajes salió un lote y cuánto metal llevó. */
export interface ViajeLoteTrace {
  id_viaje: number
  numero_viaje: string
  fecha: string
  concentrado_humedo: Dec
  concentrado_seco: Dec
  au_gramos: Dec | null
  ag_gramos: Dec | null
}

// ─── Trazabilidad completa (viaje → lotes → materiales de origen) ─────────────
/** Material de origen que aportó a un lote, con su aporte proporcional. */
export interface TrazaMaterial {
  id_entrada: number
  numero_volqueta: number
  mina: string | null
  minero: string | null
  fecha_llegada: string
  tenor: Dec | null
  total_material_seco: Dec | null
  toneladas_aportadas: Dec | null
  toneladas_seco_aportadas: Dec | null
  concentrado_proporcional: Dec | null // cuánto concentrado aportó ese material
  maquila_proporcional: Dec | null
  porcentaje_aporte: number | null      // % sobre el seco del lote
  // Desglose de costos por material (el backend ya lo devuelve).
  costo_material?: Dec | null          // solo material
  gastos_operativos?: Dec | null
  total_material?: Dec | null          // material + gastos operativos
  excedente?: Dec | null               // aparte (no incluido en total_material)
  maquila?: Dec | null                 // para comprobar sumas
}

/** Línea (lote) del viaje con sus materiales de origen. */
export interface TrazaLinea {
  id_linea: number
  id_lote: number
  codigo_lote: string | null
  estado_lote: EstadoLote | null
  concentrado_humedo: Dec
  concentrado_seco: Dec
  au_gramos: Dec | null
  ag_gramos: Dec | null
  materiales: TrazaMaterial[]
}

/** `GET /material/viajes/:id/trazabilidad` — viaje → lotes → materiales. */
export interface ViajeTrazabilidad {
  id_viaje: number
  numero_viaje: string
  fecha: string
  comentarios: string | null
  lineas: TrazaLinea[]
}

/** `GET /material/viajes/linea/:id/trazabilidad` — una línea → su lote y materiales. */
export interface LineaTrazabilidad {
  id_linea: number
  id_viaje: number
  numero_viaje: string
  fecha: string
  id_lote: number
  codigo_lote: string | null
  estado_lote: EstadoLote | null
  concentrado_despachado_humedo: Dec
  concentrado_despachado_seco: Dec
  materiales: TrazaMaterial[]
}

export interface ViajesMaterialQuery {
  desde?: string
  hasta?: string
  numero_viaje?: string
  id_lote?: number
  codigo_lote?: string
  limit?: number
  offset?: number
}

/** `GET /material/viajes/disponibles-mula` — viajes en estado `almacenado` con al menos una línea cargada. */
export interface ViajeDisponibleMula {
  id: number
  numero_viaje: string | number
  fecha: string
  estado: string
  num_lineas: number
  toneladas_seco: number | string
}

// ─── Escrituras de viajes (payloads) ──────────────────────────────────────────
/** POST /viajes — el body real es solo `numero_viaje` (fecha/comentarios opcionales). */
export interface ViajeCreatePayload {
  numero_viaje: string
  fecha?: string
  comentarios?: string
}

/** PATCH /viajes/:id — editar cabecera. */
export interface ViajeUpdatePayload {
  numero_viaje?: string
  fecha?: string
  comentarios?: string
}

/** POST /viajes/:id/lineas — asignar lote. Se despacha en SECO (`concentrado_seco`);
 *  si se omite, despacha todo lo disponible. NO enviar valor_total (lo deriva el back). */
export interface ViajeLineaPayload {
  id_material_concentrado: number
  concentrado_seco?: number
  concepto?: string
}

/** PATCH /viajes/:idViaje/lineas/:idLinea — ajusta el seco (stock por diferencia). */
export interface ViajeLineaUpdatePayload {
  concentrado_seco?: number
  valor_total?: number
  concepto?: string
}

// ════════════════════════════════════════════════════════════════════════════
// 6.4 · TARIFAS DE PROCESO (maquila) — /material/tarifas-proceso
// Precio de maquila por tipo de proceso. "Actualizar precio" (POST) versiona:
// cierra la tarifa vigente anterior del código y crea una nueva vigente.
// "Corregir" (PATCH) edita la fila existente (solo para errores de digitación).
// El backend responde { success, data } / { success:false, error }.
// ════════════════════════════════════════════════════════════════════════════

export type CodigoTarifaProceso = 'PROCESO_NORMAL' | 'PROCESO_RELAVE' | 'SOLO_FILTROPRENSA'

export interface TarifaProceso {
  id: number
  codigo: CodigoTarifaProceso | string
  descripcion: string | null
  valor: Dec                 // string decimal desde MySQL → usar num()
  unidad: string | null
  fecha_desde: string        // YYYY-MM-DD
  fecha_hasta: string | null // null = vigente
  activo: boolean | number   // 1/0
  created_at: string
  updated_at: string
}

/** Filtros del histórico completo (GET /). */
export interface TarifasProcesoHistQuery {
  codigo?: CodigoTarifaProceso | string
  activo?: 0 | 1
}

/** POST / — actualizar precio (cierra la anterior y crea una versión nueva). */
export interface TarifaProcesoUpdatePrecioPayload {
  codigo: CodigoTarifaProceso | string
  valor: number
  fecha_desde?: string
  descripcion?: string
  unidad?: string
}

/** PATCH /:id — corregir una fila existente (arreglar errores de digitación). */
export interface TarifaProcesoCorregirPayload {
  valor?: number
  descripcion?: string
  unidad?: string
  fecha_desde?: string
  fecha_hasta?: string | null
  activo?: boolean | number
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

  // ── 2.7 Tarifas de flete por zona (Tarifa_Zona) ──────────────────────────────
  getTarifasZona: () => apiFetch<TarifaZona[]>('/material/mina/tarifa-zona'),
  getTarifaZona: (id: number) => apiFetch<TarifaZona>(`/material/mina/tarifa-zona/${id}`),
  createTarifaZona: (body: TarifaZonaCreatePayload) => apiPost<TarifaZona>('/material/mina/tarifa-zona', body),
  updateTarifaZona: (id: number, body: TarifaZonaUpdatePayload) => apiPut<TarifaZona>(`/material/mina/tarifa-zona/${id}`, body),
  deleteTarifaZona: (id: number) => apiDelete<boolean>(`/material/mina/tarifa-zona/${id}`),

  // ── 2.8 Precios de material (Precio_Material, referencial) ────────────────────
  getPreciosMaterial: () => apiFetch<PrecioMaterial[]>('/material/mina/precio-material'),
  getPrecioMaterial: (id: number) => apiFetch<PrecioMaterial>(`/material/mina/precio-material/${id}`),
  createPrecioMaterial: (body: PrecioMaterialCreatePayload) => apiPost<PrecioMaterial>('/material/mina/precio-material', body),
  updatePrecioMaterial: (id: number, body: PrecioMaterialUpdatePayload) => apiPut<PrecioMaterial>(`/material/mina/precio-material/${id}`, body),
  deletePrecioMaterial: (id: number) => apiDelete<boolean>(`/material/mina/precio-material/${id}`),

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
  // Devuelve la entrada ya recalculada (precio_total, total_material y el
  // precio contrario en null). El backend valida: 400 (ambos/ninguno o ≤ 0),
  // 404 (no existe), 409 (cancelada o sin análisis / Fase 2 incompleta).
  setPrecioEntrada: (id: number, body: EntradaPrecioPayload) =>
    apiPatch<EntradaDetalle>(`/material/entradas/${id}/precio`, body),
  // Gastos operativos (los 5 costo_* + totales recalculados).
  getGastosOperativos: (id: number) => apiFetch<GastosOperativos>(`/material/entradas/${id}/gastos-operativos`),
  updateGastosOperativos: (id: number, body: GastosOperativosPayload) =>
    apiPatch<GastosOperativos>(`/material/entradas/${id}/gastos-operativos`, body),
  // Excedente (tabla aparte, upsert 1:1). El GET puede devolver null.
  getExcedente: (id: number) => apiFetch<Excedente | null>(`/material/entradas/${id}/excedente`),
  putExcedente: (id: number, body: ExcedentePayload) =>
    apiPut<Excedente>(`/material/entradas/${id}/excedente`, body),
  // Tipos de material (selector cacheable).
  getTiposMaterial: () => apiFetch<TipoMaterial[]>('/material/tipos-material'),
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

  // ── 5 Viajes de agua ─────────────────────────────────────────────────────────
  // Alta con multipart/form-data: campos de texto + archivo `comprobante` (foto).
  createAgua: (form: FormData) => apiPost<CreatedResponse>('/material/agua', form),
  updateAgua: (id: number, body: AguaUpdatePayload) => apiPut<CreatedResponse>(`/material/agua/${id}`, body),
  getAguaViajes: (q: AguaRangoQuery) =>
    apiFetch<AguaViaje[]>(`/material/agua/viajes${qs({ desde: q.desde, hasta: q.hasta })}`),
  getAguaResumen: (q: AguaRangoQuery) =>
    apiFetch<AguaResumenDueno[]>(`/material/agua/resumen${qs({ desde: q.desde, hasta: q.hasta })}`),
  getAguaDueno: (idDueno: number) => apiFetch<AguaDuenoDetalle>(`/material/agua/dueno/${idDueno}`),
  getAgua: (id: number) => apiFetch<AguaViaje>(`/material/agua/${id}`),
  getAguaReporteMensual: (q: AguaReporteQuery) =>
    apiFetch<AguaReporteMensual>(`/material/agua/reporte-mensual${qs({ mes: q.mes, anio: q.anio, desde: q.desde, hasta: q.hasta })}`),

  // ── 6.1 Inventario ─────────────────────────────────────────────────────────
  getInventarioCrudo: () => apiFetch<InvCrudoRow[]>('/material/inventario/crudo'),
  getInventarioConcentrado: () => apiFetch<InvConcentradoRow[]>('/material/inventario/concentrado'),
  getInventarioLote: (id: number) => apiFetch<InventarioLoteResumen>(`/material/inventario/lote/${id}`),
  getInventarioResumen: () => apiFetch<InventarioResumen>('/material/inventario/resumen'),

  // ── 6.2 Procesamiento / lotes de concentrado ─────────────────────────────────
  getConcentradoLotes: (q?: ConcentradoQuery) =>
    apiFetch<LoteConcentradoRow[]>(`/material/concentrado${qs({
      codigo: q?.codigo, estado: q?.estado, desde: q?.desde, hasta: q?.hasta,
      limit: q?.limit ?? 1000, offset: q?.offset,
    })}`),
  getConcentrado: (id: number) => apiFetch<LoteConcentradoDetalle>(`/material/concentrado/${id}`),
  getConcentradoProcesamiento: (q?: ProcesamientoQuery) =>
    apiFetch<ProcesamientoMaterialRow[]>(`/material/concentrado/procesamiento${qs({
      id_lote: q?.id_lote, codigo_lote: q?.codigo_lote, id_mina: q?.id_mina,
      desde: q?.desde, hasta: q?.hasta, estado_lote: q?.estado_lote,
      limit: q?.limit ?? 2000, offset: q?.offset,
    })}`),
  getConcentradoResumen: () => apiFetch<ConcentradoResumen>('/material/concentrado/resumen'),
  getAnalisisConcentrado: (idLote: number) => apiFetch<AnalisisConcentrado[]>(`/material/analisis/concentrado/${idLote}`),

  // Escrituras de concentrado
  createConcentrado: (body: ConcentradoCreatePayload) => apiPost<CreatedResponse>('/material/concentrado', body),
  procesarConcentrado: (id: number, body: ConcentradoProcesarPayload) =>
    apiPost<ConcentradoProcesarResult>(`/material/concentrado/${id}/procesar`, body),
  cerrarConcentrado: (id: number, body: ConcentradoCerrarPayload) =>
    apiPut<CreatedResponse>(`/material/concentrado/${id}/cerrar`, body),
  updateConcentrado: (id: number, body: ConcentradoUpdatePayload) =>
    apiPut<CreatedResponse>(`/material/concentrado/${id}`, body),
  corregirConcentrado: (id: number, body: ConcentradoCorregirPayload) =>
    apiPatch<CreatedResponse>(`/material/concentrado/${id}/concentrado`, body),
  deleteConcentradoMaterial: (id: number, idEntrada: number) =>
    apiDelete<CreatedResponse>(`/material/concentrado/${id}/material/${idEntrada}`),
  deleteConcentrado: (id: number) => apiDelete<CreatedResponse>(`/material/concentrado/${id}`),
  createAnalisisConcentrado: (body: AnalisisConcentradoPayload) => apiPost<CreatedResponse>('/material/analisis', body),
  // Merma del lote (gramos de metal). GET lee, PATCH registra/actualiza (solo lo que cambie).
  getConcentradoMerma: (id: number) => apiFetch<MermaConcentrado>(`/material/concentrado/${id}/merma`),
  updateConcentradoMerma: (id: number, body: MermaPayload) =>
    apiPatch<CreatedResponse>(`/material/concentrado/${id}/merma`, body),

  // ── 6.3 Viajes de material ───────────────────────────────────────────────────
  getViajesMaterial: (q?: ViajesMaterialQuery) =>
    apiFetch<ViajeMaterial[]>(`/material/viajes${qs({
      desde: q?.desde, hasta: q?.hasta, numero_viaje: q?.numero_viaje,
      id_lote: q?.id_lote, codigo_lote: q?.codigo_lote,
      limit: q?.limit ?? 1000, offset: q?.offset,
    })}`),
  getViajeMaterial: (id: number) => apiFetch<ViajeMaterial>(`/material/viajes/${id}`),
  getViajesMaterialResumen: (q?: { desde?: string; hasta?: string }) =>
    apiFetch<ViajeMaterialResumen>(`/material/viajes/resumen${qs({ desde: q?.desde, hasta: q?.hasta })}`),
  getViajesPorLote: (idLote: number) => apiFetch<ViajeLoteTrace[]>(`/material/viajes/lote/${idLote}`),
  getViajeTrazabilidad: (id: number) => apiFetch<ViajeTrazabilidad>(`/material/viajes/${id}/trazabilidad`),
  getLineaTrazabilidad: (idLinea: number) => apiFetch<LineaTrazabilidad>(`/material/viajes/linea/${idLinea}/trazabilidad`),
  // Selector de Pago de mulas: viajes `almacenado` con líneas cargadas, listos para despachar.
  getViajesDisponiblesMula: () => apiFetch<ViajeDisponibleMula[]>('/material/viajes/disponibles-mula'),

  // Escrituras de viajes
  createViaje: (body: ViajeCreatePayload) => apiPost<CreatedResponse>('/material/viajes', body),
  updateViaje: (id: number, body: ViajeUpdatePayload) => apiPatch<CreatedResponse>(`/material/viajes/${id}`, body),
  addViajeLinea: (idViaje: number, body: ViajeLineaPayload) =>
    apiPost<CreatedResponse>(`/material/viajes/${idViaje}/lineas`, body),
  updateViajeLinea: (idViaje: number, idLinea: number, body: ViajeLineaUpdatePayload) =>
    apiPatch<CreatedResponse>(`/material/viajes/${idViaje}/lineas/${idLinea}`, body),
  deleteViajeLinea: (idViaje: number, idLinea: number) =>
    apiDelete<CreatedResponse>(`/material/viajes/${idViaje}/lineas/${idLinea}`),
  deleteViaje: (id: number) => apiDelete<CreatedResponse>(`/material/viajes/${id}`),

  // ── 6.4 Tarifas de proceso (maquila) ─────────────────────────────────────────
  // Vigente de cada código (por defecto hoy; acepta ?fecha=YYYY-MM-DD).
  getTarifasProcesoVigentes: (fecha?: string) =>
    apiFetch<TarifaProceso[]>(`/material/tarifas-proceso/vigentes${qs({ fecha })}`),
  // Histórico completo (filtros opcionales codigo y activo 0/1).
  getTarifasProceso: (q?: TarifasProcesoHistQuery) =>
    apiFetch<TarifaProceso[]>(`/material/tarifas-proceso${qs({ codigo: q?.codigo, activo: q?.activo })}`),
  // Actualizar precio: versiona (cierra la vigente y crea una nueva). Devuelve 201.
  updatePrecioTarifaProceso: (body: TarifaProcesoUpdatePrecioPayload) =>
    apiPost<TarifaProceso>('/material/tarifas-proceso', body),
  // Corregir una fila (arreglar errores de digitación) sin crear versión nueva.
  corregirTarifaProceso: (id: number, body: TarifaProcesoCorregirPayload) =>
    apiPatch<TarifaProceso>(`/material/tarifas-proceso/${id}`, body),
}
