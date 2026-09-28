// Arma dist/ para instalar copiando y pegando en el editor de Apps Script (sin clasp):
//   dist/Finanzas.gs  → todo el código del servidor en un solo archivo
//   dist/Panel.html, dist/Dashboard.html, dist/appsscript.json
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const src = path.join(raiz, 'apps-script');
const dist = path.join(raiz, 'dist');

function construir() {
  const orden = ['Config.js'];
  const js = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();
  js.forEach((f) => { if (!orden.includes(f)) orden.push(f); });
  const cabecera = '/**\n * FINANZAS · sistema de administración de finanzas personales para Google Sheets.\n' +
    ' * Archivo generado con `npm run bundle` a partir de apps-script/*.js — no editar a mano.\n */\n';
  const gs = cabecera + orden.map((f) => `\n/* ===== ${f} ===== */\n\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('');
  const archivos = { 'Finanzas.gs': gs };
  for (const f of ['Panel.html', 'Dashboard.html', 'appsscript.json']) archivos[f] = fs.readFileSync(path.join(src, f), 'utf8');
  return archivos;
}

if (require.main === module) {
  fs.mkdirSync(dist, { recursive: true });
  const archivos = construir();
  for (const [f, contenido] of Object.entries(archivos)) {
    fs.writeFileSync(path.join(dist, f), contenido);
    console.log('dist/' + f);
  }
}

module.exports = { construir };
