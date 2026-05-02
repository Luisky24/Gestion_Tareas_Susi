# Sistema de estadísticas — visión actual

Documentación orientada a mantenimiento. Describe la arquitectura vigente centrada en el **dashboard modal**, la hoja **Estadisticas** y los procesos que orbitan alrededor, sin reproducir el código.

Para columnas y hojas de datos, complementar con `DATA_MODEL.md`. Para flujos generales del proyecto, ver `FLOWS.md` y `ARCHITECTURE.md`.

---

## 1. Visión general

El seguimiento operativo semanal se materializa en la hoja **Estadisticas**, generada por el **motor estadístico V2 (flujo)**. La interpretación para el usuario final se concentra en un **modal HTML** que combina:

- **Dashboard**: estado, score, tendencia global, KPIs con variación, predicción breve, insights y bloque de alertas (actualmente vacío por diseño).
- **Gráfico**: misma serie temporal con configuración persistente por usuario (series visibles y rango de semanas).

No existe ya dependencia de hojas intermedias de “análisis manual” ni de gráficos incrustados en la hoja **Estadisticas**. El reporting analítico en **Resumen Semanal** sigue siendo un segundo carril independiente (no alimenta el dashboard modal).

---

## 2. Arquitectura

En capas conceptuales:

1. **Entrada**: hojas **Tareas** y **Hecho** (y reglas del dominio) consumidas por el motor V2 del flujo estadístico.
2. **Persistencia operativa**: hoja **Estadisticas** (filas por semana ISO, métricas agregadas).
3. **Presentación interactiva**: `dashboard_estadisticas.html` + servidor (`obtenerDatosDashboardEstadisticas`, `obtenerDatosGraficaEstadisticas`, configuración de gráfico en propiedades de usuario).
4. **Orquestación**: una sola entrada programada o manual — `ejecutarEstadisticasDelSistema` — que ejecuta flujo y analítico según flags, limpia restos legacy, muestra toast opcional y puede enviar correo de alerta.

El dashboard **no recalcula** el motor V2: lee **Estadisticas** y deriva insights, score, tendencias y predicción en servidor.

---

## 3. Fuente de datos

| Origen | Uso |
|--------|-----|
| **Estadisticas** | Verdad operativa para el modal: últimas filas ordenadas por año/semana ISO (el gráfico del modal reordena internamente para lectura estable). |
| **Tareas / Hecho** | Solo el **flujo V2** durante `ejecutarEstadisticasFlujo`; el dashboard no las lee directamente. |
| **Resumen Semanal** | Salida del subsistema **analítico**; no forma parte del objeto JSON del dashboard. |

La columna **Semana (Año)** (típicamente columna G) permanece en datos y puede estar oculta por presentación; el modal usa etiquetas coherentes con esa información.

---

## 4. Dashboard

- **Apertura**: función expuesta al menú (`mostrarDashboardEstadisticas`), HtmlService modal.
- **Carga**: `obtenerDatosDashboardEstadisticas` devuelve estado (fusión score vs base OK), KPIs con tendencia, predicción opcional, insights con códigos, score detalle, recomendación, gráfica normalizada y lista `alertas` (lista vacía reservada por compatibilidad de interfaz).
- **Estado “peor”**: se conserva la idea de combinar un estado base con el derivado del score para no suavizar situaciones graves.
- **Guía embebida**: texto estático en el HTML del modal; no depende de hojas de ayuda en el libro.

---

## 5. Lógica de negocio (derivada, sin motor)

Toda esta lógica vive en el módulo de dashboard y opera sobre filas ya escritas en **Estadisticas** / serie del gráfico:

- **Insights**: reglas sobre ventanas recientes (nuevas altas, cierres bajos, backlog histórico creciente); cada hallazgo lleva **codigo** estable (`NUEVAS_ALTA`, `CIERRES_BAJOS`, `BACKLOG_CRECIENTE`).
- **Score**: 100 menos penalizaciones por **tipo** de insight presente (sin doble conteo por texto).
- **KPIs con tendencia**: última semana frente a media de las cuatro anteriores; flechas y límites de porcentaje mostrado en cliente.
- **Predicción**: extrapolación simple (último valor + delta respecto a la media de cuatro semanas); mensaje de backlog coloreado según sentido.
- **Tendencia global**: etiqueta CRECIENTE / DECRECIENTE / ESTABLE según la tendencia del KPI de histórico.

Ninguno de estos pasos escribe en **Estadisticas**.

---

## 6. Notificaciones

