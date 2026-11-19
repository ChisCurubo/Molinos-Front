import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, useToast } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate } from '@/utils/format'
import { pagosImpuestosApi } from '@/api/pagosImpuestos'
import { pagosRetencionesApi, type RetencionAplicada, type RetencionCatalogo, type TipoRetencion } from '@/api/pagosRetenciones'
import { useCanWrite } from '@/hooks/usePermissions'

const cop = formatCOP
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Próximo impuesto a agregar aquí (ReteICA…) cuando el negocio confirme que
// aplica — ver docs/plan_finanzas_2026-10-17.md §2.
type ImpuestoTab = 'aplicado' | 'retefuente' | 'reteiva'
const TABS: { value: ImpuestoTab; label: string }[] = [
  { value: 'aplicado',   label: '4×1000 aplicado' },
  { value: 'retefuente', label: 'ReteFuente' },
  { value: 'reteiva',    label: 'ReteIVA' },
]

export function ImpuestosApiPage() {
  const [tab, setTab] = useState<ImpuestoTab>('aplicado')
  return (
    <div className="page">
      <PageHeader title="Impuestos" subtitle="Impuestos y retenciones sobre el dinero que mueve la empresa." />

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.value} role="tab" aria-selected={tab === t.value}
            className={`segment__btn ${tab === t.value ? 'segment__btn--active' : ''}`} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'aplicado' && <AplicadoTab />}
      {tab === 'retefuente' && <RetencionesTab tipo="fuente" />}
      {tab === 'reteiva' && <RetencionesTab tipo="iva" />}
    </div>
  )
}

// ── 4×1000 aplicado (real) ───────────────────────────────────────
// Desde que las cuentas bancarias existen, el backend cobra y guarda el
// 4×1000 solo cuando un abono manda `id_cuenta_bancaria` de una cuenta no
// exenta — ver GET /pagos/impuestos/aplicados. Reemplaza el estimado de abajo
// como número oficial; el estimado queda solo como calculadora de simulación.
function AplicadoTab() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`

  const [data, setData] = useState<Awaited<ReturnType<typeof pagosImpuestosApi.getAplicados>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosImpuestosApi.getAplicados({ desde, hasta })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [desde, hasta])
  useEffect(() => { load() }, [load])

  const totalImpuesto = useMemo(() => data.reduce((s, a) => s + num(a.valor_impuesto), 0), [data])
  const totalBase = useMemo(() => data.reduce((s, a) => s + num(a.valor_base), 0), [data])

  return (
    <>
      <div className="callout" style={{ marginBottom: '1.25rem', fontSize: 'var(--fs-sm)' }}>
        4×1000 real, cobrado automático por el backend cuando un abono se hizo desde una cuenta bancaria no exenta (pestaña "Cuentas bancarias"
        en Gastos/Ingresos). Si un pago no tiene cuenta asociada (efectivo o sin elegir) no aparece aquí.
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 700, minWidth: '11rem', textAlign: 'center' }}>{MESES[mes - 1]} {anio}{esMesActual && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Actual</span>}</span>
        <button type="button" onClick={() => shiftMonth(1)} disabled={esMesActual} title="Mes siguiente"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: esMesActual ? 'not-allowed' : 'pointer', color: esMesActual ? 'var(--text-faint)' : 'var(--text)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Movimientos gravados" value={loading ? '…' : data.length} accent="brown" />
        <KpiTile label="Base gravable" value={loading ? '…' : cop(totalBase)} accent="rose" />
        <KpiTile label="4×1000 cobrado" value={loading ? '…' : cop(totalImpuesto)} icon={<Receipt size={16} />} accent="amber" />
      </div>

      <Card title={`4×1000 aplicado en ${MESES[mes - 1]} ${anio} (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Fecha</th><th>Cuenta bancaria</th><th>Impuesto</th>
              <th style={{ textAlign: 'right' }}>Base</th><th style={{ textAlign: 'right' }}>4×1000</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin 4×1000 aplicado en {MESES[mes - 1]} {anio}.</td></tr>
              ) : data.map(a => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                  <td>{a.cuenta_bancaria}</td>
                  <td style={{ color: 'var(--text-faint)' }}>{a.impuesto}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(num(a.valor_base))}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{cop(num(a.valor_impuesto))}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Total</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(totalBase)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{cop(totalImpuesto)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  )
}

