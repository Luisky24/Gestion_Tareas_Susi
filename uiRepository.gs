/**
 * uiRepository.gs
 * Capa UI: encapsula HtmlService y SpreadsheetApp.getUi().
 * Objetivo: evitar uso directo de UI APIs desde Código.gs.
 */

function ui_crearMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Lista Tareas')
    .addItem('Mostrar Barar Lateral', 'mostrarBarraLateral')
    .addSeparator()
    .addItem('Estadísticas: alternar orden ASC/DESC', 'toggleOrdenEstadisticas')
    .addItem('Estadísticas: gráfica (ventana)', 'mostrarGraficaEstadisticas')
    .addItem('Ver dashboard de estadísticas', 'mostrarDashboardEstadisticas')
    .addToUi();
}

function ui_renderHtml(nombreArchivo) {
  // Necesario para que se procese <?!= ... ?> en los HTML (templating de GAS).
  // Se evita el encadenado y se añade fallback seguro.
  const template = HtmlService.createTemplateFromFile(nombreArchivo);
  if (template && typeof template.evaluate === 'function') {
    return template.evaluate();
  }
  // Fallback: evita romper el flujo si algo raro pasa en runtime.
  // (OJO: con este fallback no se procesan <?!= ... ?>)
  return HtmlService.createHtmlOutputFromFile(nombreArchivo);
}

function ui_renderHtmlContent(nombreArchivo) {
  return ui_renderHtml(nombreArchivo).getContent();
}

function ui_mostrarSidebar(htmlOutput) {
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

