// Deuda total de préstamos financieros activos — compartida entre el widget
// del TopBar y Tesorería, mismo patrón de caché en memoria que
// useBalanceTesoreria (el TopBar está montado siempre).

import { useEffect, useState } from 'react'
import { num } from '@/api/material'
import { pagosPrestamosApi } from '@/api/pagosPrestamos'

interface DeudaPrestamos {
  total: number | null
  loading: boolean
  error: string | null
}

let cache: DeudaPrestamos | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

async function cargar() {
  if (inflight) return inflight
  inflight = pagosPrestamosApi.listar()
    .then(prestamos => {
      const total = (Array.isArray(prestamos) ? prestamos : [])
        .filter(p => !!num(p.activo ?? 1))
        .reduce((s, p) => s + num(p.saldo_pendiente), 0)
      cache = { total, loading: false, error: null }
    })
    .catch(e => { cache = { total: null, loading: false, error: e?.message ?? 'Error al cargar la deuda' } })
    .finally(() => { inflight = null; listeners.forEach(fn => fn()) })
  return inflight
}

export function useDeudaPrestamos() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = () => setTick(t => t + 1)
    listeners.add(listener)
    if (!cache) cargar()
    return () => { listeners.delete(listener) }
  }, [])
  return cache ?? { total: null, loading: true, error: null }
}

/** Llamar tras crear/editar/eliminar un préstamo o registrar un abono. */
export function invalidateDeudaPrestamos() {
  cache = null
  cargar()
}
