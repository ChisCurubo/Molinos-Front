import { Fragment, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Banknote, ChevronDown, ChevronUp, FlaskConical, ImageIcon, Pencil, Trash2,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { useCanWrite } from '@/hooks/usePermissions'
import { cop, formatDate, todayISO } from '@/utils/format'
import { calcValorMaterial, precioAplicable, pesoSeco } from '@/utils/material'
import {
  loadAbonosMinero, saveAbonosMinero, montoPagadoPorMaterial, desglosePorAbono,
  type AbonoMinero, type EstadoPago,
} from '@/data/materialPagos'
import { useMateriales } from '@/context/MaterialesContext'
import type { MaterialRow } from '@/data/mock'

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

const TIPO_LABELS: Record<AbonoMinero['tipo'], string> = {
  transferencia: 'Transferencia', deposito: 'Depósito', efectivo: 'Efectivo', otro: 'Otro',
}
const TIPO_OPTS = Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))

const ESTADO_BADGE: Record<EstadoPago, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',       cls: 'badge--success' },
  parcial:   { label: 'Pago parcial', cls: 'badge--info'    },
  pendiente: { label: 'Pendiente',    cls: 'badge--warning' },
}

function precioLabel(m: MaterialRow): string {
  const p = precioAplicable(m)
  if (!p) return '—'
  return p.metodo === 'por_tonelada' ? `${cop(p.precio_por_tonelada ?? 0)}/t` : `${cop(p.precio_por_gramo ?? 0)}/g`
}

