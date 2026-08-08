import {
  tarifasZona, preciosMaterial, MINA_A_ZONA, MINA_A_MINERO,
  type MaterialRow,
} from '@/data/mock'
import { getPrecioAplicable } from '@/utils/format'

/** Toneladas secas = peso húmedo × (1 − humedad). */
export function pesoSeco(m: MaterialRow) {
  return m.peso_llegada_planta * (1 - m.porcentaje_humedad)
}

/** Flete del viaje: usa el guardado, o lo calcula por zona/tonelada. */
export function calcFlete(m: MaterialRow): number | null {
  if (m.valor_flete != null) return m.valor_flete
  const idZona = m.id_zona ?? MINA_A_ZONA[m.mina]
  if (!idZona) return null
  const t = tarifasZona.find(tz => tz.id_zona === idZona)
  return t ? m.peso_llegada_planta * t.valor_tonelada : null
}

/** Precio pactado vigente para el material (según minero y tenor). */
export function precioAplicable(m: MaterialRow) {
  const idMinero = MINA_A_MINERO[m.mina] || undefined
  return getPrecioAplicable(m.tenor, idMinero, preciosMaterial)
}

/** Valor a pagar al minero = ton secas × tenor × precio (por tonelada o por gramo). */
export function calcValorMaterial(m: MaterialRow): number | null {
  const precio = precioAplicable(m)
  if (!precio) return null
  const seco = pesoSeco(m)
  return precio.metodo === 'por_tonelada'
    ? seco * (precio.precio_por_tonelada ?? 0)
    : seco * m.tenor * (precio.precio_por_gramo ?? 0)
}
