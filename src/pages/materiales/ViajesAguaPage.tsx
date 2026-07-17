import { useMemo, useState, type FormEvent } from 'react'
import { Droplets, Plus } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select, useToast } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import { aguaMock, duenosVolqueta, type AguaRow } from '@/data/mock'
import { apiPost } from '@/api/withFallback'
import { apiErrorMessage } from '@/api/client'

const cop = formatCOP

interface FormState {
  id_dueno: string
  fecha: string
  valor_viaje: string
  cantidad_viajes: string
  acpm: string
}
const emptyForm = (): FormState => ({
  id_dueno: String(duenosVolqueta[0]?.id ?? ''),
  fecha: todayISO(),
  valor_viaje: '',
  cantidad_viajes: '',
  acpm: '0',
})

export function ViajesAguaPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()
  const [registros, setRegistros] = useState<AguaRow[]>(aguaMock)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const setF = (k: keyof FormState, v: string) => setForm((s) => ({ ...s, [k]: v }))

  const previewNeto = useMemo(() => {
    const val  = Number(form.valor_viaje)    || 0
    const cant = Number(form.cantidad_viajes) || 0
    const acpm = Number(form.acpm)            || 0
    return val * cant - acpm
  }, [form])

  const porConductor = useMemo(() => {
    const mapa = new Map<string, AguaRow[]>()
    for (const a of registros) {
      if (!mapa.has(a.conductor)) mapa.set(a.conductor, [])
      mapa.get(a.conductor)!.push(a)
    }
    return [...mapa.entries()].map(([conductor, filas]) => ({
      conductor,
      count:  filas.length,
      viajes: filas.reduce((s, a) => s + a.cantidad_viajes, 0),
      bruto:  filas.reduce((s, a) => s + a.valor_viaje * a.cantidad_viajes, 0),
      acpm:   filas.reduce((s, a) => s + a.acpm, 0),
      neto:   filas.reduce((s, a) => s + a.valor_total, 0),
    }))
  }, [registros])

  const totalNeto   = porConductor.reduce((s, r) => s + r.neto, 0)
  const totalViajes = porConductor.reduce((s, r) => s + r.viajes, 0)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const dueno = duenosVolqueta.find((d) => d.id === Number(form.id_dueno))
    const body = {
      id_vehiculo:     Number(form.id_dueno),
      fecha:           form.fecha,
      valor_viaje:     Number(form.valor_viaje),
      cantidad_viajes: Number(form.cantidad_viajes),
      acpm:            Number(form.acpm) || 0,
    }
    try {
      await apiPost('/material/agua', body, (b) => b)
      toast.success('Viaje de agua registrado')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
    const nueva: AguaRow = {
      id:              Date.now(),
      id_dueno:        body.id_vehiculo,
      conductor:       dueno?.nombre ?? '',
      fecha:           body.fecha,
      valor_viaje:     body.valor_viaje,
      cantidad_viajes: body.cantidad_viajes,
      acpm:            body.acpm,
      valor_total:     body.valor_viaje * body.cantidad_viajes - body.acpm,
    }
    setRegistros((prev) => [nueva, ...prev])
    setSaving(false)
    setModalOpen(false)
    setForm(emptyForm())
  }

  return (
    <div className="page">
      <PageHeader
        title="Viajes de agua"
        subtitle={`${registros.length} registros · ${totalViajes} viajes · Neto acumulado: ${cop(totalNeto)}`}
        actions={
          canWrite && (
            <Button icon={<Plus size={18} />} onClick={() => { setForm(emptyForm()); setModalOpen(true) }}>
              Registrar viaje
            </Button>
          )
        }
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Registros" value={registros.length} icon={<Droplets size={16} />} accent="emerald" />
        <KpiTile label="Viajes totales" value={totalViajes} accent="green" />
        <KpiTile label="Total bruto" value={cop(porConductor.reduce((s, r) => s + r.bruto, 0))} accent="brown" />
        <KpiTile label="Neto a pagar" value={cop(totalNeto)} accent="rose" />
      </div>

      <Card title="Todos los registros">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Viajes</th>
                <th style={{ textAlign: 'right' }}>$/viaje</th>
                <th style={{ textAlign: 'right' }}>Bruto</th>
                <th style={{ textAlign: 'right' }}>ACPM</th>
                <th style={{ textAlign: 'right' }}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((a) => (
                <tr key={a.id} style={a.acpm > 0 ? { background: 'var(--amber-50)' } : undefined}>
                  <td style={{ fontWeight: 600 }}>{a.conductor}</td>
                  <td>{formatDate(a.fecha)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{a.cantidad_viajes}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(a.valor_viaje * a.cantidad_viajes)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {a.acpm > 0 ? <span style={{ color: 'var(--amber-700)' }}>- {cop(a.acpm)}</span> : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(a.valor_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={4}>Total</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(porConductor.reduce((s, r) => s + r.bruto, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">- {cop(porConductor.reduce((s, r) => s + r.acpm, 0))}</td>
                <td style={{ textAlign: 'right' }} className="mono">{cop(totalNeto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <h2 style={{ margin: '1.5rem 0 0.875rem', fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Por conductor</h2>
      <div className="grid grid--kpi">
        {porConductor.map((r) => (
          <Card key={r.conductor} title={r.conductor} flush>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: 'var(--fs-sm)' }}>
              <span>{r.count} registros · {r.viajes} viajes</span>
              <span>Bruto: <strong>{cop(r.bruto)}</strong></span>
              {r.acpm > 0 && <span style={{ color: 'var(--amber-700)' }}>ACPM: - {cop(r.acpm)}</span>}
              <span style={{ fontWeight: 800, fontSize: 'var(--fs-base)', marginTop: '0.25rem' }}>Neto: {cop(r.neto)}</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        title="Registrar viaje de agua"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave as unknown as () => void} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="grid grid--form">
            <Select
              label="Conductor / Dueño volqueta"
              options={duenosVolqueta.map((d) => ({ value: String(d.id), label: d.nombre }))}
              value={form.id_dueno}
              onChange={(e) => setF('id_dueno', e.target.value)}
              required
            />
            <Input label="Fecha" type="date" value={form.fecha} onChange={(e) => setF('fecha', e.target.value)} required />
            <Input label="Valor por viaje" type="number" placeholder="130000" value={form.valor_viaje} onChange={(e) => setF('valor_viaje', e.target.value)} required />
            <Input label="Cantidad de viajes" type="number" placeholder="6" value={form.cantidad_viajes} onChange={(e) => setF('cantidad_viajes', e.target.value)} required />
            <Input label="Adelanto ACPM" type="number" placeholder="0" value={form.acpm} onChange={(e) => setF('acpm', e.target.value)} helper="El total lo calcula la BD. Dejar en 0 si no aplica." />
          </div>
          {previewNeto > 0 && (
            <div className="callout" style={{ marginTop: '1rem' }}>
              <span className="callout__icon"><Droplets size={14} /></span>
              <span>
                {cop(Number(form.valor_viaje))} × {form.cantidad_viajes}
                {Number(form.acpm) > 0 ? ` − ${cop(Number(form.acpm))} ACPM` : ''} = <strong>{cop(previewNeto)}</strong>
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
