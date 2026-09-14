import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Droplets, FileText, HandCoins, ImageIcon, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { DuenoSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { materialApi, num, type AguaReporteMensual, type AguaViaje } from '@/api/material'
import { PagoAguaTab } from './PagoAguaApiPage'

const cop = formatCOP

// ── Helpers período ───────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodoLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}
function duenoLabel(nombre: string | null, alias: string | null): string {
  if (!nombre) return '—'
  return alias && alias !== nombre ? `${nombre} (${alias})` : nombre
}
function periodoEndDate(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Abonos — TEMPORAL en localStorage hasta que el backend tenga endpoint ──────
// El abono es por dueño (pago parcial del total). Se resta del saldo en el front.
interface AbonoAgua { id: number; id_dueno: number; fecha: string; monto: number; nota?: string; comprobante_url?: string }
const LS_ABONOS = 'molinos_abonos_agua_api_v1'
function loadAbonos(): AbonoAgua[] {
  try { const r = localStorage.getItem(LS_ABONOS); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveAbonos(d: AbonoAgua[]) { try { localStorage.setItem(LS_ABONOS, JSON.stringify(d)) } catch { /* quota */ } }

type PageTab = 'conductores' | 'registros' | 'pago-agua'

interface FormReg { id_dueno: number | ''; fecha: string; valor_viaje: string; cantidad_viajes: string; acpm: string }
const emptyReg = (): FormReg => ({ id_dueno: '', fecha: todayISO(), valor_viaje: '', cantidad_viajes: '1', acpm: '0' })

export function ViajesAguaApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  // Período seleccionado (mes)
  const currentMonth = todayISO().slice(0, 7)
  const [selMonth, setSelMonth] = useState<string>(currentMonth)
  const anio = Number(selMonth.slice(0, 4))
  const mes = Number(selMonth.slice(5, 7))

  const [tab, setTab] = useState<PageTab>('conductores')
  const [fDueno, setFDueno] = useState('')
  const [fEstadoPago, setFEstadoPago] = useState('todos')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [cardTab, setCardTab] = useState<Record<number, 'viajes' | 'abonos'>>({})

  // Reporte mensual (agrupado por dueño con arrastre de saldo)
  const [reporte, setReporte] = useState<AguaReporteMensual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Registro modal
  const [regOpen, setRegOpen] = useState(false)
  const [editReg, setEditReg] = useState<AguaViaje | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [formReg, setFormReg] = useState<FormReg>(emptyReg)
  const [savingReg, setSavingReg] = useState(false)
  // Foto del comprobante (solo al crear). Se sube al servidor como archivo.
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const setFotoFile = (file: File | null) => {
    setFotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : null })
    setFoto(file)
  }

  // Abonos (temporal en localStorage)
  const [abonos, setAbonos] = useState<AbonoAgua[]>(() => loadAbonos())
  const [abonoTarget, setAbonoTarget] = useState<number | null>(null)
  const [formAbono, setFormAbono] = useState({ fecha: todayISO(), monto: '', nota: '', comprobante_url: '' })

  const load = useCallback(() => {
    setLoading(true); setError(null)
    materialApi.getAguaReporteMensual({ mes, anio })
      .then(setReporte).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [mes, anio])
  useEffect(() => { load() }, [load])

  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const duenos = reporte?.duenos ?? []

  // Abonos aplicados al saldo del backend (saldo_fin llega con abonado=0).
  const mesStart = `${selMonth}-01`
  const mesEnd = periodoEndDate(selMonth)
  const abonoInfo = (idDueno: number) => {
    const propios = abonos.filter(a => a.id_dueno === idDueno)
    const previos = propios.filter(a => a.fecha < mesStart).reduce((s, a) => s + a.monto, 0)
    const delMes = propios.filter(a => a.fecha >= mesStart && a.fecha <= mesEnd).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const mesA = delMes.reduce((s, a) => s + a.monto, 0)
    return { previos, mesA, delMes }
  }
  /** Saldo final ajustado restando los abonos locales (previos + del mes). */
  const saldoAjustado = (idDueno: number, saldoFinBackend: number) => {
    const { previos, mesA } = abonoInfo(idDueno)
    return saldoFinBackend - previos - mesA
  }

  // KPIs del período
  const totalViajes = duenos.reduce((s, d) => s + (Number(d.resumen.total_viajes) || 0), 0)
  const totalNeto = duenos.reduce((s, d) => s + num(d.resumen.neto_mes), 0)
  const totalSaldo = duenos.reduce((s, d) => s + saldoAjustado(d.id_dueno, num(d.resumen.saldo_fin)), 0)

  // Lista plana (para "Todos los registros"), con el dueño de su grupo
  const registrosPlanos = useMemo(() => {
    const filas = duenos.flatMap(d => d.viajes.map(v => ({ ...v, dueno: d.dueno, alias: d.alias })))
    return filas.sort((a, b) => (b.fecha ?? '').slice(0, 10).localeCompare((a.fecha ?? '').slice(0, 10)))
  }, [duenos])

  // Filtro de la vista por conductor
  const conductoresFiltrados = duenos.filter(d => {
    if (fDueno && String(d.id_dueno) !== fDueno) return false
    const { previos } = abonoInfo(d.id_dueno)
    const saldo = saldoAjustado(d.id_dueno, num(d.resumen.saldo_fin))
    const arrastre = num(d.resumen.saldo_inicio) - previos // deuda no pagada de meses anteriores
    if (fEstadoPago === 'pagado' && saldo > 0.01) return false
    if (fEstadoPago === 'pendiente' && saldo <= 0.01) return false
    if (fEstadoPago === 'arrastre' && arrastre <= 0.01) return false
    return true
  })

  // ── Abonos CRUD (temporal en localStorage) ──────────────
  const abrirAbono = (idDueno: number) => { setAbonoTarget(idDueno); setFormAbono({ fecha: todayISO(), monto: '', nota: '', comprobante_url: '' }) }
  const guardarAbono = () => {
    if (abonoTarget == null || !formAbono.monto) { toast.error('Ingresa el monto del abono'); return }
    const nuevo: AbonoAgua = {
      id: Date.now(), id_dueno: abonoTarget, fecha: formAbono.fecha, monto: Number(formAbono.monto),
      nota: formAbono.nota.trim() || undefined, comprobante_url: formAbono.comprobante_url.trim() || undefined,
    }
    setAbonos(prev => { const n = [nuevo, ...prev]; saveAbonos(n); return n })
    setAbonoTarget(null)
    toast.success('Abono registrado')
  }
  const eliminarAbono = (id: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    setAbonos(prev => { const n = prev.filter(a => a.id !== id); saveAbonos(n); return n })
  }

  // ── Registros CRUD ──────────────────────────────────────
  const abrirNuevo = () => { setEditReg(null); setFormReg(emptyReg()); setFotoFile(null); setRegOpen(true) }
  const abrirEdit = async (id: number) => {
    setLoadingEdit(true)
    try {
      const v = await materialApi.getAgua(id)
      setEditReg(v)
      setFotoFile(null)
      setFormReg({
        id_dueno: v.id_dueno_volqueta ?? '', fecha: (v.fecha ?? '').slice(0, 10) || todayISO(),
        valor_viaje: String(num(v.valor_viaje)), cantidad_viajes: String(v.cantidad_viajes ?? 1), acpm: String(num(v.acpm)),
      })
      setRegOpen(true)
    } catch (e) { toast.error(apiError(e).message) } finally { setLoadingEdit(false) }
  }

  const previewNeto = (Number(formReg.valor_viaje) || 0) * (Number(formReg.cantidad_viajes) || 0) - (Number(formReg.acpm) || 0)
  // Al editar no se exige el dueño (no se cambia); al crear sí es obligatorio.
  const regValido = (editReg != null || formReg.id_dueno !== '') && Number(formReg.valor_viaje) > 0 && Number(formReg.cantidad_viajes) > 0

  const guardarReg = async () => {
    if (!regValido) { toast.error('Completa vehículo, valor y cantidad de viajes'); return }
    setSavingReg(true)
    try {
      if (editReg) {
        // No se cambia el vehículo ni el comprobante al editar.
        await materialApi.updateAgua(editReg.id, {
          fecha: formReg.fecha, valor_viaje: Number(formReg.valor_viaje),
          cantidad_viajes: Number(formReg.cantidad_viajes), acpm: Number(formReg.acpm) || 0,
        })
        toast.success('Registro actualizado')
      } else {
        // Alta con multipart: campos + foto del comprobante (el servidor genera la URL).
        const fd = new FormData()
        fd.append('id_dueno_volqueta', String(Number(formReg.id_dueno)))
        fd.append('fecha', formReg.fecha)
        fd.append('valor_viaje', String(Number(formReg.valor_viaje)))
        fd.append('cantidad_viajes', String(Number(formReg.cantidad_viajes)))
        fd.append('acpm', String(Number(formReg.acpm) || 0))
        if (foto) fd.append('comprobante', foto)
        await materialApi.createAgua(fd)
        toast.success('Viaje de agua registrado')
      }
      setRegOpen(false); setEditReg(null); setFotoFile(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingReg(false) }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader
        title="Viajes de agua"
        subtitle={`${periodoLabel(selMonth)} · ${duenos.length} conductores · ${totalViajes} viajes · Neto: ${cop(totalNeto)}`}
        actions={canWrite && <Button icon={<Plus size={18} />} onClick={abrirNuevo}>Registrar viaje</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Conductores"     value={duenos.length} icon={<Droplets size={16} />} accent="emerald" />
        <KpiTile label="Viajes totales"  value={totalViajes}                                  accent="green" />
        <KpiTile label="Neto acumulado"  value={cop(totalNeto)}                               accent="brown" />
        <KpiTile label="Saldo pendiente" value={cop(totalSaldo)}                              accent="rose" />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'conductores'}
          className={`segment__btn ${tab === 'conductores' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('conductores')}>Por conductor</button>
        <button role="tab" aria-selected={tab === 'registros'}
          className={`segment__btn ${tab === 'registros' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('registros')}>Todos los registros</button>
        <button role="tab" aria-selected={tab === 'pago-agua'}
          className={`segment__btn ${tab === 'pago-agua' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('pago-agua')}>Pago de agua</button>
      </div>

      {/* Navegador de mes + filtros (compartido por "Por conductor" y "Todos los registros"; Pago de agua tiene su propio filtro de mes por dueño) */}
      {tab !== 'pago-agua' && (
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
          {periodoLabel(selMonth)}{selMonth === currentMonth && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Mes actual</span>}
        </span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer', color: 'var(--text)' }}>
            <ChevronLeft size={18} />
          </button>
          <input className="field__input" type="month" value={selMonth} max={currentMonth} onChange={e => { if (e.target.value) setSelMonth(e.target.value) }} style={{ maxWidth: '10rem' }} />
          <button type="button" onClick={() => shiftMonth(1)} disabled={selMonth >= currentMonth} title="Mes siguiente"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: selMonth >= currentMonth ? 'not-allowed' : 'pointer', color: selMonth >= currentMonth ? 'var(--text-faint)' : 'var(--text)' }}>
            <ChevronRight size={18} />
          </button>
          {selMonth !== currentMonth && <button type="button" onClick={() => setSelMonth(currentMonth)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline' }}>Hoy</button>}
        </div>
        {tab === 'conductores' && (
          <>
            <div style={{ width: 1, height: 30, background: '#e5e7eb' }} />
            <select className="field__input" style={{ minWidth: '11rem' }} value={fDueno} onChange={e => setFDueno(e.target.value)}>
              <option value="">Todos los conductores</option>
              {duenos.map(d => <option key={d.id_dueno} value={String(d.id_dueno)}>{duenoLabel(d.dueno, d.alias)}</option>)}
            </select>
            <div className="segment">
              {([['todos', 'Todos'], ['pendiente', 'Por pagar'], ['pagado', 'Pagado'], ['arrastre', 'Con arrastre']] as [string, string][]).map(([k, l]) => (
                <button key={k} className={`segment__btn ${fEstadoPago === k ? 'segment__btn--active' : ''}`} onClick={() => setFEstadoPago(k)}>{l}</button>
              ))}
            </div>
          </>
        )}
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
      </div>
      )}

      {/* ── Tab: Pago de agua (cuentas reales por dueño, abonos en cascada) ── */}
      {tab === 'pago-agua' && <PagoAguaTab />}

      {/* ── Tab: Por conductor (mensual, estilo Mulas) ── */}
      {tab === 'conductores' && (
        loading ? (
          <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
        ) : error ? (
          <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
            {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
          </p></Card>
        ) : conductoresFiltrados.length === 0 ? (
          <Card title={periodoLabel(selMonth)}>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin actividad en {periodoLabel(selMonth)}.</p>
          </Card>
        ) : conductoresFiltrados.map(d => {
          const rs = d.resumen
          const { previos, mesA, delMes } = abonoInfo(d.id_dueno)
          const saldoInicio = num(rs.saldo_inicio) - previos
          const neto = num(rs.neto_mes)
          const abonado = mesA
          const saldo = saldoInicio + neto - abonado
          const isOpen = expanded.has(d.id_dueno)
          const semaforo = saldo <= 0.01 ? '#16a34a' : abonado === 0 ? '#dc2626' : '#f59e0b'
          const pct = neto > 0 ? Math.min(abonado / neto, 1) : (abonado > 0 ? 1 : 0)
          return (
            <div key={d.id_dueno} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera colapsada */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
                onClick={() => toggleExpand(d.id_dueno)}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={saldo <= 0.01 ? 'Pagado' : abonado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{duenoLabel(d.dueno, d.alias)}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{rs.total_viajes} viajes</span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                  {saldoInicio > 0.01 && (
                    <span className="badge badge--warning" title="Deuda arrastrada de meses anteriores, aún sin pagar" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> Arrastra {cop(saldoInicio)}
                    </span>
                  )}
                  {saldoInicio < -0.01 && <span style={{ color: '#15803d' }}>A favor <strong>{cop(Math.abs(saldoInicio))}</strong></span>}
                  <span>Neto mes <strong>{cop(neto)}</strong></span>
                  <span style={{ color: '#15803d' }}>Abonado <strong>{cop(abonado)}</strong></span>
                  <div style={{ minWidth: 110 }}>
                    <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: saldo > 0 ? '#b45309' : saldo < 0 ? '#15803d' : 'var(--text-muted)', minWidth: 96, textAlign: 'right' }} className="mono">
                    {saldo === 0 ? 'Saldado' : cop(Math.abs(saldo))}
                    <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{saldo > 0 ? 'por pagar' : saldo < 0 ? 'a favor' : ''}</div>
                  </span>
                  {canWrite && (
                    <span onClick={e => e.stopPropagation()}>
                      <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(d.id_dueno)}>Abonar</Button>
                    </span>
                  )}
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </div>

              {isOpen && (() => {
                const ct = cardTab[d.id_dueno] ?? 'viajes'
                return (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                  {/* Toggle Viajes / Abonos (como en la mock) */}
                  <div className="segment" style={{ marginBottom: '0.75rem' }}>
                    {(['viajes', 'abonos'] as const).map(k => (
                      <button key={k} className={`segment__btn ${ct === k ? 'segment__btn--active' : ''}`}
                        onClick={() => setCardTab(s => ({ ...s, [d.id_dueno]: k }))}>
                        {k === 'viajes' ? `Viajes del período (${d.viajes.length})` : `Abonos (${delMes.length})`}
                      </button>
                    ))}
                  </div>

                  {ct === 'viajes' ? (
                    d.viajes.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin viajes.</em> : (
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
                          {d.viajes.map(v => {
                            const acpm = num(v.acpm)
                            return (
                              <tr key={v.id} style={acpm > 0 ? { background: 'var(--amber-50)' } : undefined}>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(v.fecha)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{v.cantidad_viajes}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.valor_viaje))}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.bruto))}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{acpm > 0 ? <span style={{ color: 'var(--amber-700)' }}>- {cop(acpm)}</span> : '—'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(v.neto))}</td>
                                {canWrite && (
                                  <td><Button variant="secondary" size="sm" icon={<Pencil size={12} />} disabled={loadingEdit} onClick={() => abrirEdit(v.id)} /></td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td>Total</td>
                            <td style={{ textAlign: 'right' }} className="mono">{rs.total_viajes}</td>
                            <td />
                            <td style={{ textAlign: 'right' }} className="mono">{cop(num(rs.bruto))}</td>
                            <td style={{ textAlign: 'right' }} className="mono">- {cop(num(rs.acpm))}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(neto)}</td>
                            {canWrite && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    )
                  ) : (
                    delMes.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos.</em> : (
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                        <thead><tr>
                          <th>Fecha</th>
                          <th style={{ textAlign: 'right' }}>Monto</th>
                          <th>Nota</th>
                          <th style={{ textAlign: 'center' }}>Comp.</th>
                          {canWrite && <th></th>}
                        </tr></thead>
                        <tbody>
                          {delMes.map(a => (
                            <tr key={a.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">{cop(a.monto)}</td>
                              <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{a.nota || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{a.comprobante_url
                                ? <Button variant="ghost" size="sm" icon={<FileText size={13} />} title="Abrir comprobante" onClick={() => window.open(a.comprobante_url!, '_blank', 'noopener,noreferrer')} />
                                : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                              {canWrite && <td><Button variant="ghost" size="sm" icon={<Trash2 size={13} />} title="Eliminar abono" onClick={() => eliminarAbono(a.id)} /></td>}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td>Total abonado</td>
                            <td style={{ textAlign: 'right', color: 'var(--green-700)' }} className="mono">{cop(abonado)}</td>
                            <td colSpan={canWrite ? 3 : 2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    )
                  )}

                  {/* Resumen del mes (arrastre) */}
                  <div className="callout" style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-sm)' }}>
                    {saldoInicio !== 0 && <span style={saldoInicio > 0 ? { color: 'var(--rose-700)', fontWeight: 700 } : undefined}>Saldo inicio: <strong>{cop(Math.abs(saldoInicio))}</strong> {saldoInicio > 0 ? '(arrastrado de meses anteriores)' : '(a favor)'}</span>}
                    <span>+ Neto mes: <strong style={{ color: 'var(--green-700)' }}>{cop(neto)}</strong></span>
                    {abonado > 0 && <span>− Abonado: <strong>{cop(abonado)}</strong></span>}
                    <span style={{ fontWeight: 800, color: saldo > 0 ? 'var(--rose-700)' : 'var(--text-muted)' }}>= Saldo fin: {cop(saldo)}</span>
                    {canWrite && <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(d.id_dueno)} style={{ marginLeft: 'auto' }}>Registrar abono</Button>}
                  </div>
                </div>
                )
              })()}
            </div>
          )
        })
      )}

      {/* ── Tab: Todos los registros ── */}
      {tab === 'registros' && (
        <Card title={`Todos los registros — ${periodoLabel(selMonth)} (${registrosPlanos.length})`}>
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
                {loading ? (
                  <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando…</td></tr>
                ) : error ? (
                  <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem' }}>{error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button></td></tr>
                ) : registrosPlanos.length === 0 ? (
                  <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
                ) : registrosPlanos.map(v => {
                  const acpm = num(v.acpm)
                  return (
                    <tr key={v.id} style={acpm > 0 ? { background: 'var(--amber-50)' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{duenoLabel(v.dueno, v.alias)}</td>
                      <td>{formatDate(v.fecha)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{v.cantidad_viajes}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.valor_viaje))}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.bruto))}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{acpm > 0 ? <span style={{ color: 'var(--amber-700)' }}>- {cop(acpm)}</span> : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(v.neto))}</td>
                      {canWrite && (
                        <td><Button variant="secondary" size="sm" icon={<Pencil size={13} />} disabled={loadingEdit} onClick={() => abrirEdit(v.id)} /></td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {!loading && !error && registrosPlanos.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4}>Total</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(registrosPlanos.reduce((s, v) => s + num(v.bruto), 0))}</td>
                    <td style={{ textAlign: 'right' }} className="mono">- {cop(registrosPlanos.reduce((s, v) => s + num(v.acpm), 0))}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(totalNeto)}</td>
                    {canWrite && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* ── Modal: Registrar / Editar viaje ── */}
      <Modal open={regOpen} title={editReg ? 'Editar registro de agua' : 'Registrar viaje de agua'}
        onClose={() => { setRegOpen(false); setEditReg(null); setFotoFile(null) }}
        footer={<>
          <Button variant="secondary" onClick={() => { setRegOpen(false); setEditReg(null); setFotoFile(null) }}>Cancelar</Button>
          <Button onClick={guardarReg} disabled={savingReg || !regValido}>{savingReg ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="grid grid--form">
          <DuenoSelect label="Dueño / Transportador" required disabled={!!editReg}
            value={formReg.id_dueno} onChange={v => setFormReg(f => ({ ...f, id_dueno: v }))} />
          <Input label="Fecha" type="date" required value={formReg.fecha} onChange={e => setFormReg(f => ({ ...f, fecha: e.target.value }))} />
          <Input label="Valor por viaje" type="number" mono placeholder="130000" required
            value={formReg.valor_viaje} onChange={e => setFormReg(f => ({ ...f, valor_viaje: e.target.value }))} />
          <Input label="Cantidad de viajes" type="number" mono min="1" required
            value={formReg.cantidad_viajes} onChange={e => setFormReg(f => ({ ...f, cantidad_viajes: e.target.value }))} />
          <Input label="Adelanto ACPM" type="number" mono placeholder="0"
            value={formReg.acpm} onChange={e => setFormReg(f => ({ ...f, acpm: e.target.value }))} helper="Dejar en 0 si no aplica" />
          {!editReg && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Comprobante (foto)</label>
              {fotoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={fotoPreview} alt="comprobante" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                  <button type="button" onClick={() => setFotoFile(null)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  <ImageIcon size={15} /> Adjuntar foto
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => setFotoFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              <span className="field__helper">La foto se sube al servidor; el enlace se genera allí (opcional).</span>
            </div>
          )}
        </div>
        {Number(formReg.valor_viaje) > 0 && Number(formReg.cantidad_viajes) > 0 && (
          <div className="callout" style={{ marginTop: '1rem' }}>
            <Droplets size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            {cop(Number(formReg.valor_viaje))} × {formReg.cantidad_viajes}
            {Number(formReg.acpm) > 0 ? ` − ${cop(Number(formReg.acpm))} ACPM` : ''} = <strong>{cop(previewNeto)}</strong>
          </div>
        )}
      </Modal>

      {/* ── Modal: Registrar abono (temporal en localStorage) ── */}
      {(() => {
        const dTarget = abonoTarget != null ? duenos.find(d => d.id_dueno === abonoTarget) : undefined
        const saldoActual = dTarget ? saldoAjustado(dTarget.id_dueno, num(dTarget.resumen.saldo_fin)) : 0
        const montoNum = Number(formAbono.monto) || 0
        return (
          <Modal open={abonoTarget != null} title={`Registrar abono — ${dTarget ? duenoLabel(dTarget.dueno, dTarget.alias) : ''}`}
            onClose={() => setAbonoTarget(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
              <Button onClick={guardarAbono} disabled={!formAbono.monto}>Registrar abono</Button>
            </>}>
            {dTarget && (
              <div className="callout" style={{ marginBottom: '1rem' }}>
                Neto del mes: <strong>{cop(num(dTarget.resumen.neto_mes))}</strong>
                {' · '}<span style={{ fontWeight: 700, color: 'var(--rose-700)' }}>Saldo pendiente: {cop(saldoActual)}</span>
              </div>
            )}
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={formAbono.fecha} onChange={e => setFormAbono(f => ({ ...f, fecha: e.target.value }))} />
              <Input label="Monto abonado (COP)" type="number" mono step="1000" required placeholder="1700000"
                value={formAbono.monto} onChange={e => setFormAbono(f => ({ ...f, monto: e.target.value }))} helper="Puede ser parcial o de más." />
              <Input label="Nota (opcional)" placeholder="Transferencia Nequi…"
                value={formAbono.nota} onChange={e => setFormAbono(f => ({ ...f, nota: e.target.value }))} />
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label">Comprobante (imagen o PDF)</label>
                {formAbono.comprobante_url ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: 'var(--fs-sm)' }}>
                    <FileText size={15} />
                    <span className="mono">{formAbono.comprobante_url.split('/').pop()}</span>
                    <button type="button" onClick={() => setFormAbono(f => ({ ...f, comprobante_url: '' }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    <ImageIcon size={15} /> Adjuntar comprobante
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                      onChange={e => { const file = e.target.files?.[0]; if (file) setFormAbono(f => ({ ...f, comprobante_url: `http://localhost/${file.name}` })) }} />
                  </label>
                )}
                <span className="field__helper">Se sube desde tu dispositivo; por ahora se guarda la URL local (temporal).</span>
              </div>
            </div>
            {montoNum > 0 && dTarget && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                Saldo tras el abono: <strong style={{ color: (saldoActual - montoNum) > 0 ? 'var(--rose-700)' : 'var(--green-700)' }}>{cop(saldoActual - montoNum)}</strong>
                {saldoActual - montoNum < 0 && <span style={{ color: 'var(--green-700)' }}> (queda a favor)</span>}
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Los abonos se guardan localmente por ahora (temporal). Se migrarán al backend cuando exista el endpoint de abonos.
            </p>
          </Modal>
        )
      })()}
    </div>
  )
}
