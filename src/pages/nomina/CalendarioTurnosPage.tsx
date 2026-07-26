import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button, Card, Input, Modal, Select } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, todayISO } from '@/utils/format'
import type { Turno } from '@/types'
import './calendario.css'

type Quincena = 'q1' | 'q2'
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const VALOR_HORA = 8_000
const RECARGO: Record<string, number> = { diurno: 1, tarde: 1.25, nocturno: 1.35 }

const TIPO_OPTS = [
  { value: '',         label: 'Sin turno (limpiar)' },
  { value: 'diurno',   label: 'D — Diurno (6am–2pm)' },
  { value: 'tarde',    label: 'T — Tarde (2pm–10pm)'  },
  { value: 'nocturno', label: 'N — Nocturno (10pm–6am)' },
  { value: 'ausente',  label: 'A — Ausente'            },
]

interface CeldaEdit {
  empId: string
  dia: number
  turnoActual: Turno | undefined
}

function cellInfo(t: Turno | undefined): { cls: string; label: string } {
  if (!t) return { cls: '', label: '' }
  if (!t.presente) return { cls: 'cal-cell--ausente', label: 'A' }
  if (t.tipo === 'nocturno') return { cls: 'cal-cell--n', label: 'N' }
  if (t.tipo === 'tarde')    return { cls: 'cal-cell--t', label: 'T' }
  return { cls: 'cal-cell--d', label: 'D' }
}

