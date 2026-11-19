# ERP — Molinos de Colombia S.A.S

Sistema web de gestión integral para una planta de beneficio de minerales (oro y plata).
Construido con **React 18 + Vite + TypeScript** y **CSS puro** (sin librerías de UI pesadas). Íconos con **Lucide React**.

---

## Puesta en marcha

```bash
npm install
npm run dev       # servidor de desarrollo (http://localhost:5173)
npm run build     # chequeo de tipos + build de producción
npm run preview   # previsualizar el build
npm run lint      # tsc --noEmit (chequeo de tipos sin compilar)
```

> **Node requerido:** ≥18.x  
> **No se necesita backend:** todos los datos están en mock (`src/data/mock.ts`) + `localStorage`.

---

## Despliegue (Docker + Caddy)

El front se despliega como **un solo contenedor**: la imagen compila React con Vite y la sirve con **Caddy**, que además saca el certificado HTTPS solo y reenvía `/api/*` al backend. El servidor **no necesita Node ni Vite**: todo el build ocurre dentro de la imagen.

### Requisitos del servidor
| Herramienta | Versión | Notas |
|---|---|---|
| Ubuntu | 24.04 (ARM o x86) | La VM `molinos-front` de Oracle |
| Docker Engine | **≥ 28** (probado con 28.0.1) | Instalar `docker-ce` desde el repositorio oficial de Docker |
| Docker Compose | **v2** (probado con v2.33.1) | Plugin `docker compose` (con espacio, no `docker-compose`) |
| git, curl | cualquiera | Para clonar y para detectar la IP pública |
| Node / npm | **no se instala** | La imagen usa `node:22-alpine` (Node 22) solo para compilar |
| Caddy | **no se instala** | La imagen usa `caddy:2-alpine` (probado con 2.11.9) |

Las imágenes base son multi-arquitectura (x86 y ARM). Salida a internet necesaria: Docker Hub, Let's Encrypt y `api.ipify.org`.

### Red y puertos
| Puerto | Quién | Para qué |
|---|---|---|
| 22, 80, 443 (TCP) | internet → `molinos-front` | SSH, redirección HTTP→HTTPS y HTTPS |
| 3005 | solo red 10.0.0.0/16 | API Node en `molinos-back` (10.0.1.10), no es pública |

El navegador siempre llama a `/api/v1` en el mismo origen; Caddy lo reenvía a `10.0.1.10:3005`. Por eso no hay CORS y la cookie de sesión funciona.

### Desplegar desde cero
```bash
# 1. Docker (una sola vez)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # cerrar y abrir sesión SSH después

# 2. Código y configuración
sudo mkdir -p /opt/molinos && sudo chown $USER /opt/molinos
git clone -b feat/moduloJuliana-back https://github.com/ChisCurubo/Molinos-Front.git /opt/molinos/front-src
echo "BACK_IP=10.0.1.10" | sudo tee /opt/molinos/front.env

# 3. Levantar (detecta solo que es Oracle porque la VM tiene la IP 10.0.1.20)
sudo bash /opt/molinos/front-src/deploy/setup-front.sh
```
Al terminar imprime `[molinos] frontend listo en https://<ip-con-guiones>.sslip.io`. En la VM esto lo hace **cloud-init** automáticamente (clona el repo en `/opt/molinos/front-src` y llama a `deploy/setup-front.sh`).

**Después de conocer la URL**, ponerla en el backend (`FRONT_URL` en `/opt/molinos/front_url.env` de la VM back) y reiniciar el API; si no, el CORS del modo `oracle` la rechaza.

### Actualizar
```bash
ssh -i molinos_oracle_ed25519 ubuntu@<ip-publica-front> 'sudo /opt/molinos/update.sh'
```
Reconstruye la imagen con `deploy/setup-front.sh`; los certificados (volumen `caddy-data`) no se tocan.

