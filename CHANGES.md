# Registro de cambios — ERP Molinos de Colombia

Resumen de todo lo que se trabajó, explicado para entender **qué se hizo** y **cómo quedó**.

> **Idea general de todos los módulos de pago:** cada entidad (dueño de volqueta,
> conductor de agua, mula, minero) tiene una cuenta con **cargos** (viajes/materiales
> que generan una deuda) y **abonos** (pagos). El saldo se recalcula **siempre en vivo**
> desde los datos: no hay "cierres" ni bloqueos, y editar algo del pasado se refleja
> automáticamente en el presente. Colores estándar: **deuda = ámbar**, **a favor/pagado = verde**.

---

## 1. Volquetas — Pagos (cuenta corriente por mes)

**Archivo:** `src/pages/materiales/VolquetasPage.tsx` (pestaña *Pagos*)
**localStorage:** `molinos_abonos_prov_v1`

- Se **eliminó el mecanismo de "cierre de mes"** (ya no hay `CierreMensual`, ni botón "Cerrar mes", ni bloqueos). Antes un mes cerrado congelaba el saldo y ocultaba lo anterior — eso causaba los datos "dañados".
- Ahora hay un **navegador de calendario** (◀ / selector de mes / ▶ / «Hoy») y se ve **un mes a la vez**.
- Por cada dueño: **Saldo inicio** (arrastrado de toda la historia previa) → **Flete del mes** − **ACPM** − **Abonado** = **Saldo fin**. Ese saldo fin es el inicio del mes siguiente (**saldos encadenados**).
- Filas expandibles con el detalle de viajes y abonos del mes, editar/borrar abonos en **cualquier mes**.
- **Semáforo** por dueño: 🔴 sin abonos · 🟡 parcial · 🟢 pagado.
- Modelo de pago: **abono a la cuenta del dueño** (se le va abonando en general). *No* cambió a selección de volquetas (a pedido).

---

## 2. Viajes de agua — por conductor

**Archivo:** `src/pages/materiales/ViajesAguaPage.tsx`
**localStorage:** `molinos_erp_agua_v1` (registros), `molinos_abonos_agua_v1` (abonos)

- La vista "Por conductor" se convirtió en **tarjetas colapsables** (compactas).
  - Colapsada: semáforo 🔴/🟡/🟢 + nombre + viajes + neto + abonado + barra de progreso + saldo + botón **Abonar**.
  - Expandida: pestañas **Viajes del período** / **Abonos**, con totales al pie.
- **Abonos** con foto de comprobante (comprimida) y visor a pantalla completa.
- **Filtros** nuevos: por **mes**, por **conductor/dueño** y por **estado** (Todos / Por pagar / Pagado).

---

## 3. Mulas — transporte de salida

**Archivo:** `src/pages/materiales/MulasPage.tsx`
**localStorage:** `molinos_mulas_v1`, `molinos_viajes_mulas_v1`, `molinos_abonos_mulas_v1`

- Módulo en el navbar con dos pestañas: **Viajes y pagos** y **Registro de mulas**.
- La vista de pagos usa el **mismo patrón de calendario** que Volquetas (navegador de mes, tarjeta por mula con semáforo, tabs Viajes/Abonos, saldos encadenados).
- **Registro de viaje**: fecha, **viaje vinculado** (de los viajes de material), tarifa aplicada (por defecto la vigente, editable), **factura (número + foto)** y nota.
- **Registro de mula**: nombre/razón social, tarifa vigente y **historial de cambios de tarifa** (cada cambio guarda fecha + valor).
- **Abonos** con método (transferencia/depósito/efectivo/otro) + foto de comprobante + editar/borrar.
- **Tarifa por defecto:** $6.500.000/viaje (editable).
- Se precarga una **mula de ejemplo** (“TRANSPORTES VILLA · STO-456”) con un viaje si no hay datos guardados.

---

## 4. Pago de material a mineros (pago por selección de ítems)

**Archivos:** `src/pages/materiales/PagosMaterialPanel.tsx` (la vista, reutilizable),
`src/pages/materiales/PagoMaterialPage.tsx` (página), `src/data/materialPagos.ts` (datos),
`src/utils/material.ts` (cálculo de valor)
**localStorage:** `material_pagos_mineros_v1`

- **Entidad = minero** (identificado por el nombre de mina). **Cargo = cada material valorizado** (`ton secas × tenor × precio pactado`, tomado de la evaluación existente, no se recalcula aparte).
- **Pago por selección** (lo que pediste):
  1. En la pestaña **Materiales** cada material pendiente tiene **casilla**; los pagados muestran ✓ y su badge (**Pagado / Pago parcial / Pendiente**).
  2. Marcas los que quieres pagar → aparece **"N seleccionados · $X"** + botón **Pagar seleccionados**.
  3. El modal pre-llena el **monto** con la suma de lo pendiente marcado — **editable**. Si pones **menos**, se reparte del material más antiguo al más nuevo (pagos **parciales**).
  4. El abono queda **ligado a esos materiales** (`materiales_ids`) y su estado se actualiza también en la tabla de Entradas.
