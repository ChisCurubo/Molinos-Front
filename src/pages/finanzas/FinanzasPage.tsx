import React, { useRef, useMemo, useState, type ChangeEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Landmark, Upload, Wallet } from 'lucide-react'
import '../dashboard/dashboard.css'
import { EstadoBadge, KpiTile } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { aguaMock, viajesMock, empleados as empMock } from '@/data/mock'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import type { AbonoRegistro, CuentaPorPagar } from '@/types'

type Tab = 'pagar' | 'historico'

const estadoOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado',  label: 'Aprobado'  },
  { value: 'revision',  label: 'En revisión' },
  { value: 'pagado',    label: 'Pagado'     },
  { value: 'rechazado', label: 'Rechazado'  },
]
const tipoOptions = [
  { value: 'gasto',     label: 'Gasto general' },
  { value: 'proveedor', label: 'Proveedor'      },
  { value: 'alquiler',  label: 'Alquiler'       },
  { value: 'flete',     label: 'Flete / Mula'   },
  { value: 'material',  label: 'Material'       },
  { value: 'gasolina',  label: 'Gasolina'       },
]

function vencimientoStatus(fecha: string, estado: string) {
  if (estado === 'pagado' || estado === 'rechazado') return 'pagado'
  const hoy  = todayISO()
  const diff = Math.ceil((new Date(fecha).getTime() - new Date(hoy).getTime()) / 86_400_000)
  if (diff < 0)  return 'vencida'
  if (diff <= 3) return 'proxima'
  return 'normal'
}

// ── Cuentas históricas ───────────────────────────────────
type CategoriaMov = 'agua' | 'maquila' | 'nomina' | 'mula' | 'gasolina' | 'material' | 'proveedor' | 'alquiler' | 'gasto'

const BADGE_MOV: Record<CategoriaMov, string> = {
  agua:      'badge--info',
  maquila:   'badge--success',
  nomina:    'badge--warning',
  mula:      'badge--neutral',
  gasolina:  'badge--neutral',
  material:  'badge--info',
  proveedor: 'badge--neutral',
  alquiler:  'badge--warning',
  gasto:     'badge--neutral',
}
const LABEL_MOV: Record<CategoriaMov, string> = {
  agua:      'Agua',
  maquila:   'Maquila',
  nomina:    'Nómina',
  mula:      'Mula / Flete',
  gasolina:  'Gasolina',
  material:  'Material',
  proveedor: 'Proveedor',
  alquiler:  'Alquiler',
  gasto:     'Gasto general',
}

interface Movimiento { id: string; fecha: string; categoria: CategoriaMov; descripcion: string; monto: number }

