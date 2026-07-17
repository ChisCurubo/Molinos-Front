import { apiFetch } from './client'

export interface CatalogosMina {
  id: number
  nombre: string
  ubicacion?: string
  estado?: string
  id_minero?: number
  id_zona?: number
}

export interface CatalogosMinero {
  id: number
  nombre: string
  alias?: string
  metodo_calculo?: string
}

export interface CatalogosZona {
  id: number
  nombre: string
  descripcion?: string
}

export interface CatalogosDueno {
  id: number
  nombre: string
  banco?: string
  numero_cuenta?: string
  tipo_cuenta?: string
}

export interface Catalogos {
  minas: CatalogosMina[]
  mineros: CatalogosMinero[]
  zonas: CatalogosZona[]
  duenos: CatalogosDueno[]
}

let cache: Catalogos | null = null
let fetchPromise: Promise<Catalogos> | null = null

export async function getCatalogos(): Promise<Catalogos> {
  if (cache) return cache
  if (fetchPromise) return fetchPromise
  fetchPromise = apiFetch<Catalogos>('/info/catalogos').then(data => {
    cache = data
    fetchPromise = null
    return data
  }).catch(() => {
    fetchPromise = null
    return { minas: [], mineros: [], zonas: [], duenos: [] }
  })
  return fetchPromise
}

export function invalidateCatalogos() {
  cache = null
}
