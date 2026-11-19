// Hook simple de catálogo "cuentas bancarias" — mismo patrón que
// useCategoriasCxp/useCategoriasCxc (sin caché cross-componente: cada
// montaje pide su propio listado, es liviano y rara vez cambia en pantalla).
import { useCallback, useEffect, useState } from 'react'
import { pagosCuentasApi, type CuentaBancaria } from '@/api/pagosCuentas'

export function useCuentasBancarias() {
  const [data, setData] = useState<CuentaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    pagosCuentasApi.listar().then(r => setData(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}