function HistoricoTab() {
  const { porPagar } = useData()

  const movimientos = useMemo((): Movimiento[] => {
    const agua: Movimiento[] = aguaMock.map((a) => ({
      id: `agua-${a.id}`, fecha: a.fecha, categoria: 'agua',
      descripcion: `Agua — ${a.conductor} (${a.cantidad_viajes} viajes)`,
      monto: a.valor_total,
    }))
    const maquila: Movimiento[] = viajesMock.map((v) => ({
      id: `maquila-${v.id}`, fecha: v.fecha, categoria: 'maquila',
      descripcion: `Maquila viaje ${v.numero_viaje}`,
      monto: v.maquila,
    }))
    const nomina: Movimiento[] = empMock.map((e) => ({
      id: `nomina-${e.id}`, fecha: '2026-07-15', categoria: 'nomina',
      descripcion: `Nómina — ${e.nombre} (${e.labor})`,
      monto: e.salario_quincenal,
    }))
    const dePorPagar = (tipo: CuentaPorPagar['tipo'], cat: CategoriaMov): Movimiento[] =>
      porPagar
        .filter((p) => p.tipo === tipo && p.estado !== 'rechazado')
        .map((p) => ({
          id: `pp-${p.id}`, fecha: p.fechaVencimiento, categoria: cat,
          descripcion: `${p.concepto} — ${p.beneficiario}`,
          monto: p.saldo ?? p.monto,
        }))

    return [
      ...agua, ...maquila, ...nomina,
      ...dePorPagar('flete',     'mula'),
      ...dePorPagar('gasolina',  'gasolina'),
      ...dePorPagar('material',  'material'),
      ...dePorPagar('proveedor', 'proveedor'),
      ...dePorPagar('alquiler',  'alquiler'),
      ...dePorPagar('gasto',     'gasto'),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [porPagar])

  const [filtro,      setFiltro]      = useState<CategoriaMov | 'todos'>('todos')
  const [busqueda,    setBusqueda]    = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const filtrados = useMemo(() => movimientos.filter((m) => {
    if (filtro !== 'todos' && m.categoria !== filtro) return false
    if (busqueda && !m.descripcion.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroDesde && m.fecha < filtroDesde) return false
    if (filtroHasta && m.fecha > filtroHasta) return false
    return true
  }), [movimientos, filtro, busqueda, filtroDesde, filtroHasta])

  const totalFiltrado = filtrados.reduce((s, m) => s + m.monto, 0)

  // KPIs de categoría — responden a los filtros de fecha
  const totalesPorCat = useMemo(() => {
    const t: Partial<Record<CategoriaMov, number>> = {}
    filtrados.forEach((m) => { t[m.categoria] = (t[m.categoria] ?? 0) + m.monto })
    return t
  }, [filtrados])

  const catsPrincipales: CategoriaMov[] = ['agua', 'maquila', 'nomina', 'mula', 'gasolina']

  return (
    <>
      {/* KPIs de categoría — reemplazan el bloque superior cuando estás en esta pestaña */}
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        {catsPrincipales.map((c) => (
          <KpiTile key={c} label={LABEL_MOV[c]} value={formatCOP(totalesPorCat[c] ?? 0)}
            accent={c === 'maquila' ? 'green' : c === 'nomina' ? 'amber' : 'brown'}
            icon={<Wallet size={16} />} />
        ))}
        <KpiTile label="Total (filtrado)" value={formatCOP(totalFiltrado)} accent="rose" icon={<ArrowUpCircle size={16} />} />
      </div>

      {/* Filtros */}
      <Card flush>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ flex: '1 1 14rem' }}>
            <Input label="Buscar concepto" placeholder="Descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 9rem' }}>
            <Input label="Desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 9rem' }}>
            <Input label="Hasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '0 1rem 0.75rem', overflowX: 'auto' }}>
          <div className="segment" style={{ flexWrap: 'wrap' }}>
            <button className={`segment__btn ${filtro === 'todos' ? 'segment__btn--active' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
            {(Object.keys(LABEL_MOV) as CategoriaMov[]).map((c) => (
              <button key={c} className={`segment__btn ${filtro === c ? 'segment__btn--active' : ''}`} onClick={() => setFiltro(c)}>
                {LABEL_MOV[c]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <Card title={`Historial de movimientos (${filtrados.length})`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                    <td><span className={`badge ${BADGE_MOV[m.categoria]}`}>{LABEL_MOV[m.categoria]}</span></td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{m.descripcion}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(m.monto)}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Sin movimientos para los filtros actuales.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Total ({filtrados.length})</td>
                  <td style={{ textAlign: 'right' }} className="mono">{formatCOP(totalFiltrado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

// ── Cuentas por pagar ────────────────────────────────────
function PagarTab({ canWrite }: { canWrite: boolean }) {
  const { porPagar, add, update, remove } = useData()

  const [filtroTipo,   setFiltroTipo]   = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [busqueda,     setBusqueda]     = useState('')

  // Modal nueva / editar
  const [modalForm, setModalForm] = useState<'nueva' | CuentaPorPagar | null>(null)
  const [fConcepto, setFConcepto] = useState('')
  const [fBenef,    setFBenef]    = useState('')
  const [fTipo,     setFTipo]     = useState('gasto')
  const [fMonto,    setFMonto]    = useState('')
  const [fVence,    setFVence]    = useState(todayISO())
  const [fEstado,   setFEstado]   = useState('pendiente')

  // Modal ver comprobante
  const [viendo, setViendo] = useState<CuentaPorPagar | null>(null)

  // Modal abono parcial
  const [abonando,    setAbonando]    = useState<CuentaPorPagar | null>(null)
  const [abonoMonto,  setAbonoMonto]  = useState('')
  const [abonoFecha,  setAbonoFecha]  = useState(todayISO())
  const [abonoNota,   setAbonoNota]   = useState('')
  const [abonoComp,   setAbonoComp]   = useState<string | null>(null)
  const [abonoErr,    setAbonoErr]    = useState('')
  const fileAbonoRef = useRef<HTMLInputElement>(null)

  // Confirmación de eliminación inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Expandir historial
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtradas = useMemo(() => porPagar.filter((p) => {
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    if (busqueda && !p.concepto.toLowerCase().includes(busqueda.toLowerCase()) && !p.beneficiario.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [porPagar, filtroTipo, filtroEstado, busqueda])

  const openNueva = () => {
    setFConcepto(''); setFBenef(''); setFTipo('gasto'); setFMonto(''); setFVence(todayISO()); setFEstado('pendiente')
    setModalForm('nueva')
  }
  const openEditar = (p: CuentaPorPagar) => {
    setFConcepto(p.concepto); setFBenef(p.beneficiario); setFTipo(p.tipo)
    setFMonto(String(p.monto)); setFVence(p.fechaVencimiento); setFEstado(p.estado)
    setModalForm(p)
  }
  const guardar = () => {
    if (!fConcepto || !fBenef || !fMonto) return
    const vals = { concepto: fConcepto, beneficiario: fBenef, tipo: fTipo as CuentaPorPagar['tipo'], monto: Number(fMonto), fechaVencimiento: fVence, estado: fEstado as CuentaPorPagar['estado'] }
    if (modalForm === 'nueva') {
      const monto = Number(fMonto)
      add('porPagar', { id: `p${Date.now()}`, origen: 'manual', comprobante: null, saldo: monto, abonosHistorial: [], ...vals } as CuentaPorPagar)
    } else if (modalForm) {
      update('porPagar', (modalForm as CuentaPorPagar).id, vals)
    }
    setModalForm(null)
  }

  const abrirAbono = (p: CuentaPorPagar) => {
    setAbonando(p); setAbonoMonto(''); setAbonoFecha(todayISO()); setAbonoNota(''); setAbonoComp(null); setAbonoErr('')
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
    update('porPagar', abonando!.id, {
      saldo: nuevoSaldo,
      abonosHistorial: [...(abonando!.abonosHistorial ?? []), reg],
      estado: nuevoSaldo === 0 ? 'pagado' : abonando!.estado,
    })
    setAbonando(null)
  }

  const colCount = canWrite ? 5 : 4

  return (
    <>
      {/* Filtros */}
      <Card flush>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          <div style={{ flex: '1 1 14rem' }}>
            <Input label="Buscar" placeholder="Concepto o beneficiario…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="segment">
              {[{ v: 'todos', l: 'Todos' }, ...tipoOptions.map(o => ({ v: o.value, l: o.label }))].map(o => (
                <button key={o.v} className={`segment__btn ${filtroTipo === o.v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroTipo(o.v)}>{o.l}</button>
              ))}
            </div>
            <div className="segment">
              {[{ v: 'todos', l: 'Todos' }, { v: 'pendiente', l: 'Pendientes' }, { v: 'pagado', l: 'Pagadas' }].map(o => (
                <button key={o.v} className={`segment__btn ${filtroEstado === o.v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroEstado(o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
          {canWrite && <Button size="sm" onClick={openNueva}>+ Nueva cuenta</Button>}
        </div>
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <Card title={`Cuentas por pagar (${filtradas.length})`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '14rem' }}>Concepto</th>
                  <th style={{ textAlign: 'right', minWidth: '9rem' }}>Saldo · Monto</th>
                  <th style={{ minWidth: '8rem' }}>Vence · Estado</th>
                  <th style={{ textAlign: 'right', minWidth: '6rem' }}>4×1000</th>
                  {canWrite && <th style={{ textAlign: 'right', minWidth: '10rem' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => {
                  const saldo      = p.saldo ?? p.monto
                  const abonos     = p.abonosHistorial ?? []
                  const pct        = p.monto > 0 ? Math.round(((p.monto - saldo) / p.monto) * 100) : 0
                  const imp4x1000  = p.monto * 0.004
                  const pagada     = p.estado === 'pagado'
                  const vStatus    = vencimientoStatus(p.fechaVencimiento, p.estado)
                  const expanded   = expandedId === p.id
                  const confirming = confirmDeleteId === p.id

                  const rowBg = pagada ? undefined
                    : vStatus === 'vencida'  ? { background: 'var(--rose-50, #fff1f2)' }
                    : vStatus === 'proxima'  ? { background: 'var(--amber-50, #fffbeb)' }
                    : undefined

                  return (
                    <React.Fragment key={p.id}>
                      <tr style={{ ...rowBg, ...(pagada ? { opacity: 0.65 } : {}) }}>
                        {/* Col 1: Concepto + tipo + beneficiario */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{p.concepto}</span>
                            <span className="badge badge--neutral" style={{ textTransform: 'capitalize', fontSize: '0.65rem' }}>{p.tipo}</span>
                            {vStatus === 'vencida' && !pagada && <span className="badge badge--danger" style={{ fontSize: '0.6rem' }}>VENCIDA</span>}
                            {vStatus === 'proxima' && !pagada && <span className="badge badge--warning" style={{ fontSize: '0.6rem' }}>POR VENCER</span>}
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{p.beneficiario}</div>
                        </td>

                        {/* Col 2: Saldo + monto original + barra */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 'var(--fs-base)' }} className="mono">{formatCOP(saldo)}</div>
                          {saldo !== p.monto && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">de {formatCOP(p.monto)}</div>
                          )}
                          {abonos.length > 0 && (
                            <div style={{ height: 3, background: 'var(--slate-100)', borderRadius: 999, marginTop: '0.3rem', width: '5rem', marginLeft: 'auto' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', borderRadius: 999 }} />
                            </div>
                          )}
                        </td>

                        {/* Col 3: Vence + estado */}
                        <td>
                          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: vStatus !== 'normal' && vStatus !== 'pagado' ? 700 : undefined, color: vStatus === 'vencida' ? 'var(--rose-600)' : vStatus === 'proxima' ? 'var(--amber-700)' : undefined }}>
                            {formatDate(p.fechaVencimiento)}
                          </div>
                          <div style={{ marginTop: '0.2rem' }}><EstadoBadge estado={p.estado} /></div>
                        </td>

                        {/* Col 4: 4×1000 */}
                        <td style={{ textAlign: 'right', color: 'var(--amber-700)', fontSize: 'var(--fs-sm)' }} className="mono">
                          {formatCOP(imp4x1000)}
                          {p.comprobante && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <button className="btn btn--ghost btn--sm" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => setViendo(p)}>Ver comp.</button>
                            </div>
                          )}
                        </td>

                        {/* Col 5: Acciones (derecha) */}
                        {canWrite && (
                          <td style={{ textAlign: 'right' }}>
                            {confirming ? (
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--rose-600)', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                                <Button size="sm" variant="secondary" onClick={() => { remove('porPagar', p.id); setConfirmDeleteId(null) }}>Sí</Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>No</Button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                {abonos.length > 0 && (
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedId(expanded ? null : p.id)}>
                                    {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                                  </Button>
                                )}
                                {!pagada && <Button size="sm" onClick={() => abrirAbono(p)}>Abonar</Button>}
                                <Button size="sm" variant="secondary" onClick={() => openEditar(p)}>✎</Button>
                                <Button size="sm" variant="secondary" onClick={() => setConfirmDeleteId(p.id)}>×</Button>
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
                  <tr><td colSpan={colCount} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Sin registros para los filtros seleccionados.</td></tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total ({filtradas.length})</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      <div>{formatCOP(filtradas.reduce((s, p) => s + (p.saldo ?? p.monto), 0))}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--text-faint)' }}>de {formatCOP(filtradas.reduce((s, p) => s + p.monto, 0))}</div>
                    </td>
                    <td />
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{formatCOP(filtradas.reduce((s, p) => s + p.monto * 0.004, 0))}</td>
                    {canWrite && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>

      {/* ── Modales ────────────────────────────────────────── */}
      <Modal open={modalForm !== null} title={modalForm === 'nueva' ? 'Nueva cuenta por pagar' : 'Editar cuenta'}
        onClose={() => setModalForm(null)}
        footer={<><Button variant="secondary" onClick={() => setModalForm(null)}>Cancelar</Button><Button onClick={guardar}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" value={fConcepto} onChange={(e) => setFConcepto(e.target.value)} required />
          <Input label="Beneficiario" value={fBenef} onChange={(e) => setFBenef(e.target.value)} required />
          <Select label="Tipo" options={tipoOptions} value={fTipo} onChange={(e) => setFTipo(e.target.value)} />
          <Input label="Monto" type="number" value={fMonto} onChange={(e) => setFMonto(e.target.value)} required />
          {fMonto && Number(fMonto) > 0 && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              4×1000: <strong>{formatCOP(Number(fMonto) * 0.004)}</strong> — Total real (con impuesto): <strong>{formatCOP(Number(fMonto) * 1.004)}</strong>
            </div>
          )}
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
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>{formatCOP(abonando.saldo ?? abonando.monto)}</p>
              </div>
            </div>
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} />
              <Input label="Monto a abonar" type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} required />
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
              {viendo.beneficiario} · {formatCOP(viendo.monto)}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export function FinanzasPage() {
  const canWrite = useCanWrite('finanzas')
  const { porPagar, porCobrar, prestamos } = useData()
  const [tab, setTab] = useState<Tab>('pagar')

  const totalPagar     = porPagar.filter((p) => p.estado !== 'rechazado' && p.estado !== 'pagado').reduce((s, p) => s + (p.saldo ?? p.monto), 0)
  const totalCobrar    = porCobrar.filter((c) => c.estado !== 'rechazado' && c.estado !== 'pagado').reduce((s, c) => s + (c.saldo ?? c.monto), 0)
  const saldoPrestamos = prestamos.reduce((s, p) => s + p.saldo, 0)
  const vencidasPagar  = porPagar.filter((p) => p.estado !== 'pagado' && p.estado !== 'rechazado' && p.fechaVencimiento < todayISO()).length

  return (
    <div className="page">
      <PageHeader title="Pagos y finanzas" subtitle="Cuentas por pagar, movimientos operativos y vencimientos." />
      {!canWrite && <ReadOnlyBanner />}

      {/* KPI principal — solo visible en pestaña "Cuentas por pagar" */}
      {tab === 'pagar' && (
        <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
          <KpiTile label="Por pagar (saldo)"  value={formatCOP(totalPagar)}    icon={<ArrowUpCircle size={16} />}   accent="rose"    />
          <KpiTile label="Por cobrar (saldo)" value={formatCOP(totalCobrar)}   icon={<ArrowDownCircle size={16} />} accent="emerald" />
          <KpiTile label="Saldo préstamos"    value={formatCOP(saldoPrestamos)} icon={<Landmark size={16} />}       accent="brown"   />
          <KpiTile label="Vencidas sin pagar" value={vencidasPagar}             icon={<Wallet size={16} />}         accent="amber"   />
        </div>
      )}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        {([{ key: 'pagar', label: 'Cuentas por pagar' }, { key: 'historico', label: 'Cuentas históricas' }] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagar'    && <PagarTab canWrite={canWrite} />}
      {tab === 'historico' && <HistoricoTab />}
    </div>
  )
}
