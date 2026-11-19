import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '@/types'
import { seedUsers } from '@/data/seed'
import { authApi } from '@/api/auth'
import { apiErrorMessage } from '@/api/client'
import { SESSION_KEY, clearLocalData } from '@/auth/session'

interface StoredUser extends User {
  password: string
}

interface Session {
  user: User
  /** El backend exige cambiar la contraseña antes de usar el sistema. */
  mustChangePassword?: boolean
  /** true si la sesión proviene del login mock local (accesos rápidos / demo). */
  mock?: boolean
}

interface AuthContextValue {
  user: User | null
  /** true si el backend marcó la contraseña como temporal/rotada. */
  mustChangePassword: boolean
  clearMustChange: () => void
  users: User[]
  /** true mientras se valida el token persistido contra el backend al arrancar. */
  initializing: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  addUser: (u: Omit<StoredUser, 'id'>) => void
  updateUser: (id: string, patch: Partial<StoredUser>) => void
  removeUser: (id: string) => void
}

const USERS_KEY = 'molinos_erp_users_v1'

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return seedUsers
}

// Mapea el id_rol (numérico, confiable — FK a la tabla Roles) devuelto por el
// backend a los roles de la app. El nombre humano del rol (ej.
// "Angela_exportaciones") NO se parsea: cambia de redacción libremente y no
// es un contrato estable. Si el id_rol no es ninguno de los conocidos, usa el
// rol conocido por email (seedUsers) y por defecto 'administrador'.
const ID_ROL_MAP: Record<number, Role> = {
  1: 'administrador',
  2: 'financiero',
  3: 'materiales',
  4: 'materiales', // Valeria: escribe en /material
  5: 'materiales', // Ginna: escribe en /material
  6: 'importaciones',
}
// Un id_rol desconocido NO recibe permisos: devuelve null y el login se rechaza
// (antes caía en 'administrador', dando el panel completo a roles no mapeados).
function resolveRole(idRol: number | undefined): Role | null {
  return idRol != null && ID_ROL_MAP[idRol] ? ID_ROL_MAP[idRol] : null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>(loadUsers)
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  // Mientras validamos el token persistido contra el backend, no dejamos entrar
  // a las rutas protegidas (evita mostrar el sistema con un token vencido/inválido).
  const [initializing, setInitializing] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      const s: Session | null = raw ? JSON.parse(raw) : null
      // Solo hay que validar sesiones reales; las mock/demo no se verifican.
      return Boolean(s && !s.mock)
    } catch {
      return false
    }
  })
  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }, [users])

  useEffect(() => {
    if (session) {
      // Solo el perfil (usuario/rol). El token vive en una cookie httpOnly del backend.
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [session])

  // Al arrancar: si hay una sesión real persistida, validamos el token contra el
  // backend (GET /auth/verify). Si no es válido (vencido, revocado o inexistente),
  // cerramos la sesión para forzar el login. Las sesiones mock/demo se conservan.
  useEffect(() => {
    let cancelled = false
    if (!session || session.mock) {
      setInitializing(false)
      return
    }
    authApi
      .verify()
      .then((ok) => {
        if (cancelled) return
        if (!ok) setSession(null)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })
    return () => {
      cancelled = true
    }
    // Solo debe ejecutarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publicUsers = useMemo<User[]>(
    () => users.map(({ password: _pw, ...u }) => u),
    [users],
  )

  // Login contra el backend real (POST /auth/login). Ya no hay fallback local:
  // si el backend rechaza o no responde, el login falla (no se puede entrar
  // con las contraseñas quemadas de seedUsers).
  const login = useCallback<AuthContextValue['login']>(
    async (email, password) => {
      const correo = email.trim().toLowerCase()
      try {
        const resp = await authApi.login(correo, password)
        if (!resp?.usuario) return { ok: false, error: 'Credenciales inválidas.' }
        const seed = users.find((u) => u.email.toLowerCase() === correo)
        const role = resolveRole(resp.usuario?.id_rol)
        if (!role) {
          void authApi.logout()
          return { ok: false, error: 'Su rol no tiene acceso a esta aplicación. Contacte al administrador.' }
        }
        const user: User = {
          id: resp.usuario?.id != null ? String(resp.usuario.id) : (seed?.id ?? correo),
          nombre: seed?.nombre ?? resp.usuario?.username ?? correo,
          email: resp.usuario?.username ?? correo,
          role,
          activo: true,
          ultimoAcceso: new Date().toISOString().slice(0, 10),
        }
        setSession({ user, mock: false, mustChangePassword: Boolean(resp.usuario.debe_cambiar_password) })
        return { ok: true }
      } catch (err) {
        return { ok: false, error: apiErrorMessage(err) }
      }
    },
    [users],
  )

  const logout = useCallback(() => {
    // Recarga completa: borra datos locales y también el estado en memoria de los contextos.
    void authApi.logout().finally(() => { clearLocalData(); window.location.replace('/login') })
    setSession(null)
  }, [])
  const clearMustChange = useCallback(() => setSession((s) => (s ? { ...s, mustChangePassword: false } : s)), [])

  const addUser = useCallback<AuthContextValue['addUser']>((u) => {
    setUsers((prev) => [{ ...u, id: `u${Date.now()}` }, ...prev])
  }, [])

  const updateUser = useCallback<AuthContextValue['updateUser']>((id, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const removeUser = useCallback<AuthContextValue['removeUser']>((id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      mustChangePassword: Boolean(session?.mustChangePassword),
      clearMustChange,
      users: publicUsers,
      initializing,
      login, logout, addUser, updateUser, removeUser,
    }),
    [session, publicUsers, initializing, login, logout, addUser, updateUser, removeUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
