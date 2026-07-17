// Cálculos de laboratorio y liquidación de material

// Precio internacional de referencia (mock) — COP por gramo de oro
export const PRECIO_AU_GRAMO = 280000

export interface CalculoLiquidacion {
  toneladasSecas: number
  contenidoAu: number // gramos de oro estimados
  liquidacion: number // pago al material (COP)
  flete: number // flete a pagar (COP)
}

/**
 * Calcula toneladas secas, contenido de oro y valores a pagar.
 * @param pesoBrutoTon peso bruto en toneladas
 * @param humedadPct % de humedad
 * @param tenor tenor en g/ton
 * @param tarifaTon tarifa de flete por tonelada de la zona
 * @param factorPago fracción del valor del oro reconocida al minero (0-1)
 */
export function calcularLiquidacion(
  pesoBrutoTon: number,
  humedadPct: number,
  tenor: number,
  tarifaTon: number,
  factorPago = 0.7,
): CalculoLiquidacion {
  const toneladasSecas = +(pesoBrutoTon * (1 - humedadPct / 100)).toFixed(3)
  const contenidoAu = +(toneladasSecas * tenor).toFixed(2)
  const valorAu = contenidoAu * PRECIO_AU_GRAMO
  const liquidacion = Math.round(valorAu * factorPago)
  const flete = Math.round(pesoBrutoTon * tarifaTon)
  return { toneladasSecas, contenidoAu, liquidacion, flete }
}
