import React, { useEffect, useRef, useState, useMemo, type ChangeEvent } from 'react'
import { Building2, ChevronDown, ChevronUp, Landmark, Upload, Users2, Wallet } from 'lucide-react'
import '../dashboard/dashboard.css'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { CrudManager, type ColumnDef } from '@/components/common/CrudManager'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  empleados as empMock, prestamosEmpleadoMock,
  type PrestamoEmpleadoMock,
} from '@/data/mock'
import type { Empleado, Planta } from '@/types'
import { TurnosSection } from './TurnosSection'

type Tab = 'quincenas' | 'prestamos_emp' | 'empleados' | 'plantas' | 'turnos'

const VALOR_HORA = 8_000
const RECARGO: Record<string, number> = { diurno: 1, tarde: 1.25, nocturno: 1.35 }
const LS_KEY = 'molinos_nomina_quincenas_v1'

interface QuincenaRow {
  empleadoId: string
  nombre: string
  labor: string
  tipoContrato: 'hora' | 'fijo'
  salario: number
  bonificacion: number
  descuento: number
  neto: number
  estado: 'pendiente' | 'liquidado'
  comprobante: string | null
}

const formatMes = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' })
}

// ── Tab Quincenas ────────────────────────────────────────
function QuincenasTab({ canWrite }: { canWrite: boolean }) {
  const { empleados, prestamosEmpleado, turnos } = useData()

  const [vista, setVista] = useState<'quincena' | 'mensual'>('quincena')

  // Quincena view
  const [mes,      setMes]      = useState(todayISO().slice(0, 7))
  const [quincena, setQuincena] = useState<'q1' | 'q2'>('q1')
  const periodoKey = `${mes}-${quincena}`

  // Mensual view
  const [mesMensual, setMesMensual] = useState(todayISO().slice(0, 7))

  const [year, month] = mes.split('-').map(Number)
  const lastDay   = new Date(year, month, 0).getDate()
  const diasRango = quincena === 'q1' ? '1–15' : `16–${lastDay}`
  const periodoLabel = `${mes} · Q${quincena === 'q1' ? 1 : 2} (${diasRango})`

  // Datos persistidos en localStorage
  const [periodoData, setPeriodoData] = useState<Record<string, QuincenaRow[]>>(() => {
    try {
      const s = localStorage.getItem(LS_KEY)
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(periodoData))
  }, [periodoData])

  // Filtros (quincena view)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'liquidado'>('todos')
  const [busqueda,     setBusqueda]     = useState('')

  // Inicializar periodo
  useEffect(() => {
    if (periodoData[periodoKey]) return
    const [y, m] = mes.split('-').map(Number)
    const ld = new Date(y, m, 0).getDate()
    const diasQ = quincena === 'q1'
      ? Array.from({ length: 15 }, (_, i) => i + 1)
      : Array.from({ length: ld - 15 }, (_, i) => i + 16)
    const fechas = new Set(diasQ.map((d) => `${mes}-${String(d).padStart(2, '0')}`))

    const rows: QuincenaRow[] = empleados.filter((e) => e.activo).map((emp) => {
      const esFijo = emp.tipoContrato === 'fijo'
      let salario: number
      if (esFijo) {
        salario = emp.salarioBase / 2
      } else {
        const ts = turnos.filter((t) => t.empleadoId === emp.id && fechas.has(t.fecha) && t.presente)
        const fromTurnos = ts.reduce((s, t) => s + t.horas * VALOR_HORA * (RECARGO[t.tipo] ?? 1), 0)
        salario = fromTurnos > 0 ? fromTurnos : emp.salarioBase / 2
      }
      const desc = prestamosEmpleado
        .filter((p) => p.empleadoId === emp.id && p.estado === 'aprobado')
        .reduce((s, p) => s + p.descuentoQuincenal, 0)
      return {
        empleadoId: emp.id, nombre: emp.nombre, labor: emp.cargo,
        tipoContrato: emp.tipoContrato ?? 'hora',
        salario, bonificacion: 0, descuento: desc,
        neto: salario - desc, estado: 'pendiente', comprobante: null,
      }
    })
    setPeriodoData((prev) => ({ ...prev, [periodoKey]: rows }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoKey])

  const allRows  = periodoData[periodoKey] ?? []
  // Quincena view: solo empleados por hora
  const horaRows = allRows.filter(r => r.tipoContrato === 'hora')
  const setRows  = (updater: (prev: QuincenaRow[]) => QuincenaRow[]) =>
    setPeriodoData((prev) => ({ ...prev, [periodoKey]: updater(prev[periodoKey] ?? []) }))

  const filtradas = useMemo(() => horaRows.filter((q) => {
    if (filtroEstado !== 'todos' && q.estado !== filtroEstado) return false
    if (busqueda && !q.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [horaRows, filtroEstado, busqueda])

  const pendientesHora = horaRows.filter(q => q.estado === 'pendiente')
  const porPagar       = pendientesHora.reduce((s, q) => s + q.neto, 0)

  // Modal bonificación
  const [bonifModal, setBonifModal] = useState<QuincenaRow | null>(null)
  const [bonifValor, setBonifValor] = useState('')
  const guardarBonif = () => {
    const b = Number(bonifValor)
    setRows(prev => prev.map(q =>
      q.empleadoId === bonifModal?.empleadoId ? { ...q, bonificacion: b, neto: q.salario + b - q.descuento } : q
    ))
    setBonifModal(null)
  }

  // Modal pago quincena (por hora)
  const [modalQ,      setModalQ]      = useState<QuincenaRow | null>(null)
  const [comprobante, setComprobante] = useState<string | null>(null)
  const [errMsg,      setErrMsg]      = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const openModal  = (q: QuincenaRow) => { setModalQ(q); setComprobante(q.comprobante); setErrMsg('') }
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setComprobante(f.name); setErrMsg('') }
  }
  const confirmar = () => {
    if (!comprobante) { setErrMsg('Debes adjuntar el comprobante.'); return }
    setRows(prev => prev.map(q =>
      q.empleadoId === modalQ?.empleadoId ? { ...q, estado: 'liquidado', comprobante } : q
    ))
    setModalQ(null)
  }

  // ── Vista mensual ─────────────────────────────────────
  const [ymMensual, mmMensual] = mesMensual.split('-').map(Number)
  const lastDayMensual = new Date(ymMensual, mmMensual, 0).getDate()

  const mesalRows = useMemo(() => {
    const q1Rows = periodoData[`${mesMensual}-q1`] ?? []
    const q2Rows = periodoData[`${mesMensual}-q2`] ?? []
    return empleados.filter(e => e.activo).map(emp => {
      const r1 = q1Rows.find(r => r.empleadoId === emp.id)
      const r2 = q2Rows.find(r => r.empleadoId === emp.id)
      const esFijo = emp.tipoContrato === 'fijo'
      const desc = prestamosEmpleado
        .filter(p => p.empleadoId === emp.id && p.estado === 'aprobado')
        .reduce((s, p) => s + p.descuentoQuincenal, 0)
      const netoQ1 = r1?.estado === 'liquidado' ? r1.neto : 0
      const netoQ2 = r2?.estado === 'liquidado' ? r2.neto : 0
      return {
        empId: emp.id, nombre: emp.nombre, labor: emp.cargo,
        esFijo, salarioMensual: emp.salarioBase,
        netoEsperado: emp.salarioBase - desc * 2,
        r1, r2, netoQ1, netoQ2,
        totalPagado: netoQ1 + netoQ2,
        q1Liq: r1?.estado === 'liquidado',
        q2Liq: r2?.estado === 'liquidado',
        ambos: r1?.estado === 'liquidado' && r2?.estado === 'liquidado',
      }
    })
  }, [mesMensual, periodoData, empleados, prestamosEmpleado])

  // "Pagar mes" para empleados fijos
  const [pagarMesId,    setPagarMesId]    = useState<string | null>(null)
  const [pagarMesFecha, setPagarMesFecha] = useState(todayISO())
  const [pagarMesComp,  setPagarMesComp]  = useState('')
  const fileRefMes = useRef<HTMLInputElement>(null)
  const handleFileMes = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) setPagarMesComp(f.name)
  }
  const abrirPagarMes = (empId: string) => {
    setPagarMesId(empId); setPagarMesFecha(todayISO()); setPagarMesComp('')
  }
  const confirmarMes = () => {
    if (!pagarMesId) return
    const emp  = empleados.find(e => e.id === pagarMesId)!
    const desc = prestamosEmpleado
      .filter(p => p.empleadoId === pagarMesId && p.estado === 'aprobado')
      .reduce((s, p) => s + p.descuentoQuincenal, 0)
    const salario = emp.salarioBase / 2
    const neto    = salario - desc
    const comp    = pagarMesComp || `Pago mensual ${mesMensual}`
    setPeriodoData(prev => {
      const nd = { ...prev }
      for (const q of ['q1', 'q2'] as const) {
        const key      = `${mesMensual}-${q}`
        const existing = prev[key] ?? []
        const hasRow   = existing.some(r => r.empleadoId === pagarMesId)
        nd[key] = hasRow
          ? existing.map(r => r.empleadoId === pagarMesId ? { ...r, estado: 'liquidado' as const, comprobante: comp } : r)
          : [...existing, {
              empleadoId: pagarMesId, nombre: emp.nombre, labor: emp.cargo,
              tipoContrato: 'fijo' as const, salario, bonificacion: 0, descuento: desc,
              neto, estado: 'liquidado' as const, comprobante: comp,
            }]
      }
      return nd
    })
    setPagarMesId(null)
  }

  // Historial de meses
  const historialMeses = useMemo(() => {
    const meses = new Set<string>()
    Object.keys(periodoData).forEach(k => meses.add(k.slice(0, 7)))
    return Array.from(meses).sort().reverse().map(m => {
      const q1 = periodoData[`${m}-q1`] ?? []
      const q2 = periodoData[`${m}-q2`] ?? []
      const totalPagado = [...q1, ...q2].filter(r => r.estado === 'liquidado').reduce((s, r) => s + r.neto, 0)
      const empCount    = new Set([...q1, ...q2].filter(r => r.estado === 'liquidado').map(r => r.empleadoId)).size
      return { mes: m, totalPagado, empCount }
    }).filter(m => m.totalPagado > 0)
  }, [periodoData])

  return (
    <>
      {/* Barra de control */}
      <Card flush>
        <div className="toolbar" style={{ padding: '0.75rem 1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Vista</span>
            <div className="segment">
              <button className={`segment__btn ${vista === 'quincena' ? 'segment__btn--active' : ''}`} onClick={() => setVista('quincena')}>Por quincena</button>
              <button className={`segment__btn ${vista === 'mensual'  ? 'segment__btn--active' : ''}`} onClick={() => setVista('mensual')}>Vista mensual</button>
            </div>
          </div>

          {vista === 'quincena' ? (
            <>
              <div style={{ maxWidth: '12rem' }}>
                <Input label="Mes y año" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
              </div>
              <div>
                <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Quincena</span>
                <div className="segment">
                  <button className={`segment__btn ${quincena === 'q1' ? 'segment__btn--active' : ''}`} onClick={() => setQuincena('q1')}>Q1 — 1 al 15</button>
                  <button className={`segment__btn ${quincena === 'q2' ? 'segment__btn--active' : ''}`} onClick={() => setQuincena('q2')}>Q2 — 16 al {lastDay}</button>
                </div>
              </div>
              <div style={{ flex: '1 1 12rem' }}>
                <Input label="Buscar" placeholder="Nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <div className="segment">
                  {([['todos', 'Todos'], ['pendiente', 'Pendientes'], ['liquidado', 'Liquidados']] as const).map(([v, l]) => (
                    <button key={v} className={`segment__btn ${filtroEstado === v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroEstado(v)}>{l}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ maxWidth: '12rem' }}>
              <Input label="Mes" type="month" value={mesMensual} onChange={(e) => setMesMensual(e.target.value)} />
            </div>
          )}
        </div>
        {vista === 'quincena' && (
          <div style={{ padding: '0.25rem 1rem 0.75rem', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>{pendientesHora.length} pendientes · {horaRows.filter(q => q.estado === 'liquidado').length} liquidados</span>
            <span>Por pagar: <strong style={{ color: 'var(--rose-600)' }}>{formatCOP(porPagar)}</strong></span>
            <span style={{ color: 'var(--text-faint)' }}>Solo empleados por hora — fijos se gestionan en "Vista mensual"</span>
          </div>
        )}
      </Card>

      {/* ── Vista quincena (por hora) ─────────────────── */}
      {vista === 'quincena' && (
        <div style={{ marginTop: '1rem' }}>
          <Card title={`Nómina por hora — ${periodoLabel} (${filtradas.length})`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th style={{ textAlign: 'right' }}>Salario</th>
                    <th style={{ textAlign: 'right' }}>Bonificación</th>
                    <th style={{ textAlign: 'right' }}>Desc. préstamo</th>
                    <th style={{ textAlign: 'right' }}>Neto</th>
                    <th>Estado</th>
                    {canWrite && <th />}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((q) => (
                    <tr key={q.empleadoId} style={q.estado === 'liquidado' ? { opacity: 0.6 } : undefined}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.nombre}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{q.labor}</div>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(q.salario)}</td>
                      <td style={{ textAlign: 'right', color: q.bonificacion > 0 ? 'var(--emerald-700)' : 'var(--text-faint)' }} className="mono">
                        {q.bonificacion > 0 ? (
                          <button className="btn btn--ghost btn--sm" onClick={() => { setBonifModal(q); setBonifValor(String(q.bonificacion)) }}>
                            + {formatCOP(q.bonificacion)}
                          </button>
                        ) : canWrite ? (
                          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--text-faint)' }} onClick={() => { setBonifModal(q); setBonifValor('') }}>+ Agregar</button>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: q.descuento > 0 ? 'var(--rose-600)' : undefined }} className="mono">
                        {q.descuento > 0 ? `- ${formatCOP(q.descuento)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">{formatCOP(q.neto)}</td>
                      <td>
                        <span className={`badge ${q.estado === 'liquidado' ? 'badge--success' : 'badge--warning'}`}>
                          {q.estado === 'liquidado' ? 'Liquidado' : 'Pendiente'}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          {q.estado === 'pendiente' && <Button size="sm" onClick={() => openModal(q)}>Pagar</Button>}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtradas.length === 0 && (
                    <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>
                      Sin empleados por hora para este periodo.
                    </td></tr>
                  )}
                </tbody>
                {filtradas.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td>Total ({filtradas.length})</td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(filtradas.reduce((s, q) => s + q.salario, 0))}</td>
                      <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">+ {formatCOP(filtradas.reduce((s, q) => s + q.bonificacion, 0))}</td>
                      <td style={{ textAlign: 'right' }} className="mono">- {formatCOP(filtradas.reduce((s, q) => s + q.descuento, 0))}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(filtradas.reduce((s, q) => s + q.neto, 0))}</td>
                      <td colSpan={canWrite ? 2 : 1} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Vista mensual (todos) ─────────────────────── */}
      {vista === 'mensual' && (
        <div style={{ marginTop: '1rem' }}>
          <Card title={`Nómina mensual — ${formatMes(mesMensual)}`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Contrato</th>
                    <th style={{ textAlign: 'right' }}>Q1 (1–15)</th>
                    <th style={{ textAlign: 'right' }}>Q2 (16–{lastDayMensual})</th>
                    <th style={{ textAlign: 'right' }}>Total pagado</th>
                    <th style={{ textAlign: 'right' }}>Salario mes</th>
                    <th>Estado</th>
                    {canWrite && <th style={{ textAlign: 'right' }} />}
                  </tr>
                </thead>
                <tbody>
                  {mesalRows.map((r) => {
                    const estado = r.ambos ? 'liquidado' : (r.q1Liq || r.q2Liq) ? 'parcial' : 'pendiente'
                    return (
                      <tr key={r.empId} style={r.ambos ? { opacity: 0.65 } : undefined}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{r.labor}</div>
                        </td>
                        <td>
                          <span className={`badge ${r.esFijo ? 'badge--info' : 'badge--neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {r.esFijo ? 'FIJO' : 'POR HORA'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {r.q1Liq
                            ? <span style={{ color: 'var(--emerald-700)', fontWeight: 600 }}>{formatCOP(r.netoQ1)} ✓</span>
                            : <span style={{ color: 'var(--text-faint)' }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {r.q2Liq
                            ? <span style={{ color: 'var(--emerald-700)', fontWeight: 600 }}>{formatCOP(r.netoQ2)} ✓</span>
                            : <span style={{ color: 'var(--text-faint)' }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">
                          {r.totalPagado > 0
                            ? formatCOP(r.totalPagado)
                            : <span style={{ color: 'var(--text-faint)' }}>$0</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">
                          {formatCOP(r.salarioMensual)}
                        </td>
                        <td>
                          <span className={`badge ${estado === 'liquidado' ? 'badge--success' : estado === 'parcial' ? 'badge--warning' : 'badge--neutral'}`}>
                            {estado === 'liquidado' ? 'Completo' : estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                          </span>
                        </td>
                        {canWrite && (
                          <td style={{ textAlign: 'right' }}>
                            {r.esFijo && !r.ambos && (
                              <Button size="sm" onClick={() => abrirPagarMes(r.empId)}>
                                {r.q1Liq || r.q2Liq ? 'Completar mes' : 'Pagar mes'}
                              </Button>
                            )}
                            {!r.esFijo && !r.ambos && (
                              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>Pagar en Quincena</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4}>Total {formatMes(mesMensual)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(mesalRows.reduce((s, r) => s + r.totalPagado, 0))}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(mesalRows.reduce((s, r) => s + r.salarioMensual, 0))}</td>
                    <td colSpan={canWrite ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Historial de meses */}
          {historialMeses.length > 0 && (
            <div style={{ marginTop: '1rem' }}><Card title="Historial de pagos">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th style={{ textAlign: 'center' }}>Empleados pagados</th>
                      <th style={{ textAlign: 'right' }}>Total nómina pagada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialMeses.map((h) => (
                      <tr key={h.mes} style={{ cursor: 'pointer' }} onClick={() => setMesMensual(h.mes)}>
                        <td style={{ fontWeight: 600 }}>
                          {formatMes(h.mes)}
                          {h.mes === mesMensual && (
                            <span className="badge badge--info" style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>viendo</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>{h.empCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">
                          {formatCOP(h.totalPagado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', padding: '0.5rem 1rem 0.75rem' }}>
                Haz clic en un mes para verlo en detalle arriba.
              </p>
            </Card></div>
          )}
        </div>
      )}

      {/* Modal bonificación */}
      <Modal open={!!bonifModal} title={`Bonificación — ${bonifModal?.nombre ?? ''}`} onClose={() => setBonifModal(null)}
        footer={<><Button variant="secondary" onClick={() => setBonifModal(null)}>Cancelar</Button><Button onClick={guardarBonif}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Monto" type="number" placeholder="0" value={bonifValor} onChange={(e) => setBonifValor(e.target.value)} />
          {bonifValor && Number(bonifValor) > 0 && bonifModal && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              Neto con bonificación: <strong>{formatCOP(bonifModal.salario + Number(bonifValor) - bonifModal.descuento)}</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal pago quincena (por hora) */}
      <Modal open={!!modalQ} title={`Liquidar — ${modalQ?.nombre ?? ''}`} onClose={() => setModalQ(null)}
        footer={<><Button variant="secondary" onClick={() => setModalQ(null)}>Cancelar</Button><Button onClick={confirmar}>Confirmar liquidación</Button></>}>
        {modalQ && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Salario</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatCOP(modalQ.salario)}</p>
              </div>
              {modalQ.bonificacion > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Bonificación</p>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--emerald-700)' }}>+ {formatCOP(modalQ.bonificacion)}</p>
                </div>
              )}
              {modalQ.descuento > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Desc. préstamo</p>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>- {formatCOP(modalQ.descuento)}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Neto a pagar</p>
                <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--emerald-700)' }}>{formatCOP(modalQ.neto)}</p>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                Comprobante <span style={{ color: 'var(--rose-600)' }}>*</span>
              </p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Adjuntar</Button>
                {comprobante && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {comprobante}</span>}
              </div>
              {errMsg && <p style={{ color: 'var(--rose-600)', marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>⚠ {errMsg}</p>}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pagar mes (empleados fijos) */}
      <Modal
        open={pagarMesId !== null}
        title={`Pagar mes — ${empleados.find(e => e.id === pagarMesId)?.nombre ?? ''}`}
        onClose={() => setPagarMesId(null)}
        footer={<><Button variant="secondary" onClick={() => setPagarMesId(null)}>Cancelar</Button><Button onClick={confirmarMes}>Confirmar pago mensual</Button></>}
      >
        {pagarMesId && (() => {
          const emp  = empleados.find(e => e.id === pagarMesId)
          const desc = prestamosEmpleado
            .filter(p => p.empleadoId === pagarMesId && p.estado === 'aprobado')
            .reduce((s, p) => s + p.descuentoQuincenal, 0)
          const neto = (emp?.salarioBase ?? 0) - desc * 2
          return (
            <div className="stack">
              <div className="grid grid--form">
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Salario mensual</p>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatCOP(emp?.salarioBase ?? 0)}</p>
                </div>
                {desc > 0 && (
                  <div>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Desc. préstamo (mes)</p>
                    <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>- {formatCOP(desc * 2)}</p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Neto mensual</p>
                  <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--emerald-700)' }}>{formatCOP(neto)}</p>
                </div>
              </div>
              <Input label="Fecha de pago" type="date" value={pagarMesFecha} onChange={(e) => setPagarMesFecha(e.target.value)} />
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Comprobante (opcional)</p>
                <input ref={fileRefMes} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileMes} />
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRefMes.current?.click()}>Adjuntar</Button>
                  {pagarMesComp && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {pagarMesComp}</span>}
                </div>
              </div>
              <div className="callout">
                Se registrará el pago de Q1 y Q2 de <strong>{formatMes(mesMensual)}</strong> como <strong>Liquidado</strong>.
              </div>
            </div>
          )
        })()}
      </Modal>
    </>
  )
}

// ── Tab Préstamos empleados ──────────────────────────────
function PrestamosEmpTab({ canWrite }: { canWrite: boolean }) {
  const [prestamos, setPrestamos] = useState<PrestamoEmpleadoMock[]>(prestamosEmpleadoMock)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [fpEmpId,    setFpEmpId]    = useState('')
  const [fpConcepto, setFpConcepto] = useState('')
  const [fpValor,    setFpValor]    = useState('')
  const [fpCuotas,   setFpCuotas]   = useState('')
  const [fpFecha,    setFpFecha]    = useState(todayISO())

  const [abonandoId, setAbonandoId] = useState<number | null>(null)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoFecha, setAbonoFecha] = useState(todayISO())
  const [abonoNota,  setAbonoNota]  = useState('')
  const [abonoErr,   setAbonoErr]   = useState('')

  const saveNuevo = () => {
    const val = Number(fpValor); const cuotas = Number(fpCuotas)
    if (!fpEmpId || !val || !cuotas) return
    const emp = empMock.find((e) => e.id === Number(fpEmpId))!
    setPrestamos((prev) => [...prev, {
      id: Date.now(), empleadoId: emp.id, concepto: fpConcepto || 'Préstamo',
      valor_total: val, cuotas_mensuales: cuotas,
      cuota_mensual: Math.round(val / cuotas),
      cuota_quincenal: Math.round(val / (cuotas * 2)),
      fecha_inicio: fpFecha, estado: 'activo', pagos: [],
    }])
    setModalNuevo(false)
    setFpEmpId(''); setFpConcepto(''); setFpValor(''); setFpCuotas('')
  }

  const abrirAbono = (id: number) => {
    setAbonandoId(id); setAbonoMonto(''); setAbonoFecha(todayISO()); setAbonoNota(''); setAbonoErr('')
  }
  const confirmarAbono = () => {
    const monto = Number(abonoMonto)
    const p = prestamos.find((x) => x.id === abonandoId)!
    const pagado = p.pagos.filter((x) => x.estado === 'pagado').reduce((s, x) => s + x.monto, 0)
    const saldo  = p.valor_total - pagado
    if (!monto || monto <= 0) { setAbonoErr('Ingresa un monto válido.'); return }
    if (monto > saldo) { setAbonoErr(`El abono supera el saldo (${formatCOP(saldo)}).`); return }
    setPrestamos((prev) => prev.map((x) => x.id === abonandoId
      ? { ...x, pagos: [...x.pagos, { quincena: `Abono extra ${formatDate(abonoFecha)}${abonoNota ? ' — ' + abonoNota : ''}`, monto, estado: 'pagado' as const }] }
      : x
    ))
    setAbonandoId(null)
  }

  const calcPagado = (p: PrestamoEmpleadoMock) => p.pagos.filter((x) => x.estado === 'pagado').reduce((s, x) => s + x.monto, 0)
  const calcPct    = (p: PrestamoEmpleadoMock) => Math.min(100, Math.round((calcPagado(p) / p.valor_total) * 100))

  return (
    <>
      <Card
        title="Préstamos activos"
        actions={canWrite && <Button size="sm" icon={<Landmark size={16} />} onClick={() => setModalNuevo(true)}>Nuevo préstamo</Button>}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empleado · Concepto</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Pagado</th>
                <th style={{ minWidth: '7rem' }}>Progreso</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th style={{ textAlign: 'right' }}>Cuota quin.</th>
                <th style={{ textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => {
                const emp      = empMock.find((e) => e.id === p.empleadoId)
                const pagado   = calcPagado(p)
                const saldo    = p.valor_total - pagado
                const pctVal   = calcPct(p)
                const expanded = expandedId === p.id
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp?.nombre ?? '—'}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{p.concepto} · desde {formatDate(p.fecha_inicio)}</div>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(p.valor_total)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">{formatCOP(pagado)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: 7, background: 'var(--slate-100)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctVal}%`, background: pctVal === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, flexShrink: 0 }}>{pctVal}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: saldo > 0 ? 'var(--rose-600)' : undefined, fontWeight: 700 }} className="mono">{formatCOP(saldo)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(p.cuota_quincenal)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          {canWrite && saldo > 0 && <Button size="sm" onClick={() => abrirAbono(p.id)}>Abonar</Button>}
                          <Button variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : p.id)}>
                            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0.75rem 1rem 1rem', background: 'var(--surface-page)' }}>
                          {p.pagos.length > 0 ? (
                            <table className="data-table" style={{ margin: 0 }}>
                              <thead><tr><th>Quincena / Abono</th><th style={{ textAlign: 'right' }}>Monto</th><th>Estado</th></tr></thead>
                              <tbody>
                                {p.pagos.map((pago, i) => (
                                  <tr key={i}>
                                    <td style={{ fontSize: 'var(--fs-sm)' }}>{pago.quincena}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(pago.monto)}</td>
                                    <td><span className={`badge ${pago.estado === 'pagado' ? 'badge--success' : 'badge--warning'}`}>{pago.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin pagos registrados.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalNuevo} title="Nuevo préstamo a empleado" onClose={() => setModalNuevo(false)}
        footer={<><Button variant="secondary" onClick={() => setModalNuevo(false)}>Cancelar</Button><Button onClick={saveNuevo}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Empleado"
            options={[{ value: '', label: 'Selecciona…' }, ...empMock.map((e) => ({ value: String(e.id), label: e.nombre }))]}
            value={fpEmpId} onChange={(e) => setFpEmpId(e.target.value)} required />
          <Input label="Concepto" placeholder="Préstamo personal" value={fpConcepto} onChange={(e) => setFpConcepto(e.target.value)} />
          <Input label="Valor total" type="number" value={fpValor} onChange={(e) => setFpValor(e.target.value)} required />
          <Input label="Cuotas mensuales" type="number" placeholder="6" value={fpCuotas} onChange={(e) => setFpCuotas(e.target.value)} required />
          <Input label="Fecha inicio" type="date" value={fpFecha} onChange={(e) => setFpFecha(e.target.value)} />
          {fpValor && fpCuotas && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              Cuota quincenal: <strong>{formatCOP(Math.round(Number(fpValor) / (Number(fpCuotas) * 2)))}</strong>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={abonandoId !== null} title="Registrar abono extra" onClose={() => setAbonandoId(null)}
        footer={<><Button variant="secondary" onClick={() => setAbonandoId(null)}>Cancelar</Button><Button onClick={confirmarAbono}>Confirmar abono</Button></>}>
        {abonandoId !== null && (() => {
          const p = prestamos.find((x) => x.id === abonandoId)
          if (!p) return null
          const pagado = calcPagado(p)
          const saldo  = p.valor_total - pagado
          return (
            <div className="stack">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Saldo pendiente</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>{formatCOP(saldo)}</p>
              </div>
              <div className="grid grid--form">
                <Input label="Fecha del abono" type="date" value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} />
                <Input label="Monto a abonar" type="number" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} required />
                {abonoMonto && Number(abonoMonto) > 0 && (
                  <div className="callout" style={{ gridColumn: '1/-1' }}>
                    Saldo después: <strong>{formatCOP(Math.max(0, saldo - Number(abonoMonto)))}</strong>
                  </div>
                )}
                <Input label="Nota (opcional)" placeholder="Pago voluntario…" value={abonoNota} onChange={(e) => setAbonoNota(e.target.value)} style={{ gridColumn: '1/-1' }} />
              </div>
              {abonoErr && <p style={{ color: 'var(--rose-600)', fontSize: 'var(--fs-sm)' }}>⚠ {abonoErr}</p>}
            </div>
          )
        })()}
      </Modal>
    </>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export function NominaPage() {
  const canWrite = useCanWrite('nomina')
  const { empleados, plantas, add, update, remove } = useData()
  const [tab, setTab] = useState<Tab>('quincenas')

  const plantaOptions = plantas.map((p) => ({ value: p.id, label: p.nombre }))
  const plantaName    = (id: string) => plantas.find((p) => p.id === id)?.nombre ?? '—'

  const nominaMensual  = empMock.reduce((s, e) => s + e.salario_quincenal * 2, 0)
  const saldoPrestamos = prestamosEmpleadoMock.filter((p) => p.estado === 'activo')
    .reduce((s, p) => s + (p.valor_total - p.pagos.filter((x) => x.estado === 'pagado').reduce((a, x) => a + x.monto, 0)), 0)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'quincenas',     label: 'Nómina / Quincenas'  },
    { key: 'prestamos_emp', label: 'Préstamos empleados' },
    { key: 'empleados',     label: 'Empleados'           },
    { key: 'plantas',       label: 'Plantas'             },
    { key: 'turnos',        label: 'Turnos'              },
  ]

  const tipoContratoOptions = [
    { value: 'hora', label: 'Por hora (variable)' },
    { value: 'fijo', label: 'Salario fijo mensual' },
  ]

  const empleadoCols: ColumnDef<Empleado>[] = [
    { key: 'nombre',       label: 'Nombre'    },
    { key: 'documento',    label: 'Doc.'      },
    { key: 'cargo',        label: 'Cargo'     },
    { key: 'plantaId',     label: 'Planta',   render: (e) => plantaName(e.plantaId) },
    { key: 'tipoContrato', label: 'Contrato', render: (e) => (
      <span className={`badge ${e.tipoContrato === 'fijo' ? 'badge--info' : 'badge--neutral'}`} style={{ fontSize: '0.65rem' }}>
        {e.tipoContrato === 'fijo' ? 'FIJO' : 'POR HORA'}
      </span>
    )},
    { key: 'salarioBase',  label: 'Salario',  render: (e) => formatCOP(e.salarioBase) },
    { key: 'activo',       label: 'Estado',   render: (e) => e.activo ? 'Activo' : 'Inactivo' },
  ]

  const plantaCols: ColumnDef<Planta>[] = [
    { key: 'nombre',    label: 'Planta'    },
    { key: 'ubicacion', label: 'Ubicación' },
  ]

  return (
    <div className="page">
      <PageHeader title="Nómina y recursos humanos" subtitle="Quincenas, préstamos, empleados y turnos." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
        <KpiTile label="Empleados activos" value={empleados.filter(e => e.activo).length} icon={<Users2 size={16} />}   accent="green"   />
        <KpiTile label="Nómina mensual"    value={formatCOP(nominaMensual)}               icon={<Wallet size={16} />}   accent="brown"   />
        <KpiTile label="Plantas / sedes"   value={plantas.length}                         icon={<Building2 size={16} />} accent="emerald" />
        <KpiTile label="Saldo préstamos"   value={formatCOP(saldoPrestamos)}              icon={<Landmark size={16} />}  accent="rose"    />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'quincenas'     && <QuincenasTab    canWrite={canWrite} />}
      {tab === 'prestamos_emp' && <PrestamosEmpTab canWrite={canWrite} />}

      {tab === 'empleados' && (
        <CrudManager<Empleado>
          title="Empleados" addLabel="Nuevo empleado" canWrite={canWrite}
          items={empleados} columns={empleadoCols}
          fields={[
            { key: 'nombre',       label: 'Nombre completo',      type: 'text',     required: true },
            { key: 'documento',    label: 'Documento',            type: 'text',     mono: true, required: true },
            { key: 'cargo',        label: 'Cargo',                type: 'text',     required: true },
            { key: 'plantaId',     label: 'Planta',               type: 'select',   options: plantaOptions, required: true },
            { key: 'tipoContrato', label: 'Tipo de contrato',     type: 'select',   options: tipoContratoOptions },
            { key: 'salarioBase',  label: 'Salario base mensual', type: 'number',   required: true },
            { key: 'activo',       label: 'Empleado activo',      type: 'checkbox' },
          ]}
          mapCard={(e) => ({
            title: e.nombre,
            subtitle: `${e.cargo} · ${plantaName(e.plantaId)} · ${e.tipoContrato === 'fijo' ? 'Fijo' : 'Por hora'} · ${formatCOP(e.salarioBase)}`,
            status: <span className={`badge badge--${e.activo ? 'success' : 'neutral'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span>,
          })}
          onCreate={(vals) => add('empleados', { id: `em${Date.now()}`, tipoContrato: 'hora', ...(vals as object) } as Empleado)}
          onUpdate={(id, vals) => update('empleados', id, vals as Partial<Empleado>)}
          onDelete={(id) => remove('empleados', id)}
        />
      )}

      {tab === 'plantas' && (
        <CrudManager<Planta>
          title="Plantas / sedes" addLabel="Nueva planta" canWrite={canWrite}
          items={plantas} columns={plantaCols}
          fields={[
            { key: 'nombre',    label: 'Nombre de la planta', type: 'text', required: true },
            { key: 'ubicacion', label: 'Ubicación',           type: 'text', required: true },
          ]}
          mapCard={(p) => ({ title: p.nombre, subtitle: p.ubicacion })}
          onCreate={(vals) => add('plantas', { id: `pl${Date.now()}`, ...(vals as object) } as Planta)}
          onUpdate={(id, vals) => update('plantas', id, vals as Partial<Planta>)}
          onDelete={(id) => remove('plantas', id)}
        />
      )}

      {tab === 'turnos' && <TurnosSection />}
    </div>
  )
}
