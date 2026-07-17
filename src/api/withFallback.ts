import { apiFetch as _fetch, apiPost as _post, apiPut as _put, apiDelete as _del } from './client'

export async function apiFetch<T>(url: string, mockData: T): Promise<T> {
  try {
    return await _fetch<T>(url)
  } catch {
    return mockData
  }
}

export async function apiPost<T>(url: string, body: unknown, onMock?: (b: unknown) => T): Promise<T> {
  try {
    return await _post<T>(url, body)
  } catch {
    if (onMock) return onMock(body)
    return { ok: true, mock: true, ...(body as object) } as T
  }
}

export async function apiPut<T>(url: string, body: unknown, onMock?: (b: unknown) => T): Promise<T> {
  try {
    return await _put<T>(url, body)
  } catch {
    if (onMock) return onMock(body)
    return { ok: true, mock: true, ...(body as object) } as T
  }
}

export async function apiDelete<T>(url: string, onMock?: () => T): Promise<T> {
  try {
    return await _del<T>(url)
  } catch {
    if (onMock) return onMock()
    return { ok: true, mock: true } as T
  }
}
