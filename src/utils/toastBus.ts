// Pequeño pub/sub para avisar desde fuera de React (p. ej. client.ts, que no tiene
// acceso al contexto de ToastProvider) cuando el backend guarda un registro pero no
// pudo subir el archivo ("advertencia" en la respuesta 200/201).
type Listener = (message: string) => void
const listeners = new Set<Listener>()

export function onToastWarning(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitToastWarning(message: string): void {
  listeners.forEach(fn => fn(message))
}
