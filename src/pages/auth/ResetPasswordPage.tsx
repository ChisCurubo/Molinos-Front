import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, CheckCircle2 } from 'lucide-react'
import { Button, Input, InfoCallout } from '@/components/ui'
import { authApi } from '@/api/auth'
import { apiErrorMessage } from '@/api/client'
import './auth.css'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (pw1.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pw1 !== pw2) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, pw1)
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <img src="/logo-molinos.png" alt="Molinos de Colombia S.A.S" className="auth__logo" />
        <h1 className="auth__brand-title">Nueva contraseña</h1>
        <p className="auth__brand-text">Defina su nueva contraseña para volver a ingresar.</p>
      </div>

      <div className="auth__form-side">
        {done ? (
          <div className="auth__card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <CheckCircle2 size={56} color="var(--emerald-500)" />
            <h2 className="auth__heading">Contraseña actualizada</h2>
            <p className="auth__sub">Ya puede iniciar sesión con su nueva contraseña.</p>
            <Button size="lg" block onClick={() => navigate('/login')}>Ir a iniciar sesión</Button>
          </div>
        ) : !token ? (
          <div className="auth__card">
            <InfoCallout>El enlace no es válido o está incompleto. Solicite uno nuevo.</InfoCallout>
            <Link to="/recuperar" className="auth__link">Solicitar un enlace nuevo</Link>
          </div>
        ) : (
          <form className="auth__card" onSubmit={onSubmit} noValidate>
            <div>
              <h2 className="auth__heading">Restablecer contraseña</h2>
              <p className="auth__sub">Elija una contraseña de al menos 8 caracteres.</p>
            </div>
            <Input label="Nueva contraseña" type="password" autoComplete="new-password" icon={<Lock size={20} />}
              value={pw1} onChange={(e) => setPw1(e.target.value)} required />
            <Input label="Confirmar nueva contraseña" type="password" autoComplete="new-password" icon={<Lock size={20} />}
              value={pw2} onChange={(e) => setPw2(e.target.value)} error={error || undefined} required />
            <Button type="submit" size="lg" block disabled={loading}>{loading ? 'Guardando…' : 'Guardar nueva contraseña'}</Button>
            <div className="auth__row-between">
              <Link to="/login" className="auth__link">← Volver a iniciar sesión</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
