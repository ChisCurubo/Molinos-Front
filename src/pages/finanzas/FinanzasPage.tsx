import { useRef, useMemo, useState, type ChangeEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Landmark, LayoutList, Upload, Wallet } from 'lucide-react'
import '../dashboard/dashboard.css'
import { EstadoBadge, KpiTile } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, calc4x1000inv } from '@/utils/format'
import { aguaMock, viajesMock, empleados as empMock, calc4x1000, calc4x1000Inverso } from '@/data/mock'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import type { CuentaPorPagar } from '@/types'
import { todayISO } from '@/utils/format'

type Tab = 'pagar' | 'movimientos' | 'calculadora'

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
  { value: 'flete',     label: 'Flete'          },
  { value: 'material',  label: 'Material'       },
]

// ── Tabla referencia 4×1000 ──────────────────────────────
const TABLA_REF = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000].map((m) => calc4x1000(m))

// ── Tipos movimiento ─────────────────────────────────────
type CategoriaMov = 'agua' | 'maquila' | 'nomina'
interface Movimiento { id: string; fecha: string; categoria: CategoriaMov; descripcion: string; monto: number }

const BADGE_MOV: Record<CategoriaMov, string> = { agua: 'badge--info', maquila: 'badge--success', nomina: 'badge--warning' }
const LABEL_MOV: Record<CategoriaMov, string> = { agua: 'Agua', maquila: 'Maquila', nomina: 'Nómina' }

function useMovimientos(): Movimiento[] {
  return useMemo(() => {
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
    return [...agua, ...maquila, ...nomina].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [])
}

// ── Sub-tab: Vista general ───────────────────────────────
function MovimientosTab() {
  const movimientos = useMovimientos()
  const [filtro, setFiltro] = useState<CategoriaMov | 'todos'>('todos')

  const filtrados    = filtro === 'todos' ? movimientos : movimientos.filter((m) => m.categoria === filtro)
  const totalFiltrado = filtrados.reduce((s, m) => s + m.monto, 0)
  const totalAgua    = movimientos.filter((m) => m.categoria === 'agua').reduce((s, m) => s + m.monto, 0)
  const totalMaquila = movimientos.filter((m) => m.categoria === 'maquila').reduce((s, m) => s + m.monto, 0)
  const totalNomina  = movimientos.filter((m) => m.categoria === 'nomina').reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total agua"    value={formatCOP(totalAgua)}    accent="emerald" icon={<LayoutList size={16} />} />
        <KpiTile label="Total maquila" value={formatCOP(totalMaquila)} accent="green"   icon={<LayoutList size={16} />} />
        <KpiTile label="Total nómina"  value={formatCOP(totalNomina)}  accent="amber"   icon={<LayoutList size={16} />} />
        <KpiTile label="Total general" value={formatCOP(totalAgua + totalMaquila + totalNomina)} accent="brown" icon={<Wallet size={16} />} />
      </div>

      <Card title={`Movimientos (${filtrados.length})`}>
        <div className="segment" style={{ marginBottom: '1rem' }}>
          {(['todos', 'agua', 'maquila', 'nomina'] as const).map((c) => (
            <button key={c} className={`segment__btn ${filtro === c ? 'segment__btn--active' : ''}`} onClick={() => setFiltro(c)}>
              {c === 'todos' ? 'Todos' : LABEL_MOV[c]}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.fecha)}</td>
                  <td><span className={`badge ${BADGE_MOV[m.categoria]}`}>{LABEL_MOV[m.categoria]}</span></td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{m.descripcion}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(m.monto)}</td>
                </tr>
              ))}
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
    </>
  )
}

