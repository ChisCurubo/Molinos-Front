import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import {
  pagosApi,
  type Proveedor, type ProveedorPayload, type ProveedoresFiltro, type CategoriaProveedor, type TipoProveedor,
} from '@/api/pagos'

const TIPO_PROVEEDOR_OPTS: { value: TipoProveedor; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'combustible', label: 'Combustible' },
  { value: 'transportadora', label: 'Transportadora' },
  { value: 'laboratorio', label: 'Laboratorio' },
]
const TIPO_PROVEEDOR_LABEL = (t: string | null | undefined) => TIPO_PROVEEDOR_OPTS.find(o => o.value === t)?.label ?? (t || 'General')

function useProveedores(filtro?: ProveedoresFiltro) {
  const [data, setData] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosApi.getProveedores(filtro)
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro?.id_categoria, filtro?.tipo, filtro?.estado, filtro?.q])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function useCategoriasProveedor() {
  const [data, setData] = useState<CategoriaProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosApi.getCategoriasProveedor().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

type PageTab = 'proveedores' | 'categorias'

export function ProveedoresApiPage() {
  const canWrite = useCanWrite('finanzas')
  const [tab, setTab] = useState<PageTab>('proveedores')
  const categorias = useCategoriasProveedor()

  return (
    <div className="page">
      <PageHeader
        title="Proveedores"
        subtitle="Catálogo de proveedores usado por Cuentas por pagar, Adelantos y Pago de mulas."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'proveedores'} className={`segment__btn ${tab === 'proveedores' ? 'segment__btn--active' : ''}`} onClick={() => setTab('proveedores')}>Proveedores</button>
        <button role="tab" aria-selected={tab === 'categorias'} className={`segment__btn ${tab === 'categorias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
      </div>

      {tab === 'proveedores' && <ProveedoresTab canWrite={canWrite} categorias={categorias} />}
      {tab === 'categorias' && <CategoriasProveedorTab canWrite={canWrite} categorias={categorias} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ════════════════════════════════════════════════════════════════════════════
const emptyProveedorForm = () => ({ nombre: '', id_categoria: '' as number | '', tipo: 'general' as TipoProveedor, alias: '', contacto: '', telefono: '', ciudad: '', compra_realizada: '', nequi: false, estado: 'activo' })

function ProveedoresTab({ canWrite, categorias }: { canWrite: boolean; categorias: ReturnType<typeof useCategoriasProveedor> }) {
  const toast = useToast()
  const [fCategoria, setFCategoria] = useState<number | ''>('')
  const [fTipo, setFTipo] = useState<TipoProveedor | 'todos'>('todos')
  const [fEstado, setFEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [q, setQ] = useState('')
  const { data, loading, error, reload } = useProveedores({
    id_categoria: fCategoria || undefined, tipo: fTipo !== 'todos' ? fTipo : undefined,
    estado: fEstado !== 'todos' ? fEstado : undefined, q: q || undefined,
  })

  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyProveedorForm())
  const f = (k: keyof ReturnType<typeof emptyProveedorForm>, v: string | boolean | number) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyProveedorForm()); setModal('nuevo') }

  const openEdit = (p: Proveedor) => {
    setForm({
      nombre: p.nombre, id_categoria: p.id_categoria ?? '', tipo: p.tipo ?? 'general', alias: p.alias ?? '', contacto: p.contacto ?? '',
      telefono: p.telefono ?? '', ciudad: p.ciudad ?? '', compra_realizada: p.compra_realizada ?? '',
      nequi: !!num(p.nequi), estado: p.estado ?? 'activo',
    })
    setModal(p.id)
  }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    const body: ProveedorPayload = {
      nombre: form.nombre.trim(), id_categoria: form.id_categoria === '' ? undefined : form.id_categoria,
      tipo: form.tipo,
      alias: form.alias.trim() || undefined, contacto: form.contacto.trim() || undefined,
      telefono: form.telefono.trim() || undefined, ciudad: form.ciudad.trim() || undefined,
      compra_realizada: form.compra_realizada.trim() || undefined, nequi: form.nequi, estado: form.estado,
    }
    try {
      if (modal === 'nuevo') { await pagosApi.createProveedor(body); toast.success('Proveedor creado') }
      else if (typeof modal === 'number') { await pagosApi.updateProveedor(modal, body); toast.success('Proveedor actualizado') }
      setModal(null); reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [delProveedor, setDelProveedor] = useState<Proveedor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delProveedor) return
    setDeleting(true)
    try { await pagosApi.deleteProveedor(delProveedor.id); toast.success('Proveedor eliminado'); setDelProveedor(null); reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este proveedor tiene registros asociados (despachos, pagos) y no se puede eliminar.' : message)
      setDelProveedor(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="segment" role="tablist" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button role="tab" aria-selected={fTipo === 'todos'} className={`segment__btn ${fTipo === 'todos' ? 'segment__btn--active' : ''}`} onClick={() => setFTipo('todos')}>Todos</button>
        {TIPO_PROVEEDOR_OPTS.map(o => (
          <button key={o.value} role="tab" aria-selected={fTipo === o.value} className={`segment__btn ${fTipo === o.value ? 'segment__btn--active' : ''}`} onClick={() => setFTipo(o.value)}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="field__input" placeholder="Buscar por nombre o alias…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: '16rem' }} />
        <select className="field__select" style={{ maxWidth: '13rem' }} value={fCategoria} onChange={e => setFCategoria(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas las categorías</option>
          {categorias.data.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="segment">
          {(['todos', 'activo', 'inactivo'] as const).map(k => (
            <button key={k} className={`segment__btn ${fEstado === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstado(k)}>{k === 'todos' ? 'Todos' : k === 'activo' ? 'Activos' : 'Inactivos'}</button>
          ))}
        </div>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo proveedor</Button>}
      </div>

      <Card title={`Proveedores (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th style={{ minWidth: '14rem' }}>Proveedor</th>
              <th style={{ minWidth: '10rem' }}>Contacto</th>
              <th>Estado</th>
              {canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={reload} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin proveedores</td></tr>
              ) : data.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{p.nombre}</span>
                      <span className={`badge ${p.tipo && p.tipo !== 'general' ? 'badge--info' : 'badge--neutral'}`} style={{ fontSize: '0.65rem' }}>{TIPO_PROVEEDOR_LABEL(p.tipo)}</span>
                      {p.categoria && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{p.categoria}</span>}
                      {!!num(p.nequi) && <span className="badge badge--info" style={{ fontSize: '0.65rem' }}>Nequi</span>}
                    </div>
                    {p.alias && p.alias !== p.nombre && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>Alias: {p.alias}</div>}
                    {p.compra_realizada && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{p.compra_realizada}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: 'var(--fs-sm)' }}>{p.contacto ?? '—'}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{p.telefono ?? '—'}{p.ciudad ? ` · ${p.ciudad}` : ''}</div>
                  </td>
                  <td><span className={`badge badge--${p.estado === 'inactivo' ? 'neutral' : 'success'}`}>{p.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</span></td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelProveedor(p)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre / razón social" required value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          <Select label="Tipo" required value={form.tipo} onChange={e => f('tipo', e.target.value as TipoProveedor)}
            options={TIPO_PROVEEDOR_OPTS} helper="Determina dónde aparece el proveedor (ej: Combustible en la línea de crédito de gasolineras)." />
          <Select label="Categoría (opcional)" placeholder="— Sin categoría —" value={form.id_categoria === '' ? '' : String(form.id_categoria)}
            onChange={e => f('id_categoria', e.target.value === '' ? '' : Number(e.target.value))}
            options={categorias.data.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Alias (opcional)" value={form.alias} onChange={e => f('alias', e.target.value)} />
          <Input label="Contacto (opcional)" placeholder="Nombre de la persona de contacto" value={form.contacto} onChange={e => f('contacto', e.target.value)} />
          <Input label="Teléfono" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
          <Input label="Ciudad" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          <Input label="Compra realizada (opcional)" placeholder="Ej: Transporte de concentrado…" style={{ gridColumn: '1 / -1' }}
            value={form.compra_realizada} onChange={e => f('compra_realizada', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="proveedor-nequi-fin" checked={form.nequi} onChange={e => f('nequi', e.target.checked)} />
            <label htmlFor="proveedor-nequi-fin" style={{ cursor: 'pointer', userSelect: 'none' }}>Usa Nequi</label>
          </div>
          {typeof modal === 'number' && (
            <Select label="Estado" value={form.estado} onChange={e => f('estado', e.target.value)}
              options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          )}
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delProveedor} title="Eliminar proveedor" itemLabel={delProveedor?.nombre}
        loading={deleting} onCancel={() => setDelProveedor(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORÍAS DE PROVEEDOR
// ════════════════════════════════════════════════════════════════════════════
function CategoriasProveedorTab({ canWrite, categorias }: { canWrite: boolean; categorias: ReturnType<typeof useCategoriasProveedor> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nueva' | CategoriaProveedor>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const openNueva = () => { setNombre(''); setModal('nueva') }
  const openEdit = (c: CategoriaProveedor) => { setNombre(c.nombre); setModal(c) }
  const save = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nueva') { await pagosApi.createCategoriaProveedor(nombre.trim()); toast.success('Categoría creada') }
      else if (modal) { await pagosApi.updateCategoriaProveedor(modal.id, nombre.trim()); toast.success('Categoría actualizada') }
      setModal(null); categorias.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delCat, setDelCat] = useState<CategoriaProveedor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delCat) return
    setDeleting(true)
    try { await pagosApi.deleteCategoriaProveedor(delCat.id); toast.success('Categoría eliminada'); setDelCat(null); categorias.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Esta categoría tiene proveedores asociados y no se puede eliminar.' : message)
      setDelCat(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Categorías (${categorias.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNueva}>Nueva categoría</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              {categorias.loading ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : categorias.data.length === 0 ? (
                <tr><td colSpan={canWrite ? 2 : 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin categorías</td></tr>
              ) : categorias.data.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  {canWrite && (
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(c)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelCat(c)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nueva' ? 'Nueva categoría' : 'Editar categoría'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !nombre.trim()}>Guardar</Button></>}>
        <Input label="Nombre" required value={nombre} onChange={e => setNombre(e.target.value)} />
      </Modal>

      <ConfirmDeleteModal open={!!delCat} title="Eliminar categoría" itemLabel={delCat?.nombre} loading={deleting} onCancel={() => setDelCat(null)} onConfirm={confirmDelete} />
    </>
  )
}
