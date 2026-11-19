// ── Cuentas bancarias ────────────────────────────────────────────────────────
// Catálogo compartido (una sola tabla en el backend, /pagos/cuentas) — se
// muestra como pestaña igual en Gastos (CxPApiPage) e Ingresos (CxCApiPage)
// porque es el mismo recurso: de ahí salen los pagos y entran los cobros.
// Elegir una cuenta no exenta en un abono dispara el 4×1000 automático en el
// backend (ver src/api/pagosImpuestos.ts y la pestaña "4×1000" en Impuestos).
import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Checkbox, Input, Modal, Select, useToast } from '@/components/ui'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP } from '@/utils/format'
import { pagosCuentasApi, type CuentaBancaria, type CuentaBancariaPayload } from '@/api/pagosCuentas'
import { useCuentasBancarias } from '@/hooks/useCuentasBancarias'
import { useEmpleados, EmpleadoSelect } from '@/pages/nomina/empleadosShared'

const cop = formatCOP

const TIPO_OPTS = [
  { value: 'ahorros',   label: 'Ahorros' },
  { value: 'corriente', label: 'Corriente' },
  { value: 'nequi',     label: 'Nequi' },
  { value: 'otro',      label: 'Otro' },
]
const PROPIETARIO_OPTS = [
  { value: 'empresa',  label: 'Empresa' },
  { value: 'empleado', label: 'Empleado' },
]

const emptyForm = (): CuentaBancariaPayload => ({ nombre: '', banco: '', numero_cuenta: '', tipo_cuenta: 'ahorros', propietario: 'empresa', exento_4x1000: false })

