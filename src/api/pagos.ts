import { apiFetch, apiPost, apiPut } from './client'

export const pagosApi = {
  // CxP - Cuentas por pagar
  getCxP: () => apiFetch<unknown[]>('/pagos/cxp'),
  createCxP: (body: unknown) => apiPost<unknown>('/pagos/cxp', body),
  pagarCxP: (id: number, body: unknown) => apiPost<unknown>(`/pagos/cxp/${id}/pagar`, body),

  // Categorías CxP
  getCategoriasCxP: () => apiFetch<unknown[]>('/pagos/cxp/categorias'),
  createCategoriaCxP: (body: unknown) => apiPost<unknown>('/pagos/cxp/categorias', body),
  updateCategoriaCxP: (id: number, body: unknown) => apiPut<unknown>(`/pagos/cxp/categorias/${id}`, body),

  // CxC - Cuentas por cobrar
  getCategoriasCxC: () => apiFetch<unknown[]>('/pagos/cxc/categorias'),

  // Préstamos financieros
  getPrestamosFinancieros: () => apiFetch<unknown[]>('/pagos/prestamos-financieros'),
  getPrestamoFinanciero: (id: number) => apiFetch<unknown>(`/pagos/prestamos-financieros/${id}`),
  createPrestamoFinanciero: (body: {
    nombre_prestamo: string
    fecha_adquisicion: string
    monto_principal: number
    tasa_interes: number
    saldo_pendiente: number
    activo?: boolean
  }) => apiPost<unknown>('/pagos/prestamos-financieros', body),
  updatePrestamoFinanciero: (id: number, body: unknown) =>
    apiPut<unknown>(`/pagos/prestamos-financieros/${id}`, body),

  // Proveedores
  getProveedores: () => apiFetch<unknown[]>('/pagos/proveedores'),
  createProveedor: (body: unknown) => apiPost<unknown>('/pagos/proveedores', body),
  updateProveedor: (id: number, body: unknown) => apiPut<unknown>(`/pagos/proveedores/${id}`, body),

  // Gastos
  getGastos: () => apiFetch<unknown[]>('/pagos/gastos'),
  createGasto: (body: unknown) => apiPost<unknown>('/pagos/gastos', body),
  updateGasto: (id: number, body: unknown) => apiPut<unknown>(`/pagos/gastos/${id}`, body),

  // Alquileres
  getAlquileres: () => apiFetch<unknown[]>('/pagos/alquileres'),
  createAlquiler: (body: unknown) => apiPost<unknown>('/pagos/alquileres', body),
  updateAlquiler: (id: number, body: unknown) => apiPut<unknown>(`/pagos/alquileres/${id}`, body),
}
