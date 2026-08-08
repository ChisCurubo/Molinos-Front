// Modales de análisis reutilizados por EntradasApiPage y AnalisisApiPage.
// El backend solo maneja análisis de CABEZA (tipo 1).

import { useEffect, useState } from 'react'
import { Button, Input, Modal, useToast } from '@/components/ui'
import { apiError } from '@/api/client'
import { materialApi, num, type AnalisisDetalle } from '@/api/material'

// ── Registrar análisis de cabeza (POST /material/analisis/cabeza) ─────────────
export function AnalisisCabezaModal({ idEntrada, entradaLabel, onClose, onSaved }: {
  idEntrada: number | null
  entradaLabel?: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ numero_analisis: '', porcentaje_humedad: '', au_concentrado: '', au_falso: '', ag_concentrado: '', toneladas: '', comentarios: '' })
  useEffect(() => {
    if (idEntrada != null) setForm({ numero_analisis: '', porcentaje_humedad: '', au_concentrado: '', au_falso: '', ag_concentrado: '', toneladas: '', comentarios: '' })
  }, [idEntrada])

  // Preview: tenor real = au_concentrado / ton_secas
  const hum = Number(form.porcentaje_humedad) || 0
  const humFrac = hum > 1 ? hum / 100 : hum
  const ton = Number(form.toneladas) || 0
  const tonSec = ton > 0 ? ton * (1 - humFrac) : 0
  const auConc = Number(form.au_concentrado) || 0
  const auGrT = tonSec > 0 && auConc > 0 ? auConc / tonSec : null

  const valid = idEntrada != null && form.porcentaje_humedad !== '' && form.au_concentrado !== ''
  const save = async () => {
    if (!valid || idEntrada == null) return
    setSaving(true)
    try {
      await materialApi.createAnalisisCabeza({
        id_entrada: idEntrada,
        numero_analisis: form.numero_analisis || undefined,
        porcentaje_humedad: Number(form.porcentaje_humedad),
        au_concentrado: Number(form.au_concentrado),
        au_falso: form.au_falso ? Number(form.au_falso) : undefined,
        ag_concentrado: form.ag_concentrado ? Number(form.ag_concentrado) : undefined,
        toneladas: form.toneladas ? Number(form.toneladas) : undefined,
        comentarios: form.comentarios || undefined,
      })
      toast.success('Análisis de cabeza registrado')
      onSaved(); onClose()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  return (
    <Modal open={idEntrada != null} title="Registrar análisis de cabeza" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={saving || !valid}>Registrar análisis</Button></>}>
      {entradaLabel && <div className="callout" style={{ marginBottom: '1rem', fontSize: 'var(--fs-sm)' }}>{entradaLabel}</div>}
      <div className="grid grid--form">
        <Input label="N° análisis" value={form.numero_analisis} onChange={e => setForm(f => ({ ...f, numero_analisis: e.target.value }))} helper="Vacío → autogenera AN-{mina}-{n° volqueta}" />
        <Input label="Humedad (%)" type="number" step="0.01" required value={form.porcentaje_humedad} onChange={e => setForm(f => ({ ...f, porcentaje_humedad: e.target.value }))} helper="Acepta 45 o 0.45" />
        <Input label="Au concentrado (gramos)" type="number" step="0.1" required value={form.au_concentrado} onChange={e => setForm(f => ({ ...f, au_concentrado: e.target.value }))}
          helper={auGrT ? `→ ${auGrT.toFixed(2)} Au gr/t real` : undefined} />
        <Input label="Au falso (tenor para pago)" type="number" step="0.1" value={form.au_falso} onChange={e => setForm(f => ({ ...f, au_falso: e.target.value }))} helper="Tenor reportado al minero" />
        <Input label="Ag concentrado (gramos)" type="number" step="1" value={form.ag_concentrado} onChange={e => setForm(f => ({ ...f, ag_concentrado: e.target.value }))} />
        <Input label="Toneladas" type="number" step="0.001" value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} helper="Vacío → usa el peso de llegada" />
        <Input label="Comentarios" value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} style={{ gridColumn: '1/-1' }} />
      </div>
    </Modal>
  )
}

// ── Editar análisis (PUT /material/analisis/:id) ──────────────────────────────
export function EditAnalisisModal({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ porcentaje_humedad: '', au_concentrado: '', au_falso: '', ag_concentrado: '', toneladas: '', numero_analisis: '' })
  useEffect(() => {
    if (id == null) return
    setLoading(true)
    materialApi.getAnalisis(id).then((a: AnalisisDetalle) => setForm({
      porcentaje_humedad: String(num(a.porcentaje_humedad)),
      au_concentrado: a.au_concentrado != null ? String(num(a.au_concentrado)) : '',
      au_falso: a.tenor_falso != null ? String(num(a.tenor_falso)) : '',
      ag_concentrado: a.ag_concentrado != null ? String(num(a.ag_concentrado)) : '',
      toneladas: a.toneladas_secas != null ? String(num(a.toneladas_secas)) : '',
      numero_analisis: a.numero_analisis ?? '',
    })).catch(e => toast.error(apiError(e).message)).finally(() => setLoading(false))
  }, [id, toast])

  const save = async () => {
    if (id == null) return
    setSaving(true)
    try {
      await materialApi.updateAnalisis(id, {
        porcentaje_humedad: form.porcentaje_humedad ? Number(form.porcentaje_humedad) : undefined,
        au_concentrado: form.au_concentrado ? Number(form.au_concentrado) : undefined,
        au_falso: form.au_falso ? Number(form.au_falso) : undefined,
        ag_concentrado: form.ag_concentrado ? Number(form.ag_concentrado) : undefined,
        toneladas: form.toneladas ? Number(form.toneladas) : undefined,
        numero_analisis: form.numero_analisis || undefined,
      })
      toast.success('Análisis actualizado')
      onSaved(); onClose()
    } catch (e) { toast.error(apiError(e).message) } finally { setSaving(false) }
  }

  return (
    <Modal open={id != null} title="Editar análisis" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={saving || loading}>Guardar</Button></>}>
      {loading ? <p style={{ color: 'var(--text-muted)' }}>Cargando…</p> : (
        <div className="grid grid--form">
          <Input label="N° análisis" value={form.numero_analisis} onChange={e => setForm(f => ({ ...f, numero_analisis: e.target.value }))} />
          <Input label="Humedad (%)" type="number" step="0.01" value={form.porcentaje_humedad} onChange={e => setForm(f => ({ ...f, porcentaje_humedad: e.target.value }))} />
          <Input label="Au concentrado (g)" type="number" step="0.1" value={form.au_concentrado} onChange={e => setForm(f => ({ ...f, au_concentrado: e.target.value }))} />
          <Input label="Au falso" type="number" step="0.1" value={form.au_falso} onChange={e => setForm(f => ({ ...f, au_falso: e.target.value }))} />
          <Input label="Ag concentrado (g)" type="number" step="1" value={form.ag_concentrado} onChange={e => setForm(f => ({ ...f, ag_concentrado: e.target.value }))} />
          <Input label="Toneladas" type="number" step="0.001" value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} />
        </div>
      )}
    </Modal>
  )
}
