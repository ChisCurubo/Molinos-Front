// Mismas reglas que valida el backend (archivo.service.ts): PDF, PNG o JPG, máx 10 MB,
// por contenido real del archivo (magic bytes), no por extensión ni Content-Type.
export const COMPROBANTE_MAX_MB = 10
const AVISO_TIPOS = 'Solo se aceptan PDF, PNG o JPG.'

export function validarComprobante(file: File): string | null {
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return AVISO_TIPOS
  if (file.size > COMPROBANTE_MAX_MB * 1024 * 1024) return `El archivo supera ${COMPROBANTE_MAX_MB} MB.`
  return null
}

export const esImagenComprobante = (nombreOUrl: string) => /\.(jpe?g|png)(\?|$)/i.test(nombreOUrl)
