import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowRight, ArrowUpCircle, BarChart3, Landmark, LayoutList, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import '../dashboard/dashboard.css'
import { EstadoBadge, KpiTile } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { CrudManager, type ColumnDef } from '@/components/common/CrudManager'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, calc4x1000inv } from '@/utils/format'
import { aguaMock, viajesMock, empleados as empMock, calc4x1000, calc4x1000Inverso } from '@/data/mock'
import { Card, Input } from '@/components/ui'
import type { CuentaPorCobrar, CuentaPorPagar } from '@/types'

type Tab = 'pagar' | 'cobrar' | 'movimientos' | 'calculadora'

const estadoOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado',  label: 'Aprobado'  },
  { value: 'revision',  label: 'En revisión' },
  { value: 'rechazado', label: 'Rechazado'  },
]
const tipoOptions = [
  { value: 'gasto',     label: 'Gasto general' },
  { value: 'proveedor', label: 'Proveedor'      },
  { value: 'alquiler',  label: 'Alquiler'       },
  { value: 'flete',     label: 'Flete'          },
  { value: 'material',  label: 'Material'       },
]

// ── Tabla referencia 4×1000 ──────────────────────────────
const TABLA_REF = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000].map((m) => calc4x1000(m))

// ── Tipos movimiento ─────────────────────────────────────
type CategoriaMov = 'agua' | 'maquila' | 'nomina'
interface Movimiento { id: string; fecha: string; categoria: CategoriaMov; descripcion: string; monto: number }

const BADGE_MOV: Record<CategoriaMov, string> = { agua: 'badge--info', maquila: 'badge--success', nomina: 'badge--warning' }
const LABEL_MOV: Record<CategoriaMov, string> = { agua: 'Agua', maquila: 'Maquila', nomina: 'Nómina' }

