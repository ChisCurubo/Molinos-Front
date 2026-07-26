import { useRef, useState, type ChangeEvent } from 'react'
import { ChevronDown, ChevronUp, Landmark, Percent, RefreshCw, Upload, Wallet } from 'lucide-react'
import { Badge, Button, Card, EstadoBadge, InfoCallout, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { tablaAmortizacion } from '@/utils/amortizacion'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import type { PagoAbono, Prestamo } from '@/types'

const estadoOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado',  label: 'Aprobado'  },
  { value: 'revision',  label: 'En revisión' },
  { value: 'rechazado', label: 'Rechazado'  },
]

export function PrestamosFinancierosPage() {
  const canWrite = useCanWrite('finanzas')
  const { prestamos, add, update } = useData()

  const [detalle,   setDetalle]   = useState<Prestamo | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal nuevo préstamo
  const [modalNuevo, setModalNuevo] = useState(false)
  const [nEntidad,   setNEntidad]   = useState('')
  const [nTipo,      setNTipo]      = useState<'bancario' | 'rotativo'>('bancario')
  const [nCapital,   setNCapital]   = useState('')
  const [nTasa,      setNTasa]      = useState('')
  const [nPlazo,     setNPlazo]     = useState('')
  const [nDesc,         setNDesc]         = useState('')
  const [nEstado,       setNEstado]       = useState('pendiente')
  const [nValorMat,     setNValorMat]     = useState('')
  const [nPctAdelanto,  setNPctAdelanto]  = useState('90')

  // Modal abono
  const [abonando,      setAbonando]      = useState<Prestamo | null>(null)
  const [abonoFecha,    setAbonoFecha]    = useState(todayISO())
  const [abonoMonto,    setAbonoMonto]    = useState('')
  const [abonoNota,     setAbonoNota]     = useState('')
  const [abonoComp,     setAbonoComp]     = useState<string | null>(null)
  const [abonoErr,      setAbonoErr]      = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const totalCapital = prestamos.reduce((s, p) => s + p.capital, 0)
  const totalSaldo   = prestamos.reduce((s, p) => s + p.saldo, 0)
  const totalCuota   = prestamos.filter((p) => p.tipo === 'bancario').reduce((s, p) => s + p.cuotaMensual, 0)

  const guardarNuevo = () => {
    if (!nEntidad) return
    const capital = Number(nCapital) || 0
    const tasa    = Number(nTasa) || 0
    const plazo   = Number(nPlazo) || 0
    const cuota   = nTipo === 'bancario' && plazo > 0
      ? Math.round(capital * tasa / 100 / (1 - Math.pow(1 + tasa / 100, -plazo)))
      : 0
    const valorMaterial   = nTipo === 'rotativo' && nValorMat ? Number(nValorMat) : undefined
    const pctAdelanto     = nTipo === 'rotativo' ? Number(nPctAdelanto) || 90 : undefined
    add('prestamos', {
      id: `l${Date.now()}`, entidad: nEntidad, tipo: nTipo,
      capital, interesPct: tasa, plazoMeses: plazo,
      saldo: capital, cuotaMensual: cuota,
      estado: nEstado as Prestamo['estado'],
      descripcion: nDesc || undefined,
      valorMaterial, porcentajeAdelanto: pctAdelanto,
      pagosAbono: [],
    } as Prestamo)
    setModalNuevo(false)
    setNEntidad(''); setNTipo('bancario'); setNCapital(''); setNTasa(''); setNPlazo(''); setNDesc(''); setNEstado('pendiente')
    setNValorMat(''); setNPctAdelanto('90')
  }

  const abrirAbono = (p: Prestamo) => {
    setAbonando(p)
    setAbonoFecha(todayISO()); setAbonoMonto(''); setAbonoNota(''); setAbonoComp(null); setAbonoErr('')
  }
  const handleFileAbono = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setAbonoComp(f.name); setAbonoErr('') }
  }
  const confirmarAbono = () => {
    const monto = Number(abonoMonto)
    if (!monto || monto <= 0) { setAbonoErr('Ingresa un monto válido.'); return }
    if (monto > abonando!.saldo) { setAbonoErr(`El abono no puede superar el saldo (${formatCOP(abonando!.saldo)}).`); return }
    const pago: PagoAbono = { id: `ab${Date.now()}`, fecha: abonoFecha, monto, nota: abonoNota || undefined, comprobante: abonoComp ?? undefined }
    const nuevoSaldo = abonando!.saldo - monto
    update('prestamos', abonando!.id, {
      saldo: nuevoSaldo,
      estado: nuevoSaldo === 0 ? 'aprobado' : abonando!.estado,
      pagosAbono: [...(abonando!.pagosAbono ?? []), pago],
    })
    setAbonando(null)
  }

  const bancarios  = prestamos.filter((p) => p.tipo === 'bancario')
  const rotativos  = prestamos.filter((p) => p.tipo === 'rotativo')

  const renderPrestamo = (p: Prestamo) => {
    const expanded = expandedId === p.id
    const pagos = p.pagosAbono ?? []
    const totalAbonado = pagos.reduce((s, x) => s + x.monto, 0)
    const pctPagado = p.capital > 0 ? Math.min(100, Math.round((totalAbonado / p.capital) * 100)) : 0

    return (
      <div key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
        {/* Fila principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <p style={{ fontWeight: 700, margin: 0 }}>
              {p.entidad}
              {p.tipo === 'rotativo' && <span className="badge badge--info" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', verticalAlign: 'middle' }}>ROTATIVO</span>}
            </p>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>
              {p.tipo === 'bancario'
                ? `Capital ${formatCOP(p.capital)} · Tasa ${p.interesPct}% mensual · Plazo ${p.plazoMeses} meses`
                : p.valorMaterial
                  ? `Material: ${formatCOP(p.valorMaterial)} · Adelanto ${p.porcentajeAdelanto ?? 90}% = ${formatCOP(p.valorMaterial * ((p.porcentajeAdelanto ?? 90) / 100))}`
                  : p.descripcion ?? 'Crédito rotativo'}
            </p>
          </div>

          {/* Barra de progreso */}
          <div style={{ minWidth: '8rem', flex: '0 0 10rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>
              <span>Pagado</span><span>{pctPagado}%</span>
            </div>
            <div style={{ height: 7, background: 'var(--slate-100)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pctPagado}%`, background: pctPagado === 100 ? 'var(--emerald-500)' : 'var(--amber-500)', transition: 'width 0.3s' }} />
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '7rem' }}>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Saldo</p>
            <p style={{ fontWeight: 800, color: 'var(--rose-600)', margin: 0 }} className="mono">{formatCOP(p.saldo)}</p>
          </div>

          <EstadoBadge estado={p.estado} />

          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {canWrite && p.saldo > 0 && (
              <Button size="sm" onClick={() => abrirAbono(p)}>Registrar abono</Button>
            )}
            {p.tipo === 'bancario' && (
              <Button size="sm" variant="secondary" onClick={() => setDetalle(p)}>Ver amortización</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : p.id)}>
              {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
            </Button>
          </div>
        </div>

        {/* Historial de abonos */}
        {expanded && (
          <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem' }}>
            {pagos.length > 0 ? (
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr><th>Fecha</th><th style={{ textAlign: 'right' }}>Monto abonado</th><th>Nota</th><th>Comprobante</th></tr>
                </thead>
                <tbody>
                  {pagos.map((ab) => (
                    <tr key={ab.id}>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(ab.fecha)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{formatCOP(ab.monto)}</td>
                      <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{ab.nota ?? '—'}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{ab.comprobante ? <span style={{ color: 'var(--emerald-700)' }}>✓ {ab.comprobante}</span> : <em style={{ color: 'var(--text-faint)' }}>Sin adjunto</em>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total abonado</td>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(totalAbonado)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin abonos registrados aún.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Préstamos financieros"
        subtitle="Créditos bancarios y rotativos de la empresa."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Capital total"       value={formatCOP(totalCapital)} icon={<Landmark size={16} />} accent="brown" />
        <KpiTile label="Saldo pendiente"     value={formatCOP(totalSaldo)}   icon={<Wallet size={16} />}   accent="rose"  />
        <KpiTile label="Cuota mensual total" value={formatCOP(totalCuota)}   icon={<Percent size={16} />}  accent="emerald" />
        <KpiTile label="Préstamos activos"   value={prestamos.length}        icon={<RefreshCw size={16}/>} accent="green" />
      </div>

      <InfoCallout accent>
        Préstamos <strong>bancarios de la empresa</strong> y créditos <strong>rotativos de material</strong>.
        Los préstamos a empleados se gestionan en el módulo de Nómina.
      </InfoCallout>

      {/* Bancarios */}
      {bancarios.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <Card
            title={`Préstamos bancarios (${bancarios.length})`}
            actions={canWrite && <Button size="sm" onClick={() => { setNTipo('bancario'); setModalNuevo(true) }}>+ Nuevo bancario</Button>}
          >
            {bancarios.map(renderPrestamo)}
          </Card>
        </div>
      )}

      {/* Rotativos */}
      <div style={{ marginTop: '1rem' }}>
        <Card
          title={`Créditos rotativos (${rotativos.length})`}
          actions={canWrite && <Button size="sm" variant="secondary" onClick={() => { setNTipo('rotativo'); setModalNuevo(true) }}>+ Nuevo rotativo</Button>}
        >
          {rotativos.length > 0 ? rotativos.map(renderPrestamo) : (
            <p style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin créditos rotativos registrados.</p>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <InfoCallout>
              Un crédito <strong>rotativo</strong> es un adelanto de material por viaje, disponible cada vez que hay dinero en Barranquilla.
              No tiene tabla de amortización — se abona libremente según disponibilidad.
            </InfoCallout>
          </div>
        </Card>
      </div>

      {/* Modal amortización */}
      <Modal
        open={!!detalle}
        title={detalle ? `Amortización — ${detalle.entidad}` : ''}
        onClose={() => setDetalle(null)}
        footer={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <>
            <div className="row" style={{ gap: '0.5rem' }}>
              <Badge tone="neutral">Capital {formatCOP(detalle.capital)}</Badge>
              <Badge tone="neutral">Tasa {detalle.interesPct}% mensual</Badge>
              <Badge tone="neutral">Cuota {formatCOP(detalle.cuotaMensual)}</Badge>
            </div>
            <div className="table-wrap" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Mes</th><th>Cuota</th><th>Interés</th><th>Abono capital</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {tablaAmortizacion(detalle.capital, detalle.interesPct, detalle.plazoMeses).map((f) => (
                    <tr key={f.mes}>
                      <td className="mono">{f.mes}</td>
                      <td className="mono">{formatCOP(f.cuota)}</td>
                      <td className="mono">{formatCOP(f.interes)}</td>
                      <td className="mono">{formatCOP(f.abonoCapital)}</td>
                      <td className="mono">{formatCOP(f.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      {/* Modal nuevo préstamo */}
      <Modal
        open={modalNuevo}
        title="Nuevo préstamo / crédito"
        onClose={() => setModalNuevo(false)}
        footer={<><Button variant="secondary" onClick={() => setModalNuevo(false)}>Cancelar</Button><Button onClick={guardarNuevo}>Guardar</Button></>}
      >
        <div className="grid grid--form">
          <Select label="Tipo" options={[{ value: 'bancario', label: 'Bancario (amortización fija)' }, { value: 'rotativo', label: 'Rotativo (adelanto material)' }]}
            value={nTipo} onChange={(e) => setNTipo(e.target.value as 'bancario' | 'rotativo')} />
          <Input label="Entidad / nombre" value={nEntidad} onChange={(e) => setNEntidad(e.target.value)} required />
          <Input label="Capital" type="number" value={nCapital} onChange={(e) => setNCapital(e.target.value)} required />
          {nTipo === 'bancario' && (
            <>
              <Input label="Tasa mensual (%)" type="number" placeholder="1.8" value={nTasa} onChange={(e) => setNTasa(e.target.value)} />
              <Input label="Plazo (meses)" type="number" value={nPlazo} onChange={(e) => setNPlazo(e.target.value)} />
            </>
          )}
          {nTipo === 'rotativo' && (
            <>
              <Input label="Valor del material (total factura)" type="number" placeholder="50000000" value={nValorMat} onChange={(e) => setNValorMat(e.target.value)} />
              <Input label="Porcentaje de adelanto (%)" type="number" min={1} max={100} value={nPctAdelanto} onChange={(e) => setNPctAdelanto(e.target.value)} />
              {nValorMat && Number(nValorMat) > 0 && (
                <div className="callout" style={{ gridColumn: '1/-1' }}>
                  Monto de adelanto: <strong>{formatCOP(Number(nValorMat) * ((Number(nPctAdelanto) || 90) / 100))}</strong>
                  {' '}({nPctAdelanto}% de {formatCOP(Number(nValorMat))})
                </div>
              )}
              <Input label="Descripción (opcional)" placeholder="Adelanto de material por viaje…" value={nDesc} onChange={(e) => setNDesc(e.target.value)} style={{ gridColumn: '1/-1' }} />
            </>
          )}
          <Select label="Estado" options={estadoOptions} value={nEstado} onChange={(e) => setNEstado(e.target.value)} />
        </div>
      </Modal>

      {/* Modal abono */}
      <Modal
        open={!!abonando}
        title={`Registrar abono — ${abonando?.entidad ?? ''}`}
        onClose={() => setAbonando(null)}
        footer={<><Button variant="secondary" onClick={() => setAbonando(null)}>Cancelar</Button><Button onClick={confirmarAbono}>Confirmar abono</Button></>}
      >
        {abonando && (
          <div className="stack">
            <div className="grid grid--form">
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Saldo actual</p>
                <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--rose-600)' }}>{formatCOP(abonando.saldo)}</p>
              </div>
            </div>
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={abonoFecha} onChange={(e) => setAbonoFecha(e.target.value)} />
              <Input label="Monto a abonar" type="number" placeholder="0" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} required />
              {abonoMonto && Number(abonoMonto) > 0 && (
                <div className="callout" style={{ gridColumn: '1/-1' }}>
                  Saldo después del abono: <strong>{formatCOP(Math.max(0, abonando.saldo - Number(abonoMonto)))}</strong>
                </div>
              )}
              <Input label="Nota (opcional)" placeholder="Cuota mensual de julio…" value={abonoNota} onChange={(e) => setAbonoNota(e.target.value)} style={{ gridColumn: '1/-1' }} />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Comprobante (opcional)</p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileAbono} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Adjuntar</Button>
                {abonoComp && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--emerald-700)' }}>✓ {abonoComp}</span>}
              </div>
            </div>
            {abonoErr && <p style={{ color: 'var(--rose-600)', fontSize: 'var(--fs-sm)' }}>⚠ {abonoErr}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
