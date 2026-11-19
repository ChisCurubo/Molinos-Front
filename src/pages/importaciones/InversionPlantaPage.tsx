// Misma data que la pestaña "Inversión Planta" de Finanzas (Juliana) — el
// rol `importaciones` (Angela) ya tiene permiso de escritura sobre
// `finanzas` (ver src/auth/permissions.ts), así que comparten la categoría.
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { InversionPlantaTab } from '@/pages/finanzas/InversionPlantaTab'

export function InversionPlantaPage() {
  const canWrite = useCanWrite('finanzas')
  return (
    <div className="page">
      <PageHeader title="Inversión Planta" subtitle="Compras que amplían o mejoran la planta a futuro: maquinaria, obras, mejoras." />
      <InversionPlantaTab canWrite={canWrite} />
    </div>
  )
}
