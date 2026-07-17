// Datos reales de Molinos de Colombia S.A.S — fuente: BD de producción

// ===================================================
// TIPOS
// ===================================================

export interface PrecioMaterial {
  id: number
  metodo: 'por_tonelada' | 'por_gramo'
  precio_por_tonelada?: number
  precio_por_gramo?: number
  tenor_min: number
  tenor_max: number
  id_minero?: number
  id_zona?: number
  fecha_inicio: string
  fecha_fin?: string
  activo?: boolean
}

export interface TarifaZona {
  id: number
  zona: string
  id_zona: number
  valor_tonelada: number
  vigente_desde: string
}

export interface Zona {
  id: number
  nombre: string
}

export interface MineroReal {
  id: number
  nombre: string
  metodo: 'por_tonelada' | 'por_gramo'
}

export interface DuenoVolqueta {
  id: number
  nombre: string
  titular?: string
  cc?: string
  banco?: string
  numero_cuenta?: string
  alias?: string
  telefono?: string
  nequi?: string
  estado: 'activo' | 'inactivo'
}

export interface AnalisisRow {
  id: number
  id_entrada: number | null
  id_material_concentrado: number | null
  numero_analisis: string
  ton: number | null
  porcentaje_humedad: number
  toneladas_humedas: number | null
  toneladas_secas: number | null
  au_gr_x_ton: number
  au_falso: number
  ag_gr_x_ton: number | null
  au_concentrado: number | null
  ag_concentrado: number | null
  fecha_salida: string | null
  comentarios: string | null
  estado_pago: 'no_aplica' | 'pendiente' | 'pagado'
}

export interface LoteConcentrado {
  id: number
  codigo: string
  fecha_inicio: string
  fecha_fin: string | null
  hizo_molienda: boolean
  hizo_flotacion: boolean
  hizo_filtroprensa: boolean
  toneladas_humedo: number
  porcentaje_humedad: number
  toneladas_seco: number
  toneladas_disponibles: number
  ubicacion_canoa: string | null
  precio_maquila_por_ton: number
  maquila_total: number
  material_seco_procesado?: number
  hizo_relave?: boolean
  estado: 'en_proceso' | 'en_canoa' | 'parcialmente_enviado' | 'enviado_completo'
  comentarios: string | null
}

export interface InventarioLoteRow {
  id: number
  id_material_concentrado: number | null
  id_entrada: number | null
  condicion_material: 'Humedo' | 'Seco'
  porcentaje_humedad: number
  toneladas_iniciales: number
  toneladas_disponibles: number
  estado: 'almacenado' | 'agotado'
  ubicacion: string | null
  fecha_ingreso: string
}

export type TipoMovimiento = 'ENTRADA_PLANTA' | 'ENTRADA_CONCENTRADO' | 'SALIDA_VIAJE' | 'SALIDA_PROCESO' | 'AJUSTE_MERMA'

export interface KardexRow {
  id: number
  id_lote: number
  fecha: string
  tipo_movimiento: TipoMovimiento
  toneladas_movidas: number
  destino_referencia: string | null
}

export interface MaterialRow {
  id: number
  numero_volqueta: number
  mina: string
  id_minero?: number
  id_zona?: number
  id_dueno?: number
  id_volqueta?: string
  fecha: string
  peso_llegada_planta: number
  porcentaje_humedad: number
  tenor: number
  total_material_seco: number
  estado: 'incluida_viaje' | 'pagada' | 'pendiente' | 'en_proceso'
  lote: string | null
}

export interface LoteRow {
  id: number
  codigo: string
  fecha_inicio: string
  fecha_fin: string
  estado: string
  toneladas_humedo: number
  toneladas_disponibles: number
  maquila_total: number
  material_seco_procesado: number
}

export interface LineaViaje {
  id: number
  concepto: string
  lote: string
  concentrado_humedo: number
  concentrado_seco: number
  costo_maquila: number
  valor_total: number
}

export interface ViajeRow {
  id: number
  numero_viaje: string
  fecha: string
  maquila: number
  total_costo_material: number
  lineas: LineaViaje[]
}

export interface AguaRow {
  id: number
  id_dueno: number
  conductor: string
  fecha: string
  valor_viaje: number
  cantidad_viajes: number
  acpm: number
  valor_total: number  // campo GENERADO en BD = (valor_viaje × cantidad_viajes) - acpm
}

export interface EmpleadoReal {
  id: number
  nombre: string
  labor: string
  salario_quincenal: number
}

export interface PrestamoEmpleadoMock {
  id: number
  empleadoId: number
  concepto: string
  valor_total: number
  cuotas_mensuales: number
  cuota_mensual: number
  cuota_quincenal: number
  fecha_inicio: string
  pagos: { quincena: string; monto: number; estado: 'pagado' | 'pendiente' }[]
  estado: 'activo' | 'pagado'
}

// ===================================================
// TARIFAS — precio_material (por tenor)
// ===================================================
export const preciosMaterial: PrecioMaterial[] = [
  // por_tonelada (general — sin id_minero)
  { id:1,  metodo:'por_tonelada', precio_por_tonelada:100000,  tenor_min:2.0,  tenor_max:2.9,  fecha_inicio:'2025-01-01' },
  { id:2,  metodo:'por_tonelada', precio_por_tonelada:150000,  tenor_min:3.0,  tenor_max:3.9,  fecha_inicio:'2025-01-01' },
  { id:3,  metodo:'por_tonelada', precio_por_tonelada:280000,  tenor_min:4.0,  tenor_max:4.9,  fecha_inicio:'2025-01-01' },
  { id:4,  metodo:'por_tonelada', precio_por_tonelada:400000,  tenor_min:5.0,  tenor_max:5.9,  fecha_inicio:'2025-01-01' },
  { id:5,  metodo:'por_tonelada', precio_por_tonelada:650000,  tenor_min:6.0,  tenor_max:7.9,  fecha_inicio:'2025-01-01' },
  { id:6,  metodo:'por_tonelada', precio_por_tonelada:850000,  tenor_min:8.0,  tenor_max:9.9,  fecha_inicio:'2025-01-01' },
  { id:7,  metodo:'por_tonelada', precio_por_tonelada:1000000, tenor_min:10.0, tenor_max:10.9, fecha_inicio:'2025-01-01' },
  // por_gramo (general — sin id_minero)
  { id:8,  metodo:'por_gramo', precio_por_gramo:65000,  tenor_min:4.0,  tenor_max:6.0,  fecha_inicio:'2025-01-01' },
  { id:9,  metodo:'por_gramo', precio_por_gramo:72000,  tenor_min:6.1,  tenor_max:7.9,  fecha_inicio:'2025-01-01' },
  { id:10, metodo:'por_gramo', precio_por_gramo:85000,  tenor_min:8.0,  tenor_max:10.0, fecha_inicio:'2025-01-01' },
  { id:11, metodo:'por_gramo', precio_por_gramo:100000, tenor_min:10.1, tenor_max:12.0, fecha_inicio:'2025-01-01' },
  { id:12, metodo:'por_gramo', precio_por_gramo:115000, tenor_min:12.1, tenor_max:14.0, fecha_inicio:'2025-01-01' },
  { id:13, metodo:'por_gramo', precio_por_gramo:125000, tenor_min:14.1, tenor_max:16.0, fecha_inicio:'2025-01-01' },
]