export function CuentasBancariasTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast()
  const cuentas = useCuentasBancarias()
  const empleados = useEmpleados()

  const [saldos, setSaldos] = useState<Record<number, number> | null>(null)
  useEffect(() => {
    pagosCuentasApi.getSaldos()
      .then(r => setSaldos(Object.fromEntries((Array.isArray(r) ? r : []).map(s => [s.id ?? s.id_cuenta_bancaria ?? 0, num(s.saldo)]))))
      .catch(() => setSaldos({}))
  }, [])

  const [modal, setModal] = useState<null | 'nueva' | CuentaBancaria>(null)
  const [form, setForm] = useState<CuentaBancariaPayload>(emptyForm())
  const [saving, setSaving] = useState(false)
  const abrirNueva = () => { setForm(emptyForm()); setModal('nueva') }
  const abrirEditar = (c: CuentaBancaria) => {
    setForm({
      nombre: c.nombre, banco: c.banco, numero_cuenta: c.numero_cuenta, tipo_cuenta: c.tipo_cuenta,
      propietario: c.propietario, id_empleado: c.id_empleado ?? undefined, exento_4x1000: !!c.exento_4x1000,
    })
    setModal(c)
  }
  const valido = form.nombre.trim() && form.banco.trim() && form.numero_cuenta.trim() && (form.propietario !== 'empleado' || form.id_empleado != null)
  const guardar = async () => {
    if (!valido) { toast.error('Nombre, banco y número de cuenta son obligatorios'); return }
    const body: CuentaBancariaPayload = {
      ...form, nombre: form.nombre.trim(), banco: form.banco.trim(), numero_cuenta: form.numero_cuenta.trim(),
      id_empleado: form.propietario === 'empleado' ? form.id_empleado : undefined,
    }
    setSaving(true)
    try {
      if (modal === 'nueva') { await pagosCuentasApi.crear(body); toast.success('Cuenta bancaria creada') }
      else if (modal) { await pagosCuentasApi.actualizar(modal.id, body); toast.success('Cuenta bancaria actualizada') }
      setModal(null); cuentas.reload()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  const toggleActiva = async (c: CuentaBancaria) => {
    try { await pagosCuentasApi.actualizar(c.id, { activa: !(c.activa !== false && c.activa !== 0) }); cuentas.reload() }
    catch (e) { toast.error(apiError(e).message) }
  }
  const toggleExento = async (c: CuentaBancaria) => {
    try { await pagosCuentasApi.actualizar(c.id, { exento_4x1000: !c.exento_4x1000 }); cuentas.reload() }
    catch (e) { toast.error(apiError(e).message) }
  }

  const [delCuenta, setDelCuenta] = useState<CuentaBancaria | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!delCuenta) return
    setDeleting(true)
    try { await pagosCuentasApi.eliminar(delCuenta.id); toast.success('Cuenta bancaria eliminada'); setDelCuenta(null); cuentas.reload() }
    catch (e) {
      const { status, message } = apiError(e)
      toast.error(status === 409 ? 'Esta cuenta ya tiene movimientos o impuestos asociados y no se puede eliminar.' : message)
      setDelCuenta(null)
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>
        Cuentas reales de la empresa (o de un empleado autorizado) desde donde sale o entra la plata. Al abonar/pagar en cualquier módulo,
        elegir una de estas cuentas deja trazabilidad de a dónde fue el dinero y, si no está exenta, el banco cobra el 4×1000 automático.
      </div>

      <Card title={`Cuentas bancarias (${cuentas.data.length})`} actions={canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrirNueva}>Nueva cuenta</Button>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Nombre</th><th>Banco</th><th>Número</th><th>Tipo</th><th>Propietario</th>
              <th style={{ textAlign: 'right' }}>Saldo</th><th>Exenta 4×1000</th><th>Activa</th>{canWrite && <th></th>}
            </tr></thead>
            <tbody>
              {cuentas.loading ? (
                <tr><td colSpan={canWrite ? 9 : 8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : cuentas.data.length === 0 ? (
                <tr><td colSpan={canWrite ? 9 : 8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin cuentas bancarias registradas</td></tr>
              ) : cuentas.data.map(c => {
                const activa = c.activa !== false && c.activa !== 0
                return (
                  <tr key={c.id} style={!activa ? { opacity: 0.55 } : undefined}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td>{c.banco}</td>
                    <td className="mono">{c.numero_cuenta}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.tipo_cuenta}</td>
                    <td>{c.propietario === 'empleado' ? (empleados.data.find(e => e.id === c.id_empleado)?.nombre ?? 'Empleado') : 'Empresa'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{saldos && saldos[c.id] != null ? cop(saldos[c.id]) : '—'}</td>
                    <td>
                      <button type="button" disabled={!canWrite} onClick={() => toggleExento(c)}
                        className={`badge ${c.exento_4x1000 ? 'badge--success' : 'badge--neutral'}`} style={{ cursor: canWrite ? 'pointer' : 'default', border: 'none' }}>
                        {c.exento_4x1000 ? 'Exenta' : 'No exenta'}
                      </button>
                    </td>
                    <td>
                      <button type="button" disabled={!canWrite} onClick={() => toggleActiva(c)}
                        className={`badge ${activa ? 'badge--success' : 'badge--warning'}`} style={{ cursor: canWrite ? 'pointer' : 'default', border: 'none' }}>
                        {activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => abrirEditar(c)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDelCuenta(c)} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal !== null} title={modal === 'nueva' ? 'Nueva cuenta bancaria' : 'Editar cuenta bancaria'} onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={guardar} disabled={saving || !valido}>{saving ? 'Guardando…' : 'Guardar'}</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" required placeholder="Cuenta nómina, Bancolombia principal…" style={{ gridColumn: '1 / -1' }}
            value={form.nombre} onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} />
          <Input label="Banco" required value={form.banco} onChange={e => setForm(s => ({ ...s, banco: e.target.value }))} />
          <Input label="Número de cuenta" required mono value={form.numero_cuenta} onChange={e => setForm(s => ({ ...s, numero_cuenta: e.target.value }))} />
          <Select label="Tipo de cuenta" options={TIPO_OPTS} value={form.tipo_cuenta} onChange={e => setForm(s => ({ ...s, tipo_cuenta: e.target.value }))} />
          <Select label="Propietario" options={PROPIETARIO_OPTS} value={form.propietario}
            onChange={e => setForm(s => ({ ...s, propietario: e.target.value, id_empleado: e.target.value === 'empleado' ? s.id_empleado : undefined }))} />
          {form.propietario === 'empleado' && (
            <EmpleadoSelect empleados={empleados.data} value={form.id_empleado ?? ''} onChange={id => setForm(s => ({ ...s, id_empleado: id === '' ? undefined : id }))} required />
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <Checkbox label="Exenta del 4×1000 (no se le cobra el impuesto a los movimientos)"
              checked={!!form.exento_4x1000} onChange={e => setForm(s => ({ ...s, exento_4x1000: e.target.checked }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal open={!!delCuenta} title="Eliminar cuenta bancaria" itemLabel={delCuenta?.nombre} loading={deleting} onCancel={() => setDelCuenta(null)} onConfirm={confirmDelete} />
    </>
  )
}
