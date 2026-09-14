// ════════════════════════════════════════════════════════════════════════════
// ⚠️  MOCK — Estado, pago y análisis de VIAJES DE MATERIAL
// ────────────────────────────────────────────────────────────────────────────
// El backend real (`/material/viajes`) todavía NO expone estos campos:
//   · estado del viaje (abierto / cerrado / enviado)
//   · fecha de salida (se fija al marcar "enviado")
//   · análisis asociados a un viaje
//
// NOTA: el pago del material NO se maneja aquí. Eso va en el módulo de material
// (con abonos) como un paso posterior.
//
// Mientras el backend los implementa, esto los simula en el front y los
// persiste en localStorage para que sobrevivan recargas. Imita la forma de la
// API real (funciones async que devuelven Promises) para que migrar a los
// endpoints reales sea cambiar estas llamadas por `materialApi.*`.
//
// Ver docs/viajes_material_mock.md para el detalle y el plan de reemplazo.
// ════════════════════════════════════════════════════════════════════════════

export type ViajeEstado = 'abierto' | 'cerrado' | 'enviado'

export interface AnalisisViaje {
  id: number
  numero_analisis: string
  porcentaje_humedad: number | null
  au_gr_x_ton: number | null
  ag_gr_x_ton: number | null
  comentarios: string | null
  created_at: string
}

export interface ViajeMetaMock {
  estado: ViajeEstado
  /** Fecha (YYYY-MM-DD) en que el viaje se marcó "enviado"; null si aún no sale. */
  fecha_salida: string | null
  analisis: AnalisisViaje[]
}

const KEY = 'mock:viajes-material-meta'
type Store = Record<number, ViajeMetaMock>

function read(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { return {} }
}
function write(s: Store) { localStorage.setItem(KEY, JSON.stringify(s)) }

const defaultMeta = (): ViajeMetaMock => ({ estado: 'abierto', fecha_salida: null, analisis: [] })
const hoy = () => new Date().toISOString().slice(0, 10)

// Pequeña latencia para parecerse a una llamada de red real.
const wait = <T>(v: T) => new Promise<T>(res => setTimeout(() => res(v), 100))

export const viajesMaterialMock = {
  getMeta(id: number): Promise<ViajeMetaMock> {
    return wait(read()[id] ?? defaultMeta())
  },
  setEstado(id: number, estado: ViajeEstado): Promise<ViajeMetaMock> {
    const s = read(); const prev = s[id] ?? defaultMeta()
    // La fecha de salida se fija al enviar y se limpia al reabrir/revertir.
    const fecha_salida = estado === 'enviado' ? (prev.fecha_salida ?? hoy()) : null
    const m = { ...prev, estado, fecha_salida }; s[id] = m; write(s)
    return wait(m)
  },
  addAnalisis(id: number, a: Omit<AnalisisViaje, 'id' | 'created_at'>): Promise<ViajeMetaMock> {
    const s = read(); const prev = s[id] ?? defaultMeta()
    const nuevo: AnalisisViaje = { ...a, id: Date.now(), created_at: new Date().toISOString() }
    const m = { ...prev, analisis: [...prev.analisis, nuevo] }; s[id] = m; write(s)
    return wait(m)
  },
  deleteAnalisis(id: number, analisisId: number): Promise<ViajeMetaMock> {
    const s = read(); const prev = s[id] ?? defaultMeta()
    const m = { ...prev, analisis: prev.analisis.filter(x => x.id !== analisisId) }; s[id] = m; write(s)
    return wait(m)
  },
}
