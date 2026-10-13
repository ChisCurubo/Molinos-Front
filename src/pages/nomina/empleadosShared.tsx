// ════════════════════════════════════════════════════════════════════════════
// Piezas compartidas de Empleados/Salarios/Préstamos — usadas por
// finanzas/EmpleadosNominaApiPage.tsx, la única vista de "Empleados y nómina"
// (Plantas/Turnos/Quincenas/Bonos/Ficha además de esto).
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, HandCoins, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, todayISO } from '@/utils/format'
import {
  nominaApi,
  type Empleado, type EmpleadoPayload, type SalarioEmpleado, type TipoPago, type PrestamoEmpleado,
  type PrestacionesEmpleado,
} from '@/api/nomina'

const cop = formatCOP

// Fechas del backend llegan como ISO completo aunque la columna sea DATE (artefacto
// de zona horaria de MySQL2) — se arma a mano desde los primeros 10 caracteres para
// no depender de Date/toLocaleDateString y evitar que se corra un día.
export function fmtDMY(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const nombreCompleto = (e: Empleado) => e.apellido ? `${e.nombre} ${e.apellido}` : e.nombre

// ─── Avatar con iniciales ────────────────────────────────────────────────────
// El backend todavía no tiene foto de empleado (sin columna ni endpoint de
// subida) — mientras tanto se usa un avatar con iniciales y color estable
// por id, listo para reemplazarse por una <img> apenas exista foto_url.
const AVATAR_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#c026d3', '#65a30d']
export function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length] }
export function avatarInitials(e: Empleado) {
  const a = (e.nombre ?? '').trim().charAt(0)
  const b = (e.apellido ?? '').trim().charAt(0)
  return (a + b).toUpperCase() || '?'
}
export function Avatar({ empleado, size = 40 }: { empleado: Empleado; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '999px', background: avatarColor(empleado.id),
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4, flexShrink: 0, userSelect: 'none',
    }}>
      {avatarInitials(empleado)}
    </div>
  )
}

export const TIPO_PAGO_OPTS: { value: TipoPago; label: string }[] = [
  { value: 'FIJO_MENSUAL', label: 'Fijo mensual' },
  { value: 'POR_DIAS', label: 'Por día' },
  { value: 'POR_HORAS', label: 'Por hora' },
]
export const TIPO_PAGO_LABEL = (t: string) => TIPO_PAGO_OPTS.find(o => o.value === t)?.label ?? t
export const TIPO_PAGO_SUFFIX: Record<TipoPago, string> = { FIJO_MENSUAL: '/mes', POR_DIAS: '/día', POR_HORAS: '/hora' }

// ─── Estados de tabla reutilizables ──────────────────────────────────────────
export function TableState({ loading, error, empty, cols, onRetry }: {
  loading: boolean; error: string | null; empty: boolean; cols: number; onRetry?: () => void
}) {
  if (loading) return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
  if (error) return (
    <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
      {error}{onRetry && <> · <button onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Reintentar</button></>}
    </td></tr>
  )
  if (empty) return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin registros</td></tr>
  return null
}

// ─── Catálogo de empleados (compartido entre tabs) ──────────────────────────
export function useEmpleados() {
  const [data, setData] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getEmpleados()
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}
export type EmpleadosState = ReturnType<typeof useEmpleados>

// ─── Salario actual de TODOS los empleados (para la columna "Salario" de la
// tabla de Empleados) — no existe un endpoint en lote, así que se trae uno
// por uno en paralelo, igual que ya hace CalendarioTurnosApiPage para filtrar
// por tipo de turno. `null` = sin configurar (404 esperado, no es error).
export function useSalariosEmpleados(empleados: EmpleadosState) {
  const [data, setData] = useState<Record<number, SalarioEmpleado | null>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (empleados.loading) return
    if (empleados.data.length === 0) { setData({}); setLoading(false); return }
    let cancelado = false
    setLoading(true)
    Promise.all(empleados.data.map(e =>
      nominaApi.getSalarioActual(e.id).then(s => [e.id, s] as const).catch(() => [e.id, null] as const)
    )).then(entries => {
      if (cancelado) return
      setData(Object.fromEntries(entries))
      setLoading(false)
    })
    return () => { cancelado = true }
  }, [empleados.loading, empleados.data])
  return { data, loading }
}

