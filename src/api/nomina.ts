import { apiFetch, apiPost, apiPut, apiPatch, apiDelete, http } from './client'

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ════════════════════════════════════════════════════════════════════════════
// EMPLEADOS
// ════════════════════════════════════════════════════════════════════════════
export interface Empleado {
  id: number
  nombre: string
  apellido: string | null
  cc: string
  cuenta: string | null
  nequi: boolean | number | null
  labor: string | null
  created_at: string
}
export interface EmpleadoPayload {
  nombre: string
  apellido?: string
  cc: string
  cuenta?: string
  nequi?: boolean
  labor?: string
}
export type EmpleadoUpdatePayload = Partial<EmpleadoPayload>

// ════════════════════════════════════════════════════════════════════════════
// SALARIO (vigencias versionadas — nueva vigencia cierra la anterior)
// ════════════════════════════════════════════════════════════════════════════
export type TipoPago = 'FIJO_MENSUAL' | 'POR_DIAS' | 'POR_HORAS'

export interface SalarioEmpleado {
  id: number
  empleado_id: number
  tipo_pago: TipoPago
  tarifa_monto: string | number
  aplica_aux_transp: boolean | number
  fecha_inicio: string
  activo: boolean | number
  created_at: string
}
export interface SalarioCreatePayload {
  tipo_pago: TipoPago
  tarifa_monto: number
  aplica_aux_transp?: boolean
  fecha_inicio?: string
}
export interface SalarioUpdatePayload {
  tipo_pago?: TipoPago
  tarifa_monto?: number
  aplica_aux_transp?: boolean
  fecha_inicio?: string
  activo?: boolean
}

// ════════════════════════════════════════════════════════════════════════════
// PRÉSTAMOS DE EMPLEADO (adelantos al personal — no confundir con Préstamos
// Financieros de /pagos, que es deuda bancaria de la empresa)
// ════════════════════════════════════════════════════════════════════════════
export interface PrestamoEmpleado {
  id: number
  id_empleado: number
  empleado?: string | null
  fecha: string
  concepto: string | null
  valor: string | number
  cuotas: number
  created_at: string
}
export interface PrestamoCreatePayload {
  id_empleado: number
  valor: number
  concepto?: string
  fecha?: string
}
export interface PrestamoUpdatePayload {
  valor?: number
  concepto?: string
  cuotas?: number
  fecha?: string
  id_empleado?: number
}

// Vista de saldo — hoy nada escribe en Cuentas_Por_Pagar_Relacion al crear un
// préstamo, así que en la práctica el saldo llega en 0 hasta que se integre.
export interface SaldoPrestamoEmpleado {
  id_empleado: number
  empleado?: string | null
  saldo?: string | number
  [key: string]: unknown
}

