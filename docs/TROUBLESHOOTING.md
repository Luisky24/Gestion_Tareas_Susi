# Troubleshooting — diagnóstico y resolución operativa

## Referencias cruzadas

- Hojas y columnas: ver `docs/DATA_MODEL.md`.
- Flujos y contratos: ver `docs/FLOWS.md`.
- Riesgos de seguridad y batch: ver `docs/SECURITY.md`.

## Tabla de síntomas (mínimos requeridos)

| Síntoma | Causa probable (verificable) | Diagnóstico paso a paso | Solución operativa (sin tocar código) |
|---|---|---|---|
| **Fechas mal parseadas** en `Estadisticas` (semanas/años incorrectos) | `estadisticasV2` parsea strings asumiendo `dd/MM/yyyy`; si el display en la hoja es distinto, el parseo se invierte | 1) Abrir hoja `Estadisticas` y revisar valores anómalos 2) Verificar formato de fecha mostrado en `Tareas!A:A` y `Tareas!G:G` 3) Revisar `Errores_Estadisticas` por entradas de `convertirAFecha`/`obtenerAnioYSemana` (si existen) | Ajustar el formato de visualización de la hoja para `dd/MM/yyyy` o convertir celdas a tipo fecha real en Sheets | 
| **Triggers no ejecutándose** | Trigger no creado o fue borrado; falta autorización; proyecto sin triggers activos | 1) Ejecutar `listarTriggersActivosLogger()` y revisar `Logger` 2) En Apps Script UI: “Triggers” comprobar existencia de `triggerCalculoEstadisticas` 3) Revisar “Ejecuciones” para ver errores/denegaciones | Ejecutar `crearTriggerCalculoEstadisticas()` manualmente desde editor GAS con cuenta autorizada y volver a listar triggers |
| **Duplicados en `Hecho`** tras mover finalizadas | Clave de deduplicación depende de `fechaFinReal.getTime()` + texto tarea + `fechaAlta.getTime()`. Si cambia el texto, o hay fechas no-`Date`, la clave se rompe y se insertan duplicados | 1) Revisar si en `Hecho` hay tareas con mismo texto y fechas similares 2) Confirmar tipos de columnas A y G en `Tareas/Hecho` (deben ser fechas reales, no strings) 3) Revisar que `moverFinalizadas` no está fallando (Apps Script executions) | Normalizar columnas A y G a tipo fecha real en Sheets y volver a ejecutar `moverFinalizadas()`; si hay duplicados existentes, deduplicar manualmente en `Hecho` (antes de siguiente ejecución) |
| **Mover Finalizados no hace nada / falla** cuando no hay tareas en estado `'hecho'` | `moverFinalizadas` inicializa `filaInicalTareaMov = 0` y solo la asigna si encuentra al menos una tarea con estado `'hecho'`; después intenta `deleteRows(filaInicalTareaMov, ...)` | 1) Verificar si existen tareas con `Estado == "hecho"` (col E) en `Tareas` 2) Revisar ejecuciones en Apps Script por error en `deleteRows` 3) Si falla, confirmar que `filaInicalTareaMov` quedó en 0 (a partir del comportamiento observado en logs/stack) | No ejecutar “Mover Finalizados” cuando no existan tareas hechas; primero finalizar al menos una tarea o usar reorganización/filtrado manual para confirmar estado |
| **Errores silenciosos** (UI muestra “Proceso completado” pero no cambia nada) | UI usa `withSuccessHandler((error) => updateStatus('Proceso completado.'))`: ignora resultado real; además algunos `catch` pueden lanzar errores secundarios (variables mal nombradas) | 1) Abrir consola de Apps Script (Ejecuciones) y revisar logs/errores del handler llamado 2) Revisar si se escribió en hojas de errores (`Errores`, `Errores_Estadisticas`) 3) Forzar error controlado (p.ej. seleccionar fila 1 y “Finalizar Tarea”) y ver si llega a UI | Operar con “Ejecuciones” y hojas de error como fuente de verdad. Si el UI no refleja cambios, verificar selección activa (fila válida) y permisos |
| **UI sin cambios / botones no responden** | Sidebar no cargado o `google.script.run` falla por permisos/autorización; botón deshabilitado por estado no restaurado | 1) Reabrir sidebar desde menú “Lista Tareas” 2) Revisar consola del navegador (si aplica) y “Ejecuciones” en Apps Script 3) Confirmar que `index.html` se está sirviendo (`mostrarBarraLateral`) | Reautorizar script al ejecutar `mostrarBarraLateral()`/cualquier función desde editor GAS; recargar spreadsheet |

