// Tabla de amortización (sistema francés: cuota fija)

export interface FilaAmortizacion {
  mes: number
  cuota: number
  interes: number
  abonoCapital: number
  saldo: number
}

export function calcularCuota(capital: number, tasaMensualPct: number, plazoMeses: number): number {
  const r = tasaMensualPct / 100
  if (r === 0) return capital / plazoMeses
  return (capital * r) / (1 - Math.pow(1 + r, -plazoMeses))
}

export function tablaAmortizacion(
  capital: number,
  tasaMensualPct: number,
  plazoMeses: number,
): FilaAmortizacion[] {
  const r = tasaMensualPct / 100
  const cuota = calcularCuota(capital, tasaMensualPct, plazoMeses)
  const filas: FilaAmortizacion[] = []
  let saldo = capital
  for (let mes = 1; mes <= plazoMeses; mes++) {
    const interes = saldo * r
    const abonoCapital = cuota - interes
    saldo = Math.max(0, saldo - abonoCapital)
    filas.push({
      mes,
      cuota: Math.round(cuota),
      interes: Math.round(interes),
      abonoCapital: Math.round(abonoCapital),
      saldo: Math.round(saldo),
    })
  }
  return filas
}
