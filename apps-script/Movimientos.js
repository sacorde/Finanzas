/**
 * Finanzas · Movimientos (gastos eventuales) y carga rápida
 *
 * Los gastos sueltos (una cena, un viaje, una heladera en 6 cuotas) van a la
 * hoja Movimientos, una fila por gasto. La sección EVENTUALES de Finanzas los
 * suma solos por categoría y por mes, repartiendo las cuotas.
 */

var PALABRAS_CATEGORIA_ = {
  'Salidas y comida': ['mc', 'mcdonal', 'burger', 'hamburg', 'hambu', 'empanada', 'pizza', 'bar', 'cerveza', 'cena', 'almuerzo', 'comida', 'resto', 'cafe', 'helado', 'pedidos ya', 'rappi', 'pescadorita', 'sushi', 'parrilla', 'escape', 'cine', 'teatro', 'recital', 'river', 'boca', 'entrada'],
  'Viajes': ['viaje', 'vuelo', 'hotel', 'airbnb', 'florianopolis', 'mendoza', 'iguazu', 'chalten', 'bariloche', 'brc', 'trekking', 'pasaporte', 'excursion', 'micro', 'aerolineas', 'flybondi', 'booking'],
  'Ropa y calzado': ['ropa', 'jean', 'remera', 'short', 'zapatilla', 'bikini', 'campera', 'buzo', 'salomon', 'nike', 'adidas', 'anteojo', 'rayban', 'medias', 'zapato'],
  'Tecnología': ['samsung', 's24', 's20', 'celular', 'iphone', 'notebook', 'compaq', 'disco', 'ssd', 'monitor', 'teclado', 'mouse', 'auricular', 'juego', 'alan wake', 'steam', 'playstation', 'ps5', 'xbox', 'tablet', 'cargador'],
  'Hogar': ['mueble', 'heladera', 'lavarropas', 'silla', 'escritorio', 'colchon', 'sillon', 'cortina', 'quinta', 'ferreteria', 'pintura', 'envio mueble', 'bazar', 'sommier', 'microondas'],
  'Salud y cuidado': ['farmacia', 'medico', 'dentista', 'odontolog', 'implante', 'capilar', 'perfume', 'cortadora', 'peluqueria', 'psicolog', 'estudio', 'remedio', 'optica', 'kinesio'],
  'Regalos': ['regalo', 'cumple', 'prote', 'protes'],
  'Educación': ['matricula', 'curso', 'libro', 'utn', 'istea', 'facultad', 'copy', 'fotocopia', 'udemy', 'cuota colegio'],
  'Auto y transporte': ['arreglo auto', 'auto', 'mecanico', 'gomeria', 'service', 'vtv', 'peaje', 'estacionamiento', 'cochera', 'uber', 'cabify', 'taxi', 'multa']
};

/**
 * Adivina la categoría de un gasto.
 * 1) Lo que ya cargaste antes con la misma descripción (aprendizaje).
 * 2) Palabras clave.  3) "Otros".
 */
function adivinarCategoria(desc, aprendidas) {
  var d = norm_(desc);
  if (!d) return 'Otros';
  if (aprendidas) {
    if (aprendidas[d]) return aprendidas[d];
    var primera = d.split(' ')[0];
    if (primera.length > 2 && aprendidas['#' + primera]) return aprendidas['#' + primera];
  }
  var mejor = null, largo = 0;
  Object.keys(PALABRAS_CATEGORIA_).forEach(function (cat) {
    PALABRAS_CATEGORIA_[cat].forEach(function (p) {
      var hay = p.length <= 3 ? new RegExp('(^|[^a-z0-9])' + p + '([^a-z0-9]|$)').test(d) : d.indexOf(p) >= 0;
      if (hay && p.length > largo) { mejor = cat; largo = p.length; }
    });
  });
  return mejor || 'Otros';
}

