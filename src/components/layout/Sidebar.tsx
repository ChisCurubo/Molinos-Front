import { NavLink } from 'react-router-dom'
import {
  ArrowDownCircle, BarChart3, Banknote, Boxes, CalendarDays, ClipboardList, Cloud, Coins, Container, Droplets, Factory,
  FlaskConical, HandCoins, Home, Landmark, Layers, Mountain, Package, PackagePlus, Send,
  Truck, UserCog, Users2, Wallet, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { canView, ROLES, type ModuleKey } from '@/auth/permissions'

interface NavLeaf {
  to: string
  label: string
  icon: LucideIcon
}
interface NavGroup {
  module: ModuleKey
  label: string
  icon: LucideIcon
  items: NavLeaf[]
}

const GROUPS: NavGroup[] = [
  {
    module: 'materiales',
    label: 'Materiales',
    icon: Boxes,
    items: [
      { to: '/materiales/entradas',         label: 'Entradas de material',  icon: PackagePlus  },
      { to: '/materiales/analisis',         label: 'Análisis y laboratorio', icon: FlaskConical },
      { to: '/materiales/procesamiento',    label: 'Procesamiento',          icon: Layers       },
      { to: '/materiales/inventario',       label: 'Inventario',             icon: Package      },
      { to: '/materiales/viajes-material',  label: 'Viajes material',        icon: Send         },
      { to: '/materiales/viajes',           label: 'Viajes de agua',         icon: Droplets     },
      { to: '/materiales/mulas',            label: 'Mulas',                  icon: Container    },
      { to: '/materiales/pago-material',    label: 'Pago de material',       icon: Banknote     },
      { to: '/materiales/zonas',            label: 'Catálogos y precios',    icon: Mountain     },
      { to: '/materiales/volquetas',        label: 'Volquetas',              icon: Truck        },
      { to: '/materiales/informes',         label: 'Informes de material',   icon: BarChart3    },
    ],
  },
  {
    module: 'materiales',
    label: 'Materiales · API',
    icon: Cloud,
    items: [
      { to: '/materiales/entradas-api',  label: 'Entradas de material',   icon: PackagePlus  },
      { to: '/materiales/analisis-api',  label: 'Análisis y laboratorio', icon: FlaskConical },
      { to: '/materiales/catalogos-api', label: 'Catálogos y precios',    icon: Mountain     },
    ],
  },
  {
    module: 'finanzas',
    label: 'Pagos y finanzas',
    icon: Coins,
    items: [
      { to: '/finanzas',          label: 'Cuentas por pagar',    icon: Wallet           },
      { to: '/finanzas/cobrar',   label: 'Cuentas por cobrar',   icon: ArrowDownCircle  },
      { to: '/finanzas/prestamos', label: 'Préstamos financieros', icon: Landmark        },
      { to: '/finanzas/informes', label: 'Informes de finanzas',  icon: BarChart3        },
    ],
  },
  {
    module: 'nomina',
    label: 'Nómina',
    icon: Users2,
    items: [
      { to: '/nomina',            label: 'Empleados y préstamos', icon: HandCoins    },
      { to: '/nomina/calendario', label: 'Calendario de turnos',  icon: CalendarDays },
      { to: '/nomina/informes',   label: 'Informes de nómina',    icon: BarChart3    },
    ],
  },
  {
    module: 'planta',
    label: 'Planta y producción',
    icon: Factory,
    items: [
      { to: '/planta/calendario', label: 'Calendario de planta', icon: ClipboardList },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onNavigate: () => void
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { user } = useAuth()
  if (!user) return null
  const isAdmin = user.role === 'administrador'

  const leaf = (item: NavLeaf, sub = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/finanzas' || item.to === '/nomina'}
      className={({ isActive }) => `nav-item ${sub ? 'nav-item--sub' : ''} ${isActive ? 'nav-item--active' : ''}`}
      onClick={onNavigate}
    >
      <span className="nav-item__icon">
        <item.icon size={sub ? 18 : 20} aria-hidden="true" />
      </span>
      {item.label}
    </NavLink>
  )

  return (
    <nav className={`sidebar ${open ? 'sidebar--open' : ''}`} aria-label="Navegación principal">
      <span className="sidebar__section">Inicio</span>
      {leaf({ to: '/', label: isAdmin ? 'Panel de administración' : 'Panel principal', icon: Home })}

      {GROUPS.filter((g) => canView(user.role, g.module)).map((g) => (
        <div key={g.label}>
          <div className="sidebar__group-label">
            <g.icon size={16} aria-hidden="true" />
            {g.label}
          </div>
          {g.items.map((it) => leaf(it, true))}
        </div>
      ))}

      {(canView(user.role, 'usuarios') || canView(user.role, 'powerbi')) && (
        <>
          <span className="sidebar__section">Administración</span>
          {canView(user.role, 'usuarios') && leaf({ to: '/usuarios', label: 'Usuarios', icon: UserCog })}
          {canView(user.role, 'powerbi') && leaf({ to: '/informes', label: 'Informes Power BI', icon: BarChart3 })}
        </>
      )}

      <div className="sidebar__spacer" />
      <div className="sidebar__foot">
        {ROLES[user.role].label}
        <br />
        {isAdmin ? 'Modo solo lectura' : 'Gestión habilitada'}
      </div>
    </nav>
  )
}
