import { useState } from 'react'
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react'
import { Button, Card, InfoCallout, Input } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { abrirUrl, urlSegura } from '@/utils/safeUrl'

// Solo se incrustan informes publicados en Power BI (evita cargar sitios arbitrarios en el iframe).
const esPowerBI = (u: string) => { const s = urlSegura(u); return !!s && new URL(s).protocol === 'https:' && new URL(s).hostname === 'app.powerbi.com' }

// URL de ejemplo. Reemplace por el enlace "Publicar en la web" de su informe de Power BI.
const DEFAULT_URL = ''

export function InformesPage() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [applied, setApplied] = useState(DEFAULT_URL)
  const [err, setErr] = useState('')

  return (
    <div className="page">
      <PageHeader
        title="Informes Power BI"
        subtitle="Visualice el tablero gerencial embebido directamente en el sistema."
        actions={
          applied && (
            <Button variant="secondary" icon={<ExternalLink size={18} />} onClick={() => abrirUrl(applied)}>
              Abrir en pestaña nueva
            </Button>
          )
        }
      />

      <Card flush>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input
              label="Enlace del informe (embed)"
              placeholder="https://app.powerbi.com/view?r=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              error={err || undefined}
              helper="Pegue aquí el enlace de inserción de su informe de Power BI."
            />
          </div>
          <Button icon={<RefreshCw size={18} />} onClick={() => { if (!url || esPowerBI(url)) { setErr(''); setApplied(url) } else setErr('Solo se aceptan enlaces https://app.powerbi.com/…') }}>
            Cargar informe
          </Button>
        </div>
      </Card>

      <div style={{ height: 18 }} />

      {applied ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <iframe
            title="Informe de Power BI"
            src={applied}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      ) : (
        <Card>
          <div className="empty">
            <BarChart3 size={48} className="empty__icon" aria-hidden="true" />
            <strong>Aún no hay un informe cargado</strong>
            <span>Pegue el enlace de inserción de Power BI y presione «Cargar informe».</span>
          </div>
        </Card>
      )}

      <div style={{ height: 18 }} />
      <InfoCallout>
        Para obtener el enlace, en Power BI use <strong>Archivo → Insertar informe → Publicar en la web</strong> y copie
        la dirección del iframe.
      </InfoCallout>
    </div>
  )
}