Notas de evidencia:
- EVIDENCIA: `f_estadisticasV2.js` → `convertirAFecha(str)` → parseo `dd/MM/yyyy` con `split("/")`.
- EVIDENCIA: `f_planificador.js` → `listarTriggersActivosLogger()` → enumeración de triggers en `Logger`.
- EVIDENCIA: `Código.js` → `moverFinalizadas()` → clave `\`${elemenIn[6].getTime()}|${elemenIn[1]}|${elemenIn[0].getTime()}\``.
- EVIDENCIA: `Código.js` → `moverFinalizadas()` → `hjTareas.deleteRows(filaInicalTareaMov, (numfilas - filaInicalTareaMov + 1))` (borrado depende de `filaInicalTareaMov`).
- EVIDENCIA: `index.html` → `google.script.run.withSuccessHandler((error) => updateStatus('Proceso completado.'))` (no usa retorno).

## Diagnóstico detallado (paso a paso)

### 1) Verificar “fuente de verdad” del error

1. Revisar ejecuciones del proyecto en Apps Script (stacktraces y permisos).
   - EVIDENCIA: `appsscript.json` → `exceptionLogging: "STACKDRIVER"` (registro de excepciones).
2. Para `estadisticasV2`, revisar hoja `Errores_Estadisticas`.
   - EVIDENCIA: `f_estadisticasV2.js` → `registrarError()` → crea/inserta `Errores_Estadisticas` y hace `appendRow(...)`.
3. Para `calculoEstadisticas` (resumen semanal), revisar hoja `Errores`.
   - EVIDENCIA: `f_estadisticas.js` → `procesarResumenPorFechaFin()` → crea/limpia `Errores` y añade filas con mensaje.

### 2) Verificar selección activa y rango (flujos UI 2/4/3)

- Finalizar/Borrar dependen de la fila activa y validan rango.
  - EVIDENCIA: `Código.js` → `finalizarTarea()` → `filaTarea = rngTarea.getRow(); if (filaTarea > filasTareas || filaTarea < 2) throw ...`.
  - EVIDENCIA: `Código.js` → `borrarTarea()` → valida `filaTarea > 1 && filaTarea <= ultFila`.

### 3) Verificar tipos de datos (Date vs string)

Caso crítico:
- `moverFinalizadas` requiere `Date` en columnas A y G (usa `.getTime()`).
  - EVIDENCIA: `Código.js` → `moverFinalizadas()` → `elemenIn[6].getTime()` y `elemenIn[0].getTime()`.

Diagnóstico:
1) En la hoja, seleccionar una celda de fecha y comprobar si Sheets la reconoce como fecha (formato de celda).
2) Si proviene de importación/copia, convertir manualmente a fecha real.

### 4) Verificar triggers (existencia y duplicados)

1) Ejecutar `listarTriggersActivosLogger()` y revisar `Logger`.
   - EVIDENCIA: `f_planificador.js` → `listarTriggersActivosLogger()` → `Logger.log(...)`.
2) Re-crear trigger con deduplicación.
   - EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → borra triggers previos por handler y crea nuevo.

## Riesgos operativos conocidos (para interpretar incidencias)

Estos puntos pueden cambiar la forma en que se manifiesta un error (p.ej. “error secundario” que tapa el original).

- `finalizarTarea` lanza `err.message` dentro de `catch(error)` → puede ocultar el error real.
  - EVIDENCIA: `Código.js` → `finalizarTarea()` → `catch (error) { throw new Error(err.message); }`.
- `reactivarTarea` y `moverFinalizadas` tienen inconsistencias similares en `catch`.
  - EVIDENCIA: `Código.js` → `reactivarTarea()` → `throw new Error(error.message)` dentro de `catch (err)`.
  - EVIDENCIA: `Código.js` → `moverFinalizadas()` → `catch (err) { throw new Error(error.message); }`.
- `f_estadisticasV2.js` define `grabarEnHjEstadisticas` dos veces (sobrescritura).
  - EVIDENCIA: `f_estadisticasV2.js` → `grabarEnHjEstadisticas(valores)` → definiciones duplicadas.

