import { Fragment, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  HandCoins, ImageIcon, Pencil, Plus, Trash2, Truck, TruckIcon, Users2,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MineroField } from '@/components/common/MineroField'
import { useCanWrite } from '@/hooks/usePermissions'
import { cop, formatDate, todayISO } from '@/utils/format'
import {
  duenosVolqueta as duenosMock,
  tarifasZona, zonas as zonasReal,
  type DuenoVolqueta, type MaterialRow,
} from '@/data/mock'
import { useData } from '@/context/DataContext'
import { useMateriales } from '@/context/MaterialesContext'
import type { CuentaPorPagar, Volqueta } from '@/types'

// ── AbonoProveedor ────────────────────────────────────────────
interface AbonoProveedor {
  id: number
  id_dueno: number
  fecha: string
  monto: number
  tipo: 'transferencia' | 'deposito' | 'efectivo' | 'otro'
  comprobante_img?: string // base64 comprimida
  nota?: string
}

// ── Persistencia abonos ───────────────────────────────────────
const LS_ABONOS = 'molinos_abonos_prov_v1'
function loadAbonos(): AbonoProveedor[] {
  try { const raw = localStorage.getItem(LS_ABONOS); return raw ? JSON.parse(raw) : [] } catch { return [] }
}
function saveAbonos(data: AbonoProveedor[]) {
  try { localStorage.setItem(LS_ABONOS, JSON.stringify(data)) } catch { /* quota */ }
}

