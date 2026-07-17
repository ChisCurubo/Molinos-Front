// Cliente HTTP con fallback automático a datos mock cuando la API no responde

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

export async function apiFetch<T>(url: string, mockData: T): Promise<T> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${BASE}${url}`, { headers: authHeaders(), signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return mockData
    const data = await res.json() as T | { data: T }
    if (data && typeof data === 'object' && 'data' in data) return (data as { data: T }).data
    return data as T
  } catch {
    return mockData
  }
}

export async function apiPost<T>(url: string, body: unknown, onMock?: (b: unknown) => T): Promise<T> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${BASE}${url}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error('api-error')
    return (await res.json()) as T
  } catch {
    if (onMock) return onMock(body)
    return { ok: true, mock: true, ...(body as object) } as T
  }
}
