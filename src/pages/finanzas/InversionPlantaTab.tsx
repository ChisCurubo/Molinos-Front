// ── Inversión Planta ────────────────────────────────────────────
// Compras que benefician la planta a futuro (ampliarla o mejorarla: una
// excavadora, una obra, maquinaria nueva...) en vez de un gasto operativo
// del día a día. Es una categoría más de CxP (como cualquier otra en la
// pestaña "Categorías"), con su propia vista filtrada + botón de alta
// rápida — misma mecánica que "Cuentas", sin mes/proveedor obligatorios
// de otros módulos. Se usa igual desde Finanzas (Juliana) e Importaciones
// (Angela): ambos roles ya tienen permiso de escritura sobre `finanzas`
// (ver src/auth/permissions.ts), así que es la misma data en los dos sitios.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Plus, RefreshCw, TrendingUp } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { pagosCxpApi, type CxpCuenta, type CategoriaCxp } from '@/api/pagosCxp'
import { pagosApi, type Proveedor } from '@/api/pagos'

const NOMBRE_CATEGORIA = 'Inversión Planta'
const cop = formatCOP

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado:    { label: 'Pagado',    cls: 'badge--success' },
  parcial:   { label: 'Parcial',   cls: 'badge--info'    },
  pendiente: { label: 'Pendiente', cls: 'badge--warning' },
}

