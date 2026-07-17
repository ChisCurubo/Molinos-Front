import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Tamaños de letra predefinidos (multiplicadores)
export const FONT_STEPS = [
  { key: 'normal', label: 'Normal', scale: 1 },
  { key: 'grande', label: 'Grande', scale: 1.15 },
  { key: 'muy-grande', label: 'Muy grande', scale: 1.3 },
] as const

export type FontStepKey = (typeof FONT_STEPS)[number]['key']

interface A11yValue {
  fontStep: FontStepKey
  setFontStep: (k: FontStepKey) => void
  cycleFontStep: () => void
  highContrast: boolean
  toggleContrast: () => void
  reduceMotion: boolean
  toggleReduceMotion: () => void
}

const KEY = 'molinos_erp_a11y_v1'

const AccessibilityContext = createContext<A11yValue | null>(null)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [fontStep, setFontStepState] = useState<FontStepKey>('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  // cargar preferencias
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.fontStep) setFontStepState(p.fontStep)
        if (typeof p.highContrast === 'boolean') setHighContrast(p.highContrast)
        if (typeof p.reduceMotion === 'boolean') setReduceMotion(p.reduceMotion)
      }
    } catch {
      /* noop */
    }
  }, [])

  // aplicar al <html> y persistir
  useEffect(() => {
    const scale = FONT_STEPS.find((f) => f.key === fontStep)?.scale ?? 1
    const root = document.documentElement
    // Escala global vía font-size del <html>: al usar rem, todo el layout crece.
    root.style.fontSize = `${scale * 100}%`
    root.setAttribute('data-contrast', highContrast ? 'high' : 'normal')
    root.setAttribute('data-reduce-motion', String(reduceMotion))
    localStorage.setItem(KEY, JSON.stringify({ fontStep, highContrast, reduceMotion }))
  }, [fontStep, highContrast, reduceMotion])

  const cycleFontStep = useCallback(() => {
    setFontStepState((cur) => {
      const idx = FONT_STEPS.findIndex((f) => f.key === cur)
      return FONT_STEPS[(idx + 1) % FONT_STEPS.length].key
    })
  }, [])

  const value = useMemo<A11yValue>(
    () => ({
      fontStep,
      setFontStep: setFontStepState,
      cycleFontStep,
      highContrast,
      toggleContrast: () => setHighContrast((v) => !v),
      reduceMotion,
      toggleReduceMotion: () => setReduceMotion((v) => !v),
    }),
    [fontStep, cycleFontStep, highContrast, reduceMotion],
  )

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useA11y() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useA11y debe usarse dentro de AccessibilityProvider')
  return ctx
}
