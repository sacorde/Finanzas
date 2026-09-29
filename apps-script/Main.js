/**
 * Finanzas · Punto de entrada
 *  doGet   → la app web (toda la interfaz)
 *  onOpen  → en la planilla, un menú para abrir la app
 */

function doGet() {
  var t = HtmlService.createTemplateFromFile('App');
  return t.evaluate()
    .setTitle('Finanzas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b0/512.png');
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** URL de la app: la publica el deploy automático (UrlWeb.js); si no, la de la implementación. */
function urlApp_() {
  if (typeof FZ_URL_WEB !== 'undefined' && FZ_URL_WEB) return FZ_URL_WEB;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function onOpen() {
  try { PropertiesService.getScriptProperties().setProperty('SS_ID', SpreadsheetApp.getActiveSpreadsheet().getId()); } catch (e) { /* sin permisos todavía */ }
  SpreadsheetApp.getUi().createMenu('💰 Finanzas')
    .addItem('Abrir la app', 'abrirApp')
    .addToUi();
}

function abrirApp() {
  var url = urlApp_();
  var html = url
    ? '<div style="font:14px system-ui;padding:8px"><p>La app de Finanzas se abre en una pestaña nueva.</p>' +
      '<p><a href="' + url + '" target="_blank" onclick="setTimeout(function(){google.script.host.close()},300)" ' +
      'style="display:inline-block;background:#4F46E5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir Finanzas</a></p>' +
      '<p style="color:#64748B;font-size:12px">Guardá el link en favoritos: ' + url + '</p></div>'
    : '<div style="font:14px system-ui;padding:8px">Todavía no hay una URL publicada. Corré el deploy automático desde GitHub (Actions → Deploy a Apps Script).</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(200), 'Finanzas');
}