// ===================================================
// TARIFAS — tarifa_zona (flete transporte)
// ===================================================
export const tarifasZona: TarifaZona[] = [
  { id:1, zona:'MINA 80',      id_zona:3, valor_tonelada:110000, vigente_desde:'2026-07-01' },
  { id:2, zona:'CULO ALZADO',  id_zona:5, valor_tonelada:400000, vigente_desde:'2026-07-01' },
  { id:3, zona:'GENERAL',      id_zona:1, valor_tonelada:100000, vigente_desde:'2026-07-01' },
  { id:4, zona:'MINA CACHETE', id_zona:6, valor_tonelada:110000, vigente_desde:'2026-07-01' },
  // Mina 30 (id_zona:2) y Santa Rosa (id_zona:4) sin tarifa asignada aún
]

// ===================================================
// CATÁLOGOS
// ===================================================
export const zonas: Zona[] = [
  { id:1, nombre:'General' },
  { id:2, nombre:'Mina 30' },
  { id:3, nombre:'Mina 80' },
  { id:4, nombre:'Santa Rosa' },
  { id:5, nombre:'Culo Alzado' },
  { id:6, nombre:'Mina Cachete' },
]

export const mineros: MineroReal[] = [
  { id:1,  nombre:'NAUM',           metodo:'por_gramo'    },
  { id:2,  nombre:'OMAR MINA 80',   metodo:'por_tonelada' },
  { id:3,  nombre:'LEONEL NAVARRO', metodo:'por_gramo'    },
  { id:4,  nombre:'JEFERSON',       metodo:'por_tonelada' },
  { id:5,  nombre:'MARLON ARENAS',  metodo:'por_tonelada' },
  { id:6,  nombre:'RICARDO POVEDA', metodo:'por_tonelada' },
  { id:7,  nombre:'CAMILO',         metodo:'por_tonelada' },
  { id:8,  nombre:'ALEX MINA',      metodo:'por_tonelada' },
  { id:9,  nombre:'JOSE SAN ISIDRO',metodo:'por_tonelada' },
  { id:10, nombre:'JAINIER',        metodo:'por_gramo'    },
  { id:11, nombre:'CARLOS',         metodo:'por_tonelada' },
  { id:12, nombre:'TATA CARLOS',    metodo:'por_tonelada' },
  { id:13, nombre:'JARAMILLO',      metodo:'por_gramo'    },
]

export const duenosVolqueta: DuenoVolqueta[] = [
  { id:1,  nombre:'ANIBAL',    titular:'Zusan Cristina Santiago',  cc:'1193034408', banco:'Bancolombia', numero_cuenta:'29779958688', alias:'Anibal',       nequi:'0', estado:'activo' },
  { id:2,  nombre:'GEIBER',    estado:'activo',                    alias:'Geiber' },
  { id:3,  nombre:'ISAIAS',    titular:'Osmel Isaia Cabezas',      cc:'1012410300', banco:'Bancolombia', numero_cuenta:'91238946773', alias:'Isaias',       nequi:'0', estado:'activo' },
  { id:4,  nombre:'DEIMER',    titular:'Leydis Garcia Rivera',     cc:'1096223260', banco:'Bancolombia', numero_cuenta:'91286243750', alias:'Deimer',       nequi:'0', estado:'activo' },
  { id:5,  nombre:'CARLOS',    titular:'Carlos Acuña Povea',       cc:'12401398',   banco:'Bancolombia', numero_cuenta:'95107240757', alias:'Pata de palo', nequi:'0', estado:'activo' },
  { id:6,  nombre:'CAMILO',    titular:'Luis Angel Furnieles',     cc:'1047391774', banco:'Bancolombia', numero_cuenta:'48427520806', alias:'Camilo',       nequi:'0', estado:'activo' },
  { id:7,  nombre:'CLIXMAN',   titular:'Elianny Jimenez',          banco:'Bancolombia', numero_cuenta:'29766712850',                alias:'Clixman',      nequi:'0', estado:'activo' },
  { id:8,  nombre:'MANUEL',    titular:'Alfred Sanguino Guevara',  cc:'88280855',   banco:'Bancolombia', numero_cuenta:'31872419031', alias:'Manuel',       nequi:'0', estado:'activo' },
  { id:9,  nombre:'NELSON',    estado:'activo',                    alias:'Nelson' },
  { id:10, nombre:'JOEL',      estado:'activo',                    alias:'Joel' },
  { id:11, nombre:'JARAMILLO', estado:'activo',                    alias:'Jaramillo' },
]

// Mapping mina → zona (para calcular flete)
export const MINA_A_ZONA: Record<string, number> = {
  'OMAR M80':  3,   // Mina 80
  'OMAR M30':  2,   // Mina 30 (sin tarifa)
  'NAUM':      1,   // General
  'JEFERSON':  1,   // General
  'ABRAHAM':   1,   // General
  'ANTONIO':   1,   // General
  'MARLON':    1,   // General
}

// Mapping mina → mineroId (para calcular precio material)
export const MINA_A_MINERO: Record<string, number> = {
  'NAUM':     1,
  'OMAR M80': 2,
  'JEFERSON': 4,
  'MARLON':   5,
  'ABRAHAM':  0,  // 0 = no encontrado → usar precio general
  'ANTONIO':  0,
  'OMAR M30': 0,
}