export function InversionPlantaTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()

  const [categoria, setCategoria] = useState<CategoriaCxp | null>(null)
  const [catLoading, setCatLoading] = useState(true)
  const cargarCategoria = useCallback(() => {
    setCatLoading(true)
    pagosCxpApi.getCategorias()
      .then(r => setCategoria((Array.isArray(r) ? r : []).find(c => c.nombre === NOMBRE_CATEGORIA) ?? null))
      .catch(() => setCategoria(null))
      .finally(() => setCatLoading(false))
  }, [])
  useEffect(() => { cargarCategoria() }, [cargarCategoria])

  const [data, setData] = useState<CxpCuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    if (!categoria) { setData([]); setLoading(false); return }
    setLoading(true); setError(null)
    pagosCxpApi.getMensual({ id_categoria: categoria.id, limit: 200 })
      .then(r => setData(r.cuentas ?? []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [categoria])
  useEffect(() => { load() }, [load])

  const totales = useMemo(() => ({
    total: data.reduce((s, c) => s + num(c.valor_total), 0),
    pagado: data.reduce((s, c) => s + num(c.valor_pagado), 0),
    saldo: data.reduce((s, c) => s + num(c.saldo), 0),
  }), [data])

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  useEffect(() => { pagosApi.getProveedores().then(r => setProveedores(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  const proveedoresPagables = useMemo(() => proveedores.filter(p => p.categoria !== 'Transporte_Mula'), [proveedores])

  const [creandoCat, setCreandoCat] = useState(false)
  const crearCategoria = async () => {
    setCreandoCat(true)
    try { await pagosCxpApi.createCategoria(NOMBRE_CATEGORIA); toast.success('Categoría creada'); cargarCategoria() }
    catch (e) { toast.error(apiError(e).message) } finally { setCreandoCat(false) }
  }

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ id_proveedor: '' as number | '', concepto: '', valor_total: '', fecha_creacion: todayISO() })
  const [saving, setSaving] = useState(false)
  const abrir = () => { setForm({ id_proveedor: '', concepto: '', valor_total: '', fecha_creacion: todayISO() }); setModal(true) }
  const guardar = async () => {
    if (!categoria) return
    if (form.id_proveedor === '') { toast.error('Selecciona el proveedor'); return }
    if (!form.concepto.trim() || !(Number(form.valor_total) > 0)) { toast.error('Concepto y valor son obligatorios'); return }
    setSaving(true)
    try {
      await pagosCxpApi.crear({
        id_proveedor: form.id_proveedor, concepto: form.concepto.trim(), valor_total: Number(form.valor_total),
        id_categoria: categoria.id, fecha_creacion: form.fecha_creacion || undefined,
      })
      toast.success('Inversión registrada'); setModal(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [pagoTarget, setPagoTarget] = useState<CxpCuenta | null>(null)
  const [pagoValor, setPagoValor] = useState('')
  const [savingPago, setSavingPago] = useState(false)
  const abrirPago = (c: CxpCuenta) => { setPagoTarget(c); setPagoValor(String(num(c.saldo))) }
  const guardarPago = async () => {
    if (!pagoTarget) return
    const valor = Number(pagoValor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSavingPago(true)
    try { await pagosCxpApi.pagar(pagoTarget.id, valor); toast.success('Pago registrado'); setPagoTarget(null); load() }
    catch (e) { toast.error(apiError(e).message) } finally { setSavingPago(false) }
  }

  if (catLoading) return <div className="empty" style={{ paddingTop: 48 }}><span>Cargando…</span></div>

  if (!categoria) {
    return (
      <div className="empty" style={{ paddingTop: 48 }}>
        <TrendingUp className="empty__icon" size={40} aria-hidden="true" />
        <strong>Inversión Planta</strong>
        <span>Compras que mejoran o amplían la planta a futuro (maquinaria, obras, mejoras) — es una categoría propia dentro de Gastos.</span>
        {canWrite && <Button style={{ marginTop: 12 }} onClick={crearCategoria} disabled={creandoCat}>{creandoCat ? 'Creando…' : 'Crear categoría'}</Button>}
      </div>
    )
  }

  return (
    <>
      <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
        Compras que benefician la planta a futuro — ampliarla o mejorarla (maquinaria, obras, una excavadora, etc.) — en vez de un gasto operativo del día a día.
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Inversiones" value={data.length} icon={<TrendingUp size={16} />} accent="emerald" />
        <KpiTile label="Total"  value={cop(totales.total)} accent="green" />
        <KpiTile label="Pagado" value={cop(totales.pagado)} accent="brown" />
        <KpiTile label="Saldo"  value={cop(totales.saldo)} accent="rose" />
      </div>

      <Card title={`Inversiones de planta (${data.length})`}
        actions={<div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
          {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrir}>Nueva inversión</Button>}
        </div>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th style={{ minWidth: '16rem' }}>Concepto</th><th>Proveedor</th>
              <th style={{ textAlign: 'right', minWidth: '10rem' }}>Saldo · Total</th>
              <th style={{ minWidth: '8rem' }}>Estado · Fecha</th>
              {canWrite && <th style={{ minWidth: '8rem' }}></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={canWrite ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={canWrite ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin inversiones registradas todavía.</td></tr>
              ) : data.map(c => {
                const eb = ESTADO_BADGE[c.estado] ?? { label: c.estado, cls: 'badge--neutral' }
                const saldo = num(c.saldo)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.concepto || `Inversión #${c.id}`}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{c.beneficiario ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: saldo > 0.01 ? '#b45309' : '#15803d' }} className="mono">{saldo > 0.01 ? cop(saldo) : 'Al día'}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }} className="mono">de {cop(num(c.valor_total))} · pagado {cop(num(c.valor_pagado))}</div>
                    </td>
                    <td>
                      <span className={`badge ${eb.cls}`}>{eb.label}</span>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>{c.fecha_creacion ? formatDate(c.fecha_creacion) : '—'}</div>
                    </td>
                    {canWrite && <td>{saldo > 0.01 && <Button size="sm" icon={<Banknote size={13} />} onClick={() => abrirPago(c)}>Pagar</Button>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title="Nueva inversión de planta" onClose={() => setModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || form.id_proveedor === '' || !form.concepto.trim() || !(Number(form.valor_total) > 0)}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>}>
        <div className="grid grid--form">
          <Select label="Proveedor" required placeholder="— Seleccionar —" style={{ gridColumn: '1 / -1' }}
            value={form.id_proveedor === '' ? '' : String(form.id_proveedor)}
            onChange={e => setForm(s => ({ ...s, id_proveedor: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={proveedoresPagables.map(p => ({ value: String(p.id), label: p.alias && p.alias !== p.nombre ? `${p.nombre} (${p.alias})` : p.nombre }))} />
          <Input label="Concepto" required style={{ gridColumn: '1 / -1' }} placeholder="Excavadora, ampliación de patio, mejora de molino…" value={form.concepto} onChange={e => setForm(s => ({ ...s, concepto: e.target.value }))} />
          <Input label="Valor" type="number" mono step="1000" required value={form.valor_total} onChange={e => setForm(s => ({ ...s, valor_total: e.target.value }))} />
          <Input label="Fecha" type="date" value={form.fecha_creacion} onChange={e => setForm(s => ({ ...s, fecha_creacion: e.target.value }))} />
        </div>
      </Modal>

      <Modal open={pagoTarget != null} title={`Pagar — ${pagoTarget?.concepto ?? ''}`} onClose={() => setPagoTarget(null)}
        footer={<>
          <Button variant="secondary" onClick={() => setPagoTarget(null)}>Cancelar</Button>
          <Button icon={<Banknote size={16} />} onClick={guardarPago} disabled={savingPago || !(Number(pagoValor) > 0)}>{savingPago ? 'Guardando…' : 'Registrar pago'}</Button>
        </>}>
        {pagoTarget && (
          <div className="callout" style={{ marginBottom: '1rem' }}>
            Saldo pendiente: <strong style={{ color: 'var(--rose-700)' }}>{cop(num(pagoTarget.saldo))}</strong>
          </div>
        )}
        <Input label="Valor a pagar" type="number" mono step="1000" required value={pagoValor} onChange={e => setPagoValor(e.target.value)} />
      </Modal>
    </>
  )
}
