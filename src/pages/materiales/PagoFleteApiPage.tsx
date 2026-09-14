import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronRight, FileText, HandCoins,
  Pencil, RefreshCw, Trash2,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { DuenoSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  pagosFleteApi,
  type DuenoFleteResumen, type FleteDuenoDetalle, type FleteCuentaMes, type FleteViajePago,
  type AbonoPagoFlete, type MetodoPagoFlete, type HistorialFleteResponse,
} from '@/api/pagosFlete'

const cop = formatCOP

const METODO_OPTS: { value: MetodoPagoFlete; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi',         label: 'Nequi' },
  { value: 'deposito',      label: 'Depósito' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'otro',          label: 'Otro' },
]
const METODO_LABEL = (m: string | null | undefined) => METODO_OPTS.find(o => o.value === m)?.label ?? (m ?? '—')
const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',       cls: 'badge--success' },
  parcial:   { label: 'Pago parcial', cls: 'badge--info'    },
  pendiente: { label: 'Pendiente',    cls: 'badge--warning' },
  anulado:   { label: 'Anulado',      cls: 'badge--neutral' },
}

// ── Accesores tolerantes al shape del backend ─────────────────────────────────
const duenoLabel = (d: DuenoFleteResumen) => (d.alias && d.alias !== d.nombre ? `${d.nombre} (${d.alias})` : d.nombre)
const duenoSaldo = (d: DuenoFleteResumen) => num(d.flete_neto_total) - num(d.abonado)
const viajeSaldo = (v: FleteViajePago) => (v.saldo_flete != null ? num(v.saldo_flete) : num(v.flete_neto) - num(v.pagado_flete))

interface AbonoForm { valor: string; fecha_abono: string; metodo_pago: MetodoPagoFlete; comprobante_url: string; observaciones: string }
const emptyAbono = (valor = ''): AbonoForm => ({ valor, fecha_abono: todayISO(), metodo_pago: 'transferencia', comprobante_url: '', observaciones: '' })

type PageTab = 'dashboard' | 'historial'

