import { http } from './client'

export interface LoginResponse {
  // El token ya no viaja en el body: el backend lo pone en una cookie httpOnly.
  // Shape real confirmado en vivo contra el backend (2026-10-31): el usuario
  // viene en `usuario` (no `user`) y el rol es un objeto anidado — no un
  // string plano. `id_rol`/`usuario.id_rol` es el campo confiable para
  // mapear al Role del front (ver resolveRole en AuthContext.tsx); el
  // nombre humano (`rol.nombre`, ej. "Angela_exportaciones") es solo para
  // mostrar, no para parsear.
  usuario?: {
    id: number
    username: string
    id_rol: number
    id_empleado?: number | null
    activo: number | boolean
    // Nombre del flag por confirmar con backend: fuerza POST /auth/change-password tras el login.
    debe_cambiar_password?: boolean | number
    rol?: { id: number; nombre: string; descripcion?: string }
  }
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await http.post<{ success: boolean; data?: LoginResponse; message?: string }>(
      '/auth/login',
      { username, password }
    )
    const payload = res.data.data ?? (res.data as unknown as LoginResponse)
    if (!payload?.usuario) throw new Error(res.data.message ?? 'Credenciales inválidas')
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

  logout: () => http.post('/auth/logout').catch(() => undefined),
  // Respuesta siempre igual (no revela si el usuario existe).
  forgotPassword: (username: string) => http.post('/auth/forgot-password', { username }).then(r => r.data),
  resetPassword: (token: string, nuevaPassword: string) =>
    http.post('/auth/reset-password', { token, nuevaPassword }).then(r => r.data),
  changePassword: (actual: string, nueva: string) =>
    http.post('/auth/change-password', { actual, nueva }).then(r => r.data),

  // Usuarios
  getUsuarios: () => http.get('/auth/usuarios').then(r => r.data.data),
  createUsuario: (body: { nombres: string; correo: string; contrasena: string; id_rol: number }) =>
    http.post('/auth/usuarios', body).then(r => r.data.data),
  updateUsuario: (id: number, body: unknown) =>
    http.put(`/auth/usuarios/${id}`, body).then(r => r.data.data),
  deleteUsuario: (id: number) =>
    http.delete(`/auth/usuarios/${id}`).then(r => r.data.data),
}
