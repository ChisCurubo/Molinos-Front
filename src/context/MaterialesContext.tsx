import {
  createContext, useContext, useState, useCallback,
  type ReactNode, type Dispatch, type SetStateAction,
} from 'react'
import {
  materialesMock, lotesConcentrado as lotesConcentradoMock, viajesMock, analisisMock,
  type MaterialRow, type LoteConcentrado, type ViajeRow, type AnalisisRow,
} from '@/data/mock'

const LS_KEYS = {
  materiales: 'erp_materiales',
  lotes:      'erp_lotes',
  viajes:     'erp_viajes',
  analisis:   'erp_analisis',
} as const

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function lsSave<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
}

/** Wrap a setter so every update also persists to localStorage */
function usePersisted<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setRaw] = useState<T>(() => lsLoad(key, fallback))

  const setState: Dispatch<SetStateAction<T>> = useCallback((action) => {
    setRaw(prev => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action
      lsSave(key, next)
      return next
    })
  }, [key])

  return [state, setState]
}

interface MaterialesContextValue {
  materiales:    MaterialRow[]
  setMateriales: Dispatch<SetStateAction<MaterialRow[]>>
  lotes:         LoteConcentrado[]
  setLotes:      Dispatch<SetStateAction<LoteConcentrado[]>>
  viajes:        ViajeRow[]
  setViajes:     Dispatch<SetStateAction<ViajeRow[]>>
  analisis:      AnalisisRow[]
  setAnalisis:   Dispatch<SetStateAction<AnalisisRow[]>>
  resetMock:     () => void
}

const MaterialesContext = createContext<MaterialesContextValue | null>(null)

export function MaterialesProvider({ children }: { children: ReactNode }) {
  const [materiales, setMateriales] = usePersisted<MaterialRow[]>  (LS_KEYS.materiales, materialesMock)
  const [lotes,      setLotes]      = usePersisted<LoteConcentrado[]>(LS_KEYS.lotes,    lotesConcentradoMock)
  const [viajes,     setViajes]     = usePersisted<ViajeRow[]>      (LS_KEYS.viajes,    viajesMock)
  const [analisis,   setAnalisis]   = usePersisted<AnalisisRow[]>   (LS_KEYS.analisis,  analisisMock)

  /** Reset all data back to the original mock (useful for dev/testing) */
  const resetMock = useCallback(() => {
    setMateriales(materialesMock)
    setLotes(lotesConcentradoMock)
    setViajes(viajesMock)
    setAnalisis(analisisMock)
  }, [setMateriales, setLotes, setViajes, setAnalisis])

  return (
    <MaterialesContext.Provider value={{ materiales, setMateriales, lotes, setLotes, viajes, setViajes, analisis, setAnalisis, resetMock }}>
      {children}
    </MaterialesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMateriales() {
  const ctx = useContext(MaterialesContext)
  if (!ctx) throw new Error('useMateriales debe usarse dentro de MaterialesProvider')
  return ctx
}