export function EmpleadoSelect({ empleados, value, onChange, placeholder = '— Seleccionar empleado —', required }: {
  empleados: Empleado[]; value: number | ''; onChange: (id: number | '') => void; placeholder?: string; required?: boolean
}) {
  return (
    <Select
      label="Empleado" required={required}
      value={value === '' ? '' : String(value)}
      onChange={e => { const v = e.target.value; onChange(v === '' ? '' : Number(v)) }}
      placeholder={placeholder}
      options={empleados.map(e => ({ value: String(e.id), label: nombreCompleto(e) }))}
    />
  )
}

// ─── Celda de salario — monto + unidad bien resaltados, tipo de pago como
// detalle chico debajo, para que la tabla de Empleados sea informativa de un
// vistazo sin tener que entrar al perfil ────────────────────────────────────
export function SalarioCell({ salario, loading }: { salario: SalarioEmpleado | null | undefined; loading: boolean }) {
  if (loading) return <span style={{ color: 'var(--text-faint)' }}>…</span>
  if (!salario) return <em style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>Sin configurar</em>
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700 }}>
        {cop(num(salario.tarifa_monto))}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{TIPO_PAGO_SUFFIX[salario.tipo_pago]}</span>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
        {TIPO_PAGO_LABEL(salario.tipo_pago)}{!!num(salario.aplica_aux_transp) && ' · Aux. transporte'}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EMPLEADOS
// ════════════════════════════════════════════════════════════════════════════
const emptyEmpleadoForm = () => ({ nombre: '', apellido: '', cc: '', cuenta: '', nequi: false, labor: '' })

