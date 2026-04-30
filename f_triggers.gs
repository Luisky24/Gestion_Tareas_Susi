/**
 * f_triggers.gs
 * Módulo de triggers del proyecto.
 * Aquí se agruparán funciones de creación/borrado/listado de triggers y puntos de entrada asociados.
 */

const TRIGGERS_CONFIG = [
  {
    nombre: 'triggerCalculoEstadisticas',
    tipo: 'time',
    diaSemana: 'FRIDAY',
    hora: 13,
    minuto: 10,
    activo: true,
  },
];

const TRIGGERS_CONFIG_PROPERTY_KEY = 'TRIGGERS_CONFIG';

/**
 * Días de la semana soportados por triggers time-based.
 * Se usa para validar `diaSemana` en la configuración.
 */
const DIAS_SEMANA_VALIDOS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/**
 * Valida una configuración completa de triggers.
 * Lanza errores con mensajes claros para facilitar el diagnóstico desde el frontend.
 *
 * @param {Array} configArray Array de objetos trigger.
 * @returns {Array} Devuelve el mismo array si es válido (sin mutarlo).
 */
function validarConfigTriggers(configArray) {
  if (!Array.isArray(configArray)) {
    throw new Error(
      `La configuración de triggers debe ser un array. Recibido: ${Object.prototype.toString.call(configArray)}`
    );
  }

  const nombres = new Set();
  configArray.forEach((config, index) => {
    validarTriggerConfig_(config, index);

    const nombre = String(config.nombre).trim();
    if (nombres.has(nombre)) {
      throw new Error(`Error en trigger '${nombre}': nombre duplicado`);
    }
    nombres.add(nombre);
  });

  return configArray;
}

/**
 * Valida un objeto trigger individual.
 * Esta validación es estricta y se usa tanto al guardar como antes de crear triggers.
 *
 * @param {Object} config Objeto trigger.
 * @param {number} [index] Índice dentro del array (solo para mejorar mensajes).
 */
function validarTriggerConfig_(config, index) {
  const nombreForMsg =
    config && typeof config === 'object' && 'nombre' in config ? String(config.nombre || '').trim() : '';
  const ref = nombreForMsg ? `'${nombreForMsg}'` : `(índice ${typeof index === 'number' ? index : '?'})`;

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Error en trigger ${ref}: el trigger debe ser un objeto`);
  }

  // nombre: string no vacío
  if (typeof config.nombre !== 'string' || config.nombre.trim() === '') {
    throw new Error(`Error en trigger ${ref}: nombre inválido`);
  }

  // tipo: 'time'
  if (config.tipo !== 'time') {
    throw new Error(`Error en trigger '${config.nombre}': tipo inválido (solo se soporta 'time')`);
  }

  // diaSemana: incluido en DIAS_SEMANA_VALIDOS
  if (typeof config.diaSemana !== 'string' || !DIAS_SEMANA_VALIDOS.includes(config.diaSemana)) {
    throw new Error(`Error en trigger '${config.nombre}': diaSemana inválido`);
  }

  // hora: entero 0–23
  if (!Number.isInteger(config.hora) || config.hora < 0 || config.hora > 23) {
    throw new Error(`Error en trigger '${config.nombre}': hora inválida`);
  }

  // minuto: entero 0–59
  if (!Number.isInteger(config.minuto) || config.minuto < 0 || config.minuto > 59) {
    throw new Error(`Error en trigger '${config.nombre}': minuto inválido`);
  }

  // activo: boolean
  if (typeof config.activo !== 'boolean') {
    throw new Error(`Error en trigger '${config.nombre}': activo inválido`);
  }
}

function guardarConfigTriggers(configArray) {
  validarConfigTriggers(configArray);

  const raw = JSON.stringify(configArray);
  PropertiesService.getScriptProperties().setProperty(TRIGGERS_CONFIG_PROPERTY_KEY, raw);
}

function obtenerConfigTriggers() {
  const raw = PropertiesService.getScriptProperties().getProperty(TRIGGERS_CONFIG_PROPERTY_KEY);
  if (!raw) {
    // Primer uso: si no existe la property, no es un error. No se crean triggers hasta que haya configuración.
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `El JSON de configuración de triggers en ScriptProperties es inválido (clave: ${TRIGGERS_CONFIG_PROPERTY_KEY}). ` +
        `Error original: ${e && e.message ? e.message : String(e)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `El JSON de configuración de triggers debe ser un array. Recibido: ${Object.prototype.toString.call(parsed)}`
    );
  }

  return parsed;
}

function inicializarConfigTriggers() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(TRIGGERS_CONFIG_PROPERTY_KEY);
  if (existing) {
    Logger.log(
      `La propiedad '${TRIGGERS_CONFIG_PROPERTY_KEY}' ya existe. No se sobrescribe. ` +
        `Si quieres reinicializar, elimina la propiedad manualmente en ScriptProperties.`
    );
    return;
  }

  const configPorDefecto = [
    {
      nombre: 'triggerCalculoEstadisticas',
      tipo: 'time',
      diaSemana: 'FRIDAY',
      hora: 13,
      minuto: 10,
      activo: true,
    },
  ];

  guardarConfigTriggers(configPorDefecto);
  Logger.log(`Configuración de triggers inicializada en ScriptProperties ('${TRIGGERS_CONFIG_PROPERTY_KEY}').`);
}

function eliminarTriggers(nombreFuncion) {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === nombreFuncion) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function crearTriggerDesdeConfig(config) {
  // Validación defensiva para evitar crear triggers corruptos desde datos inválidos.
  validarTriggerConfig_(config);

  const weekDay = ScriptApp.WeekDay[config.diaSemana];
  if (!weekDay) {
    // Esto no debería ocurrir si `DIAS_SEMANA_VALIDOS` y `ScriptApp.WeekDay` están alineados.
    throw new Error(`Error en trigger '${config.nombre}': diaSemana inválido`);
  }

  return ScriptApp.newTrigger(config.nombre)
    .timeBased()
    .onWeekDay(weekDay)
    .atHour(config.hora)
    .nearMinute(config.minuto)
    .create();
}

function crearTodosLosTriggers() {
  const configTriggers = obtenerConfigTriggers();
  configTriggers.forEach((config) => {
    if (!config || config.activo !== true) {
      return;
    }
    eliminarTriggers(config.nombre);
    crearTriggerDesdeConfig(config);
  });
}

function crearTriggerCalculoEstadisticas() {
  const config = TRIGGERS_CONFIG.find((c) => c.nombre === 'triggerCalculoEstadisticas');
  if (!config) {
    throw new Error("No existe configuración para 'triggerCalculoEstadisticas'");
  }

  eliminarTriggers(config.nombre);
  crearTriggerDesdeConfig(config);
}

