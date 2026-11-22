// Modo de ejecución, detectado por el host desde el que se abre la app:
//   local  → mi PC o la red de la casa (localhost, 192.168.x, 10.x, 172.16-31.x, *.local)
//   oracle → servidor (sslip.io, IP pública o 10.0.1.20, que es la VM del front)
const host = typeof window === 'undefined' ? 'localhost' : window.location.hostname

const esPrivada = (h: string) =>
  h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.local') ||
  /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || (/^10\./.test(h) && h !== '10.0.1.20')

export const MODO: 'local' | 'oracle' = esPrivada(host) ? 'local' : 'oracle'

// Siempre relativa: en local la atiende el proxy de Vite y en Oracle el de Caddy,
// así no hay CORS y la cookie de sesión es del mismo sitio.
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1'

// Los datos de ejemplo solo son válidos desarrollando en local; en cualquier otro caso
// un fallo de la API debe verse como fallo, no como datos inventados.
export const MOCKS_PERMITIDOS = MODO === 'local' && import.meta.env.DEV

console.info(`[molinos] modo=${MODO} · api=${API_BASE}${MODO === 'local' ? ' → proxy a VITE_BACK_URL' : ''}`)
