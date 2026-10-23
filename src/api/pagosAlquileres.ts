// ════════════════════════════════════════════════════════════════════════════
// Cliente API — Alquileres (gastos fijos de arriendo: vehículos, maquinaria,
// herramientas...). Prefijo: /api/v1/pagos/alquileres
//
// Cada fila de Alquileres es un cobro puntual (ej. "Alquiler camioneta
// octubre"), no una suscripción recurrente — para el mes siguiente se crea
// otra fila (igual que Combustible/Material). La Cuenta_Por_Pagar nace sola
// (lazy) al pedir el estado o abonar por primera vez: 1 alquiler = 1 cuenta,
// sin agrupar varios meses como sí hace Flete/Agua.
//
// A diferencia de Préstamos financieros, aquí el backend SÍ tiene abonos con
// historial propio (PATCH/DELETE por abono) — no hace falta localStorage.
// ════════════════════════════════════════════════════════════════════════════

import { apiFetch, apiPost, apiPut, apiPatch, apiDelete } from './client'

type Dec = number | string | null

// ── Tipos de alquiler (catálogo — Vehículos, Maquinaria pesada, Herramientas…) ──
export interface TipoAlquiler {
  id: number
  nombre: string
}

// ── Alquiler (el contrato/cobro puntual) ────────────────────────────────────
export type EstadoAlquiler = 'pendiente' | 'parcial' | 'pagado' | 'anulado' | string

export interface Alquiler {
  id: number
  concepto: string
  id_tipo?: number | null
  tipo?: string | null
  id_proveedor?: number | null
  proveedor?: string | null
  fecha_inicio: string
  valor: Dec
  // ⚠️ No confirmado si el listado trae estado/saldo embebidos o si hay que
  // pedirlos por getEstadoPago(id) — si el listado los trae, úsalos directo;
  // si no, cada fila debe pedir su estado-pago al montar (como hoy no se
  // puede probar en vivo, la página pide estado-pago por fila, nunca asume).
  estado?: EstadoAlquiler
  saldo?: Dec
  // Mes generado por un contrato recurrente (puede venir null si el alquiler
  // se creó suelto, sin contrato). Shape de id_contrato/contrato sin confirmar.
  id_contrato?: number | null
  contrato?: string | null
}

export interface AlquilerPayload {
  concepto: string
  id_tipo?: number
  id_proveedor?: number
  fecha_inicio: string
  valor: number
}

export interface AlquileresFiltro {
  estado?: string
  id_tipo?: number
  id_proveedor?: number
  id_contrato?: number
  mes?: number
  anio?: number
  desde?: string
  hasta?: string
}

// ── Contratos de alquiler (gasto recurrente mes a mes por un plazo) ────────
// Prefijo: /pagos/alquileres/contratos. Al crear, el backend genera
// automáticamente un Alquiler (mes a mes) por cada mes del período —
// ancla el día de fecha_inicio y lo recorta al último día del mes si ese
// día no existe (ej. ancla 31 cayendo en febrero).
export interface ContratoAlquiler {
  id: number
  concepto: string
  id_tipo?: number | null
  tipo?: string | null
  id_proveedor?: number | null
  proveedor?: string | null
  fecha_inicio: string
  fecha_fin: string
  valor_mensual: Dec
  contrato_url?: string | null
  // ⚠️ No confirmado si el backend expone este campo o solo distingue
  // vigente/anulado por otro medio — ver nota en `anularContrato`.
  estado?: string
}

export interface ContratoPayload {
  concepto: string
  id_tipo?: number
  // A diferencia de un Alquiler suelto (donde es opcional), en Contratos el
  // backend lo exige — 400 "id_proveedor es obligatorio" si se omite
  // (confirmado en vivo, 2026-10-18).
  id_proveedor: number
  fecha_inicio: string
  fecha_fin: string
  valor_mensual: number
  contrato_url?: string
}

export interface ContratoDetalle extends ContratoAlquiler {
  meses: Alquiler[]
}

// ── Abonos (pago parcial o total de UN alquiler) ────────────────────────────
// Confirmado en vivo (GET estado-pago): el abono NO trae id_alquiler, solo
// id_cuenta_pagar (el id de la CxP, = EstadoPagoAlquiler.id_cuenta) — para
// saber a qué alquiler pertenece hay que guardarlo aparte desde el contexto.
export interface AbonoAlquiler {
  id: number
  id_cuenta_pagar: number
  fecha_abono: string
  valor: Dec
  metodo_pago?: string | null
  comprobante_url?: string | null
  observaciones?: string | null
}

export interface AbonoAlquilerPayload {
  valor: number
  // El backend lo exige siempre — 400 "Cada abono requiere el comprobante
  // (comprobante_url)" si se omite (confirmado en vivo, no es opcional).
  comprobante_url: string
  fecha?: string
  metodo_pago?: string
  observaciones?: string
}

