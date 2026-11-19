import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, Boxes, ListTree, Pencil, Plus, RefreshCw, Trash2,
} from 'lucide-react'
import { Button, Card, Input, Modal, Select, KpiTile, useToast } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal'
import { useCanWrite } from '@/hooks/usePermissions'
import { apiError } from '@/api/client'
import { num } from '@/api/material'
import { formatCOP, formatDate, todayISO } from '@/utils/format'
import {
  inventarioProductosApi, CATEGORIA_LABEL,
  type Producto, type MovimientoProducto, type CategoriaProducto, type ResumenInventarioProductos,
} from '@/api/inventarioProductos'

const cop = formatCOP

const CATEGORIA_OPTIONS = Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({ value, label }))

const RESUMEN_VACIO: ResumenInventarioProductos = {
  total_productos: 0, valor_total_inventario: 0, productos_bajo_minimo: 0, gastado_en_compras: 0,
}

export function InventarioProductosApiPage() {
  const canWrite = useCanWrite('materiales')
  const toast = useToast()

  const [productos, setProductos] = useState<Producto[]>([])
  const [resumen, setResumen] = useState<ResumenInventarioProductos>(RESUMEN_VACIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([inventarioProductosApi.listProductos(), inventarioProductosApi.getResumen()])
      .then(([p, r]) => { setProductos(p); setResumen(r) })
      .catch((e) => setError(apiError(e).message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // ── Modal: nuevo / editar producto ──────────────────────
  const [modalProducto, setModalProducto] = useState<'nueva' | Producto | null>(null)
  const [fNombre, setFNombre] = useState('')
  const [fCategoria, setFCategoria] = useState<CategoriaProducto>('quimico')
  const [fUnidad, setFUnidad] = useState('')
  const [fMinimo, setFMinimo] = useState('')
  const [savingProducto, setSavingProducto] = useState(false)

  const abrirNuevoProducto = () => {
    setFNombre(''); setFCategoria('quimico'); setFUnidad(''); setFMinimo('0')
    setModalProducto('nueva')
  }
  const abrirEditarProducto = (p: Producto) => {
    setFNombre(p.nombre); setFCategoria(p.categoria); setFUnidad(p.unidad); setFMinimo(String(num(p.stock_minimo)))
    setModalProducto(p)
  }
  const guardarProducto = async () => {
    if (!fNombre.trim() || !fUnidad.trim()) { toast.error('Nombre y unidad son obligatorios.'); return }
    const vals = { nombre: fNombre.trim(), categoria: fCategoria, unidad: fUnidad.trim(), stock_minimo: Number(fMinimo) || 0 }
    setSavingProducto(true)
    try {
      if (modalProducto === 'nueva') await inventarioProductosApi.crearProducto(vals)
      else if (modalProducto) await inventarioProductosApi.actualizarProducto(modalProducto.id, vals)
      setModalProducto(null)
      load()
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setSavingProducto(false)
    }
  }

  // ── Eliminar producto ────────────────────────────────────
  const [borrando, setBorrando] = useState<Producto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmarBorrar = async () => {
    if (!borrando) return
    setDeleting(true)
    try {
      await inventarioProductosApi.eliminarProducto(borrando.id)
      setBorrando(null)
      load()
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Modal: registrar movimiento (entrada/salida) ─────────
  const [modalMov, setModalMov] = useState<{ producto: Producto; tipo: 'entrada' | 'salida' } | null>(null)
  const [mFecha, setMFecha] = useState(todayISO())
  const [mCantidad, setMCantidad] = useState('')
  const [mCosto, setMCosto] = useState('')
  const [mNota, setMNota] = useState('')
  const [mErr, setMErr] = useState('')
  const [savingMov, setSavingMov] = useState(false)

  const abrirMovimiento = (producto: Producto, tipo: 'entrada' | 'salida') => {
    setMFecha(todayISO()); setMCantidad(''); setMCosto(''); setMNota(''); setMErr('')
    setModalMov({ producto, tipo })
  }
  const guardarMovimiento = async () => {
    const cantidad = Number(mCantidad)
    if (!cantidad || cantidad <= 0) { setMErr('Ingresa una cantidad válida.'); return }
    if (modalMov!.tipo === 'entrada' && (!mCosto || Number(mCosto) <= 0)) { setMErr('Ingresa el costo unitario de compra.'); return }
    const stockActual = num(modalMov!.producto.stock_actual)
    if (modalMov!.tipo === 'salida' && cantidad > stockActual) {
      setMErr(`No hay suficiente stock (disponible: ${stockActual}).`); return
    }
    setSavingMov(true)
    try {
      await inventarioProductosApi.registrarMovimiento({
        id_producto: modalMov!.producto.id,
        fecha: mFecha,
        tipo: modalMov!.tipo,
        cantidad,
        costo_unitario: modalMov!.tipo === 'entrada' ? Number(mCosto) : undefined,
        nota: mNota || undefined,
      })
      setModalMov(null)
      load()
    } catch (e) {
      setMErr(apiError(e).message)
    } finally {
      setSavingMov(false)
    }
  }

  // ── Modal: kardex de un producto ──────────────────────────
  const [kardexDe, setKardexDe] = useState<Producto | null>(null)
  const [filasKardex, setFilasKardex] = useState<MovimientoProducto[]>([])
  const [kardexLoading, setKardexLoading] = useState(false)

  const abrirKardex = (p: Producto) => {
    setKardexDe(p)
    setKardexLoading(true)
    inventarioProductosApi.listMovimientos({ id_producto: p.id })
      .then(setFilasKardex)
      .catch((e) => toast.error(apiError(e).message))
      .finally(() => setKardexLoading(false))
  }

  const valorTotalInventario = num(resumen.valor_total_inventario)
  const gastoTotalCompras = num(resumen.gastado_en_compras)

  return (
    <div className="page">
      <PageHeader
        title="Inventario de productos"
        subtitle="Insumos que almacenamos: químicos, bolas de molino, filtroprensa y repuestos — stock y gasto con cardex."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refrescar</Button>
            {canWrite && <Button size="sm" icon={<Plus size={16} />} onClick={abrirNuevoProducto}>Nuevo producto</Button>}
          </>
        }
      />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Productos"          value={resumen.total_productos}     icon={<Boxes size={16} />}         accent="brown"   />
        <KpiTile label="Valor en inventario" value={cop(valorTotalInventario)}  icon={<ArrowUpCircle size={16} />} accent="emerald" />
        <KpiTile label="Bajo mínimo"         value={resumen.productos_bajo_minimo} icon={<ArrowDownCircle size={16} />} accent="rose" />
        <KpiTile label="Gastado en compras"  value={cop(gastoTotalCompras)}     icon={<ListTree size={16} />}      accent="amber"   />
      </div>

      <Card title={`Productos (${productos.length})`}>
        {error ? (
          <p style={{ textAlign: 'center', color: 'var(--rose-600)', padding: '2rem 0' }}>
            {error} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--amber-700)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
          </p>
        ) : loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Cargando…</p>
        ) : productos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            Sin productos registrados todavía.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Costo prom.</th>
                  <th style={{ textAlign: 'right' }}>Valor stock</th>
                  {canWrite && <th style={{ textAlign: 'right' }}></th>}
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const stockActual = num(p.stock_actual)
                  const costoProm = num(p.costo_promedio)
                  const bajo = stockActual < num(p.stock_minimo)
                  return (
                    <tr key={p.id} style={bajo ? { background: 'var(--rose-50, #fff1f2)' } : undefined}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>Mínimo: {num(p.stock_minimo)} {p.unidad}</div>
                      </td>
                      <td><span className="badge badge--neutral">{CATEGORIA_LABEL[p.categoria]}</span></td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        <span style={{ fontWeight: 700, color: bajo ? 'var(--rose-600)' : undefined }}>{stockActual}</span> {p.unidad}
                        {bajo && <div><span className="badge badge--danger" style={{ fontSize: '0.6rem' }}>BAJO MÍNIMO</span></div>}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{costoProm > 0 ? cop(costoProm) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(p.valor_stock))}</td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button size="sm" icon={<ArrowUpCircle size={14} />} onClick={() => abrirMovimiento(p, 'entrada')}>Entrada</Button>
                            <Button size="sm" variant="secondary" icon={<ArrowDownCircle size={14} />} onClick={() => abrirMovimiento(p, 'salida')}>Salida</Button>
                            <Button size="sm" variant="ghost" icon={<ListTree size={14} />} aria-label="Ver kardex" onClick={() => abrirKardex(p)} />
                            <Button size="sm" variant="secondary" icon={<Pencil size={14} />} aria-label="Editar" onClick={() => abrirEditarProducto(p)} />
                            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label="Eliminar" onClick={() => setBorrando(p)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>Total ({productos.length})</td>
                  <td style={{ textAlign: 'right' }} className="mono">{cop(valorTotalInventario)}</td>
                  {canWrite && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: nuevo/editar producto ── */}
      <Modal open={modalProducto !== null} title={modalProducto === 'nueva' ? 'Nuevo producto' : 'Editar producto'}
        onClose={() => setModalProducto(null)}
        footer={<><Button variant="secondary" onClick={() => setModalProducto(null)}>Cancelar</Button><Button onClick={guardarProducto} disabled={savingProducto}>{savingProducto ? 'Guardando…' : 'Guardar'}</Button></>}>
        <div className="grid grid--form">
          <Input label="Nombre" value={fNombre} onChange={(e) => setFNombre(e.target.value)} required style={{ gridColumn: '1/-1' }} />
          <Select label="Categoría" options={CATEGORIA_OPTIONS} value={fCategoria} onChange={(e) => setFCategoria(e.target.value as CategoriaProducto)} />
          <Input label="Unidad de medida" placeholder="kg, L, unidad…" value={fUnidad} onChange={(e) => setFUnidad(e.target.value)} required />
          <Input label="Stock mínimo (alerta)" type="number" value={fMinimo} onChange={(e) => setFMinimo(e.target.value)} />
        </div>
      </Modal>

      {/* ── Modal: registrar movimiento ── */}
      <Modal open={modalMov !== null} title={`${modalMov?.tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'} — ${modalMov?.producto.nombre ?? ''}`}
        onClose={() => setModalMov(null)}
        footer={<><Button variant="secondary" onClick={() => setModalMov(null)}>Cancelar</Button><Button onClick={guardarMovimiento} disabled={savingMov}>{savingMov ? 'Guardando…' : 'Guardar'}</Button></>}>
        {modalMov && (
          <div className="stack">
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              Stock actual: <strong>{num(modalMov.producto.stock_actual)} {modalMov.producto.unidad}</strong>
            </p>
            <div className="grid grid--form">
              <Input label="Fecha" type="date" value={mFecha} onChange={(e) => setMFecha(e.target.value)} />
              <Input label={`Cantidad (${modalMov.producto.unidad})`} type="number" value={mCantidad} onChange={(e) => setMCantidad(e.target.value)} required />
              {modalMov.tipo === 'entrada' && (
                <Input label="Costo unitario de compra" type="number" value={mCosto} onChange={(e) => setMCosto(e.target.value)} required />
              )}
              <Input label="Nota (opcional)" value={mNota} onChange={(e) => setMNota(e.target.value)} style={{ gridColumn: '1/-1' }} />
            </div>
            {mErr && <p style={{ color: 'var(--rose-600)', fontSize: 'var(--fs-sm)' }}>⚠ {mErr}</p>}
          </div>
        )}
      </Modal>

      {/* ── Modal: kardex ── */}
      <Modal open={kardexDe !== null} title={`Kardex — ${kardexDe?.nombre ?? ''}`} onClose={() => setKardexDe(null)}
        footer={<Button variant="secondary" onClick={() => setKardexDe(null)}>Cerrar</Button>}>
        {kardexDe && (
          kardexLoading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Cargando…</p>
          ) : filasKardex.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Sin movimientos todavía.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Costo unit.</th>
                    <th style={{ textAlign: 'right' }}>Costo total</th>
                    <th style={{ textAlign: 'right' }}>Saldo cant.</th>
                    <th style={{ textAlign: 'right' }}>Saldo valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filasKardex.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontSize: 'var(--fs-sm)' }}>{formatDate(f.fecha)}</td>
                      <td>
                        <span className={`badge ${f.tipo === 'entrada' ? 'badge--success' : 'badge--warning'}`}>
                          {f.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(f.cantidad)} {kardexDe.unidad}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{cop(num(f.costo_unitario))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(f.costo_total))}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{num(f.saldo_cantidad)} {kardexDe.unidad}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{cop(num(f.saldo_valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Modal>

      <ConfirmDeleteModal
        open={borrando !== null}
        title="Borrar producto"
        itemLabel={borrando?.nombre}
        message="Se borrará también todo su historial de movimientos (kardex)."
        loading={deleting}
        onCancel={() => setBorrando(null)}
        onConfirm={confirmarBorrar}
      />
    </div>
  )
}
