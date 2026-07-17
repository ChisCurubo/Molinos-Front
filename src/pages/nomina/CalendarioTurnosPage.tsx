import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Card, InfoCallout, Input } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { todayISO } from '@/utils/format'
import type { Turno } from '@/types'
import './calendario.css'

type Quincena = 'q1' | 'q2'
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function CalendarioTurnosPage() {
  const canWrite = useCanWrite('nomina')
  const { turnos, empleados, add, update, remove } = useData()
  const [mes, setMes] = useState(todayISO().slice(0, 7)) // YYYY-MM
  const [quincena, setQuincena] = useState<Quincena>('q1')

  const [year, month] = mes.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const dias = useMemo(() => {
    const start = quincena === 'q1' ? 1 : 16
    const end = quincena === 'q1' ? 15 : lastDay
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [quincena, lastDay])

  const fechaDe = (dia: number) => `${mes}-${String(dia).padStart(2, '0')}`
  const turnoDe = (empId: string, dia: number): Turno | undefined =>
    turnos.find((t) => t.empleadoId === empId && t.fecha === fechaDe(dia))

  // Ciclo al hacer clic: vacío → Diurno → Nocturno → Ausente → vacío
  const cicloTurno = (empId: string, dia: number) => {
    if (!canWrite) return
    const t = turnoDe(empId, dia)
    const fecha = fechaDe(dia)
    if (!t) {
      add('turnos', { id: `t${Date.now()}`, empleadoId: empId, fecha, tipo: 'diurno', horas: 8, presente: true })
    } else if (t.tipo === 'diurno' && t.presente) {
      update('turnos', t.id, { tipo: 'nocturno' })
    } else if (t.tipo === 'nocturno' && t.presente) {
      update('turnos', t.id, { presente: false, horas: 0 })
    } else {
      remove('turnos', t.id)
    }
  }

  const cellInfo = (t: Turno | undefined) => {
    if (!t) return { cls: '', label: '' }
    if (!t.presente) return { cls: 'cal-cell--ausente', label: 'A' }
    return t.tipo === 'nocturno' ? { cls: 'cal-cell--n', label: 'N' } : { cls: 'cal-cell--d', label: 'D' }
  }

  return (
    <div className="page">
      <PageHeader
        title="Calendario de turnos"
        subtitle="Vista quincenal de asistencias. Toque una celda para cambiar el turno."
      />
      {!canWrite && <ReadOnlyBanner />}

      <Card flush>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div style={{ maxWidth: '12rem' }}>
            <Input label="Mes y año" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div>
            <span className="field__label" style={{ display: 'block', marginBottom: '0.4375rem' }}>Quincena</span>
            <div className="segment" role="group" aria-label="Quincena">
              <button
                className={`segment__btn ${quincena === 'q1' ? 'segment__btn--active' : ''}`}
                aria-pressed={quincena === 'q1'}
                onClick={() => setQuincena('q1')}
              >
                1ª quincena (1–15)
              </button>
              <button
                className={`segment__btn ${quincena === 'q2' ? 'segment__btn--active' : ''}`}
                aria-pressed={quincena === 'q2'}
                onClick={() => setQuincena('q2')}
              >
                2ª quincena (16–{lastDay})
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="cal-legend">
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--d" />Diurno (D)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--n" />Nocturno (N)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--ausente" />Ausente (A)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch" style={{ border: '1px solid var(--border-default)' }} />Sin turno</span>
      </div>

      <InfoCallout>
        {canWrite
          ? 'Cada clic avanza el estado del día: sin turno → Diurno → Nocturno → Ausente → sin turno.'
          : 'Vista de solo lectura del calendario de turnos.'}
      </InfoCallout>

      <div className="cal-wrap" style={{ marginTop: '1.125rem' }}>
        <table className="cal-table">
          <thead>
            <tr>
              <th className="cal-emp">
                <span className="row" style={{ gap: '0.5rem' }}>
                  <CalendarDays size={16} /> Empleado
                </span>
              </th>
              {dias.map((d) => {
                const dow = new Date(`${fechaDe(d)}T00:00:00`).getDay()
                return (
                  <th key={d} className={dow === 0 ? 'cal-dom' : ''}>
                    {d}
                    <br />
                    <span style={{ fontWeight: 400 }}>{DIAS_SEMANA[dow]}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => (
              <tr key={emp.id}>
                <td className="cal-emp">{emp.nombre}</td>
                {dias.map((d) => {
                  const info = cellInfo(turnoDe(emp.id, d))
                  return (
                    <td key={d}>
                      <button
                        className={`cal-cell ${info.cls}`}
                        onClick={() => cicloTurno(emp.id, d)}
                        disabled={!canWrite}
                        aria-label={`${emp.nombre}, día ${d}: ${info.label || 'sin turno'}`}
                      >
                        {info.label}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
