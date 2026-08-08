# Estado de integración API — Molinos de Colombia ERP

Base URL: `http://localhost:3005/api/v1` (configurada en `.env.local`)

## Infraestructura creada

| Archivo | Estado | Descripción |
|---|---|---|
| `src/api/client.ts` | ✅ | Axios + JWT interceptor + unwrap `{data}` + `apiFetch/apiPost/apiPut/apiPatch/apiDelete` |
| `src/api/withFallback.ts` | ✅ | Envuelve client.ts con fallback a mock en caso de error |
| `src/api/catalogos.ts` | ✅ | Cache de `/info/catalogos` (minas, mineros, zonas, dueños) |
| `src/api/auth.ts` | ✅ | Login, verify, CRUD usuarios |
| `src/api/material.ts` | ✅ | **Reescrito y tipado por endpoint** (spec backend): zonas, mineros, minas, dueños, volquetas, precios, entradas, análisis. Helpers `num()`/`numOrNull()` para decimales-string |
| `src/hooks/useMaterialCatalogos.ts` | ✅ | Hooks de catálogo con caché compartida + `invalidateMaterialCatalog()` |
| `src/components/common/CatalogSelectors.tsx` | ✅ | Selectores reutilizables (mina, minero, zona, volqueta, dueño) |
| `src/api/nomina.ts` | ✅ | Empleados, préstamos empleado, turnos, plantas, vistas saldo |
| `src/api/pagos.ts` | ✅ | CxP, CxC categorías, préstamos financieros, proveedores, gastos, alquileres |
| `.env.local` | ✅ | `VITE_API_URL=http://localhost:3005/api/v1` |

## Páginas nuevas conectadas 100% a la API (en paralelo a las mock)

| Ruta | Página | Cubre |
|---|---|---|
| `/materiales/zonas` | `CatalogosPage` (reescrita) | Zonas, Mineros, Minas, Dueños, Volquetas, Precios — CRUD + 409 |
| `/materiales/entradas-api` | `EntradasApiPage` (nueva) | Registrar llegada, tabla + paginación, detalle expandible, análisis de cabeza (crear/ver/editar/borrar) |

> Las páginas mock originales (`EntradasPage`, `VolquetasPage`, `AnalisisPage`) siguen intactas.

## Endpoints del backend conectados a la UI

| Módulo | Endpoint | UI conectada | Notas |
|---|---|---|---|
| Auth | `POST /auth/login` | ✅ AuthContext | Intenta real API, fallback a mock si el backend no responde |
| Auth | `GET /auth/verify` | Módulo creado | Pendiente wire en ProtectedRoute |
| Info | `GET /info/catalogos` | Módulo creado | Pendiente usar desde ZonasPage / VolquetasPage |
| Material | `GET /material/entradas` | Pendiente | Actualmente usa localStorage mock |
| Material | `POST /material/entrada` | Pendiente | EntradasPage.saveNuevo() usa solo local state |
| Material | `POST /material/analisis` | Pendiente | AnalisisPage.save() usa solo local state |
| Material | `POST /material/concentrado` | Pendiente | LotesPage usa solo local state |
| Material | `POST /material/concentrado/:id/procesar` | Pendiente | — |
| Material | `PUT /material/concentrado/:id/cerrar` | Pendiente | — |
| Material | `GET /material/volqueta` | Pendiente | VolquetasPage usa mock |
| Material | `POST /material/volqueta` | Pendiente | — |
| Material | `POST /material/volqueta/dueno` | Pendiente | — |
| Material | `GET /material/mina` | Pendiente | ZonasPage usa mock |
| Material | `POST /material/agua` | Pendiente | ViajesAguaPage usa apiPost de withFallback |
| Nómina | `GET /nomina/empleados` | Pendiente | NominaPage usa mock |
| Nómina | `POST /nomina/turnos` | Pendiente | — |
| Pagos | `GET /pagos/prestamos-financieros` | Pendiente | FinanzasPage usa mock |
| Pagos | `POST /pagos/cxp` | Pendiente | — |

## Pendiente de conectar en páginas

### Prioridad alta
- [ ] `EntradasPage` → `materialApi.createEntrada()` + `materialApi.getEntradas()` al cargar
- [ ] `AnalisisPage` → `materialApi.createAnalisis()` al guardar
- [ ] `VolquetasPage` → `materialApi.getVolquetas()`, `createVolqueta()`, `createDueno()` al cargar/guardar
- [ ] `ZonasPage` → `getCatalogos()` para minas/mineros/zonas; `materialApi.create*()` al guardar

### Prioridad media
- [ ] `LotesPage` (procesamiento) → `materialApi.iniciarLote()`, `procesarMaterial()`, `cerrarLote()`
- [ ] `NominaPage` → `nominaApi.getEmpleados()`, `createTurno()`, etc.
- [ ] `FinanzasPage` → `pagosApi.getPrestamosFinancieros()`, `createCxP()`, etc.

### Notas de campo a NO enviar (genera BD / triggers)
- `au_gr_x_ton` — calculado por backend
- `ag_gr_x_ton` — calculado por backend
- `valor_total` de agua_planta — campo generado `(valor_viaje × cantidad_viajes) - acpm`
- `toneladas_disponibles` — calculado
