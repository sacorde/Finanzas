/**
 * Finanzas · Instalación: importa la planilla anterior (o crea una plantilla)
 *
 * La hoja original NUNCA se borra: se renombra a "Finanzas (original)".
 * Qué se importa:
 *  - Los meses (fila 1 con ENERO..DICIEMBRE + el año en la columna de total).
 *  - Secciones (MAYÚSCULAS), categorías (títulos sin valores) e ítems.
 *  - Las cuentas escritas a mano (=10615+178223) se conservan como fórmula.
 *    Las fórmulas que apuntan a otras celdas se importan con su valor.
 *  - Las fórmulas de vencimiento de la columna A se traducen a reglas ("1er hábil", "10"...).
 *  - "DA" → medio de pago "Débito automático".
 *  - Los EVENTUALES pasan a la hoja Movimientos (una fila por gasto) con su categoría.
 */

var MES_IDX_ = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

var CATEGORIAS_EVENTUALES = ['Salidas y comida', 'Viajes', 'Ropa y calzado', 'Tecnología', 'Hogar', 'Salud y cuidado', 'Regalos', 'Educación', 'Auto y transporte', 'Otros'];

/** Traduce una fórmula de vencimiento del Excel viejo a una regla en palabras. */
function inferirVence_(a, f) {
  var s = String(f || '').toUpperCase().replace(/\s+/g, '');
  if (!s) return a instanceof Date ? String(a.getDate()) : '';
  var m;
  if ((m = /WORKDAY\(EOMONTH\(TODAY\(\),0\)\+1,-(\d)\)/.exec(s))) return m[1] === '1' ? 'último hábil' : m[1] === '2' ? 'anteúltimo hábil' : '';
  if (/^=WORKDAY\(/.test(s) && /,1\)$/.test(s)) return '1er hábil';
  if ((m = /DAY\(TODAY\(\)\)>(\d+)/.exec(s))) return m[1] + (/WEEKDAY/.test(s) ? ' hábil anterior' : '');
  if (/DAY\(TODAY\(\)\)=1\b/.test(s)) return '1';
  return a instanceof Date ? String(a.getDate()) : '';
}

/**
 * Parte pura: interpreta la hoja vieja.
 * @param {Array<Array>} vals   getValues()
 * @param {Array<Array>} forms  getFormulas()
 * @return {{meses:Date[], items:Array, avisos:string[]}}
 */
function parsearLegado(vals, forms) {
  var cols = [], pend = [], ultimoAnio = null;
  var f1 = vals[0] || [];
  for (var c = 0; c < f1.length; c++) {
    var t = norm_(f1[c]);
    if (MES_IDX_.hasOwnProperty(t)) { pend.push({ c: c, m: MES_IDX_[t] }); continue; }
    var anio = typeof f1[c] === 'number' ? f1[c] : /^\d{4}$/.test(t) ? Number(t) : null;
    if (anio && anio > 1990 && anio < 2200 && pend.length) {
      pend.forEach(function (p) { cols.push({ c: p.c, fecha: new Date(anio, p.m, 1) }); });
      pend = []; ultimoAnio = anio;
    }
  }
  if (pend.length) {
    var a2 = (ultimoAnio || new Date().getFullYear()) + 1;
    pend.forEach(function (p) { cols.push({ c: p.c, fecha: new Date(a2, p.m, 1) }); });
  }

  var items = [], avisos = [], sec = '', cat = '';
  for (var r = 2; r < vals.length; r++) {
    var a = vals[r][0], fa = forms[r] ? forms[r][0] : '';
    var aTxt = typeof a === 'string' && !fa ? a.trim() : '';
    var bTxt = String(vals[r][1] == null ? '' : vals[r][1]).trim();
    if (/^(total|resultado)/i.test(aTxt) || /^(total|resultado)/i.test(bTxt)) continue;
    if (!bTxt && aTxt) {
      if (aTxt === aTxt.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(aTxt)) { sec = aTxt; cat = ''; continue; }
      var conValores = cols.some(function (col) { return typeof vals[r][col.c] === 'number' && vals[r][col.c] !== 0; });
      if (!conValores) { cat = aTxt; continue; }
    }
    var nombre = bTxt || (aTxt !== 'DA' ? aTxt : '');
    if (!nombre) continue;
    var celdas = {}, alguno = false;
    cols.forEach(function (col) {
      var f = forms[r] ? forms[r][col.c] : '', v = vals[r][col.c];
      if (f && esFormulaAritmetica(f.replace(/^=\+/, '='))) {
        celdas[isoMes_(col.fecha)] = { f: '=' + f.replace(/^=\+?\s*/, ''), v: typeof v === 'number' ? v : null };
        alguno = true;
      } else if (typeof v === 'number') {
        celdas[isoMes_(col.fecha)] = { v: v, f: '' };
        alguno = true;
        if (f) avisos.push(nombre + ' · ' + isoMes_(col.fecha) + ': fórmula "' + f + '" importada como valor');
      }
    });
    items.push({ sec: sec, cat: cat, nombre: nombre, vence: inferirVence_(a, fa), medio: aTxt === 'DA' ? 'Débito automático' : '', celdas: celdas, conValores: alguno });
  }
  var meses = cols.map(function (x) { return x.fecha; }).sort(function (x, y) { return x - y; });
  return { meses: meses, items: items, avisos: avisos };
}

