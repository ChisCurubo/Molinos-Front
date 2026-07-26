import { useRef, useMemo, useState, type ChangeEvent } from 'react'
import { ArrowDownCircle, Upload, Wallet } from 'lucide-react'
import { EstadoBadge, KpiTile } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { calc4x1000 } from '@/data/mock'
import type { CuentaPorCobrar } from '@/types'

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

export function CuentasPorCobrarPage() {
  const canWrite = useCanWrite('finanzas')
  const { porCobrar, add, update, remove } = useData()

  // Filtros
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroEst,  setFiltroEst]  = useState<string>('todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Modal nueva / editar
  const [modalForm, setModalForm]   = useState<'nueva' | CuentaPorCobrar | null>(null)
  const [fConcepto, setFConcepto]   = useState('')
  const [fCliente,  setFCliente]    = useState('')
  const [fClienteLibre, setFClienteLibre] = useState('')
  const [fMonto,    setFMonto]      = useState('')
  const [fVence,    setFVence]      = useState(todayISO())
  const [fEstado,   setFEstado]     = useState('pendiente')

  // Modal cobrar
  const [cobrando,    setCobrando]    = useState<CuentaPorCobrar | null>(null)
  const [comprobante, setComprobante] = useState<string | null>(null)
  const [errCobro,    setErrCobro]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Modal ver comprobante
  const [viendo, setViendo] = useState<CuentaPorCobrar | null>(null)

  // Clientes únicos del dataset
  const clientesExistentes = useMemo(() => {
    const set = new Set(porCobrar.map((c) => c.cliente))
    const combined = [...CLIENTES_PREDEFINIDOS, ...Array.from(set)]
    return [...new Set(combined)]
  }, [porCobrar])

  const hoy = todayISO()

  // Filtrado y ordenamiento: vencidas al fondo
  const filtradas = useMemo(() => {
    let items = porCobrar.filter((c) => {
      if (filtroEst !== 'todos' && c.estado !== filtroEst) return false
      if (busqueda && !c.concepto.toLowerCase().includes(busqueda.toLowerCase()) && !c.cliente.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filtroDesde && c.fechaVencimiento < filtroDesde) return false
      if (filtroHasta && c.fechaVencimiento > filtroHasta) return false
      return true
    })
    // Vencidas (pendientes y fecha ya pasó) al fondo
    const vigentes = items.filter((c) => c.estado === 'pagado' || c.estado === 'rechazado' || c.fechaVencimiento >= hoy)
    const vencidas = items.filter((c) => c.estado !== 'pagado' && c.estado !== 'rechazado' && c.fechaVencimiento < hoy)
    return [...vigentes, ...vencidas]
  }, [porCobrar, filtroEst, busqueda, filtroDesde, filtroHasta, hoy])

  const totalPendiente = filtradas.filter((c) => c.estado !== 'rechazado' && c.estado !== 'pagado').reduce((s, c) => s + c.monto, 0)
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
      add('porCobrar', { id: `c${Date.now()}`, comprobante: null, ...vals } as CuentaPorCobrar)
    } else if (modalForm) {
      update('porCobrar', (modalForm as CuentaPorCobrar).id, vals)
    }
    setModalForm(null)
  }

  const abrirCobro = (c: CuentaPorCobrar) => { setCobrando(c); setComprobante(null); setErrCobro('') }
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setComprobante(f.name); setErrCobro('') }
  }
  const confirmarCobro = () => {
    if (!comprobante) { setErrCobro('Adjunta el comprobante antes de marcar como cobrado.'); return }
    update('porCobrar', cobrando!.id, { estado: 'pagado', comprobante })
    setCobrando(null)
  }

  return (
    <div className="page">
      <PageHeader title="Cuentas por cobrar" subtitle="Cartera de clientes, vencimientos y comprobantes." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Por cobrar (pendiente)" value={formatCOP(totalPendiente)} accent="emerald" icon={<ArrowDownCircle size={16}/>} />
        <KpiTile label="4×1000 sobre lo por cobrar" value={formatCOP(totalPendiente * 0.004)} accent="amber" icon={<Wallet size={16}/>} />
        <KpiTile label="Total cobrado" value={formatCOP(totalCobrado)} accent="green" icon={<ArrowDownCircle size={16}/>} />
        <KpiTile label="Cuentas vencidas" value={vencidasCount} accent="rose" icon={<ArrowDownCircle size={16}/>} />
      </div>

      {/* Filtros */}
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
          {canWrite && (
            <Button size="sm" onClick={openNueva}>+ Nueva cuenta</Button>
          )}
        </div>
      </Card>

      <div style={{ marginTop: '1rem' }}>
      <Card title={`Cuentas por cobrar (${filtradas.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cliente</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ textAlign: 'right' }}>4×1000</th>
                <th>Vence</th>
                <th>Estado</th>
                <th>Comprobante</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const vencida = c.estado !== 'pagado' && c.estado !== 'rechazado' && c.fechaVencimiento < hoy
                const imp = c.monto * 0.004
                return (
                  <tr key={c.id} style={vencida ? { background: 'var(--rose-50, #fff1f2)' } : c.estado === 'pagado' ? { opacity: 0.65 } : undefined}>
                    <td style={{ fontWeight: 600 }}>
                      {c.concepto}
                      {vencida && <span className="badge badge--danger" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>VENCIDA</span>}
                    </td>
                    <td style={{ fontSize: 'var(--fs-sm)' }}>{c.cliente}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(c.monto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)', fontSize: 'var(--fs-sm)' }} className="mono">{formatCOP(imp)}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', color: vencida ? 'var(--rose-600)' : undefined, fontWeight: vencida ? 700 : undefined }}>
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
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {c.estado !== 'pagado' && <Button size="sm" onClick={() => abrirCobro(c)}>Cobrar</Button>}
                          <Button size="sm" variant="secondary" onClick={() => openEditar(c)}>Editar</Button>
                          <Button size="sm" variant="ghost" onClick={() => remove('porCobrar', c.id)}>×</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Sin cuentas para los filtros actuales.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </div>

      {/* Modal nueva / editar */}
      <Modal
        open={modalForm !== null}
        title={modalForm === 'nueva' ? 'Nueva cuenta por cobrar' : 'Editar cuenta'}
        onClose={() => setModalForm(null)}
        footer={<><Button variant="secondary" onClick={() => setModalForm(null)}>Cancelar</Button><Button onClick={guardar}>Guardar</Button></>}
      >
        <div className="grid grid--form">
          <Input label="Concepto" value={fConcepto} onChange={(e) => setFConcepto(e.target.value)} required />
          <Select
            label="Cliente"
            options={clientesExistentes.map((cl) => ({ value: cl, label: cl }))}
            value={fCliente}
            onChange={(e) => setFCliente(e.target.value)}
          />
          {fCliente === 'Otro' && (
            <Input label="Nombre del cliente" value={fClienteLibre} onChange={(e) => setFClienteLibre(e.target.value)} required />
          )}
          <Input label="Monto" type="number" value={fMonto} onChange={(e) => setFMonto(e.target.value)} required />
          {fMonto && Number(fMonto) > 0 && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              4×1000 sobre este cobro: <strong>{formatCOP(calc4x1000(Number(fMonto)).impuesto)}</strong> — Neto recibido: <strong>{formatCOP(calc4x1000(Number(fMonto)).neto)}</strong>
            </div>
          )}
          <Input label="Fecha vencimiento" type="date" value={fVence} onChange={(e) => setFVence(e.target.value)} />
          <Select label="Estado" options={estadoOptions} value={fEstado} onChange={(e) => setFEstado(e.target.value)} />
        </div>
      </Modal>

      {/* Modal cobrar */}
      <Modal
        open={!!cobrando}
        title={`Registrar cobro — ${cobrando?.concepto ?? ''}`}
        onClose={() => setCobrando(null)}
        footer={<><Button variant="secondary" onClick={() => setCobrando(null)}>Cancelar</Button><Button onClick={confirmarCobro}>Confirmar cobro</Button></>}
      >
        {cobrando && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Monto a cobrar</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{formatCOP(cobrando.monto)}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>4×1000 (te descuentan)</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--amber-700)' }}>{formatCOP(cobrando.monto * 0.004)}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Neto real que recibes</p>
                <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--emerald-700)' }}>{formatCOP(cobrando.monto * 0.996)}</p>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                Comprobante de cobro <span style={{ color: 'var(--rose-600)' }}>*</span>
              </p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Adjuntar</Button>
                {comprobante && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {comprobante}</span>}
              </div>
              {errCobro && <p style={{ color: 'var(--rose-600)', marginTop: '0.5rem', fontSize: 'var(--fs-sm)' }}>⚠ {errCobro}</p>}
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
              Cliente: {viendo.cliente} · Monto: {formatCOP(viendo.monto)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
