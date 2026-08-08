import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Modal, KpiTile, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MinaSelect, VolquetaSelect, DuenoSelect } from '@/components/common/CatalogSelectors'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { AnalisisCabezaModal, EditAnalisisModal } from '@/components/materiales/analisisModals'
import { useCanWrite } from '@/hooks/usePermissions'
import { invalidateMaterialCatalog } from '@/hooks/useMaterialCatalogos'
import { useEntradas, invalidateEntradas, invalidateAnalisisCache } from '@/hooks/useEntradas'
import { apiError } from '@/api/client'
import { formatCOP } from '@/utils/format'
import {
  materialApi, num,
  type EntradaRow, type EntradaDetalle, type EstadoEntrada, type EstadoPagoFlete,
} from '@/api/material'

const cop = formatCOP
const today = () => new Date().toISOString().slice(0, 10)

const GROUP_TH: CSSProperties = {
  textAlign: 'center', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'var(--text-muted)', background: '#f6f5f3', borderBottom: '1px solid #e5e7eb',
  fontWeight: 700, padding: '4px 6px',
}

const CODE_MSG: Record<string, string> = {
  ANALISIS_NO_ELIMINABLE: 'No se puede borrar: la entrada ya está en viaje o pagada.',
  ENTRADA_CON_ANALISIS: 'No se puede borrar: la entrada tiene análisis. Bórralos primero o cámbiala a cancelada.',
  ENTRADA_CON_SALIDAS: 'No se puede borrar: la entrada tiene salidas/inventario asociado.',
  ENTRADA_NO_ELIMINABLE: 'Esta entrada no se puede borrar en su estado actual.',
}

const ESTADO_BADGE: Record<EstadoEntrada, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'warning' },
  en_proceso: { label: 'En proceso', cls: 'info' },
  incluida_viaje: { label: 'En viaje', cls: 'neutral' },
  pagada: { label: 'Pagada', cls: 'success' },
  cancelada: { label: 'Cancelada', cls: 'neutral' },
}
const FLETE_BADGE: Record<EstadoPagoFlete, { label: string; cls: string }> = {
  pendiente: { label: 'Flete pendiente', cls: 'warning' },
  parcial: { label: 'Flete parcial', cls: 'info' },
  pagado: { label: 'Flete pagado', cls: 'success' },
  no_aplica: { label: 'N/A', cls: 'neutral' },
}
const ESTADOS: (EstadoEntrada | 'todos')[] = ['todos', 'pendiente', 'en_proceso', 'incluida_viaje', 'pagada', 'cancelada']
const ESTADO_LABEL: Record<string, string> = { todos: 'Todos', pendiente: 'Pendiente', en_proceso: 'En proceso', incluida_viaje: 'En viaje', pagada: 'Pagada', cancelada: 'Cancelada' }

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
// Humedad derivada de la lista (peso seco / húmedo) sin pedir el detalle.
function humedadPct(r: EntradaRow): number | null {
  const humedo = num(r.peso_llegada_planta)
  const seco = num(r.total_material_seco)
  if (humedo <= 0 || seco <= 0) return null
  return Math.max(0, 1 - seco / humedo)
}

