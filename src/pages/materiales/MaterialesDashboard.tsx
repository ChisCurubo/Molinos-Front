import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Droplets, FlaskConical, Layers,
  Mountain, Package, PackagePlus, Send, Truck, type LucideIcon,
} from 'lucide-react'
import { KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useMateriales } from '@/context/MaterialesContext'
import '../dashboard/dashboard.css'

interface NavCard {
  to: string
  title: string
  desc: string
  icon: LucideIcon
  variant: '' | 'brown' | 'emerald' | 'info'
}

const NAV_CARDS: NavCard[] = [
  { to: '/materiales/entradas',       title: 'Entradas de material',   desc: 'Registra llegadas de volquetas, peso bruto y estado de pago.',        icon: PackagePlus,  variant: 'brown'   },
  { to: '/materiales/analisis',       title: 'Análisis y laboratorio', desc: 'Au/Ag total, tenor real (gr/t) y au falso para cálculo de pago.',     icon: FlaskConical, variant: 'emerald' },
  { to: '/materiales/procesamiento',  title: 'Procesamiento',          desc: 'Lotes de concentrado, estado de maquila y vinculación de material.',   icon: Layers,       variant: 'info'    },
  { to: '/materiales/inventario',     title: 'Inventario',             desc: 'Stock de crudo y concentrado disponible en canoa.',                   icon: Package,      variant: ''        },
  { to: '/materiales/viajes-material',title: 'Viajes material',        desc: 'Envíos de concentrado a destino con trazabilidad completa.',          icon: Send,         variant: 'brown'   },
  { to: '/materiales/viajes',         title: 'Viajes de agua',         desc: 'Registro de viajes cisterna por conductor y dueño.',                  icon: Droplets,     variant: 'info'    },
  { to: '/materiales/zonas',          title: 'Catálogos y precios',    desc: 'Zonas, minas, mineros y tarifas de material y flete.',                icon: Mountain,     variant: ''        },
  { to: '/materiales/volquetas',      title: 'Volquetas',              desc: 'Flota registrada, dueños con datos bancarios y llegadas a planta.',    icon: Truck,        variant: 'emerald' },
  { to: '/materiales/informes',       title: 'Informes de material',   desc: 'Resumen, estadísticas y exportación del módulo materiales.',          icon: BarChart3,    variant: 'brown'   },
]

export function MaterialesDashboard() {
  const navigate = useNavigate()
  const { materiales, lotes, viajes, analisis } = useMateriales()

  const sinAnalisis  = materiales.filter(m => m.tenor === 0).length
  const lotesActivos = lotes.filter(l => l.estado !== 'enviado_completo').length

  return (
    <div className="page">
      <PageHeader
        title="Módulo de Materiales"
        subtitle="Gestión completa del ciclo de material: entradas, análisis, procesamiento, inventario y viajes."
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.5rem' }}>
        <KpiTile label="Total entradas"   value={materiales.length} hint="Materiales registrados en planta" icon={<PackagePlus size={16}/>} accent="brown"   />
        <KpiTile label="Sin análisis"     value={sinAnalisis}       hint="Materiales sin tenor asignado"   icon={<FlaskConical size={16}/>} accent="rose"    />
        <KpiTile label="Lotes activos"    value={lotesActivos}      hint="En proceso o en canoa"           icon={<Layers size={16}/>}      accent="emerald" />
        <KpiTile label="Análisis totales" value={analisis.length}   hint="Registros de laboratorio"        icon={<BarChart3 size={16}/>}   accent="green"   />
        <KpiTile label="Viajes mineral"   value={viajes.length}     hint="Envíos de concentrado"           icon={<Send size={16}/>}        accent="amber"   />
      </div>

      <h2 className="dash-section-title">Secciones del módulo</h2>
      <div className="dash-cards">
        {NAV_CARDS.map(c => {
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
              <span className="dash-card__cta">
                Abrir <ArrowRight size={15} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
