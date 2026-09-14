// Única fuente de verdad de la sesión en localStorage.
// Solo se guarda la sesión (usuario + token); el token NO se duplica en otra clave.
export const SESSION_KEY = 'molinos_erp_session_v1'

/** Lee el token JWT desde la sesión persistida (o null si no hay sesión). */
export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string } | null
    return parsed?.token ?? null
  } catch {
    return null
  }
}

/** Borra la sesión de localStorage (logout duro). */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
