import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { MaterialesProvider } from '@/context/MaterialesContext'
import { AccessibilityProvider } from '@/context/AccessibilityContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
import { ProtectedRoute, AuthLoading } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CatalogosApiPage } from '@/pages/materiales/CatalogosApiPage'
import { VolquetasApiPage } from '@/pages/materiales/VolquetasApiPage'
import { EntradasApiPage } from '@/pages/materiales/EntradasApiPage'
import { AnalisisApiPage } from '@/pages/materiales/AnalisisApiPage'
import { ViajesAguaApiPage } from '@/pages/materiales/ViajesAguaApiPage'
import { ProcesamientoApiPage } from '@/pages/materiales/ProcesamientoApiPage'
import { InventarioApiPage } from '@/pages/materiales/InventarioApiPage'
import { InventarioProductosApiPage } from '@/pages/materiales/InventarioProductosApiPage'
import { ViajesMaterialApiPage } from '@/pages/materiales/ViajesMaterialApiPage'
import { PagoMaterialApiPage } from '@/pages/materiales/PagoMaterialApiPage'
import { PagoMulasApiPage } from '@/pages/materiales/PagoMulasApiPage'
import { PlantillasMaterialPage } from '@/pages/materiales/PlantillasMaterialPage'
import { CxPApiPage } from '@/pages/finanzas/CxPApiPage'
import { CxCApiPage } from '@/pages/finanzas/CxCApiPage'
import { CombustibleApiPage } from '@/pages/finanzas/CombustibleApiPage'
import { AnticiposApiPage } from '@/pages/finanzas/AnticiposApiPage'
import { ProveedoresApiPage } from '@/pages/finanzas/ProveedoresApiPage'
import { EmpleadosNominaApiPage } from '@/pages/finanzas/EmpleadosNominaApiPage'
import { CalendarioTurnosApiPage } from '@/pages/finanzas/CalendarioTurnosApiPage'
import { PrestamosFinancierosApiPage } from '@/pages/finanzas/PrestamosFinancierosApiPage'
import { AlquileresApiPage } from '@/pages/finanzas/AlquileresApiPage'
import { TesoreriaApiPage } from '@/pages/finanzas/TesoreriaApiPage'
import { ImpuestosApiPage } from '@/pages/finanzas/ImpuestosApiPage'
import {
  ImportacionesPage, GastosPuertoPage, TransfiguraPage, AdelantosImportacionesPage, RegaliasPage,
} from '@/pages/importaciones/ImportacionesWip'
import { InversionPlantaPage } from '@/pages/importaciones/InversionPlantaPage'
import { NominaPage } from '@/pages/nomina/NominaPage'
import { CalendarioTurnosPage } from '@/pages/nomina/CalendarioTurnosPage'
import { InformesNominaPage } from '@/pages/nomina/InformesNominaPage'
import { CalendarioPlantaPage } from '@/pages/planta/CalendarioPlantaPage'
import { UsuariosPage } from '@/pages/usuarios/UsuariosPage'
import { InformesPage } from '@/pages/powerbi/InformesPage'
import { GeneradorPowerBIPage } from '@/pages/powerbi/GeneradorPowerBIPage'
import { NoAccessPage } from '@/pages/NoAccessPage'
import { ToastProvider } from '@/components/ui'
import type { ReactNode } from 'react'