// ── Helpers período ───────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodoLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}
function periodoEndDate(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// ── Helpers zona / imagen ─────────────────────────────────────
function getTarifa(idZona: number): number {
  return tarifasZona.find(t => t.id_zona === idZona)?.valor_tonelada ?? 0
}

function compressImage(file: File, maxPx = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type MainTab = 'volquetas' | 'duenos' | 'llegadas' | 'pagos'

// ── DuenosTab ─────────────────────────────────────────────────
interface DuenosTabProps {
  duenos: DuenoVolqueta[]
  setDuenos: (fn: (prev: DuenoVolqueta[]) => DuenoVolqueta[]) => void
  canWrite: boolean
}
function DuenosTab({ duenos, setDuenos, canWrite }: DuenosTabProps) {
  const [modal, setModal] = useState(false)
  const [editD, setEditD]   = useState<DuenoVolqueta | null>(null)
  const [fp, setFp] = useState({ nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '', alias: '', telefono: '', nequi: '', estado: 'activo' as 'activo' | 'inactivo' })

  const openNuevo = () => { setEditD(null); setFp({ nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '', alias: '', telefono: '', nequi: '', estado: 'activo' }); setModal(true) }
  const openEdit = (d: DuenoVolqueta) => { setEditD(d); setFp({ nombre: d.nombre, titular: d.titular ?? '', cc: d.cc ?? '', banco: d.banco ?? '', numero_cuenta: d.numero_cuenta ?? '', alias: d.alias ?? '', telefono: d.telefono ?? '', nequi: d.nequi ?? '', estado: d.estado }); setModal(true) }
  const save = () => {
    if (!fp.nombre.trim()) return
    const obj: DuenoVolqueta = { id: editD?.id ?? Date.now(), nombre: fp.nombre.toUpperCase(), titular: fp.titular || undefined, cc: fp.cc || undefined, banco: fp.banco || undefined, numero_cuenta: fp.numero_cuenta || undefined, alias: fp.alias || undefined, telefono: fp.telefono || undefined, nequi: fp.nequi || undefined, estado: fp.estado }
    setDuenos(prev => editD ? prev.map(d => d.id === editD.id ? obj : d) : [...prev, obj])
    setModal(false)
  }
  const del = (id: number) => { if (!confirm('¿Eliminar dueño?')) return; setDuenos(prev => prev.filter(d => d.id !== id)) }
  const f = (k: keyof typeof fp, v: string) => setFp(s => ({ ...s, [k]: v }))

  return (
    <>
      <Card title={`Dueños de volqueta (${duenos.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={18}/>} onClick={openNuevo}>Nuevo</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Titular</th><th>CC</th><th>Banco</th><th>N.° cuenta</th><th>Alias</th><th>Nequi</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {duenos.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700 }}>{d.nombre}</td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{d.titular ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{d.cc ?? '—'}</td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{d.banco ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{d.numero_cuenta ?? '—'}</td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{d.alias ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{d.nequi && d.nequi !== '0' ? d.nequi : '—'}</td>
                  <td><span className={`badge badge--${d.estado === 'activo' ? 'success' : 'neutral'}`}>{d.estado}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(d)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14}/>} onClick={() => del(d.id)} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title={editD ? 'Editar dueño' : 'Nuevo dueño de volqueta'} onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" placeholder="ANIBAL" required value={fp.nombre} onChange={e => f('nombre', e.target.value)} />
          <Input label="Alias (pago)" placeholder="Pata de palo" value={fp.alias} onChange={e => f('alias', e.target.value)} />
          <Input label="Titular de la cuenta" value={fp.titular} onChange={e => f('titular', e.target.value)} />
          <Input label="Cédula (CC)" value={fp.cc} onChange={e => f('cc', e.target.value)} />
          <Input label="Banco" value={fp.banco} onChange={e => f('banco', e.target.value)} />
          <Input label="N.° cuenta" value={fp.numero_cuenta} onChange={e => f('numero_cuenta', e.target.value)} />
          <Input label="Teléfono" value={fp.telefono} onChange={e => f('telefono', e.target.value)} />
          <Input label="Nequi" value={fp.nequi} onChange={e => f('nequi', e.target.value)} />
          <Select label="Estado" value={fp.estado} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} onChange={e => f('estado', e.target.value)} />
        </div>
      </Modal>
    </>
  )
}

// ── VolquetasTab ──────────────────────────────────────────────
interface VolquetasTabProps {
  volquetas: Volqueta[]
  duenos: DuenoVolqueta[]
  canWrite: boolean
  onCreate: (v: Volqueta) => void
  onUpdate: (id: string, v: Partial<Volqueta>) => void
  onDelete: (id: string) => void
}
function VolquetasTab({ volquetas, duenos, canWrite, onCreate, onUpdate, onDelete }: VolquetasTabProps) {
  const [modal, setModal] = useState(false)
  const [editV, setEditV] = useState<Volqueta | null>(null)
  const [form, setForm] = useState({ placa: '', conductor: '', id_dueno: '', capacidadTon: '', activo: true })

  const duenoOpts = [{ value: '', label: '— Sin asignar —' }, ...duenos.map(d => ({ value: String(d.id), label: `${d.nombre}${d.alias && d.alias !== d.nombre ? ` (${d.alias})` : ''}` }))]
  const openNuevo = () => { setEditV(null); setForm({ placa: '', conductor: '', id_dueno: '', capacidadTon: '', activo: true }); setModal(true) }
  const openEdit = (v: Volqueta) => { setEditV(v); setForm({ placa: v.placa, conductor: v.conductor, id_dueno: v.id_dueno ? String(v.id_dueno) : '', capacidadTon: String(v.capacidadTon), activo: v.activo }); setModal(true) }
  const save = () => {
    if (!form.placa.trim() || !form.conductor.trim()) return
    const duenoSel = duenos.find(d => d.id === Number(form.id_dueno))
    const obj: Volqueta = { id: editV?.id ?? `v${Date.now()}`, placa: form.placa.toUpperCase(), conductor: form.conductor, dueno: duenoSel?.nombre ?? editV?.dueno ?? '', id_dueno: duenoSel?.id, capacidadTon: Number(form.capacidadTon) || 0, activo: form.activo }
    if (editV) onUpdate(editV.id, obj); else onCreate(obj)
    setModal(false)
  }
  const f = (k: keyof typeof form, v: string | boolean) => setForm(s => ({ ...s, [k]: v }))
  const selectedDueno = duenos.find(d => d.id === Number(form.id_dueno))

  return (
    <>
      <Card title={`Volquetas (${volquetas.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={18}/>} onClick={openNuevo}>Nueva volqueta</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Placa</th><th>Dueño</th><th>Conductor</th><th style={{ textAlign: 'right' }}>Cap. (t)</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {volquetas.length === 0 ? (
                <tr><td colSpan={canWrite ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin volquetas</td></tr>
              ) : volquetas.map(v => {
                const di = duenos.find(d => d.id === v.id_dueno)
                return (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700 }} className="mono">{v.placa}</td>
                    <td><span style={{ fontWeight: 600 }}>{v.dueno || '—'}</span>{di?.banco && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: 6 }}>{di.banco}</span>}</td>
                    <td>{v.conductor}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{v.capacidadTon}</td>
                    <td><span className={`badge badge--${v.activo ? 'success' : 'neutral'}`}>{v.activo ? 'Activa' : 'Inactiva'}</span></td>
                    {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(v)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14}/>} onClick={() => { if (confirm(`¿Eliminar ${v.placa}?`)) onDelete(v.id) }} /></div></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title={editV ? `Editar ${editV.placa}` : 'Nueva volqueta'} onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Placa" placeholder="ABC-123" required value={form.placa} onChange={e => f('placa', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
          <Input label="Conductor" required value={form.conductor} onChange={e => f('conductor', e.target.value)} />
          <Select label="Dueño" options={duenoOpts} value={form.id_dueno} onChange={e => f('id_dueno', e.target.value)} />
          <Input label="Capacidad (ton)" type="number" step="0.1" value={form.capacidadTon} onChange={e => f('capacidadTon', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="vol-activo" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="vol-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Volqueta activa</label>
          </div>
        </div>
        {selectedDueno && (
          <div className="callout" style={{ marginTop: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>{selectedDueno.nombre}</strong>{selectedDueno.titular && <> · {selectedDueno.titular}</>}
            {selectedDueno.banco && <> · {selectedDueno.banco}</>}
            {selectedDueno.numero_cuenta && <> · <span className="mono">{selectedDueno.numero_cuenta}</span></>}
          </div>
        )}
      </Modal>
    </>
  )
}

// ── LlegadasTab ───────────────────────────────────────────────
interface LlegadasTabProps {
  volquetas: Volqueta[]
  duenos: DuenoVolqueta[]
  canWrite: boolean
  onCreateVolqueta: (v: Volqueta) => void
}
function LlegadasTab({ volquetas, duenos, canWrite, onCreateVolqueta }: LlegadasTabProps) {
  const { materiales, setMateriales } = useMateriales()

  // Filtros
  const [fBusqueda, setFBusqueda] = useState('')
  const [fEstado,   setFEstado]   = useState('todos')
  const [fFechaD,   setFFechaD]   = useState('')
  const [fFechaH,   setFFechaH]   = useState('')
  const [fDueno,    setFDueno]    = useState('')

  // Modal registro / edición
  const [modal, setModal]     = useState(false)
  const [editando, setEditando] = useState<MaterialRow | null>(null)
  const [selVolqueta, setSelVolqueta] = useState<Volqueta | null>(null)
  const [form, setForm] = useState({ id_volqueta: '', id_dueno: '', mina: '', id_zona: '', fecha: todayISO(), peso: '', acpm: '', numVol: '', estado: 'pendiente' })

  // Mini-form nueva volqueta
  const [showNuevaVol, setShowNuevaVol] = useState(false)
  const [nvForm, setNvForm] = useState({ placa: '', conductor: '', id_dueno: '' })

  const zonaOpts = [
    { value: '', label: '— Sin zona —' },
    ...zonasReal.map(z => { const t = getTarifa(z.id); return { value: String(z.id), label: `${z.nombre}${t ? ` · ${cop(t)}/t` : ' · Sin tarifa'}` } }),
  ]
  const volquetaOpts = [
    { value: '', label: '— Seleccionar —' },
    ...volquetas.filter(v => v.activo).map(v => ({ value: v.id, label: `${v.placa}${v.dueno ? ` · ${v.dueno}` : ''}` })),
  ]
  const duenoOpts = [{ value: '', label: '— Sin asignar —' }, ...duenos.filter(d => d.estado === 'activo').map(d => ({ value: String(d.id), label: d.nombre + (d.alias && d.alias !== d.nombre ? ` (${d.alias})` : '') }))]
  const duenoFiltroOpts = [{ value: '', label: 'Todos los dueños' }, ...duenos.map(d => ({ value: String(d.id), label: d.nombre }))]

  const nextNumVol = useMemo(() => Math.max(0, ...materiales.map(m => m.numero_volqueta)) + 1, [materiales])
  const minasConocidas = useMemo(() => [...new Set(materiales.map(m => m.mina))].filter(s => s && s !== '—').sort(), [materiales])

  const valorFlete = useMemo(() => {
    const peso = Number(form.peso) || 0
    const idZona = Number(form.id_zona) || 0
    return peso * getTarifa(idZona)
  }, [form.peso, form.id_zona])

  const openNuevo = () => {
    setEditando(null)
    setSelVolqueta(null)
    setForm({ id_volqueta: '', id_dueno: '', mina: '', id_zona: '', fecha: todayISO(), peso: '', acpm: '', numVol: String(nextNumVol), estado: 'pendiente' })
    setShowNuevaVol(false)
    setNvForm({ placa: '', conductor: '', id_dueno: '' })
    setModal(true)
  }

  const openEdit = (m: MaterialRow) => {
    setEditando(m)
    const v = m.id_volqueta ? volquetas.find(x => x.id === m.id_volqueta) ?? null : null
    setSelVolqueta(v)
    const dId = m.id_dueno ?? v?.id_dueno
    setForm({
      id_volqueta: m.id_volqueta ?? '',
      id_dueno:    dId ? String(dId) : '',
      mina:        m.mina === '—' ? '' : m.mina,
      id_zona:     m.id_zona ? String(m.id_zona) : '',
      fecha:       m.fecha,
      peso:        String(m.peso_llegada_planta),
      acpm:        m.acpm ? String(m.acpm) : '',
      numVol:      String(m.numero_volqueta),
      estado:      m.estado,
    })
    setShowNuevaVol(false)
    setModal(true)
  }

  const guardarValido = Number(form.peso) > 0

  const onVolquetaChange = (id: string) => {
    const v = volquetas.find(x => x.id === id) ?? null
    setSelVolqueta(v)
    setForm(f => ({ ...f, id_volqueta: id, id_dueno: v?.id_dueno ? String(v.id_dueno) : f.id_dueno }))
  }

  const crearVolquetaRapido = () => {
    if (!nvForm.placa.trim() || !nvForm.conductor.trim()) return
    const duenoSel = duenos.find(d => d.id === Number(nvForm.id_dueno))
    const nueva: Volqueta = { id: `v${Date.now()}`, placa: nvForm.placa.toUpperCase(), conductor: nvForm.conductor, dueno: duenoSel?.nombre ?? '', id_dueno: duenoSel?.id, capacidadTon: 0, activo: true }
    onCreateVolqueta(nueva)
    setSelVolqueta(nueva)
    setForm(f => ({ ...f, id_volqueta: nueva.id, id_dueno: duenoSel ? String(duenoSel.id) : f.id_dueno }))
    setShowNuevaVol(false)
    setNvForm({ placa: '', conductor: '', id_dueno: '' })
  }

  const guardar = () => {
    if (!guardarValido) return
    const zona = form.id_zona ? Number(form.id_zona) : undefined
    const zonaLabel = zona ? (zonasReal.find(z => z.id === zona)?.nombre ?? '') : ''
    const numVolFinal = Number(form.numVol) || nextNumVol
    const base = {
      mina:                form.mina.trim().toUpperCase() || zonaLabel || '—',
      id_volqueta:         form.id_volqueta || undefined,
      id_dueno:            form.id_dueno ? Number(form.id_dueno) : undefined,
      id_zona:             zona,
      valor_flete:         valorFlete > 0 ? valorFlete : undefined,
      fecha:               form.fecha,
      peso_llegada_planta: Number(form.peso),
      total_material_seco: Number(form.peso),
      acpm:                form.acpm ? Number(form.acpm) : undefined,
      estado:              form.estado as MaterialRow['estado'],
    }
    if (editando) {
      setMateriales(prev => prev.map(m => m.id === editando.id ? { ...m, ...base, numero_volqueta: numVolFinal } : m))
    } else {
      const nuevo: MaterialRow = { ...base, id: Date.now(), numero_volqueta: numVolFinal, porcentaje_humedad: 0, tenor: 0, lote: null }
      setMateriales(prev => [nuevo, ...prev])
    }
    setModal(false)
  }

  const duenoOf = (m: MaterialRow) => {
    const v = m.id_volqueta ? volquetas.find(x => x.id === m.id_volqueta) : null
    const dId = m.id_dueno ?? v?.id_dueno
    const d = dId ? duenos.find(x => x.id === dId) : undefined
    return { v, d }
  }

  const filtrados = useMemo(() => materiales.filter(m => {
    if (fEstado !== 'todos' && m.estado !== fEstado) return false
    if (fFechaD && m.fecha < fFechaD) return false
    if (fFechaH && m.fecha > fFechaH) return false
    if (fDueno) {
      const { v, d } = duenoOf(m)
      const dId = d?.id ?? (v?.id_dueno) ?? m.id_dueno
      if (dId !== Number(fDueno)) return false
    }
    if (fBusqueda) {
      const q = fBusqueda.toUpperCase()
      const { v } = duenoOf(m)
      if (!m.mina.toUpperCase().includes(q) && !String(m.numero_volqueta).includes(q) && !(v?.placa.toUpperCase().includes(q)) && !(v?.conductor.toUpperCase().includes(q))) return false
    }
    return true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiales, fBusqueda, fEstado, fFechaD, fFechaH, fDueno, volquetas, duenos])

  const pendientes   = materiales.filter(m => m.estado === 'pendiente')
  const tonPendiente = pendientes.reduce((s, m) => s + m.peso_llegada_planta, 0)

  const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const fmtDia = (iso: string) => { const [y,m,d] = iso.split('-'); return `${d}/${MESES_CORTOS[Number(m)-1]}/${y.slice(2)}` }
  const ESTADO_PAGO_BADGE: Record<string, { label: string; cls: string }> = {
    pendiente:      { label: 'Flete pendiente', cls: 'warning' },
    pagada:         { label: 'Flete pagado',    cls: 'success' },
    en_proceso:     { label: 'En proceso',       cls: 'info'    },
    incluida_viaje: { label: 'En viaje',         cls: 'neutral' },
  }
  const matAnalisisBadge = (m: MaterialRow) => {
    if (m.estado === 'incluida_viaje') return { label: 'En viaje', cls: 'neutral' }
    if (m.estado === 'en_proceso')     return { label: 'En planta', cls: 'info' }
    if (m.tenor > 0)                   return { label: 'Con tenor', cls: 'success' }
    if (m.porcentaje_humedad > 0)      return { label: 'Analizado', cls: 'info' }
    return { label: 'Sin análisis', cls: 'neutral' }
  }
  const ESTADO_OPTS_PAGO = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'pagada', label: 'Pagado' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'incluida_viaje', label: 'En viaje' },
  ]

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total registros"   value={materiales.length}               accent="brown" icon={<TruckIcon size={16}/>} />
        <KpiTile label="Sin procesar"      value={pendientes.length}               accent="rose"  />
        <KpiTile label="Ton húmedo pend."  value={`${tonPendiente.toFixed(2)} t`}  accent="amber" />
        <KpiTile label="Volquetas activas" value={volquetas.filter(v=>v.activo).length} accent="green" />
      </div>

      <Card title={`Llegadas de material (${filtrados.length} / ${materiales.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={15}/>} onClick={openNuevo}>Registrar llegada</Button>}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input className="field__input" placeholder="Buscar mina, placa…" value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} style={{ maxWidth: '13rem' }} />
          <input className="field__input" type="date" title="Desde" value={fFechaD} onChange={e => setFFechaD(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" title="Hasta" value={fFechaH} onChange={e => setFFechaH(e.target.value)} style={{ maxWidth: '9rem' }} />
          <select className="field__input" value={fDueno} onChange={e => setFDueno(e.target.value)} style={{ maxWidth: '13rem' }}>
            {duenoFiltroOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="segment" style={{ marginBottom: '1rem' }}>
          {ESTADO_OPTS_PAGO.map(o => <button key={o.value} className={`segment__btn ${fEstado === o.value ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(o.value)}>{o.label}</button>)}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N°</th>
                <th>Volqueta · Dueño</th>
                <th>Mina · Zona</th>
                <th style={{ textAlign: 'right' }}>Tons</th>
                <th style={{ textAlign: 'right' }}>ACPM</th>
                <th style={{ textAlign: 'right' }}>Flete</th>
                <th>Pago flete</th>
                <th>Material</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map(m => {
                const { v, d } = duenoOf(m)
                const zona = m.id_zona ? zonasReal.find(z => z.id === m.id_zona) : undefined
                const pagoBadge = ESTADO_PAGO_BADGE[m.estado] ?? { label: m.estado, cls: 'neutral' }
                const matBadge  = matAnalisisBadge(m)
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>{fmtDia(m.fecha)}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{m.numero_volqueta}</td>
                    <td>
                      <div className="mono" style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{v?.placa ?? '—'}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{d?.nombre ?? v?.dueno ?? '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{m.mina && m.mina !== '—' ? m.mina : <em style={{ color: 'var(--text-faint)' }}>—</em>}</div>
                      {zona && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{zona.nombre}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(2)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.acpm ? <span style={{ color: '#b45309', fontWeight: 600 }}>{cop(m.acpm)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.valor_flete ? <span style={{ color: 'var(--amber-700)', fontWeight: 600 }}>{cop(m.valor_flete)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    <td><span className={`badge badge--${pagoBadge.cls}`}>{pagoBadge.label}</span></td>
                    <td><span className={`badge badge--${matBadge.cls}`}>{matBadge.label}</span></td>
                    {canWrite && <td><Button variant="secondary" size="sm" icon={<Pencil size={13}/>} onClick={() => openEdit(m)} /></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal registrar / editar llegada */}
      <Modal open={modal} title={editando ? `Editar llegada N° ${editando.numero_volqueta}` : 'Registrar llegada'}
        onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={guardar} disabled={!guardarValido}>{editando ? 'Guardar cambios' : 'Registrar'}</Button></>}>

        {/* Selección de volqueta */}
        <Select label="Volqueta" options={volquetaOpts} value={form.id_volqueta} onChange={e => onVolquetaChange(e.target.value)} style={{ marginBottom: '0.5rem' }} />

        {selVolqueta && (
          <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>{selVolqueta.placa}</strong>
            {selVolqueta.dueno && <> · Dueño: <strong>{selVolqueta.dueno}</strong></>}
          </div>
        )}

        {/* Crear volqueta nueva si no existe */}
        {!selVolqueta && !showNuevaVol && (
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-700)', fontSize: 'var(--fs-sm)', textDecoration: 'underline', padding: 0, marginBottom: '0.75rem', display: 'block' }}
            onClick={() => setShowNuevaVol(true)}>+ Volqueta nueva (no está en la lista)</button>
        )}
        {showNuevaVol && (
          <div style={{ border: '1.5px solid var(--amber-300)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '0.75rem', background: '#fffbf0' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', marginBottom: '0.5rem' }}>Registrar nueva volqueta</div>
            <div className="grid grid--form" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Input label="Placa" placeholder="ABC-123" value={nvForm.placa} onChange={e => setNvForm(f => ({ ...f, placa: e.target.value }))} style={{ fontFamily: 'var(--font-mono)' }} />
              <Input label="Conductor" value={nvForm.conductor} onChange={e => setNvForm(f => ({ ...f, conductor: e.target.value }))} />
              <div style={{ gridColumn: '1/-1' }}>
                <Select label="Dueño" options={duenoOpts} value={nvForm.id_dueno} onChange={e => setNvForm(f => ({ ...f, id_dueno: e.target.value }))} />
              </div>
            </div>
            <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button size="sm" onClick={crearVolquetaRapido} disabled={!nvForm.placa.trim() || !nvForm.conductor.trim()}>Crear y seleccionar</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowNuevaVol(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Datos de la llegada */}
        <div className="grid grid--form">
          <Input label="N° volqueta" type="number" step="1" placeholder={String(nextNumVol)}
            value={form.numVol} onChange={e => setForm(f => ({ ...f, numVol: e.target.value }))}
            helper="Número que usted asigna al registro" />
          <Input label="Fecha de llegada" type="date" required value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <MineroField value={form.mina} onChange={v => setForm(f => ({ ...f, mina: v }))} extraKnown={minasConocidas} />
          <Select label="Zona / tarifa de flete" options={zonaOpts} value={form.id_zona}
            onChange={e => setForm(f => ({ ...f, id_zona: e.target.value }))} />
          <Input label="Toneladas (peso húmedo)" type="number" step="0.01" required placeholder="Ej: 11.250"
            value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))} />
          <Input label="ACPM adelantado (COP)" type="number" step="1000" placeholder="0"
            value={form.acpm} onChange={e => setForm(f => ({ ...f, acpm: e.target.value }))}
            helper="Dinero de gasolina entregado al conductor" />
          <Select label="Estado del flete" value={form.estado}
            options={ESTADO_OPTS_PAGO.filter(o => o.value !== 'todos').map(o => ({ value: o.value, label: o.label }))}
            onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
        </div>

        {valorFlete > 0 && (
          <div className="callout" style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>
            <strong>Flete a pagar:</strong>{' '}
            <span style={{ color: 'var(--amber-700)', fontWeight: 700 }}>{cop(valorFlete)}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({Number(form.peso)} t × {cop(getTarifa(Number(form.id_zona)))} / t)</span>
          </div>
        )}
        {form.acpm && Number(form.acpm) > 0 && (
          <div style={{ marginTop: '0.3rem', fontSize: 'var(--fs-xs)', color: '#b45309' }}>
            ACPM {cop(Number(form.acpm))} se descontará del flete al pagar
          </div>
        )}
      </Modal>
    </>
  )
}

// ── PagosTab ──────────────────────────────────────────────────
interface PagosTabProps {
  duenos: DuenoVolqueta[]
  materiales: MaterialRow[]
  volquetas: Volqueta[]
  abonos: AbonoProveedor[]
  setAbonos: (fn: (prev: AbonoProveedor[]) => AbonoProveedor[]) => void
  canWrite: boolean
}
function PagosTab({ duenos, materiales, volquetas, abonos, setAbonos, canWrite }: PagosTabProps) {
  const { add: addDataCtx } = useData()

  // ── Filtros ───────────────────────────────────────────────────
  const [fDueno,   setFDueno]   = useState('')     // id como string; '' = todos

  // ── Abono modal ───────────────────────────────────────────────
  const [expandedRow,    setExpandedRow]    = useState<string | null>(null)
  const [selMonth,       setSelMonth]       = useState<string>(() => todayISO().slice(0, 7))
  const [abonoModal,     setAbonoModal]     = useState(false)
  const [abonoTarget,    setAbonoTarget]    = useState<DuenoVolqueta | null>(null)
  const [editandoAbono,  setEditandoAbono]  = useState<AbonoProveedor | null>(null)
  const [imgPreview,     setImgPreview]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [abonoForm, setAbonoForm] = useState({
    fecha: todayISO(), monto: '', tipo: 'transferencia' as AbonoProveedor['tipo'],
    nota: '', comprobante_img: '',
  })
  const af = (k: keyof typeof abonoForm, v: string) => setAbonoForm(f => ({ ...f, [k]: v }))

  const shiftMonth = (delta: number) => {
    const [y, m] = selMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setExpandedRow(null)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await compressImage(file)
    af('comprobante_img', b64)
    setImgPreview(b64)
  }

  // ── Mes actual del sistema ────────────────────────────────────
  const currentMonth = todayISO().slice(0, 7)
  const getDId = (m: MaterialRow) =>
    m.id_dueno ?? (m.id_volqueta ? volquetas.find(v => v.id === m.id_volqueta)?.id_dueno : undefined)

  // ── Balance acumulado (histórico completo) por dueño ──────────
  const overall = useMemo(() => {
    return duenos.map(d => {
      const mats = materiales.filter(m => getDId(m) === d.id)
      const totalFlete   = mats.reduce((s, m) => s + (m.valor_flete ?? 0), 0)
      const totalAcpm    = mats.reduce((s, m) => s + (m.acpm ?? 0), 0)
      const totalAbonado = abonos.filter(a => a.id_dueno === d.id).reduce((s, a) => s + a.monto, 0)
      const saldo = totalFlete - totalAcpm - totalAbonado
      return { dueno: d, totalFlete, totalAcpm, totalAbonado, saldo, nViajes: mats.length }
    }).filter(e => e.nViajes > 0 || e.totalAbonado > 0 || Math.abs(e.saldo) > 0.01)
      .sort((a, b) => b.saldo - a.saldo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duenos, materiales, volquetas, abonos])

  // ── Mes más antiguo con actividad (límite del navegador) ──────
  const firstMonth = useMemo(() => {
    let earliest = currentMonth
    for (const m of materiales) if (m.fecha && m.fecha.slice(0, 7) < earliest) earliest = m.fecha.slice(0, 7)
    for (const a of abonos)     if (a.fecha && a.fecha.slice(0, 7) < earliest) earliest = a.fecha.slice(0, 7)
    return earliest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiales, abonos, currentMonth])

  // ── Datos del mes seleccionado (todo editable, saldos encadenados) ──
  const monthView = useMemo(() => {
    const mesStart = `${selMonth}-01`
    const mesEnd   = periodoEndDate(selMonth)
    const rows = duenos.map(d => {
      // Saldo arrastrado: TODA la historia previa al mes (así, editar el pasado mueve todo)
      const saldoInicio =
          materiales.filter(m => getDId(m) === d.id && m.fecha < mesStart).reduce((s, m) => s + (m.valor_flete ?? 0) - (m.acpm ?? 0), 0)
        - abonos.filter(a => a.id_dueno === d.id && a.fecha < mesStart).reduce((s, a) => s + a.monto, 0)
      const viajesMes = materiales
        .filter(m => getDId(m) === d.id && m.fecha >= mesStart && m.fecha <= mesEnd)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      const abonosMes = abonos
        .filter(a => a.id_dueno === d.id && a.fecha >= mesStart && a.fecha <= mesEnd)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
      const totalFlete   = viajesMes.reduce((s, m) => s + (m.valor_flete ?? 0), 0)
      const totalAcpm    = viajesMes.reduce((s, m) => s + (m.acpm ?? 0), 0)
      const totalAbonado = abonosMes.reduce((s, a) => s + a.monto, 0)
      const saldoFin     = saldoInicio + totalFlete - totalAcpm - totalAbonado
      return { d, saldoInicio, viajesMes, abonosMes, totalFlete, totalAcpm, totalAbonado, saldoFin }
    }).filter(r => r.viajesMes.length > 0 || r.abonosMes.length > 0 || Math.abs(r.saldoInicio) > 0.01 || Math.abs(r.saldoFin) > 0.01)
      .sort((a, b) => b.saldoFin - a.saldoFin)
    return {
      rows,
      totalFlete:   rows.reduce((s, r) => s + r.totalFlete, 0),
      totalAcpm:    rows.reduce((s, r) => s + r.totalAcpm, 0),
      totalAbonado: rows.reduce((s, r) => s + r.totalAbonado, 0),
      saldoFin:     rows.reduce((s, r) => s + r.saldoFin, 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selMonth, duenos, materiales, volquetas, abonos])

  // ── Abono ─────────────────────────────────────────────────────
  const openAbono = (d: DuenoVolqueta) => {
    setAbonoTarget(d)
    setEditandoAbono(null)
    setImgPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    setAbonoForm({ fecha: todayISO(), monto: '', tipo: 'transferencia', nota: '', comprobante_img: '' })
    setAbonoModal(true)
  }

  const openEditAbono = (a: AbonoProveedor, d: DuenoVolqueta) => {
    setAbonoTarget(d)
    setEditandoAbono(a)
    setImgPreview(a.comprobante_img ?? null)
    if (fileRef.current) fileRef.current.value = ''
    setAbonoForm({ fecha: a.fecha, monto: String(a.monto), tipo: a.tipo, nota: a.nota ?? '', comprobante_img: a.comprobante_img ?? '' })
    setAbonoModal(true)
  }

  const guardarAbono = () => {
    if (!abonoTarget || !abonoForm.monto || Number(abonoForm.monto) <= 0) return
    if (editandoAbono) {
      const actualizado: AbonoProveedor = { ...editandoAbono, fecha: abonoForm.fecha, monto: Number(abonoForm.monto), tipo: abonoForm.tipo, comprobante_img: abonoForm.comprobante_img || undefined, nota: abonoForm.nota || undefined }
      setAbonos(prev => { const next = prev.map(x => x.id === editandoAbono.id ? actualizado : x); saveAbonos(next); return next })
    } else {
      const nuevo: AbonoProveedor = {
        id: Date.now(), id_dueno: abonoTarget.id, fecha: abonoForm.fecha,
        monto: Number(abonoForm.monto), tipo: abonoForm.tipo,
        comprobante_img: abonoForm.comprobante_img || undefined,
        nota: abonoForm.nota || undefined,
      }
      setAbonos(prev => { const next = [nuevo, ...prev]; saveAbonos(next); return next })
      const cp: CuentaPorPagar = {
        id: `abono-${Date.now()}`,
        concepto: `Pago volqueta — ${abonoTarget.nombre}${abonoForm.nota ? ` (${abonoForm.nota})` : ''}`,
        tipo: 'proveedor', beneficiario: abonoTarget.nombre,
        monto: Number(abonoForm.monto), saldo: 0, fechaVencimiento: abonoForm.fecha,
        estado: abonoForm.comprobante_img ? 'pendiente' : 'pagado',
        origen: 'automatico', comprobante: null,
      }
      addDataCtx('porPagar', cp)
    }
    setAbonoModal(false)
  }

  const eliminarAbono = (id: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    setAbonos(prev => { const next = prev.filter(x => x.id !== id); saveAbonos(next); return next })
  }

  const TIPO_LABELS: Record<AbonoProveedor['tipo'], string> = {
    transferencia: 'Transferencia', deposito: 'Depósito', efectivo: 'Efectivo', otro: 'Otro',
  }
  const TIPO_OPTS = Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))

  // ── Totales para KPIs (histórico completo) ────────────────────
  const totalPorPagar = overall.filter(e => e.saldo > 0).reduce((s, e) => s + e.saldo, 0)
  const totalPagado   = overall.reduce((s, e) => s + e.totalAbonado + e.totalAcpm, 0)
  const conSaldo      = overall.filter(e => e.saldo > 0.01).length
  const aFavor        = overall.filter(e => e.saldo < -0.01).length

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Con saldo pendiente" value={conSaldo} accent="rose" icon={<AlertCircle size={16}/>} />
        <KpiTile label="Total por pagar"     value={cop(totalPorPagar)}  accent="amber" />
        <KpiTile label="Total pagado"        value={cop(totalPagado)}    accent="green" />
        <KpiTile label="Saldos a favor"      value={aFavor} accent="brown" />
      </div>

      {/* ── Barra de acciones principal ── */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>

        {/* Selector de volquetero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Volquetero</span>
          <select className="field__input" style={{ minWidth: '13rem' }} value={fDueno} onChange={e => setFDueno(e.target.value)}>
            <option value="">Todos</option>
            {duenos.filter(d => d.estado === 'activo').map(d => (
              <option key={d.id} value={String(d.id)}>{d.nombre}{d.alias && d.alias !== d.nombre ? ` (${d.alias})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Navegador de mes */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mes</span>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button type="button" onClick={() => shiftMonth(-1)} disabled={selMonth <= firstMonth}
              title="Mes anterior"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth <= firstMonth ? 'not-allowed' : 'pointer', color: selMonth <= firstMonth ? 'var(--text-faint)' : 'var(--text)' }}>
              <ChevronLeft size={18}/>
            </button>
            <input className="field__input" type="month" value={selMonth} max={currentMonth}
              onChange={e => { if (e.target.value) { setSelMonth(e.target.value); setExpandedRow(null) } }}
              style={{ maxWidth: '10rem' }} />
            <button type="button" onClick={() => shiftMonth(1)} disabled={selMonth >= currentMonth}
              title="Mes siguiente"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth >= currentMonth ? 'not-allowed' : 'pointer', color: selMonth >= currentMonth ? 'var(--text-faint)' : 'var(--text)' }}>
              <ChevronRight size={18}/>
            </button>
            {selMonth !== currentMonth && (
              <button type="button" onClick={() => { setSelMonth(currentMonth); setExpandedRow(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                Hoy
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Vista del mes seleccionado (calendario) ── */}
      {overall.length === 0 ? (
        <Card title="Control de pagos">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            Sin viajes con propietario asignado. Registra llegadas con dueño para ver el balance.
          </p>
        </Card>
      ) : (() => {
        const rows = fDueno ? monthView.rows.filter(r => String(r.d.id) === fDueno) : monthView.rows
        return (
          <Card title={`Estado de cuenta — ${periodoLabel(selMonth)}${selMonth === currentMonth ? ' · mes actual' : ''}`}>
            {rows.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
                Sin actividad en <strong>{periodoLabel(selMonth)}</strong>.
                {selMonth !== currentMonth && <> Usa las flechas o «Hoy» para volver al mes actual.</>}
              </p>
            ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '1.5rem' }}></th>
                    <th>Dueño</th>
                    <th style={{ textAlign: 'right' }}>Saldo inicio</th>
                    <th style={{ textAlign: 'right' }}>Flete mes</th>
                    <th style={{ textAlign: 'right' }}>ACPM</th>
                    <th style={{ textAlign: 'right' }}>Abonado</th>
                    <th style={{ textAlign: 'right' }}>Saldo fin mes</th>
                    {canWrite && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const rowKey = `${selMonth}::${r.d.id}`
                    const isExp = expandedRow === rowKey
                    const sc = r.saldoFin
                    return (
                      <Fragment key={rowKey}>
                        <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                          onClick={() => setExpandedRow(isExp ? null : rowKey)}>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {isExp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle', background: sc <= 0.01 ? '#16a34a' : r.totalAbonado === 0 ? '#dc2626' : '#f59e0b' }}
                              title={sc <= 0.01 ? 'Pagado' : r.totalAbonado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                            {r.d.nombre}
                            {r.d.banco && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: 16 }}>{r.d.banco}</div>}
                          </td>
                          <td style={{ textAlign: 'right', color: r.saldoInicio > 0 ? '#b45309' : r.saldoInicio < 0 ? '#15803d' : 'var(--text-muted)' }} className="mono">
                            {r.saldoInicio !== 0 ? cop(Math.abs(r.saldoInicio)) : '—'}
                            {r.saldoInicio > 0 && <div style={{ fontSize: '0.6rem', color: '#b45309' }}>debía</div>}
                            {r.saldoInicio < 0 && <div style={{ fontSize: '0.6rem', color: '#15803d' }}>a favor</div>}
                          </td>
                          <td style={{ textAlign: 'right' }} className="mono">{r.totalFlete > 0 ? cop(r.totalFlete) : '—'}</td>
                          <td style={{ textAlign: 'right', color: '#b45309' }} className="mono">{r.totalAcpm > 0 ? cop(r.totalAcpm) : '—'}</td>
                          <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{r.totalAbonado > 0 ? cop(r.totalAbonado) : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: sc > 0 ? '#b45309' : sc < 0 ? '#15803d' : 'var(--text-muted)' }} className="mono">
                            {sc === 0 ? <span style={{ color: '#15803d', fontSize: 'var(--fs-sm)' }}>Saldado</span> : cop(Math.abs(sc))}
                            {sc > 0 && <div style={{ fontSize: '0.6rem', color: '#b45309' }}>por pagar</div>}
                            {sc < 0 && <div style={{ fontSize: '0.6rem', color: '#15803d' }}>a favor</div>}
                          </td>
                          {canWrite && (
                            <td onClick={e => e.stopPropagation()}>
                              <Button size="sm" icon={<Banknote size={13}/>} onClick={() => openAbono(r.d)}>Abonar</Button>
                            </td>
                          )}
                        </tr>

                        {isExp && (
                          <tr>
                            <td colSpan={canWrite ? 8 : 7} style={{ padding: '0.75rem 1rem', background: '#fafaf9' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Viajes del mes */}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.4rem', color: 'var(--amber-800)' }}>
                                    Viajes ({r.viajesMes.length})
                                  </div>
                                  {r.viajesMes.length === 0 ? (
                                    <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin viajes</em>
                                  ) : (
                                    <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                                      <thead><tr style={{ color: 'var(--text-muted)' }}>
                                        <th style={{ textAlign: 'left', padding: '2px 4px' }}>Fecha</th>
                                        <th style={{ textAlign: 'left', padding: '2px 4px' }}>Mina</th>
                                        <th style={{ textAlign: 'right', padding: '2px 4px' }}>ACPM</th>
                                        <th style={{ textAlign: 'right', padding: '2px 4px' }}>Flete</th>
                                      </tr></thead>
                                      <tbody>
                                        {r.viajesMes.map(m => (
                                          <tr key={m.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '3px 4px' }}>{formatDate(m.fecha)}</td>
                                            <td style={{ padding: '3px 4px', fontWeight: 600 }}>{m.mina}</td>
                                            <td style={{ padding: '3px 4px', textAlign: 'right', color: '#b45309' }} className="mono">{m.acpm ? cop(m.acpm) : '—'}</td>
                                            <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{m.valor_flete ? cop(m.valor_flete) : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr style={{ fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                                          <td colSpan={2} style={{ padding: '3px 4px' }}>Total</td>
                                          <td style={{ padding: '3px 4px', textAlign: 'right', color: '#b45309' }} className="mono">{cop(r.totalAcpm)}</td>
                                          <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{cop(r.totalFlete)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  )}
                                </div>

                                {/* Abonos del mes */}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.4rem', color: 'var(--amber-800)' }}>
                                    Abonos ({r.abonosMes.length})
                                  </div>
                                  {r.abonosMes.length === 0 ? (
                                    <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos</em>
                                  ) : (
                                    <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                                      <thead><tr style={{ color: 'var(--text-muted)' }}>
                                        <th style={{ textAlign: 'left', padding: '2px 4px' }}>Fecha</th>
                                        <th style={{ textAlign: 'left', padding: '2px 4px' }}>Método</th>
                                        <th style={{ textAlign: 'right', padding: '2px 4px' }}>Monto</th>
                                        <th style={{ padding: '2px 4px' }}></th>
                                      </tr></thead>
                                      <tbody>
                                        {r.abonosMes.map(a => (
                                          <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '3px 4px' }}>{formatDate(a.fecha)}</td>
                                            <td style={{ padding: '3px 4px' }}>{TIPO_LABELS[a.tipo]}</td>
                                            <td style={{ padding: '3px 4px', textAlign: 'right', color: '#15803d', fontWeight: 700 }} className="mono">{cop(a.monto)}</td>
                                            <td style={{ padding: '3px 4px' }}>
                                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                {a.comprobante_img && (
                                                  <a href={a.comprobante_img} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ color: 'var(--amber-700)', display: 'flex' }}>
                                                    <ImageIcon size={13}/>
                                                  </a>
                                                )}
                                                {canWrite && (
                                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-600)' }}
                                                    onClick={() => openEditAbono(a, r.d)} title="Editar abono">
                                                    <Pencil size={12}/>
                                                  </button>
                                                )}
                                                {canWrite && (
                                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}
                                                    onClick={() => eliminarAbono(a.id)} title="Eliminar">
                                                    <Trash2 size={12}/>
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>

                              {/* Resumen del mes */}
                              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: sc > 0 ? '#fef3c7' : sc < 0 ? '#dcfce7' : '#f3f4f6', borderRadius: 6, fontSize: 'var(--fs-sm)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                {r.saldoInicio !== 0 && <span>Saldo inicio: <strong>{cop(Math.abs(r.saldoInicio))}</strong> {r.saldoInicio > 0 ? '(debía)' : '(a favor)'}</span>}
                                <span>+ Flete: <strong>{cop(r.totalFlete)}</strong></span>
                                {r.totalAcpm > 0 && <span>− ACPM: <strong style={{ color: '#b45309' }}>{cop(r.totalAcpm)}</strong></span>}
                                {r.totalAbonado > 0 && <span>− Pagado: <strong style={{ color: '#15803d' }}>{cop(r.totalAbonado)}</strong></span>}
                                <span style={{ fontWeight: 800 }}>= Saldo fin: <strong style={{ color: sc > 0 ? '#b45309' : sc < 0 ? '#15803d' : 'var(--text-muted)' }}>{sc === 0 ? 'Saldado' : cop(Math.abs(sc))}</strong></span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={3}>Total</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(rows.reduce((s, r) => s + r.totalFlete, 0))}</td>
                    <td style={{ textAlign: 'right', color: '#b45309' }} className="mono">{cop(rows.reduce((s, r) => s + r.totalAcpm, 0))}</td>
                    <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(rows.reduce((s, r) => s + r.totalAbonado, 0))}</td>
                    <td style={{ textAlign: 'right', color: '#b45309' }} className="mono">{cop(rows.reduce((s, r) => s + r.saldoFin, 0))}</td>
                    {canWrite && <td/>}
                  </tr>
                </tfoot>
              </table>
            </div>
            )}
          </Card>
        )
      })()}

      {/* ── Modal abono ── */}
      <Modal open={abonoModal} title={editandoAbono ? `Editar pago — ${abonoTarget?.nombre ?? ''}` : `Registrar pago — ${abonoTarget?.nombre ?? ''}`} onClose={() => setAbonoModal(false)}
        footer={<><Button variant="secondary" onClick={() => setAbonoModal(false)}>Cancelar</Button><Button icon={<Banknote size={16}/>} onClick={guardarAbono} disabled={!abonoForm.monto || Number(abonoForm.monto) <= 0}>{editandoAbono ? 'Guardar cambios' : 'Registrar pago'}</Button></>}>

        {abonoTarget && (() => {
          const entry = overall.find(e => e.dueno.id === abonoTarget.id)
          if (!entry) return null
          return (
            <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)' }}>
              {entry.saldo > 0 && <>Saldo pendiente: <span style={{ fontWeight: 800, color: '#b45309' }}>{cop(entry.saldo)}</span></>}
              {entry.saldo < 0 && <><strong>{abonoTarget.nombre}</strong> tiene <span style={{ fontWeight: 800, color: '#0f6e3a' }}>{cop(Math.abs(entry.saldo))}</span> a favor</>}
              {entry.saldo === 0 && <><strong>{abonoTarget.nombre}</strong> está al día</>}
            </div>
          )
        })()}

        <div className="grid grid--form">
          <Input label="Fecha" type="date" required value={abonoForm.fecha} onChange={e => af('fecha', e.target.value)} />
          <Input label="Monto (COP)" type="number" step="1000" required placeholder="Ej: 5000000" value={abonoForm.monto} onChange={e => af('monto', e.target.value)} />
          <Select label="Método" options={TIPO_OPTS} value={abonoForm.tipo} onChange={e => af('tipo', e.target.value)} />
          <Input label="Nota (opcional)" placeholder="Referencia o aclaración" value={abonoForm.nota} onChange={e => af('nota', e.target.value)} />
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Foto del comprobante</div>
            <input ref={fileRef} id="comp-file" type="file" accept="image/*" onChange={handleFile}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            {!imgPreview ? (
              <label htmlFor="comp-file" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--amber-400)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
                <ImageIcon size={18} style={{ color: 'var(--amber-600)' }} /> Subir foto del depósito / transferencia
              </label>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgPreview} alt="comprobante" style={{ maxHeight: 160, borderRadius: 8, border: '1.5px solid var(--border-default)', display: 'block' }} />
                <button onClick={() => { setImgPreview(null); af('comprobante_img', ''); if (fileRef.current) fileRef.current.value = '' }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <label htmlFor="comp-file" style={{ display: 'block', marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--amber-700)', cursor: 'pointer', textDecoration: 'underline' }}>Cambiar foto</label>
              </div>
            )}
            {imgPreview && <div style={{ marginTop: '0.3rem', fontSize: 'var(--fs-xs)', color: '#0f6e3a' }}>Comprobante adjunto — pendiente de aprobación</div>}
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Página principal ──────────────────────────────────────────
export function VolquetasPage() {
  const canWrite = useCanWrite('materiales')
  const { volquetas, add, update, remove } = useData()
  const { materiales } = useMateriales()
  const [tab, setTab] = useState<MainTab>('volquetas')
  const [duenos, setDuenos] = useState<DuenoVolqueta[]>(duenosMock)
  const [abonos, setAbonos] = useState<AbonoProveedor[]>(loadAbonos)

  return (
    <div className="page">
      <PageHeader title="Volquetas y dueños" subtitle="Registro de volquetas, propietarios, llegadas de material y control de pagos." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        {([
          { key: 'volquetas', label: 'Volquetas',  Icon: Truck      },
          { key: 'duenos',   label: 'Dueños',      Icon: Users2     },
          { key: 'llegadas', label: 'Llegadas',     Icon: TruckIcon  },
          { key: 'pagos',    label: 'Pagos',        Icon: HandCoins  },
        ] as const).map(({ key, label, Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key}
            className={`segment__btn ${tab === key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(key)}>
            <Icon size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'volquetas' && (
        <VolquetasTab volquetas={volquetas} duenos={duenos} canWrite={canWrite}
          onCreate={v => add('volquetas', v)} onUpdate={(id, v) => update('volquetas', id, v)} onDelete={id => remove('volquetas', id)} />
      )}
      {tab === 'duenos' && <DuenosTab duenos={duenos} setDuenos={setDuenos} canWrite={canWrite} />}
      {tab === 'llegadas' && <LlegadasTab volquetas={volquetas} duenos={duenos} canWrite={canWrite} onCreateVolqueta={v => add('volquetas', v)} />}
      {tab === 'pagos' && <PagosTab duenos={duenos} materiales={materiales} volquetas={volquetas} abonos={abonos} setAbonos={setAbonos} canWrite={canWrite} />}
    </div>
  )
}
