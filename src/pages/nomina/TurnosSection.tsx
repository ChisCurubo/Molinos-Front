import { useMemo, useState } from 'react'
import { CalendarClock, Moon, Plus, Sun } from 'lucide-react'
import {
  Badge, Button, Card, Checkbox, InfoCallout, Input, Modal, Select, CardList, CardRow, KpiTile,
} from '@/components/ui'
import { EmptyState } from '@/components/common/Page'
import { useData } from '@/context/DataContext'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import type { Turno } from '@/types'

type Periodo = 'q1' | 'q2' | 'mes'

// Valor de referencia por hora para la liquidación de turnos
const VALOR_HORA = 8000
const RECARGO_NOCTURNO = 1.35

export function TurnosSection() {
  const canWrite = useCanWrite('nomina')
  const { turnos, empleados, add } = useData()
  const [mes, setMes] = useState(todayISO().slice(0, 7)) // YYYY-MM
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({ empleadoId: '', fecha: todayISO(), tipo: 'diurno', horas: '8', presente: true })

  const empleadoName = (id: string) => empleados.find((e) => e.id === id)?.nombre ?? '—'
  const empleadoOptions = empleados.map((e) => ({ value: e.id, label: e.nombre }))

  const filtrados = useMemo(() => {
    return turnos.filter((t) => {
      if (!t.fecha.startsWith(mes)) return false
      const dia = Number(t.fecha.slice(8, 10))
      if (periodo === 'q1') return dia <= 15
      if (periodo === 'q2') return dia >= 16
      return true
    })
  }, [turnos, mes, periodo])

  // Liquidación por empleado
  const liquidacion = useMemo(() => {
    const map = new Map<string, { horas: number; valor: number; presentes: number }>()
    filtrados.forEach((t) => {
      if (!t.presente) return
      const factor = t.tipo === 'nocturno' ? RECARGO_NOCTURNO : 1
      const valor = t.horas * VALOR_HORA * factor
      const cur = map.get(t.empleadoId) ?? { horas: 0, valor: 0, presentes: 0 }
      cur.horas += t.horas
      cur.valor += valor
      cur.presentes += 1
      map.set(t.empleadoId, cur)
    })
    return map
  }, [filtrados])

  const totalLiquidacion = [...liquidacion.values()].reduce((s, v) => s + v.valor, 0)
  const totalHoras = [...liquidacion.values()].reduce((s, v) => s + v.horas, 0)

  const submit = () => {
    if (!form.empleadoId || !form.fecha) return
    add('turnos', {
      id: `t${Date.now()}`,
      empleadoId: form.empleadoId,
      fecha: form.fecha,
      tipo: form.tipo as Turno['tipo'],
      horas: Number(form.horas) || 0,
      presente: form.presente,
    })
    setForm({ empleadoId: '', fecha: todayISO(), tipo: 'diurno', horas: '8', presente: true })
    setOpen(false)
  }

  return (
    <div className="stack">
      <Card flush>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Input
            label="Mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className=""
          />
          <div>
            <span className="field__label" style={{ display: 'block', marginBottom: 7 }}>
              Periodo de liquidación
            </span>
            <div className="segment" role="group" aria-label="Periodo">
              {([
                { k: 'q1', l: '1ª quincena' },
                { k: 'q2', l: '2ª quincena' },
                { k: 'mes', l: 'Mes completo' },
              ] as const).map((p) => (
                <button
                  key={p.k}
                  className={`segment__btn ${periodo === p.k ? 'segment__btn--active' : ''}`}
                  aria-pressed={periodo === p.k}
                  onClick={() => setPeriodo(p.k)}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div className="spacer" />
          {canWrite && (
            <Button icon={<Plus size={18} />} onClick={() => setOpen(true)} style={{ alignSelf: 'flex-end' }}>
              Registrar turno
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid--kpi">
        <KpiTile label="Turnos en el periodo" value={filtrados.length} icon={<CalendarClock size={16} />} accent="green" />
        <KpiTile label="Horas presentes" value={totalHoras} accent="brown" />
        <KpiTile label="Liquidación estimada" value={formatCOP(totalLiquidacion)} accent="emerald" />
      </div>

      <InfoCallout>
        La liquidación usa {formatCOP(VALOR_HORA)} por hora, con recargo del {(RECARGO_NOCTURNO - 1) * 100}% para
        turnos nocturnos. Filtre por quincena o mes según necesite.
      </InfoCallout>

      <Card title="Liquidación por empleado">
        {liquidacion.size === 0 ? (
          <EmptyState title="Sin turnos en el periodo" hint="Ajuste el filtro o registre turnos." />
        ) : (
          <CardList>
            {[...liquidacion.entries()].map(([empId, v]) => (
              <CardRow
                key={empId}
                title={empleadoName(empId)}
                subtitle={`${v.presentes} turnos · ${v.horas} horas`}
                tons={formatCOP(v.valor)}
                status={<Badge tone="success">Liquidado</Badge>}
              />
            ))}
          </CardList>
        )}
      </Card>

      <Card title="Detalle de turnos">
        {filtrados.length === 0 ? (
          <EmptyState title="Sin registros" />
        ) : (
          <CardList>
            {filtrados.map((t) => (
              <CardRow
                key={t.id}
                title={empleadoName(t.empleadoId)}
                subtitle={`${formatDate(t.fecha)} · ${t.horas} h`}
                status={
                  <>
                    <Badge tone={t.tipo === 'nocturno' ? 'info' : 'warning'} icon={t.tipo === 'nocturno' ? <Moon size={14} /> : <Sun size={14} />}>
                      {t.tipo === 'nocturno' ? 'Nocturno' : 'Diurno'}
                    </Badge>
                    <Badge tone={t.presente ? 'success' : 'danger'}>{t.presente ? 'Presente' : 'Ausente'}</Badge>
                  </>
                }
              />
            ))}
          </CardList>
        )}
      </Card>

      <Modal
        open={open}
        title="Registrar turno"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Guardar turno</Button>
          </>
        }
      >
        <div className="grid grid--form">
          <Select
            label="Empleado"
            options={empleadoOptions}
            placeholder="Seleccione el empleado"
            value={form.empleadoId}
            onChange={(e) => setForm((f) => ({ ...f, empleadoId: e.target.value }))}
            required
          />
          <Input label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
          <Select
            label="Tipo de turno"
            options={[
              { value: 'diurno', label: 'Diurno' },
              { value: 'nocturno', label: 'Nocturno' },
            ]}
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          />
          <Input label="Horas" type="number" mono value={form.horas} onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))} />
        </div>
        <Checkbox
          label="El empleado asistió al turno"
          checked={form.presente}
          onChange={(e) => setForm((f) => ({ ...f, presente: e.target.checked }))}
        />
      </Modal>
    </div>
  )
}
