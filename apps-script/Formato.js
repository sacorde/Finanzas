/**
 * Finanzas · Diseño visual de la hoja
 * Todo el formato se puede reaplicar sin perder datos (menú → Reparar formato).
 * Respeta el estado estimado/confirmado de cada celda (itálica gris = estimado).
 */

function aplicarFormato(sh, est) {
  est = est || leerEstructura(sh);
  var C = FZ.C, lr = est.ultimaFila, lc = est.ultimaCol, G = FZ.COL_MES0;
  var nMes = lc - G + 1;

  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, lr, lc).setFontFamily(FZ.FUENTE).setFontSize(10).setVerticalAlignment('middle').setWrap(false);
  sh.setTabColor(C.acento);

  // Anchos
  sh.setColumnWidth(FZ.COL_TIPO, 20);
  sh.setColumnWidth(FZ.COL_NOMBRE, 250);
  sh.setColumnWidth(FZ.COL_VENCE, 130);
  sh.setColumnWidth(FZ.COL_PROX, 92);
  sh.setColumnWidth(FZ.COL_MEDIO, 140);
  sh.setColumnWidth(FZ.COL_PROY, 140);
  sh.setColumnWidths(G, nMes, 96);
  est.totales.forEach(function (t) { sh.setColumnWidth(t.col, 116); });
  sh.hideColumns(FZ.COL_TIPO);

  // Alturas
  sh.setRowHeights(1, lr, 26);
  sh.setRowHeight(1, 24);
  sh.setRowHeight(2, 30);

  // Cabecera (filas 1-2)
  var cab = sh.getRange(1, 1, 2, lc);
  cab.setBackground(C.cabecera).setFontColor(C.cabeceraTxt).setFontWeight('bold').setBorder(false, false, false, false, false, false);
  sh.getRange(1, 1, 1, lc).setFontSize(9).setFontColor(C.tenue).setHorizontalAlignment('center');
  sh.getRange(1, 1, 1, lc).breakApart();
  est.totales.forEach(function (t) {
    if (t.cols.length > 1) sh.getRange(1, t.cols[0], 1, t.cols.length).merge();
    sh.getRange(1, t.cols[0]).setValue(t.anio);
    sh.getRange(1, t.col).setValue('');
  });
  sh.getRange(1, FZ.COL_NOMBRE).setValue('FINANZAS').setFontSize(11).setFontColor(C.cabeceraTxt).setHorizontalAlignment('left');
  sh.getRange(2, FZ.COL_NOMBRE, 1, 5).setValues([['Concepto', 'Vence', 'Próximo', 'Medio de pago', 'Proyección']])
    .setFontColor('#CBD5E1').setFontSize(9).setHorizontalAlignment('left');
  sh.getRange(2, G, 1, nMes).setNumberFormat('mmmm').setHorizontalAlignment('center').setFontSize(10);
  est.totales.forEach(function (t) { sh.getRange(1, t.col, 2, 1).setBackground(C.cabecera2); });
  sh.getRange(2, FZ.COL_VENCE).setNote('Escribí cuándo vence, en palabras:\n• 15\n• 10 hábil (si cae feriado, el hábil siguiente)\n• 1er hábil · 5to hábil\n• último hábil · anteúltimo hábil\n• último día · primer lunes');
  sh.getRange(2, FZ.COL_PROY).setNote('Cómo completar los meses futuros:\n• Repetir: el último valor que cargaste\n• Promedio 3 meses: para gastos variables (luz, gas)\n• Ajustar por inflación: último valor + inflación esperada\n• No proyectar');

  // Cuerpo
  var cuerpo = sh.getRange(3, 1, lr - 2, lc);
  cuerpo.setBackground(C.fondo).setFontWeight('normal').setBorder(false, false, false, false, false, false);
  cuerpo.setBorder(null, null, true, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(3, FZ.COL_NOMBRE, lr - 2, 1).setFontColor(C.tinta);
  sh.getRange(3, FZ.COL_VENCE, lr - 2, 4).setFontColor(C.tinta2).setFontSize(9);
  sh.getRange(3, FZ.COL_PROX, lr - 2, 1).setNumberFormat('ddd d/m').setHorizontalAlignment('left');
  sh.getRange(3, G, lr - 2, nMes).setNumberFormat(FZ.FORMATO_NUM).setHorizontalAlignment('right');

  // Filas vacías = separadores finos
  var izq = sh.getRange(1, 1, lr, 2).getValues();
  for (var f = 3; f <= lr; f++) {
    if (!String(izq[f - 1][0]).trim() && !String(izq[f - 1][1]).trim()) {
      sh.setRowHeight(f, 10);
      sh.getRange(f, 1, 1, lc).setBorder(false, false, false, false, false, false);
    }
  }

  // Resumen
  var R = est.resumen;
  var res = [['I', 'Ingresos', C.ingreso], ['G', 'Gastos', C.gasto], ['A', 'Ahorro e inversión', C.ahorro], ['L', 'Libre del mes', C.tinta]];
  res.forEach(function (x) {
    var fila = R[x[0]];
    if (!fila) return;
    var r = sh.getRange(fila, 1, 1, lc);
    r.setFontWeight('bold').setFontSize(10).setFontColor(C.tinta).setBackground(C.fondo);
    sh.getRange(fila, G, 1, nMes).setNumberFormat(FZ.FORMATO_NUM_RES);
    sh.getRange(fila, FZ.COL_NOMBRE).setValue(x[1]).setFontColor(x[2]);
    sh.setRowHeight(fila, 28);
  });
  if (R.L) {
    sh.getRange(R.L, 1, 1, lc).setFontSize(11).setBorder(true, null, true, null, null, null, C.tinta, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(R.L, 32);
  }

  // Secciones y categorías
  est.secciones.forEach(function (s) {
    var col = s.mov ? [C.eventual, C.eventualSuave] : s.clase === 'I' ? [C.ingreso, C.ingresoSuave] : s.clase === 'A' ? [C.ahorro, C.ahorroSuave] : [C.gasto, C.gastoSuave];
    sh.getRange(s.fila, 1, 1, lc).setBackground(col[1]).setFontColor(col[0]).setFontWeight('bold').setFontSize(10)
      .setBorder(true, null, true, null, null, null, col[0], SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(s.fila, FZ.COL_NOMBRE).setValue(String(s.nombre).toUpperCase());
    sh.setRowHeight(s.fila, 32);
  });
  est.categorias.forEach(function (c) {
    sh.getRange(c.fila, 1, 1, lc).setBackground(C.fondo2).setFontColor(C.tinta2).setFontWeight('bold');
    sh.setRowHeight(c.fila, 28);
  });

  // Columnas de total anual
  est.totales.forEach(function (t) {
    sh.getRange(3, t.col, lr - 2, 1).setBackground(C.fondoTotal).setFontWeight('bold').setFontColor(C.tinta).setFontStyle('normal');
  });

  aplicarFormatoCondicional_(sh, est);
  aplicarValidaciones_(sh, est);
  aplicarGrupos_(sh, est);
  sh.setFrozenRows(FZ.FILAS_CONGELADAS);
  sh.setFrozenColumns(FZ.COL_NOMBRE);
}

function aplicarFormatoCondicional_(sh, est) {
  var C = FZ.C, lr = est.ultimaFila, lc = est.ultimaCol, G = FZ.COL_MES0;
  var L = colLetra_(G);
  var mesActual = '=' + L + '$2=DATE(YEAR(TODAY()),MONTH(TODAY()),1)';
  var reglas = [];
  var nuevo = function () { return SpreadsheetApp.newConditionalFormatRule(); };
  if (est.resumen.L) {
    var libre = sh.getRange(est.resumen.L, G, 1, lc - G + 1);
    reglas.push(nuevo().whenNumberLessThan(0).setFontColor(C.mal).setBackground(C.malSuave).setRanges([libre]).build());
    reglas.push(nuevo().whenNumberGreaterThan(0).setFontColor(C.ok).setRanges([libre]).build());
  }
  reglas.push(nuevo().whenFormulaSatisfied(mesActual).setBackground(C.acento).setFontColor('#FFFFFF')
    .setRanges([sh.getRange(2, G, 1, lc - G + 1)]).build());
  reglas.push(nuevo().whenFormulaSatisfied(mesActual).setBackground(C.acentoSuave)
    .setRanges([sh.getRange(3, G, lr - 2, lc - G + 1)]).build());
  reglas.push(nuevo().whenFormulaSatisfied('=AND(ISNUMBER($D3),$D3-TODAY()<=3)').setBackground(C.avisoSuave).setFontColor(C.aviso).setBold(true)
    .setRanges([sh.getRange(3, FZ.COL_PROX, lr - 2, 1)]).build());
  sh.setConditionalFormatRules(reglas);
}

function aplicarValidaciones_(sh, est) {
  var lr = est.ultimaFila, cfg = leerConfig();
  var vMedio = SpreadsheetApp.newDataValidation().requireValueInList(cfg.medios, true).setAllowInvalid(true).build();
  var vProy = SpreadsheetApp.newDataValidation().requireValueInList(FZ.PROY, true).setAllowInvalid(false).build();
  var medios = [], proys = [];
  var esItem = {};
  est.items.forEach(function (it) { if (!it.mov) esItem[it.fila] = true; });
  for (var f = 3; f <= lr; f++) {
    medios.push([esItem[f] ? vMedio : null]);
    proys.push([esItem[f] ? vProy : null]);
  }
  sh.getRange(3, FZ.COL_MEDIO, lr - 2, 1).setDataValidations(medios);
  sh.getRange(3, FZ.COL_PROY, lr - 2, 1).setDataValidations(proys);
}

function aplicarGrupos_(sh, est) {
  var lr = est.ultimaFila, lc = est.ultimaCol;
  sh.getRange(3, 1, lr - 2, 1).shiftRowGroupDepth(-8);
  sh.getRange(1, FZ.COL_VENCE, 1, lc - FZ.COL_VENCE + 1).shiftColumnGroupDepth(-8);
  sh.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
  sh.setColumnGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.AFTER);

  var conContenido = {};
  est.items.forEach(function (it) { conContenido[it.fila] = true; });
  est.categorias.forEach(function (c) { conContenido[c.fila] = true; });
  est.secciones.forEach(function (s, i) {
    var fin = i + 1 < est.secciones.length ? est.secciones[i + 1].fila - 1 : lr;
    // El separador final queda fuera del grupo para que la sección colapsada respire
    if (!conContenido[fin]) fin--;
    if (fin > s.fila) sh.getRange(s.fila + 1, 1, fin - s.fila, 1).shiftRowGroupDepth(1);
    s.categorias.forEach(function (c, k) {
      var finCat = k + 1 < s.categorias.length ? s.categorias[k + 1].fila - 1 : fin;
      if (finCat > c.fila) sh.getRange(c.fila + 1, 1, finCat - c.fila, 1).shiftRowGroupDepth(1);
    });
  });
  est.totales.forEach(function (t) {
    if (t.cols.length) sh.getRange(1, t.cols[0], 1, t.cols.length).shiftColumnGroupDepth(1);
  });
  sh.getRange(1, FZ.COL_VENCE, 1, 4).shiftColumnGroupDepth(1);
}

/** Colapsa años pasados y deja el mes actual a la vista. */
function enfocarMesActual(sh, est) {
  est = est || leerEstructura(sh);
  var hoy = new Date(), anio = hoy.getFullYear();
  est.totales.forEach(function (t) {
    if (!t.cols.length) return;
    try {
      var g = sh.getColumnGroup(t.cols[0], 1);
      if (t.anio < anio) g.collapse(); else g.expand();
    } catch (e) { /* sin grupo */ }
  });
  var idx = indiceMes_(est, hoy);
  if (idx < 0) return;
  var col = est.meses[idx].col;
  var filaFoco = est.items.length ? est.items[0].fila : FZ.FILAS_CONGELADAS + 1;
  // Truco de scroll: ir al final, volver dos meses antes y quedarse en el mes actual
  var previo = idx >= 2 && est.meses[idx - 2].fecha.getFullYear() === anio ? est.meses[idx - 2].col
    : (est.totales.filter(function (t) { return t.anio === anio - 1; })[0] || { col: col }).col;
  sh.getRange(filaFoco, est.ultimaCol).activate();
  SpreadsheetApp.flush();
  sh.getRange(filaFoco, previo).activate();
  SpreadsheetApp.flush();
  sh.getRange(filaFoco, col).activate();
}
