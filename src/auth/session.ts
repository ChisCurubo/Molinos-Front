// Perfil de sesión en localStorage (solo usuario/rol para pintar la UI).
// El token JWT ya NO se guarda aquí: viaja en una cookie httpOnly puesta por el backend,
// que el JavaScript de la página no puede leer. Los permisos reales los valida el backend.
export const SESSION_KEY = 'molinos_erp_session_v1'

/** Borra la sesión de localStorage (logout duro). */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

const KEEP_KEYS = ['molinos_erp_a11y_v1'] // preferencias de accesibilidad, no son datos de negocio

/** Borra sesión y todos los datos de negocio guardados en el navegador (logout / sesión vencida). */
export function clearLocalData(): void {
  try {
    Object.keys(localStorage).filter((k) => !KEEP_KEYS.includes(k)).forEach((k) => localStorage.removeItem(k))
    sessionStorage.clear()
  } catch { /* storage no disponible */ }
}
