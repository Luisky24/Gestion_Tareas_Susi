## 1. Visión general

El sistema **Estadísticas V3** es una tercera generación del módulo de estadísticas del proyecto, implementada con **arquitectura por capas** y orientada a ser **mantenible, robusta y extensible**.

### Qué hace

- Lee tareas desde las hojas **`Tareas`** y **`Hecho`**.
- Normaliza los datos a una estructura homogénea (fechas a `Date`, estado normalizado, prioridad numérica, y cálculo de **año/semana ISO**).
- Valida consistencia de datos antes de ejecutar cálculos.
- Calcula dos salidas:
  - **Resumen semanal** (conceptualmente equivalente a V1) en la hoja **`Resumen Semanal V3`**
  - **Evolución semanal** (conceptualmente equivalente a V2) en la hoja **`Estadisticas V3`**
- Escribe una hoja de errores de validación/carga: **`Errores Estadisticas V3`**
- Registra un log de ejecución: **`Log Estadisticas V3`**

### Qué problema resuelve

V3 reduce el acoplamiento y los riesgos típicos del legacy:

- Evita depender del **orden fijo de columnas**: usa un **mapeo dinámico** basado en la cabecera.
- Centraliza configuración (nombres de hojas y estados).
- Separa IO (Spreadsheet) de dominio (funciones puras).
- Añade **validación previa** y un **modo seguro** en el orquestador (no “tumba” el proceso si hay errores).

### Diferencias respecto a V1 y V2

- **V1 (`f_estadisticas.js`)** genera el resumen semanal en otras hojas y con su propia lógica de semana/errores. V3 replica el objetivo de “resumen” pero con capas, validación y semana ISO unificada.
- **V2 (`f_estadisticasV2.js`)** calcula evolución (nuevas/abiertas/cerradas) con enfoque distinto y bastante IO. V3 implementa una evolución equivalente pero:
  - sin `getDisplayValues()` (V3 usa `getValues()`)
  - sin variables globales
  - con cálculo optimizado de “abiertas por semana”
  - con validación y logging integrados

---

## 2. Arquitectura por capas

La V3 está dividida en módulos `.gs` con responsabilidades claras. La regla general es:

- **IO (SpreadsheetApp)** solo en Loader/Writer/Logging/Columnas.
- **Dominio/Normalización/Validación/Reglas** deben ser funciones **puras**.

### Acceso a datos (IO)

Funciones que acceden directamente a `SpreadsheetApp` para leer/escribir.

- **Loader** (`estadisticasV3Loader.gs`)
  - `io_cargarTareasDesdeHojas()`
    - Lee `Tareas` y `Hecho` usando `getValues()`
    - Obtiene mapeo de columnas desde cabecera (ver módulo Columnas)
    - Devuelve `{ datosCrudos, errores }`

- **Writer** (`estadisticasV3Writer.gs`)
  - `io_escribirDatosEnHoja(nombreHoja, datos)`
    - Crea hoja si no existe, limpia contenido y escribe una matriz 2D
    - Normaliza número de columnas para evitar errores de `setValues`
  - `io_escribirErrores(nombreHoja, errores)`
    - Escribe errores estructurados con cabecera `["Fuente","Fila","Mensaje"]`

- **Logging** (`estadisticasV3Logging.gs`)
  - `io_registrarLogEjecucion(info)`
    - Añade una fila a la hoja `Log Estadisticas V3`
    - Cabecera: Fecha ejecución, totales, duración

- **Columnas** (`estadisticasV3Columnas.gs`)
  - `io_obtenerMapaColumnasDesdeHoja(hoja)`
    - Lee cabecera (fila 1) y detecta índices por nombre/sinónimos
  - `normalizarNombreColumna(v)`
    - Normaliza texto de cabecera (minúsculas, sin acentos, etc.)

### Lógica funcional (dominio)

Funciones puras que generan estructuras de salida (tablas) a partir de tareas normalizadas y válidas.

- **Resumen semanal** (`estadisticasV3ResumenDominio.gs`)
  - `dom_generarResumenSemanal(tareas)`
    - Agrupa por (año/semana ISO, estado, prioridad)
    - Se apoya en reglas: `tec_esTareaHecha(estado)` y `tec_esTareaAbierta(estado)`

- **Evolución semanal** (`estadisticasV3EvolucionDominio.gs`)
  - `dom_generarEvolucionSemanal(tareas)`
    - Calcula:
      - Nuevas por semana de alta
      - Cerradas por semana de cierre (solo si `tec_esTareaHecha`)
      - Abiertas por semana (solo si `tec_esTareaAbierta`)
    - Implementa cálculo optimizado por intervalos (sin bucle semana-a-semana por tarea)
  - Helpers técnicos internos del módulo:
    - `semanasISOEnAnio(anio)`
    - `construirOffsetsSemanas(minAnio, maxAnio)`
    - `absAAnioSemana(abs, ...)`

