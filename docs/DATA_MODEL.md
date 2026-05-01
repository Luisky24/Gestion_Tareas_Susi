# Modelo de datos (Google Sheets) — Gestión_Tareas_Susi

## Convenciones de índices (CRÍTICO)

### A) Índices 1-based (Sheets)

- Filas/columnas en `SpreadsheetApp.getRange(fila, columna, ...)` son **1-based**.
  - EVIDENCIA: `Código.js` → `nuevaTarea()` → `hj_tareas.getRange(2, 1)` (fila 2, col 1).

Convención observada:
- **Fila 1**: cabecera (no se modifica en el flujo normal; las operaciones empiezan en fila 2).
  - EVIDENCIA: `Código.js` → `reorganizarTareas()` → `getRange(2, 1, ultimaFila - 1, ultimaColumna)` (desde fila 2).

### B) Índices 0-based (arrays en memoria)

Cuando se usa `getValues()` o `getDisplayValues()`, cada fila es un array **0-based**:
- `elemento[0]` = Columna A (1) en Sheets, `elemento[1]` = B (2), etc.
  - EVIDENCIA: `Código.js` → `reorganizarTareas()` → `vlTareas.forEach((elemento...) => { if (elemento[5] != "") ...; if (elemento[4] == "hecho") ... })`.
- `getValues()` devuelve tipos nativos (p.ej. `Date`), `getDisplayValues()` devuelve strings renderizados.
  - EVIDENCIA: `Código.js` → `moverFinalizadas()` → `rngTareas.getValues()` y luego usa `elemenIn[6].getTime()` (requiere `Date`).
- EVIDENCIA: `f_estadisticas_flujo.js` → `obtenerDatosHoja()` → `return rango.getDisplayValues();` (strings).

## Hojas y responsabilidades

| Hoja | Rol | Productor(es) | Consumidor(es) |
|---|---|---|---|
| `Tareas` | Backlog operativo (tareas abiertas y finalizadas antes de mover) | `nuevaTarea`, `finalizarTarea`, `reactivarTarea`, `borrarTarea`, `reorganizarTareas`, `moverFinalizadas` | `reorganizarTareas`, `moverFinalizadas`, `estadisticasV2`, `ejecutarEstadisticasAnaliticas` |
| `Hecho` | Histórico de tareas finalizadas movidas desde `Tareas` | `moverFinalizadas`, `reactivarTarea` (si reactivas desde `Hecho`) | `estadisticasV2`, `ejecutarEstadisticasAnaliticas` |
| `Estadisticas` | Agregado semanal (Nuevas/Abiertas/Cerradas) | `estadisticasV2` | humano/visualización |
| `Resumen Semanal` | Resumen semanal alternativo (hechas/no hechas) | `ejecutarEstadisticasAnaliticas` | humano/visualización |
| `Errores_Estadisticas` | Log de errores de `estadisticasV2` | `registrarError` | diagnóstico |
| `Errores` | Log de errores de `ejecutarEstadisticasAnaliticas` (se crea/limpia en ejecución) | `procesarResumenPorFechaFin` | diagnóstico |

EVIDENCIAS:
- EVIDENCIA: `Código.js` → `getSheetByName('Tareas')` → operaciones core sobre hoja `Tareas`.
- EVIDENCIA: `Código.js` → `moverFinalizadas()` → `getSheetByName('Hecho')` + `setValues(...)`.
- EVIDENCIA: `f_estadisticas_flujo.js` → `nombreHoja = "Estadisticas"` → `crearHoja(...)` inserta hoja y escribe cabecera.
- EVIDENCIA: `f_estadisticas_analitico.js` → `hojaResumen = ... 'Resumen Semanal'` → `setValues(...)`.
- EVIDENCIA: `f_estadisticas_flujo.js` → `registrarError()` → `insertSheet('Errores_Estadisticas')` y `appendRow(['Fecha','Función','Mensaje','Detalle'])`.
- EVIDENCIA: `f_estadisticas_analitico.js` → `hojaErrores = ... 'Errores'` → `appendRow(['Hoja','Fila','Mensaje'])`.

## Hoja `Tareas` / `Hecho` — tabla de columnas (completa según uso en código)

