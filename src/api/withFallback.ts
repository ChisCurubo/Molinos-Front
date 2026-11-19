// Cliente HTTP con fallback a datos mock cuando la API no responde.
// El fallback SOLO existe en desarrollo local (MOCKS_PERMITIDOS); en cualquier otro caso
// el error se propaga para que la pantalla muestre el fallo en vez de datos inventados.
import { API_BASE as BASE, MOCKS_PERMITIDOS } from '@/config/entorno'

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

export async function apiFetch<T>(url: string, mockData: T): Promise<T> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${BASE}${url}`, { headers: authHeaders(), credentials: 'include', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`api-error ${res.status}`)
    const data = await res.json() as T | { data: T }
    if (data && typeof data === 'object' && 'data' in data) return (data as { data: T }).data
    return data as T
  } catch (e) {
    if (MOCKS_PERMITIDOS) return mockData
    throw e
  }
}

export async function apiPost<T>(url: string, body: unknown, onMock?: (b: unknown) => T): Promise<T> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${BASE}${url}`, {
      method: 'POST',
      headers: authHeaders(), credentials: 'include',
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`api-error ${res.status}`)
    return (await res.json()) as T
  } catch (e) {
    if (!MOCKS_PERMITIDOS) throw e
    if (onMock) return onMock(body)
    return { ok: true, mock: true, ...(body as object) } as T
  }
}