- Botón **"Abono libre"** para un pago a la cuenta general (sin seleccionar).
- Pestaña **Abonos**: cada pago indica si **cubre N materiales** o es **cuenta general**; editar/borrar.
- **KPIs claros:** "Total por pagar" = suma de lo realmente pendiente (valor − pagado).
- Los abonos viejos (sin `materiales_ids`) siguen funcionando como **cuenta general**.
- **Dónde vive:** la página `/materiales/pago-material` (navbar) **y** una pestaña **"Pagos a mineros" dentro de Entradas** — es el **mismo componente**, sin duplicar código.

**Cómo se calcula el estado de un material** (`materialPagos.ts`):
- Los abonos con `materiales_ids` se aplican **solo** a esos materiales; los generales, a todos los del minero.
- En ambos casos el dinero se reparte del material más antiguo al más nuevo → permite parciales.
- Estado: `pagado` si lo pagado ≥ su valor, `parcial` si hay algo, `pendiente` si nada.

---

## 5. Entradas de material

**Archivo:** `src/pages/materiales/EntradasPage.tsx`

- **Selector de minero** en el formulario (ver módulo 8) en vez de texto libre.
- **Tabla rediseñada** con **fila desplegable**: al abrir muestra
  - **Análisis registrados** (Cabeza/Sulfuros/Colas con color, n.° análisis, ton seco, Au gr/t, Ag gr/t, Au total, fecha salida) + botón "Ver/editar análisis".
  - **Detalle del material** (peso húmedo, humedad, ton secas, tenor, flete, valor, estado de pago, lote).
- **Fecha** en formato **dd/mm/aaaa**.
- Columnas **Estado material** (Sin análisis / Analizado / En lote / En viaje…) y **Estado pago** (Pendiente / Pago parcial / Pagado) — este último ahora se deriva de los abonos reales al minero.
- **Pestaña "Pagos a mineros"** integrada (mismo panel que el módulo 4).

---

## 6. Análisis y laboratorio

**Archivo:** `src/pages/materiales/AnalisisPage.tsx`

- **Pestañas por tipo**: Todos / Cabeza / Sulfuros / Colas / Concentrado, con conteo en cada una.
- Tabla más limpia: primera columna con tipo (color propio) + referencia (mina#vol o código de lote) + fecha; **Fecha de salida** en dd/mm/aaaa.

---

## 7. Procesamiento e Inventario

**Procesamiento** (`src/pages/materiales/ProcesamientoPage.tsx`)
- Pestaña "Procesamiento material": filas **desplegables** con el **análisis del material** y su detalle (lote, peso húmedo, humedad, ton secas, tenor, estado del lote).
- La pestaña "Lotes concentrado" ya tenía su desplegable de materiales y análisis.

**Inventario** (`src/pages/materiales/InventarioPage.tsx`)
- Fecha en formato **dd/mm/aa**.

---

## 8. Selector de minero (reutilizable)

**Archivo:** `src/components/common/MineroField.tsx`
**localStorage:** `molinos_mineros_extra_v1`

- Convierte el campo "Mina / Minero" en un **selector** con la lista de mineros del sistema (catálogo + mapas de precio/zona + los que ya existen en registros).
- Opción **"➕ Nuevo minero…"** para crear uno nuevo en el mismo campo; los nuevos se **guardan** y quedan disponibles en ambos formularios (Entradas y Llegadas de volquetas).
- Normaliza a mayúsculas para no romper el cálculo automático de flete y precio.

---

## Cosas que se quitaron o cambiaron de fondo

- **Cierres de mes** (Volquetas): eliminados. Todo es editable siempre y los saldos se recalculan solos. Los datos viejos de `molinos_cierres_v1` quedan sin usar (puedes borrarlos con `localStorage.removeItem('molinos_cierres_v1')` en la consola del navegador).
- **Bug corregido:** en Pago de material la foto de comprobante era obligatoria y bloqueaba el botón; ahora es **opcional**.

---

## Pendiente (a propósito)

- **Exportación a Excel** para Mulas y Pago de material (resumen + detalle + abonos, con filtros). Falta decidir: instalar `xlsx` (SheetJS, .xlsx real multi-hoja) **o** exportar CSV sin dependencias.

---

## Notas técnicas

- Todo el código pasa `npx tsc --noEmit` sin errores (el proyecto usa `strict`, `noUnusedLocals` y `noUnusedParameters`).
- Persistencia por módulo en **localStorage** (claves indicadas arriba). Los datos son locales del navegador.
- Utilidades compartidas: `compressImage()` (comprime fotos a base64), `calcValorMaterial()` (valor del material), `estadoPagoMap()` / `montoPagadoPorMaterial()` (estado de pago por material).
</content>
