import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Button, Input, InfoCallout } from '@/components/ui'
import { authApi } from '@/api/auth'
import { apiErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import './auth.css'

/** Cambio de contraseña: obligatorio tras un login con contraseña temporal, o voluntario
 * desde el menú de usuario en cualquier momento. */
export function ChangePasswordPage() {
  const { user, mustChangePassword, clearMustChange, logout } = useAuth()
  const navigate = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [nueva2, setNueva2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== nueva2) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      await authApi.changePassword(actual, nueva)
      if (mustChangePassword) clearMustChange()
      navigate('/', { replace: true })
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
        <h1 className="auth__brand-title">Cambie su contraseña</h1>
        <p className="auth__brand-text">{mustChangePassword
          ? 'Por seguridad debe definir una contraseña personal antes de continuar.'
          : 'Defina una contraseña nueva cuando quiera.'}</p>
      </div>
      <div className="auth__form-side">
        <form className="auth__card" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth__heading">Nueva contraseña</h2>
            <p className="auth__sub">Escriba la contraseña actual y elija una nueva.</p>
          </div>
          <Input label="Contraseña actual" type="password" autoComplete="current-password" icon={<Lock size={20} />}
            value={actual} onChange={(e) => setActual(e.target.value)} required />
          <Input label="Nueva contraseña" type="password" autoComplete="new-password" icon={<Lock size={20} />}
            helper="Mínimo 8 caracteres" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
          <Input label="Confirmar nueva contraseña" type="password" autoComplete="new-password" icon={<Lock size={20} />}
            value={nueva2} onChange={(e) => setNueva2(e.target.value)} error={error || undefined} required />
          <Button type="submit" size="lg" block disabled={loading}>{loading ? 'Guardando…' : 'Guardar y continuar'}</Button>
          {mustChangePassword ? (
            <>
              <InfoCallout>Si no es usted, cierre la sesión.</InfoCallout>
              <button type="button" className="auth__link" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cerrar sesión</button>
            </>
          ) : (
            <button type="button" className="auth__link" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>← Cancelar</button>
          )}
        </form>
      </div>
    </div>
  )
}
