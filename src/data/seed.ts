import type {
  CuentaPorCobrar,
  CuentaPorPagar,
  Empleado,
  EntradaMaterial,
  Mina,
  Minero,
  Planta,
  Prestamo,
  PrestamoEmpleado,
  Turno,
  User,
  ViajeAgua,
  Volqueta,
  Zona,
} from '@/types'

// Usuarios del sistema. La "contraseña" mock por defecto es: molinos2026
export const seedUsers: (User & { password: string })[] = [
  { id: 'u1', nombre: 'David', email: 'david@molinosdecolombia.com', role: 'administrador', activo: true, password: 'molinos2026', ultimoAcceso: '2026-07-07' },
  { id: 'u2', nombre: 'Vicky', email: 'vicky@molinosdecolombia.com', role: 'materiales', activo: true, password: 'molinos2026', ultimoAcceso: '2026-07-08' },
  { id: 'u3', nombre: 'Juliana', email: 'juliana@molinosdecolombia.com', role: 'financiero', activo: true, password: 'molinos2026', ultimoAcceso: '2026-07-08' },
]

export const seedZonas: Zona[] = [
  { id: 'z1', nombre: 'Zona Alta — Segovia', tarifaTon: 48000 },
  { id: 'z2', nombre: 'Zona Media — Remedios', tarifaTon: 42000 },
  { id: 'z3', nombre: 'Zona Baja — El Bagre', tarifaTon: 55000 },
]

export const seedMinas: Mina[] = [
  { id: 'm1', nombre: 'La Esperanza', zonaId: 'z1', responsable: 'Carlos Ruiz' },
  { id: 'm2', nombre: 'El Dorado', zonaId: 'z2', responsable: 'Marta Gómez' },
  { id: 'm3', nombre: 'San Antonio', zonaId: 'z3', responsable: 'Luis Peña' },
]

export const seedMineros: Minero[] = [
  { id: 'mi1', nombre: 'Pedro Álvarez', documento: '71.234.567', minaId: 'm1', telefono: '310 555 1122' },
  { id: 'mi2', nombre: 'José Cuartas', documento: '98.111.222', minaId: 'm2', telefono: '311 444 3344' },
  { id: 'mi3', nombre: 'Andrés Mora', documento: '15.987.654', minaId: 'm3', telefono: '312 333 5566' },
]

export const seedVolquetas: Volqueta[] = [
  { id: 'v1', placa: 'WGN-482', dueno: 'Transportes El Roble', conductor: 'Ramiro Díaz', capacidadTon: 14, activo: true },
  { id: 'v2', placa: 'TXK-190', dueno: 'Inversiones Vega', conductor: 'Fabián Ortiz', capacidadTon: 16, activo: true },
  { id: 'v3', placa: 'HRP-733', dueno: 'Molinos de Colombia', conductor: 'Nelson Vega', capacidadTon: 12, activo: false },
]

export const seedEntradas: EntradaMaterial[] = [
  {
    id: 'e1', fecha: '2026-07-08', volquetaId: 'v1', minaId: 'm1', mineroId: 'mi1',
    pesoBrutoTon: 12.4, estado: 'aprobado', humedadPct: 8, tenor: 14.2, au: 24.1, ag: 110,
    toneladasSecas: 11.408, liquidacion: 9820000, flete: 547584,
  },
  {
    id: 'e2', fecha: '2026-07-08', volquetaId: 'v2', minaId: 'm2', mineroId: 'mi2',
    pesoBrutoTon: 15.1, estado: 'revision',
  },
  {
    id: 'e3', fecha: '2026-07-07', volquetaId: 'v1', minaId: 'm3', mineroId: 'mi3',
    pesoBrutoTon: 10.8, estado: 'pendiente',
  },
  {
    id: 'e4', fecha: '2026-06-28', volquetaId: 'v2', minaId: 'm1', mineroId: 'mi1',
    pesoBrutoTon: 13.6, estado: 'aprobado', humedadPct: 7.5, tenor: 12.8, au: 21.4, ag: 98,
    toneladasSecas: 12.58, liquidacion: 8640000, flete: 652800,
  },
  {
    id: 'e5', fecha: '2026-06-20', volquetaId: 'v1', minaId: 'm2', mineroId: 'mi2',
    pesoBrutoTon: 11.2, estado: 'aprobado', humedadPct: 9.2, tenor: 15.6, au: 26.8, ag: 130,
    toneladasSecas: 10.17, liquidacion: 11100000, flete: 470400,
  },
  {
    id: 'e6', fecha: '2026-06-12', volquetaId: 'v2', minaId: 'm3', mineroId: 'mi3',
    pesoBrutoTon: 14.9, estado: 'aprobado', humedadPct: 8.8, tenor: 11.1, au: 18.2, ag: 88,
    toneladasSecas: 13.59, liquidacion: 7350000, flete: 819500,
  },
]