| Canal | Comportamiento |
|--------|----------------|
| **Toast en hoja** | Tras estadísticas globales: un mensaje según score/insights; puede omitirse si score alto sin insights. Anti-duplicado por mensaje en Script Properties (`ULTIMO_TOAST`). Fallos → log `ERROR_TOAST`. |
| **Correo** | Solo si hay alertas “proactivas” detectadas (predicción backlog en alza en texto, o insights por código); máximo **un envío por día** (`ULTIMA_ALERTA_FECHA`). Destinatario: `obtenerEmailNotificacion()` (propiedad opcional `EMAIL_NOTIFICACION`). Fallos → log `ERROR_ALERTAS_PROACTIVAS`. |

La barra lateral de tareas y otras notificaciones del planificador no forman parte de este documento salvo que compartan el mismo adaptador de correo.

---

## 7. Elementos eliminados o fuera de uso

Quitar del modelo mental y de los procedimientos:

- Hojas **Estadisticas_Analisis** y **Estadisticas_Ayuda**: ya no se mantienen; al ejecutar estadísticas globales se intenta **borrarlas si existen** (limpieza legacy).
- Menú: activar/desactivar análisis automático, ejecutar análisis ahora, ver ayuda de análisis.
- Generación de **gráfico incrustado** en la hoja **Estadisticas** (solo queda limpieza de charts viejos en preparación de hoja cuando aplica).
- Lectura del dashboard desde **Estadisticas_Analisis** (alertas y salud en hoja): la respuesta del servidor ya no las usa; la UI mantiene la sección con lista vacía y texto neutro.

Si aparecen triggers o botones asignados a funciones antiguas, deben eliminarse en el proyecto Apps Script.

---

## 8. Flujo del sistema

Orden relevante dentro de `ejecutarEstadisticasDelSistema`:

1. Migraciones de columnas necesarias (repositorio / compatibilidad).
2. **Eliminación de hojas legacy** de análisis/ayuda.
3. **Flujo estadístico V2** → escribe **Estadisticas** (si el flag está activo).
4. **Estadísticas analíticas** → escribe **Resumen Semanal** (si el flag está activo).
5. **Toast inteligente** (dashboard derivado, lectura solo).
6. **Alertas por correo** (condicional + anti-spam diario).

Los pasos 5–6 vuelven a llamar a funciones que leen el libro; no modifican **Estadisticas** salvo errores indirectos no previstos.

---

## 9. Módulos (mapa rápido)

| Área | Archivos principales |
|------|------------------------|
| Motor flujo + contexto global V2 | `f_estadisticas_flujo.js` |
| IO hoja Estadisticas (preparar, grabar, presentación columnas, limpiar charts) | `estadisticasV2_io.gs` |
| Utilidades fechas / errores V2 | `estadisticasV2_fechas.gs`, `estadisticasV2_errores.gs` |
| Analítico Resumen Semanal | `f_estadisticas_analitico.js` |
| Dashboard + score + insights + predicción + toast/correo asociados | `f_estadisticas_dashboard.js` |
| Modal gráfico: datos, ordenación hoja, UserProperties | `f_estadisticas_vista.js` |
| Limpieza legacy hojas | `f_estadisticas_analisis.js` (solo función de borrado) |
| Orquestación | `f_planificador_service.gs` |
| Email notificación | `f_planificador_notificaciones.gs` |
| Menú | `uiRepository.gs` |
| Cliente modal | `dashboard_estadisticas.html` |

El despliegue consolidado puede usar `scripts/build-gas-bundle.js` → `dist/app.bundle.gs` según la política del equipo.

---

## 10. Uso recomendado

- **Operación diaria/semanal**: disparar **una** función de cálculo global (`ejecutarEstadisticasDelSistema` o alias expuesto al usuario); abrir el **dashboard** para decisión rápida y el **gráfico** del modal para contexto temporal.
- **No** esperar datos del dashboard en **Estadisticas_Analisis**: ya no existe ese contrato.
- **Incidencias**: revisar hoja **Errores_Estadisticas** (u equivalente según `registrarError`) y códigos `ERROR_TOAST` / `ERROR_ALERTAS_PROACTIVAS`.
- **Evolution**: nuevas reglas de negocio “visibles al usuario” deberían preferir **insights con codigo** + score/recomendación antes que nuevas hojas auxiliares, para mantener un solo lugar de verdad (**Estadisticas** + modal).

---

## Referencias internas

- `docs/DATA_MODEL.md` — modelo de hojas y columnas.
- `docs/FLOWS.md` — flujos generales del proyecto.
- `docs/ARCHITECTURE.md` — inventario y decisiones de alto nivel.
- `docs/TROUBLESHOOTING.md` — diagnóstico de errores de estadísticas.

---

*Última alineación conceptual: dashboard como interfaz principal de interpretación; motor V2 como único escritor de **Estadisticas**; reporting analítico en paralelo.*
