/**
 * Finanzas · Lectura de planillas anteriores (Excel original y versión 2)
 *
 * Qué se importa del Excel original:
 *  - Los meses (fila 1 con ENERO..DICIEMBRE + el año en la columna de total).
 *  - Secciones (MAYÚSCULAS), categorías (títulos sin valores) e ítems.
 *  - Las cuentas escritas a mano (=10615+178223) se conservan como fórmula.
 *    Las fórmulas que apuntan a otras celdas se importan con su valor.
 *  - Las fórmulas de vencimiento de la columna A se traducen a reglas ("1er hábil", "10"...).
 *  - "DA" → medio de pago "Débito automático".
 *  - Los EVENTUALES pasan a ser filas de la categoría Eventuales (una por gasto).
 */

var MES_IDX_ = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

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
function modeloDesdeLegado(leg, hoy) {
  var mesHoy = isoMes_(hoy);
  var grupos = { I: [], G: [], P: [], A: [] }, ordenCat = [], porCat = {}, movimientos = [];
  leg.items.forEach(function (it, items_i) {
    var s = norm_(it.sec);
    if (/eventual/.test(s)) {
      Object.keys(it.celdas).sort().forEach(function (iso) {
        var c = it.celdas[iso];
        var monto = c.f || c.v;
        if (!monto) return;
        movimientos.push({ fecha: desdeIsoMes_(iso), desc: it.nombre, monto: monto, cuotas: 1, medio: '', mes: desdeIsoMes_(iso), grupo: 'L' + items_i });
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
    { tipo: 'SEC', nombre: 'Ingresos', clase: 'I' }, it('Salario', 'anteúltimo hábil', 'Transferencia'), it('Aguinaldo'), it('Bonos'), it('Otros'),
    { tipo: 'SEC', nombre: 'Gastos fijos', clase: 'G' },
    { tipo: 'CAT', nombre: 'Vivienda' }, it('Alquiler', '10', 'Transferencia'), it('Expensas', '15 hábil'),
    { tipo: 'CAT', nombre: 'Servicios' }, it('Luz', '1er hábil', 'Débito automático'), it('Gas', '1er hábil', 'Débito automático'), it('Internet', '10', 'Débito automático'), it('Celular', '1er hábil', 'Débito automático'),
    { tipo: 'CAT', nombre: 'Suscripciones' }, it('Streaming', '5', 'Tarjeta VISA'),
    { tipo: 'CAT', nombre: 'Transporte' }, it('SUBE'), it('Nafta'),
    { tipo: 'CAT', nombre: 'Supermercado' }, it('Supermercado del mes', '1er hábil'),
    { tipo: 'SEC', nombre: 'Ahorro e inversión', clase: 'A' }, it('Ahorro del mes'),
    { tipo: 'SEC', nombre: 'Eventuales', clase: 'G', mov: true }
  ];
  return { meses: meses, filas: filas, movimientos: [] };
}

/* ------------------------------------------------------------------ */
/* Versión 2 (planilla con grilla y códigos en la columna A)            */
/* ------------------------------------------------------------------ */

/** ¿La hoja es la grilla de la versión 2? */
function esGrillaV2_(sh) {
  return !!sh && sh.getLastRow() >= 3 && String(sh.getRange(3, 1).getValue()) === 'RES:I';
}

/**
 * Lee la grilla v2 al mismo formato que modeloDesdeLegado: {filas, movimientos}.
 * Parte pura: recibe matrices (cabecera, izquierda, valores, fórmulas, estilos) de la hoja.
 */
function modeloDesdeV2(cab, izq, vals, forms, estilos, movsV2) {
  var cols = [];
  for (var c = 6; c < cab[1].length; c++) if (cab[1][c] instanceof Date) cols.push({ c: c, iso: isoMes_(cab[1][c]) });
  var filas = [], esMov = false;
  for (var r = 2; r < izq.length; r++) {
    var tipo = String(izq[r][0]).trim(), nombre = String(izq[r][1]).trim();
    if (tipo.indexOf('RES:') === 0) continue;
    if (tipo.indexOf('SEC:') === 0) {
      var p = tipo.split(':');
      esMov = p[2] === 'MOV';
      filas.push({ tipo: 'SEC', nombre: titulo_(nombre), clase: p[1] || 'G', mov: esMov });
      continue;
    }
    if (tipo === 'CAT') { filas.push({ tipo: 'CAT', nombre: nombre }); continue; }
    if (!nombre) continue;
    var celdas = {};
    if (!esMov) {
      cols.forEach(function (col) {
        var f = forms[r][col.c], v = vals[r][col.c];
        if (f && esFormulaAritmetica(f)) celdas[col.iso] = { f: f, v: typeof v === 'number' ? v : (parsearMonto(f) || {}).valor, proy: estilos[r][col.c] === 'italic' };
        else if (typeof v === 'number') celdas[col.iso] = { v: v, f: '', proy: estilos[r][col.c] === 'italic' };
      });
    }
    filas.push({ tipo: 'ITEM', nombre: nombre, vence: String(izq[r][2] || ''), medio: String(izq[r][4] || ''), proy: String(izq[r][5] || '') || modoProyeccionSugerido(nombre), celdas: celdas });
  }
  var movimientos = (movsV2 || []).filter(function (m) { return String(m[1] || '').trim(); }).map(function (m) {
    var fecha = m[0] instanceof Date ? m[0] : null;
    var mes = m[7] instanceof Date ? m[7] : (m[6] instanceof Date ? m[6] : fecha);
    return { fecha: fecha || mes || new Date(), desc: String(m[1]), monto: m[3], cuotas: Number(m[4]) || 1, medio: String(m[5] || ''), mes: mes || fecha, nota: String(m[10] || '') };
  });
  return { filas: filas, movimientos: movimientos };
}

function leerV2_(ss) {
  var sh = ss.getSheetByName('Finanzas');
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  var rng = sh.getRange(1, 1, lr, lc);
  var shm = ss.getSheetByName('Movimientos');
  var movs = [];
  if (shm && String(shm.getRange(1, 1).getValue()) === 'Fecha' && shm.getLastRow() > 1) {
    var rm = shm.getRange(2, 1, shm.getLastRow() - 1, 11);
    var mv = rm.getValues(), mf = rm.getFormulas();
    movs = mv.map(function (r, i) { if (mf[i][3] && esFormulaAritmetica(mf[i][3])) r[3] = mf[i][3]; return r; });
  }
  var vals = rng.getValues();
  return modeloDesdeV2(vals.slice(0, 2), vals.map(function (r) { return r.slice(0, 6); }), vals, rng.getFormulas(), rng.getFontStyles(), movs);
}

/** Qué hay para importar en la planilla. */
function detectarFuente_(ss) {
  var v2 = ss.getSheetByName('Finanzas');
  if (esGrillaV2_(v2)) return { tipo: 'v2', hoja: 'Finanzas', descripcion: 'la planilla Finanzas que instalaste (con tus cambios)' };
  var candidatas = ['Finanzas (original)', 'Finanzas'];
  for (var i = 0; i < candidatas.length; i++) {
    var sh = ss.getSheetByName(candidatas[i]);
    if (sh && sh.getLastColumn() > 3) {
      var f1 = sh.getRange(1, 1, 1, Math.min(sh.getLastColumn(), 20)).getValues()[0].map(norm_);
      if (f1.indexOf('enero') >= 0) return { tipo: 'legado', hoja: candidatas[i], descripcion: 'tu Excel original (hoja "' + candidatas[i] + '")' };
    }
  }
  return { tipo: 'plantilla', descripcion: 'una planilla nueva con conceptos de ejemplo' };
}

/**
 * Convierte filas (SEC/CAT/ITEM) y gastos eventuales al formato de las tablas. Parte pura.
 * Las secciones y subcategorías de antes se reparten en las categorías de un solo nivel;
 * cada gasto eventual es una fila de Eventuales y las cuotas se reparten en meses consecutivos.
 * @return {{conceptos:Array, valores:Array, categorias:Array}}
 */
function filasAdb_(filas, movimientos) {
  var m = { conceptos: [], valores: {}, categorias: categoriasBase_() };
  var sec = null, cat = null, orden = 0;
  filas.forEach(function (f) {
    if (f.tipo === 'SEC') { sec = { nombre: f.nombre, clase: f.clase, tipo: f.mov ? 'eventual' : 'fijo' }; cat = null; return; }
    if (f.tipo === 'CAT') { cat = f.nombre; return; }
    // En las versiones anteriores, las filas de Eventuales eran categorías (sin montos propios)
    if (f.tipo !== 'ITEM' || !sec || sec.tipo === 'eventual') return;
    var k = asegurarCategoria_(m, mapearCategoria_({ seccion: sec.nombre, categoria: cat || '', nombre: f.nombre, clase: sec.clase, tipo: 'fijo' }), { clase: sec.clase });
    var id = nuevoId_();
    orden += 10;
    m.conceptos.push(normConcepto_({ id: id, nombre: f.nombre, categoria: k.nombre, vence: String(f.vence || ''), medio: f.medio || '', proyeccion: f.proy || 'Repetir', orden: orden }, m.categorias));
    var porMes = m.valores[id] = {};
    Object.keys(f.celdas || {}).sort().forEach(function (iso) {
      var c = f.celdas[iso];
      var cuenta = c.f ? String(c.f).replace(/^=\+?\s*/, '') : '';
      var monto = cuenta ? (parsearMonto(cuenta) || { valor: Number(c.v) || 0 }).valor : Number(c.v) || 0;
      porMes[iso] = { monto: monto, cuenta: cuenta, estado: c.proy ? 'estimado' : 'confirmado' };
    });
  });
  (movimientos || []).forEach(function (mv) {
    var cuenta = typeof mv.monto === 'string' && mv.monto.charAt(0) === '=' ? mv.monto.slice(1) : '';
    var monto = cuenta ? (parsearMonto(cuenta) || { valor: 0 }).valor : Number(mv.monto) || 0;
    if (!monto) return;
    agregarEventual_(m, {
      nombre: mv.desc, medio: mv.medio || '', mes: mv.mes instanceof Date ? isoMes_(mv.mes) : String(mv.mes || '').slice(0, 7),
      monto: monto, cuenta: cuenta, cuotas: mv.cuotas, grupo: mv.grupo
    });
  });
  completarIngresos_(m);
  marcarCalendario_(m.conceptos);
  renumerar_(m);
  return { conceptos: m.conceptos, valores: aplanarValores_(m.valores, m.conceptos), categorias: m.categorias };
}

/** Agrega una fila de gasto eventual al modelo, repartiendo cuotas. */
function agregarEventual_(m, p) {
  var cat = categoriaEventual_(m);
  m._grupos = m._grupos || {};
  // Varios meses de una misma fila del Excel original siguen siendo una sola fila
  var c = p.grupo && m._grupos[p.grupo];
  if (!c) {
    c = normConcepto_({ id: nuevoId_(), nombre: String(p.nombre || 'Gasto'), categoria: cat.nombre, medio: p.medio || '', orden: 1e8 + m.conceptos.length }, m.categorias);
    m.conceptos.push(c);
    if (p.grupo) m._grupos[p.grupo] = c;
  }
  var n = Math.max(1, Math.min(60, Number(p.cuotas) || 1));
  var porMes = m.valores[c.id] = m.valores[c.id] || {};
  if (!/^\d{4}-\d{2}$/.test(String(p.mes))) return c;
  for (var k = 0; k < n; k++) {
    var mes = sumarMes_(p.mes, k);
    var prev = porMes[mes];
    porMes[mes] = { monto: Math.round(p.monto / n * 100) / 100 + (prev ? prev.monto : 0), cuenta: n === 1 && !prev ? (p.cuenta || '') : '', estado: 'confirmado' };
  }
  return c;
}
