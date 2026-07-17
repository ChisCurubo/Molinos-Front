import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import './toast.css'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const success = useCallback((m: string) => toast(m, 'success'), [toast])
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast])
  const info    = useCallback((m: string) => toast(m, 'info'),    [toast])
  const warning = useCallback((m: string) => toast(m, 'warning'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notificaciones">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => remove(t.id)}>
            <span className="toast__msg">{t.message}</span>
            <button className="toast__close" aria-label="Cerrar" onClick={(e) => { e.stopPropagation(); remove(t.id) }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