> Nota: el repo no contiene un “diccionario de columnas” explícito. La tabla siguiente se reconstruye **solo** con columnas referenciadas en el código.

### Estructura mínima confirmada (7 columnas)

| Col (Sheets 1-based) | Índice array 0-based | Nombre funcional (deducido) | Tipo esperado | Validaciones / reglas | Usos (funciones) | Evidencia por columna |
|---:|---:|---|---|---|---|---|
| 1 (A) | 0 | Fecha alta | `Date` o string `dd/MM/yyyy` (según API usada) | Debe ser fecha parseable; en stats V2 se parsea `dd/MM/yyyy` si llega como string | Alta, reactivación, estadísticas | EVIDENCIA: `Código.js` → `nuevaTarea()` → `Utilities.formatDate(...,"dd/MM/yyyy")` y `rngCelda.setValue(fechaAlta)`; EVIDENCIA: `f_estadisticas_flujo.js` → `convertirAFecha(str)` → `str.split("/")` usado para fecha inicio |
| 2 (B) | 1 | Tarea (texto) | string | Clave de deduplicación en `Hecho` usa texto exacto | mover finalizadas | EVIDENCIA: `Código.js` → `moverFinalizadas()` → `claveIn = ...|${elemenIn[1]}|...` |
| 3 (C) | 2 | Prioridad | number (preferible) | Orden ascendente; si no es número, la resta puede dar `NaN` → orden no determinista | ordenación tareas; resumen semanal | EVIDENCIA: `f_secundarias.js` → `ordenarTareas()` → `const prioridadDif = a[2] - b[2];` ; EVIDENCIA: `f_estadisticas_analitico.js` → `IDX_PRIORIDAD = 2` |
| 4 (D) | 3 | (No usado explícitamente en repo) | SUPOSICIÓN: string o vacío | SUPOSICIÓN: campo descriptivo (p.ej. categoría/nota) | N/A | SUPOSICIÓN: esta columna existe si la hoja tiene más columnas, pero **no hay acceso por índice/columna en código**. Verificación: abrir `Tareas` y revisar cabecera en fila 1. |
| 5 (E) | 4 | Estado | string (p.ej. `"hecho"` o `""`) | Regla: `"hecho"` indica finalizada | finalizar/reorganizar/mover/stats | EVIDENCIA: `Código.js` → `finalizarTarea()` → `getRange(filaTarea, 5).setValue('hecho')`; EVIDENCIA: `Código.js` → `reorganizarTareas()` → `if (elemento[4] == "hecho") ...` ; EVIDENCIA: `Código.js` → `moverFinalizadas()` → `elemento[numcolumnas - 3] == 'hecho'` |
| 6 (F) | 5 | Fecha fin estimada | `Date` o `""` | Si existe y está en pasado y no está hecha → tarea retrasada; si vacío se trata como “hoy” en ordenación | reorganizar/pijama; resumen semanal | EVIDENCIA: `Código.js` → `reorganizarTareas()` → `if (elemento[5] != "") { fhEstimada = elemento[5].getTime(); }` ; EVIDENCIA: `f_secundarias.js` → `pijama()` → `if (vl_pijama[i][5] != "") { let fhFinEsperada = ...getTime(); }` ; EVIDENCIA: `f_estadisticas_analitico.js` → `IDX_FECHA_FIN_EST = 5` |
| 7 (G) | 6 | Fecha fin real | `Date` o `""` | Se escribe al finalizar; `""` implica abierta; usada para claves de deduplicación y cierre semanal | finalizar/mover/stats | EVIDENCIA: `Código.js` → `finalizarTarea()` → `getRange(filaTarea, columnasTarea).setValue(fechaFin)` (última columna) ; EVIDENCIA: `Código.js` → `moverFinalizadas()` → clave usa `elemenIn[6].getTime()` ; EVIDENCIA: `f_estadisticas_flujo.js` → `contarTareasAbiertasPorSemana()` → `const fechaFin = tarea[6]; if (!fechaFin || fechaFin === "") ...` ; EVIDENCIA: `f_estadisticas_analitico.js` → `IDX_FECHA_FIN = 6` |

### Reglas de negocio derivadas (verificables)