// ── Sub-tab: Calculadora 4×1000 ──────────────────────────
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
      <Card title="Calculadora 4×1000 (GMF — Gravamen a los Movimientos Financieros)">
        <div className="segment" style={{ marginBottom: '1.25rem' }}>
          <button className={`segment__btn ${modo === 'normal'  ? 'segment__btn--active' : ''}`} onClick={() => { setModo('normal');  setMonto('') }}>
            Normal (monto → neto)
          </button>
          <button className={`segment__btn ${modo === 'inverso' ? 'segment__btn--active' : ''}`} onClick={() => { setModo('inverso'); setMonto('') }}>
            Inverso (neto → bruto)
          </button>
        </div>

        <div className="grid grid--form" style={{ maxWidth: '24rem' }}>
          <Input
            label={modo === 'normal' ? 'Monto bruto a retirar / pagar' : 'Monto neto que quieres recibir'}
            type="number" placeholder="1000000"
            value={monto} onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        {resultado && (
          <div className="grid grid--kpi" style={{ marginTop: '1rem' }}>
            {'monto' in resultado ? (
              <>
                <KpiTile label="Monto bruto"     value={formatCOP(resultado.monto)}    accent="brown"   />
                <KpiTile label="Impuesto 4×1000" value={formatCOP(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Neto recibido"   value={formatCOP(resultado.neto)}     accent="emerald" />
              </>
            ) : (
              <>
                <KpiTile label="Neto deseado"    value={formatCOP(resultado.neto)}     accent="emerald" />
                <KpiTile label="Impuesto 4×1000" value={formatCOP(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Bruto a retirar" value={formatCOP(resultado.bruto)}    accent="brown"   />
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="Tabla de referencia">
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
              {TABLA_REF.map((r) => {
                const inv = calc4x1000inv(r.neto)
                return (
                  <tr key={r.monto}>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(r.monto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--rose-600)' }} className="mono">{formatCOP(r.impuesto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald-700)', fontWeight: 700 }} className="mono">{formatCOP(r.neto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{formatCOP(inv.bruto)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
          Tarifa: 4 pesos por cada $1.000 (0.4%). Normal: neto = monto × 0.996. Inverso: bruto = neto / 0.996.
        </p>
      </Card>
    </>
  )
}

// ── Sub-tab: Cuentas por pagar ───────────────────────────
function PagarTab({ canWrite }: { canWrite: boolean }) {
  const { porPagar, add, update, remove } = useData()

  const [filtroTipo,   setFiltroTipo]   = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  // Modal nueva / editar
  const [modalForm, setModalForm]   = useState<'nueva' | CuentaPorPagar | null>(null)
  const [fConcepto, setFConcepto]   = useState('')
  const [fBenef,    setFBenef]      = useState('')
  const [fTipo,     setFTipo]       = useState('gasto')
  const [fMonto,    setFMonto]      = useState('')
  const [fVence,    setFVence]      = useState(todayISO())
  const [fEstado,   setFEstado]     = useState('pendiente')

  // Modal pago
  const [pagando,      setPagando]      = useState<CuentaPorPagar | null>(null)
  const [comprobante,  setComprobante]  = useState<string | null>(null)
  const [errPago,      setErrPago]      = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Modal ver comprobante
  const [viendo, setViendo] = useState<CuentaPorPagar | null>(null)

  const filtradas = porPagar.filter((p) => {
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
    return true
  })

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
      add('porPagar', { id: `p${Date.now()}`, origen: 'manual', comprobante: null, ...vals } as CuentaPorPagar)
    } else if (modalForm) {
      update('porPagar', (modalForm as CuentaPorPagar).id, vals)
    }
    setModalForm(null)
  }

  const abrirPago = (p: CuentaPorPagar) => { setPagando(p); setComprobante(null); setErrPago('') }
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setComprobante(f.name); setErrPago('') }
  }
  const confirmarPago = () => {
    if (!comprobante) { setErrPago('Adjunta el comprobante antes de marcar como pagada.'); return }
    update('porPagar', pagando!.id, { estado: 'pagado', comprobante })
    setPagando(null)
  }

  const totalFiltrado  = filtradas.reduce((s, p) => s + p.monto, 0)
  const totalImpuesto  = filtradas.reduce((s, p) => s + p.monto * 0.004, 0)
  const pendientesCount = porPagar.filter((p) => p.estado === 'pendiente' || p.estado === 'aprobado').length

  return (
    <>
      {/* Filtros */}
      <div className="toolbar" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>Tipo:</span>
          <div className="segment">
            {[{ v: 'todos', l: 'Todos' }, ...tipoOptions.map(o => ({ v: o.value, l: o.label }))].map(o => (
              <button key={o.v} className={`segment__btn ${filtroTipo === o.v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroTipo(o.v)}>{o.l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>Estado:</span>
          <div className="segment">
            {[{ v: 'todos', l: 'Todos' }, { v: 'pendiente', l: 'Pendientes' }, { v: 'pagado', l: 'Pagadas' }].map(o => (
              <button key={o.v} className={`segment__btn ${filtroEstado === o.v ? 'segment__btn--active' : ''}`} onClick={() => setFiltroEstado(o.v)}>{o.l}</button>
            ))}
          </div>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNueva} style={{ marginLeft: 'auto' }}>+ Nueva cuenta</Button>
        )}
      </div>

      {/* Resumen 4×1000 */}
      {filtradas.length > 0 && (
        <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
          <KpiTile label={`Total a pagar (${filtradas.length})`} value={formatCOP(totalFiltrado)} accent="rose" icon={<ArrowUpCircle size={16}/>} />
          <KpiTile label="4×1000 estimado" value={formatCOP(totalImpuesto)} accent="amber" icon={<Wallet size={16}/>} />
          <KpiTile label="Neto real (con impuesto)" value={formatCOP(totalFiltrado + totalImpuesto)} accent="brown" icon={<Wallet size={16}/>} />
          <KpiTile label="Pendientes de pago" value={pendientesCount} accent="rose" icon={<ArrowUpCircle size={16}/>} />
        </div>
      )}

      <Card title={`Cuentas por pagar (${filtradas.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Beneficiario</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ textAlign: 'right' }}>4×1000</th>
                <th>Vence</th>
                <th>Estado</th>
                <th>Comprobante</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => {
                const imp4x1000 = p.monto * 0.004
                const pagada = p.estado === 'pagado'
                return (
                  <tr key={p.id} style={pagada ? { opacity: 0.65 } : undefined}>
                    <td style={{ fontWeight: 600 }}>{p.concepto}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{p.beneficiario}</td>
                    <td><span className="badge badge--neutral" style={{ textTransform: 'capitalize' }}>{p.tipo}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(p.monto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)', fontSize: 'var(--fs-sm)' }} className="mono">
                      {formatCOP(imp4x1000)}
                    </td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(p.fechaVencimiento)}</td>
                    <td><EstadoBadge estado={p.estado} /></td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>
                      {p.comprobante
                        ? <button className="btn btn--ghost btn--sm" onClick={() => setViendo(p)}>Ver</button>
                        : <em style={{ color: 'var(--text-faint)' }}>—</em>}
                    </td>
                    {canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {!pagada && <Button size="sm" onClick={() => abrirPago(p)}>Pagar</Button>}
                          <Button size="sm" variant="secondary" onClick={() => openEditar(p)}>Editar</Button>
                          <Button size="sm" variant="ghost" onClick={() => remove('porPagar', p.id)}>×</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={canWrite ? 9 : 8} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Sin registros para los filtros seleccionados.</td></tr>
              )}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Total ({filtradas.length})</td>
                  <td style={{ textAlign: 'right' }} className="mono">{formatCOP(totalFiltrado)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{formatCOP(totalImpuesto)}</td>
                  <td colSpan={canWrite ? 4 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Modal nueva / editar */}
      <Modal
        open={modalForm !== null}
        title={modalForm === 'nueva' ? 'Nueva cuenta por pagar' : 'Editar cuenta'}
        onClose={() => setModalForm(null)}
        footer={<><Button variant="secondary" onClick={() => setModalForm(null)}>Cancelar</Button><Button onClick={guardar}>Guardar</Button></>}
      >
        <div className="grid grid--form">
          <Input label="Concepto" value={fConcepto} onChange={(e) => setFConcepto(e.target.value)} required />
          <Input label="Beneficiario" value={fBenef} onChange={(e) => setFBenef(e.target.value)} required />
          <Select label="Tipo" options={tipoOptions} value={fTipo} onChange={(e) => setFTipo(e.target.value)} />
          <Input label="Monto" type="number" value={fMonto} onChange={(e) => setFMonto(e.target.value)} required />
          {fMonto && Number(fMonto) > 0 && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              4×1000: <strong>{formatCOP(Number(fMonto) * 0.004)}</strong> — Neto con impuesto: <strong>{formatCOP(Number(fMonto) * 1.004)}</strong>
            </div>
          )}
          <Input label="Fecha vencimiento" type="date" value={fVence} onChange={(e) => setFVence(e.target.value)} />
          <Select label="Estado" options={estadoOptions} value={fEstado} onChange={(e) => setFEstado(e.target.value)} />
        </div>
      </Modal>

      {/* Modal pagar */}
      <Modal
        open={!!pagando}
        title={`Registrar pago — ${pagando?.concepto ?? ''}`}
        onClose={() => setPagando(null)}
        footer={<><Button variant="secondary" onClick={() => setPagando(null)}>Cancelar</Button><Button onClick={confirmarPago}>Confirmar pago</Button></>}
      >
        {pagando && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Monto a pagar</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatCOP(pagando.monto)}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>4×1000 (impuesto)</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--amber-700)' }}>{formatCOP(pagando.monto * 0.004)}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Total real (monto + 4×1000)</p>
                <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--rose-600)' }}>{formatCOP(pagando.monto * 1.004)}</p>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                Comprobante de pago <span style={{ color: 'var(--rose-600)' }}>*</span>
              </p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Adjuntar</Button>
                {comprobante && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {comprobante}</span>}
              </div>
              {errPago && <p style={{ color: 'var(--rose-600)', marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>⚠ {errPago}</p>}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal ver comprobante */}
      <Modal
        open={!!viendo}
        title={`Comprobante — ${viendo?.concepto ?? ''}`}
        onClose={() => setViendo(null)}
        footer={<Button variant="secondary" onClick={() => setViendo(null)}>Cerrar</Button>}
      >
        {viendo && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Archivo adjunto:</p>
            <p style={{ fontWeight: 600, color: 'var(--emerald-700)' }}>✓ {viendo.comprobante}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
              Pagado el {formatDate(viendo.fechaVencimiento)} · Monto {formatCOP(viendo.monto)}
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

  const totalPagar     = porPagar.filter((p) => p.estado !== 'rechazado' && p.estado !== 'pagado').reduce((s, p) => s + p.monto, 0)
  const totalCobrar    = porCobrar.filter((c) => c.estado !== 'rechazado').reduce((s, c) => s + c.monto, 0)
  const saldoPrestamos = prestamos.reduce((s, p) => s + p.saldo, 0)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pagar',       label: 'Cuentas por pagar'    },
    { key: 'movimientos', label: 'Vista general'         },
    { key: 'calculadora', label: 'Calculadora 4×1000'   },
  ]

  return (
    <div className="page">
      <PageHeader title="Pagos y finanzas" subtitle="Cuentas por pagar, movimientos y herramientas financieras." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
        <KpiTile label="Total por pagar"  value={formatCOP(totalPagar)}    icon={<ArrowUpCircle size={16} />}   accent="rose"    />
        <KpiTile label="Total por cobrar" value={formatCOP(totalCobrar)}   icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Saldo préstamos"  value={formatCOP(saldoPrestamos)} icon={<Landmark size={16} />}       accent="brown"   />
        <KpiTile label="4×1000 estimado total" value={formatCOP(totalPagar * 0.004)} icon={<Wallet size={16} />} accent="amber" />
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

      {tab === 'pagar'       && <PagarTab canWrite={canWrite} />}
      {tab === 'movimientos' && <MovimientosTab />}
      {tab === 'calculadora' && <CalculadoraTab />}
    </div>
  )
}
