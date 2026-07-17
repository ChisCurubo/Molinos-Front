import { useState } from 'react'
import { Landmark, Percent, Wallet } from 'lucide-react'
import { Badge, Button, Card, EstadoBadge, InfoCallout, KpiTile, CardList, CardRow, Modal } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { tablaAmortizacion } from '@/utils/amortizacion'
import { formatCOP } from '@/utils/format'
import type { Prestamo } from '@/types'

export function PrestamosFinancierosPage() {
  const canWrite = useCanWrite('finanzas')
  const { prestamos } = useData()
  const [detalle, setDetalle] = useState<Prestamo | null>(null)

  const totalCapital = prestamos.reduce((s, p) => s + p.capital, 0)
  const totalSaldo = prestamos.reduce((s, p) => s + p.saldo, 0)
  const totalCuota = prestamos.reduce((s, p) => s + p.cuotaMensual, 0)

  return (
    <div className="page">
      <PageHeader
        title="Préstamos financieros"
        subtitle="Créditos bancarios de la empresa. Toque un préstamo para ver su tabla de amortización."
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Capital total" value={formatCOP(totalCapital)} icon={<Landmark size={16} />} accent="brown" />
        <KpiTile label="Saldo pendiente" value={formatCOP(totalSaldo)} icon={<Wallet size={16} />} accent="rose" />
        <KpiTile label="Cuota mensual total" value={formatCOP(totalCuota)} icon={<Percent size={16} />} accent="emerald" />
      </div>

      <InfoCallout accent>
        Estos son préstamos <strong>bancarios de la empresa</strong>. Los préstamos a empleados se gestionan en el
        módulo de Nómina.
      </InfoCallout>

      <Card title="Préstamos vigentes">
        <CardList>
          {prestamos.map((p) => (
            <CardRow
              key={p.id}
              title={p.entidad}
              subtitle={`Capital ${formatCOP(p.capital)} · Tasa ${p.interesPct}% mensual · Plazo ${p.plazoMeses} meses`}
              tons={formatCOP(p.saldo)}
              status={<EstadoBadge estado={p.estado} />}
              extra={
                <Button size="sm" variant="secondary" onClick={() => setDetalle(p)}>
                  Ver amortización
                </Button>
              }
            />
          ))}
        </CardList>
      </Card>

      <Modal
        open={!!detalle}
        title={detalle ? `Amortización — ${detalle.entidad}` : ''}
        onClose={() => setDetalle(null)}
        footer={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <>
            <div className="row" style={{ gap: '0.5rem' }}>
              <Badge tone="neutral">Capital {formatCOP(detalle.capital)}</Badge>
              <Badge tone="neutral">Tasa {detalle.interesPct}% mensual</Badge>
              <Badge tone="neutral">Cuota {formatCOP(detalle.cuotaMensual)}</Badge>
            </div>
            <div className="table-wrap" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Cuota</th>
                    <th>Interés</th>
                    <th>Abono capital</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaAmortizacion(detalle.capital, detalle.interesPct, detalle.plazoMeses).map((f) => (
                    <tr key={f.mes}>
                      <td className="mono">{f.mes}</td>
                      <td className="mono">{formatCOP(f.cuota)}</td>
                      <td className="mono">{formatCOP(f.interes)}</td>
                      <td className="mono">{formatCOP(f.abonoCapital)}</td>
                      <td className="mono">{formatCOP(f.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
