import * as XLSX from 'xlsx'

const MONEY = '#,##0'
const DEC = '#,##0.0000'

function addr(col: string, row0: number) {
  return `${col}${row0 + 1}`
}

/** Hoja "Detalle por volqueta": tabla en blanco (30 filas) + totales + abonos/saldo, con las
 * mismas fórmulas que se calculaban a mano en los archivos de viajes/cuentas de minero. */
function buildDetalleSheet(): XLSX.WorkSheet {
  const header = [
    'N° Volqueta', 'Fecha', 'Minero / Mina', 'Peso llega planta (t)', '% Humedad',
    'Gramos humedad (t)', 'Tenor (gr/t)', 'Total material seco (t)', 'Total gramos',
    'Precio por gramo', 'Precio por tonelada', 'Precio total', 'Excedente', 'Total',
  ]
  const DATA_ROWS = 30
  const titleRow0 = 0
  const headerRow0 = 2
  const dataStart0 = headerRow0 + 1
  const dataEnd0 = dataStart0 + DATA_ROWS - 1
  const totalRow0 = dataEnd0 + 1
  const abonosHeaderRow0 = totalRow0 + 3
  const abonosDataStart0 = abonosHeaderRow0 + 1
  const ABONOS_ROWS = 6
  const abonosDataEnd0 = abonosDataStart0 + ABONOS_ROWS - 1
  const saldoRow0 = abonosDataEnd0 + 1

  const aoa: (string | number)[][] = []
  aoa[titleRow0] = ['MATERIAL — [MINERO / VIAJE] — [MES O N° DE VIAJE]']
  aoa[headerRow0] = header
  for (let r = dataStart0; r <= dataEnd0; r++) aoa[r] = new Array(header.length).fill('')
  aoa[totalRow0] = ['TOTAL', ...new Array(header.length - 1).fill('')]
  aoa[abonosHeaderRow0] = ['ABONOS Y SALDO']
  aoa[abonosHeaderRow0 + 1] = ['Fecha', 'Concepto', 'Valor (negativo = abono, positivo = cargo)']
  for (let r = abonosDataStart0; r <= abonosDataEnd0; r++) aoa[r] = ['', '', '']
  aoa[saldoRow0] = ['', 'SALDO PENDIENTE', '']

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: titleRow0, c: 0 }, e: { r: titleRow0, c: header.length - 1 } }]
  ws['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 14) }))

  for (let r = dataStart0; r <= dataEnd0; r++) {
    const row = r + 1
    ws[addr('F', r)] = { t: 'n', f: `D${row}*E${row}`, z: DEC }
    ws[addr('H', r)] = { t: 'n', f: `D${row}-F${row}`, z: DEC }
    ws[addr('I', r)] = { t: 'n', f: `H${row}*G${row}`, z: DEC }
    ws[addr('L', r)] = { t: 'n', f: `IF(J${row}>0,I${row}*J${row},H${row}*K${row})`, z: MONEY }
    ws[addr('N', r)] = { t: 'n', f: `L${row}+M${row}`, z: MONEY }
  }
  const totalRow = totalRow0 + 1
  ;(['D', 'F', 'H', 'I', 'L', 'M', 'N'] as const).forEach((c) => {
    ws[addr(c, totalRow0)] = { t: 'n', f: `SUM(${c}${dataStart0 + 1}:${c}${dataEnd0 + 1})`, z: c === 'L' || c === 'N' ? MONEY : DEC }
  })

  ws[addr('C', saldoRow0)] = {
    t: 'n',
    f: `N${totalRow}+SUM(C${abonosDataStart0 + 1}:C${abonosDataEnd0 + 1})`,
    z: MONEY,
  }

  return ws
}

function buildIdentidadSheet(): XLSX.WorkSheet {
  const aoa = [
    ['Nombre minero / mina', 'Mina / zona', 'Teléfono', 'Observaciones'],
    ...Array.from({ length: 15 }, () => ['', '', '', '']),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 30 }]
  return ws
}

function buildInstruccionesSheet(): XLSX.WorkSheet {
  const lineas = [
    ['PLANTILLA DE MATERIAL — VIAJE / CUENTA DE MINERO'],
    [''],
    ['1. Duplica la pestaña "Detalle por volqueta" por cada viaje, minero o mes nuevo'],
    ['   (clic derecho sobre la pestaña → Mover o copiar → Crear una copia) y renómbrala,'],
    ['   ej. "15.1 NAUM" o "OMAR MARZO". Puedes crear tantas pestañas como necesites.'],
    [''],
    ['2. Llena solo: N° volqueta, fecha, minero/mina, peso, % humedad, tenor y el precio'],
    ['   (por gramo o por tonelada, el que corresponda). Las demás columnas se calculan solas.'],
    [''],
    ['3. Registra los abonos en la tabla "ABONOS Y SALDO" de abajo (como negativo, ej. -3000000);'],
    ['   el saldo pendiente se actualiza solo.'],
    [''],
    ['4. Usa la pestaña "Identidad clientes" para que el nombre del minero/mina quede igual'],
    ['   en todas las pestañas del archivo.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(lineas)
  ws['!cols'] = [{ wch: 80 }]
  return ws
}

/** Genera y descarga la plantilla en blanco de material (viaje / cuenta de minero). */
export function descargarPlantillaMaterial() {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildInstruccionesSheet(), 'Instrucciones')
  XLSX.utils.book_append_sheet(wb, buildDetalleSheet(), 'Detalle por volqueta')
  XLSX.utils.book_append_sheet(wb, buildIdentidadSheet(), 'Identidad clientes')
  XLSX.writeFile(wb, 'plantilla-material-viaje.xlsx')
}
