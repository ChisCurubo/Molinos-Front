import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2, CalendarClock, ChevronDown, ChevronRight, Gift, Landmark, Pencil, Plus, Trash2, UserCog, Users2, Wallet,
} from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, todayISO } from '@/utils/format'
import {
  nominaApi,
  type Empleado, type Planta, type PlantaPayload, type Turno, type TipoTurno, type TipoTurnoPayload,
  type JornadaNocturnaLegal,
  type LiquidacionPreview, type Liquidacion, type DetalleTurnoLiquidacion, type PreviewLiquidacionError, type Bono, type SaldoPrestamoEmpleado,
  type FichaEmpleado,
} from '@/api/nomina'
import {
  EmpleadosTab, SalariosTab, PrestamosTab, EmpleadoSelect, useEmpleados,
  nombreCompleto, fmtDMY, TableState, Avatar,
} from '@/pages/nomina/empleadosShared'
import '@/pages/nomina/calendario.css'

const cop = formatCOP

function looksLikeMoney(key: string) { return /valor|monto|neto|salario|tarifa|cesant|prima|interes|vacacion|bono|aux/i.test(key) }
function looksLikeDate(key: string) { return /fecha|created_at|desde|hasta/i.test(key) }
function looksLikeId(key: string) { return /^id(_|$)/i.test(key) || key === 'id' }
// Banderas booleanas que el backend manda como tinyint (0/1) — sin esto, claves
// como "aplica_aux_transp" caían en looksLikeMoney (por "aux") y se mostraban
// como "$1" en vez de "Sí".
function looksLikeBooleanFlag(key: string) { return /^aplica_|^activo$|_activo$|^presente$|^nequi$/i.test(key) }
function fmtCell(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (looksLikeDate(key) && typeof v === 'string') return fmtDMY(v)
  if (looksLikeBooleanFlag(key) && (typeof v === 'boolean' || v === 0 || v === 1 || v === '0' || v === '1')) return Number(v) ? 'Sí' : 'No'
  if (!looksLikeId(key) && looksLikeMoney(key) && (typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))) return cop(Number(v))
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
function humanKey(k: string) { return k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) }