var RENOMBRE_CAT_ = { alquiler: 'Vivienda', super: 'Supermercado' };

/**
 * Parte pura: arma el modelo nuevo (filas) a partir del legado.
 * @return {{meses, filas:Array, movimientos:Array}}
 */
function modeloDesdeLegado(leg, hoy, aprendidas) {
  var mesHoy = isoMes_(hoy);
  var grupos = { I: [], G: [], P: [], A: [] }, ordenCat = [], porCat = {}, movimientos = [];
  leg.items.forEach(function (it) {
    var s = norm_(it.sec);
    if (/eventual/.test(s)) {
      Object.keys(it.celdas).sort().forEach(function (iso) {
        var c = it.celdas[iso];
        var monto = c.f || c.v;
        if (!monto) return;
        movimientos.push({ fecha: desdeIsoMes_(iso), desc: it.nombre, cat: adivinarCategoria(it.nombre, aprendidas), monto: monto, cuotas: 1, medio: '', mes: desdeIsoMes_(iso) });
      });
      return;
    }
    if (!it.conValores && !it.vence) return;
    if (/ingreso/.test(s)) { grupos.I.push(it); return; }
    if (/prestamo|inversion|deuda|ahorro/.test(s)) {
      (/ahorro|inversi|plazo fijo|fci|dolar/.test(norm_(it.nombre)) ? grupos.A : grupos.P).push(it);
      return;
    }
    var cat = it.cat || (s && s !== 'gastos fijos' ? titulo_(it.sec) : 'Otros fijos');
    cat = RENOMBRE_CAT_[norm_(cat)] || cat;
    if (!porCat[cat]) { porCat[cat] = []; ordenCat.push(cat); }
    porCat[cat].push(it);
  });

  var filas = [];
  var item = function (it) {
    return { tipo: 'ITEM', nombre: it.nombre, vence: it.vence, medio: it.medio, proy: modoProyeccionSugerido(it.nombre), celdas: marcarEstimados_(it.celdas, leg.meses, mesHoy) };
  };
  filas.push({ tipo: 'SEC', nombre: 'Ingresos', clase: 'I' });
  grupos.I.forEach(function (it) { filas.push(item(it)); });
  filas.push({ tipo: 'SEP' });
  filas.push({ tipo: 'SEC', nombre: 'Gastos fijos', clase: 'G' });
  ordenCat.forEach(function (c) {
    filas.push({ tipo: 'CAT', nombre: c });
    porCat[c].forEach(function (it) { filas.push(item(it)); });
  });
  filas.push({ tipo: 'SEP' });
  filas.push({ tipo: 'SEC', nombre: 'Préstamos y deudas', clase: 'G' });
  grupos.P.forEach(function (it) { filas.push(item(it)); });
  filas.push({ tipo: 'SEP' });
  filas.push({ tipo: 'SEC', nombre: 'Ahorro e inversión', clase: 'A' });
  grupos.A.forEach(function (it) { filas.push(item(it)); });
  filas.push({ tipo: 'SEP' });
  filas.push({ tipo: 'SEC', nombre: 'Eventuales', clase: 'G', mov: true });
  var cats = CATEGORIAS_EVENTUALES.slice();
  movimientos.forEach(function (m) { if (cats.indexOf(m.cat) < 0) cats.splice(cats.length - 1, 0, m.cat); });
  cats.forEach(function (c) { filas.push({ tipo: 'ITEM', nombre: c, celdas: {} }); });
  filas.push({ tipo: 'SEP' });
  return { meses: leg.meses, filas: filas, movimientos: movimientos };
}

/**
 * Marca como estimados los meses futuros que solo repiten el valor anterior
 * (lo que el sistema haría solo). Los que cambian se respetan como cargados por vos.
 * Si el mes actual está vacío pero el anterior tenía valor, se carga 0 para
 * reproducir fielmente la planilla (el concepto no se pagó este mes).
 */
function marcarEstimados_(celdas, meses, mesHoy) {
  var out = {}, prev = null;
  meses.forEach(function (d) {
    var iso = isoMes_(d), c = celdas[iso];
    if (iso === mesHoy && !c && prev) { out[iso] = { v: 0, f: '', proy: false }; prev = null; return; }
    if (!c) { prev = null; return; }
    var val = c.v === null || c.v === undefined ? c.f : c.v;
    var repite = iso > mesHoy && prev && (prev.f ? prev.f === c.f : prev.val === val);
    out[iso] = { v: c.v, f: c.f, proy: !!repite };
    prev = { val: val, f: c.f };
  });
  return out;
}

