import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { MaterialesProvider } from '@/context/MaterialesContext'
import { AccessibilityProvider } from '@/context/AccessibilityContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, AuthLoading } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { MaterialesDashboard } from '@/pages/materiales/MaterialesDashboard'
import { VolquetasPage } from '@/pages/materiales/VolquetasPage'
import { CatalogosPage } from '@/pages/materiales/CatalogosPage'
import { CatalogosApiPage } from '@/pages/materiales/CatalogosApiPage'
import { VolquetasApiPage } from '@/pages/materiales/VolquetasApiPage'
import { EntradasPage } from '@/pages/materiales/EntradasPage'
import { EntradasApiPage } from '@/pages/materiales/EntradasApiPage'
import { AnalisisApiPage } from '@/pages/materiales/AnalisisApiPage'
import { AnalisisPage } from '@/pages/materiales/AnalisisPage'
import { ViajesAguaPage } from '@/pages/materiales/ViajesAguaPage'
import { ViajesAguaApiPage } from '@/pages/materiales/ViajesAguaApiPage'
import { InformesMaterialPage } from '@/pages/materiales/InformesMaterialPage'
import { ProcesamientoPage } from '@/pages/materiales/ProcesamientoPage'
import { ProcesamientoApiPage } from '@/pages/materiales/ProcesamientoApiPage'
import { InventarioPage } from '@/pages/materiales/InventarioPage'
import { InventarioApiPage } from '@/pages/materiales/InventarioApiPage'
import { ViajesMaterialPage } from '@/pages/materiales/ViajesMaterialPage'
import { ViajesMaterialApiPage } from '@/pages/materiales/ViajesMaterialApiPage'
import { MulasPage } from '@/pages/materiales/MulasPage'
import { PagoMaterialPage } from '@/pages/materiales/PagoMaterialPage'
import { PagoMaterialApiPage } from '@/pages/materiales/PagoMaterialApiPage'
import { PagoMulasApiPage } from '@/pages/materiales/PagoMulasApiPage'
import { FinanzasPage } from '@/pages/finanzas/FinanzasPage'
import { PrestamosFinancierosPage } from '@/pages/finanzas/PrestamosFinancierosPage'
import { InformesFinanzasPage } from '@/pages/finanzas/InformesFinanzasPage'
import { CuentasPorCobrarPage } from '@/pages/finanzas/CuentasPorCobrarPage'
import { CxPApiPage } from '@/pages/finanzas/CxPApiPage'
import { CxCApiPage } from '@/pages/finanzas/CxCApiPage'
import { CombustibleApiPage } from '@/pages/finanzas/CombustibleApiPage'
import { AnticiposApiPage } from '@/pages/finanzas/AnticiposApiPage'
import { ProveedoresApiPage } from '@/pages/finanzas/ProveedoresApiPage'
import { EmpleadosNominaApiPage } from '@/pages/finanzas/EmpleadosNominaApiPage'
import { CalendarioTurnosApiPage } from '@/pages/finanzas/CalendarioTurnosApiPage'
import { PrestamosFinancierosApiPage } from '@/pages/finanzas/PrestamosFinancierosApiPage'
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
      <Route path="/restablecer" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<ProtectedRoute module="dashboard"><DashboardPage /></ProtectedRoute>} />

        {/* Materiales */}
        <Route path="/materiales" element={<ProtectedRoute module="materiales"><MaterialesDashboard /></ProtectedRoute>} />
        <Route path="/materiales/volquetas" element={<ProtectedRoute module="materiales"><VolquetasPage /></ProtectedRoute>} />
        <Route path="/materiales/zonas" element={<ProtectedRoute module="materiales"><CatalogosPage /></ProtectedRoute>} />
        <Route path="/materiales/catalogos-api" element={<ProtectedRoute module="materiales"><CatalogosApiPage /></ProtectedRoute>} />
        <Route path="/materiales/volquetas-api" element={<ProtectedRoute module="materiales"><VolquetasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/entradas" element={<ProtectedRoute module="materiales"><EntradasPage /></ProtectedRoute>} />
        <Route path="/materiales/entradas-api" element={<ProtectedRoute module="materiales"><EntradasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/analisis-api" element={<ProtectedRoute module="materiales"><AnalisisApiPage /></ProtectedRoute>} />
        <Route path="/materiales/analisis" element={<ProtectedRoute module="materiales"><AnalisisPage /></ProtectedRoute>} />
        <Route path="/materiales/concentrado"    element={<Navigate to="/materiales/procesamiento" replace />} />
        <Route path="/materiales/procesamiento"  element={<ProtectedRoute module="materiales"><ProcesamientoPage /></ProtectedRoute>} />
        <Route path="/materiales/inventario"     element={<ProtectedRoute module="materiales"><InventarioPage /></ProtectedRoute>} />
        <Route path="/materiales/viajes-material" element={<ProtectedRoute module="materiales"><ViajesMaterialPage /></ProtectedRoute>} />
        <Route path="/materiales/viajes" element={<ProtectedRoute module="materiales"><ViajesAguaPage /></ProtectedRoute>} />
        <Route path="/materiales/viajes-agua-api" element={<ProtectedRoute module="materiales"><ViajesAguaApiPage /></ProtectedRoute>} />
        <Route path="/materiales/procesamiento-api" element={<ProtectedRoute module="materiales"><ProcesamientoApiPage /></ProtectedRoute>} />
        <Route path="/materiales/inventario-api" element={<ProtectedRoute module="materiales"><InventarioApiPage /></ProtectedRoute>} />
        <Route path="/materiales/viajes-material-api" element={<ProtectedRoute module="materiales"><ViajesMaterialApiPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-material-api" element={<ProtectedRoute module="materiales"><PagoMaterialApiPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-mulas-api" element={<ProtectedRoute module="materiales"><PagoMulasApiPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-agua-api" element={<Navigate to="/materiales/viajes-agua-api" replace />} />
        <Route path="/materiales/pago-flete-api" element={<Navigate to="/materiales/volquetas-api" replace />} />
        <Route path="/materiales/mulas" element={<ProtectedRoute module="materiales"><MulasPage /></ProtectedRoute>} />
        <Route path="/materiales/pago-material" element={<ProtectedRoute module="materiales"><PagoMaterialPage /></ProtectedRoute>} />
        <Route path="/materiales/informes" element={<ProtectedRoute module="materiales"><InformesMaterialPage /></ProtectedRoute>} />

        {/* Pagos y finanzas */}
        <Route path="/finanzas" element={<ProtectedRoute module="finanzas"><FinanzasPage /></ProtectedRoute>} />
        <Route path="/finanzas/cobrar" element={<ProtectedRoute module="finanzas"><CuentasPorCobrarPage /></ProtectedRoute>} />
        <Route path="/finanzas/prestamos" element={<ProtectedRoute module="finanzas"><PrestamosFinancierosPage /></ProtectedRoute>} />
        <Route path="/finanzas/informes" element={<ProtectedRoute module="finanzas"><InformesFinanzasPage /></ProtectedRoute>} />
        <Route path="/finanzas/cxp-api" element={<ProtectedRoute module="finanzas"><CxPApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/cxc-api" element={<ProtectedRoute module="finanzas"><CxCApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/combustible-api" element={<ProtectedRoute module="finanzas"><CombustibleApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/anticipos-api" element={<ProtectedRoute module="finanzas"><AnticiposApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/proveedores-api" element={<ProtectedRoute module="finanzas"><ProveedoresApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/nominas-api" element={<ProtectedRoute module="finanzas"><EmpleadosNominaApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/calendario-turnos-api" element={<ProtectedRoute module="finanzas"><CalendarioTurnosApiPage /></ProtectedRoute>} />
        <Route path="/finanzas/prestamos-api" element={<ProtectedRoute module="finanzas"><PrestamosFinancierosApiPage /></ProtectedRoute>} />

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
