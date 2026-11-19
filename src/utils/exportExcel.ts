import * as XLSX from 'xlsx'

export interface ExcelColumn<T> {
  key: string
  label: string
  /** Si no se da, toma row[key]. */
  value?: (row: T) => string | number | null | undefined
  format?: 'integer' | 'decimal' | 'money'
  /** Si agrupas en pestañas, esta columna se suma en la hoja "Resumen". */
  summable?: boolean
}

export interface ExportOptions<T> {
  /** Si se da, crea una pestaña por cada valor distinto + una pestaña "Resumen" con los totales. */
  groupBy?: (row: T) => string
}

const NUM_FORMAT: Record<NonNullable<ExcelColumn<unknown>['format']>, string> = {
  integer: '#,##0',
  decimal: '#,##0.0000',
  money: '#,##0',
}

function buildSheet<T>(columns: ExcelColumn<T>[], rows: T[]): XLSX.WorkSheet {
  const header = columns.map((c) => c.label)
  const data = rows.map((row) =>
    columns.map((c) => {
      const raw = c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]
      return raw ?? ''
    }),
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...data])

  ws['!cols'] = columns.map((c, i) => {
    const maxLen = Math.max(c.label.length, ...data.map((r) => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) }
  })

  columns.forEach((c, ci) => {
    if (!c.format) return
    const fmt = NUM_FORMAT[c.format]
    for (let r = 0; r < data.length; r++) {
      const addr = XLSX.utils.encode_cell({ r: r + 1, c: ci })
      const cell = ws[addr]
      if (cell && typeof cell.v === 'number') cell.z = fmt
    }
  })

  if (data.length > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: columns.length - 1 } }),
    }
  }
  return ws
}

/** Excel no permite "\ / ? * [ ] :" en nombres de pestaña, ni más de 31 caracteres, ni duplicados. */
function sheetName(base: string, used: Set<string>): string {
  const clean = base.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja'
  let final = clean
  let i = 2
  while (used.has(final.toLowerCase())) {
    const suffix = ` (${i++})`
    final = clean.slice(0, 31 - suffix.length) + suffix
  }
  used.add(final.toLowerCase())
  return final
}

/**
 * Exporta filas seleccionadas a un .xlsx con columnas, anchos y formato numérico.
 * Con `groupBy`, crea una pestaña por cada valor distinto (p. ej. por minero o por viaje) más
 * una pestaña "Resumen" con el conteo y las sumas de las columnas `summable`. Así, si entran más
 * viajes/mineros a la selección, simplemente aparecen más pestañas — no hay que tocar nada.
 */
export function exportToExcel<T>(filename: string, columns: ExcelColumn<T>[], rows: T[], opts?: ExportOptions<T>) {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()

  if (!opts?.groupBy) {
    XLSX.utils.book_append_sheet(wb, buildSheet(columns, rows), sheetName('Datos', used))
  } else {
    const groups = new Map<string, T[]>()
    rows.forEach((r) => {
      const key = opts.groupBy!(r) || 'Sin grupo'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    })

    const summableCols = columns.filter((c) => c.summable)
    if (summableCols.length > 0) {
      type GroupEntry = [string, T[]]
      const resumenCols: ExcelColumn<GroupEntry>[] = [
        { key: 'grupo', label: 'Grupo', value: ([k]) => k },
        { key: 'registros', label: 'Registros', format: 'integer', value: ([, items]) => items.length },
        ...summableCols.map((c) => ({
          key: c.key,
          label: c.label,
          format: c.format,
          value: ([, items]: GroupEntry) =>
            items.reduce((s, r) => {
              const v = c.value ? c.value(r) : (r as Record<string, unknown>)[c.key]
              return s + (typeof v === 'number' ? v : 0)
            }, 0),
        })),
      ]
      XLSX.utils.book_append_sheet(wb, buildSheet(resumenCols, [...groups.entries()]), sheetName('Resumen', used))
    }

    for (const [key, items] of groups) {
      XLSX.utils.book_append_sheet(wb, buildSheet(columns, items), sheetName(key, used))
    }
  }

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