- **Una tarea se considera finalizada** si `Estado == "hecho"` y/o `Fecha fin real` no está vacía (según función).
  - EVIDENCIA: `Código.js` → `finalizarTarea()` → escribe `'hecho'` en col 5 y fecha fin real en última columna.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `contarTareasAbiertasPorSemana()` → considera abierta si `fechaFin` es vacío.
- **Clasificación para reorganización**:
  - Retrasada: `hoy > Fecha fin estimada` y `Estado != "hecho"`.
  - En curso: no retrasada y no hecha.
  - Finalizada: `Estado == "hecho"`.
  - EVIDENCIA: `Código.js` → `reorganizarTareas()` → `if (fhDia > fhEstimada && elemento[4] != "hecho") ... else if (elemento[4] == "hecho") ...`.
- **Ordenación**:
  - Por prioridad ascendente (col C).
  - Luego por “fecha” (toma `a[num_columnas - 1]` como “fecha fin real”; si vacío usa `new Date()`).
  - EVIDENCIA: `f_secundarias.js` → `ordenarTareas(tblTareas, num_columnas)` → compara `a[2]-b[2]` y luego `a[num_columnas-1]`.

## Hoja `Estadisticas` (estadisticasV2)

### Cabecera confirmada

| Col | Nombre | Tipo | Evidencia |
|---:|---|---|---|
| 1 | Año | number | EVIDENCIA: `f_estadisticas_flujo.js` → `cabeceras = ["Año", ...]` → se escribe en fila 1 |
| 2 | Semana | number | EVIDENCIA: `f_estadisticas_flujo.js` → `cabeceras = [..., "Semana", ...]` |
| 3 | Tareas Nuevas | number | EVIDENCIA: `f_estadisticas_flujo.js` → `cabeceras = [...,"Tareas Nuevas",...]` |
| 4 | Tareas Abiertas | number | EVIDENCIA: `f_estadisticas_flujo.js` → `cabeceras = [...,"Tareas Abiertas",...]` |
| 5 | Tareas Cerradas | number | EVIDENCIA: `f_estadisticas_flujo.js` → `cabeceras = [...,"Tareas Cerradas"]` |

Reglas:
- Semana ISO calculada con `obtenerSemanaISO`.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `obtenerSemanaISO(fecha)` → ajuste al jueves y cálculo `Math.ceil(...)`.

## Hoja `Resumen Semanal` (f_estadisticas_analitico.js)

### Cabecera confirmada (fila 1)

`['Año', 'Semana', 'Estado', 'Prioridad', 'Número de Tareas', 'Media Días desde Inicio', 'Desviación Media en Días', 'Tareas nuevas semana', 'Total tareas no hechas']`

- EVIDENCIA: `f_estadisticas_analitico.js` → `calcularResumenHechas()` → `const salida = [[...cabecera...]]`.

## Hojas de errores

### `Errores_Estadisticas`

Columnas (fila 1): `['Fecha', 'Función', 'Mensaje', 'Detalle']`
- EVIDENCIA: `f_estadisticas_flujo.js` → `registrarError()` → `appendRow(['Fecha', 'Función', 'Mensaje', 'Detalle'])`.

### `Errores`

Columnas (fila 1): `['Hoja', 'Fila', 'Mensaje']` (y se limpia en cada ejecución de resumen semanal)
- EVIDENCIA: `f_estadisticas_analitico.js` → `procesarResumenPorFechaFin()` → `hojaErrores.clearContents(); hojaErrores.appendRow(['Hoja','Fila','Mensaje'])`.

## Ejemplos (mínimos y verificables)

### Ejemplo 1 — Alta de tarea (col A)

Se escribe la fecha en formato `dd/MM/yyyy` en `Tareas!A2` y se activa `Tareas!B2` para completar datos manualmente.
- EVIDENCIA: `Código.js` → `nuevaTarea()` → `rngCelda = hj_tareas.getRange(2, 1); rngCelda.setValue(fechaAlta); ... hj_tareas.setActiveRange(getRange(2,2))`.

### Ejemplo 2 — Finalización (col E y última col)

Se asigna fecha fin real en última columna y estado `'hecho'` en columna 5.
- EVIDENCIA: `Código.js` → `finalizarTarea()` → `getRange(filaTarea, columnasTarea).setValue(fechaFin)` y `getRange(filaTarea, 5).setValue('hecho')`.

