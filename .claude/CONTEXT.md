# CONTEXT — ERP Molinos de Colombia S.A.S

> Documento de arquitectura y contexto de negocio para el equipo de desarrollo y para Claude Code.
> Versión: julio 2026. Actualizar cuando cambie la arquitectura o las reglas de negocio.

---

## 1. ¿Qué es esta aplicación?

ERP frontend para **Molinos de Colombia S.A.S**, una planta de beneficio de minerales que procesa
roca aurífera (oro y plata). La planta recibe material de mineros, lo procesa en concentrado y lo
despacha en viajes a refinerías/compradores.

El sistema gestiona **tres grandes áreas**:
1. **Materiales** — recepción, análisis, procesamiento, concentrado, inventario, viajes, viajes de agua.
2. **Finanzas y pagos** — cuentas por pagar/cobrar, préstamos financieros.
3. **Nómina** — empleados, quincenas, turnos, préstamos a empleados.

**Estado actual:** Frontend 100% funcional con datos mock. El backend (Node/MySQL) existe pero
la integración API está pendiente. Todo funciona offline con `src/data/mock.ts`.

---

## 2. Tecnología

```
React 18 + TypeScript 5.6 + Vite 5.4
react-router-dom v6   → rutas SPA con ProtectedRoute
lucide-react          → íconos (no usar otras librerías de íconos)
recharts              → gráficos en páginas de informes
CSS puro              → sin Tailwind, sin MUI, sin styled-components
fetch nativo          → sin axios (ver src/api/withFallback.ts)
localStorage          → persistencia de datos mock + sesión
```

**Alias de importación:** `@/` mapea a `src/`. Usar siempre en lugar de rutas relativas largas.

```typescript
import { Button } from '@/components/ui'
import { formatCOP } from '@/utils/format'
import type { MaterialRow } from '@/data/mock'
```

---

## 3. Estructura de archivos

```
src/
├── App.tsx                    router principal + todas las rutas
├── main.tsx                   entrada de la app
│
├── api/
│   └── withFallback.ts        wrapper fetch + AbortController + timeout
│
├── auth/
│   └── permissions.ts         ROLES map, canWrite(), canView(), ModuleKey
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx         variantes: primary|secondary|ghost, tamaños: sm|md|lg
│   │   ├── Card.tsx           props: title, subtitle, actions (ReactNode)
│   │   ├── Input.tsx          props: label, helper, error, type, ...HTMLInput
│   │   ├── Select.tsx         props: label, options[{value,label}], helper
│   │   ├── Modal.tsx          props: open, title, onClose, footer
│   │   ├── KpiTile.tsx        props: label, value, icon?, accent (ver §7)
│   │   ├── Badge.tsx          clases CSS: badge--success|warning|info|neutral
│   │   ├── Checkbox.tsx
│   │   ├── FileDropzone.tsx
│   │   ├── InfoCallout.tsx
│   │   ├── CardList.tsx
│   │   └── index.ts           re-exporta todo (usar: import { X } from '@/components/ui')
│   │
│   ├── layout/
│   │   ├── AppLayout.tsx      layout principal (TopBar + Sidebar + <Outlet/>)
│   │   ├── TopBar.tsx         barra superior: logo 44px, toggle sidebar, accesibilidad
│   │   ├── Sidebar.tsx        nav lateral: grupos por módulo, NavLink activos
│   │   ├── ProtectedRoute.tsx comprueba rol con canView(); redirige a /sin-acceso
│   │   └── AccessibilityMenu.tsx control tamaño letra + alto contraste
│   │
│   └── common/
│       ├── Page.tsx           PageHeader (title+subtitle+actions), ReadOnlyBanner
│       └── CrudManager.tsx    tabla genérica con alta/edición/borrado (usado en catálogos)
│
├── context/
│   ├── AuthContext.tsx         useAuth() → {user, login, logout}. "JWT" simulado en localStorage
│   ├── DataContext.tsx         useData() → datos globales + reset(). Persiste en localStorage
│   └── AccessibilityContext.tsx useAccessibility() → {fontSize, contrast, setFontSize, ...}
│
├── data/
│   └── mock.ts                FUENTE ÚNICA DE DATOS. Interfaces + arrays de datos reales de BD.
│                              Helpers: inventarioCrudo, inventarioConcentrado, calc4x1000
│
├── hooks/
│   └── usePermissions.ts      useCanWrite(module), useCanView(module)
│
├── pages/
│   ├── auth/                  LoginPage, ForgotPasswordPage, ResetPasswordPage
│   ├── dashboard/             DashboardPage, AdminDashboard (tabs por módulo)
│   ├── materiales/            → ver §5
│   ├── finanzas/              → ver §5
│   ├── nomina/                → ver §5
│   ├── usuarios/              UsuariosPage (CRUD de cuentas)
│   ├── powerbi/               InformesPage (iframe Power BI)
│   └── NoAccessPage.tsx       página 403
│
├── styles/
│   ├── tokens.css             variables CSS: colores, fuentes, espaciado, radios, sombras
│   └── base.css               reset + clases utilitarias (grid, badge, segment, table, etc.)
│
├── types/
│   └── index.ts               Role, Mina, Minero, Zona (tipos compartidos entre contextos)
│
└── utils/
    └── format.ts              formatCOP, formatDate, todayISO, getPrecioAplicable, calc4x1000
```

