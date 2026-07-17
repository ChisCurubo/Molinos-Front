import axios, { type AxiosError, type AxiosResponse } from 'axios'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3005/api/v1'

export const http = axios.create({ baseURL: BASE, timeout: 8000 })

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

http.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
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

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string })?.message
    return msg ?? err.message
  }
  return err instanceof Error ? err.message : 'Error desconocido'
}
