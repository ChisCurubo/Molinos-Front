import { useMemo, useState } from 'react'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Input, KpiTile, Modal, Select } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  tarifasZona, preciosMaterial,
  MINA_A_ZONA, MINA_A_MINERO,
  type MaterialRow,
} from '@/data/mock'
import { getPrecioAplicable } from '@/utils/format'
import { useMateriales } from '@/context/MaterialesContext'

const cop = formatCOP

// ── Cálculos ──────────────────────────────────────────────
function pesoSeco(m: MaterialRow) { return m.peso_llegada_planta * (1 - m.porcentaje_humedad) }
function calcFlete(m: MaterialRow) {
  const idZona = MINA_A_ZONA[m.mina]
  if (!idZona) return null
  const t = tarifasZona.find((tz) => tz.id_zona === idZona)
  return t ? pesoSeco(m) * t.valor_tonelada : null
}
function calcValorMaterial(m: MaterialRow) {
  const idMinero = MINA_A_MINERO[m.mina] || undefined
  const precio   = getPrecioAplicable(m.tenor, idMinero, preciosMaterial)
  if (!precio) return null
  const seco = pesoSeco(m)
  return precio.metodo === 'por_tonelada'
    ? seco * (precio.precio_por_tonelada ?? 0)
    : seco * m.tenor * (precio.precio_por_gramo ?? 0)
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', pagada: 'Pagada', en_proceso: 'En proceso',
  incluida_viaje: 'En viaje', en_canoa: 'En canoa', enviado_completo: 'Enviado',
}
const ESTADOS = ['todos', 'pendiente', 'pagada', 'en_proceso', 'incluida_viaje'] as const

interface EditMaterialForm { fecha: string; peso_llegada_planta: string; comentario: string }
interface EditAnalisisForm {
  porcentaje_humedad: string
  au_concentrado: string
  ag_concentrado: string
  au_falso: string
  numero_analisis: string
  fecha_salida: string
  comentarios: string
}

