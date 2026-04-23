# Operaciones — despliegue y ejecución (clasp / triggers / validación)

## Referencias cruzadas

- Flujos (UI y batch): ver `docs/FLOWS.md`.
- Seguridad y riesgos: ver `docs/SECURITY.md`.
- Diagnóstico de fallos: ver `docs/TROUBLESHOOTING.md`.

## `clasp` (gestión del proyecto Apps Script)

### Identidad del script

- **Script ID**: se obtiene de `.clasp.json`.
  - EVIDENCIA: `.clasp.json` → `scriptId` → `"168DVYrdihcaO0XGEu7cYeBbgWkkazdqDRr9mtgjRLlAd7G2gaQss-z22"`.
- **Root dir**: `.clasp.json` fija `rootDir` con ruta absoluta local.
  - Riesgo operativo: la ruta absoluta puede no existir en otros equipos/CI.
  - EVIDENCIA: `.clasp.json` → `rootDir` → `"/home/luis/Documentos/Desarrollo_GAS2/Gestion_Tareas_Susi"`.

### Comandos operativos (reproducibles)

> El repo no incluye scripts automatizados; las operaciones de `clasp` se asumen manuales.
> SUPOSICIÓN: el usuario tiene `@google/clasp` instalado globalmente o en PATH.
> Verificación: ejecutar `clasp -v` en el entorno local.

- **Login**:

```bash
clasp login
```

- **Sincronizar desde Apps Script → local**:

```bash
clasp pull
```

- **Publicar desde local → Apps Script**:

```bash
clasp push
```

## Versionado / Runtime

- **Runtime**: V8.
  - EVIDENCIA: `appsscript.json` → `runtimeVersion` → `"V8"`.
- **Zona horaria**: `Europe/Madrid`.
  - EVIDENCIA: `appsscript.json` → `timeZone` → `"Europe/Madrid"`.
- **Logging de excepciones**: `STACKDRIVER`.
  - EVIDENCIA: `appsscript.json` → `exceptionLogging` → `"STACKDRIVER"`.

## Triggers (creación / verificación / eliminación de duplicados)

### Trigger soportado por código

El repo define un trigger time-based que ejecuta el batch de estadísticas y notifica por email.

- **Handler**: `triggerCalculoEstadisticas`
  - EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → función definida.
- **Creación y deduplicación**: `crearTriggerCalculoEstadisticas()` borra triggers previos con el mismo handler antes de crear uno nuevo.
  - EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → `ScriptApp.getProjectTriggers()` + `if (trigger.getHandlerFunction() === 'triggerCalculoEstadisticas') ScriptApp.deleteTrigger(trigger)`.
- **Programación**: se configura para `FRIDAY` a las `13` y `nearMinute(10)`.
  - EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → `.onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(13).nearMinute(10)`.

SUPOSICIÓN (nomenclatura comentario vs código):
- El comentario indica “cada lunes a las 03:00”, pero el código crea viernes 13:10 aprox.
- Verificación: abrir `f_planificador.js` y contrastar comentario `// Crear nuevo trigger...` con la cadena `onWeekDay(...).atHour(...).nearMinute(...)`.
- Riesgo operativo: documentación interna (comentario) no coincide con el comportamiento real.
  - EVIDENCIA: `f_planificador.js` → `crearTriggerCalculoEstadisticas()` → comentario “lunes 03:00” y código FRIDAY/13/nearMinute(10).

### Listado de triggers activos

El repo incluye utilidad para listar triggers en `Logger`.
- EVIDENCIA: `f_planificador.js` → `listarTriggersActivosLogger()` → `ScriptApp.getProjectTriggers()` + `Logger.log(...)`.

## Checklist de validación operativa (sin tocar código)

### UI / Menú

- **Menú aparece al abrir la hoja**: “Lista Tareas” con item “Mostrar Barar Lateral”.
  - EVIDENCIA: `Código.js` → `onOpen()` → `SpreadsheetApp.getUi().createMenu('Lista Tareas').addItem('Mostrar Barar Lateral','mostrarBarraLateral')`.
- **Sidebar renderiza** `index.html`.
  - EVIDENCIA: `Código.js` → `mostrarBarraLateral()` → `createHtmlOutputFromFile('index')`.

### Hojas requeridas

- Deben existir al menos `Tareas` y `Hecho` para flujos 1..6.
  - EVIDENCIA: `Código.js` → `getSheetByName('Tareas')` y `getSheetByName('Hecho')`.
- Para estadísticas:
  - `estadisticasV2` crea `Estadisticas` si no existe (y borra si existe).
    - EVIDENCIA: `f_estadisticasV2.js` → `prepararHojaEstadisticas()` → `if (existeHoja()) borrarHoja(); crearHoja(3);`.
  - `calculoEstadisticas` crea/limpia `Resumen Semanal` y `Errores`.
    - EVIDENCIA: `f_estadisticas.js` → `procesarResumenPorFechaFin()` → `ss.getSheetByName('Resumen Semanal') || ss.insertSheet('Resumen Semanal')` y `hojaErrores = ... || ss.insertSheet('Errores'); hojaErrores.clearContents();`.

### Formato de fechas (crítico para estadísticas)

- `estadisticasV2` parsea strings `dd/MM/yyyy`.
  - EVIDENCIA: `f_estadisticasV2.js` → `convertirAFecha(str)` → `const [d,m,y] = str.split("/").map(Number);`.
- Riesgo operativo: si el display en la hoja no sigue `dd/MM/yyyy` (p.ej. `MM/dd/yyyy`), los conteos semanales serán erróneos.
  - EVIDENCIA: `f_estadisticasV2.js` → `convertirAFecha(str)` → split por `/` y asignación `new Date(y, m-1, d)`.