// ── Renderiza cualquier objeto/array del backend sin asumir su forma exacta
// (la Ficha 360 no viene documentada campo a campo) ─────────────────────────
function GenericArrayTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin registros.</p>
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).filter(k => !looksLikeId(k)).slice(0, 7)
  return (
    <div className="table-wrap">
      <table className="data-table" style={{ fontSize: 'var(--fs-sm)' }}>
        <thead><tr>{cols.map(c => <th key={c}>{humanKey(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map(c => <td key={c} className={looksLikeMoney(c) ? 'mono' : undefined}>{fmtCell(c, r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function GenericKV({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([k]) => !looksLikeId(k))
  if (entries.length === 0) return <p style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin datos.</p>
  return (
    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{humanKey(k)}</div>
          <div style={{ fontWeight: 700 }} className={looksLikeMoney(k) ? 'mono' : undefined}>{fmtCell(k, v)}</div>
        </div>
      ))}
    </div>
  )
}
function GenericSection({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{label}</p>
      {Array.isArray(value)
        ? (typeof value[0] === 'object' ? <GenericArrayTable rows={value as Record<string, unknown>[]} /> : <p>{value.join(', ') || '—'}</p>)
        : typeof value === 'object' ? <GenericKV obj={value as Record<string, unknown>} /> : <p className="mono">{fmtCell(label, value)}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RESUMEN (ficha 360) — GET /empleados/:id/ficha (+ /prestaciones)
// ════════════════════════════════════════════════════════════════════════════
function ResumenPanel({ empleado }: { empleado: Empleado }) {
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [ficha, setFicha] = useState<FichaEmpleado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([
      nominaApi.getFicha(empleado.id, Number(anio) || undefined),
      nominaApi.getPrestaciones(empleado.id, Number(anio) || undefined).catch(() => null),
    ]).then(([f, prest]) => {
      setFicha(prest ? { ...f, prestaciones: (f as Record<string, unknown>).prestaciones ?? prest } : f)
    }).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [empleado, anio])
  useEffect(() => { load() }, [load])

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <Input label="Año" type="number" value={anio} onChange={e => setAnio(e.target.value)} style={{ maxWidth: '8rem' }} />
        <Button size="sm" variant="secondary" onClick={load}>Actualizar</Button>
      </div>
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p>
      ) : error ? (
        <p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>{error}</p>
      ) : ficha ? (
        <div style={{ maxHeight: '22rem', overflowY: 'auto' }}>
          {Object.entries(ficha).map(([k, v]) => <GenericSection key={k} label={humanKey(k)} value={v} />)}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Sin datos.</p>
      )}
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
        Vista genérica: el backend no documenta el shape exacto de la ficha, así que se muestra tal cual llega.
      </p>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PAGOS — historial de liquidaciones de un empleado (GET /liquidaciones?id_empleado=)
// ════════════════════════════════════════════════════════════════════════════
function PagosHistorialPanel({ idEmpleado }: { idEmpleado: number }) {
  const [data, setData] = useState<Liquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getLiquidaciones({ id_empleado: idEmpleado })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [idEmpleado])
  useEffect(() => { load() }, [load])

  const total = data.reduce((s, h) => s + num(h.monto_neto ?? h.neto), 0)

  return (
    <Card title={`Historial de pagos (${data.length})`}>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Fecha</th><th>Periodo</th><th style={{ textAlign: 'right' }}>Neto</th></tr></thead>
          <tbody>
            <TableState loading={loading} error={error} empty={data.length === 0} cols={3} onRetry={load} />
            {!loading && !error && data.map(h => (
              <tr key={h.id}>
                <td>{fmtDMY(h.fecha)}</td>
                <td>{h.anio}-{String(h.mes).padStart(2, '0')} · Q{h.quincena}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(h.monto_neto ?? h.neto))}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={2}>Total pagado</td><td style={{ textAlign: 'right' }} className="mono">{cop(total)}</td></tr></tfoot>
          )}
        </table>
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PERFIL DE EMPLEADO — foto (o iniciales mientras no exista foto_url en el
// backend) + info básica + pestañas con historial completo: ficha 360,
// salario (aumentos), préstamos, bonos y pagos. Se abre al hacer clic en el
// nombre del empleado en cualquier pestaña de este módulo.
// ════════════════════════════════════════════════════════════════════════════
type PerfilTab = 'resumen' | 'salario' | 'prestamos' | 'bonos' | 'pagos'
const PERFIL_TABS: { key: PerfilTab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'salario', label: 'Salario' },
  { key: 'prestamos', label: 'Préstamos' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'pagos', label: 'Pagos' },
]

export function EmpleadoProfileModal({ idEmpleado, empleados, canWrite, onClose }: {
  idEmpleado: number | null; empleados: ReturnType<typeof useEmpleados>; canWrite: boolean; onClose: () => void
}) {
  const empleado = idEmpleado != null ? empleados.data.find(e => e.id === idEmpleado) ?? null : null
  const [tab, setTab] = useState<PerfilTab>('resumen')
  useEffect(() => { setTab('resumen') }, [idEmpleado])

  return (
    <Modal open={!!empleado} title={empleado ? nombreCompleto(empleado) : ''} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      {empleado && (
        <>
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', marginBottom: '1rem' }}>
            <Avatar empleado={empleado} size={56} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{nombreCompleto(empleado)}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                CC {empleado.cc}{empleado.labor ? ` · ${empleado.labor}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                {empleado.cuenta && <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{empleado.cuenta}</span>}
                {!!num(empleado.nequi) && <span className="badge badge--info" style={{ fontSize: '0.65rem' }}>Nequi</span>}
              </div>
            </div>
          </div>

          <div className="segment" role="tablist" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
            {PERFIL_TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          <div style={{ maxHeight: '26rem', overflowY: 'auto' }}>
            {tab === 'resumen' && <ResumenPanel empleado={empleado} />}
            {tab === 'salario' && <SalariosTab canWrite={canWrite} empleados={empleados} idEmpleadoInicial={empleado.id} fixed />}
            {tab === 'prestamos' && <PrestamosTab canWrite={canWrite} empleados={empleados} idEmpleadoInicial={empleado.id} fixed />}
            {tab === 'bonos' && <BonosTab canWrite={canWrite} empleados={empleados} idEmpleadoInicial={empleado.id} fixed />}
            {tab === 'pagos' && <PagosHistorialPanel idEmpleado={empleado.id} />}
          </div>
        </>
      )}
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PLANTAS
// ════════════════════════════════════════════════════════════════════════════
export function usePlantas() {
  const [data, setData] = useState<Planta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getPlantas().then(r => setData(Array.isArray(r) ? r : [])).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

export function PlantasTab({ canWrite, plantas }: { canWrite: boolean; plantas: ReturnType<typeof usePlantas> }) {
  const toast = useToast()
  const [modal, setModal] = useState<null | 'nueva' | Planta>(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '' })
  const [saving, setSaving] = useState(false)
  const openNueva = () => { setForm({ nombre: '', ubicacion: '' }); setModal('nueva') }
  const openEdit = (p: Planta) => { setForm({ nombre: p.nombre, ubicacion: p.ubicacion ?? '' }); setModal(p) }
  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    const body: PlantaPayload = { nombre: form.nombre.trim(), ubicacion: form.ubicacion.trim() || undefined }
    try {
      if (modal === 'nueva') { await nominaApi.createPlanta(body); toast.success('Planta creada') }
      else if (modal) { await nominaApi.updatePlanta(modal.id, body); toast.success('Planta actualizada') }
      setModal(null); plantas.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delPlanta, setDelPlanta] = useState<Planta | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delPlanta) return
    setDeleting(true)
    try { await nominaApi.deletePlanta(delPlanta.id); toast.success('Planta eliminada'); setDelPlanta(null); plantas.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 || status === 500 ? 'Esta planta tiene turnos asociados y no se puede eliminar.' : message)
      setDelPlanta(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Plantas / sedes (${plantas.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNueva}>Nueva planta</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Ubicación</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={plantas.loading} error={plantas.error} empty={plantas.data.length === 0} cols={canWrite ? 3 : 2} onRetry={plantas.reload} />
              {!plantas.loading && !plantas.error && plantas.data.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.nombre}</td>
                  <td>{p.ubicacion ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}>
                    <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelPlanta(p)} />
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nueva' ? 'Nueva planta' : 'Editar planta'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre de la planta" required value={form.nombre} onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} />
          <Input label="Ubicación" value={form.ubicacion} onChange={e => setForm(s => ({ ...s, ubicacion: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delPlanta} title="Eliminar planta" itemLabel={delPlanta?.nombre}
        loading={deleting} onCancel={() => setDelPlanta(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CALENDARIO — grilla igual que /nomina/calendario, conectada al backend real:
// PUT /nomina/turnos/upsert (nunca duplica, por id_empleado+fecha) y
// DELETE /nomina/turnos/dia para limpiar una celda.
// ════════════════════════════════════════════════════════════════════════════
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CELL_CLASSES = ['cal-cell--d', 'cal-cell--t', 'cal-cell--n']

export function useTiposTurno() {
  const [data, setData] = useState<TipoTurno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getTiposTurno().then(r => setData(Array.isArray(r) ? r : [])).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

// ════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE TURNOS — tipos de turno (CRUD) + jornada nocturna legal
// (histórico del corte, solo-lectura casi siempre). El recargo de un tipo de
// turno es SOLO la política propia de la empresa; el nocturno (+35%) y el
// dominical/festivo (+75%) de ley se calculan aparte y se suman solos.
// ════════════════════════════════════════════════════════════════════════════
const RECARGO_FESTIVO_PCT = 75
const RECARGO_NOCTURNO_PCT = 35

function minutosDe(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
// Si el tipo de turno tiene horas que caen en zona nocturna (desde el corte
// vigente hasta las 6:00 a.m.) — para mostrar el +35% en la columna Recargo
// cuando el turno no tiene recargo propio (ej. TURNO 3).
function tieneHorasNocturnas(t: TipoTurno, horaCorte: string): boolean {
  const ini = minutosDe(t.hora_inicio)
  let fin = minutosDe(t.hora_fin)
  if (fin <= ini) fin += 24 * 60
  const corte = minutosDe(horaCorte)
  const ventanas: [number, number][] = [[corte, 24 * 60], [24 * 60, 24 * 60 + 6 * 60]]
  return ventanas.some(([a, b]) => Math.min(fin, b) - Math.max(ini, a) > 0)
}

export function TiposTurnoTab({ canWrite, tipos }: { canWrite: boolean; tipos: ReturnType<typeof useTiposTurno> }) {
  const toast = useToast()
  const jornada = useJornadaNocturna()
  const corteVigente = jornada.data[0]?.hora_inicio_nocturno
  const emptyForm = () => ({ nombre: '', hora_inicio: '06:00', hora_fin: '14:00', recargo_porcentaje: '0' })
  const [modal, setModal] = useState<null | 'nuevo' | TipoTurno>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const openNuevo = () => { setForm(emptyForm()); setModal('nuevo') }
  const openEdit = (t: TipoTurno) => {
    setForm({ nombre: t.nombre, hora_inicio: t.hora_inicio.slice(0, 5), hora_fin: t.hora_fin.slice(0, 5), recargo_porcentaje: String(num(t.recargo_porcentaje)) })
    setModal(t)
  }
  const save = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    const recargo = Number(form.recargo_porcentaje)
    if (!(recargo >= 0 && recargo <= 200)) { toast.error('El recargo debe estar entre 0 y 200'); return }
    setSaving(true)
    const body: TipoTurnoPayload = { nombre: form.nombre.trim(), hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, recargo_porcentaje: recargo }
    try {
      if (modal === 'nuevo') { await nominaApi.createTipoTurno(body); toast.success('Tipo de turno creado') }
      else if (modal) { await nominaApi.updateTipoTurno(modal.id, body); toast.success('Tipo de turno actualizado') }
      setModal(null); tipos.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delTipo, setDelTipo] = useState<TipoTurno | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delTipo) return
    setDeleting(true)
    try { await nominaApi.deleteTipoTurno(delTipo.id); toast.success('Tipo de turno eliminado'); setDelTipo(null); tipos.reload() }
    catch (e) { toast.error(apiError(e).message); setDelTipo(null) } finally { setDeleting(false) }
  }

  return (
    <>
      <Card title={`Tipos de turno (${tipos.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo}>Agregar tipo de turno</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Nombre</th><th>Hora inicio</th><th>Hora fin</th><th style={{ textAlign: 'right' }}>Recargo</th>
              <th style={{ textAlign: 'right' }}>Festivo/dominical</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              <TableState loading={tipos.loading} error={tipos.error} empty={tipos.data.length === 0} cols={canWrite ? 6 : 5} onRetry={tipos.reload} />
              {!tipos.loading && !tipos.error && tipos.data.map(t => {
                const recargoPropio = num(t.recargo_porcentaje)
                const recargo = recargoPropio > 0 ? recargoPropio
                  : (corteVigente && tieneHorasNocturnas(t, corteVigente)) ? RECARGO_NOCTURNO_PCT : 0
                return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.nombre}</td>
                  <td className="mono">{t.hora_inicio.slice(0, 5)}</td>
                  <td className="mono">{t.hora_fin.slice(0, 5)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{recargo > 0 ? `+${recargo}%` : '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">+{RECARGO_FESTIVO_PCT}%</td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}>
                    <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(t)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelTipo(t)} />
                  </div></td>}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo tipo de turno' : 'Editar tipo de turno'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} style={{ gridColumn: '1/-1' }} />
          <Input label="Hora inicio" type="time" required value={form.hora_inicio} onChange={e => setForm(s => ({ ...s, hora_inicio: e.target.value }))} />
          <Input label="Hora fin" type="time" required value={form.hora_fin} onChange={e => setForm(s => ({ ...s, hora_fin: e.target.value }))} />
          <Input label="Recargo propio (%)" type="number" min={0} max={200} value={form.recargo_porcentaje} onChange={e => setForm(s => ({ ...s, recargo_porcentaje: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delTipo} title="Eliminar tipo de turno" itemLabel={delTipo?.nombre}
        loading={deleting} onCancel={() => setDelTipo(null)} onConfirm={confirmDelete} />
    </>
  )
}

function useJornadaNocturna() {
  const [data, setData] = useState<JornadaNocturnaLegal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getJornadaNocturnaLegal().then(r => setData(Array.isArray(r) ? r : [])).catch(e => setError(apiError(e).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

export function JornadaNocturnaPanel({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const jornada = useJornadaNocturna()
  const [modal, setModal] = useState(false)
  const emptyForm = () => ({ hora_inicio_nocturno: '19:00', vigente_desde: todayISO() })
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const abrir = () => { setForm(emptyForm()); setModal(true) }
  const save = async () => {
    setSaving(true)
    try {
      await nominaApi.createJornadaNocturnaLegal({ hora_inicio_nocturno: form.hora_inicio_nocturno, vigente_desde: form.vigente_desde })
      toast.success('Nuevo corte de jornada nocturna registrado')
      setModal(false); jornada.reload()
    } catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Ya existe un corte registrado desde esa fecha exacta.' : message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <Card title="Jornada nocturna legal" actions={canWrite && <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={abrir}>Registrar nuevo corte</Button>}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 0 }}>
          A partir de la hora vigente, las horas trabajadas después de ese momento llevan el recargo nocturno de ley
          (+35%) — la jornada nocturna siempre termina a las 6:00 a.m. Se mueve cuando cambia la ley (Ley 2101 de
          2021; ha pasado 3 veces desde entonces): no se edita un corte ya registrado, se agrega uno nuevo.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Vigente desde</th><th>Hora de inicio nocturno</th><th></th></tr></thead>
            <tbody>
              <TableState loading={jornada.loading} error={jornada.error} empty={jornada.data.length === 0} cols={3} onRetry={jornada.reload} />
              {!jornada.loading && !jornada.error && jornada.data.map((j, i) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 600 }}>{fmtDMY(j.vigente_desde)}</td>
                  <td className="mono">{j.hora_inicio_nocturno.slice(0, 5)}</td>
                  <td>{i === 0 && <span className="badge badge--success">Vigente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} title="Registrar nuevo corte de jornada nocturna" onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button></>}>
        <div className="callout" style={{ marginBottom: '1rem' }}>
          Úsalo solo el día que la ley mueva la jornada nocturna — no para corregir un corte existente.
        </div>
        <div className="grid grid--form">
          <Input label="Hora de inicio nocturno" type="time" required value={form.hora_inicio_nocturno} onChange={e => setForm(s => ({ ...s, hora_inicio_nocturno: e.target.value }))} />
          <Input label="Vigente desde" type="date" required value={form.vigente_desde} onChange={e => setForm(s => ({ ...s, vigente_desde: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}

export function CatalogoTurnosTab({ canWrite }: { canWrite: boolean }) {
  const tipos = useTiposTurno()
  return (
    <>
      <TiposTurnoTab canWrite={canWrite} tipos={tipos} />
      <JornadaNocturnaPanel canWrite={canWrite} />
    </>
  )
}

interface CeldaEdit { idEmpleado: number; dia: number; actual: Turno | undefined }

export function CalendarioTab({ canWrite, empleados, plantas, onVerPerfil }: {
  canWrite: boolean; empleados: ReturnType<typeof useEmpleados>; plantas: ReturnType<typeof usePlantas>; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const tipos = useTiposTurno()
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const [quincena, setQuincena] = useState<1 | 2>(1)

  const [anio, mesNum] = mes.split('-').map(Number)
  const lastDay = new Date(anio, mesNum, 0).getDate()
  const dias = useMemo(() => {
    const start = quincena === 1 ? 1 : 16
    const end = quincena === 1 ? 15 : lastDay
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [quincena, lastDay])

  const [data, setData] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getTurnos({ quincena, mes: mesNum, anio })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [quincena, mesNum, anio])
  useEffect(() => { load() }, [load])

  const fechaDe = (dia: number) => `${mes}-${String(dia).padStart(2, '0')}`
  const turnoDe = (idEmpleado: number, dia: number) =>
    data.find(t => t.id_empleado === idEmpleado && (t.fecha ?? '').slice(0, 10) === fechaDe(dia))

  const tipoClase = (id: number | null | undefined) => {
    const idx = tipos.data.findIndex(t => t.id === id)
    return idx >= 0 ? CELL_CLASSES[idx % CELL_CLASSES.length] : ''
  }
  const cellInfo = (t: Turno | undefined): { cls: string; label: string } => {
    if (!t) return { cls: '', label: '' }
    if (!num(t.presente)) return { cls: 'cal-cell--ausente', label: 'A' }
    const nombre = tipos.data.find(ti => ti.id === t.id_tipo_turno)?.nombre ?? '?'
    return { cls: tipoClase(t.id_tipo_turno), label: nombre.slice(0, 3).toUpperCase() }
  }

  // ── Edición de celda ──────────────────────────────────────────────────────
  const [celda, setCelda] = useState<CeldaEdit | null>(null)
  const [modo, setModo] = useState<'turno' | 'ausente' | 'limpiar'>('turno')
  const [editTipo, setEditTipo] = useState<number | ''>('')
  const [editHoras, setEditHoras] = useState('8')
  const [editPlanta, setEditPlanta] = useState<number | ''>('')
  const [editFestivo, setEditFestivo] = useState(false)
  const [editComentario, setEditComentario] = useState('')
  const [saving, setSaving] = useState(false)

  const abrir = (idEmpleado: number, dia: number) => {
    if (!canWrite) return
    const t = turnoDe(idEmpleado, dia)
    setCelda({ idEmpleado, dia, actual: t })
    if (t) {
      setModo(num(t.presente) ? 'turno' : 'ausente')
      setEditTipo(t.id_tipo_turno ?? (tipos.data[0]?.id ?? ''))
      setEditHoras(String(num(t.horas_trabajadas) || 8))
      setEditPlanta(t.id_planta_proceso ?? '')
      setEditFestivo(!!num(t.es_festivo))
      setEditComentario(t.comentarios ?? '')
    } else {
      setModo('turno')
      setEditTipo(tipos.data[0]?.id ?? '')
      setEditHoras('8')
      setEditPlanta('')
      setEditFestivo(false)
      setEditComentario('')
    }
  }

  const guardar = async () => {
    if (!celda) return
    const fecha = fechaDe(celda.dia)
    setSaving(true)
    try {
      if (modo === 'limpiar') {
        await nominaApi.deleteTurnoDia(celda.idEmpleado, fecha)
        toast.success('Turno eliminado')
      } else if (modo === 'ausente') {
        await nominaApi.upsertTurno({
          id_empleado: celda.idEmpleado, fecha, presente: false,
          id_planta_proceso: editPlanta === '' ? undefined : editPlanta,
          es_festivo: editFestivo,
          comentarios: editComentario.trim() || undefined,
        })
        toast.success('Ausencia registrada')
      } else {
        if (editTipo === '') { toast.error('Selecciona el tipo de turno'); setSaving(false); return }
        await nominaApi.upsertTurno({
          id_empleado: celda.idEmpleado, fecha, id_tipo_turno: editTipo,
          horas_trabajadas: Math.max(1, Math.min(24, Number(editHoras) || 8)),
          presente: true,
          id_planta_proceso: editPlanta === '' ? undefined : editPlanta,
          es_festivo: editFestivo,
          comentarios: editComentario.trim() || undefined,
        })
        toast.success('Turno guardado')
      }
      setCelda(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  // ── Resumen de la quincena ────────────────────────────────────────────────
  const resumen = useMemo(() => empleados.data.map(emp => {
    const turnosEmp = dias.flatMap(d => { const t = turnoDe(emp.id, d); return t ? [t] : [] })
    const presentes = turnosEmp.filter(t => num(t.presente))
    const horasTotales = presentes.reduce((s, t) => s + num(t.horas_trabajadas), 0)
    const porTipo = tipos.data.map(tt => presentes.filter(t => t.id_tipo_turno === tt.id).length)
    const ausencias = turnosEmp.length - presentes.length
    return { emp, horasTotales, porTipo, ausencias }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, empleados.data, dias, tipos.data])

  const empleadoSel = celda ? empleados.data.find(e => e.id === celda.idEmpleado) : undefined

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <Input label="Mes y año" type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ maxWidth: '11rem' }} />
        <div>
          <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Quincena</span>
          <div className="segment">
            <button className={`segment__btn ${quincena === 1 ? 'segment__btn--active' : ''}`} onClick={() => setQuincena(1)}>1ª (1–15)</button>
            <button className={`segment__btn ${quincena === 2 ? 'segment__btn--active' : ''}`} onClick={() => setQuincena(2)}>2ª (16–{lastDay})</button>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={load} style={{ marginLeft: 'auto' }}>Actualizar</Button>
      </div>

      {tipos.error && <div className="callout" style={{ marginBottom: '1rem', color: 'var(--rose-700)' }}>⚠ No se pudo cargar el catálogo de tipos de turno: {tipos.error}</div>}

      <div className="cal-legend">
        {tipos.data.map((t, i) => (
          <span key={t.id} className="cal-legend__item">
            <span className={`cal-legend__swatch ${CELL_CLASSES[i % CELL_CLASSES.length]}`} />
            {t.nombre} — {t.hora_inicio}–{t.hora_fin} (+{num(t.recargo_porcentaje)}%)
          </span>
        ))}
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--ausente" />A — Ausente</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch" style={{ border: '1px solid var(--border-default)' }} />Sin turno</span>
        <span className="cal-legend__item">* — Festivo (+75%)</span>
      </div>

      {error ? (
        <div className="callout" style={{ color: 'var(--rose-700)' }}>⚠ {error} · <button className="btn btn--ghost btn--sm" onClick={load}>Reintentar</button></div>
      ) : loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando…</p>
      ) : (
        <div className="cal-wrap">
          <table className="cal-table">
            <thead>
              <tr>
                <th className="cal-emp"><span className="row" style={{ gap: '0.5rem' }}><CalendarClock size={16} /> Empleado</span></th>
                {dias.map(d => {
                  const dow = new Date(`${fechaDe(d)}T00:00:00`).getDay()
                  return <th key={d} className={dow === 0 ? 'cal-dom' : ''}>{d}<br /><span style={{ fontWeight: 400 }}>{DIAS_SEMANA[dow]}</span></th>
                })}
              </tr>
            </thead>
            <tbody>
              {empleados.data.map(emp => (
                <tr key={emp.id}>
                  <td className="cal-emp">
                    {onVerPerfil ? (
                      <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(emp.id)}>
                        {nombreCompleto(emp)}
                      </button>
                    ) : nombreCompleto(emp)}
                  </td>
                  {dias.map(d => {
                    const t = turnoDe(emp.id, d)
                    const info = cellInfo(t)
                    const horasTip = t && num(t.presente) && num(t.horas_trabajadas) !== 8 ? ` (${num(t.horas_trabajadas)}h)` : ''
                    const festivo = !!t && !!num(t.es_festivo)
                    const festivoTip = festivo ? ' · Festivo (+75%)' : ''
                    return (
                      <td key={d}>
                        <button className={`cal-cell ${info.cls}`} onClick={() => abrir(emp.id, d)} disabled={!canWrite}
                          title={info.label ? `${info.label}${horasTip}${festivoTip}` : 'Sin turno'}
                          aria-label={`${nombreCompleto(emp)}, día ${d}: ${info.label || 'sin turno'}${horasTip}${festivoTip}`}>
                          {info.label}{festivo && '*'}
                          {horasTip && <span style={{ fontSize: '0.55rem', display: 'block', lineHeight: 1 }}>{num(t!.horas_trabajadas)}h</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <Card title={`Resumen — ${quincena === 1 ? '1ª (1–15)' : `2ª (16–${lastDay})`}`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  {tipos.data.map(t => <th key={t.id} style={{ textAlign: 'center' }}>{t.nombre}</th>)}
                  <th style={{ textAlign: 'center' }}>Ausencias</th>
                  <th style={{ textAlign: 'right' }}>Horas</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map(({ emp, horasTotales, porTipo, ausencias }) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{nombreCompleto(emp)}</td>
                    {porTipo.map((c, i) => <td key={i} style={{ textAlign: 'center' }}>{c}</td>)}
                    <td style={{ textAlign: 'center', color: ausencias > 0 ? 'var(--rose-600)' : 'var(--text-faint)' }}>{ausencias}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{horasTotales}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  {tipos.data.map((_, i) => <td key={i} style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + (r.porTipo[i] ?? 0), 0)}</td>)}
                  <td style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.ausencias, 0)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{resumen.reduce((s, r) => s + r.horasTotales, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={!!celda} title={celda ? `Turno — día ${celda.dia} de ${mes}` : ''} onClose={() => setCelda(null)}
        footer={<><Button variant="secondary" onClick={() => setCelda(null)}>Cancelar</Button><Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></>}>
        {celda && (
          <div className="grid grid--form">
            <div style={{ gridColumn: '1/-1' }}>
              <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>{empleadoSel ? nombreCompleto(empleadoSel) : ''}</span>
              <div className="segment">
                <button className={`segment__btn ${modo === 'turno' ? 'segment__btn--active' : ''}`} onClick={() => setModo('turno')}>Turno</button>
                <button className={`segment__btn ${modo === 'ausente' ? 'segment__btn--active' : ''}`} onClick={() => setModo('ausente')}>Ausente</button>
                {celda.actual && <button className={`segment__btn ${modo === 'limpiar' ? 'segment__btn--active' : ''}`} onClick={() => setModo('limpiar')}>Quitar</button>}
              </div>
            </div>
            {modo === 'turno' && (
              <>
                <Select label="Tipo de turno" value={editTipo === '' ? '' : String(editTipo)}
                  onChange={e => setEditTipo(e.target.value === '' ? '' : Number(e.target.value))}
                  options={tipos.data.map(t => ({ value: String(t.id), label: `${t.nombre} (${t.hora_inicio}–${t.hora_fin})` }))} />
                <Input label="Horas trabajadas" type="number" min={1} max={24} value={editHoras} onChange={e => setEditHoras(e.target.value)} />
              </>
            )}
            {modo !== 'limpiar' && (
              <Select label="Planta / proceso (opcional)" placeholder="— Sin planta —" value={editPlanta === '' ? '' : String(editPlanta)}
                onChange={e => setEditPlanta(e.target.value === '' ? '' : Number(e.target.value))}
                options={plantas.data.map(p => ({ value: String(p.id), label: p.nombre }))} />
            )}
            {modo !== 'limpiar' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                <input type="checkbox" id="celda-festivo" checked={editFestivo} onChange={e => setEditFestivo(e.target.checked)} />
                <label htmlFor="celda-festivo" style={{ cursor: 'pointer', userSelect: 'none' }} title="Lleva el recargo dominical/festivo (+75%) sin importar el turno. El domingo se detecta solo, no hace falta marcarlo.">
                  Es festivo
                </label>
              </div>
            )}
            {modo !== 'limpiar' && (
              <Input label="Comentarios (opcional)" value={editComentario} onChange={e => setEditComentario(e.target.value)} style={{ gridColumn: '1/-1' }} />
            )}
            {modo === 'limpiar' && (
              <div className="callout" style={{ gridColumn: '1/-1' }}>Se eliminará el turno de este día para este empleado.</div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TURNOS — registro a mano, igual que la pestaña "Turnos" de /nomina: filtro
// por mes/quincena + botón "Registrar turno" con formulario, sin grilla.
// ════════════════════════════════════════════════════════════════════════════
export function TurnosTab({ canWrite, empleados, plantas, onVerPerfil }: {
  canWrite: boolean; empleados: ReturnType<typeof useEmpleados>; plantas: ReturnType<typeof usePlantas>; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const tipos = useTiposTurno()
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const [periodo, setPeriodo] = useState<'q1' | 'q2' | 'mes'>('mes')
  const [idEmpleado, setIdEmpleado] = useState<number | ''>('')

  const [anio, mesNum] = mes.split('-').map(Number)
  const quincena = periodo === 'q1' ? 1 : periodo === 'q2' ? 2 : undefined

  const [data, setData] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getTurnos({ anio, mes: mesNum, quincena, id_empleado: idEmpleado === '' ? undefined : idEmpleado })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [anio, mesNum, quincena, idEmpleado])
  useEffect(() => { load() }, [load])

  const nombreEmpleado = (id: number) => { const e = empleados.data.find(x => x.id === id); return e ? nombreCompleto(e) : `#${id}` }
  const nombrePlanta = (id: number | null | undefined) => id ? (plantas.data.find(p => p.id === id)?.nombre ?? `#${id}`) : '—'
  const nombreTipo = (id: number | null | undefined) => tipos.data.find(t => t.id === id)?.nombre ?? '—'
  const totalHoras = data.reduce((s, t) => s + num(t.horas_trabajadas), 0)
  const presentes = data.filter(t => num(t.presente)).length

  // ── Costo por turno — no viene en GET /turnos, se saca del desglose
  // (detalle_turnos) de la previsualización de liquidación de Q1+Q2 del mes,
  // y se cruza por empleado+fecha. Si el empleado no tiene salario configurado
  // (no aparece en el preview), el costo queda sin dato — se muestra "—".
  const [costos, setCostos] = useState<Record<string, number>>({})
  const [costosLoading, setCostosLoading] = useState(false)
  const loadCostos = useCallback(() => {
    setCostosLoading(true)
    Promise.all([
      nominaApi.previewLiquidacionGrupal({ anio, mes: mesNum, quincena: 1 }),
      nominaApi.previewLiquidacionGrupal({ anio, mes: mesNum, quincena: 2 }),
    ]).then(([r1, r2]) => {
      const mapa: Record<string, number> = {}
      for (const r of [r1, r2]) {
        for (const p of r.previews ?? []) {
          for (const d of p.detalle_turnos ?? []) {
            mapa[`${p.id_empleado}_${(d.fecha ?? '').slice(0, 10)}`] = num(d.monto)
          }
        }
      }
      setCostos(mapa)
    }).catch(() => setCostos({})).finally(() => setCostosLoading(false))
  }, [anio, mesNum])
  useEffect(() => { loadCostos() }, [loadCostos])
  const costoDe = (t: Turno) => costos[`${t.id_empleado}_${(t.fecha ?? '').slice(0, 10)}`]
  const costoTotal = data.reduce((s, t) => s + (costoDe(t) ?? 0), 0)

  const emptyForm = () => ({
    id_empleado: '' as number | '', fecha: todayISO(), id_tipo_turno: (tipos.data[0]?.id ?? '') as number | '',
    horas: '8', presente: true, id_planta: '' as number | '', esFestivo: false, comentarios: '',
  })
  const [modal, setModal] = useState<null | 'nuevo' | Turno>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const openNuevo = () => { setForm({ ...emptyForm(), id_empleado: idEmpleado }); setModal('nuevo') }
  const openEdit = (t: Turno) => {
    setForm({
      id_empleado: t.id_empleado, fecha: (t.fecha ?? '').slice(0, 10) || todayISO(),
      id_tipo_turno: t.id_tipo_turno ?? (tipos.data[0]?.id ?? ''),
      horas: String(num(t.horas_trabajadas) || 8), presente: !!num(t.presente),
      id_planta: t.id_planta_proceso ?? '', esFestivo: !!num(t.es_festivo), comentarios: t.comentarios ?? '',
    })
    setModal(t)
  }
  const save = async () => {
    if (form.id_empleado === '') { toast.error('Selecciona el empleado'); return }
    if (form.presente && form.id_tipo_turno === '') { toast.error('Selecciona el tipo de turno'); return }
    setSaving(true)
    try {
      await nominaApi.upsertTurno({
        id_empleado: form.id_empleado, fecha: form.fecha,
        id_tipo_turno: form.presente && form.id_tipo_turno !== '' ? form.id_tipo_turno : undefined,
        horas_trabajadas: form.presente ? (Math.max(1, Math.min(24, Number(form.horas) || 8))) : undefined,
        presente: form.presente,
        id_planta_proceso: form.id_planta === '' ? undefined : form.id_planta,
        es_festivo: form.esFestivo,
        comentarios: form.comentarios.trim() || undefined,
      })
      toast.success(modal === 'nuevo' ? 'Turno registrado' : 'Turno actualizado')
      setModal(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delTurno, setDelTurno] = useState<Turno | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delTurno) return
    setDeleting(true)
    try { await nominaApi.deleteTurno(delTurno.id); toast.success('Turno eliminado'); setDelTurno(null); load() }
    catch (e) { toast.error(apiError(e).message); setDelTurno(null) } finally { setDeleting(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <Input label="Mes" type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ maxWidth: '11rem' }} />
        <div>
          <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Periodo</span>
          <div className="segment">
            <button className={`segment__btn ${periodo === 'q1' ? 'segment__btn--active' : ''}`} onClick={() => setPeriodo('q1')}>1ª quincena</button>
            <button className={`segment__btn ${periodo === 'q2' ? 'segment__btn--active' : ''}`} onClick={() => setPeriodo('q2')}>2ª quincena</button>
            <button className={`segment__btn ${periodo === 'mes' ? 'segment__btn--active' : ''}`} onClick={() => setPeriodo('mes')}>Mes completo</button>
          </div>
        </div>
        <div style={{ minWidth: '14rem' }}>
          <EmpleadoSelect empleados={empleados.data} value={idEmpleado} onChange={setIdEmpleado} placeholder="— Todos los empleados —" />
        </div>
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Registrar turno</Button>}
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Turnos" value={data.length} icon={<CalendarClock size={16} />} accent="green" />
        <KpiTile label="Horas registradas" value={totalHoras} accent="brown" />
        <KpiTile label="Asistencias" value={presentes} accent="emerald" />
        <KpiTile label="Costo del periodo" value={cop(costoTotal)} icon={<Wallet size={16} />} accent="rose" />
      </div>

      <Card title={`Turnos — ${mes} (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Planta</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Horas</th><th style={{ textAlign: 'right' }}>Costo</th><th>Presente</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 8 : 7} onRetry={load} />
              {!loading && !error && data.map(t => (
                <tr key={t.id}>
                  <td>
                    {fmtDMY(t.fecha)}
                    {!!num(t.es_festivo) && <span className="badge badge--warning" style={{ fontSize: '0.6rem', marginLeft: '0.4rem' }}>Festivo</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {onVerPerfil ? (
                      <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(t.id_empleado)}>
                        {t.empleado ?? nombreEmpleado(t.id_empleado)}
                      </button>
                    ) : (t.empleado ?? nombreEmpleado(t.id_empleado))}
                  </td>
                  <td>{t.planta ?? nombrePlanta(t.id_planta_proceso)}</td>
                  <td>{num(t.presente) ? <span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{nombreTipo(t.id_tipo_turno)}</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{num(t.horas_trabajadas)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                    {costosLoading ? <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>…</span>
                      : costoDe(t) !== undefined ? cop(costoDe(t)!)
                      : <span style={{ color: 'var(--text-faint)', fontWeight: 400 }} title="Sin salario configurado o sin liquidación posible para este empleado/fecha">—</span>}
                  </td>
                  <td><span className={`badge badge--${num(t.presente) ? 'success' : 'neutral'}`}>{num(t.presente) ? 'Sí' : 'No'}</span></td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}>
                    <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(t)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelTurno(t)} />
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Registrar turno' : 'Editar turno'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></>}>
        <div className="grid grid--form">
          <EmpleadoSelect empleados={empleados.data} value={form.id_empleado} onChange={v => setForm(s => ({ ...s, id_empleado: v }))} required />
          <Input label="Fecha" type="date" required value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="turno-presente" checked={form.presente} onChange={e => setForm(s => ({ ...s, presente: e.target.checked }))} />
            <label htmlFor="turno-presente" style={{ cursor: 'pointer', userSelect: 'none' }}>Asistió</label>
          </div>
          {form.presente && (
            <>
              <Select label="Tipo de turno" value={form.id_tipo_turno === '' ? '' : String(form.id_tipo_turno)}
                onChange={e => setForm(s => ({ ...s, id_tipo_turno: e.target.value === '' ? '' : Number(e.target.value) }))}
                options={tipos.data.map(t => ({ value: String(t.id), label: `${t.nombre} (${t.hora_inicio}–${t.hora_fin})` }))} />
              <Input label="Horas" type="number" min={1} max={24} value={form.horas} onChange={e => setForm(s => ({ ...s, horas: e.target.value }))} />
            </>
          )}
          <Select label="Planta (opcional)" placeholder="— Sin planta —" value={form.id_planta === '' ? '' : String(form.id_planta)}
            onChange={e => setForm(s => ({ ...s, id_planta: e.target.value === '' ? '' : Number(e.target.value) }))}
            options={plantas.data.map(p => ({ value: String(p.id), label: p.nombre }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="turno-festivo" checked={form.esFestivo} onChange={e => setForm(s => ({ ...s, esFestivo: e.target.checked }))} />
            <label htmlFor="turno-festivo" style={{ cursor: 'pointer', userSelect: 'none' }} title="Lleva el recargo dominical/festivo (+75%) sin importar el turno. El domingo se detecta solo.">
              Es festivo
            </label>
          </div>
          <Input label="Comentarios (opcional)" value={form.comentarios} onChange={e => setForm(s => ({ ...s, comentarios: e.target.value }))} style={{ gridColumn: '1/-1' }} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delTurno} title="Eliminar turno" itemLabel={delTurno ? `el turno del ${fmtDMY(delTurno.fecha)}` : undefined}
        loading={deleting} onCancel={() => setDelTurno(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// QUINCENAS (liquidaciones)
// ════════════════════════════════════════════════════════════════════════════
// Desglose turno por turno de una previsualización — ya viene todo sumado
// (propio + nocturno + festivo), acá solo se muestra el número.
function DetalleTurnosTable({ detalle }: { detalle: DetalleTurnoLiquidacion[] }) {
  if (detalle.length === 0) return <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)', margin: 0 }}>Sin turnos en el periodo.</p>
  return (
    <table className="data-table" style={{ margin: 0 }}>
      <thead><tr>
        <th>Fecha</th><th>Turno</th><th style={{ textAlign: 'right' }}>H. día</th><th style={{ textAlign: 'right' }}>H. noche</th>
        <th style={{ textAlign: 'right' }}>% día</th><th style={{ textAlign: 'right' }}>% noche</th><th></th><th style={{ textAlign: 'right' }}>Monto</th>
      </tr></thead>
      <tbody>
        {detalle.map((d, i) => (
          <tr key={i}>
            <td style={{ fontSize: 'var(--fs-sm)' }}>{fmtDMY(d.fecha)}</td>
            <td style={{ fontSize: 'var(--fs-sm)' }}>{d.nombre_turno}</td>
            <td style={{ textAlign: 'right' }} className="mono">{num(d.horas_diurnas) || '—'}</td>
            <td style={{ textAlign: 'right' }} className="mono">{num(d.horas_nocturnas) || '—'}</td>
            <td style={{ textAlign: 'right' }} className="mono">{num(d.recargo_pct_diurno) > 0 ? `+${num(d.recargo_pct_diurno)}%` : '—'}</td>
            <td style={{ textAlign: 'right' }} className="mono">{num(d.recargo_pct_nocturno) > 0 ? `+${num(d.recargo_pct_nocturno)}%` : '—'}</td>
            <td>
              {d.es_domingo && <span className="badge badge--info" style={{ fontSize: '0.6rem' }}>Domingo</span>}
              {d.es_festivo && <span className="badge badge--warning" style={{ fontSize: '0.6rem', marginLeft: 4 }}>Festivo</span>}
            </td>
            <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(d.monto))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function QuincenasTab({ canWrite, empleados, onVerPerfil }: {
  canWrite: boolean; empleados: ReturnType<typeof useEmpleados>; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const hoy = new Date()
  const [vista, setVista] = useState<'quincena' | 'mensual'>('quincena')
  const [anio, setAnio] = useState(String(hoy.getFullYear()))
  const [mes, setMes] = useState(String(hoy.getMonth() + 1))
  const [quincena, setQuincena] = useState<1 | 2>(1)

  const nombreEmpleado = (id: number) => { const e = empleados.data.find(x => x.id === id); return e ? nombreCompleto(e) : `#${id}` }
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null)

  // ── Vista por quincena: previsualización + confirmar ─────────────────────
  // Usa el preview grupal (trae a todos los empleados en un solo request);
  // previewLiquidacion sin id_empleado exige el parámetro y devuelve 400.
  const [preview, setPreview] = useState<LiquidacionPreview[]>([])
  const [errores, setErrores] = useState<PreviewLiquidacionError[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadPreview = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.previewLiquidacionGrupal({ anio: Number(anio), mes: Number(mes), quincena })
      .then(r => { setPreview(r.previews ?? []); setErrores(r.errores ?? []) })
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [anio, mes, quincena])
  useEffect(() => { if (vista === 'quincena') loadPreview() }, [vista, loadPreview])

  const [histOpen, setHistOpen] = useState(false)
  const [hist, setHist] = useState<Liquidacion[]>([])
  const loadHist = useCallback(() => {
    nominaApi.getLiquidaciones({ anio: Number(anio), mes: Number(mes) }).then(r => setHist(Array.isArray(r) ? r : [])).catch(() => setHist([]))
  }, [anio, mes])
  useEffect(() => { if (histOpen) loadHist() }, [histOpen, loadHist])

  const totalNeto = preview.reduce((s, p) => s + num(p.monto_neto), 0)
  const totalAportes = preview.reduce((s, p) => s + num(p.total_aportes_seguridad_social), 0)

  // ── Vista mensual: agrega Q1 + Q2 del mes, igual que /nomina ─────────────
  const [prevQ1, setPrevQ1] = useState<LiquidacionPreview[]>([])
  const [prevQ2, setPrevQ2] = useState<LiquidacionPreview[]>([])
  const [histMes, setHistMes] = useState<Liquidacion[]>([])
  const [erroresMensual, setErroresMensual] = useState<PreviewLiquidacionError[]>([])
  const [loadingMensual, setLoadingMensual] = useState(false)
  const [errorMensual, setErrorMensual] = useState<string | null>(null)
  const loadMensual = useCallback(() => {
    setLoadingMensual(true); setErrorMensual(null)
    Promise.all([
      nominaApi.previewLiquidacionGrupal({ anio: Number(anio), mes: Number(mes), quincena: 1 }),
      nominaApi.previewLiquidacionGrupal({ anio: Number(anio), mes: Number(mes), quincena: 2 }),
      nominaApi.getLiquidaciones({ anio: Number(anio), mes: Number(mes) }),
    ]).then(([r1, r2, h]) => {
      setPrevQ1(r1.previews ?? [])
      setPrevQ2(r2.previews ?? [])
      const vistos = new Set<number>()
      const combinados = [...(r1.errores ?? []), ...(r2.errores ?? [])].filter(e => {
        if (vistos.has(e.id_empleado)) return false
        vistos.add(e.id_empleado); return true
      })
      setErroresMensual(combinados)
      setHistMes(Array.isArray(h) ? h : [])
    }).catch(e => setErrorMensual(apiError(e).message)).finally(() => setLoadingMensual(false))
  }, [anio, mes])
  useEffect(() => { if (vista === 'mensual') loadMensual() }, [vista, loadMensual])

  const mensualRows = useMemo(() => {
    const ids = new Set([...prevQ1.map(p => p.id_empleado), ...prevQ2.map(p => p.id_empleado)])
    return Array.from(ids).map(id => {
      const p1 = prevQ1.find(p => p.id_empleado === id)
      const p2 = prevQ2.find(p => p.id_empleado === id)
      const h1 = histMes.find(h => h.id_empleado === id && h.quincena === 1)
      const h2 = histMes.find(h => h.id_empleado === id && h.quincena === 2)
      const netoQ1 = h1 ? num(h1.monto_neto ?? h1.neto) : 0
      const netoQ2 = h2 ? num(h2.monto_neto ?? h2.neto) : 0
      return {
        id, nombre: p1?.empleado ?? p2?.empleado ?? nombreEmpleado(id), p1, p2, h1, h2, netoQ1, netoQ2,
        totalPagado: netoQ1 + netoQ2,
        estado: (h1 && h2) ? 'completo' as const : (h1 || h2) ? 'parcial' as const : 'pendiente' as const,
      }
    })
  }, [prevQ1, prevQ2, histMes, empleados.data])
  const totalMensual = mensualRows.reduce((s, r) => s + r.totalPagado, 0)

  // ── Confirmar liquidación (compartido por ambas vistas) ──────────────────
  const [confirmando, setConfirmando] = useState<LiquidacionPreview | null>(null)
  const [confQuincena, setConfQuincena] = useState<1 | 2>(1)
  const [confForm, setConfForm] = useState({ bonificaciones: '', otros_descuentos: '' })
  const [confirmSaving, setConfirmSaving] = useState(false)
  const abrirConfirmar = (p: LiquidacionPreview, q: 1 | 2 = quincena) => { setConfirmando(p); setConfQuincena(q); setConfForm({ bonificaciones: '', otros_descuentos: '' }) }
  const yaLiquidado = (idEmpleado: number) =>
    hist.some(h => h.id_empleado === idEmpleado && h.quincena === confQuincena) ||
    histMes.some(h => h.id_empleado === idEmpleado && h.quincena === confQuincena)
  const confirmar = async () => {
    if (!confirmando) return
    setConfirmSaving(true)
    try {
      await nominaApi.confirmarLiquidacion({
        id_empleado: confirmando.id_empleado, anio: Number(anio), mes: Number(mes), quincena: confQuincena,
        bonificaciones: Number(confForm.bonificaciones) || undefined,
        otros_descuentos: Number(confForm.otros_descuentos) || undefined,
      })
      toast.success('Liquidación confirmada')
      setConfirmando(null); loadPreview(); loadMensual(); if (histOpen) loadHist()
    } catch (e) { toast.error(apiError(e).message) } finally { setConfirmSaving(false) }
  }

  return (
    <>
      <div className="callout" style={{ marginBottom: '1rem' }}>
        El <strong>devengado</strong> de cada turno por hora/día ya incluye el recargo propio del tipo de turno, el
        <strong> nocturno de ley (+35%)</strong> calculado por hora según el corte vigente, y el
        <strong> dominical/festivo (+75%)</strong> si cae domingo o se marcó "Es festivo" en Turnos. El
        <strong> neto</strong> es ese devengado + bonos − <strong>salud y pensión (8% de ley, 4%+4%)</strong> − cuota
        de préstamo activo − otros descuentos. <strong>Antes de confirmar una quincena real, asegúrate de que las
        migraciones de seguridad social y jornada nocturna ya se corrieron contra la base de datos</strong> — el
        preview ya calcula bien, pero confirmar puede fallar hasta que se apliquen.
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div>
          <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Vista</span>
          <div className="segment">
            <button className={`segment__btn ${vista === 'quincena' ? 'segment__btn--active' : ''}`} onClick={() => setVista('quincena')}>Por quincena</button>
            <button className={`segment__btn ${vista === 'mensual' ? 'segment__btn--active' : ''}`} onClick={() => setVista('mensual')}>Vista mensual</button>
          </div>
        </div>
        <Input label="Año" type="number" value={anio} onChange={e => setAnio(e.target.value)} style={{ maxWidth: '7rem' }} />
        <Select label="Mes" value={mes} onChange={e => setMes(e.target.value)}
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))} style={{ maxWidth: '7rem' }} />
        {vista === 'quincena' && (
          <div>
            <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Quincena</span>
            <div className="segment">
              <button className={`segment__btn ${quincena === 1 ? 'segment__btn--active' : ''}`} onClick={() => setQuincena(1)}>Q1 — 1 al 15</button>
              <button className={`segment__btn ${quincena === 2 ? 'segment__btn--active' : ''}`} onClick={() => setQuincena(2)}>Q2 — 16 al fin</button>
            </div>
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={vista === 'quincena' ? loadPreview : loadMensual} style={{ marginLeft: 'auto' }}>
          {vista === 'quincena' ? 'Actualizar previsualización' : 'Actualizar resumen'}
        </Button>
      </div>

      {vista === 'quincena' ? (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Empleados en preview" value={preview.length} icon={<Users2 size={16} />} accent="green" />
            <KpiTile label="Salud + pensión del periodo" value={cop(totalAportes)} icon={<Landmark size={16} />} accent="rose" />
            <KpiTile label="Neto total del periodo" value={cop(totalNeto)} icon={<Wallet size={16} />} accent="brown" />
          </div>

          {errores.length > 0 && (
            <div className="callout" style={{ marginBottom: '1rem', color: 'var(--rose-700)' }}>
              ⚠ {errores.length} empleado(s) no se pudieron previsualizar:
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                {errores.map(e => <li key={e.id_empleado}>{nombreEmpleado(e.id_empleado)}: {e.message}</li>)}
              </ul>
            </div>
          )}

          <Card title={`Previsualización — ${anio}-${String(mes).padStart(2, '0')} Q${quincena}`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th></th><th>Empleado</th><th style={{ textAlign: 'right' }}>Devengado</th><th style={{ textAlign: 'right' }}>Bonificaciones</th>
                  <th style={{ textAlign: 'right' }}>Salud y pensión</th>
                  <th style={{ textAlign: 'right' }}>Desc. préstamo</th><th style={{ textAlign: 'right' }}>Neto</th>{canWrite && <th></th>}
                </tr></thead>
                <tbody>
                  <TableState loading={loading} error={error} empty={preview.length === 0} cols={canWrite ? 8 : 7} onRetry={loadPreview} />
                  {!loading && !error && preview.map(p => { const tieneDetalle = (p.detalle_turnos?.length ?? 0) > 0; const abierto = detalleAbierto === p.id_empleado; return (
                  <Fragment key={p.id_empleado}>
                    <tr>
                      <td>
                        {tieneDetalle && (
                          <Button variant="ghost" size="sm" icon={abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            onClick={() => setDetalleAbierto(abierto ? null : p.id_empleado)} title="Ver desglose por turno" />
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {onVerPerfil ? (
                          <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(p.id_empleado)}>
                            {p.empleado ?? nombreEmpleado(p.id_empleado)}
                          </button>
                        ) : (p.empleado ?? nombreEmpleado(p.id_empleado))}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {cop(num(p.monto_bruto))}
                        {(p.tipo_pago === 'POR_HORAS' || p.tipo_pago === 'POR_DIAS') && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
                            {num(p.unidades)} {p.tipo_pago === 'POR_HORAS' ? 'h' : 'día(s)'} × {cop(num(p.tarifa_aplicada))}
                          </div>
                        )}
                        {num(p.total_recargo_dominical_festivo) > 0 && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--amber-700)', fontWeight: 400 }}>
                            incl. {cop(num(p.total_recargo_dominical_festivo))} dominical/festivo
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(p.total_bonos_periodo) > 0 ? `+ ${cop(num(p.total_bonos_periodo))}` : '—'}</td>
                      <td style={{ textAlign: 'right', color: num(p.total_aportes_seguridad_social) > 0 ? 'var(--rose-600)' : undefined }} className="mono">
                        {num(p.total_aportes_seguridad_social) > 0 ? (
                          <>
                            - {cop(num(p.total_aportes_seguridad_social))}
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {cop(num(p.aporte_salud))} salud + {cop(num(p.aporte_pension))} pensión
                            </div>
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: num(p.total_descuento_prestamo) > 0 ? 'var(--rose-600)' : undefined }} className="mono">
                        {num(p.total_descuento_prestamo) > 0 ? `- ${cop(num(p.total_descuento_prestamo))}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">{cop(num(p.monto_neto))}</td>
                      {canWrite && <td style={{ textAlign: 'right' }}>
                        <Button size="sm" onClick={() => abrirConfirmar(p, quincena)}>Confirmar</Button>
                      </td>}
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={canWrite ? 8 : 7} style={{ padding: '0.75rem 1rem 1rem', background: 'var(--surface-page)' }}>
                          <DetalleTurnosTable detalle={p.detalle_turnos ?? []} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )})}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ marginTop: '1rem' }}>
            <Card title="Historial de liquidaciones" actions={<Button size="sm" variant="secondary" onClick={() => setHistOpen(o => !o)}>{histOpen ? 'Ocultar' : 'Ver historial del mes'}</Button>}>
              {!histOpen ? (
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>Liquidaciones ya confirmadas de {anio}-{String(mes).padStart(2, '0')}.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Empleado</th><th>Quincena</th><th style={{ textAlign: 'right' }}>Neto</th><th>Fecha</th></tr></thead>
                    <tbody>
                      <TableState loading={false} error={null} empty={hist.length === 0} cols={4} />
                      {hist.map(h => (
                        <tr key={h.id}>
                          <td>{h.empleado ?? nombreEmpleado(h.id_empleado)}</td>
                          <td>Q{h.quincena}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{cop(num(h.monto_neto ?? h.neto))}</td>
                          <td>{fmtDMY(h.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
            <KpiTile label="Empleados" value={mensualRows.length} icon={<Users2 size={16} />} accent="green" />
            <KpiTile label="Total pagado del mes" value={cop(totalMensual)} icon={<Wallet size={16} />} accent="brown" />
          </div>

          {erroresMensual.length > 0 && (
            <div className="callout" style={{ marginBottom: '1rem', color: 'var(--rose-700)' }}>
              ⚠ {erroresMensual.length} aviso(s) al previsualizar:
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                {erroresMensual.map((e, i) => <li key={`${e.id_empleado}-${i}`}>{nombreEmpleado(e.id_empleado)}: {e.message}</li>)}
              </ul>
            </div>
          )}

          <Card title={`Nómina mensual — ${anio}-${String(mes).padStart(2, '0')}`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Empleado</th><th style={{ textAlign: 'right' }}>Q1 (1–15)</th><th style={{ textAlign: 'right' }}>Q2 (16–fin)</th>
                  <th style={{ textAlign: 'right' }}>Total pagado</th><th>Estado</th>{canWrite && <th></th>}
                </tr></thead>
                <tbody>
                  <TableState loading={loadingMensual} error={errorMensual} empty={mensualRows.length === 0} cols={canWrite ? 6 : 5} onRetry={loadMensual} />
                  {!loadingMensual && !errorMensual && mensualRows.map(r => (
                    <tr key={r.id} style={r.estado === 'completo' ? { opacity: 0.65 } : undefined}>
                      <td style={{ fontWeight: 600 }}>
                        {onVerPerfil ? (
                          <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(r.id)}>
                            {r.nombre}
                          </button>
                        ) : r.nombre}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {r.h1 ? <span style={{ color: 'var(--emerald-700)', fontWeight: 600 }}>{cop(r.netoQ1)} ✓</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {r.h2 ? <span style={{ color: 'var(--emerald-700)', fontWeight: 600 }}>{cop(r.netoQ2)} ✓</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">
                        {r.totalPagado > 0 ? cop(r.totalPagado) : <span style={{ color: 'var(--text-faint)' }}>$0</span>}
                      </td>
                      <td>
                        <span className={`badge ${r.estado === 'completo' ? 'badge--success' : r.estado === 'parcial' ? 'badge--warning' : 'badge--neutral'}`}>
                          {r.estado === 'completo' ? 'Completo' : r.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {!r.h1 && r.p1 && <Button size="sm" variant="secondary" onClick={() => abrirConfirmar(r.p1!, 1)}>Liquidar Q1</Button>}
                            {!r.h2 && r.p2 && <Button size="sm" variant="secondary" onClick={() => abrirConfirmar(r.p2!, 2)}>Liquidar Q2</Button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {mensualRows.length > 0 && (
                  <tfoot><tr style={{ fontWeight: 700 }}>
                    <td colSpan={3}>Total {anio}-{String(mes).padStart(2, '0')}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(totalMensual)}</td>
                    <td colSpan={canWrite ? 2 : 1} />
                  </tr></tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={!!confirmando} title={`Confirmar liquidación — ${confirmando?.empleado ?? (confirmando ? nombreEmpleado(confirmando.id_empleado) : '')}`}
        onClose={() => setConfirmando(null)}
        footer={<><Button variant="secondary" onClick={() => setConfirmando(null)}>Cancelar</Button><Button onClick={confirmar} disabled={confirmSaving}>{confirmSaving ? 'Confirmando…' : 'Confirmar liquidación'}</Button></>}>
        {confirmando && (
          <div className="stack">
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>Quincena Q{confQuincena} — {anio}-{String(mes).padStart(2, '0')}</p>
            {yaLiquidado(confirmando.id_empleado) && (
              <div className="callout" style={{ color: 'var(--rose-700)' }}>⚠ Este empleado ya tiene una liquidación confirmada para esta quincena — verifica antes de repetirla.</div>
            )}
            <div className="grid grid--form">
              <Input label="Bonificaciones extra (opcional)" type="number" value={confForm.bonificaciones} onChange={e => setConfForm(s => ({ ...s, bonificaciones: e.target.value }))} />
              <Input label="Otros descuentos (opcional)" type="number" value={confForm.otros_descuentos} onChange={e => setConfForm(s => ({ ...s, otros_descuentos: e.target.value }))} />
            </div>
            {num(confirmando.total_recargo_dominical_festivo) > 0 && (
              <div className="callout" style={{ color: 'var(--amber-700)' }}>
                Incluye {cop(num(confirmando.total_recargo_dominical_festivo))} de recargo dominical/festivo (+75%),
                ya sumado dentro del devengado — no se resta.
              </div>
            )}
            {num(confirmando.total_aportes_seguridad_social) > 0 && (
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Salud (4%)</div>
                  <div style={{ fontWeight: 700 }} className="mono">- {cop(num(confirmando.aporte_salud))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Pensión (4%)</div>
                  <div style={{ fontWeight: 700 }} className="mono">- {cop(num(confirmando.aporte_pension))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Neto previsto</div>
                  <div style={{ fontWeight: 800 }} className="mono">{cop(num(confirmando.monto_neto))}</div>
                </div>
              </div>
            )}
            <div className="callout">
              Genera la CxP de nómina, descuenta la cuota de préstamo activo del empleado (si tiene uno) y el 8% de
              salud + pensión. El neto previsto arriba no incluye las bonificaciones/descuentos que agregues en este
              formulario — el backend los recalcula al confirmar.
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BONOS
// ════════════════════════════════════════════════════════════════════════════
export function BonosTab({ canWrite, empleados, idEmpleadoInicial, fixed, onVerPerfil }: {
  canWrite: boolean; empleados: ReturnType<typeof useEmpleados>; idEmpleadoInicial?: number; fixed?: boolean; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const [idEmpleado, setIdEmpleado] = useState<number | ''>(idEmpleadoInicial ?? '')
  useEffect(() => { if (idEmpleadoInicial != null) setIdEmpleado(idEmpleadoInicial) }, [idEmpleadoInicial])
  const [data, setData] = useState<Bono[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getBonos({ id_empleado: idEmpleado === '' ? undefined : idEmpleado })
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [idEmpleado])
  useEffect(() => { load() }, [load])

  const nombreEmpleado = (id: number) => { const e = empleados.data.find(x => x.id === id); return e ? nombreCompleto(e) : `#${id}` }
  const total = data.reduce((s, b) => s + num(b.valor), 0)

  const emptyForm = () => ({ id_empleado: '' as number | '', fecha: todayISO(), concepto: '', valor: '' })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const abrir = () => { setForm({ ...emptyForm(), id_empleado: idEmpleado }); setModal(true) }
  const save = async () => {
    if (form.id_empleado === '' || !(Number(form.valor) > 0)) { toast.error('Selecciona el empleado y un valor válido'); return }
    setSaving(true)
    try {
      await nominaApi.createBono({ id_empleado: form.id_empleado, fecha: form.fecha || undefined, concepto: form.concepto.trim() || undefined, valor: Number(form.valor) })
      toast.success('Bono registrado')
      setModal(false); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }
  const [delBono, setDelBono] = useState<Bono | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delBono) return
    setDeleting(true)
    try { await nominaApi.deleteBono(delBono.id); toast.success('Bono eliminado'); setDelBono(null); load() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este bono ya tiene abonos y no se puede eliminar.' : message)
      setDelBono(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        {!fixed && (
          <div style={{ minWidth: '16rem' }}>
            <EmpleadoSelect empleados={empleados.data} value={idEmpleado} onChange={setIdEmpleado} placeholder="— Todos los empleados —" />
          </div>
        )}
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrir} style={{ marginLeft: 'auto' }}>Nuevo bono</Button>}
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Bonos" value={data.length} icon={<Gift size={16} />} accent="emerald" />
        <KpiTile label="Valor total" value={cop(total)} accent="brown" />
      </div>

      <Card title={`Bonos (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Fecha</th>{!fixed && <th>Empleado</th>}<th>Concepto</th><th style={{ textAlign: 'right' }}>Valor</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 5 : 4} onRetry={load} />
              {!loading && !error && data.map(b => (
                <tr key={b.id}>
                  <td>{fmtDMY(b.fecha)}</td>
                  {!fixed && (
                    <td style={{ fontWeight: 600 }}>
                      {onVerPerfil ? (
                        <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(b.id_empleado)}>
                          {b.empleado ?? nombreEmpleado(b.id_empleado)}
                        </button>
                      ) : (b.empleado ?? nombreEmpleado(b.id_empleado))}
                    </td>
                  )}
                  <td>{b.concepto ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">{cop(num(b.valor))}</td>
                  {canWrite && <td><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelBono(b)} /></td>}
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={fixed ? 2 : 3}>Total</td><td style={{ textAlign: 'right' }} className="mono">{cop(total)}</td><td /></tr></tfoot>
            )}
          </table>
        </div>
      </Card>

      <Modal open={modal} title="Nuevo bono" onClose={() => setModal(false)}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>Guardar</Button></>}>
        <div className="grid grid--form">
          {!fixed && <EmpleadoSelect empleados={empleados.data} value={form.id_empleado} onChange={v => setForm(s => ({ ...s, id_empleado: v }))} required />}
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          <Input label="Valor (COP)" type="number" step="1000" required value={form.valor} onChange={e => setForm(s => ({ ...s, valor: e.target.value }))} />
          <Input label="Concepto (opcional)" placeholder="Bono de productividad…" value={form.concepto} onChange={e => setForm(s => ({ ...s, concepto: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delBono} title="Eliminar bono"
        itemLabel={delBono ? `el bono de ${cop(num(delBono.valor))} a ${nombreEmpleado(delBono.id_empleado)}` : undefined}
        loading={deleting} onCancel={() => setDelBono(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════════════════════
// "Salarios" ya no es una pestaña aparte: el salario (vigente + aumentos) se
// gestiona desde el perfil del empleado (clic en su nombre), junto con sus
// préstamos, bonos y pagos — así se maneja empleados+salarios en un solo lugar.
type PageTab = 'empleados' | 'prestamos' | 'quincenas' | 'bonos' | 'plantas' | 'turnos' | 'catalogoTurnos'

export function EmpleadosNominaApiPage() {
  const canWrite = useCanWrite('finanzas')
  const [tab, setTab] = useState<PageTab>('empleados')
  const empleados = useEmpleados()
  const plantas = usePlantas()
  const [perfilId, setPerfilId] = useState<number | null>(null)

  const [saldos, setSaldos] = useState<SaldoPrestamoEmpleado[]>([])
  useEffect(() => { nominaApi.getSaldoPrestamos().then(r => setSaldos(Array.isArray(r) ? r : [])).catch(() => {}) }, [])
  const saldoTotal = saldos.reduce((s, x) => s + num(x.saldo), 0)

  const TABS: { key: PageTab; label: string }[] = [
    { key: 'empleados', label: 'Empleados' },
    { key: 'prestamos', label: 'Préstamos' },
    { key: 'quincenas', label: 'Quincenas' },
    { key: 'bonos', label: 'Bonos' },
    { key: 'plantas', label: 'Plantas' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'catalogoTurnos', label: 'Catálogo de turnos' },
  ]

  return (
    <div className="page">
      <PageHeader title="Empleados y nómina" subtitle="Empleados (con salario, préstamos, bonos y pagos en su perfil), quincenas, plantas y turnos — conectado al backend." />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Empleados"       value={empleados.data.length} icon={<Users2 size={16} />}   accent="green"   />
        <KpiTile label="Plantas / sedes" value={plantas.data.length}   icon={<Building2 size={16} />} accent="emerald" />
        <KpiTile label="Saldo préstamos" value={cop(saldoTotal)}       icon={<Landmark size={16} />}  accent="rose"    />
        <KpiTile label="Módulo"          value="Nómina API"            icon={<UserCog size={16} />}   accent="brown"   />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'empleados' && <EmpleadosTab canWrite={canWrite} empleados={empleados} onVerPerfil={setPerfilId} />}
      {tab === 'prestamos' && <PrestamosTab canWrite={canWrite} empleados={empleados} onVerPerfil={setPerfilId} />}
      {tab === 'quincenas' && <QuincenasTab canWrite={canWrite} empleados={empleados} onVerPerfil={setPerfilId} />}
      {tab === 'bonos' && <BonosTab canWrite={canWrite} empleados={empleados} onVerPerfil={setPerfilId} />}
      {tab === 'plantas' && <PlantasTab canWrite={canWrite} plantas={plantas} />}
      {tab === 'turnos' && <TurnosTab canWrite={canWrite} empleados={empleados} plantas={plantas} onVerPerfil={setPerfilId} />}
      {tab === 'catalogoTurnos' && <CatalogoTurnosTab canWrite={canWrite} />}

      <EmpleadoProfileModal idEmpleado={perfilId} empleados={empleados} canWrite={canWrite} onClose={() => setPerfilId(null)} />
    </div>
  )
}
