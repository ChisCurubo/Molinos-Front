import { apiFetch, apiPost, apiPut, apiDelete } from './client'

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ─── Proveedores (usado por /pagos/mulas y otros módulos de pagos) ────────────
export interface CategoriaProveedor {
  id: number
  nombre: string
  descripcion?: string | null
}

export type TipoProveedor = 'general' | 'combustible' | 'transportadora' | 'laboratorio'

export interface Proveedor {
  id: number
  nombre: string
  id_categoria?: number | null
  categoria?: string | null
  tipo?: TipoProveedor
  contacto?: string | null
  telefono?: string | null
  ciudad?: string | null
  alias?: string | null
  nequi?: boolean | number
  compra_realizada?: string | null
  estado?: 'activo' | 'inactivo' | string
}
export interface ProveedorPayload {
  nombre: string
  id_categoria?: number
  tipo?: TipoProveedor
  contacto?: string
  telefono?: string
  ciudad?: string
  alias?: string
  nequi?: boolean
  compra_realizada?: string
  estado?: string
}
export interface ProveedoresFiltro {
  id_categoria?: number
  tipo?: TipoProveedor
  estado?: string
  q?: string
}

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
  getProveedores: (filtro?: ProveedoresFiltro) =>
    apiFetch<Proveedor[]>(`/pagos/proveedores${qs({ id_categoria: filtro?.id_categoria, tipo: filtro?.tipo, estado: filtro?.estado, q: filtro?.q })}`),
  getProveedor: (id: number) => apiFetch<Proveedor>(`/pagos/proveedores/${id}`),
  createProveedor: (body: ProveedorPayload) => apiPost<Proveedor>('/pagos/proveedores', body),
  updateProveedor: (id: number, body: Partial<ProveedorPayload>) => apiPut<Proveedor>(`/pagos/proveedores/${id}`, body),
  deleteProveedor: (id: number) => apiDelete<{ message?: string }>(`/pagos/proveedores/${id}`),
  getCategoriasProveedor: () => apiFetch<CategoriaProveedor[]>('/pagos/proveedores/categorias'),
  getCategoriaProveedor: (id: number) => apiFetch<CategoriaProveedor>(`/pagos/proveedores/categorias/${id}`),
  createCategoriaProveedor: (nombre: string) => apiPost<CategoriaProveedor>('/pagos/proveedores/categorias', { nombre }),
  updateCategoriaProveedor: (id: number, nombre: string) => apiPut<CategoriaProveedor>(`/pagos/proveedores/categorias/${id}`, { nombre }),
  deleteCategoriaProveedor: (id: number) => apiDelete<{ message?: string }>(`/pagos/proveedores/categorias/${id}`),

  // Gastos
  getGastos: () => apiFetch<unknown[]>('/pagos/gastos'),
  createGasto: (body: unknown) => apiPost<unknown>('/pagos/gastos', body),
  updateGasto: (id: number, body: unknown) => apiPut<unknown>(`/pagos/gastos/${id}`, body),

  // Alquileres
  getAlquileres: () => apiFetch<unknown[]>('/pagos/alquileres'),
  createAlquiler: (body: unknown) => apiPost<unknown>('/pagos/alquileres', body),
  updateAlquiler: (id: number, body: unknown) => apiPut<unknown>(`/pagos/alquileres/${id}`, body),
}
