/**
 * Finanzas · Estructura de la hoja principal
 *
 * La hoja es una grilla normal de Sheets: podés escribir números, cuentas
 * (=1500*3), insertar filas, arrastrar, copiar y pegar. La columna A (oculta)
 * guarda códigos que le dicen al script qué es cada fila:
 *   RES:I/G/A/L   filas de resumen (Ingresos, Gastos, Ahorro, Libre)
 *   SEC:I|G|A     sección (INGRESOS, GASTOS FIJOS, AHORRO...) · SEC:G:MOV = Eventuales
 *   CAT           categoría (muestra el subtotal de sus ítems)
 *   (vacío)       ítem común: cualquier fila con nombre en la columna B
 */

/** Lee toda la estructura en 2 llamadas. */
function leerEstructura(sh) {
  var ultimaFila = Math.max(sh.getLastRow(), FZ.FILAS_CONGELADAS + 1);
  var ultimaCol = Math.max(sh.getLastColumn(), FZ.COL_MES0);
  var cab = sh.getRange(1, 1, 2, ultimaCol).getValues();
  var izq = sh.getRange(1, 1, ultimaFila, FZ.COL_PROY).getValues();
  return construirEstructura_(cab, izq, ultimaFila, ultimaCol);
}

/** Parte pura (testeable): arma el modelo a partir de los valores. */
function construirEstructura_(cab, izq, ultimaFila, ultimaCol) {
  var est = { meses: [], totales: [], resumen: {}, secciones: [], categorias: [], items: [], ultimaFila: ultimaFila, ultimaCol: ultimaCol };
  for (var c = FZ.COL_MES0 - 1; c < ultimaCol; c++) {
    var v = cab[1][c];
    if (v instanceof Date) {
      est.meses.push({ col: c + 1, fecha: new Date(v.getFullYear(), v.getMonth(), 1), iso: isoMes_(v) });
    } else if (/^total/i.test(String(v))) {
      var anio = Number(String(v).replace(/\D/g, '')) || Number(cab[0][c]) || null;
      est.totales.push({ col: c + 1, anio: anio });
    }
  }
  est.totales.forEach(function (t) {
    t.cols = est.meses.filter(function (m) { return m.fecha.getFullYear() === t.anio; }).map(function (m) { return m.col; });
  });
  var sec = null, cat = null;
  for (var r = 2; r < izq.length; r++) {
    var tipo = String(izq[r][0]).trim(), nombre = String(izq[r][1]).trim(), fila = r + 1;
    if (tipo.indexOf(FZ.RES) === 0) {
      est.resumen[tipo.slice(4)] = fila;
    } else if (tipo.indexOf(FZ.SEC) === 0) {
      var p = tipo.split(':');
      sec = { fila: fila, nombre: nombre, clase: p[1] || 'G', mov: p[2] === 'MOV', categorias: [], items: [] };
      est.secciones.push(sec);
      cat = null;
    } else if (tipo === FZ.CAT) {
      cat = { fila: fila, nombre: nombre, seccion: sec, items: [] };
      est.categorias.push(cat);
      if (sec) sec.categorias.push(cat);
    } else if (nombre && sec) {
      var it = {
        fila: fila, nombre: nombre, seccion: sec.nombre, clase: sec.clase, mov: sec.mov,
        categoria: sec.mov ? nombre : (cat ? cat.nombre : sec.nombre),
        cat: cat, vence: izq[r][FZ.COL_VENCE - 1], medio: String(izq[r][FZ.COL_MEDIO - 1] || ''),
        proy: String(izq[r][FZ.COL_PROY - 1] || '') || 'Repetir'
      };
      est.items.push(it);
      sec.items.push(it);
      if (cat) cat.items.push(it);
    }
  }
  return est;
}

function indiceMes_(est, fecha) {
  var iso = isoMes_(fecha);
  for (var i = 0; i < est.meses.length; i++) if (est.meses[i].iso === iso) return i;
  return -1;
}

function colDeMes_(est, fecha) {
  var i = indiceMes_(est, fecha);
  return i < 0 ? -1 : est.meses[i].col;
}

/* ------------------------------------------------------------------ */
/* Fórmulas: subtotales, resumen, totales anuales y eventuales         */
/* ------------------------------------------------------------------ */

