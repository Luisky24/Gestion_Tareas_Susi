/**
 * uiRepository.gs
 * Capa UI: encapsula HtmlService y SpreadsheetApp.getUi().
 * Objetivo: evitar uso directo de UI APIs desde Código.gs.
 */

function ui_crearMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Lista Tareas')
    .addItem('Mostrar Barar Lateral', 'mostrarBarraLateral')
    .addItem('Configuración notificaciones', 'mostrarConfiguracionNotificaciones')
    .addSeparator()
    .addItem('Estadísticas: alternar orden ASC/DESC', 'toggleOrdenEstadisticas')
    .addItem('Estadísticas: gráfica (ventana)', 'mostrarGraficaEstadisticas')
    .addItem('Ver dashboard de estadísticas', 'mostrarDashboardEstadisticas')
    .addToUi();
}

function ui_renderHtml(nombreArchivo) {
  // Necesario para que se procese <?!= ... ?> en los HTML (templating de GAS).
  // Preferimos HTML embebido vía gasHtmlRawByName_ cuando existe (bundle),
  // pero soportamos también HTML "real" en el proyecto para vistas nuevas.
  try {
    const html = gasHtmlRawByName_(nombreArchivo);
    const template = HtmlService.createTemplate(html);
    if (template && typeof template.evaluate === 'function') {
      return template.evaluate();
    }
    return HtmlService.createHtmlOutput(html);
  } catch (e) {
    // Fallback: archivos HTML del proyecto (HtmlService.createTemplateFromFile).
    // Esto permite añadir nuevas vistas sin tocar el bundle.
    const template = HtmlService.createTemplateFromFile(nombreArchivo);
    if (template && typeof template.evaluate === 'function') {
      return template.evaluate();
    }
    return HtmlService.createHtmlOutputFromFile(nombreArchivo);
  }
}

function ui_renderHtmlContent(nombreArchivo) {
  return ui_renderHtml(nombreArchivo).getContent();
}

function ui_mostrarSidebar(htmlOutput) {
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

