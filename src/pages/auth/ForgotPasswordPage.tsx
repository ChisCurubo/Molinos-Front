import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, Send } from 'lucide-react'
import { Button, Input, InfoCallout } from '@/components/ui'
import { authApi } from '@/api/auth'
import { apiErrorMessage } from '@/api/client'
import './auth.css'

export function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('Escriba su usuario.'); return }
    setLoading(true)
    try {
      await authApi.forgotPassword(username.trim().toLowerCase())
      setSent(true)
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
        <h1 className="auth__brand-title">Recuperar acceso</h1>
        <p className="auth__brand-text">Le enviaremos un enlace para restablecer su contraseña.</p>
      </div>

      <div className="auth__form-side">
        <form className="auth__card" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth__heading">¿Olvidó su contraseña?</h2>
            <p className="auth__sub">Escriba su usuario y le enviaremos las instrucciones.</p>
          </div>

          <Input
            label="Usuario"
            autoComplete="username"
            placeholder="nombre@molinosdecolombia.com"
            icon={<AtSign size={20} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={error || undefined}
            disabled={sent}
            required
          />

          {sent ? (
            <InfoCallout>
              Si el usuario existe, recibirá las instrucciones para restablecer su contraseña.
            </InfoCallout>
          ) : (
            <Button type="submit" size="lg" block icon={<Send size={20} />} disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
          )}

          <div className="auth__row-between">
            <Link to="/login" className="auth__link">← Volver a iniciar sesión</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
