import { useState } from 'react'
import { Database, Download, Copy, CheckCircle2, FileJson, BarChart2 } from 'lucide-react'
import { Button, Card, InfoCallout, Badge, useToast } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'

// Datos simulados para los endpoints
const DATASETS = [
  {
    id: 'inventario',
    name: 'Inventario y Materiales',
    description: 'Existencias actuales, entradas de material de mina y movimientos de procesamiento.',
    records: 12450,
    lastUpdate: 'Hace 5 minutos',
    endpoint: 'https://api.molinos.com/v1/export/inventario',
    status: 'active'
  },
  {
    id: 'finanzas',
    name: 'Movimientos Financieros',
    description: 'Flujo de caja, préstamos a conductores y cuentas por cobrar/pagar.',
    records: 8320,
    lastUpdate: 'Hace 1 hora',
    endpoint: 'https://api.molinos.com/v1/export/finanzas',
    status: 'active'
  },
  {
    id: 'nomina',
    name: 'Nómina y Turnos',
    description: 'Registro de turnos de empleados, horas extras y liquidaciones.',
    records: 3105,
    lastUpdate: 'Hace 12 horas',
    endpoint: 'https://api.molinos.com/v1/export/nomina',
    status: 'active'
  }
]

export function GeneradorPowerBIPage() {
  const { success, info } = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleCopyEndpoint = (id: string, endpoint: string) => {
    navigator.clipboard.writeText(endpoint)
    setCopiedId(id)
    success('URL copiada al portapapeles')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownloadCSV = (id: string) => {
    setDownloadingId(id)
    info('Preparando exportación CSV...')
    
    // Simular tiempo de descarga
    setTimeout(() => {
      setDownloadingId(null)
      success('El archivo CSV se ha descargado exitosamente.')
    }, 1500)
  }

  return (
    <div className="page" style={{ animation: 'fade-in 0.3s ease-out' }}>
      <PageHeader
        title="Orígenes de Datos para Power BI"
        subtitle="Gestione y exporte la información de la base de datos para alimentar sus tableros."
        actions={
          <Button variant="secondary" icon={<BarChart2 size={18} />} onClick={() => window.open('/informes', '_self')}>
            Ver Tableros
          </Button>
        }
      />

      <InfoCallout>
        Utilice las siguientes credenciales y endpoints para conectar Power BI Desktop directamente a la base de datos mediante la opción <strong>Obtener Datos &gt; Web (API REST)</strong>.
      </InfoCallout>

      <div style={{ height: 24 }} />

      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {DATASETS.map((dataset) => (
          <div key={dataset.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Card flush>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  background: 'var(--brand-surface)', 
                  color: 'var(--brand-primary)',
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex'
                }}>
                  <Database size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{dataset.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Badge tone={dataset.status === 'active' ? 'success' : 'neutral'}>
                      {dataset.status === 'active' ? 'En línea' : 'Mantenimiento'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, flex: 1, margin: '0 0 20px 0' }}>
              {dataset.description}
            </p>

            <div style={{ background: 'var(--bg-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Registros aproximados:</span>
                <span style={{ fontWeight: 500 }}>{dataset.records.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Última actualización:</span>
                <span style={{ fontWeight: 500 }}>{dataset.lastUpdate}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
              <Button 
                variant="secondary" 
                style={{ flex: 1 }}
                icon={copiedId === dataset.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                onClick={() => handleCopyEndpoint(dataset.id, dataset.endpoint)}
              >
                {copiedId === dataset.id ? 'Copiado' : 'Copiar URL'}
              </Button>
              <Button 
                variant="primary"
                style={{ flex: 1 }}
                icon={<Download size={16} />}
                onClick={() => handleDownloadCSV(dataset.id)}
                disabled={downloadingId === dataset.id}
              >
                {downloadingId === dataset.id ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </div>
            </div>
          </Card>
          </div>
        ))}
      </div>
      
      <div style={{ height: 32 }} />
      
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            <FileJson size={28} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>Autenticación de API</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Para conectar desde Power BI, utilice autenticación de tipo <strong>Bearer Token</strong>. El token de acceso puede ser generado desde su perfil de usuario o solicitarlo al equipo de soporte de TI. Asegúrese de mantener este token seguro y no compartirlo públicamente.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