### Funciones técnicas

Funciones puras reutilizables para normalizar y aplicar reglas.

- **Semana ISO** (`estadisticasV3SemanaISO.gs`)
  - `tec_obtenerAnioSemanaISO(fecha)`
    - Implementación única en UTC

- **Normalizador** (`estadisticasV3Normalizador.gs`)
  - `tec_normalizarFecha(valor)` → `Date|null`
  - `tec_normalizarTareas(datosCrudos)` → tareas homogéneas con:
    - `fechaAlta`, `fechaFinEstimada`, `fechaFinReal` como `Date|null`
    - `anioAlta`, `semanaAlta`, `anioFin`, `semanaFin` usando semana ISO

- **Validación** (`estadisticasV3Validacion.gs`)
  - `tec_validarTareas(tareas)` → `{ tareasValidas, errores }`
    - Detecta fechas inválidas, `fechaFin < fechaAlta`, estado vacío, prioridad no numérica

- **Reglas de negocio** (`estadisticasV3Reglas.gs`)
  - `tec_normalizarEstado(estado)`
  - `tec_esTareaHecha(estado)` (usa `CONFIG_ESTADISTICAS.ESTADOS.HECHO`)
  - `tec_esTareaAbierta(estado)` (usa `CONFIG_ESTADISTICAS.ESTADOS.ABIERTOS` y excluye hechos)

- **Configuración** (`estadisticasV3Config.gs`)
  - `CONFIG_ESTADISTICAS`
    - Nombres de hojas (`HOJAS.*`)
    - Canon de estados (`ESTADOS.HECHO`, `ESTADOS.ABIERTOS`)

### Orquestación

- **Orquestador principal** (`estadisticasV3Orquestador.gs`)
  - `app_ejecutarEstadisticasV3()`
    - Ejecuta el pipeline completo en modo seguro (try/catch/finally)

---

## 3. Flujo de ejecución

La función principal es `app_ejecutarEstadisticasV3()` y sigue este flujo:

1. **Carga de datos (IO)**
   - `io_cargarTareasDesdeHojas()`
   - Produce:
     - `datosCrudos`: filas convertidas a objetos `{ fuente, fila, campos }`
     - `erroresCarga`: errores estructurales (hoja inexistente, columnas faltantes)

2. **Normalización (puro)**
   - `tec_normalizarTareas(datosCrudos)`
   - Convierte a objetos homogéneos con fechas `Date|null` y (año, semana ISO)

3. **Validación (puro)**
   - `tec_validarTareas(tareasNormalizadas)`
   - Devuelve:
     - `tareasValidas`
     - `erroresValidacion`

4. **Cálculo (puro)**
   - `dom_generarResumenSemanal(tareasValidas)` → tabla 2D
   - `dom_generarEvolucionSemanal(tareasValidas)` → tabla 2D
   - Ambos dominios usan reglas:
     - `tec_esTareaHecha(estado)`
     - `tec_esTareaAbierta(estado)`

5. **Escritura (IO)**
   - `io_escribirDatosEnHoja(CONFIG_ESTADISTICAS.HOJAS.RESUMEN, resumen)`
   - `io_escribirDatosEnHoja(CONFIG_ESTADISTICAS.HOJAS.EVOLUCION, evolucion)`
   - `io_escribirErrores(CONFIG_ESTADISTICAS.HOJAS.ERRORES, erroresCarga + erroresValidacion + erroresEjecucion)`

6. **Logging (IO)**
   - `io_registrarLogEjecucion({ fechaEjecucion, totalLeidas, validas, errores, duracionMs })`

7. **Modo seguro**
   - Si ocurre una excepción en cualquier punto del pipeline:
     - se registra un error estructurado `fuente:"V3"` en la lista de errores
     - se intenta escribir errores y log en el `finally`
     - el proceso no “revienta” por el fallo (best-effort)

---

## 4. Reglas de arquitectura

### Reglas de separación de capas

- **No mezclar IO con dominio**:
- Dominios (`dom_generarResumenSemanal`, `dom_generarEvolucionSemanal`) no deben llamar a `SpreadsheetApp`.
  - Normalizador, Validación y Reglas también deben mantenerse **puras**.

### Qué funciones pueden usar SpreadsheetApp

- Permitidas (IO):
  - `io_cargarTareasDesdeHojas`
  - `io_obtenerMapaColumnasDesdeHoja`
  - `io_escribirDatosEnHoja`
  - `io_escribirErrores`
  - `io_registrarLogEjecucion`
  - `app_ejecutarEstadisticasV3` (solo coordinación y llamadas a IO)