export const seedViajesAgua: ViajeAgua[] = [
  { id: 'w1', fecha: '2026-07-08', vehiculo: 'Cisterna 1', placa: 'AGU-001', volumenM3: 20, destino: 'Planta principal', costo: 180000, estado: 'aprobado' },
  { id: 'w2', fecha: '2026-07-07', vehiculo: 'Cisterna 2', placa: 'AGU-002', volumenM3: 18, destino: 'Molienda', costo: 165000, estado: 'pendiente' },
]

export const seedPorPagar: CuentaPorPagar[] = [
  { id: 'p1', concepto: 'Flete entrada E1', tipo: 'flete', beneficiario: 'Ramiro Díaz', monto: 547584, fechaVencimiento: '2026-07-15', estado: 'pendiente', origen: 'automatico' },
  { id: 'p2', concepto: 'Pago material E1', tipo: 'material', beneficiario: 'Pedro Álvarez', monto: 9820000, fechaVencimiento: '2026-07-12', estado: 'pendiente', origen: 'automatico' },
  { id: 'p3', concepto: 'Reactivos laboratorio', tipo: 'proveedor', beneficiario: 'Químicos Andinos', monto: 2300000, fechaVencimiento: '2026-07-20', estado: 'aprobado', origen: 'manual' },
]

export const seedPorCobrar: CuentaPorCobrar[] = [
  { id: 'c1', concepto: 'Venta de concentrado julio', cliente: 'Comercializadora Aurora', monto: 42000000, fechaVencimiento: '2026-07-25', estado: 'pendiente' },
]

export const seedPrestamos: Prestamo[] = [
  { id: 'l1', entidad: 'Banco Agrario', capital: 120000000, interesPct: 1.8, plazoMeses: 24, saldo: 84000000, cuotaMensual: 6200000, estado: 'aprobado' },
  { id: 'l2', entidad: 'Bancolombia', capital: 80000000, interesPct: 1.5, plazoMeses: 18, saldo: 52000000, cuotaMensual: 5100000, estado: 'aprobado' },
  { id: 'l3', entidad: 'Cooperativa Minera', capital: 45000000, interesPct: 2.1, plazoMeses: 12, saldo: 45000000, cuotaMensual: 4300000, estado: 'pendiente' },
]

export const seedPlantas: Planta[] = [
  { id: 'pl1', nombre: 'Planta Principal', ubicacion: 'Segovia, Antioquia' },
  { id: 'pl2', nombre: 'Planta Molienda', ubicacion: 'Remedios, Antioquia' },
]

export const seedEmpleados: Empleado[] = [
  { id: 'em1', nombre: 'Sandra Ruiz', documento: '43.222.111', cargo: 'Operaria de molienda', plantaId: 'pl1', salarioBase: 1650000, activo: true },
  { id: 'em2', nombre: 'Jorge Betancur', documento: '70.555.333', cargo: 'Laboratorista', plantaId: 'pl1', salarioBase: 2100000, activo: true },
  { id: 'em3', nombre: 'Diana Loaiza', documento: '32.888.444', cargo: 'Auxiliar administrativa', plantaId: 'pl2', salarioBase: 1500000, activo: true },
  { id: 'em4', nombre: 'Camilo Ríos', documento: '10.444.777', cargo: 'Operario de planta', plantaId: 'pl2', salarioBase: 1620000, activo: true },
]

// Genera turnos coherentes para la 1ª quincena de julio 2026 (días 1–15).
// Domingos de descanso, alternancia diurno/nocturno y algún ausentismo.
function generarTurnos(): Turno[] {
  const empleados = ['em1', 'em2', 'em3', 'em4']
  const turnos: Turno[] = []
  empleados.forEach((empId, ei) => {
    for (let dia = 1; dia <= 15; dia++) {
      const fecha = `2026-07-${String(dia).padStart(2, '0')}`
      const dow = new Date(`${fecha}T00:00:00`).getDay() // 0 = domingo
      if (dow === 0) continue // descanso dominical
      // em2 (laboratorista) trabaja de noche; otros diurno, con rotación
      const tipo: Turno['tipo'] = ei === 1 || (dia + ei) % 5 === 0 ? 'nocturno' : 'diurno'
      const presente = !((dia + ei) % 7 === 0) // ausentismo ocasional
      turnos.push({
        id: `t-${empId}-${dia}`,
        empleadoId: empId,
        fecha,
        tipo,
        horas: presente ? 8 : 0,
        presente,
      })
    }
  })
  return turnos
}

export const seedTurnos: Turno[] = generarTurnos()

export const seedPrestamosEmpleado: PrestamoEmpleado[] = [
  { id: 'pe1', empleadoId: 'em1', monto: 800000, saldo: 400000, descuentoQuincenal: 100000, estado: 'aprobado' },
]
