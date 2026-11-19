// ── Módulo Importaciones (Angela) — shell inicial ───────────────────────────
// Rol nuevo: ver src/auth/permissions.ts (ROLES.importaciones) y
// src/types/index.ts (Role). Todavía no hay backend para este módulo — estas
// 5 secciones son placeholders ("en construcción") que se van a ir llenando
// una por una, igual que se hizo con Materiales y Finanzas.
import type { LucideIcon } from 'lucide-react'
import { Anchor, Handshake, CircleDollarSign, Landmark, Ship } from 'lucide-react'
import { PageHeader } from '@/components/common/Page'

function WipPage({ title, subtitle, icon: Icon, hint }: { title: string; subtitle: string; icon: LucideIcon; hint: string }) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="empty" style={{ paddingTop: 48 }}>
        <Icon className="empty__icon" size={40} aria-hidden="true" />
        <strong>En construcción</strong>
        <span>{hint}</span>
      </div>
    </div>
  )
}

export function ImportacionesPage() {
  return (
    <WipPage
      title="Importaciones"
      subtitle="Seguimiento de pedidos e insumos importados."
      icon={Ship}
      hint="Acá va a quedar el registro de cada importación: proveedor, pedido, estado y documentos."
    />
  )
}

export function GastosPuertoPage() {
  return (
    <WipPage
      title="Gastos de puerto"
      subtitle="Almacenaje, demoras y demás costos de dejar la carga en puerto."
      icon={Anchor}
      hint="Acá va a quedar el registro de los gastos asociados a cada importación mientras está en puerto."
    />
  )
}

export function TransfiguraPage() {
  return (
    <WipPage
      title="Transfigura"
      subtitle="Pagos que recibimos de nuestro cliente Transfigura."
      icon={Handshake}
      hint="Acá va a quedar el registro de lo que nos paga Transfigura por cada despacho."
    />
  )
}

export function AdelantosImportacionesPage() {
  return (
    <WipPage
      title="Adelantos"
      subtitle="Anticipos entregados relacionados con importaciones."
      icon={CircleDollarSign}
      hint="Acá va a quedar el registro de adelantos y su cruce contra las cuentas que correspondan."
    />
  )
}

export function RegaliasPage() {
  return (
    <WipPage
      title="Regalías"
      subtitle="Regalías mineras liquidadas y pagadas a la ANM."
      icon={Landmark}
      hint="Acá va a quedar el registro por periodo: base de liquidación, tasa aplicada, valor y soporte de pago."
    />
  )
}
