import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Truck, TruckIcon, Users2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatDate, todayISO } from '@/utils/format'
import { duenosVolqueta as duenosMock, type DuenoVolqueta } from '@/data/mock'
import { useData } from '@/context/DataContext'
import { useMateriales } from '@/context/MaterialesContext'
import type { Volqueta } from '@/types'

type MainTab = 'volquetas' | 'duenos' | 'llegadas'

// ── Dueños de volqueta ─────────────────────────────────────
interface DuenosTabProps {
  duenos: DuenoVolqueta[]
  setDuenos: (fn: (prev: DuenoVolqueta[]) => DuenoVolqueta[]) => void
  canWrite: boolean
}
function DuenosTab({ duenos, setDuenos, canWrite }: DuenosTabProps) {
  const [modal, setModal]   = useState(false)
  const [editD, setEditD]   = useState<DuenoVolqueta | null>(null)
  const [fp, setFp] = useState({
    nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '',
    alias: '', telefono: '', nequi: '', estado: 'activo' as 'activo' | 'inactivo',
  })

  const openNuevo = () => {
    setEditD(null)
    setFp({ nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '', alias: '', telefono: '', nequi: '', estado: 'activo' })
    setModal(true)
  }
  const openEdit = (d: DuenoVolqueta) => {
    setEditD(d)
    setFp({ nombre: d.nombre, titular: d.titular ?? '', cc: d.cc ?? '', banco: d.banco ?? '', numero_cuenta: d.numero_cuenta ?? '', alias: d.alias ?? '', telefono: d.telefono ?? '', nequi: d.nequi ?? '', estado: d.estado })
    setModal(true)
  }
  const save = () => {
    if (!fp.nombre.trim()) return
    const obj: DuenoVolqueta = {
      id: editD?.id ?? Date.now(), nombre: fp.nombre.toUpperCase(),
      titular: fp.titular || undefined, cc: fp.cc || undefined, banco: fp.banco || undefined,
      numero_cuenta: fp.numero_cuenta || undefined, alias: fp.alias || undefined,
      telefono: fp.telefono || undefined, nequi: fp.nequi || undefined, estado: fp.estado,
    }
    setDuenos(prev => editD ? prev.map(d => d.id === editD.id ? obj : d) : [...prev, obj])
    setModal(false)
  }
  const del = (id: number) => {
    if (!confirm('¿Eliminar dueño de volqueta?')) return
    setDuenos(prev => prev.filter(d => d.id !== id))
  }
  const f = (k: keyof typeof fp, v: string) => setFp(s => ({ ...s, [k]: v }))

  return (
    <>
      <Card title={`Dueños de volqueta (${duenos.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={18}/>} onClick={openNuevo}>Nuevo</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th><th>Titular (cuenta)</th><th>CC</th>
                <th>Banco</th><th>N.° cuenta</th><th>Alias</th>
                <th>Nequi</th><th>Estado</th>{canWrite && <th></th>}
              </tr>
            </thead>
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
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(d)} />
                        <Button variant="ghost"     size="sm" icon={<Trash2  size={14}/>} onClick={() => del(d.id)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title={editD ? 'Editar dueño' : 'Nuevo dueño de volqueta'} onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre / alias" placeholder="ANIBAL" required value={fp.nombre} onChange={e => f('nombre', e.target.value)} />
          <Input label="Alias (pago)" placeholder="Pata de palo" value={fp.alias} onChange={e => f('alias', e.target.value)} />
          <Input label="Titular de la cuenta" placeholder="Juan Carlos Pérez" value={fp.titular} onChange={e => f('titular', e.target.value)} />
          <Input label="Cédula (CC)" type="text" placeholder="1234567890" value={fp.cc} onChange={e => f('cc', e.target.value)} />
          <Input label="Banco" placeholder="Bancolombia" value={fp.banco} onChange={e => f('banco', e.target.value)} />
          <Input label="N.° cuenta" placeholder="12345678901" value={fp.numero_cuenta} onChange={e => f('numero_cuenta', e.target.value)} />
          <Input label="Teléfono" placeholder="3001234567" value={fp.telefono} onChange={e => f('telefono', e.target.value)} />
          <Input label="Nequi" placeholder="3001234567 o 0" value={fp.nequi} onChange={e => f('nequi', e.target.value)} />
          <Select label="Estado" value={fp.estado}
            options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]}
            onChange={e => f('estado', e.target.value)} />
        </div>
      </Modal>
    </>
  )
}

// ── Volquetas (con selector de dueño) ─────────────────────
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
  const [form, setForm] = useState({
    placa: '', conductor: '', id_dueno: '', capacidadTon: '', activo: true,
  })

  const duenoOpts = [
    { value: '', label: '— Sin asignar —' },
    ...duenos.map(d => ({ value: String(d.id), label: `${d.nombre}${d.alias && d.alias !== d.nombre ? ` (${d.alias})` : ''}` })),
  ]

  const openNuevo = () => {
    setEditV(null)
    setForm({ placa: '', conductor: '', id_dueno: '', capacidadTon: '', activo: true })
    setModal(true)
  }
  const openEdit = (v: Volqueta) => {
    setEditV(v)
    setForm({
      placa: v.placa, conductor: v.conductor,
      id_dueno: v.id_dueno ? String(v.id_dueno) : '',
      capacidadTon: String(v.capacidadTon), activo: v.activo,
    })
    setModal(true)
  }
  const save = () => {
    if (!form.placa.trim() || !form.conductor.trim()) return
    const duenoSel = duenos.find(d => d.id === Number(form.id_dueno))
    const obj: Volqueta = {
      id:           editV?.id ?? `v${Date.now()}`,
      placa:        form.placa.toUpperCase(),
      conductor:    form.conductor,
      dueno:        duenoSel?.nombre ?? editV?.dueno ?? '',
      id_dueno:     duenoSel?.id,
      capacidadTon: Number(form.capacidadTon) || 0,
      activo:       form.activo,
    }
    if (editV) onUpdate(editV.id, obj)
    else       onCreate(obj)
    setModal(false)
  }
  const f = (k: keyof typeof form, v: string | boolean) => setForm(s => ({ ...s, [k]: v }))

  const selectedDueno = duenos.find(d => d.id === Number(form.id_dueno))

  return (
    <>
      <Card title={`Volquetas (${volquetas.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={18}/>} onClick={openNuevo}>Nueva volqueta</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Placa</th><th>Dueño</th><th>Conductor</th>
                <th style={{ textAlign: 'right' }}>Cap. (t)</th><th>Estado</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {volquetas.length === 0 ? (
                <tr><td colSpan={canWrite ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin volquetas registradas</td></tr>
              ) : volquetas.map(v => {
                const duenoInfo = duenos.find(d => d.id === v.id_dueno)
                return (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700 }} className="mono">{v.placa}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{v.dueno}</span>
                      {duenoInfo?.banco && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: 6 }}>{duenoInfo.banco}</span>
                      )}
                    </td>
                    <td>{v.conductor}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{v.capacidadTon}</td>
                    <td><span className={`badge badge--${v.activo ? 'success' : 'neutral'}`}>{v.activo ? 'Activa' : 'Inactiva'}</span></td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(v)} />
                          <Button variant="ghost"     size="sm" icon={<Trash2  size={14}/>}
                            onClick={() => { if (confirm(`¿Eliminar volqueta ${v.placa}?`)) onDelete(v.id) }} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title={editV ? `Editar volqueta ${editV.placa}` : 'Nueva volqueta'} onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Placa" placeholder="ABC-123" required value={form.placa}
            onChange={e => f('placa', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
          <Input label="Conductor" required value={form.conductor} onChange={e => f('conductor', e.target.value)} />
          <Select label="Dueño" options={duenoOpts} value={form.id_dueno}
            onChange={e => f('id_dueno', e.target.value)} />
          <Input label="Capacidad (toneladas)" type="number" step="0.1" value={form.capacidadTon}
            onChange={e => f('capacidadTon', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="vol-activo" checked={form.activo}
              onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="vol-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Volqueta activa</label>
          </div>
        </div>
        {selectedDueno && (
          <div className="callout" style={{ marginTop: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>{selectedDueno.nombre}</strong>
            {selectedDueno.titular && <> · {selectedDueno.titular}</>}
            {selectedDueno.banco && <> · {selectedDueno.banco}</>}
            {selectedDueno.numero_cuenta && <> · <span className="mono">{selectedDueno.numero_cuenta}</span></>}
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Llegadas de material ────────────────────────────────────
interface LlegadasTabProps {
  volquetas: Volqueta[]
  duenos: DuenoVolqueta[]
  canWrite: boolean
}
function LlegadasTab({ volquetas, duenos, canWrite }: LlegadasTabProps) {
  const { materiales, setMateriales } = useMateriales()

  // Filtros
  const [fBusqueda, setFBusqueda] = useState('')
  const [fEstado,   setFEstado]   = useState('todos')
  const [fFechaD,   setFFechaD]   = useState('')
  const [fFechaH,   setFFechaH]   = useState('')

  // Modal nueva llegada
  const [modal, setModal] = useState(false)
  const [selVolqueta, setSelVolqueta] = useState<Volqueta | null>(null)
  const [form, setForm] = useState({
    id_volqueta: '', mina: '', fecha: todayISO(), peso: '',
  })

  const volquetaOpts = [
    { value: '', label: '— Sin volqueta registrada —' },
    ...volquetas
      .filter(v => v.activo)
      .map(v => ({ value: v.id, label: `${v.placa} · ${v.conductor}${v.dueno ? ` · ${v.dueno}` : ''}` })),
  ]

  const minas = useMemo(() => [...new Set(materiales.map(m => m.mina))].sort(), [materiales])
  const minaOpts = [{ value: '', label: '— Escribir nueva —' }, ...minas.map(m => ({ value: m, label: m }))]

  const nextNumVol = useMemo(() =>
    Math.max(0, ...materiales.map(m => m.numero_volqueta)) + 1, [materiales])

  const openModal = () => {
    setSelVolqueta(null)
    setForm({ id_volqueta: '', mina: '', fecha: todayISO(), peso: '' })
    setModal(true)
  }

  const onVolquetaChange = (id: string) => {
    const v = volquetas.find(x => x.id === id) ?? null
    setSelVolqueta(v)
    setForm(f => ({ ...f, id_volqueta: id }))
  }

  const registrar = () => {
    if (!form.mina.trim() || !form.peso || Number(form.peso) <= 0) return
    const nuevo = {
      id:                   Date.now(),
      numero_volqueta:      nextNumVol,
      mina:                 form.mina.trim().toUpperCase(),
      id_volqueta:          form.id_volqueta || undefined,
      fecha:                form.fecha,
      peso_llegada_planta:  Number(form.peso),
      porcentaje_humedad:   0,
      tenor:                0,
      total_material_seco:  Number(form.peso),
      estado:               'pendiente' as const,
      lote:                 null,
    }
    setMateriales(prev => [nuevo, ...prev])
    setModal(false)
  }

  // Materiales filtrados
  const filtrados = useMemo(() => materiales.filter(m => {
    if (fEstado !== 'todos' && m.estado !== fEstado) return false
    if (fFechaD && m.fecha < fFechaD) return false
    if (fFechaH && m.fecha > fFechaH) return false
    if (fBusqueda) {
      const q = fBusqueda.toUpperCase()
      const v = m.id_volqueta ? volquetas.find(x => x.id === m.id_volqueta) : null
      if (
        !m.mina.toUpperCase().includes(q) &&
        !String(m.numero_volqueta).includes(q) &&
        !(v?.placa.toUpperCase().includes(q)) &&
        !(v?.conductor.toUpperCase().includes(q))
      ) return false
    }
    return true
  }), [materiales, fBusqueda, fEstado, fFechaD, fFechaH, volquetas])

  const pendientes   = materiales.filter(m => m.estado === 'pendiente' || m.estado === 'pagada')
  const tonPendiente = pendientes.reduce((s, m) => s + m.peso_llegada_planta, 0)

  const ESTADO_OPTS = [
    { value: 'todos',          label: 'Todos' },
    { value: 'pendiente',      label: 'Pendiente' },
    { value: 'pagada',         label: 'Pagada' },
    { value: 'en_proceso',     label: 'En proceso' },
    { value: 'incluida_viaje', label: 'En viaje' },
  ]
  const ESTADO_BADGE: Record<string, string> = {
    pendiente: 'warning', pagada: 'success', en_proceso: 'info', incluida_viaje: 'neutral',
  }

  const duenoOf = (m: { id_volqueta?: string }) => {
    const v = m.id_volqueta ? volquetas.find(x => x.id === m.id_volqueta) : null
    if (!v) return null
    const d = duenos.find(x => x.id === v.id_dueno)
    return { v, d }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total registros"   value={materiales.length}               accent="brown"  icon={<TruckIcon size={16}/>} />
        <KpiTile label="Sin procesar"      value={pendientes.length}               accent="rose"    />
        <KpiTile label="Ton húmedo pend."  value={`${tonPendiente.toFixed(2)} t`}  accent="amber"  />
        <KpiTile label="Volquetas activas" value={volquetas.filter(v=>v.activo).length} accent="green" />
      </div>

      <Card title={`Llegadas de material (${filtrados.length} / ${materiales.length})`}
        actions={canWrite && (
          <Button size="sm" icon={<Plus size={15}/>} onClick={openModal}>Registrar llegada</Button>
        )}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <input className="field__input" placeholder="Buscar mina, placa, N° vol…"
            value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} style={{ maxWidth: '14rem' }} />
          <input className="field__input" type="date" title="Desde" value={fFechaD}
            onChange={e => setFFechaD(e.target.value)} style={{ maxWidth: '10rem' }} />
          <input className="field__input" type="date" title="Hasta" value={fFechaH}
            onChange={e => setFFechaH(e.target.value)} style={{ maxWidth: '10rem' }} />
          <div className="segment">
            {ESTADO_OPTS.map(o => (
              <button key={o.value}
                className={`segment__btn ${fEstado === o.value ? 'segment__btn--active' : ''}`}
                onClick={() => setFEstado(o.value)}>{o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th><th>N° Vol.</th><th>Placa</th><th>Conductor</th>
                <th>Dueño</th><th>Mina</th>
                <th style={{ textAlign: 'right' }}>T. Húm.</th>
                <th style={{ textAlign: 'right' }}>Tenor</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map(m => {
                const linked = duenoOf(m)
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{m.numero_volqueta}</td>
                    <td className="mono" style={{ color: linked?.v ? 'var(--text)' : 'var(--text-faint)', fontWeight: linked?.v ? 600 : 400 }}>
                      {linked?.v?.placa ?? '—'}
                    </td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{linked?.v?.conductor ?? '—'}</td>
                    <td style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                      {linked?.d?.nombre ?? linked?.v?.dueno ?? '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.mina}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.tenor > 0 ? <span style={{ color: 'var(--amber-700)', fontWeight: 700 }}>{m.tenor.toFixed(1)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    <td>
                      <span className={`badge badge--${ESTADO_BADGE[m.estado] ?? 'neutral'}`}>
                        {m.estado === 'incluida_viaje' ? 'Viaje' : m.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal registrar llegada */}
      <Modal open={modal} title="Registrar llegada de material" onClose={() => setModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button onClick={registrar} disabled={!form.mina.trim() || !form.peso || Number(form.peso) <= 0}>
            Registrar
          </Button>
        </>}>

        <div className="grid grid--form">
          <Select label="Volqueta (placa · conductor · dueño)" options={volquetaOpts}
            value={form.id_volqueta} onChange={e => onVolquetaChange(e.target.value)}
            style={{ gridColumn: '1/-1' }} />
        </div>

        {selVolqueta && (
          <div className="callout" style={{ margin: '0.5rem 0 0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>Placa:</strong> {selVolqueta.placa}
            {' · '}<strong>Conductor:</strong> {selVolqueta.conductor}
            {selVolqueta.dueno && <> · <strong>Dueño:</strong> {selVolqueta.dueno}</>}
            {selVolqueta.id_dueno && (() => {
              const d = duenos.find(x => x.id === selVolqueta.id_dueno)
              return d ? (
                <>
                  {d.banco && <> · {d.banco}</>}
                  {d.numero_cuenta && <> · <span className="mono">{d.numero_cuenta}</span></>}
                </>
              ) : null
            })()}
          </div>
        )}

        <div className="grid grid--form">
          <Select label="Mina / Minero" options={minaOpts}
            value={minas.includes(form.mina) ? form.mina : ''}
            onChange={e => setForm(f => ({ ...f, mina: e.target.value }))} />
          {(!form.mina || !minas.includes(form.mina)) && (
            <Input label="Mina / Minero (nueva)" placeholder="NAUM, OMAR M80, JEFERSON…" required
              value={form.mina} onChange={e => setForm(f => ({ ...f, mina: e.target.value }))} />
          )}
          <Input label="Fecha de llegada" type="date" required
            value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Input label="Peso bruto (toneladas húmedas)" type="number" step="0.01" required placeholder="Ej: 11.250"
            value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
            helper={`Se asignará N° volqueta: ${nextNumVol}`} />
        </div>
      </Modal>
    </>
  )
}

// ── Página principal ───────────────────────────────────────
export function VolquetasPage() {
  const canWrite = useCanWrite('materiales')
  const { volquetas, add, update, remove } = useData()
  const [tab, setTab] = useState<MainTab>('volquetas')
  const [duenos, setDuenos] = useState<DuenoVolqueta[]>(duenosMock)

  return (
    <div className="page">
      <PageHeader
        title="Volquetas y dueños"
        subtitle="Registro de volquetas, propietarios y llegadas de material a planta."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'volquetas'}
          className={`segment__btn ${tab === 'volquetas' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('volquetas')}>
          <Truck size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Volquetas
        </button>
        <button role="tab" aria-selected={tab === 'duenos'}
          className={`segment__btn ${tab === 'duenos' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('duenos')}>
          <Users2 size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Dueños
        </button>
        <button role="tab" aria-selected={tab === 'llegadas'}
          className={`segment__btn ${tab === 'llegadas' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('llegadas')}>
          <TruckIcon size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
          Llegadas de material
        </button>
      </div>

      {tab === 'volquetas' && (
        <VolquetasTab
          volquetas={volquetas}
          duenos={duenos}
          canWrite={canWrite}
          onCreate={v => add('volquetas', v)}
          onUpdate={(id, v) => update('volquetas', id, v)}
          onDelete={id => remove('volquetas', id)}
        />
      )}
      {tab === 'duenos'   && <DuenosTab duenos={duenos} setDuenos={setDuenos} canWrite={canWrite} />}
      {tab === 'llegadas' && <LlegadasTab volquetas={volquetas} duenos={duenos} canWrite={canWrite} />}
    </div>
  )
}
