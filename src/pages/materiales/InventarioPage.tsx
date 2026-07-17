import { useNavigate } from 'react-router-dom'
import { ArrowRight, Package, Layers } from 'lucide-react'
import { Button, Card, KpiTile } from '@/components/ui'
import { PageHeader } from '@/components/common/Page'
import { formatCOP, formatDate } from '@/utils/format'
import { useMateriales } from '@/context/MaterialesContext'

const cop = formatCOP

export function InventarioPage() {
  const navigate = useNavigate()
  const { materiales, lotes } = useMateriales()

  const crudo = materiales.filter(
    m => (m.estado === 'pagada' || m.estado === 'pendiente') && m.lote === null,
  )
  const concentrado = lotes.filter(l => l.toneladas_disponibles > 0)

  const totalCrudoHum = crudo.reduce((s, m) => s + m.peso_llegada_planta, 0)
  const totalCrudoSec = crudo.reduce((s, m) => s + m.total_material_seco, 0)
  const totalConcHum  = concentrado.reduce((s, l) => s + l.toneladas_disponibles, 0)
  const totalMaquila  = concentrado.reduce((s, l) => s + l.maquila_total, 0)

  return (
    <div className="page">
      <PageHeader
        title="Inventario"
        subtitle="Material crudo disponible y concentrado en canoa listo para despacho."
      />

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Entradas sin lote"     value={crudo.length}              accent="amber"   />
        <KpiTile label="T. húm. crudo"         value={`${totalCrudoHum.toFixed(2)} t`} accent="brown" />
        <KpiTile label="Lotes en canoa"        value={concentrado.length}        accent="green"   />
        <KpiTile label="T. húm. disponibles"   value={`${totalConcHum.toFixed(2)} t`}  accent="emerald" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Panel A — Material crudo */}
        <Card
          title={`Material crudo pendiente (${crudo.length})`}
          actions={
            <Button size="sm" variant="secondary" icon={<Layers size={14}/>}
              onClick={() => navigate('/materiales/procesamiento')}>
              Ir a Procesamiento
              <ArrowRight size={13} style={{ marginLeft: 4 }} />
            </Button>
          }>
          {crudo.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No hay material crudo pendiente de procesar.
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vol.</th><th>Mina</th><th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>T. Húm.</th>
                      <th style={{ textAlign: 'right' }}>T. Seco</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crudo.map(m => (
                      <tr key={m.id}>
                        <td className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{m.numero_volqueta}</td>
                        <td style={{ fontWeight: 600 }}>{m.mina}</td>
                        <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(m.fecha)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{m.peso_llegada_planta.toFixed(3)} t</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)' }} className="mono">
                          {m.total_material_seco.toFixed(4)} t
                        </td>
                        <td>
                          <span className={`badge badge--${m.estado === 'pagada' ? 'success' : 'warning'}`}>
                            {m.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={3}>Total ({crudo.length})</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalCrudoHum.toFixed(3)} t</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalCrudoSec.toFixed(4)} t</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Para procesar: ve a <strong>Procesamiento</strong> → crear o abrir un lote → vincular materiales.
              </p>
            </>
          )}
        </Card>

        {/* Panel B — Concentrado disponible */}
        <Card
          title={`Concentrado disponible (${concentrado.length} lotes)`}
          actions={
            <Button size="sm" icon={<Package size={14}/>}
              onClick={() => navigate('/materiales/viajes-material')}>
              Crear viaje
              <ArrowRight size={13} style={{ marginLeft: 4 }} />
            </Button>
          }>
          {concentrado.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No hay concentrado disponible en canoa.
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Código</th><th>Canoa</th>
                      <th style={{ textAlign: 'right' }}>T. Húm. Disp.</th>
                      <th style={{ textAlign: 'right' }}>Maquila</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concentrado.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 700 }} className="mono">{l.codigo}</td>
                        <td style={{ fontSize: 'var(--fs-sm)' }}>{l.ubicacion_canoa ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-700)' }} className="mono">
                          {l.toneladas_disponibles.toFixed(2)} t
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">
                          {l.maquila_total > 0 ? cop(l.maquila_total) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${
                            l.estado === 'en_canoa' ? 'badge--info'
                            : l.estado === 'parcialmente_enviado' ? 'badge--warning'
                            : 'badge--neutral'
                          }`}>
                            {l.estado === 'en_canoa' ? 'En canoa'
                              : l.estado === 'parcialmente_enviado' ? 'Parcial'
                              : l.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={2}>Total ({concentrado.length})</td>
                      <td style={{ textAlign: 'right' }} className="mono">{totalConcHum.toFixed(2)} t</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(totalMaquila)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Para despachar: ve a <strong>Viajes material</strong> → nuevo viaje → seleccionar lotes.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