### Logs y diagnóstico
```bash
docker compose -p molinos-front logs --tail 100 web      # logs de Caddy
docker compose -p molinos-front ps                       # estado
curl -I https://<ip-con-guiones>.sslip.io/api/v1/health  # 200 = backend vivo (si es backend viejo: /api/v1/info/health → 200/401)
```
| Síntoma | Causa probable |
|---|---|
| El script termina sin certificado | Puertos 80/443 cerrados, o sslip.io caído. Plan B: `SITE=<ip-con-guiones>.nip.io sudo -E bash deploy/setup-front.sh` |
| Pantallas con error de red / 502 | El backend (10.0.1.10:3005) no responde; revisar desde la VM: `curl http://10.0.1.10:3005/api/v1/health` |
| Login funciona pero se cierra la sesión | Se está entrando por `http://` o por la IP; usar la URL `https://…sslip.io` |
| `permission denied` con docker | Falta `usermod -aG docker` (o usar `sudo`) |

> **No borrar** el volumen `molinos-front_caddy-data`: ahí están los certificados y Let's Encrypt limita las renovaciones.

### Probarlo en tu PC (Windows, Docker Desktop)
```bash
# Git Bash, con el backend local corriendo en :3005
MODO=local bash deploy/setup-front.sh        # → http://localhost:8080
docker compose -p molinos-front down
```
Sin Docker: `npm run dev` (puerto 5173) o `npm run preview` (4173); ambos reenvían `/api` al backend en `VITE_BACK_URL` (por defecto `http://localhost:3005`).

### Modos (se detectan solos)
- **`oracle`**: cualquier host que no sea de red privada (`*.sslip.io`, IP pública, `10.0.1.20`). Sin datos de ejemplo: si la API falla, la pantalla muestra el error.
- **`local`**: `localhost`, `192.168.x`, `10.x` (salvo `10.0.1.20`), `172.16–31.x`, `*.local`. Muestra la etiqueta "LOCAL" y permite datos de ejemplo solo con `npm run dev`.

Detalle de los archivos en [`deploy/README.md`](deploy/README.md).

---

## Cuentas de prueba

| Rol           | Correo                        | Contraseña    | Acceso                                                |
|---------------|-------------------------------|---------------|-------------------------------------------------------|
| Materiales    | vicky@molinosdecolombia.com   | `molinos2026` | Gestión completa: entradas, análisis, concentrado, viajes, catálogos |
| Financiero    | juliana@molinosdecolombia.com | `molinos2026` | Finanzas, préstamos, nómina, turnos                   |
| Administrador | david@molinosdecolombia.com   | `molinos2026` | Solo lectura de todo + administración de usuarios     |

> Autenticación simulada con "JWT" en `localStorage`. No apto para producción sin backend real.

---

## Módulos del sistema

### Panel principal (`/`)
- **Administrador (David):** tarjetas navegables a cada módulo, KPIs de resumen (entradas, concentrado, viajes, nómina).
- **Materiales (Vicky):** acceso directo a entradas, análisis, concentrado e inventario.
- **Financiero (Juliana):** resumen de cuentas por pagar, nómina pendiente, próximos vencimientos.

### Materiales (`/materiales/*`)
Módulo central. Implementa el flujo completo de procesamiento mineral en 5 etapas:

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/materiales/entradas` | `EntradasPage` | Registro de volquetas que llegan con material. Alta, edición, análisis de laboratorio (humedad/tenor), cálculo automático de peso seco y flete. |
| `/materiales/analisis` | `AnalisisPage` | Tabla completa de todos los análisis (planta y concentrado). Edición de campos de laboratorio. |
| `/materiales/concentrado` | `ConcentradoPage` | Flujo completo: crear lote → procesar materiales → cerrar lote → análisis concentrado → crear viaje → despacho. Inventario en dos paneles (crudo / concentrado). Kardex de movimientos. |
| `/materiales/viajes` | `ViajesAguaPage` | Registro de viajes de agua (camión cisterna): conductor, valor/viaje, cantidad, ACPM, total generado. |
| `/materiales/zonas` | `CatalogosPage` | Dueños de volqueta (CRUD con datos bancarios), precios por tenor, tarifas de flete por zona, catálogos (zonas, minas, mineros). |
| `/materiales/volquetas` | `VolquetasPage` | Gestión de volquetas asociadas a dueños. |
| `/materiales/informes` | `InformesMaterialPage` | Resúmenes y reportes del módulo. |

**Flujo de procesamiento mineral (5 etapas):**
```
Etapa 1          Etapa 2        Etapa 3              Etapa 4         Etapa 5
Entrada      →   Análisis   →   Crear lote       →   Cerrar lote →   Viaje
(volqueta)       laboratorio    + Procesar mat.       (concentrado)   (despacho)
MPE              analisis       procesamiento_mat     material_conc   viaje
                 tipo=Cabeza    (tabla puente)        + análisis      viaje_material
                                                      tipo=Concentrado
