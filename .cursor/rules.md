## Reglas obligatorias del proyecto (Apps Script)

Estas reglas son **obligatorias**. Si una modificación rompe alguna de ellas, **NO debe implementarse**.

Siempre priorizar:
- claridad
- separación de responsabilidades
- mantenibilidad

---

## 1. Separación de capas

- **NO** mezclar lógica de negocio con acceso a datos.
- **NO** usar `SpreadsheetApp` fuera de:
  - Loader
  - Writer
  - Logging
  - Columnas
  - Orquestador (**solo coordinación**)

---

## 2. Funciones puras

Las siguientes áreas deben ser **siempre puras**:
- Normalizador
- Validación
- Reglas de negocio
- Dominios (resumen, evolución)

Prohibido en estas capas:
- usar `SpreadsheetApp`
- usar variables globales
- efectos secundarios (escrituras, logs, mutaciones externas, etc.)

---

## 3. Reglas de negocio centralizadas

- **NO** dispersar reglas de negocio en múltiples sitios.
- **SIEMPRE** concentrar las reglas en funciones utilitarias del módulo correspondiente.

Regla actual (V2):
- En estadísticas V2, una tarea se considera **cerrada** si `Fecha fin real` (columna G / índice 6) no está vacía.
- En estadísticas V2, una tarea se considera **abierta** si `Fecha fin real` está vacía.

---

## 4. Configuración centralizada

- **NO** usar strings hardcodeados para:
  - nombres de hojas
  - estados
- **SIEMPRE** centralizar estos valores en constantes del módulo (p.ej. `nombreHoja`, `cabeceras`) o en un único archivo de configuración del proyecto.

---

## 5. Mapeo de columnas

- Si se usan **índices fijos**, deben estar:
  - documentados (modelo de datos)
  - agrupados como constantes `IDX_*` cerca de su uso
- Si se necesita robustez ante cambios de cabecera, usar mapeo por nombres.

---

## 6. Manejo de errores

- **NO** lanzar errores que rompan el sistema.
- **SIEMPRE**:
  - capturar errores en el orquestador
  - registrar errores en hoja
  - continuar ejecución si es posible (modo seguro)

---

## 7. Extensibilidad

Al añadir nuevas funcionalidades:
- respetar arquitectura existente
- no duplicar lógica
- reutilizar funciones existentes
- mantener funciones pequeñas y claras

---

## 8. Nombres de funciones

- usar nombres en español
- descriptivos
- coherentes con el resto del sistema

---

## 9. Arquitectura de estadísticas (anti-versiones paralelas)

### Punto único de entrada

- **SOLO** puede existir un entrypoint público para estadísticas:
  - `ejecutarEstadisticasDelSistema()`
- **PROHIBIDO** llamar desde otros módulos a funciones internas de estadísticas (por ejemplo: `estadisticasV2()` o `ejecutarEstadisticasAnaliticas()`).

### Evolución sin duplicidades

- **PROHIBIDO** crear versiones paralelas de estadísticas mediante:
  - archivos o funciones con sufijos/patrones: `V1`, `V2`, `V3`, `V4`, `version`, `legacy`, `old`
- Toda evolución debe hacerse:
  - sobre el motor actual (lógica existente)
  - o mediante feature flags (mismos nombres públicos, comportamiento controlado por flags)

### Regla de revisión (obligatoria)

- Si en un cambio aparecen nuevos símbolos/archivos con los patrones anteriores, el cambio debe rechazarse salvo justificación excepcional documentada.

