import type { Role } from '@/types'

// ============================================================
// Control de acceso estricto por rol
// ============================================================
// Administrador (David): solo lectura absoluta.
// Materiales (Vicky): gestión completa de materiales.
// Financiero (Juliana): pagos, turnos, nóminas y finanzas.
// ============================================================

export type ModuleKey =
  | 'dashboard'
  | 'materiales'
  | 'finanzas'
  | 'nomina'
  | 'usuarios'
  | 'powerbi'
  | 'planta'

export interface RoleProfile {
  label: string
  descripcion: string
  /** Módulos visibles en la navegación */
  modules: ModuleKey[]
  /** true = puede crear/editar/eliminar. false = solo lectura. */
  canWrite: (module: ModuleKey) => boolean
}

const ALL_MODULES: ModuleKey[] = [
  'dashboard',
  'materiales',
  'finanzas',
  'nomina',
  'usuarios',
  'powerbi',
  'planta',
]

export const ROLES: Record<Role, RoleProfile> = {
  administrador: {
    label: 'Administrador',
    descripcion: 'Lectura total del sistema. Gestión de usuarios y calendario de planta.',
    modules: ALL_MODULES,
    canWrite: (m) => m === 'usuarios' || m === 'planta',
  },
  materiales: {
    label: 'Materiales',
    descripcion: 'Gestión de entradas de material, laboratorio, viajes, producción y pagos de material.',
    modules: ['dashboard', 'materiales', 'powerbi'],
    canWrite: (m) => m === 'materiales',
  },
  financiero: {
    label: 'Financiero',
    descripcion: 'Pagos operativos, cuentas, préstamos, turnos y nómina.',
    modules: ['dashboard', 'finanzas', 'nomina', 'powerbi'],
    canWrite: (m) => m === 'finanzas' || m === 'nomina',
  },
}

export function canWrite(role: Role, module: ModuleKey): boolean {
  return ROLES[role].canWrite(module)
}

export function canView(role: Role, module: ModuleKey): boolean {
  return ROLES[role].modules.includes(module)
}
