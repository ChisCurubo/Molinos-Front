import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button, Card, Select, useToast } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { apiError } from '@/api/client'
import { descargarCosteoAnual } from '@/api/plantillasExcel'
import { ReporteViajePanel } from './ReporteViajePanel'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = [ANIO_ACTUAL + 1, ANIO_ACTUAL, ANIO_ACTUAL - 1, ANIO_ACTUAL - 2]
type Tab = 'reporte' | 'costeo'

function CosteoAnualPanel() {
  const toast = useToast()
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [viajes, setViajes] = useState<'despachados' | 'todos'>('despachados')
  const [estado, setEstado] = useState<string | null>(null)

  const descargar = async () => {
    setEstado('Generando…')
    try {
      await descargarCosteoAnual(anio, viajes)
      toast.success(`Costeo ${anio} descargado`)
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setEstado(null)
    }
  }

  return (
    <Card title="Resumen de materiales para costeo">
      <div className="row row--between" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: '0.75rem', alignItems: 'flex-start' }}>
          <FileSpreadsheet size={22} style={{ color: 'var(--emerald-700)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <strong>Costeo anual por mes y por minero</strong>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Identidad por minero · una pestaña por mes (viajes enviados) · resumen · inventario en planta
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
          <Select label="Año" value={String(anio)} options={ANIOS.map((a) => ({ value: String(a), label: String(a) }))}
            onChange={(e) => setAnio(Number(e.target.value))} disabled={!!estado} />
          <Select label="Viajes incluidos" value={viajes} onChange={(e) => setViajes(e.target.value as 'despachados' | 'todos')} disabled={!!estado}
            options={[{ value: 'despachados', label: 'Solo despachados' }, { value: 'todos', label: 'Despachados y almacenados' }]} />
          <Button icon={<Download size={16} />} onClick={descargar} disabled={!!estado}>{estado ?? 'Descargar'}</Button>
        </div>
      </div>
    </Card>
  )
}

export function PlantillasMaterialPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'costeo' ? 'costeo' : 'reporte'
  const cambiar = (t: Tab) => setParams(t === 'reporte' ? {} : { tab: t }, { replace: true })

  return (
    <div className="page">
      <PageHeader title="Plantillas de material" subtitle="Reportes y Excel estándar que se llenan solos con los datos del sistema"
        actions={
          <div className="segment" role="tablist" aria-label="Plantillas">
            {([['reporte', 'Reporte de viaje'], ['costeo', 'Costeo anual']] as const).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`segment__btn ${tab === t ? 'segment__btn--active' : ''}`} onClick={() => cambiar(t)}>{l}</button>
            ))}
          </div>
        } />
      {tab === 'reporte' ? <ReporteViajePanel /> : <CosteoAnualPanel />}
    </div>
  )
}
