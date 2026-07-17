import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import './layout.css'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar onToggleMenu={() => setMenuOpen((v) => !v)} />
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div
        className={`sidebar-backdrop ${menuOpen ? 'sidebar-backdrop--open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
