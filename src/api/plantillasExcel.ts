// Excel de Plantillas generados en el BACKEND (docs/frontend/EXCEL_PLANTILLAS_BACKEND.md del repo back).
// Éxito = el archivo (no `{ success, data }`); error = JSON estándar. Va por axios autenticado (cookie) + blob.

import { isAxiosError } from 'axios'
import { http } from './client'

const TIMEOUT_MS = 60_000 // el timeout global (8 s) no alcanza para un año completo

async function descargarExcel(ruta: string, params: Record<string, unknown>): Promise<void> {
  let r
  try {
    r = await http.get<Blob>(ruta, { params, responseType: 'blob', timeout: TIMEOUT_MS })
  } catch (e) {
    // Con responseType blob el JSON de error llega como Blob: se parsea para que apiError() lo lea normal.
    if (isAxiosError(e) && e.response?.data instanceof Blob) {
      try { e.response.data = JSON.parse(await e.response.data.text()) } catch { /* cuerpo no JSON: apiError usa el fallback por status */ }
    }
    throw e
  }
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(r.headers['content-disposition'] ?? ''))?.[1]
  const url = URL.createObjectURL(r.data)
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre ? decodeURIComponent(nombre) : 'reporte.xlsx' })
  a.click()
  URL.revokeObjectURL(url)
}

export const descargarCosteoAnual = (anio: number, viajes: 'despachados' | 'todos' = 'despachados') =>
  descargarExcel('/material/plantillas/costeo-anual', { anio, viajes })

export const descargarReporteViajes = (f: { ids?: number[]; desde?: string; hasta?: string; maquila?: string; id_minero?: number }) =>
  descargarExcel('/material/reportes/viajes/excel', { ...f, ids: f.ids?.length ? f.ids.join(',') : undefined })
