import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AtSign, KeyRound, Lock, CheckCircle2 } from 'lucide-react'
import { Button, Input, InfoCallout } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import './auth.css'

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (pw1 !== pw2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    const res = resetPassword(email, code, pw1)
    if (res.ok) setDone(true)
    else setError(res.error ?? 'No fue posible restablecer la contraseña.')
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <img src="/logo-molinos.png" alt="Molinos de Colombia S.A.S" className="auth__logo" />
        <h1 className="auth__brand-title">Nueva contraseña</h1>
        <p className="auth__brand-text">Ingrese el código de verificación y defina su nueva contraseña.</p>
      </div>

      <div className="auth__form-side">
        {done ? (
          <div className="auth__card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <CheckCircle2 size={56} color="var(--emerald-500)" />
            <h2 className="auth__heading">Contraseña actualizada</h2>
            <p className="auth__sub">Ya puede iniciar sesión con su nueva contraseña.</p>
            <Button size="lg" block onClick={() => navigate('/login')}>
              Ir a iniciar sesión
            </Button>
          </div>
        ) : (
          <form className="auth__card" onSubmit={onSubmit} noValidate>
            <div>
              <h2 className="auth__heading">Restablecer contraseña</h2>
              <p className="auth__sub">Complete los datos para definir una nueva contraseña.</p>
            </div>

            <Input
              label="Correo electrónico"
              type="email"
              icon={<AtSign size={20} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Código de verificación"
              icon={<KeyRound size={20} />}
              mono
              placeholder="6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="Nueva contraseña"
              type="password"
              icon={<Lock size={20} />}
              helper="Mínimo 6 caracteres"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              required
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              icon={<Lock size={20} />}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              error={error || undefined}
              required
            />

            <Button type="submit" size="lg" block>
              Guardar nueva contraseña
            </Button>

            <InfoCallout>Si no recibió el código, puede solicitarlo nuevamente desde la pantalla anterior.</InfoCallout>

            <div className="auth__row-between">
              <Link to="/login" className="auth__link">
                ← Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
