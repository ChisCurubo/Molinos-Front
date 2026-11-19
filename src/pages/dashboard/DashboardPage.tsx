import { useNavigate } from 'react-router-dom'
import {
  Anchor, ArrowRight, BarChart3, Boxes, CalendarDays, CircleDollarSign, Coins, Contrast,
  CreditCard, Droplets, FileBarChart2, FlaskConical, HandCoins, Handshake,
  Landmark, Layers, Mountain, Package, Send, Ship, Truck, Type,
  Users2, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useA11y } from '@/context/AccessibilityContext'
import { canView, type ModuleKey } from '@/auth/permissions'
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

interface DashArea {
  label: string
  icon: LucideIcon
  cards: DashCard[]
}

const AREAS: DashArea[] = [
  {
    label: 'Materiales',
    icon: Boxes,
    cards: [
      { module: 'materiales', to: '/materiales/entradas-api',          title: 'Entradas de material',   desc: 'Registre llegadas, peso húmedo y datos de mina.',         icon: Package,       variant: 'brown'   },
      { module: 'materiales', to: '/materiales/analisis-api',          title: 'Análisis / Laboratorio', desc: 'Humedad, tenor y control de calidad por lote.',           icon: FlaskConical,  variant: 'emerald' },
      { module: 'materiales', to: '/materiales/procesamiento-api',     title: 'Procesamiento',          desc: 'Lotes en proceso, concentrado y maquila.',               icon: Layers,        variant: 'info'    },
      { module: 'materiales', to: '/materiales/inventario-api',        title: 'Inventario material',    desc: 'Crudo pendiente y concentrado disponible en canoa.',     icon: Package,       variant: ''        },
      { module: 'materiales', to: '/materiales/viajes-material-api',   title: 'Viajes de mineral',      desc: 'Despachos de concentrado y costos de maquila.',          icon: Send,          variant: 'brown'   },
      { module: 'materiales', to: '/materiales/viajes-agua-api',       title: 'Viajes de agua',         desc: 'Vehículos cisterna, cantidad de viajes y ACPM.',         icon: Droplets,      variant: 'info'    },
      { module: 'materiales', to: '/materiales/volquetas-api',         title: 'Volquetas y pagos',      desc: 'Dueños, llegadas de material y control de fletes.',      icon: Truck,         variant: 'emerald' },
      { module: 'materiales', to: '/materiales/catalogos-api',         title: 'Catálogos y tarifas',    desc: 'Zonas, mineros, precios de material y tarifas de flete.', icon: Mountain,     variant: ''        },
    ],
  },
  {
    label: 'Finanzas',
    icon: Coins,
    cards: [
      { module: 'finanzas', to: '/finanzas/cxp-api',       title: 'Cuentas por pagar',     desc: 'Pagos pendientes, proveedores y órdenes de pago.',   icon: Wallet,      variant: ''        },
      { module: 'finanzas', to: '/finanzas/cxc-api',       title: 'Cuentas por cobrar',    desc: 'Facturas emitidas, cobros pendientes y abonos.',     icon: CreditCard,  variant: 'emerald' },
      { module: 'finanzas', to: '/finanzas/prestamos-api', title: 'Préstamos financieros', desc: 'Créditos activos, cuotas y estado de deudas.',       icon: Landmark,    variant: 'brown'   },
      { module: 'finanzas', to: '/finanzas/tesoreria-api',  title: 'Informes financieros',  desc: 'Flujo de caja, balances y reportes contables.',      icon: BarChart3,   variant: 'info'    },
    ],
  },
  {
    label: 'Nómina',
    icon: Users2,
    cards: [
      { module: 'nomina', to: '/nomina',            title: 'Nómina y empleados',   desc: 'Liquidación de quincenas, préstamos a empleados.',  icon: HandCoins,    variant: ''      },
      { module: 'nomina', to: '/nomina/calendario', title: 'Calendario de turnos', desc: 'Asignación de turnos y control de asistencia.',     icon: CalendarDays, variant: 'brown' },
      { module: 'nomina', to: '/nomina/informes',   title: 'Informes de nómina',   desc: 'Resúmenes de pago y reportes por período.',         icon: BarChart3,    variant: 'info'  },
    ],
  },
  {
    label: 'Importaciones',
    icon: Ship,
    cards: [
      { module: 'importaciones', to: '/importaciones',             title: 'Importaciones',   desc: 'Seguimiento de pedidos e insumos importados.',               icon: Ship,             variant: ''        },
      { module: 'importaciones', to: '/importaciones/puerto',      title: 'Gastos de puerto', desc: 'Almacenaje, demoras y costos de dejar la carga en puerto.', icon: Anchor,           variant: 'brown'   },
      { module: 'importaciones', to: '/importaciones/transfigura', title: 'Transfigura',      desc: 'Pagos que recibimos de nuestro cliente Transfigura.',       icon: Handshake,        variant: 'emerald' },
      { module: 'importaciones', to: '/importaciones/adelantos',   title: 'Adelantos',        desc: 'Anticipos entregados relacionados con importaciones.',      icon: CircleDollarSign, variant: 'info'    },
      { module: 'importaciones', to: '/importaciones/regalias',    title: 'Regalías',         desc: 'Regalías mineras liquidadas y pagadas a la ANM.',            icon: Landmark,         variant: ''        },
    ],
  },
  {
    label: 'Informes',
    icon: FileBarChart2,
    cards: [
      { module: 'powerbi', to: '/informes',            title: 'Power BI',              desc: 'Dashboards gerenciales embebidos en tiempo real.',   icon: BarChart3,     variant: 'info' },
      { module: 'powerbi', to: '/powerbi/generador',   title: 'Generador de informes', desc: 'Crear y exportar reportes personalizados.',         icon: FileBarChart2, variant: ''     },
    ],
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cycleFontStep, toggleContrast, highContrast } = useA11y()
  if (!user) return null

  if (user.role === 'administrador') return <AdminDashboard />

  // Áreas y cards visibles para este rol
  const areasVisibles = AREAS.map(area => ({
    ...area,
    cards: area.cards.filter(c => canView(user.role, c.module)),
  })).filter(area => area.cards.length > 0)

  return (
    <div className="page">
      <div className="dash-hero">
        <div>
          <h1 className="dash-hero__title">Hola, {user.nombre} 👋</h1>
          <p className="dash-hero__sub">Bienvenida al sistema de gestión de Molinos de Colombia.</p>
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

      {/* Cards agrupadas por área */}
      {areasVisibles.map(area => (
        <div className="dash-area" key={area.label}>
          <div className="dash-area__head">
            <area.icon size={20} />
            {area.label}
          </div>
          <div className="dash-cards">
            {area.cards.map(c => {
              const Icon = c.icon
              return (
                <button
                  key={c.to}
                  className="dash-card"
                  onClick={() => navigate(c.to)}
                  aria-label={`Ir a ${c.title}`}
                >
                  <span className={`dash-card__icon ${c.variant ? `dash-card__icon--${c.variant}` : ''}`}>
                    <Icon size={26} aria-hidden="true" />
                  </span>
                  <span className="dash-card__title">{c.title}</span>
                  <span className="dash-card__desc">{c.desc}</span>
                  <span className="dash-card__cta">Abrir <ArrowRight size={15} /></span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