### Qué funciones deben ser puras

- Deben ser puras (sin SpreadsheetApp):
  - `tec_obtenerAnioSemanaISO`
  - `tec_normalizarFecha`, `tec_normalizarTareas`
  - `tec_validarTareas`
  - `tec_esTareaHecha`, `tec_esTareaAbierta`, `tec_normalizarEstado`
  - `dom_generarResumenSemanal`, `dom_generarEvolucionSemanal` (y helpers internos)

### Cómo añadir nuevas funcionalidades

- Si es **nuevo dato de entrada**:
  - añadir un nuevo campo al `campos` del Loader y mapearlo desde cabecera.
  - normalizarlo en el Normalizador.
  - validarlo en Validación (si aplica).
- Si es **nueva métrica**:
  - añadirla en el dominio correspondiente (Resumen/Evolución) como cálculo puro.
  - extender Writer si requiere una nueva hoja.
- Si es **nuevo estado**:
  - actualizar `CONFIG_ESTADISTICAS.ESTADOS` (y nada más).

---

## 5. Decisiones técnicas importantes

### Semana ISO como implementación única

- V3 usa **una sola** función: `tec_obtenerAnioSemanaISO(fecha)` (UTC).
- Esto evita discrepancias entre módulos y hace que Resumen/Evolución se apoyen en el mismo criterio.

### Normalización de datos

- Fechas se convierten a `Date|null` de manera defensiva.
- Prioridad se intenta convertir a `number` y si falla queda `null` (lo que la validación marca como error).
- Estado se normaliza a minúsculas.

### Configuración centralizada

- `CONFIG_ESTADISTICAS` centraliza:
  - nombres de hojas (evita strings repetidos)
  - canon de estados (hecho/abierto) para reglas de dominio

### Validación previa a cálculo

- Se calcula únicamente sobre `tareasValidas`.
- Errores se escriben en una hoja específica, sin interrumpir el proceso.

### “Abiertas por semana” optimizado

- En evolución semanal, “abiertas” se calcula por intervalos:
  - +1 en semana de inicio
  - -1 en semana posterior al fin
  - prefijo acumulado para obtener conteos por semana
- Evita el coste `O(n * semanas)` del enfoque week-by-week por tarea.

---

## 6. Riesgos actuales

### Dependencia de cabeceras (aunque sea dinámica)

- El mapeo depende de que la cabecera tenga nombres reconocibles por los sinónimos definidos.
- Si un usuario renombra columnas de forma inesperada, el Loader registrará “faltan columnas …” y no cargará esa hoja.

### Estados ambiguos

- La regla actual indica “Ignorar ambigüedades”.
- Si una tarea tiene estado no incluido en `ESTADOS.HECHO` ni `ESTADOS.ABIERTOS`, no contará como abierta ni cerrada en dominios.

### Datos incompletos

- Tareas con fechas inválidas o prioridad no numérica se excluyen por validación.
- Esto es deseable para integridad, pero puede “bajar” los conteos si la hoja contiene datos sucios.

### Sensibilidad a cambios de modelo

- Si se añaden nuevas columnas o cambia el significado de “cerrada”, hay que actualizar:
  - `CONFIG_ESTADISTICAS.ESTADOS`
  - (si aplica) sinónimos del mapeo en `estadisticasV3Columnas.gs`

---

## 7. Guía para futuras ampliaciones

### Añadir nuevas métricas

- **Resumen**:
- editar `dom_generarResumenSemanal(tareas)` para añadir columnas y agregados.
  - mantener la función pura: solo operar sobre el array de tareas.
- **Evolución**:
- editar `dom_generarEvolucionSemanal(tareas)` para nuevas series (por ejemplo “retrasadas por semana”).
  - si se requiere cálculo por intervalos, usar el patrón “deltas + prefijo”.

### Modificar hojas o nombres

- Cambiar nombres de hojas **solo** en `CONFIG_ESTADISTICAS.HOJAS`.
- Evitar cambios en hardcodes en Loader/Writer/Orquestador.

### Extender dominios sin romper la arquitectura

- No añadir `SpreadsheetApp` dentro de dominios.
- Si se necesita un nuevo output:
  - crear un nuevo dominio puro que devuelva tabla 2D
- escribir con `io_escribirDatosEnHoja(nombre, datos)`
  - conectar desde el Orquestador

### Endurecer validación

- Añadir reglas nuevas en `tec_validarTareas()` (por ejemplo “prioridad en rango 1..5”, “nombre no vacío”).
- Mantener el formato de errores `{ fuente, fila, mensaje }` para que Writer y Orquestador no cambien.