// ===================================================
// MATERIALES
// ===================================================
export const materialesMock: MaterialRow[] = [
  // Viaje 13-1: Jeferson, Abraham, Antonio, Naum, Omar Mina30
  { id:101, numero_volqueta:13006, mina:'JEFERSON', fecha:'2025-10-30', peso_llegada_planta:10.850, porcentaje_humedad:0.110, tenor:7.5, total_material_seco:9.6565,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:102, numero_volqueta:13007, mina:'JEFERSON', fecha:'2025-11-01', peso_llegada_planta:10.290, porcentaje_humedad:0.046, tenor:7.5, total_material_seco:9.8167,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:103, numero_volqueta:13008, mina:'JEFERSON', fecha:'2025-11-28', peso_llegada_planta:10.270, porcentaje_humedad:0.065, tenor:5.7, total_material_seco:9.6024,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:104, numero_volqueta:13009, mina:'JEFERSON', fecha:'2025-12-09', peso_llegada_planta: 9.270, porcentaje_humedad:0.051, tenor:4.8, total_material_seco:8.7972,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:105, numero_volqueta:13010, mina:'JEFERSON', fecha:'2025-12-11', peso_llegada_planta:10.860, porcentaje_humedad:0.050, tenor:4.8, total_material_seco:10.3170, estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:106, numero_volqueta:13011, mina:'JEFERSON', fecha:'2025-12-20', peso_llegada_planta:10.280, porcentaje_humedad:0.080, tenor:5.6, total_material_seco:9.4576,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:107, numero_volqueta:13012, mina:'ABRAHAM',  fecha:'2025-11-03', peso_llegada_planta:10.760, porcentaje_humedad:0.200, tenor:6.3, total_material_seco:8.6080,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:108, numero_volqueta:13013, mina:'ABRAHAM',  fecha:'2025-11-13', peso_llegada_planta: 9.500, porcentaje_humedad:0.100, tenor:3.7, total_material_seco:8.5500,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:109, numero_volqueta:13014, mina:'ABRAHAM',  fecha:'2025-11-19', peso_llegada_planta:11.680, porcentaje_humedad:0.054, tenor:7.2, total_material_seco:11.0493, estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:110, numero_volqueta:13015, mina:'ANTONIO',  fecha:'2025-10-06', peso_llegada_planta: 7.740, porcentaje_humedad:0.100, tenor:4.7, total_material_seco:6.9660,  estado:'incluida_viaje', lote:'LC-13-1-G' },
  { id:111, numero_volqueta:13016, mina:'NAUM',     fecha:'2026-02-20', peso_llegada_planta:11.700, porcentaje_humedad:0.077, tenor:6.5, total_material_seco:10.7991, estado:'incluida_viaje', lote:'LC-13-1-H' },
  { id:112, numero_volqueta:13017, mina:'NAUM',     fecha:'2026-03-01', peso_llegada_planta:12.760, porcentaje_humedad:0.080, tenor:8.0, total_material_seco:11.7392, estado:'incluida_viaje', lote:'LC-13-1-H' },
  { id:113, numero_volqueta:13018, mina:'OMAR M30', fecha:'2026-02-20', peso_llegada_planta:13.590, porcentaje_humedad:0.059, tenor:8.5, total_material_seco:12.7882, estado:'incluida_viaje', lote:'LC-13-1-H' },
  // Viaje 13-2
  { id:114, numero_volqueta:13019,  mina:'OMAR M80', fecha:'2026-02-20', peso_llegada_planta:10.700, porcentaje_humedad:0.059, tenor:8.5, total_material_seco:10.0687, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:115, numero_volqueta:130192, mina:'OMAR M80', fecha:'2026-02-20', peso_llegada_planta:13.590, porcentaje_humedad:0.059, tenor:8.5, total_material_seco:12.7882, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:116, numero_volqueta:13020,  mina:'OMAR M80', fecha:'2026-02-21', peso_llegada_planta:11.310, porcentaje_humedad:0.059, tenor:9.0, total_material_seco:10.6427, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:117, numero_volqueta:13021,  mina:'OMAR M80', fecha:'2026-02-21', peso_llegada_planta:12.090, porcentaje_humedad:0.059, tenor:9.0, total_material_seco:11.3767, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:118, numero_volqueta:13022,  mina:'OMAR M80', fecha:'2026-02-26', peso_llegada_planta:10.890, porcentaje_humedad:0.053, tenor:8.0, total_material_seco:10.3128, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:119, numero_volqueta:13023,  mina:'OMAR M80', fecha:'2026-02-27', peso_llegada_planta:11.110, porcentaje_humedad:0.053, tenor:7.3, total_material_seco:10.5212, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:120, numero_volqueta:13024,  mina:'OMAR M80', fecha:'2026-02-28', peso_llegada_planta:10.890, porcentaje_humedad:0.053, tenor:8.1, total_material_seco:10.3128, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:121, numero_volqueta:13025,  mina:'OMAR M80', fecha:'2026-03-02', peso_llegada_planta:10.560, porcentaje_humedad:0.050, tenor:8.4, total_material_seco:10.0320, estado:'incluida_viaje', lote:'LC-13-2-I' },
  { id:122, numero_volqueta:13026,  mina:'MARLON',   fecha:'2026-03-09', peso_llegada_planta: 2.000, porcentaje_humedad:0.000, tenor:10.0, total_material_seco:2.0000, estado:'incluida_viaje', lote:'LC-13-2-J' },
  // Viaje 13-3
  { id:123, numero_volqueta:13027, mina:'OMAR M80', fecha:'2026-03-10', peso_llegada_planta:12.270, porcentaje_humedad:0.086, tenor:7.8, total_material_seco:11.2153, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:124, numero_volqueta:13028, mina:'OMAR M80', fecha:'2026-03-11', peso_llegada_planta:12.890, porcentaje_humedad:0.054, tenor:8.0, total_material_seco:12.1934, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:125, numero_volqueta:13029, mina:'OMAR M80', fecha:'2026-03-12', peso_llegada_planta:12.970, porcentaje_humedad:0.054, tenor:7.8, total_material_seco:12.2696, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:126, numero_volqueta:13030, mina:'OMAR M80', fecha:'2026-03-17', peso_llegada_planta:11.620, porcentaje_humedad:0.070, tenor:7.5, total_material_seco:10.8066, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:127, numero_volqueta:13031, mina:'OMAR M80', fecha:'2026-03-18', peso_llegada_planta:13.960, porcentaje_humedad:0.055, tenor:8.9, total_material_seco:13.1922, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:128, numero_volqueta:13032, mina:'OMAR M80', fecha:'2026-03-18', peso_llegada_planta:11.640, porcentaje_humedad:0.060, tenor:9.1, total_material_seco:10.9416, estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:129, numero_volqueta:13033, mina:'OMAR M80', fecha:'2026-03-18', peso_llegada_planta:10.080, porcentaje_humedad:0.060, tenor:9.1, total_material_seco:9.4752,  estado:'incluida_viaje', lote:'LC-13-3-K' },
  { id:130, numero_volqueta:13034, mina:'OMAR M80', fecha:'2026-03-18', peso_llegada_planta:10.640, porcentaje_humedad:0.060, tenor:9.1, total_material_seco:10.0016, estado:'incluida_viaje', lote:'LC-13-3-K' },
  // Pendientes
  { id:131, numero_volqueta:14001, mina:'OMAR M80', fecha:'2026-07-10', peso_llegada_planta:14.000, porcentaje_humedad:0.070, tenor:8.2, total_material_seco:13.020, estado:'pagada',    lote:null },
  { id:132, numero_volqueta:14002, mina:'NAUM',     fecha:'2026-07-11', peso_llegada_planta:12.500, porcentaje_humedad:0.060, tenor:7.8, total_material_seco:11.750, estado:'pagada',    lote:null },
  { id:133, numero_volqueta:14003, mina:'JEFERSON', fecha:'2026-07-12', peso_llegada_planta:11.200, porcentaje_humedad:0.055, tenor:6.5, total_material_seco:10.584, estado:'pendiente', lote:null },
]