export interface EstadoPagoAlquiler {
  id_alquiler: number
  id_cuenta: number
  estado: EstadoAlquiler
  valor_total: Dec
  valor_pagado: Dec
  saldo: Dec
  abonos: AbonoAlquiler[]
}

export interface AbonosAlquilerFiltro {
  id_alquiler?: number
  desde?: string
  hasta?: string
  metodo_pago?: string
  page?: number
  limit?: number
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pagosAlquileresApi = {
  // Tipos de alquiler
  getTipos: () => apiFetch<TipoAlquiler[]>('/pagos/alquileres/tipos'),
  getTipo: (id: number) => apiFetch<TipoAlquiler>(`/pagos/alquileres/tipos/${id}`),
  crearTipo: (nombre: string) => apiPost<TipoAlquiler>('/pagos/alquileres/tipos', { nombre }),
  actualizarTipo: (id: number, nombre: string) => apiPut<TipoAlquiler>(`/pagos/alquileres/tipos/${id}`, { nombre }),
  eliminarTipo: (id: number) => apiDelete<{ message?: string }>(`/pagos/alquileres/tipos/${id}`),

  // Alquileres
  // ⚠️ Confirmado en vivo (2026-10-18): GET con ?estado=anulado devuelve 200
  // pero siempre [] — el backend no está filtrando/devolviendo anulados por
  // este parámetro (o usa otro campo internamente). Repórtalo al backend
  // antes de asumir que el pestañeo "Anulado" del front funciona.
  listar: (filtro?: AlquileresFiltro) =>
    apiFetch<Alquiler[]>(`/pagos/alquileres${qs({
      estado: filtro?.estado, id_tipo: filtro?.id_tipo, id_proveedor: filtro?.id_proveedor,
      id_contrato: filtro?.id_contrato, mes: filtro?.mes, anio: filtro?.anio,
      desde: filtro?.desde, hasta: filtro?.hasta,
    })}`),
  crear: (body: AlquilerPayload) => apiPost<Alquiler>('/pagos/alquileres', body),
  getDetalle: (id: number) => apiFetch<Alquiler>(`/pagos/alquileres/${id}`),
  actualizar: (id: number, body: Partial<AlquilerPayload>) => apiPut<Alquiler>(`/pagos/alquileres/${id}`, body),
  // Anula (soft delete) — nunca borra físico, queda trazado para auditoría.
  anular: (id: number) => apiDelete<{ message?: string }>(`/pagos/alquileres/${id}`),

  // Pago (estado + abonos de UN alquiler — la cuenta por pagar nace sola al pedirlo)
  getEstadoPago: (id: number) => apiFetch<EstadoPagoAlquiler>(`/pagos/alquileres/${id}/estado-pago`),
  crearAbono: (id: number, body: AbonoAlquilerPayload) => apiPost<AbonoAlquiler>(`/pagos/alquileres/${id}/abonos`, body),
  listarAbonos: (filtro?: AbonosAlquilerFiltro) =>
    apiFetch<AbonoAlquiler[]>(`/pagos/alquileres/abonos${qs({
      id_alquiler: filtro?.id_alquiler, desde: filtro?.desde, hasta: filtro?.hasta,
      metodo_pago: filtro?.metodo_pago, page: filtro?.page, limit: filtro?.limit,
    })}`),
  corregirAbono: (idAbono: number, body: Partial<AbonoAlquilerPayload>) => apiPatch<AbonoAlquiler>(`/pagos/alquileres/abonos/${idAbono}`, body),
  eliminarAbono: (idAbono: number) => apiDelete<{ message?: string }>(`/pagos/alquileres/abonos/${idAbono}`),

  // Contratos (gasto recurrente — genera los meses automáticamente)
  // ⚠️ GET lista "contratos vigentes" según la doc — no confirmado si
  // también devuelve los anulados/vencidos para el historial, o si hace
  // falta un filtro aparte (mismo riesgo que ?estado=anulado en Alquileres).
  getContratos: () => apiFetch<ContratoAlquiler[]>('/pagos/alquileres/contratos'),
  getContrato: (id: number) => apiFetch<ContratoDetalle>(`/pagos/alquileres/contratos/${id}`),
  crearContrato: (body: ContratoPayload) => apiPost<ContratoAlquiler>('/pagos/alquileres/contratos', body),
  actualizarContrato: (id: number, body: Partial<ContratoPayload>) => apiPut<ContratoAlquiler>(`/pagos/alquileres/contratos/${id}`, body),
  // Anula el contrato — los meses ya generados quedan intactos (no se tocan).
  anularContrato: (id: number) => apiDelete<{ message?: string }>(`/pagos/alquileres/contratos/${id}`),
}
