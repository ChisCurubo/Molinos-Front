import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Coins, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Card, Input, Select, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MineroSelect, ZonaSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP, todayISO } from '@/utils/format'
import { materialApi, num, type MetodoCalculo, type PrecioMaterial, type TarifaProceso } from '@/api/material'
import { useZonas, useMineros, useMinas } from '@/hooks/useMaterialCatalogos'

const cop = formatCOP

// Mensajes amigables para los códigos de conflicto (409) del backend.
const CODE_MSG: Record<string, string> = {
  ZONA_EN_USO: 'Hay minas usando esta zona. Reasígnalas a otra zona antes de borrarla.',
}

type CatTab = 'zonas' | 'mineros' | 'minas' | 'precios' | 'tarifas-proceso'

const TABS: { key: CatTab; label: string }[] = [
  { key: 'zonas', label: 'Zonas' },
  { key: 'mineros', label: 'Mineros' },
  { key: 'minas', label: 'Minas' },
  { key: 'precios', label: 'Precios material' },
  { key: 'tarifas-proceso', label: 'Tarifas de maquila' },
]

// Etiquetas legibles para los códigos de tarifa de proceso.
const COD_TARIFA_LABEL: Record<string, string> = {
  PROCESO_NORMAL: 'Proceso normal',
  PROCESO_RELAVE: 'Proceso con relave',
  SOLO_FILTROPRENSA: 'Solo filtroprensa',
}

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
// PRECIOS DE MATERIAL (Precio_Material) — tabla referencial (no afecta cálculos)
// ════════════════════════════════════════════════════════════════════════════
function fmtDMY(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function PreciosMaterialTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<PrecioMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    id_minero: '' as number | '', id_zona: '' as number | '', metodo: 'por_gramo' as MetodoCalculo,
    precio_por_gramo: '', precio_por_tonelada: '', intervalo_tenor_min: '', intervalo_tenor_max: '',
    fecha_inicio: '', fecha_fin: '', activo: true,
  })
  const f = (k: keyof typeof form, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getPreciosMaterial().then(setData).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const openNuevo = () => {
    setForm({ id_minero: '', id_zona: '', metodo: 'por_gramo', precio_por_gramo: '', precio_por_tonelada: '', intervalo_tenor_min: '', intervalo_tenor_max: '', fecha_inicio: '', fecha_fin: '', activo: true })
    setModal('nuevo')
  }
  const openEdit = (id: number) => {
    const p = data.find(x => x.id === id)!
    setForm({
      id_minero: p.id_minero ?? '', id_zona: p.id_zona ?? '', metodo: p.metodo,
      precio_por_gramo: p.precio_por_gramo != null ? String(num(p.precio_por_gramo)) : '',
      precio_por_tonelada: p.precio_por_tonelada != null ? String(num(p.precio_por_tonelada)) : '',
      intervalo_tenor_min: p.intervalo_tenor_min != null ? String(num(p.intervalo_tenor_min)) : '',
      intervalo_tenor_max: p.intervalo_tenor_max != null ? String(num(p.intervalo_tenor_max)) : '',
      fecha_inicio: p.fecha_inicio?.slice(0, 10) ?? '', fecha_fin: p.fecha_fin?.slice(0, 10) ?? '', activo: !!num(p.activo),
    })
    setModal(id)
  }
  const save = async () => {
    if (!form.fecha_inicio) { toast.error('Indica la fecha de inicio'); return }
    setSaving(true)
    const body = {
      id_minero: form.id_minero === '' ? undefined : form.id_minero,
      id_zona: form.id_zona === '' ? undefined : form.id_zona,
      metodo: form.metodo,
      precio_por_gramo: form.metodo === 'por_gramo' && form.precio_por_gramo ? Number(form.precio_por_gramo) : undefined,
      precio_por_tonelada: form.metodo === 'por_tonelada' && form.precio_por_tonelada ? Number(form.precio_por_tonelada) : undefined,
      intervalo_tenor_min: form.intervalo_tenor_min ? Number(form.intervalo_tenor_min) : undefined,
      intervalo_tenor_max: form.intervalo_tenor_max ? Number(form.intervalo_tenor_max) : undefined,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin || undefined, activo: form.activo,
    }
    try {
      if (modal === 'nuevo') { await materialApi.createPrecioMaterial(body); toast.success('Precio creado') }
      else if (typeof modal === 'number') { await materialApi.updatePrecioMaterial(modal, body); toast.success('Precio actualizado') }
      setModal(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const del = async (id: number) => {
    if (!confirm('¿Eliminar este precio de referencia?')) return
    try { await materialApi.deletePrecioMaterial(id); toast.success('Precio eliminado'); load() }
    catch (e) { toast.error(apiError(e).message) }
  }

  return (
    <>
      <Card title={`Precios de material (${data.length})`}
        actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Nuevo precio</Button>}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Tabla de referencia/consulta. No afecta los cálculos: el precio de compra se asigna manualmente en el flujo de entrada.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Minero</th><th>Zona</th><th>Método</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Tenor min–max</th>
                <th>Vigencia</th><th>Estado</th>{canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 8 : 7} onRetry={load} />
              {!loading && !error && data.map(p => {
                const precio = p.metodo === 'por_tonelada' ? num(p.precio_por_tonelada) : num(p.precio_por_gramo)
                const min = p.intervalo_tenor_min != null ? num(p.intervalo_tenor_min) : null
                const max = p.intervalo_tenor_max != null ? num(p.intervalo_tenor_max) : null
                return (
                  <tr key={p.id}>
                    <td>{p.minero ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                    <td>{p.zona ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                    <td>{p.metodo === 'por_tonelada' ? 'Por tonelada' : 'Por gramo'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{precio > 0 ? cop(precio) : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{min != null || max != null ? `${min ?? 0} – ${max ?? '∞'}` : '—'}</td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(p.fecha_inicio)}{p.fecha_fin ? ` → ${fmtDMY(p.fecha_fin)}` : ''}</td>
                    <td><span className={`badge badge--${num(p.activo) ? 'success' : 'neutral'}`}>{num(p.activo) ? 'Activo' : 'Inactivo'}</span></td>
                    {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p.id)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => del(p.id)} /></div></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo precio de material' : 'Editar precio'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.fecha_inicio}>Guardar</Button></>}>
        <div className="grid grid--form">
          <MineroSelect value={form.id_minero} onChange={v => f('id_minero', v)} placeholder="— Sin minero —" />
          <ZonaSelect value={form.id_zona} onChange={v => f('id_zona', v)} showTarifa={false} />
          <Select label="Método" options={METODO_OPTS} value={form.metodo} onChange={e => f('metodo', e.target.value as MetodoCalculo)} />
          {form.metodo === 'por_gramo'
            ? <Input label="Precio por gramo (COP)" type="number" step="1000" value={form.precio_por_gramo} onChange={e => f('precio_por_gramo', e.target.value)} />
            : <Input label="Precio por tonelada (COP)" type="number" step="1000" value={form.precio_por_tonelada} onChange={e => f('precio_por_tonelada', e.target.value)} />}
          <Input label="Tenor mín." type="number" step="0.1" value={form.intervalo_tenor_min} onChange={e => f('intervalo_tenor_min', e.target.value)} />
          <Input label="Tenor máx." type="number" step="0.1" value={form.intervalo_tenor_max} onChange={e => f('intervalo_tenor_max', e.target.value)} />
          <Input label="Fecha inicio" type="date" required value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} />
          <Input label="Fecha fin" type="date" value={form.fecha_fin} onChange={e => f('fecha_fin', e.target.value)} helper="Opcional. Vacío = sin fin." />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="precio-mat-activo" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
            <label htmlFor="precio-mat-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Activo</label>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TARIFAS DE MAQUILA (Tarifas_Proceso)
// "Actualizar precio" (POST) crea una versión nueva vigente; "Corregir" (PATCH)
// edita la fila existente (solo para arreglar errores de digitación).
// ════════════════════════════════════════════════════════════════════════════
function TarifasProcesoTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()

  // Tabla superior: la vigente de cada código (endpoint /vigentes, por defecto hoy).
  const [vigentes, setVigentes] = useState<TarifaProceso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Historial completo (GET /), colapsable y con carga perezosa.
  const [histOpen, setHistOpen] = useState(false)
  const [hist, setHist] = useState<TarifaProceso[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState<string | null>(null)

  // Modal "Actualizar precio" (POST → versiona) y "Corregir" (PATCH → edita fila).
  const [precioModal, setPrecioModal] = useState<TarifaProceso | null>(null)
  const [precioForm, setPrecioForm] = useState({ valor: '', fecha_desde: todayISO(), descripcion: '' })
  const [corregirModal, setCorregirModal] = useState<TarifaProceso | null>(null)
  const [corregirForm, setCorregirForm] = useState({ valor: '', descripcion: '', unidad: '', fecha_desde: '', fecha_hasta: '', activo: true })
  const [saving, setSaving] = useState(false)

  const loadVigentes = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getTarifasProcesoVigentes()
      .then(setVigentes).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { loadVigentes() }, [loadVigentes])

  const loadHist = useCallback(() => {
    setHistLoading(true); setHistError(null)
    materialApi.getTarifasProceso()
      .then(rows => setHist([...rows].sort((a, b) =>
        a.codigo === b.codigo
          ? (b.fecha_desde ?? '').localeCompare(a.fecha_desde ?? '')  // fecha_desde desc
          : a.codigo.localeCompare(b.codigo))))                       // código asc
      .catch(e => setHistError(apiError(e).message)).finally(() => setHistLoading(false))
  }, [])
  const toggleHist = () => { const next = !histOpen; setHistOpen(next); if (next) loadHist() }

  // ── Actualizar precio (POST): crea una versión nueva vigente ──
  const openPrecio = (t: TarifaProceso) => {
    setPrecioForm({ valor: '', fecha_desde: todayISO(), descripcion: t.descripcion ?? '' })
    setPrecioModal(t)
  }
  const savePrecio = async () => {
    if (!precioModal) return
    const valor = Number(precioForm.valor)
    if (!precioForm.valor || Number.isNaN(valor) || valor <= 0) { toast.error('El nuevo valor debe ser un número mayor que 0'); return }
    setSaving(true)
    try {
      await materialApi.updatePrecioTarifaProceso({
        codigo: precioModal.codigo,
        valor,
        fecha_desde: precioForm.fecha_desde || undefined,
        descripcion: precioForm.descripcion || undefined,
      })
      toast.success('Precio actualizado · nueva versión vigente')
      setPrecioModal(null); loadVigentes(); if (histOpen) loadHist()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Corregir (PATCH): edita la fila existente ──
  const openCorregir = (t: TarifaProceso) => {
    setCorregirForm({
      valor: String(num(t.valor)),
      descripcion: t.descripcion ?? '',
      unidad: t.unidad ?? '',
      fecha_desde: (t.fecha_desde ?? '').slice(0, 10),
      fecha_hasta: (t.fecha_hasta ?? '').slice(0, 10),
      activo: !!num(t.activo),
    })
    setCorregirModal(t)
  }
  const saveCorregir = async () => {
    if (!corregirModal) return
    const valor = Number(corregirForm.valor)
    if (corregirForm.valor !== '' && (Number.isNaN(valor) || valor < 0)) { toast.error('El valor debe ser un número mayor o igual que 0'); return }
    setSaving(true)
    try {
      await materialApi.corregirTarifaProceso(corregirModal.id, {
        valor: corregirForm.valor !== '' ? valor : undefined,
        descripcion: corregirForm.descripcion || undefined,
        unidad: corregirForm.unidad || undefined,
        fecha_desde: corregirForm.fecha_desde || undefined,
        fecha_hasta: corregirForm.fecha_hasta || null,
        activo: corregirForm.activo,
      })
      toast.success('Tarifa corregida')
      setCorregirModal(null); loadVigentes(); loadHist()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  return (
    <>
      {/* ── Tarifas vigentes ── */}
      <Card title={`Tarifas de maquila vigentes (${vigentes.length})`}
        actions={<Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={loadVigentes}>Refrescar</Button>}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Precio de maquila vigente por tipo de proceso. <strong>Actualizar precio</strong> crea una versión nueva y conserva el historial.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Unidad</th><th>Vigente desde</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} error={error} empty={vigentes.length === 0} cols={canWrite ? 6 : 5} onRetry={loadVigentes} />
              {!loading && !error && vigentes.map(t => (
                <tr key={t.id}>
                  <td><span className="mono" style={{ fontWeight: 700 }}>{t.codigo}</span></td>
                  <td>{t.descripcion || COD_TARIFA_LABEL[t.codigo] || <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(t.valor))}</td>
                  <td>{t.unidad ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(t.fecha_desde)}</td>
                  {canWrite && (
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" icon={<Coins size={14} />} onClick={() => openPrecio(t)}>Actualizar precio</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Historial ── */}
      <Card title="Historial de tarifas"
        actions={<Button size="sm" variant="secondary" icon={histOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={toggleHist}>
          {histOpen ? 'Ocultar' : 'Ver historial'}
        </Button>}>
        {!histOpen ? (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>
            Todas las versiones (vigentes y cerradas) de cada tarifa. Usa <strong>Corregir</strong> solo para arreglar errores de digitación.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th><th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Unidad</th><th>Desde</th><th>Hasta</th><th>Estado</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                <TableState loading={histLoading} error={histError} empty={hist.length === 0} cols={canWrite ? 8 : 7} onRetry={loadHist} />
                {!histLoading && !histError && hist.map(t => {
                  const esVigente = t.fecha_hasta == null && !!num(t.activo)
                  return (
                    <tr key={t.id} style={esVigente ? { background: 'var(--green-50)' } : undefined}>
                      <td className="mono">{t.codigo}</td>
                      <td>{t.descripcion || COD_TARIFA_LABEL[t.codigo] || <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                      <td style={{ textAlign: 'right', fontWeight: esVigente ? 700 : 400 }} className="mono">{cop(num(t.valor))}</td>
                      <td>{t.unidad ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(t.fecha_desde)}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{t.fecha_hasta ? fmtDMY(t.fecha_hasta) : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                      <td><span className={`badge badge--${esVigente ? 'success' : 'neutral'}`}>{esVigente ? 'Vigente' : 'Cerrada'}</span></td>
                      {canWrite && (
                        <td>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} title="Corregir (arreglar error de digitación)" onClick={() => openCorregir(t)}>Corregir</Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: Actualizar precio (POST → versiona) ── */}
      <Modal open={precioModal !== null} title={`Actualizar precio — ${precioModal?.codigo ?? ''}`} onClose={() => setPrecioModal(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setPrecioModal(null)}>Cancelar</Button>
          <Button onClick={savePrecio} disabled={saving || !precioForm.valor}>{saving ? 'Guardando…' : 'Guardar nuevo precio'}</Button>
        </>}>
        <div className="callout" style={{ marginBottom: '1rem' }}>
          Crea una <strong>versión nueva</strong> de la tarifa: cierra la vigente y deja esta como actual. El histórico se conserva.
        </div>
        <div className="grid grid--form">
          <Input label="Código" value={precioModal?.codigo ?? ''} readOnly disabled />
          <Input label="Nuevo valor (COP)" type="number" step="1000" required placeholder="0"
            value={precioForm.valor} onChange={e => setPrecioForm(f => ({ ...f, valor: e.target.value }))} />
          <Input label="Vigente desde" type="date"
            value={precioForm.fecha_desde} onChange={e => setPrecioForm(f => ({ ...f, fecha_desde: e.target.value }))} />
          <Input label="Descripción (opcional)"
            value={precioForm.descripcion} onChange={e => setPrecioForm(f => ({ ...f, descripcion: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: Corregir (PATCH → edita la fila) ── */}
      <Modal open={corregirModal !== null} title={`Corregir tarifa — ${corregirModal?.codigo ?? ''}`} onClose={() => setCorregirModal(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setCorregirModal(null)}>Cancelar</Button>
          <Button onClick={saveCorregir} disabled={saving}>{saving ? 'Guardando…' : 'Guardar corrección'}</Button>
        </>}>
        <div className="callout" style={{ marginBottom: '1rem' }}>
          <strong>Solo para arreglar errores de digitación.</strong> Edita esta misma fila sin crear una versión nueva.
          Para un cambio de precio real usa <em>Actualizar precio</em>.
        </div>
        <div className="grid grid--form">
          <Input label="Código" value={corregirModal?.codigo ?? ''} readOnly disabled />
          <Input label="Valor (COP)" type="number" step="1000"
            value={corregirForm.valor} onChange={e => setCorregirForm(f => ({ ...f, valor: e.target.value }))} />
          <Input label="Unidad" value={corregirForm.unidad} onChange={e => setCorregirForm(f => ({ ...f, unidad: e.target.value }))} />
          <Input label="Vigente desde" type="date"
            value={corregirForm.fecha_desde} onChange={e => setCorregirForm(f => ({ ...f, fecha_desde: e.target.value }))} />
          <Input label="Vigente hasta" type="date" helper="Vacío = vigente (sin cierre)"
            value={corregirForm.fecha_hasta} onChange={e => setCorregirForm(f => ({ ...f, fecha_hasta: e.target.value }))} />
          <Input label="Descripción" value={corregirForm.descripcion} onChange={e => setCorregirForm(f => ({ ...f, descripcion: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="tp-activo" checked={corregirForm.activo} onChange={e => setCorregirForm(f => ({ ...f, activo: e.target.checked }))} />
            <label htmlFor="tp-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Activo</label>
          </div>
        </div>
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
      <PageHeader title="Catálogos" subtitle="Zonas, mineros, minas, precios de material y tarifas de maquila" />
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
      {tab === 'precios' && <PreciosMaterialTab canWrite={canWrite} />}
      {tab === 'tarifas-proceso' && <TarifasProcesoTab canWrite={canWrite} />}
    </div>
  )
}
