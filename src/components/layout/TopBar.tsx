import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { ROLES } from '@/auth/permissions'
import { AccessibilityMenu } from './AccessibilityMenu'

interface TopBarProps {
  onToggleMenu: () => void
}

export function TopBar({ onToggleMenu }: TopBarProps) {
  const { user, logout } = useAuth()
  if (!user) return null
  const initial = user.nombre.charAt(0).toUpperCase()

  return (
    <header className="topbar">
      <Button
        className="menu-toggle"
        variant="ghost"
        size="sm"
        icon={<Menu size={22} />}
        aria-label="Abrir menú de navegación"
        onClick={onToggleMenu}
      />
      <img src="/logo-molinos.png" alt="Molinos de Colombia S.A.S" className="topbar__logo" />
      <div className="topbar__brand">
        <span className="topbar__brand-name">Molinos de Colombia</span>
        <span className="topbar__brand-sub">Procesamiento de minerales</span>
      </div>

      <div className="spacer" />

      <AccessibilityMenu />

      <div className="topbar__user">
        <span className="topbar__user-name">{user.nombre}</span>
        <span className="topbar__user-role">{ROLES[user.role].label}</span>
      </div>
      <span className="topbar__avatar" aria-hidden="true">{initial}</span>
      <Button
        className="topbar__logout"
        variant="ghost"
        size="sm"
        icon={<LogOut size={20} />}
        aria-label="Cerrar sesión"
        onClick={logout}
      />
    </header>
  )
}
