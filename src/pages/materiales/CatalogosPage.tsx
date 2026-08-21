import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { CrudManager, type ColumnDef } from '@/components/common/CrudManager'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate } from '@/utils/format'
import { tarifasZona, zonas as zonasMock, type TarifaZona } from '@/data/mock'
import type { Mina, Minero, Zona } from '@/types'

const cop = formatCOP

type MainTab = 'tarifas' | 'catalogos'
type CatTab = 'zonas' | 'minas' | 'mineros'

// ── Tarifa de flete por zona ──────────────────────────────
function TarifasFleteTab({ canWrite }: { canWrite: boolean }) {
  const [tarifas, setTarifas] = useState<TarifaZona[]>(tarifasZona)

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

  return (
    <div className="stack">
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
  { key: 'tarifas',   label: 'Tarifas de flete' },
  { key: 'catalogos', label: 'Catálogos'         },
]
const CAT_TABS: { key: CatTab; label: string }[] = [
  { key: 'zonas',    label: 'Zonas'    },
  { key: 'minas',    label: 'Minas'    },
  { key: 'mineros',  label: 'Mineros'  },
]

export function CatalogosPage() {
  const canWrite = useCanWrite('materiales')
  const { zonas, minas, mineros: minerosSeed, add, update, remove } = useData()
  const [tab,    setTab]    = useState<MainTab>('tarifas')
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
      <PageHeader title="Catálogos y tarifas" subtitle="Tarifas de flete por zona y catálogos base." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {MAIN_TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab===t.key}
            className={`segment__btn ${tab===t.key?'segment__btn--active':''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'tarifas' && <TarifasFleteTab canWrite={canWrite} />}

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
