import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Coins, RefreshCw } from 'lucide-react'
import { Button, Card, Input, Select, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MineroSelect, ZonaSelect, DuenoSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP } from '@/utils/format'
import {
  materialApi, num,
  type MetodoCalculo, type Precio, type PreciosFiltro, type PrecioIntervalo,
} from '@/api/material'
import {
  useZonas, useMineros, useMinas, useDuenos,
  invalidateMaterialCatalog,
} from '@/hooks/useMaterialCatalogos'

const cop = formatCOP

// Mensajes amigables para los códigos de conflicto (409) del backend.
const CODE_MSG: Record<string, string> = {
  ZONA_EN_USO: 'Hay minas usando esta zona. Reasígnalas a otra zona antes de borrarla.',
}

type CatTab = 'zonas' | 'mineros' | 'minas' | 'duenos' | 'volquetas' | 'precios'

const TABS: { key: CatTab; label: string }[] = [
  { key: 'zonas', label: 'Zonas' },
  { key: 'mineros', label: 'Mineros' },
  { key: 'minas', label: 'Minas' },
  { key: 'duenos', label: 'Dueños' },
  { key: 'volquetas', label: 'Volquetas' },
  { key: 'precios', label: 'Precios de material' },
]

// ─── Estados de tabla reutilizables ──────────────────────────────────────────
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
// ZONAS
// ════════════════════════════════════════════════════════════════════════════
function ZonasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { data, loading, error, reload } = useZonas()
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', valor_tonelada: '' })
  const [tarifaModal, setTarifaModal] = useState<null | number>(null)
  const [tarifaVal, setTarifaVal] = useState('')
  const [saving, setSaving] = useState(false)

  const openNuevo = () => { setForm({ nombre: '', descripcion: '', valor_tonelada: '' }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const z = data.find(x => x.id === id)!
    setForm({ nombre: z.nombre, descripcion: '', valor_tonelada: '' })
    setModal(id)
  }

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nuevo') {
        await materialApi.createZona({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion || undefined,
          valor_tonelada: form.valor_tonelada ? Number(form.valor_tonelada) : undefined,
        })
        toast.success('Zona creada')
      } else if (typeof modal === 'number') {
        // Editar SOLO nombre/descripción (la tarifa se versiona por separado)
        await materialApi.updateZona(modal, { nombre: form.nombre.trim(), descripcion: form.descripcion || undefined })
        toast.success('Zona actualizada')
      }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const saveTarifa = async () => {
    if (tarifaModal == null || !tarifaVal) return
    setSaving(true)
    try {
      await materialApi.updateZona(tarifaModal, { valor_tonelada: Number(tarifaVal) })
      toast.success('Tarifa actualizada (versionada)')
      setTarifaModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const del = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la zona "${nombre}"?`)) return
    try {
      await materialApi.deleteZona(id); toast.success('Zona eliminada'); reload()
    } catch (e) {
      const { code, message } = apiError(e)
      toast.error(code ? (CODE_MSG[code] ?? message) : message)
    }
  }

  return (
    <>
      <Card title={`Zonas (${data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nueva zona</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th style={{ textAlign: 'right' }}>Tarifa flete /t</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 3 : 2} onRetry={reload} />
              {!loading && !error && data.map(z => {
                const t = num(z.tarifa)
                return (
                  <tr key={z.id}>
                    <td style={{ fontWeight: 700 }}>{z.nombre}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{t > 0 ? cop(t) : <em style={{ color: 'var(--text-faint)' }}>sin tarifa</em>}</td>
                    {canWrite && (
                      <td><div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Coins size={14} />} title="Cambiar tarifa de flete" onClick={() => { setTarifaVal(t > 0 ? String(t) : ''); setTarifaModal(z.id) }} />
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(z.id)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(z.id, z.nombre)} />
                      </div></td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nueva zona' : 'Editar zona'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <Input label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          {modal === 'nuevo' && (
            <Input label="Tarifa flete inicial (COP/t)" type="number" step="1000" value={form.valor_tonelada}
              onChange={e => setForm(f => ({ ...f, valor_tonelada: e.target.value }))} helper="Opcional. Luego se versiona desde el botón de tarifa." />
          )}
        </div>
      </Modal>

      <Modal open={tarifaModal !== null} title="Cambiar tarifa de flete" onClose={() => setTarifaModal(null)}
        footer={<><Button variant="secondary" onClick={() => setTarifaModal(null)}>Cancelar</Button><Button onClick={saveTarifa} disabled={saving || !tarifaVal}>Guardar tarifa</Button></>}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Cambiar la tarifa crea una nueva versión en el historial. Las entradas ya registradas conservan su flete.</p>
        <Input label="Nueva tarifa (COP/t)" type="number" step="1000" required value={tarifaVal} onChange={e => setTarifaVal(e.target.value)} />
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MINEROS
// ════════════════════════════════════════════════════════════════════════════
const METODO_OPTS = [
  { value: 'por_gramo', label: 'Por gramo' },
  { value: 'por_tonelada', label: 'Por tonelada' },
]
function MinerosTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { data, loading, error, reload } = useMineros()
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [form, setForm] = useState({ nombre: '', alias: '', metodo_calculo: 'por_gramo' as MetodoCalculo, estado: 'activo' })
  const [saving, setSaving] = useState(false)

  const openNuevo = () => { setForm({ nombre: '', alias: '', metodo_calculo: 'por_gramo', estado: 'activo' }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const m = data.find(x => x.id === id)!
    setForm({ nombre: m.nombre, alias: m.alias ?? '', metodo_calculo: m.metodo_calculo, estado: m.estado })
    setModal(id)
  }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nuevo') {
        await materialApi.createMinero({ nombre: form.nombre.trim(), alias: form.alias || undefined, metodo_calculo: form.metodo_calculo })
        toast.success('Minero creado')
      } else if (typeof modal === 'number') {
        await materialApi.updateMinero(modal, { nombre: form.nombre.trim(), alias: form.alias || undefined, metodo_calculo: form.metodo_calculo, estado: form.estado })
        toast.success('Minero actualizado')
      }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const del = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar el minero "${nombre}"?`)) return
    try { await materialApi.deleteMinero(id); toast.success('Minero eliminado'); reload() }
    catch (e) { const { code, message } = apiError(e); toast.error(code ? (CODE_MSG[code] ?? message) : message) }
  }

  return (
    <>
      <Card title={`Mineros (${data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nuevo minero</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Alias</th><th>Método pago</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 5 : 4} onRetry={reload} />
              {!loading && !error && data.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.nombre}</td>
                  <td>{m.alias ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td>{m.metodo_calculo === 'por_tonelada' ? 'Por tonelada' : 'Por gramo'}</td>
                  <td><span className={`badge badge--${m.estado === 'activo' ? 'success' : 'neutral'}`}>{m.estado}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(m.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(m.id, m.nombre)} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo minero' : 'Editar minero'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} helper="Se guarda en MAYÚSCULAS" />
          <Input label="Alias" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS} value={form.metodo_calculo} onChange={e => setForm(f => ({ ...f, metodo_calculo: e.target.value as MetodoCalculo }))} />
          {typeof modal === 'number' && <Select label="Estado" options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />}
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MINAS
// ════════════════════════════════════════════════════════════════════════════
function MinasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const { data, loading, error, reload } = useMinas()
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [form, setForm] = useState({ nombre: '', id_minero: '' as number | '', id_zona: '' as number | '', ubicacion: '', estado: 'activa' })
  const [saving, setSaving] = useState(false)

  const openNuevo = () => { setForm({ nombre: '', id_minero: '', id_zona: '', ubicacion: '', estado: 'activa' }); setModal('nuevo') }
  const openEdit = (id: number) => {
    const m = data.find(x => x.id === id)!
    setForm({ nombre: m.nombre, id_minero: m.minero_id ?? '', id_zona: m.zona_id ?? '', ubicacion: m.ubicacion ?? '', estado: m.estado })
    setModal(id)
  }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    const body = {
      nombre: form.nombre.trim(),
      id_minero: form.id_minero === '' ? undefined : form.id_minero,
      id_zona: form.id_zona === '' ? undefined : form.id_zona,
      ubicacion: form.ubicacion || undefined,
      estado: form.estado,
    }
    try {
      if (modal === 'nuevo') { await materialApi.createMina(body); toast.success('Mina creada') }
      else if (typeof modal === 'number') { await materialApi.updateMina(modal, body); toast.success('Mina actualizada') }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const del = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la mina "${nombre}"?`)) return
    try { await materialApi.deleteMina(id); toast.success('Mina eliminada'); reload() }
    catch (e) { const { code, message } = apiError(e); toast.error(code ? (CODE_MSG[code] ?? message) : message) }
  }

  return (
    <>
      <Card title={`Minas (${data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nueva mina</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Minero</th><th>Zona</th><th>Ubicación</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 6 : 5} onRetry={reload} />
              {!loading && !error && data.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.nombre}</td>
                  <td>{m.minero_alias ?? m.minero ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td>{m.zona ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td>{m.ubicacion ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td><span className={`badge badge--${m.estado === 'activa' ? 'success' : 'neutral'}`}>{m.estado}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(m.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(m.id, m.nombre)} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nueva mina' : 'Editar mina'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <MineroSelect value={form.id_minero} onChange={v => setForm(f => ({ ...f, id_minero: v }))} />
          <ZonaSelect value={form.id_zona} onChange={v => setForm(f => ({ ...f, id_zona: v }))} />
          <Input label="Ubicación" value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} />
          <Select label="Estado" options={[{ value: 'activa', label: 'Activa' }, { value: 'inactiva', label: 'Inactiva' }]} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
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
            <input type="checkbox" id="dueno-nequi" checked={form.nequi} onChange={e => f('nequi', e.target.checked)} />
            <label htmlFor="dueno-nequi" style={{ cursor: 'pointer', userSelect: 'none' }}>Usa Nequi</label>
          </div>
          {typeof modal === 'number' && <Select label="Estado" options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} value={form.estado} onChange={e => f('estado', e.target.value)} />}
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VOLQUETAS (vehículos) — fetch directo para soportar el toggle "todas"
// ════════════════════════════════════════════════════════════════════════════
function VolquetasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [todas, setTodas] = useState(false)
  const [data, setData] = useState<import('@/api/material').Volqueta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ id_dueno: '' as number | '', placa: '', tipo_vehiculo: '', conductor: '', conductor_cc: '', capacidad_ton: '', activo: true })
  const f = (k: keyof typeof form, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getVolquetas(todas)
      .then(setData).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
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
            <input type="checkbox" id="vol-activo" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="vol-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Volqueta activa</label>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PRECIOS DE MATERIAL
// ════════════════════════════════════════════════════════════════════════════
const emptyIntervalo = (): PrecioIntervalo => ({ min: 0, max: 0, precio_por_gramo: undefined, precio_por_tonelada: undefined })

function PreciosTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<Precio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [alcance, setAlcance] = useState<'todos' | 'minero' | 'zona' | 'general'>('todos')
  const [filtMinero, setFiltMinero] = useState<number | ''>('')
  const [filtZona, setFiltZona] = useState<number | ''>('')
  const [soloActivos, setSoloActivos] = useState(true)

  // Modal lote
  const [loteModal, setLoteModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lote, setLote] = useState({
    alcance: 'general' as 'general' | 'minero' | 'zona',
    id_minero: '' as number | '', id_zona: '' as number | '',
    metodo: 'por_gramo' as MetodoCalculo, fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: '',
    intervalos: [emptyIntervalo()] as PrecioIntervalo[],
  })

  // Modal editar intervalo
  const [editP, setEditP] = useState<Precio | null>(null)
  const [editForm, setEditForm] = useState({ min: '', max: '', precio_por_gramo: '', precio_por_tonelada: '', fecha_inicio: '' })

  const load = useCallback(() => {
    setLoading(true); setError(null)
    const filtro: PreciosFiltro = {}
    if (alcance === 'minero' && filtMinero !== '') filtro.id_minero = filtMinero
    if (alcance === 'zona' && filtZona !== '') filtro.id_zona = filtZona
    if (alcance === 'general') filtro.alcance = 'general'
    if (soloActivos) filtro.activo = true
    materialApi.getPrecios(filtro).then(setData).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [alcance, filtMinero, filtZona, soloActivos])
  useEffect(() => { load() }, [load])

  // ── Lote ──
  const setInterval = (i: number, patch: Partial<PrecioIntervalo>) =>
    setLote(l => ({ ...l, intervalos: l.intervalos.map((it, idx) => idx === i ? { ...it, ...patch } : it) }))
  const addInterval = () => setLote(l => ({ ...l, intervalos: [...l.intervalos, emptyIntervalo()] }))
  const removeInterval = (i: number) => setLote(l => ({ ...l, intervalos: l.intervalos.filter((_, idx) => idx !== i) }))

  const openLote = () => {
    setLote({ alcance: 'general', id_minero: '', id_zona: '', metodo: 'por_gramo', fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: '', intervalos: [emptyIntervalo()] })
    setLoteModal(true)
  }
  const saveLote = async () => {
    if (lote.intervalos.length === 0) { toast.error('Agrega al menos un intervalo'); return }
    if (lote.alcance === 'minero' && lote.id_minero === '') { toast.error('Selecciona el minero'); return }
    if (lote.alcance === 'zona' && lote.id_zona === '') { toast.error('Selecciona la zona'); return }
    setSaving(true)
    try {
      await materialApi.createPreciosLote({
        id_minero: lote.alcance === 'minero' && lote.id_minero !== '' ? lote.id_minero : undefined,
        id_zona: lote.alcance === 'zona' && lote.id_zona !== '' ? lote.id_zona : undefined,
        metodo: lote.metodo,
        fecha_inicio: lote.fecha_inicio,
        fecha_fin: lote.fecha_fin || undefined,
        intervalos: lote.intervalos.map(it => ({
          min: Number(it.min), max: Number(it.max),
          precio_por_gramo: lote.metodo === 'por_gramo' ? Number(it.precio_por_gramo) || undefined : undefined,
          precio_por_tonelada: lote.metodo === 'por_tonelada' ? Number(it.precio_por_tonelada) || undefined : undefined,
        })),
      })
      toast.success('Precios registrados')
      setLoteModal(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Editar intervalo ──
  const openEdit = (p: Precio) => {
    setEditP(p)
    setEditForm({
      min: String(num(p.intervalo_tenor_min)), max: String(num(p.intervalo_tenor_max)),
      precio_por_gramo: p.precio_por_gramo != null ? String(num(p.precio_por_gramo)) : '',
      precio_por_tonelada: p.precio_por_tonelada != null ? String(num(p.precio_por_tonelada)) : '',
      fecha_inicio: p.fecha_inicio?.slice(0, 10) ?? '',
    })
  }
  const saveEdit = async () => {
    if (!editP) return
    setSaving(true)
    try {
      await materialApi.updatePrecio(editP.id, {
        min: editForm.min ? Number(editForm.min) : undefined,
        max: editForm.max ? Number(editForm.max) : undefined,
        precio_por_gramo: editP.metodo === 'por_gramo' && editForm.precio_por_gramo ? Number(editForm.precio_por_gramo) : undefined,
        precio_por_tonelada: editP.metodo === 'por_tonelada' && editForm.precio_por_tonelada ? Number(editForm.precio_por_tonelada) : undefined,
        fecha_inicio: editForm.fecha_inicio || undefined,
      })
      toast.success('Intervalo actualizado')
      setEditP(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const ALCANCE_LABEL: Record<string, string> = { minero: 'Minero', zona: 'Zona', general: 'General' }

  return (
    <>
      <Card
        title={`Precios de material (${data.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openLote}>Nuevo lote de precios</Button>}
      >
        {/* Filtros */}
        <div className="toolbar" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div style={{ minWidth: '11rem' }}>
            <Select label="Alcance" value={alcance}
              options={[{ value: 'todos', label: 'Todos' }, { value: 'minero', label: 'Por minero' }, { value: 'zona', label: 'Por zona' }, { value: 'general', label: 'General' }]}
              onChange={e => setAlcance(e.target.value as typeof alcance)} />
          </div>
          {alcance === 'minero' && <div style={{ minWidth: '13rem' }}><MineroSelect value={filtMinero} onChange={setFiltMinero} /></div>}
          {alcance === 'zona' && <div style={{ minWidth: '13rem' }}><ZonaSelect value={filtZona} onChange={setFiltZona} /></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', cursor: 'pointer', paddingBottom: '0.5rem' }}>
            <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} /> Solo activos
          </label>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginBottom: '0.25rem' }}>Refrescar</Button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Alcance</th><th>Minero / Zona</th><th>Método</th>
              <th style={{ textAlign: 'right' }}>Tenor min–max</th>
              <th style={{ textAlign: 'right' }}>Precio</th>
              <th>Vigencia</th><th>Activo</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 8 : 7} onRetry={load} />
              {!loading && !error && data.map(p => (
                <tr key={p.id}>
                  <td><span className="badge badge--neutral">{ALCANCE_LABEL[p.alcance] ?? p.alcance}</span></td>
                  <td>{p.minero ?? p.zona ?? <em style={{ color: 'var(--text-faint)' }}>general</em>}</td>
                  <td>{p.metodo === 'por_tonelada' ? 'Por tonelada' : 'Por gramo'}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{num(p.intervalo_tenor_min)}–{num(p.intervalo_tenor_max)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {p.metodo === 'por_gramo' ? `${cop(num(p.precio_por_gramo))}/g` : `${cop(num(p.precio_por_tonelada))}/t`}
                  </td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{p.fecha_inicio?.slice(0, 10)}{p.fecha_fin ? ` → ${p.fecha_fin.slice(0, 10)}` : ''}</td>
                  <td><span className={`badge badge--${num(p.activo) ? 'success' : 'neutral'}`}>{num(p.activo) ? 'Sí' : 'No'}</span></td>
                  {canWrite && <td><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal nuevo lote */}
      <Modal open={loteModal} title="Nuevo lote de precios" onClose={() => setLoteModal(false)}
        footer={<><Button variant="secondary" onClick={() => setLoteModal(false)}>Cancelar</Button><Button onClick={saveLote} disabled={saving}>Guardar lote</Button></>}>
        <div className="grid grid--form">
          <Select label="Alcance" value={lote.alcance}
            options={[{ value: 'general', label: 'General' }, { value: 'minero', label: 'Por minero' }, { value: 'zona', label: 'Por zona' }]}
            onChange={e => setLote(l => ({ ...l, alcance: e.target.value as typeof l.alcance }))} />
          <Select label="Método" value={lote.metodo} options={METODO_OPTS}
            onChange={e => setLote(l => ({ ...l, metodo: e.target.value as MetodoCalculo }))} />
          {lote.alcance === 'minero' && <MineroSelect value={lote.id_minero} onChange={v => setLote(l => ({ ...l, id_minero: v }))} />}
          {lote.alcance === 'zona' && <ZonaSelect value={lote.id_zona} onChange={v => setLote(l => ({ ...l, id_zona: v }))} />}
          <Input label="Fecha inicio" type="date" required value={lote.fecha_inicio} onChange={e => setLote(l => ({ ...l, fecha_inicio: e.target.value }))} />
          <Input label="Fecha fin (opcional)" type="date" value={lote.fecha_fin} onChange={e => setLote(l => ({ ...l, fecha_fin: e.target.value }))} />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: 'var(--fs-sm)' }}>Intervalos de tenor</strong>
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addInterval}>Agregar intervalo</Button>
          </div>
          <table className="data-table">
            <thead><tr><th>Tenor min</th><th>Tenor max</th><th>{lote.metodo === 'por_gramo' ? 'Precio/gramo' : 'Precio/tonelada'}</th><th></th></tr></thead>
            <tbody>
              {lote.intervalos.map((it, i) => (
                <tr key={i}>
                  <td><input className="field__input" type="number" step="0.01" value={it.min || ''} onChange={e => setInterval(i, { min: Number(e.target.value) })} /></td>
                  <td><input className="field__input" type="number" step="0.01" value={it.max || ''} onChange={e => setInterval(i, { max: Number(e.target.value) })} /></td>
                  <td>
                    <input className="field__input" type="number" step="1"
                      value={(lote.metodo === 'por_gramo' ? it.precio_por_gramo : it.precio_por_tonelada) ?? ''}
                      onChange={e => setInterval(i, lote.metodo === 'por_gramo' ? { precio_por_gramo: Number(e.target.value) } : { precio_por_tonelada: Number(e.target.value) })} />
                  </td>
                  <td><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => removeInterval(i)} disabled={lote.intervalos.length === 1} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Modal editar intervalo */}
      <Modal open={!!editP} title="Editar intervalo de precio" onClose={() => setEditP(null)}
        footer={<><Button variant="secondary" onClick={() => setEditP(null)}>Cancelar</Button><Button onClick={saveEdit} disabled={saving}>Guardar</Button></>}>
        {editP && (
          <>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Se inactiva el precio actual y se inserta un reemplazo activo. Alcance: <strong>{ALCANCE_LABEL[editP.alcance]}</strong> · {editP.minero ?? editP.zona ?? 'general'}
            </p>
            <div className="grid grid--form">
              <Input label="Tenor min" type="number" step="0.01" value={editForm.min} onChange={e => setEditForm(f => ({ ...f, min: e.target.value }))} />
              <Input label="Tenor max" type="number" step="0.01" value={editForm.max} onChange={e => setEditForm(f => ({ ...f, max: e.target.value }))} />
              {editP.metodo === 'por_gramo'
                ? <Input label="Precio/gramo" type="number" step="1" value={editForm.precio_por_gramo} onChange={e => setEditForm(f => ({ ...f, precio_por_gramo: e.target.value }))} />
                : <Input label="Precio/tonelada" type="number" step="1" value={editForm.precio_por_tonelada} onChange={e => setEditForm(f => ({ ...f, precio_por_tonelada: e.target.value }))} />}
              <Input label="Fecha inicio" type="date" value={editForm.fecha_inicio} onChange={e => setEditForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════════════════════
export function CatalogosApiPage() {
  const canWrite = useCanWrite('materiales')
  const [tab, setTab] = useState<CatTab>('zonas')

  return (
    <div className="page">
      <PageHeader title="Catálogos" subtitle="Zonas, mineros, minas, dueños, volquetas y precios de material" />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'zonas' && <ZonasTab canWrite={canWrite} />}
      {tab === 'mineros' && <MinerosTab canWrite={canWrite} />}
      {tab === 'minas' && <MinasTab canWrite={canWrite} />}
      {tab === 'duenos' && <DuenosTab canWrite={canWrite} />}
      {tab === 'volquetas' && <VolquetasTab canWrite={canWrite} />}
      {tab === 'precios' && <PreciosTab canWrite={canWrite} />}
    </div>
  )
}
