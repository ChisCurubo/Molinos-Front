import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Coins, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { MineroField } from '@/components/common/MineroField'
import { loadAbonosMinero, estadoPagoMap } from '@/data/materialPagos'
import { PagosMaterialPanel } from './PagosMaterialPanel'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  tarifasZona, preciosMaterial, duenosVolqueta as duenosMock,
  zonas as zonasReal,
  MINA_A_ZONA, MINA_A_MINERO,
  type MaterialRow,
} from '@/data/mock'
import { getPrecioAplicable } from '@/utils/format'
import { useMateriales } from '@/context/MaterialesContext'
import { useData } from '@/context/DataContext'
import type { Volqueta } from '@/types'

const cop = formatCOP

// ── Helpers ──────────────────────────────────────────────────
function getTarifaZona(idZona: number): number {
  return tarifasZona.find(t => t.id_zona === idZona)?.valor_tonelada ?? 0
}
function getZonaFromMina(mina: string): number | undefined {
  return MINA_A_ZONA[mina.trim().toUpperCase()]
}
function pesoSeco(m: MaterialRow) { return m.peso_llegada_planta * (1 - m.porcentaje_humedad) }
function calcFlete(m: MaterialRow) {
  if (m.valor_flete != null) return m.valor_flete
  const idZona = m.id_zona ?? MINA_A_ZONA[m.mina]
  if (!idZona) return null
  const t = tarifasZona.find((tz) => tz.id_zona === idZona)
  return t ? m.peso_llegada_planta * t.valor_tonelada : null
}
function calcValorMaterial(m: MaterialRow) {
  const idMinero = MINA_A_MINERO[m.mina] || undefined
  const precio   = getPrecioAplicable(m.tenor, idMinero, preciosMaterial)
  if (!precio) return null
  const seco = pesoSeco(m)
  return precio.metodo === 'por_tonelada'
    ? seco * (precio.precio_por_tonelada ?? 0)
    : seco * m.tenor * (precio.precio_por_gramo ?? 0)
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', pagada: 'Pagada', en_proceso: 'En proceso',
  incluida_viaje: 'En viaje', en_canoa: 'En canoa', enviado_completo: 'Enviado',
}
const ESTADOS = ['todos', 'pendiente', 'pagada', 'en_proceso', 'incluida_viaje'] as const