/** Calcula (sin tocar la hoja) las fórmulas R1C1 de cada fila estructural. Puro. */
function planFormulas_(est) {
  var plan = {}; // fila → fórmula R1C1 para las columnas de mes
  var limites = est.secciones.map(function (s, i) {
    var fin = i + 1 < est.secciones.length ? est.secciones[i + 1].fila - 1 : est.ultimaFila;
    return fin;
  });
  var rangos = function (desde, hasta) { return desde <= hasta ? 'R' + desde + 'C:R' + hasta + 'C' : null; };
  est.secciones.forEach(function (s, i) {
    var fin = limites[i];
    var partes = [];
    if (s.categorias.length) {
      var directo = rangos(s.fila + 1, s.categorias[0].fila - 1);
      if (directo) partes.push(directo);
      s.categorias.forEach(function (c, k) {
        var finCat = k + 1 < s.categorias.length ? s.categorias[k + 1].fila - 1 : fin;
        plan[c.fila] = rangos(c.fila + 1, finCat) ? '=SUM(' + rangos(c.fila + 1, finCat) + ')' : '=0';
        partes.push('R' + c.fila + 'C');
      });
    } else if (rangos(s.fila + 1, fin)) {
      partes.push(rangos(s.fila + 1, fin));
    }
    plan[s.fila] = partes.length ? '=SUM(' + partes.join(',') + ')' : '=0';
  });
  var suma = function (clase) {
    var refs = est.secciones.filter(function (s) { return s.clase === clase; }).map(function (s) { return 'R' + s.fila + 'C'; });
    return refs.length ? '=' + refs.join('+') : '=0';
  };
  var R = est.resumen;
  if (R.I) plan[R.I] = suma('I');
  if (R.G) plan[R.G] = suma('G');
  if (R.A) plan[R.A] = suma('A');
  if (R.L) plan[R.L] = '=R' + (R.I || 1) + 'C-R' + (R.G || 1) + 'C-R' + (R.A || 1) + 'C';
  if (R.L && (!R.I || !R.G || !R.A)) plan[R.L] = '=0';
  return plan;
}

var FORMULA_EVENTUAL_ = '=SUMIFS(Movimientos!C10,Movimientos!C3,RC2,Movimientos!C8,"<="&R2C,Movimientos!C9,">="&R2C)';

/** Escribe subtotales, resumen, totales anuales y fórmulas de Eventuales. */
function reconstruirFormulas(sh, est) {
  est = est || leerEstructura(sh);
  var plan = planFormulas_(est);
  var c0 = FZ.COL_MES0, nCol = est.ultimaCol - c0 + 1;
  var esMes = {}, esTotal = {};
  est.meses.forEach(function (m) { esMes[m.col] = true; });
  est.totales.forEach(function (t) { esTotal[t.col] = t; });

  // 1) Filas estructurales: una escritura por fila
  Object.keys(plan).forEach(function (fila) {
    var fs = [];
    for (var c = c0; c <= est.ultimaCol; c++) {
      if (esMes[c]) fs.push(plan[fila]);
      else if (esTotal[c]) fs.push(formulaTotal_(esTotal[c]));
      else fs.push('');
    }
    sh.getRange(Number(fila), c0, 1, nCol).setFormulasR1C1([fs]);
  });

  // 2) Eventuales: completa con la fórmula de Movimientos donde no hay valor manual
  var eventuales = est.items.filter(function (it) { return it.mov; });
  if (eventuales.length && sh.getParent().getSheetByName(FZ.HOJA_MOV)) {
    var f0 = eventuales[0].fila, f1 = eventuales[eventuales.length - 1].fila;
    var rng = sh.getRange(f0, c0, f1 - f0 + 1, nCol);
    var act = rng.getFormulasR1C1(), vals = rng.getValues();
    var cambio = false;
    eventuales.forEach(function (it) {
      var r = it.fila - f0;
      est.meses.forEach(function (m) {
        var j = m.col - c0;
        if (act[r][j] === FORMULA_EVENTUAL_) return;
        if (!act[r][j] && vals[r][j] === '') { act[r][j] = FORMULA_EVENTUAL_; cambio = true; }
      });
    });
    if (cambio) {
      eventuales.forEach(function (it) {
        var r = it.fila - f0;
        // null = valor cargado a mano: no se pisa
        var fila = act[r].map(function (f, j) { return f || (vals[r][j] === '' ? '' : null); });
        escribirFormulasSaltando_(sh, it.fila, c0, fila);
      });
    }
  }

  // 3) Totales anuales: una escritura por columna de total
  var filasConTotal = [];
  for (var f = 3; f <= est.ultimaFila; f++) filasConTotal.push(f);
  var conContenido = {};
  Object.keys(plan).forEach(function (f) { conContenido[f] = true; });
  est.items.forEach(function (it) { conContenido[it.fila] = true; });
  est.totales.forEach(function (t) {
    var fs = filasConTotal.map(function (f) { return [conContenido[f] ? formulaTotal_(t) : '']; });
    sh.getRange(3, t.col, fs.length, 1).setFormulasR1C1(fs);
  });
}

