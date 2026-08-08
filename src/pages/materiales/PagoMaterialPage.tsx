import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { PagosMaterialPanel } from './PagosMaterialPanel'

export function PagoMaterialPage() {
  const canWrite = useCanWrite('materiales')
  return (
    <div className="page">
      <PageHeader title="Pago de material" subtitle="Control de pagos a mineros por el material entregado." />
      {!canWrite && <ReadOnlyBanner />}
      <PagosMaterialPanel />
    </div>
  )
}