---

## 4. Roles y permisos

Definidos en `src/auth/permissions.ts`.

| Rol | Label | canWrite | Módulos visibles |
|-----|-------|----------|-----------------|
| `administrador` | Administrador | solo `usuarios` | todos |
| `materiales` | Materiales | solo `materiales` | dashboard, materiales, powerbi |
| `financiero` | Financiero | `finanzas` y `nomina` | dashboard, finanzas, nomina, powerbi |

**Regla de escritura:** `useCanWrite('materiales')` devuelve `true` solo si el rol tiene permiso.
Todos los botones de creación/edición/eliminación se condicionan con `{canWrite && <Button...>}`.

El Administrador (David) ve todo en modo solo lectura. Excepción: puede gestionar usuarios.

---

## 5. Módulos y sus páginas

### 5.1 Materiales (`/materiales/*`)

**Flujo de negocio — 5 etapas:**

```
ETAPA 1            ETAPA 2          ETAPA 3                ETAPA 4          ETAPA 5
Recepción      →   Análisis     →   Crear lote         →   Cerrar lote  →   Viaje
EntradasPage       AnalisisPage     ConcentradoPage        ConcentradoPage  ConcentradoPage
                                    (tab Lotes)            (tab Lotes)      (tab Viajes)
```

**Páginas:**

`EntradasPage` (`/materiales/entradas`)
- Tabla de `MaterialRow[]` (material_planta_entrada en BD)
- Cada fila puede no tener análisis → ícono 🔬 en rojo si `tenor === 0`
- Modal "Análisis" llena: numero_analisis, humedad%, Au gr/t, Ag gr/t → calcula peso seco
- Al guardar análisis: actualiza `porcentaje_humedad`, `tenor`, `total_material_seco` en la fila
- Modal "Nuevo material": mina, dueño volqueta, fecha, peso bruto
- Estados: `pendiente | pagada | en_proceso | incluida_viaje`

`AnalisisPage` (`/materiales/analisis`)
- Tabla de `AnalisisRow[]` (tabla analisis en BD)
- Dos tipos: `id_entrada != null` → Planta/Cabeza; `id_material_concentrado != null` → Concentrado
- Edición de: numero_analisis, humedad, Au, Ag, fecha_salida, estado_pago, comentarios
- Filtros: búsqueda + segment (todos/planta/concentrado)

`ConcentradoPage` (`/materiales/concentrado`)
- 4 tabs: Lotes concentrado | Inventario | Kardex/Movimientos | Viajes de material
- **Lotes tab:**
  - Estado `en_proceso`: botones "Procesar" (vincular materiales) y "Cerrar" (capturar ton + humedad)
  - Estado `en_canoa`: botón "Análisis" (registrar análisis concentrado tipo 2)
  - Botón "Crear lote": seleccionar código + fecha + procesos aplicados
- **Inventario tab:**
  - Panel A: material crudo disponible (estado pagada/pendiente sin lote)
  - Panel B: concentrado en canoa (toneladas_disponibles > 0)
- **Viajes tab:**
  - Wizard 2 pasos: 1) datos viaje, 2) seleccionar lotes con cantidades
  - Al guardar: decrementa `toneladas_disponibles`, actualiza estado lote
  - Si sobran toneladas: prompt para crear lote remanente

