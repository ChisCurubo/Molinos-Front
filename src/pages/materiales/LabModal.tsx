import { useMemo, useState } from 'react'
import { Button, InfoCallout, Input, Modal, KpiTile } from '@/components/ui'
import { calcularLiquidacion } from '@/utils/liquidacion'
import { formatCOP, formatTon, todayISO } from '@/utils/format'
import type { CuentaPorPagar, EntradaMaterial } from '@/types'

interface LabModalProps {
  entrada: EntradaMaterial
  tarifaTon: number
  minero: string
  conductor: string
  onClose: () => void
  onSave: (patch: Partial<EntradaMaterial>, deudas: CuentaPorPagar[]) => void
}

/** Análisis de laboratorio: calcula toneladas secas y liquidación,
 *  y genera las deudas automáticas de material y flete. */
export function LabModal({ entrada, tarifaTon, minero, conductor, onClose, onSave }: LabModalProps) {
  const [humedad, setHumedad] = useState('')
  const [tenor, setTenor] = useState('')
  const [au, setAu] = useState('')
  const [ag, setAg] = useState('')

  const calc = useMemo(() => {
    const h = Number(humedad) || 0
    const t = Number(tenor) || 0
    return calcularLiquidacion(entrada.pesoBrutoTon, h, t, tarifaTon)
  }, [humedad, tenor, entrada.pesoBrutoTon, tarifaTon])

  const guardar = () => {
    const patch: Partial<EntradaMaterial> = {
      humedadPct: Number(humedad) || 0,
      tenor: Number(tenor) || 0,
      au: Number(au) || 0,
      ag: Number(ag) || 0,
      toneladasSecas: calc.toneladasSecas,
      liquidacion: calc.liquidacion,
      flete: calc.flete,
      estado: 'aprobado',
    }
    const deudas: CuentaPorPagar[] = [
      {
        id: `p${Date.now()}-mat`,
        concepto: `Pago material — entrada ${entrada.id}`,
        tipo: 'material',
        beneficiario: minero,
        monto: calc.liquidacion,
        fechaVencimiento: todayISO(),
        estado: 'pendiente',
        origen: 'automatico',
      },
      {
        id: `p${Date.now()}-fle`,
        concepto: `Flete — entrada ${entrada.id}`,
        tipo: 'flete',
        beneficiario: conductor,
        monto: calc.flete,
        fechaVencimiento: todayISO(),
        estado: 'pendiente',
        origen: 'automatico',
      },
    ]
    onSave(patch, deudas)
  }

  return (
    <Modal
      open
      title="Análisis de laboratorio"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" onClick={guardar}>
            Procesar y liquidar
          </Button>
        </>
      }
    >
      <InfoCallout>
        Ingrese los resultados del análisis. El sistema calcula las toneladas secas y la liquidación
        automáticamente, y genera las deudas de material y flete.
      </InfoCallout>
      <div className="grid grid--form">
        <Input label="Humedad (%)" type="number" step={0.1} mono value={humedad} onChange={(e) => setHumedad(e.target.value)} required />
        <Input label="Tenor (g/ton)" type="number" step={0.1} mono value={tenor} onChange={(e) => setTenor(e.target.value)} required />
        <Input label="Oro — Au (g)" type="number" step={0.1} mono value={au} onChange={(e) => setAu(e.target.value)} />
        <Input label="Plata — Ag (g)" type="number" step={0.1} mono value={ag} onChange={(e) => setAg(e.target.value)} />
      </div>

      <div className="grid grid--kpi">
        <KpiTile label="Toneladas secas" value={formatTon(calc.toneladasSecas)} accent="green" />
        <KpiTile label="Liquidación al minero" value={formatCOP(calc.liquidacion)} accent="emerald" />
        <KpiTile label="Flete a pagar" value={formatCOP(calc.flete)} accent="brown" />
      </div>
    </Modal>
  )
}
