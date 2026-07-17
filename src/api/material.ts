import { apiFetch, apiPost, apiPut, apiDelete } from './client'

// ── Entradas ──────────────────────────────────────────────────────────────────

export interface EntradaPayload {
  id_mina: number
  id_volqueta?: number
  fecha_entrada: string
  peso_bruto: number
  peso_tara?: number
  numero_volqueta?: number
  observaciones?: string
}

export const materialApi = {
  // Entradas
  getEntradas: (params?: { fechaDesde?: string; fechaHasta?: string; estado?: string }) => {
    const q = new URLSearchParams()
    if (params?.fechaDesde) q.set('fechaDesde', params.fechaDesde)
    if (params?.fechaHasta) q.set('fechaHasta', params.fechaHasta)
    if (params?.estado)     q.set('estado', params.estado)
    const qs = q.toString()
    return apiFetch<unknown[]>(`/material/entradas${qs ? `?${qs}` : ''}`)
  },
  createEntrada: (body: EntradaPayload) =>
    apiPost<unknown>('/material/entrada', body),

  // Análisis
  createAnalisis: (body: {
    id_entrada: number
    id_tipo_analisis?: number
    porcentaje_humedad: number
    toneladas_secas: number
    au_falso: number
    au_concentrado?: number
    ag_concentrado?: number
  }) => apiPost<unknown>('/material/analisis', body),

  // Concentrado
  iniciarLote: (body: { codigo: string; fecha_inicio: string }) =>
    apiPost<unknown>('/material/concentrado', body),
  procesarMaterial: (idLote: number, body: { id_entrada: number; toneladas_aportadas: number }) =>
    apiPost<unknown>(`/material/concentrado/${idLote}/procesar`, body),
  cerrarLote: (idLote: number, body: {
    toneladas_humedo: number
    porcentaje_humedad: number
    fecha_fin: string
    hizo_molienda: 0 | 1
    hizo_filtroprensa: 0 | 1
  }) => apiPut<unknown>(`/material/concentrado/${idLote}/cerrar`, body),

  // Viajes de concentrado
  crearViajeConcentrado: (body: { id_cliente: number; conductor: string; placa: string }) =>
    apiPost<unknown>('/material/viajes', body),
  asignarLineaViaje: (idViaje: number, body: { id_material_concentrado: number; total_concentrado_humedo: number }) =>
    apiPost<unknown>(`/material/viajes/${idViaje}/lineas`, body),
  eliminarLineaViaje: (idViaje: number, idLinea: number) =>
    apiDelete<unknown>(`/material/viajes/${idViaje}/lineas/${idLinea}`),

  // Volquetas
  getVolquetas: () => apiFetch<unknown[]>('/material/volqueta'),
  createVolqueta: (body: { placa: string; conductor?: string; capacidad_ton?: number; id_dueno?: number }) =>
    apiPost<unknown>('/material/volqueta', body),
  updateVolqueta: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/volqueta/${id}`, body),
  deleteVolqueta: (id: number) =>
    apiDelete<unknown>(`/material/volqueta/${id}`),
  getVolquetaPorDueno: (idDueno: number) =>
    apiFetch<unknown[]>(`/material/volqueta/dueno/${idDueno}`),
  getVolquetaEntradas: (id: number) =>
    apiFetch<unknown[]>(`/material/volqueta/${id}/entradas`),

  // Dueños de volqueta
  createDueno: (body: { nombre: string; banco?: string; numero_cuenta?: string; tipo_cuenta?: string }) =>
    apiPost<unknown>('/material/volqueta/dueno', body),
  updateDueno: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/volqueta/dueno/${id}`, body),
  deleteDueno: (id: number) =>
    apiDelete<unknown>(`/material/volqueta/dueno/${id}`),

  // Agua planta
  createViajeAgua: (body: {
    id_vehiculo: number
    fecha: string
    valor_viaje: number
    cantidad_viajes: number
    acpm?: number
    comprobante_url?: string
  }) => apiPost<unknown>('/material/agua', body),
  getViajesAgua: () => apiFetch<unknown[]>('/material/agua/viajes'),
  updateViajeAgua: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/agua/${id}`, body),

  // Minas
  getMinas: () => apiFetch<unknown[]>('/material/mina'),
  createMina: (body: { nombre: string; id_minero?: number; id_zona?: number; ubicacion?: string; estado?: string }) =>
    apiPost<unknown>('/material/mina', body),
  updateMina: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/mina/${id}`, body),
  deleteMina: (id: number) =>
    apiDelete<unknown>(`/material/mina/${id}`),

  // Mineros
  getMineros: () => apiFetch<unknown[]>('/material/mina/catalogo/mineros'),
  createMinero: (body: { nombre: string; alias?: string; metodo_calculo?: string }) =>
    apiPost<unknown>('/material/mina/minero', body),
  updateMinero: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/mina/minero/${id}`, body),
  deleteMinero: (id: number) =>
    apiDelete<unknown>(`/material/mina/minero/${id}`),

  // Zonas
  getZonas: () => apiFetch<unknown[]>('/material/mina/catalogo/zonas'),
  createZona: (body: { nombre: string; descripcion?: string }) =>
    apiPost<unknown>('/material/mina/zona', body),
  updateZona: (id: number, body: unknown) =>
    apiPut<unknown>(`/material/mina/zona/${id}`, body),
  deleteZona: (id: number) =>
    apiDelete<unknown>(`/material/mina/zona/${id}`),
}