/** Construye el mapa de aprendizaje a partir de los movimientos existentes. */
function aprenderCategorias_(filas) {
  var mapa = {}, conteo = {};
  filas.forEach(function (r) {
    var d = norm_(r[FZ.MOV.DESC - 1]), c = String(r[FZ.MOV.CAT - 1] || '');
    if (!d || !c) return;
    mapa[d] = c;
    var p = '#' + d.split(' ')[0];
    conteo[p] = conteo[p] || {};
    conteo[p][c] = (conteo[p][c] || 0) + 1;
  });
  Object.keys(conteo).forEach(function (p) {
    var mejor = Object.keys(conteo[p]).sort(function (a, b) { return conteo[p][b] - conteo[p][a]; })[0];
    mapa[p] = mejor;
  });
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Hoja Movimientos                                                    */
/* ------------------------------------------------------------------ */

function formulasMovimientos_(tarjetaMesSig) {
  var desde = tarjetaMesSig
    ? 'IF(G2:G<>"",DATE(YEAR(G2:G),MONTH(G2:G),1),IF(REGEXMATCH(LOWER(F2:F),"tarjeta|visa|amex|master"),DATE(YEAR(A2:A),MONTH(A2:A)+1,1),DATE(YEAR(A2:A),MONTH(A2:A),1)))'
    : 'IF(G2:G<>"",DATE(YEAR(G2:G),MONTH(G2:G),1),DATE(YEAR(A2:A),MONTH(A2:A),1))';
  return [
    '={"Desde (auto)";ARRAYFORMULA(IF((A2:A="")*(G2:G=""),,' + desde + '))}',
    '={"Hasta (auto)";ARRAYFORMULA(IF(H2:H="",,DATE(YEAR(H2:H),MONTH(H2:H)+IF(E2:E="",1,E2:E)-1,1)))}',
    '={"Por mes (auto)";ARRAYFORMULA(IF(H2:H="",,D2:D/IF(E2:E="",1,E2:E)))}'
  ];
}

function crearHojaMovimientos_(ss, movimientos) {
  var existente = ss.getSheetByName(FZ.HOJA_MOV);
  if (existente) existente.setName(FZ.HOJA_MOV + ' (anterior ' + isoDia_(new Date()) + ')');
  var sh = ss.insertSheet(FZ.HOJA_MOV, 1);
  var cfg = leerConfig();
  var cab = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Cuotas', 'Medio de pago', 'Mes (opcional)'];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  sh.getRange(1, FZ.MOV.NOTA).setValue('Nota');
  sh.getRange(1, FZ.MOV.DESDE, 1, 3).setFormulas([formulasMovimientos_(cfg.tarjetaMesSig)]);
  if (movimientos.length) {
    var filas = movimientos.map(function (m) { return [m.fecha, m.desc, m.cat, m.monto, m.cuotas || 1, m.medio || '', m.mes || '']; });
    sh.getRange(2, 1, filas.length, 7).setValues(filas);
  }
  formatearMovimientos_(sh);
  return sh;
}

function formatearMovimientos_(sh) {
  var C = FZ.C;
  var n = Math.max(sh.getMaxRows(), 500);
  if (sh.getMaxRows() < 500) sh.insertRowsAfter(sh.getMaxRows(), 500 - sh.getMaxRows());
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, n, 11).setFontFamily(FZ.FUENTE).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, 11).setBackground(C.cabecera).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(1, FZ.MOV.DESDE, 1, 3).setBackground(C.cabecera2).setFontColor('#CBD5E1');
  sh.setRowHeight(1, 30);
  sh.setFrozenRows(1);
  var anchos = [96, 260, 150, 110, 64, 140, 110, 100, 100, 110, 220];
  anchos.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, FZ.MOV.FECHA, n - 1, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, FZ.MOV.MONTO, n - 1, 1).setNumberFormat(FZ.FORMATO_NUM);
  sh.getRange(2, FZ.MOV.POR_MES, n - 1, 1).setNumberFormat(FZ.FORMATO_NUM);
  sh.getRange(2, FZ.MOV.MES, n - 1, 3).setNumberFormat('mmm yyyy');
  sh.getRange(2, FZ.MOV.POR_MES, n - 1, 1).setNumberFormat(FZ.FORMATO_NUM);
  sh.getRange(2, FZ.MOV.DESDE, n - 1, 3).setFontColor(C.tenue).setBackground(C.fondo2);
  sh.getRange(2, FZ.MOV.CUOTAS, n - 1, 1).setHorizontalAlignment('center');
  sh.getRange(2, 1, n - 1, 11).setBorder(null, null, null, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, FZ.MOV.MES).setNote('Dejalo vacío: se calcula solo. Completalo solo si querés imputar el gasto a otro mes.');
  sh.getRange(1, FZ.MOV.CUOTAS).setNote('Cantidad de cuotas. El monto total se reparte en meses consecutivos.');
  sh.setTabColor(C.eventual);
  var cfg = leerConfig();
  sh.getRange(2, FZ.MOV.MEDIO, n - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(cfg.medios, true).setAllowInvalid(true).build());
  sh.getRange(2, FZ.MOV.CUOTAS, n - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberBetween(1, 60).setAllowInvalid(false).build());
}

