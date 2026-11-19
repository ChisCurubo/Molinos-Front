// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Tesorería: Ingresos y Flujo de caja. Prefijo: /api/v1/pagos
//
// Shapes confirmados en vivo contra el código real del backend (2026-10-18,
// ver docs/plan_tesoreria_2026-10-18.md) — no son inferencia.
//
// "Ingreso real" / "Egreso real" NO se suman a mano en el front: ya vienen
// calculados en /pagos/vistas/flujo-caja (ingresos.total, gastos.total,
// saldo_mes). "Ingreso esperado" / "Egreso esperado" sí se arman sumando
// pagosCxcApi.getMensual()/pagosCxpApi.getMensual() — eso vive en esos
// otros clientes, no aquí.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPut, apiDelete, apiPostComprobante } from './client'

type Dec = number | string | null

// ── Categorías de ingreso (catálogo, solo lectura confirmada) ──────────────
export interface CategoriaIngreso {
  id: number
  nombre: string
  descripcion?: string | null
}

// ── Ingreso (registro plano — no es una cuenta con abonos, nace cobrado) ───
export interface Ingreso {
  id: number
  id_categoria: number
  categoria?: string | null // join con Categorias_Ingreso.nombre
  concepto: string
  valor: Dec
  fecha: string
  // no-null = es el espejo automático de un préstamo financiero — PUT/DELETE
  // dan 409 en el backend si esto no es null ("edítalo desde Préstamos").
  // Nunca se envía desde el front: el formulario no lo expone.
  id_prestamo_fin?: number | null
  comprobante_url?: string | null
  created_at?: string
  // Cuenta bancaria donde entró el cobro (si se asoció una) — nombre ya
  // resuelto por el backend.
  cuenta_bancaria?: string | null
}

export interface IngresoPayload {
  id_categoria: number
  valor: number
  concepto: string
  fecha?: string
}

export interface IngresosFiltro {
  id_categoria?: number
  id_cuenta_bancaria?: number
  desde?: string
  hasta?: string
}

// ── Flujo de caja — mes puntual ─────────────────────────────────────────────
export interface CategoriaGasto {
  categoria: string
  color?: string | null // puede venir null — fallback de paleta en el front
  total: Dec
}

export interface FlujoCajaResponse {
  periodo: { mes: number; anio: number }
  ingresos: {
    tesoreria: Dec   // ingresos manuales de /pagos/ingresos
    cobros_cxc: Dec  // cobros reales de Cuentas por Cobrar ese mes
    total: Dec       // = "Ingreso real"
  }
  gastos: {
    total: Dec       // = "Egreso real"
    por_categoria: CategoriaGasto[] // ordenado de mayor a menor
  }
  saldo_mes: Dec                 // = ingresos.total − gastos.total, YA calculado
  saldo_acumulado_historico: Dec // balance de TODA la vida, no confundir con saldo_mes
}

// ── Flujo de caja — corte anual (reemplaza el loop mes a mes) ──────────────
export interface MesFlujoCaja {
  mes: number
  ingresos: Dec
  gastos: Dec
  saldo_mes: Dec
}

export interface FlujoCajaAnualResponse {
  anio: number
  ingresos_total: Dec
  gastos_total: Dec
  saldo_anio: Dec
  meses: MesFlujoCaja[] // siempre los 12, con ceros si no hubo movimiento
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosIngresosApi = {
  getCategorias: () => apiFetch<CategoriaIngreso[]>('/pagos/categorias-ingreso'),

  listar: (filtro?: IngresosFiltro) =>
    apiFetch<Ingreso[]>(`/pagos/ingresos${qs({
      id_categoria: filtro?.id_categoria, id_cuenta_bancaria: filtro?.id_cuenta_bancaria,
      desde: filtro?.desde, hasta: filtro?.hasta,
    })}`),
  crear: (body: IngresoPayload, comprobante?: File | null) =>
    apiPostComprobante<Ingreso>('/pagos/ingresos', body, comprobante),
  actualizar: (id: number, body: Partial<IngresoPayload>) => apiPut<Ingreso>(`/pagos/ingresos/${id}`, body),
  // 409 si el ingreso es espejo de un préstamo (id_prestamo_fin no-null).
  eliminar: (id: number) => apiDelete<{ message?: string }>(`/pagos/ingresos/${id}`),

  getFlujoCaja: (mes?: number, anio?: number) =>
    apiFetch<FlujoCajaResponse>(`/pagos/vistas/flujo-caja${qs({ mes, anio })}`),
  getFlujoCajaAnual: (anio?: number) =>
    apiFetch<FlujoCajaAnualResponse>(`/pagos/vistas/flujo-caja/anual${qs({ anio })}`),
}
