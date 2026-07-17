import { useMemo, useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Button, Card, Checkbox, Input, Modal, Select, CardList, CardRow,
} from '@/components/ui'
import { EmptyState } from './Page'
import { useAuth } from '@/context/AuthContext'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox'
  options?: { value: string; label: string }[]
  mono?: boolean
  required?: boolean
  helper?: string
  placeholder?: string
  step?: number
}

export interface ColumnDef<T> {
  key: string
  label: string
  render?: (item: T) => ReactNode
}

export interface CardMap {
  title: ReactNode
  subtitle?: ReactNode
  plate?: string
  tons?: ReactNode
  status?: ReactNode
}

interface CrudManagerProps<T extends { id: string }> {
  title: string
  addLabel: string
  fields: FieldDef[]
  columns: ColumnDef<T>[]
  items: T[]
  mapCard: (item: T) => CardMap
  canWrite: boolean
  onCreate: (values: Record<string, unknown>) => void
  onUpdate: (id: string, values: Record<string, unknown>) => void
  onDelete: (id: string) => void
  emptyHint?: string
}

function emptyValues(fields: FieldDef[]): Record<string, unknown> {
  const v: Record<string, unknown> = {}
  fields.forEach((f) => {
    v[f.key] = f.type === 'checkbox' ? false : f.type === 'number' ? '' : ''
  })
  return v
}

export function CrudManager<T extends { id: string }>({
  title, addLabel, fields, columns, items, mapCard, canWrite,
  onCreate, onUpdate, onDelete, emptyHint,
}: CrudManagerProps<T>) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrador'
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>(() => emptyValues(fields))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const openCreate = () => {
    setEditing(null)
    setValues(emptyValues(fields))
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    const v: Record<string, unknown> = {}
    fields.forEach((f) => {
      v[f.key] = (item as Record<string, unknown>)[f.key] ?? (f.type === 'checkbox' ? false : '')
    })
    setValues(v)
    setErrors({})
    setModalOpen(true)
  }

  const setVal = (key: string, val: unknown) => setValues((s) => ({ ...s, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    fields.forEach((f) => {
      if (f.required && f.type !== 'checkbox') {
        const val = values[f.key]
        if (val === '' || val == null) e[f.key] = 'Este campo es obligatorio.'
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = () => {
    if (!validate()) return
    // convierte números
    const out: Record<string, unknown> = {}
    fields.forEach((f) => {
      const v = values[f.key]
      out[f.key] = f.type === 'number' ? Number(v) || 0 : v
    })
    if (editing) onUpdate(editing.id, out)
    else onCreate(out)
    setModalOpen(false)
  }

  const footer = useMemo(
    () => (
      <>
        <Button variant="secondary" onClick={() => setModalOpen(false)}>
          Cancelar
        </Button>
        <Button onClick={submit}>{editing ? 'Guardar cambios' : addLabel}</Button>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, values],
  )

  return (
    <Card
      title={title}
      actions={
        canWrite && (
          <Button size="sm" icon={<Plus size={18} />} onClick={openCreate}>
            {addLabel}
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState title="Sin registros" hint={emptyHint} />
      ) : isAdmin ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.key === 'placa' || c.key === 'documento' ? 'mono' : ''}>
                      {c.render ? c.render(it) : String((it as Record<string, unknown>)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CardList>
          {items.map((it) => {
            const m = mapCard(it)
            return (
              <CardRow
                key={it.id}
                title={m.title}
                subtitle={m.subtitle}
                plate={m.plate}
                tons={m.tons}
                status={m.status}
                extra={
                  canWrite && (
                    <div className="row" style={{ gap: 8 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Pencil size={16} />}
                        aria-label={`Editar ${typeof m.title === 'string' ? m.title : ''}`}
                        onClick={() => openEdit(it)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
                        aria-label="Eliminar"
                        onClick={() => {
                          if (confirm('¿Eliminar este registro?')) onDelete(it.id)
                        }}
                      />
                    </div>
                  )
                }
              />
            )
          })}
        </CardList>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Editar — ${title}` : addLabel}
        onClose={() => setModalOpen(false)}
        footer={footer}
      >
        <div className="grid grid--form">
          {fields.map((f) => {
            if (f.type === 'checkbox') {
              return (
                <Checkbox
                  key={f.key}
                  label={f.label}
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setVal(f.key, e.target.checked)}
                />
              )
            }
            if (f.type === 'select') {
              return (
                <Select
                  key={f.key}
                  label={f.label}
                  options={f.options ?? []}
                  placeholder={f.placeholder ?? 'Seleccione…'}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => setVal(f.key, e.target.value)}
                  error={errors[f.key]}
                  required={f.required}
                  helper={f.helper}
                />
              )
            }
            return (
              <Input
                key={f.key}
                label={f.label}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                mono={f.mono}
                step={f.step}
                placeholder={f.placeholder}
                value={String(values[f.key] ?? '')}
                onChange={(e) => setVal(f.key, e.target.value)}
                error={errors[f.key]}
                required={f.required}
                helper={f.helper}
              />
            )
          })}
        </div>
      </Modal>
    </Card>
  )
}
