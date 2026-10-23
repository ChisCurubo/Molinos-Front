import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, CalendarRange, ChevronDown, ChevronUp, FileText, Landmark, Pencil, Plus, Scale, Trash2, Wallet, X,
} from 'lucide-react'
import { Badge, Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { BarChartCard } from '@/components/charts/Charts'
import { useCanWrite } from '@/hooks/usePermissions'
import { useBalanceTesoreria, invalidateBalanceTesoreria } from '@/hooks/useBalanceTesoreria'
import { useDeudaPrestamos } from '@/hooks/useDeudaPrestamos'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO, mesActualISO, nombreMes, nombreMesCorto } from '@/utils/format'
import {
  pagosIngresosApi,
  type Ingreso, type IngresoPayload, type CategoriaIngreso, type FlujoCajaResponse,
} from '@/api/pagosIngresos'
import { pagosCxpApi } from '@/api/pagosCxp'
import { pagosCxcApi } from '@/api/pagosCxc'

const cop = formatCOP
type PageTab = 'flujo' | 'tesoreria' | 'mes'

function useCategoriasIngreso() {
  const [data, setData] = useState<CategoriaIngreso[]>([])
  useEffect(() => {
    pagosIngresosApi.getCategorias().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])
  return data
}

export function TesoreriaApiPage() {
  const canWrite = useCanWrite('finanzas')
  const [tab, setTab] = useState<PageTab>('flujo')
  const categorias = useCategoriasIngreso()

  return (
    <div className="page">
      <PageHeader
        title="Tesorería"
        subtitle="Dinero que entra y que sale — ingresos manuales + egresos reales de todos los módulos."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'flujo'} className={`segment__btn ${tab === 'flujo' ? 'segment__btn--active' : ''}`} onClick={() => setTab('flujo')}>Flujo de caja</button>
        <button role="tab" aria-selected={tab === 'tesoreria'} className={`segment__btn ${tab === 'tesoreria' ? 'segment__btn--active' : ''}`} onClick={() => setTab('tesoreria')}>Tesorería</button>
        <button role="tab" aria-selected={tab === 'mes'} className={`segment__btn ${tab === 'mes' ? 'segment__btn--active' : ''}`} onClick={() => setTab('mes')}>Flujo del mes</button>
      </div>

      {tab === 'flujo' && <FlujoCajaTab />}
      {tab === 'tesoreria' && <DetalleMensualTab canWrite={canWrite} categorias={categorias} />}
      {tab === 'mes' && <MesSeleccionadoTab canWrite={canWrite} categorias={categorias} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FLUJO DE CAJA — resumen fijo del mes actual (sin selector)
// ════════════════════════════════════════════════════════════════════════════
function useEsperadoDelMes(mes: number, anio: number) {
  const [data, setData] = useState<{ ingreso: number; egreso: number } | null>(null)
  useEffect(() => {
    // Estos listados paginan para su propia UI maestra (CxP/CxC) — para un
    // total agregado alcanza con pedir un límite alto en vez de recorrer páginas.
    Promise.all([
      pagosCxpApi.getMensual({ mes, anio, limit: 1000 }),
      pagosCxcApi.getMensual({ mes, anio, limit: 1000 }),
    ]).then(([cxp, cxc]) => {
      setData({
        egreso: cxp.cuentas.reduce((s, c) => s + num(c.valor_total), 0),
        ingreso: cxc.cuentas.reduce((s, c) => s + num(c.valor_total), 0),
      })
    }).catch(() => setData({ ingreso: 0, egreso: 0 }))
  }, [mes, anio])
  return data
}

function FlujoCajaTab() {
  const balance = useBalanceTesoreria()
  const deuda = useDeudaPrestamos()
  const [anio, mes] = mesActualISO().split('-').map(Number)
  const esperado = useEsperadoDelMes(mes, anio)
  const flujo = balance.mesData

  const ingresoReal = flujo ? num(flujo.ingresos.total) : 0
  const egresoReal  = flujo ? num(flujo.gastos.total) : 0
  const saldoReal   = flujo ? num(flujo.saldo_mes) : 0
  const ingresoEsperado = esperado?.ingreso ?? 0
  const egresoEsperado  = esperado?.egreso ?? 0
  const saldoEsperado   = ingresoEsperado - egresoEsperado

  // Plata prestada (id_prestamo_fin no-nulo) — se resta del balance real para
  // no leer deuda como si fuera plata del negocio (el widget del TopBar hace
  // lo mismo: muestra la deuda aparte en vez de mezclarla en el balance).
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  useEffect(() => { pagosIngresosApi.listar().then(r => setIngresos(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  const mesISO = mesActualISO()
  const prestamosMes = useMemo(
    () => ingresos.filter(i => i.id_prestamo_fin != null && i.fecha?.slice(0, 7) === mesISO).reduce((s, i) => s + num(i.valor), 0),
    [ingresos, mesISO]
  )
  const prestamosAnio = useMemo(
    () => ingresos.filter(i => i.id_prestamo_fin != null && i.fecha?.slice(0, 4) === String(anio)).reduce((s, i) => s + num(i.valor), 0),
    [ingresos, anio]
  )
  const saldoRealSinPrestamos = saldoReal - prestamosMes
  const saldoAnioSinPrestamos = (balance.anioData ? num(balance.anioData.saldo_anio) : 0) - prestamosAnio

  const chartCategorias = flujo?.gastos.por_categoria.map(c => ({ name: c.categoria, Total: num(c.total) })) ?? []
  const chartTendencia = (balance.anioData?.meses ?? []).map(m => ({
    name: nombreMesCorto(m.mes), Ingresos: num(m.ingresos), Egresos: num(m.gastos),
  }))

  const mesesTabla = (balance.anioData?.meses ?? []).filter(m => m.mes <= mes).slice().reverse()

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '0.75rem' }}>
        <KpiTile label="Ingreso esperado" value={cop(ingresoEsperado)} icon={<ArrowDownCircle size={16} />} accent="green"   />
        <KpiTile label="Ingreso real"     value={cop(ingresoReal)}     icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Egreso esperado"  value={cop(egresoEsperado)}  icon={<ArrowUpCircle size={16} />}   accent="amber"   />
        <KpiTile label="Egreso real"      value={cop(egresoReal)}      icon={<ArrowUpCircle size={16} />}   accent="rose"    />
        <KpiTile label="Balance esperado" value={cop(saldoEsperado)}   icon={<Scale size={16} />}           accent="brown"   />
        <KpiTile label="Balance real"     value={cop(saldoReal)}       icon={<Wallet size={16} />}          accent={saldoReal >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '0.75rem' }}>
        <KpiTile label="Balance del año" value={balance.anioData ? cop(num(balance.anioData.saldo_anio)) : '—'} icon={<Scale size={16} />} accent={(num(balance.anioData?.saldo_anio) ?? 0) >= 0 ? 'emerald' : 'rose'} />
        <KpiTile label="Balance histórico total" value={flujo ? cop(num(flujo.saldo_acumulado_historico)) : '—'} icon={<Landmark size={16} />} accent="brown" />
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Balance real (sin préstamos)" value={cop(saldoRealSinPrestamos)} icon={<Wallet size={16} />} accent={saldoRealSinPrestamos >= 0 ? 'emerald' : 'rose'}
          hint="Balance real del mes, sin contar plata prestada." />
        <KpiTile label="Balance del año (sin préstamos)" value={cop(saldoAnioSinPrestamos)} icon={<Scale size={16} />} accent={saldoAnioSinPrestamos >= 0 ? 'emerald' : 'rose'} />
        <KpiTile label="Deuda (préstamos activos)" value={deuda.total == null ? '—' : cop(deuda.total)} icon={<Landmark size={16} />} accent="amber" />
      </div>

      <div className="grid grid--charts">
        <div>
          <BarChartCard
            title={`Egresos por categoría — ${nombreMes(mesActualISO())}`}
            hint={!flujo ? 'Cargando…' : chartCategorias.length === 0 ? 'Sin movimientos este mes.' : undefined}
            data={chartCategorias}
            bars={[{ key: 'Total', label: 'Total' }]}
            formatter={cop}
          />
          {flujo && flujo.gastos.por_categoria.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
            <Card title="Detalle por categoría">
              <table className="data-table">
                <thead><tr><th>Categoría</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>% del mes</th></tr></thead>
                <tbody>
                  {flujo.gastos.por_categoria.map(c => (
                    <tr key={c.categoria}>
                      <td>{c.categoria}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--rose-600)' }} className="mono">{cop(num(c.total))}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{egresoReal > 0 ? `${Math.round((num(c.total) / egresoReal) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(egresoReal)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">100%</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
            </div>
          )}
        </div>

        <div>
          <BarChartCard
            title={`Ingresos vs. egresos — ${anio}`}
            hint={balance.loading ? 'Cargando…' : undefined}
            data={chartTendencia}
            bars={[{ key: 'Ingresos', label: 'Ingresos' }, { key: 'Egresos', label: 'Egresos' }]}
            formatter={cop}
          />
          <div style={{ marginTop: '0.75rem' }}>
          <Card title={`Detalle mensual — ${anio}`}>
            <table className="data-table">
              <thead><tr><th>Mes</th><th style={{ textAlign: 'right' }}>Ingresos</th><th style={{ textAlign: 'right' }}>Egresos</th><th style={{ textAlign: 'right' }}>Saldo</th></tr></thead>
              <tbody>
                {mesesTabla.map(m => {
                  const saldo = num(m.saldo_mes)
                  return (
                    <tr key={m.mes}>
                      <td>{nombreMesCorto(m.mes)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--emerald-700)' }} className="mono">{cop(num(m.ingresos))}</td>
                      <td style={{ textAlign: 'right', color: 'var(--rose-600)' }} className="mono">{cop(num(m.gastos))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: saldo >= 0 ? 'var(--emerald-700)' : 'var(--rose-600)' }} className="mono">{cop(saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
          </div>
        </div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TESORERÍA — detalle mes a mes del año en curso, sin selector (todos los
// meses visibles de una). El resumen de cada mes viene del mismo
// /flujo-caja/anual que ya cargó el hook; el detalle (ingresos individuales +
// egresos por categoría) se pide solo al expandir ese mes.
// ════════════════════════════════════════════════════════════════════════════
const emptyForm = () => ({ id_categoria: '' as number | '', concepto: '', valor: '', fecha: todayISO(), comprobante_url: '' })

function DetalleMensualTab({ canWrite, categorias }: { canWrite: boolean; categorias: CategoriaIngreso[] }) {
  const toast = useToast()
  const balance = useBalanceTesoreria()

  // Todos los ingresos se piden una sola vez y se agrupan por mes en cliente
  // (no hay filtro mes/año confirmado en /pagos/ingresos).
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loadingIngresos, setLoadingIngresos] = useState(true)
  const loadIngresos = useCallback(() => {
    setLoadingIngresos(true)
    pagosIngresosApi.listar().then(r => setIngresos(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoadingIngresos(false))
  }, [])
  useEffect(() => { loadIngresos() }, [loadIngresos])
  const ingresosDelMes = useCallback((mesISO: string) => ingresos.filter(i => i.fecha?.slice(0, 7) === mesISO), [ingresos])

  // Egresos por categoría — se pide por mes, solo al expandir ese mes.
  const [categoriasPorMes, setCategoriasPorMes] = useState<Record<string, FlujoCajaResponse['gastos']['por_categoria']>>({})
  const [expandido, setExpandido] = useState<string | null>(null)
  const toggleMes = (mesISO: string, mes: number, anio: number) => {
    const next = expandido === mesISO ? null : mesISO
    setExpandido(next)
    if (next && !categoriasPorMes[mesISO]) {
      pagosIngresosApi.getFlujoCaja(mes, anio)
        .then(r => setCategoriasPorMes(prev => ({ ...prev, [mesISO]: r.gastos.por_categoria })))
        .catch(() => {})
    }
  }

  const mesesVisibles = useMemo(() => {
    const [, mesActualNum] = mesActualISO().split('-').map(Number)
    return (balance.anioData?.meses ?? []).filter(m => m.mes <= mesActualNum).slice().reverse()
  }, [balance.anioData])

  // ── Nuevo / Editar ingreso ──────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | Ingreso>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const f = (k: keyof ReturnType<typeof emptyForm>, v: string) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyForm()); setModal('nuevo') }
  const openEdit = (i: Ingreso) => {
    setForm({ id_categoria: i.id_categoria, concepto: i.concepto, valor: String(num(i.valor)), fecha: i.fecha?.slice(0, 10) ?? todayISO(), comprobante_url: i.comprobante_url ?? '' })
    setModal(i)
  }
  const refrescarTodo = () => {
    loadIngresos(); invalidateBalanceTesoreria()
    setCategoriasPorMes({}) // el mes editado pudo cambiar su egreso si se tocó algo más — se vuelve a pedir al reabrir
  }
  const save = async () => {
    if (!form.concepto.trim() || !form.valor || form.id_categoria === '') return
    setSaving(true)
    const body: IngresoPayload = {
      id_categoria: form.id_categoria, concepto: form.concepto.trim(), valor: Number(form.valor),
      fecha: form.fecha, comprobante_url: form.comprobante_url.trim() || undefined,
    }
    try {
      if (modal === 'nuevo') { await pagosIngresosApi.crear(body); toast.success('Ingreso registrado') }
      else if (modal) { await pagosIngresosApi.actualizar(modal.id, body); toast.success('Ingreso actualizado') }
      setModal(null); refrescarTodo()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [borrando, setBorrando] = useState<Ingreso | null>(null)
  const [borrandoLoading, setBorrandoLoading] = useState(false)
  const confirmBorrar = async () => {
    if (!borrando) return
    setBorrandoLoading(true)
    try { await pagosIngresosApi.eliminar(borrando.id); toast.success('Ingreso eliminado'); setBorrando(null); refrescarTodo() }
    catch (e) { toast.error(apiError(e).message); setBorrando(null) }
    finally { setBorrandoLoading(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {canWrite && <Button icon={<Plus size={18} />} onClick={openNuevo}>Nuevo ingreso</Button>}
      </div>

      {balance.loading ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p></Card>
      ) : balance.error ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>{balance.error}</p></Card>
      ) : mesesVisibles.map(m => {
        const anioActual = new Date(todayISO()).getFullYear()
        const key = `${anioActual}-${String(m.mes).padStart(2, '0')}`
        const expanded = expandido === key
        const saldo = num(m.saldo_mes)
        const detalleIngresos = ingresosDelMes(key)
        const detalleCategorias = categoriasPorMes[key]

        return (
          <div key={key} style={{ marginBottom: '0.75rem' }}>
          <Card flush>
            <div
              onClick={() => toggleMes(key, m.mes, anioActual)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.85rem 1rem', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: 700, flex: 1, minWidth: '9rem' }}>{nombreMes(key)}</span>
              <div style={{ textAlign: 'right', minWidth: '7rem' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Ingreso</p>
                <p style={{ fontWeight: 700, color: 'var(--emerald-700)', margin: 0 }} className="mono">{cop(num(m.ingresos))}</p>
              </div>
              <div style={{ textAlign: 'right', minWidth: '7rem' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Egreso</p>
                <p style={{ fontWeight: 700, color: 'var(--rose-600)', margin: 0 }} className="mono">{cop(num(m.gastos))}</p>
              </div>
              <div style={{ textAlign: 'right', minWidth: '7rem' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Saldo</p>
                <Badge tone={saldo >= 0 ? 'success' : 'danger'}>{cop(saldo)}</Badge>
              </div>
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {expanded && (
              <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', margin: '0.75rem 0 0.4rem' }}>Ingresos del mes</p>
                {loadingIngresos ? (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>Cargando…</p>
                ) : detalleIngresos.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>Sin ingresos registrados este mes.</p>
                ) : (
                  <table className="data-table" style={{ margin: '0 0 1rem' }}>
                    <thead><tr><th>Concepto</th><th>Categoría</th><th style={{ textAlign: 'right' }}>Valor</th><th>Fecha</th>{canWrite && <th></th>}</tr></thead>
                    <tbody>
                      {detalleIngresos.map(i => {
                        const automatico = i.id_prestamo_fin != null
                        return (
                          <tr key={i.id}>
                            <td style={{ fontWeight: 600 }}>{i.concepto} {automatico && <Badge tone="info">Automático</Badge>}</td>
                            <td style={{ fontSize: 'var(--fs-sm)' }}>{i.categoria ?? '—'}</td>
                            <td style={{ textAlign: 'right', color: 'var(--emerald-700)', fontWeight: 700 }} className="mono">{cop(num(i.valor))}</td>
                            <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(i.fecha)}</td>
                            {canWrite && (
                              <td>
                                {!automatico && (
                                  <div className="row" style={{ gap: 4 }}>
                                    <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={(e) => { e.stopPropagation(); openEdit(i) }} />
                                    <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={(e) => { e.stopPropagation(); setBorrando(i) }} />
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                <p style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', margin: '0.75rem 0 0.4rem' }}>Egresos por categoría</p>
                {!detalleCategorias ? (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>Cargando…</p>
                ) : detalleCategorias.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>Sin egresos este mes.</p>
                ) : (
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Categoría</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                    <tbody>
                      {detalleCategorias.map(c => (
                        <tr key={c.categoria}>
                          <td>{c.categoria}</td>
                          <td style={{ textAlign: 'right', color: 'var(--rose-600)', fontWeight: 700 }} className="mono">{cop(num(c.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
          </div>
        )
      })}

      {/* ── Modal: Nuevo / Editar ingreso ── */}
      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo ingreso' : 'Editar ingreso'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.concepto.trim() || !form.valor || form.id_categoria === ''}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" required placeholder="Aporte socio Camilo" style={{ gridColumn: '1 / -1' }} value={form.concepto} onChange={e => f('concepto', e.target.value)} />
          <Select label="Categoría" required placeholder="— Elige una categoría —" value={form.id_categoria === '' ? '' : String(form.id_categoria)}
            onChange={e => f('id_categoria', e.target.value)} options={categorias.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} helper="Determina en qué mes aparece listado." />
          <Input label="Valor (COP)" type="number" mono step="1000" required value={form.valor} onChange={e => f('valor', e.target.value)} style={{ gridColumn: '1 / -1' }} />
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="field__label">Comprobante (opcional)</label>
            {form.comprobante_url ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: 'var(--fs-sm)' }}>
                <FileText size={15} /><span className="mono">{form.comprobante_url.split('/').pop()}</span>
                <button type="button" onClick={() => f('comprobante_url', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={14} /></button>
              </div>
            ) : (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                Adjuntar comprobante
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) f('comprobante_url', `http://localhost/${file.name}`) }} />
              </label>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!borrando} title="Eliminar ingreso" itemLabel={borrando?.concepto}
        loading={borrandoLoading} onCancel={() => setBorrando(null)} onConfirm={confirmBorrar} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FLUJO DEL MES — selector de mes (presente → pasado, nunca futuro), trae
// entradas y salidas completas de ESE mes. Componente independiente del de
// arriba a propósito: no toca nada de "Tesorería" (ya validada por el usuario).
// ════════════════════════════════════════════════════════════════════════════
function MesSeleccionadoTab({ canWrite, categorias }: { canWrite: boolean; categorias: CategoriaIngreso[] }) {
  const toast = useToast()
  const [mesSel, setMesSel] = useState(mesActualISO())
  const [anio, mes] = mesSel.split('-').map(Number)

  const [flujo, setFlujo] = useState<FlujoCajaResponse | null>(null)
  const [loadingFlujo, setLoadingFlujo] = useState(true)
  const loadFlujo = useCallback(() => {
    setLoadingFlujo(true)
    pagosIngresosApi.getFlujoCaja(mes, anio).then(setFlujo).catch(() => setFlujo(null)).finally(() => setLoadingFlujo(false))
  }, [mes, anio])
  useEffect(() => { loadFlujo() }, [loadFlujo])

  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loadingIngresos, setLoadingIngresos] = useState(true)
  const loadIngresos = useCallback(() => {
    setLoadingIngresos(true)
    pagosIngresosApi.listar().then(r => setIngresos(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoadingIngresos(false))
  }, [])
  useEffect(() => { loadIngresos() }, [loadIngresos])
  const ingresosDelMes = useMemo(() => ingresos.filter(i => i.fecha?.slice(0, 7) === mesSel), [ingresos, mesSel])

  const refrescar = () => { loadIngresos(); loadFlujo(); invalidateBalanceTesoreria() }

  // ── Nuevo / Editar ingreso ──────────────────────────────────
  const [modal, setModal] = useState<null | 'nuevo' | Ingreso>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const f = (k: keyof ReturnType<typeof emptyForm>, v: string) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm({ ...emptyForm(), fecha: mesSel === mesActualISO() ? todayISO() : `${mesSel}-01` }); setModal('nuevo') }
  const openEdit = (i: Ingreso) => {
    setForm({ id_categoria: i.id_categoria, concepto: i.concepto, valor: String(num(i.valor)), fecha: i.fecha?.slice(0, 10) ?? todayISO(), comprobante_url: i.comprobante_url ?? '' })
    setModal(i)
  }
  const save = async () => {
    if (!form.concepto.trim() || !form.valor || form.id_categoria === '') return
    setSaving(true)
    const body: IngresoPayload = {
      id_categoria: form.id_categoria, concepto: form.concepto.trim(), valor: Number(form.valor),
      fecha: form.fecha, comprobante_url: form.comprobante_url.trim() || undefined,
    }
    try {
      if (modal === 'nuevo') { await pagosIngresosApi.crear(body); toast.success('Ingreso registrado') }
      else if (modal) { await pagosIngresosApi.actualizar(modal.id, body); toast.success('Ingreso actualizado') }
      setModal(null); refrescar()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [borrando, setBorrando] = useState<Ingreso | null>(null)
  const [borrandoLoading, setBorrandoLoading] = useState(false)
  const confirmBorrar = async () => {
    if (!borrando) return
    setBorrandoLoading(true)
    try { await pagosIngresosApi.eliminar(borrando.id); toast.success('Ingreso eliminado'); setBorrando(null); refrescar() }
    catch (e) { toast.error(apiError(e).message); setBorrando(null) }
    finally { setBorrandoLoading(false) }
  }

  const ingresoReal = flujo ? num(flujo.ingresos.total) : 0
  const egresoReal  = flujo ? num(flujo.gastos.total) : 0
  const saldoReal   = flujo ? num(flujo.saldo_mes) : 0

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <Input label="Mes" type="month" icon={<CalendarRange size={16} />} value={mesSel} max={mesActualISO()}
          onChange={e => setMesSel(e.target.value)} style={{ maxWidth: '12rem' }} helper="Desde el mes actual hacia atrás — no futuro." />
        {canWrite && <Button icon={<Plus size={18} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo ingreso</Button>}
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Entradas del mes" value={cop(ingresoReal)} icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Salidas del mes"  value={cop(egresoReal)}  icon={<ArrowUpCircle size={16} />}   accent="rose"    />
        <KpiTile label="Saldo del mes"    value={cop(saldoReal)}   icon={<Scale size={16} />}           accent={saldoReal >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Card title={`Entradas — ${nombreMes(mesSel)} (${ingresosDelMes.length})`}>
          {loadingIngresos ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando…</p>
          ) : ingresosDelMes.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '1.5rem 0' }}>Sin ingresos registrados este mes.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Concepto</th><th>Categoría</th><th style={{ textAlign: 'right' }}>Valor</th><th>Fecha</th>{canWrite && <th></th>}</tr></thead>
              <tbody>
                {ingresosDelMes.map(i => {
                  const automatico = i.id_prestamo_fin != null
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.concepto} {automatico && <Badge tone="info">Automático</Badge>}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{i.categoria ?? '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--emerald-700)', fontWeight: 700 }} className="mono">{cop(num(i.valor))}</td>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(i.fecha)}</td>
                      {canWrite && (
                        <td>
                          {!automatico && (
                            <div className="row" style={{ gap: 4 }}>
                              <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(i)} />
                              <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setBorrando(i)} />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title={`Salidas por categoría — ${nombreMes(mesSel)}`}>
        {loadingFlujo ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando…</p>
        ) : !flujo || flujo.gastos.por_categoria.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '1.5rem 0' }}>Sin egresos este mes.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Categoría</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>% del mes</th></tr></thead>
            <tbody>
              {flujo.gastos.por_categoria.map(c => (
                <tr key={c.categoria}>
                  <td>{c.categoria}</td>
                  <td style={{ textAlign: 'right', color: 'var(--rose-600)', fontWeight: 700 }} className="mono">{cop(num(c.total))}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">{egresoReal > 0 ? `${Math.round((num(c.total) / egresoReal) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(egresoReal)}</td>
                <td style={{ textAlign: 'right' }} className="mono">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {/* ── Modal: Nuevo / Editar ingreso ── */}
      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo ingreso' : 'Editar ingreso'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.concepto.trim() || !form.valor || form.id_categoria === ''}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Concepto" required placeholder="Aporte socio Camilo" style={{ gridColumn: '1 / -1' }} value={form.concepto} onChange={e => f('concepto', e.target.value)} />
          <Select label="Categoría" required placeholder="— Elige una categoría —" value={form.id_categoria === '' ? '' : String(form.id_categoria)}
            onChange={e => f('id_categoria', e.target.value)} options={categorias.map(c => ({ value: String(c.id), label: c.nombre }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} helper="Determina en qué mes aparece listado." />
          <Input label="Valor (COP)" type="number" mono step="1000" required value={form.valor} onChange={e => f('valor', e.target.value)} style={{ gridColumn: '1 / -1' }} />
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="field__label">Comprobante (opcional)</label>
            {form.comprobante_url ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: 'var(--fs-sm)' }}>
                <FileText size={15} /><span className="mono">{form.comprobante_url.split('/').pop()}</span>
                <button type="button" onClick={() => f('comprobante_url', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={14} /></button>
              </div>
            ) : (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                Adjuntar comprobante
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) f('comprobante_url', `http://localhost/${file.name}`) }} />
              </label>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!borrando} title="Eliminar ingreso" itemLabel={borrando?.concepto}
        loading={borrandoLoading} onCancel={() => setBorrando(null)} onConfirm={confirmBorrar} />
    </>
  )
}
