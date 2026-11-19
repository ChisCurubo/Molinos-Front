import { Download, FileSpreadsheet } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { descargarPlantillaMaterial } from '@/utils/plantillasMaterial'

interface Plantilla {
  nombre: string
  descripcion: string
  descargar: () => void
}

const PLANTILLAS: Plantilla[] = [
  {
    nombre: 'Material — viaje / cuenta de minero',
    descripcion:
      'Tabla por volqueta (peso, humedad, tenor, gramos, precio) + totales, abonos y saldo pendiente. Duplica la pestaña "Detalle por volqueta" por cada viaje, minero o mes nuevo.',
    descargar: descargarPlantillaMaterial,
  },
]

export function PlantillasMaterialPage() {
  return (
    <>
      <PageHeader title="Plantillas de material" subtitle="Archivos Excel en blanco para llenar a mano" />
      <Card title="Plantillas disponibles">
        <div className="grid" style={{ gap: '0.75rem' }}>
          {PLANTILLAS.map((p) => (
            <div
              key={p.nombre}
              className="row row--between"
              style={{ alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius, 10px)' }}
            >
              <div className="row" style={{ gap: '0.75rem', alignItems: 'flex-start' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--emerald-700)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>{p.nombre}</strong>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{p.descripcion}</p>
                </div>
              </div>
              <Button size="sm" icon={<Download size={14} />} onClick={p.descargar} style={{ flexShrink: 0 }}>
                Descargar
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
