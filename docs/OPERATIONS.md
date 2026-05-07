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

Notas:

- El repo incluye scripts npm de **hardening mínimo** para reducir errores operativos (ver `package.json` en la raíz).
- SUPOSICIÓN: el usuario tiene `@google/clasp` instalado globalmente o en PATH.
- Verificación: ejecutar `clasp -v` en el entorno local.

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

Notas (hardening mínimo):
- Para **DES** (fuentes sueltas), preferir `npm run deploy:des` desde la raíz del repo: fija el `cwd` correcto (`Gestion_Tareas_Susi/`).
- Para **PRO** (bundle), el bundling usa `scripts/build-gas-bundle.js` y aplica un coverage check: si hay `.gs/.js` nuevos no incluidos en `FILE_ORDER`, el build falla.

## UI / HtmlService (reglas operativas para evitar divergencias DES/PRO)

Este proyecto soporta:

- **DES**: fuentes sueltas desplegadas con `clasp push` desde `Gestion_Tareas_Susi/`.
- **PRO/BUNDLE**: despliegue de `dist/app.bundle.gs` donde el HTML está embebido y se resuelve por `gasHtmlRawByName_`.

Regla operativa: cualquier renderizado de HTML debe usar los wrappers core:

- `ui_renderHtml(nombre)` para producir `HtmlOutput` (sidebar/modales) con `Template.evaluate()`.
- `ui_htmlRawByName_(nombre)` para resolver HTML raw (usado por `include(...)`).

Motivo: evitar:

- `Exception: No se ha encontrado el archivo HTML denominado ...` (PRO/BUNDLE cuando se usa `*FromFile` fuera del wrapper).
- `<?!= include('...') ?>` impreso como texto (cuando no se evalúa como template).

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
- **Creación / deduplicación / programación**: se gestiona en el módulo de triggers (config centralizada + recreación).
  - **Backend**:
    - EVIDENCIA: `f_triggers.gs` → `crearTriggerCalculoEstadisticas()` → `eliminarTriggers(config.nombre)` + `crearTriggerDesdeConfig(config)`.
    - EVIDENCIA: `f_triggers.gs` → `crearTriggerDesdeConfig(config)` → `.onWeekDay(...).atHour(...).nearMinute(...)`.
  - **Configuración persistida**:
    - EVIDENCIA: `f_triggers.gs` → `TRIGGERS_CONFIG_PROPERTY_KEY = 'TRIGGERS_CONFIG'` + `guardarConfigTriggers()` / `obtenerConfigTriggers()`.
  - **API (UI → backend)**:
    - EVIDENCIA: `f_triggers_api.gs` → `apiObtenerTriggers()` / `apiGuardarTriggers(config)` / `apiRecrearTriggers()` / `apiInicializarTriggersConfig()`.
  - **UI de administración**:
    - EVIDENCIA: `panelTriggers.html` + `panelTriggers_script.html` (modal) → llama a `apiObtenerTriggers/apiGuardarTriggers/apiRecrearTriggers`.

Nota (separación handler/orquestación):
- `triggerCalculoEstadisticas()` es un **handler ligero** (wrapper `try/catch`) que delega el cálculo.
  - EVIDENCIA: `f_planificador.js` → `triggerCalculoEstadisticas()` → `ejecutarCalculoEstadisticas()` + `notificarExito()` / `notificarError(error)`.
- La **orquestación principal** del sistema de estadísticas vive en:
  - EVIDENCIA: `f_planificador_service.gs` → `ejecutarEstadisticasDelSistema()` (entrypoint de orquestación) → flujo + analítico + toast + alertas proactivas.

SUPOSICIÓN (nomenclatura comentario vs código):
- El comentario indica “cada lunes a las 03:00”, pero el código crea viernes 13:10 aprox.
- Verificación: abrir `f_triggers.gs` y contrastar la configuración guardada (`TRIGGERS_CONFIG` / ScriptProperty `TRIGGERS_CONFIG`) con la cadena `onWeekDay(...).atHour(...).nearMinute(...)`.
- Riesgo operativo: documentación interna (comentario) no coincide con el comportamiento real.
  - EVIDENCIA: `f_triggers.gs` → configuración por defecto `TRIGGERS_CONFIG` → `diaSemana: 'FRIDAY', hora: 13, minuto: 10`.

### Listado de triggers activos

Listado recomendado (operativo, sin depender de helpers):
- En Apps Script UI → **Triggers**: verificar existencia del handler `triggerCalculoEstadisticas`.
- Alternativa: recrear desde la UI `panelTriggers` (acción “Recrear triggers”) si existe configuración guardada.

## Checklist de validación operativa (sin tocar código)

### UI / Menú

- **Menú aparece al abrir la hoja**: “Lista Tareas” con item “Mostrar Barar Lateral”.
  - EVIDENCIA: `Código.js` → `onOpen()` → `SpreadsheetApp.getUi().createMenu('Lista Tareas').addItem('Mostrar Barar Lateral','mostrarBarraLateral')`.
- **Sidebar renderiza** `index.html`.
  - EVIDENCIA: `Código.js` → `mostrarBarraLateral()` → `ui_renderHtml('index')`.
  - Nota: esto es crítico para compatibilidad DES/PRO (ver `docs/ARCHITECTURE.md`).

- **Paneles administrativos** (modales) se abren como ventana flotante:
  - “Ver dashboard de estadísticas” → modal.
  - “Gestión de Triggers” → modal.
  - “Configuración notificaciones” → modal.

### Hojas requeridas

- Deben existir al menos `Tareas` y `Hecho` para flujos 1..6.
  - EVIDENCIA: `Código.js` → `getSheetByName('Tareas')` y `getSheetByName('Hecho')`.
- Para estadísticas:
  - `estadisticasV2` crea `Estadisticas` si no existe (y borra si existe).
    - EVIDENCIA: `f_estadisticas_flujo.js` → `prepararHojaEstadisticas()` → `if (existeHoja()) borrarHoja(); crearHoja(3);`.
  - `ejecutarEstadisticasAnaliticas` crea/limpia `Resumen Semanal` y `Errores`.
    - EVIDENCIA: `f_estadisticas_analitico.js` → `procesarResumenPorFechaFin()` → `ss.getSheetByName('Resumen Semanal') || ss.insertSheet('Resumen Semanal')` y `hojaErrores = ... || ss.insertSheet('Errores'); hojaErrores.clearContents();`.

### Formato de fechas (crítico para estadísticas)

- `estadisticasV2` parsea strings `dd/MM/yyyy`.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `convertirAFecha(str)` → `const [d,m,y] = str.split("/").map(Number);`.
- Riesgo operativo: si el display en la hoja no sigue `dd/MM/yyyy` (p.ej. `MM/dd/yyyy`), los conteos semanales serán erróneos.
  - EVIDENCIA: `f_estadisticas_flujo.js` → `convertirAFecha(str)` → split por `/` y asignación `new Date(y, m-1, d)`.

