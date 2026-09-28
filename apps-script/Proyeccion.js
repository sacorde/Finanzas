/**
 * Finanzas · Proyección automática ("arrastre" de precios)
 *
 * Idea: lo que escribís vos es CONFIRMADO (texto normal). Lo que completa el
 * sistema es ESTIMADO (gris itálica). Cuando confirmás un valor nuevo —por
 * ejemplo, la luz aumentó en septiembre— todos los meses siguientes que estaban
 * estimados pasan a ese precio, hasta el próximo valor que hayas cargado vos.
 *
 * Reglas:
 *  - Solo se proyecta desde el mes actual en adelante (nunca se inventa el pasado).
 *  - Si el mes anterior quedó vacío, el concepto se considera dado de baja y no se proyecta.
 *    Para dar de baja algo, poné 0 en el mes que deja de existir.
 *  - Nunca se pisa un valor que cargaste vos.
 */

function celdaVacia_(c) {
  return !c.f && (c.v === '' || c.v === null || c.v === undefined);
}

function numero_(v) {
  var n = typeof v === 'number' ? v : Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Cálculo puro de la proyección de una fila.
 * @param {Array<{v:*, f:string, proy:boolean}>} celdas  una por mes (f en R1C1)
 * @param {number} idxInicio  índice del mes actual
 * @param {number} idxFin     último índice a proyectar (inclusive)
 * @param {string} modo       uno de FZ.PROY
 * @param {number} infl       inflación mensual esperada (0.03 = 3%)
 * @return {Array<{i:number, v:*, f:string, borrar:boolean}>} cambios (celdas que quedan estimadas o se limpian)
 */
function calcularProyeccion(celdas, idxInicio, idxFin, modo, infl) {
  var cambios = [];
  var ultimo = -1, historia = [];
  var noProyectar = modo === 'No proyectar';
  for (var i = 0; i < celdas.length; i++) {
    var c = celdas[i];
    var vacia = celdaVacia_(c);
    if (i < idxInicio) {
      if (vacia) { ultimo = -1; historia = []; }
      else { ultimo = i; historia.push(numero_(c.v)); }
      continue;
    }
    if (!vacia && !c.proy) { ultimo = i; historia.push(numero_(c.v)); continue; }
    // Celda vacía o estimada dentro de la zona de proyección
    if (noProyectar || ultimo < 0 || i > idxFin) {
      if (c.proy && !vacia && (noProyectar || ultimo < 0)) cambios.push({ i: i, borrar: true });
      continue;
    }
    var fuente = celdas[ultimo], nuevo;
    if (modo === 'Promedio 3 meses') {
      var ult3 = historia.slice(-3);
      nuevo = { v: Math.round(ult3.reduce(function (a, b) { return a + b; }, 0) / ult3.length), f: '' };
    } else if (modo === 'Ajustar por inflación') {
      nuevo = { v: Math.round(numero_(fuente.v) * Math.pow(1 + (infl || 0), i - ultimo)), f: '' };
    } else if (fuente.f) {
      nuevo = { v: null, f: fuente.f }; // copia la fórmula (las referencias relativas se desplazan)
    } else {
      nuevo = { v: fuente.v, f: '' };
    }
    var igual = nuevo.f ? c.f === nuevo.f : (!c.f && numero_(c.v) === numero_(nuevo.v) && !vacia);
    if (!igual || !c.proy) cambios.push({ i: i, v: nuevo.v, f: nuevo.f, borrar: false });
  }
  return cambios;
}

/* ------------------------------------------------------------------ */
/* Aplicación sobre la hoja                                           */
/* ------------------------------------------------------------------ */

/** Inflación mensual esperada (0.035 = 3,5%). */
function inflacionEsperada_() {
  var cfg = leerConfig();
  if (cfg.inflacion !== '' && !isNaN(Number(cfg.inflacion))) return Number(cfg.inflacion) / 100;
  var ind = leerIndices_();
  var meses = Object.keys(ind.inflacion).sort();
  if (meses.length) return ind.inflacion[meses[meses.length - 1]] / 100;
  return 0.03;
}

/**
 * Reproyecta filas de la hoja Finanzas.
 * @param {Array<number>=} filas  filas a procesar (por defecto, todos los ítems proyectables)
 * @param {Object=} opts  { confirmarAntesDe: índice de mes; confirmar: [{fila, idx}] }
 * @return {number} celdas modificadas
 */
function reproyectar(sh, est, filas, opts) {
  opts = opts || {};
  var hoy = new Date();
  var idxInicio = indiceMes_(est, hoy);
  if (idxInicio < 0) return 0;
  var cfg = leerConfig();
  var idxFin = Math.min(est.meses.length - 1, idxInicio + cfg.horizonte);
  var infl = null;
  var items = est.items.filter(function (it) { return !it.mov && (!filas || filas.indexOf(it.fila) >= 0); });
  if (!items.length) return 0;

  var f0 = items[0].fila, f1 = items[items.length - 1].fila;
  var nFil = f1 - f0 + 1, c0 = FZ.COL_MES0, nCol = est.ultimaCol - c0 + 1;
  var rng = sh.getRange(f0, c0, nFil, nCol);
  var valores = rng.getValues(), formulas = rng.getFormulas(), r1c1 = rng.getFormulasR1C1();
  var estilos = rng.getFontStyles(), colores = rng.getFontColors();
  var confirmar = {};
  (opts.confirmar || []).forEach(function (x) { confirmar[x.fila + ':' + x.idx] = true; });
  var total = 0;

  items.forEach(function (it) {
    var r = it.fila - f0, tocada = false;
    var celdas = est.meses.map(function (m, k) {
      var j = m.col - c0;
      var proy = estilos[r][j] === 'italic';
      if (proy && ((opts.confirmarAntesDe !== undefined && k < opts.confirmarAntesDe) || confirmar[it.fila + ':' + k])) {
        proy = false; estilos[r][j] = 'normal'; colores[r][j] = FZ.C.tinta; tocada = true; total++;
      }
      return { v: valores[r][j], f: r1c1[r][j], proy: proy };
    });
    if (it.proy === 'Ajustar por inflación' && infl === null) infl = inflacionEsperada_();
    var cambios = calcularProyeccion(celdas, idxInicio, idxFin, it.proy || 'Repetir', infl || 0);
    cambios.forEach(function (ch) {
      var j = est.meses[ch.i].col - c0;
      if (ch.borrar) {
        valores[r][j] = ''; formulas[r][j] = '';
        estilos[r][j] = 'normal'; colores[r][j] = FZ.C.tinta;
      } else {
        formulas[r][j] = ch.f ? r1c1aA1(ch.f, it.fila, est.meses[ch.i].col) : '';
        valores[r][j] = ch.f ? '' : ch.v;
        estilos[r][j] = 'italic'; colores[r][j] = FZ.C.estimado;
      }
      tocada = true; total++;
    });
    if (tocada) {
      var fila = valores[r].map(function (v, j) { return formulas[r][j] || v; });
      var rf = sh.getRange(it.fila, c0, 1, nCol);
      rf.setValues([fila]);
      rf.setFontStyles([estilos[r]]);
      rf.setFontColors([colores[r]]);
    }
  });
  return total;
}

/** Marca celdas como confirmadas (texto normal) sin tocar su valor. */
function marcarConfirmado_(rango) {
  rango.setFontStyle('normal').setFontColor(FZ.C.tinta);
}