export function EntradasPage() {
  const canWrite = useCanWrite('materiales')
  const { materiales, setMateriales } = useMateriales()

  // Filtros
  const [busqueda,   setBusqueda]   = useState('')
  const [estadoF,    setEstadoF]    = useState('todos')
  const [mineroF,    setMineroF]    = useState('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Modal editar material
  const [editMat,  setEditMat]  = useState<MaterialRow | null>(null)
  const [formMat,  setFormMat]  = useState<EditMaterialForm>({ fecha: '', peso_llegada_planta: '', comentario: '' })

  // Modal análisis
  const [editAnal, setEditAnal] = useState<MaterialRow | null>(null)
  const [formAnal, setFormAnal] = useState<EditAnalisisForm>({
    porcentaje_humedad: '', au_concentrado: '', ag_concentrado: '', au_falso: '',
    numero_analisis: '', fecha_salida: '', comentarios: '',
  })

  // Modal nuevo
  const [modalNuevo, setModalNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    mina: '', numero_volqueta: '', fecha: todayISO(), peso_llegada_planta: '',
  })

  const minas = [...new Set(materiales.map((m) => m.mina))].sort()

  // ── Filtrado ──
  const filtrados = useMemo(() => materiales.filter((m) => {
    if (estadoF !== 'todos' && m.estado !== estadoF) return false
    if (mineroF !== 'todos' && m.mina !== mineroF) return false
    if (fechaDesde && m.fecha < fechaDesde) return false
    if (fechaHasta && m.fecha > fechaHasta) return false
    if (busqueda) {
      const q = busqueda.toUpperCase()
      if (!m.mina.includes(q) && !String(m.numero_volqueta).includes(q)) return false
    }
    return true
  }), [materiales, estadoF, mineroF, fechaDesde, fechaHasta, busqueda])

  // ── KPIs ──
  const totalHumedo = filtrados.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalSeco   = filtrados.reduce((s, m) => s + pesoSeco(m), 0)

  // ── Handlers ──
  const openEditMat = (m: MaterialRow) => {
    setEditMat(m)
    setFormMat({ fecha: m.fecha, peso_llegada_planta: String(m.peso_llegada_planta), comentario: '' })
  }
  const saveEditMat = () => {
    if (!editMat) return
    setMateriales((prev) => prev.map((m) => m.id === editMat.id
      ? { ...m, fecha: formMat.fecha, peso_llegada_planta: Number(formMat.peso_llegada_planta) }
      : m
    ))
    setEditMat(null)
  }

  const openEditAnal = (m: MaterialRow) => {
    setEditAnal(m)
    setFormAnal({
      porcentaje_humedad: m.porcentaje_humedad > 0 ? String((m.porcentaje_humedad * 100).toFixed(2)) : '',
      au_concentrado: m.tenor > 0 && m.total_material_seco > 0 ? String((m.tenor * m.total_material_seco).toFixed(2)) : '',
      ag_concentrado: '',
      au_falso: m.tenor > 0 ? String(m.tenor) : '',
      numero_analisis: '', fecha_salida: '', comentarios: '',
    })
  }

  const saveEditAnal = () => {
    if (!editAnal) return
    const hum      = Number(formAnal.porcentaje_humedad) / 100
    const tonSec   = editAnal.peso_llegada_planta * (1 - hum)
    const auConc   = Number(formAnal.au_concentrado) || 0
    const auFalso  = Number(formAnal.au_falso) || 0
    // tenor = au_falso (el que se le dice al minero y genera el pago)
    const tenor    = auFalso > 0 ? auFalso : (tonSec > 0 && auConc > 0 ? auConc / tonSec : 0)
    setMateriales((prev) => prev.map((m) => m.id === editAnal.id
      ? { ...m, porcentaje_humedad: hum, tenor, total_material_seco: tonSec }
      : m
    ))
    setEditAnal(null)
  }

  const deleteMaterial = (id: number) => {
    if (!confirm('¿Eliminar este registro de material? Esta acción también borrará el análisis asociado.')) return
    setMateriales((prev) => prev.filter((m) => m.id !== id))
  }

  const saveNuevo = () => {
    if (!formNuevo.mina || !formNuevo.peso_llegada_planta) return
    const nuevo: MaterialRow = {
      id:                  Date.now(),
      numero_volqueta:     formNuevo.numero_volqueta ? Number(formNuevo.numero_volqueta) : 0,
      mina:                formNuevo.mina,
      fecha:               formNuevo.fecha,
      peso_llegada_planta: Number(formNuevo.peso_llegada_planta),
      porcentaje_humedad:  0,
      tenor:               0,
      total_material_seco: 0,
      estado:              'pendiente',
      lote:                null,
    }
    setMateriales((prev) => [nuevo, ...prev])
    setModalNuevo(false)
    setFormNuevo({ mina: '', numero_volqueta: '', fecha: todayISO(), peso_llegada_planta: '' })
  }

  // Live preview for análisis form
  const analPreview = (() => {
    if (!editAnal) return null
    const hum    = Number(formAnal.porcentaje_humedad) || 0
    const tonSec = editAnal.peso_llegada_planta * (1 - hum / 100)
    const auConc = Number(formAnal.au_concentrado) || 0
    const agConc = Number(formAnal.ag_concentrado) || 0
    return {
      tonSec,
      auGrT: tonSec > 0 && auConc > 0 ? auConc / tonSec : null,
      agGrT: tonSec > 0 && agConc > 0 ? agConc / tonSec : null,
    }
  })()

  return (
    <div className="page">
      <PageHeader
        title="Entradas de material"
        subtitle={`${filtrados.length} registros · ${totalHumedo.toFixed(3)} t húmedo · ${totalSeco.toFixed(4)} t seco`}
        actions={
          canWrite && (
            <Button icon={<Plus size={18} />} onClick={() => setModalNuevo(true)}>
              Registrar entrada
            </Button>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Registros"       value={filtrados.length}                                                      accent="brown"   />
        <KpiTile label="Peso húmedo (t)" value={totalHumedo.toFixed(3)}                                               accent="green"   />
        <KpiTile label="Peso seco (t)"   value={totalSeco.toFixed(4)}                                                  accent="emerald" />
        <KpiTile label="Sin análisis"    value={filtrados.filter((m) => m.tenor === 0).length}                        accent="rose"    />
        <KpiTile label="Pendientes pago" value={filtrados.filter((m) => m.estado === 'pendiente').length}             accent="amber"   />
      </div>

      {/* Filtros + tabla */}
      <Card title={`Materiales (${filtrados.length})`}>
        <div className="toolbar" style={{ marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', display: 'flex', alignItems: 'center' }}>
          <input
            className="field__input"
            placeholder="Buscar por mina o N.° volqueta…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: '16rem' }}
          />
          <select className="field__select" style={{ maxWidth: '11rem' }} value={mineroF} onChange={(e) => setMineroF(e.target.value)}>
            <option value="todos">Todas las minas</option>
            {minas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="segment">
            {ESTADOS.map((e) => (
              <button key={e} className={`segment__btn ${estadoF === e ? 'segment__btn--active' : ''}`} onClick={() => setEstadoF(e)}>
                {e === 'todos' ? 'Todos' : ESTADO_LABELS[e] ?? e}
              </button>
            ))}
          </div>
          <input className="field__input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ maxWidth: '9rem' }} />
          <input className="field__input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ maxWidth: '9rem' }} />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mina / Minero</th>
                <th>N.° Vol.</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Húmedo (t)</th>
                <th style={{ textAlign: 'right' }}>Humedad</th>
                <th style={{ textAlign: 'right' }}>Seco (t)</th>
                <th style={{ textAlign: 'right' }}>Tenor (gr/t)</th>
                <th style={{ textAlign: 'right' }}>Flete</th>
                <th style={{ textAlign: 'right' }}>Valor mat.</th>
                <th>Estado</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin registros</td></tr>
              ) : filtrados.map((m) => {
                const seco  = pesoSeco(m)
                const flete = calcFlete(m)
                const valor = m.tenor > 0 ? calcValorMaterial(m) : null
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.mina}</td>
                    <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta || '—'}</td>
                    <td>{formatDate(m.fecha)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.porcentaje_humedad > 0
                        ? `${(m.porcentaje_humedad * 100).toFixed(1)}%`
                        : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{seco.toFixed(4)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {m.tenor > 0 ? m.tenor.toFixed(1) : <em style={{ color: 'var(--text-faint)' }}>S/A</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {flete != null ? cop(flete) : <em style={{ color: 'var(--text-faint)' }}>S/T</em>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {valor != null ? cop(valor) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${
                        m.estado === 'pendiente'      ? 'badge--warning' :
                        m.estado === 'pagada'         ? 'badge--success' :
                        m.estado === 'en_proceso'     ? 'badge--info'    :
                        m.estado === 'incluida_viaje' ? 'badge--neutral' : 'badge--neutral'
                      }`}>
                        {ESTADO_LABELS[m.estado] ?? m.estado}
                      </span>
                    </td>
                    {canWrite && (
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEditMat(m)} />
                          <Button
                            variant="secondary"
                            size="sm"
                            title={m.tenor === 0 ? 'Sin análisis — agregar' : 'Editar análisis'}
                            icon={<FlaskConical size={14} style={m.tenor === 0 ? { color: 'var(--rose-600)' } : undefined} />}
                            onClick={() => openEditAnal(m)}
                          />
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => deleteMaterial(m.id)} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({filtrados.length})</td>
                <td style={{ textAlign: 'right' }} className="mono">{totalHumedo.toFixed(3)}</td>
                <td />
                <td style={{ textAlign: 'right' }} className="mono">{totalSeco.toFixed(4)}</td>
                <td colSpan={canWrite ? 5 : 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Modal editar material */}
      <Modal open={!!editMat} title={`Editar — ${editMat?.mina ?? ''}`} onClose={() => setEditMat(null)}
        footer={<><Button variant="secondary" onClick={() => setEditMat(null)}>Cancelar</Button><Button onClick={saveEditMat}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Fecha de llegada" type="date" value={formMat.fecha} onChange={(e) => setFormMat((f) => ({ ...f, fecha: e.target.value }))} />
          <Input label="Peso bruto (t)" type="number" step="0.001" value={formMat.peso_llegada_planta} onChange={(e) => setFormMat((f) => ({ ...f, peso_llegada_planta: e.target.value }))} />
        </div>
      </Modal>

      {/* Modal análisis de material (Cabeza) */}
      <Modal open={!!editAnal}
        title={`Análisis — ${editAnal?.mina ?? ''} · N.° ${editAnal?.numero_volqueta ?? ''}`}
        onClose={() => setEditAnal(null)}
        footer={<><Button variant="secondary" onClick={() => setEditAnal(null)}>Cancelar</Button><Button onClick={saveEditAnal}>Guardar</Button></>}>
        {editAnal && (
          <>
            <div className="callout" style={{ marginBottom: '1rem' }}>
              <strong>{editAnal.mina}</strong> · {editAnal.peso_llegada_planta.toFixed(3)} t húm. · {formatDate(editAnal.fecha)}
              {editAnal.tenor > 0 && <> · Tenor actual: {editAnal.tenor.toFixed(1)} gr/t</>}
            </div>
            <div className="grid grid--form">
              <Input label="N° análisis laboratorio" placeholder="AN-12019"
                value={formAnal.numero_analisis} onChange={(e) => setFormAnal((f) => ({ ...f, numero_analisis: e.target.value }))} />
              <Input label="Humedad (%)" type="number" step="0.01" placeholder="Ej: 5.9"
                value={formAnal.porcentaje_humedad} onChange={(e) => setFormAnal((f) => ({ ...f, porcentaje_humedad: e.target.value }))}
                helper="Ej: 5.9 para 5.9%" />
              <Input label="Au total (gramos)" type="number" step="0.1" required placeholder="Ej: 245.5 g"
                value={formAnal.au_concentrado} onChange={(e) => setFormAnal((f) => ({ ...f, au_concentrado: e.target.value }))}
                helper={analPreview?.auGrT ? `→ ${analPreview.auGrT.toFixed(2)} Au gr/t (real)` : undefined} />
              <Input label="Ag total (gramos, opcional)" type="number" step="1" placeholder="Ej: 1200 g"
                value={formAnal.ag_concentrado} onChange={(e) => setFormAnal((f) => ({ ...f, ag_concentrado: e.target.value }))}
                helper={analPreview?.agGrT ? `→ ${analPreview.agGrT.toFixed(1)} Ag gr/t` : undefined} />
              <Input label="Au falso (tenor para pago al minero)" type="number" step="0.1" required placeholder="Ej: 4.5 gr/t"
                value={formAnal.au_falso} onChange={(e) => setFormAnal((f) => ({ ...f, au_falso: e.target.value }))}
                helper="Este tenor es el que se reporta al minero y genera el cálculo del pago" />
              <Input label="Fecha de salida (opcional)" type="date"
                value={formAnal.fecha_salida} onChange={(e) => setFormAnal((f) => ({ ...f, fecha_salida: e.target.value }))} />
              <Input label="Comentarios"
                value={formAnal.comentarios} onChange={(e) => setFormAnal((f) => ({ ...f, comentarios: e.target.value }))} />
            </div>
            {analPreview && analPreview.auGrT && (
              <div className="callout" style={{ marginTop: '1rem', fontWeight: 600 }}>
                T. secas: <strong>{analPreview.tonSec.toFixed(4)} t</strong>
                {' · '}Au gr/t real: <strong>{analPreview.auGrT.toFixed(2)} gr/t</strong>
                {formAnal.au_falso && (
                  <> · Au falso (pago): <strong style={{ color: 'var(--amber-700)' }}>{Number(formAnal.au_falso).toFixed(1)} gr/t</strong></>
                )}
                {analPreview.agGrT && <> · Ag gr/t: <strong>{analPreview.agGrT.toFixed(1)} gr/t</strong></>}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Modal nuevo material */}
      <Modal open={modalNuevo} title="Registrar entrada de material" onClose={() => setModalNuevo(false)}
        footer={<><Button variant="secondary" onClick={() => setModalNuevo(false)}>Cancelar</Button><Button onClick={saveNuevo} disabled={!formNuevo.mina || !formNuevo.peso_llegada_planta}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Select label="Mina / Minero" required
            options={[{ value: '', label: 'Seleccionar…' }, ...minas.map((m) => ({ value: m, label: m }))]}
            value={formNuevo.mina} onChange={(e) => setFormNuevo((f) => ({ ...f, mina: e.target.value }))} />
          <Input label="N.° volqueta" type="number" placeholder="13019"
            value={formNuevo.numero_volqueta} onChange={(e) => setFormNuevo((f) => ({ ...f, numero_volqueta: e.target.value }))} />
          <Input label="Fecha llegada" type="date" required
            value={formNuevo.fecha} onChange={(e) => setFormNuevo((f) => ({ ...f, fecha: e.target.value }))} />
          <Input label="Peso bruto (t)" type="number" step="0.001" placeholder="0.000" required
            value={formNuevo.peso_llegada_planta} onChange={(e) => setFormNuevo((f) => ({ ...f, peso_llegada_planta: e.target.value }))} />
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          El análisis de laboratorio (humedad, tenor) se registra después con el botón 🔬 en la tabla.
        </p>
      </Modal>
    </div>
  )
}
