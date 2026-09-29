// Genera preview/app.html: la app web completa corriendo en el navegador, con el código real del
// servidor (apps-script/*.js) sobre el simulador de Google Sheets de los tests. Sin Apps Script.
//   node scripts/preview.js                 → planilla de ejemplo (sin instalar: muestra la bienvenida)
//   node scripts/preview.js --instalada     → ya instalada
//   node scripts/preview.js --excel x.json  → usa un Excel exportado ({vals, forms}) como planilla original
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const src = path.join(raiz, 'apps-script');
const args = process.argv.slice(2);
const instalada = args.includes('--instalada');
const excel = args.includes('--excel') ? JSON.parse(fs.readFileSync(args[args.indexOf('--excel') + 1], 'utf8')) : null;

function resolver(nombre) {
  let html = fs.readFileSync(path.join(src, nombre + '.html'), 'utf8');
  return html.replace(/<\?!= include\('(\w+)'\) \?>/g, (_, n) => resolver(n));
}

const servidor = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const mock = fs.readFileSync(path.join(raiz, 'tests', 'mock-sheets.js'), 'utf8');

const semilla = `
(function () {
  var module = { exports: {} };
  ${mock}
  var env = module.exports.crearEntorno(window);
  window.__env = env;
  // Red simulada: inflación, dólar y feriados de ejemplo
  var infl = [20.6,13.2,11,8.8,4.2,4.6,4,4.2,3.5,2.7,2.4,2.7,2.2,2.4,3.7,2.8,1.5,1.6,1.9,1.9,2.1,2.3,2.5,2.8,2.6,2.4,2.9,2.7,2.3,2.1,2.0,1.9];
  var serie = function (base, tasa) { var out = [], v = base; for (var y = 2023; y <= 2026; y++) for (var m = 1; m <= 12; m++) { v *= 1 + tasa; out.push({ fecha: y + '-' + String(m).padStart(2, '0') + '-15', venta: Math.round(v), compra: Math.round(v * .97) }); } return out; };
  UrlFetchApp.fetch = function (url) {
    var body;
    if (/inflacion/.test(url)) body = infl.map(function (v, i) { var y = 2024 + Math.floor(i / 12), m = i % 12 + 1; return { fecha: y + '-' + String(m).padStart(2, '0') + '-28', valor: v }; });
    else if (/blue/.test(url)) body = serie(380, 0.035);
    else if (/oficial/.test(url)) body = serie(180, 0.04);
    else if (/feriados\\/(\\d+)/.test(url)) { var a = url.match(/(\\d{4})$/)[1]; body = [{ fecha: a + '-01-01', nombre: 'Año nuevo' }, { fecha: a + '-05-01', nombre: 'Día del trabajador' }, { fecha: a + '-10-12', nombre: 'Diversidad cultural' }, { fecha: a + '-12-25', nombre: 'Navidad' }]; }
    else throw new Error('sin red');
    return { getResponseCode: function () { return 200; }, getContentText: function () { return JSON.stringify(body); } };
  };
  window.__servidor = function () {
${servidor}
    return { ${[...new Set(servidor.match(/function (api_\w+)/g).map((x) => x.slice(9)))].map((n) => n + ': ' + n).join(', ')}, tareaDiaria: tareaDiaria };
  };
})();
`;

