import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { canView, type ModuleKey } from '@/auth/permissions'

interface ProtectedRouteProps {
  module: ModuleKey
  children: ReactNode
}

/** Exige sesión activa y permiso de vista para el módulo. */
export function ProtectedRoute({ module, children }: ProtectedRouteProps) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  // Aún validando el token persistido contra el backend: no mostramos el sistema
  // hasta confirmar que la sesión es válida.
  if (initializing) {
    return <AuthLoading />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!canView(user.role, module)) {
    return <Navigate to="/sin-acceso" replace />
  }
  return <>{children}</>
}

/** Pantalla de carga mientras se valida la sesión al arrancar. */
export function AuthLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--text-muted)',
      }}
    >
      Cargando…
    </div>
  )
}