function formulaTotal_(t) {
  if (!t.cols || !t.cols.length) return '=0';
  return '=SUM(RC' + t.cols[0] + ':RC' + t.cols[t.cols.length - 1] + ')';
}

/** Escribe fórmulas R1C1 en tramos contiguos, saltando celdas marcadas con null. */
function escribirFormulasSaltando_(sh, fila, c0, arr) {
  var i = 0;
  while (i < arr.length) {
    if (arr[i] === null) { i++; continue; }
    var j = i;
    while (j < arr.length && arr[j] !== null) j++;
    sh.getRange(fila, c0 + i, 1, j - i).setFormulasR1C1([arr.slice(i, j)]);
    i = j;
  }
}

/* ------------------------------------------------------------------ */
/* Línea de tiempo: agrega años automáticamente                        */
/* ------------------------------------------------------------------ */

/** Garantiza columnas de meses hasta cubrir el horizonte (agrega años completos). */
function asegurarLineaDeTiempo(sh) {
  var est = leerEstructura(sh);
  var cfg = leerConfig();
  var hoy = new Date();
  var objetivo = new Date(hoy.getFullYear(), hoy.getMonth() + cfg.horizonte, 1);
  var ultimo = est.meses.length ? est.meses[est.meses.length - 1].fecha : new Date(hoy.getFullYear() - 1, 11, 1);
  var agregados = 0;
  while (ultimo < objetivo) {
    var anio = ultimo.getMonth() === 11 ? ultimo.getFullYear() + 1 : ultimo.getFullYear();
    agregarAnio_(sh, anio);
    ultimo = new Date(anio, 11, 1);
    agregados++;
  }
  return agregados;
}

function agregarAnio_(sh, anio) {
  var col = sh.getLastColumn() + 1;
  sh.insertColumnsAfter(sh.getLastColumn(), 13);
  var fila1 = [], fila2 = [];
  for (var m = 0; m < 12; m++) { fila1.push(m === 0 ? anio : ''); fila2.push(new Date(anio, m, 1)); }
  fila1.push(anio); fila2.push('Total ' + anio);
  sh.getRange(1, col, 2, 13).setValues([fila1, fila2]);
}

/* ------------------------------------------------------------------ */
/* Columna "Próximo vencimiento"                                       */
/* ------------------------------------------------------------------ */

function actualizarProximos(sh, est) {
  est = est || leerEstructura(sh);
  var fer = leerFeriados();
  var hoy = new Date();
  var n = est.ultimaFila - 2;
  if (n < 1) return;
  var rng = sh.getRange(3, FZ.COL_PROX, n, 1);
  var out = rng.getValues().map(function () { return ['']; });
  var notas = out.map(function () { return ['']; });
  est.items.forEach(function (it) {
    var regla = parsearRegla(it.vence);
    if (!regla) return;
    if (regla.error) { out[it.fila - 3][0] = '⚠︎ revisar'; notas[it.fila - 3][0] = regla.error; return; }
    out[it.fila - 3][0] = proximoVencimiento(regla, hoy, fer) || '';
    notas[it.fila - 3][0] = describirRegla(regla);
  });
  rng.setValues(out).setNotes(notas);
}