// ════════════════════════════════════════════════════════════════════════════
// Modal registrar / editar (con «Cancelar entrada» dentro del de edición)
// ════════════════════════════════════════════════════════════════════════════
function LlegadaModal({ open, editId, onClose, onSaved, onRequestDelete }: {
  open: boolean; editId: number | null; onClose: () => void; onSaved: () => void; onRequestDelete: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [volquetaNueva, setVolquetaNueva] = useState(false)
  const [form, setForm] = useState({
    numero_volqueta: '', id_mina: '' as number | '', id_vehiculo: '' as number | '',
    id_tipo_material: '1', fecha_llegada: today(), peso_llegada_planta: '', comentarios: '',
  })
  const [nueva, setNueva] = useState({ placa: '', conductor: '', conductor_cc: '', id_dueno: '' as number | '', tipo_vehiculo: '', capacidad_ton: '' })

  useEffect(() => {
    if (!open) return
    setVolquetaNueva(false)
    setNueva({ placa: '', conductor: '', conductor_cc: '', id_dueno: '', tipo_vehiculo: '', capacidad_ton: '' })
    if (editId != null) {
      materialApi.getEntrada(editId).then(d => setForm({
        numero_volqueta: String(d.numero_volqueta),
        id_mina: d.mina_id ?? '', id_vehiculo: d.vehiculo_id ?? '', id_tipo_material: '1',
        fecha_llegada: d.fecha_llegada?.slice(0, 10) ?? today(),
        peso_llegada_planta: String(num(d.peso_llegada_planta)), comentarios: d.comentarios ?? '',
      })).catch(e => toast.error(apiError(e).message))
    } else {
      setForm({ numero_volqueta: '', id_mina: '', id_vehiculo: '', id_tipo_material: '1', fecha_llegada: today(), peso_llegada_planta: '', comentarios: '' })
    }
  }, [open, editId, toast])

  const valid = form.numero_volqueta && form.id_mina !== '' && form.peso_llegada_planta &&
    (editId != null || (volquetaNueva ? nueva.placa.trim() !== '' : form.id_vehiculo !== ''))

  const save = async () => {
    if (!valid) { toast.error('Completa los campos obligatorios'); return }
    setSaving(true)
    try {
      if (editId != null) {
        await materialApi.updateEntrada(editId, {
          numero_volqueta: Number(form.numero_volqueta),
          id_mina: form.id_mina === '' ? undefined : form.id_mina,
          id_vehiculo: form.id_vehiculo === '' ? undefined : form.id_vehiculo,
          id_tipo_material: Number(form.id_tipo_material),
          fecha_llegada: form.fecha_llegada,
          peso_llegada_planta: Number(form.peso_llegada_planta),
          comentarios: form.comentarios || undefined,
        })
        toast.success('Entrada actualizada')
      } else {
        await materialApi.createEntrada({
          numero_volqueta: Number(form.numero_volqueta),
          id_mina: form.id_mina as number,
          id_vehiculo: volquetaNueva ? null : (form.id_vehiculo as number),
          id_tipo_material: Number(form.id_tipo_material),
          fecha_llegada: form.fecha_llegada,
          peso_llegada_planta: Number(form.peso_llegada_planta),
          comentarios: form.comentarios || undefined,
          ...(volquetaNueva ? {
            nueva_volqueta: {
              placa: nueva.placa.trim().toUpperCase(), conductor: nueva.conductor || undefined,
              conductor_cc: nueva.conductor_cc || undefined, id_dueno: nueva.id_dueno === '' ? undefined : nueva.id_dueno,
              tipo_vehiculo: nueva.tipo_vehiculo || undefined, capacidad_ton: nueva.capacidad_ton ? Number(nueva.capacidad_ton) : undefined,
            },
          } : {}),
        })
        toast.success('Entrada registrada')
        if (volquetaNueva) invalidateMaterialCatalog('volquetas')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} title={editId != null ? `Editar entrada N° ${form.numero_volqueta}` : 'Registrar llegada de material'} onClose={onClose}
      footer={
        <div className="row row--between" style={{ width: '100%' }}>
          <div>{editId != null && <Button variant="danger" icon={<Trash2 size={16} />} onClick={onRequestDelete} disabled={saving}>Borrar registro</Button>}</div>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button onClick={save} disabled={saving || !valid}>{editId != null ? 'Guardar cambios' : 'Registrar'}</Button>
          </div>
        </div>
      }>
      {editId == null && (
        <div className="segment" style={{ marginBottom: '0.75rem' }}>
          <button className={`segment__btn ${!volquetaNueva ? 'segment__btn--active' : ''}`} onClick={() => setVolquetaNueva(false)}>Volqueta registrada</button>
          <button className={`segment__btn ${volquetaNueva ? 'segment__btn--active' : ''}`} onClick={() => setVolquetaNueva(true)}>Volqueta nueva</button>
        </div>
      )}

      {(editId != null || !volquetaNueva) ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <VolquetaSelect required={editId == null} value={form.id_vehiculo} onChange={v => setForm(f => ({ ...f, id_vehiculo: v }))} />
        </div>
      ) : (
        <div style={{ border: '1.5px solid var(--amber-300)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '0.75rem', background: '#fffbf0' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', marginBottom: '0.5rem' }}>Registrar nueva volqueta</div>
          <div className="grid grid--form" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Input label="Placa" required value={nueva.placa} onChange={e => setNueva(n => ({ ...n, placa: e.target.value }))} style={{ fontFamily: 'var(--font-mono)' }} />
            <Input label="Conductor" value={nueva.conductor} onChange={e => setNueva(n => ({ ...n, conductor: e.target.value }))} />
            <Input label="Cédula conductor" value={nueva.conductor_cc} onChange={e => setNueva(n => ({ ...n, conductor_cc: e.target.value }))} />
            <DuenoSelect value={nueva.id_dueno} onChange={v => setNueva(n => ({ ...n, id_dueno: v }))} />
            <Input label="Tipo de vehículo" value={nueva.tipo_vehiculo} onChange={e => setNueva(n => ({ ...n, tipo_vehiculo: e.target.value }))} />
            <Input label="Capacidad (t)" type="number" step="0.1" value={nueva.capacidad_ton} onChange={e => setNueva(n => ({ ...n, capacidad_ton: e.target.value }))} />
          </div>
        </div>
      )}

      <div className="grid grid--form">
        <Input label="N° volqueta" type="number" step="1" required value={form.numero_volqueta} onChange={e => setForm(f => ({ ...f, numero_volqueta: e.target.value }))} />
        <Input label="Fecha de llegada" type="date" required value={form.fecha_llegada} onChange={e => setForm(f => ({ ...f, fecha_llegada: e.target.value }))} />
        <MinaSelect required value={form.id_mina} onChange={v => setForm(f => ({ ...f, id_mina: v }))} />
        <Input label="Tipo de material (id)" type="number" required value={form.id_tipo_material} onChange={e => setForm(f => ({ ...f, id_tipo_material: e.target.value }))} />
        <Input label="Toneladas (peso húmedo)" type="number" step="0.001" required value={form.peso_llegada_planta} onChange={e => setForm(f => ({ ...f, peso_llegada_planta: e.target.value }))} />
        <Input label="Comentarios" value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} />
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        El análisis se agrega después con <FlaskConical size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> en la tabla.
      </p>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Detalle expandido
// ════════════════════════════════════════════════════════════════════════════
function DetalleRow({ id, canWrite, cols, nonce, onAddAnalisis, onEditAnalisis, onRequestDeleteAnalisis }: {
  id: number; canWrite: boolean; cols: number; nonce: number
  onAddAnalisis: (id: number) => void; onEditAnalisis: (id: number) => void; onRequestDeleteAnalisis: (id: number) => void
}) {
  const [d, setD] = useState<EntradaDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getEntrada(id).then(setD).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load, nonce])

  return (
    <tr>
      <td colSpan={cols} style={{ padding: '0.85rem 1.25rem', background: '#fafaf9' }}>
        {loading ? <span style={{ color: 'var(--text-muted)' }}>Cargando detalle…</span>
        : error ? <span style={{ color: 'var(--rose-600)' }}>{error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></span>
        : d && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.25rem' }}>
            <div>
              <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FlaskConical size={14} /> Análisis registrados ({d.analisis.length})</strong>
                {canWrite && <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => onAddAnalisis(d.id)}>Registrar cabeza</Button>}
              </div>
              {d.analisis.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin análisis.</em> : (
                <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '2px 6px' }}>Tipo</th><th style={{ padding: '2px 6px' }}>N.°</th>
                    <th style={{ padding: '2px 6px', textAlign: 'right' }}>Humedad</th>
                    <th style={{ padding: '2px 6px', textAlign: 'right' }}>T. secas</th>
                    <th style={{ padding: '2px 6px', textAlign: 'right' }}>Tenor real</th>
                    <th style={{ padding: '2px 6px', textAlign: 'right' }}>Tenor falso</th>
                    <th style={{ padding: '2px 6px', textAlign: 'right' }}>Au total (g)</th>
                    {canWrite && <th></th>}
                  </tr></thead>
                  <tbody>
                    {d.analisis.map(a => {
                      const h = num(a.porcentaje_humedad)
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '3px 6px', fontWeight: 700, textTransform: 'capitalize' }}>{a.tipo_analisis}</td>
                          <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)' }}>{a.numero_analisis}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{(h <= 1 ? h * 100 : h).toFixed(1)}%</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.toneladas_secas != null ? num(a.toneladas_secas).toFixed(4) : '—'}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{a.tenor_real != null ? num(a.tenor_real).toFixed(2) : '—'}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.tenor_falso != null ? num(a.tenor_falso).toFixed(2) : '—'}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.au_gramos_totales != null ? num(a.au_gramos_totales).toFixed(1) : '—'}</td>
                          {canWrite && <td style={{ whiteSpace: 'nowrap' }}>
                            <Button variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => onEditAnalisis(a.id)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => onRequestDeleteAnalisis(a.id)} />
                          </td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', display: 'block', marginBottom: '0.5rem' }}>Detalle del material</strong>
              <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Peso húmedo</span><strong className="mono">{num(d.detalle.peso_humedo).toFixed(3)} t</strong>
                <span style={{ color: 'var(--text-muted)' }}>Humedad</span><strong className="mono">{num(d.detalle.humedad_pct).toFixed(1)}%</strong>
                <span style={{ color: 'var(--text-muted)' }}>Ton secas</span><strong className="mono">{num(d.detalle.ton_secas).toFixed(4)} t</strong>
                <span style={{ color: 'var(--text-muted)' }}>Tenor Au</span><strong className="mono">{num(d.detalle.tenor_au).toFixed(2)} g/t</strong>
                <span style={{ color: 'var(--text-muted)' }}>Flete</span><strong className="mono">{cop(num(d.detalle.flete))}</strong>
                <span style={{ color: 'var(--text-muted)' }}>ACPM adelantado</span><strong className="mono">{cop(num(d.detalle.acpm_adelantado))}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Gastos operativos</span><strong className="mono" style={{ color: '#b45309' }}>{cop(num(d.detalle.gastos_operativos))}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Valor material</span><strong className="mono" style={{ color: '#15803d' }}>{cop(num(d.detalle.valor_material))}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Estado pago</span><span>{d.detalle.estado_pago}</span>
                {d.comentarios && <><span style={{ color: 'var(--text-muted)' }}>Comentarios</span><span>{d.comentarios}</span></>}
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════════════════════
export function EntradasApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  // Lista de entradas desde la caché compartida (se reutiliza entre pantallas).
  const { data: all, loading, error, reload } = useEntradas()

  // Filtros (todos en el front sobre la data cargada)
  const [busqueda, setBusqueda] = useState('')
  const [mineroF, setMineroF] = useState('todos')
  const [estadoF, setEstadoF] = useState<EstadoEntrada | 'todos'>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const [expanded, setExpanded] = useState<number | null>(null)
  const [llegadaOpen, setLlegadaOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [analisisEntrada, setAnalisisEntrada] = useState<number | null>(null)
  const [editAnalisis, setEditAnalisis] = useState<number | null>(null)
  const [detailNonce, setDetailNonce] = useState(0)
  // Borrado con confirmación por escritura (una sola cola para entrada o análisis)
  const [del, setDel] = useState<{ kind: 'entrada' | 'analisis'; id: number; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const minas = useMemo(() => [...new Set(all.map(m => m.mina).filter(Boolean) as string[])].sort(), [all])

  const filtrados = useMemo(() => all.filter(m => {
    if (estadoF !== 'todos' && m.estado !== estadoF) return false
    if (mineroF !== 'todos' && m.mina !== mineroF) return false
    const f = m.fecha_llegada?.slice(0, 10) ?? ''
    if (fechaDesde && f < fechaDesde) return false
    if (fechaHasta && f > fechaHasta) return false
    if (busqueda) {
      const q = busqueda.toUpperCase()
      if (!(m.mina ?? '').toUpperCase().includes(q) && !String(m.numero_volqueta).includes(q) && !(m.placa ?? '').toUpperCase().includes(q)) return false
    }
    return true
  }), [all, estadoF, mineroF, fechaDesde, fechaHasta, busqueda])

  const totalHumedo = filtrados.reduce((s, m) => s + num(m.peso_llegada_planta), 0)
  const totalSeco = filtrados.reduce((s, m) => s + num(m.total_material_seco), 0)
  const sinAnalisis = filtrados.filter(m => !num(m.tiene_analisis_cabeza)).length
  const pendientesPago = filtrados.filter(m => m.estado_pago_flete === 'pendiente').length

  const refresh = () => { invalidateAnalisisCache(); invalidateEntradas(); reload(); setDetailNonce(n => n + 1) }

  // Pide borrar una entrada (desde el modal de edición): cierra edición y abre confirmación.
  const requestDeleteEntrada = () => {
    if (editId == null) return
    const numero = all.find(m => m.id === editId)?.numero_volqueta
    setLlegadaOpen(false)
    setDel({ kind: 'entrada', id: editId, label: `la entrada N° ${numero ?? editId}` })
  }

  const confirmDelete = async () => {
    if (!del) return
    setDeleting(true)
    try {
      if (del.kind === 'entrada') await materialApi.deleteEntrada(del.id)
      else await materialApi.deleteAnalisis(del.id)
      toast.success(del.kind === 'entrada' ? 'Registro borrado' : 'Análisis borrado')
      setDel(null); refresh()
    } catch (e) {
      const { code, message } = apiError(e)
      toast.error(code ? (CODE_MSG[code] ?? message) : message)
      setDel(null)
    } finally { setDeleting(false) }
  }

  const cols = canWrite ? 10 : 9

  return (
    <div className="page">
      <PageHeader
        title="Entradas de material"
        subtitle={`${filtrados.length} registros · ${totalHumedo.toFixed(3)} t húmedo · ${totalSeco.toFixed(4)} t seco`}
        actions={canWrite && <Button icon={<Plus size={18} />} onClick={() => { setEditId(null); setLlegadaOpen(true) }}>Registrar llegada</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Registros" value={filtrados.length} accent="brown" />
        <KpiTile label="Peso húmedo (t)" value={totalHumedo.toFixed(3)} accent="green" />
        <KpiTile label="Peso seco (t)" value={totalSeco.toFixed(4)} accent="emerald" />
        <KpiTile label="Sin análisis" value={sinAnalisis} accent="rose" />
        <KpiTile label="Flete pendiente" value={pendientesPago} accent="amber" />
      </div>

      <Card title={`Materiales (${filtrados.length})`}>
        <div className="toolbar" style={{ marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por mina, N.° volqueta o placa…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '16rem' }} />
          <select className="field__select" style={{ maxWidth: '11rem' }} value={mineroF} onChange={e => setMineroF(e.target.value)}>
            <option value="todos">Todas las minas</option>
            {minas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="segment">
            {ESTADOS.map(e => <button key={e} className={`segment__btn ${estadoF === e ? 'segment__btn--active' : ''}`} onClick={() => setEstadoF(e)}>{ESTADO_LABEL[e]}</button>)}
          </div>
          <input className="field__input" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ background: '#f6f5f3', borderBottom: '1px solid #e5e7eb' }}></th>
                <th colSpan={2} style={GROUP_TH}>Identificación</th>
                <th colSpan={4} style={GROUP_TH}>Material y ley</th>
                <th style={GROUP_TH}>Valor</th>
                <th style={GROUP_TH}>Estado</th>
                {canWrite && <th style={{ background: '#f6f5f3', borderBottom: '1px solid #e5e7eb' }}></th>}
              </tr>
              <tr>
                <th style={{ width: '1.5rem' }}></th>
                <th>Mina / Minero</th>
                <th>Fecha · N.° Vol</th>
                <th style={{ textAlign: 'right' }}>Húmedo (t)</th>
                <th style={{ textAlign: 'right' }}>Seco (t)</th>
                <th style={{ textAlign: 'right' }}>Humedad</th>
                <th style={{ textAlign: 'right' }}>Tenor Au</th>
                <th style={{ textAlign: 'right' }}>Valor mat.</th>
                <th>Estado</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              : error ? <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>{error} · <button onClick={reload} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></td></tr>
              : filtrados.length === 0 ? <tr><td colSpan={cols} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              : filtrados.map(m => {
                const isExp = expanded === m.id
                const seco = num(m.total_material_seco)
                const hum = humedadPct(m)
                const tenor = num(m.tenor)
                const valor = num(m.total_material || m.precio_total)
                const eb = ESTADO_BADGE[m.estado] ?? { label: m.estado, cls: 'neutral' }
                const fb = FLETE_BADGE[m.estado_pago_flete] ?? { label: m.estado_pago_flete, cls: 'neutral' }
                return (
                  <Fragment key={m.id}>
                    <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }} onClick={() => setExpanded(isExp ? null : m.id)}>
                      <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      <td style={{ fontWeight: 700 }}>
                        {m.mina ?? '—'}
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>{m.minero_alias ?? m.minero ?? ''}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha_llegada)}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>N° {m.numero_volqueta}</div>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(m.peso_llegada_planta).toFixed(3)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{seco > 0 ? seco.toFixed(4) : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{hum != null ? `${(hum * 100).toFixed(1)}%` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: tenor > 0 ? 'var(--amber-700)' : undefined }} className="mono">{tenor > 0 ? tenor.toFixed(2) : <em style={{ color: 'var(--text-faint)', fontWeight: 400 }}>S/A</em>}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{valor > 0 ? <strong style={{ color: '#15803d' }}>{cop(valor)}</strong> : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge badge--${eb.cls}`}>{eb.label}</span>
                          <span className={`badge badge--${fb.cls}`}>{fb.label}</span>
                        </div>
                      </td>
                      {canWrite && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} title="Editar / cancelar" onClick={() => { setEditId(m.id); setLlegadaOpen(true) }} />
                            <Button variant="secondary" size="sm" title={num(m.tiene_analisis_cabeza) ? 'Con análisis' : 'Sin análisis — registrar'}
                              icon={<FlaskConical size={14} style={{ color: num(m.tiene_analisis_cabeza) ? 'var(--green-600)' : 'var(--rose-600)' }} />}
                              onClick={() => setAnalisisEntrada(m.id)} />
                          </div>
                        </td>
                      )}
                    </tr>
                    {isExp && <DetalleRow id={m.id} canWrite={canWrite} cols={cols} nonce={detailNonce}
                      onAddAnalisis={setAnalisisEntrada} onEditAnalisis={setEditAnalisis}
                      onRequestDeleteAnalisis={(idA) => setDel({ kind: 'analisis', id: idA, label: 'este análisis' })} />}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalHumedo.toFixed(3)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalSeco.toFixed(4)}</td>
                <td colSpan={canWrite ? 5 : 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <LlegadaModal open={llegadaOpen} editId={editId} onClose={() => setLlegadaOpen(false)} onSaved={refresh} onRequestDelete={requestDeleteEntrada} />
      <AnalisisCabezaModal idEntrada={analisisEntrada} onClose={() => setAnalisisEntrada(null)} onSaved={() => { refresh() }} />
      <EditAnalisisModal id={editAnalisis} onClose={() => setEditAnalisis(null)} onSaved={() => { refresh() }} />
      <ConfirmDeleteModal
        open={!!del}
        title={del?.kind === 'analisis' ? 'Borrar análisis' : 'Borrar registro'}
        itemLabel={del?.label}
        loading={deleting}
        onCancel={() => setDel(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
