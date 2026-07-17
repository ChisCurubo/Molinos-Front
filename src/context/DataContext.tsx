import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  CuentaPorCobrar, CuentaPorPagar, Empleado, EntradaMaterial, Mina, Minero,
  Planta, Prestamo, PrestamoEmpleado, Turno, ViajeAgua, Volqueta, Zona,
} from '@/types'
import {
  seedEmpleados, seedEntradas, seedMinas, seedMineros, seedPlantas, seedPorCobrar,
  seedPorPagar, seedPrestamos, seedPrestamosEmpleado, seedTurnos, seedViajesAgua,
  seedVolquetas, seedZonas,
} from '@/data/seed'

interface DataState {
  zonas: Zona[]
  minas: Mina[]
  mineros: Minero[]
  volquetas: Volqueta[]
  entradas: EntradaMaterial[]
  viajesAgua: ViajeAgua[]
  porPagar: CuentaPorPagar[]
  porCobrar: CuentaPorCobrar[]
  prestamos: Prestamo[]
  plantas: Planta[]
  empleados: Empleado[]
  turnos: Turno[]
  prestamosEmpleado: PrestamoEmpleado[]
}

type Collection = keyof DataState

interface DataContextValue extends DataState {
  add: <K extends Collection>(col: K, item: DataState[K][number]) => void
  update: <K extends Collection>(col: K, id: string, patch: Partial<DataState[K][number]>) => void
  remove: (col: Collection, id: string) => void
  reset: () => void
}

const STORAGE_KEY = 'molinos_erp_data_v2'

const initialState: DataState = {
  zonas: seedZonas,
  minas: seedMinas,
  mineros: seedMineros,
  volquetas: seedVolquetas,
  entradas: seedEntradas,
  viajesAgua: seedViajesAgua,
  porPagar: seedPorPagar,
  porCobrar: seedPorCobrar,
  prestamos: seedPrestamos,
  plantas: seedPlantas,
  empleados: seedEmpleados,
  turnos: seedTurnos,
  prestamosEmpleado: seedPrestamosEmpleado,
}

function load(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState, ...JSON.parse(raw) }
  } catch {
    /* noop */
  }
  return initialState
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const add = useCallback<DataContextValue['add']>((col, item) => {
    setState((s) => ({ ...s, [col]: [item, ...(s[col] as unknown[])] as DataState[typeof col] }))
  }, [])

  const update = useCallback<DataContextValue['update']>((col, id, patch) => {
    setState((s) => ({
      ...s,
      [col]: (s[col] as { id: string }[]).map((it) =>
        it.id === id ? { ...it, ...patch } : it,
      ) as DataState[typeof col],
    }))
  }, [])

  const remove = useCallback<DataContextValue['remove']>((col, id) => {
    setState((s) => ({
      ...s,
      [col]: (s[col] as { id: string }[]).filter((it) => it.id !== id) as DataState[typeof col],
    }))
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(initialState)
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({ ...state, add, update, remove, reset }),
    [state, add, update, remove, reset],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}
