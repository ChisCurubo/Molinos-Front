import { useId, useRef, useState, type DragEvent } from 'react'
import { CheckCircle2, UploadCloud } from 'lucide-react'

interface FileDropzoneProps {
  label?: string
  onFile?: (file: File | null) => void
  accept?: string
}

export function FileDropzone({
  label = 'Comprobante',
  onFile,
  accept = 'image/*,application/pdf',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const id = useId()

  const setFile = (file: File | null) => {
    setFileName(file?.name ?? null)
    onFile?.(file)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0] ?? null
    setFile(file)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div
        className={`dropzone ${drag ? 'dropzone--drag' : ''} ${fileName ? 'dropzone--filled' : ''}`}
        role="button"
        tabIndex={0}
        aria-describedby={`${id}-hint`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        {fileName ? (
          <CheckCircle2 size={30} aria-hidden="true" />
        ) : (
          <UploadCloud size={30} aria-hidden="true" />
        )}
        <span className="dropzone__title">
          {fileName ? `Archivo cargado: ${fileName}` : 'Toque para subir una foto del comprobante'}
        </span>
        <span className="dropzone__hint" id={`${id}-hint`}>
          Acepta fotos o PDF
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  )
}