export function CalendarioTurnosPage() {
  const canWrite = useCanWrite('nomina')
  const { turnos, empleados, add, update, remove } = useData()
  const [mes, setMes]         = useState(todayISO().slice(0, 7))
  const [quincena, setQuincena] = useState<Quincena>('q1')

  // Modal edición de celda
  const [celdaEdit, setCeldaEdit] = useState<CeldaEdit | null>(null)
  const [editTipo,  setEditTipo]  = useState<string>('diurno')
  const [editHoras, setEditHoras] = useState<string>('8')

  const [year, month] = mes.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const dias = useMemo(() => {
    const start = quincena === 'q1' ? 1 : 16
    const end   = quincena === 'q1' ? 15 : lastDay
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [quincena, lastDay])

  const fechaDe = (dia: number) => `${mes}-${String(dia).padStart(2, '0')}`
  const turnoDe = (empId: string, dia: number): Turno | undefined =>
    turnos.find((t) => t.empleadoId === empId && t.fecha === fechaDe(dia))

  const abrirEdicion = (empId: string, dia: number) => {
    if (!canWrite) return
    const t = turnoDe(empId, dia)
    setCeldaEdit({ empId, dia, turnoActual: t })
    if (t) {
      setEditTipo(!t.presente ? 'ausente' : t.tipo)
      setEditHoras(String(t.horas))
    } else {
      setEditTipo('diurno')
      setEditHoras('8')
    }
  }

  const guardarCelda = () => {
    if (!celdaEdit) return
    const { empId, dia, turnoActual } = celdaEdit
    const fecha = fechaDe(dia)

    if (editTipo === '') {
      // Limpiar
      if (turnoActual) remove('turnos', turnoActual.id)
    } else if (editTipo === 'ausente') {
      const patch = { tipo: 'diurno' as const, presente: false, horas: 0 }
      if (turnoActual) update('turnos', turnoActual.id, patch)
      else add('turnos', { id: `t${Date.now()}`, empleadoId: empId, fecha, ...patch })
    } else {
      const tipo = editTipo as Turno['tipo']
      const horas = Math.max(0, Math.min(24, Number(editHoras) || 8))
      const patch = { tipo, presente: true, horas }
      if (turnoActual) update('turnos', turnoActual.id, patch)
      else add('turnos', { id: `t${Date.now()}`, empleadoId: empId, fecha, ...patch })
    }
    setCeldaEdit(null)
  }

  // Resumen quincena
  const resumen = useMemo(() => {
    return empleados.map((emp) => {
      const esFijo = emp.tipoContrato === 'fijo'
      const turnosEmp = dias.flatMap((d) => {
        const t = turnoDe(emp.id, d)
        return t ? [t] : []
      })
      const horasTotales = turnosEmp.filter((t) => t.presente).reduce((s, t) => s + t.horas, 0)
      // Salario fijo: mitad del mensual por quincena; por hora: horas × tarifa × recargo
      const liquidacion = esFijo
        ? emp.salarioBase / 2
        : turnosEmp.filter((t) => t.presente).reduce((s, t) => s + t.horas * VALOR_HORA * (RECARGO[t.tipo] ?? 1), 0)
      const contD = turnosEmp.filter((t) => t.presente && t.tipo === 'diurno').length
      const contT = turnosEmp.filter((t) => t.presente && t.tipo === 'tarde').length
      const contN = turnosEmp.filter((t) => t.presente && t.tipo === 'nocturno').length
      const contA = turnosEmp.filter((t) => !t.presente).length
      return { emp, esFijo, horasTotales, liquidacion, contD, contT, contN, contA }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnos, empleados, dias, mes])

  return (
    <div className="page">
      <PageHeader
        title="Calendario de turnos"
        subtitle="Planta 24 h — 3 turnos: Diurno (D), Tarde (T), Nocturno (N). Toque una celda para editar."
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
              <button className={`segment__btn ${quincena === 'q1' ? 'segment__btn--active' : ''}`}
                aria-pressed={quincena === 'q1'} onClick={() => setQuincena('q1')}>
                1ª (1–15)
              </button>
              <button className={`segment__btn ${quincena === 'q2' ? 'segment__btn--active' : ''}`}
                aria-pressed={quincena === 'q2'} onClick={() => setQuincena('q2')}>
                2ª (16–{lastDay})
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="cal-legend">
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--d" />D — Diurno (6am–2pm)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--t" />T — Tarde (2pm–10pm)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--n" />N — Nocturno (10pm–6am)</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch cal-cell--ausente" />A — Ausente</span>
        <span className="cal-legend__item"><span className="cal-legend__swatch" style={{ border: '1px solid var(--border-default)' }} />Sin turno</span>
      </div>

      {/* Grid calendario */}
      <div className="cal-wrap" style={{ marginTop: '0.75rem' }}>
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
                    {d}<br /><span style={{ fontWeight: 400 }}>{DIAS_SEMANA[dow]}</span>
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
                  const t    = turnoDe(emp.id, d)
                  const info = cellInfo(t)
                  const horasTip = t && t.presente && t.horas !== 8 ? ` (${t.horas}h)` : ''
                  return (
                    <td key={d}>
                      <button
                        className={`cal-cell ${info.cls}`}
                        onClick={() => abrirEdicion(emp.id, d)}
                        disabled={!canWrite}
                        title={info.label ? `${info.label}${horasTip}` : 'Sin turno'}
                        aria-label={`${emp.nombre}, día ${d}: ${info.label || 'sin turno'}${horasTip}`}
                      >
                        {info.label}
                        {horasTip && <span style={{ fontSize: '0.55rem', display: 'block', lineHeight: 1 }}>{t!.horas}h</span>}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen quincena */}
      <div style={{ marginTop: '1.25rem' }}>
      <Card title={`Resumen quincena — ${quincena === 'q1' ? '1ª (1–15)' : `2ª (16–${lastDay})`}`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th style={{ textAlign: 'center' }}>Turnos D</th>
                <th style={{ textAlign: 'center' }}>Turnos T</th>
                <th style={{ textAlign: 'center' }}>Turnos N</th>
                <th style={{ textAlign: 'center' }}>Ausencias</th>
                <th style={{ textAlign: 'right' }}>Horas</th>
                <th style={{ textAlign: 'right' }}>Liquidación est.</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map(({ emp, esFijo, horasTotales, liquidacion, contD, contT, contN, contA }) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>
                    {emp.nombre}
                    {esFijo && <span className="badge badge--info" style={{ marginLeft: '0.375rem', fontSize: '0.6rem', verticalAlign: 'middle' }}>FIJO</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}><span className="cal-legend__swatch cal-cell--d" style={{ display: 'inline-block', width: '1.2rem', height: '1.2rem', lineHeight: '1.2rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, borderRadius: 4 }}>{contD}</span></td>
                  <td style={{ textAlign: 'center' }}><span className="cal-legend__swatch cal-cell--t" style={{ display: 'inline-block', width: '1.2rem', height: '1.2rem', lineHeight: '1.2rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, borderRadius: 4 }}>{contT}</span></td>
                  <td style={{ textAlign: 'center' }}><span className="cal-legend__swatch cal-cell--n" style={{ display: 'inline-block', width: '1.2rem', height: '1.2rem', lineHeight: '1.2rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, borderRadius: 4 }}>{contN}</span></td>
                  <td style={{ textAlign: 'center', color: contA > 0 ? 'var(--rose-600)' : 'var(--text-faint)' }}>{contA}</td>
                  <td style={{ textAlign: 'right', color: esFijo ? 'var(--text-muted)' : undefined }} className="mono">
                    {esFijo ? '—' : horasTotales}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                    {formatCOP(liquidacion)}
                    {esFijo && <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', fontWeight: 400 }}>salario fijo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.contD, 0)}</td>
                <td style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.contT, 0)}</td>
                <td style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.contN, 0)}</td>
                <td style={{ textAlign: 'center' }}>{resumen.reduce((s, r) => s + r.contA, 0)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{resumen.filter(r => !r.esFijo).reduce((s, r) => s + r.horasTotales, 0)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{formatCOP(resumen.reduce((s, r) => s + r.liquidacion, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
          Valor hora base: {formatCOP(VALOR_HORA)} · Tarde: +25% · Nocturno: +35%
        </p>
      </Card>
      </div>

      {/* Modal edición de celda */}
      <Modal
        open={!!celdaEdit}
        title={celdaEdit ? `Turno — día ${celdaEdit.dia} de ${mes}` : ''}
        onClose={() => setCeldaEdit(null)}
        footer={<><Button variant="secondary" onClick={() => setCeldaEdit(null)}>Cancelar</Button><Button onClick={guardarCelda}>Guardar</Button></>}
      >
        <div className="grid grid--form">
          <Select label="Tipo de turno" options={TIPO_OPTS} value={editTipo} onChange={(e) => {
            setEditTipo(e.target.value)
            if (e.target.value === '' || e.target.value === 'ausente') setEditHoras('0')
            else setEditHoras('8')
          }} />
          {editTipo !== '' && editTipo !== 'ausente' && (
            <Input
              label="Horas trabajadas"
              type="number"
              min={1} max={24}
              value={editHoras}
              onChange={(e) => setEditHoras(e.target.value)}
            />
          )}
          {editTipo !== '' && editTipo !== 'ausente' && editHoras && Number(editHoras) !== 8 && (
            <div className="callout" style={{ gridColumn: '1/-1' }}>
              Turno corto: <strong>{editHoras} horas</strong> (turno normal = 8 h)
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
