import { useCallback, useEffect, useState } from 'react'
import {
  Calculator, ChevronDown, ChevronUp, FileText, ImageIcon, Landmark, Pencil, Percent, Plus, RefreshCw, TrendingUp, Trash2, Wallet, X,
} from 'lucide-react'
import { Badge, Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { calcularCuota, tablaAmortizacion } from '@/utils/amortizacion'
import {
  pagosPrestamosApi, type PrestamoFinanciero, type PrestamoPayload, type MovimientoPrestamo, type ProyeccionInteresPrestamo,
} from '@/api/pagosPrestamos'
import { invalidateDeudaPrestamos } from '@/hooks/useDeudaPrestamos'
import { invalidateBalanceTesoreria } from '@/hooks/useBalanceTesoreria'

const cop = formatCOP

// ── Plazo (meses) — TEMPORAL en localStorage: el backend no tiene este campo,
// así que la tabla de amortización se calcula en el front (sistema francés) a
// partir de capital + tasa (reales del backend) + plazo (guardado local). ──
const LS_PLAZOS = 'molinos_plazos_prestamos_api_v1'
function loadPlazos(): Record<number, number> {
  try { const r = localStorage.getItem(LS_PLAZOS); return r ? JSON.parse(r) : {} } catch { return {} }
}
function savePlazos(d: Record<number, number>) { try { localStorage.setItem(LS_PLAZOS, JSON.stringify(d)) } catch { /* quota */ } }

function usePrestamos() {
  const [data, setData] = useState<PrestamoFinanciero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosPrestamosApi.listar()
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

const emptyForm = () => ({ nombre_prestamo: '', fecha_adquisicion: todayISO(), monto_principal: '', tasa_interes: '', plazo_meses: '', activo: true })

export function PrestamosFinancierosApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const { data, loading, error, reload } = usePrestamos()

  // Historial real (interés + abonos) — se pide perezoso, solo al expandir.
  const [movimientos, setMovimientos] = useState<Record<number, MovimientoPrestamo[]>>({})
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    if (!movimientos[id]) {
      pagosPrestamosApi.getMovimientos(id).then(r => setMovimientos(prev => ({ ...prev, [id]: Array.isArray(r) ? r : [] }))).catch(() => {})
    }
  }
  const recargarMovimientos = (id: number) => {
    pagosPrestamosApi.getMovimientos(id).then(r => setMovimientos(prev => ({ ...prev, [id]: Array.isArray(r) ? r : [] }))).catch(() => {})
  }

  const [plazos, setPlazos] = useState<Record<number, number>>(() => loadPlazos())
  const plazoDe = (id: number): number | undefined => plazos[id] || undefined

  // ── Nuevo / Editar préstamo ─────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | PrestamoFinanciero>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const f = (k: keyof ReturnType<typeof emptyForm>, v: string | boolean) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyForm()); setModal('nuevo') }
  const openEdit = (p: PrestamoFinanciero) => {
    setForm({
      nombre_prestamo: p.nombre_prestamo,
      fecha_adquisicion: p.fecha_adquisicion?.slice(0, 10) ?? todayISO(),
      monto_principal: String(num(p.monto_principal)),
      tasa_interes: String(num(p.tasa_interes)),
      plazo_meses: String(plazoDe(p.id) ?? ''),
      activo: !!num(p.activo ?? 1),
    })
    setModal(p)
  }

  const guardarPlazo = (id: number, meses: number) => {
    setPlazos(prev => {
      const n = { ...prev }
      if (meses > 0) n[id] = meses; else delete n[id]
      savePlazos(n); return n
    })
  }

  const save = async () => {
    if (!form.nombre_prestamo.trim() || !form.monto_principal) return
    setSaving(true)
    const montoPrincipal = Number(form.monto_principal) || 0
    const plazoMeses = Number(form.plazo_meses) || 0
    try {
      if (modal === 'nuevo') {
        const body: PrestamoPayload = {
          nombre_prestamo: form.nombre_prestamo.trim(), fecha_adquisicion: form.fecha_adquisicion,
          monto_principal: montoPrincipal, tasa_interes: Number(form.tasa_interes) || 0,
          saldo_pendiente: montoPrincipal, activo: form.activo,
        }
        const creado = await pagosPrestamosApi.crear(body)
        guardarPlazo(creado.id, plazoMeses)
        toast.success('Préstamo creado')
        invalidateBalanceTesoreria() // genera un ingreso espejo en Tesorería
      } else if (modal) {
        await pagosPrestamosApi.actualizar(modal.id, {
          nombre_prestamo: form.nombre_prestamo.trim(), fecha_adquisicion: form.fecha_adquisicion,
          monto_principal: montoPrincipal, tasa_interes: Number(form.tasa_interes) || 0,
          saldo_pendiente: num(modal.saldo_pendiente), activo: form.activo,
        })
        guardarPlazo(modal.id, plazoMeses)
        toast.success('Préstamo actualizado')
      }
      setModal(null); reload(); invalidateDeudaPrestamos()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const toggleActivo = async (p: PrestamoFinanciero) => {
    try { await pagosPrestamosApi.actualizarParcial(p.id, { activo: !num(p.activo ?? 1) }); reload(); invalidateDeudaPrestamos() }
    catch (e) { toast.error(apiError(e).message) }
  }

  const [delPrestamo, setDelPrestamo] = useState<PrestamoFinanciero | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delPrestamo) return
    setDeleting(true)
    try {
      await pagosPrestamosApi.eliminar(delPrestamo.id)
      toast.success('Préstamo eliminado')
      guardarPlazo(delPrestamo.id, 0)
      setDelPrestamo(null); reload(); invalidateDeudaPrestamos()
      invalidateBalanceTesoreria() // borra el ingreso espejo en cascada
    } catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este préstamo ya tuvo actividad (abonos o interés) y no se puede eliminar.' : message)
      setDelPrestamo(null)
    } finally { setDeleting(false) }
  }

  // ── Registrar abono (real — POST /:id/abonos) ─────────────────
  const [abonoTarget, setAbonoTarget] = useState<PrestamoFinanciero | null>(null)
  const [formAbono, setFormAbono] = useState({ fecha_abono: todayISO(), valor: '', metodo_pago: 'transferencia', observaciones: '', comprobante_url: '' })
  const [guardandoAbono, setGuardandoAbono] = useState(false)
  const abrirAbono = (p: PrestamoFinanciero) => { setAbonoTarget(p); setFormAbono({ fecha_abono: todayISO(), valor: '', metodo_pago: 'transferencia', observaciones: '', comprobante_url: '' }) }
  const guardarAbono = async () => {
    if (!abonoTarget) return
    const valor = Number(formAbono.valor) || 0
    const saldoActual = num(abonoTarget.saldo_pendiente)
    if (valor <= 0) { toast.error('Ingresa el monto del abono'); return }
    setGuardandoAbono(true)
    try {
      await pagosPrestamosApi.abonar(abonoTarget.id, {
        valor, fecha_abono: formAbono.fecha_abono, metodo_pago: formAbono.metodo_pago,
        comprobante_url: formAbono.comprobante_url.trim() || undefined, observaciones: formAbono.observaciones.trim() || undefined,
      })
      toast.success('Abono registrado')
      setAbonoTarget(null); reload(); invalidateDeudaPrestamos(); invalidateBalanceTesoreria(); recargarMovimientos(abonoTarget.id)
    } catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? `El abono no puede superar el saldo pendiente (${cop(saldoActual)}).` : message)
    } finally { setGuardandoAbono(false) }
  }

  // ── Capitalizar interés (real — GET proyección + POST /:id/interes) ──
  const [interesTarget, setInteresTarget] = useState<PrestamoFinanciero | null>(null)
  const [proyeccion, setProyeccion] = useState<ProyeccionInteresPrestamo | null>(null)
  const [cargandoProyeccion, setCargandoProyeccion] = useState(false)
  const [capitalizando, setCapitalizando] = useState(false)
  const abrirInteres = (p: PrestamoFinanciero) => {
    setInteresTarget(p); setProyeccion(null); setCargandoProyeccion(true)
    pagosPrestamosApi.getProyeccionInteres(p.id)
      .then(setProyeccion)
      .catch(e => { toast.error(apiError(e).message); setInteresTarget(null) })
      .finally(() => setCargandoProyeccion(false))
  }
  const confirmarCapitalizar = async () => {
    if (!interesTarget) return
    setCapitalizando(true)
    try {
      await pagosPrestamosApi.capitalizarInteres(interesTarget.id)
      toast.success('Interés capitalizado')
      setInteresTarget(null); reload(); invalidateDeudaPrestamos(); invalidateBalanceTesoreria(); recargarMovimientos(interesTarget.id)
    } catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Todavía no ha pasado un mes completo desde el último movimiento de este préstamo.' : message)
    } finally { setCapitalizando(false) }
  }

  // ── Amortización (calculada en el front — el backend no tiene plazo) ────────
  const [detalleAmort, setDetalleAmort] = useState<PrestamoFinanciero | null>(null)

  const totalCapital = data.reduce((s, p) => s + num(p.monto_principal), 0)
  const totalSaldo   = data.reduce((s, p) => s + num(p.saldo_pendiente), 0)
  const activos      = data.filter(p => num(p.activo ?? 1)).length
  const totalCuota   = data.reduce((s, p) => {
    const plazo = plazoDe(p.id)
    return plazo ? s + calcularCuota(num(p.monto_principal), num(p.tasa_interes), plazo) : s
  }, 0)

  return (
    <div className="page">
      <PageHeader
        title="Préstamos financieros"
        subtitle="Créditos bancarios de la empresa — conectado a /pagos/prestamos-financieros."
        actions={canWrite && <Button icon={<Plus size={18} />} onClick={openNuevo}>Nuevo préstamo</Button>}
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Capital total"     value={cop(totalCapital)} icon={<Landmark size={16} />}  accent="brown"   />
        <KpiTile label="Saldo pendiente"   value={cop(totalSaldo)}   icon={<Wallet size={16} />}    accent="rose"    />
        <KpiTile label="Cuota mensual"     value={cop(Math.round(totalCuota))} icon={<Percent size={16} />} accent="emerald" />
        <KpiTile label="Préstamos activos" value={activos}           icon={<RefreshCw size={16} />} accent="green"   />
      </div>

      <Card
        title={`Préstamos (${data.length})`}
        actions={canWrite && <Button size="sm" onClick={openNuevo}>+ Nuevo préstamo</Button>}
      >
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p>
        ) : error ? (
          <p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>
            {error} · <button onClick={reload} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
          </p>
        ) : data.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin préstamos registrados.</p>
        ) : data.map(p => {
          const capital = num(p.monto_principal)
          const saldo = num(p.saldo_pendiente)
          const abonado = capital - saldo
          const pctPagado = capital > 0 ? Math.min(100, Math.max(0, Math.round((abonado / capital) * 100))) : 0
          const expanded = expandedIds.has(p.id)
          const historial = movimientos[p.id] ?? []
          const activo = !!num(p.activo ?? 1)

          return (
            <div key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Fila principal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '12rem' }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>
                    {p.nombre_prestamo}
                    {!activo && <span className="badge badge--neutral" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', verticalAlign: 'middle' }}>INACTIVO</span>}
                  </p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>
                    Capital {cop(capital)} · Tasa {num(p.tasa_interes)}% mensual · Desde {formatDate(p.fecha_adquisicion)}
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
                  <p style={{ fontWeight: 800, color: 'var(--rose-600)', margin: 0 }} className="mono">{cop(saldo)}</p>
                </div>

                <Badge tone={activo ? 'success' : 'neutral'}>{activo ? 'Activo' : 'Inactivo'}</Badge>

                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {canWrite && saldo > 0.01 && <Button size="sm" onClick={() => abrirAbono(p)}>Registrar abono</Button>}
                  {canWrite && saldo > 0.01 && <Button size="sm" variant="secondary" icon={<TrendingUp size={13} />} onClick={() => abrirInteres(p)}>Capitalizar interés</Button>}
                  {plazoDe(p.id) && <Button size="sm" variant="secondary" icon={<Calculator size={13} />} onClick={() => setDetalleAmort(p)}>Ver amortización</Button>}
                  {canWrite && <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEdit(p)} />}
                  {canWrite && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setDelPrestamo(p)} />}
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(p.id)}>
                    {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </Button>
                </div>
              </div>

              {/* Historial de abonos */}
              {expanded && (
                <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem' }}>
                  {!plazoDe(p.id) && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', margin: '0 0 0.5rem' }}>
                      Sin plazo definido — {canWrite ? <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-700)', textDecoration: 'underline', padding: 0 }}>agrégalo en Editar</button> : 'pide a un editor que lo agregue'} para ver la amortización.
                    </p>
                  )}
                  {canWrite && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                      Estado: <button className={`badge badge--${activo ? 'success' : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleActivo(p)}>{activo ? 'Activo' : 'Inactivo'}</button>
                    </p>
                  )}
                  {!movimientos[p.id] ? (
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Cargando historial…</p>
                  ) : historial.length > 0 ? (
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr><th>Fecha</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Saldo resultante</th><th>Observaciones</th></tr>
                      </thead>
                      <tbody>
                        {historial.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                            <td><span className={`badge ${m.tipo === 'abono' ? 'badge--success' : 'badge--info'}`}>{m.tipo === 'abono' ? 'Abono' : 'Interés'}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: m.tipo === 'abono' ? 'var(--emerald-700)' : 'var(--rose-600)' }} className="mono">
                              {m.tipo === 'abono' ? '−' : '+'}{cop(num(m.valor))}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">{cop(num(m.saldo_resultante))}</td>
                            <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{m.observaciones ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin movimientos registrados aún.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* ── Modal: Nuevo / Editar préstamo ── */}
      <Modal
        open={modal !== null}
        title={modal === 'nuevo' ? 'Nuevo préstamo' : 'Editar préstamo'}
        onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre_prestamo.trim() || !form.monto_principal}>Guardar</Button></>}
      >
        <div className="grid grid--form">
          <Input label="Nombre del préstamo" required value={form.nombre_prestamo} onChange={e => f('nombre_prestamo', e.target.value)} />
          <Input label="Fecha de adquisición" type="date" value={form.fecha_adquisicion} onChange={e => f('fecha_adquisicion', e.target.value)} />
          <Input label="Monto principal (capital)" type="number" required value={form.monto_principal} onChange={e => f('monto_principal', e.target.value)}
            helper={modal !== 'nuevo' ? 'Cambiar el capital no ajusta el saldo pendiente — usa "Abonar" para eso.' : undefined} />
          <Input label="Tasa de interés mensual (%)" type="number" value={form.tasa_interes} onChange={e => f('tasa_interes', e.target.value)} />
          <Input label="Plazo (meses, opcional)" type="number" value={form.plazo_meses} onChange={e => f('plazo_meses', e.target.value)}
            helper="Solo para calcular la tabla de amortización — el backend no tiene este campo, se guarda local." />
          <Select label="Estado" value={form.activo ? '1' : '0'} onChange={e => f('activo', e.target.value === '1')}
            options={[{ value: '1', label: 'Activo' }, { value: '0', label: 'Inactivo' }]} />
          {Number(form.plazo_meses) > 0 && Number(form.monto_principal) > 0 && (
            <div className="callout" style={{ gridColumn: '1 / -1' }}>
              Cuota mensual estimada: <strong>{cop(Math.round(calcularCuota(Number(form.monto_principal), Number(form.tasa_interes) || 0, Number(form.plazo_meses))))}</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Registrar abono (real — POST /:id/abonos) ── */}
      {(() => {
        const saldoActual = abonoTarget ? num(abonoTarget.saldo_pendiente) : 0
        const valorNum = Number(formAbono.valor) || 0
        return (
          <Modal open={abonoTarget !== null} title={`Registrar abono — ${abonoTarget?.nombre_prestamo ?? ''}`}
            onClose={() => setAbonoTarget(null)}
            footer={<>
              <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
              <Button onClick={guardarAbono} disabled={guardandoAbono || !formAbono.valor}>Registrar abono</Button>
            </>}>
            {abonoTarget && (
              <div className="callout" style={{ marginBottom: '1rem' }}>
                Capital: <strong>{cop(num(abonoTarget.monto_principal))}</strong>
                {' · '}<span style={{ fontWeight: 700, color: 'var(--rose-700)' }}>Saldo pendiente: {cop(saldoActual)}</span>
              </div>
            )}
            <div className="grid grid--form">
              <Input label="Fecha del abono" type="date" value={formAbono.fecha_abono} onChange={e => setFormAbono(v => ({ ...v, fecha_abono: e.target.value }))} />
              <Input label="Valor abonado (COP)" type="number" mono step="1000" required placeholder="1000000"
                value={formAbono.valor} onChange={e => setFormAbono(v => ({ ...v, valor: e.target.value }))} helper={`Máximo ${cop(saldoActual)}.`} />
              <Select label="Método de pago" value={formAbono.metodo_pago} onChange={e => setFormAbono(v => ({ ...v, metodo_pago: e.target.value }))}
                options={[{ value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'nequi', label: 'Nequi' }, { value: 'deposito', label: 'Depósito' }, { value: 'otro', label: 'Otro' }]} />
              <Input label="Observaciones (opcional)" placeholder="Cuota mensual de septiembre…" style={{ gridColumn: '1 / -1' }}
                value={formAbono.observaciones} onChange={e => setFormAbono(v => ({ ...v, observaciones: e.target.value }))} />
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label">Comprobante (imagen o PDF, opcional)</label>
                {formAbono.comprobante_url ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: 'var(--fs-sm)' }}>
                    <FileText size={15} />
                    <span className="mono">{formAbono.comprobante_url.split('/').pop()}</span>
                    <button type="button" onClick={() => setFormAbono(v => ({ ...v, comprobante_url: '' }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    <ImageIcon size={15} /> Adjuntar comprobante
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                      onChange={e => { const file = e.target.files?.[0]; if (file) setFormAbono(v => ({ ...v, comprobante_url: `http://localhost/${file.name}` })) }} />
                  </label>
                )}
              </div>
            </div>
            {valorNum > 0 && abonoTarget && (
              <div className="callout" style={{ marginTop: '0.75rem' }}>
                Saldo tras el abono: <strong style={{ color: (saldoActual - valorNum) > 0 ? 'var(--rose-700)' : 'var(--green-700)' }}>{cop(Math.max(0, saldoActual - valorNum))}</strong>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ── Modal: Capitalizar interés (preview con /interes/proyeccion antes de confirmar) ── */}
      <Modal open={interesTarget !== null} title={`Capitalizar interés — ${interesTarget?.nombre_prestamo ?? ''}`}
        onClose={() => setInteresTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setInteresTarget(null)}>Cancelar</Button>
          <Button onClick={confirmarCapitalizar} disabled={capitalizando || cargandoProyeccion || !proyeccion || proyeccion.meses_a_acumular <= 0}>
            {capitalizando ? 'Capitalizando…' : 'Confirmar capitalización'}
          </Button>
        </>}>
        {cargandoProyeccion ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>Calculando proyección…</p>
        ) : proyeccion && proyeccion.meses_a_acumular > 0 ? (
          <div className="grid grid--form">
            <div className="callout" style={{ gridColumn: '1 / -1' }}>
              Han pasado <strong>{proyeccion.meses_a_acumular}</strong> mes(es) completos desde el último movimiento de este préstamo.
            </div>
            <Badge tone="neutral">Saldo actual {cop(num(proyeccion.saldo_actual))}</Badge>
            <Badge tone="warning">Interés a capitalizar {cop(num(proyeccion.interes_proyectado))}</Badge>
            <Badge tone="danger">Saldo resultante {cop(num(proyeccion.saldo_si_se_acumula))}</Badge>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>
            Todavía no ha pasado un mes completo desde el último movimiento — no hay interés para capitalizar aún.
          </p>
        )}
      </Modal>

      {/* ── Modal: Tabla de amortización (calculada en el front — plazo local) ── */}
      <Modal
        open={!!detalleAmort}
        title={detalleAmort ? `Amortización — ${detalleAmort.nombre_prestamo}` : ''}
        onClose={() => setDetalleAmort(null)}
        footer={<Button variant="secondary" onClick={() => setDetalleAmort(null)}>Cerrar</Button>}
      >
        {detalleAmort && (() => {
          const capital = num(detalleAmort.monto_principal)
          const tasa = num(detalleAmort.tasa_interes)
          const plazo = plazoDe(detalleAmort.id) ?? 0
          const cuota = plazo > 0 ? calcularCuota(capital, tasa, plazo) : 0
          const filas = plazo > 0 ? tablaAmortizacion(capital, tasa, plazo) : []
          return (
            <>
              <div className="row" style={{ gap: '0.5rem' }}>
                <Badge tone="neutral">Capital {cop(capital)}</Badge>
                <Badge tone="neutral">Tasa {tasa}% mensual</Badge>
                <Badge tone="neutral">Cuota {cop(Math.round(cuota))}</Badge>
              </div>
              <div className="table-wrap" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Mes</th><th>Cuota</th><th>Interés</th><th>Abono capital</th><th>Saldo</th></tr>
                  </thead>
                  <tbody>
                    {filas.map(f => (
                      <tr key={f.mes}>
                        <td className="mono">{f.mes}</td>
                        <td className="mono">{cop(f.cuota)}</td>
                        <td className="mono">{cop(f.interes)}</td>
                        <td className="mono">{cop(f.abonoCapital)}</td>
                        <td className="mono">{cop(f.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        })()}
      </Modal>

      <ConfirmDeleteModal open={!!delPrestamo} title="Eliminar préstamo" itemLabel={delPrestamo?.nombre_prestamo}
        loading={deleting} onCancel={() => setDelPrestamo(null)} onConfirm={confirmDelete} />
    </div>
  )
}
