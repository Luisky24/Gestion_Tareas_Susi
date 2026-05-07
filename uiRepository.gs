/**
 * uiRepository.gs
 * Capa UI: encapsula HtmlService y SpreadsheetApp.getUi().
 * Objetivo: evitar uso directo de UI APIs desde Código.gs.
 */

function ui_crearMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Lista Tareas')
    .addItem('Mostrar Barar Lateral', 'mostrarBarraLateral')
    .addItem('Configuración notificaciones', 'mostrarConfiguracionNotificacionesModal')
    .addSeparator()
    .addItem('Estadísticas: alternar orden ASC/DESC', 'toggleOrdenEstadisticas')
    .addItem('Estadísticas: gráfica (ventana)', 'mostrarGraficaEstadisticas')
    .addItem('Ver dashboard de estadísticas', 'mostrarDashboardEstadisticas')
    .addToUi();
}

/**
 * Resuelve HTML por nombre de forma robusta en despliegues parciales:
 * - Si existe `gasHtmlRawByName_` (modo BUNDLE), usa HTML embebido.
 * - Si NO existe (DES con fuentes sueltas / módulos parciales), lee el archivo HTML físico.
 */
function ui_htmlRawByName_(nombreArchivo) {
  const n = String(nombreArchivo || '').trim();
  if (!n) throw new Error('ui_htmlRawByName_(nombreArchivo): nombreArchivo es obligatorio.');

  if (typeof gasHtmlRawByName_ === 'function') {
    return gasHtmlRawByName_(n);
  }

  return HtmlService.createHtmlOutputFromFile(n).getContent();
}

function ui_renderHtml(nombreArchivo) {
  // Necesario para que se procese <?!= ... ?> en los HTML (templating de GAS).
  const n = String(nombreArchivo || '').trim();
  if (!n) throw new Error('ui_renderHtml(nombreArchivo): nombreArchivo es obligatorio.');

  // Importante:
  // - En BUNDLE, el HTML se resuelve desde `gasHtmlRawByName_` (string embebido) → createTemplate(string).
  // - En DES (fuentes sueltas / despliegue parcial), se debe usar createTemplateFromFile para que GAS procese
  //   los tags `<?= ?>` / `<?!= ?>` (includes). Si se usa createHtmlOutputFromFile, esos tags se imprimen literal.
  if (typeof gasHtmlRawByName_ === 'function') {
    const html = gasHtmlRawByName_(n);
    return HtmlService.createTemplate(html).evaluate();
  }

  return HtmlService.createTemplateFromFile(n).evaluate();
}

function ui_renderHtmlContent(nombreArchivo) {
  return ui_renderHtml(nombreArchivo).getContent();
}

function ui_mostrarSidebar(htmlOutput) {
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

