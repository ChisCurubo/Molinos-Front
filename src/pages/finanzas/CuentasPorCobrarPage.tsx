import React, { useRef, useMemo, useState, type ChangeEvent } from 'react'
import { ArrowDownCircle, ChevronDown, ChevronUp, Upload } from 'lucide-react'
import { EstadoBadge, KpiTile } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import type { AbonoRegistro, CuentaPorCobrar } from '@/types'

const estadoOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado',  label: 'Aprobado'  },
  { value: 'revision',  label: 'En revisión' },
  { value: 'pagado',    label: 'Cobrado'    },
  { value: 'rechazado', label: 'Rechazado'  },
]

const CLIENTES_PREDEFINIDOS = [
  'Claro Colombia',
  'Grupo Argos',
  'Cementos Argos',
  'ProBa S.A.',
  'Constructora Bolívar',
  'Otro',
]

function vencimientoStatus(fecha: string, estado: string) {
  if (estado === 'pagado' || estado === 'rechazado') return 'pagado'
  const hoy  = todayISO()
  const diff = Math.ceil((new Date(fecha).getTime() - new Date(hoy).getTime()) / 86_400_000)
  if (diff < 0)  return 'vencida'
  if (diff <= 3) return 'proxima'
  return 'normal'
}

export function CuentasPorCobrarPage() {
  const canWrite = useCanWrite('finanzas')
  const { porCobrar, add, update, remove } = useData()

  const [busqueda,    setBusqueda]    = useState('')
  const [filtroEst,   setFiltroEst]   = useState<string>('todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const [modalForm,    setModalForm]    = useState<'nueva' | CuentaPorCobrar | null>(null)
  const [fConcepto,    setFConcepto]    = useState('')
  const [fCliente,     setFCliente]     = useState('')
  const [fClienteLibre, setFClienteLibre] = useState('')
  const [fMonto,       setFMonto]       = useState('')
  const [fVence,       setFVence]       = useState(todayISO())
  const [fEstado,      setFEstado]      = useState('pendiente')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [viendo, setViendo] = useState<CuentaPorCobrar | null>(null)

  const [abonando,   setAbonando]   = useState<CuentaPorCobrar | null>(null)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoFecha, setAbonoFecha] = useState(todayISO())
  const [abonoNota,  setAbonoNota]  = useState('')
  const [abonoComp,  setAbonoComp]  = useState<string | null>(null)
  const [abonoErr,   setAbonoErr]   = useState('')
  const fileAbonoRef = useRef<HTMLInputElement>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const clientesExistentes = useMemo(() => {
    const set = new Set(porCobrar.map((c) => c.cliente))
    return [...new Set([...CLIENTES_PREDEFINIDOS, ...Array.from(set)])]
  }, [porCobrar])

  const hoy = todayISO()

  const filtradas = useMemo(() => {
    const items = porCobrar.filter((c) => {
      if (filtroEst !== 'todos' && c.estado !== filtroEst) return false
      if (busqueda && !c.concepto.toLowerCase().includes(busqueda.toLowerCase()) && !c.cliente.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filtroDesde && c.fechaVencimiento < filtroDesde) return false
      if (filtroHasta && c.fechaVencimiento > filtroHasta) return false
      return true
    })
    const vigentes = items.filter((c) => c.estado === 'pagado' || c.estado === 'rechazado' || c.fechaVencimiento >= hoy)
    const vencidas = items.filter((c) => c.estado !== 'pagado' && c.estado !== 'rechazado' && c.fechaVencimiento < hoy)
    return [...vigentes, ...vencidas]
  }, [porCobrar, filtroEst, busqueda, filtroDesde, filtroHasta, hoy])

  const totalPendiente = filtradas.filter((c) => c.estado !== 'rechazado' && c.estado !== 'pagado').reduce((s, c) => s + (c.saldo ?? c.monto), 0)
  const totalCobrado   = filtradas.filter((c) => c.estado === 'pagado').reduce((s, c) => s + c.monto, 0)
  const vencidasCount  = porCobrar.filter((c) => c.estado !== 'pagado' && c.estado !== 'rechazado' && c.fechaVencimiento < hoy).length

  const clienteReal = (c: string, libre: string) => c === 'Otro' ? libre : c

  const openNueva = () => {
    setFConcepto(''); setFCliente(clientesExistentes[0] ?? ''); setFClienteLibre('')
    setFMonto(''); setFVence(todayISO()); setFEstado('pendiente')
    setModalForm('nueva')
  }
  const openEditar = (c: CuentaPorCobrar) => {
    setFConcepto(c.concepto)
    const known = CLIENTES_PREDEFINIDOS.includes(c.cliente)
    setFCliente(known ? c.cliente : 'Otro')
    setFClienteLibre(known ? '' : c.cliente)
    setFMonto(String(c.monto)); setFVence(c.fechaVencimiento); setFEstado(c.estado)
    setModalForm(c)
  }
  const guardar = () => {
    const cliente = clienteReal(fCliente, fClienteLibre)
    if (!fConcepto || !cliente || !fMonto) return
    const vals: Partial<CuentaPorCobrar> = { concepto: fConcepto, cliente, monto: Number(fMonto), fechaVencimiento: fVence, estado: fEstado as CuentaPorCobrar['estado'] }
    if (modalForm === 'nueva') {
      const monto = Number(fMonto)
      add('porCobrar', { id: `c${Date.now()}`, comprobante: null, saldo: monto, abonosHistorial: [], ...vals } as CuentaPorCobrar)
    } else if (modalForm) {
      update('porCobrar', (modalForm as CuentaPorCobrar).id, vals)
    }
    setModalForm(null)
  }

  const abrirAbono = (c: CuentaPorCobrar) => {
    setAbonando(c); setAbonoMonto(''); setAbonoFecha(todayISO()); setAbonoNota(''); setAbonoComp(null); setAbonoErr('')
  }
  const handleFileAbono = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setAbonoComp(f.name); setAbonoErr('') }
  }
  const confirmarAbono = () => {
    const monto = Number(abonoMonto)
    const saldoActual = abonando!.saldo ?? abonando!.monto
    if (!monto || monto <= 0) { setAbonoErr('Ingresa un monto válido.'); return }
    if (monto > saldoActual) { setAbonoErr(`El abono no puede superar el saldo (${formatCOP(saldoActual)}).`); return }
    const nuevoSaldo = saldoActual - monto
    const reg: AbonoRegistro = { id: `ab${Date.now()}`, fecha: abonoFecha, monto, nota: abonoNota || undefined, comprobante: abonoComp ?? undefined }
    update('porCobrar', abonando!.id, {
      saldo: nuevoSaldo,
      abonosHistorial: [...(abonando!.abonosHistorial ?? []), reg],
      estado: nuevoSaldo === 0 ? 'pagado' : abonando!.estado,
    })
    setAbonando(null)
  }

  const colCount = canWrite ? 8 : 7

  return (
    <div className="page">
      <PageHeader title="Cuentas por cobrar" subtitle="Cartera de clientes, vencimientos y comprobantes." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Por cobrar (saldo)"  value={formatCOP(totalPendiente)} accent="emerald" icon={<ArrowDownCircle size={16}/>} />
        <KpiTile label="Total cobrado"       value={formatCOP(totalCobrado)}   accent="green"   icon={<ArrowDownCircle size={16}/>} />
        <KpiTile label="Cuentas vencidas"    value={vencidasCount}             accent="rose"    icon={<ArrowDownCircle size={16}/>} />
      </div>

      <Card flush>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ flex: '1 1 14rem' }}>
            <Input label="Buscar" placeholder="Concepto o cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 10rem' }}>
            <Input label="Desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 10rem' }}>
            <Input label="Hasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <div className="segment">
              {[{ v: 'todos', l: 'Todos' }, { v: 'pendiente', l: 'Pendientes' }, { v: 'pagado', l: 'Cobrados' }].map(o => (
                <button key={o.v} className={`segment__btn ${filtroEst === o.v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroEst(o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
          {canWrite && <Button size="sm" onClick={openNueva}>+ Nueva cuenta</Button>}
        </div>
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <Card title={`Cuentas por cobrar (${filtradas.length})`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th><th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th>Vence</th><th>Estado</th><th>Comprobante</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const saldo      = c.saldo ?? c.monto
                  const abonos     = c.abonosHistorial ?? []
                  const pct        = c.monto > 0 ? Math.round(((c.monto - saldo) / c.monto) * 100) : 0
                  const vStatus    = vencimientoStatus(c.fechaVencimiento, c.estado)
                  const cobrada    = c.estado === 'pagado'
                  const expanded   = expandedId === c.id
                  const confirming = confirmDeleteId === c.id

                  const rowBg = cobrada ? undefined
                    : vStatus === 'vencida' ? { background: 'var(--rose-50, #fff1f2)' }
                    : vStatus === 'proxima' ? { background: 'var(--amber-50, #fffbeb)' }
                    : undefined

                  return (
                    <React.Fragment key={c.id}>
                      <tr style={{ ...rowBg, ...(cobrada ? { opacity: 0.65 } : {}) }}>
                        <td style={{ fontWeight: 600 }}>
                          {c.concepto}
                          {vStatus === 'vencida' && !cobrada && <span className="badge badge--danger" style={{ marginLeft: '0.375rem', fontSize: '0.6rem' }}>VENCIDA</span>}
                          {vStatus === 'proxima' && !cobrada && <span className="badge badge--warning" style={{ marginLeft: '0.375rem', fontSize: '0.6rem' }}>POR VENCER</span>}
                        </td>
                        <td style={{ fontSize: 'var(--fs-sm)' }}>{c.cliente}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(c.monto)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                          <div>{formatCOP(saldo)}</div>
                          {abonos.length > 0 && (
                            <div style={{ height: 4, background: 'var(--slate-100)', borderRadius: 999, marginTop: '0.25rem', width: '4rem' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', borderRadius: 999 }} />
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 'var(--fs-sm)', color: vStatus === 'vencida' ? 'var(--rose-600)' : vStatus === 'proxima' ? 'var(--amber-700)' : undefined, fontWeight: vStatus !== 'normal' && vStatus !== 'pagado' ? 700 : undefined }}>
                          {formatDate(c.fechaVencimiento)}
                        </td>
                        <td><EstadoBadge estado={c.estado} /></td>
                        <td>
                          {c.comprobante
                            ? <button className="btn btn--ghost btn--sm" onClick={() => setViendo(c)}>Ver</button>
                            : <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>—</em>}
                        </td>
                        {canWrite && (
                          <td>
                            {confirming ? (
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--rose-600)', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                                <Button size="sm" variant="secondary" onClick={() => { remove('porCobrar', c.id); setConfirmDeleteId(null) }}>Sí</Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>No</Button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {!cobrada && <Button size="sm" onClick={() => abrirAbono(c)}>Abonar</Button>}
                                <Button size="sm" variant="secondary" onClick={() => openEditar(c)}>✎</Button>
                                <Button size="sm" variant="secondary" onClick={() => setConfirmDeleteId(c.id)}>×</Button>
                                {abonos.length > 0 && (
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedId(expanded ? null : c.id)}>
                                    {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {expanded && abonos.length > 0 && (
                        <tr>
                          <td colSpan={colCount} style={{ padding: '0.5rem 1rem 1rem', background: 'var(--surface-page)' }}>
                            <table className="data-table" style={{ margin: 0 }}>
                              <thead><tr><th>Fecha</th><th style={{ textAlign: 'right' }}>Abono</th><th>Nota</th><th>Comprobante</th></tr></thead>
                              <tbody>
                                {abonos.map((ab) => (
                                  <tr key={ab.id}>
                                    <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(ab.fecha)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{formatCOP(ab.monto)}</td>
                                    <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{ab.nota ?? '—'}</td>
                                    <td style={{ fontSize: 'var(--fs-sm)' }}>{ab.comprobante ? <span style={{ color: 'var(--emerald-700)' }}>✓ {ab.comprobante}</span> : <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
                {filtradas.length === 0 && (
                  <tr><td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Sin cuentas para los filtros actuales.</td></tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Total ({filtradas.length})</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(filtradas.reduce((s, c) => s + c.monto, 0))}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(filtradas.reduce((s, c) => s + (c.saldo ?? c.monto), 0))}</td>
                    <td colSpan={canWrite ? 4 : 3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalForm !== null} title={modalForm === 'nueva' ? 'Nueva cuenta por cobrar' : 'Editar cuenta'}
        onClose={() => setModalForm(null)}
        footer={<><Button variant="secondary" onClick={() => setModalForm(null)}>Cancelar</Button><Button onClick={guardar}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" value={fConcepto} onChange={(e) => setFConcepto(e.target.value)} required />
          <Select label="Cliente" options={clientesExistentes.map((cl) => ({ value: cl, label: cl }))} value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
          {fCliente === 'Otro' && (
            <Input label="Nombre del cliente" value={fClienteLibre} onChange={(e) => setFClienteLibre(e.target.value)} required />
          )}
          <Input label="Monto" type="number" value={fMonto} onChange={(e) => setFMonto(e.target.value)} required />
          <Input label="Fecha vencimiento" type="date" value={fVence} onChange={(e) => setFVence(e.target.value)} />
          <Select label="Estado" options={estadoOptions} value={fEstado} onChange={(e) => setFEstado(e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!abonando} title={`Registrar abono — ${abonando?.concepto ?? ''}`} onClose={() => setAbonando(null)}
        footer={<><Button variant="secondary" onClick={() => setAbonando(null)}>Cancelar</Button><Button onClick={confirmarAbono}>Guardar abono</Button></>}>
        {abonando && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Saldo actual</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--emerald-700)' }}>{formatCOP(abonando.saldo ?? abonando.monto)}</p>
              </div>
            </div>
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} />
              <Input label="Monto recibido" type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} required />
              {abonoMonto && Number(abonoMonto) > 0 && (
                <div className="callout" style={{ gridColumn: '1/-1' }}>
                  Saldo después del abono: <strong>{formatCOP(Math.max(0, (abonando.saldo ?? abonando.monto) - Number(abonoMonto)))}</strong>
                </div>
              )}
              <Input label="Nota (opcional)" value={abonoNota} onChange={(e) => setAbonoNota(e.target.value)} style={{ gridColumn: '1/-1' }} />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Comprobante (opcional)</p>
              <input ref={fileAbonoRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileAbono} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileAbonoRef.current?.click()}>Adjuntar</Button>
                {abonoComp && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {abonoComp}</span>}
              </div>
            </div>
            {abonoErr && <p style={{ color: 'var(--rose-600)', fontSize: 'var(--fs-sm)' }}>⚠ {abonoErr}</p>}
          </div>
        )}
      </Modal>

      <Modal open={!!viendo} title={`Comprobante — ${viendo?.concepto ?? ''}`} onClose={() => setViendo(null)}
        footer={<Button variant="secondary" onClick={() => setViendo(null)}>Cerrar</Button>}>
        {viendo && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Archivo adjunto:</p>
            <p style={{ fontWeight: 600, color: 'var(--emerald-700)' }}>✓ {viendo.comprobante}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
              Cliente: {viendo.cliente} · Monto: {formatCOP(viendo.monto)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
