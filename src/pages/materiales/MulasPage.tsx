import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FileText, ImageIcon, Pencil, Plus, Trash2, Truck,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { useMateriales } from '@/context/MaterialesContext'

const cop = formatCOP

// ── Interfaces ────────────────────────────────────────────────
interface TarifaCambio { fecha: string; tarifa: number }

interface MulaRow {
  id: number
  nombre: string
  placa: string
  conductor: string
  tarifa_por_viaje: number
  activo: boolean
  historial_tarifa?: TarifaCambio[]
}

interface ViajesMulaRow {
  id: number
  id_mula: number
  fecha: string
  concepto: string
  cantidad_viajes: number
  tarifa: number
  total: number
  id_viaje?: number        // viaje vinculado del módulo de viajes
  factura_num?: string
  factura_img?: string
  nota?: string
}

interface AbonoMulaRow {
  id: number
  id_mula: number
  fecha: string
  monto: number
  tipo: 'transferencia' | 'deposito' | 'efectivo' | 'otro'
  comprobante_img?: string
  nota?: string
}

// ── Persistencia ──────────────────────────────────────────────
const LS_MULAS   = 'molinos_mulas_v1'
const LS_VIAJES  = 'molinos_viajes_mulas_v1'
const LS_ABONOS  = 'molinos_abonos_mulas_v1'

function load<T>(key: string): T[] {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}
function save<T>(key: string, data: T[]) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
}

const TARIFA_DEFAULT = 6_500_000

// ── Datos de ejemplo (se cargan solo si no hay nada guardado) ──
const EJEMPLO_MULAS: MulaRow[] = [
  { id: 1, nombre: 'TRANSPORTES VILLA', placa: 'STO-456', conductor: 'Ramiro Díaz', tarifa_por_viaje: TARIFA_DEFAULT, activo: true, historial_tarifa: [{ fecha: '2026-07-01', tarifa: TARIFA_DEFAULT }] },
]
const EJEMPLO_VIAJES: ViajesMulaRow[] = [
  { id: 1001, id_mula: 1, fecha: '2026-07-10', concepto: 'Viaje a refinería Medellín', cantidad_viajes: 1, tarifa: TARIFA_DEFAULT, total: TARIFA_DEFAULT, factura_num: 'F-00123' },
]

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

// ── Compresión de imágenes ────────────────────────────────────
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

const TIPO_LABELS: Record<AbonoMulaRow['tipo'], string> = {
  transferencia: 'Transferencia', deposito: 'Depósito', efectivo: 'Efectivo', otro: 'Otro',
}
const TIPO_OPTS = Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))

type PageTab = 'pagos' | 'mulas'