/** Desplegable de categorías = filas de la sección EVENTUALES de Finanzas. */
function actualizarValidacionMovimientos_(est) {
  var sh = hoja_(FZ.HOJA_MOV);
  if (!sh) return;
  var cats = est.items.filter(function (i) { return i.mov; }).map(function (i) { return i.nombre; });
  if (!cats.length) return;
  sh.getRange(2, FZ.MOV.CAT, sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(cats, true).setAllowInvalid(false)
      .setHelpText('Las categorías son las filas de EVENTUALES en la hoja Finanzas. Agregá una fila allá para crear una nueva.').build());
}

function leerMovimientos_() {
  var sh = hoja_(FZ.HOJA_MOV);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, FZ.MOV.NOTA).getValues();
}

/** Automatización al escribir en Movimientos: fecha de hoy y categoría sugerida. */
function alEditarMovimientos_(e) {
  var r = e.range;
  if (r.getColumn() > FZ.MOV.DESC || r.getLastColumn() < FZ.MOV.DESC || r.getRow() < 2) return;
  var sh = r.getSheet();
  var filas = sh.getRange(r.getRow(), 1, r.getNumRows(), FZ.MOV.CAT).getValues();
  var aprendidas = null, cambio = false;
  filas.forEach(function (f) {
    if (!String(f[1]).trim()) return;
    if (f[0] === '') { f[0] = new Date(); cambio = true; }
    if (f[2] === '') {
      aprendidas = aprendidas || aprenderCategorias_(leerMovimientos_());
      f[2] = adivinarCategoria(f[1], aprendidas); cambio = true;
    }
  });
  if (cambio) sh.getRange(r.getRow(), 1, filas.length, FZ.MOV.CAT).setValues(filas);
}

/* ------------------------------------------------------------------ */
/* API del panel lateral                                               */
/* ------------------------------------------------------------------ */

/** Datos para el panel: conceptos, estado del mes, categorías y aprendizaje. */
function panelDatos() {
  var sh = hoja_();
  var est = leerEstructura(sh);
  var hoy = new Date(), cfg = leerConfig(), fer = leerFeriados();
  var idx = indiceMes_(est, hoy);
  var col = idx >= 0 ? est.meses[idx].col : -1;
  var n = est.ultimaFila - 2;
  var vals = col > 0 ? sh.getRange(3, col, n, 1).getValues() : [];
  var ests = col > 0 ? sh.getRange(3, col, n, 1).getFontStyles() : [];
  var items = est.items.filter(function (it) { return !it.mov; }).map(function (it) {
    var regla = parsearRegla(it.vence);
    var fecha = regla && !regla.error ? fechaRegla(regla, hoy.getFullYear(), hoy.getMonth(), fer) : null;
    var v = col > 0 ? vals[it.fila - 3][0] : '';
    return {
      nombre: it.nombre, fila: it.fila, seccion: it.seccion, categoria: it.categoria, clase: it.clase,
      medio: it.medio, vence: describirRegla(regla), fecha: fecha ? isoDia_(fecha) : '',
      valor: typeof v === 'number' ? v : null, estimado: col > 0 && ests[it.fila - 3][0] === 'italic'
    };
  });
  var movs = leerMovimientos_();
  var R = est.resumen;
  var resumen = {};
  if (col > 0) {
    ['I', 'G', 'A', 'L'].forEach(function (k) { if (R[k]) resumen[k] = Number(sh.getRange(R[k], col).getValue()) || 0; });
  }
  var meses = [];
  for (var k = -3; k <= 6; k++) {
    var d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
    if (indiceMes_(est, d) >= 0) meses.push({ iso: isoMes_(d), label: etiquetaMes_(d) });
  }
  return {
    hoy: isoDia_(hoy), mes: isoMes_(hoy), mesLabel: etiquetaMes_(hoy), meses: meses,
    items: items,
    categorias: est.items.filter(function (i) { return i.mov; }).map(function (i) { return i.nombre; }),
    medios: cfg.medios,
    aprendidas: aprenderCategorias_(movs.slice(-800)),
    palabras: PALABRAS_CATEGORIA_,
    recientes: movs.slice(-6).reverse().filter(function (r) { return r[1]; }).map(function (r) {
      return { fecha: r[0] instanceof Date ? isoDia_(r[0]) : '', desc: r[1], cat: r[2], monto: Number(r[3]) || 0, cuotas: r[4] || 1 };
    }),
    resumen: resumen,
    deshacer: PropertiesService.getUserProperties().getProperty('deshacer') ? JSON.parse(PropertiesService.getUserProperties().getProperty('deshacer')).texto : ''
  };
}

/**
 * Guarda una carga del panel.
 * p = { tipo:'fijo'|'mov', fila, mes:'YYYY-MM', texto:'89423' | '10615+178223', desc, categoria, cuotas, medio, fecha:'YYYY-MM-DD' }
 */
