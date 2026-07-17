import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AtSign, Send } from 'lucide-react'
import { Button, Input, InfoCallout } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import './auth.css'

export function ForgotPasswordPage() {
  const { requestReset } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [code, setCode] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const res = requestReset(email)
    if (res.ok) setCode(res.token ?? null)
    else setError(res.error ?? 'No fue posible generar el código.')
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <img src="/logo-molinos.png" alt="Molinos de Colombia S.A.S" className="auth__logo" />
        <h1 className="auth__brand-title">Recuperar acceso</h1>
        <p className="auth__brand-text">Le enviaremos un código de verificación para restablecer su contraseña.</p>
      </div>

      <div className="auth__form-side">
        <form className="auth__card" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth__heading">¿Olvidó su contraseña?</h2>
            <p className="auth__sub">Escriba su correo y le generaremos un código de verificación.</p>
          </div>

          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="nombre@molinosdecolombia.com"
            icon={<AtSign size={20} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
            required
          />

          {code ? (
            <>
              <InfoCallout>
                Código de verificación generado (simulado). En producción llegaría al correo. Su código es:{' '}
                <strong className="mono">{code}</strong>
              </InfoCallout>
              <Button
                size="lg"
                block
                onClick={() => navigate(`/restablecer?email=${encodeURIComponent(email)}`)}
              >
                Continuar al restablecimiento
              </Button>
            </>
          ) : (
            <Button type="submit" size="lg" block icon={<Send size={20} />}>
              Enviar código
            </Button>
          )}

          <div className="auth__row-between">
            <Link to="/login" className="auth__link">
              ← Volver a iniciar sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
