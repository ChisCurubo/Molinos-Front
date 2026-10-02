// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Cuentas por Pagar (CxP) genérico
// Prefijo: /api/v1/pagos/cxp
//
// ⚠️ Implementación vieja/simple (ver ENDPOINTS_PAGOS.md §1): no usa Abonos_CxP
// (un solo "pagoAdicional" sin comprobante/fecha/método individual), no genera
// saldo a favor, no crea Cuentas_Por_Pagar_Relacion. Material/Flete/Agua/Mulas/
// Anticipos ya tienen su propio módulo dedicado con abonos completos — este es
// solo el LISTADO MAESTRO (trae todas las CxP de cualquier módulo, resueltas
// por categoría y beneficiario) más un "pagar rápido" para casos sueltos sin
// módulo propio.
//
// ⚠️ Los decimales llegan como string desde MySQL ("120.0000"): usa num() de
// '@/api/material' en la UI.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiDelete } from './client'

type Dec = number | string | null

export interface CxpCuenta {
  id: number
  id_categoria?: number | null
  categoria?: string | null
  concepto?: string | null
  id_proveedor?: number | null
  id_minero?: number | null
  id_dueno_volqueta?: number | null
  beneficiario?: string | null
  valor_total: Dec
  valor_pagado: Dec
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
export interface CxpMensualResponse {
  cuentas: CxpCuenta[]
  pagination: Paginacion
}
export interface CxpMensualFiltro {
  mes?: number
  anio?: number
  id_categoria?: number
  estado?: string
  page?: number
  limit?: number
}

export interface CategoriaCxp {
  id: number
  nombre: string
}

export interface CrearCxpPayload {
  id_proveedor?: number
  id_minero?: number
  id_dueno_volqueta?: number
  concepto: string
  valor_total: number
  id_categoria?: number
  fecha_creacion?: string
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosCxpApi = {
  // Listado maestro, paginado — trae TODAS las CxP (cualquier módulo).
  getMensual: (filtro?: CxpMensualFiltro) =>
    apiFetch<CxpMensualResponse>(`/pagos/cxp/mensual${qs({
      mes: filtro?.mes, anio: filtro?.anio, id_categoria: filtro?.id_categoria,
      estado: filtro?.estado, page: filtro?.page, limit: filtro?.limit,
    })}`),

  // Crea una CxP suelta (sin módulo dedicado).
  crear: (body: CrearCxpPayload) => apiPost<CxpCuenta>('/pagos/cxp', body),

  // "Pago rápido": suma directo a valor_pagado, sin registro de abono individual.
  pagar: (id: number, pagoAdicional: number) =>
    apiPost<CxpCuenta>(`/pagos/cxp/${id}/pagar`, { pagoAdicional }),

  // Categorías (catálogo compartido por todos los módulos de pago).
  getCategorias: () => apiFetch<CategoriaCxp[]>('/pagos/cxp/categorias'),
  createCategoria: (nombre: string) => apiPost<CategoriaCxp>('/pagos/cxp/categorias', { nombre }),
  updateCategoria: (id: number, nombre: string) => apiPut<CategoriaCxp>(`/pagos/cxp/categorias/${id}`, { nombre }),
  deleteCategoria: (id: number) => apiDelete<{ message?: string }>(`/pagos/cxp/categorias/${id}`),
}
