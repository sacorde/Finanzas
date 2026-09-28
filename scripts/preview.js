// Genera preview/panel.html y preview/dashboard.html con datos ficticios para ver la interfaz
// en un navegador común, sin Apps Script:  node scripts/preview.js [datos.json]
const fs = require('fs');
const path = require('path');
const { generar } = require('./demo-data');

const raiz = path.join(__dirname, '..');
const datos = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : generar();
fs.mkdirSync(path.join(raiz, 'preview'), { recursive: true });

const mock = {
  Panel: `window.MOCK = { panelDatos: () => (${JSON.stringify(datos.panel)}), panelGuardar: (p) => ({ ok: true, mensaje: 'Guardado (preview): ' + JSON.stringify(p) }), panelDeshacer: () => ({ ok: true, mensaje: 'Deshecho' }), panelConfirmar: () => ({ ok: true }) };`,
  Dashboard: `window.MOCK = { dashboardDatos: () => (${JSON.stringify(datos.dashboard)}) };`,
};
for (const nombre of ['Panel', 'Dashboard']) {
  let html = fs.readFileSync(path.join(raiz, 'apps-script', nombre + '.html'), 'utf8');
  html = html.replace(/<\?= modo \?>/g, 'preview').replace(/<\?= urlWeb \?>/g, '#');
  html = html.replace('<script>\n// <', `<script>${mock[nombre]}</script>\n<script>\n// <`);
  fs.writeFileSync(path.join(raiz, 'preview', nombre.toLowerCase() + '.html'), html);
  console.log('preview/' + nombre.toLowerCase() + '.html');
}
