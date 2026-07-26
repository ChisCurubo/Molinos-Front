import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, CalendarDays, ClipboardList, Coins, DollarSign, Factory,
  FlaskConical, HandCoins, Landmark, Layers, Mountain, Package, PackagePlus, Pencil, Plus,
  Scale, Send, Droplets, Trash2, Truck, Users2, Wallet, type LucideIcon,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { useData } from '@/context/DataContext'
import { formatCOP, formatDate, getPrecioAplicable, pct, ton } from '@/utils/format'
import {
  materialesMock, aguaMock, viajesMock, inventarioCrudo, inventarioConcentrado,
  preciosMaterial, tarifasZona, zonas, mineros,
  MINA_A_ZONA, MINA_A_MINERO,
  type PrecioMaterial, type TarifaZona,
} from '@/data/mock'
import './dashboard.css'

const cop = formatCOP

// ===================================================
// Quick-links
// ===================================================
interface QuickLink { to: string; title: string; icon: LucideIcon; variant: '' | 'brown' | 'emerald' | 'info' }
interface Area { label: string; icon: LucideIcon; links: QuickLink[] }
const AREAS: Area[] = [
  { label:'Materiales', icon:Boxes, links:[
    { to:'/materiales/entradas',        title:'Entradas de material',   icon:PackagePlus,  variant:'brown'   },
    { to:'/materiales/analisis',        title:'Análisis y laboratorio', icon:FlaskConical, variant:'emerald' },
    { to:'/materiales/procesamiento',   title:'Procesamiento',          icon:Layers,       variant:'info'    },
    { to:'/materiales/inventario',      title:'Inventario',             icon:Package,      variant:''        },
    { to:'/materiales/viajes-material', title:'Viajes material',        icon:Send,         variant:'brown'   },
    { to:'/materiales/viajes',          title:'Viajes de agua',         icon:Droplets,     variant:'info'    },
    { to:'/materiales/zonas',           title:'Catálogos y precios',    icon:Mountain,     variant:''        },
    { to:'/materiales/volquetas',       title:'Volquetas',              icon:Truck,        variant:'emerald' },
    { to:'/materiales/informes',        title:'Informes de material',   icon:BarChart3,    variant:'info'    },
  ]},
  { label:'Pagos y finanzas', icon:Coins, links:[
    { to:'/finanzas',           title:'Cuentas por pagar/cobrar', icon:Wallet,    variant:''        },
    { to:'/finanzas/prestamos', title:'Préstamos financieros',    icon:Landmark,  variant:'brown'   },
    { to:'/finanzas/informes',  title:'Informes de finanzas',     icon:BarChart3, variant:'info'    },
  ]},
  { label:'Nómina', icon:Users2, links:[
    { to:'/nomina',            title:'Empleados y préstamos',  icon:HandCoins,    variant:''        },
    { to:'/nomina/calendario', title:'Calendario de turnos',   icon:CalendarDays, variant:'brown'   },
    { to:'/nomina/informes',   title:'Informes de nómina',     icon:BarChart3,    variant:'info'    },
  ]},
  { label:'Planta y producción', icon:Factory, links:[
    { to:'/planta/calendario', title:'Calendario de planta',   icon:ClipboardList, variant:'brown'  },
  ]},
]

// ===================================================
// Tabs
// ===================================================
const TABS = ['Dashboard','Materiales','Agua','Viajes','Inventario','Tarifas'] as const
type Tab = typeof TABS[number]

const MATERIAL_ESTADOS = ['todos','pendiente','pagada','incluida_viaje'] as const
const ESTADO_LABELS: Record<string, string> = {
  incluida_viaje: 'En viaje', pagada:'Pagada', pendiente:'Pendiente',
  enviado_completo:'Enviado', en_canoa:'En canoa',
}

// ===================================================
// Helpers de cálculo
// ===================================================
function calcPesoSeco(humedo: number, humPct: number) { return humedo * (1 - humPct) }
function calcFlete(pesoSeco: number, minaName: string) {
  const idZona = MINA_A_ZONA[minaName]
  if (!idZona) return null
  const tarifa = tarifasZona.find((t) => t.id_zona === idZona)
  return tarifa ? pesoSeco * tarifa.valor_tonelada : null
}
function calcValorMaterial(pesoSeco: number, tenor: number, minaName: string) {
  const idMinero = MINA_A_MINERO[minaName]
  const precio   = getPrecioAplicable(tenor, idMinero || undefined, preciosMaterial)
  if (!precio) return null
  if (precio.metodo === 'por_tonelada') return pesoSeco * (precio.precio_por_tonelada ?? 0)
  // por_gramo: total_gramos = pesoSeco × tenor (gr/t)
  const totalGramos = pesoSeco * tenor
  return totalGramos * (precio.precio_por_gramo ?? 0)
}

