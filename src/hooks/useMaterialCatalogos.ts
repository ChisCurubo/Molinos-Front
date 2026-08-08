// Hooks de catálogos del módulo Material con caché en memoria compartida.
// Varios selectores montados a la vez comparten una sola petición; `reload()`
// invalida y re-consulta para todos los suscriptores.

import { useCallback, useEffect, useState } from 'react'
import { apiError } from '@/api/client'
import {
  materialApi,
  type Zona, type Minero, type Mina, type DuenoVolqueta, type Volqueta,
} from '@/api/material'

interface CacheEntry<T> {
  data: T[] | null
  promise: Promise<T[]> | null
  listeners: Set<() => void>
}

type CatalogKey = 'zonas' | 'mineros' | 'minas' | 'duenos' | 'volquetas'

const store: Record<CatalogKey, CacheEntry<unknown>> = {
  zonas:     { data: null, promise: null, listeners: new Set() },
  mineros:   { data: null, promise: null, listeners: new Set() },
  minas:     { data: null, promise: null, listeners: new Set() },
  duenos:    { data: null, promise: null, listeners: new Set() },
  volquetas: { data: null, promise: null, listeners: new Set() },
}

const fetchers: Record<CatalogKey, () => Promise<unknown[]>> = {
  zonas:     () => materialApi.getZonas(),
  mineros:   () => materialApi.getMineros(),
  minas:     () => materialApi.getMinas(),
  duenos:    () => materialApi.getDuenos(),
  volquetas: () => materialApi.getVolquetas(),
}

function notify(key: CatalogKey) {
  store[key].listeners.forEach(fn => fn())
}

/** Invalida un catálogo (o todos) — úsalo tras crear/editar/borrar para refrescar los selectores. */
export function invalidateMaterialCatalog(key?: CatalogKey) {
  const keys = key ? [key] : (Object.keys(store) as CatalogKey[])
  for (const k of keys) {
    store[k].data = null
    store[k].promise = null
    notify(k)
  }
}

function useCatalog<T>(key: CatalogKey) {
  const entry = store[key] as CacheEntry<T>
  const [data, setData] = useState<T[] | null>(entry.data)
  const [loading, setLoading] = useState(entry.data === null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(() => {
    setError(null)
    if (entry.data !== null) {
      setData(entry.data)
      setLoading(false)
      return
    }
    setLoading(true)
    if (!entry.promise) {
      entry.promise = (fetchers[key]() as Promise<T[]>)
        .then(res => { entry.data = res; return res })
        .finally(() => { entry.promise = null })
    }
    entry.promise
      .then(() => notify(key))
      .catch(e => { setError(apiError(e).message); setLoading(false) })
  }, [entry, key])

  useEffect(() => {
    const sync = () => {
      setData(entry.data)
      setLoading(entry.data === null && !!entry.promise)
    }
    entry.listeners.add(sync)
    run()
    return () => { entry.listeners.delete(sync) }
  }, [entry, run])

  const reload = useCallback(() => { invalidateMaterialCatalog(key) }, [key])

  return { data: data ?? [], loading, error, reload }
}

export const useZonas    = () => useCatalog<Zona>('zonas')
export const useMineros  = () => useCatalog<Minero>('mineros')
export const useMinas    = () => useCatalog<Mina>('minas')
export const useDuenos   = () => useCatalog<DuenoVolqueta>('duenos')
export const useVolquetas = () => useCatalog<Volqueta>('volquetas')
