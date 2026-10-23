// Balance de Tesorería (mes actual + año actual) — compartido entre el
// widget del TopBar y la página de Tesorería para no duplicar la llamada: el
// TopBar está montado siempre, así que cachea el resultado en memoria y lo
// reutiliza cualquier página que pida lo mismo (mismo mes/año actual).
// Expone las respuestas crudas (no solo números derivados) porque la página
// de Tesorería necesita el desglose por categoría y la serie de 12 meses.

import { useEffect, useState } from 'react'
import { pagosIngresosApi, type FlujoCajaResponse, type FlujoCajaAnualResponse } from '@/api/pagosIngresos'
import { todayISO } from '@/utils/format'

interface BalanceTesoreria {
  mesData: FlujoCajaResponse | null
  anioData: FlujoCajaAnualResponse | null
  loading: boolean
  error: string | null
}

let cache: { anio: number; mes: number; data: BalanceTesoreria } | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function hoy() {
  const [anio, mes] = todayISO().split('-').map(Number)
  return { anio, mes }
}

async function cargar() {
  const { anio, mes } = hoy()
  if (inflight) return inflight
  inflight = Promise.all([
    pagosIngresosApi.getFlujoCaja(mes, anio),
    pagosIngresosApi.getFlujoCajaAnual(anio),
  ]).then(([mesData, anioData]) => {
    cache = { anio, mes, data: { mesData, anioData, loading: false, error: null } }
  }).catch(e => {
    cache = { anio, mes, data: { mesData: null, anioData: null, loading: false, error: e?.message ?? 'Error al cargar el balance' } }
  }).finally(() => { inflight = null; listeners.forEach(fn => fn()) })
  return inflight
}

export function useBalanceTesoreria() {
  const { anio, mes } = hoy()
  const [, setTick] = useState(0)
  const vigente = cache && cache.anio === anio && cache.mes === mes

  useEffect(() => {
    const listener = () => setTick(t => t + 1)
    listeners.add(listener)
    if (!vigente) cargar()
    return () => { listeners.delete(listener) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return vigente ? cache!.data : { mesData: null, anioData: null, loading: true, error: null }
}

/** Llamar tras crear/editar/eliminar un ingreso para que el widget del
 * TopBar y cualquier página abierta se refresquen con el dato real. */
export function invalidateBalanceTesoreria() {
  cache = null
  cargar()
}
