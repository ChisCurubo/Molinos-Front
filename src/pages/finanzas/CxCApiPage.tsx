import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownCircle, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate } from '@/utils/format'
import { pagosCxcApi, type CxcCuenta, type CategoriaCxc } from '@/api/pagosCxc'

const cop = formatCOP
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function useCategoriasCxc() {
  const [data, setData] = useState<CategoriaCxc[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosCxcApi.getCategorias().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

type PageTab = 'cuentas' | 'categorias'

export function CxCApiPage() {
  const canWrite = useCanWrite('finanzas')
  const [tab, setTab] = useState<PageTab>('cuentas')

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()

  const categorias = useCategoriasCxc()
  const [page, setPage] = useState(1)
  const [resp, setResp] = useState<{ cuentas: CxcCuenta[]; pagination: { page: number; total: number; total_pages: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxcApi.getMensual({ mes, anio, page, limit: 50 })
      .then(setResp)
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio, page])
  useEffect(() => { setPage(1) }, [mes, anio])
  useEffect(() => { load() }, [load])

  const cuentas = resp?.cuentas ?? []
  const totalSaldo = cuentas.reduce((s, c) => s + num(c.saldo), 0)

  return (
    <div className="page">
      <PageHeader title="Cuentas por cobrar" subtitle="Cobros a clientes — módulo aún sin ningún flujo de negocio conectado." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
        <span>
          Ningún módulo del ERP escribe todavía en Cuentas por Cobrar (no hay flujo de venta/cobro implementado, ej. venta de concentrado a un cliente).
          El listado de abajo por ahora siempre estará vacío — queda listo para cuando exista el primer módulo de cobro. Mientras tanto, el catálogo
          de categorías sí funciona.
        </span>
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'cuentas'} className={`segment__btn ${tab === 'cuentas' ? 'segment__btn--active' : ''}`} onClick={() => setTab('cuentas')}>Cuentas</button>
        <button role="tab" aria-selected={tab === 'categorias'} className={`segment__btn ${tab === 'categorias' ? 'segment__btn--active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
      </div>

      {tab === 'cuentas' && (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Cuentas" value={resp?.pagination.total ?? 0} icon={<ArrowDownCircle size={16} />} accent="emerald" />
            <KpiTile label="Saldo por cobrar" value={cop(totalSaldo)} accent="rose" />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontWeight: 700, minWidth: '11rem', textAlign: 'center' }}>{MESES[mes - 1]} {anio}{esMesActual && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Actual</span>}</span>
              <button type="button" onClick={() => shiftMonth(1)} disabled={esMesActual} title="Mes siguiente"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: esMesActual ? 'not-allowed' : 'pointer', color: esMesActual ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronRight size={18} />
              </button>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
          </div>

          <Card title={`Cuentas por cobrar (${resp?.pagination.total ?? 0})`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th style={{ minWidth: '16rem' }}>Concepto</th>
                  <th style={{ textAlign: 'right', minWidth: '10rem' }}>Saldo · Total</th>
                  <th style={{ minWidth: '8rem' }}>Estado · Fecha</th>
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
                  ) : error ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                      {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                    </td></tr>
                  ) : cuentas.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin cuentas por cobrar (esperado — módulo sin flujo conectado todavía).</td></tr>
                  ) : cuentas.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{c.concepto || `Cuenta #${c.id}`}</span>
                          {c.categoria && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{c.categoria}</span>}
                        </div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{c.cliente ?? '—'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 'var(--fs-base)' }} className="mono">{cop(num(c.saldo))}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">de {cop(num(c.valor_total))} · cobrado {cop(num(c.valor_cobrado))}</div>
                      </td>
                      <td>
                        <span className="badge badge--neutral">{c.estado}</span>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>{c.fecha_creacion ? formatDate(c.fecha_creacion) : '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resp && resp.pagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span style={{ fontSize: 'var(--fs-sm)' }}>Página {resp.pagination.page} de {resp.pagination.total_pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= resp.pagination.total_pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'categorias' && <CategoriasCxcTab canWrite={canWrite} categorias={categorias} />}
    </div>
  )
}

function CategoriasCxcTab({ canWrite, categorias }: { canWrite: boolean; categorias: ReturnType<typeof useCategoriasCxc> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nueva' | CategoriaCxc>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const openNueva = () => { setNombre(''); setModal('nueva') }
  const openEdit = (c: CategoriaCxc) => { setNombre(c.nombre); setModal(c) }
  const save = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      if (modal === 'nueva') { await pagosCxcApi.createCategoria(nombre.trim()); toast.success('Categoría creada') }
      else if (modal) { await pagosCxcApi.updateCategoria(modal.id, nombre.trim()); toast.success('Categoría actualizada') }
      setModal(null); categorias.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delCat, setDelCat] = useState<CategoriaCxc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delCat) return
    setDeleting(true)
    try { await pagosCxcApi.deleteCategoria(delCat.id); toast.success('Categoría eliminada'); setDelCat(null); categorias.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Esta categoría tiene cuentas asociadas y no se puede eliminar.' : message)
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
