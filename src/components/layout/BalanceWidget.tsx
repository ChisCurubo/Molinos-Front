import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { canView } from '@/auth/permissions'
import { useBalanceTesoreria } from '@/hooks/useBalanceTesoreria'
import { useDeudaPrestamos } from '@/hooks/useDeudaPrestamos'
import { num } from '@/api/material'
import { formatCOP } from '@/utils/format'

const cop = formatCOP

const pillStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.9rem',
  padding: '0.35rem 0.85rem', borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-sunken)',
  textDecoration: 'none', fontSize: 'var(--fs-sm)', color: 'inherit',
}
const labelStyle: CSSProperties = { fontSize: '0.65rem', color: 'var(--text-faint)' }

// Balance mes/año de Tesorería + deuda de préstamos, visible solo para quien
// ya ve el módulo finanzas (Financiero y Administrador) — no para Materiales/Vicky.
// El balance SÍ incluye el desembolso de préstamos como ingreso real (así lo
// ve /pagos/vistas/flujo-caja) — por eso va aparte la Deuda: para no leer un
// balance alto como "plata del negocio" cuando en realidad es dinero prestado.
export function BalanceWidget() {
  const { user } = useAuth()
  const balance = useBalanceTesoreria()
  const deuda = useDeudaPrestamos()
  if (!user || !canView(user.role, 'finanzas')) return null

  const mes = balance.mesData ? num(balance.mesData.saldo_mes) : null
  const anio = balance.anioData ? num(balance.anioData.saldo_anio) : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <Link to="/finanzas/tesoreria-api" title="Ver flujo de caja completo" style={pillStyle}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={labelStyle}>Balance mes</span>
          <span className="mono" style={{ fontWeight: 700, color: mes == null ? 'var(--text-faint)' : mes >= 0 ? 'var(--emerald-700)' : 'var(--rose-600)' }}>
            {mes == null ? '…' : cop(mes)}
          </span>
        </span>
        <span style={{ width: 1, height: '1.6rem', background: 'var(--border-default)' }} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={labelStyle}>Balance año</span>
          <span className="mono" style={{ fontWeight: 700, color: anio == null ? 'var(--text-faint)' : anio >= 0 ? 'var(--emerald-700)' : 'var(--rose-600)' }}>
            {anio == null ? '…' : cop(anio)}
          </span>
        </span>
      </Link>

      <Link to="/finanzas/prestamos-api" title="Saldo pendiente de préstamos activos — no es plata del negocio" style={pillStyle}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={labelStyle}>Deuda (préstamos)</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--amber-700)' }}>
            {deuda.total == null ? '…' : cop(deuda.total)}
          </span>
        </span>
      </Link>
    </div>
  )
}