// ════════════════════════════════════════════════════════════════════════════
// NÓMINA QUINCENAL (liquidaciones) — POST confirma: genera CxP de nómina y
// descuenta la cuota de préstamo activo del empleado, si tiene uno.
// ════════════════════════════════════════════════════════════════════════════
// Shape verificado en vivo contra el backend real (curl directo, 2026-10-12):
// NO trae "salario_base"/"bonificaciones"/"descuento_prestamo"/"neto" — esos
// nombres eran una suposición que nunca coincidió con la respuesta real, por
// eso la tabla de previsualización mostraba todo en $0 pese a que el backend
// sí calculaba bien. `unidades` es horas/días trabajados (null en FIJO_MENSUAL).
//
// aporte_salud/aporte_pension/total_aportes_seguridad_social agregados por el
// backend el 2026-10-12 (4%+4% sobre monto_bruto+total_bonos_periodo, ya
// restado de monto_neto) — verificado en vivo: Eder (bruto 72.000) →
// aporte_salud 2.880, aporte_pension 2.880, neto 66.240; Juan David (bruto+
// bono 2.000.000) → aportes 160.000, neto 1.840.000. La migración que agrega
// estas columnas a Nomina_Liquidaciones AÚN NO se corrió contra la BD real —
// el preview (GET, no persiste) ya funciona, pero confirmar (POST, si
// persiste) puede fallar hasta que se aplique.
// Un renglón por cada turno de la quincena — ya trae todo sumado (propio +
// nocturno + festivo), el front solo muestra el número. Verificado en vivo
// (curl, 2026-10-13) contra /preview y /preview-grupal reales.
export interface DetalleTurnoLiquidacion {
  fecha: string
  id_tipo_turno?: number
  nombre_turno: string
  horas_trabajadas?: string | number
  es_domingo?: boolean
  es_festivo?: boolean
  horas_diurnas: string | number
  horas_nocturnas: string | number
  recargo_pct_diurno: string | number
  recargo_pct_nocturno: string | number
  monto: string | number
}
export interface LiquidacionPreview {
  id_empleado: number
  empleado?: string | null
  anio: number
  mes: number
  quincena: 1 | 2
  tipo_pago?: TipoPago
  unidades?: number | string | null
  tarifa_aplicada?: string | number
  monto_bruto?: string | number
  total_bonos_periodo?: string | number
  total_descuento_prestamo?: string | number
  prestamos_a_descontar?: unknown[]
  // Informativo: ya viene incluido dentro de monto_bruto, NO se resta aparte.
  total_recargo_dominical_festivo?: string | number
  // Desglose turno por turno — vacío para FIJO_MENSUAL (no usa Turnos).
  detalle_turnos?: DetalleTurnoLiquidacion[]
  aporte_salud?: string | number
  aporte_pension?: string | number
  total_aportes_seguridad_social?: string | number
  otros_descuentos?: string | number
  monto_neto?: string | number
  ya_liquidada?: boolean
  [key: string]: unknown
}
// Shape de la liquidación ya confirmada no verificado contra una real (no hay
// ninguna confirmada todavía en el ambiente de prueba) — se lee con fallback
// a los nombres del preview (`monto_neto`) por si el backend es consistente,
// sin descartar el nombre viejo `neto` por si no lo es. aporte_salud/
// aporte_pension/total_aportes_seguridad_social quedan persistidos según el
// backend, pero sin confirmar aún contra un registro real.
export interface Liquidacion {
  id: number
  id_empleado: number
  empleado?: string | null
  anio: number
  mes: number
  quincena: 1 | 2
  neto?: string | number
  monto_neto?: string | number
  total_recargo_dominical_festivo?: string | number
  aporte_salud?: string | number
  aporte_pension?: string | number
  total_aportes_seguridad_social?: string | number
  fecha?: string
  [key: string]: unknown
}
export interface LiquidacionPreviewParams {
  id_empleado?: number
  anio: number
  mes: number
  quincena: 1 | 2
}
export interface PreviewLiquidacionError { id_empleado: number; message: string }
export interface PreviewGrupalResult { previews: LiquidacionPreview[]; errores: PreviewLiquidacionError[] }
export interface LiquidacionConfirmarPayload {
  id_empleado: number
  anio: number
  mes: number
  quincena: 1 | 2
  otros_descuentos?: number
  bonificaciones?: number
}
export interface LiquidacionesFiltro {
  id_empleado?: number
  anio?: number
  mes?: number
}

// ════════════════════════════════════════════════════════════════════════════
// BONOS — genera CxP al registrarse
// ════════════════════════════════════════════════════════════════════════════
export interface Bono {
  id: number
  id_empleado: number
  empleado?: string | null
  fecha: string
  concepto: string | null
  valor: string | number
  created_at?: string
}
export interface BonoPayload {
  id_empleado: number
  fecha?: string
  concepto?: string
  valor: number
}
export interface BonosFiltro {
  id_empleado?: number
  desde?: string
  hasta?: string
}

// ════════════════════════════════════════════════════════════════════════════
// FICHA 360 / PRESTACIONES — shape exacto no documentado por el backend; se
// tipa como registro abierto y se renderiza defensivamente en la UI.
// ════════════════════════════════════════════════════════════════════════════
export type FichaEmpleado = Record<string, unknown>
export type PrestacionesEmpleado = Record<string, unknown>

// ════════════════════════════════════════════════════════════════════════════
// PLANTAS — catálogo de sedes/plantas
// ════════════════════════════════════════════════════════════════════════════
export interface Planta {
  id: number
  nombre: string
  ubicacion?: string | null
}
export interface PlantaPayload {
  nombre: string
  ubicacion?: string
}

// ════════════════════════════════════════════════════════════════════════════
// TURNOS — grilla de calendario. El tipo de turno es un catálogo dinámico
// (Tipos_Turno: id, nombre, hora_inicio, hora_fin, recargo_porcentaje), no un
// enum fijo. /upsert es la vía recomendada para la grilla (nunca duplica: si
// ya existe un turno para ese empleado/día, actualiza; si no, inserta).
// ════════════════════════════════════════════════════════════════════════════
export interface Turno {
  id: number
  id_empleado: number
  empleado?: string | null
  fecha: string
  id_tipo_turno: number | null
  id_planta_proceso?: number | null
  planta?: string | null
  horas_trabajadas: string | number
  presente: boolean | number
  es_festivo?: boolean | number
  comentarios?: string | null
  quincena?: number
  created_at?: string
  [key: string]: unknown
}
export interface TurnoUpsertPayload {
  id_empleado: number
  fecha: string
  id_tipo_turno?: number
  horas_trabajadas?: number
  presente?: boolean
  id_planta_proceso?: number
  es_festivo?: boolean
  comentarios?: string
}
export type TurnoUpdatePayload = Partial<TurnoUpsertPayload>
export interface TurnosFiltro {
  id_empleado?: number
  quincena?: number
  mes?: number
  anio?: number
}

