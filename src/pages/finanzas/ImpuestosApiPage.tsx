import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { Card, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate } from '@/utils/format'
import { calc4x1000 } from '@/data/mock'
import { pagosCxpApi, type LibroGastoItem } from '@/api/pagosCxp'
import { pagosGastosDirectosApi } from '@/api/pagosGastosDirectos'

const CATEGORIA_GASTO_DIRECTO = 'Gasto Directo'

const cop = formatCOP
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Próximos impuestos/retenciones a agregar aquí (ReteFuente, ReteICA, ReteIVA,
// IVA…) cuando el negocio confirme que aplican — ver docs/plan_finanzas_2026-10-17.md §2.
type ImpuestoTab = '4x1000'
const TABS: { value: ImpuestoTab; label: string }[] = [
  { value: '4x1000', label: '4×1000' },
]

export function ImpuestosApiPage() {
  const [tab, setTab] = useState<ImpuestoTab>('4x1000')
  return (
    <div className="page">
      <PageHeader title="Impuestos" subtitle="Impuestos y retenciones sobre el dinero que mueve la empresa." />

      <div className="segment" role="tablist" style={{ marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.value} role="tab" aria-selected={tab === t.value}
            className={`segment__btn ${tab === t.value ? 'segment__btn--active' : ''}`} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === '4x1000' && <Cuatro1000Tab />}
    </div>
  )
}

// ── 4×1000 (GMF) ─────────────────────────────────────────────────
// Sin endpoint en el backend todavía (confirmado — no hay tabla ni ruta de
// impuestos/retenciones). Se calcula tomando cada gasto real del mes (el
// mismo Libro de Gastos de /finanzas/cxp-api, vía /pagos/vistas/libro-gastos)
// y multiplicando cada uno por 0.004 — no es un solo número agregado, es
// gasto por gasto, igual que hacía la tabla de Pagos y finanzas (mock).
// Los gastos en efectivo se excluyen: el 4×1000 solo lo cobra el banco en
// movimientos que salen de una cuenta (transferencia/nequi/consignación/otro).
function Cuatro1000Tab() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const esMesActual = mes === now.getMonth() + 1 && anio === now.getFullYear()
  const shiftMonth = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1); setAnio(d.getFullYear())
  }

  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`

  const [dataCruda, setDataCruda] = useState<LibroGastoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoading(true); setError(null)
    pagosCxpApi.getLibroGastos(mes, anio)
      .then(r => setDataCruda(Array.isArray(r) ? r : []))
      .catch(e => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [mes, anio])
  useEffect(() => { load() }, [load])

  // ⚠️ Mismo bug de backend que Libro de Gastos: /pagos/vistas/libro-gastos no
  // excluye un Gasto Directo anulado. Se filtra acá cruzando contra el listado
  // real de /pagos/gastos-directos (ver nota completa en CxPApiPage.tsx).
  const [idsActivos, setIdsActivos] = useState<Set<number> | null>(null)
  useEffect(() => {
    pagosGastosDirectosApi.listar({ desde, hasta })
      .then(r => setIdsActivos(new Set((Array.isArray(r) ? r : []).map(gd => gd.id_abono))))
      .catch(() => setIdsActivos(new Set()))
  }, [desde, hasta])
  const data = useMemo(() => {
    if (!idsActivos) return dataCruda
    return dataCruda.filter(g => g.categoria !== CATEGORIA_GASTO_DIRECTO || idsActivos.has(g.id))
  }, [dataCruda, idsActivos])

  const esGravable = (g: LibroGastoItem) => (g.metodo_pago ?? '').toLowerCase() !== 'efectivo'
  const totalGastos = useMemo(() => data.reduce((s, g) => s + num(g.monto), 0), [data])
  const totalGravable = useMemo(() => data.filter(esGravable).reduce((s, g) => s + num(g.monto), 0), [data])
  const totalImpuesto = calc4x1000(totalGravable).impuesto

  return (
    <>
      <div className="callout" style={{ marginBottom: '1.25rem', fontSize: 'var(--fs-sm)' }}>
        El 4×1000 (Gravamen a los Movimientos Financieros) lo retiene el banco automático en cada movimiento que sale de una cuenta: por cada
        $1.000, se van $4. Los gastos pagados en efectivo no lo generan — se excluyen de los totales de abajo.
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button type="button" onClick={() => shiftMonth(-1)} title="Mes anterior"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 700, minWidth: '11rem', textAlign: 'center' }}>{MESES[mes - 1]} {anio}{esMesActual && <span className="badge badge--warning" style={{ marginLeft: '0.5rem' }}>Actual</span>}</span>
        <button type="button" onClick={() => shiftMonth(1)} disabled={esMesActual} title="Mes siguiente"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: esMesActual ? 'not-allowed' : 'pointer', color: esMesActual ? 'var(--text-faint)' : 'var(--text)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Gastos del mes" value={loading ? '…' : cop(totalGastos)} accent="brown" />
        <KpiTile label="Monto gravable" value={loading ? '…' : cop(totalGravable)} accent="rose"
          hint="Solo gastos pagados por transferencia/Nequi/consignación/otro — excluye efectivo." />
        <KpiTile label="4×1000 del mes" value={loading ? '…' : cop(totalImpuesto)} icon={<Receipt size={16} />} accent="amber" />
      </div>

      <Card title={`Gastos de ${MESES[mes - 1]} ${anio} (${data.length})`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Fecha</th><th>Categoría</th><th style={{ minWidth: '14rem' }}>Concepto</th><th>Método</th>
              <th style={{ textAlign: 'right' }}>Monto</th><th style={{ textAlign: 'right' }}>4×1000</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</td></tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rose-600)' }}>
                  {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin gastos para {MESES[mes - 1]} {anio}.</td></tr>
              ) : data.map(g => {
                const gravable = esGravable(g)
                const impuesto = gravable ? calc4x1000(num(g.monto)).impuesto : 0
                return (
                  <tr key={g.id} style={!gravable ? { opacity: 0.55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(g.fecha)}</td>
                    <td><span className="badge badge--neutral" style={{ fontSize: '0.65rem' }}>{g.categoria}</span></td>
                    <td>{g.concepto}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{g.metodo_pago ?? '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{cop(num(g.monto))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: gravable ? 'var(--amber-700)' : 'var(--text-faint)' }} className="mono">
                      {gravable ? cop(impuesto) : 'No aplica'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(totalGravable)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--amber-700)' }} className="mono">{cop(totalImpuesto)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  )
}
