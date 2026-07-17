import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { CrudManager, type ColumnDef } from '@/components/common/CrudManager'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, getPrecioAplicable } from '@/utils/format'
import {
  preciosMaterial, tarifasZona, zonas as zonasMock, mineros,
  type PrecioMaterial, type TarifaZona,
} from '@/data/mock'
import type { Mina, Minero, Zona } from '@/types'

const cop = formatCOP

type MainTab = 'precios' | 'catalogos'
type CatTab = 'zonas' | 'minas' | 'mineros'

// ── Precios por tenor ─────────────────────────────────────
function PreciosTab({ canWrite }: { canWrite: boolean }) {
  const [precios, setPrecios] = useState<PrecioMaterial[]>(preciosMaterial)
  const [tarifas, setTarifas] = useState<TarifaZona[]>(tarifasZona)
  const [subTab, setSubTab] = useState<'precios'|'tarifas'>('precios')

  // Modal precio
  const [modalP, setModalP]   = useState(false)
  const [editP, setEditP]     = useState<PrecioMaterial|null>(null)
  const [fpMetodo, setFpMetodo] = useState<'por_tonelada'|'por_gramo'>('por_tonelada')
  const [fpTMin, setFpTMin]   = useState('')
  const [fpTMax, setFpTMax]   = useState('')
  const [fpPTon, setFpPTon]   = useState('')
  const [fpPGramo, setFpPGramo] = useState('')
  const [fpDesde, setFpDesde] = useState('2025-01-01')
  const [fpMineroId, setFpMineroId] = useState('')
  const [fpZonaId, setFpZonaId]   = useState('')

  const openNuevoP = () => { setEditP(null); setFpMetodo('por_tonelada'); setFpTMin(''); setFpTMax(''); setFpPTon(''); setFpPGramo(''); setFpDesde('2025-01-01'); setFpMineroId(''); setFpZonaId(''); setModalP(true) }
  const openEditP  = (p: PrecioMaterial) => { setEditP(p); setFpMetodo(p.metodo); setFpTMin(String(p.tenor_min)); setFpTMax(String(p.tenor_max)); setFpPTon(String(p.precio_por_tonelada??'')); setFpPGramo(String(p.precio_por_gramo??'')); setFpDesde(p.fecha_inicio); setFpMineroId(String(p.id_minero??'')); setFpZonaId(String(p.id_zona??'')); setModalP(true) }
  const saveP = () => {
    const nuevo: PrecioMaterial = { id:editP?.id??Date.now(), metodo:fpMetodo, tenor_min:Number(fpTMin), tenor_max:Number(fpTMax), precio_por_tonelada:fpMetodo==='por_tonelada'?Number(fpPTon):undefined, precio_por_gramo:fpMetodo==='por_gramo'?Number(fpPGramo):undefined, fecha_inicio:fpDesde, id_minero:fpMineroId?Number(fpMineroId):undefined, id_zona:fpZonaId?Number(fpZonaId):undefined }
    setPrecios((prev) => editP ? prev.map((p) => p.id===editP.id ? nuevo : p) : [...prev, nuevo])
    setModalP(false)
  }

  // Modal tarifa zona
  const [modalZ, setModalZ]   = useState(false)
  const [editZ, setEditZ]     = useState<TarifaZona|null>(null)
  const [fzZona, setFzZona]   = useState('')
  const [fzValor, setFzValor] = useState('')
  const [fzDesde, setFzDesde] = useState('2026-07-01')
  const openNuevaZ = () => { setEditZ(null); setFzZona(''); setFzValor(''); setFzDesde('2026-07-01'); setModalZ(true) }
  const openEditZ  = (t: TarifaZona) => { setEditZ(t); setFzZona(String(t.id_zona)); setFzValor(String(t.valor_tonelada)); setFzDesde(t.vigente_desde); setModalZ(true) }
  const saveZ = () => {
    const zona = zonasMock.find((z) => z.id === Number(fzZona))
    if (!zona) return
    const nueva: TarifaZona = { id:editZ?.id??Date.now(), zona:zona.nombre.toUpperCase(), id_zona:Number(fzZona), valor_tonelada:Number(fzValor), vigente_desde:fzDesde }
    setTarifas((prev) => editZ ? prev.map((t) => t.id===editZ.id?nueva:t) : [...prev, nueva])
    setModalZ(false)
  }

  const simTenor = '7.5'
  const simRes = useMemo(() => getPrecioAplicable(Number(simTenor), undefined, precios), [precios])

  return (
    <div className="stack">
      <div className="segment">
        <button className={`segment__btn ${subTab==='precios'?'segment__btn--active':''}`} onClick={() => setSubTab('precios')}>Precio por tenor</button>
        <button className={`segment__btn ${subTab==='tarifas'?'segment__btn--active':''}`} onClick={() => setSubTab('tarifas')}>Tarifa de flete por zona</button>
      </div>

      {subTab === 'precios' && (
        <>
          <Card title="Precios de material según tenor" actions={canWrite && <Button size="sm" icon={<Plus size={18} />} onClick={openNuevoP}>Nueva tarifa</Button>}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Tenor mín</th><th>Tenor máx</th><th>Método</th>
                  <th style={{textAlign:'right'}}>$/ton</th><th style={{textAlign:'right'}}>$/gramo</th>
                  <th>Minero</th><th>Zona</th><th>Vigente desde</th>{canWrite && <th></th>}
                </tr></thead>
                <tbody>
                  {precios.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.tenor_min.toFixed(1)}</td>
                      <td className="mono">{p.tenor_max.toFixed(1)}</td>
                      <td><span className="badge badge--info">{p.metodo==='por_tonelada'?'Por ton':'Por gramo'}</span></td>
                      <td style={{textAlign:'right'}} className="mono">{p.precio_por_tonelada?cop(p.precio_por_tonelada):'—'}</td>
                      <td style={{textAlign:'right'}} className="mono">{p.precio_por_gramo?cop(p.precio_por_gramo):'—'}</td>
                      <td style={{fontSize:'var(--fs-sm)'}}>{p.id_minero?mineros.find((m)=>m.id===p.id_minero)?.nombre:<em style={{color:'var(--text-muted)'}}>Todos</em>}</td>
                      <td style={{fontSize:'var(--fs-sm)'}}>{p.id_zona?zonasMock.find((z)=>z.id===p.id_zona)?.nombre:<em style={{color:'var(--text-muted)'}}>Todos</em>}</td>
                      <td>{formatDate(p.fecha_inicio)}</td>
                      {canWrite && <td><div className="row" style={{gap:4}}><Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEditP(p)}/><Button variant="ghost" size="sm" icon={<Trash2 size={14}/>} onClick={() => setPrecios((prev)=>prev.filter((x)=>x.id!==p.id))}/></div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {simRes && (
            <div className="callout">
              <span>Simulación tenor 7.5 gr/t → {simRes.metodo==='por_tonelada'?<><strong>{cop(simRes.precio_por_tonelada??0)}/ton</strong></>:<><strong>{cop(simRes.precio_por_gramo??0)}/gramo</strong></>} (rango {simRes.tenor_min}–{simRes.tenor_max})</span>
            </div>
          )}
        </>
      )}

      {subTab === 'tarifas' && (
        <Card title="Tarifas de flete por zona" actions={canWrite && <Button size="sm" icon={<Plus size={18}/>} onClick={openNuevaZ}>Nueva tarifa</Button>}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Zona</th><th style={{textAlign:'right'}}>$/tonelada</th><th>Vigente desde</th>{canWrite&&<th></th>}</tr></thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.id}>
                    <td style={{fontWeight:600}}>{t.zona}</td>
                    <td style={{textAlign:'right'}} className="mono">{cop(t.valor_tonelada)}</td>
                    <td>{formatDate(t.vigente_desde)}</td>
                    {canWrite && <td><div className="row" style={{gap:4}}><Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={()=>openEditZ(t)}/><Button variant="ghost" size="sm" icon={<Trash2 size={14}/>} onClick={()=>setTarifas((prev)=>prev.filter((x)=>x.id!==t.id))}/></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal precio */}
      <Modal open={modalP} title={editP?'Editar tarifa':'Nueva tarifa de material'} onClose={() => setModalP(false)}
        footer={<><Button variant="secondary" onClick={()=>setModalP(false)}>Cancelar</Button><Button onClick={saveP}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Método" options={[{value:'por_tonelada',label:'Por tonelada'},{value:'por_gramo',label:'Por gramo'}]} value={fpMetodo} onChange={(e)=>setFpMetodo(e.target.value as 'por_tonelada'|'por_gramo')} />
          <Input label="Tenor mín (gr/t)" type="number" step="0.1" value={fpTMin} onChange={(e)=>setFpTMin(e.target.value)} required />
          <Input label="Tenor máx (gr/t)" type="number" step="0.1" value={fpTMax} onChange={(e)=>setFpTMax(e.target.value)} required />
          {fpMetodo==='por_tonelada'
            ? <Input label="Precio por tonelada" type="number" value={fpPTon} onChange={(e)=>setFpPTon(e.target.value)} required />
            : <Input label="Precio por gramo"    type="number" value={fpPGramo} onChange={(e)=>setFpPGramo(e.target.value)} required />}
          <Select label="Minero (opcional)" options={[{value:'',label:'Todos los mineros'},...mineros.map((m)=>({value:String(m.id),label:m.nombre}))]} value={fpMineroId} onChange={(e)=>setFpMineroId(e.target.value)} helper="Vacío = aplica a todos" />
          <Select label="Zona (opcional)" options={[{value:'',label:'Todas las zonas'},...zonasMock.map((z)=>({value:String(z.id),label:z.nombre}))]} value={fpZonaId} onChange={(e)=>setFpZonaId(e.target.value)} />
          <Input label="Vigente desde" type="date" value={fpDesde} onChange={(e)=>setFpDesde(e.target.value)} />
        </div>
      </Modal>

      {/* Modal tarifa zona */}
      <Modal open={modalZ} title={editZ?'Editar tarifa de zona':'Nueva tarifa de zona'} onClose={()=>setModalZ(false)}
        footer={<><Button variant="secondary" onClick={()=>setModalZ(false)}>Cancelar</Button><Button onClick={saveZ}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Zona" options={[{value:'',label:'Seleccionar zona'},...zonasMock.map((z)=>({value:String(z.id),label:z.nombre}))]} value={fzZona} onChange={(e)=>setFzZona(e.target.value)} required />
          <Input label="Valor por tonelada" type="number" value={fzValor} onChange={(e)=>setFzValor(e.target.value)} required />
          <Input label="Vigente desde" type="date" value={fzDesde} onChange={(e)=>setFzDesde(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'precios',   label: 'Precios / Tarifas'  },
  { key: 'catalogos', label: 'Catálogos'           },
]
const CAT_TABS: { key: CatTab; label: string }[] = [
  { key: 'zonas',    label: 'Zonas'    },
  { key: 'minas',    label: 'Minas'    },
  { key: 'mineros',  label: 'Mineros'  },
]

export function CatalogosPage() {
  const canWrite = useCanWrite('materiales')
  const { zonas, minas, mineros: minerosSeed, add, update, remove } = useData()
  const [tab,    setTab]    = useState<MainTab>('precios')
  const [catTab, setCatTab] = useState<CatTab>('zonas')

  const zonaOptions  = zonas.map((z) => ({ value: z.id, label: z.nombre }))
  const minaOptions  = minas.map((m) => ({ value: m.id, label: m.nombre }))
  const zonaName     = (id: string) => zonas.find((z) => z.id === id)?.nombre ?? '—'
  const minaName     = (id: string) => minas.find((m) => m.id === id)?.nombre ?? '—'

  const zonaCols: ColumnDef<Zona>[]   = [{ key:'nombre', label:'Zona' }, { key:'tarifaTon', label:'Tarifa / ton', render:(z)=>cop(z.tarifaTon) }]
  const minaCols: ColumnDef<Mina>[]   = [{ key:'nombre', label:'Mina' }, { key:'zonaId', label:'Zona', render:(m)=>zonaName(m.zonaId) }, { key:'responsable', label:'Responsable' }]
  const mineroCols: ColumnDef<Minero>[] = [{ key:'nombre', label:'Minero' }, { key:'documento', label:'Doc.' }, { key:'minaId', label:'Mina', render:(m)=>minaName(m.minaId) }, { key:'telefono', label:'Tel.' }]

  return (
    <div className="page">
      <PageHeader title="Catálogos y precios" subtitle="Precios de material, tarifas de flete y catálogos base." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {MAIN_TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab===t.key}
            className={`segment__btn ${tab===t.key?'segment__btn--active':''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'precios' && <PreciosTab canWrite={canWrite} />}

      {tab === 'catalogos' && (
        <>
          <div className="segment" role="tablist" style={{ marginBottom: 14 }}>
            {CAT_TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={catTab===t.key}
                className={`segment__btn ${catTab===t.key?'segment__btn--active':''}`}
                onClick={() => setCatTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {catTab === 'zonas' && (
            <CrudManager<Zona> title="Zonas" addLabel="Nueva zona" canWrite={canWrite} items={zonas} columns={zonaCols}
              fields={[{ key:'nombre', label:'Nombre', type:'text', required:true }, { key:'tarifaTon', label:'Tarifa/ton', type:'number', required:true }]}
              mapCard={(z) => ({ title:z.nombre, subtitle:`Tarifa: ${cop(z.tarifaTon)}/ton` })}
              onCreate={(v)=>add('zonas',{id:`z${Date.now()}`,...v as object} as Zona)}
              onUpdate={(id,v)=>update('zonas',id,v as Partial<Zona>)}
              onDelete={(id)=>remove('zonas',id)} />
          )}
          {catTab === 'minas' && (
            <CrudManager<Mina> title="Minas" addLabel="Nueva mina" canWrite={canWrite} items={minas} columns={minaCols}
              fields={[{ key:'nombre', label:'Nombre', type:'text', required:true }, { key:'zonaId', label:'Zona', type:'select', options:zonaOptions, required:true }, { key:'responsable', label:'Responsable', type:'text', required:true }]}
              mapCard={(m) => ({ title:m.nombre, subtitle:`${zonaName(m.zonaId)} · ${m.responsable}` })}
              onCreate={(v)=>add('minas',{id:`m${Date.now()}`,...v as object} as Mina)}
              onUpdate={(id,v)=>update('minas',id,v as Partial<Mina>)}
              onDelete={(id)=>remove('minas',id)} />
          )}
          {catTab === 'mineros' && (
            <CrudManager<Minero> title="Mineros" addLabel="Nuevo minero" canWrite={canWrite} items={minerosSeed} columns={mineroCols}
              fields={[{ key:'nombre', label:'Nombre', type:'text', required:true }, { key:'documento', label:'Documento', type:'text', mono:true, required:true }, { key:'minaId', label:'Mina', type:'select', options:minaOptions, required:true }, { key:'telefono', label:'Teléfono', type:'text' }]}
              mapCard={(mi) => ({ title:mi.nombre, subtitle:`${minaName(mi.minaId)} · Doc. ${mi.documento}` })}
              onCreate={(v)=>add('mineros',{id:`mi${Date.now()}`,...v as object} as Minero)}
              onUpdate={(id,v)=>update('mineros',id,v as Partial<Minero>)}
              onDelete={(id)=>remove('mineros',id)} />
          )}
        </>
      )}
    </div>
  )
}