const planilla = excel ? `
(function () {
  var j = ${JSON.stringify(excel)};
  var sh = __env.ss.insertSheet('Finanzas'); sh.insertColumnsAfter(26, 40);
  var vals = j.vals.map(function (r, i) { return r.map(function (v, c) { return j.forms[i][c] ? j.forms[i][c] : v && v.__d ? new Date(v.__d) : v; }); });
  sh.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  j.forms.forEach(function (r, i) { r.forEach(function (f, c) { if (f) sh._celda(i + 1, c + 1, true).v = j.vals[i][c]; }); });
  ['Finanzas 2022', 'Finanzas 2023', 'Reservas', 'Pagos'].forEach(function (n) { __env.ss.insertSheet(n).getRange(1, 1).setValue('x'); });
})();` : `
(function () {
  var MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  var sh = __env.ss.insertSheet('Finanzas'); sh.insertColumnsAfter(26, 20);
  var y0 = new Date().getFullYear() - 1, n = 2 + 13 * 3, hoyI = 12 + new Date().getMonth();
  var fila = function (a, b, fn) { var r = Array(n).fill(''); r[0] = a; r[1] = b; if (fn) for (var i = 0; i < 36; i++) { var v = i <= hoyI + 3 ? fn(i) : ''; r[2 + i + Math.floor(i / 12)] = v === null ? '' : v; } return r; };
  var f1 = Array(n).fill(''); for (var a = 0; a < 3; a++) { MESES.forEach(function (m, i) { f1[2 + a * 13 + i] = m; }); f1[2 + a * 13 + 12] = y0 + a; }
  var sube = function (base, cada, pct) { return function (i) { return Math.round(base * Math.pow(1 + pct, Math.floor(i / cada))); }; };
  var filas = [f1, Array(n).fill(''), fila('INGRESOS', ''),
    fila('=WORKDAY(EOMONTH(TODAY(),0)+1,-2)', 'Salario', sube(1500000, 2, 0.07)), fila('Otros Ingresos', '', function (i) { return i % 6 === 5 ? 900000 : null; }),
    fila('GASTOS FIJOS', ''), fila('Vivienda', ''), fila('=IF(DAY(TODAY())>10, 1, 1)', 'Alquiler', sube(450000, 4, 0.18)), fila('', 'Expensas', sube(120000, 1, 0.03)),
    fila('Servicios', ''), fila('=WORKDAY(IF(1,1,1)-1, 1)', 'Luz', function (i) { return Math.round(40000 * (1 + i * 0.05) * (i % 2 ? 1.2 : 0.9)); }),
    fila('DA', 'Internet', sube(22000, 2, 0.08)), fila('DA', 'Celular', sube(15000, 3, 0.1)),
    fila('Suscripciones', ''), fila('DA', 'Netflix', sube(6000, 4, 0.2)), fila('DA', 'Spotify', sube(3000, 6, 0.25)),
    fila('Super', ''), fila('', 'Super Mes', sube(300000, 1, 0.025)),
    fila('PRESTAMOS/INVERSIONES', ''), fila('', 'Ahorro del Mes', sube(250000, 1, 0.03)), fila('', 'Préstamo', function (i) { return i < 20 ? 95000 : null; }),
    fila('EVENTUALES', ''), fila('', 'Cena cumple', function (i) { return i % 3 === 0 ? 45000 + i * 1500 : null; }), fila('', 'Vuelo Bariloche', function (i) { return i === 18 ? 520000 : null; }),
    fila('', 'Zapatillas', function (i) { return i % 7 === 2 ? 140000 : null; }), fila('', 'Heladera', function (i) { return i === 25 ? 980000 : null; }),
    fila('Total Eventuales', '')];
  sh.getRange(1, 1, filas.length, n).setValues(filas);
  ['Reservas', 'Pagos', 'Hoja 7'].forEach(function (x) { __env.ss.insertSheet(x).getRange(1, 1).setValue('x'); });
})();`;

const arranque = `
<script>
${semilla}
${planilla}
window.MOCK = (function () {
  var api = window.__servidor();
  var out = {};
  Object.keys(api).forEach(function (k) { out[k] = function () { return JSON.parse(JSON.stringify(api[k].apply(null, arguments))); }; });
  ${instalada ? "['respaldo','migrar','indices','automatizaciones','calendario'].forEach(function (p) { api.api_instalar(p); });" : ''}
  return out;
})();
</script>`;

let html = resolver('App');
html = html.replace("<?!= include('Nucleo') ?>", '').replace('<script>\n// <nucleo>', arranque + '\n<script>\n// <nucleo>');
fs.mkdirSync(path.join(raiz, 'preview'), { recursive: true });
const salida = path.join(raiz, 'preview', 'app.html');
fs.writeFileSync(salida, html);
console.log(path.relative(process.cwd(), salida));