export function PagosMaterialPanel() {
  const canWrite = useCanWrite('materiales')
  const { materiales, analisis } = useMateriales()

  const [abonos, setAbonosState] = useState<AbonoMinero[]>(loadAbonosMinero)
  const setAbonos = (fn: (prev: AbonoMinero[]) => AbonoMinero[]) =>
    setAbonosState(prev => { const next = fn(prev); saveAbonosMinero(next); return next })

  const [fMinero, setFMinero]     = useState('')
  const [openCards, setOpenCards] = useState<Set<string>>(new Set())
  const [cardTab, setCardTab]     = useState<Record<string, 'materiales' | 'abonos'>>({})
  const [openMat, setOpenMat]     = useState<Set<number>>(new Set())
  const [openAbonoRows, setOpenAbonoRows] = useState<Set<number>>(new Set())
  const [selected, setSelected]   = useState<Set<number>>(new Set())

  // Abono modal
  const [abonoModal, setAbonoModal]   = useState(false)
  const [abonoTarget, setAbonoTarget] = useState<string | null>(null)
  const [abonoIds, setAbonoIds]       = useState<number[]>([])
  const [editando, setEditando]       = useState<AbonoMinero | null>(null)
  const [imgPreview, setImgPreview]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ fecha: todayISO(), monto: '', tipo: 'transferencia' as AbonoMinero['tipo'], nota: '', comprobante_img: '' })
  const f = (k: keyof typeof form, v: string) => setForm(s => ({ ...s, [k]: v }))

  const getValor = calcValorMaterial
  const getCabeza = (m: MaterialRow) => analisis.find(a => a.id_entrada === m.id && (a.tipo ?? 'cabeza') === 'cabeza')

  const toggleCard = (k: string) => setOpenCards(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toggleMat  = (id: number) => setOpenMat(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAbono = (id: number) => setOpenAbonoRows(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleSel  = (id: number) => setSelected(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // Monto pagado por material (soporta pago por ítem + parcial)
  const paidMap = useMemo(() => montoPagadoPorMaterial(materiales, abonos, getValor), [materiales, abonos]) // eslint-disable-line react-hooks/exhaustive-deps
  const desglose = useMemo(() => desglosePorAbono(materiales, abonos, getValor), [materiales, abonos]) // eslint-disable-line react-hooks/exhaustive-deps
  const matById = useMemo(() => new Map(materiales.map(m => [m.id, m])), [materiales])
  const pendienteDe = (m: MaterialRow) => Math.max(0, (getValor(m) ?? 0) - (paidMap.get(m.id) ?? 0))
  const estadoDe = (m: MaterialRow): EstadoPago => {
    const v = getValor(m) ?? 0, p = paidMap.get(m.id) ?? 0
    return p >= v - 0.01 ? 'pagado' : p > 0 ? 'parcial' : 'pendiente'
  }

  const mineroNames = useMemo(() => {
    const s = new Set<string>()
    for (const m of materiales) if (m.mina && m.mina !== '—') s.add(m.mina)
    for (const a of abonos) s.add(a.minero)
    return [...s]
  }, [materiales, abonos])

  const porMinero = useMemo(() => {
    return mineroNames.map(minero => {
      const valued = materiales
        .filter(m => m.mina === minero && (getValor(m) ?? 0) > 0)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      const totalValor   = valued.reduce((s, m) => s + (getValor(m) ?? 0), 0)
      const totalAbonado = abonos.filter(a => a.minero === minero).reduce((s, a) => s + a.monto, 0)
      const pendiente    = valued.reduce((s, m) => s + Math.max(0, (getValor(m) ?? 0) - (paidMap.get(m.id) ?? 0)), 0)
      return { minero, materiales: valued, totalValor, totalAbonado, saldo: totalValor - totalAbonado, pendiente }
    }).filter(e => e.materiales.length > 0 || e.totalAbonado > 0)
      .sort((a, b) => b.pendiente - a.pendiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineroNames, materiales, abonos, paidMap])

  // KPIs
  const totalPorPagar = porMinero.reduce((s, e) => s + e.pendiente, 0)
  const totalPagado   = porMinero.reduce((s, e) => s + e.totalAbonado, 0)
  const conSaldo      = porMinero.filter(e => e.pendiente > 0.01).length
  const aFavor        = porMinero.filter(e => e.saldo < -0.01).length

  // Abono
  const openAbono = (minero: string, ids: number[] = []) => {
    setAbonoTarget(minero); setAbonoIds(ids); setEditando(null); setImgPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    const montoSel = ids.reduce((s, id) => { const m = materiales.find(x => x.id === id); return s + (m ? pendienteDe(m) : 0) }, 0)
    setForm({ fecha: todayISO(), monto: montoSel > 0 ? String(Math.round(montoSel)) : '', tipo: 'transferencia', nota: '', comprobante_img: '' })
    setAbonoModal(true)
  }
  const openEditAbono = (a: AbonoMinero) => {
    setAbonoTarget(a.minero); setAbonoIds(a.materiales_ids ?? []); setEditando(a); setImgPreview(a.comprobante_img ?? null)
    if (fileRef.current) fileRef.current.value = ''
    setForm({ fecha: a.fecha, monto: String(a.monto), tipo: a.tipo, nota: a.nota ?? '', comprobante_img: a.comprobante_img ?? '' })
    setAbonoModal(true)
  }
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const b64 = await compressImage(file); f('comprobante_img', b64); setImgPreview(b64)
  }
  const guardarAbono = () => {
    if (!abonoTarget || !form.monto || Number(form.monto) <= 0) return
    if (editando) {
      const upd: AbonoMinero = { ...editando, fecha: form.fecha, monto: Number(form.monto), tipo: form.tipo, comprobante_img: form.comprobante_img || undefined, nota: form.nota || undefined, materiales_ids: abonoIds.length ? abonoIds : undefined }
      setAbonos(prev => prev.map(x => x.id === editando.id ? upd : x))
    } else {
      const nuevo: AbonoMinero = {
        id: Date.now(), minero: abonoTarget, fecha: form.fecha, monto: Number(form.monto),
        tipo: form.tipo, comprobante_img: form.comprobante_img || undefined, nota: form.nota || undefined,
        materiales_ids: abonoIds.length ? abonoIds : undefined,
      }
      setAbonos(prev => [nuevo, ...prev])
    }
    // limpiar selección de los materiales cubiertos
    if (abonoIds.length) setSelected(p => { const n = new Set(p); abonoIds.forEach(id => n.delete(id)); return n })
    setAbonoModal(false)
  }
  const eliminarAbono = (id: number) => {
    if (!confirm('¿Eliminar este abono?')) return
    setAbonos(prev => prev.filter(x => x.id !== id))
  }

  const rows = fMinero ? porMinero.filter(r => r.minero === fMinero) : porMinero

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Mineros con saldo" value={conSaldo} accent="rose" icon={<AlertCircle size={16}/>} />
        <KpiTile label="Total por pagar"   value={cop(totalPorPagar)} accent="amber" />
        <KpiTile label="Total pagado"      value={cop(totalPagado)}   accent="green" />
        <KpiTile label="Saldos a favor"    value={aFavor} accent="brown" />
      </div>

      {/* Filtro por minero */}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Minero</span>
          <select className="field__input" style={{ minWidth: '13rem' }} value={fMinero} onChange={e => setFMinero(e.target.value)}>
            <option value="">Todos</option>
            {[...mineroNames].sort().map(mn => <option key={mn} value={mn}>{mn}</option>)}
          </select>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Marca los materiales a pagar y usa «Pagar seleccionados».
        </span>
      </div>

      {porMinero.length === 0 ? (
        <Card title="Sin datos">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            No hay materiales valorizados. Registra y evalúa material para gestionar el pago a mineros.
          </p>
        </Card>
      ) : rows.map(r => {
        const isOpen = openCards.has(r.minero)
        const tab = cardTab[r.minero] ?? 'materiales'
        const semaforo = r.pendiente <= 0.01 ? '#16a34a' : r.totalAbonado === 0 ? '#dc2626' : '#f59e0b'
        const pct = r.totalValor > 0 ? Math.min(r.totalAbonado / r.totalValor, 1) : (r.totalAbonado > 0 ? 1 : 0)
        const abonosMinero = abonos.filter(a => a.minero === r.minero).sort((a, b) => b.fecha.localeCompare(a.fecha))
        const selIds = r.materiales.filter(m => selected.has(m.id) && pendienteDe(m) > 0).map(m => m.id)
        const sumSel = selIds.reduce((s, id) => { const m = materiales.find(x => x.id === id); return s + (m ? pendienteDe(m) : 0) }, 0)
        const pendientes = r.materiales.filter(m => pendienteDe(m) > 0.01).length
        return (
          <div key={r.minero} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
              onClick={() => toggleCard(r.minero)}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} title={r.pendiente <= 0.01 ? 'Al día' : r.totalAbonado === 0 ? 'Sin abonos' : 'Abono parcial'} />
              <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{r.minero}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{pendientes} pendientes / {r.materiales.length} mat.</span>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                <span>Valor <strong>{cop(r.totalValor)}</strong></span>
                <span style={{ color: '#15803d' }}>Pagado <strong>{cop(r.totalAbonado)}</strong></span>
                <div style={{ minWidth: 110 }}>
                  <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: r.pendiente > 0.01 ? '#b45309' : '#15803d', minWidth: 96, textAlign: 'right' }} className="mono">
                  {r.pendiente <= 0.01 ? 'Al día' : cop(r.pendiente)}
                  <div style={{ fontSize: '0.6rem', fontWeight: 500 }}>{r.pendiente > 0.01 ? 'por pagar' : ''}</div>
                </span>
                {canWrite && (
                  <span onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="secondary" icon={<Banknote size={13}/>} onClick={() => openAbono(r.minero)}>Abono libre</Button>
                  </span>
                )}
                {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                <div className="segment" style={{ marginBottom: '0.75rem' }}>
                  {(['materiales', 'abonos'] as const).map(t => (
                    <button key={t} className={`segment__btn ${tab === t ? 'segment__btn--active' : ''}`}
                      onClick={() => setCardTab(s => ({ ...s, [r.minero]: t }))}>
                      {t === 'materiales' ? `Materiales (${r.materiales.length})` : `Abonos (${abonosMinero.length})`}
                    </button>
                  ))}
                </div>

                {tab === 'materiales' ? (
                  r.materiales.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin materiales valorizados.</em> : (
                    <>
                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                          <thead><tr>
                            {canWrite && <th style={{ width: '2rem' }}></th>}
                            <th>Fecha</th><th>Lote / N.° Vol.</th>
                            <th style={{ textAlign: 'right' }}>Ton secas</th>
                            <th style={{ textAlign: 'right' }}>Tenor Au</th>
                            <th style={{ textAlign: 'right' }}>Precio</th>
                            <th style={{ textAlign: 'right' }}>Valor</th>
                            <th style={{ textAlign: 'right' }}>Pagado</th>
                            <th>Estado</th>
                          </tr></thead>
                          <tbody>
                            {r.materiales.map(m => {
                              const v = getValor(m) ?? 0
                              const p = paidMap.get(m.id) ?? 0
                              const est = estadoDe(m)
                              const puedePagar = pendienteDe(m) > 0.01
                              const cab = getCabeza(m)
                              const isMatOpen = openMat.has(m.id)
                              return (
                                <Fragment key={m.id}>
                                  <tr style={{ cursor: 'pointer', ...(selected.has(m.id) ? { background: '#fffbeb' } : {}) }} onClick={() => toggleMat(m.id)}>
                                    {canWrite && (
                                      <td onClick={e => e.stopPropagation()}>
                                        {puedePagar
                                          ? <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSel(m.id)} />
                                          : <span title="Ya pagado" style={{ color: '#16a34a' }}>✓</span>}
                                      </td>
                                    )}
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(m.fecha)}</td>
                                    <td style={{ fontWeight: 600 }}>{m.lote ?? `#${m.numero_volqueta}`}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{pesoSeco(m).toFixed(4)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{m.tenor > 0 ? `${m.tenor.toFixed(2)} g/t` : 'S/A'}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{precioLabel(m)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(v)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{p > 0 ? cop(p) : '—'}</td>
                                    <td><span className={`badge ${ESTADO_BADGE[est].cls}`}>{ESTADO_BADGE[est].label}</span></td>
                                  </tr>
                                  {isMatOpen && (
                                    <tr>
                                      <td colSpan={canWrite ? 9 : 8} style={{ background: '#fff', padding: '0.6rem 1rem' }}>
                                        {cab ? (
                                          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                                            <span><FlaskConical size={12} style={{ verticalAlign: 'middle', color: 'var(--amber-600)' }} /> <strong>{cab.numero_analisis}</strong></span>
                                            <span>Humedad: <strong>{(m.porcentaje_humedad * 100).toFixed(1)}%</strong></span>
                                            <span>Au real: <strong>{cab.au_gr_x_ton.toFixed(2)} g/t</strong></span>
                                            {cab.au_falso > 0 && <span>Au pago: <strong style={{ color: 'var(--amber-700)' }}>{cab.au_falso.toFixed(2)} g/t</strong></span>}
                                            {cab.ag_gr_x_ton != null && <span>Ag: <strong>{cab.ag_gr_x_ton.toFixed(0)} g/t</strong></span>}
                                            {p > 0 && p < v && <span style={{ color: 'var(--amber-700)' }}>Falta: <strong>{cop(v - p)}</strong></span>}
                                          </div>
                                        ) : <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin análisis de cabeza.</em>}
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: 700 }}>
                              <td colSpan={canWrite ? 6 : 5}>Total</td>
                              <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(r.totalValor)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{cop(r.totalAbonado)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {canWrite && selIds.length > 0 && (
                        <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: '#fef3c7', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--fs-sm)' }}><strong>{selIds.length}</strong> seleccionados · <strong>{cop(sumSel)}</strong></span>
                          <Button size="sm" icon={<Banknote size={14}/>} style={{ marginLeft: 'auto' }} onClick={() => openAbono(r.minero, selIds)}>Pagar seleccionados</Button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  abonosMinero.length === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin abonos.</em> : (
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                        <thead><tr>
                          <th>Fecha</th><th>Método</th>
                          <th style={{ textAlign: 'right' }}>Monto</th>
                          <th>Cubre</th><th>Nota</th><th>Comp.</th>
                          {canWrite && <th></th>}
                        </tr></thead>
                        <tbody>
                          {abonosMinero.map(a => {
                            const det = desglose.get(a.id) ?? []
                            const isAbOpen = openAbonoRows.has(a.id)
                            return (
                              <Fragment key={a.id}>
                                <tr style={{ cursor: 'pointer', ...(isAbOpen ? { background: 'var(--slate-50)' } : {}) }} onClick={() => toggleAbono(a.id)}>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    {isAbOpen ? <ChevronUp size={12} style={{ verticalAlign: 'middle', marginRight: 3 }}/> : <ChevronDown size={12} style={{ verticalAlign: 'middle', marginRight: 3 }}/>}
                                    {formatDate(a.fecha)}
                                  </td>
                                  <td>{TIPO_LABELS[a.tipo]}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(a.monto)}</td>
                                  <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{det.length ? `${det.length} material(es)` : (a.materiales_ids?.length ? `${a.materiales_ids.length} material(es)` : 'Cuenta general')}</td>
                                  <td style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{a.nota ?? ''}</td>
                                  <td onClick={e => e.stopPropagation()}>{a.comprobante_img && <a href={a.comprobante_img} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ color: 'var(--amber-700)', display: 'flex' }}><ImageIcon size={14}/></a>}</td>
                                  {canWrite && (
                                    <td onClick={e => e.stopPropagation()}>
                                      <div className="row" style={{ gap: 4 }}>
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-600)' }} onClick={() => openEditAbono(a)} title="Editar"><Pencil size={13}/></button>
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }} onClick={() => eliminarAbono(a.id)} title="Eliminar"><Trash2 size={13}/></button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                                {isAbOpen && (
                                  <tr>
                                    <td colSpan={canWrite ? 7 : 6} style={{ background: '#fff', padding: '0.5rem 1rem 0.75rem 1.75rem' }}>
                                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--amber-800)', marginBottom: '0.35rem' }}>Este abono pagó:</div>
                                      {det.length === 0 ? (
                                        <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>No se aplicó a ningún material (excedente o sin pendientes).</em>
                                      ) : (
                                        <table style={{ fontSize: 'var(--fs-xs)', borderCollapse: 'collapse', width: 'auto', minWidth: '20rem' }}>
                                          <tbody>
                                            {det.map(d => {
                                              const mm = matById.get(d.id_material)
                                              const val = mm ? (getValor(mm) ?? 0) : 0
                                              return (
                                                <tr key={d.id_material} style={{ borderTop: '1px solid #f0efec' }}>
                                                  <td style={{ padding: '2px 8px', fontWeight: 600 }}>{mm ? (mm.lote ?? `#${mm.numero_volqueta}`) : `Mat ${d.id_material}`}</td>
                                                  <td style={{ padding: '2px 8px', color: 'var(--text-muted)' }}>{mm ? formatDate(mm.fecha) : ''}</td>
                                                  <td style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(d.monto)}</td>
                                                  <td style={{ padding: '2px 8px', textAlign: 'right', color: 'var(--text-muted)' }} className="mono">de {cop(val)}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td colSpan={2}>Total abonado</td>
                            <td style={{ textAlign: 'right', color: '#15803d' }} className="mono">{cop(r.totalAbonado)}</td>
                            <td colSpan={canWrite ? 4 : 3} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Modal abono ── */}
      <Modal open={abonoModal} title={`${editando ? 'Editar' : 'Registrar'} pago — ${abonoTarget ?? ''}`} onClose={() => setAbonoModal(false)}
        footer={<><Button variant="secondary" onClick={() => setAbonoModal(false)}>Cancelar</Button>
          <Button icon={<Banknote size={16}/>} onClick={guardarAbono} disabled={!form.monto || Number(form.monto) <= 0}>{editando ? 'Guardar cambios' : 'Registrar pago'}</Button></>}>
        {abonoIds.length > 0 && (
          <div className="callout" style={{ marginBottom: '0.75rem', fontSize: 'var(--fs-sm)' }}>
            Este pago cubre <strong>{abonoIds.length} material(es)</strong> seleccionados. Si el monto es menor, se reparte del más antiguo al más nuevo.
          </div>
        )}
        <div className="grid grid--form">
          <Input label="Fecha" type="date" required value={form.fecha} onChange={e => f('fecha', e.target.value)} />
          <Input label="Monto (COP)" type="number" step="1000" required value={form.monto} onChange={e => f('monto', e.target.value)} />
          <Select label="Método" options={TIPO_OPTS} value={form.tipo} onChange={e => f('tipo', e.target.value)} />
          <Input label="Nota (opcional)" value={form.nota} onChange={e => f('nota', e.target.value)} />
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Foto del comprobante <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(opcional)</span></div>
            <input ref={fileRef} id="comp-file-panel" type="file" accept="image/*" onChange={handleFile} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            {!imgPreview ? (
              <label htmlFor="comp-file-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                <ImageIcon size={18} style={{ color: 'var(--amber-600)' }} /> Subir foto del depósito / transferencia
              </label>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgPreview} alt="comprobante" style={{ maxHeight: 150, borderRadius: 8, border: '1.5px solid var(--border-default)', display: 'block' }} />
                <button onClick={() => { setImgPreview(null); f('comprobante_img', ''); if (fileRef.current) fileRef.current.value = '' }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 12 }}>✕</button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
