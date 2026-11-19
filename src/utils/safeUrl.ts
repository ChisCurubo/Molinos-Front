/** Devuelve la URL solo si es http(s); bloquea javascript:, data:, etc. */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url, window.location.origin)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** Abre un enlace externo en pestaña nueva, sin acceso a `window.opener`. */
export function abrirUrl(url: string | null | undefined): void {
  const safe = urlSegura(url)
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer')
}
