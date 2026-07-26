import React, { useRef, useState, type ChangeEvent } from 'react'
import { Building2, ChevronDown, ChevronUp, Landmark, Upload, Users2, Wallet } from 'lucide-react'
import '../dashboard/dashboard.css'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { CrudManager, type ColumnDef } from '@/components/common/CrudManager'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, todayISO } from '@/utils/format'
import {
  empleados as empMock, prestamosEmpleadoMock,
  type PrestamoEmpleadoMock,
} from '@/data/mock'
import type { Empleado, Planta } from '@/types'
import { TurnosSection } from './TurnosSection'

type Tab = 'quincenas' | 'prestamos_emp' | 'empleados' | 'plantas' | 'turnos'

// ── Quincena Row ─────────────────────────────────────────
interface QuincenaRow {
  empleadoId: number
  nombre: string
  labor: string
  salario: number
  bonificacion: number
  descuento: number
  neto: number
  estado: 'pendiente' | 'liquidado'
  comprobante: string | null
}

// ── Tab Quincenas ────────────────────────────────────────
function QuincenasTab({ canWrite }: { canWrite: boolean }) {
  const PERIODO = '2026-07-01 / 2026-07-15'

  const [quincenas, setQuincenas] = useState<QuincenaRow[]>(() =>
    empMock.map((e) => {
      const activos = prestamosEmpleadoMock.filter((p) => p.empleadoId === e.id && p.estado === 'activo')
      const desc    = activos.reduce((s, p) => s + p.cuota_quincenal, 0)
      return { empleadoId: e.id, nombre: e.nombre, labor: e.labor, salario: e.salario_quincenal, bonificacion: 0, descuento: desc, neto: e.salario_quincenal - desc, estado: 'pendiente', comprobante: null }
    })
  )
  const [filtroNomina, setFiltroNomina] = useState<'todos' | 'pendiente' | 'liquidado'>('todos')

  const [modalQ, setModalQ]           = useState<QuincenaRow | null>(null)
  const [comprobante, setComprobante] = useState<string | null>(null)
  const [errMsg, setErrMsg]           = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pendientes   = quincenas.filter((q) => q.estado === 'pendiente')
  const liquidados   = quincenas.filter((q) => q.estado === 'liquidado')
  const porPagar     = pendientes.reduce((s, q) => s + q.neto, 0)
  const quincenasFiltradas = filtroNomina === 'todos' ? quincenas : quincenas.filter((q) => q.estado === filtroNomina)

  // Modal bonificación
  const [bonifModal, setBonifModal] = useState<QuincenaRow | null>(null)
  const [bonifValor, setBonifValor] = useState('')

  const openModal = (q: QuincenaRow) => { setModalQ(q); setComprobante(q.comprobante); setErrMsg('') }

  const guardarBonif = () => {
    const b = Number(bonifValor)
    setQuincenas((prev) => prev.map((q) => q.empleadoId === bonifModal?.empleadoId
      ? { ...q, bonificacion: b, neto: q.salario + b - q.descuento }
      : q))
    setBonifModal(null)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setComprobante(f.name); setErrMsg('') }
  }

  const confirmar = () => {
    if (!comprobante) { setErrMsg('Debes adjuntar el comprobante antes de liquidar.'); return }
    setQuincenas((prev) => prev.map((q) => q.empleadoId === modalQ?.empleadoId ? { ...q, estado: 'liquidado', comprobante } : q))
    setModalQ(null)
  }


  return (
    <>
      {/* Filtro y resumen */}
      <div className="toolbar" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="segment">
          {([['todos', 'Todos'], ['pendiente', 'Pendientes'], ['liquidado', 'Liquidados']] as const).map(([v, l]) => (
            <button key={v} className={`segment__btn ${filtroNomina === v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroNomina(v)}>{l}</button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {pendientes.length} pendientes · {liquidados.length} liquidados · Por pagar: <strong>{formatCOP(porPagar)}</strong>
        </span>
      </div>

      <Card title={`Quincena ${PERIODO}`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Empleado</th><th>Labor</th>
                <th style={{ textAlign: 'right' }}>Salario</th>
                <th style={{ textAlign: 'right' }}>Bonificación</th>
                <th style={{ textAlign: 'right' }}>Desc. préstamo</th>
                <th style={{ textAlign: 'right' }}>Neto</th>
                <th>Estado</th><th>Comprobante</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {quincenasFiltradas.map((q, i) => (
                <tr key={q.empleadoId} style={q.estado === 'liquidado' ? { opacity: 0.6 } : undefined}>
                  <td className="mono" style={{ color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{q.nombre}</td>
                  <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{q.labor}</td>
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
                  <td style={{ fontSize: 'var(--fs-sm)', maxWidth: '9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.comprobante
                      ? <span style={{ color: 'var(--emerald-700)' }}>✓ {q.comprobante}</span>
                      : <em style={{ color: 'var(--text-faint)' }}>Sin adjunto</em>}
                  </td>
                  {canWrite && (
                    <td>
                      {q.estado === 'pendiente' && <Button size="sm" onClick={() => openModal(q)}>Pagar</Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({quincenasFiltradas.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{formatCOP(quincenasFiltradas.reduce((s, q) => s + q.salario, 0))}</td>
                <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">+ {formatCOP(quincenasFiltradas.reduce((s, q) => s + q.bonificacion, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">- {formatCOP(quincenasFiltradas.reduce((s, q) => s + q.descuento, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">{formatCOP(quincenasFiltradas.reduce((s, q) => s + q.neto, 0))}</td>
                <td colSpan={canWrite ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Modal bonificación */}
      <Modal open={!!bonifModal} title={`Bonificación — ${bonifModal?.nombre ?? ''}`} onClose={() => setBonifModal(null)}
        footer={<><Button variant="secondary" onClick={() => setBonifModal(null)}>Cancelar</Button><Button onClick={guardarBonif}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Monto de bonificación" type="number" placeholder="0" value={bonifValor} onChange={(e) => setBonifValor(e.target.value)} />
          {bonifValor && Number(bonifValor) > 0 && bonifModal && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              Neto con bonificación: <strong>{formatCOP(bonifModal.salario + Number(bonifValor) - bonifModal.descuento)}</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal pago */}
      <Modal open={!!modalQ} title={`Liquidar — ${modalQ?.nombre ?? ''}`} onClose={() => setModalQ(null)}
        footer={<><Button variant="secondary" onClick={() => setModalQ(null)}>Cancelar</Button><Button onClick={confirmar}>Confirmar liquidación</Button></>}>
        {modalQ && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Salario base</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatCOP(modalQ.salario)}</p>
              </div>
              {modalQ.descuento > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Descuento préstamo</p>
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
                <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                Comprobante de pago <span style={{ color: 'var(--rose-600)' }}>*</span>
              </p>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Obligatorio — no se puede liquidar sin comprobante.</p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Adjuntar</Button>
                {comprobante && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {comprobante}</span>}
              </div>
              {errMsg && <p style={{ color: 'var(--rose-600)', marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>⚠ {errMsg}</p>}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Tab Préstamos empleados ──────────────────────────────
function PrestamosEmpTab({ canWrite }: { canWrite: boolean }) {
  const [prestamos, setPrestamos] = useState<PrestamoEmpleadoMock[]>(prestamosEmpleadoMock)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [fpEmpId, setFpEmpId]   = useState('')
  const [fpConcepto, setFpConcepto] = useState('')
  const [fpValor, setFpValor]   = useState('')
  const [fpCuotas, setFpCuotas] = useState('')
  const [fpFecha, setFpFecha]   = useState(todayISO())

  const saveNuevo = () => {
    const val = Number(fpValor); const cuotas = Number(fpCuotas)
    if (!fpEmpId || !val || !cuotas) return
    const emp = empMock.find((e) => e.id === Number(fpEmpId))!
    const nuevo: PrestamoEmpleadoMock = {
      id: Date.now(), empleadoId: emp.id, concepto: fpConcepto || 'Préstamo',
      valor_total: val, cuotas_mensuales: cuotas,
      cuota_mensual: Math.round(val / cuotas),
      cuota_quincenal: Math.round(val / (cuotas * 2)),
      fecha_inicio: fpFecha, estado: 'activo', pagos: [],
    }
    setPrestamos((prev) => [...prev, nuevo])
    setModalNuevo(false)
    setFpEmpId(''); setFpConcepto(''); setFpValor(''); setFpCuotas('')
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
                <th>Empleado</th>
                <th>Concepto</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Pagado</th>
                <th style={{ minWidth: '7rem' }}>Progreso</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th style={{ textAlign: 'right' }}>Cuota quin.</th>
                <th></th>
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
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : p.id)}>
                      <td style={{ fontWeight: 600 }}>{emp?.nombre ?? '—'}</td>
                      <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{p.concepto}</td>
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
                      <td style={{ textAlign: 'right', color: saldo > 0 ? 'var(--rose-600)' : 'inherit', fontWeight: 700 }} className="mono">{formatCOP(saldo)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{formatCOP(p.cuota_quincenal)}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : p.id) }}>
                          {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0.75rem 1rem 1rem', background: 'var(--surface-page)' }}>
                          {p.pagos.length > 0 ? (
                            <table className="data-table" style={{ margin: 0 }}>
                              <thead><tr><th>Quincena</th><th style={{ textAlign: 'right' }}>Monto</th><th>Estado</th></tr></thead>
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
                            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin pagos registrados aún.</p>
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
              <span>Cuota quincenal: <strong>{formatCOP(Math.round(Number(fpValor) / (Number(fpCuotas) * 2)))}</strong></span>
            </div>
          )}
        </div>
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
    { key: 'quincenas',    label: 'Nómina / Quincenas'  },
    { key: 'prestamos_emp', label: 'Préstamos empleados' },
    { key: 'empleados',    label: 'Empleados'           },
    { key: 'plantas',      label: 'Plantas'             },
    { key: 'turnos',       label: 'Turnos'              },
  ]

  const empleadoCols: ColumnDef<Empleado>[] = [
    { key: 'nombre',     label: 'Nombre'   },
    { key: 'documento',  label: 'Doc.'     },
    { key: 'cargo',      label: 'Cargo'    },
    { key: 'plantaId',   label: 'Planta',  render: (e) => plantaName(e.plantaId)  },
    { key: 'salarioBase', label: 'Salario', render: (e) => formatCOP(e.salarioBase) },
    { key: 'activo',     label: 'Estado',  render: (e) => e.activo ? 'Activo' : 'Inactivo' },
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
        <KpiTile label="Empleados (planta)" value={empMock.length}             icon={<Users2 size={16} />}  accent="green"   />
        <KpiTile label="Nómina mensual"     value={formatCOP(nominaMensual)}    icon={<Wallet size={16} />}  accent="brown"   />
        <KpiTile label="Plantas / sedes"    value={plantas.length}              icon={<Building2 size={16}/>} accent="emerald" />
        <KpiTile label="Saldo préstamos"    value={formatCOP(saldoPrestamos)}   icon={<Landmark size={16}/>} accent="rose"    />
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
            { key: 'nombre',     label: 'Nombre completo', type: 'text',     required: true },
            { key: 'documento',  label: 'Documento',       type: 'text',     mono: true, required: true },
            { key: 'cargo',      label: 'Cargo',           type: 'text',     required: true },
            { key: 'plantaId',   label: 'Planta',          type: 'select',   options: plantaOptions, required: true },
            { key: 'salarioBase', label: 'Salario base',   type: 'number',   required: true },
            { key: 'activo',     label: 'Empleado activo', type: 'checkbox' },
          ]}
          mapCard={(e) => ({ title: e.nombre, subtitle: `${e.cargo} · ${plantaName(e.plantaId)} · ${formatCOP(e.salarioBase)}`, status: <span className={`badge badge--${e.activo ? 'success' : 'neutral'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span> })}
          onCreate={(vals) => add('empleados', { id: `em${Date.now()}`, ...(vals as object) } as Empleado)}
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
