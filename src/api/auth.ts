import { http } from './client'

export interface LoginResponse {
  token: string
  user?: {
    id: number
    nombres: string
    correo: string
    id_rol: number
    rol?: string
  }
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await http.post<{ success: boolean; data?: LoginResponse; token?: string; message?: string }>(
      '/auth/login',
      { username, password }
    )
    // Backend may return token at root or inside data
    const payload = res.data.data ?? (res.data as unknown as LoginResponse)
    if (!payload?.token) throw new Error(res.data.message ?? 'Credenciales inválidas')
    return payload
  },

  verify: async (): Promise<boolean> => {
    try {
      await http.get('/auth/verify')
      return true
    } catch {
      return false
    }
  },

  // Usuarios
  getUsuarios: () => http.get('/auth/usuarios').then(r => r.data.data),
  createUsuario: (body: { nombres: string; correo: string; contrasena: string; id_rol: number }) =>
    http.post('/auth/usuarios', body).then(r => r.data.data),
  updateUsuario: (id: number, body: unknown) =>
    http.put(`/auth/usuarios/${id}`, body).then(r => r.data.data),
  deleteUsuario: (id: number) =>
    http.delete(`/auth/usuarios/${id}`).then(r => r.data.data),
}
