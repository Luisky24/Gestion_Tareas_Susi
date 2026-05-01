/**
 * app_globals.gs
 * Namespace global único para evitar colisiones al hacer bundling.
 */

// Nota: no se usa `const APP = ...` porque en JS (V8) puede caer en TDZ al evaluarse `typeof APP`
// en el mismo scope. Con `var` es seguro y mantiene el objetivo: un único namespace global.
var APP = typeof APP !== "undefined" ? APP : {};

APP.LOG =
  APP.LOG ||
  {
    log: function (msg) {
      Logger.log(msg);
    },
    error: function (msg) {
      Logger.log("[ERROR] " + msg);
    },
  };