/** Redirige al panel si ya hay sesión (para /login, /recuperar, etc.). */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth()
  if (initializing) return <AuthLoading />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/recuperar" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/reset-password" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />
      <Route path="/restablecer" element={<Navigate to="/reset-password" replace />} />
      <Route path="/cambiar-password" element={<ChangePasswordPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<ProtectedRoute module="dashboard"><DashboardPage /></ProtectedRoute>} />

        {/* Materiales */}
        <Route path="/materiales" element={<Navigate to="/materiales/entradas-api" replace />} />
        <Route path="/materiales/catalogos-api" element={<ProtectedRoute module="materiales"><CatalogosApiPage /></ProtectedRoute>} />
        <Route path="/materiales/volquetas-api" element={<ProtectedRoute module="materiales"><VolquetasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/entradas-api" element={<ProtectedRoute module="materiales"><EntradasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/analisis-api" element={<ProtectedRoute module="materiales"><AnalisisApiPage /></ProtectedRoute>} />
        <Route path="/materiales/concentrado"    element={<Navigate to="/materiales/procesamiento-api" replace />} />
        <Route path="/materiales/viajes-agua-api" element={<ProtectedRoute module="materiales"><ViajesAguaApiPage /></ProtectedRoute>} />
        <Route path="/materiales/procesamiento-api" element={<ProtectedRoute module="materiales"><ProcesamientoApiPage /></ProtectedRoute>} />
        <Route path="/materiales/inventario-api" element={<ProtectedRoute module="materiales"><InventarioApiPage /></ProtectedRoute>} />
        <Route path="/materiales/inventario-productos-api" element={<ProtectedRoute module="materiales"><InventarioProductosApiPage /></ProtectedRoute>} />
        <Route path="/materiales/viajes-material-api" element={<ProtectedRoute module="materiales"><ViajesMaterialApiPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-material-api" element={<ProtectedRoute module="materiales"><PagoMaterialApiPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-mulas-api" element={<ProtectedRoute module="materiales"><PagoMulasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/reporte-viaje" element={<Navigate to="/materiales/plantillas" replace />} />
        <Route path="/materiales/plantillas" element={<ProtectedRoute module="materiales"><PlantillasMaterialPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-agua-api" element={<Navigate to="/materiales/viajes-agua-api" replace />} />
        <Route path="/materiales/pago-flete-api" element={<Navigate to="/materiales/volquetas-api" replace />} />

        {/* Pagos y finanzas */}
        <Route path="/finanzas" element={<Navigate to="/finanzas/cxp-api" replace />} />
        <Route path="/finanzas/cxp-api" element={<ProtectedRoute module="finanzas"><CxPApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/cxc-api" element={<ProtectedRoute module="finanzas"><CxCApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/combustible-api" element={<ProtectedRoute module="finanzas"><CombustibleApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/anticipos-api" element={<ProtectedRoute module="finanzas"><AnticiposApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/proveedores-api" element={<ProtectedRoute module="finanzas"><ProveedoresApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/nominas-api" element={<ProtectedRoute module="finanzas"><EmpleadosNominaApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/calendario-turnos-api" element={<ProtectedRoute module="finanzas"><CalendarioTurnosApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/prestamos-api" element={<ProtectedRoute module="finanzas"><PrestamosFinancierosApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/alquileres-api" element={<ProtectedRoute module="finanzas"><AlquileresApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/tesoreria-api" element={<ProtectedRoute module="finanzas"><TesoreriaApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/impuestos-api" element={<ProtectedRoute module="finanzas"><ImpuestosApiPage /></ProtectedRoute>} />

        {/* Importaciones (Angela) */}
        <Route path="/importaciones" element={<ProtectedRoute module="importaciones"><ImportacionesPage /></ProtectedRoute>} />
        <Route path="/importaciones/puerto" element={<ProtectedRoute module="importaciones"><GastosPuertoPage /></ProtectedRoute>} />
        <Route path="/importaciones/transfigura" element={<ProtectedRoute module="importaciones"><TransfiguraPage /></ProtectedRoute>} />
        <Route path="/importaciones/adelantos" element={<ProtectedRoute module="importaciones"><AdelantosImportacionesPage /></ProtectedRoute>} />
        <Route path="/importaciones/regalias" element={<ProtectedRoute module="importaciones"><RegaliasPage /></ProtectedRoute>} />
        <Route path="/importaciones/inversion-planta" element={<ProtectedRoute module="importaciones"><InversionPlantaPage /></ProtectedRoute>} />

        {/* Nómina */}
        <Route path="/nomina" element={<ProtectedRoute module="nomina"><NominaPage /></ProtectedRoute>} />
        <Route path="/nomina/calendario" element={<ProtectedRoute module="nomina"><CalendarioTurnosPage /></ProtectedRoute>} />
        <Route path="/nomina/informes" element={<ProtectedRoute module="nomina"><InformesNominaPage /></ProtectedRoute>} />
        <Route path="/nomina/empleados-api" element={<Navigate to="/finanzas/nominas-api" replace />} />

        {/* Planta y producción */}
        <Route path="/planta/calendario" element={<ProtectedRoute module="planta"><CalendarioPlantaPage /></ProtectedRoute>} />

        {/* Administración */}
        <Route path="/usuarios" element={<ProtectedRoute module="usuarios"><UsuariosPage /></ProtectedRoute>} />
        <Route path="/informes" element={<ProtectedRoute module="powerbi"><InformesPage /></ProtectedRoute>} />
        <Route path="/powerbi/generador" element={<ProtectedRoute module="powerbi"><GeneradorPowerBIPage /></ProtectedRoute>} />
        <Route path="/sin-acceso" element={<NoAccessPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AccessibilityProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <MaterialesProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </MaterialesProvider>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </AccessibilityProvider>
  )
}