// ── Retenciones (ReteFuente / ReteIVA) ───────────────────────────
// Igual mecánica que el 4×1000 pero al revés: se descuenta DEL pago al
// tercero al crear la cuenta por pagar (hoy solo Mulas 1% y Alquiler 4%+15%),
// no se cobra aparte. Catálogo + histórico real, con ajuste manual por fila.
// Una pestaña por tipo (ReteFuente / ReteIVA) — el catálogo no trae un campo
// `tipo` propio, así que se infiere por nombre (shortcut: si el backend algún
// día agrega un concepto de IVA sin la palabra "iva" en el nombre, revisar
// pagosRetenciones.ts y este filtro).
const esConceptoIva = (nombre: string) => nombre.toLowerCase().includes('iva')

function RetencionesTab({ tipo }: { tipo: TipoRetencion }) {
  const toast = useToast()
  const canWrite = useCanWrite('finanzas')
  const esIva = tipo === 'iva'

  const [catalogo, setCatalogo] = useState<RetencionCatalogo[]>([])
  const [catalogoError, setCatalogoError] = useState<string | null>(null)
  useEffect(() => {
    pagosRetencionesApi.getCatalogo()
      .then(r => setCatalogo(Array.isArray(r) ? r : []))
      .catch(e => setCatalogoError(apiError(e).message))
  }, [])
  const catalogoFiltrado = useMemo(() => catalogo.filter(c => esConceptoIva(c.nombre) === esIva), [catalogo, esIva])

  const now = new Date()
  const [desde, setDesde] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [hasta, setHasta] = useState(now.toISOString().slice(0, 10))

  const [data, setData] = useState<RetencionAplicada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosRetencionesApi.getAplicadas({ tipo, desde, hasta })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [tipo, desde, hasta])
  useEffect(() => { load() }, [load])

  const totalBase = useMemo(() => data.reduce((s, a) => s + num(a.valor_base), 0), [data])
  const totalRetenido = useMemo(() => data.reduce((s, a) => s + num(a.valor_retenido), 0), [data])

  const [ajuste, setAjuste] = useState<RetencionAplicada | null>(null)
  const [valorAjuste, setValorAjuste] = useState('')
  const [guardando, setGuardando] = useState(false)
  const abrirAjuste = (a: RetencionAplicada) => { setAjuste(a); setValorAjuste(String(num(a.valor_retenido))) }
  const guardarAjuste = async () => {
    if (!ajuste) return
    const valor = Number(valorAjuste)
    if (!Number.isFinite(valor) || valor < 0) { toast.error('Valor retenido inválido'); return }
    setGuardando(true)
    try {
      await pagosRetencionesApi.ajustar(ajuste.id, valor)
      toast.success('Retención ajustada')
      setAjuste(null); load()
    } catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'El ajuste deja el total pagado por encima del valor de la cuenta.' : message)
    } finally { setGuardando(false) }
  }

  return (
    <>
      <div className="callout" style={{ marginBottom: '1.25rem', fontSize: 'var(--fs-sm)', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>
          <strong>¿Qué es {esIva ? 'ReteIVA' : 'ReteFuente'}?</strong> Al pago no se le entrega el 100% al tercero (proveedor,
          transportador, arrendador): se le descuenta un % y ese % se le consigna aparte a la DIAN a nombre de él, como anticipo
          de su impuesto.
        </p>
        <p style={{ margin: 0 }}>
          {esIva
            ? <>Hoy solo aplica en Alquiler. Mulas no lleva ReteIVA. ⚠️ Activa sin confirmar con el contador si Molinos es agente de reteIVA.</>
            : <>Hoy aplica en Mulas (transporte de carga) y Alquiler (arrendamiento). Material/Minero, Flete y Agua quedan fuera por ahora.</>}
        </p>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <Card title="Tarifa (el % que se descuenta)">
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.5rem' }}>
            Es el % que el sistema aplica solo cuando se crea una cuenta nueva de este tipo. Hoy no se puede cambiar desde aquí —
            si la ley cambia la tarifa (ej. de 4% a 19%), hay que pedir que se actualice en el servidor.
          </p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.75rem' }}>
            <strong>No confundir con "Ajustar"</strong> (más abajo): eso solo corrige el valor de un pago puntual ya hecho, no
            cambia este % para los pagos futuros.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Concepto</th><th style={{ textAlign: 'right' }}>Tarifa declarante</th><th style={{ textAlign: 'right' }}>Tarifa no declarante</th><th>Estado</th></tr></thead>
              <tbody>
                {catalogoError ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--rose-600)' }}>{catalogoError}</td></tr>
                ) : catalogoFiltrado.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Sin conceptos configurados.</td></tr>
                ) : catalogoFiltrado.map(c => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{num(c.tarifa_declarante).toFixed(1)}%</td>
                    <td style={{ textAlign: 'right' }} className="mono">{c.tarifa_no_declarante != null ? `${num(c.tarifa_no_declarante).toFixed(1)}%` : '—'}</td>
                    <td><span className={`badge ${c.activo === false || c.activo === 0 ? 'badge--neutral' : 'badge--success'}`}>{c.activo === false || c.activo === 0 ? 'Inactivo' : 'Vigente'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="callout" style={{ marginBottom: '1.25rem', fontSize: 'var(--fs-sm)' }}>
        <strong>Abajo — "{esIva ? 'ReteIVA' : 'ReteFuente'} aplicada"</strong> es el historial de lo que ya se retuvo, pago por pago.
        "Ajustar" corrige el valor de un pago puntual (si se calculó mal una vez) — no cambia la tarifa de arriba ni los pagos futuros.
      </div>

      <div className="grid grid--form" style={{ marginBottom: '1rem' }}>
        <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Retenciones aplicadas" value={loading ? '…' : data.length} accent="brown" />
        <KpiTile label="Base gravable" value={loading ? '…' : cop(totalBase)} accent="rose" />
        <KpiTile label="Total retenido" value={loading ? '…' : cop(totalRetenido)} icon={<Receipt size={16} />} accent="amber" />
      </div>

      <Card title={`${esIva ? 'ReteIVA' : 'ReteFuente'} aplicada (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Fecha</th><th>Concepto</th><th>Cuenta</th>
              <th style={{ textAlign: 'right' }}>Base</th><th style={{ textAlign: 'right' }}>Tarifa</th>
              <th style={{ textAlign: 'right' }}>Retenido</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin {esIva ? 'reteIVA' : 'retefuente'} aplicada en este rango.</td></tr>
              ) : data.map(a => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha)}</td>
                  <td>
                    {a.concepto ?? `Concepto #${a.id_concepto_retencion}`}
                    {(a.ajustado_manualmente === true || a.ajustado_manualmente === 1) && (
                      <span className="badge badge--warning" style={{ marginLeft: 6, fontSize: '0.65rem' }}
                        title={a.valor_calculado_original != null ? `Calculado originalmente: ${cop(num(a.valor_calculado_original))}` : 'Ajustado manualmente'}>
                        Ajustado
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-faint)' }}>{a.cuenta_concepto ?? `Cuenta #${a.id_cuenta_pagar}`}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(num(a.valor_base))}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{num(a.tarifa_aplicada).toFixed(1)}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--amber-700)' }} className="mono">{cop(num(a.valor_retenido))}</td>
                  {canWrite && (
                    <td><Button variant="secondary" size="sm" onClick={() => abrirAjuste(a)}>Ajustar</Button></td>
                  )}
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Total</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(totalBase)}</td>
                  <td></td>
                  <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{cop(totalRetenido)}</td>
                  {canWrite && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Modal open={ajuste !== null} title="Ajustar retención" onClose={() => setAjuste(null)}
        footer={<><Button variant="secondary" onClick={() => setAjuste(null)}>Cancelar</Button><Button onClick={guardarAjuste} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button></>}>
        <Input label="Valor retenido" type="number" min={0} mono value={valorAjuste} onChange={e => setValorAjuste(e.target.value)} />
      </Modal>
    </>
  )
}