// ===================================================
// LOTES
// ===================================================
export const lotesMock: LoteRow[] = [
  { id:17, codigo:'LC-13-1-G',        fecha_inicio:'2025-10-30', fecha_fin:'2026-02-10', estado:'enviado_completo', toneladas_humedo:22.0,  toneladas_disponibles:0,    maquila_total:27846210, material_seco_procesado:92.82 },
  { id:18, codigo:'LC-13-1-H',        fecha_inicio:'2026-02-20', fecha_fin:'2026-02-10', estado:'enviado_completo', toneladas_humedo: 7.0,  toneladas_disponibles:0,    maquila_total:10597950, material_seco_procesado:35.33 },
  { id:19, codigo:'LC-REMANENTE-13-1',fecha_inicio:'2026-02-20', fecha_fin:'2026-02-20', estado:'enviado_completo', toneladas_humedo: 2.20, toneladas_disponibles:0,    maquila_total:0,        material_seco_procesado:0 },
  { id:20, codigo:'LC-13-2-I',        fecha_inicio:'2026-02-20', fecha_fin:'2026-03-18', estado:'enviado_completo', toneladas_humedo:27.95, toneladas_disponibles:0,    maquila_total:25816530, material_seco_procesado:86.06 },
  { id:21, codigo:'LC-13-2-J',        fecha_inicio:'2026-03-09', fecha_fin:'2026-03-18', estado:'enviado_completo', toneladas_humedo: 2.0,  toneladas_disponibles:0,    maquila_total:0,        material_seco_procesado:2.0 },
  { id:22, codigo:'LC-REMANENTE-13-2',fecha_inicio:'2026-03-18', fecha_fin:'2026-03-18', estado:'enviado_completo', toneladas_humedo: 3.15, toneladas_disponibles:0,    maquila_total:0,        material_seco_procesado:0 },
  { id:23, codigo:'LC-13-3-K',        fecha_inicio:'2026-03-10', fecha_fin:'2026-03-25', estado:'enviado_completo', toneladas_humedo:35.85, toneladas_disponibles:0,    maquila_total:27028650, material_seco_procesado:90.09 },
  { id:24, codigo:'LC-REMANENTE-13-3',fecha_inicio:'2026-03-25', fecha_fin:'2026-03-25', estado:'en_canoa',        toneladas_humedo:10.0,  toneladas_disponibles:10.0, maquila_total:0,        material_seco_procesado:0 },
]

// ===================================================
// VIAJES
// ===================================================
export const viajesMock: ViajeRow[] = [
  {
    id:14, numero_viaje:'13-1', fecha:'2026-02-10',
    maquila:38444160, total_costo_material:43881550,
    lineas:[
      { id:50, concepto:'JEFERSON + ABRAHAM + ANTONIO',  lote:'LC-13-1-G',        concentrado_humedo:22.0, concentrado_seco:19.14, costo_maquila:27846210, valor_total:14523772 },
      { id:51, concepto:'NAUM + OMAR MINA 30',           lote:'LC-13-1-H',        concentrado_humedo: 4.8, concentrado_seco: 4.08, costo_maquila:10597950, valor_total:29357778 },
    ],
  },
  {
    id:15, numero_viaje:'13-2', fecha:'2026-03-18',
    maquila:25816530, total_costo_material:89622891,
    lineas:[
      { id:52, concepto:'OMAR MINA 80 vol 1-8',          lote:'LC-13-2-I',        concentrado_humedo:24.80, concentrado_seco:21.58, costo_maquila:25816530, valor_total:89622891 },
      { id:53, concepto:'MARLON ARENAS — sin maquila',   lote:'LC-13-2-J',        concentrado_humedo: 2.00, concentrado_seco: 1.86, costo_maquila:0,        valor_total:4450000 },
      { id:54, concepto:'REMANENTE LC-13-1-H — libre',   lote:'LC-REMANENTE-13-1',concentrado_humedo: 2.20, concentrado_seco: 1.91, costo_maquila:0,        valor_total:0 },
    ],
  },
  {
    id:16, numero_viaje:'13-3', fecha:'2026-03-26',
    maquila:27028650, total_costo_material:73186021,
    lineas:[
      { id:55, concepto:'OMAR MINA 80 vol 9-16',         lote:'LC-13-3-K',        concentrado_humedo:25.85, concentrado_seco:22.49, costo_maquila:27028650, valor_total:73186021 },
      { id:56, concepto:'LC-REMANENTE-13-2 — libre',     lote:'LC-REMANENTE-13-2',concentrado_humedo: 3.15, concentrado_seco: 2.74, costo_maquila:0,        valor_total:0 },
    ],
  },
]

