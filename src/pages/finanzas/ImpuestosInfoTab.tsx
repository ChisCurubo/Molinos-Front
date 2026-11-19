// ── Pestaña informativa "Impuestos" — compartida entre Gastos (CxP) e
// Ingresos (CxC). Solo explica qué impuestos/retenciones aplican a cada lado
// del flujo de caja; los números reales y el ajuste manual viven en la
// página central /finanzas/impuestos-api (pestañas 4×1000 / ReteFuente / ReteIVA).
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui'

export function ImpuestosInfoTab({ modulo }: { modulo: 'gastos' | 'ingresos' }) {
  return (
    <>
      {modulo === 'ingresos' && (
        <div className="callout" style={{ marginBottom: '1.25rem', fontSize: 'var(--fs-sm)' }}>
          Ningún impuesto se cobra directamente sobre el dinero que <strong>entra</strong>. El 4×1000 solo lo cobra el banco
          cuando el dinero <strong>sale</strong> de una cuenta (ver Gastos), y ReteFuente/ReteIVA son retenciones que se le
          hacen a un tercero al pagarle — no aplican a lo que los clientes/deudores nos pagan a nosotros.
        </div>
      )}

      <Card title="4×1000 (GMF)">
        <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          {modulo === 'gastos'
            ? 'Se cobra automático cuando un pago (abono) se hace desde una cuenta bancaria no exenta — sin importar a quién se le paga. Efectivo y cuentas exentas no lo generan.'
            : 'No aplica a los ingresos/cobros. Solo se cobra en egresos (ver pestaña Gastos).'}
        </p>
        <Link to="/finanzas/impuestos-api" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--amber-700)' }}>
          Ver 4×1000 aplicado <ArrowRight size={14} />
        </Link>
      </Card>

      {modulo === 'gastos' && (
        <>
          <div style={{ height: '1rem' }} />
          <Card title="ReteFuente">
            <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              Se descuenta DEL pago al tercero, al crear la cuenta por pagar — hoy solo en <strong>Mulas</strong> (transporte
              de carga, 1%) y <strong>Alquiler</strong> (arrendamiento, 4%). Material/Minero, Flete, Agua y Combustible
              quedan fuera. Un proveedor marcado "Exento de retención" no la genera (ver Proveedores).
            </p>
            <Link to="/finanzas/impuestos-api" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--amber-700)' }}>
              Ver ReteFuente aplicada <ArrowRight size={14} />
            </Link>
          </Card>

          <div style={{ height: '1rem' }} />
          <Card title="ReteIVA">
            <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              Misma mecánica, 15%, solo en <strong>Alquiler</strong> (Mulas no lleva reteIVA).
              ⚠️ Activa en el sistema, pero sin confirmar con el contador si Molinos es agente de reteIVA.
            </p>
            <Link to="/finanzas/impuestos-api" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--amber-700)' }}>
              Ver ReteIVA aplicada <ArrowRight size={14} />
            </Link>
          </Card>
        </>
      )}
    </>
  )
}
