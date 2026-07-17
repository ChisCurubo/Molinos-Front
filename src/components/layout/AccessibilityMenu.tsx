import { useEffect, useRef, useState } from 'react'
import { Accessibility, Contrast, Type, Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { FONT_STEPS, useA11y } from '@/context/AccessibilityContext'

export function AccessibilityMenu() {
  const [open, setOpen] = useState(false)
  const { fontStep, setFontStep, highContrast, toggleContrast, reduceMotion, toggleReduceMotion } = useA11y()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="a11y-wrap" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        icon={<Accessibility size={20} />}
        aria-label="Opciones de accesibilidad"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Accesibilidad
      </Button>

      {open && (
        <div className="a11y-panel" role="dialog" aria-label="Opciones de accesibilidad">
          <span className="a11y-panel__title">Accesibilidad</span>

          <div>
            <div className="a11y-group__label">
              <Type size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Tamaño de letra
            </div>
            <div className="segment" role="group" aria-label="Tamaño de letra">
              {FONT_STEPS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`segment__btn ${fontStep === f.key ? 'segment__btn--active' : ''}`}
                  aria-pressed={fontStep === f.key}
                  onClick={() => setFontStep(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant={highContrast ? 'primary' : 'secondary'}
            block
            icon={<Contrast size={18} />}
            aria-pressed={highContrast}
            onClick={toggleContrast}
          >
            {highContrast ? 'Alto contraste activado' : 'Activar alto contraste'}
          </Button>

          <Button
            variant={reduceMotion ? 'primary' : 'secondary'}
            block
            icon={<Zap size={18} />}
            aria-pressed={reduceMotion}
            onClick={toggleReduceMotion}
          >
            {reduceMotion ? 'Animaciones reducidas' : 'Reducir animaciones'}
          </Button>
        </div>
      )}
    </div>
  )
}
