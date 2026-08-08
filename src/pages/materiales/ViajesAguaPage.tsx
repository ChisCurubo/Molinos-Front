import React, { useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Droplets, HandCoins, ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { duenosVolqueta, type AguaRow } from '@/data/mock'
import { apiPost } from '@/api/withFallback'

const cop = formatCOP

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

// ── Imagen ────────────────────────────────────────────────────
function compressImage(file: File, maxPx = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
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

// ── Interfaces ────────────────────────────────────────────────
interface AbonoAgua {
  id: number
  id_dueno: number
  fecha: string
  monto: number
  nota?: string
  comprobante_img?: string
}

const LS_AGUA   = 'molinos_erp_agua_v1'
const LS_ABONOS = 'molinos_abonos_agua_v1'

function loadRegistros(): AguaRow[] {
  try { const r = localStorage.getItem(LS_AGUA); return r ? JSON.parse(r) : [] } catch { return [] }
}
function loadAbonos(): AbonoAgua[] {
  try { const r = localStorage.getItem(LS_ABONOS); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveRegistros(d: AguaRow[]) { try { localStorage.setItem(LS_AGUA, JSON.stringify(d)) } catch { /* quota */ } }
function saveAbonos(d: AbonoAgua[]) { try { localStorage.setItem(LS_ABONOS, JSON.stringify(d)) } catch { /* quota */ } }

type PageTab = 'registros' | 'conductores'

interface FormRegistro { id_dueno: string; fecha: string; valor_viaje: string; cantidad_viajes: string; acpm: string }
const emptyRegistro = (): FormRegistro => ({
  id_dueno: String(duenosVolqueta[0]?.id ?? ''),
  fecha: todayISO(), valor_viaje: '', cantidad_viajes: '', acpm: '0',
})

export function ViajesAguaPage() {
  const canWrite = useCanWrite('materiales')

  const [registros, setRegistros] = useState<AguaRow[]>(() => loadRegistros())
  const [abonos,    setAbonos]    = useState<AbonoAgua[]>(() => loadAbonos())

  const [tab,      setTab]      = useState<PageTab>('conductores')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [cardTab,  setCardTab]  = useState<Record<number, 'viajes' | 'abonos'>>({})

  // Filtros de la vista por conductor
  const [selMonth,    setSelMonth]    = useState<string>(() => todayISO().slice(0, 7))
  const [fDueno,      setFDueno]      = useState('')
  const [fEstadoPago, setFEstadoPago] = useState('todos')

  // Imagen viewer
  const [imgViewer, setImgViewer] = useState<string | null>(null)

  // Registro modal
  const [regOpen,   setRegOpen]  = useState(false)
  const [editReg,   setEditReg]  = useState<AguaRow | null>(null)
  const [formReg,   setFormReg]  = useState<FormRegistro>(emptyRegistro)
  const [savingReg, setSavingReg] = useState(false)

  // Abono modal
  const [abonoTarget,   setAbonoTarget]   = useState<number | null>(null)
  const [formAbono,     setFormAbono]     = useState({ fecha: todayISO(), monto: '', nota: '', comprobante: '' })
  const [comprimiendo,  setComprimiendo]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Por conductor ─────────────────────────────────────────
  const porConductor = useMemo(() => {
    return duenosVolqueta.map(d => {
      const filas      = registros.filter(a => a.id_dueno === d.id)
      const abonosFila = abonos.filter(ab => ab.id_dueno === d.id)
      if (filas.length === 0 && abonosFila.length === 0) return null
      const neto         = filas.reduce((s, a) => s + a.valor_total, 0)
      const totalAbonado = abonosFila.reduce((s, ab) => s + ab.monto, 0)
      return {
        dueno: d, filas,
        abonos: abonosFila,
        viajes: filas.reduce((s, a) => s + a.cantidad_viajes, 0),
        neto, totalAbonado,
        saldo: neto - totalAbonado,
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [registros, abonos])

  const totalNeto      = porConductor.reduce((s, r) => s + r.neto, 0)
  const totalViajes    = porConductor.reduce((s, r) => s + r.viajes, 0)
  const totalPendiente = porConductor.reduce((s, r) => s + r.saldo, 0)

  // ── Vista mensual (estilo Mulas: saldo arrastrado + encadenado) ──
  const currentMonth = todayISO().slice(0, 7)
  const firstMonth = useMemo(() => {
    let e = currentMonth
    for (const a of registros) if (a.fecha && a.fecha.slice(0, 7) < e) e = a.fecha.slice(0, 7)
    for (const x of abonos)    if (x.fecha && x.fecha.slice(0, 7) < e) e = x.fecha.slice(0, 7)
    return e
  }, [registros, abonos, currentMonth])
  const shiftMonth = (delta: number) => {
    const [y, m] = selMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const aguaMes = useMemo(() => {
    const mesStart = `${selMonth}-01`
    const mesEnd   = periodoEndDate(selMonth)
    return duenosVolqueta.map(d => {
      const saldoInicio =
          registros.filter(a => a.id_dueno === d.id && a.fecha < mesStart).reduce((s, a) => s + a.valor_total, 0)
        - abonos.filter(x => x.id_dueno === d.id && x.fecha < mesStart).reduce((s, x) => s + x.monto, 0)
      const filas  = registros.filter(a => a.id_dueno === d.id && a.fecha >= mesStart && a.fecha <= mesEnd).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const abns   = abonos.filter(x => x.id_dueno === d.id && x.fecha >= mesStart && x.fecha <= mesEnd).sort((a, b) => b.fecha.localeCompare(a.fecha))
      const neto         = filas.reduce((s, a) => s + a.valor_total, 0)
      const totalAbonado = abns.reduce((s, x) => s + x.monto, 0)
      return {
        dueno: d, saldoInicio, filas, abonos: abns,
        viajes: filas.reduce((s, a) => s + a.cantidad_viajes, 0),
        neto, totalAbonado, saldo: saldoInicio + neto - totalAbonado,
      }
    }).filter(r => r.filas.length > 0 || r.abonos.length > 0 || Math.abs(r.saldoInicio) > 0.01 || Math.abs(r.saldo) > 0.01)
      .sort((a, b) => b.saldo - a.saldo)
  }, [selMonth, registros, abonos])

  // ── Registros CRUD ────────────────────────────────────────
  const abrirNuevo = () => { setEditReg(null); setFormReg(emptyRegistro()); setRegOpen(true) }
  const abrirEdit  = (a: AguaRow) => {
    setEditReg(a)
    setFormReg({ id_dueno: String(a.id_dueno), fecha: a.fecha, valor_viaje: String(a.valor_viaje), cantidad_viajes: String(a.cantidad_viajes), acpm: String(a.acpm) })
    setRegOpen(true)
  }

  const handleGuardarReg = async (e: FormEvent) => {
    e.preventDefault()
    setSavingReg(true)
    const dueno = duenosVolqueta.find(d => d.id === Number(formReg.id_dueno))
    if (editReg) {
      const updated: AguaRow = {
        ...editReg,
        id_dueno: Number(formReg.id_dueno), conductor: dueno?.nombre ?? editReg.conductor,
        fecha: formReg.fecha, valor_viaje: Number(formReg.valor_viaje),
        cantidad_viajes: Number(formReg.cantidad_viajes), acpm: Number(formReg.acpm) || 0,
        valor_total: Number(formReg.valor_viaje) * Number(formReg.cantidad_viajes) - (Number(formReg.acpm) || 0),
      }
      setRegistros(prev => { const n = prev.map(a => a.id === editReg.id ? updated : a); saveRegistros(n); return n })
    } else {
      const body = { id_vehiculo: Number(formReg.id_dueno), fecha: formReg.fecha, valor_viaje: Number(formReg.valor_viaje), cantidad_viajes: Number(formReg.cantidad_viajes), acpm: Number(formReg.acpm) || 0 }
      await apiPost('/material/agua', body, b => b)
      const nueva: AguaRow = { id: Date.now(), id_dueno: body.id_vehiculo, conductor: dueno?.nombre ?? '', fecha: body.fecha, valor_viaje: body.valor_viaje, cantidad_viajes: body.cantidad_viajes, acpm: body.acpm, valor_total: body.valor_viaje * body.cantidad_viajes - body.acpm }
      setRegistros(prev => { const n = [nueva, ...prev]; saveRegistros(n); return n })
    }
    setSavingReg(false); setRegOpen(false); setEditReg(null)
  }

  const eliminarReg = (a: AguaRow) => {
    if (!confirm(`¿Eliminar registro del ${formatDate(a.fecha)} de ${a.conductor}?`)) return
    setRegistros(prev => { const n = prev.filter(x => x.id !== a.id); saveRegistros(n); return n })
  }

  // ── Abonos CRUD ───────────────────────────────────────────
  const abrirAbono = (id_dueno: number) => {
    setAbonoTarget(id_dueno)
    setFormAbono({ fecha: todayISO(), monto: '', nota: '', comprobante: '' })
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setComprimiendo(true)
    try {
      const b64 = await compressImage(file)
      setFormAbono(f => ({ ...f, comprobante: b64 }))
    } finally {
      setComprimiendo(false)
    }
  }

  const guardarAbono = () => {
    if (!abonoTarget || !formAbono.monto) return
    const nuevo: AbonoAgua = {
      id: Date.now(), id_dueno: abonoTarget, fecha: formAbono.fecha,
      monto: Number(formAbono.monto),
      nota: formAbono.nota || undefined,
      comprobante_img: formAbono.comprobante || undefined,
    }
    setAbonos(prev => { const n = [nuevo, ...prev]; saveAbonos(n); return n })
    setAbonoTarget(null)
  }

  const eliminarAbono = (id: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    setAbonos(prev => { const n = prev.filter(a => a.id !== id); saveAbonos(n); return n })
  }

  const previewNeto = Number(formReg.valor_viaje) * Number(formReg.cantidad_viajes) - (Number(formReg.acpm) || 0)

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader
        title="Viajes de agua"
        subtitle={`${registros.length} registros · ${totalViajes} viajes · Neto: ${cop(totalNeto)}`}
        actions={canWrite && <Button icon={<Plus size={18}/>} onClick={abrirNuevo}>Registrar viaje</Button>}
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Conductores"     value={porConductor.length}  icon={<Droplets size={16}/>} accent="emerald" />
        <KpiTile label="Viajes totales"  value={totalViajes}                                        accent="green"   />
        <KpiTile label="Neto acumulado"  value={cop(totalNeto)}                                     accent="brown"   />
        <KpiTile label="Saldo pendiente" value={cop(totalPendiente)}                                accent="rose"    />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'conductores'}
          className={`segment__btn ${tab === 'conductores' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('conductores')}>Por conductor</button>
        <button role="tab" aria-selected={tab === 'registros'}
          className={`segment__btn ${tab === 'registros' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('registros')}>Todos los registros</button>
      </div>

      {/* ── Tab: Por conductor (mensual, estilo Mulas) ── */}
      {tab === 'conductores' && (() => {
        const conductoresFiltrados = aguaMes.filter(r => {
          if (fDueno && String(r.dueno.id) !== fDueno) return false
          if (fEstadoPago === 'pagado'    && r.saldo > 0.01)  return false
          if (fEstadoPago === 'pendiente' && r.saldo <= 0.01) return false
          return true
        })
        return (
        <>
          {/* Navegador de mes + filtros */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
              {periodoLabel(selMonth)}{selMonth === currentMonth && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Mes actual</span>}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button type="button" onClick={() => shiftMonth(-1)} disabled={selMonth <= firstMonth} title="Mes anterior"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth <= firstMonth ? 'not-allowed' : 'pointer', color: selMonth <= firstMonth ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronLeft size={18}/>
              </button>
              <input className="field__input" type="month" value={selMonth} max={currentMonth} onChange={e => { if (e.target.value) setSelMonth(e.target.value) }} style={{ maxWidth: '10rem' }} />
              <button type="button" onClick={() => shiftMonth(1)} disabled={selMonth >= currentMonth} title="Mes siguiente"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth >= currentMonth ? 'not-allowed' : 'pointer', color: selMonth >= currentMonth ? 'var(--text-faint)' : 'var(--text)' }}>
                <ChevronRight size={18}/>
              </button>
              {selMonth !== currentMonth && <button type="button" onClick={() => setSelMonth(currentMonth)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline' }}>Hoy</button>}
            </div>
            <div style={{ width: 1, height: 30, background: '#e5e7eb' }} />
            <select className="field__input" style={{ minWidth: '11rem' }} value={fDueno} onChange={e => setFDueno(e.target.value)}>
              <option value="">Todos los conductores</option>
              {porConductor.map(r => <option key={r.dueno.id} value={String(r.dueno.id)}>{r.dueno.nombre}</option>)}
            </select>
            <div className="segment">
              {([['todos', 'Todos'], ['pendiente', 'Por pagar'], ['pagado', 'Pagado']] as [string, string][]).map(([k, l]) => (
                <button key={k} className={`segment__btn ${fEstadoPago === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstadoPago(k)}>{l}</button>
              ))}
            </div>
          </div>

          {conductoresFiltrados.length === 0 ? (
            <Card title={periodoLabel(selMonth)}>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin actividad en {periodoLabel(selMonth)}.</p>
            </Card>
          ) : conductoresFiltrados.map(r => {
          const isOpen = expanded.has(r.dueno.id)
          const ct = cardTab[r.dueno.id] ?? 'viajes'
          const semaforo = r.saldo <= 0.01 ? '#16a34a' : r.totalAbonado === 0 ? '#dc2626' : '#f59e0b'
          const pct = r.neto > 0 ? Math.min(r.totalAbonado / r.neto, 1) : (r.totalAbonado > 0 ? 1 : 0)
          return (
            <div key={r.dueno.id} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera colapsada */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
                onClick={() => toggleExpand(r.dueno.id)}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={r.saldo <= 0.01 ? 'Pagado' : r.totalAbonado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{r.dueno.nombre}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{r.viajes} viajes</span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                  {r.saldoInicio !== 0 && <span style={{ color: 'var(--text-muted)' }}>Inicio <strong>{cop(Math.abs(r.saldoInicio))}</strong></span>}
                  <span>Neto mes <strong>{cop(r.neto)}</strong></span>
                  <span style={{ color: '#15803d' }}>Abonado <strong>{cop(r.totalAbonado)}</strong></span>
                  <div style={{ minWidth: 110 }}>
                    <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: r.saldo > 0 ? '#b45309' : r.saldo < 0 ? '#15803d' : 'var(--text-muted)', minWidth: 96, textAlign: 'right' }} className="mono">
                    {r.saldo === 0 ? 'Saldado' : cop(Math.abs(r.saldo))}
                    <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{r.saldo > 0 ? 'por pagar' : r.saldo < 0 ? 'a favor' : ''}</div>
                  </span>
                  {canWrite && (
                    <span onClick={e => e.stopPropagation()}>
                      <Button size="sm" icon={<HandCoins size={13}/>} onClick={() => abrirAbono(r.dueno.id)}>Abonar</Button>
                    </span>
                  )}
                  {isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                  <div className="segment" style={{ marginBottom: '0.75rem' }}>
                    {(['viajes', 'abonos'] as const).map(k => (
                      <button key={k} className={`segment__btn ${ct === k ? 'segment__btn--active' : ''}`}
                        onClick={() => setCardTab(s => ({ ...s, [r.dueno.id]: k }))}>
                        {k === 'viajes' ? `Viajes del período (${r.filas.length})` : `Abonos (${r.abonos.length})`}
                      </button>
                    ))}
                  </div>

                  {ct === 'viajes' ? (
                    r.filas.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin viajes.</em> : (
                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                          <thead><tr>
                            <th>Fecha</th>
                            <th style={{ textAlign: 'right' }}>Viajes</th>
                            <th style={{ textAlign: 'right' }}>$/viaje</th>
                            <th style={{ textAlign: 'right' }}>Bruto</th>
                            <th style={{ textAlign: 'right' }}>ACPM</th>
                            <th style={{ textAlign: 'right' }}>Neto</th>
                            {canWrite && <th></th>}
                          </tr></thead>
                          <tbody>
                            {r.filas.map(a => (
                              <tr key={a.id} style={a.acpm > 0 ? { background: 'var(--amber-50)' } : undefined}>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{a.cantidad_viajes}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje * a.cantidad_viajes)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{a.acpm > 0 ? <span style={{ color: 'var(--amber-700)' }}>- {cop(a.acpm)}</span> : '—'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(a.valor_total)}</td>
                                {canWrite && (
                                  <td>
                                    <div className="row" style={{ gap: 4 }}>
                                      <Button variant="secondary" size="sm" icon={<Pencil size={12}/>} onClick={() => abrirEdit(a)} />
                                      <Button variant="ghost"     size="sm" icon={<Trash2  size={12}/>} onClick={() => eliminarReg(a)} />
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: 700 }}>
                              <td>Total</td>
                              <td style={{ textAlign: 'right' }} className="mono">{r.viajes}</td>
                              <td/>
                              <td style={{ textAlign: 'right' }} className="mono">{cop(r.filas.reduce((s, a) => s + a.valor_viaje * a.cantidad_viajes, 0))}</td>
                              <td style={{ textAlign: 'right' }} className="mono">- {cop(r.filas.reduce((s, a) => s + a.acpm, 0))}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{cop(r.neto)}</td>
                              {canWrite && <td/>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  ) : (
                    r.abonos.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos.</em> : (
                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                          <thead><tr>
                            <th>Fecha</th>
                            <th style={{ textAlign: 'right' }}>Monto</th>
                            <th>Nota</th><th style={{ width: '2.5rem' }}>Comp.</th>
                            {canWrite && <th></th>}
                          </tr></thead>
                          <tbody>
                            {r.abonos.map(ab => (
                              <tr key={ab.id}>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(ab.fecha)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{cop(ab.monto)}</td>
                                <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{ab.nota ?? '—'}</td>
                                <td>{ab.comprobante_img && (
                                  <img src={ab.comprobante_img} alt="comprobante" onClick={() => setImgViewer(ab.comprobante_img!)}
                                    style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)' }} />
                                )}</td>
                                {canWrite && (
                                  <td><Button variant="ghost" size="sm" icon={<Trash2 size={12}/>} onClick={() => eliminarAbono(ab.id)} /></td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: 700 }}>
                              <td>Total abonado</td>
                              <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{cop(r.totalAbonado)}</td>
                              <td colSpan={canWrite ? 3 : 2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  )}

                  {/* Resumen del mes */}
                  <div className="callout" style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-sm)' }}>
                    {r.saldoInicio !== 0 && <span>Saldo inicio: <strong>{cop(Math.abs(r.saldoInicio))}</strong> {r.saldoInicio > 0 ? '(debía)' : '(a favor)'}</span>}
                    <span>+ Neto mes: <strong style={{ color: 'var(--green-700)' }}>{cop(r.neto)}</strong></span>
                    {r.totalAbonado > 0 && <span>− Abonado: <strong>{cop(r.totalAbonado)}</strong></span>}
                    <span style={{ fontWeight: 800, color: r.saldo > 0 ? 'var(--rose-700)' : 'var(--text-muted)' }}>= Saldo fin: {cop(r.saldo)}</span>
                    {canWrite && <Button size="sm" icon={<HandCoins size={13}/>} onClick={() => abrirAbono(r.dueno.id)} style={{ marginLeft: 'auto' }}>Registrar abono</Button>}
                  </div>
                </div>
              )}
            </div>
          )
          })}
        </>
        )
      })()}

      {/* ── Tab: Todos los registros ── */}
      {tab === 'registros' && (
        <Card title={`Todos los registros (${registros.length})`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Conductor</th><th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Viajes</th>
                  <th style={{ textAlign: 'right' }}>$/viaje</th>
                  <th style={{ textAlign: 'right' }}>Bruto</th>
                  <th style={{ textAlign: 'right' }}>ACPM</th>
                  <th style={{ textAlign: 'right' }}>Neto</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
                )}
                {registros.map(a => (
                  <tr key={a.id} style={a.acpm > 0 ? { background: 'var(--amber-50)' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{a.conductor}</td>
                    <td>{formatDate(a.fecha)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{a.cantidad_viajes}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje * a.cantidad_viajes)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {a.acpm > 0 ? <span style={{ color: 'var(--amber-700)' }}>- {cop(a.acpm)}</span> : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(a.valor_total)}</td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={13}/>} onClick={() => abrirEdit(a)} />
                          <Button variant="ghost"     size="sm" icon={<Trash2  size={13}/>} onClick={() => eliminarReg(a)} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(registros.reduce((s, a) => s + a.valor_viaje * a.cantidad_viajes, 0))}</td>
                  <td style={{ textAlign: 'right' }} className="mono">- {cop(registros.reduce((s, a) => s + a.acpm, 0))}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(totalNeto)}</td>
                  {canWrite && <td/>}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Modal: Registrar / Editar viaje ── */}
      <Modal open={regOpen} title={editReg ? 'Editar registro de agua' : 'Registrar viaje de agua'}
        onClose={() => { setRegOpen(false); setEditReg(null) }}
        footer={<>
          <Button variant="secondary" onClick={() => { setRegOpen(false); setEditReg(null) }}>Cancelar</Button>
          <Button type="submit" form="viajes-agua-form" disabled={savingReg}>{savingReg ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <form id="viajes-agua-form" onSubmit={handleGuardarReg}>
          <div className="grid grid--form">
            <Select label="Conductor / Dueño"
              options={duenosVolqueta.map(d => ({ value: String(d.id), label: d.nombre }))}
              value={formReg.id_dueno} onChange={e => setFormReg(f => ({ ...f, id_dueno: e.target.value }))} required />
            <Input label="Fecha" type="date" value={formReg.fecha}
              onChange={e => setFormReg(f => ({ ...f, fecha: e.target.value }))} required />
            <Input label="Valor por viaje" type="number" placeholder="130000"
              value={formReg.valor_viaje} onChange={e => setFormReg(f => ({ ...f, valor_viaje: e.target.value }))} required />
            <Input label="Cantidad de viajes" type="number" placeholder="6"
              value={formReg.cantidad_viajes} onChange={e => setFormReg(f => ({ ...f, cantidad_viajes: e.target.value }))} required />
            <Input label="Adelanto ACPM" type="number" placeholder="0"
              value={formReg.acpm} onChange={e => setFormReg(f => ({ ...f, acpm: e.target.value }))}
              helper="Dejar en 0 si no aplica" />
          </div>
          {Number(formReg.valor_viaje) > 0 && Number(formReg.cantidad_viajes) > 0 && (
            <div className="callout" style={{ marginTop: '1rem' }}>
              <span className="callout__icon"><Droplets size={14}/></span>
              <span>
                {cop(Number(formReg.valor_viaje))} × {formReg.cantidad_viajes}
                {Number(formReg.acpm) > 0 ? ` − ${cop(Number(formReg.acpm))} ACPM` : ''} = <strong>{cop(previewNeto)}</strong>
              </span>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Modal: Registrar abono ── */}
      {(() => {
        const targetDueno = abonoTarget != null ? duenosVolqueta.find(d => d.id === abonoTarget) : null
        const grupo       = abonoTarget != null ? porConductor.find(r => r.dueno.id === abonoTarget) : null
        return (
          <Modal open={abonoTarget != null} title={`Registrar abono — ${targetDueno?.nombre ?? ''}`}
            onClose={() => setAbonoTarget(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
              <Button onClick={guardarAbono} disabled={!formAbono.monto || comprimiendo}>
                {comprimiendo ? 'Procesando imagen…' : 'Registrar abono'}
              </Button>
            </>}>
            {grupo && (
              <div className="callout" style={{ marginBottom: '1rem' }}>
                Neto acumulado: <strong style={{ color: 'var(--green-700)' }}>{cop(grupo.neto)}</strong>
                {grupo.totalAbonado > 0 && <> · Ya abonado: <strong>- {cop(grupo.totalAbonado)}</strong></>}
                <br/>
                <span style={{ fontWeight: 700, color: 'var(--rose-700)' }}>Saldo pendiente: {cop(grupo.saldo)}</span>
              </div>
            )}
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date"
                value={formAbono.fecha} onChange={e => setFormAbono(f => ({ ...f, fecha: e.target.value }))} />
              <Input label="Monto abonado ($)" type="number" step="1000" required placeholder="Ej: 500000"
                value={formAbono.monto} onChange={e => setFormAbono(f => ({ ...f, monto: e.target.value }))} />
              <Input label="Nota (opcional)" placeholder="Transferencia Nequi…"
                value={formAbono.nota} onChange={e => setFormAbono(f => ({ ...f, nota: e.target.value }))}
                style={{ gridColumn: '1/-1' }} />
            </div>

            {/* Comprobante */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '0.4rem' }}>Comprobante (foto / captura):</p>
              {formAbono.comprobante ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={formAbono.comprobante}
                    alt="comprobante"
                    onClick={() => setImgViewer(formAbono.comprobante)}
                    style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in', display: 'block' }}
                  />
                  <button
                    onClick={() => { setFormAbono(f => ({ ...f, comprobante: '' })); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <X size={13}/>
                  </button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  <ImageIcon size={15}/>
                  {comprimiendo ? 'Procesando…' : 'Adjuntar comprobante'}
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
              )}
            </div>

            {formAbono.monto && grupo && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                Saldo tras el abono: <strong style={{ color: grupo.saldo - Number(formAbono.monto) > 0 ? 'var(--rose-700)' : 'var(--green-700)' }}>
                  {cop(grupo.saldo - Number(formAbono.monto))}
                </strong>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ── Visor de imagen ── */}
      {imgViewer && (
        <div
          onClick={() => setImgViewer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', cursor: 'zoom-out' }}>
          <img src={imgViewer} alt="comprobante"
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()} />
          <button
            onClick={() => setImgViewer(null)}
            style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={18}/>
          </button>
        </div>
      )}
    </div>
  )
}
