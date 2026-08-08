// Caché compartida de entradas + análisis para reducir peticiones al backend.
// - La lista de entradas se trae UNA vez y se reutiliza entre EntradasApiPage y
//   AnalisisApiPage (y al volver a la misma pantalla). `reload()` invalida.
// - Los análisis de cada entrada se cachean por id; `invalidateAnalisisCache()`
//   los limpia tras crear/editar/borrar un análisis.

import { useCallback, useEffect, useState } from 'react'
import { apiError } from '@/api/client'
import { materialApi, type EntradaRow, type AnalisisResumen } from '@/api/material'

// ── Lista de entradas ─────────────────────────────────────────────────────────
let cache: EntradaRow[] | null = null
let promise: Promise<EntradaRow[]> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(f => f())

export function invalidateEntradas() {
  cache = null
  promise = null
  notify()
}

export function useEntradas() {
  const [data, setData] = useState<EntradaRow[] | null>(cache)
  const [loading, setLoading] = useState(cache === null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(() => {
    setError(null)
    if (cache !== null) { setData(cache); setLoading(false); return }
    setLoading(true)
    if (!promise) {
      promise = materialApi.getEntradas({ limit: 1000, offset: 0 })
        .then(r => { cache = r; return r })
        .finally(() => { promise = null })
    }
    promise.then(() => notify()).catch(e => { setError(apiError(e).message); setLoading(false) })
  }, [])

  useEffect(() => {
    const sync = () => { setData(cache); setLoading(cache === null && !!promise) }
    listeners.add(sync)
    run()
    return () => { listeners.delete(sync) }
  }, [run])

  const reload = useCallback(() => invalidateEntradas(), [])
  return { data: data ?? [], loading, error, reload }
}

// ── Análisis por entrada (cache por id) ───────────────────────────────────────
const analisisCache = new Map<number, AnalisisResumen[]>()

export function invalidateAnalisisCache() {
  analisisCache.clear()
}

/** Trae los análisis de una entrada usando caché; solo pega al backend si no está cacheado. */
export async function getAnalisisDeEntradaCached(id: number): Promise<AnalisisResumen[]> {
  const hit = analisisCache.get(id)
  if (hit) return hit
  const res = await materialApi.getAnalisisPorEntrada(id).catch(() => [] as AnalisisResumen[])
  analisisCache.set(id, res)
  return res
}
