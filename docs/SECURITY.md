# Seguridad — permisos, riesgos y límites (auditable)

## Referencias cruzadas

- Arquitectura y riesgos operativos detectados: ver `docs/ARCHITECTURE.md`.
- Flujos batch y UI: ver `docs/FLOWS.md`.

## Superficie de permisos (APIs usadas en repo)

El conjunto de APIs usadas determina el “scope” requerido por el script al autorizarse.

| API | Uso en código | Riesgo principal | Evidencia |
|---|---|---|---|
| `SpreadsheetApp` | Lectura/escritura/borrado de filas, rangos, colores, creación/borrado de hojas | Integridad: borrados masivos (`deleteRows`, `deleteSheet`) y reescritura total (`setValues`) | EVIDENCIA: `Código.js` → `moverFinalizadas()` → `hjTareas.deleteRows(...)`; EVIDENCIA: `f_estadisticas_flujo.js` → `borrarHoja()` → `libro.deleteSheet(hoja)` |
| `HtmlService` | Renderiza sidebar desde `index.html` | UI puede disparar acciones destructivas si el usuario autorizado las ejecuta | EVIDENCIA: `Código.js` → `mostrarBarraLateral()` → `HtmlService.createHtmlOutputFromFile('index')` |
| `ScriptApp` | Crea/borra/lista triggers del proyecto | Persistencia de ejecución automática; riesgo de duplicación o ejecución en horarios no esperados | EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → `getProjectTriggers()` + `deleteTrigger(...)` + `newTrigger(...).create()` |
| `MailApp` | Envía email de éxito/error del batch | Confidencialidad: exposición de stacktrace por email; envío a destinatario hardcodeado | EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → `MailApp.sendEmail(destinatario, asunto, cuerpo)` |
| `Utilities` / `Session` | Formateo de fechas con timezone de script | Integridad: fecha escrita como string puede divergir de tipo `Date` esperado en otros flujos | EVIDENCIA: `Código.js` → `nuevaTarea()`/`finalizarTarea()` → `Session.getScriptTimeZone(); Utilities.formatDate(...,"dd/MM/yyyy")` |
| `Logger` / `console` | Log de diagnóstico | Confidencialidad baja (logs en ejecuciones), pero útil para auditoría | EVIDENCIA: `f_planificador.js` → `listarTriggersActivosLogger()` → `Logger.log(...)`; EVIDENCIA: `Código.js` → `console.log(...)` |

## WebApp: `executeAs` y `access`

El manifest define configuración de webapp aunque el repo usa UI de Spreadsheet (sidebar).

- **executeAs**: `USER_DEPLOYING`
- **access**: `MYSELF`
- EVIDENCIA: `appsscript.json` → `webapp` → `executeAs` y `access`.

Interpretación operativa (verificable):
- El acceso a la webapp (si se despliega como tal) estaría restringido al propietario del despliegue (`MYSELF`).
- SUPOSICIÓN: el proyecto se usa principalmente como “container-bound” a un Spreadsheet y se opera desde `onOpen()`/UI; no hay `doGet()` en repo.
  - Verificación: buscar función `doGet`/`doPost` en el repositorio (no aparece en los archivos analizados).

## Triggers: riesgos y control

### Riesgos

- **Ejecución automática**: `triggerCalculoEstadisticas` ejecuta `estadisticasV2` y `ejecutarEstadisticasAnaliticas` y luego envía email, con potencial de:
  - Borrado/creación de hojas (`Estadisticas`, `Errores`, `Resumen Semanal`).
  - Envío de stacktrace por email.
  - EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → `estadisticasV2(); ejecutarEstadisticasAnaliticas(); MailApp.sendEmail(...)`.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `prepararHojaEstadisticas()` → `borrarHoja()`/`crearHoja()`.
  - EVIDENCIA: `f_estadisticas_analitico.js` → `procesarResumenPorFechaFin()` → `hojaErrores.clearContents(); hojaResumen.clearContents();`.

### Control implementado en repo

- **Deduplicación**: antes de crear el trigger, se eliminan triggers previos del mismo handler.
  - EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → `if (trigger.getHandlerFunction() === 'triggerCalculoEstadisticas') deleteTrigger`.

## Email (`MailApp`) y exposición de información

- Se envía email con:
  - Mensaje de error (`error.message`)
  - Stack (`error.stack`)
  - EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → `cuerpo = \`...\n\n${error.message}\n\nStack:\n${error.stack}\``.

Riesgo:
- El stack puede incluir detalles de estructura de datos o nombres de hojas/funciones, útil para depuración pero potencialmente sensible.

## Cuotas y límites (operativos)

> El repo no define límites explícitos ni control de cuotas. Los siguientes puntos dependen de cuotas estándar de Apps Script y volumen real.

### Operaciones de escritura masiva

- `reorganizarTareas` reescribe toda la tabla de tareas (`clearContent` + `setValues`) y luego `pijama` aplica `setBackgrounds` sobre todo el rango.
  - Impacto: mayor consumo de tiempo/cuota conforme crece la hoja.
  - EVIDENCIA: `Código.js` → `reorganizarTareas()` → `clearContent(); setValues(tablafinal); pijama();`.
  - EVIDENCIA: `f_secundarias.js` → `pijama()` → `rng_pijama.setBackgrounds(colores)`.

### Borrado de filas en bloque

- `moverFinalizadas` borra desde la primera finalizada hasta el final (`deleteRows(filaInicalTareaMov, ...)`).
  - Riesgo: si `filaInicalTareaMov` se calcula mal (p.ej. no se encuentra ninguna finalizada), el borrado puede ser erróneo o fallar.
  - EVIDENCIA: `Código.js` → `moverFinalizadas()` → `filaInicalTareaMov` y `deleteRows(filaInicalTareaMov, (numfilas - filaInicalTareaMov + 1))`.

## Riesgos operativos consolidados (sin corrección)

- **Errores silenciosos/encadenados por variables mal nombradas en `catch`** (`finalizarTarea`, `reactivarTarea`, `moverFinalizadas`).
  - EVIDENCIA: `Código.js` → `finalizarTarea()`/`reactivarTarea()`/`moverFinalizadas()` → bloques `catch` con variables inconsistentes.
- **Dependencia de formato `dd/MM/yyyy` en estadísticas v2**.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `convertirAFecha(str)` → split por `/`.
- **Destinatario hardcodeado** en email.
  - EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → `const destinatario = "luiskycv24@gmail.com";`.

