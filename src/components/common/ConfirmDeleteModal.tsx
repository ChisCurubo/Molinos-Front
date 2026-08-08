import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from '@/components/ui'

interface ConfirmDeleteModalProps {
  open: boolean
  /** Título del modal. */
  title?: string
  /** Qué se va a borrar, ej: "la entrada N° 12". Se muestra en el mensaje. */
  itemLabel?: string
  /** Mensaje adicional/advertencia bajo el título. */
  message?: ReactNode
  /** Palabra que el usuario debe escribir. Por defecto "borrar". */
  confirmWord?: string
  /** Texto del botón de confirmación. */
  confirmLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

// Confirmación de borrado con tu diseño (no la del navegador):
// exige escribir la palabra "borrar" para habilitar el botón.
export function ConfirmDeleteModal({
  open, title = 'Borrar registro', itemLabel, message,
  confirmWord = 'borrar', confirmLabel = 'Borrar definitivamente',
  loading = false, onCancel, onConfirm,
}: ConfirmDeleteModalProps) {
  const [texto, setTexto] = useState('')
  useEffect(() => { if (open) setTexto('') }, [open])

  const ok = texto.trim().toLowerCase() === confirmWord.toLowerCase()

  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!ok || loading}>
            {loading ? 'Borrando…' : confirmLabel}
          </Button>
        </>
      }>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: 'var(--rose-100, #ffe4e6)', color: 'var(--rose-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={20} />
        </span>
        <div style={{ fontSize: 'var(--fs-sm)' }}>
          <strong>Esta acción no se puede deshacer.</strong>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            {message ?? <>Vas a borrar {itemLabel ? <strong>{itemLabel}</strong> : 'este registro'} de forma permanente.</>}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field__label">
          Escribe <code style={{ color: 'var(--rose-600)' }}>{confirmWord}</code> para confirmar
        </label>
        <div className="field__control">
          <input
            className="field__input"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={confirmWord}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && ok && !loading) onConfirm() }}
          />
        </div>
      </div>
    </Modal>
  )
}