`ViajesAguaPage` (`/materiales/viajes`)
- Tabla de `AguaRow[]` (agua_planta en BD)
- Campos: conductor, fecha, valor_viaje, cantidad_viajes, acpm
- `valor_total` es **campo GENERADO** en BD → NO enviarlo en POST/PUT
- Fórmula: `valor_total = (valor_viaje × cantidad_viajes) - acpm`

`CatalogosPage` (`/materiales/zonas`)
- 3 tabs principales:
  - **Dueños de volqueta:** CRUD con campos bancarios (titular, CC, banco, numero_cuenta, alias, nequi)
  - **Precios / Tarifas:** sub-tabs "Precio por tenor" y "Tarifa de flete por zona"
  - **Catálogos:** zonas, minas, mineros (vía CrudManager)

### 5.2 Finanzas (`/finanzas/*`)

`FinanzasPage` — cuentas por pagar (flete, material, maquila) y por cobrar.
`PrestamosFinancierosPage` — préstamos financieros a terceros.
`InformesFinanzasPage` — resúmenes financieros.
`JulianaPage` — panel personal (rol financiero).

### 5.3 Nómina (`/nomina/*`)

`NominaPage` — 3 tabs:
- **Empleados** — lista de 33 empleados reales con salario quincenal
- **Quincenas** — liquidación quincena a quincena. Requiere comprobante para `estado=liquidado`
- **Préstamos** — tabla con barra de progreso + detalle de pagos (expandible por fila)

`CalendarioTurnosPage` — calendario de turnos diurnos/nocturnos.
`InformesNominaPage` — reportes.

---

## 6. Datos mock (`src/data/mock.ts`)

### Interfaces principales

```typescript
MaterialRow {
  id, numero_volqueta, mina, id_minero?, id_zona?, fecha,
  peso_llegada_planta,   // toneladas húmedas
  porcentaje_humedad,    // decimal: 0.059 = 5.9%
  tenor,                 // Au gr/t
  total_material_seco,   // = peso_llegada_planta × (1 - porcentaje_humedad)
  estado: 'pendiente'|'pagada'|'en_proceso'|'incluida_viaje',
  lote: string | null
}

AnalisisRow {
  id, id_entrada: number|null, id_material_concentrado: number|null,
  numero_analisis, ton, porcentaje_humedad, toneladas_humedas, toneladas_secas,
  au_gr_x_ton, au_falso, ag_gr_x_ton, au_concentrado, ag_concentrado,
  fecha_salida, comentarios,
  estado_pago: 'no_aplica'|'pendiente'|'pagado'
}

LoteConcentrado {
  id, codigo, fecha_inicio, fecha_fin,
  hizo_molienda, hizo_flotacion, hizo_relave?, hizo_filtroprensa,
  toneladas_humedo, porcentaje_humedad, toneladas_seco, toneladas_disponibles,
  ubicacion_canoa, precio_maquila_por_ton, maquila_total,
  material_seco_procesado?,   // suma de toneladas secas vinculadas
  estado: 'en_proceso'|'en_canoa'|'parcialmente_enviado'|'enviado_completo',
  comentarios
}

ViajeRow { id, numero_viaje, fecha, maquila, total_costo_material, lineas: LineaViaje[] }
LineaViaje { id, concepto, lote, concentrado_humedo, concentrado_seco, costo_maquila, valor_total }

DuenoVolqueta { id, nombre, titular?, cc?, banco?, numero_cuenta?, alias?, telefono?, nequi?, estado }

PrecioMaterial {
  id, metodo: 'por_tonelada'|'por_gramo',
  precio_por_tonelada?, precio_por_gramo?,
  tenor_min, tenor_max, id_minero?, id_zona?,
  fecha_inicio, fecha_fin?, activo?
}

AguaRow {
  id, id_dueno, conductor, fecha, valor_viaje, cantidad_viajes, acpm,
  valor_total   // CAMPO GENERADO en BD — no enviar en POST
}
```

### Datos catálogo incluidos
- `preciosMaterial` — 13 tramos de precio (por tonelada y por gramo)
- `tarifasZona` — 4 zonas con tarifa por tonelada
- `zonas` — 6 zonas geográficas
- `mineros` — 13 mineros reales
- `duenosVolqueta` — 11 dueños con datos bancarios reales
- `materialesMock` — ~30 entradas reales de material
- `lotesConcentrado` — ~11 lotes históricos + 2 activos (1 en_canoa, 1 en_proceso)
- `viajesMock` — 3 viajes históricos completos con líneas
- `analisisMock` — 14 registros de análisis reales
- `empleados` — 33 empleados reales con labor y salario
- `aguaMock` — 34 registros de viajes de agua reales
- `MINA_A_ZONA` / `MINA_A_MINERO` — mappings para calcular flete y precio

