import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Select, Modal, KpiTile, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { DuenoSelect, ZonaSelect } from '@/components/common/CatalogSelectors'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { useDuenos, invalidateMaterialCatalog } from '@/hooks/useMaterialCatalogos'
import { useEntradas, invalidateEntradas } from '@/hooks/useEntradas'
import { apiError } from '@/api/client'
import { formatCOP } from '@/utils/format'
import { materialApi, num, type Volqueta, type TarifaZona, type EstadoEntrada, type EstadoPagoFlete, type EntradaRow } from '@/api/material'
import { LlegadaModal } from './EntradasApiPage'
import { PagoFleteTab } from './PagoFleteApiPage'

const cop = formatCOP

const CODE_MSG: Record<string, string> = {
  ENTRADA_CON_ANALISIS: 'No se puede borrar: la entrada tiene análisis. Bórralos primero o cámbiala a cancelada.',
  ENTRADA_CON_SALIDAS: 'No se puede borrar: la entrada tiene salidas/inventario asociado.',
  ENTRADA_NO_ELIMINABLE: 'Esta entrada no se puede borrar en su estado actual.',
}

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// Estados de tabla reutilizables (loading / error / vacío).
function TableState({ loading, error, empty, cols, onRetry }: {
  loading: boolean; error: string | null; empty: boolean; cols: number; onRetry?: () => void
}) {
  if (loading) return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
  if (error) return (
    <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
      {error}{onRetry && <> · <button onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Reintentar</button></>}
    </td></tr>
  )
  if (empty) return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin registros</td></tr>
  return null
}

