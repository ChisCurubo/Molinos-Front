// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Cuentas por Cobrar (CxC)
// Prefijo: /api/v1/pagos/cxc
//
// ⚠️ Ningún módulo de negocio escribe todavía en Cuentas_Por_Cobrar (ver
// ENDPOINTS_PAGOS.md §2) — no hay flujo de venta/cobro implementado. El listado
// mensual siempre devuelve `cuentas: []` hoy; esta página deja listo el catálogo
// de categorías y el listado para cuando exista el primer módulo de cobro.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiDelete } from './client'

type Dec = number | string | null

export interface CxcCuenta {
  id: number
  id_categoria?: number | null
  categoria?: string | null
  concepto?: string | null
  cliente?: string | null
  valor_total: Dec
  valor_cobrado: Dec
  saldo: Dec
  estado: 'pendiente' | 'parcial' | 'pagado' | string
  fecha_creacion?: string
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

  getCategorias: () => apiFetch<CategoriaCxc[]>('/pagos/cxc/categorias'),
  createCategoria: (nombre: string) => apiPost<CategoriaCxc>('/pagos/cxc/categorias', { nombre }),
  updateCategoria: (id: number, nombre: string) => apiPut<CategoriaCxc>(`/pagos/cxc/categorias/${id}`, { nombre }),
  deleteCategoria: (id: number) => apiDelete<{ message?: string }>(`/pagos/cxc/categorias/${id}`),
}
