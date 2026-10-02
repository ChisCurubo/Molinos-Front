import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Banknote, ChevronDown, ChevronLeft, ChevronRight, FileText,
  Fuel, HandCoins, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { DuenoSelect, VolquetaSelect } from '@/components/common/CatalogSelectors'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosApi, type Proveedor } from '@/api/pagos'
import {
  pagosCombustibleApi, esConsumoEditable,
  type CombustibleRegistro, type CombustibleFiltro, type TipoConsumoCombustible, type FormaPagoCombustible,
  type CrearCombustiblePayload, type ResumenMensualCombustible, type KpisCombustible,
  type GasolineraDeuda, type GasolineraEstadoCuenta, type GasolineraCuentaMes, type GasolineraConsumoResumen, type AbonoGasolinera,
  type MetodoPagoCombustible, type EstadoCuentaPago,
} from '@/api/pagosCombustible'

const cop = formatCOP

const TIPO_OPTS: { value: TipoConsumoCombustible; label: string }[] = [
  { value: 'vehiculo',   label: 'Vehículo' },
  { value: 'planta',     label: 'Planta' },
  { value: 'maquinaria', label: 'Maquinaria' },
  { value: 'otro',       label: 'Otro' },
]
const TIPO_LABEL = (t: string | null | undefined) => TIPO_OPTS.find(o => o.value === t)?.label ?? (t ?? '—')

const FORMA_PAGO_OPTS: { value: FormaPagoCombustible; label: string }[] = [
  { value: 'credito',  label: 'Crédito (gasolinera)' },
  { value: 'efectivo', label: 'Efectivo' },
]
const FORMA_PAGO_LABEL = (f: string | null | undefined) => FORMA_PAGO_OPTS.find(o => o.value === f)?.label ?? (f ?? '—')