/** Ingresos irregulares (aguinaldo, bonos) no se repiten solos. */
function modoProyeccionSugerido(nombre) {
  return /^otros|aguinaldo|\bsac\b|bono|premio|extra|reintegro/.test(norm_(nombre)) ? 'No proyectar' : 'Repetir';
}

function titulo_(s) {
  s = String(s).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Plantilla para empezar de cero. */
function modeloPlantilla(hoy) {
  var meses = [];
  for (var y = hoy.getFullYear(); y <= hoy.getFullYear() + 1; y++) for (var m = 0; m < 12; m++) meses.push(new Date(y, m, 1));
  var it = function (nombre, vence, medio) { return { tipo: 'ITEM', nombre: nombre, vence: vence || '', medio: medio || '', proy: modoProyeccionSugerido(nombre), celdas: {} }; };
  var filas = [
    { tipo: 'SEC', nombre: 'Ingresos', clase: 'I' }, it('Salario', 'anteúltimo hábil', 'Transferencia'), it('Otros ingresos (aguinaldo, bonos)'), { tipo: 'SEP' },
    { tipo: 'SEC', nombre: 'Gastos fijos', clase: 'G' },
    { tipo: 'CAT', nombre: 'Vivienda' }, it('Alquiler', '10', 'Transferencia'), it('Expensas', '15 hábil'),
    { tipo: 'CAT', nombre: 'Servicios' }, it('Luz', '1er hábil', 'Débito automático'), it('Gas', '1er hábil', 'Débito automático'), it('Internet', '10', 'Débito automático'), it('Celular', '1er hábil', 'Débito automático'),
    { tipo: 'CAT', nombre: 'Suscripciones' }, it('Streaming', '5', 'Tarjeta VISA'),
    { tipo: 'CAT', nombre: 'Transporte' }, it('SUBE'), it('Nafta'),
    { tipo: 'CAT', nombre: 'Supermercado' }, it('Supermercado del mes', '1er hábil'),
    { tipo: 'SEP' },
    { tipo: 'SEC', nombre: 'Préstamos y deudas', clase: 'G' }, { tipo: 'SEP' },
    { tipo: 'SEC', nombre: 'Ahorro e inversión', clase: 'A' }, it('Ahorro del mes'), { tipo: 'SEP' },
    { tipo: 'SEC', nombre: 'Eventuales', clase: 'G', mov: true }
  ];
  CATEGORIAS_EVENTUALES.forEach(function (c) { filas.push({ tipo: 'ITEM', nombre: c, celdas: {} }); });
  filas.push({ tipo: 'SEP' });
  return { meses: meses, filas: filas, movimientos: [] };
}

/**
 * Parte pura: convierte el modelo en las matrices que se escriben en la hoja.
 * Meses consecutivos + una columna "Total AAAA" después de cada diciembre (o fin de año).
 */
function matricesDesdeModelo(modelo) {
  var cols = [];
  var meses = modelo.meses.slice();
  // Completar años enteros
  if (meses.length) {
    var y0 = meses[0].getFullYear(), y1 = meses[meses.length - 1].getFullYear();
    meses = [];
    for (var y = y0; y <= y1; y++) for (var m = 0; m < 12; m++) meses.push(new Date(y, m, 1));
  }
  meses.forEach(function (d, i) {
    cols.push({ tipo: 'MES', fecha: d, iso: isoMes_(d) });
    if (d.getMonth() === 11 || i === meses.length - 1) cols.push({ tipo: 'TOT', anio: d.getFullYear() });
  });
  var fila1 = ['', 'FINANZAS', '', '', '', ''], fila2 = ['', 'Concepto', 'Vence', 'Próximo', 'Medio de pago', 'Proyección'];
  cols.forEach(function (c) {
    fila1.push(c.tipo === 'MES' ? (c.fecha.getMonth() === 0 ? c.fecha.getFullYear() : '') : '');
    fila2.push(c.tipo === 'MES' ? c.fecha : 'Total ' + c.anio);
  });
  var izq = [
    ['RES:I', 'Ingresos', '', '', '', ''], ['RES:G', 'Gastos', '', '', '', ''],
    ['RES:A', 'Ahorro e inversión', '', '', '', ''], ['RES:L', 'Libre del mes', '', '', '', ''], ['', '', '', '', '', '']
  ];
  var grilla = [], estilos = [], colores = [];
  var vacia = function () { return cols.map(function () { return ''; }); };
  for (var k = 0; k < 5; k++) { grilla.push(vacia()); estilos.push(cols.map(function () { return 'normal'; })); colores.push(cols.map(function () { return FZ.C.tinta; })); }
  modelo.filas.forEach(function (f) {
    var a = f.tipo === 'SEC' ? 'SEC:' + f.clase + (f.mov ? ':MOV' : '') : f.tipo === 'CAT' ? 'CAT' : '';
    izq.push([a, f.tipo === 'SEP' ? '' : f.nombre, f.vence || '', '', f.medio || '', f.tipo === 'ITEM' && f.proy ? f.proy : '']);
    var g = [], e = [], co = [];
    cols.forEach(function (c) {
      var celda = c.tipo === 'MES' && f.celdas ? f.celdas[c.iso] : null;
      g.push(celda ? (celda.f || celda.v) : '');
      e.push(celda && celda.proy ? 'italic' : 'normal');
      co.push(celda && celda.proy ? FZ.C.estimado : FZ.C.tinta);
    });
    grilla.push(g); estilos.push(e); colores.push(co);
  });
  return { cabecera: [fila1, fila2], izq: izq, grilla: grilla, estilos: estilos, colores: colores, nCols: cols.length };
}

/* ------------------------------------------------------------------ */
/* Escritura en la planilla                                            */
/* ------------------------------------------------------------------ */

function crearHojaFinanzas_(ss, modelo) {
  var sh = ss.insertSheet(FZ.HOJA, 0);
  var mz = matricesDesdeModelo(modelo);
  var totalCols = FZ.COL_MES0 - 1 + mz.nCols;
  var totalFilas = 2 + mz.izq.length;
  if (sh.getMaxColumns() < totalCols) sh.insertColumnsAfter(sh.getMaxColumns(), totalCols - sh.getMaxColumns());
  if (sh.getMaxRows() < totalFilas + 20) sh.insertRowsAfter(sh.getMaxRows(), totalFilas + 20 - sh.getMaxRows());
  sh.getRange(1, 1, 2, totalCols).setValues(mz.cabecera);
  sh.getRange(3, 1, mz.izq.length, FZ.COL_PROY).setValues(mz.izq);
  var g = sh.getRange(3, FZ.COL_MES0, mz.grilla.length, mz.nCols);
  g.setValues(mz.grilla);
  g.setFontStyles(mz.estilos);
  g.setFontColors(mz.colores);
  // Quitar columnas sobrantes a la derecha
  if (sh.getMaxColumns() > totalCols) sh.deleteColumns(totalCols + 1, sh.getMaxColumns() - totalCols);
  return sh;
}

/** Instalación completa. Devuelve un resumen para mostrar. */
function instalarSistema_(usarLegado) {
  var ss = ss_();
  var hoy = new Date();
  ss.setSpreadsheetTimeZone('America/Argentina/Buenos_Aires');
  try { ss.setSpreadsheetLocale('es_AR'); } catch (e) { /* opcional */ }
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());

  crearHojaConfig_(ss);
  crearHojaIndices_(ss);
  try { actualizarFeriados_(hoy.getFullYear()); actualizarFeriados_(hoy.getFullYear() + 1); } catch (e) { console.warn(e); }

  var vieja = ss.getSheetByName(FZ.HOJA), modelo, avisos = [], origen = 'plantilla';
  if (vieja && usarLegado) {
    var rng = vieja.getDataRange();
    var leg = parsearLegado(rng.getValues(), rng.getFormulas());
    modelo = modeloDesdeLegado(leg, hoy, {});
    avisos = leg.avisos;
    origen = 'importado';
  } else {
    modelo = modeloPlantilla(hoy);
  }
  if (vieja) {
    var nombreViejo = FZ.HOJA + ' (original)';
    var n = 2;
    while (ss.getSheetByName(nombreViejo)) nombreViejo = FZ.HOJA + ' (original ' + n++ + ')';
    vieja.setName(nombreViejo);
  }
  crearHojaMovimientos_(ss, modelo.movimientos);
  var sh = crearHojaFinanzas_(ss, modelo);
  CFG_CACHE_ = null;
  asegurarLineaDeTiempo(sh);
  var est = leerEstructura(sh);
  reconstruirFormulas(sh, est);
  aplicarFormato(sh, est);
  reproyectar(sh, est);
  actualizarProximos(sh, est);
  actualizarValidacionMovimientos_(est);
  ss.setActiveSheet(sh);
  enfocarMesActual(sh, est);
  PropertiesService.getDocumentProperties().setProperty('ultimoMes', isoMes_(hoy));
  PropertiesService.getDocumentProperties().setProperty('version', FZ.VERSION);
  return {
    origen: origen,
    items: est.items.filter(function (i) { return !i.mov; }).length,
    movimientos: modelo.movimientos.length,
    meses: est.meses.length,
    avisos: avisos
  };
}