function panelGuardar(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var monto = parsearMonto(p.texto);
    if (!monto) throw new Error('No entendí el monto "' + p.texto + '"');
    var deshacer;
    var mensaje;
    if (p.tipo === 'fijo') {
      var sh = hoja_();
      var est = leerEstructura(sh);
      var it = est.items.filter(function (x) { return x.fila === Number(p.fila); })[0];
      if (!it) throw new Error('No encontré ese concepto. ¿Se movió la fila? Recargá el panel.');
      var col = colDeMes_(est, desdeIsoMes_(p.mes));
      if (col < 0) throw new Error('Ese mes no está en la planilla.');
      var celda = sh.getRange(it.fila, col);
      deshacer = { tipo: 'fijo', fila: it.fila, col: col, f: celda.getFormula(), v: celda.getValue(), estilo: celda.getFontStyle(), color: celda.getFontColor(),
        texto: it.nombre + ' · ' + etiquetaMes_(desdeIsoMes_(p.mes)) };
      if (p.sumar && typeof deshacer.v === 'number' && deshacer.estilo !== 'italic') {
        var base = deshacer.f ? deshacer.f.replace(/^=/, '') : String(deshacer.v);
        celda.setFormula('=' + base + '+' + monto.valor);
      } else if (monto.formula) celda.setFormula(monto.formula);
      else celda.setValue(monto.valor);
      marcarConfirmado_(celda);
      var nProy = reproyectar(sh, est, [it.fila]);
      mensaje = it.nombre + ' ' + etiquetaMes_(desdeIsoMes_(p.mes)) + ': ' + fmtPesos_(celda.getValue()) + (nProy ? ' · meses siguientes actualizados' : '');
    } else {
      var shm = hoja_(FZ.HOJA_MOV);
      var fila = [
        p.fecha ? new Date(p.fecha + 'T12:00:00') : new Date(), String(p.desc || '').trim() || 'Gasto', p.categoria || 'Otros',
        monto.formula || monto.valor, Math.max(1, Number(p.cuotas) || 1), p.medio || '', p.mesManual ? desdeIsoMes_(p.mesManual) : ''
      ];
      // Primera fila libre según la descripción (las columnas automáticas llegan hasta el final)
      var colB = shm.getRange(1, FZ.MOV.DESC, Math.max(shm.getLastRow(), 1), 1).getValues();
      var destino = colB.length;
      while (destino > 1 && !String(colB[destino - 1][0]).trim()) destino--;
      destino++;
      shm.getRange(destino, 1, 1, 7).setValues([fila]);
      deshacer = { tipo: 'mov', fila: destino, texto: fila[1] + ' (' + fmtPesos_(monto.valor) + ')' };
      mensaje = fila[1] + ' · ' + fila[2] + ' · ' + fmtPesos_(monto.valor) + (fila[4] > 1 ? ' en ' + fila[4] + ' cuotas' : '');
    }
    PropertiesService.getUserProperties().setProperty('deshacer', JSON.stringify(deshacer));
    return { ok: true, mensaje: mensaje };
  } finally {
    lock.releaseLock();
  }
}

function panelDeshacer() {
  var props = PropertiesService.getUserProperties();
  var raw = props.getProperty('deshacer');
  if (!raw) return { ok: false, mensaje: 'Nada para deshacer' };
  var d = JSON.parse(raw);
  if (d.tipo === 'fijo') {
    var sh = hoja_();
    var celda = sh.getRange(d.fila, d.col);
    if (d.f) celda.setFormula(d.f); else celda.setValue(d.v);
    celda.setFontStyle(d.estilo).setFontColor(d.color);
    reproyectar(sh, leerEstructura(sh), [d.fila]);
  } else {
    var shm = hoja_(FZ.HOJA_MOV);
    shm.getRange(d.fila, 1, 1, 7).clearContent();
  }
  props.deleteProperty('deshacer');
  return { ok: true, mensaje: 'Deshecho: ' + d.texto };
}

/** Confirma el valor estimado del mes (ej. "ya lo pagué"). */
function panelConfirmar(fila, mes) {
  var sh = hoja_();
  var est = leerEstructura(sh);
  var col = colDeMes_(est, desdeIsoMes_(mes || isoMes_(new Date())));
  if (col < 0) throw new Error('Mes fuera de la planilla');
  var celda = sh.getRange(Number(fila), col);
  if (celda.getValue() === '') throw new Error('No hay monto para confirmar');
  marcarConfirmado_(celda);
  return { ok: true };
}