---

## 7. Design system

### Colores de acento (KpiTile, badges)
```typescript
type Accent = 'green' | 'brown' | 'emerald' | 'rose' | 'amber'
// NOTA: 'info' NO es un Accent válido para KpiTile
// Para badges sí existe: badge--info, badge--success, badge--warning, badge--neutral
```

**Nunca usar azul. Nunca degradados morados.**

### Clases CSS reutilizables (definidas en `base.css`)

```css
/* Layout de páginas */
.page               /* contenedor principal de cada página */
.grid.grid--kpi     /* fila de KpiTiles (auto-fill, min 10rem) */
.grid.grid--form    /* grilla de formulario (2 cols) */

/* Tabla */
.table-wrap         /* overflow-x: auto */
.data-table         /* tabla estilizada */

/* Navegación por tabs */
.segment            /* contenedor de botones de tab */
.segment__btn       /* botón de tab */
.segment__btn--active

/* Badges de estado */
.badge              /* base */
.badge--success     /* verde */
.badge--warning     /* ámbar */
.badge--info        /* teal */
.badge--neutral     /* slate */

/* Texto */
.mono               /* JetBrains Mono (placas, IDs, montos) */
```

### Patrón de página estándar

```tsx
export function MiPagina() {
  const canWrite = useCanWrite('materiales')

  return (
    <div className="page">
      <PageHeader title="Título" subtitle="Subtítulo" actions={canWrite && <Button>...</Button>} />
      {!canWrite && <ReadOnlyBanner />}

      <div className="grid grid--kpi" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label="Total" value={n} accent="brown" />
        ...
      </div>

      <Card title="Tabla (N)">
        <div className="table-wrap">
          <table className="data-table">...</table>
        </div>
      </Card>

      <Modal open={!!editItem} title="Editar" onClose={() => setEditItem(null)}
        footer={<><Button variant="secondary" onClick={() => setEditItem(null)}>Cancelar</Button>
                  <Button onClick={save}>Guardar</Button></>}>
        <div className="grid grid--form">
          <Input label="Campo" value={fp.campo} onChange={e => setFp(f => ({...f, campo: e.target.value}))} />
        </div>
      </Modal>
    </div>
  )
}
```

---

## 8. Reglas críticas de negocio

### Cálculos de material
```
peso_seco            = peso_llegada_planta × (1 - porcentaje_humedad)
flete                = peso_seco × tarifa_zona.valor_tonelada
valor_material_ton   = peso_seco × precio_por_tonelada
valor_material_gramo = peso_seco × tenor × precio_por_gramo
```

### Precios por tenor (`getPrecioAplicable`)
Busca precio en `preciosMaterial` respetando esta jerarquía:
1. Precio con `id_minero` exacto que cubra el rango de tenor → prioridad
2. Precio sin minero (general) que cubra el rango
3. `undefined` → mostrar '—' en tabla

### Lotes de concentrado
```
Crear lote    → estado = 'en_proceso', toneladas_humedo = 0
Procesar mat  → material.estado = 'en_proceso'; lote.material_seco_procesado += suma
Cerrar lote   → ton_humedo ingresado; ton_seco = ton_humedo×(1-hum)
              → maquila = material_seco_procesado × precio_maquila_por_ton
              → estado = 'en_canoa'; toneladas_disponibles = ton_humedo (HÚMEDAS)
Despacho      → toneladas_disponibles -= ton_salida
              → si disponibles=0 → 'enviado_completo'; si >0 → 'parcialmente_enviado'
Remanente     → nuevo lote en_canoa con maquila=0; lote original → enviado_completo
```

**Invariante crítica:** `toneladas_disponibles` **siempre en toneladas HÚMEDAS**.
Si se guarda en secas, el inventario queda incorrecto.

### Análisis tipos
- `id_tipo_analisis = 1` → Cabeza (análisis de roca que llegó, vinculado a `id_entrada`)
- `id_tipo_analisis = 2` → Concentrado (análisis del concentrado producido, vinculado a `id_material_concentrado`)

