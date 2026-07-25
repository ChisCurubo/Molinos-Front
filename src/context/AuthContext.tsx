import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@/types'
import { seedUsers } from '@/data/seed'

interface StoredUser extends User {
  password: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  users: User[]
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  requestReset: (email: string) => { ok: boolean; token?: string; error?: string }
  resetPassword: (email: string, token: string, newPassword: string) => { ok: boolean; error?: string }
  addUser: (u: Omit<StoredUser, 'id'>) => void
  updateUser: (id: string, patch: Partial<StoredUser>) => void
  removeUser: (id: string) => void
}

const USERS_KEY = 'molinos_erp_users_v1'
const SESSION_KEY = 'molinos_erp_session_v1'

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

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>(loadUsers)
  const [session, setSession] = useState<{ user: User; token: string } | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  // tokens de restablecimiento activos (email -> código)
  const [resetTokens, setResetTokens] = useState<Record<string, string>>({})

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }, [users])

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  const publicUsers = useMemo<User[]>(
    () => users.map(({ password: _pw, ...u }) => u),
    [users],
  )

  const login = useCallback<AuthContextValue['login']>(
    async (email, password) => {
      await new Promise((r) => setTimeout(r, 350))
      const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!found) return { ok: false, error: 'No existe una cuenta con ese correo.' }
      if (!found.activo) return { ok: false, error: 'La cuenta está desactivada. Contacte al administrador.' }
      if (found.password !== password) return { ok: false, error: 'La contraseña es incorrecta.' }
      const { password: _pw, ...publicUser } = found
      const withAccess: User = { ...publicUser, ultimoAcceso: new Date().toISOString().slice(0, 10) }
      setUsers((prev) => prev.map((u) => (u.id === found.id ? { ...u, ultimoAcceso: withAccess.ultimoAcceso } : u)))
      setSession({ user: withAccess, token: fakeJwt(withAccess) })
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
      login, logout, requestReset, resetPassword, addUser, updateUser, removeUser,
    }),
    [session, publicUsers, login, logout, requestReset, resetPassword, addUser, updateUser, removeUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
