import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, CalendarDays, ClipboardList, Coins,
  CreditCard, Factory, FileBarChart2, FlaskConical, HandCoins, Landmark, Layers, Mountain, Package,
  PackagePlus, Send, Droplets, Truck, UserCog, Users2, Wallet,
  type LucideIcon,
} from 'lucide-react'
import './dashboard.css'

// ===================================================
// Quick-links
// ===================================================
interface QuickLink { to: string; title: string; icon: LucideIcon; variant: '' | 'brown' | 'emerald' | 'info' }
interface Area { label: string; icon: LucideIcon; links: QuickLink[] }
const AREAS: Area[] = [
  { label:'Materiales', icon:Boxes, links:[
    { to:'/materiales/entradas-api',        title:'Entradas de material',   icon:PackagePlus,  variant:'brown'   },
    { to:'/materiales/analisis-api',        title:'Análisis y laboratorio', icon:FlaskConical, variant:'emerald' },
    { to:'/materiales/procesamiento-api',   title:'Procesamiento',          icon:Layers,       variant:'info'    },
    { to:'/materiales/inventario-api',      title:'Inventario material',    icon:Package,      variant:''        },
    { to:'/materiales/viajes-material-api', title:'Viajes material',        icon:Send,         variant:'brown'   },
    { to:'/materiales/viajes-agua-api',     title:'Viajes de agua',         icon:Droplets,     variant:'info'    },
    { to:'/materiales/catalogos-api',       title:'Catálogos y precios',    icon:Mountain,     variant:''        },
    { to:'/materiales/volquetas-api',       title:'Volquetas',              icon:Truck,        variant:'emerald' },
  ]},
  { label:'Pagos y finanzas', icon:Coins, links:[
    { to:'/finanzas/cxp-api',       title:'Cuentas por pagar',     icon:Wallet,      variant:''        },
    { to:'/finanzas/cxc-api',       title:'Cuentas por cobrar',    icon:CreditCard,  variant:'emerald' },
    { to:'/finanzas/prestamos-api', title:'Préstamos financieros', icon:Landmark,    variant:'brown'   },
    { to:'/finanzas/tesoreria-api', title:'Informes financieros',  icon:BarChart3,   variant:'info'    },
  ]},
  { label:'Nómina', icon:Users2, links:[
    { to:'/nomina',            title:'Empleados y préstamos',  icon:HandCoins,    variant:''        },
    { to:'/nomina/calendario', title:'Calendario de turnos',   icon:CalendarDays, variant:'brown'   },
    { to:'/nomina/informes',   title:'Informes de nómina',     icon:BarChart3,    variant:'info'    },
  ]},
  { label:'Planta y producción', icon:Factory, links:[
    { to:'/planta/calendario', title:'Calendario de planta',   icon:ClipboardList, variant:'brown'  },
  ]},
  { label:'Administración', icon:UserCog, links:[
    { to:'/usuarios',           title:'Gestión de usuarios',    icon:UserCog,       variant:'emerald' },
    { to:'/informes',           title:'Power BI',               icon:BarChart3,     variant:'info'    },
    { to:'/powerbi/generador',  title:'Generador de informes',  icon:FileBarChart2, variant:''        },
  ]},
]

// ===================================================
// MAIN
// ===================================================
export function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <div className="dash-hero">
        <div>
          <h1 className="dash-hero__title">Panel de administración</h1>
          <p className="dash-hero__sub">Molinos de Colombia S.A.S — resumen general</p>
        </div>
      </div>

      {AREAS.map((area) => (
        <div className="dash-area" key={area.label}>
          <div className="dash-area__head"><area.icon size={20}/>{area.label}</div>
          <div className="dash-cards">
            {area.links.map((l) => (
              <button key={l.to} className="dash-card" onClick={() => navigate(l.to)}>
                <span className={`dash-card__icon ${l.variant ? `dash-card__icon--${l.variant}` : ''}`}><l.icon size={26}/></span>
                <span className="dash-card__title">{l.title}</span>
                <span className="dash-card__cta">Ver <ArrowRight size={16}/></span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
