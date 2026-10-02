import { useEffect, useState } from 'react'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import { nominaApi } from '@/api/nomina'
import { useEmpleados, type EmpleadosState } from '@/pages/nomina/empleadosShared'
import { CalendarioTab, usePlantas } from './EmpleadosNominaApiPage'

// Solo entra al calendario el personal que se paga por día u hora (turnos
// variables). El personal administrativo (TipoPago FIJO_MENSUAL) no asigna
// turno — solo se marca ausente en los días que no trabaja, y eso se maneja
// en la pestaña "Turnos" de Empleados y nómina, no aquí.
function useEmpleadosConTurno(): EmpleadosState {
  const empleados = useEmpleados()
  const [ids, setIds] = useState<Set<number> | null>(null)

  useEffect(() => {
    if (empleados.loading) return
    if (empleados.data.length === 0) { setIds(new Set()); return }
    let cancelado = false
    Promise.all(empleados.data.map(e =>
      nominaApi.getSalarioActual(e.id)
        .then(s => ({ id: e.id, conTurno: s.tipo_pago !== 'FIJO_MENSUAL' }))
        .catch(() => ({ id: e.id, conTurno: false }))
    )).then(resultados => {
      if (cancelado) return
      setIds(new Set(resultados.filter(r => r.conTurno).map(r => r.id)))
    })
    return () => { cancelado = true }
  }, [empleados.loading, empleados.data])

  return {
    data: ids ? empleados.data.filter(e => ids.has(e.id)) : [],
    loading: empleados.loading || ids === null,
    error: empleados.error,
    reload: empleados.reload,
  }
}

export function CalendarioTurnosApiPage() {
  const canWrite = useCanWrite('finanzas')
  const empleados = useEmpleadosConTurno()
  const plantas = usePlantas()

  return (
    <div className="page">
      <PageHeader
        title="Calendario de turnos"
        subtitle="Solo personal con pago por día u hora. El personal administrativo tiene sueldo fijo y se gestiona desde la pestaña Turnos de Empleados y nómina."
      />
      {!canWrite && <ReadOnlyBanner />}
      <CalendarioTab canWrite={canWrite} empleados={empleados} plantas={plantas} />
    </div>
  )
}