export function PagoFleteTab() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [tab, setTab] = useState<PageTab>('dashboard')

  // ── Dashboard ────────────────────────────────────────────────
  const [duenos, setDuenos] = useState<DuenoFleteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosFleteApi.getDashboard()
      .then(rows => setDuenos(Array.isArray(rows) ? rows : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // ── Detalle por dueño (expand) ──────────────────────────────
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [detalles, setDetalles] = useState<Record<number, FleteDuenoDetalle>>({})
  const [detLoading, setDetLoading] = useState<Set<number>>(new Set())
  const [mesFiltro, setMesFiltro] = useState<Record<number, string>>({}) // "YYYY-MM" o '' = todos

  const reloadDetalle = useCallback(async (id: number) => {
    const ym = mesFiltro[id]
    const [anio, mes] = ym ? ym.split('-').map(Number) : [undefined, undefined]
    try {
      const det = await pagosFleteApi.getDuenoDetalle(id, { mes, anio })
      setDetalles(prev => ({ ...prev, [id]: det }))
    } catch (e) { toast.error(apiError(e).message) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFiltro, toast])

  const toggleExpand = async (id: number) => {
    const isOpen = expanded.has(id)
    setExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(id) : n.add(id); return n })
    if (!isOpen) {
      setDetLoading(prev => new Set(prev).add(id))
      await reloadDetalle(id)
      setDetLoading(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const cambiarMesFiltro = async (id: number, ym: string) => {
    setMesFiltro(prev => ({ ...prev, [id]: ym }))
    setDetLoading(prev => new Set(prev).add(id))
    const [anio, mes] = ym ? ym.split('-').map(Number) : [undefined, undefined]
    try {
      const det = await pagosFleteApi.getDuenoDetalle(id, { mes, anio })
      setDetalles(prev => ({ ...prev, [id]: det }))
    } catch (e) { toast.error(apiError(e).message) }
    finally { setDetLoading(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  // ── KPIs ────────────────────────────────────────────────────
  const conSaldo = duenos.filter(d => duenoSaldo(d) > 0.01).length
  const totalPorPagar = duenos.reduce((s, d) => s + Math.max(0, duenoSaldo(d)), 0)
  const totalAbonado = duenos.reduce((s, d) => s + num(d.abonado), 0)
  const totalCreditos = duenos.reduce((s, d) => s + num(d.credito_gasolina) + num(d.credito_sobrepago), 0)

  // ── Abono (crear) ────────────────────────────────────────────
  const [abonoDueno, setAbonoDueno] = useState<DuenoFleteResumen | null>(null)
  const [abonoForm, setAbonoForm] = useState<AbonoForm>(emptyAbono())
  const [savingAbono, setSavingAbono] = useState(false)

  const abrirAbono = (d: DuenoFleteResumen) => {
    const saldo = duenoSaldo(d)
    setAbonoDueno(d)
    setAbonoForm(emptyAbono(saldo > 0 ? String(Math.round(saldo)) : ''))
  }

  const guardarAbono = async () => {
    if (!abonoDueno) return
    const valor = Number(abonoForm.valor)
    if (!(valor > 0)) { toast.error('El valor del abono debe ser mayor a 0'); return }
    setSavingAbono(true)
    try {
      const res = await pagosFleteApi.crearAbono(abonoDueno.id, {
        valor, fecha_abono: abonoForm.fecha_abono, metodo_pago: abonoForm.metodo_pago,
        comprobante_url: abonoForm.comprobante_url.trim() || undefined,
        observaciones: abonoForm.observaciones.trim() || undefined,
      })
      const nMeses = res.aplicado_a?.length ?? 0
      const aFavor = num(res.saldo_a_favor_generado)
      toast.success(`Abono aplicado a ${nMeses} cuenta${nMeses === 1 ? '' : 's'} por ${cop(num(res.total_aplicado) || valor)}${aFavor > 0 ? ` · ${cop(aFavor)} quedó a favor` : ''}`)
      const id = abonoDueno.id
      setAbonoDueno(null)
      if (expanded.has(id)) await reloadDetalle(id)
      load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingAbono(false) }
  }

  // ── Abono (editar/eliminar) ──────────────────────────────────
  const [editAbono, setEditAbono] = useState<{ idDueno: number; abono: AbonoPagoFlete } | null>(null)
  const [editForm, setEditForm] = useState<AbonoForm>(emptyAbono())
  const [savingEdit, setSavingEdit] = useState(false)

  const abrirEditAbono = (idDueno: number, a: AbonoPagoFlete) => {
    setEditAbono({ idDueno, abono: a })
    setEditForm({
      valor: String(num(a.valor)), fecha_abono: (a.fecha_abono ?? todayISO()).slice(0, 10),
      metodo_pago: (a.metodo_pago as MetodoPagoFlete) || 'transferencia',
      comprobante_url: a.comprobante_url ?? '', observaciones: a.observaciones ?? '',
    })
  }
  const guardarEditAbono = async () => {
    if (!editAbono) return
    const valor = Number(editForm.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingEdit(true)
    try {
      await pagosFleteApi.editarAbono(editAbono.abono.id, {
        valor, fecha_abono: editForm.fecha_abono, metodo_pago: editForm.metodo_pago,
        comprobante_url: editForm.comprobante_url.trim() || undefined,
        observaciones: editForm.observaciones.trim() || undefined,
      })
      toast.success('Abono actualizado')
      const id = editAbono.idDueno
      setEditAbono(null)
      await reloadDetalle(id); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingEdit(false) }
  }
  const eliminarAbono = async (idDueno: number, idAbono: number) => {
    if (!confirm('¿Eliminar este abono? La cuenta volverá a parcial/pendiente.')) return
    try {
      await pagosFleteApi.eliminarAbono(idAbono)
      toast.success('Abono eliminado')
      await reloadDetalle(idDueno); load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Con saldo pendiente" value={conSaldo} accent="rose" icon={<AlertCircle size={16} />} />
        <KpiTile label="Total por pagar"     value={cop(totalPorPagar)} accent="amber" />
        <KpiTile label="Total abonado"       value={cop(totalAbonado)}  accent="green" />
        <KpiTile label="Créditos (gasolina + sobrepago)" value={cop(totalCreditos)} accent="brown" />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'dashboard'}
          className={`segment__btn ${tab === 'dashboard' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('dashboard')}>Dashboard</button>
        <button role="tab" aria-selected={tab === 'historial'}
          className={`segment__btn ${tab === 'historial' ? 'segment__btn--active' : ''}`}
          onClick={() => setTab('historial')}>Historial de abonos</button>
      </div>

      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
          </div>

          {loading ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
          ) : error ? (
            <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
              {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
            </p></Card>
          ) : duenos.length === 0 ? (
            <Card title="Sin pendientes"><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              No hay dueños con saldo pendiente ni créditos de flete.
            </p></Card>
          ) : duenos.map(d => {
            const saldo = duenoSaldo(d), pagado = num(d.abonado), valor = num(d.flete_neto_total)
            const isOpen = expanded.has(d.id)
            const det = detalles[d.id]
            const semaforo = saldo <= 0.01 ? '#16a34a' : pagado === 0 ? '#dc2626' : '#f59e0b'
            const pct = valor > 0 ? Math.min(pagado / valor, 1) : (pagado > 0 ? 1 : 0)
            const credGas = num(d.credito_gasolina), credSobre = num(d.credito_sobrepago)
            return (
              <div key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
                  onClick={() => toggleExpand(d.id)}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={saldo <= 0.01 ? 'Pagado' : pagado === 0 ? 'Sin abonos' : 'Abono parcial'} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{duenoLabel(d)}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{d.banco ?? '—'}</span>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                    {credGas > 0 && <span className="badge badge--info" title="Crédito de gasolina: ACPM adelantado que superó la deuda">Créd. gasolina {cop(credGas)}</span>}
                    {credSobre > 0 && <span className="badge badge--success" title="Sobrepago del dueño: crédito a favor">A favor {cop(credSobre)}</span>}
                    <span>Neto <strong>{cop(valor)}</strong></span>
                    <span style={{ color: '#15803d' }}>Abonado <strong>{cop(pagado)}</strong></span>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: saldo > 0.01 ? '#b45309' : '#15803d', minWidth: 96, textAlign: 'right' }} className="mono">
                      {saldo <= 0.01 ? 'Al día' : cop(saldo)}
                      <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{saldo > 0.01 ? 'por pagar' : ''}</div>
                    </span>
                    {canWrite && saldo > 0.01 && (
                      <span onClick={e => e.stopPropagation()}>
                        <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(d)}>Abonar</Button>
                      </span>
                    )}
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtrar mes</span>
                      <input className="field__input" type="month" value={mesFiltro[d.id] ?? ''} onChange={e => cambiarMesFiltro(d.id, e.target.value)} style={{ maxWidth: '10rem' }} />
                      {mesFiltro[d.id] && <button type="button" onClick={() => cambiarMesFiltro(d.id, '')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', textDecoration: 'underline' }}>Ver todos</button>}
                      {canWrite && (
                        <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(d)} style={{ marginLeft: 'auto' }}>Registrar abono</Button>
                      )}
                    </div>

                    {detLoading.has(d.id) || !det ? (
                      <p style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>Cargando detalle…</p>
                    ) : (det.meses ?? []).length === 0 ? (
                      <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin actividad en el período.</em>
                    ) : det.meses.map(mesData => <MesCard key={mesData.id_cuenta} mesData={mesData} idDueno={d.id} canWrite={canWrite}
                      onEditAbono={abrirEditAbono} onEliminarAbono={eliminarAbono} />)}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === 'historial' && <HistorialFlete />}

      {/* ── Modal: nuevo abono ── */}
      <Modal open={abonoDueno != null} title={`Registrar abono — ${abonoDueno ? duenoLabel(abonoDueno) : ''}`}
        onClose={() => setAbonoDueno(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAbonoDueno(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarAbono} disabled={savingAbono || !(Number(abonoForm.valor) > 0)}>
            {savingAbono ? 'Guardando…' : 'Registrar abono'}
          </Button>
        </>}>
        {abonoDueno && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente: <strong style={{ color: 'var(--rose-700)' }}>{cop(Math.max(0, duenoSaldo(abonoDueno)))}</strong>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              El abono se aplica en cascada, empezando por el mes más antiguo con deuda.
            </div>
          </div>
        )}
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required placeholder="500000"
            value={abonoForm.valor} onChange={e => setAbonoForm(f => ({ ...f, valor: e.target.value }))}
            helper="Puede ser mayor al saldo; el excedente queda como crédito a favor." />
          <Input label="Fecha del abono" type="date" required
            value={abonoForm.fecha_abono} onChange={e => setAbonoForm(f => ({ ...f, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={abonoForm.metodo_pago} onChange={e => setAbonoForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPagoFlete }))} />
          <Input label="Comprobante (URL, opcional)" placeholder="https://…/comprobante.png"
            value={abonoForm.comprobante_url} onChange={e => setAbonoForm(f => ({ ...f, comprobante_url: e.target.value }))} />
          <Input label="Observaciones (opcional)" placeholder="Abono parcial"
            value={abonoForm.observaciones} onChange={e => setAbonoForm(f => ({ ...f, observaciones: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: editar abono ── */}
      <Modal open={editAbono != null} title="Editar abono" onClose={() => setEditAbono(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditAbono(null)}>Cancelar</Button>
          <Button onClick={guardarEditAbono} disabled={savingEdit || !(Number(editForm.valor) > 0)}>{savingEdit ? 'Guardando…' : 'Guardar cambios'}</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required
            value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} />
          <Input label="Fecha del abono" type="date" required
            value={editForm.fecha_abono} onChange={e => setEditForm(f => ({ ...f, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={editForm.metodo_pago} onChange={e => setEditForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPagoFlete }))} />
          <Input label="Comprobante (URL)" value={editForm.comprobante_url}
            onChange={e => setEditForm(f => ({ ...f, comprobante_url: e.target.value }))} />
          <Input label="Observaciones" value={editForm.observaciones}
            onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}

// ── Card de un mes dentro del detalle de un dueño ──────────────────────────────
function MesCard({ mesData, idDueno, canWrite, onEditAbono, onEliminarAbono }: {
  mesData: FleteCuentaMes
  idDueno: number
  canWrite: boolean
  onEditAbono: (idDueno: number, a: AbonoPagoFlete) => void
  onEliminarAbono: (idDueno: number, idAbono: number) => void
}) {
  const valor = num(mesData.valor_total)
  const pagado = mesData.pagado != null ? num(mesData.pagado) : (mesData.abonos ?? []).reduce((s, a) => s + num(a.valor), 0)
  const saldo = Math.max(0, valor - pagado)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', background: '#fff', padding: '0.75rem 0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <strong>{mesData.concepto || mesData.periodo}</strong>
        <span className={`badge ${ESTADO_BADGE[mesData.estado]?.cls ?? 'badge--neutral'}`}>{ESTADO_BADGE[mesData.estado]?.label ?? mesData.estado}</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', display: 'flex', gap: '1rem' }}>
          <span>Valor <strong>{cop(valor)}</strong></span>
          <span style={{ color: '#15803d' }}>Pagado <strong>{cop(pagado)}</strong></span>
          <span style={{ color: saldo > 0.01 ? '#b45309' : '#15803d', fontWeight: 700 }}>{saldo > 0.01 ? `Saldo ${cop(saldo)}` : 'Al día'}</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Viajes ({mesData.viajes?.length ?? 0})
          </div>
          {(mesData.viajes?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin viajes.</em> : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                <thead><tr><th>Fecha</th><th>N.° / Placa</th><th style={{ textAlign: 'right' }}>Bruto</th><th style={{ textAlign: 'right' }}>ACPM</th><th style={{ textAlign: 'right' }}>Neto</th><th style={{ textAlign: 'right' }}>Saldo</th></tr></thead>
                <tbody>
                  {mesData.viajes.map(v => (
                    <tr key={v.id_entrada}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(v.fecha_llegada)}</td>
                      <td style={{ fontWeight: 600 }}>#{v.numero_volqueta ?? '—'}{v.placa ? ` · ${v.placa}` : ''}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(num(v.flete_bruto))}</td>
                      <td style={{ textAlign: 'right', color: '#b45309' }} className="mono">{num(v.acpm) > 0 ? cop(num(v.acpm)) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(v.flete_neto))}</td>
                      <td style={{ textAlign: 'right', color: viajeSaldo(v) > 0.01 ? '#b45309' : '#15803d' }} className="mono">{viajeSaldo(v) > 0.01 ? cop(viajeSaldo(v)) : 'Al día'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Abonos ({mesData.abonos?.length ?? 0})
          </div>
          {(mesData.abonos?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin abonos.</em> : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                <thead><tr><th>Fecha</th><th>Método</th><th style={{ textAlign: 'right' }}>Valor</th>{canWrite && <th></th>}</tr></thead>
                <tbody>
                  {mesData.abonos.map(a => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                      <td>{METODO_LABEL(a.metodo_pago)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                      {canWrite && (
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {a.comprobante_url && <Button variant="ghost" size="sm" icon={<FileText size={12} />} title="Ver comprobante" onClick={() => window.open(a.comprobante_url!, '_blank', 'noopener,noreferrer')} />}
                            <Button variant="ghost" size="sm" icon={<Pencil size={12} />} title="Editar" onClick={() => onEditAbono(idDueno, a)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} title="Eliminar" onClick={() => onEliminarAbono(idDueno, a.id)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Historial de abonos (reporte plano paginado) ───────────────────────────────
function HistorialFlete() {
  const toast = useToast()
  const [fDueno, setFDueno] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistorialFleteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosFleteApi.getHistorial({ id_dueno_volqueta: fDueno === '' ? undefined : fDueno, page, limit: 50 })
      .then(setData)
      .catch(e => { setError(apiError(e).message); toast.error(apiError(e).message) })
      .finally(() => setLoading(false))
  }, [fDueno, page, toast])
  useEffect(() => { load() }, [load])

  const totalPages = data?.pagination.total_pages ?? 1

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <div style={{ minWidth: '13rem' }}>
          <DuenoSelect label="Dueño" value={fDueno} onChange={v => { setFDueno(v); setPage(1) }} placeholder="Todos los dueños" />
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} style={{ marginLeft: 'auto' }}>Refrescar</Button>
      </div>

      {loading ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
      ) : error ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>{error}</p></Card>
      ) : (
        <Card title={`Abonos (${data?.pagination.total ?? 0})`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Fecha</th><th>Dueño</th><th>Concepto</th><th>Método</th>
                <th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'center' }}>Comp.</th>
              </tr></thead>
              <tbody>
                {(data?.abonos.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin abonos</td></tr>
                ) : data!.abonos.map(a => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                    <td style={{ fontWeight: 600 }}>{a.dueno_volqueta ?? '—'}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{a.concepto ?? '—'}</td>
                    <td>{METODO_LABEL(a.metodo_pago)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                    <td style={{ textAlign: 'center' }}>{a.comprobante_url
                      ? <Button variant="ghost" size="sm" icon={<FileText size={13} />} onClick={() => window.open(a.comprobante_url!, '_blank', 'noopener,noreferrer')} />
                      : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Página {page} de {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