```

### Pagos y finanzas (`/finanzas/*`)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/finanzas` | `FinanzasPage` | Cuentas por pagar (flete, material, maquila) y cuentas por cobrar. |
| `/finanzas/prestamos` | `PrestamosFinancierosPage` | Préstamos a terceros: titular, monto, cuotas, trazabilidad de pagos. |
| `/finanzas/informes` | `InformesFinanzasPage` | Resúmenes financieros. |
| `/juliana` | `JulianaPage` | Panel personal de Juliana (financiero). |

### Nómina (`/nomina/*`)
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/nomina` | `NominaPage` | Empleados (33 reales), quincenas liquidables, préstamos a empleados con trazabilidad de pagos. |
| `/nomina/calendario` | `CalendarioTurnosPage` | Calendario de turnos diurnos/nocturnos filtrable por quincena o mes. |
| `/nomina/informes` | `InformesNominaPage` | Reportes de nómina. |

**Reglas de nómina:**
- Cuota quincenal de préstamo = `valor_prestamo / (cuotas × 2)`
- La quincena **NO** puede liquidarse (`estado=liquidado`) sin comprobante.

### Usuarios (`/usuarios`)
CRUD de cuentas y roles. Solo accesible por el Administrador.

### Informes Power BI (`/informes`)
Iframe para embeber informe externo. Accesible a todos los roles.

---

## Control de acceso

Definido en `src/auth/permissions.ts`. Rutas protegidas en `src/components/layout/ProtectedRoute.tsx`.

```
administrador → canWrite: solo 'usuarios'  (lectura total del resto)
materiales    → canWrite: solo 'materiales'
financiero    → canWrite: 'finanzas' y 'nomina'
```

El hook `useCanWrite(module)` controla si se muestran botones de edición/eliminación.

---

## Diseño y accesibilidad

**Paleta:** verde marca, café/dorado, slate, esmeralda, ámbar, rosa.
**Prohibido:** azul, degradados morados.

| Token | Uso |
|-------|-----|
| `--green-*` | Acción primaria, botones, estado pagada |
| `--amber-*` | Advertencias, estado pendiente, valores de tenor |
| `--rose-*` | Peligro, eliminación, estados de error |
| `--emerald-*` | Éxito, disponibilidad, inventario positivo |
| `--brown-*` | Identidad de marca, placas, IDs |
| `--slate-*` | Texto y fondos neutros |

**Tipografía:**
- Cuerpo: Inter
- Títulos: Plus Jakarta Sans
- Monoespaciado (placas, montos, IDs): JetBrains Mono — clase `mono`

**Accesibilidad:**
- 3 niveles de tamaño de letra (persistidos en `localStorage`)
- Modo alto contraste (`prefers-contrast`)
- Reducción de animaciones (`prefers-reduced-motion`)
- Foco visible verde, `aria-label` en todos los botones de ícono
- Áreas táctiles ≥ 44 px

---

## Estructura de directorios

```
src/
├── api/
│   └── withFallback.ts       fetch + AbortController, sin axios
├── auth/
│   └── permissions.ts        roles, canWrite, canView
├── components/
│   ├── ui/                   Button, Input, Select, Card, KpiTile,
│   │                         Modal, Badge, Checkbox, FileDropzone,
│   │                         InfoCallout, CardList
│   ├── layout/               TopBar, Sidebar, AppLayout, ProtectedRoute,
│   │                         AccessibilityMenu
│   └── common/               PageHeader, ReadOnlyBanner, CrudManager
├── context/
│   ├── AuthContext.tsx        sesión + "JWT" simulado
│   ├── DataContext.tsx        datos globales + localStorage
│   └── AccessibilityContext.tsx  preferencias de UI
├── data/
│   └── mock.ts               todos los datos semilla + interfaces TypeScript
├── hooks/
│   └── usePermissions.ts     useCanWrite, useCanView
├── pages/
│   ├── auth/                 LoginPage, ForgotPasswordPage, ResetPasswordPage
│   ├── dashboard/            DashboardPage, AdminDashboard
│   ├── materiales/           EntradasPage, AnalisisPage, ConcentradoPage,
│   │                         ViajesAguaPage, CatalogosPage, VolquetasPage,
│   │                         InformesMaterialPage, VictoriaPage
│   ├── finanzas/             FinanzasPage, PrestamosFinancierosPage,
│   │                         InformesFinanzasPage, JulianaPage
│   ├── nomina/               NominaPage, CalendarioTurnosPage,
│   │                         InformesNominaPage
│   ├── usuarios/             UsuariosPage
│   └── powerbi/              InformesPage
├── styles/
│   ├── tokens.css            variables CSS (colores, tipografía, espaciado)
│   └── base.css              reset + clases utilitarias
├── types/
│   └── index.ts              tipos globales (Role, Mina, Zona, Minero…)
└── utils/
    └── format.ts             formatCOP, formatDate, todayISO,
                              getPrecioAplicable, calc4x1000
```

---

## Interfaces clave en `mock.ts`

| Interfaz | Descripción |
|----------|-------------|
| `MaterialRow` | Entrada de material (volqueta). Campos: `peso_llegada_planta`, `porcentaje_humedad`, `tenor`, `total_material_seco`, `estado`, `lote`. |
| `AnalisisRow` | Análisis de laboratorio. `id_entrada` (tipo Cabeza) o `id_material_concentrado` (tipo Concentrado). |
| `LoteConcentrado` | Lote de concentrado. Estados: `en_proceso → en_canoa → parcialmente_enviado → enviado_completo`. |
| `ViajeRow` | Viaje de material con `lineas: LineaViaje[]`. |
| `DuenoVolqueta` | Propietario de volqueta con datos bancarios (titular, CC, banco, cuenta, nequi). |
| `PrecioMaterial` | Precio por tenor con soporte de `id_minero` e `id_zona` opcionales. |
| `TarifaZona` | Tarifa de flete por zona (pesos/tonelada seco). |
| `EmpleadoReal` | Empleado con `salario_quincenal`. |
| `PrestamoEmpleadoMock` | Préstamo a empleado con trazabilidad de pagos por quincena. |
| `AguaRow` | Viaje de agua. `valor_total` es **campo generado** en BD — no enviar en POST. |

---

## Reglas críticas de negocio

```
peso_seco = peso_llegada_planta × (1 - porcentaje_humedad)
flete     = peso_seco × tarifa_zona (pesos/ton)
valor_mat = peso_seco × precio_por_tonelada   (método por_tonelada)
          = peso_seco × tenor × precio_por_gramo  (método por_gramo)

cuota_quincenal_prestamo = valor_total / (cuotas_mensuales × 2)

agua.valor_total = (valor_viaje × cantidad_viajes) - acpm   ← GENERADO en BD, no enviar
```

**Flujo de lotes:**
1. Crear lote (`en_proceso`) → vincular materiales → actualizar `material_seco_procesado`
2. Cerrar lote → ingresar ton húmedo + humedad → calcular maquila = `material_seco_procesado × tarifa`
3. Lote pasa a `en_canoa` con `toneladas_disponibles = ton_humedo`
4. Crear viaje → seleccionar lotes en canoa con cantidades → `toneladas_disponibles` se decrementan
5. Si sobran toneladas → crear lote remanente (`en_canoa`, `maquila=0`)

---

## Stack técnico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.3 | UI |
| TypeScript | 5.6 | Tipado estricto |
| Vite | 5.4 | Bundler + HMR |
| react-router-dom | 6.28 | Rutas + ProtectedRoute |
| lucide-react | 0.454 | Íconos |
| recharts | 3.9 | Gráficos (informes) |

Sin axios: se usa `fetch` nativo con `AbortController` via `src/api/withFallback.ts`.