const METODO_OPTS: { value: MetodoPagoCombustible; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi',         label: 'Nequi' },
  { value: 'deposito',      label: 'Depósito' },
  { value: 'consignacion',  label: 'Consignación' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'otro',          label: 'Otro' },
]
const METODO_LABEL = (m: string | null | undefined) => METODO_OPTS.find(o => o.value === m)?.label ?? (m ?? '—')
const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',       cls: 'badge--success' },
  parcial:   { label: 'Pago parcial', cls: 'badge--info'    },
  pendiente: { label: 'Pendiente',    cls: 'badge--warning' },
  anulado:   { label: 'Anulado',      cls: 'badge--neutral' },
}
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodoLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${MESES[Number(m) - 1] ?? m} ${y}`
}

function gasolineraLabel(p: Proveedor) { return p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre }

// ── Catálogo de gasolineras: proveedores con tipo="combustible" (columna real, ya no se infiere por nombre de categoría) ──
function GasolineraSelect({ label = 'Gasolinera', value, onChange, placeholder = '— Seleccionar gasolinera —', required, disabled }: {
  label?: string; value: number | ''; onChange: (id: number | '') => void; placeholder?: string; required?: boolean; disabled?: boolean
}) {
  const [data, setData] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setLoading(true); setError(null)
    pagosApi.getProveedores({ tipo: 'combustible' })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  return (
    <Select
      label={label} required={required} disabled={disabled || loading}
      value={value === '' ? '' : String(value)}
      onChange={e => { const v = e.target.value; onChange(v === '' ? '' : Number(v)) }}
      placeholder={loading ? 'Cargando…' : placeholder}
      error={error ?? undefined}
      options={data.map(p => ({ value: String(p.id), label: gasolineraLabel(p) }))}
    />
  )
}

// ── Formulario de consumo (crear/editar) ────────────────────────────────────────
interface ConsumoForm {
  tipo_consumo: TipoConsumoCombustible
  forma_pago: FormaPagoCombustible
  id_gasolinera: number | ''
  id_planta: string
  id_dueno_volqueta: number | ''
  id_vehiculo: number | ''
  fecha: string
  descripcion: string
  valor: string
  comprobante_url: string
}
const emptyConsumoForm = (): ConsumoForm => ({
  tipo_consumo: 'vehiculo', forma_pago: 'credito', id_gasolinera: '', id_planta: '',
  id_dueno_volqueta: '', id_vehiculo: '', fecha: todayISO(), descripcion: '', valor: '', comprobante_url: '',
})

type PageTab = 'consumos' | 'reportes' | 'credito'

export function CombustibleApiPage() {
  const canWrite = useCanWrite('finanzas')
  const toast = useToast()
  const [tab, setTab] = useState<PageTab>('consumos')

  // ── Consumos: filtros + listado ─────────────────────────────
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipoConsumo, setTipoConsumo] = useState('')
  const [formaPago, setFormaPago] = useState('')

  const [data, setData] = useState<CombustibleRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    const filtro: CombustibleFiltro = {
      desde: desde || undefined, hasta: hasta || undefined,
      tipo_consumo: tipoConsumo || undefined, forma_pago: formaPago || undefined,
    }
    pagosCombustibleApi.listar(filtro)
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => { setError(apiError(e).message); toast.error(apiError(e).message) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, tipoConsumo, formaPago])
  useEffect(() => { load() }, [load])

  const totalValor = data.reduce((s, r) => s + num(r.valor), 0)
  const totalCredito = data.filter(r => r.forma_pago === 'credito').reduce((s, r) => s + num(r.valor), 0)
  const totalEfectivo = data.filter(r => r.forma_pago === 'efectivo').reduce((s, r) => s + num(r.valor), 0)

  // Solo cuenta como línea de crédito de gasolinera si trae id_gasolinera: un
  // crédito sin gasolinera (p.ej. ACPM adelantado backfilled contra agua/flete)
  // no es una línea de crédito, es un abono/ajuste interno — no se agrupa aquí.
  const consumoPorGasolinera = useMemo(() => {
    const map = new Map<string, { nombre: string; valor: number; registros: number }>()
    for (const r of data) {
      if (r.forma_pago !== 'credito' || r.id_gasolinera == null) continue
      const key = r.gasolinera ?? `#${r.id_gasolinera}`
      if (!map.has(key)) map.set(key, { nombre: key, valor: 0, registros: 0 })
      const g = map.get(key)!
      g.valor += num(r.valor); g.registros += 1
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor)
  }, [data])

  // ── Consumo: crear / editar ──────────────────────────────────
  const [consumoModal, setConsumoModal] = useState(false)
  const [editConsumo, setEditConsumo] = useState<CombustibleRegistro | null>(null)
  const [form, setForm] = useState<ConsumoForm>(emptyConsumoForm())
  const [savingConsumo, setSavingConsumo] = useState(false)
  const f = <K extends keyof ConsumoForm>(k: K, v: ConsumoForm[K]) => setForm(s => ({ ...s, [k]: v }))

  const abrirNuevoConsumo = () => { setEditConsumo(null); setForm(emptyConsumoForm()); setConsumoModal(true) }
  const abrirEditarConsumo = (r: CombustibleRegistro) => {
    setEditConsumo(r)
    setForm({
      tipo_consumo: (r.tipo_consumo as TipoConsumoCombustible) || 'vehiculo',
      forma_pago: (r.forma_pago as FormaPagoCombustible) || 'credito',
      id_gasolinera: r.id_gasolinera ?? '',
      id_planta: r.id_planta != null ? String(r.id_planta) : '',
      id_dueno_volqueta: r.id_dueno_volqueta ?? '',
      id_vehiculo: r.id_vehiculo ?? '',
      fecha: (r.fecha ?? '').slice(0, 10) || todayISO(),
      descripcion: r.descripcion ?? r.observaciones ?? '',
      valor: String(num(r.valor)),
      comprobante_url: r.comprobante_url ?? '',
    })
    setConsumoModal(true)
  }

  // Si el consumo ya está agrupado/pagado en su cuenta con la gasolinera (o viene de
  // otro módulo), el backend bloquea (409) cualquier cambio que afecte la cuenta —
  // pero descripción/comprobante son datos "seguros" que se pueden corregir siempre.
  const edicionRestringida = editConsumo != null && !esConsumoEditable(editConsumo)

  const guardarConsumo = async () => {
    if (edicionRestringida) {
      setSavingConsumo(true)
      try {
        await pagosCombustibleApi.editar(editConsumo!.id, {
          descripcion: form.descripcion.trim() || undefined,
          comprobante_url: form.comprobante_url.trim() || undefined,
        })
        toast.success('Consumo actualizado')
        setConsumoModal(false); setEditConsumo(null); load()
      } catch (e) { toast.error(apiError(e).message) } finally { setSavingConsumo(false) }
      return
    }
    if (!(Number(form.valor) > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    if (form.forma_pago === 'credito' && form.id_gasolinera === '') { toast.error('La gasolinera es obligatoria para pagos a crédito'); return }
    if (form.tipo_consumo === 'vehiculo' && form.id_vehiculo === '' && form.id_dueno_volqueta === '') {
      toast.error('Selecciona un vehículo o un dueño de volqueta'); return
    }
    setSavingConsumo(true)
    try {
      const payload: CrearCombustiblePayload = {
        tipo_consumo: form.tipo_consumo,
        forma_pago: form.forma_pago,
        valor: Number(form.valor),
        fecha: form.fecha || undefined,
        descripcion: form.descripcion.trim() || undefined,
        comprobante_url: form.comprobante_url.trim() || undefined,
        id_gasolinera: form.forma_pago === 'credito' && form.id_gasolinera !== '' ? Number(form.id_gasolinera) : undefined,
        id_planta: form.tipo_consumo === 'planta' && form.id_planta !== '' ? Number(form.id_planta) : undefined,
        id_dueno_volqueta: form.tipo_consumo === 'vehiculo' && form.id_dueno_volqueta !== '' ? Number(form.id_dueno_volqueta) : undefined,
        id_vehiculo: form.tipo_consumo === 'vehiculo' && form.id_vehiculo !== '' ? Number(form.id_vehiculo) : undefined,
      }
      if (editConsumo) {
        await pagosCombustibleApi.editar(editConsumo.id, payload)
        toast.success('Consumo actualizado')
      } else {
        await pagosCombustibleApi.crear(payload)
        toast.success('Consumo registrado')
      }
      setConsumoModal(false); setEditConsumo(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingConsumo(false) }
  }

  const [delConsumo, setDelConsumo] = useState<CombustibleRegistro | null>(null)
  const [deletingConsumo, setDeletingConsumo] = useState(false)
  const confirmEliminarConsumo = async () => {
    if (!delConsumo) return
    setDeletingConsumo(true)
    try {
      await pagosCombustibleApi.eliminar(delConsumo.id)
      toast.success('Consumo eliminado'); setDelConsumo(null); load()
    } catch (e) { toast.error(apiError(e).message); setDelConsumo(null) }
    finally { setDeletingConsumo(false) }
  }

  return (
    <div className="page">
      <PageHeader title="Combustible (ACPM)" subtitle="Consumo por vehículo/planta, línea de crédito por gasolinera y reportes."
        actions={canWrite && tab === 'consumos' && <Button icon={<Plus size={18} />} onClick={abrirNuevoConsumo}>Nuevo consumo</Button>} />
      {!canWrite && <ReadOnlyBanner />}

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === 'consumos'} className={`segment__btn ${tab === 'consumos' ? 'segment__btn--active' : ''}`} onClick={() => setTab('consumos')}>Consumos</button>
        <button role="tab" aria-selected={tab === 'reportes'} className={`segment__btn ${tab === 'reportes' ? 'segment__btn--active' : ''}`} onClick={() => setTab('reportes')}>Reportes / KPIs</button>
        <button role="tab" aria-selected={tab === 'credito'} className={`segment__btn ${tab === 'credito' ? 'segment__btn--active' : ''}`} onClick={() => setTab('credito')}>Línea de crédito</button>
      </div>

      {tab === 'consumos' && (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Registros" value={data.length} icon={<Fuel size={16} />} accent="emerald" />
            <KpiTile label="Valor total" value={cop(totalValor)} accent="green" />
            <KpiTile label="A crédito" value={cop(totalCredito)} accent="amber" />
            <KpiTile label="En efectivo" value={cop(totalEfectivo)} accent="brown" />
          </div>

          <Card flush>
            <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
              <div style={{ flex: '1 1 9rem' }}>
                <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 9rem' }}>
                <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 11rem' }}>
                <Select label="Tipo de consumo" placeholder="Todos los tipos" value={tipoConsumo}
                  onChange={e => setTipoConsumo(e.target.value)} options={TIPO_OPTS} />
              </div>
              <div style={{ flex: '1 1 11rem' }}>
                <Select label="Forma de pago" placeholder="Todas" value={formaPago}
                  onChange={e => setFormaPago(e.target.value)} options={FORMA_PAGO_OPTS} />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
              </div>
            </div>
          </Card>

          <div style={{ marginTop: '1rem' }}>
            <Card title={`Consumos de combustible (${data.length})`} flush>
              <div className="table-wrap table-wrap--fit">
                <table className="data-table data-table--fit" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '32%' }} />
                    {canWrite && <col style={{ width: '12%' }} />}
                  </colgroup>
                  <thead><tr>
                    <th>Fecha</th>
                    <th>Vehículo / dueño / planta / gasolinera</th>
                    <th>Tipo · forma de pago</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Descripción</th>
                    {canWrite && <th>Acciones</th>}
                  </tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={canWrite ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
                    ) : error ? (
                      <tr><td colSpan={canWrite ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                        {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                      </td></tr>
                    ) : data.length === 0 ? (
                      <tr><td colSpan={canWrite ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin registros para los filtros actuales.</td></tr>
                    ) : data.map(r => {
                      const editable = esConsumoEditable(r)
                      const estadoBadge = r.estado_pago ? (ESTADO_BADGE[r.estado_pago] ?? { label: r.estado_pago, cls: 'badge--neutral' }) : null
                      const entidad = r.tipo_consumo === 'planta'
                        ? (r.planta ?? (r.id_planta != null ? `Planta #${r.id_planta}` : '—'))
                        : (r.dueno_volqueta ?? r.vehiculo ?? r.placa ?? (r.id_dueno_volqueta != null ? `Dueño #${r.id_dueno_volqueta}` : (r.id_vehiculo != null ? `Vehículo #${r.id_vehiculo}` : '—')))
                      return (
                        <tr key={r.id}>
                          <td>{formatDate(r.fecha)}</td>
                          <td style={{ wordBreak: 'break-word' }}>
                            <div style={{ fontWeight: 600 }}>{entidad}</div>
                            {r.gasolinera && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{r.gasolinera}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                              <span className="badge badge--neutral">{TIPO_LABEL(r.tipo_consumo)}</span>
                              <span className={`badge ${r.forma_pago === 'credito' ? 'badge--warning' : 'badge--success'}`}>{FORMA_PAGO_LABEL(r.forma_pago)}</span>
                              {estadoBadge && <span className={`badge ${estadoBadge.cls}`}>{estadoBadge.label}</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }} className="mono">{cop(num(r.valor))}</td>
                          <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                            {r.descripcion ?? r.observaciones ?? '—'}
                          </td>
                          {canWrite && (
                            <td>
                              <div className="row" style={{ gap: 4 }}>
                                <Button variant="secondary" size="sm" icon={<Pencil size={12} />}
                                  title={editable ? 'Editar' : 'Ya está pagado/agrupado — solo puedes editar descripción y comprobante'}
                                  onClick={() => abrirEditarConsumo(r)} />
                                {editable && <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} title="Eliminar" onClick={() => setDelConsumo(r)} />}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  {data.length > 0 && (
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td colSpan={3}>Total ({data.length})</td>
                        <td style={{ textAlign: 'right' }} className="mono">{cop(totalValor)}</td>
                        <td colSpan={canWrite ? 2 : 1} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>

          {consumoPorGasolinera.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <Card title="Consumo a crédito por gasolinera (período filtrado)">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Gasolinera</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                    <tbody>
                      {consumoPorGasolinera.map(g => (
                        <tr key={g.nombre}>
                          <td style={{ fontWeight: 600 }}>{g.nombre}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{g.registros}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(g.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {tab === 'reportes' && <ReportesTab />}
      {tab === 'credito' && <GasolineraCreditoTab canWrite={canWrite} />}

      {/* ── Modal: nuevo/editar consumo ── */}
      <Modal open={consumoModal} title={editConsumo ? `Editar consumo #${editConsumo.id}` : 'Nuevo consumo'}
        onClose={() => { setConsumoModal(false); setEditConsumo(null) }}
        footer={<>
          <Button variant="secondary" onClick={() => { setConsumoModal(false); setEditConsumo(null) }}>Cancelar</Button>
          <Button onClick={guardarConsumo} disabled={
            savingConsumo || (!edicionRestringida && (
              !(Number(form.valor) > 0)
              || (form.forma_pago === 'credito' && form.id_gasolinera === '')
              || (form.tipo_consumo === 'vehiculo' && form.id_vehiculo === '' && form.id_dueno_volqueta === '')
            ))
          }>{savingConsumo ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        {edicionRestringida ? (
          <>
            <div className="callout" style={{ marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-700)' }} />
              <span>Este consumo ya está pagado/agrupado en su cuenta con la gasolinera (o viene de otro módulo) — el valor, la forma de pago, el tipo y a quién corresponde ya no se pueden cambiar aquí. Solo la descripción y el comprobante.</span>
            </div>
            <div className="grid grid--form">
              <Input label="Tipo de consumo" value={TIPO_LABEL(form.tipo_consumo)} disabled />
              <Input label="Forma de pago" value={FORMA_PAGO_LABEL(form.forma_pago)} disabled />
              <Input label="Fecha" value={formatDate(form.fecha)} disabled />
              <Input label="Valor (COP)" mono value={cop(Number(form.valor))} disabled />
              <Input label="Descripción" placeholder="40 galones ACPM para tambores" style={{ gridColumn: '1 / -1' }}
                value={form.descripcion} onChange={e => f('descripcion', e.target.value)} />
              <Input label="Comprobante (URL)" placeholder="https://…/comprobante.png" style={{ gridColumn: '1 / -1' }}
                value={form.comprobante_url} onChange={e => f('comprobante_url', e.target.value)} />
            </div>
          </>
        ) : (
          <div className="grid grid--form">
            <Select label="Tipo de consumo" required options={TIPO_OPTS}
              value={form.tipo_consumo} onChange={e => f('tipo_consumo', e.target.value as TipoConsumoCombustible)} />
            <Select label="Forma de pago" required options={FORMA_PAGO_OPTS}
              value={form.forma_pago} onChange={e => f('forma_pago', e.target.value as FormaPagoCombustible)} />

            {form.forma_pago === 'credito' && (
              <GasolineraSelect required value={form.id_gasolinera} onChange={v => f('id_gasolinera', v)} />
            )}

            {form.tipo_consumo === 'vehiculo' && (
              <>
                <VolquetaSelect label="Vehículo (volqueta)" placeholder="— Sin vincular —" value={form.id_vehiculo} onChange={v => f('id_vehiculo', v)} />
                <DuenoSelect label="Dueño de volqueta" placeholder="— Sin vincular —" value={form.id_dueno_volqueta} onChange={v => f('id_dueno_volqueta', v)} />
              </>
            )}
            {form.tipo_consumo === 'planta' && (
              <Input label="ID de planta" type="number" placeholder="1" value={form.id_planta} onChange={e => f('id_planta', e.target.value)} />
            )}

            <Input label="Fecha" type="date" required value={form.fecha} onChange={e => f('fecha', e.target.value)} />
            <Input label="Valor (COP)" type="number" mono step="1000" required placeholder="320000" value={form.valor} onChange={e => f('valor', e.target.value)} />
            <Input label="Descripción (opcional)" placeholder="40 galones ACPM para tambores" style={{ gridColumn: '1 / -1' }}
              value={form.descripcion} onChange={e => f('descripcion', e.target.value)} />
            <Input label="Comprobante (URL, opcional)" placeholder="https://…/comprobante.png" style={{ gridColumn: '1 / -1' }}
              value={form.comprobante_url} onChange={e => f('comprobante_url', e.target.value)} />
          </div>
        )}
      </Modal>

      <ConfirmDeleteModal open={!!delConsumo} title="Eliminar consumo"
        itemLabel={delConsumo ? `el consumo del ${formatDate(delConsumo.fecha)} por ${cop(num(delConsumo.valor))}` : undefined}
        loading={deletingConsumo} onCancel={() => setDelConsumo(null)} onConfirm={confirmEliminarConsumo} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REPORTES / KPIS
// ════════════════════════════════════════════════════════════════════════════
function ReportesTab() {
  const toast = useToast()
  const [anio, setAnio] = useState(new Date().getFullYear())

  const [resumen, setResumen] = useState<ResumenMensualCombustible[]>([])
  const [loadingResumen, setLoadingResumen] = useState(true)
  const loadResumen = useCallback(() => {
    setLoadingResumen(true)
    pagosCombustibleApi.getResumenMensual(anio)
      .then(r => setResumen(Array.isArray(r) ? r : []))
      .catch(e => toast.error(apiError(e).message))
      .finally(() => setLoadingResumen(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio])
  useEffect(() => { loadResumen() }, [loadResumen])

  const [kpis, setKpis] = useState<KpisCombustible | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(true)
  const loadKpis = useCallback(() => {
    setLoadingKpis(true)
    pagosCombustibleApi.getKpis()
      .then(setKpis)
      .catch(e => toast.error(apiError(e).message))
      .finally(() => setLoadingKpis(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { loadKpis() }, [loadKpis])

  const refreshAll = () => { loadResumen(); loadKpis() }
  const variacion = kpis?.variacion_pct ?? 0

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={refreshAll}>Refrescar</Button>
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Mes actual" value={loadingKpis ? '…' : cop(num(kpis?.mes_actual?.total))} icon={<Fuel size={16} />} accent="emerald" />
        <KpiTile
          label="Variación vs. mes anterior"
          value={loadingKpis ? '…' : `${variacion > 0 ? '+' : ''}${variacion.toFixed(1)}%`}
          icon={variacion > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={variacion > 0 ? 'rose' : 'green'}
        />
        <KpiTile label="Promedio 12 meses" value={loadingKpis ? '…' : cop(num(kpis?.promedio_mensual_ultimos_12))} accent="brown" />
        <KpiTile label="Histórico crédito" value={loadingKpis ? '…' : cop(num(kpis?.total_historico_credito))} accent="amber" />
      </div>

      {kpis && (
        <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
          <strong>{periodoLabel(kpis.mes_actual.periodo)}</strong>: {cop(num(kpis.mes_actual.total))} · <strong>{periodoLabel(kpis.mes_anterior.periodo)}</strong>: {cop(num(kpis.mes_anterior.total))}
          {' · '}Histórico efectivo: <strong>{cop(num(kpis.total_historico_efectivo))}</strong>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <Card title="Top gasolineras (por consumo a crédito)">
          {loadingKpis ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>Cargando…</p>
          ) : (kpis?.top_gasolineras.length ?? 0) === 0 ? (
            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin datos.</em>
          ) : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                <thead><tr><th>Gasolinera</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {kpis!.top_gasolineras.map(g => (
                    <tr key={g.id_gasolinera}>
                      <td>{g.gasolinera ?? `#${g.id_gasolinera}`}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{g.cantidad}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(g.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top dueños con mayor adelanto de ACPM">
          {loadingKpis ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>Cargando…</p>
          ) : (kpis?.top_duenos_adelanto.length ?? 0) === 0 ? (
            <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin datos.</em>
          ) : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
                <thead><tr><th>Dueño</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Adelantado</th></tr></thead>
                <tbody>
                  {kpis!.top_duenos_adelanto.map(d => (
                    <tr key={d.id_dueno_volqueta}>
                      <td>{d.dueno_volqueta ?? `#${d.id_dueno_volqueta}`}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{d.cantidad}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(d.total_adelantado))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Resumen mensual">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <button type="button" onClick={() => setAnio(a => a - 1)} title="Año anterior"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          <strong style={{ minWidth: '4rem', textAlign: 'center' }}>{anio}</strong>
          <button type="button" onClick={() => setAnio(a => a + 1)} disabled={anio >= new Date().getFullYear()} title="Año siguiente"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: anio >= new Date().getFullYear() ? 'not-allowed' : 'pointer', color: anio >= new Date().getFullYear() ? 'var(--text-faint)' : 'var(--text)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="table-wrap table-wrap--fit">
          <table className="data-table data-table--fit" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead><tr>
              <th>Período</th><th style={{ textAlign: 'right' }}>Registros</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Por forma de pago</th>
              <th>Por tipo de consumo</th>
            </tr></thead>
            <tbody>
              {loadingResumen ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : resumen.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin datos para {anio}.</td></tr>
              ) : resumen.map(m => (
                <tr key={m.periodo}>
                  <td style={{ fontWeight: 600 }}>{periodoLabel(m.periodo)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{m.cantidad}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(m.total))}</td>
                  <td style={{ fontSize: 'var(--fs-xs)' }} className="mono">
                    Efvo {cop(num(m.total_efectivo))} · Créd {cop(num(m.total_credito))}
                  </td>
                  <td style={{ fontSize: 'var(--fs-xs)' }} className="mono">
                    {[
                      num(m.total_vehiculo) > 0 && `Veh ${cop(num(m.total_vehiculo))}`,
                      num(m.total_planta) > 0 && `Planta ${cop(num(m.total_planta))}`,
                      num(m.total_maquinaria) > 0 && `Maq ${cop(num(m.total_maquinaria))}`,
                      num(m.total_otro) > 0 && `Otro ${cop(num(m.total_otro))}`,
                    ].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LÍNEA DE CRÉDITO — pago a la gasolinera (cascada por mes, igual patrón que Agua/Mulas)
// ════════════════════════════════════════════════════════════════════════════
interface AbonoForm { valor: string; fecha_abono: string; metodo_pago: MetodoPagoCombustible; comprobante_url: string; observaciones: string }
const emptyAbono = (valor = ''): AbonoForm => ({ valor, fecha_abono: todayISO(), metodo_pago: 'transferencia', comprobante_url: '', observaciones: '' })

function gasolineraDeudaLabel(g: GasolineraDeuda) { return g.alias && g.alias !== g.nombre ? `${g.nombre} (${g.alias})` : g.nombre }

function GasolineraCreditoTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()

  const [gasolineras, setGasolineras] = useState<GasolineraDeuda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCombustibleApi.getDeuda()
      .then(r => setGasolineras(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [detalles, setDetalles] = useState<Record<number, GasolineraEstadoCuenta>>({})
  const [detLoading, setDetLoading] = useState<Set<number>>(new Set())

  const reloadDetalle = useCallback(async (id: number) => {
    try {
      const det = await pagosCombustibleApi.getGasolineraDetalle(id)
      setDetalles(prev => ({ ...prev, [id]: det }))
    } catch (e) { toast.error(apiError(e).message) }
  }, [toast])

  const toggleExpand = async (id: number) => {
    const isOpen = expanded.has(id)
    setExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(id) : n.add(id); return n })
    if (!isOpen) {
      setDetLoading(prev => new Set(prev).add(id))
      await reloadDetalle(id)
      setDetLoading(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const conSaldo = gasolineras.filter(g => num(g.saldo_pendiente) > 0.01).length
  const totalPorPagar = gasolineras.reduce((s, g) => s + Math.max(0, num(g.saldo_pendiente)), 0)
  const totalAbonado = gasolineras.reduce((s, g) => s + num(g.abonado), 0)
  const totalSobrepago = gasolineras.reduce((s, g) => s + num(g.credito_sobrepago), 0)

  // ── Abono (crear) ──────────────────────────────────────────
  const [abonoTarget, setAbonoTarget] = useState<GasolineraDeuda | null>(null)
  const [abonoForm, setAbonoForm] = useState<AbonoForm>(emptyAbono())
  const [savingAbono, setSavingAbono] = useState(false)
  const abrirAbono = (g: GasolineraDeuda) => {
    const saldo = num(g.saldo_pendiente)
    setAbonoTarget(g)
    setAbonoForm(emptyAbono(saldo > 0 ? String(Math.round(saldo)) : ''))
  }
  const guardarAbono = async () => {
    if (!abonoTarget) return
    const valor = Number(abonoForm.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    if (!abonoForm.comprobante_url.trim()) { toast.error('El comprobante es obligatorio'); return }
    setSavingAbono(true)
    try {
      const res = await pagosCombustibleApi.crearAbonoGasolinera(abonoTarget.id, {
        valor, metodo_pago: abonoForm.metodo_pago, fecha_abono: abonoForm.fecha_abono,
        comprobante_url: abonoForm.comprobante_url.trim(),
      })
      const nMeses = res.aplicado_a?.length ?? 0
      const aFavor = num(res.saldo_a_favor_generado)
      toast.success(`Abono aplicado a ${nMeses} cuenta${nMeses === 1 ? '' : 's'} por ${cop(num(res.total_aplicado) || valor)}${aFavor > 0 ? ` · ${cop(aFavor)} quedó a favor` : ''}`)
      const id = abonoTarget.id
      setAbonoTarget(null)
      if (expanded.has(id)) await reloadDetalle(id)
      load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingAbono(false) }
  }

  // ── Abono (editar/eliminar) ────────────────────────────────
  const [editAbono, setEditAbono] = useState<{ idGasolinera: number; abono: AbonoGasolinera } | null>(null)
  const [editForm, setEditForm] = useState<AbonoForm>(emptyAbono())
  const [savingEdit, setSavingEdit] = useState(false)
  const abrirEditAbono = (idGasolinera: number, a: AbonoGasolinera) => {
    setEditAbono({ idGasolinera, abono: a })
    setEditForm({
      valor: String(num(a.valor)), fecha_abono: (a.fecha_abono ?? todayISO()).slice(0, 10),
      metodo_pago: (a.metodo_pago as MetodoPagoCombustible) || 'transferencia',
      comprobante_url: a.comprobante_url ?? '', observaciones: a.observaciones ?? '',
    })
  }
  const guardarEditAbono = async () => {
    if (!editAbono) return
    const valor = Number(editForm.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingEdit(true)
    try {
      await pagosCombustibleApi.editarAbonoGasolinera(editAbono.abono.id, {
        valor, fecha_abono: editForm.fecha_abono, metodo_pago: editForm.metodo_pago,
        comprobante_url: editForm.comprobante_url.trim() || undefined,
        observaciones: editForm.observaciones.trim() || undefined,
      })
      toast.success('Abono actualizado')
      const id = editAbono.idGasolinera
      setEditAbono(null)
      await reloadDetalle(id); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingEdit(false) }
  }
  const eliminarAbono = async (idGasolinera: number, idAbono: number) => {
    if (!confirm('¿Eliminar este abono? La cuenta volverá a parcial/pendiente.')) return
    try {
      await pagosCombustibleApi.eliminarAbonoGasolinera(idAbono)
      toast.success('Abono eliminado')
      await reloadDetalle(idGasolinera); load()
    } catch (e) { toast.error(apiError(e).message) }
  }

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Con saldo pendiente" value={conSaldo} accent="rose" icon={<AlertTriangle size={16} />} />
        <KpiTile label="Total por pagar" value={cop(totalPorPagar)} accent="amber" />
        <KpiTile label="Total abonado" value={cop(totalAbonado)} accent="green" />
        <KpiTile label="Crédito a favor (sobrepago)" value={cop(totalSobrepago)} accent="brown" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
      </div>

      {loading ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>Cargando…</p></Card>
      ) : error ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2.5rem 0' }}>
          {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
        </p></Card>
      ) : gasolineras.length === 0 ? (
        <Card title="Sin pendientes"><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
          No hay líneas de crédito de gasolinera con saldo pendiente.
        </p></Card>
      ) : gasolineras.map(g => {
        const saldo = num(g.saldo_pendiente), pagado = num(g.abonado), valor = num(g.total_credito)
        const isOpen = expanded.has(g.id)
        const det = detalles[g.id]
        const semaforo = saldo <= 0.01 ? '#16a34a' : pagado === 0 ? '#dc2626' : '#f59e0b'
        const pct = valor > 0 ? Math.min(pagado / valor, 1) : (pagado > 0 ? 1 : 0)
        return (
          <div key={g.id} style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-lg)', marginBottom: '0.85rem', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', flexWrap: 'wrap', cursor: 'pointer', background: isOpen ? '#fafaf9' : '#fff' }}
              onClick={() => toggleExpand(g.id)}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: semaforo, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{gasolineraDeudaLabel(g)}</span>
              {num(g.credito_sobrepago) > 0 && <span className="badge badge--success" title="Sobrepago: crédito a favor">A favor {cop(num(g.credito_sobrepago))}</span>}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-xs)' }}>
                <span>Total <strong>{cop(valor)}</strong></span>
                <span style={{ color: '#15803d' }}>Abonado <strong>{cop(pagado)}</strong></span>
                <div style={{ minWidth: 110 }}>
                  <div style={{ height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: pct >= 1 ? '#16a34a' : '#f59e0b', borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: saldo > 0.01 ? '#b45309' : '#15803d', minWidth: 96, textAlign: 'right' }} className="mono">
                  {saldo <= 0.01 ? 'Al día' : cop(saldo)}
                </span>
                {canWrite && saldo > 0.01 && (
                  <span onClick={e => e.stopPropagation()}>
                    <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(g)}>Abonar</Button>
                  </span>
                )}
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', background: '#fafaf9' }}>
                {canWrite && (
                  <div style={{ display: 'flex', marginBottom: '0.75rem' }}>
                    <Button size="sm" icon={<HandCoins size={13} />} onClick={() => abrirAbono(g)} style={{ marginLeft: 'auto' }}>Registrar abono</Button>
                  </div>
                )}
                {detLoading.has(g.id) || !det ? (
                  <p style={{ color: 'var(--text-muted)', padding: '1rem 0', textAlign: 'center' }}>Cargando detalle…</p>
                ) : (det.meses ?? []).length === 0 ? (
                  <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin actividad.</em>
                ) : det.meses.map(mesData => (
                  <MesCard key={mesData.id_cuenta} mesData={mesData} idGasolinera={g.id} canWrite={canWrite}
                    onEditAbono={abrirEditAbono} onEliminarAbono={eliminarAbono} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Modal: nuevo abono ── */}
      <Modal open={abonoTarget != null} title={`Registrar abono — ${abonoTarget ? gasolineraDeudaLabel(abonoTarget) : ''}`}
        onClose={() => setAbonoTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarAbono} disabled={savingAbono || !(Number(abonoForm.valor) > 0) || !abonoForm.comprobante_url.trim()}>
            {savingAbono ? 'Guardando…' : 'Registrar abono'}
          </Button>
        </>}>
        {abonoTarget && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente: <strong style={{ color: 'var(--rose-700)' }}>{cop(Math.max(0, num(abonoTarget.saldo_pendiente)))}</strong>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              El abono se aplica en cascada, empezando por el mes más antiguo con deuda.
            </div>
          </div>
        )}
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required placeholder="800000"
            value={abonoForm.valor} onChange={e => setAbonoForm(s => ({ ...s, valor: e.target.value }))}
            helper="Puede ser mayor al saldo; el excedente queda como crédito a favor." />
          <Input label="Fecha del abono" type="date" required
            value={abonoForm.fecha_abono} onChange={e => setAbonoForm(s => ({ ...s, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={abonoForm.metodo_pago} onChange={e => setAbonoForm(s => ({ ...s, metodo_pago: e.target.value as MetodoPagoCombustible }))} />
          <Input label="Comprobante (URL)" required placeholder="https://…/comprobante.png"
            value={abonoForm.comprobante_url} onChange={e => setAbonoForm(s => ({ ...s, comprobante_url: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Modal: editar abono ── */}
      <Modal open={editAbono != null} title="Editar abono" onClose={() => setEditAbono(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setEditAbono(null)}>Cancelar</Button>
          <Button onClick={guardarEditAbono} disabled={savingEdit || !(Number(editForm.valor) > 0)}>{savingEdit ? 'Guardando…' : 'Guardar cambios'}</Button>
        </>}>
        <div className="grid grid--form">
          <Input label="Valor (COP)" type="number" mono step="1000" required
            value={editForm.valor} onChange={e => setEditForm(s => ({ ...s, valor: e.target.value }))} />
          <Input label="Fecha del abono" type="date" required
            value={editForm.fecha_abono} onChange={e => setEditForm(s => ({ ...s, fecha_abono: e.target.value }))} />
          <Select label="Método de pago" options={METODO_OPTS}
            value={editForm.metodo_pago} onChange={e => setEditForm(s => ({ ...s, metodo_pago: e.target.value as MetodoPagoCombustible }))} />
          <Input label="Comprobante (URL)" value={editForm.comprobante_url}
            onChange={e => setEditForm(s => ({ ...s, comprobante_url: e.target.value }))} />
          <Input label="Observaciones" value={editForm.observaciones}
            onChange={e => setEditForm(s => ({ ...s, observaciones: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}

// ── Card de un mes dentro del detalle de una gasolinera ────────────────────────
function MesCard({ mesData, idGasolinera, canWrite, onEditAbono, onEliminarAbono }: {
  mesData: GasolineraCuentaMes
  idGasolinera: number
  canWrite: boolean
  onEditAbono: (idGasolinera: number, a: AbonoGasolinera) => void
  onEliminarAbono: (idGasolinera: number, idAbono: number) => void
}) {
  const valor = num(mesData.valor_total)
  const pagado = mesData.valor_pagado != null ? num(mesData.valor_pagado) : (mesData.abonos ?? []).reduce((s, a) => s + num(a.valor), 0)
  const saldo = mesData.saldo != null ? num(mesData.saldo) : Math.max(0, valor - pagado)
  const estadoBadge = ESTADO_BADGE[mesData.estado as EstadoCuentaPago] ?? { label: mesData.estado, cls: 'badge--neutral' }
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', background: '#fff', padding: '0.75rem 0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <strong>{mesData.concepto || mesData.periodo}</strong>
        <span className={`badge ${estadoBadge.cls}`}>{estadoBadge.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', display: 'flex', gap: '1rem' }}>
          <span>Valor <strong>{cop(valor)}</strong></span>
          <span style={{ color: '#15803d' }}>Pagado <strong>{cop(pagado)}</strong></span>
          <span style={{ color: saldo > 0.01 ? '#b45309' : '#15803d', fontWeight: 700 }}>{saldo > 0.01 ? `Saldo ${cop(saldo)}` : 'Al día'}</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Consumos ({mesData.consumos?.length ?? 0})
          </div>
          {(mesData.consumos?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin consumos.</em> : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                <thead><tr><th>Fecha</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {mesData.consumos.map((c: GasolineraConsumoResumen) => (
                    <tr key={c.id_combustible}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.fecha)}</td>
                      <td>{TIPO_LABEL(c.tipo_consumo)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(c.monto_aplicado))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Abonos ({mesData.abonos?.length ?? 0})
          </div>
          {(mesData.abonos?.length ?? 0) === 0 ? <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-xs)' }}>Sin abonos.</em> : (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: 'var(--fs-xs)' }}>
                <thead><tr><th>Fecha</th><th>Método</th><th style={{ textAlign: 'right' }}>Valor</th>{canWrite && <th></th>}</tr></thead>
                <tbody>
                  {mesData.abonos.map(a => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.fecha_abono)}</td>
                      <td>{METODO_LABEL(a.metodo_pago)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }} className="mono">{cop(num(a.valor))}</td>
                      {canWrite && (
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {a.comprobante_url && <Button variant="ghost" size="sm" icon={<FileText size={12} />} title="Ver comprobante" onClick={() => window.open(a.comprobante_url!, '_blank', 'noopener,noreferrer')} />}
                            <Button variant="ghost" size="sm" icon={<Pencil size={12} />} title="Editar" onClick={() => onEditAbono(idGasolinera, a)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} title="Eliminar" onClick={() => onEliminarAbono(idGasolinera, a.id)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
