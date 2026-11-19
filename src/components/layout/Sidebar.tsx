import { NavLink } from 'react-router-dom'
import {
  Anchor, ArrowDownCircle, BarChart3, Banknote, Boxes, Building2, CalendarDays, CircleDollarSign, ClipboardList, Cloud, Container, Droplets, Factory,
  FileSpreadsheet, FlaskConical, Fuel, HandCoins, Handshake, Home, Landmark, Layers, Mountain, Package, PackagePlus, Receipt, Scale, Send,
  Ship, TrendingUp, Truck, UserCog, Users2, Wallet, type LucideIcon,
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
    icon: Cloud,
    items: [
      { to: '/materiales/entradas-api',   label: 'Entradas de material',   icon: PackagePlus  },
      { to: '/materiales/volquetas-api',  label: 'Volquetas',              icon: Truck        },
      { to: '/materiales/analisis-api',   label: 'Análisis y laboratorio', icon: FlaskConical },
      { to: '/materiales/procesamiento-api', label: 'Procesamiento',       icon: Layers       },
      { to: '/materiales/inventario-api', label: 'Inventario material',    icon: Package      },
      { to: '/materiales/inventario-productos-api', label: 'Inventario de productos', icon: Boxes },
      { to: '/materiales/viajes-material-api', label: 'Viajes material',   icon: Send         },
      { to: '/materiales/pago-material-api', label: 'Pago de material',    icon: Banknote     },
      { to: '/materiales/pago-mulas-api', label: 'Pago de mulas',          icon: Container    },
      { to: '/materiales/catalogos-api',  label: 'Catálogos',              icon: Mountain     },
      { to: '/materiales/viajes-agua-api', label: 'Viajes de agua',        icon: Droplets     },
      { to: '/materiales/plantillas',     label: 'Plantillas',             icon: FileSpreadsheet },
    ],
  },
  {
    module: 'finanzas',
    label: 'Pagos y finanzas',
    icon: Cloud,
    items: [
      { to: '/finanzas/cxp-api',         label: 'Gastos',              icon: Wallet          },
      { to: '/finanzas/cxc-api',         label: 'Ingresos',            icon: ArrowDownCircle },
      { to: '/finanzas/combustible-api', label: 'Combustible',        icon: Fuel            },
      { to: '/finanzas/anticipos-api',   label: 'Adelantos a terceros', icon: CircleDollarSign },
      { to: '/finanzas/proveedores-api', label: 'Proveedores',        icon: Users2          },
      { to: '/finanzas/nominas-api',     label: 'Empleados y nómina', icon: UserCog         },
      { to: '/finanzas/calendario-turnos-api', label: 'Calendario de turnos', icon: CalendarDays },
      { to: '/finanzas/prestamos-api',   label: 'Préstamos financieros', icon: Landmark      },
      { to: '/finanzas/alquileres-api',  label: 'Alquileres',          icon: Building2       },
      { to: '/finanzas/tesoreria-api',   label: 'Tesorería',           icon: Scale           },
      { to: '/finanzas/impuestos-api',   label: 'Impuestos',           icon: Receipt         },
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
    module: 'importaciones',
    label: 'Importaciones',
    icon: Ship,
    items: [
      { to: '/importaciones',             label: 'Importaciones',   icon: Ship              },
      { to: '/importaciones/puerto',      label: 'Gastos de puerto', icon: Anchor           },
      { to: '/importaciones/transfigura', label: 'Transfigura',      icon: Handshake        },
      { to: '/importaciones/adelantos',   label: 'Adelantos',        icon: CircleDollarSign },
      { to: '/importaciones/regalias',    label: 'Regalías',         icon: Landmark         },
      { to: '/importaciones/inversion-planta', label: 'Inversión Planta', icon: TrendingUp  },
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
      end={item.to === '/nomina' || item.to === '/importaciones'}
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
