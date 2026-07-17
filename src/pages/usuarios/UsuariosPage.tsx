import { useState } from 'react'
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import {
  Badge, Button, Card, Checkbox, InfoCallout, Input, Modal, Select, CardList, CardRow, KpiTile,
} from '@/components/ui'
import { PageHeader, ReadOnlyBanner, EmptyState } from '@/components/common/Page'
import { useAuth } from '@/context/AuthContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { ROLES } from '@/auth/permissions'
import { formatDate } from '@/utils/format'
import type { Role, User } from '@/types'

const roleOptions = (Object.keys(ROLES) as Role[]).map((r) => ({ value: r, label: ROLES[r].label }))
const roleTone: Record<Role, 'success' | 'info' | 'warning'> = {
  administrador: 'info',
  materiales: 'success',
  financiero: 'warning',
}

export function UsuariosPage() {
  const canWrite = useCanWrite('usuarios')
  const { users, user: current, addUser, updateUser, removeUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', role: 'materiales' as Role, password: '', activo: true })
  const [err, setErr] = useState<Record<string, string>>({})

  const openCreate = () => {
    setEditing(null)
    setForm({ nombre: '', email: '', role: 'materiales', password: '', activo: true })
    setErr({})
    setOpen(true)
  }
  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ nombre: u.nombre, email: u.email, role: u.role, password: '', activo: u.activo })
    setErr({})
    setOpen(true)
  }

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.nombre) e.nombre = 'Ingrese el nombre.'
    if (!form.email) e.email = 'Ingrese el correo.'
    if (!editing && !form.password) e.password = 'Defina una contraseña inicial.'
    setErr(e)
    if (Object.keys(e).length) return

    if (editing) {
      const patch: Partial<User> & { password?: string } = {
        nombre: form.nombre,
        email: form.email,
        role: form.role,
        activo: form.activo,
      }
      if (form.password) patch.password = form.password
      updateUser(editing.id, patch)
    } else {
      addUser({ nombre: form.nombre, email: form.email, role: form.role, activo: form.activo, password: form.password })
    }
    setOpen(false)
  }

  return (
    <div className="page">
      <PageHeader
        title="Usuarios y accesos"
        subtitle="Administre las cuentas del sistema y sus roles."
        actions={
          canWrite && (
            <Button icon={<Plus size={18} />} onClick={openCreate}>
              Nuevo usuario
            </Button>
          )
        }
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
        <KpiTile label="Usuarios totales" value={users.length} icon={<UserCog size={16} />} accent="green" />
        <KpiTile label="Activos" value={users.filter((u) => u.activo).length} icon={<ShieldCheck size={16} />} accent="emerald" />
        <KpiTile label="Roles definidos" value={Object.keys(ROLES).length} accent="brown" />
      </div>

      <InfoCallout accent>
        Cada rol tiene permisos estrictos: <strong>Materiales</strong> gestiona el material, <strong>Financiero</strong>{' '}
        gestiona pagos y nómina, y <strong>Administrador</strong> consulta todo el sistema.
      </InfoCallout>

      <Card title="Cuentas del sistema">
        {users.length === 0 ? (
          <EmptyState title="Sin usuarios" />
        ) : (
          <CardList>
            {users.map((u) => (
              <CardRow
                key={u.id}
                title={`${u.nombre}${u.id === current?.id ? ' (usted)' : ''}`}
                subtitle={`${u.email} · Último acceso ${formatDate(u.ultimoAcceso ?? '')}`}
                status={
                  <>
                    <Badge tone={roleTone[u.role]}>{ROLES[u.role].label}</Badge>
                    <Badge tone={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </>
                }
                extra={
                  canWrite && (
                    <div className="row" style={{ gap: 8 }}>
                      <Button variant="secondary" size="sm" icon={<Pencil size={16} />} aria-label={`Editar ${u.nombre}`} onClick={() => openEdit(u)} />
                      {u.id !== current?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={16} />}
                          aria-label={`Eliminar ${u.nombre}`}
                          onClick={() => confirm(`¿Eliminar a ${u.nombre}?`) && removeUser(u.id)}
                        />
                      )}
                    </div>
                  )
                }
              />
            ))}
          </CardList>
        )}
      </Card>

      <Modal
        open={open}
        title={editing ? `Editar usuario — ${editing.nombre}` : 'Nuevo usuario'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{editing ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </>
        }
      >
        <div className="grid grid--form">
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} error={err.nombre} required />
          <Input label="Correo electrónico" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={err.email} required />
          <Select
            label="Rol"
            options={roleOptions}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            helper={ROLES[form.role].descripcion}
            required
          />
          <Input
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={err.password}
            helper={editing ? 'Déjela vacía para no cambiarla.' : 'Mínimo 6 caracteres.'}
            required={!editing}
          />
        </div>
        <Checkbox label="Cuenta activa" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
      </Modal>
    </div>
  )
}
