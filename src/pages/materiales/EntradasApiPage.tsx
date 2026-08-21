import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Coins, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, Modal, Select, KpiTile, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { MinaSelect, VolquetaSelect, DuenoSelect, TipoMaterialSelect } from '@/components/common/CatalogSelectors'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { AnalisisCabezaModal, EditAnalisisModal } from '@/components/materiales/analisisModals'
import { useCanWrite } from '@/hooks/usePermissions'
import { invalidateMaterialCatalog } from '@/hooks/useMaterialCatalogos'
import { useEntradas, invalidateEntradas, invalidateAnalisisCache } from '@/hooks/useEntradas'
import { apiError } from '@/api/client'
import { formatCOP } from '@/utils/format'
import {
  materialApi, num,
  type EntradaRow, type EntradaDetalle, type EstadoEntrada, type EstadoPagoFlete, type MetodoCalculo,
  type GastosOperativosPayload,
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
// Dec → string para inputs (vacío si es 0/null).
const decStr = (v: unknown) => { const n = num(v); return n > 0 ? String(n) : '' }
// Solo estos costos se editan desde materiales. Maquila y volqueta son solo
// lectura (se ven en el detalle, no se tocan aquí).
const GASTO_KEYS: { key: keyof GastosState; api: keyof GastosOperativosPayload; label: string }[] = [
  { key: 'cargue', api: 'costo_cargue', label: 'Cargue' },
  { key: 'bascula', api: 'costo_bascula', label: 'Báscula' },
  { key: 'adicional', api: 'costo_adicional', label: 'Adicional' },
]
type GastosState = { cargue: string; bascula: string; adicional: string }
const EMPTY_GASTOS: GastosState = { cargue: '', bascula: '', adicional: '' }

export function LlegadaModal({ open, editId, onClose, onSaved, onRequestDelete, simple = false }: {
  open: boolean; editId: number | null; onClose: () => void; onSaved: () => void; onRequestDelete: () => void
  /** `simple`: solo campos de la llegada (hasta ACPM); oculta precio/gastos/excedente. */
  simple?: boolean
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [volquetaNueva, setVolquetaNueva] = useState(false)
  const [form, setForm] = useState({
    numero_volqueta: '', id_mina: '' as number | '', id_vehiculo: '' as number | '',
    id_tipo_material: '' as number | '', fecha_llegada: today(), peso_llegada_planta: '', acpm: '', comentarios: '',
  })
  const [formIni, setFormIni] = useState('')  // snapshot JSON de los campos de la entrada
  const [nueva, setNueva] = useState({ placa: '', conductor: '', conductor_cc: '', id_dueno: '' as number | '', tipo_vehiculo: '', capacidad_ton: '' })
  // Edición del precio (Fase 3) — solo en modo edición y con tenor listo.
  const [precioEdit, setPrecioEdit] = useState({ tenor: 0, tonSecas: 0, metodo: 'por_gramo' as MetodoCalculo, valor: '' })
  const [precioInicial, setPrecioInicial] = useState({ metodo: 'por_gramo' as MetodoCalculo, valor: '' })
  // Gastos operativos y excedente (paneles editables en modo edición).
  const [gastos, setGastos] = useState<GastosState>(EMPTY_GASTOS)
  const [gastosIni, setGastosIni] = useState<GastosState>(EMPTY_GASTOS)
  // Excedente = ton secas × número. Guardamos el «número» (factor); el total va al PUT.
  const [excedenteNum, setExcedenteNum] = useState('')
  const [excedenteNumIni, setExcedenteNumIni] = useState('')

  useEffect(() => {
    if (!open) return
    setVolquetaNueva(false)
    setNueva({ placa: '', conductor: '', conductor_cc: '', id_dueno: '', tipo_vehiculo: '', capacidad_ton: '' })
    setPrecioEdit({ tenor: 0, tonSecas: 0, metodo: 'por_gramo', valor: '' })
    setPrecioInicial({ metodo: 'por_gramo', valor: '' })
    setGastos(EMPTY_GASTOS); setGastosIni(EMPTY_GASTOS)
    setExcedenteNum(''); setExcedenteNumIni('')
    if (editId != null) {
      materialApi.getEntrada(editId).then(d => {
        const f = {
          numero_volqueta: String(d.numero_volqueta),
          id_mina: (d.mina_id ?? '') as number | '', id_vehiculo: (d.vehiculo_id ?? '') as number | '',
          id_tipo_material: (d.tipo_material_id ?? '') as number | '',
          fecha_llegada: d.fecha_llegada?.slice(0, 10) ?? today(),
          peso_llegada_planta: String(num(d.peso_llegada_planta)), acpm: decStr(d.detalle.acpm_adelantado),
          comentarios: d.comentarios ?? '',
        }
        setForm(f); setFormIni(JSON.stringify(f))
        const porTon = num(d.precio_por_tonelada)
        const metodo: MetodoCalculo = porTon > 0 ? 'por_tonelada' : 'por_gramo'
        const valor = porTon > 0 ? String(porTon) : (num(d.precio_por_gramo) > 0 ? String(num(d.precio_por_gramo)) : '')
        setPrecioEdit({ tenor: num(d.tenor), tonSecas: num(d.total_material_seco), metodo, valor })
        setPrecioInicial({ metodo, valor })
        // Costos editables (cargue, báscula, adicional). Maquila y volqueta: solo lectura.
        const g: GastosState = {
          cargue: decStr(d.detalle.costo_cargue ?? d.costo_cargue),
          bascula: decStr(d.detalle.costo_bascula ?? d.costo_bascula),
          adicional: decStr(d.detalle.costo_adicional ?? d.costo_adicional),
        }
        setGastos(g); setGastosIni(g)
        // Excedente = ton secas × número → retrocalculamos el número desde el valor guardado.
        const excCop = num(d.detalle.excedente ?? d.excedente_calculado)
        const ts = num(d.total_material_seco)
        const factor = excCop > 0 && ts > 0 ? String(excCop / ts) : ''
        setExcedenteNum(factor); setExcedenteNumIni(factor)
      }).catch(e => toast.error(apiError(e).message))
    } else {
      const f = { numero_volqueta: '', id_mina: '' as number | '', id_vehiculo: '' as number | '', id_tipo_material: '' as number | '', fecha_llegada: today(), peso_llegada_planta: '', acpm: '', comentarios: '' }
      setForm(f); setFormIni('')
    }
  }, [open, editId, toast])

  const valid = form.numero_volqueta && form.id_mina !== '' && form.peso_llegada_planta &&
    (editId != null || (form.id_tipo_material !== '' && (volquetaNueva ? nueva.placa.trim() !== '' : form.id_vehiculo !== '')))

  const save = async () => {
    if (!valid) { toast.error('Completa los campos obligatorios'); return }
    setSaving(true)
    try {
      if (editId != null) {
        // Solo disparamos las llamadas de los paneles que cambiaron.
        if (JSON.stringify(form) !== formIni) {
          await materialApi.updateEntrada(editId, {
            numero_volqueta: Number(form.numero_volqueta),
            id_mina: form.id_mina === '' ? undefined : form.id_mina,
            id_vehiculo: form.id_vehiculo === '' ? undefined : form.id_vehiculo,
            id_tipo_material: form.id_tipo_material === '' ? undefined : Number(form.id_tipo_material),
            fecha_llegada: form.fecha_llegada,
            peso_llegada_planta: Number(form.peso_llegada_planta),
            acpm_adelantado: form.acpm === '' ? undefined : Number(form.acpm),
            comentarios: form.comentarios || undefined,
          })
        }
        // Paneles avanzados (precio, gastos, excedente): solo en modo completo.
        if (!simple) {
          // Precio (Fase 3): solo si cambió y es válido.
          const pValorNum = Number(precioEdit.valor)
          const pCambio = precioEdit.valor.trim() !== '' && Number.isFinite(pValorNum) && pValorNum > 0 &&
            (precioEdit.metodo !== precioInicial.metodo || precioEdit.valor !== precioInicial.valor)
          if (precioEdit.tenor > 0 && pCambio) {
            await materialApi.setPrecioEntrada(editId, precioEdit.metodo === 'por_gramo'
              ? { precio_por_gramo: pValorNum }
              : { precio_por_tonelada: pValorNum })
          }
          // Gastos operativos: manda solo los costos que cambiaron.
          const gastosBody: GastosOperativosPayload = {}
          for (const { key, api } of GASTO_KEYS) {
            if (gastos[key] !== gastosIni[key]) gastosBody[api] = Number(gastos[key]) || 0
          }
          if (Object.keys(gastosBody).length > 0) await materialApi.updateGastosOperativos(editId, gastosBody)
          // Excedente = ton secas × número. Se envía el «número» (factor); el backend
          // lo multiplica por las ton secas. NO enviar el total ya calculado.
          if (excedenteNum !== excedenteNumIni && excedenteNum.trim() !== '') {
            const factor = Number(excedenteNum)
            if (Number.isFinite(factor) && factor >= 0) {
              await materialApi.putExcedente(editId, { excedente: factor, fecha_calculo: today() })
            }
          }
        }
        toast.success('Cambios guardados')
      } else {
        await materialApi.createEntrada({
          numero_volqueta: Number(form.numero_volqueta),
          id_mina: form.id_mina as number,
          id_vehiculo: volquetaNueva ? null : (form.id_vehiculo as number),
          id_tipo_material: Number(form.id_tipo_material),
          fecha_llegada: form.fecha_llegada,
          peso_llegada_planta: Number(form.peso_llegada_planta),
          acpm_adelantado: form.acpm === '' ? undefined : Number(form.acpm),
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

  const totalGastos = GASTO_KEYS.reduce((s, { key }) => s + (Number(gastos[key]) || 0), 0)
  const excedenteCalc = precioEdit.tonSecas * (Number(excedenteNum) || 0)

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
        <TipoMaterialSelect required value={form.id_tipo_material} onChange={v => setForm(f => ({ ...f, id_tipo_material: v }))} />
        <Input label="Toneladas (peso húmedo)" type="number" step="0.001" required value={form.peso_llegada_planta} onChange={e => setForm(f => ({ ...f, peso_llegada_planta: e.target.value }))} />
        <Input label="ACPM adelantado (COP)" type="number" step="1000" mono value={form.acpm} onChange={e => setForm(f => ({ ...f, acpm: e.target.value }))} helper="Se descuenta del flete al pagar." />
        <Input label="Comentarios" value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} />
      </div>

      {!simple && editId != null && precioEdit.tenor > 0 && (() => {
        const pValorNum = Number(precioEdit.valor)
        const pValido = precioEdit.valor.trim() !== '' && Number.isFinite(pValorNum) && pValorNum > 0
        const pGramos = precioEdit.tonSecas * precioEdit.tenor
        const pPreview = pValido ? calcPrecioTotal(precioEdit.metodo, pValorNum, pGramos, precioEdit.tonSecas) : null
        const unidad = precioEdit.metodo === 'por_gramo' ? '$/gr Au' : '$/ton seca'
        return (
          <div style={{ border: '1.5px solid var(--amber-300)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginTop: '0.85rem', background: '#fffbf0' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Coins size={14} /> Precio del material
            </div>
            <div className="grid grid--form" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Select label="Pagar por" value={precioEdit.metodo} disabled={saving}
                onChange={e => setPrecioEdit(p => ({ ...p, metodo: e.target.value as MetodoCalculo, valor: '' }))}
                options={[{ value: 'por_gramo', label: 'Por gramo' }, { value: 'por_tonelada', label: 'Por tonelada' }]} />
              <Input label={`Precio (${unidad})`} type="number" min="0" step="any" mono disabled={saving}
                placeholder={precioEdit.metodo === 'por_gramo' ? 'Precio por gramo' : 'Precio por tonelada'}
                value={precioEdit.valor} onChange={e => setPrecioEdit(p => ({ ...p, valor: e.target.value }))}
                helper={precioEdit.metodo === 'por_gramo' ? `Referencia: ${pGramos.toFixed(2)} gr Au` : `Referencia: ${precioEdit.tonSecas.toFixed(2)} t secas`} />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>
              Pagaríamos: {pPreview != null
                ? <strong className="mono" style={{ color: '#15803d' }}>{cop(pPreview)}</strong>
                : <em style={{ color: 'var(--text-faint)' }}>—</em>}
              {precioInicial.valor !== '' && <span style={{ color: 'var(--text-faint)', marginLeft: 8, fontSize: 'var(--fs-xs)' }}>(deja igual para no cambiarlo)</span>}
            </div>
          </div>
        )
      })()}

      {!simple && editId != null && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginTop: '0.85rem' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', marginBottom: '0.5rem' }}>Gastos operativos</div>
          <div className="grid grid--form" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {GASTO_KEYS.map(({ key, label }) => (
              <Input key={key} label={label} type="number" min="0" step="any" mono disabled={saving}
                value={gastos[key]} onChange={e => setGastos(g => ({ ...g, [key]: e.target.value }))} />
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>
            Subtotal editable: <strong className="mono" style={{ color: '#b45309' }}>{cop(totalGastos)}</strong>
            <span style={{ color: 'var(--text-faint)', marginLeft: 8, fontSize: 'var(--fs-xs)' }}>Maquila, volqueta, flete y ACPM son solo lectura (en el detalle).</span>
          </div>
        </div>
      )}

      {!simple && editId != null && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginTop: '0.85rem' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', marginBottom: '0.5rem' }}>Excedente</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Ton secas: <strong className="mono">{precioEdit.tonSecas.toFixed(4)} t</strong>
          </div>
          <div className="grid grid--form">
            <Input label="Número (× ton secas)" type="number" min="0" step="any" mono disabled={saving}
              value={excedenteNum} onChange={e => setExcedenteNum(e.target.value)}
              helper="El excedente = ton secas × este número. Se guarda aparte; no afecta el total del material." />
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>
            Excedente: {excedenteNum.trim() !== '' && Number(excedenteNum) > 0
              ? <strong className="mono" style={{ color: '#15803d' }}>{cop(excedenteCalc)}</strong>
              : <em style={{ color: 'var(--text-faint)' }}>—</em>}
          </div>
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        El análisis se agrega después con <FlaskConical size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> en la tabla.
      </p>
    </Modal>
  )
}

// Mensajes por código HTTP del PATCH .../precio (validación en el backend).
const PRECIO_MSG: Record<number, string> = {
  400: 'Precio inválido: debe ser mayor a 0 y con un solo método.',
  404: 'La entrada ya no existe.',
  409: 'No se puede fijar el precio: la entrada está cancelada o sin análisis (Fase 2 incompleta).',
}

// Calcula el precio total (COP) a partir del método y precio unitario.
function calcPrecioTotal(metodo: MetodoCalculo, precio: number, gramos: number, tonSecas: number) {
  return metodo === 'por_gramo' ? gramos * precio : tonSecas * precio
}

// ════════════════════════════════════════════════════════════════════════════
// Modal · Registrar precio (Fase 3) — se abre desde el botón «Precio» de la fila.
// La edición de un precio ya fijado se hace en el modal de edición del material.
// ════════════════════════════════════════════════════════════════════════════
function PrecioModal({ row, onClose, onSaved }: {
  row: EntradaRow | null; onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [metodo, setMetodo] = useState<MetodoCalculo>('por_gramo')
  const [precioStr, setPrecioStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (row) { setMetodo('por_gramo'); setPrecioStr(''); setError(null); setSaving(false) }
  }, [row])

  const tenor = num(row?.tenor)
  const tonSecas = num(row?.total_material_seco)
  const gramos = tonSecas * tenor // Au total (g) = ton secas × tenor (g/t)

  const precio = Number(precioStr)
  const precioValido = precioStr.trim() !== '' && Number.isFinite(precio) && precio > 0
  const preview = precioValido ? calcPrecioTotal(metodo, precio, gramos, tonSecas) : null

  const cambiarMetodo = (m: MetodoCalculo) => { setMetodo(m); setPrecioStr(''); setError(null) }

  const confirmar = async () => {
    if (!row || !precioValido || saving) return
    setSaving(true); setError(null)
    try {
      await materialApi.setPrecioEntrada(row.id, metodo === 'por_gramo'
        ? { precio_por_gramo: precio }
        : { precio_por_tonelada: precio })
      toast.success('Precio registrado')
      onSaved(); onClose()
    } catch (e) {
      const { status, message } = apiError(e)
      setError(status && PRECIO_MSG[status] ? PRECIO_MSG[status] : message)
    } finally {
      setSaving(false)
    }
  }

  const unidad = metodo === 'por_gramo' ? '$/gr Au' : '$/ton seca'
  return (
    <Modal open={!!row} title={`Registrar precio · N° ${row?.numero_volqueta ?? ''}`} onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!precioValido || saving}>{saving ? 'Guardando…' : 'Confirmar precio'}</Button>
        </>
      }>
      {row && (
        <>
          <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
            <strong>{row.mina ?? '—'}</strong> · Tenor Au <strong className="mono">{tenor.toFixed(2)} g/t</strong> · Ton secas <strong className="mono">{tonSecas.toFixed(4)} t</strong>
          </div>
          <div className="grid grid--form">
            <Select label="Pagar por" value={metodo} onChange={e => cambiarMetodo(e.target.value as MetodoCalculo)} disabled={saving}
              options={[{ value: 'por_gramo', label: 'Por gramo' }, { value: 'por_tonelada', label: 'Por tonelada' }]} />
            <Input label={`Precio (${unidad})`} type="number" min="0" step="any" mono disabled={saving}
              placeholder={metodo === 'por_gramo' ? 'Precio por gramo' : 'Precio por tonelada'}
              value={precioStr} onChange={e => setPrecioStr(e.target.value)}
              helper={metodo === 'por_gramo' ? `Referencia: ${gramos.toFixed(2)} gr Au totales` : `Referencia: ${tonSecas.toFixed(2)} t secas`} />
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            Pagaríamos: {preview != null
              ? <strong className="mono" style={{ color: '#15803d' }}>{cop(preview)}</strong>
              : <em style={{ color: 'var(--text-faint)' }}>—</em>}
          </div>
          {error && <p style={{ color: 'var(--rose-600)', fontSize: 'var(--fs-sm)', marginTop: '0.5rem' }}>{error}</p>}
        </>
      )}
    </Modal>
  )
}

// Encabezado de subgrupo dentro de «Detalle del material».
const SUBHEAD: CSSProperties = {
  gridColumn: '1 / -1', marginTop: '0.45rem', paddingTop: '0.3rem', borderTop: '1px solid #ececea',
  fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' }}>
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

                {/* Precio del material (solo lectura; se registra/edita desde el botón o el modal de material) */}
                {num(d.detalle.precio_total ?? d.precio_total) > 0 ? (
                  <>
                    <span style={SUBHEAD}>Precio del material</span>
                    {num(d.precio_por_gramo) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Precio por gramo</span><strong className="mono">{cop(num(d.precio_por_gramo))}</strong></>}
                    {num(d.precio_por_tonelada) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Precio por tonelada</span><strong className="mono">{cop(num(d.precio_por_tonelada))}</strong></>}
                    <span style={{ color: 'var(--text-muted)' }}>Precio total</span><strong className="mono" style={{ color: '#15803d' }}>{cop(num(d.detalle.precio_total ?? d.precio_total))}</strong>
                  </>
                ) : (
                  <>
                    <span style={SUBHEAD}>Precio del material</span>
                    <span style={{ gridColumn: '1 / -1', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>
                      {num(d.tenor) > 0 ? 'Sin precio — usa el botón «Precio» de la fila.' : 'Pendiente: registra el análisis (tenor) primero.'}
                    </span>
                  </>
                )}

                {/* Gastos operativos (Flete = Volqueta, se muestra una vez) */}
                <span style={SUBHEAD}>Gastos operativos</span>
                <span style={{ color: 'var(--text-muted)' }}>ACPM adelantado</span><strong className="mono">{cop(num(d.detalle.acpm_adelantado))}</strong>
                {num(d.detalle.costo_cargue ?? d.costo_cargue) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Cargue</span><strong className="mono">{cop(num(d.detalle.costo_cargue ?? d.costo_cargue))}</strong></>}
                {num(d.detalle.costo_bascula ?? d.costo_bascula) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Báscula</span><strong className="mono">{cop(num(d.detalle.costo_bascula ?? d.costo_bascula))}</strong></>}
                {num(d.detalle.costo_maquila ?? d.costo_maquila) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Maquila</span><strong className="mono">{cop(num(d.detalle.costo_maquila ?? d.costo_maquila))}</strong></>}
                {num(d.detalle.costo_adicional ?? d.costo_adicional) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Adicional</span><strong className="mono">{cop(num(d.detalle.costo_adicional ?? d.costo_adicional))}</strong></>}
                {num(d.detalle.costo_volqueta ?? d.costo_volqueta) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Volqueta</span><strong className="mono">{cop(num(d.detalle.costo_volqueta ?? d.costo_volqueta))}</strong></>}
                <span style={{ color: 'var(--text-muted)' }}>Total gastos oper.</span><strong className="mono" style={{ color: '#b45309' }}>{cop(num(d.detalle.total_costos_operativos ?? d.total_costos_operativos) || num(d.detalle.gastos_operativos))}</strong>
                <span style={{ color: 'var(--text-muted)' }}>Excedente</span><strong className="mono">{cop(num(d.detalle.excedente ?? d.excedente_calculado))}</strong>

                {/* Resultado */}
                <span style={SUBHEAD}>Resultado</span>
                <span style={{ color: 'var(--text-muted)' }}>Valor material</span><strong className="mono" style={{ color: '#15803d' }}>{cop(num(d.detalle.total_material ?? d.total_material) || num(d.detalle.valor_material))}</strong>
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
  const [precioRow, setPrecioRow] = useState<EntradaRow | null>(null)
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
                            {num(m.tenor) > 0 && num(m.precio_total) <= 0 && (
                              <Button variant="secondary" size="sm" title="Registrar precio"
                                icon={<Coins size={14} style={{ color: 'var(--amber-600)' }} />}
                                onClick={() => setPrecioRow(m)} />
                            )}
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
      <PrecioModal row={precioRow} onClose={() => setPrecioRow(null)} onSaved={refresh} />
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
