// Inventario de productos/insumos (químicos, bolas de molino, filtroprensa, repuestos, etc.)
// Prefijo: /api/v1/inventario-productos
// El backend ya resuelve el costeo por promedio ponderado: cada Producto trae
// stock_actual/costo_promedio/valor_stock, y cada Movimiento trae
// costo_total/saldo_cantidad/saldo_valor — el front NO recalcula nada.

import { apiFetch, apiPost, apiPut, apiDelete } from './client'

type Dec = number | string | null

export type CategoriaProducto = 'quimico' | 'bola_molino' | 'filtro_prensa' | 'repuesto' | 'consumible' | 'otro'

export const CATEGORIA_LABEL: Record<CategoriaProducto, string> = {
  quimico: 'Químico',
  bola_molino: 'Bola de molino',
  filtro_prensa: 'Filtro prensa',
  repuesto: 'Repuesto',
  consumible: 'Consumible',
  otro: 'Otro',
}

export interface Producto {
  id: number
  nombre: string
  categoria: CategoriaProducto
  unidad: string
  stock_minimo: Dec
  // resueltos por el backend (promedio ponderado)
  stock_actual: Dec
  costo_promedio: Dec
  valor_stock: Dec
}

export type TipoMovimiento = 'entrada' | 'salida'

export interface MovimientoProducto {
  id: number
  id_producto: number
  fecha: string
  tipo: TipoMovimiento
  cantidad: Dec
  costo_unitario: Dec
  nota?: string | null
  // resueltos por el backend
  costo_total: Dec
  saldo_cantidad: Dec
  saldo_valor: Dec
}

export interface ResumenInventarioProductos {
  total_productos: number
  valor_total_inventario: Dec
  productos_bajo_minimo: number
  gastado_en_compras: Dec
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export interface ListarProductosFiltro {
  categoria?: CategoriaProducto
  q?: string
  bajo_minimo?: boolean
}
export interface ListarMovimientosFiltro {
  id_producto?: number
  tipo?: TipoMovimiento
  desde?: string
  hasta?: string
}

export const inventarioProductosApi = {
  listProductos: (filtro?: ListarProductosFiltro) =>
    apiFetch<Producto[]>(`/inventario-productos/productos${qs({ ...filtro })}`),

  crearProducto: (body: { nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo?: number }) =>
    apiPost<Producto>('/inventario-productos/productos', body),

  actualizarProducto: (id: number, patch: Partial<{ nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo: number }>) =>
    apiPut<Producto>(`/inventario-productos/productos/${id}`, patch),

  eliminarProducto: (id: number) =>
    apiDelete<{ message?: string }>(`/inventario-productos/productos/${id}`),

  listMovimientos: (filtro?: ListarMovimientosFiltro) =>
    apiFetch<MovimientoProducto[]>(`/inventario-productos/movimientos${qs({ ...filtro })}`),

  registrarMovimiento: (body: { id_producto: number; fecha: string; tipo: TipoMovimiento; cantidad: number; costo_unitario?: number; nota?: string }) =>
    apiPost<MovimientoProducto>('/inventario-productos/movimientos', body),

  eliminarMovimiento: (id: number) =>
    apiDelete<{ message?: string }>(`/inventario-productos/movimientos/${id}`),

  getResumen: (filtro?: { desde?: string; hasta?: string }) =>
    apiFetch<ResumenInventarioProductos>(`/inventario-productos/resumen${qs({ ...filtro })}`),
}
