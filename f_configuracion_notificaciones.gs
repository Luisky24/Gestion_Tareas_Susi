/**
 * f_configuracion_notificaciones.gs
 * Configuración persistente de notificaciones (ScriptProperties).
 *
 * Objetivo:
 * - Exponer una API simple para UI administrativa.
 * - Evitar hardcodes de emails en el sistema.
 */

const _CFG_NOTIF_PROP_EMAIL = 'EMAIL_NOTIFICACION';

/**
 * Lee la configuración actual de notificaciones.
 * @returns {{ emailNotificaciones: string|null }}
 */
function obtenerConfiguracionNotificaciones() {
  const raw = PropertiesService.getScriptProperties().getProperty(_CFG_NOTIF_PROP_EMAIL);
  const email = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
  return { emailNotificaciones: email };
}

/**
 * Guarda la configuración de notificaciones.
 * @param {string} email
 * @returns {{ ok: boolean, mensaje: string }}
 */
function guardarConfiguracionNotificaciones(email) {
  const e = email != null ? String(email).trim() : '';
  if (!e) {
    return { ok: false, mensaje: 'El email es obligatorio.' };
  }
  if (!validarEmail_(e)) {
    return { ok: false, mensaje: 'Formato de email inválido.' };
  }

  PropertiesService.getScriptProperties().setProperty(_CFG_NOTIF_PROP_EMAIL, e);
  return { ok: true, mensaje: 'Configuración guardada correctamente.' };
}

/**
 * Valida email con regla pragmática (no RFC completa).
 * @param {string} email
 * @returns {boolean}
 */
function validarEmail_(email) {
  const s = String(email || '').trim();
  if (!s) return false;
  // Reglas mínimas: sin espacios, un @, dominio con punto, no empieza/termina en punto.
  // Suficiente para configuración operativa (evitar errores obvios).
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(s);
}

