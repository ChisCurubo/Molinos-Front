import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { CheckCircle2, ExternalLink, FileText, UploadCloud, X } from 'lucide-react'
import { validarComprobante, esImagenComprobante, COMPROBANTE_MAX_MB } from '@/utils/comprobante'
import { urlSegura } from '@/utils/safeUrl'

interface ComprobanteInputProps {
  label?: string
  /** Archivo recién elegido (aún no enviado); se manda junto con el resto del formulario. */
  value: File | null
  onChange: (file: File | null) => void
  /** URL ya guardada en el backend (al editar). Se muestra mientras no se elija un archivo nuevo. */
  existingUrl?: string | null
  required?: boolean
  helper?: string
  style?: CSSProperties
}

/**
 * Selector de comprobante (foto o PDF). Ya NO sube el archivo por su cuenta: solo lo guarda
 * para que el formulario lo mande junto con los demás campos (multipart, campo `comprobante`),
 * como lo exige cada endpoint de abono/pago del backend.
 */
export function ComprobanteInput({ label = 'Comprobante', value, onChange, existingUrl, required, helper, style }: ComprobanteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const elegir = (file: File | null | undefined) => {
    if (!file) return
    const msg = validarComprobante(file)
    if (msg) { setError(msg); return }
    setError('')
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
    onChange(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); elegir(e.dataTransfer.files?.[0]) }
  const abrir = () => inputRef.current?.click()
  const quitar = () => { setPreview(null); setError(''); onChange(null) }

  const nombreMostrado = value?.name ?? decodeURIComponent(existingUrl?.split('?')[0].split('/').pop() ?? '')
  const thumb = preview ?? (!value && existingUrl && esImagenComprobante(existingUrl) ? urlSegura(existingUrl) : null)
  const hayAlgo = !!value || !!existingUrl

  return (
    <div className="field" style={style}>
      <span className="field__label">
        {label}
        {required && <span style={{ color: 'var(--rose-600)' }}> *</span>}
      </span>

      {hayAlgo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1.5px solid var(--emerald-200)', background: 'var(--emerald-50)', borderRadius: 'var(--radius-sm)' }}>
          {thumb
            ? <img src={thumb} alt="Comprobante" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-default)' }} />
            : <FileText size={26} style={{ color: 'var(--emerald-700)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--emerald-800)' }}>
              <CheckCircle2 size={14} /> {value ? 'Listo para enviar' : 'Comprobante guardado'}
            </div>
            <div className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nombreMostrado}
            </div>
          </div>
          {!value && existingUrl && (
            <a href={urlSegura(existingUrl) ?? undefined} target="_blank" rel="noopener noreferrer" title="Abrir" style={{ display: 'flex', color: 'var(--text-muted)' }}><ExternalLink size={16} /></a>
          )}
          <button type="button" onClick={quitar} title="Quitar" aria-label="Quitar comprobante"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${drag ? 'dropzone--drag' : ''}`}
          role="button" tabIndex={0} aria-describedby={`${id}-hint`}
          onClick={abrir}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() } }}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <UploadCloud size={28} aria-hidden="true" />
          <span className="dropzone__title">Toque o arrastre el comprobante</span>
          <span className="dropzone__hint" id={`${id}-hint`}>PDF, PNG o JPG · máx. {COMPROBANTE_MAX_MB} MB</span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only"
            onChange={e => elegir(e.target.files?.[0])} />
        </div>
      )}

      {error && <span className="field__helper" role="alert" style={{ color: 'var(--rose-600)' }}>{error}</span>}
      {helper && !error && <span className="field__helper">{helper}</span>}
    </div>
  )
}
