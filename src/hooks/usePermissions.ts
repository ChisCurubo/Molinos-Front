import { useAuth } from '@/context/AuthContext'
import { canWrite, type ModuleKey } from '@/auth/permissions'

/** Devuelve si el usuario actual puede escribir en el módulo indicado. */
export function useCanWrite(module: ModuleKey): boolean {
  const { user } = useAuth()
  if (!user) return false
  return canWrite(user.role, module)
}