function fmtDMY(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const GROUP_TH: CSSProperties = {
  textAlign: 'center', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'var(--text-muted)', background: '#f6f5f3', borderBottom: '1px solid #e5e7eb',
  fontWeight: 700, padding: '4px 6px',
}

// ── Tipos para el sistema de análisis ────────────────────────
type LabOrigen = '' | 'sgs_medellin' | 'ahk_peru'
type AnalTab   = 'cabeza' | 'sulfuros' | 'colas' | 'comparacion' | 'recuperacion'

const LAB_OPTS: { value: LabOrigen; label: string }[] = [
  { value: '',             label: '— Sin especificar —' },
  { value: 'sgs_medellin', label: 'SGS Medellín'        },
  { value: 'ahk_peru',    label: 'AHK Perú'             },
]
const ANAL_TAB_LABELS: Record<AnalTab, string> = {
  cabeza: 'Cabeza', sulfuros: 'Sulfuros', colas: 'Colas',
  comparacion: 'Comparación', recuperacion: 'Recuperación',
}

const mkCabeza   = () => ({ numero_analisis: '', laboratorio: '' as LabOrigen, porcentaje_humedad: '', au_concentrado: '', ag_concentrado: '', au_falso: '', fecha_salida: '', comentarios: '' })
const mkSulfuros = () => ({ numero_analisis: '', laboratorio: '' as LabOrigen, toneladas_humedo: '', porcentaje_humedad: '', au_gr_x_ton: '', ag_gr_x_ton: '', fecha_salida: '', comentarios: '' })
const mkColas    = () => ({ numero_analisis: '', laboratorio: '' as LabOrigen, toneladas_colas: '', au_gr_x_ton: '', ag_gr_x_ton: '', fecha_salida: '', comentarios: '' })

// ── Componente auxiliar para filas de balance ─────────────────
function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{label}</span>
      <span style={{ float: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>{value}</span>
      {sub && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Precio del material (Fase 3) — formulario compacto en el detalle ──────────
// Demo local: sin backend. Al confirmar actualiza el estado (setMateriales).
// Visible con tenor listo (Fase 2). Si ya hay precio_total → solo lectura.
type MetodoPrecio = 'por_gramo' | 'por_tonelada'
function PrecioSection({ m, seco, canWrite, onConfirm }: {
  m: MaterialRow; seco: number; canWrite: boolean
  onConfirm: (payload: { precio_por_gramo?: number; precio_por_tonelada?: number; precio_total: number }) => void
}) {
  const gramos = seco * m.tenor // gramos totales de Au = ton secas × tenor (gr/t)
  const [metodo, setMetodo] = useState<MetodoPrecio>('por_gramo')
  const [precioStr, setPrecioStr] = useState('')
  const [saving, setSaving] = useState(false)

  const precio = Number(precioStr)
  const precioValido = precioStr.trim() !== '' && Number.isFinite(precio) && precio > 0
  const preview = precioValido ? (metodo === 'por_gramo' ? gramos * precio : seco * precio) : null

  const cambiarMetodo = (v: MetodoPrecio) => { setMetodo(v); setPrecioStr('') }

  const confirmar = () => {
    if (!precioValido || saving) return
    setSaving(true)
    // Simula la llamada al backend (PATCH .../precio) para mostrar el loading.
    setTimeout(() => {
      const total = metodo === 'por_gramo' ? gramos * precio : seco * precio
      onConfirm(metodo === 'por_gramo'
        ? { precio_por_gramo: precio, precio_total: total }
        : { precio_por_tonelada: precio, precio_total: total })
      setSaving(false)
    }, 450)
  }

  const titulo = (
    <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
      <Coins size={14} /> Precio del material
    </div>
  )

  // ── Solo lectura: precio ya confirmado (> 0; null o 0 = pendiente) ──
  if ((m.precio_total ?? 0) > 0) {
    return (
      <div>
        {titulo}
        <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem' }}>
          {(m.precio_por_gramo ?? 0) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Precio por gramo</span><strong className="mono">{cop(m.precio_por_gramo ?? 0)}</strong></>}
          {(m.precio_por_tonelada ?? 0) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Precio por tonelada</span><strong className="mono">{cop(m.precio_por_tonelada ?? 0)}</strong></>}
          <span style={{ color: 'var(--text-muted)' }}>Precio confirmado</span>
          <strong className="mono" style={{ color: '#15803d' }}>{cop(m.precio_total ?? 0)}</strong>
        </div>
      </div>
    )
  }

  // ── Formulario: tenor listo y precio pendiente ──
  const unidad = metodo === 'por_gramo' ? '$/gr Au' : '$/ton seca'
  return (
    <div>
      {titulo}
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        Tenor Au: <strong className="mono" style={{ color: 'var(--amber-700)' }}>{m.tenor.toFixed(2)}</strong> g/t
      </div>
      {canWrite ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <Select label="Pagar por" value={metodo} onChange={e => cambiarMetodo(e.target.value as MetodoPrecio)} disabled={saving}
            options={[{ value: 'por_gramo', label: 'Por gramo' }, { value: 'por_tonelada', label: 'Por tonelada' }]} />
          <Input label={`Precio (${unidad})`} type="number" min="0" step="any" mono disabled={saving}
            placeholder={metodo === 'por_gramo' ? 'Precio por gramo' : 'Precio por tonelada'}
            value={precioStr} onChange={e => setPrecioStr(e.target.value)} />
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: '0.15rem' }}>Referencia:</div>
            <div className="mono" style={{ color: 'var(--text-body)' }}>
              {metodo === 'por_gramo' ? `Gramos totales: ${gramos.toFixed(2)} gr` : `Ton secas: ${seco.toFixed(2)} t`}
            </div>
          </div>
          {preview != null && (
            <div style={{ fontSize: 'var(--fs-sm)' }}>
              Pagaríamos: <strong className="mono" style={{ color: '#15803d' }}>{cop(preview)}</strong>
            </div>
          )}
          <Button size="sm" onClick={confirmar} disabled={!precioValido || saving}>
            {saving ? 'Guardando…' : 'Confirmar precio'}
          </Button>
        </div>
      ) : (
        <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin precio registrado.</em>
      )}
    </div>
  )
}

export function EntradasPage() {
  const canWrite = useCanWrite('materiales')
  const { materiales, setMateriales, analisis, setAnalisis } = useMateriales()
  const { volquetas, add: addData } = useData()
  const [duenos] = useState(duenosMock)

  // ── Filtros ──
  const [mainTab, setMainTab] = useState<'entradas' | 'pagos'>('entradas')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [busqueda,   setBusqueda]   = useState('')
  const [estadoF,    setEstadoF]    = useState('todos')
  const [mineroF,    setMineroF]    = useState('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // ── Modal análisis — 5 pestañas ──
  const [editAnal,     setEditAnal]     = useState<MaterialRow | null>(null)
  const [analTab,      setAnalTab]      = useState<AnalTab>('cabeza')
  const [formCabeza,   setFormCabeza]   = useState(mkCabeza())
  const [formSulfuros, setFormSulfuros] = useState(mkSulfuros())
  const [formColas,    setFormColas]    = useState(mkColas())

  // ── Modal registrar / editar ──
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando,     setEditando]     = useState<MaterialRow | null>(null)
  const [selVolqueta,  setSelVolqueta]  = useState<Volqueta | null>(null)
  const [showNuevaVol, setShowNuevaVol] = useState(false)
  const [nvForm,       setNvForm]       = useState({ placa: '', conductor: '', id_dueno: '' })
  const [formNuevo,    setFormNuevo]    = useState({ id_volqueta: '', id_dueno: '', mina: '', id_zona: '', fecha: todayISO(), peso: '', acpm: '', numVol: '' })

  const minas = [...new Set(materiales.map((m) => m.mina))].sort()

  const filtrados = useMemo(() => materiales.filter((m) => {
    if (estadoF !== 'todos' && m.estado !== estadoF) return false
    if (mineroF !== 'todos' && m.mina !== mineroF) return false
    if (fechaDesde && m.fecha < fechaDesde) return false
    if (fechaHasta && m.fecha > fechaHasta) return false
    if (busqueda) {
      const q = busqueda.toUpperCase()
      if (!m.mina.includes(q) && !String(m.numero_volqueta).includes(q)) return false
    }
    return true
  }), [materiales, estadoF, mineroF, fechaDesde, fechaHasta, busqueda])

  const totalHumedo = filtrados.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalSeco   = filtrados.reduce((s, m) => s + pesoSeco(m), 0)

  // Estado de pago por material (FIFO de abonos al minero — se gestiona en /materiales/pago-material)
  const pagoMmap = useMemo(() => estadoPagoMap(materiales, loadAbonosMinero(), calcValorMaterial), [materiales])

  // ── Handlers — registro ──
  const openEditMat = (m: MaterialRow) => {
    setEditando(m)
    const v = m.id_volqueta ? volquetas.find(x => x.id === m.id_volqueta) ?? null : null
    setSelVolqueta(v)
    setShowNuevaVol(false)
    setNvForm({ placa: '', conductor: '', id_dueno: '' })
    setFormNuevo({
      id_volqueta: m.id_volqueta ?? '',
      id_dueno:    m.id_dueno ? String(m.id_dueno) : (v?.id_dueno ? String(v.id_dueno) : ''),
      mina:        m.mina,
      id_zona:     m.id_zona ? String(m.id_zona) : '',
      fecha:       m.fecha,
      peso:        String(m.peso_llegada_planta),
      acpm:        m.acpm ? String(m.acpm) : '',
      numVol:      String(m.numero_volqueta),
    })
    setModalAbierto(true)
  }

  // ── Handlers — análisis ──
  const openEditAnal = (m: MaterialRow) => {
    setEditAnal(m)
    setAnalTab('cabeza')
    const cab = analisis.find(a => a.id_entrada === m.id && (a.tipo ?? 'cabeza') === 'cabeza')
    const sul = analisis.find(a => a.id_entrada === m.id && a.tipo === 'sulfuros')
    const col = analisis.find(a => a.id_entrada === m.id && a.tipo === 'colas')
    setFormCabeza(cab ? {
      numero_analisis:    cab.numero_analisis,
      laboratorio:        (cab.laboratorio ?? '') as LabOrigen,
      porcentaje_humedad: cab.porcentaje_humedad > 0 ? String((cab.porcentaje_humedad * 100).toFixed(2)) : '',
      au_concentrado:     cab.au_concentrado != null ? String(cab.au_concentrado) : '',
      ag_concentrado:     cab.ag_concentrado != null ? String(cab.ag_concentrado) : '',
      au_falso:           cab.au_falso > 0 ? String(cab.au_falso) : '',
      fecha_salida:       cab.fecha_salida ?? '',
      comentarios:        cab.comentarios ?? '',
    } : mkCabeza())
    setFormSulfuros(sul ? {
      numero_analisis:    sul.numero_analisis,
      laboratorio:        (sul.laboratorio ?? '') as LabOrigen,
      toneladas_humedo:   sul.toneladas_humedas != null ? String(sul.toneladas_humedas) : '',
      porcentaje_humedad: sul.porcentaje_humedad > 0 ? String((sul.porcentaje_humedad * 100).toFixed(2)) : '',
      au_gr_x_ton:        sul.au_gr_x_ton > 0 ? String(sul.au_gr_x_ton) : '',
      ag_gr_x_ton:        sul.ag_gr_x_ton != null ? String(sul.ag_gr_x_ton) : '',
      fecha_salida:       sul.fecha_salida ?? '',
      comentarios:        sul.comentarios ?? '',
    } : mkSulfuros())
    setFormColas(col ? {
      numero_analisis: col.numero_analisis,
      laboratorio:     (col.laboratorio ?? '') as LabOrigen,
      toneladas_colas: col.toneladas_humedas != null ? String(col.toneladas_humedas) : '',
      au_gr_x_ton:     col.au_gr_x_ton > 0 ? String(col.au_gr_x_ton) : '',
      ag_gr_x_ton:     col.ag_gr_x_ton != null ? String(col.ag_gr_x_ton) : '',
      fecha_salida:    col.fecha_salida ?? '',
      comentarios:     col.comentarios ?? '',
    } : mkColas())
  }

  const saveCabeza = () => {
    if (!editAnal) return
    const hum     = Number(formCabeza.porcentaje_humedad) / 100
    const tonSec  = editAnal.peso_llegada_planta * (1 - hum)
    const auConc  = Number(formCabeza.au_concentrado) || 0
    const auFalso = Number(formCabeza.au_falso) || 0
    const agConc  = formCabeza.ag_concentrado ? Number(formCabeza.ag_concentrado) : null
    const auGrT   = tonSec > 0 && auConc > 0 ? auConc / tonSec : 0
    const agGrT   = tonSec > 0 && agConc != null && agConc > 0 ? agConc / tonSec : null
    const tenor   = auFalso > 0 ? auFalso : auGrT
    setMateriales(prev => prev.map(m => m.id === editAnal.id
      ? { ...m, porcentaje_humedad: hum, tenor, total_material_seco: tonSec } : m))
    const row = {
      id_entrada: editAnal.id, id_material_concentrado: null, tipo: 'cabeza' as const,
      laboratorio: formCabeza.laboratorio || undefined,
      numero_analisis: formCabeza.numero_analisis || `AN-${editAnal.numero_volqueta}`,
      ton: editAnal.peso_llegada_planta, porcentaje_humedad: hum,
      toneladas_humedas: editAnal.peso_llegada_planta, toneladas_secas: tonSec,
      au_gr_x_ton: auGrT, au_falso: auFalso, ag_gr_x_ton: agGrT,
      au_concentrado: auConc || null, ag_concentrado: agConc,
      fecha_salida: formCabeza.fecha_salida || null, comentarios: formCabeza.comentarios || null,
      estado_pago: 'no_aplica' as const,
    }
    setAnalisis(prev => {
      const idx = prev.findIndex(a => a.id_entrada === editAnal.id && (a.tipo ?? 'cabeza') === 'cabeza')
      return idx >= 0 ? prev.map((a, i) => i === idx ? { ...a, ...row } : a) : [{ id: Date.now(), ...row }, ...prev]
    })
  }

  const saveSulfuros = () => {
    if (!editAnal) return
    const hum    = Number(formSulfuros.porcentaje_humedad) / 100
    const tonHum = Number(formSulfuros.toneladas_humedo) || 0
    const tonSec = tonHum > 0 ? tonHum * (1 - hum) : 0
    const auGrT  = Number(formSulfuros.au_gr_x_ton) || 0
    const agGrT  = formSulfuros.ag_gr_x_ton ? Number(formSulfuros.ag_gr_x_ton) : null
    const row = {
      id_entrada: editAnal.id, id_material_concentrado: null, tipo: 'sulfuros' as const,
      laboratorio: formSulfuros.laboratorio || undefined,
      numero_analisis: formSulfuros.numero_analisis || `SUL-${editAnal.numero_volqueta}`,
      ton: tonHum, porcentaje_humedad: hum,
      toneladas_humedas: tonHum, toneladas_secas: tonSec,
      au_gr_x_ton: auGrT, au_falso: 0, ag_gr_x_ton: agGrT,
      au_concentrado: tonSec > 0 && auGrT > 0 ? tonSec * auGrT : null,
      ag_concentrado: tonSec > 0 && agGrT != null ? tonSec * agGrT : null,
      fecha_salida: formSulfuros.fecha_salida || null, comentarios: formSulfuros.comentarios || null,
      estado_pago: 'no_aplica' as const,
    }
    setAnalisis(prev => {
      const idx = prev.findIndex(a => a.id_entrada === editAnal.id && a.tipo === 'sulfuros')
      return idx >= 0 ? prev.map((a, i) => i === idx ? { ...a, ...row } : a) : [{ id: Date.now(), ...row }, ...prev]
    })
  }

  const saveColas = () => {
    if (!editAnal) return
    const tonColas = Number(formColas.toneladas_colas) || 0
    const auGrT    = Number(formColas.au_gr_x_ton) || 0
    const agGrT    = formColas.ag_gr_x_ton ? Number(formColas.ag_gr_x_ton) : null
    const row = {
      id_entrada: editAnal.id, id_material_concentrado: null, tipo: 'colas' as const,
      laboratorio: formColas.laboratorio || undefined,
      numero_analisis: formColas.numero_analisis || `COL-${editAnal.numero_volqueta}`,
      ton: tonColas, porcentaje_humedad: 0,
      toneladas_humedas: tonColas, toneladas_secas: tonColas,
      au_gr_x_ton: auGrT, au_falso: 0, ag_gr_x_ton: agGrT,
      au_concentrado: tonColas > 0 && auGrT > 0 ? tonColas * auGrT : null,
      ag_concentrado: null,
      fecha_salida: formColas.fecha_salida || null, comentarios: formColas.comentarios || null,
      estado_pago: 'no_aplica' as const,
    }
    setAnalisis(prev => {
      const idx = prev.findIndex(a => a.id_entrada === editAnal.id && a.tipo === 'colas')
      return idx >= 0 ? prev.map((a, i) => i === idx ? { ...a, ...row } : a) : [{ id: Date.now(), ...row }, ...prev]
    })
  }

  const deleteMaterial = (id: number) => {
    if (!confirm('¿Eliminar este registro de material?')) return
    setMateriales((prev) => prev.filter((m) => m.id !== id))
  }

  // Confirmar precio (Fase 3) — actualiza el estado local sin recargar.
  const confirmarPrecio = (id: number, payload: { precio_por_gramo?: number; precio_por_tonelada?: number; precio_total: number }) => {
    setMateriales((prev) => prev.map((m) => m.id === id ? { ...m, ...payload } : m))
  }

  // ── Opciones selects ──
  const volquetaOpts = [
    { value: '', label: '— Seleccionar —' },
    ...volquetas.filter(v => v.activo).map(v => ({ value: v.id, label: `${v.placa}${v.dueno ? ` · ${v.dueno}` : ''}` })),
  ]
  const zonaOpts = [
    { value: '', label: '— Sin zona —' },
    ...zonasReal.map(z => { const t = getTarifaZona(z.id); return { value: String(z.id), label: `${z.nombre}${t ? ` · ${cop(t)}/t` : ' · Sin tarifa'}` } }),
  ]
  const duenoOpts = [{ value: '', label: '— Sin asignar —' }, ...duenos.filter(d => d.estado === 'activo').map(d => ({ value: String(d.id), label: d.nombre + (d.alias && d.alias !== d.nombre ? ` (${d.alias})` : '') }))]
  const minasConocidas = useMemo(() => [...new Set(materiales.map(m => m.mina))].filter(Boolean).sort(), [materiales])
  const nextNumVol     = useMemo(() => Math.max(0, ...materiales.map(m => m.numero_volqueta)) + 1, [materiales])
  const valorFlete     = useMemo(() => (Number(formNuevo.peso) || 0) * getTarifaZona(Number(formNuevo.id_zona) || 0), [formNuevo.peso, formNuevo.id_zona])

  const onVolquetaChange = (id: string) => {
    const v = volquetas.find(x => x.id === id) ?? null
    setSelVolqueta(v)
    setFormNuevo(f => ({ ...f, id_volqueta: id, id_dueno: v?.id_dueno ? String(v.id_dueno) : f.id_dueno }))
  }
  const onMinaChange = (mina: string) => {
    const zonaNum = getZonaFromMina(mina)
    setFormNuevo(f => ({ ...f, mina, id_zona: zonaNum ? String(zonaNum) : f.id_zona }))
  }
  const crearVolquetaRapido = () => {
    if (!nvForm.placa.trim() || !nvForm.conductor.trim()) return
    const duenoSel = duenos.find(d => d.id === Number(nvForm.id_dueno))
    const nueva: Volqueta = { id: `v${Date.now()}`, placa: nvForm.placa.toUpperCase(), conductor: nvForm.conductor, dueno: duenoSel?.nombre ?? '', id_dueno: duenoSel?.id, capacidadTon: 0, activo: true }
    addData('volquetas', nueva)
    setSelVolqueta(nueva)
    setFormNuevo(f => ({ ...f, id_volqueta: nueva.id, id_dueno: duenoSel ? String(duenoSel.id) : f.id_dueno }))
    setShowNuevaVol(false)
    setNvForm({ placa: '', conductor: '', id_dueno: '' })
  }

  const openNuevo = () => {
    setEditando(null)
    setSelVolqueta(null)
    setShowNuevaVol(false)
    setNvForm({ placa: '', conductor: '', id_dueno: '' })
    setFormNuevo({ id_volqueta: '', id_dueno: '', mina: '', id_zona: '', fecha: todayISO(), peso: '', acpm: '', numVol: String(nextNumVol) })
    setModalAbierto(true)
  }

  const guardar = () => {
    if (!formNuevo.peso || Number(formNuevo.peso) <= 0) return
    const numVolFinal = Number(formNuevo.numVol) || nextNumVol
    const zona = formNuevo.id_zona ? Number(formNuevo.id_zona) : undefined
    const base = {
      mina:                formNuevo.mina.trim().toUpperCase() || '—',
      id_volqueta:         formNuevo.id_volqueta || undefined,
      id_dueno:            formNuevo.id_dueno ? Number(formNuevo.id_dueno) : undefined,
      id_zona:             zona,
      valor_flete:         valorFlete > 0 ? valorFlete : undefined,
      fecha:               formNuevo.fecha,
      peso_llegada_planta: Number(formNuevo.peso),
      acpm:                formNuevo.acpm ? Number(formNuevo.acpm) : undefined,
    }
    if (editando) {
      setMateriales(prev => prev.map(m => m.id === editando.id ? { ...m, ...base, numero_volqueta: numVolFinal } : m))
    } else {
      const nuevo: MaterialRow = {
        ...base, id: Date.now(), numero_volqueta: numVolFinal,
        porcentaje_humedad: 0, tenor: 0, total_material_seco: Number(formNuevo.peso),
        estado: 'pendiente', lote: null,
      }
      setMateriales(prev => [nuevo, ...prev])
    }
    setModalAbierto(false)
  }

  // ── Datos del modal de análisis (para las pestañas de solo lectura) ──
  const analCabeza   = editAnal ? analisis.find(a => a.id_entrada === editAnal.id && (a.tipo ?? 'cabeza') === 'cabeza') : null
  const analSulfuros = editAnal ? analisis.find(a => a.id_entrada === editAnal.id && a.tipo === 'sulfuros') : null
  const analColas    = editAnal ? analisis.find(a => a.id_entrada === editAnal.id && a.tipo === 'colas') : null

  // Live previews para cabeza y sulfuros
  const prevCabeza = editAnal ? (() => {
    const hum    = Number(formCabeza.porcentaje_humedad) || 0
    const tonSec = editAnal.peso_llegada_planta * (1 - hum / 100)
    const auConc = Number(formCabeza.au_concentrado) || 0
    return { tonSec, auGrT: tonSec > 0 && auConc > 0 ? auConc / tonSec : null }
  })() : null

  const prevSulfuros = (() => {
    const tonHum = Number(formSulfuros.toneladas_humedo) || 0
    const hum    = Number(formSulfuros.porcentaje_humedad) || 0
    const tonSec = tonHum * (1 - hum / 100)
    const auGrT  = Number(formSulfuros.au_gr_x_ton) || 0
    return { tonSec, auTotal: tonSec > 0 && auGrT > 0 ? tonSec * auGrT : null }
  })()

  // Badge del ícono de análisis en la tabla
  const getAnalBadge = (m: MaterialRow) => {
    const hasCab = analisis.some(a => a.id_entrada === m.id && (a.tipo ?? 'cabeza') === 'cabeza')
    const hasSul = analisis.some(a => a.id_entrada === m.id && a.tipo === 'sulfuros')
    const hasCol = analisis.some(a => a.id_entrada === m.id && a.tipo === 'colas')
    const count  = [hasCab, hasSul, hasCol].filter(Boolean).length
    if (count === 0) return { color: 'var(--rose-600)',  title: 'Sin análisis — agregar' }
    if (count === 3) return { color: 'var(--green-600)', title: 'Análisis completo (Cabeza · Sulfuros · Colas)' }
    return { color: 'var(--amber-600)', title: `${count}/3 análisis registrados` }
  }

  // Footer dinámico del modal de análisis
  const analFooter = editAnal && (
    <>
      <Button variant="secondary" onClick={() => setEditAnal(null)}>Cerrar</Button>
      {analTab === 'cabeza'   && <Button onClick={saveCabeza}>Guardar Cabeza</Button>}
      {analTab === 'sulfuros' && <Button onClick={saveSulfuros}>Guardar Sulfuros</Button>}
      {analTab === 'colas'    && <Button onClick={saveColas}>Guardar Colas</Button>}
    </>
  )

  return (
    <div className="page">
      <PageHeader
        title="Entradas de material"
        subtitle={`${filtrados.length} registros · ${totalHumedo.toFixed(3)} t húmedo · ${totalSeco.toFixed(4)} t seco`}
        actions={canWrite && mainTab === 'entradas' && <Button icon={<Plus size={18} />} onClick={openNuevo}>Registrar llegada</Button>}
      />

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={mainTab === 'entradas'}
          className={`segment__btn ${mainTab === 'entradas' ? 'segment__btn--active' : ''}`}
          onClick={() => setMainTab('entradas')}>Entradas</button>
        <button role="tab" aria-selected={mainTab === 'pagos'}
          className={`segment__btn ${mainTab === 'pagos' ? 'segment__btn--active' : ''}`}
          onClick={() => setMainTab('pagos')}>Pagos a mineros</button>
      </div>

      {mainTab === 'pagos' && <PagosMaterialPanel />}

      {mainTab === 'entradas' && (<>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Registros"       value={filtrados.length}                                       accent="brown"   />
        <KpiTile label="Peso húmedo (t)" value={totalHumedo.toFixed(3)}                                accent="green"   />
        <KpiTile label="Peso seco (t)"   value={totalSeco.toFixed(4)}                                   accent="emerald" />
        <KpiTile label="Sin análisis"    value={filtrados.filter(m => m.tenor === 0).length}            accent="rose"    />
        <KpiTile label="Pendientes pago" value={filtrados.filter(m => m.estado === 'pendiente').length} accent="amber"   />
      </div>

      <Card title={`Materiales (${filtrados.length})`}>
        <div className="toolbar" style={{ marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <input className="field__input" placeholder="Buscar por mina o N.° volqueta…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ maxWidth: '16rem' }} />
          <select className="field__select" style={{ maxWidth: '11rem' }} value={mineroF} onChange={(e) => setMineroF(e.target.value)}>
            <option value="todos">Todas las minas</option>
            {minas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="segment">
            {ESTADOS.map((e) => (
              <button key={e} className={`segment__btn ${estadoF === e ? 'segment__btn--active' : ''}`} onClick={() => setEstadoF(e)}>
                {e === 'todos' ? 'Todos' : ESTADO_LABELS[e] ?? e}
              </button>
            ))}
          </div>
          <input className="field__input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ background: '#f6f5f3', borderBottom: '1px solid #e5e7eb' }}></th>
                <th colSpan={2} style={GROUP_TH}>Identificación</th>
                <th colSpan={4} style={GROUP_TH}>Material y ley</th>
                <th colSpan={2} style={GROUP_TH}>Valores</th>
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
                <th style={{ textAlign: 'right' }}>Gastos oper.</th>
                <th style={{ textAlign: 'right' }}>Valor mat.</th>
                <th>Estado</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map((m) => {
                const isExp = expandedRow === m.id
                const anals = analisis.filter(a => a.id_entrada === m.id)
                const seco  = pesoSeco(m)
                const flete = calcFlete(m)
                const gastos = (flete ?? 0) + (m.acpm ?? 0)   // gastos operativos = flete + ACPM
                const valor = m.tenor > 0 ? calcValorMaterial(m) : null
                const badge = getAnalBadge(m)

                const hasCab = analisis.some(a => a.id_entrada === m.id && (a.tipo ?? 'cabeza') === 'cabeza')
                const estadoMat: { label: string; cls: string } =
                  m.lote             ? { label: `Lote ${m.lote}`,  cls: 'badge--info'    } :
                  m.estado === 'incluida_viaje' ? { label: 'En viaje',   cls: 'badge--neutral' } :
                  m.estado === 'en_proceso'     ? { label: 'En proceso', cls: 'badge--info'    } :
                  hasCab             ? { label: 'Analizado',        cls: 'badge--success' } :
                                       { label: 'Sin análisis',     cls: 'badge--warning' }

                const ep = valor != null && valor > 0 ? (pagoMmap.get(m.id) ?? 'pendiente') : null
                const estadoPago: { label: string; cls: string } =
                  ep === 'pagado'    ? { label: 'Pagado',       cls: 'badge--success' } :
                  ep === 'parcial'   ? { label: 'Pago parcial', cls: 'badge--info'    } :
                  ep === 'pendiente' ? { label: 'Pendiente',    cls: 'badge--warning' } :
                                       { label: '—',            cls: 'badge--neutral' }

                return (
                  <Fragment key={m.id}>
                  <tr style={{ cursor: 'pointer', ...(isExp ? { background: 'var(--slate-50)' } : {}) }}
                    onClick={() => setExpandedRow(isExp ? null : m.id)}>
                    <td style={{ color: 'var(--text-muted)' }}>{isExp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</td>
                    <td style={{ fontWeight: 700 }}>{m.mina}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(m.fecha)}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>N° {m.numero_volqueta || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.porcentaje_humedad > 0 ? seco.toFixed(4) : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.porcentaje_humedad > 0 ? `${(m.porcentaje_humedad * 100).toFixed(1)}%` : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.tenor > 0 ? 'var(--amber-700)' : undefined }} className="mono">
                      {m.tenor > 0 ? m.tenor.toFixed(2) : <em style={{ color: 'var(--text-faint)', fontWeight: 400 }}>S/A</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {gastos > 0 ? <span style={{ color: '#b45309' }}>{cop(gastos)}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {valor != null ? <strong style={{ color: '#15803d' }}>{cop(valor)}</strong> : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div>
                          <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 1 }}>Estado material</div>
                          <span className={`badge ${estadoMat.cls}`}>{estadoMat.label}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 1 }}>Estado pago</div>
                          <span className={`badge ${estadoPago.cls}`}>{estadoPago.label}</span>
                        </div>
                      </div>
                    </td>
                    {canWrite && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEditMat(m)} />
                          <Button variant="secondary" size="sm" title={badge.title}
                            icon={<FlaskConical size={14} style={{ color: badge.color }} />}
                            onClick={() => openEditAnal(m)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => deleteMaterial(m.id)} />
                        </div>
                      </td>
                    )}
                  </tr>

                  {isExp && (
                    <tr>
                      <td colSpan={canWrite ? 11 : 10} style={{ padding: '0.85rem 1.25rem', background: '#fafaf9' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: (m.tenor > 0 || (m.precio_total ?? 0) > 0) ? '1.5fr 1fr 1fr' : '1.6fr 1fr', gap: '1.25rem' }}>
                          {/* Análisis */}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <FlaskConical size={14}/> Análisis registrados ({anals.length})
                            </div>
                            {anals.length === 0 ? (
                              <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
                                Sin análisis. Usa el botón <FlaskConical size={12} style={{ verticalAlign: 'middle' }}/> para registrarlo.
                              </em>
                            ) : (
                              <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                                  <th style={{ padding: '2px 6px' }}>Tipo</th>
                                  <th style={{ padding: '2px 6px' }}>N.° análisis</th>
                                  <th style={{ padding: '2px 6px', textAlign: 'right' }}>T. seco</th>
                                  <th style={{ padding: '2px 6px', textAlign: 'right' }}>Au gr/t</th>
                                  <th style={{ padding: '2px 6px', textAlign: 'right' }}>Ag gr/t</th>
                                  <th style={{ padding: '2px 6px', textAlign: 'right' }}>Au total</th>
                                  <th style={{ padding: '2px 6px' }}>Salida</th>
                                </tr></thead>
                                <tbody>
                                  {anals.map(a => {
                                    const tipo = a.tipo ?? 'cabeza'
                                    const col = tipo === 'sulfuros' ? '#065f46' : tipo === 'colas' ? '#9f1239' : '#0c4a6e'
                                    return (
                                      <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '3px 6px' }}><span style={{ fontWeight: 700, color: col, textTransform: 'capitalize' }}>{tipo}</span></td>
                                        <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)' }}>{a.numero_analisis}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.toneladas_secas != null ? a.toneladas_secas.toFixed(4) : '—'}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{a.au_gr_x_ton.toFixed(2)}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.ag_gr_x_ton != null ? a.ag_gr_x_ton.toFixed(0) : '—'}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right' }} className="mono">{a.au_concentrado != null ? `${a.au_concentrado.toFixed(1)} g` : '—'}</td>
                                        <td style={{ padding: '3px 6px' }}>{a.fecha_salida ? fmtDMY(a.fecha_salida) : '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                            {canWrite && (
                              <Button size="sm" variant="secondary" icon={<FlaskConical size={13}/>} style={{ marginTop: '0.6rem' }}
                                onClick={() => openEditAnal(m)}>Ver / editar análisis</Button>
                            )}
                          </div>

                          {/* Detalle del material */}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginBottom: '0.5rem', color: 'var(--amber-800)' }}>Detalle del material</div>
                            <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Peso húmedo</span><strong className="mono">{m.peso_llegada_planta.toFixed(3)} t</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Humedad</span><strong className="mono">{m.porcentaje_humedad > 0 ? `${(m.porcentaje_humedad * 100).toFixed(1)}%` : 'S/A'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Ton secas</span><strong className="mono">{seco.toFixed(4)} t</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Tenor Au</span><strong className="mono">{m.tenor > 0 ? `${m.tenor.toFixed(2)} g/t` : 'S/A'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Flete</span><strong className="mono">{flete != null ? cop(flete) : 'S/T'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>ACPM adelantado</span><strong className="mono">{m.acpm ? cop(m.acpm) : '—'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Gastos operativos</span><strong className="mono" style={{ color: '#b45309' }}>{gastos > 0 ? cop(gastos) : '—'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Valor material</span><strong className="mono" style={{ color: '#15803d' }}>{valor != null ? cop(valor) : '—'}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>Estado pago</span><span><span className={`badge ${estadoPago.cls}`}>{estadoPago.label}</span></span>
                              {m.lote && <><span style={{ color: 'var(--text-muted)' }}>Lote</span><strong>{m.lote}</strong></>}
                            </div>
                          </div>

                          {/* Precio del material (Fase 3) */}
                          {(m.tenor > 0 || (m.precio_total ?? 0) > 0) && (
                            <PrecioSection m={m} seco={seco} canWrite={canWrite}
                              onConfirm={(payload) => confirmarPrecio(m.id, payload)} />
                          )}
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
                <td colSpan={3}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalHumedo.toFixed(3)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalSeco.toFixed(4)}</td>
                <td colSpan={canWrite ? 6 : 5} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      </>)}

      {/* ══ Modal análisis — 5 pestañas ══ */}
      <Modal
        open={!!editAnal}
        title={`Análisis — ${editAnal?.mina ?? ''} · N° ${editAnal?.numero_volqueta ?? ''}`}
        onClose={() => setEditAnal(null)}
        footer={analFooter}
      >
        {editAnal && (
          <>
            {/* Info del material */}
            <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
              <strong>{editAnal.mina}</strong> · {editAnal.peso_llegada_planta.toFixed(3)} t húm. · {formatDate(editAnal.fecha)}
              {editAnal.tenor > 0 && <> · Tenor actual: <strong>{editAnal.tenor.toFixed(2)} gr/t</strong></>}
            </div>

            {/* Pestañas */}
            <div className="segment" style={{ marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {(['cabeza', 'sulfuros', 'colas', 'comparacion', 'recuperacion'] as AnalTab[]).map(t => {
                const hasDot = (t === 'cabeza' && !!analCabeza) || (t === 'sulfuros' && !!analSulfuros) || (t === 'colas' && !!analColas)
                return (
                  <button key={t} className={`segment__btn ${analTab === t ? 'segment__btn--active' : ''}`} onClick={() => setAnalTab(t)}>
                    {ANAL_TAB_LABELS[t]}
                    {hasDot && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--green-500)', marginLeft: 5, verticalAlign: 'middle' }} />}
                  </button>
                )
              })}
            </div>

            {/* ─── Pestaña Cabeza ─── */}
            {analTab === 'cabeza' && (
              <div className="grid grid--form">
                <Input label="N° análisis" placeholder="AN-12019"
                  value={formCabeza.numero_analisis} onChange={e => setFormCabeza(f => ({ ...f, numero_analisis: e.target.value }))} />
                <div className="field">
                  <label className="field__label">Laboratorio origen</label>
                  <select className="field__select" value={formCabeza.laboratorio} onChange={e => setFormCabeza(f => ({ ...f, laboratorio: e.target.value as LabOrigen }))}>
                    {LAB_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Humedad (%)" type="number" step="0.01" placeholder="Ej: 5.9"
                  value={formCabeza.porcentaje_humedad} onChange={e => setFormCabeza(f => ({ ...f, porcentaje_humedad: e.target.value }))}
                  helper={prevCabeza?.tonSec ? `→ ${prevCabeza.tonSec.toFixed(4)} t secos` : 'Ej: 5.9 para 5.9%'} />
                <Input label="Au total (gramos)" type="number" step="0.1" placeholder="Ej: 245.5 g"
                  value={formCabeza.au_concentrado} onChange={e => setFormCabeza(f => ({ ...f, au_concentrado: e.target.value }))}
                  helper={prevCabeza?.auGrT ? `→ ${prevCabeza.auGrT.toFixed(2)} Au gr/t real` : undefined} />
                <Input label="Au falso — tenor al minero (gr/t)" type="number" step="0.1" placeholder="Ej: 4.5"
                  value={formCabeza.au_falso} onChange={e => setFormCabeza(f => ({ ...f, au_falso: e.target.value }))}
                  helper="Tenor reportado al minero para calcular el pago" />
                <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
                  value={formCabeza.ag_concentrado} onChange={e => setFormCabeza(f => ({ ...f, ag_concentrado: e.target.value }))} />
                <Input label="Fecha de salida" type="date"
                  value={formCabeza.fecha_salida} onChange={e => setFormCabeza(f => ({ ...f, fecha_salida: e.target.value }))} />
                <Input label="Comentarios"
                  value={formCabeza.comentarios} onChange={e => setFormCabeza(f => ({ ...f, comentarios: e.target.value }))} />
              </div>
            )}

            {/* ─── Pestaña Sulfuros ─── */}
            {analTab === 'sulfuros' && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: '0.75rem' }}>
                  Estimado del concentrado de sulfuros que se obtendrá en flotación.
                </p>
                <div className="grid grid--form">
                  <Input label="N° análisis" placeholder="SUL-001"
                    value={formSulfuros.numero_analisis} onChange={e => setFormSulfuros(f => ({ ...f, numero_analisis: e.target.value }))} />
                  <div className="field">
                    <label className="field__label">Laboratorio origen</label>
                    <select className="field__select" value={formSulfuros.laboratorio} onChange={e => setFormSulfuros(f => ({ ...f, laboratorio: e.target.value as LabOrigen }))}>
                      {LAB_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <Input label="Ton concentrado húmedo" type="number" step="0.001" placeholder="Ej: 2.500"
                    value={formSulfuros.toneladas_humedo} onChange={e => setFormSulfuros(f => ({ ...f, toneladas_humedo: e.target.value }))}
                    helper={prevSulfuros.tonSec > 0 ? `→ ${prevSulfuros.tonSec.toFixed(4)} t secos` : undefined} />
                  <Input label="Humedad concentrado (%)" type="number" step="0.1" placeholder="Ej: 12.0"
                    value={formSulfuros.porcentaje_humedad} onChange={e => setFormSulfuros(f => ({ ...f, porcentaje_humedad: e.target.value }))} />
                  <Input label="Au gr/t en concentrado" type="number" step="0.1" placeholder="Ej: 85.5"
                    value={formSulfuros.au_gr_x_ton} onChange={e => setFormSulfuros(f => ({ ...f, au_gr_x_ton: e.target.value }))}
                    helper={prevSulfuros.auTotal ? `→ ${prevSulfuros.auTotal.toFixed(2)} g Au total en concentrado` : undefined} />
                  <Input label="Ag gr/t en concentrado (opcional)" type="number" step="0.1"
                    value={formSulfuros.ag_gr_x_ton} onChange={e => setFormSulfuros(f => ({ ...f, ag_gr_x_ton: e.target.value }))} />
                  <Input label="Fecha de análisis" type="date"
                    value={formSulfuros.fecha_salida} onChange={e => setFormSulfuros(f => ({ ...f, fecha_salida: e.target.value }))} />
                  <Input label="Comentarios"
                    value={formSulfuros.comentarios} onChange={e => setFormSulfuros(f => ({ ...f, comentarios: e.target.value }))} />
                </div>
              </>
            )}

            {/* ─── Pestaña Colas ─── */}
            {analTab === 'colas' && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: '0.75rem' }}>
                  Análisis de residuos post-flotación. Tenor bajo indica buena recuperación.
                </p>
                <div className="grid grid--form">
                  <Input label="N° análisis" placeholder="COL-001"
                    value={formColas.numero_analisis} onChange={e => setFormColas(f => ({ ...f, numero_analisis: e.target.value }))} />
                  <div className="field">
                    <label className="field__label">Laboratorio origen</label>
                    <select className="field__select" value={formColas.laboratorio} onChange={e => setFormColas(f => ({ ...f, laboratorio: e.target.value as LabOrigen }))}>
                      {LAB_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <Input label="Toneladas de colas" type="number" step="0.001" placeholder="Ej: 8.750"
                    value={formColas.toneladas_colas} onChange={e => setFormColas(f => ({ ...f, toneladas_colas: e.target.value }))} />
                  <Input label="Au gr/t en colas (tenor residual)" type="number" step="0.01" placeholder="Ej: 0.15"
                    value={formColas.au_gr_x_ton} onChange={e => setFormColas(f => ({ ...f, au_gr_x_ton: e.target.value }))}
                    helper="Debe ser bajo si la flotación fue eficiente" />
                  <Input label="Ag gr/t en colas (opcional)" type="number" step="0.01"
                    value={formColas.ag_gr_x_ton} onChange={e => setFormColas(f => ({ ...f, ag_gr_x_ton: e.target.value }))} />
                  <Input label="Fecha de análisis" type="date"
                    value={formColas.fecha_salida} onChange={e => setFormColas(f => ({ ...f, fecha_salida: e.target.value }))} />
                  <Input label="Comentarios"
                    value={formColas.comentarios} onChange={e => setFormColas(f => ({ ...f, comentarios: e.target.value }))} />
                </div>
              </>
            )}

            {/* ─── Pestaña Comparación ─── */}
            {analTab === 'comparacion' && (() => {
              if (!analCabeza) return <div className="callout">Sin análisis de Cabeza. Registre primero el análisis de Cabeza para ver la comparación.</div>
              const auFalso = analCabeza.au_falso ?? 0
              const auReal  = analCabeza.au_gr_x_ton ?? 0
              const auSul   = analSulfuros?.au_gr_x_ton ?? 0
              const auColas = analColas?.au_gr_x_ton ?? 0
              const auEntrada = (analCabeza.toneladas_secas ?? 0) * auReal
              const auConc    = analSulfuros ? (analSulfuros.au_concentrado ?? ((analSulfuros.toneladas_secas ?? 0) * auSul)) : 0
              const recPct    = auEntrada > 0 && auConc > 0 ? (auConc / auEntrada) * 100 : null
              return (
                <div>
                  <table className="data-table" style={{ marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Parámetro</th>
                        <th style={{ textAlign: 'right' }}>Teórico (Cabeza)</th>
                        <th style={{ textAlign: 'right' }}>Real / Concentrado</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Tenor Au (gr/t)</td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {auFalso.toFixed(2)} <small style={{ color: 'var(--text-muted)' }}>falso</small>
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {auReal.toFixed(2)} <small style={{ color: 'var(--text-muted)' }}>real</small>
                        </td>
                        <td style={{ textAlign: 'right', color: auReal >= auFalso ? 'var(--green-600)' : 'var(--rose-600)' }} className="mono">
                          {auReal >= auFalso ? '+' : ''}{(auReal - auFalso).toFixed(2)}
                        </td>
                      </tr>
                      {analSulfuros && (
                        <tr>
                          <td>Au gr/t en concentrado</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-faint)' }}>—</td>
                          <td style={{ textAlign: 'right' }} className="mono">{auSul.toFixed(2)}</td>
                          <td />
                        </tr>
                      )}
                      {analColas && (
                        <tr>
                          <td>Au gr/t en colas</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-faint)' }}>—</td>
                          <td style={{ textAlign: 'right', color: 'var(--rose-600)' }} className="mono">{auColas.toFixed(3)}</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {recPct != null && (
                    <div className="callout" style={{ fontWeight: 600 }}>
                      Au entrada: <strong>{auEntrada.toFixed(2)} g</strong>
                      {' · '}Au concentrado: <strong>{auConc.toFixed(2)} g</strong>
                      {' · '}Recuperación estimada:{' '}
                      <strong style={{ color: recPct >= 80 ? 'var(--green-700)' : 'var(--amber-700)' }}>{recPct.toFixed(1)}%</strong>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ─── Pestaña Recuperación ─── */}
            {analTab === 'recuperacion' && (() => {
              if (!analCabeza) return <div className="callout">Sin análisis de Cabeza. Registre el análisis de Cabeza para ver el balance metalúrgico.</div>
              const tonHumCab  = analCabeza.toneladas_humedas ?? editAnal.peso_llegada_planta
              const tonSecCab  = analCabeza.toneladas_secas   ?? editAnal.total_material_seco
              const auGrTCab   = analCabeza.au_gr_x_ton
              const auTotalCab = tonSecCab * auGrTCab

              const tonHumSul  = analSulfuros?.toneladas_humedas ?? 0
              const tonSecSul  = analSulfuros?.toneladas_secas   ?? 0
              const auGrTSul   = analSulfuros?.au_gr_x_ton       ?? 0
              const auTotalSul = analSulfuros?.au_concentrado     ?? (tonSecSul * auGrTSul)

              const tonColas   = analColas?.toneladas_humedas ?? 0
              const auGrTCol   = analColas?.au_gr_x_ton       ?? 0
              const auTotalCol = tonColas * auGrTCol

              const recPct     = auTotalCab > 0 && auTotalSul > 0 ? (auTotalSul / auTotalCab) * 100 : null
              const perdidaPct = auTotalCab > 0 && auTotalCol > 0 ? (auTotalCol / auTotalCab) * 100 : null

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--amber-800)', fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cabeza (entrada)</div>
                    <StatRow label="Ton húmedo" value={`${tonHumCab.toFixed(3)} t`} />
                    <StatRow label="Ton seco"   value={`${tonSecCab.toFixed(4)} t`} />
                    <StatRow label="Tenor Au"   value={`${auGrTCab.toFixed(2)} gr/t`} />
                    <StatRow label="Au total entrada" value={`${auTotalCab.toFixed(2)} g`} />
                    {analCabeza.au_falso > 0 && (
                      <StatRow label="Au falso (minero)" value={`${analCabeza.au_falso.toFixed(2)} gr/t`} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--emerald-700)', fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sulfuros (concentrado)</div>
                    {analSulfuros ? (
                      <>
                        <StatRow label="Ton húmedo" value={`${tonHumSul.toFixed(3)} t`} />
                        <StatRow label="Ton seco"   value={`${tonSecSul.toFixed(4)} t`} />
                        <StatRow label="Tenor Au"   value={`${auGrTSul.toFixed(2)} gr/t`} />
                        <StatRow label="Au total conc." value={`${auTotalSul.toFixed(2)} g`} />
                      </>
                    ) : <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin datos de Sulfuros</em>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--rose-700)', fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Colas (residuos)</div>
                    {analColas ? (
                      <>
                        <StatRow label="Ton colas"         value={`${tonColas.toFixed(3)} t`} />
                        <StatRow label="Tenor Au residual" value={`${auGrTCol.toFixed(3)} gr/t`} />
                        <StatRow label="Au perdido"        value={`${auTotalCol.toFixed(3)} g`} />
                      </>
                    ) : <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin datos de Colas</em>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance metalúrgico</div>
                    {recPct != null ? (
                      <StatRow label="Recuperación Au" value={`${recPct.toFixed(1)}%`} sub={recPct >= 80 ? 'Eficiente' : 'Por debajo de lo esperado'} />
                    ) : null}
                    {perdidaPct != null ? (
                      <StatRow label="Pérdida en colas" value={`${perdidaPct.toFixed(1)}%`} />
                    ) : null}
                    {!analSulfuros && <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Complete Sulfuros y Colas para el balance completo</em>}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </Modal>

      {/* ══ Modal registrar / editar material ══ */}
      <Modal open={modalAbierto}
        title={editando ? `Editar entrada N° ${editando.numero_volqueta}` : 'Registrar llegada de material'}
        onClose={() => setModalAbierto(false)}
        footer={<><Button variant="secondary" onClick={() => setModalAbierto(false)}>Cancelar</Button><Button onClick={guardar} disabled={!formNuevo.peso || Number(formNuevo.peso) <= 0}>{editando ? 'Guardar cambios' : 'Registrar'}</Button></>}
      >
        <Select label="Volqueta" options={volquetaOpts} value={formNuevo.id_volqueta}
          onChange={e => onVolquetaChange(e.target.value)} style={{ marginBottom: '0.5rem' }} />
        {selVolqueta && (
          <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>{selVolqueta.placa}</strong>{selVolqueta.dueno && <> · Dueño: <strong>{selVolqueta.dueno}</strong></>}
          </div>
        )}
        {!selVolqueta && !showNuevaVol && (
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-700)', fontSize: 'var(--fs-sm)', textDecoration: 'underline', padding: 0, marginBottom: '0.75rem', display: 'block' }}
            onClick={() => setShowNuevaVol(true)}>+ Volqueta nueva</button>
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
        <div className="grid grid--form">
          <Input label="N° volqueta" type="number" step="1" placeholder={String(nextNumVol)}
            value={formNuevo.numVol} onChange={e => setFormNuevo(f => ({ ...f, numVol: e.target.value }))}
            helper="Número que usted asigna al registro" />
          <Input label="Fecha de llegada" type="date" required value={formNuevo.fecha}
            onChange={e => setFormNuevo(f => ({ ...f, fecha: e.target.value }))} />
          <MineroField value={formNuevo.mina} onChange={onMinaChange} extraKnown={minasConocidas} />
          <Select label="Zona / tarifa de flete" options={zonaOpts} value={formNuevo.id_zona}
            onChange={e => setFormNuevo(f => ({ ...f, id_zona: e.target.value }))} />
          <Input label="Toneladas (peso húmedo)" type="number" step="0.01" required placeholder="Ej: 11.250"
            value={formNuevo.peso} onChange={e => setFormNuevo(f => ({ ...f, peso: e.target.value }))} />
          <Input label="ACPM adelantado (COP)" type="number" step="1000" placeholder="0"
            value={formNuevo.acpm} onChange={e => setFormNuevo(f => ({ ...f, acpm: e.target.value }))}
            helper="Dinero de gasolina entregado al conductor" />
        </div>
        {valorFlete > 0 && (
          <div className="callout" style={{ marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>
            <strong>Flete a pagar:</strong>{' '}
            <span style={{ color: 'var(--amber-700)', fontWeight: 700 }}>{cop(valorFlete)}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({formNuevo.peso} t × {cop(getTarifaZona(Number(formNuevo.id_zona)))} / t)</span>
          </div>
        )}
        {formNuevo.acpm && Number(formNuevo.acpm) > 0 && (
          <div style={{ marginTop: '0.3rem', fontSize: 'var(--fs-xs)', color: '#b45309' }}>
            ACPM {cop(Number(formNuevo.acpm))} se descuenta del flete al pagar
          </div>
        )}
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Análisis se agrega después con <FlaskConical size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> en la tabla.
        </p>
      </Modal>
    </div>
  )
}
