import { apiFetch, apiPost, apiPut, apiDelete } from './client'

export const nominaApi = {
  // Empleados
  getEmpleados: () => apiFetch<unknown[]>('/nomina/empleados'),
  getEmpleado: (id: number) => apiFetch<unknown>(`/nomina/empleados/${id}`),
  createEmpleado: (body: unknown) => apiPost<unknown>('/nomina/empleados', body),
  updateEmpleado: (id: number, body: unknown) => apiPut<unknown>(`/nomina/empleados/${id}`, body),
  deleteEmpleado: (id: number) => apiDelete<unknown>(`/nomina/empleados/${id}`),

  // Préstamos empleado
  getPrestamosPorEmpleado: (idEmpleado: number) =>
    apiFetch<unknown[]>(`/nomina/empleados/prestamos/${idEmpleado}`),
  createPrestamo: (body: { id_empleado: number; valor: number; concepto: string }) =>
    apiPost<unknown>('/nomina/empleados/prestamos', body),
  updatePrestamo: (id: number, body: unknown) =>
    apiPut<unknown>(`/nomina/empleados/prestamos/${id}`, body),

  // Turnos
  getTurnos: (params?: { id_empleado?: number; quincena?: number; mes?: number; anio?: number }) => {
    const q = new URLSearchParams()
    if (params?.id_empleado) q.set('id_empleado', String(params.id_empleado))
    if (params?.quincena)    q.set('quincena', String(params.quincena))
    if (params?.mes)         q.set('mes', String(params.mes))
    if (params?.anio)        q.set('anio', String(params.anio))
    const qs = q.toString()
    return apiFetch<unknown[]>(`/nomina/turnos${qs ? `?${qs}` : ''}`)
  },
  createTurno: (body: unknown) => apiPost<unknown>('/nomina/turnos', body),
  updateTurno: (id: number, body: unknown) => apiPut<unknown>(`/nomina/turnos/${id}`, body),
  deleteTurno: (id: number) => apiDelete<unknown>(`/nomina/turnos/${id}`),

  // Plantas
  getPlantas: () => apiFetch<unknown[]>('/nomina/plantas'),
  createPlanta: (body: unknown) => apiPost<unknown>('/nomina/plantas', body),
  updatePlanta: (id: number, body: unknown) => apiPut<unknown>(`/nomina/plantas/${id}`, body),
  deletePlanta: (id: number) => apiDelete<unknown>(`/nomina/plantas/${id}`),

  // Saldo préstamos (vista)
  getSaldoPrestamos: () => apiFetch<unknown[]>('/nomina/vistas/saldo-prestamos-empleado'),
  getSaldoPrestamosPorEmpleado: (idEmpleado: number) =>
    apiFetch<unknown>(`/nomina/vistas/saldo-prestamos-empleado/${idEmpleado}`),
}
