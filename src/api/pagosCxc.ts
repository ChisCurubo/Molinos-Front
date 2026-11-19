// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Cuentas por Cobrar (CxC)
// Prefijo: /api/v1/pagos/cxc
//
// (2026-10-22) El backend agregó crear/editar/abonar/anular cuentas sueltas
// (antes solo existía el listado mensual + categorías). Shape CONFIRMADO en
// vivo contra el backend (no es inferencia):
// - No existe "cliente" en este esquema. El deudor es UNO de id_empleado /
//   id_minero / id_dueno_volqueta / id_proveedor (los 4 opcionales, se manda
//   solo el que aplique).
// - POST /pagos/cxc soporta un "abono" anidado opcional para cobro inmediato
//   al crear (no se usa desde el front todavía — ver GastoDirecto/CxP, el
//   front aquí crea pendiente y abona después, más simple de validar en UI).
// - El campo del abono es "metodo" (no "metodo_pago" como en los demás
//   módulos de abono de este proyecto) y "fecha_cobro" (no "fecha").
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete, apiPostComprobante } from './client'

type Dec = number | string | null

// Exactamente uno de estos 4 identifica al deudor — todos opcionales.
export interface DeudorCxc {
  id_empleado?: number
  id_minero?: number
  id_dueno_volqueta?: number
  id_proveedor?: number
}

export interface CxcCuenta extends DeudorCxc {
  id: number
  id_categoria?: number | null
  categoria?: string | null
  concepto?: string | null
  // Confirmado en vivo (2026-10-23): el campo real se llama `deudor`, NO
  // `beneficiario` como en CxP — se había asumido por simetría y estaba mal.
  deudor?: string | null
  valor_total: Dec
  valor_cobrado: Dec
  saldo: Dec
  estado: 'pendiente' | 'parcial' | 'pagado' | string
  fecha_creacion?: string
  fecha_limite?: string | null
}

export interface Paginacion {
  page: number
  limit: number
  total: number
  total_pages: number
}
export interface CxcMensualResponse {
  cuentas: CxcCuenta[]
  pagination: Paginacion
}
export interface CxcMensualFiltro {
  mes?: number
  anio?: number
  id_categoria?: number
  estado?: string
  page?: number
  limit?: number
}

export interface CategoriaCxc {
  id: number
  nombre: string
}

export interface AbonoInicialCxc {
  valor: number
  metodo: string
  comprobante_url: string
}
export interface CrearCxcPayload extends DeudorCxc {
  concepto: string
  valor_total: number
  // Confirmado en vivo (2026-10-23): el backend responde 400 "id_categoria es
  // obligatorio" si se omite — NO es opcional como se asumió al escribir esto.
  id_categoria: number
  fecha_creacion?: string
  fecha_limite?: string
  abono?: AbonoInicialCxc // cobro inmediato al crear — no usado desde el front todavía
}
export type EditarCxcPayload = Partial<Omit<CrearCxcPayload, 'abono'>>

export interface AbonoCxc {
  id: number
  id_cuenta: number
  fecha_cobro: string
  valor: Dec
  metodo?: string | null
  comprobante_url?: string | null
}
export interface AbonoCxcPayload {
  valor: number
  metodo: string
  fecha_cobro?: string
}

export interface CxcDetalle extends CxcCuenta {
  abonos: AbonoCxc[]
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosCxcApi = {
  getMensual: (filtro?: CxcMensualFiltro) =>
    apiFetch<CxcMensualResponse>(`/pagos/cxc/mensual${qs({
      mes: filtro?.mes, anio: filtro?.anio, id_categoria: filtro?.id_categoria,
      estado: filtro?.estado, page: filtro?.page, limit: filtro?.limit,
    })}`),

  crear: (body: CrearCxcPayload) => apiPost<CxcCuenta>('/pagos/cxc', body),
  obtener: (id: number) => apiFetch<CxcDetalle>(`/pagos/cxc/${id}`),
  abonar: (id: number, body: AbonoCxcPayload, comprobante?: File | null) =>
    apiPostComprobante<AbonoCxc>(`/pagos/cxc/${id}/abonos`, body, comprobante),
  actualizar: (id: number, body: EditarCxcPayload) => apiPatch<CxcCuenta>(`/pagos/cxc/${id}`, body),
  anular: (id: number) => apiDelete<{ message?: string }>(`/pagos/cxc/${id}`),

  getCategorias: () => apiFetch<CategoriaCxc[]>('/pagos/cxc/categorias'),
  createCategoria: (nombre: string) => apiPost<CategoriaCxc>('/pagos/cxc/categorias', { nombre }),
  updateCategoria: (id: number, nombre: string) => apiPut<CategoriaCxc>(`/pagos/cxc/categorias/${id}`, { nombre }),
  deleteCategoria: (id: number) => apiDelete<{ message?: string }>(`/pagos/cxc/categorias/${id}`),
}
