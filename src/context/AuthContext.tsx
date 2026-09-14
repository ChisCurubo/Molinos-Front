import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '@/types'
import { seedUsers } from '@/data/seed'
import { authApi } from '@/api/auth'
import { SESSION_KEY } from '@/auth/session'

interface StoredUser extends User {
  password: string
}

interface Session {
  user: User
  token: string
  /** true si la sesión proviene del login mock local (accesos rápidos / demo). */
  mock?: boolean
}

interface AuthContextValue {
  user: User | null
  token: string | null
  users: User[]
  /** true mientras se valida el token persistido contra el backend al arrancar. */
  initializing: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  requestReset: (email: string) => { ok: boolean; token?: string; error?: string }
  resetPassword: (email: string, token: string, newPassword: string) => { ok: boolean; error?: string }
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

// Token "JWT" simulado (no criptográfico — solo para el prototipo)
function fakeJwt(user: User): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub: user.id, role: user.role, name: user.nombre, iat: Date.now() }))
  return `${header}.${payload}.molinos-signature`
}

// Mapea el rol devuelto por el backend a los roles de la app. Si no coincide,
// usa el rol conocido por email (seedUsers) y por defecto 'administrador'.
function resolveRole(apiRol: string | undefined, fallback: Role | undefined): Role {
  const r = apiRol?.toLowerCase().trim()
  if (r === 'administrador' || r === 'materiales' || r === 'financiero') return r
  return fallback ?? 'administrador'
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
  // tokens de restablecimiento activos (email -> código)
  const [resetTokens, setResetTokens] = useState<Record<string, string>>({})

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }, [users])

  useEffect(() => {
    if (session) {
      // Solo se persiste la sesión; el token viaja dentro de ella. El cliente API
      // (client.ts / withFallback.ts) lo lee vía getStoredToken().
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

  // Login contra el backend real (POST /auth/login). Si el backend no responde,
  // cae a la autenticación mock local (seedUsers) para no bloquear el prototipo.
  const login = useCallback<AuthContextValue['login']>(
    async (email, password) => {
      const correo = email.trim().toLowerCase()

      // 1) Intento real: guarda el token del backend para las llamadas a la API.
      try {
        const resp = await authApi.login(correo, password)
        if (resp?.token) {
          const seed = users.find((u) => u.email.toLowerCase() === correo)
          const role = resolveRole(resp.user?.rol, seed?.role)
          const user: User = {
            id: resp.user?.id != null ? String(resp.user.id) : (seed?.id ?? correo),
            nombre: resp.user?.nombres ?? seed?.nombre ?? correo,
            email: resp.user?.correo ?? correo,
            role,
            activo: true,
            ultimoAcceso: new Date().toISOString().slice(0, 10),
          }
          setSession({ user, token: resp.token, mock: false })
          return { ok: true }
        }
      } catch {
        // Backend no disponible o credenciales rechazadas → intentar mock abajo.
      }

      // 2) Fallback mock local.
      const found = users.find((u) => u.email.toLowerCase() === correo)
      if (!found) return { ok: false, error: 'No existe una cuenta con ese correo.' }
      if (!found.activo) return { ok: false, error: 'La cuenta está desactivada. Contacte al administrador.' }
      if (found.password !== password) return { ok: false, error: 'La contraseña es incorrecta.' }
      const { password: _pw, ...publicUser } = found
      const withAccess: User = { ...publicUser, ultimoAcceso: new Date().toISOString().slice(0, 10) }
      setUsers((prev) => prev.map((u) => (u.id === found.id ? { ...u, ultimoAcceso: withAccess.ultimoAcceso } : u)))
      setSession({ user: withAccess, token: fakeJwt(withAccess), mock: true })
      return { ok: true }
    },
    [users],
  )

  const logout = useCallback(() => setSession(null), [])

  const requestReset = useCallback<AuthContextValue['requestReset']>(
    (email) => {
      const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!found) return { ok: false, error: 'No existe una cuenta con ese correo.' }
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setResetTokens((prev) => ({ ...prev, [found.email.toLowerCase()]: code }))
      return { ok: true, token: code }
    },
    [users],
  )

  const resetPassword = useCallback<AuthContextValue['resetPassword']>(
    (email, token, newPassword) => {
      const key = email.trim().toLowerCase()
      if (resetTokens[key] !== token) return { ok: false, error: 'El código de verificación no es válido.' }
      if (newPassword.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
      setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === key ? { ...u, password: newPassword } : u)))
      setResetTokens((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return { ok: true }
    },
    [resetTokens],
  )

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
      token: session?.token ?? null,
      users: publicUsers,
      initializing,
      login, logout, requestReset, resetPassword, addUser, updateUser, removeUser,
    }),
    [session, publicUsers, initializing, login, logout, requestReset, resetPassword, addUser, updateUser, removeUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