// ===================================================
// Component: TarifasTab
// ===================================================
function TarifasTab() {
  const [subTab, setSubTab] = useState<'precios' | 'zonas'>('precios')
  const [precios, setPrecios] = useState<PrecioMaterial[]>(preciosMaterial)
  const [tarifas, setTarifas] = useState<TarifaZona[]>(tarifasZona)

  // Modal precio material
  const [modalPrecio, setModalPrecio] = useState(false)
  const [editPrecio, setEditPrecio]   = useState<PrecioMaterial | null>(null)
  const [fpMetodo, setFpMetodo]       = useState<'por_tonelada' | 'por_gramo'>('por_tonelada')
  const [fpTenorMin, setFpTenorMin]   = useState('')
  const [fpTenorMax, setFpTenorMax]   = useState('')
  const [fpPrecioTon, setFpPrecioTon] = useState('')
  const [fpPrecioGramo, setFpPrecioGramo] = useState('')
  const [fpDesde, setFpDesde]         = useState('2025-01-01')
  const [fpMineroId, setFpMineroId]   = useState('')

  // Modal tarifa zona
  const [modalZona, setModalZona]   = useState(false)
  const [editZona, setEditZona]     = useState<TarifaZona | null>(null)
  const [fzIdZona, setFzIdZona]     = useState('')
  const [fzValor, setFzValor]       = useState('')
  const [fzDesde, setFzDesde]       = useState('2026-07-01')

  // Simulador tenor
  const [simTenor, setSimTenor]     = useState('7.5')
  const simResultado = useMemo(() => {
    const t = Number(simTenor)
    if (isNaN(t)) return null
    return getPrecioAplicable(t, undefined, precios)
  }, [simTenor, precios])

  const openNuevoPrecio = () => {
    setEditPrecio(null); setFpMetodo('por_tonelada')
    setFpTenorMin(''); setFpTenorMax(''); setFpPrecioTon(''); setFpPrecioGramo('')
    setFpDesde('2025-01-01'); setFpMineroId(''); setModalPrecio(true)
  }
  const openEditPrecio = (p: PrecioMaterial) => {
    setEditPrecio(p); setFpMetodo(p.metodo)
    setFpTenorMin(String(p.tenor_min)); setFpTenorMax(String(p.tenor_max))
    setFpPrecioTon(String(p.precio_por_tonelada ?? '')); setFpPrecioGramo(String(p.precio_por_gramo ?? ''))
    setFpDesde(p.fecha_inicio); setFpMineroId(String(p.id_minero ?? '')); setModalPrecio(true)
  }
  const savePrecio = () => {
    const nuevo: PrecioMaterial = {
      id: editPrecio?.id ?? Date.now(),
      metodo: fpMetodo,
      tenor_min: Number(fpTenorMin), tenor_max: Number(fpTenorMax),
      precio_por_tonelada: fpMetodo === 'por_tonelada' ? Number(fpPrecioTon) : undefined,
      precio_por_gramo:    fpMetodo === 'por_gramo'    ? Number(fpPrecioGramo) : undefined,
      fecha_inicio: fpDesde,
      id_minero: fpMineroId ? Number(fpMineroId) : undefined,
    }
    setPrecios((prev) => editPrecio
      ? prev.map((p) => p.id === editPrecio.id ? nuevo : p)
      : [...prev, nuevo])
    setModalPrecio(false)
  }
  const deletePrecio = (id: number) => {
    if (!confirm('¿Eliminar esta tarifa?')) return
    setPrecios((prev) => prev.filter((p) => p.id !== id))
  }

  const openNuevaZona = () => {
    setEditZona(null); setFzIdZona(''); setFzValor(''); setFzDesde('2026-07-01'); setModalZona(true)
  }
  const openEditZona = (t: TarifaZona) => {
    setEditZona(t); setFzIdZona(String(t.id_zona)); setFzValor(String(t.valor_tonelada)); setFzDesde(t.vigente_desde); setModalZona(true)
  }
  const saveZona = () => {
    const zona = zonas.find((z) => z.id === Number(fzIdZona))
    if (!zona) return
    const nueva: TarifaZona = {
      id: editZona?.id ?? Date.now(),
      zona: zona.nombre.toUpperCase(),
      id_zona: Number(fzIdZona),
      valor_tonelada: Number(fzValor),
      vigente_desde: fzDesde,
    }
    setTarifas((prev) => editZona
      ? prev.map((t) => t.id === editZona.id ? nueva : t)
      : [...prev, nueva])
    setModalZona(false)
  }

  const zonasConTarifa = new Set(tarifas.map((t) => t.id_zona))
  const zonasSinTarifa = zonas.filter((z) => !zonasConTarifa.has(z.id))

  return (
    <div className="stack">
      {/* Mini-tabs */}
      <div className="segment">
        <button className={`segment__btn ${subTab === 'precios' ? 'segment__btn--active' : ''}`} onClick={() => setSubTab('precios')}>
          Precio material (por tenor)
        </button>
        <button className={`segment__btn ${subTab === 'zonas' ? 'segment__btn--active' : ''}`} onClick={() => setSubTab('zonas')}>
          Tarifa por zona (flete)
        </button>
      </div>

      {/* ── Sub-tab: precios ── */}
      {subTab === 'precios' && (
        <>
          <Card
            title="Tarifas de material según tenor"
            actions={<Button size="sm" icon={<Plus size={18} />} onClick={openNuevoPrecio}>Nueva tarifa</Button>}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Tenor mín</th><th>Tenor máx</th><th>Método</th>
                  <th style={{textAlign:'right'}}>$/ton</th>
                  <th style={{textAlign:'right'}}>$/gramo</th>
                  <th>Minero</th><th>Vigente desde</th><th></th>
                </tr></thead>
                <tbody>
                  {precios.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.tenor_min.toFixed(1)}</td>
                      <td className="mono">{p.tenor_max.toFixed(1)}</td>
                      <td><span className="badge badge--info">{p.metodo === 'por_tonelada' ? 'Por ton' : 'Por gramo'}</span></td>
                      <td style={{textAlign:'right'}} className="mono">{p.precio_por_tonelada ? cop(p.precio_por_tonelada) : '—'}</td>
                      <td style={{textAlign:'right'}} className="mono">{p.precio_por_gramo    ? cop(p.precio_por_gramo)    : '—'}</td>
                      <td>{p.id_minero ? (mineros.find((m) => m.id === p.id_minero)?.nombre ?? '—') : <em style={{color:'var(--text-muted)'}}>Todos</em>}</td>
                      <td>{formatDate(p.fecha_inicio)}</td>
                      <td>
                        <div className="row" style={{gap:6}}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={15} />} onClick={() => openEditPrecio(p)} />
                          <Button variant="ghost"     size="sm" icon={<Trash2 size={15} />} onClick={() => deletePrecio(p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Simulador */}
          <Card title="Simulador de precio por tenor">
            <div className="row" style={{gap:'1rem', flexWrap:'wrap', alignItems:'flex-end'}}>
              <div style={{flex:'0 0 12rem'}}>
                <Input label="Tenor (gr/t)" type="number" step="0.1" value={simTenor} onChange={(e) => setSimTenor(e.target.value)} />
              </div>
              {simResultado ? (
                <div className="callout" style={{flex:1}}>
                  <span className="callout__icon"><Scale size={14}/></span>
                  <span>
                    Tenor <strong>{simTenor} gr/t</strong> →{' '}
                    {simResultado.metodo === 'por_tonelada'
                      ? <>Precio: <strong>{cop(simResultado.precio_por_tonelada ?? 0)}/ton</strong></>
                      : <>Precio: <strong>{cop(simResultado.precio_por_gramo ?? 0)}/gramo</strong></>
                    }
                    {' '}(rango {simResultado.tenor_min}–{simResultado.tenor_max})
                  </span>
                </div>
              ) : (
                <p style={{color:'var(--text-muted)',fontSize:'var(--fs-sm)'}}>Tenor fuera de rango — sin precio configurado</p>
              )}
            </div>
          </Card>
        </>
      )}

      {/* ── Sub-tab: zonas ── */}
      {subTab === 'zonas' && (
        <>
          <Card
            title="Tarifas de flete por zona"
            actions={zonasSinTarifa.length > 0 && <Button size="sm" icon={<Plus size={18} />} onClick={openNuevaZona}>Nueva tarifa</Button>}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Zona</th><th style={{textAlign:'right'}}>Tarifa/ton seca</th>
                  <th>Vigente desde</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {zonas.map((z) => {
                    const tarifa = tarifas.find((t) => t.id_zona === z.id)
                    return (
                      <tr key={z.id}>
                        <td>{z.nombre}</td>
                        <td style={{textAlign:'right'}} className="mono">{tarifa ? cop(tarifa.valor_tonelada) : '—'}</td>
                        <td>{tarifa ? formatDate(tarifa.vigente_desde) : '—'}</td>
                        <td>
                          {tarifa
                            ? <span className="badge badge--success">Con tarifa</span>
                            : <span className="badge badge--warning">Sin tarifa</span>
                          }
                        </td>
                        <td>
                          {tarifa
                            ? <Button variant="secondary" size="sm" icon={<Pencil size={15} />} onClick={() => openEditZona(tarifa)} />
                            : <Button size="sm" icon={<Plus size={15} />} onClick={() => { setFzIdZona(String(z.id)); setFzValor(''); setFzDesde('2026-07-01'); setEditZona(null); setModalZona(true) }}>Agregar</Button>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Modal precio material */}
      <Modal open={modalPrecio} title={editPrecio ? 'Editar tarifa de material' : 'Nueva tarifa de material'} onClose={() => setModalPrecio(false)}
        footer={<><Button variant="secondary" onClick={() => setModalPrecio(false)}>Cancelar</Button><Button onClick={savePrecio}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Método de pago" options={[{value:'por_tonelada',label:'Por tonelada'},{value:'por_gramo',label:'Por gramo'}]}
            value={fpMetodo} onChange={(e) => setFpMetodo(e.target.value as 'por_tonelada' | 'por_gramo')} />
          <Input label="Tenor mínimo (gr/t)" type="number" step="0.1" value={fpTenorMin} onChange={(e) => setFpTenorMin(e.target.value)} required />
          <Input label="Tenor máximo (gr/t)" type="number" step="0.1" value={fpTenorMax} onChange={(e) => setFpTenorMax(e.target.value)} required />
          {fpMetodo === 'por_tonelada'
            ? <Input label="Precio por tonelada" type="number" value={fpPrecioTon} onChange={(e) => setFpPrecioTon(e.target.value)} required />
            : <Input label="Precio por gramo"    type="number" value={fpPrecioGramo} onChange={(e) => setFpPrecioGramo(e.target.value)} required />
          }
          <Select label="Minero (opcional)"
            options={[{ value: '', label: 'Todos los mineros' }, ...mineros.map((m) => ({ value: String(m.id), label: m.nombre }))]}
            value={fpMineroId} onChange={(e) => setFpMineroId(e.target.value)}
            helper="Dejar en 'Todos' para que aplique a cualquier minero"
          />
          <Input label="Vigente desde" type="date" value={fpDesde} onChange={(e) => setFpDesde(e.target.value)} />
        </div>
      </Modal>

      {/* Modal tarifa zona */}
      <Modal open={modalZona} title={editZona ? 'Editar tarifa de zona' : 'Nueva tarifa de zona'} onClose={() => setModalZona(false)}
        footer={<><Button variant="secondary" onClick={() => setModalZona(false)}>Cancelar</Button><Button onClick={saveZona}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Zona" options={zonas.map((z) => ({value:String(z.id),label:z.nombre}))}
            value={fzIdZona} onChange={(e) => setFzIdZona(e.target.value)} required />
          <Input label="Tarifa por ton seca" type="number" value={fzValor} onChange={(e) => setFzValor(e.target.value)} required />
          <Input label="Vigente desde" type="date" value={fzDesde} onChange={(e) => setFzDesde(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

// ===================================================
// MAIN
// ===================================================
export function AdminDashboard() {
  const navigate = useNavigate()
  const { porPagar, empleados: empCtx, prestamos } = useData()

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [minaFiltro, setMinaFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  // KPIs mock
  const totalMaterial  = materialesMock.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalConcentrado = inventarioConcentrado.reduce((s, l) => s + l.toneladas_disponibles, 0)
  const maquilaTotal   = viajesMock.reduce((s, v) => s + v.maquila, 0)

  // Filtro materiales
  const minas = [...new Set(materialesMock.map((m) => m.mina))].sort()
  const materialesFiltrados = useMemo(() => materialesMock.filter((m) => {
    const porEstado = estadoFiltro === 'todos' || m.estado === estadoFiltro
    const porMina   = minaFiltro === 'todas'  || m.mina === minaFiltro
    const porBusq   = !busqueda || m.mina.includes(busqueda.toUpperCase()) || String(m.numero_volqueta).includes(busqueda)
    return porEstado && porMina && porBusq
  }), [estadoFiltro, minaFiltro, busqueda])

  // Resumen agua por conductor
  const conductores = [...new Set(aguaMock.map((a) => a.conductor))]
  const resumenAgua = conductores.map((c) => {
    const filas = aguaMock.filter((a) => a.conductor === c)
    return { conductor:c, registros:filas.length, bruto:filas.reduce((s,a)=>s+a.valor_viaje*a.cantidad_viajes,0), acpm:filas.reduce((s,a)=>s+a.acpm,0), neto:filas.reduce((s,a)=>s+a.valor_total,0) }
  })

  return (
    <div className="page">
      <div className="dash-hero">
        <div>
          <h1 className="dash-hero__title">Panel de administración</h1>
          <p className="dash-hero__sub">Molinos de Colombia S.A.S — resumen general</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="segment" style={{marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {TABS.map((t) => (
          <button key={t} className={`segment__btn ${tab === t ? 'segment__btn--active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'Dashboard' && (
        <>
          <div className="grid grid--kpi" style={{marginBottom:'1.5rem'}}>
            <KpiTile label="Material recibido"    value={ton(totalMaterial,1)}    hint="Total bruto acumulado" icon={<Package size={16}/>}     accent="green" />
            <KpiTile label="Concentrado disp."    value={ton(totalConcentrado,1)} hint="Disponible en canoa"  icon={<Layers size={16}/>}       accent="brown" />
            <KpiTile label="Viajes realizados"    value={viajesMock.length}       hint="Viajes de mineral"   icon={<Truck size={16}/>}        accent="emerald" />
            <KpiTile label="Maquila total"        value={cop(maquilaTotal)}       hint="Costo de beneficio"  icon={<DollarSign size={16}/>}   accent="rose" />
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
        </>
      )}

      {/* ── MATERIALES ── */}
      {tab === 'Materiales' && (
        <Card title={`Materiales (${materialesFiltrados.length})`}>
          {/* Filtros */}
          <div className="toolbar" style={{marginBottom:'1rem',gap:'0.75rem',flexWrap:'wrap'}}>
            <input className="field__input" placeholder="Buscar por minero o volqueta…" value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} style={{maxWidth:'16rem'}} />
            <div className="segment">
              {MATERIAL_ESTADOS.map((e) => (
                <button key={e} className={`segment__btn ${estadoFiltro===e?'segment__btn--active':''}`} onClick={()=>setEstadoFiltro(e)}>
                  {e==='todos'?'Todos':ESTADO_LABELS[e]??e}
                </button>
              ))}
            </div>
            <select className="field__select" style={{maxWidth:'11rem'}} value={minaFiltro} onChange={(e)=>setMinaFiltro(e.target.value)}>
              <option value="todas">Todas las minas</option>
              {minas.map((m)=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Volqueta</th>
                <th>Minero/Mina</th>
                <th>Fecha</th>
                <th style={{textAlign:'right'}}>Húmedo (t)</th>
                <th style={{textAlign:'right'}}>Humedad</th>
                <th style={{textAlign:'right'}}>Seco (t)</th>
                <th style={{textAlign:'right'}}>Tenor</th>
                <th style={{textAlign:'right'}}>Flete</th>
                <th style={{textAlign:'right'}}>Valor mat.</th>
                <th>Estado</th>
              </tr></thead>
              <tbody>
                {materialesFiltrados.map((m) => {
                  const seco   = calcPesoSeco(m.peso_llegada_planta, m.porcentaje_humedad)
                  const flete  = calcFlete(seco, m.mina)
                  const valor  = m.porcentaje_humedad > 0 ? calcValorMaterial(seco, m.tenor, m.mina) : null
                  return (
                    <tr key={m.id}>
                      <td className="mono">{m.numero_volqueta}</td>
                      <td>{m.mina}</td>
                      <td>{formatDate(m.fecha)}</td>
                      <td style={{textAlign:'right'}} className="mono">{m.peso_llegada_planta.toFixed(3)}</td>
                      <td style={{textAlign:'right'}} className="mono">{pct(m.porcentaje_humedad)}</td>
                      <td style={{textAlign:'right'}} className="mono">{seco.toFixed(4)}</td>
                      <td style={{textAlign:'right'}} className="mono">{m.tenor.toFixed(1)}</td>
                      <td style={{textAlign:'right'}} className="mono">{flete != null ? cop(flete) : <em style={{color:'var(--text-faint)'}}>S/T</em>}</td>
                      <td style={{textAlign:'right'}} className="mono">{valor != null ? cop(valor) : '—'}</td>
                      <td><span className={`badge ${m.estado==='pendiente'?'badge--warning':m.estado==='pagada'?'badge--info':'badge--neutral'}`}>{ESTADO_LABELS[m.estado]??m.estado}</span></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{fontWeight:700}}>
                  <td colSpan={3}>Total ({materialesFiltrados.length})</td>
                  <td style={{textAlign:'right'}} className="mono">{materialesFiltrados.reduce((s,m)=>s+m.peso_llegada_planta,0).toFixed(3)}</td>
                  <td/>
                  <td style={{textAlign:'right'}} className="mono">
                    {materialesFiltrados.reduce((s,m)=>s+calcPesoSeco(m.peso_llegada_planta,m.porcentaje_humedad),0).toFixed(4)}
                  </td>
                  <td colSpan={4}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── AGUA ── */}
      {tab === 'Agua' && (
        <>
          <Card title={`Viajes de agua (${aguaMock.length} registros)`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Conductor</th><th>Fecha</th>
                  <th style={{textAlign:'right'}}>Viajes</th>
                  <th style={{textAlign:'right'}}>$/viaje</th>
                  <th style={{textAlign:'right'}}>Bruto</th>
                  <th style={{textAlign:'right'}}>ACPM</th>
                  <th style={{textAlign:'right'}}>Neto</th>
                </tr></thead>
                <tbody>
                  {aguaMock.map((a) => (
                    <tr key={a.id} style={a.acpm>0?{background:'var(--amber-50)'}:undefined}>
                      <td>{a.conductor}</td>
                      <td>{formatDate(a.fecha)}</td>
                      <td style={{textAlign:'right'}} className="mono">{a.cantidad_viajes}</td>
                      <td style={{textAlign:'right'}} className="mono">{cop(a.valor_viaje)}</td>
                      <td style={{textAlign:'right'}} className="mono">{cop(a.valor_viaje*a.cantidad_viajes)}</td>
                      <td style={{textAlign:'right'}} className="mono">{a.acpm>0?cop(a.acpm):'—'}</td>
                      <td style={{textAlign:'right',fontWeight:700}} className="mono">{cop(a.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid grid--kpi" style={{marginTop:'1.25rem'}}>
            {resumenAgua.map((r) => (
              <Card key={r.conductor} title={r.conductor} flush>
                <div style={{display:'flex',flexDirection:'column',gap:'0.375rem',fontSize:'var(--fs-sm)'}}>
                  <span>{r.registros} registros</span>
                  <span>Bruto: <strong>{cop(r.bruto)}</strong></span>
                  {r.acpm>0&&<span>ACPM: <strong>- {cop(r.acpm)}</strong></span>}
                  <span style={{fontSize:'var(--fs-base)',fontWeight:800}}>Neto: {cop(r.neto)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── VIAJES ── */}
      {tab === 'Viajes' && (
        <div className="stack">
          {viajesMock.map((v) => (
            <Card key={v.id} title={`Viaje ${v.numero_viaje} — ${formatDate(v.fecha)}`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th>Concepto</th><th>Lote</th>
                    <th style={{textAlign:'right'}}>Húmedo (t)</th>
                    <th style={{textAlign:'right'}}>Seco (t)</th>
                    <th style={{textAlign:'right'}}>Maquila</th>
                    <th style={{textAlign:'right'}}>Valor material</th>
                  </tr></thead>
                  <tbody>
                    {v.lineas.map((l) => (
                      <tr key={l.id}>
                        <td>{l.concepto}</td>
                        <td className="mono">{l.lote}</td>
                        <td style={{textAlign:'right'}} className="mono">{l.concentrado_humedo.toFixed(2)}</td>
                        <td style={{textAlign:'right'}} className="mono">{l.concentrado_seco.toFixed(2)}</td>
                        <td style={{textAlign:'right'}} className="mono">{l.costo_maquila>0?cop(l.costo_maquila):'—'}</td>
                        <td style={{textAlign:'right'}} className="mono">{l.valor_total>0?cop(l.valor_total):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{fontWeight:700}}>
                      <td colSpan={4}>Total viaje {v.numero_viaje}</td>
                      <td style={{textAlign:'right'}} className="mono">{cop(v.maquila)}</td>
                      <td style={{textAlign:'right'}} className="mono">{cop(v.total_costo_material)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── INVENTARIO ── */}
      {tab === 'Inventario' && (
        <div className="stack">
          <Card title={`Crudo pendiente (${inventarioCrudo.length})`}>
            {inventarioCrudo.length===0
              ? <p style={{color:'var(--text-muted)',padding:'1rem 0'}}>No hay material crudo pendiente.</p>
              : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>
                      <th>Volqueta</th><th>Mina</th><th>Llegada</th>
                      <th style={{textAlign:'right'}}>Húmedo</th>
                      <th style={{textAlign:'right'}}>Seco disponible</th>
                      <th>Estado</th>
                    </tr></thead>
                    <tbody>
                      {inventarioCrudo.map((m) => (
                        <tr key={m.id}>
                          <td className="mono">{m.numero_volqueta}</td>
                          <td>{m.mina}</td>
                          <td>{formatDate(m.fecha)}</td>
                          <td style={{textAlign:'right'}} className="mono">{ton(m.pendiente_humedo,3)}</td>
                          <td style={{textAlign:'right'}} className="mono">{ton(m.pendiente_seco,4)}</td>
                          <td><span className={`badge ${m.estado==='pendiente'?'badge--warning':'badge--info'}`}>{ESTADO_LABELS[m.estado]??m.estado}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>

          <Card title={`Concentrado disponible (${inventarioConcentrado.length} lotes)`}>
            {inventarioConcentrado.length===0
              ? <p style={{color:'var(--text-muted)',padding:'1rem 0'}}>Sin concentrado disponible.</p>
              : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>
                      <th>Lote</th><th>Fecha inicio</th>
                      <th style={{textAlign:'right'}}>Disponible (húmedo)</th>
                      <th style={{textAlign:'right'}}>Maquila</th>
                      <th>Estado</th>
                    </tr></thead>
                    <tbody>
                      {inventarioConcentrado.map((l) => (
                        <tr key={l.id}>
                          <td className="mono">{l.codigo}</td>
                          <td>{formatDate(l.fecha_inicio)}</td>
                          <td style={{textAlign:'right'}} className="mono">{ton(l.disponible_humedo,2)}</td>
                          <td style={{textAlign:'right'}} className="mono">{l.maquila_total>0?cop(l.maquila_total):'—'}</td>
                          <td><span className="badge badge--success">{ESTADO_LABELS[l.estado]??l.estado}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>

          <div className="grid grid--kpi">
            <KpiTile label="Crudo pendiente" value={ton(inventarioCrudo.reduce((s,m)=>s+m.pendiente_seco,0),2)} icon={<Package size={16}/>} accent="brown" />
            <KpiTile label="Concentrado en canoa" value={ton(inventarioConcentrado.reduce((s,l)=>s+l.disponible_humedo,0),2)} icon={<FlaskConical size={16}/>} accent="emerald" />
            <KpiTile label="Pagos pendientes" value={cop(porPagar.filter((p)=>p.estado==='pendiente').reduce((s,p)=>s+p.monto,0))} icon={<Wallet size={16}/>} accent="rose" />
            <KpiTile label="Préstamos activos" value={prestamos.filter((p)=>p.estado==='aprobado').length} icon={<Landmark size={16}/>} accent="amber" />
            <KpiTile label="Empleados activos" value={empCtx.filter((e)=>e.activo).length} icon={<Users2 size={16}/>} accent="green" />
          </div>
        </div>
      )}

      {/* ── TARIFAS ── */}
      {tab === 'Tarifas' && <TarifasTab />}
    </div>
  )
}
