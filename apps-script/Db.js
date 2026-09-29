/**
 * Finanzas · Acceso a la base de datos (hojas de cálculo como tablas)
 *
 * Cada hoja es una tabla con encabezados en la fila 1. Las lecturas devuelven
 * objetos planos; las escrituras reescriben la tabla completa (son chicas: unos
 * pocos miles de filas) dentro de un lock, así nunca quedan a medio escribir.
 */

function hojaTabla_(nombre) {
  return ss_().getSheetByName(nombre);
}

/** Encabezados de la hoja (fila 1). */
function cabecera_(sh) {
  if (!sh || sh.getLastColumn() < 1) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/**
 * @return {Array<Object>} filas como objetos (vacío si la tabla no existe).
 * Las columnas se leen por su encabezado: una tabla de una versión anterior
 * (con otras columnas) se lee igual, con todas sus columnas.
 */
function leerTabla(nombre) {
  var sh = hojaTabla_(nombre);
  if (!sh || sh.getLastRow() < 2) return [];
  var cab = cabecera_(sh), cols = ESQUEMA[nombre].cols, texto = ESQUEMA[nombre].texto;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues();
  var out = [];
  vals.forEach(function (r) {
    if (r.every(function (v) { return v === '' || v === null; })) return;
    var o = {};
    cols.forEach(function (c) { o[c] = ''; });
    cab.forEach(function (c, i) {
      if (!c) return;
      var v = r[i];
      if (v instanceof Date) v = texto.indexOf(c) >= 0 && /mes/.test(c) ? isoMes_(v) : isoDia_(v);
      o[c] = v;
    });
    out.push(o);
  });
  return out;
}

/** Reescribe la tabla completa. */
function escribirTabla(nombre, filas) {
  var sh = hojaTabla_(nombre) || crearTabla_(ss_(), nombre);
  var cols = ESQUEMA[nombre].cols;
  var datos = filas.map(function (o) {
    return cols.map(function (c) {
      var v = o[c];
      if (v === undefined || v === null) return '';
      if (typeof v === 'string' && /^[=+\-@]/.test(v) && ESQUEMA[nombre].texto.indexOf(c) >= 0) return "'" + v;
      return v;
    });
  });
  var cab = cabecera_(sh);
  if (cab.join('|') !== cols.join('|')) {
    // Tabla de una versión anterior: se reescribe con las columnas nuevas
    if (sh.getMaxColumns() > cols.length) sh.deleteColumns(cols.length + 1, sh.getMaxColumns() - cols.length);
    else if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  var necesarias = datos.length + 1;
  if (sh.getMaxRows() < necesarias) sh.insertRowsAfter(sh.getMaxRows(), necesarias - sh.getMaxRows() + 50);
  var viejas = sh.getLastRow() - 1;
  if (viejas > 0) sh.getRange(2, 1, viejas, cols.length).clearContent();
  if (datos.length) {
    formatoTexto_(sh, nombre, datos.length);
    sh.getRange(2, 1, datos.length, cols.length).setValues(datos);
  }
}

function formatoTexto_(sh, nombre, n) {
  var cols = ESQUEMA[nombre].cols;
  ESQUEMA[nombre].texto.forEach(function (c) {
    sh.getRange(2, cols.indexOf(c) + 1, Math.max(n, 1), 1).setNumberFormat('@');
  });
}

/** Crea la hoja de una tabla con su encabezado. Si existe una hoja con ese nombre que no es tabla, la renombra. */
function crearTabla_(ss, nombre) {
  var existente = ss.getSheetByName(nombre);
  var cols = ESQUEMA[nombre].cols;
  if (existente) {
    var cab = existente.getRange(1, 1, 1, cols.length).getValues()[0];
    if (cab.join('|') === cols.join('|')) return existente;
    existente.setName(nombre + ' (anterior)');
  }
  var sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0F172A').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  var n = sh.getMaxRows() - 1;
  formatoTexto_(sh, nombre, n);
  if (sh.getMaxColumns() > cols.length) sh.deleteColumns(cols.length + 1, sh.getMaxColumns() - cols.length);
  return sh;
}

function esTabla_(sh) {
  var nombre = sh.getName();
  if (!ESQUEMA[nombre]) return false;
  var cols = ESQUEMA[nombre].cols;
  if (sh.getLastColumn() < cols.length) return sh.getLastRow() === 0;
  return sh.getRange(1, 1, 1, cols.length).getValues()[0].join('|') === cols.join('|');
}

function conLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/** ¿La base de datos está instalada? (en cualquier versión: la app la actualiza sola) */
function dbInstalada_() {
  var sh = hojaTabla_(FZ.T.CONCEPTOS);
  return !!(sh && sh.getLastRow() > 1 && cabecera_(sh)[0] === 'id');
}