function useMovimientos(): Movimiento[] {
  return useMemo(() => {
    const agua: Movimiento[] = aguaMock.map((a) => ({
      id: `agua-${a.id}`, fecha: a.fecha, categoria: 'agua',
      descripcion: `Agua — ${a.conductor} (${a.cantidad_viajes} viajes)`,
      monto: a.valor_total,
    }))
    const maquila: Movimiento[] = viajesMock.map((v) => ({
      id: `maquila-${v.id}`, fecha: v.fecha, categoria: 'maquila',
      descripcion: `Maquila viaje ${v.numero_viaje}`,
      monto: v.maquila,
    }))
    const nomina: Movimiento[] = empMock.map((e) => ({
      id: `nomina-${e.id}`, fecha: '2026-07-15', categoria: 'nomina',
      descripcion: `Nómina — ${e.nombre} (${e.labor})`,
      monto: e.salario_quincenal,
    }))
    return [...agua, ...maquila, ...nomina].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [])
}

// ── Sub-tab: Vista general ───────────────────────────────
function MovimientosTab() {
  const movimientos = useMovimientos()
  const [filtro, setFiltro] = useState<CategoriaMov | 'todos'>('todos')

  const filtrados    = filtro === 'todos' ? movimientos : movimientos.filter((m) => m.categoria === filtro)
  const totalFiltrado = filtrados.reduce((s, m) => s + m.monto, 0)
  const totalAgua    = movimientos.filter((m) => m.categoria === 'agua').reduce((s, m) => s + m.monto, 0)
  const totalMaquila = movimientos.filter((m) => m.categoria === 'maquila').reduce((s, m) => s + m.monto, 0)
  const totalNomina  = movimientos.filter((m) => m.categoria === 'nomina').reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total agua"    value={formatCOP(totalAgua)}    accent="emerald" icon={<LayoutList size={16} />} />
        <KpiTile label="Total maquila" value={formatCOP(totalMaquila)} accent="green"   icon={<LayoutList size={16} />} />
        <KpiTile label="Total nómina"  value={formatCOP(totalNomina)}  accent="amber"   icon={<LayoutList size={16} />} />
        <KpiTile label="Total general" value={formatCOP(totalAgua + totalMaquila + totalNomina)} accent="brown" icon={<Wallet size={16} />} />
      </div>

      <Card title={`Movimientos (${filtrados.length})`}>
        <div className="segment" style={{ marginBottom: '1rem' }}>
          {(['todos', 'agua', 'maquila', 'nomina'] as const).map((c) => (
            <button key={c} className={`segment__btn ${filtro === c ? 'segment__btn--active' : ''}`} onClick={() => setFiltro(c)}>
              {c === 'todos' ? 'Todos' : LABEL_MOV[c]}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.fecha)}</td>
                  <td><span className={`badge ${BADGE_MOV[m.categoria]}`}>{LABEL_MOV[m.categoria]}</span></td>
                  <td style={{ fontSize: 'var(--fs-sm)' }}>{m.descripcion}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatCOP(m.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{formatCOP(totalFiltrado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

// ── Sub-tab: Calculadora 4×1000 ──────────────────────────
function CalculadoraTab() {
  const [modo, setModo]   = useState<'normal' | 'inverso'>('normal')
  const [monto, setMonto] = useState('')

  const resultado = useMemo(() => {
    const n = Number(monto)
    if (!n || n <= 0) return null
    return modo === 'normal' ? calc4x1000(n) : calc4x1000Inverso(n)
  }, [monto, modo])

  return (
    <>
      <Card title="Calculadora 4×1000 (GMF — Gravamen a los Movimientos Financieros)">
        <div className="segment" style={{ marginBottom: '1.25rem' }}>
          <button className={`segment__btn ${modo === 'normal'  ? 'segment__btn--active' : ''}`} onClick={() => { setModo('normal');  setMonto('') }}>
            Normal (monto → neto)
          </button>
          <button className={`segment__btn ${modo === 'inverso' ? 'segment__btn--active' : ''}`} onClick={() => { setModo('inverso'); setMonto('') }}>
            Inverso (neto → bruto)
          </button>
        </div>

        <div className="grid grid--form" style={{ maxWidth: '24rem' }}>
          <Input
            label={modo === 'normal' ? 'Monto bruto a retirar / pagar' : 'Monto neto que quieres recibir'}
            type="number" placeholder="1000000"
            value={monto} onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        {resultado && (
          <div className="grid grid--kpi" style={{ marginTop: '1rem' }}>
            {'monto' in resultado ? (
              <>
                <KpiTile label="Monto bruto"     value={formatCOP(resultado.monto)}    accent="brown"   />
                <KpiTile label="Impuesto 4×1000" value={formatCOP(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Neto recibido"   value={formatCOP(resultado.neto)}     accent="emerald" />
              </>
            ) : (
              <>
                <KpiTile label="Neto deseado"    value={formatCOP(resultado.neto)}     accent="emerald" />
                <KpiTile label="Impuesto 4×1000" value={formatCOP(resultado.impuesto)} accent="rose"    />
                <KpiTile label="Bruto a retirar" value={formatCOP(resultado.bruto)}    accent="brown"   />
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="Tabla de referencia">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>Monto bruto</th>
                <th style={{ textAlign: 'right' }}>Impuesto</th>
                <th style={{ textAlign: 'right' }}>Neto</th>
                <th style={{ textAlign: 'right' }}>Bruto necesario (inverso)</th>
              </tr>
            </thead>
            <tbody>
              {TABLA_REF.map((r) => {
                const inv = calc4x1000inv(r.neto)
                return (
                  <tr key={r.monto}>
                    <td style={{ textAlign: 'right' }} className="mono">{formatCOP(r.monto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--rose-600)' }} className="mono">{formatCOP(r.impuesto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--emerald-700)', fontWeight: 700 }} className="mono">{formatCOP(r.neto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{formatCOP(inv.bruto)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
          Tarifa: 4 pesos por cada $1.000 (0.4%). Normal: neto = monto × 0.996. Inverso: bruto = neto / 0.996.
        </p>
      </Card>
    </>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export function FinanzasPage() {
  const canWrite = useCanWrite('finanzas')
  const navigate = useNavigate()
  const { porPagar, porCobrar, prestamos, add, update, remove } = useData()
  const [tab, setTab] = useState<Tab>('pagar')

  const totalPagar    = porPagar.filter((p) => p.estado !== 'rechazado').reduce((s, p) => s + p.monto, 0)
  const totalCobrar   = porCobrar.filter((c) => c.estado !== 'rechazado').reduce((s, c) => s + c.monto, 0)
  const saldoPrestamos = prestamos.reduce((s, p) => s + p.saldo, 0)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pagar',        label: 'Por pagar'      },
    { key: 'cobrar',       label: 'Por cobrar'     },
    { key: 'movimientos',  label: 'Vista general'  },
    { key: 'calculadora',  label: 'Calculadora 4×1000' },
  ]

  const pagarCols: ColumnDef<CuentaPorPagar>[] = [
    { key: 'concepto',         label: 'Concepto'     },
    { key: 'beneficiario',     label: 'Beneficiario' },
    { key: 'tipo',             label: 'Tipo'         },
    { key: 'monto',            label: 'Monto',         render: (p) => formatCOP(p.monto)              },
    { key: 'fechaVencimiento', label: 'Vence',         render: (p) => formatDate(p.fechaVencimiento)  },
    { key: 'estado',           label: 'Estado',        render: (p) => <EstadoBadge estado={p.estado} /> },
  ]
  const cobrarCols: ColumnDef<CuentaPorCobrar>[] = [
    { key: 'concepto',         label: 'Concepto' },
    { key: 'cliente',          label: 'Cliente'  },
    { key: 'monto',            label: 'Monto',   render: (c) => formatCOP(c.monto)              },
    { key: 'fechaVencimiento', label: 'Vence',   render: (c) => formatDate(c.fechaVencimiento)  },
    { key: 'estado',           label: 'Estado',  render: (c) => <EstadoBadge estado={c.estado} /> },
  ]

  return (
    <div className="page">
      <PageHeader title="Pagos y finanzas" subtitle="Cuentas, movimientos y herramientas financieras." />
      {!canWrite && <ReadOnlyBanner />}

      {/* Quick-nav sub-páginas del módulo */}
      <div className="dash-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))', marginBottom: '1.5rem' }}>
        {[
          { to: '/finanzas/prestamos', title: 'Préstamos financieros', icon: Landmark,  variant: 'brown' },
          { to: '/finanzas/informes',  title: 'Informes de finanzas',  icon: BarChart3, variant: 'info'  },
        ].map(c => {
          const Icon = c.icon
          return (
            <button key={c.to} className="dash-card" style={{ minHeight: '7rem' }}
              onClick={() => navigate(c.to)} aria-label={`Ir a ${c.title}`}>
              <span className={`dash-card__icon dash-card__icon--${c.variant}`}><Icon size={22}/></span>
              <span className="dash-card__title" style={{ fontSize: 'var(--fs-base)' }}>{c.title}</span>
              <span className="dash-card__cta">Abrir <ArrowRight size={14}/></span>
            </button>
          )
        })}
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
        <KpiTile label="Total por pagar"   value={formatCOP(totalPagar)}    icon={<ArrowUpCircle size={16} />}   accent="rose"    />
        <KpiTile label="Total por cobrar"  value={formatCOP(totalCobrar)}   icon={<ArrowDownCircle size={16} />} accent="emerald" />
        <KpiTile label="Saldo préstamos"   value={formatCOP(saldoPrestamos)} icon={<Landmark size={16} />}       accent="brown"   />
        <KpiTile label="Pagos automáticos" value={porPagar.filter((p) => p.origen === 'automatico').length} icon={<Wallet size={16} />} accent="green" />
      </div>

      <div className="segment" role="tablist" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`segment__btn ${tab === t.key ? 'segment__btn--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagar' && (
        <CrudManager<CuentaPorPagar>
          title="Cuentas por pagar" addLabel="Nueva cuenta" canWrite={canWrite}
          items={porPagar} columns={pagarCols}
          fields={[
            { key: 'concepto',         label: 'Concepto',           type: 'text',   required: true },
            { key: 'beneficiario',     label: 'Beneficiario',       type: 'text',   required: true },
            { key: 'tipo',             label: 'Tipo',               type: 'select', options: tipoOptions, required: true },
            { key: 'monto',            label: 'Monto',              type: 'number', required: true },
            { key: 'fechaVencimiento', label: 'Fecha vencimiento',  type: 'date',   required: true },
            { key: 'estado',           label: 'Estado',             type: 'select', options: estadoOptions, required: true },
          ]}
          mapCard={(p) => ({ title: p.concepto, subtitle: `${p.beneficiario} · Vence ${formatDate(p.fechaVencimiento)}`, tons: formatCOP(p.monto), status: <EstadoBadge estado={p.estado} /> })}
          onCreate={(vals) => add('porPagar', { id: `p${Date.now()}`, origen: 'manual', ...(vals as object) } as CuentaPorPagar)}
          onUpdate={(id, vals) => update('porPagar', id, vals as Partial<CuentaPorPagar>)}
          onDelete={(id) => remove('porPagar', id)}
        />
      )}

      {tab === 'cobrar' && (
        <CrudManager<CuentaPorCobrar>
          title="Cuentas por cobrar" addLabel="Nueva cuenta" canWrite={canWrite}
          items={porCobrar} columns={cobrarCols}
          fields={[
            { key: 'concepto',         label: 'Concepto',          type: 'text',   required: true },
            { key: 'cliente',          label: 'Cliente',           type: 'text',   required: true },
            { key: 'monto',            label: 'Monto',             type: 'number', required: true },
            { key: 'fechaVencimiento', label: 'Fecha vencimiento', type: 'date',   required: true },
            { key: 'estado',           label: 'Estado',            type: 'select', options: estadoOptions, required: true },
          ]}
          mapCard={(c) => ({ title: c.concepto, subtitle: `${c.cliente} · Vence ${formatDate(c.fechaVencimiento)}`, tons: formatCOP(c.monto), status: <EstadoBadge estado={c.estado} /> })}
          onCreate={(vals) => add('porCobrar', { id: `c${Date.now()}`, ...(vals as object) } as CuentaPorCobrar)}
          onUpdate={(id, vals) => update('porCobrar', id, vals as Partial<CuentaPorCobrar>)}
          onDelete={(id) => remove('porCobrar', id)}
        />
      )}

      {tab === 'movimientos' && <MovimientosTab />}
      {tab === 'calculadora' && <CalculadoraTab />}
    </div>
  )
}