export interface TipoTurno {
  id: number
  nombre: string
  hora_inicio: string
  hora_fin: string
  recargo_porcentaje: string | number
}
export interface TipoTurnoPayload {
  nombre: string
  hora_inicio: string
  hora_fin: string
  recargo_porcentaje: number
}

// ════════════════════════════════════════════════════════════════════════════
// JORNADA NOCTURNA LEGAL — histórico del corte legal (Ley 2101 de 2021, se ha
// movido 3 veces desde 2021). Solo se crea (nunca se edita/borra una fila
// vieja): si el corte cambia, se agrega una fila nueva con vigente_desde.
// ════════════════════════════════════════════════════════════════════════════
export interface JornadaNocturnaLegal {
  id: number
  hora_inicio_nocturno: string
  vigente_desde: string
  created_at?: string
}
export interface JornadaNocturnaLegalPayload {
  hora_inicio_nocturno: string
  vigente_desde: string
}

export const nominaApi = {
  // ── Empleados ────────────────────────────────────────────────────────────
  getEmpleados: () => apiFetch<Empleado[]>('/nomina/empleados'),
  getEmpleado: (id: number) => apiFetch<Empleado>(`/nomina/empleados/${id}`),
  createEmpleado: (body: EmpleadoPayload) => apiPost<Empleado>('/nomina/empleados', body),
  updateEmpleado: (id: number, body: EmpleadoUpdatePayload) => apiPut<Empleado>(`/nomina/empleados/${id}`, body),
  deleteEmpleado: (id: number) => apiDelete<{ message?: string }>(`/nomina/empleados/${id}`),

  // ── Salario (vigencias) ────────────────────────────────────────────────────
  getSalarioActual: (idEmpleado: number) => apiFetch<SalarioEmpleado>(`/nomina/empleados/${idEmpleado}/salario`),
  getSalarioHistorial: (idEmpleado: number) => apiFetch<SalarioEmpleado[]>(`/nomina/empleados/${idEmpleado}/salario/historial`),
  crearVigenciaSalario: (idEmpleado: number, body: SalarioCreatePayload) =>
    apiPost<SalarioEmpleado>(`/nomina/empleados/${idEmpleado}/salario`, body),
  corregirVigenciaSalario: (idSalario: number, body: SalarioUpdatePayload) =>
    apiPatch<SalarioEmpleado>(`/nomina/empleados/salario/${idSalario}`, body),
  deleteVigenciaSalario: (idSalario: number) => apiDelete<{ message?: string }>(`/nomina/empleados/salario/${idSalario}`),

  // ── Préstamos de empleado ──────────────────────────────────────────────────
  getPrestamos: (idEmpleado?: number) =>
    apiFetch<PrestamoEmpleado[]>(`/nomina/empleados/prestamos${qs({ id_empleado: idEmpleado })}`),
  getPrestamo: (id: number) => apiFetch<PrestamoEmpleado>(`/nomina/empleados/prestamos/detalle/${id}`),
  createPrestamo: (body: PrestamoCreatePayload) => apiPost<PrestamoEmpleado>('/nomina/empleados/prestamos', body),
  updatePrestamo: (id: number, body: PrestamoUpdatePayload) => apiPatch<PrestamoEmpleado>(`/nomina/empleados/prestamos/${id}`, body),
  deletePrestamo: (id: number) => apiDelete<{ message?: string }>(`/nomina/empleados/prestamos/${id}`),

  // ── Saldo de préstamos (vista, solo lectura) ────────────────────────────────
  getSaldoPrestamos: () => apiFetch<SaldoPrestamoEmpleado[]>('/nomina/vistas/saldo-prestamos-empleado'),
  getSaldoPrestamoEmpleado: (idEmpleado: number) =>
    apiFetch<SaldoPrestamoEmpleado>(`/nomina/vistas/saldo-prestamos-empleado/${idEmpleado}`),

  // ── Nómina quincenal (liquidaciones) ────────────────────────────────────────
  previewLiquidacion: (p: LiquidacionPreviewParams) =>
    apiFetch<LiquidacionPreview | LiquidacionPreview[]>(`/nomina/empleados/liquidaciones/preview${qs({ id_empleado: p.id_empleado, anio: p.anio, mes: p.mes, quincena: p.quincena })}`),
  // Trae la previsualización de TODOS los empleados en un solo request
  // (previewLiquidacion sin id_empleado exige el parámetro y devuelve 400).
  previewLiquidacionGrupal: (p: { anio: number; mes: number; quincena: 1 | 2 }) =>
    apiFetch<PreviewGrupalResult>(`/nomina/empleados/liquidaciones/preview-grupal${qs({ anio: p.anio, mes: p.mes, quincena: p.quincena })}`),
  confirmarLiquidacion: (body: LiquidacionConfirmarPayload) => apiPost<Liquidacion>('/nomina/empleados/liquidaciones', body),
  getLiquidaciones: (f?: LiquidacionesFiltro) =>
    apiFetch<Liquidacion[]>(`/nomina/empleados/liquidaciones${qs({ id_empleado: f?.id_empleado, anio: f?.anio, mes: f?.mes })}`),
  getLiquidacion: (id: number) => apiFetch<Liquidacion>(`/nomina/empleados/liquidaciones/${id}`),

  // ── Bonos ────────────────────────────────────────────────────────────────
  createBono: (body: BonoPayload) => apiPost<Bono>('/nomina/empleados/bonos', body),
  getBonos: (f?: BonosFiltro) =>
    apiFetch<Bono[]>(`/nomina/empleados/bonos${qs({ id_empleado: f?.id_empleado, desde: f?.desde, hasta: f?.hasta })}`),
  getBono: (id: number) => apiFetch<Bono>(`/nomina/empleados/bonos/${id}`),
  deleteBono: (id: number) => apiDelete<{ message?: string }>(`/nomina/empleados/bonos/${id}`),

  // ── Ficha 360 / Prestaciones ─────────────────────────────────────────────
  getFicha: (idEmpleado: number, anio?: number) => apiFetch<FichaEmpleado>(`/nomina/empleados/${idEmpleado}/ficha${qs({ anio })}`),
  getPrestaciones: (idEmpleado: number, anio?: number) => apiFetch<PrestacionesEmpleado>(`/nomina/empleados/${idEmpleado}/prestaciones${qs({ anio })}`),

  // ── Plantas ──────────────────────────────────────────────────────────────
  getPlantas: () => apiFetch<Planta[]>('/nomina/plantas'),
  createPlanta: (body: PlantaPayload) => apiPost<Planta>('/nomina/plantas', body),
  updatePlanta: (id: number, body: Partial<PlantaPayload>) => apiPut<Planta>(`/nomina/plantas/${id}`, body),
  deletePlanta: (id: number) => apiDelete<{ message?: string }>(`/nomina/plantas/${id}`),

  // ── Turnos (grilla de calendario) ───────────────────────────────────────────
  getTurnos: (f?: TurnosFiltro) =>
    apiFetch<Turno[]>(`/nomina/turnos${qs({ id_empleado: f?.id_empleado, quincena: f?.quincena, mes: f?.mes, anio: f?.anio })}`),
  // Upsert por (id_empleado, fecha) — nunca duplica. Es lo que usa la grilla.
  upsertTurno: (body: TurnoUpsertPayload) => apiPut<Turno>('/nomina/turnos/upsert', body),
  // Borra el turno de un empleado/día si existe (idempotente, no es error si no existe).
  deleteTurnoDia: async (idEmpleado: number, fecha: string): Promise<boolean> => {
    const res = await http.delete<{ success: boolean; eliminado?: boolean; message?: string }>(
      `/nomina/turnos/dia${qs({ id_empleado: idEmpleado, fecha })}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Error del servidor')
    return !!res.data.eliminado
  },
  getTurno: (id: number) => apiFetch<Turno>(`/nomina/turnos/${id}`),
  updateTurno: (id: number, body: TurnoUpdatePayload) => apiPut<Turno>(`/nomina/turnos/${id}`, body),
  deleteTurno: (id: number) => apiDelete<{ message?: string }>(`/nomina/turnos/${id}`),

  // ── Tipos de turno (catálogo) ───────────────────────────────────────────────
  getTiposTurno: () => apiFetch<TipoTurno[]>('/nomina/turnos/tipos'),
  createTipoTurno: (body: TipoTurnoPayload) => apiPost<TipoTurno>('/nomina/turnos/tipos', body),
  updateTipoTurno: (id: number, body: Partial<TipoTurnoPayload>) => apiPut<TipoTurno>(`/nomina/turnos/tipos/${id}`, body),
  deleteTipoTurno: (id: number) => apiDelete<{ message?: string }>(`/nomina/turnos/tipos/${id}`),

  // ── Jornada nocturna legal (histórico del corte, uso raro) ─────────────────
  getJornadaNocturnaLegal: () => apiFetch<JornadaNocturnaLegal[]>('/nomina/jornada-nocturna-legal'),
  createJornadaNocturnaLegal: (body: JornadaNocturnaLegalPayload) =>
    apiPost<JornadaNocturnaLegal>('/nomina/jornada-nocturna-legal', body),
}
