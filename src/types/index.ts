// ============================================================
// Tipos del dominio — Molinos de Colombia S.A.S
// ============================================================

export type Role = 'administrador' | 'materiales' | 'financiero'

export interface User {
  id: string
  nombre: string
  email: string
  role: Role
  activo: boolean
  ultimoAcceso?: string
}

export type EstadoGeneral = 'aprobado' | 'pendiente' | 'rechazado' | 'revision' | 'pagado'

// --- Materiales ---
export interface Volqueta {
  id: string
  placa: string
  dueno: string
  id_dueno?: number
  conductor: string
  capacidadTon: number
  activo: boolean
}

export interface Zona {
  id: string
  nombre: string
  tarifaTon: number // flete por tonelada
}

export interface Mina {
  id: string
  nombre: string
  zonaId: string
  responsable: string
}

export interface Minero {
  id: string
  nombre: string
  documento: string
  minaId: string
  telefono: string
}

export interface EntradaMaterial {
  id: string
  fecha: string
  volquetaId: string
  minaId: string
  mineroId: string
  pesoBrutoTon: number
  estado: EstadoGeneral
  // Laboratorio (opcional hasta que se analice)
  humedadPct?: number
  tenor?: number // g/ton
  au?: number // g
  ag?: number // g
  toneladasSecas?: number
  liquidacion?: number // pago al material
  flete?: number
}

export interface ViajeAgua {
  id: string
  fecha: string
  vehiculo: string
  placa: string
  volumenM3: number
  destino: string
  costo: number
  estado: EstadoGeneral
}

// --- Finanzas ---
export type TipoMovimiento = 'flete' | 'material' | 'proveedor' | 'gasto' | 'alquiler' | 'gasolina'

export interface AbonoRegistro {
  id: string
  fecha: string
  monto: number
  comprobante?: string
  nota?: string
}

export interface CuentaPorPagar {
  id: string
  concepto: string
  tipo: TipoMovimiento
  beneficiario: string
  monto: number
  saldo?: number
  abonosHistorial?: AbonoRegistro[]
  fechaVencimiento: string
  estado: EstadoGeneral
  origen: 'automatico' | 'manual'
  comprobante?: string | null
}

export interface CuentaPorCobrar {
  id: string
  concepto: string
  cliente: string
  monto: number
  saldo?: number
  abonosHistorial?: AbonoRegistro[]
  fechaVencimiento: string
  estado: EstadoGeneral
  comprobante?: string | null
}

export interface PagoAbono {
  id: string
  fecha: string
  monto: number
  comprobante?: string
  nota?: string
}

export interface Prestamo {
  id: string
  entidad: string
  tipo: 'bancario' | 'rotativo'
  capital: number
  interesPct: number
  plazoMeses: number
  saldo: number
  cuotaMensual: number
  estado: EstadoGeneral
  pagosAbono?: PagoAbono[]
  descripcion?: string
  valorMaterial?: number
  porcentajeAdelanto?: number
}

// --- Nómina ---
export interface Planta {
  id: string
  nombre: string
  ubicacion: string
}

export interface Empleado {
  id: string
  nombre: string
  documento: string
  cargo: string
  plantaId: string
  salarioBase: number
  tipoContrato?: 'hora' | 'fijo'
  activo: boolean
}

export type TipoTurno = 'diurno' | 'tarde' | 'nocturno'
export interface Turno {
  id: string
  empleadoId: string
  fecha: string
  tipo: TipoTurno
  horas: number
  presente: boolean
}

export interface PrestamoEmpleado {
  id: string
  empleadoId: string
  monto: number
  saldo: number
  descuentoQuincenal: number
  estado: EstadoGeneral
}
