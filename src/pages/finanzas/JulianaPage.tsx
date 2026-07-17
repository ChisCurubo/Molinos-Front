import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Calculator, ChevronDown, ChevronUp, CreditCard, Landmark, LayoutList, Upload, Users2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { formatCOP, formatDate, todayISO, calc4x1000inv } from '@/utils/format'
import {
  empleados, prestamosEmpleadoMock, aguaMock, viajesMock,
  calc4x1000, calc4x1000Inverso,
  type PrestamoEmpleadoMock,
} from '@/data/mock'

const cop = formatCOP

// ===================================================
// Types locales
// ===================================================
type QuincenaEstado = 'pendiente' | 'liquidado'
interface QuincenaRow {
  empleadoId: number
  nombre: string
  labor: string
  salario: number
  descuento_prestamo: number
  neto: number
  estado: QuincenaEstado
  comprobante: string | null
}

// ===================================================
// Tabs
// ===================================================
const TABS = ['Nómina / Quincenas', 'Préstamos', 'Vista general', 'Calculadora 4×1000'] as const
type Tab = typeof TABS[number]

// ===================================================
// ─── Tab 1: Nómina ──────────────────────────────
// ===================================================
function NominaTab() {
  const QUINCENA_ACTUAL = '2026-07-01/2026-07-15'

  const [quincenas, setQuincenas] = useState<QuincenaRow[]>(() =>
    empleados.map((e) => {
      const prestamosActivos = prestamosEmpleadoMock.filter(
        (p) => p.empleadoId === e.id && p.estado === 'activo',
      )
      const descuento = prestamosActivos.reduce((s, p) => s + p.cuota_quincenal, 0)
      return {
        empleadoId: e.id,
        nombre:     e.nombre,
        labor:      e.labor,
        salario:    e.salario_quincenal,
        descuento_prestamo: descuento,
        neto:       e.salario_quincenal - descuento,
        estado:     'pendiente',
        comprobante: null,
      }
    }),
  )

  const [modalEmpleado, setModalEmpleado] = useState<QuincenaRow | null>(null)
  const [comprobanteFile, setComprobanteFile] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pendientes      = quincenas.filter((q) => q.estado === 'pendiente').length
  const liquidados      = quincenas.filter((q) => q.estado === 'liquidado').length
  const totalNomina     = quincenas.reduce((s, q) => s + q.neto, 0)
  const pendientesTotal = quincenas.filter((q) => q.estado === 'pendiente').reduce((s, q) => s + q.neto, 0)

  const openModal = (q: QuincenaRow) => {
    setModalEmpleado(q)
    setComprobanteFile(q.comprobante)
    setErrMsg('')
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setComprobanteFile(file.name)
    setErrMsg('')
  }

  const handleLiquidar = () => {
    if (!comprobanteFile) {
      setErrMsg('Debes adjuntar el comprobante antes de liquidar la quincena.')
      return
    }
    setQuincenas((prev) =>
      prev.map((q) =>
        q.empleadoId === modalEmpleado?.empleadoId
          ? { ...q, estado: 'liquidado', comprobante: comprobanteFile }
          : q,
      ),
    )
    setModalEmpleado(null)
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Empleados"      value={empleados.length}    icon={<Users2 size={16} />}     accent="green" />
        <KpiTile label="Pendientes"     value={pendientes}           icon={<ChevronDown size={16}/>} accent="amber" />
        <KpiTile label="Liquidados"     value={liquidados}           icon={<ChevronUp size={16} />}  accent="emerald" />
        <KpiTile label="Por liquidar"   value={cop(pendientesTotal)} icon={<CreditCard size={16}/>}  accent="rose" />
        <KpiTile label="Total quincena" value={cop(totalNomina)}     icon={<Users2 size={16} />}     accent="brown" />
      </div>

      <Card title={`Quincena ${QUINCENA_ACTUAL}`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Empleado</th><th>Labor</th>
                <th style={{ textAlign: 'right' }}>Salario quincenal</th>
                <th style={{ textAlign: 'right' }}>Desc. préstamo</th>
                <th style={{ textAlign: 'right' }}>Neto</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quincenas.map((q, i) => (
                <tr key={q.empleadoId} style={q.estado === 'liquidado' ? { opacity: 0.65 } : undefined}>
                  <td className="mono" style={{ color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{q.nombre}</td>
                  <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{q.labor}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(q.salario)}</td>
                  <td style={{ textAlign: 'right', color: q.descuento_prestamo > 0 ? 'var(--rose-600)' : undefined }} className="mono">
                    {q.descuento_prestamo > 0 ? `- ${cop(q.descuento_prestamo)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">{cop(q.neto)}</td>
                  <td>
                    <span className={`badge ${q.estado === 'liquidado' ? 'badge--success' : 'badge--warning'}`}>
                      {q.estado === 'liquidado' ? 'Liquidado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--fs-sm)', maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.comprobante
                      ? <span style={{ color: 'var(--emerald-700)' }}>✓ {q.comprobante}</span>
                      : <em style={{ color: 'var(--text-faint)' }}>Sin adjunto</em>
                    }
                  </td>
                  <td>
                    {q.estado === 'pendiente' && (
                      <Button size="sm" onClick={() => openModal(q)}>Pagar</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total quincena ({quincenas.length} empleados)</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(quincenas.reduce((s, q) => s + q.salario, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">- {cop(quincenas.reduce((s, q) => s + q.descuento_prestamo, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(totalNomina)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Modal
        open={!!modalEmpleado}
        title={`Liquidar quincena — ${modalEmpleado?.nombre ?? ''}`}
        onClose={() => setModalEmpleado(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalEmpleado(null)}>Cancelar</Button>
            <Button onClick={handleLiquidar}>Confirmar liquidación</Button>
          </>
        }
      >
        {modalEmpleado && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Salario base</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{cop(modalEmpleado.salario)}</p>
              </div>
              {modalEmpleado.descuento_prestamo > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Descuento préstamo</p>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>- {cop(modalEmpleado.descuento_prestamo)}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Neto a pagar</p>
                <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--emerald-700)' }}>{cop(modalEmpleado.neto)}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Comprobante de pago <span style={{ color: 'var(--rose-600)' }}>*</span>
              </p>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Obligatorio antes de marcar como liquidada.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                  Adjuntar comprobante
                </Button>
                {comprobanteFile && (
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {comprobanteFile}</span>
                )}
              </div>
              {errMsg && (
                <p style={{ color: 'var(--rose-600)', marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>⚠ {errMsg}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ===================================================
// ─── Tab 2: Préstamos ───────────────────────────
// ===================================================
function PrestamosTab() {
  const [prestamos, setPrestamos] = useState<PrestamoEmpleadoMock[]>(prestamosEmpleadoMock)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [fpEmpleadoId, setFpEmpleadoId] = useState('')
  const [fpConcepto, setFpConcepto]     = useState('')
  const [fpValor, setFpValor]           = useState('')
  const [fpCuotas, setFpCuotas]         = useState('')
  const [fpFecha, setFpFecha]           = useState(todayISO())
  const [expandedId, setExpandedId]     = useState<number | null>(null)

  const saveNuevo = () => {
    const val    = Number(fpValor)
    const cuotas = Number(fpCuotas)
    if (!fpEmpleadoId || !val || !cuotas) return
    const emp = empleados.find((e) => e.id === Number(fpEmpleadoId))!
    const nuevo: PrestamoEmpleadoMock = {
      id:               Date.now(),
      empleadoId:       emp.id,
      concepto:         fpConcepto || 'Préstamo',
      valor_total:      val,
      cuotas_mensuales: cuotas,
      cuota_mensual:    Math.round(val / cuotas),
      cuota_quincenal:  Math.round(val / (cuotas * 2)),
      fecha_inicio:     fpFecha,
      estado:           'activo',
      pagos:            [],
    }
    setPrestamos((prev) => [...prev, nuevo])
    setModalNuevo(false)
    setFpEmpleadoId(''); setFpConcepto(''); setFpValor(''); setFpCuotas('')
  }

  const calcPagado = (p: PrestamoEmpleadoMock) => p.pagos.filter((x) => x.estado === 'pagado').reduce((s, x) => s + x.monto, 0)
  const calcPct    = (p: PrestamoEmpleadoMock) => Math.min(100, Math.round((calcPagado(p) / p.valor_total) * 100))

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Button icon={<Landmark size={16} />} onClick={() => setModalNuevo(true)}>Nuevo préstamo</Button>
      </div>

      <div className="stack">
        {prestamos.map((p) => {
          const emp     = empleados.find((e) => e.id === p.empleadoId)
          const pagado  = calcPagado(p)
          const saldo   = p.valor_total - pagado
          const pct     = calcPct(p)
          const expanded = expandedId === p.id

          return (
            <Card key={p.id} title={`${emp?.nombre ?? '—'} — ${p.concepto}`}
              actions={
                <Button variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : p.id)}>
                  {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </Button>
              }
            >
              <div className="grid grid--kpi" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Valor total</p>
                  <p style={{ fontWeight: 700 }}>{cop(p.valor_total)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Pagado</p>
                  <p style={{ fontWeight: 700, color: 'var(--emerald-700)' }}>{cop(pagado)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Saldo</p>
                  <p style={{ fontWeight: 700, color: saldo > 0 ? 'var(--rose-600)' : 'var(--text-base)' }}>{cop(saldo)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Cuota quincenal</p>
                  <p style={{ fontWeight: 700 }}>{cop(p.cuota_quincenal)}</p>
                </div>
              </div>

              <div style={{ marginBottom: expanded ? '1rem' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progreso de pago</span>
                  <span style={{ fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--slate-100)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', transition: 'width 0.3s' }} />
                </div>
              </div>

              {expanded && p.pagos.length > 0 && (
                <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Quincena</th><th style={{ textAlign: 'right' }}>Monto</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {p.pagos.map((pago, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 'var(--fs-sm)' }}>{pago.quincena}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{cop(pago.monto)}</td>
                          <td>
                            <span className={`badge ${pago.estado === 'pagado' ? 'badge--success' : 'badge--warning'}`}>
                              {pago.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {expanded && p.pagos.length === 0 && (
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>Sin pagos registrados aún.</p>
              )}
            </Card>
          )
        })}
      </div>

      <Modal open={modalNuevo} title="Nuevo préstamo" onClose={() => setModalNuevo(false)}
        footer={<><Button variant="secondary" onClick={() => setModalNuevo(false)}>Cancelar</Button><Button onClick={saveNuevo}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Empleado"
            options={[{ value: '', label: 'Selecciona…' }, ...empleados.map((e) => ({ value: String(e.id), label: e.nombre }))]}
            value={fpEmpleadoId} onChange={(e) => setFpEmpleadoId(e.target.value)} required />
          <Input label="Concepto" placeholder="Préstamo personal" value={fpConcepto} onChange={(e) => setFpConcepto(e.target.value)} />
          <Input label="Valor total" type="number" value={fpValor} onChange={(e) => setFpValor(e.target.value)} required />
          <Input label="Cuotas mensuales" type="number" placeholder="6" value={fpCuotas} onChange={(e) => setFpCuotas(e.target.value)} required />
          <Input label="Fecha inicio" type="date" value={fpFecha} onChange={(e) => setFpFecha(e.target.value)} />
          {fpValor && fpCuotas && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              <span>Cuota quincenal: <strong>{cop(Math.round(Number(fpValor) / (Number(fpCuotas) * 2)))}</strong></span>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

// ===================================================
// ─── Tab 3: Vista general ───────────────────────
// ===================================================
type MovimientoCategoria = 'agua' | 'maquila' | 'nomina'
interface Movimiento {
  id: string
  fecha: string
  categoria: MovimientoCategoria
  descripcion: string
  monto: number
}

function VistaGeneralTab() {
  const [filtro, setFiltro] = useState<MovimientoCategoria | 'todos'>('todos')

  const movimientos = useMemo<Movimiento[]>(() => {
    const agua: Movimiento[] = aguaMock.map((a) => ({
      id:          `agua-${a.id}`,
      fecha:       a.fecha,
      categoria:   'agua',
      descripcion: `Agua — ${a.conductor} (${a.cantidad_viajes} viajes)`,
      monto:       a.valor_total,
    }))

    const maquila: Movimiento[] = viajesMock.map((v) => ({
      id:          `maquila-${v.id}`,
      fecha:       v.fecha,
      categoria:   'maquila',
      descripcion: `Maquila viaje ${v.numero_viaje}`,
      monto:       v.maquila,
    }))

    const nomina: Movimiento[] = empleados.map((e) => ({
      id:          `nomina-${e.id}`,
      fecha:       '2026-07-15',
      categoria:   'nomina',
      descripcion: `Nómina — ${e.nombre} (${e.labor})`,
      monto:       e.salario_quincenal,
    }))

    return [...agua, ...maquila, ...nomina].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [])

  const filtrados    = filtro === 'todos' ? movimientos : movimientos.filter((m) => m.categoria === filtro)
  const totalFiltrado = filtrados.reduce((s, m) => s + m.monto, 0)

  const CATEGORIA_LABEL: Record<MovimientoCategoria, string> = { agua: 'Agua', maquila: 'Maquila', nomina: 'Nómina' }
  const CATEGORIA_BADGE: Record<MovimientoCategoria, string> = { agua: 'badge--info', maquila: 'badge--success', nomina: 'badge--warning' }

  const totalAgua    = movimientos.filter((m) => m.categoria === 'agua').reduce((s, m) => s + m.monto, 0)
  const totalMaquila = movimientos.filter((m) => m.categoria === 'maquila').reduce((s, m) => s + m.monto, 0)
  const totalNomina  = movimientos.filter((m) => m.categoria === 'nomina').reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total agua"    value={cop(totalAgua)}    accent="amber"   icon={<LayoutList size={16} />} />
        <KpiTile label="Total maquila" value={cop(totalMaquila)} accent="emerald" icon={<LayoutList size={16} />} />
        <KpiTile label="Total nómina"  value={cop(totalNomina)}  accent="amber"   icon={<Users2 size={16} />} />
        <KpiTile label="Total general" value={cop(totalAgua + totalMaquila + totalNomina)} accent="brown" icon={<LayoutList size={16} />} />
      </div>

      <Card title={`Movimientos (${filtrados.length})`}>
        <div className="segment" style={{ marginBottom: '1rem' }}>
          {(['todos', 'agua', 'maquila', 'nomina'] as const).map((c) => (
            <button key={c} className={`segment__btn ${filtro === c ? 'segment__btn--active' : ''}`} onClick={() => setFiltro(c)}>
              {c === 'todos' ? 'Todos' : CATEGORIA_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Categoría</th><th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.fecha)}</td>
                  <td><span className={`badge ${CATEGORIA_BADGE[m.categoria]}`}>{CATEGORIA_LABEL[m.categoria]}</span></td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{m.descripcion}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(m.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({filtrados.length} registros)</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(totalFiltrado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

// ===================================================
// ─── Tab 4: Calculadora 4×1000 ──────────────────
// ===================================================
const TABLA_REFERENCIA = [
  500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000,
].map((m) => calc4x1000(m))

function CalculadoraTab() {
  const [modo, setModo]   = useState<'normal' | 'inverso'>('normal')
  const [monto, setMonto] = useState('')

  const resultado = useMemo(() => {
    const n = Number(monto)
    if (!n || n <= 0) return null
    return modo === 'normal' ? calc4x1000(n) : calc4x1000Inverso(n)
  }, [monto, modo])

  return (
    <>
      <Card title="Calculadora 4×1000 (GMF)">
        <div className="segment" style={{ marginBottom: '1.25rem' }}>
          <button className={`segment__btn ${modo === 'normal' ? 'segment__btn--active' : ''}`}  onClick={() => { setModo('normal');  setMonto('') }}>
            Normal (monto → neto)
          </button>
          <button className={`segment__btn ${modo === 'inverso' ? 'segment__btn--active' : ''}`} onClick={() => { setModo('inverso'); setMonto('') }}>
            Inverso (neto → bruto)
          </button>
        </div>

        <div className="grid grid--form">
          <Input
            label={modo === 'normal' ? 'Monto bruto a retirar / pagar' : 'Monto neto que quieres recibir'}
            type="number"
            placeholder="1000000"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        {resultado && (
          <div className="grid grid--kpi" style={{ marginTop: '1rem' }}>
            {'monto' in resultado ? (
              <>
                <KpiTile label="Monto bruto"     value={cop(resultado.monto)}    accent="brown"   />
                <KpiTile label="Impuesto 4×1000" value={cop(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Neto recibido"   value={cop(resultado.neto)}     accent="emerald" />
              </>
            ) : (
              <>
                <KpiTile label="Neto deseado"    value={cop(resultado.neto)}     accent="emerald" />
                <KpiTile label="Impuesto 4×1000" value={cop(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Bruto a retirar" value={cop(resultado.bruto)}    accent="brown"   />
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="Tabla de referencia 4×1000">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>Monto bruto</th>
                <th style={{ textAlign: 'right' }}>Impuesto</th>
                <th style={{ textAlign: 'right' }}>Neto</th>
                <th style={{ textAlign: 'right' }}>Bruto necesario (inverso)</th>
              </tr>
            </thead>
            <tbody>
              {TABLA_REFERENCIA.map((r) => {
                const inv = calc4x1000inv(r.neto)
                return (
                  <tr key={r.monto}>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(r.monto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--rose-600)' }} className="mono">{cop(r.impuesto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald-700)', fontWeight: 700 }} className="mono">{cop(r.neto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{cop(inv.bruto)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
          GMF = Gravamen a los Movimientos Financieros. Tarifa: 4 por cada 1.000 pesos (0.4%).
        </p>
      </Card>
    </>
  )
}

// ===================================================
// MAIN
// ===================================================
export function JulianaPage() {
  const [tab, setTab] = useState<Tab>('Nómina / Quincenas')

  return (
    <div className="page">
      <div className="dash-hero" style={{ background: 'linear-gradient(150deg, var(--amber-700), var(--amber-500))' }}>
        <div>
          <h1 className="dash-hero__title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Calculator size={28} aria-hidden="true" /> MÓDULO FINANZAS — Juliana
          </h1>
          <p className="dash-hero__sub">
            {empleados.length} empleados · {prestamosEmpleadoMock.filter((p) => p.estado === 'activo').length} préstamos activos
          </p>
        </div>
      </div>

      <div className="segment" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={`segment__btn ${tab === t ? 'segment__btn--active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Nómina / Quincenas' && <NominaTab />}
      {tab === 'Préstamos'          && <PrestamosTab />}
      {tab === 'Vista general'      && <VistaGeneralTab />}
      {tab === 'Calculadora 4×1000' && <CalculadoraTab />}
    </div>
  )
}