// ════════════════════════════════════════════════════════════════════════════
// DUEÑOS
// ════════════════════════════════════════════════════════════════════════════
function DuenosTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { data, loading, error, reload } = useDuenos()
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '', alias: '', telefono: '', ciudad: '', nequi: false, estado: 'activo' })
  const f = (k: keyof typeof form, v: string | boolean) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm({ nombre: '', titular: '', cc: '', banco: '', numero_cuenta: '', alias: '', telefono: '', ciudad: '', nequi: false, estado: 'activo' }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const d = data.find(x => x.id === id)!
    setForm({ nombre: d.nombre, titular: d.titular ?? '', cc: d.cc ?? '', banco: d.banco ?? '', numero_cuenta: d.numero_cuenta ?? '', alias: d.alias ?? '', telefono: d.telefono ?? '', ciudad: d.ciudad ?? '', nequi: !!num(d.nequi), estado: d.estado })
    setModal(id)
  }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    const body = {
      nombre: form.nombre.trim(), titular: form.titular || undefined, cc: form.cc || undefined,
      banco: form.banco || undefined, numero_cuenta: form.numero_cuenta || undefined, alias: form.alias || undefined,
      telefono: form.telefono || undefined, ciudad: form.ciudad || undefined, nequi: form.nequi, estado: form.estado,
    }
    try {
      if (modal === 'nuevo') { await materialApi.createDueno(body); toast.success('Dueño creado') }
      else if (typeof modal === 'number') { await materialApi.updateDueno(modal, body); toast.success('Dueño actualizado') }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const del = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar el dueño "${nombre}"?`)) return
    try { await materialApi.deleteDueno(id); toast.success('Dueño eliminado'); reload() }
    catch (e) { const { code, message } = apiError(e); toast.error(code ? (CODE_MSG[code] ?? message) : message) }
  }

  return (
    <>
      <Card title={`Dueños de volqueta (${data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nuevo dueño</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Alias</th><th>Banco</th><th>N.° cuenta</th><th>Teléfono</th><th>Nequi</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 8 : 7} onRetry={reload} />
              {!loading && !error && data.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700 }}>{d.nombre}</td>
                  <td>{d.alias ?? '—'}</td>
                  <td>{d.banco ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{d.numero_cuenta ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{d.telefono ?? '—'}</td>
                  <td>{num(d.nequi) ? 'Sí' : '—'}</td>
                  <td><span className={`badge badge--${d.estado === 'activo' ? 'success' : 'neutral'}`}>{d.estado}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(d.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(d.id, d.nombre)} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo dueño' : 'Editar dueño'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          <Input label="Alias (pago)" value={form.alias} onChange={e => f('alias', e.target.value)} />
          <Input label="Titular de la cuenta" value={form.titular} onChange={e => f('titular', e.target.value)} />
          <Input label="Cédula (CC)" value={form.cc} onChange={e => f('cc', e.target.value)} />
          <Input label="Banco" value={form.banco} onChange={e => f('banco', e.target.value)} />
          <Input label="N.° cuenta" value={form.numero_cuenta} onChange={e => f('numero_cuenta', e.target.value)} />
          <Input label="Teléfono" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
          <Input label="Ciudad" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="vol-dueno-nequi" checked={form.nequi} onChange={e => f('nequi', e.target.checked)} />
            <label htmlFor="vol-dueno-nequi" style={{ cursor: 'pointer', userSelect: 'none' }}>Usa Nequi</label>
          </div>
          {typeof modal === 'number' && <Select label="Estado" options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} value={form.estado} onChange={e => f('estado', e.target.value)} />}
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VOLQUETAS (vehículos)
// ════════════════════════════════════════════════════════════════════════════
function VolquetasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [todas, setTodas] = useState(false)
  const [data, setData] = useState<Volqueta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ id_dueno: '' as number | '', placa: '', tipo_vehiculo: '', conductor: '', conductor_cc: '', capacidad_ton: '', activo: true })
  const f = (k: keyof typeof form, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getVolquetas(todas).then(setData).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [todas])
  useEffect(() => { load() }, [load])

  const openNuevo = () => { setForm({ id_dueno: '', placa: '', tipo_vehiculo: '', conductor: '', conductor_cc: '', capacidad_ton: '', activo: true }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const v = data.find(x => x.id === id)!
    setForm({ id_dueno: v.dueno_id ?? '', placa: v.placa, tipo_vehiculo: v.tipo_vehiculo ?? '', conductor: v.conductor ?? '', conductor_cc: '', capacidad_ton: v.capacidad_ton != null ? String(num(v.capacidad_ton)) : '', activo: !!num(v.activo) })
    setModal(id)
  }
  const save = async () => {
    if (!form.placa.trim()) return
    setSaving(true)
    try {
      if (modal === 'nuevo') {
        if (form.id_dueno === '') { toast.error('Selecciona el dueño de la volqueta'); setSaving(false); return }
        await materialApi.createVolqueta({
          id_dueno_volqueta: form.id_dueno, placa: form.placa.trim().toUpperCase(),
          tipo_vehiculo: form.tipo_vehiculo || undefined, conductor: form.conductor || undefined,
          conductor_cc: form.conductor_cc || undefined,
          capacidad_ton: form.capacidad_ton ? Number(form.capacidad_ton) : undefined,
          activo: form.activo ? 1 : 0,
        })
        toast.success('Volqueta creada')
      } else if (typeof modal === 'number') {
        await materialApi.updateVolqueta(modal, {
          id_dueno_volqueta: form.id_dueno === '' ? undefined : form.id_dueno,
          placa: form.placa.trim().toUpperCase(), tipo_vehiculo: form.tipo_vehiculo || undefined,
          conductor: form.conductor || undefined, conductor_cc: form.conductor_cc || undefined,
          capacidad_ton: form.capacidad_ton ? Number(form.capacidad_ton) : undefined,
          activo: form.activo ? 1 : 0,
        })
        toast.success('Volqueta actualizada')
      }
      setModal(null); invalidateMaterialCatalog('volquetas'); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const del = async (id: number, placa: string) => {
    if (!confirm(`¿Eliminar la volqueta ${placa}?`)) return
    try { await materialApi.deleteVolqueta(id); toast.success('Volqueta eliminada'); invalidateMaterialCatalog('volquetas'); load() }
    catch (e) { const { code, message } = apiError(e); toast.error(code ? (CODE_MSG[code] ?? message) : message) }
  }

  return (
    <>
      <Card title={`Volquetas (${data.length})`} actions={<div className="row" style={{ gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={todas} onChange={e => setTodas(e.target.checked)} /> Ver inactivas
        </label>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nueva volqueta</Button>}
      </div>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Placa</th><th>Dueño</th><th>Conductor</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Cap. (t)</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 7 : 6} onRetry={load} />
              {!loading && !error && data.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700 }} className="mono">{v.placa}</td>
                  <td>{v.dueno ?? v.dueno_nombre ?? '—'}</td>
                  <td>{v.conductor ?? '—'}</td>
                  <td>{v.tipo_vehiculo ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{v.capacidad_ton != null ? num(v.capacidad_ton) : '—'}</td>
                  <td><span className={`badge badge--${num(v.activo) ? 'success' : 'neutral'}`}>{num(v.activo) ? 'Activa' : 'Inactiva'}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(v.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(v.id, v.placa)} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nueva volqueta' : 'Editar volqueta'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.placa.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <DuenoSelect required value={form.id_dueno} onChange={v => f('id_dueno', v)} />
          <Input label="Placa" required value={form.placa} onChange={e => f('placa', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
          <Input label="Conductor" value={form.conductor} onChange={e => f('conductor', e.target.value)} />
          <Input label="Cédula conductor" value={form.conductor_cc} onChange={e => f('conductor_cc', e.target.value)} />
          <Input label="Tipo de vehículo" value={form.tipo_vehiculo} onChange={e => f('tipo_vehiculo', e.target.value)} placeholder="Volqueta / Mula…" />
          <Input label="Capacidad (t)" type="number" step="0.1" value={form.capacidad_ton} onChange={e => f('capacidad_ton', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="vol-api-activo" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="vol-api-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Volqueta activa</label>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TARIFAS DE FLETE POR ZONA (Tarifa_Zona)
// ════════════════════════════════════════════════════════════════════════════
function TarifasFleteTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<TarifaZona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [del, setDel] = useState<{ id: number; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ id_zona: '' as number | '', valor_tonelada: '', vigente_desde: '', vigente_hasta: '', activo: true })
  const f = (k: keyof typeof form, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getTarifasZona().then(setData).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const openNuevo = () => { setForm({ id_zona: '', valor_tonelada: '', vigente_desde: '', vigente_hasta: '', activo: true }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const t = data.find(x => x.id === id)!
    setForm({
      id_zona: t.id_zona ?? '', valor_tonelada: t.valor_tonelada != null ? String(num(t.valor_tonelada)) : '',
      vigente_desde: t.vigente_desde?.slice(0, 10) ?? '', vigente_hasta: t.vigente_hasta?.slice(0, 10) ?? '', activo: !!num(t.activo),
    })
    setModal(id)
  }
  const save = async () => {
    if (!form.valor_tonelada) return
    setSaving(true)
    try {
      if (modal === 'nuevo') {
        if (form.id_zona === '') { toast.error('Selecciona la zona'); setSaving(false); return }
        await materialApi.createTarifaZona({
          id_zona: form.id_zona, valor_tonelada: Number(form.valor_tonelada),
          vigente_desde: form.vigente_desde || undefined, vigente_hasta: form.vigente_hasta || undefined, activo: form.activo,
        })
        toast.success('Tarifa creada')
      } else if (typeof modal === 'number') {
        await materialApi.updateTarifaZona(modal, {
          id_zona: form.id_zona === '' ? undefined : form.id_zona, valor_tonelada: Number(form.valor_tonelada),
          vigente_desde: form.vigente_desde || undefined, vigente_hasta: form.vigente_hasta || undefined, activo: form.activo,
        })
        toast.success('Tarifa actualizada')
      }
      setModal(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const confirmDelete = async () => {
    if (!del) return
    setDeleting(true)
    try { await materialApi.deleteTarifaZona(del.id); toast.success('Tarifa eliminada'); setDel(null); load() }
    catch (e) { toast.error(apiError(e).message); setDel(null) } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Tarifas de flete por zona (${data.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nueva tarifa</Button>}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Flete base por tonelada de cada zona. Al activar una tarifa nueva se cierra la vigente anterior de esa zona.
          El flete de cada entrada se calcula al registrarla; aquí solo se administran las tarifas base.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Zona</th><th style={{ textAlign: 'right' }}>Valor /t</th><th>Vigente desde</th><th>Vigente hasta</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 6 : 5} onRetry={load} />
              {!loading && !error && data.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.zona ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(num(t.valor_tonelada))}</td>
                  <td>{t.vigente_desde ? fmtDMY(t.vigente_desde) : '—'}</td>
                  <td>{t.vigente_hasta ? fmtDMY(t.vigente_hasta) : <em style={{ color: 'var(--text-faint)' }}>vigente</em>}</td>
                  <td><span className={`badge badge--${num(t.activo) ? 'success' : 'neutral'}`}>{num(t.activo) ? 'Activa' : 'Cerrada'}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(t.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDel({ id: t.id, label: `la tarifa de ${t.zona ?? 'la zona'}` })} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nueva tarifa de flete' : 'Editar tarifa'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.valor_tonelada}>Guardar</Button></>}>
        <div className="grid grid--form">
          <ZonaSelect required value={form.id_zona} onChange={v => f('id_zona', v)} showTarifa={false} />
          <Input label="Valor por tonelada (COP)" type="number" step="1000" required value={form.valor_tonelada} onChange={e => f('valor_tonelada', e.target.value)} />
          <Input label="Vigente desde" type="date" value={form.vigente_desde} onChange={e => f('vigente_desde', e.target.value)} />
          <Input label="Vigente hasta" type="date" value={form.vigente_hasta} onChange={e => f('vigente_hasta', e.target.value)} helper="Opcional. Vacío = vigente." />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="tarifa-flete-activo" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="tarifa-flete-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Tarifa activa</label>
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!del} title="Borrar tarifa" itemLabel={del?.label} loading={deleting}
        onCancel={() => setDel(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LLEGADAS — lista de entradas por volqueta/dueño (registrar/editar/borrar)
// ════════════════════════════════════════════════════════════════════════════
const FLETE_BADGE: Record<EstadoPagoFlete, { label: string; cls: string }> = {
  pendiente: { label: 'Flete pendiente', cls: 'warning' },
  parcial: { label: 'Flete parcial', cls: 'info' },
  pagado: { label: 'Flete pagado', cls: 'success' },
  no_aplica: { label: 'N/A', cls: 'neutral' },
}

const ESTADO_OPTS: { key: EstadoEntrada | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'pagada', label: 'Pagado' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'incluida_viaje', label: 'En viaje' },
]

// Estado del material (igual que el mock: en viaje / en planta / con tenor / …).
function materialBadge(m: EntradaRow): { label: string; cls: string } {
  if (m.estado === 'incluida_viaje') return { label: 'En viaje', cls: 'neutral' }
  if (m.estado === 'en_proceso') return { label: 'En planta', cls: 'info' }
  if (num(m.tenor) > 0) return { label: 'Con tenor', cls: 'success' }
  if (num(m.tiene_analisis_cabeza)) return { label: 'Analizado', cls: 'info' }
  return { label: 'Sin análisis', cls: 'neutral' }
}

function LlegadasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { data: all, loading, error, reload } = useEntradas()
  const [busqueda, setBusqueda] = useState('')
  const [duenoF, setDuenoF] = useState('todos')
  const [estadoF, setEstadoF] = useState<EstadoEntrada | 'todos'>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [llegadaOpen, setLlegadaOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [del, setDel] = useState<{ id: number; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = () => { invalidateEntradas(); reload() }

  const duenos = useMemo(() => [...new Set(all.map(m => m.dueno_volqueta).filter(Boolean) as string[])].sort(), [all])

  const filtrados = useMemo(() => all.filter(m => {
    if (estadoF !== 'todos' && m.estado !== estadoF) return false
    if (duenoF !== 'todos' && m.dueno_volqueta !== duenoF) return false
    const f = m.fecha_llegada?.slice(0, 10) ?? ''
    if (fechaDesde && f < fechaDesde) return false
    if (fechaHasta && f > fechaHasta) return false
    if (busqueda) {
      const q = busqueda.toUpperCase()
      if (!(m.placa ?? '').toUpperCase().includes(q) && !(m.mina ?? '').toUpperCase().includes(q) &&
          !String(m.numero_volqueta).includes(q) && !(m.dueno_volqueta ?? '').toUpperCase().includes(q)) return false
    }
    return true
  }), [all, estadoF, duenoF, fechaDesde, fechaHasta, busqueda])

  const totalTon = filtrados.reduce((s, m) => s + num(m.peso_llegada_planta), 0)
  const totalAcpm = filtrados.reduce((s, m) => s + num(m.acpm_adelantado), 0)
  const totalFlete = filtrados.reduce((s, m) => s + num(m.flete), 0)

  const requestDelete = () => {
    if (editId == null) return
    const numero = all.find(m => m.id === editId)?.numero_volqueta
    setLlegadaOpen(false)
    setDel({ id: editId, label: `la entrada N° ${numero ?? editId}` })
  }
  const confirmDelete = async () => {
    if (!del) return
    setDeleting(true)
    try {
      await materialApi.deleteEntrada(del.id)
      toast.success('Registro borrado'); setDel(null); refresh()
    } catch (e) {
      const { code, message } = apiError(e)
      toast.error(code ? (CODE_MSG[code] ?? message) : message); setDel(null)
    } finally { setDeleting(false) }
  }

  const cols = canWrite ? 10 : 9

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Llegadas" value={filtrados.length} accent="brown" />
        <KpiTile label="Ton húmedo" value={`${totalTon.toFixed(2)} t`} accent="green" />
        <KpiTile label="ACPM adelantado" value={cop(totalAcpm)} accent="amber" />
      </div>

      <Card title={`Llegadas de material (${filtrados.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={() => { setEditId(null); setLlegadaOpen(true) }}>Registrar llegada</Button>}>
        <div className="toolbar" style={{ marginBottom: '1rem', gap: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por placa, dueño, mina o N.° volqueta…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '16rem' }} />
          <select className="field__select" style={{ maxWidth: '13rem' }} value={duenoF} onChange={e => setDuenoF(e.target.value)}>
            <option value="todos">Todos los dueños</option>
            {duenos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="segment">
            {ESTADO_OPTS.map(o => <button key={o.key} className={`segment__btn ${estadoF === o.key ? 'segment__btn--active' : ''}`} onClick={() => setEstadoF(o.key)}>{o.label}</button>)}
          </div>
          <input className="field__input" type="date" title="Desde" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" title="Hasta" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
        </div>

        <div className="table-wrap table-wrap--fit">
          <table className="data-table data-table--fit">
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
              <TableState loading={loading} error={error} empty={filtrados.length === 0} cols={cols} onRetry={reload} />
              {!loading && !error && filtrados.map(m => {
                const acpm = num(m.acpm_adelantado)
                const flete = num(m.flete)
                const fb = FLETE_BADGE[m.estado_pago_flete] ?? { label: m.estado_pago_flete, cls: 'neutral' }
                const mb = materialBadge(m)
                return (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha_llegada)}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{m.numero_volqueta}</td>
                    <td>
                      <div className="mono" style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{m.placa ?? '—'}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{m.dueno_volqueta ?? '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{m.mina ?? '—'}</div>
                      {m.zona && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{m.zona}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{num(m.peso_llegada_planta).toFixed(2)} t</td>
                    <td style={{ textAlign: 'right' }} className="mono">{acpm > 0 ? <span style={{ color: '#b45309', fontWeight: 600 }}>{cop(acpm)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{flete > 0 ? <span style={{ color: 'var(--amber-700)', fontWeight: 600 }}>{cop(flete)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                    <td><span className={`badge badge--${fb.cls}`}>{fb.label}</span></td>
                    <td><span className={`badge badge--${mb.cls}`}>{mb.label}</span></td>
                    {canWrite && <td><Button variant="secondary" size="sm" icon={<Pencil size={14} />} title="Editar" onClick={() => { setEditId(m.id); setLlegadaOpen(true) }} /></td>}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={4}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalTon.toFixed(2)} t</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(totalAcpm)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(totalFlete)}</td>
                <td colSpan={canWrite ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <LlegadaModal open={llegadaOpen} editId={editId} onClose={() => setLlegadaOpen(false)} onSaved={refresh} onRequestDelete={requestDelete} simple />
      <ConfirmDeleteModal
        open={!!del}
        title="Borrar registro"
        itemLabel={del?.label}
        loading={deleting}
        onCancel={() => setDel(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════════════════════
type Tab = 'llegadas' | 'volquetas' | 'duenos' | 'tarifas' | 'pago-flete'
const TABS: { key: Tab; label: string }[] = [
  { key: 'llegadas', label: 'Llegadas' },
  { key: 'volquetas', label: 'Volquetas' },
  { key: 'duenos', label: 'Dueños' },
  { key: 'tarifas', label: 'Tarifas flete' },
  { key: 'pago-flete', label: 'Pago de flete' },
]

export function VolquetasApiPage() {
  const canWrite = useCanWrite('materiales')
  const [tab, setTab] = useState<Tab>('llegadas')

  return (
    <div className="page">
      <PageHeader title="Volquetas" subtitle="Volquetas, dueños, llegadas y tarifas de flete" />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'llegadas' && <LlegadasTab canWrite={canWrite} />}
      {tab === 'volquetas' && <VolquetasTab canWrite={canWrite} />}
      {tab === 'duenos' && <DuenosTab canWrite={canWrite} />}
      {tab === 'tarifas' && <TarifasFleteTab canWrite={canWrite} />}
      {tab === 'pago-flete' && <PagoFleteTab />}
    </div>
  )
}
