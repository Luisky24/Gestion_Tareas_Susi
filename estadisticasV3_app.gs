/**
 * Estadísticas V3 - App (Orquestación)
 * Archivo dedicado exclusivamente a la función orquestadora.
 *
 * Restricciones:
 * - No contiene IO directo fuera de llamadas io_*.
 * - No contiene lógica de negocio fuera de llamadas dom_* / tec_*.
 */

/**
 * Ejecuta el pipeline completo de estadísticas V3.
 *
 * Salidas:
 * - "Resumen Semanal V3"
 * - "Estadisticas V3"
 */
function app_ejecutarEstadisticasV3() {
  const t0 = Date.now();

  let totalLeidas = 0;
  let validas = 0;
  let numErrores = 0;
  let errores = [];

  try {
    // 1) Cargar datos (IO)
    const carga = io_cargarTareasDesdeHojas();
    const crudo = carga && carga.datosCrudos ? carga.datosCrudos : [];
    const erroresCarga = carga && carga.errores ? carga.errores : [];
    totalLeidas = crudo.length;

    // 2) Normalizar (puro)
    const tareas = tec_normalizarTareas(crudo);

    // 3) Validar (puro) y trabajar solo con tareas válidas
    const validacion = tec_validarTareas(tareas);
    const tareasValidas = validacion.tareasValidas;
    errores = erroresCarga.concat(validacion.errores);

    // 4) Generar resumen (puro)
    const resumen = dom_generarResumenSemanal(tareasValidas);

    // 5) Generar evolución (puro)
    const evolucion = dom_generarEvolucionSemanal(tareasValidas);

    // 6) Escribir resultados (IO)
    io_escribirDatosEnHoja(CONFIG_ESTADISTICAS.HOJAS.RESUMEN, resumen);
    io_escribirDatosEnHoja(CONFIG_ESTADISTICAS.HOJAS.EVOLUCION, evolucion);

    validas = tareasValidas.length;
  } catch (e) {
    // Modo seguro: registrar el fallo como error estructurado y continuar.
    errores = errores.concat([{
      fuente: "V3",
      fila: 0,
      mensaje: `Error en app_ejecutarEstadisticasV3: ${(e && e.message) ? e.message : String(e)}`
    }]);
  } finally {
    numErrores = Array.isArray(errores) ? errores.length : 0;

    // 7) Escribir errores de validación/carga/ejecución (IO)
    try {
      io_escribirErrores(CONFIG_ESTADISTICAS.HOJAS.ERRORES, errores);
    } catch (e) {
      // No romper por errores de escritura
    }

    // 8) Logging de ejecución (IO)
    try {
      const t1 = Date.now();
      io_registrarLogEjecucion({
        fechaEjecucion: new Date(),
        totalLeidas,
        validas,
        errores: numErrores,
        duracionMs: t1 - t0
      });
    } catch (e) {
      // No romper por errores de logging
    }
  }
}

