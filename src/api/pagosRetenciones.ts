// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Retenciones (ReteFuente / ReteIVA). Prefijo: /api/v1/pagos/retenciones
//
// ✅ Shape CONFIRMADO en vivo (2026-10-31): catálogo, aplicadas y PATCH de
// ajuste probados contra el backend real (despacho de Mulas de prueba,
// retefuente 1% auto-calculado, ajuste manual con 409 al pasarse del total).
// Las tarifas (`tarifa_declarante`, `tarifa_no_declarante`, `tarifa_aplicada`)
// llegan como porcentaje entero (ej. "1" = 1%, NO 0.01) — no multiplicar ×100.
// Hoy solo aplica a Mulas (ReteFuente transporte, 1%) y Alquiler (ReteFuente
// arrendamiento 4% + ReteIVA 15%) — el backend calcula solo al crear la
// cuenta por pagar, salvo override manual. ⚠️ Al eliminar un despacho/cuenta,
// el backend NO borra su retención aplicada — queda huérfana en el histórico.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPatch } from './client'

type Dec = number | string | null

export interface RetencionCatalogo {
  id: number
  nombre: string
  tarifa_declarante: Dec
  tarifa_no_declarante?: Dec
  activo?: boolean | number
}

export type TipoRetencion = 'fuente' | 'iva'

export interface RetencionAplicada {
  id: number
  id_concepto_retencion: number
  id_cuenta_pagar: number
  valor_base: Dec
  tarifa_aplicada: Dec
  valor_retenido: Dec
  tipo: TipoRetencion | string
  fecha: string
  ajustado_manualmente?: boolean | number
  valor_calculado_original?: Dec
  // Resueltos por el backend — nombre del concepto de retención y concepto de
  // la cuenta por pagar de origen (ej. "Pago viaje 13-1"). NO trae proveedor.
  concepto?: string
  cuenta_concepto?: string
}

export interface RetencionesAplicadasFiltro {
  id_cuenta_pagar?: number
  tipo?: TipoRetencion
  desde?: string
  hasta?: string
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosRetencionesApi = {
  getCatalogo: () => apiFetch<RetencionCatalogo[]>('/pagos/retenciones'),
  getAplicadas: (filtro?: RetencionesAplicadasFiltro) =>
    apiFetch<RetencionAplicada[]>(`/pagos/retenciones/aplicadas${qs({
      id_cuenta_pagar: filtro?.id_cuenta_pagar, tipo: filtro?.tipo, desde: filtro?.desde, hasta: filtro?.hasta,
    })}`),
  // 409 si el ajuste deja el total pagado por encima de valor_total de la cuenta.
  ajustar: (id: number, valor_retenido: number) =>
    apiPatch<RetencionAplicada>(`/pagos/retenciones/aplicadas/${id}`, { valor_retenido }),
}
