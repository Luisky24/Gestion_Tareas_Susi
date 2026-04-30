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

- **NO** usar comparaciones directas como:
  - `estado === "hecho"`
- **SIEMPRE** usar:
  - `esTareaHecha()`
  - `esTareaAbierta()`

Regla:
- Si `esTareaHecha` → tarea cerrada
- Si `esTareaAbierta` → tarea abierta
- Ignorar ambigüedades

---

## 4. Configuración centralizada

- **NO** usar strings hardcodeados para:
  - nombres de hojas
  - estados
- **SIEMPRE** usar `CONFIG_ESTADISTICAS`

---

## 5. Mapeo de columnas

- **NO** usar índices fijos (`valores[0]`, `valores[2]`, etc.).
- **SIEMPRE** usar el **mapeo dinámico de columnas** (cabecera de hoja → índices por nombre).

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

