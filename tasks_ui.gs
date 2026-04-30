/**
 * FASE MIGRACIÓN 1
 *
 * Módulo UI (presentación): formato y colores.
 * En esta fase sólo se crea el punto de entrada canónico para aplicar color a un rango.
 * Las funciones existentes siguen disponibles por compatibilidad.
 */

/**
 * Implementación canónica (nueva) para aplicar color a un rango.
 * Se mantiene separada para permitir migrar progresivamente desde `tareasUI.gs`.
 */
function ui_aplicarColorRango(rango, colorHex) {
  rango.setBackground(colorHex);
}

