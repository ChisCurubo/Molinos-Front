import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Coins, Contrast, Droplets, Package, Truck, Type, Users2, Wallet,
} from 'lucide-react'
import { Button, KpiTile } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useA11y } from '@/context/AccessibilityContext'
import { canView, type ModuleKey } from '@/auth/permissions'
import { formatCOP, formatTon } from '@/utils/format'
import type { LucideIcon } from 'lucide-react'
import { AdminDashboard } from './AdminDashboard'
import './dashboard.css'

interface DashCard {
  module: ModuleKey
  to: string
  title: string
  desc: string
  icon: LucideIcon
  variant: '' | 'brown' | 'emerald' | 'info'
}

const CARDS: DashCard[] = [
  { module: 'materiales', to: '/materiales/volquetas', title: 'Inventario y materiales', desc: 'Volquetas, minas, mineros y catálogos base.', icon: Boxes, variant: '' },
  { module: 'materiales', to: '/materiales/entradas', title: 'Materiales de llegada', desc: 'Registre entradas de material y análisis de laboratorio.', icon: Package, variant: 'brown' },
  { module: 'materiales', to: '/materiales/viajes', title: 'Viajes de agua', desc: 'Controle los viajes de vehículos cisterna.', icon: Droplets, variant: 'info' },
  { module: 'finanzas', to: '/finanzas', title: 'Pagos y finanzas', desc: 'Cuentas por pagar y cobrar, préstamos y alquileres.', icon: Coins, variant: 'emerald' },
  { module: 'nomina', to: '/nomina', title: 'Nómina y turnos', desc: 'Empleados, turnos, asistencias y liquidación.', icon: Users2, variant: 'brown' },
  { module: 'powerbi', to: '/informes', title: 'Módulo Power BI', desc: 'Informes gerenciales embebidos.', icon: BarChart3, variant: 'info' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { entradas, viajesAgua, porPagar, empleados } = useData()
  const { cycleFontStep, toggleContrast, highContrast } = useA11y()
  if (!user) return null

  // El administrador tiene un panel resumen propio.
  if (user.role === 'administrador') return <AdminDashboard />

  const visibleCards = CARDS.filter((c) => canView(user.role, c.module))
  const totalTon = entradas.reduce((s, e) => s + (e.toneladasSecas ?? e.pesoBrutoTon), 0)
  const pendientesPago = porPagar.filter((p) => p.estado === 'pendiente').reduce((s, p) => s + p.monto, 0)

  return (
    <div className="page">
      <div className="dash-hero">
        <div>
          <h1 className="dash-hero__title">Hola, {user.nombre} 👋</h1>
          <p className="dash-hero__sub">Bienvenido al sistema de gestión de Molinos de Colombia.</p>
        </div>
        <div className="dash-a11y" role="group" aria-label="Accesibilidad rápida">
          <Button variant="secondary" icon={<Type size={18} />} onClick={cycleFontStep}>
            Tamaño de letra
          </Button>
          <Button
            variant={highContrast ? 'primary' : 'secondary'}
            icon={<Contrast size={18} />}
            aria-pressed={highContrast}
            onClick={toggleContrast}
          >
            Alto contraste
          </Button>
        </div>
      </div>

      <div className="grid grid--kpi">
        <KpiTile label="Material procesado" value={formatTon(totalTon)} hint="Toneladas secas acumuladas" icon={<Boxes size={16} />} accent="green" />
        <KpiTile label="Entradas registradas" value={entradas.length} hint="Materiales de llegada" icon={<Package size={16} />} accent="brown" />
        <KpiTile label="Viajes de agua" value={viajesAgua.length} hint="Vehículos cisterna" icon={<Truck size={16} />} accent="emerald" />
        <KpiTile label="Pendiente por pagar" value={formatCOP(pendientesPago)} hint={`${empleados.length} empleados activos`} icon={<Wallet size={16} />} accent="rose" />
      </div>

      <h2 className="dash-section-title">Accesos rápidos</h2>
      <div className="dash-cards">
        {visibleCards.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.to}
              className="dash-card"
              onClick={() => navigate(c.to)}
              aria-label={`Ir a ${c.title}`}
            >
              <span className={`dash-card__icon ${c.variant ? `dash-card__icon--${c.variant}` : ''}`}>
                <Icon size={28} aria-hidden="true" />
              </span>
              <span className="dash-card__title">{c.title}</span>
              <span className="dash-card__desc">{c.desc}</span>
              <span className="dash-card__cta">
                Abrir <ArrowRight size={16} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
