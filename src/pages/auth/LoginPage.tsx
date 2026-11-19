import { useState, type FormEvent } from 'react'
import { ArrowLeft, Calculator, Droplets, Settings2, Ship } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button, Input } from '@/components/ui'
import './auth.css'

interface ModuloDef {
  id: string
  label: string
  sub: string
  icon: typeof Settings2
  color: 'green' | 'info' | 'amber' | 'brown'
  email: string
  to: string
}

const MODULOS: ModuloDef[] = [
  { id: 'admin',    label: 'ADMIN',    sub: 'David — Panel completo', icon: Settings2,  color: 'green', email: 'david@molinosdecolombia.com',   to: '/' },
  { id: 'victoria', label: 'VICTORIA', sub: 'Módulo de agua',         icon: Droplets,   color: 'info',  email: 'vicky@molinosdecolombia.com',   to: '/' },
  { id: 'juliana',  label: 'JULIANA',  sub: 'Costos y maquila',       icon: Calculator, color: 'amber', email: 'juliana@molinosdecolombia.com', to: '/' },
  { id: 'angela',   label: 'ANGELA',   sub: 'Importaciones',          icon: Ship,       color: 'brown', email: 'angela@molinosdecolombia.com',  to: '/' },
]

type Mode = 'cards' | 'form'

export function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()

  const [mode, setMode]       = useState<Mode>('cards')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState('')

  // Form mode state
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')

  // ── Card mode: click selecciona el usuario y pasa al formulario para pedir la contraseña ──
  const handleCardSelect = (m: ModuloDef) => {
    setError('')
    setEmail(m.email)
    setPassword('')
    setMode('form')
  }

  // ── Form mode: login con email + contraseña ──
  const handleFormLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completa todos los campos.'); return }
    setLoading('form')
    const res = await login(email.trim().toLowerCase(), password)
    setLoading(null)
    if (res.ok) {
      // Detectar módulo por email
      const modulo = MODULOS.find((m) => m.email === email.trim().toLowerCase())
      localStorage.setItem('modulo', modulo?.id ?? 'admin')
      navigate(modulo?.to ?? '/', { replace: true })
    } else {
      setError(res.error ?? 'Correo o contraseña incorrectos.')
    }
  }

  const isBusy = loading !== null

  return (
    <main className="auth">
      {/* Lado izquierdo — branding */}
      <div className="auth__brand">
        <img src="/logo-molinos.png" alt="Molinos de Colombia S.A.S" className="auth__logo" />
        <h1 className="auth__brand-title">Molinos de Colombia S.A.S</h1>
        <p className="auth__brand-text">
          Sistema de gestión para el procesamiento de minerales. Seleccione su módulo para continuar.
        </p>
      </div>

      {/* Lado derecho — formulario */}
      <div className="auth__form-side">
        <div className="auth__card">

          {/* ══ MODO CARDS ══ */}
          {mode === 'cards' && (
            <>
              <div>
                <h2 className="auth__heading">Seleccionar usuario</h2>
                <p className="auth__sub">Haga clic en su usuario y luego ingrese su contraseña.</p>
              </div>

              <div className="auth__modules">
                {MODULOS.map((m) => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.id}
                      className={`auth__mod-card auth__mod-card--${m.color}`}
                      onClick={() => handleCardSelect(m)}
                    >
                      <span className={`auth__mod-icon auth__mod-icon--${m.color}`}>
                        <Icon size={24} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="auth__mod-label">{m.label}</span>
                        <span className="auth__mod-sub">{m.sub}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {error && (
                <p role="alert" style={{ color: 'var(--rose-700)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                  {error}
                </p>
              )}

              <div className="auth__divider">o</div>

              <button className="auth__toggle-btn" onClick={() => { setMode('form'); setError('') }}>
                Acceder con correo y contraseña →
              </button>
            </>
          )}

          {/* ══ MODO FORMULARIO ══ */}
          {mode === 'form' && (
            <>
              <div>
                <button className="auth__back-btn" onClick={() => { setMode('cards'); setError('') }}>
                  <ArrowLeft size={15} /> Seleccionar módulo
                </button>
                <h2 className="auth__heading">Iniciar sesión</h2>
                <p className="auth__sub">Ingresa tu correo y contraseña.</p>
              </div>

              <form className="auth__form" onSubmit={handleFormLogin}>
                <Input
                  label="Usuario"
                  type="text"
                  placeholder="david@molinosdecolombia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={!email}
                />
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={!!email}
                />

                {error && (
                  <p role="alert" style={{ color: 'var(--rose-700)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={isBusy} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading === 'form' ? 'Ingresando…' : 'Ingresar'}
                </Button>
              </form>

              <div className="auth__divider">o</div>

              <button className="auth__toggle-btn" onClick={() => { setMode('cards'); setError('') }}>
                ← Seleccionar usuario
              </button>
            </>
          )}

        </div>
      </div>
    </main>
  )
}
