import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { clearLocalData } from '@/auth/session'
import { emitToastWarning } from '@/utils/toastBus'

import { API_BASE as BASE, MODO } from '@/config/entorno'

// Servir la API por HTTP en Oracle expone la sesión a cualquiera en la misma red.
// Con la URL relativa por defecto (/api/v1) esto no sale; solo avisa si alguien fuerza
// un VITE_API_URL absoluto con http://.
if (MODO === 'oracle' && BASE.startsWith('http://')) {
  console.error(`[seguridad] VITE_API_URL usa HTTP sin cifrar en producción: ${BASE}`)
}

export const http = axios.create({ baseURL: BASE, timeout: 8000, withCredentials: true })

// Cada petición lleva su propio id: el backend lo respeta y lo pone en sus logs, así un
// error del usuario se rastrea de punta a punta (ver ESTANDAR_ERRORES.md del backend).
http.interceptors.request.use(cfg => {
  cfg.headers.set('X-Request-Id', crypto.randomUUID())
  return cfg
})

// Códigos del backend que significan "la sesión ya no sirve".
const CODES_SESION = new Set(['UNAUTHENTICATED', 'TOKEN_INVALID', 'TOKEN_EXPIRED', 'USER_INACTIVE'])

http.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const esLogin = err.config?.url?.includes('/auth/login')
    // En el propio login, 401/USER_INACTIVE es "credenciales incorrectas", no sesión vencida.
    if (!esLogin && (err.response?.status === 401 || (code && CODES_SESION.has(code)))) {
      clearLocalData()
      window.location.href = '/login'
    }
    // Un solo punto de log: método, ruta y el requestId para buscarlo en el servidor.
    const info = apiError(err)
    console.error(`[API ${err.config?.method?.toUpperCase()} ${err.config?.url}]`, info)
    return Promise.reject(err)
  }
)

function unwrap<T>(res: AxiosResponse<{ success: boolean; data?: T; message?: string }>): T {
  if (!res.data.success) throw new Error(res.data.message ?? 'Error del servidor')
  return res.data.data as T
}

export async function apiFetch<T>(url: string): Promise<T> {
  const res = await http.get<{ success: boolean; data?: T; message?: string }>(url)
  return unwrap(res)
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<{ success: boolean; data?: T; message?: string }>(url, body)
  return unwrap(res)
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<{ success: boolean; data?: T; message?: string }>(url, body)
  return unwrap(res)
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<{ success: boolean; data?: T; message?: string }>(url, body)
  return unwrap(res)
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await http.delete<{ success: boolean; data?: T; message?: string }>(url)
  return unwrap(res)
}

/**
 * POST/PUT/PATCH con comprobante: si hay archivo, manda multipart con el campo `datos` (el
 * mismo JSON de siempre) + el archivo bajo `fileField`; el backend lo sube a MinIO y guarda
 * esa URL. Sin archivo, manda el JSON normal de siempre (el backend ignora una URL escrita a
 * mano). Nunca se sube el archivo aparte ni se construye la URL en el front.
 */
async function withComprobante<T>(
  method: 'post' | 'put' | 'patch',
  url: string,
  body: object,
  file: File | null | undefined,
  fileField: string,
): Promise<T> {
  if (!file) return (method === 'post' ? apiPost : method === 'put' ? apiPut : apiPatch)<T>(url, body)
  const form = new FormData()
  form.append('datos', JSON.stringify(body))
  form.append(fileField, file)
  const res = await http[method]<{ success: boolean; data?: T; message?: string; advertencia?: string }>(url, form)
  // El registro se guardó pero el archivo no se pudo subir (almacenamiento caído):
  // seguimos sin romper el flujo, pero avisamos para que el usuario lo adjunte después.
  if (res.data.advertencia) emitToastWarning(res.data.advertencia)
  return unwrap(res)
}

export const apiPostComprobante = <T>(url: string, body: object, file?: File | null, fileField = 'comprobante') =>
  withComprobante<T>('post', url, body, file, fileField)
export const apiPutComprobante = <T>(url: string, body: object, file?: File | null, fileField = 'comprobante') =>
  withComprobante<T>('put', url, body, file, fileField)
export const apiPatchComprobante = <T>(url: string, body: object, file?: File | null, fileField = 'comprobante') =>
  withComprobante<T>('patch', url, body, file, fileField)

export const apiErrorMessage = (err: unknown): string => apiError(err).message

// Información de error enriquecida. El backend responde (ESTANDAR_ERRORES.md):
// `{ success:false, error, code, status, details?, requestId }`. `error` ya viene
// redactado para el usuario en 4xx y es genérico en 5xx.
export interface ApiErrorInfo {
  message: string
  code?: string
  status?: number
  /** Solo en VALIDATION_ERROR: un item por campo. */
  details?: { field: string; message: string }[]
  /** Referencia de soporte: el mismo id que está en el log del servidor. */
  requestId?: string
}

// Mensaje genérico por status cuando el backend no manda `error`/`message` en el body
// (por ejemplo un 500 que devuelve HTML, o el proxy/nginx respondiendo directo).
// Sirve de respaldo para que nunca se muestre "Network Error" ni un mensaje vacío,
// y para que el status por sí solo ya diga qué pasó al revisar logs/consola.
const STATUS_FALLBACK: Record<number, string> = {
  400: 'Datos inválidos. Revisa los campos del formulario.',
  401: 'Sesión vencida o credenciales inválidas. Inicia sesión de nuevo.',
  403: 'No tienes permiso para esta acción con tu rol actual.',
  404: 'No se encontró el recurso solicitado (¿fue borrado o el id cambió?).',
  409: 'Conflicto con el estado actual del registro (ver `code` para el detalle).',
  413: 'El archivo es demasiado grande (máx. 10MB).',
  422: 'El servidor no pudo procesar los datos enviados.',
  429: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  500: 'Error interno del servidor. Si persiste, revisa los logs del backend.',
  502: 'El backend no respondió (caído o reiniciándose).',
  503: 'Servicio no disponible por ahora. Intenta de nuevo en un momento.',
}

export function apiError(err: unknown): ApiErrorInfo {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const data = err.response?.data as
      { message?: string; error?: string; code?: string; details?: ApiErrorInfo['details']; requestId?: string } | undefined
    if (!err.response) {
      // Sin response = nunca llegó al servidor: timeout, backend caído o CORS.
      // `err.code` (ECONNABORTED, ERR_NETWORK, ...) queda en consola para depurar.
      const sinConexion = err.code === 'ECONNABORTED'
        ? 'La solicitud tardó demasiado (timeout). El servidor puede estar caído o lento.'
        : 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo.'
      return { message: sinConexion, status: undefined, code: err.code }
    }
    const requestId = data?.requestId ?? (err.response.headers?.['x-request-id'] as string | undefined)
    const details = data?.details
    let message = data?.error ?? data?.message ?? STATUS_FALLBACK[status ?? 0] ?? err.message
    // VALIDATION_ERROR: el toast muestra qué campo falló (no hay forms que pinten cada campo).
    if (details?.length) message += ` (${details.map(d => `${d.field}: ${d.message}`).join('; ')})`
    // 5xx: el texto es genérico a propósito; la referencia permite al soporte hallar el stack.
    if ((status ?? 0) >= 500 && requestId) message += ` Código de referencia: ${requestId}`
    return { message, code: data?.code, status, details, requestId }
  }
  return { message: err instanceof Error ? err.message : 'Error desconocido' }
}