### Nómina
```
cuota_quincenal = valor_total / (cuotas_mensuales × 2)
Estado 'liquidado' requiere comprobante — validar en frontend antes de permitir cambio
```

### Viajes de agua
```
agua_planta.valor_total = (valor_viaje × cantidad_viajes) - acpm
```
Este campo es **GENERADO** en la BD (columna computed). **No enviarlo** en el cuerpo del POST/PUT.

### Remanentes en viajes
- Maquila de remanente = 0 (ya fue cobrada en el primer envío del lote)
- El remanente crea un lote nuevo en `en_canoa` directamente (no pasa por `en_proceso`)
- `id_viaje_origen` debe apuntar al viaje que generó el remanente

---

## 9. Patrones de código

### Estado de formulario con un updater tipado

```typescript
const [fp, setFp] = useState({ campo1: '', campo2: '' })
const f = (k: keyof typeof fp, v: string) => setFp(s => ({...s, [k]: v}))
// Uso: onChange={e => f('campo1', e.target.value)}
```

### Keyed fragments para pares de `<tr>`

```tsx
import React from 'react'  // necesario para React.Fragment con key

{items.map(item => (
  <React.Fragment key={item.id}>
    <tr>...</tr>
    <tr>...</tr>  {/* fila expandible */}
  </React.Fragment>
))}
```

### Tabla con acciones condicionales

```tsx
<thead><tr>
  <th>Campo</th>
  {canWrite && <th></th>}
</tr></thead>
<tbody>{items.map(item => (
  <tr key={item.id}>
    <td>{item.campo}</td>
    {canWrite && <td>
      <Button size="sm" icon={<Pencil size={14}/>} onClick={() => openEdit(item)} />
    </td>}
  </tr>
))}</tbody>
<tfoot><tr>
  <td>Total</td>
  <td colSpan={canWrite ? 2 : 1} />
</tr></tfoot>
```

### Fetch con withFallback

```typescript
import { withFallback } from '@/api/withFallback'

const data = await withFallback(
  fetch('/api/endpoint', { signal }),
  fallbackData  // datos mock si el backend no responde
)
```

---

## 10. Rutas de la aplicación

```
/                           → DashboardPage / AdminDashboard
/materiales                 → redirige a /materiales/volquetas
/materiales/entradas        → EntradasPage
/materiales/analisis        → AnalisisPage
/materiales/concentrado     → ConcentradoPage
/materiales/viajes          → ViajesAguaPage
/materiales/zonas           → CatalogosPage
/materiales/volquetas       → VolquetasPage
/materiales/informes        → InformesMaterialPage
/finanzas                   → FinanzasPage
/finanzas/prestamos         → PrestamosFinancierosPage
/finanzas/informes          → InformesFinanzasPage
/nomina                     → NominaPage
/nomina/calendario          → CalendarioTurnosPage
/nomina/informes            → InformesNominaPage
/usuarios                   → UsuariosPage
/informes                   → InformesPage (Power BI)
/login                      → LoginPage
/recuperar                  → ForgotPasswordPage
/restablecer                → ResetPasswordPage
/sin-acceso                 → NoAccessPage
/victoria                   → VictoriaPage (alias materiales para Vicky)
/juliana                    → JulianaPage (alias finanzas para Juliana)
```

Todas las rutas autenticadas están dentro de `<AppLayout>` y envueltas en `<ProtectedRoute module="...">`.

---

## 11. Variables de entorno

No se usan variables de entorno en el frontend actual (todo mock).
Cuando se integre el backend, agregar a `.env`:

```
VITE_API_URL=https://api.molinosdecolombia.com
```

Y usar como:
```typescript
const API = import.meta.env.VITE_API_URL
```

---

## 12. Checklist para agregar un módulo nuevo

1. Crear página en `src/pages/<modulo>/MiPagina.tsx`
2. Importar y agregar ruta en `src/App.tsx` con `<ProtectedRoute module="...">`
3. Agregar nav item en `src/components/layout/Sidebar.tsx` (importar ícono de lucide)
4. Si es un módulo nuevo: agregar `ModuleKey` en `src/auth/permissions.ts` y actualizar ROLES
5. Agregar tipos en `src/data/mock.ts` y datos mock
6. Si hay cálculos: agregar helpers en `src/utils/format.ts`
7. Correr `npm run lint` (tsc --noEmit) — debe pasar sin errores antes de commitear