export function EmpleadosTab({ canWrite, empleados, onVerPerfil }: {
  canWrite: boolean; empleados: EmpleadosState; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const salarios = useSalariosEmpleados(empleados)
  const [q, setQ] = useState('')
  const filtrados = useMemo(() => {
    if (!q.trim()) return empleados.data
    const s = q.trim().toUpperCase()
    return empleados.data.filter(e => e.nombre.toUpperCase().includes(s) || (e.apellido ?? '').toUpperCase().includes(s) || e.cc.includes(s))
  }, [empleados.data, q])

  const [modal, setModal] = useState<null | 'nuevo' | number>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyEmpleadoForm())
  const f = (k: keyof ReturnType<typeof emptyEmpleadoForm>, v: string | boolean) => setForm(s => ({ ...s, [k]: v }))

  const openNuevo = () => { setForm(emptyEmpleadoForm()); setModal('nuevo') }
  const openEdit = (e: Empleado) => {
    setForm({ nombre: e.nombre, apellido: e.apellido ?? '', cc: e.cc, cuenta: e.cuenta ?? '', nequi: !!num(e.nequi), labor: e.labor ?? '' })
    setModal(e.id)
  }
  const save = async () => {
    if (!form.nombre.trim() || !form.cc.trim()) return
    setSaving(true)
    const body: EmpleadoPayload = {
      nombre: form.nombre.trim(), apellido: form.apellido.trim() || undefined, cc: form.cc.trim(),
      cuenta: form.cuenta.trim() || undefined, nequi: form.nequi, labor: form.labor.trim() || undefined,
    }
    try {
      if (modal === 'nuevo') { await nominaApi.createEmpleado(body); toast.success('Empleado creado') }
      else if (typeof modal === 'number') { await nominaApi.updateEmpleado(modal, body); toast.success('Empleado actualizado') }
      setModal(null); empleados.reload()
    } catch (e) {
      const { status, message } = apiError(e)
      // El backend responde 500 crudo (constraint UNIQUE) si la cédula ya existe.
      toast.error(modal === 'nuevo' && status === 500 ? 'La cédula ya existe o el dato ingresado no es válido.' : message)
    } finally { setSaving(false) }
  }

  const [delEmpleado, setDelEmpleado] = useState<Empleado | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delEmpleado) return
    setDeleting(true)
    try { await nominaApi.deleteEmpleado(delEmpleado.id); toast.success('Empleado eliminado'); setDelEmpleado(null); empleados.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      // El backend responde 500 crudo si el empleado tiene turnos/préstamos/usuario asociado.
      toast.error(status === 500 ? 'No se pudo eliminar: tiene turnos, préstamos o un usuario del sistema asociado.' : message)
      setDelEmpleado(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="field__input" placeholder="Buscar por nombre, apellido o cédula…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: '22rem' }} />
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo empleado</Button>}
      </div>

      <Card title={`Empleados (${filtrados.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Cédula</th><th>Cuenta / Nequi</th><th>Labor</th><th>Salario</th><th></th></tr></thead>
            <tbody>
              <TableState loading={empleados.loading} error={empleados.error} empty={filtrados.length === 0} cols={6} onRetry={empleados.reload} />
              {!empleados.loading && !empleados.error && filtrados.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700 }}>
                    {onVerPerfil ? (
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }}
                        onClick={() => onVerPerfil(e.id)}
                      >
                        <Avatar empleado={e} size={28} />
                        {nombreCompleto(e)}
                      </button>
                    ) : nombreCompleto(e)}
                  </td>
                  <td className="mono">{e.cc}</td>
                  <td>
                    <div className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{e.cuenta ?? '—'}</div>
                    {!!num(e.nequi) && <span className="badge badge--info" style={{ fontSize: '0.65rem' }}>Nequi</span>}
                  </td>
                  <td>{e.labor ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td><SalarioCell salario={salarios.data[e.id]} loading={salarios.loading} /></td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {onVerPerfil && <Button variant="secondary" size="sm" onClick={() => onVerPerfil(e.id)}>Perfil</Button>}
                      {canWrite && <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(e)} />}
                      {canWrite && <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelEmpleado(e)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo empleado' : 'Editar empleado'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !form.nombre.trim() || !form.cc.trim()}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          <Input label="Apellido" value={form.apellido} onChange={e => f('apellido', e.target.value)} />
          <Input label="Cédula (CC)" required value={form.cc} onChange={e => f('cc', e.target.value)} />
          <Input label="Cuenta bancaria" value={form.cuenta} onChange={e => f('cuenta', e.target.value)} />
          <Input label="Labor / cargo" value={form.labor} onChange={e => f('labor', e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="empleado-nequi" checked={form.nequi} onChange={e => f('nequi', e.target.checked)} />
            <label htmlFor="empleado-nequi" style={{ cursor: 'pointer', userSelect: 'none' }}>Usa Nequi</label>
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delEmpleado} title="Eliminar empleado" itemLabel={delEmpleado ? nombreCompleto(delEmpleado) : undefined}
        loading={deleting} onCancel={() => setDelEmpleado(null)} onConfirm={confirmDelete} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SALARIOS (vigencias versionadas — igual patrón que Tarifas de maquila)
// ════════════════════════════════════════════════════════════════════════════
export function SalariosTab({ canWrite, empleados, idEmpleadoInicial, fixed }: {
  canWrite: boolean; empleados: EmpleadosState; idEmpleadoInicial?: number; fixed?: boolean
}) {
  const toast = useToast()
  const [idEmpleado, setIdEmpleado] = useState<number | ''>(idEmpleadoInicial ?? '')
  useEffect(() => { if (idEmpleadoInicial != null) setIdEmpleado(idEmpleadoInicial) }, [idEmpleadoInicial])

  const [actual, setActual] = useState<SalarioEmpleado | null>(null)
  const [loadingActual, setLoadingActual] = useState(false)
  const [sinConfigurar, setSinConfigurar] = useState(false)
  const loadActual = useCallback(() => {
    if (idEmpleado === '') { setActual(null); return }
    setLoadingActual(true); setSinConfigurar(false)
    nominaApi.getSalarioActual(idEmpleado)
      .then(s => setActual(s))
      .catch(e => {
        const { status, message } = apiError(e)
        setActual(null)
        if (status === 404) setSinConfigurar(true)
        else toast.error(message)
      })
      .finally(() => setLoadingActual(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEmpleado])
  useEffect(() => { loadActual() }, [loadActual])

  const [histOpen, setHistOpen] = useState(false)
  const [hist, setHist] = useState<SalarioEmpleado[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const loadHist = useCallback(() => {
    if (idEmpleado === '') return
    setHistLoading(true)
    nominaApi.getSalarioHistorial(idEmpleado)
      .then(r => setHist(Array.isArray(r) ? r : []))
      .catch(() => setHist([]))
      .finally(() => setHistLoading(false))
  }, [idEmpleado])
  const toggleHist = () => { const next = !histOpen; setHistOpen(next); if (next) loadHist() }
  useEffect(() => { setHistOpen(false); setHist([]) }, [idEmpleado])

  // ── Prestaciones sociales estimadas (cesantías, prima, vacaciones…) — el
  // backend solo provisiona esto, NO salud/pensión (no hay esos campos). ──
  const [anioPrest, setAnioPrest] = useState(String(new Date().getFullYear()))
  const [prest, setPrest] = useState<PrestacionesEmpleado | null>(null)
  const [loadingPrest, setLoadingPrest] = useState(false)
  const loadPrest = useCallback(() => {
    if (idEmpleado === '') { setPrest(null); return }
    setLoadingPrest(true)
    nominaApi.getPrestaciones(idEmpleado, Number(anioPrest) || undefined)
      .then(p => setPrest(p))
      .catch(() => setPrest(null))
      .finally(() => setLoadingPrest(false))
  }, [idEmpleado, anioPrest])
  useEffect(() => { loadPrest() }, [loadPrest])

  // ── Nueva vigencia (POST → cierra la anterior sola) ──
  const [nuevaModal, setNuevaModal] = useState(false)
  const [nuevaForm, setNuevaForm] = useState({ tipo_pago: 'FIJO_MENSUAL' as TipoPago, tarifa_monto: '', aplica_aux_transp: false, fecha_inicio: todayISO() })
  const [savingNueva, setSavingNueva] = useState(false)
  const abrirNueva = () => {
    setNuevaForm({
      tipo_pago: actual?.tipo_pago ?? 'FIJO_MENSUAL', tarifa_monto: '',
      aplica_aux_transp: actual ? !!num(actual.aplica_aux_transp) : false, fecha_inicio: todayISO(),
    })
    setNuevaModal(true)
  }
  const guardarNueva = async () => {
    if (idEmpleado === '') return
    const monto = Number(nuevaForm.tarifa_monto)
    if (!(monto > 0)) { toast.error('La tarifa debe ser mayor a 0'); return }
    setSavingNueva(true)
    try {
      await nominaApi.crearVigenciaSalario(idEmpleado, {
        tipo_pago: nuevaForm.tipo_pago, tarifa_monto: monto,
        aplica_aux_transp: nuevaForm.aplica_aux_transp, fecha_inicio: nuevaForm.fecha_inicio || undefined,
      })
      toast.success('Nueva vigencia salarial creada')
      setNuevaModal(false); loadActual(); if (histOpen) loadHist()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingNueva(false) }
  }

  // ── Corregir vigencia puntual (PATCH → NO versiona) ──
  const [corregirModal, setCorregirModal] = useState<SalarioEmpleado | null>(null)
  const [corregirForm, setCorregirForm] = useState({ tipo_pago: 'FIJO_MENSUAL' as TipoPago, tarifa_monto: '', aplica_aux_transp: false, fecha_inicio: '', activo: true })
  const [savingCorregir, setSavingCorregir] = useState(false)
  const abrirCorregir = (s: SalarioEmpleado) => {
    setCorregirForm({
      tipo_pago: s.tipo_pago, tarifa_monto: String(num(s.tarifa_monto)),
      aplica_aux_transp: !!num(s.aplica_aux_transp), fecha_inicio: (s.fecha_inicio ?? '').slice(0, 10), activo: !!num(s.activo),
    })
    setCorregirModal(s)
  }
  const guardarCorregir = async () => {
    if (!corregirModal) return
    setSavingCorregir(true)
    try {
      await nominaApi.corregirVigenciaSalario(corregirModal.id, {
        tipo_pago: corregirForm.tipo_pago,
        tarifa_monto: corregirForm.tarifa_monto ? Number(corregirForm.tarifa_monto) : undefined,
        aplica_aux_transp: corregirForm.aplica_aux_transp,
        fecha_inicio: corregirForm.fecha_inicio || undefined,
        activo: corregirForm.activo,
      })
      toast.success('Vigencia corregida')
      setCorregirModal(null); loadActual(); loadHist()
    } catch (e) { toast.error(apiError(e).message) } finally { setSavingCorregir(false) }
  }

  const [delSalario, setDelSalario] = useState<SalarioEmpleado | null>(null)
  const [deletingSalario, setDeletingSalario] = useState(false)
  const confirmDeleteSalario = async () => {
    if (!delSalario) return
    setDeletingSalario(true)
    try { await nominaApi.deleteVigenciaSalario(delSalario.id); toast.success('Vigencia eliminada'); setDelSalario(null); loadActual(); loadHist() }
    catch (e) { toast.error(apiError(e).message); setDelSalario(null) } finally { setDeletingSalario(false) }
  }

  return (
    <>
      {!fixed && (
        <div style={{ marginBottom: '1rem' }}>
          <Card>
            <div className="grid grid--form" style={{ marginBottom: 0 }}>
              <EmpleadoSelect empleados={empleados.data} value={idEmpleado} onChange={setIdEmpleado} placeholder="— Selecciona un empleado —" />
            </div>
          </Card>
        </div>
      )}

      {idEmpleado === '' ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Selecciona un empleado para ver y gestionar su salario.</p></Card>
      ) : (
        <>
          <Card title="Salario vigente" actions={canWrite && (
            <div className="row" style={{ gap: 8 }}>
              {actual && <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => abrirCorregir(actual)}>Corregir</Button>}
              <Button size="sm" icon={<Plus size={16} />} onClick={abrirNueva}>Nueva vigencia</Button>
            </div>
          )}>
            {loadingActual ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Cargando…</p>
            ) : sinConfigurar || !actual ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>Este empleado todavía no tiene salario configurado.</p>
            ) : (
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Tipo de pago</div>
                  <div style={{ fontWeight: 700 }}>{TIPO_PAGO_LABEL(actual.tipo_pago)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Tarifa</div>
                  <div style={{ fontWeight: 700 }} className="mono">{cop(num(actual.tarifa_monto))}{TIPO_PAGO_SUFFIX[actual.tipo_pago]}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Vigente desde</div>
                  <div>{fmtDMY(actual.fecha_inicio)}</div>
                </div>
                {!!num(actual.aplica_aux_transp) && <span className="badge badge--info">Aplica auxilio de transporte</span>}
              </div>
            )}
          </Card>

          <div style={{ marginTop: '1rem' }}>
            <Card title="Historial de vigencias"
              actions={<Button size="sm" variant="secondary" icon={histOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={toggleHist}>{histOpen ? 'Ocultar' : 'Ver historial'}</Button>}>
              {!histOpen ? (
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>Todas las vigencias salariales de este empleado (vigentes y cerradas).</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Tipo de pago</th><th style={{ textAlign: 'right' }}>Tarifa</th><th>Desde</th><th>Aux. transporte</th><th>Estado</th>{canWrite && <th></th>}</tr></thead>
                    <tbody>
                      <TableState loading={histLoading} error={null} empty={hist.length === 0} cols={canWrite ? 6 : 5} />
                      {!histLoading && hist.map(s => (
                        <tr key={s.id} style={num(s.activo) ? { background: 'var(--green-50)' } : undefined}>
                          <td>{TIPO_PAGO_LABEL(s.tipo_pago)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{cop(num(s.tarifa_monto))}{TIPO_PAGO_SUFFIX[s.tipo_pago]}</td>
                          <td>{fmtDMY(s.fecha_inicio)}</td>
                          <td>{num(s.aplica_aux_transp) ? 'Sí' : '—'}</td>
                          <td><span className={`badge badge--${num(s.activo) ? 'success' : 'neutral'}`}>{num(s.activo) ? 'Vigente' : 'Cerrada'}</span></td>
                          {canWrite && <td><div className="row" style={{ gap: 4 }}>
                            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} title="Corregir" onClick={() => abrirCorregir(s)} />
                            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} title="Eliminar" onClick={() => setDelSalario(s)} />
                          </div></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Card title="Prestaciones sociales"
              actions={<Input label="Año" type="number" value={anioPrest} onChange={e => setAnioPrest(e.target.value)} style={{ maxWidth: '7rem' }} />}>
              {loadingPrest ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>Cargando…</p>
              ) : !prest ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>Sin datos de prestaciones para {anioPrest}.</p>
              ) : (
                <>
                  <div className="grid grid--kpi">
                    <KpiTile label="Cesantías" value={cop(num(prest.cesantias))} accent="brown" />
                    <KpiTile label="Intereses de cesantías" value={cop(num(prest.intereses_cesantias))} accent="amber" />
                    <KpiTile label="Prima de servicios" value={cop(num(prest.prima))} accent="emerald" />
                    <KpiTile label="Vacaciones" value={cop(num(prest.vacaciones))} accent="green" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      Provisionado sobre {num(prest.meses_trabajados)} mes(es) trabajados · base mensual {cop(num(prest.base_mensual))}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 'var(--fs-lg)' }} className="mono">Total: {cop(num(prest.total_provisionado))}</span>
                  </div>
                </>
              )}
              <div className="callout" style={{ marginTop: '0.9rem' }}>
                Esto son las <strong>prestaciones sociales</strong> que provisiona el backend (cesantías, sus intereses,
                prima de servicios y vacaciones). <strong>Salud y pensión (seguridad social) todavía no se calculan</strong> —
                el backend no tiene esos campos; si se necesitan, hay que pedirlos en el backend.
              </div>
            </Card>
          </div>
        </>
      )}

      <Modal open={nuevaModal} title="Nueva vigencia salarial" onClose={() => setNuevaModal(false)}
        footer={<><Button variant="secondary" onClick={() => setNuevaModal(false)}>Cancelar</Button><Button onClick={guardarNueva} disabled={savingNueva || !(Number(nuevaForm.tarifa_monto) > 0)}>{savingNueva ? 'Guardando…' : 'Crear vigencia'}</Button></>}>
        <div className="callout" style={{ marginBottom: '1rem' }}>Crea una <strong>vigencia nueva</strong>: cierra automáticamente la anterior de este empleado. El histórico se conserva.</div>
        <div className="grid grid--form">
          <Select label="Tipo de pago" required options={TIPO_PAGO_OPTS} value={nuevaForm.tipo_pago} onChange={e => setNuevaForm(s => ({ ...s, tipo_pago: e.target.value as TipoPago }))} />
          <Input label="Tarifa (COP)" type="number" step="1000" required value={nuevaForm.tarifa_monto} onChange={e => setNuevaForm(s => ({ ...s, tarifa_monto: e.target.value }))} />
          <Input label="Vigente desde" type="date" value={nuevaForm.fecha_inicio} onChange={e => setNuevaForm(s => ({ ...s, fecha_inicio: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="salario-aux" checked={nuevaForm.aplica_aux_transp} onChange={e => setNuevaForm(s => ({ ...s, aplica_aux_transp: e.target.checked }))} />
            <label htmlFor="salario-aux" style={{ cursor: 'pointer', userSelect: 'none' }}>Aplica auxilio de transporte</label>
          </div>
        </div>
      </Modal>

      <Modal open={corregirModal !== null} title="Corregir vigencia salarial" onClose={() => setCorregirModal(null)}
        footer={<><Button variant="secondary" onClick={() => setCorregirModal(null)}>Cancelar</Button><Button onClick={guardarCorregir} disabled={savingCorregir}>{savingCorregir ? 'Guardando…' : 'Guardar corrección'}</Button></>}>
        <div className="callout" style={{ marginBottom: '1rem' }}><strong>Solo para arreglar errores de digitación.</strong> Edita esta misma vigencia sin crear una nueva. Para un cambio de sueldo real usa <em>Nueva vigencia</em>.</div>
        <div className="grid grid--form">
          <Select label="Tipo de pago" options={TIPO_PAGO_OPTS} value={corregirForm.tipo_pago} onChange={e => setCorregirForm(s => ({ ...s, tipo_pago: e.target.value as TipoPago }))} />
          <Input label="Tarifa (COP)" type="number" step="1000" value={corregirForm.tarifa_monto} onChange={e => setCorregirForm(s => ({ ...s, tarifa_monto: e.target.value }))} />
          <Input label="Vigente desde" type="date" value={corregirForm.fecha_inicio} onChange={e => setCorregirForm(s => ({ ...s, fecha_inicio: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="salario-corregir-aux" checked={corregirForm.aplica_aux_transp} onChange={e => setCorregirForm(s => ({ ...s, aplica_aux_transp: e.target.checked }))} />
            <label htmlFor="salario-corregir-aux" style={{ cursor: 'pointer', userSelect: 'none' }}>Aplica auxilio de transporte</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input type="checkbox" id="salario-corregir-activo" checked={corregirForm.activo} onChange={e => setCorregirForm(s => ({ ...s, activo: e.target.checked }))} />
            <label htmlFor="salario-corregir-activo" style={{ cursor: 'pointer', userSelect: 'none' }}>Vigente (activo)</label>
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delSalario} title="Eliminar vigencia salarial"
        itemLabel={delSalario ? `la vigencia de ${TIPO_PAGO_LABEL(delSalario.tipo_pago)} desde ${fmtDMY(delSalario.fecha_inicio)}` : undefined}
        loading={deletingSalario} onCancel={() => setDelSalario(null)} onConfirm={confirmDeleteSalario} />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PRÉSTAMOS DE EMPLEADO
// ════════════════════════════════════════════════════════════════════════════
const emptyPrestamoForm = () => ({ id_empleado: '' as number | '', valor: '', concepto: '', fecha: todayISO() })

export function PrestamosTab({ canWrite, empleados, idEmpleadoInicial, fixed, onVerPerfil }: {
  canWrite: boolean; empleados: EmpleadosState; idEmpleadoInicial?: number; fixed?: boolean; onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const [idEmpleado, setIdEmpleado] = useState<number | ''>(idEmpleadoInicial ?? '')
  useEffect(() => { if (idEmpleadoInicial != null) setIdEmpleado(idEmpleadoInicial) }, [idEmpleadoInicial])
  const [data, setData] = useState<PrestamoEmpleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    nominaApi.getPrestamos(idEmpleado === '' ? undefined : idEmpleado)
      .then(r => setData(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [idEmpleado])
  useEffect(() => { load() }, [load])

  const nombreEmpleado = useCallback((id: number) => {
    const e = empleados.data.find(x => x.id === id)
    return e ? nombreCompleto(e) : `#${id}`
  }, [empleados.data])

  const totalValor = data.reduce((s, p) => s + num(p.valor), 0)

  const [modal, setModal] = useState<null | 'nuevo' | PrestamoEmpleado>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyPrestamoForm())
  const [editCuotas, setEditCuotas] = useState('1')

  const openNuevo = () => { setForm({ ...emptyPrestamoForm(), id_empleado: idEmpleado }); setModal('nuevo') }
  const openEdit = (p: PrestamoEmpleado) => {
    setForm({ id_empleado: p.id_empleado, valor: String(num(p.valor)), concepto: p.concepto ?? '', fecha: (p.fecha ?? '').slice(0, 10) || todayISO() })
    setEditCuotas(String(p.cuotas ?? 1))
    setModal(p)
  }
  const save = async () => {
    const valor = Number(form.valor)
    if (!(valor > 0)) { toast.error('El valor debe ser mayor a 0'); return }
    setSaving(true)
    try {
      if (modal === 'nuevo') {
        if (form.id_empleado === '') { toast.error('Selecciona el empleado'); setSaving(false); return }
        await nominaApi.createPrestamo({ id_empleado: form.id_empleado, valor, concepto: form.concepto.trim() || undefined, fecha: form.fecha || undefined })
        toast.success('Préstamo registrado')
      } else if (modal) {
        const cuotas = Number(editCuotas)
        await nominaApi.updatePrestamo(modal.id, {
          valor, concepto: form.concepto.trim() || undefined, fecha: form.fecha || undefined,
          cuotas: Number.isFinite(cuotas) && cuotas > 0 ? cuotas : undefined,
        })
        toast.success('Préstamo actualizado')
      }
      setModal(null); load()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const [delPrestamo, setDelPrestamo] = useState<PrestamoEmpleado | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delPrestamo) return
    setDeleting(true)
    try { await nominaApi.deletePrestamo(delPrestamo.id); toast.success('Préstamo eliminado'); setDelPrestamo(null); load() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Este préstamo tiene una cuenta asociada y no se puede eliminar.' : message)
      setDelPrestamo(null)
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
        {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={openNuevo} style={{ marginLeft: 'auto' }}>Nuevo préstamo</Button>}
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1rem' }}>
        <KpiTile label="Préstamos" value={data.length} icon={<HandCoins size={16} />} accent="amber" />
        <KpiTile label="Valor total" value={cop(totalValor)} accent="brown" />
      </div>

      <Card title={`Préstamos de empleado (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Fecha</th>{!fixed && <th>Empleado</th>}<th>Concepto</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Cuotas</th>{canWrite && <th></th>}</tr></thead>
            <tbody>
              <TableState loading={loading} error={error} empty={data.length === 0} cols={canWrite ? 6 : 5} onRetry={load} />
              {!loading && !error && data.map(p => (
                <tr key={p.id}>
                  <td>{fmtDMY(p.fecha)}</td>
                  {!fixed && (
                    <td style={{ fontWeight: 600 }}>
                      {onVerPerfil ? (
                        <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => onVerPerfil(p.id_empleado)}>
                          {nombreEmpleado(p.id_empleado)}
                        </button>
                      ) : nombreEmpleado(p.id_empleado)}
                    </td>
                  )}
                  <td>{p.concepto ?? <em style={{ color: 'var(--text-faint)' }}>—</em>}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(num(p.valor))}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{p.cuotas}</td>
                  {canWrite && <td><div className="row" style={{ gap: 4 }}><Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(p)} /><Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelPrestamo(p)} /></div></td>}
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={fixed ? 2 : 3}>Total ({data.length})</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(totalValor)}</td>
                  <td colSpan={canWrite ? 2 : 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nuevo' ? 'Nuevo préstamo' : 'Editar préstamo'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save} disabled={saving || !(Number(form.valor) > 0)}>Guardar</Button></>}>
        <div className="grid grid--form">
          {modal === 'nuevo' && !fixed ? (
            <EmpleadoSelect empleados={empleados.data} value={form.id_empleado} onChange={v => setForm(s => ({ ...s, id_empleado: v }))} required />
          ) : (
            <Input label="Empleado" value={typeof form.id_empleado === 'number' ? nombreEmpleado(form.id_empleado) : ''} disabled />
          )}
          <Input label="Valor (COP)" type="number" step="1000" required value={form.valor} onChange={e => setForm(s => ({ ...s, valor: e.target.value }))} />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} />
          <Input label="Concepto (opcional)" value={form.concepto} onChange={e => setForm(s => ({ ...s, concepto: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
          {modal !== 'nuevo' && (
            <Input label="Cuotas (quincenas a descontar)" type="number" min="1" value={editCuotas} onChange={e => setEditCuotas(e.target.value)}
              helper="Nace en 1 al crear el préstamo; ajústalo aquí." />
          )}
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delPrestamo} title="Eliminar préstamo"
        itemLabel={delPrestamo ? `el préstamo de ${cop(num(delPrestamo.valor))} a ${nombreEmpleado(delPrestamo.id_empleado)}` : undefined}
        loading={deleting} onCancel={() => setDelPrestamo(null)} onConfirm={confirmDelete} />
    </>
  )
}
