import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, CalendarDays, Coins, Contrast,
  CreditCard, Droplets, FileBarChart2, FlaskConical, HandCoins,
  Landmark, Layers, Mountain, Package, Send, Truck, Type,
  Users2, Wallet,
} from 'lucide-react'
import { Button, KpiTile } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useMateriales } from '@/context/MaterialesContext'
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
      { module: 'materiales', to: '/materiales',                   title: 'Panel de materiales',    desc: 'Resumen general, indicadores y acceso rápido.',           icon: Boxes,         variant: ''        },
      { module: 'materiales', to: '/materiales/entradas',          title: 'Entradas de material',   desc: 'Registre llegadas, peso húmedo y datos de mina.',         icon: Package,       variant: 'brown'   },
      { module: 'materiales', to: '/materiales/analisis',          title: 'Análisis / Laboratorio', desc: 'Humedad, tenor y control de calidad por lote.',           icon: FlaskConical,  variant: 'emerald' },
      { module: 'materiales', to: '/materiales/procesamiento',     title: 'Procesamiento',          desc: 'Lotes en proceso, concentrado y maquila.',               icon: Layers,        variant: 'info'    },
      { module: 'materiales', to: '/materiales/inventario',        title: 'Inventario',             desc: 'Crudo pendiente y concentrado disponible en canoa.',     icon: Package,       variant: ''        },
      { module: 'materiales', to: '/materiales/viajes-material',   title: 'Viajes de mineral',      desc: 'Despachos de concentrado y costos de maquila.',          icon: Send,          variant: 'brown'   },
      { module: 'materiales', to: '/materiales/viajes',            title: 'Viajes de agua',         desc: 'Vehículos cisterna, cantidad de viajes y ACPM.',         icon: Droplets,      variant: 'info'    },
      { module: 'materiales', to: '/materiales/volquetas',         title: 'Volquetas y pagos',      desc: 'Dueños, llegadas de material y control de fletes.',      icon: Truck,         variant: 'emerald' },
      { module: 'materiales', to: '/materiales/zonas',             title: 'Catálogos y tarifas',    desc: 'Zonas, mineros, precios de material y tarifas de flete.', icon: Mountain,     variant: ''        },
      { module: 'materiales', to: '/materiales/informes',          title: 'Informes de material',   desc: 'Reportes y estadísticas de producción.',                 icon: BarChart3,     variant: 'info'    },
    ],
  },
  {
    label: 'Finanzas',
    icon: Coins,
    cards: [
      { module: 'finanzas', to: '/finanzas',            title: 'Cuentas por pagar',     desc: 'Pagos pendientes, proveedores y órdenes de pago.',   icon: Wallet,      variant: ''        },
      { module: 'finanzas', to: '/finanzas/cobrar',     title: 'Cuentas por cobrar',    desc: 'Facturas emitidas, cobros pendientes y abonos.',     icon: CreditCard,  variant: 'emerald' },
      { module: 'finanzas', to: '/finanzas/prestamos',  title: 'Préstamos financieros', desc: 'Créditos activos, cuotas y estado de deudas.',       icon: Landmark,    variant: 'brown'   },
      { module: 'finanzas', to: '/finanzas/informes',   title: 'Informes financieros',  desc: 'Flujo de caja, balances y reportes contables.',      icon: BarChart3,   variant: 'info'    },
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
  const { entradas, viajesAgua, porPagar, porCobrar, empleados, prestamos, volquetas } = useData()
  const { materiales } = useMateriales()
  const { cycleFontStep, toggleContrast, highContrast } = useA11y()
  if (!user) return null

  if (user.role === 'administrador') return <AdminDashboard />

  const pendientesPago   = porPagar.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.monto, 0)
  const pendientesCobrar = porCobrar.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.monto, 0)
  const totalTon         = materiales.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const volquetasActivas = volquetas.filter(v => v.activo).length
  const prestamosActivos = prestamos.filter(p => p.estado === 'aprobado').length
  const empleadosActivos = empleados.filter(e => e.activo).length

  const isMateriales = user.role === 'materiales'
  const isFinanciero = user.role === 'financiero'

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

      {/* KPIs según rol */}
      <div className="grid grid--kpi" style={{ marginBottom: '1.75rem' }}>
        {isMateriales && <>
          <KpiTile label="Material registrado"  value={formatTon(totalTon)}        hint="Ton húmedas acumuladas"          icon={<Boxes size={16}/>}     accent="brown"   />
          <KpiTile label="Entradas registradas" value={entradas.length}            hint="Registros de llegada"            icon={<Package size={16}/>}   accent="green"   />
          <KpiTile label="Viajes de agua"       value={viajesAgua.length}          hint="Vehículos cisterna"             icon={<Droplets size={16}/>}  accent="amber"   />
          <KpiTile label="Volquetas activas"    value={volquetasActivas}           hint="Flota de transporte activa"     icon={<Truck size={16}/>}     accent="emerald" />
        </>}
        {isFinanciero && <>
          <KpiTile label="Por pagar"            value={formatCOP(pendientesPago)}  hint="Cuentas pendientes de pago"     icon={<Wallet size={16}/>}    accent="rose"    />
          <KpiTile label="Por cobrar"           value={formatCOP(pendientesCobrar)} hint="Cobros pendientes"            icon={<CreditCard size={16}/>} accent="amber"  />
          <KpiTile label="Empleados activos"    value={empleadosActivos}           hint="Personal vinculado"             icon={<Users2 size={16}/>}    accent="green"   />
          <KpiTile label="Préstamos activos"    value={prestamosActivos}           hint="Créditos en curso"              icon={<Landmark size={16}/>}  accent="brown"   />
        </>}
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
