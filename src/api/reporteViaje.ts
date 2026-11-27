// Reporte de viaje (INF + COSTEO + DETALLADOS). Ejemplos reales: docs/datos/reporte_viaje/*.json
// Números llegan como number (no string). Fechas ISO: usar solo los 10 primeros caracteres.
// Humedad es fracción (0.13 = 13 %).

import { apiFetch } from './client'

export type ModoMaquila = 'proporcional' | 'guardada'

export interface ReporteViajeCab { id: number; numero_viaje: string; fecha: string; estado: string }

export interface InfLote {
  codigo_lote: string
  numero_analisis: string | null
  laboratorio: string | null
  ton_humedas: number
  humedad: number
  ton_secas: number
  au_gr_t: number
  ag_gr_t: number
  gramos_au: number
  gramos_ag: number
}

export interface PlantaVsSgs {
  planta: { laboratorios: string[]; peso_humedo: number; peso_seco: number; au: number; ag: number }
  sgs: { peso_seco: number; au: number; ag: number } | null
  diferencia: { peso_seco: number; au: number; ag: number } | null
}

export interface Conciliacion {
  gramos_au_comprados: number
  gramos_au_vendidos: number
  merma_au: number
  pct_merma_au: number
  pct_recuperacion_au: number
  saldo_lotes: { ton_secas: number; gramos_au: number }
}

export interface Inf {
  lotes: InfLote[]
  promedio_ponderado: { au_gr_t: number; ag_gr_t: number }
  totales: { ton_humedas: number; ton_secas: number; gramos_au: number; gramos_ag: number }
  planta_vs_sgs?: PlantaVsSgs
  conciliacion: Conciliacion
}

export interface CosteoFila {
  codigo_lote: string
  material_primario_t: number
  concentrado_t: number
  valor_con_gastos: number
  excedente: number
  au_promedio_compra: number | null
  tenor_au_venta: number
  gramos_au_venta: number
  maquila: number
  total: number
}

export interface Costeo {
  modo_maquila: ModoMaquila
  filas: CosteoFila[]
  totales: {
    material_primario_t: number; concentrado_t: number; valor_con_gastos: number; excedente: number
    maquila: number; total_viaje: number; gramos_au_venta: number; gramos_ag_venta: number
  }
}

export interface VolquetaDet {
  numero_volqueta: number
  fecha: string
  minero: string
  mina: string | null
  peso: number
  humedad: number
  ton_humedad: number
  ton_seca: number
  tenor: number
  gramos: number
  precio_por_gramo: number
  precio_total: number
  excedente: number
  flete: number
  cargue: number
  pesada: number
  total_material: number
  fraccion_en_lote: number
}

export interface RepartoLinea {
  id_linea: number
  viaje: string
  id_viaje: number
  fecha: string
  es_remanente: boolean
  vendido_t: number
  costo: number
  maquila: number
  total: number
  gramos_au: number
  gramos_ag: number
  gramos_comprados: number
  merma_au: number
  pct_merma_au: number
}

export interface Detallado {
  lote: { id: number; codigo: string; estado: string; humedad: number; ton_secas: number; ton_humedas: number }
  analisis: { numero_analisis: string | null; laboratorio: string | null; au_gr_t: number; ag_gr_t: number } | null
  otros_analisis: unknown[]
  volquetas: VolquetaDet[]
  totales_volquetas: {
    peso: number; ton_seca: number; gramos: number; precio_total: number; excedente: number
    flete: number; cargue: number; pesada: number; total_material: number
  }
  parametros_reparto: {
    denominador_concentrado_t: number; vendido_t: number; queda_t: number
    material_primario_seco_t: number; material_primario_por_t_concentrado: number
    costo_material_lote: number; costo_por_t_concentrado: number
    maquila_lote: number; maquila_por_t_concentrado: number
  }
  reparto: RepartoLinea[]
  saldo: { ton_secas: number; gramos_au: number; gramos_ag: number }
  merma: {
    gramos_au_comprados: number; gramos_au_vendidos: number; gramos_au_quedan: number
    merma_au: number; pct_merma_au: number; merma_au_manual_registrada: number; merma_ag_manual_registrada: number
  }
}

export interface ReporteViaje {
  viaje: ReporteViajeCab
  inf: Inf
  costeo: Costeo
  remanentes: unknown[]
  advertencias: string[]
  detallados?: Detallado[]
}

export interface ReporteViajes {
  filtros: { ids: number[] | null; desde: string | null; hasta: string | null; maquila: ModoMaquila }
  total_viajes: number
  consolidado: {
    inf: Pick<Inf, 'totales' | 'promedio_ponderado' | 'conciliacion'>
    costeo: {
      modo_maquila: ModoMaquila; material_primario_t: number; concentrado_t: number; valor_con_gastos: number
      excedente: number; maquila: number; total: number; gramos_au_venta: number; gramos_ag_venta: number
    }
  }
  viajes: Omit<ReporteViaje, 'detallados'>[]
  detallados?: Detallado[]
}

export interface FiltroReporte { ids?: number[]; desde?: string; hasta?: string; maquila?: ModoMaquila; detallado?: boolean }

function qs(p: Record<string, string | undefined>) {
  const e = Object.entries(p).filter(([, v]) => v)
  return e.length ? '?' + e.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&') : ''
}

export const reporteViajeApi = {
  viaje: (id: number, maquila?: ModoMaquila) => apiFetch<ReporteViaje>(`/material/reportes/viaje/${id}${qs({ maquila })}`),
  viajes: (f: FiltroReporte) =>
    apiFetch<ReporteViajes>(`/material/reportes/viajes${qs({
      ids: f.ids?.length ? f.ids.join(',') : undefined, desde: f.desde, hasta: f.hasta,
      maquila: f.maquila, detallado: f.detallado ? '1' : undefined,
    })}`),
  lote: (id: number) => apiFetch<Detallado>(`/material/reportes/lote/${id}`),
}