// ===================================================
// AGUA — 34 registros reales (valor_total = campo generado en BD)
// ===================================================
export const aguaMock: AguaRow[] = [
  { id:1,  id_dueno:9, conductor:'Nelson', fecha:'2026-04-30', valor_viaje:200000, cantidad_viajes:6,  acpm:0,      valor_total:1200000 },
  { id:2,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-01', valor_viaje:200000, cantidad_viajes:5,  acpm:0,      valor_total:1000000 },
  { id:3,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-05', valor_viaje:200000, cantidad_viajes:8,  acpm:0,      valor_total:1600000 },
  { id:4,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-06', valor_viaje:200000, cantidad_viajes:8,  acpm:0,      valor_total:1600000 },
  { id:5,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-07', valor_viaje:200000, cantidad_viajes:6,  acpm:0,      valor_total:1200000 },
  { id:6,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-08', valor_viaje:200000, cantidad_viajes:9,  acpm:0,      valor_total:1800000 },
  { id:7,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-09', valor_viaje:200000, cantidad_viajes:6,  acpm:0,      valor_total:1200000 },
  { id:8,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-11', valor_viaje:130000, cantidad_viajes:6,  acpm:0,      valor_total:780000  },
  { id:9,  id_dueno:9, conductor:'Nelson', fecha:'2026-05-12', valor_viaje:180000, cantidad_viajes:7,  acpm:0,      valor_total:1260000 },
  { id:10, id_dueno:9, conductor:'Nelson', fecha:'2026-05-13', valor_viaje:180000, cantidad_viajes:7,  acpm:0,      valor_total:1260000 },
  { id:11, id_dueno:9, conductor:'Nelson', fecha:'2026-05-14', valor_viaje:180000, cantidad_viajes:7,  acpm:0,      valor_total:1260000 },
  { id:12, id_dueno:4, conductor:'Deimer', fecha:'2026-05-15', valor_viaje:180000, cantidad_viajes:7,  acpm:0,      valor_total:1260000 },
  { id:13, id_dueno:4, conductor:'Deimer', fecha:'2026-05-16', valor_viaje:180000, cantidad_viajes:5,  acpm:0,      valor_total:900000  },
  { id:14, id_dueno:4, conductor:'Deimer', fecha:'2026-05-17', valor_viaje:180000, cantidad_viajes:5,  acpm:0,      valor_total:900000  },
  { id:15, id_dueno:4, conductor:'Deimer', fecha:'2026-05-18', valor_viaje:180000, cantidad_viajes:6,  acpm:0,      valor_total:1080000 },
  { id:16, id_dueno:1, conductor:'Anibal', fecha:'2026-05-10', valor_viaje:180000, cantidad_viajes:3,  acpm:0,      valor_total:540000  },
  { id:17, id_dueno:9, conductor:'Nelson', fecha:'2026-05-19', valor_viaje:130000, cantidad_viajes:1,  acpm:0,      valor_total:130000  },
  { id:18, id_dueno:9, conductor:'Nelson', fecha:'2026-05-20', valor_viaje:130000, cantidad_viajes:4,  acpm:0,      valor_total:520000  },
  { id:19, id_dueno:9, conductor:'Nelson', fecha:'2026-05-21', valor_viaje:130000, cantidad_viajes:4,  acpm:0,      valor_total:520000  },
  { id:20, id_dueno:9, conductor:'Nelson', fecha:'2026-05-22', valor_viaje:130000, cantidad_viajes:6,  acpm:126000, valor_total:654000  },
  { id:21, id_dueno:9, conductor:'Nelson', fecha:'2026-05-23', valor_viaje:130000, cantidad_viajes:7,  acpm:126000, valor_total:784000  },
  { id:22, id_dueno:9, conductor:'Nelson', fecha:'2026-05-25', valor_viaje:130000, cantidad_viajes:8,  acpm:126000, valor_total:914000  },
  { id:23, id_dueno:9, conductor:'Nelson', fecha:'2026-05-26', valor_viaje:130000, cantidad_viajes:8,  acpm:126000, valor_total:914000  },
  { id:24, id_dueno:9, conductor:'Nelson', fecha:'2026-05-27', valor_viaje:130000, cantidad_viajes:8,  acpm:0,      valor_total:1040000 },
  { id:25, id_dueno:9, conductor:'Nelson', fecha:'2026-05-28', valor_viaje:130000, cantidad_viajes:3,  acpm:0,      valor_total:390000  },
  { id:26, id_dueno:9, conductor:'Nelson', fecha:'2026-05-29', valor_viaje:130000, cantidad_viajes:3,  acpm:0,      valor_total:390000  },
  { id:27, id_dueno:9, conductor:'Nelson', fecha:'2026-05-30', valor_viaje:130000, cantidad_viajes:9,  acpm:0,      valor_total:1170000 },
  { id:28, id_dueno:9, conductor:'Nelson', fecha:'2026-06-02', valor_viaje:130000, cantidad_viajes:5,  acpm:0,      valor_total:650000  },
  { id:29, id_dueno:9, conductor:'Nelson', fecha:'2026-06-03', valor_viaje:130000, cantidad_viajes:3,  acpm:126000, valor_total:264000  },
  { id:30, id_dueno:9, conductor:'Nelson', fecha:'2026-06-04', valor_viaje:130000, cantidad_viajes:3,  acpm:126000, valor_total:264000  },
  { id:31, id_dueno:9, conductor:'Nelson', fecha:'2026-06-05', valor_viaje:130000, cantidad_viajes:4,  acpm:126000, valor_total:394000  },
  { id:32, id_dueno:9, conductor:'Nelson', fecha:'2026-06-06', valor_viaje:130000, cantidad_viajes:7,  acpm:0,      valor_total:910000  },
  { id:33, id_dueno:1, conductor:'Anibal', fecha:'2026-07-03', valor_viaje:60000,  cantidad_viajes:2,  acpm:0,      valor_total:120000  },
  { id:34, id_dueno:1, conductor:'Anibal', fecha:'2026-07-03', valor_viaje:60000,  cantidad_viajes:2,  acpm:10000,  valor_total:110000  },
]

// ===================================================
// EMPLEADOS — 33 reales con salario quincenal estimado
// ===================================================
const SALARIO_POR_LABOR: Record<string, number> = {
  'PLANTA':                          800000,
  'OPERACION PLANTA - LIDER':       1200000,
  'OPERACION PLANTA':               1000000,
  'SECADO':                          900000,
  'MATERIAL - CARGUES':              900000,
  'SOLDADOR':                       1000000,
  'SOLDADOR-AYUDANTE':               800000,
  'JEFE-ADMINISTRATIVO':            2500000,
  'CONTADORA-ADMINISTRATIVO':       2000000,
  'MATERIAL-ADMINISTRATIVO':        1500000,
  'EXPORTACIONES-ADMINISTRATIVO':   1500000,
  'ADMINISTRATIVO':                 1200000,
  'VOLQUETA-ADMINISTRATIVO':        1200000,
  'JEFE-APRENDIS-ADMINISTRATIVO':   1500000,
}

function emp(id: number, nombre: string, labor: string): EmpleadoReal {
  return { id, nombre, labor, salario_quincenal: SALARIO_POR_LABOR[labor] ?? 800000 }
}

export const empleados: EmpleadoReal[] = [
  emp( 1, 'EDER HERNANDEZ',         'PLANTA'),
  emp( 2, 'GINA MONTEALEGRE',       'PLANTA'),
  emp( 3, 'ESTEFANIA MONTEALEGRE',  'PLANTA'),
  emp( 4, 'ULPIANO CAMPO',          'PLANTA'),
  emp( 5, 'MARYORIS LABORAT',       'PLANTA'),
  emp( 6, 'MILADYS',                'PLANTA'),
  emp( 7, 'CALIXTO LOZANO',         'OPERACION PLANTA - LIDER'),
  emp( 8, 'EDINSON MARTINEZ',       'OPERACION PLANTA'),
  emp( 9, 'ANDRES RUEDA',           'OPERACION PLANTA'),
  emp(10, 'ANDRES CASTILLO',        'OPERACION PLANTA'),
  emp(11, 'ENEL ZAMBRANO',          'OPERACION PLANTA - LIDER'),
  emp(12, 'SEBASTIAN NARVAEZ',       'OPERACION PLANTA'),
  emp(13, 'RICARDO',                'OPERACION PLANTA'),
  emp(14, 'ALCIDES PADILLA',        'OPERACION PLANTA'),
  emp(15, 'CESAR JIMENEZ',          'OPERACION PLANTA'),
  emp(16, 'FRANCISCO JAVIER',       'OPERACION PLANTA'),
  emp(17, 'ENGER',                  'OPERACION PLANTA'),
  emp(18, 'CRISTIAN JIMENEZ',       'OPERACION PLANTA'),
  emp(19, 'DAVID HERNANDEZ',        'SECADO'),
  emp(20, 'YHONNY',                 'SECADO'),
  emp(21, 'DANIEL',                 'SECADO'),
  emp(22, 'ANDRES CAMPO',           'SECADO'),
  emp(23, 'MAURICIO GIRALDO',       'MATERIAL - CARGUES'),
  emp(24, 'LUIS',                   'SOLDADOR'),
  emp(25, 'WILDER',                 'SOLDADOR'),
  emp(26, 'ALFREDO RICO',           'SOLDADOR-AYUDANTE'),
  emp(27, 'DAVID OYUELA',           'JEFE-ADMINISTRATIVO'),
  emp(28, 'JULIANA OTERO',          'CONTADORA-ADMINISTRATIVO'),
  emp(29, 'VICTORIA DIAZ',          'MATERIAL-ADMINISTRATIVO'),
  emp(30, 'ANGELA GARCIA',          'EXPORTACIONES-ADMINISTRATIVO'),
  emp(31, 'CINDY',                  'ADMINISTRATIVO'),
  emp(32, 'VALERIA OYUELA',         'VOLQUETA-ADMINISTRATIVO'),
  emp(33, 'JUAN DAVID OYUELA',      'JEFE-APRENDIS-ADMINISTRATIVO'),
]

// ===================================================
// PRÉSTAMOS EMPLEADOS (mock — algunos con trazabilidad)
// ===================================================
export const prestamosEmpleadoMock: PrestamoEmpleadoMock[] = [
  {
    id:1, empleadoId:1, concepto:'Préstamo personal', valor_total:1200000, cuotas_mensuales:6,
    cuota_mensual:200000, cuota_quincenal:100000, fecha_inicio:'2026-06-01',
    estado:'activo',
    pagos:[
      { quincena:'2026-06-01/2026-06-15', monto:100000, estado:'pagado' },
      { quincena:'2026-06-16/2026-06-30', monto:100000, estado:'pagado' },
      { quincena:'2026-07-01/2026-07-15', monto:100000, estado:'pendiente' },
    ],
  },
  {
    id:2, empleadoId:7, concepto:'Adelanto de nómina', valor_total:600000, cuotas_mensuales:3,
    cuota_mensual:200000, cuota_quincenal:100000, fecha_inicio:'2026-07-01',
    estado:'activo',
    pagos:[
      { quincena:'2026-07-01/2026-07-15', monto:100000, estado:'pendiente' },
    ],
  },
  {
    id:3, empleadoId:19, concepto:'Préstamo urgente', valor_total:400000, cuotas_mensuales:4,
    cuota_mensual:100000, cuota_quincenal:50000, fecha_inicio:'2026-06-16',
    estado:'activo',
    pagos:[
      { quincena:'2026-06-16/2026-06-30', monto:50000,  estado:'pagado' },
      { quincena:'2026-07-01/2026-07-15', monto:50000,  estado:'pendiente' },
    ],
  },
]

// ===================================================
// HELPERS — 4×1000
// ===================================================
export function calc4x1000(monto: number) {
  return { monto, impuesto: Math.round(monto * 0.004), neto: Math.round(monto * 0.996) }
}
export function calc4x1000Inverso(neto: number) {
  const bruto = Math.round(neto / 0.996)
  return { neto, bruto, impuesto: bruto - neto }
}

// ===================================================
// INVENTARIO CALCULADO
// ===================================================
export const inventarioCrudo = materialesMock
  .filter((m) => m.estado === 'pagada' || m.estado === 'pendiente')
  .map((m) => ({ ...m, pendiente_humedo: m.peso_llegada_planta, pendiente_seco: m.total_material_seco }))

export const inventarioConcentrado = lotesMock
  .filter((l) => l.toneladas_disponibles > 0)
  .map((l) => ({ ...l, disponible_humedo: l.toneladas_disponibles }))

// ===================================================
// ANÁLISIS — registros reales de BD (subset representativo)
// ===================================================
export const analisisMock: AnalisisRow[] = [
  { id:167, id_entrada:null, id_material_concentrado:11, numero_analisis:'AN-LOTB',   ton:7.0,   porcentaje_humedad:0.15, toneladas_humedas:1.05,  toneladas_secas:5.95,  au_gr_x_ton:141.0, au_falso:141.0, ag_gr_x_ton:2678.0,  au_concentrado:838.95,  ag_concentrado:15934.1,  fecha_salida:'2026-02-10', comentarios:'Concentrado Lote B 12-1',               estado_pago:'no_aplica' },
  { id:168, id_entrada:245,  id_material_concentrado:null, numero_analisis:'AN-12019', ton:10.7,  porcentaje_humedad:0.059, toneladas_humedas:0.6313, toneladas_secas:10.0687, au_gr_x_ton:8.5, au_falso:8.5, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Análisis Omar vol 1', estado_pago:'no_aplica' },
  { id:169, id_entrada:246,  id_material_concentrado:null, numero_analisis:'AN-12020', ton:11.31, porcentaje_humedad:0.059, toneladas_humedas:0.6673, toneladas_secas:10.6427, au_gr_x_ton:9.0, au_falso:9.0, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Análisis Omar vol 3', estado_pago:'no_aplica' },
  { id:170, id_entrada:247,  id_material_concentrado:null, numero_analisis:'AN-12021', ton:12.09, porcentaje_humedad:0.059, toneladas_humedas:0.7133, toneladas_secas:11.3767, au_gr_x_ton:9.0, au_falso:9.0, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Análisis Omar vol 4', estado_pago:'no_aplica' },
  { id:171, id_entrada:248,  id_material_concentrado:null, numero_analisis:'AN-12022', ton:10.89, porcentaje_humedad:0.053, toneladas_humedas:0.5772, toneladas_secas:10.3128, au_gr_x_ton:8.0, au_falso:8.0, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Análisis Omar vol 5', estado_pago:'no_aplica' },
  { id:172, id_entrada:249,  id_material_concentrado:null, numero_analisis:'AN-12023', ton:11.11, porcentaje_humedad:0.053, toneladas_humedas:0.5888, toneladas_secas:10.5212, au_gr_x_ton:7.3, au_falso:7.3, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Análisis Omar vol 6', estado_pago:'no_aplica' },
  { id:176, id_entrada:null, id_material_concentrado:12, numero_analisis:'AN-LOTC',   ton:27.95, porcentaje_humedad:0.13, toneladas_humedas:3.63,  toneladas_secas:24.32, au_gr_x_ton:429.0, au_falso:429.0, ag_gr_x_ton:10486.0, au_concentrado:10433.28, ag_concentrado:255019.52, fecha_salida:'2026-03-18', comentarios:'Concentrado Lote C 12-2', estado_pago:'no_aplica' },
  { id:179, id_entrada:254,  id_material_concentrado:null, numero_analisis:'AN-12027', ton:12.27, porcentaje_humedad:0.086, toneladas_humedas:1.0552, toneladas_secas:11.2148, au_gr_x_ton:7.8, au_falso:7.8, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Omar vol 9', estado_pago:'no_aplica' },
  { id:180, id_entrada:255,  id_material_concentrado:null, numero_analisis:'AN-12028', ton:12.89, porcentaje_humedad:0.054, toneladas_humedas:0.6961, toneladas_secas:12.1939, au_gr_x_ton:8.0, au_falso:8.0, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Omar vol 10', estado_pago:'no_aplica' },
  { id:187, id_entrada:null, id_material_concentrado:16, numero_analisis:'3284-3305-3310', ton:25.85, porcentaje_humedad:0.13, toneladas_humedas:3.3605, toneladas_secas:22.4895, au_gr_x_ton:18.2, au_falso:18.2, ag_gr_x_ton:434.0, au_concentrado:409.31, ag_concentrado:9760.44, fecha_salida:'2026-03-25', comentarios:'Concentrado Lote F 12-3 vol 9-16', estado_pago:'no_aplica' },
  { id:201, id_entrada:null, id_material_concentrado:17, numero_analisis:'AN-LOTG',   ton:22.0,  porcentaje_humedad:0.13, toneladas_humedas:2.86,  toneladas_secas:19.14, au_gr_x_ton:440.0, au_falso:440.0, ag_gr_x_ton:6929.0,  au_concentrado:8421.6,   ag_concentrado:132621.06, fecha_salida:'2026-02-10', comentarios:'Conc Lote G 13-1', estado_pago:'no_aplica' },
  { id:227, id_entrada:292,  id_material_concentrado:null, numero_analisis:'AN-13035', ton:12.0,  porcentaje_humedad:0.05, toneladas_humedas:0.6,  toneladas_secas:11.4,  au_gr_x_ton:8.0, au_falso:8.0, ag_gr_x_ton:null, au_concentrado:null, ag_concentrado:null, fecha_salida:null, comentarios:'Omar vol 1', estado_pago:'no_aplica' },
  { id:237, id_entrada:null, id_material_concentrado:27, numero_analisis:'AN-LOTL',   ton:26.0,  porcentaje_humedad:0.13, toneladas_humedas:3.38,  toneladas_secas:22.62, au_gr_x_ton:18.5, au_falso:18.5, ag_gr_x_ton:440.0,  au_concentrado:418.47,   ag_concentrado:9952.8,    fecha_salida:'2026-04-10', comentarios:'Conc Lote L 13-4', estado_pago:'no_aplica' },
  { id:238, id_entrada:303,  id_material_concentrado:null, numero_analisis:'AN-303',   ton:25.5,  porcentaje_humedad:0.15, toneladas_humedas:3.825, toneladas_secas:21.675, au_gr_x_ton:10.0, au_falso:10.0, ag_gr_x_ton:325.13, au_concentrado:20.0, ag_concentrado:15.0, fecha_salida:null, comentarios:null, estado_pago:'no_aplica' },
]

// ===================================================
// LOTES CONCENTRADO — material_concentrado real
// ===================================================
export const lotesConcentrado: LoteConcentrado[] = [
  { id:10, codigo:'LC-12-1-A',      fecha_inicio:'2025-10-30', fecha_fin:'2026-02-10', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:22.0,  porcentaje_humedad:0.13, toneladas_seco:19.14, toneladas_disponibles:0,    ubicacion_canoa:'Canoa A',        precio_maquila_por_ton:300000, maquila_total:27846210, estado:'enviado_completo', comentarios:null },
  { id:11, codigo:'LC-12-1-B',      fecha_inicio:'2026-02-20', fecha_fin:'2026-02-10', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:7.0,   porcentaje_humedad:0.15, toneladas_seco:5.95,  toneladas_disponibles:0,    ubicacion_canoa:'Canoa B',        precio_maquila_por_ton:300000, maquila_total:10597950, estado:'enviado_completo', comentarios:null },
  { id:12, codigo:'LC-12-2-C',      fecha_inicio:'2026-02-20', fecha_fin:'2026-03-18', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:27.95, porcentaje_humedad:0.13, toneladas_seco:24.3165, toneladas_disponibles:0,  ubicacion_canoa:'Canoa C',        precio_maquila_por_ton:300000, maquila_total:21980070, estado:'enviado_completo', comentarios:null },
  { id:16, codigo:'LC-12-3-F',      fecha_inicio:'2026-03-10', fecha_fin:'2026-03-25', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:35.85, porcentaje_humedad:0.13, toneladas_seco:31.1895, toneladas_disponibles:10.0, ubicacion_canoa:'Canoa F',       precio_maquila_por_ton:300000, maquila_total:15555000, estado:'parcialmente_enviado', comentarios:null },
  { id:17, codigo:'LC-13-1-G',      fecha_inicio:'2025-10-30', fecha_fin:'2026-02-10', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:22.0,  porcentaje_humedad:0.13, toneladas_seco:19.14, toneladas_disponibles:0,    ubicacion_canoa:'Canoa G',        precio_maquila_por_ton:300000, maquila_total:27846210, estado:'enviado_completo', comentarios:null },
  { id:20, codigo:'LC-13-2-I',      fecha_inicio:'2026-02-20', fecha_fin:'2026-03-18', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:27.95, porcentaje_humedad:0.13, toneladas_seco:24.3165, toneladas_disponibles:0,  ubicacion_canoa:'Canoa I',        precio_maquila_por_ton:300000, maquila_total:25816530, estado:'enviado_completo', comentarios:null },
  { id:22, codigo:'LC-13-3-K',      fecha_inicio:'2026-03-10', fecha_fin:'2026-03-25', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:35.85, porcentaje_humedad:0.13, toneladas_seco:31.1895, toneladas_disponibles:0,  ubicacion_canoa:'Canoa K',        precio_maquila_por_ton:300000, maquila_total:27028650, estado:'enviado_completo', comentarios:null },
  { id:27, codigo:'LC-13-4-L',      fecha_inicio:'2026-04-01', fecha_fin:'2026-04-10', hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:26.0,  porcentaje_humedad:0.13, toneladas_seco:22.62, toneladas_disponibles:0,    ubicacion_canoa:'Canoa L',        precio_maquila_por_ton:300000, maquila_total:24000000, estado:'enviado_completo', comentarios:null },
  { id:28, codigo:'LOTE-303',        fecha_inicio:'2026-07-04', fecha_fin:'2026-07-05', hizo_molienda:true,  hizo_flotacion:false, hizo_filtroprensa:true,  toneladas_humedo:20.0,  porcentaje_humedad:0.10, toneladas_seco:18.0,  toneladas_disponibles:0,    ubicacion_canoa:null,             precio_maquila_por_ton:0,      maquila_total:0,        material_seco_procesado:20.0, estado:'enviado_completo', comentarios:null },
  { id:29, codigo:'LC-REMANENTE-13-3', fecha_inicio:'2026-03-26', fecha_fin:null,        hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:10.0,  porcentaje_humedad:0.13, toneladas_seco:8.7,   toneladas_disponibles:10.0, ubicacion_canoa:'Canoa K-rem',    precio_maquila_por_ton:0,      maquila_total:0,        material_seco_procesado:0,    estado:'en_canoa',         comentarios:'Remanente viaje 13-3' },
  { id:30, codigo:'LC-2026-001',       fecha_inicio:'2026-07-15', fecha_fin:null,        hizo_molienda:false, hizo_flotacion:true,  hizo_filtroprensa:true,  toneladas_humedo:0,     porcentaje_humedad:0,    toneladas_seco:0,     toneladas_disponibles:0,    ubicacion_canoa:null,             precio_maquila_por_ton:300000, maquila_total:0,        material_seco_procesado:0,    estado:'en_proceso',       comentarios:'Lote julio 2026' },
]

// ===================================================
// INVENTARIO LOTES — tabla inventario real
// ===================================================
export const inventarioLotesMock: InventarioLoteRow[] = [
  { id:208, id_material_concentrado:20,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.13, toneladas_iniciales:27.95, toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa I',          fecha_ingreso:'2026-07-12' },
  { id:209, id_material_concentrado:21,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.07, toneladas_iniciales:2.0,   toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa J',          fecha_ingreso:'2026-07-12' },
  { id:210, id_material_concentrado:22,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.13, toneladas_iniciales:35.85, toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa K',          fecha_ingreso:'2026-07-12' },
  { id:211, id_material_concentrado:25,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.13, toneladas_iniciales:3.15,  toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa Remanente',  fecha_ingreso:'2026-07-13' },
  { id:212, id_material_concentrado:27,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.13, toneladas_iniciales:26.0,  toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa L',          fecha_ingreso:'2026-07-13' },
  { id:213, id_entrada:302,              id_material_concentrado:null, condicion_material:'Seco',   porcentaje_humedad:0.0,  toneladas_iniciales:15000.5, toneladas_disponibles:15000.5, estado:'almacenado', ubicacion:null,          fecha_ingreso:'2026-07-14' },
  { id:214, id_entrada:303,              id_material_concentrado:null, condicion_material:'Humedo', porcentaje_humedad:0.15, toneladas_iniciales:25.5,  toneladas_disponibles:25.5,  estado:'agotado',    ubicacion:null,             fecha_ingreso:'2026-07-14' },
  { id:215, id_material_concentrado:28,  id_entrada:null, condicion_material:'Humedo', porcentaje_humedad:0.10, toneladas_iniciales:20.0,  toneladas_disponibles:0,     estado:'agotado',    ubicacion:'Canoa principal',  fecha_ingreso:'2026-07-14' },
]

// ===================================================
// KARDEX MOVIMIENTOS — subset real
// ===================================================
export const kardexMock: KardexRow[] = [
  { id:260, id_lote:206, fecha:'2026-07-12', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:22.0,  destino_referencia:'Lote LC-13-1-G' },
  { id:261, id_lote:207, fecha:'2026-07-12', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:7.0,   destino_referencia:'Lote LC-13-1-H' },
  { id:262, id_lote:206, fecha:'2026-07-12', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:22.0,  destino_referencia:'Viaje #14' },
  { id:263, id_lote:207, fecha:'2026-07-12', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:4.8,   destino_referencia:'Viaje #14' },
  { id:264, id_lote:208, fecha:'2026-07-12', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:27.95, destino_referencia:'Lote LC-13-2-I' },
  { id:265, id_lote:209, fecha:'2026-07-12', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:2.0,   destino_referencia:'Lote LC-13-2-J' },
  { id:266, id_lote:208, fecha:'2026-07-12', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:24.8,  destino_referencia:'Viaje #15' },
  { id:267, id_lote:209, fecha:'2026-07-12', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:2.0,   destino_referencia:'Viaje #15' },
  { id:268, id_lote:210, fecha:'2026-07-12', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:35.85, destino_referencia:'Lote LC-13-3-K' },
  { id:269, id_lote:210, fecha:'2026-07-12', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:25.85, destino_referencia:'Viaje #16' },
  { id:271, id_lote:208, fecha:'2026-07-12', tipo_movimiento:'AJUSTE_MERMA',        toneladas_movidas:3.15,  destino_referencia:'Devolucion Viaje #16' },
  { id:273, id_lote:212, fecha:'2026-07-13', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:26.0,  destino_referencia:'Lote LC-13-4-L' },
  { id:274, id_lote:212, fecha:'2026-07-13', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:26.0,  destino_referencia:'Viaje #17' },
  { id:275, id_lote:213, fecha:'2026-07-14', tipo_movimiento:'ENTRADA_PLANTA',      toneladas_movidas:15000.5, destino_referencia:'Entrada MPE #302' },
  { id:276, id_lote:214, fecha:'2026-07-14', tipo_movimiento:'ENTRADA_PLANTA',      toneladas_movidas:25.5,  destino_referencia:'Entrada MPE #303' },
  { id:277, id_lote:1,   fecha:'2026-07-14', tipo_movimiento:'SALIDA_PROCESO',      toneladas_movidas:20.0,  destino_referencia:'Concentrado #28' },
  { id:278, id_lote:215, fecha:'2026-07-14', tipo_movimiento:'ENTRADA_CONCENTRADO', toneladas_movidas:20.0,  destino_referencia:'Lote LOTE-303' },
  { id:279, id_lote:215, fecha:'2026-07-14', tipo_movimiento:'SALIDA_VIAJE',        toneladas_movidas:20.0,  destino_referencia:'Viaje #18' },
]