export function MulasPage() {
  const canWrite = useCanWrite('materiales')
  const { viajes: viajesMaterial } = useMateriales()

  const [mulas,  setMulasState]  = useState<MulaRow[]>(() => { const d = load<MulaRow>(LS_MULAS); return d.length ? d : EJEMPLO_MULAS })
  const [viajes, setViajesState] = useState<ViajesMulaRow[]>(() => { const d = load<ViajesMulaRow>(LS_VIAJES); const hasMulas = load<MulaRow>(LS_MULAS).length > 0; return d.length ? d : (hasMulas ? [] : EJEMPLO_VIAJES) })
  const [abonos, setAbonosState] = useState<AbonoMulaRow[]>(() => load(LS_ABONOS))

  const setMulas  = (fn: (p: MulaRow[]) => MulaRow[]) =>
    setMulasState(p => { const n = fn(p); save(LS_MULAS, n); return n })
  const setViajes = (fn: (p: ViajesMulaRow[]) => ViajesMulaRow[]) =>
    setViajesState(p => { const n = fn(p); save(LS_VIAJES, n); return n })
  const setAbonos = (fn: (p: AbonoMulaRow[]) => AbonoMulaRow[]) =>
    setAbonosState(p => { const n = fn(p); save(LS_ABONOS, n); return n })

  const [tab, setTab] = useState<PageTab>('pagos')

  // ── Navegación mes ──
  const currentMonth = todayISO().slice(0, 7)
  const [selMonth, setSelMonth]   = useState<string>(() => currentMonth)
  const [openCards, setOpenCards] = useState<Set<number>>(new Set())
  const [cardTab, setCardTab]     = useState<Record<number, 'viajes' | 'abonos'>>({})
  const toggleCard = (id: number) => setOpenCards(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const shiftMonth = (delta: number) => {
    const [y, m] = selMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Mulas CRUD ────────────────────────────────────────────
  const [mulaModal, setMulaModal] = useState(false)
  const [editMula,  setEditMula]  = useState<MulaRow | null>(null)
  const [formMula,  setFormMula]  = useState({ nombre: '', placa: '', conductor: '', tarifa: String(TARIFA_DEFAULT), activo: true })

  const abrirNuevaMula = () => {
    setEditMula(null)
    setFormMula({ nombre: '', placa: '', conductor: '', tarifa: String(TARIFA_DEFAULT), activo: true })
    setMulaModal(true)
  }
  const abrirEditMula = (m: MulaRow) => {
    setEditMula(m)
    setFormMula({ nombre: m.nombre, placa: m.placa, conductor: m.conductor, tarifa: String(m.tarifa_por_viaje), activo: m.activo })
    setMulaModal(true)
  }
  const guardarMula = () => {
    if (!formMula.nombre.trim() || !formMula.placa.trim()) return
    const nuevaTarifa = Number(formMula.tarifa) || TARIFA_DEFAULT
    if (editMula) {
      setMulas(prev => prev.map(m => {
        if (m.id !== editMula.id) return m
        const hist = m.historial_tarifa ?? [{ fecha: '2000-01-01', tarifa: m.tarifa_por_viaje }]
        const changed = nuevaTarifa !== m.tarifa_por_viaje
        return {
          ...m,
          nombre: formMula.nombre.trim(),
          placa: formMula.placa.trim().toUpperCase(),
          conductor: formMula.conductor.trim(),
          activo: formMula.activo,
          tarifa_por_viaje: nuevaTarifa,
          historial_tarifa: changed ? [{ fecha: todayISO(), tarifa: nuevaTarifa }, ...hist] : hist,
        }
      }))
    } else {
      const obj: MulaRow = {
        id: Date.now(),
        nombre: formMula.nombre.trim(),
        placa: formMula.placa.trim().toUpperCase(),
        conductor: formMula.conductor.trim(),
        tarifa_por_viaje: nuevaTarifa,
        activo: formMula.activo,
        historial_tarifa: [{ fecha: todayISO(), tarifa: nuevaTarifa }],
      }
      setMulas(prev => [obj, ...prev])
    }
    setMulaModal(false)
  }
  const eliminarMula = (m: MulaRow) => {
    if (!confirm(`¿Eliminar la mula ${m.placa}? Se eliminarán también sus viajes y abonos.`)) return
    setMulas(prev => prev.filter(x => x.id !== m.id))
    setViajes(prev => prev.filter(v => v.id_mula !== m.id))
    setAbonos(prev => prev.filter(a => a.id_mula !== m.id))
  }

  // ── Viajes CRUD ───────────────────────────────────────────
  const [viajeTarget, setViajeTarget] = useState<number | null>(null)
  const [editViaje,   setEditViaje]   = useState<ViajesMulaRow | null>(null)
  const [formViaje,   setFormViaje]   = useState({ fecha: todayISO(), concepto: '', cantidad: '1', tarifa: '', id_viaje: '', factura_num: '', factura_img: '', nota: '' })
  const [facturaPrev, setFacturaPrev] = useState<string | null>(null)

  const abrirNuevoViaje = (id_mula: number) => {
    const mula = mulas.find(m => m.id === id_mula)
    setViajeTarget(id_mula); setEditViaje(null); setFacturaPrev(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormViaje({ fecha: todayISO(), concepto: '', cantidad: '1', tarifa: String(mula?.tarifa_por_viaje ?? TARIFA_DEFAULT), id_viaje: '', factura_num: '', factura_img: '', nota: '' })
  }
  const abrirEditViaje = (v: ViajesMulaRow) => {
    setViajeTarget(v.id_mula); setEditViaje(v); setFacturaPrev(v.factura_img ?? null)
    if (fileRef.current) fileRef.current.value = ''
    setFormViaje({ fecha: v.fecha, concepto: v.concepto, cantidad: String(v.cantidad_viajes), tarifa: String(v.tarifa), id_viaje: v.id_viaje ? String(v.id_viaje) : '', factura_num: v.factura_num ?? '', factura_img: v.factura_img ?? '', nota: v.nota ?? '' })
  }
  const handleFactura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const b64 = await compressImage(file); setFormViaje(f => ({ ...f, factura_img: b64 })); setFacturaPrev(b64)
  }
  const guardarViaje = () => {
    if (!viajeTarget || !formViaje.concepto.trim()) return
    const cantidad = Number(formViaje.cantidad) || 1
    const tarifa   = Number(formViaje.tarifa) || TARIFA_DEFAULT
    const obj: ViajesMulaRow = {
      id: editViaje?.id ?? Date.now(),
      id_mula: viajeTarget,
      fecha: formViaje.fecha,
      concepto: formViaje.concepto.trim(),
      cantidad_viajes: cantidad,
      tarifa,
      total: cantidad * tarifa,
      id_viaje: formViaje.id_viaje ? Number(formViaje.id_viaje) : undefined,
      factura_num: formViaje.factura_num.trim() || undefined,
      factura_img: formViaje.factura_img || undefined,
      nota: formViaje.nota.trim() || undefined,
    }
    setViajes(prev => editViaje ? prev.map(v => v.id === editViaje.id ? obj : v) : [obj, ...prev])
    setViajeTarget(null); setEditViaje(null)
  }
  const eliminarViaje = (v: ViajesMulaRow) => {
    if (!confirm(`¿Eliminar el viaje "${v.concepto}" del ${formatDate(v.fecha)}?`)) return
    setViajes(prev => prev.filter(x => x.id !== v.id))
  }

  // ── Abonos CRUD ───────────────────────────────────────────
  const [abonoTarget, setAbonoTarget] = useState<number | null>(null)
  const [editAbono,   setEditAbono]   = useState<AbonoMulaRow | null>(null)
  const [formAbono,   setFormAbono]   = useState({ fecha: todayISO(), monto: '', tipo: 'transferencia' as AbonoMulaRow['tipo'], nota: '', comprobante_img: '' })
  const [compPrev,    setCompPrev]    = useState<string | null>(null)

  const abrirAbono = (id_mula: number) => {
    setAbonoTarget(id_mula); setEditAbono(null); setCompPrev(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormAbono({ fecha: todayISO(), monto: '', tipo: 'transferencia', nota: '', comprobante_img: '' })
  }
  const abrirEditAbono = (a: AbonoMulaRow) => {
    setAbonoTarget(a.id_mula); setEditAbono(a); setCompPrev(a.comprobante_img ?? null)
    if (fileRef.current) fileRef.current.value = ''
    setFormAbono({ fecha: a.fecha, monto: String(a.monto), tipo: a.tipo ?? 'transferencia', nota: a.nota ?? '', comprobante_img: a.comprobante_img ?? '' })
  }
  const handleComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const b64 = await compressImage(file); setFormAbono(f => ({ ...f, comprobante_img: b64 })); setCompPrev(b64)
  }
  const guardarAbono = () => {
    if (!abonoTarget || !formAbono.monto || Number(formAbono.monto) <= 0) return
    if (editAbono) {
      const upd: AbonoMulaRow = { ...editAbono, fecha: formAbono.fecha, monto: Number(formAbono.monto), tipo: formAbono.tipo, comprobante_img: formAbono.comprobante_img || undefined, nota: formAbono.nota || undefined }
      setAbonos(prev => prev.map(x => x.id === editAbono.id ? upd : x))
    } else {
      const obj: AbonoMulaRow = {
        id: Date.now(), id_mula: abonoTarget, fecha: formAbono.fecha, monto: Number(formAbono.monto),
        tipo: formAbono.tipo, comprobante_img: formAbono.comprobante_img || undefined, nota: formAbono.nota || undefined,
      }
      setAbonos(prev => [obj, ...prev])
    }
    setAbonoTarget(null); setEditAbono(null)
  }
  const eliminarAbono = (id: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    setAbonos(prev => prev.filter(a => a.id !== id))
  }

  // ── Balance histórico (KPIs / modal) ──
  const overall = useMemo(() => mulas.map(m => {
    const vs = viajes.filter(v => v.id_mula === m.id)
    const totalGanado  = vs.reduce((s, v) => s + v.total, 0)
    const totalAbonado = abonos.filter(a => a.id_mula === m.id).reduce((s, a) => s + a.monto, 0)
    return { mula: m, totalGanado, totalAbonado, saldo: totalGanado - totalAbonado, nViajes: vs.length }
  }), [mulas, viajes, abonos])

  // ── Mes más antiguo con actividad ──
  const firstMonth = useMemo(() => {
    let e = currentMonth
    for (const v of viajes) if (v.fecha && v.fecha.slice(0, 7) < e) e = v.fecha.slice(0, 7)
    for (const a of abonos) if (a.fecha && a.fecha.slice(0, 7) < e) e = a.fecha.slice(0, 7)
    return e
  }, [viajes, abonos, currentMonth])

  // ── Vista del mes por mula ──
  const monthView = useMemo(() => {
    const mesStart = `${selMonth}-01`
    const mesEnd   = periodoEndDate(selMonth)
    return mulas.map(m => {
      const saldoInicio =
          viajes.filter(v => v.id_mula === m.id && v.fecha < mesStart).reduce((s, v) => s + v.total, 0)
        - abonos.filter(a => a.id_mula === m.id && a.fecha < mesStart).reduce((s, a) => s + a.monto, 0)
      const viajesMes = viajes.filter(v => v.id_mula === m.id && v.fecha >= mesStart && v.fecha <= mesEnd).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const abonosMes = abonos.filter(a => a.id_mula === m.id && a.fecha >= mesStart && a.fecha <= mesEnd).sort((a, b) => b.fecha.localeCompare(a.fecha))
      const totalCargos  = viajesMes.reduce((s, v) => s + v.total, 0)
      const totalAbonado = abonosMes.reduce((s, a) => s + a.monto, 0)
      const saldoFin = saldoInicio + totalCargos - totalAbonado
      return { mula: m, saldoInicio, viajesMes, abonosMes, totalCargos, totalAbonado, saldoFin }
    }).filter(r => r.mula.activo || r.viajesMes.length > 0 || r.abonosMes.length > 0 || Math.abs(r.saldoInicio) > 0.01 || Math.abs(r.saldoFin) > 0.01)
      .sort((a, b) => b.saldoFin - a.saldoFin)
  }, [selMonth, mulas, viajes, abonos])

  // ── KPIs ──
  const totalGanado   = overall.reduce((s, r) => s + r.totalGanado, 0)
  const conSaldo      = overall.filter(r => r.saldo > 0.01).length
  const totalViajes   = viajes.reduce((s, v) => s + v.cantidad_viajes, 0)

  const viajeOpts = [
    { value: '', label: '— Sin vincular —' },
    ...viajesMaterial.map(v => ({ value: String(v.id), label: `${v.numero_viaje} · ${formatDate(v.fecha)}` })),
  ]

  return (
    <div className="page">
      <PageHeader
        title="Mulas"
        subtitle="Transporte de salida — control de viajes de concentrado y pagos."
        actions={canWrite && <Button icon={<Plus size={18}/>} onClick={abrirNuevaMula}>Nueva mula</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Mulas activas"   value={mulas.filter(m => m.activo).length} icon={<Truck size={16}/>} accent="emerald" />
        <KpiTile label="Viajes totales"  value={totalViajes} accent="green" />
        <KpiTile label="Total ganado"    value={cop(totalGanado)} accent="brown" />
        <KpiTile label="Con saldo pend." value={conSaldo} accent="rose" icon={<AlertCircle size={16}/>} />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'pagos'}
          className={`segment__btn ${tab === 'pagos' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('pagos')}>Viajes y pagos</button>
        <button role="tab" aria-selected={tab === 'mulas'}
          className={`segment__btn ${tab === 'mulas' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('mulas')}>Registro de mulas</button>
      </div>

      {/* ══ Tab: Viajes y pagos (calendario) ══ */}
      {tab === 'pagos' && (
        <>
          {/* Navegador de mes */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
              {periodoLabel(selMonth)}{selMonth === currentMonth && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Mes actual</span>}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button type="button" onClick={() => shiftMonth(-1)} disabled={selMonth <= firstMonth} title="Mes anterior"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth <= firstMonth ? 'not-allowed' : 'pointer', color: selMonth <= firstMonth ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronLeft size={18}/>
              </button>
              <input className="field__input" type="month" value={selMonth} max={currentMonth}
                onChange={e => { if (e.target.value) setSelMonth(e.target.value) }} style={{ maxWidth: '10rem' }} />
              <button type="button" onClick={() => shiftMonth(1)} disabled={selMonth >= currentMonth} title="Mes siguiente"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth >= currentMonth ? 'not-allowed' : 'pointer', color: selMonth >= currentMonth ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronRight size={18}/>
              </button>
              {selMonth !== currentMonth && (
                <button type="button" onClick={() => setSelMonth(currentMonth)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline' }}>Hoy</button>
              )}
            </div>
          </div>

          {mulas.length === 0 ? (
            <Card title="Sin mulas">
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>
                No hay mulas registradas.{' '}
                <button className="link-btn" onClick={() => setTab('mulas')}>Registrar una mula</button>
              </p>
            </Card>
          ) : monthView.length === 0 ? (
            <Card title={periodoLabel(selMonth)}>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Sin actividad en <strong>{periodoLabel(selMonth)}</strong>.</p>
            </Card>
          ) : monthView.map(r => {
            const isOpen = openCards.has(r.mula.id)
            const t = cardTab[r.mula.id] ?? 'viajes'
            const sc = r.saldoFin
            const semaforo = sc <= 0.01 ? '#16a34a' : r.totalAbonado === 0 ? '#dc2626' : '#f59e0b'
            const base = (r.saldoInicio > 0 ? r.saldoInicio : 0) + r.totalCargos
            const pct = base > 0 ? Math.min(r.totalAbonado / base, 1) : (r.totalAbonado > 0 ? 1 : 0)
            return (
              <div key={r.mula.id} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff', opacity: r.mula.activo ? 1 : 0.7 }}>
                {/* Cabecera colapsada */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
                  onClick={() => toggleCard(r.mula.id)}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={sc <= 0.01 ? 'Pagado' : r.totalAbonado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                  <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{r.mula.nombre}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{r.mula.placa}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{r.viajesMes.length} viajes</span>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                    {r.saldoInicio !== 0 && <span style={{ color: 'var(--text-muted)' }}>Inicio <strong>{cop(Math.abs(r.saldoInicio))}</strong></span>}
                    <span>Cargos <strong>{cop(r.totalCargos)}</strong></span>
                    <span style={{ color: '#15803d' }}>Abonado <strong>{cop(r.totalAbonado)}</strong></span>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: sc > 0 ? '#b45309' : sc < 0 ? '#15803d' : 'var(--text-muted)', minWidth: 96, textAlign: 'right' }} className="mono">
                      {sc === 0 ? 'Saldado' : cop(Math.abs(sc))}
                      <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{sc > 0 ? 'por pagar' : sc < 0 ? 'a favor' : ''}</div>
                    </span>
                    {canWrite && (
                      <span onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="secondary" icon={<Plus size={13}/>} title="Registrar viaje" onClick={() => abrirNuevoViaje(r.mula.id)} />
                        <Button size="sm" icon={<Banknote size={13}/>} onClick={() => abrirAbono(r.mula.id)}>Abonar</Button>
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                    <div className="segment" style={{ marginBottom: '0.75rem' }}>
                      {(['viajes', 'abonos'] as const).map(k => (
                        <button key={k} className={`segment__btn ${t === k ? 'segment__btn--active' : ''}`}
                          onClick={() => setCardTab(s => ({ ...s, [r.mula.id]: k }))}>
                          {k === 'viajes' ? `Viajes del mes (${r.viajesMes.length})` : `Abonos (${r.abonosMes.length})`}
                        </button>
                      ))}
                    </div>

                    {t === 'viajes' ? (
                      r.viajesMes.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin viajes este mes.</em> : (
                        <div className="table-wrap">
                          <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                            <thead><tr>
                              <th>Fecha</th><th>Concepto</th><th>Factura</th>
                              <th style={{ textAlign: 'right' }}>N.°</th>
                              <th style={{ textAlign: 'right' }}>Tarifa</th>
                              <th style={{ textAlign: 'right' }}>Total</th>
                              {canWrite && <th></th>}
                            </tr></thead>
                            <tbody>
                              {r.viajesMes.map(v => (
                                <tr key={v.id}>
                                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(v.fecha)}</td>
                                  <td style={{ fontWeight: 600 }}>{v.concepto}</td>
                                  <td>
                                    {v.factura_num && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>{v.factura_num} </span>}
                                    {v.factura_img && <a href={v.factura_img} target="_blank" rel="noreferrer" title="Ver factura" style={{ color: 'var(--amber-700)' }}><ImageIcon size={13} style={{ verticalAlign: 'middle' }}/></a>}
                                    {!v.factura_num && !v.factura_img && <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                  </td>
                                  <td style={{ textAlign: 'right' }} className="mono">{v.cantidad_viajes}</td>
                                  <td style={{ textAlign: 'right' }} className="mono">{cop(v.tarifa)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(v.total)}</td>
                                  {canWrite && (
                                    <td>
                                      <div className="row" style={{ gap: 4 }}>
                                        <Button variant="secondary" size="sm" icon={<Pencil size={12}/>} onClick={() => abrirEditViaje(v)} />
                                        <Button variant="ghost" size="sm" icon={<Trash2 size={12}/>} onClick={() => eliminarViaje(v)} />
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700 }}>
                                <td colSpan={3}>Total del mes</td>
                                <td style={{ textAlign: 'right' }} className="mono">{r.viajesMes.reduce((s, v) => s + v.cantidad_viajes, 0)}</td>
                                <td/>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(r.totalCargos)}</td>
                                {canWrite && <td/>}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    ) : (
                      r.abonosMes.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos este mes.</em> : (
                        <div className="table-wrap">
                          <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                            <thead><tr>
                              <th>Fecha</th><th>Método</th>
                              <th style={{ textAlign: 'right' }}>Monto</th>
                              <th>Nota</th><th>Comprob.</th>
                              {canWrite && <th></th>}
                            </tr></thead>
                            <tbody>
                              {r.abonosMes.map(a => (
                                <tr key={a.id}>
                                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                                  <td>{TIPO_LABELS[a.tipo ?? 'otro']}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(a.monto)}</td>
                                  <td style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{a.nota ?? ''}</td>
                                  <td>{a.comprobante_img && <a href={a.comprobante_img} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ color: 'var(--amber-700)', display: 'flex' }}><ImageIcon size={14}/></a>}</td>
                                  {canWrite && (
                                    <td>
                                      <div className="row" style={{ gap: 4 }}>
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-600)' }} onClick={() => abrirEditAbono(a)} title="Editar"><Pencil size={13}/></button>
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }} onClick={() => eliminarAbono(a.id)} title="Eliminar"><Trash2 size={13}/></button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700 }}>
                                <td colSpan={2}>Total abonado</td>
                                <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(r.totalAbonado)}</td>
                                <td colSpan={canWrite ? 3 : 2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    )}

                    {/* Resumen del mes */}
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: sc > 0 ? '#fef3c7' : sc < 0 ? '#dcfce7' : '#f3f4f6', borderRadius: 6, fontSize: 'var(--fs-sm)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {r.saldoInicio !== 0 && <span>Saldo inicio: <strong>{cop(Math.abs(r.saldoInicio))}</strong> {r.saldoInicio > 0 ? '(debía)' : '(a favor)'}</span>}
                      <span>+ Cargos: <strong>{cop(r.totalCargos)}</strong></span>
                      {r.totalAbonado > 0 && <span>− Pagado: <strong style={{ color: '#15803d' }}>{cop(r.totalAbonado)}</strong></span>}
                      <span style={{ fontWeight: 800 }}>= Saldo fin: <strong style={{ color: sc > 0 ? '#b45309' : sc < 0 ? '#15803d' : 'var(--text-muted)' }}>{sc === 0 ? 'Saldado' : cop(Math.abs(sc))}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ══ Tab: Registro de mulas ══ */}
      {tab === 'mulas' && (
        <Card title={`Mulas registradas (${mulas.length})`}
          actions={canWrite && <Button size="sm" icon={<Plus size={15}/>} onClick={abrirNuevaMula}>Nueva mula</Button>}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Nombre</th><th>Placa</th><th>Conductor</th>
                <th style={{ textAlign: 'right' }}>Tarifa/viaje</th>
                <th>Historial tarifa</th><th>Estado</th>
                {canWrite && <th></th>}
              </tr></thead>
              <tbody>
                {mulas.length === 0 && (
                  <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin mulas registradas</td></tr>
                )}
                {mulas.map(m => (
                  <tr key={m.id} style={!m.activo ? { opacity: 0.6 } : undefined}>
                    <td style={{ fontWeight: 700 }}>{m.nombre}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{m.placa}</td>
                    <td>{m.conductor || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">{cop(m.tarifa_por_viaje)}</td>
                    <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      {(m.historial_tarifa && m.historial_tarifa.length > 1)
                        ? m.historial_tarifa.slice(0, 3).map((h, i) => <div key={i}>{formatDate(h.fecha)}: {cop(h.tarifa)}</div>)
                        : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td><span className={`badge badge--${m.activo ? 'success' : 'neutral'}`}>{m.activo ? 'Activa' : 'Inactiva'}</span></td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={13}/>} onClick={() => abrirEditMula(m)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={13}/>} onClick={() => eliminarMula(m)} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Modal: Nueva / Editar mula ── */}
      <Modal open={mulaModal} title={editMula ? `Editar mula — ${editMula.placa}` : 'Nueva mula'}
        onClose={() => setMulaModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setMulaModal(false)}>Cancelar</Button>
          <Button onClick={guardarMula} disabled={!formMula.nombre.trim() || !formMula.placa.trim()}>Guardar</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Nombre / razón social" required placeholder="TRANSPORTES VILLA"
            value={formMula.nombre} onChange={e => setFormMula(f => ({ ...f, nombre: e.target.value }))} />
          <Input label="Placa" required placeholder="STO-456" style={{ fontFamily: 'var(--font-mono)' }}
            value={formMula.placa} onChange={e => setFormMula(f => ({ ...f, placa: e.target.value }))} />
          <Input label="Conductor (opcional)" placeholder="Nombre del conductor"
            value={formMula.conductor} onChange={e => setFormMula(f => ({ ...f, conductor: e.target.value }))} />
          <Input label="Tarifa vigente por viaje ($)" type="number" step="100000"
            value={formMula.tarifa} onChange={e => setFormMula(f => ({ ...f, tarifa: e.target.value }))}
            helper={`Estándar: ${cop(TARIFA_DEFAULT)}. Al cambiarla se guarda en el historial.`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="mula-activa" checked={formMula.activo}
              onChange={e => setFormMula(f => ({ ...f, activo: e.target.checked }))} />
            <label htmlFor="mula-activa" style={{ cursor: 'pointer', userSelect: 'none' }}>Mula activa</label>
          </div>
        </div>
        {editMula?.historial_tarifa && editMula.historial_tarifa.length > 0 && (
          <div className="callout" style={{ marginTop: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            <strong>Historial de tarifa:</strong>
            {editMula.historial_tarifa.map((h, i) => <div key={i} style={{ color: 'var(--text-muted)' }}>{formatDate(h.fecha)} → {cop(h.tarifa)}</div>)}
          </div>
        )}
      </Modal>

      {/* ── Modal: Registrar / Editar viaje ── */}
      {(() => {
        const mula = viajeTarget != null ? mulas.find(m => m.id === viajeTarget) : null
        return (
          <Modal open={viajeTarget != null} title={editViaje ? 'Editar viaje' : `Registrar viaje — ${mula?.nombre ?? ''}`}
            onClose={() => { setViajeTarget(null); setEditViaje(null) }}
            footer={<>
              <Button variant="secondary" onClick={() => { setViajeTarget(null); setEditViaje(null) }}>Cancelar</Button>
              <Button onClick={guardarViaje} disabled={!formViaje.concepto.trim()}>Guardar</Button>
            </>}>
            <div className="grid grid--form">
              <Input label="Fecha" type="date" value={formViaje.fecha} onChange={e => setFormViaje(f => ({ ...f, fecha: e.target.value }))} />
              <Input label="N.° de viajes" type="number" step="1" min="1" value={formViaje.cantidad} onChange={e => setFormViaje(f => ({ ...f, cantidad: e.target.value }))} />
              <Input label="Concepto / Destino" required placeholder="Viaje a refinería…" style={{ gridColumn: '1/-1' }}
                value={formViaje.concepto} onChange={e => setFormViaje(f => ({ ...f, concepto: e.target.value }))} />
              <Select label="Viaje vinculado" options={viajeOpts} value={formViaje.id_viaje} onChange={e => setFormViaje(f => ({ ...f, id_viaje: e.target.value }))} />
              <Input label="Tarifa por viaje ($)" type="number" step="100000" value={formViaje.tarifa} onChange={e => setFormViaje(f => ({ ...f, tarifa: e.target.value }))} />
              <Input label="N.° de factura" placeholder="F-00123" value={formViaje.factura_num} onChange={e => setFormViaje(f => ({ ...f, factura_num: e.target.value }))} />
              <Input label="Nota (opcional)" value={formViaje.nota} onChange={e => setFormViaje(f => ({ ...f, nota: e.target.value }))} />
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Foto de la factura</div>
                <input ref={fileRef} id="factura-file" type="file" accept="image/*" onChange={handleFactura} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
                {!facturaPrev ? (
                  <label htmlFor="factura-file" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                    <FileText size={18} style={{ color: 'var(--amber-600)' }} /> Subir foto de la factura
                  </label>
                ) : (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={facturaPrev} alt="factura" style={{ maxHeight: 150, borderRadius: 8, border: '1.5px solid var(--border-default)', display: 'block' }} />
                    <button onClick={() => { setFacturaPrev(null); setFormViaje(f => ({ ...f, factura_img: '' })); if (fileRef.current) fileRef.current.value = '' }}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 12 }}>✕</button>
                  </div>
                )}
              </div>
            </div>
            {Number(formViaje.cantidad) > 0 && Number(formViaje.tarifa) > 0 && (
              <div className="callout" style={{ marginTop: '1rem' }}>
                {formViaje.cantidad} viaje{Number(formViaje.cantidad) !== 1 ? 's' : ''} × {cop(Number(formViaje.tarifa))} = <strong>{cop(Number(formViaje.cantidad) * Number(formViaje.tarifa))}</strong>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ── Modal: Registrar / Editar abono ── */}
      {(() => {
        const mula  = abonoTarget != null ? mulas.find(m => m.id === abonoTarget) : null
        const grupo = abonoTarget != null ? overall.find(r => r.mula.id === abonoTarget) : null
        return (
          <Modal open={abonoTarget != null} title={`${editAbono ? 'Editar' : 'Registrar'} pago — ${mula?.nombre ?? ''}`}
            onClose={() => { setAbonoTarget(null); setEditAbono(null) }}
            footer={<>
              <Button variant="secondary" onClick={() => { setAbonoTarget(null); setEditAbono(null) }}>Cancelar</Button>
              <Button icon={<Banknote size={16}/>} onClick={guardarAbono} disabled={!formAbono.monto || Number(formAbono.monto) <= 0}>{editAbono ? 'Guardar cambios' : 'Registrar abono'}</Button>
            </>}>
            {grupo && (
              <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)' }}>
                Total ganado: <strong style={{ color: '#15803d' }}>{cop(grupo.totalGanado)}</strong>
                {grupo.totalAbonado > 0 && <> · Abonado: <strong>{cop(grupo.totalAbonado)}</strong></>}
                {' · '}<span style={{ fontWeight: 800, color: grupo.saldo > 0 ? '#b45309' : '#15803d' }}>Saldo: {cop(grupo.saldo)}</span>
              </div>
            )}
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={formAbono.fecha} onChange={e => setFormAbono(f => ({ ...f, fecha: e.target.value }))} />
              <Input label="Monto abonado ($)" type="number" step="100000" required placeholder={`Ej: ${cop(TARIFA_DEFAULT)}`}
                value={formAbono.monto} onChange={e => setFormAbono(f => ({ ...f, monto: e.target.value }))} />
              <Select label="Método" options={TIPO_OPTS} value={formAbono.tipo} onChange={e => setFormAbono(f => ({ ...f, tipo: e.target.value as AbonoMulaRow['tipo'] }))} />
              <Input label="Nota (opcional)" placeholder="Referencia…" value={formAbono.nota} onChange={e => setFormAbono(f => ({ ...f, nota: e.target.value }))} />
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Foto del comprobante</div>
                <input id="comp-file-mula" type="file" accept="image/*" onChange={handleComprobante} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
                {!compPrev ? (
                  <label htmlFor="comp-file-mula" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                    <ImageIcon size={18} style={{ color: 'var(--amber-600)' }} /> Subir foto del depósito / transferencia
                  </label>
                ) : (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={compPrev} alt="comprobante" style={{ maxHeight: 150, borderRadius: 8, border: '1.5px solid var(--border-default)', display: 'block' }} />
                    <button onClick={() => { setCompPrev(null); setFormAbono(f => ({ ...f, comprobante_img: '' })) }}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 12 }}>✕</button>
                  </div>
                )}
              </div>
            </div>
            {formAbono.monto && grupo && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                Saldo tras el abono: <strong style={{ color: grupo.saldo - Number(formAbono.monto) > 0 ? '#b45309' : '#15803d' }}>
                  {cop(grupo.saldo - Number(formAbono.monto) + (editAbono ? editAbono.monto : 0))}
                </strong>
              </div>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}
