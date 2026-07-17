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
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!canView(user.role, module)) {
    return <Navigate to="/sin-acceso" replace />
  }
  return <>{children}</>
}
