/**
 * Finanzas · API que usa la app web (google.script.run)
 * Todo lo que viaja al navegador son textos y números (sin objetos Date).
 */

function api_estado() {
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  return {
    instalado: dbInstalada_(),
    fuente: detectarFuente_(ss),
    hojas: ss.getSheets().map(function (s) { return s.getName(); }),
    urlPlanilla: ss.getUrl(),
    version: FZ.VERSION
  };
}

/** Todo lo necesario para dibujar la app. */
function api_datos() {
  actualizarEsquema_();
  var m = cargarModelo_();
  var hoy = new Date();
  var cfgRaw = {};
  CFG_DEF.forEach(function (d) { cfgRaw[d.k] = d.def; });
  leerTabla(FZ.T.CFG).forEach(function (r) { if (cfgRaw.hasOwnProperty(r.clave)) cfgRaw[r.clave] = String(r.valor); });
  var indices = leerTabla(FZ.T.IND);
  return {
    hoy: isoDia_(hoy),
    conceptos: m.conceptos,
    categorias: m.categorias,
    valores: aplanarValores_(m.valores, m.conceptos).map(function (v) { return [v.concepto, v.mes, v.monto, v.cuenta, v.estado === 'estimado' ? 1 : 0]; }),
    indices: indices,
    feriados: leerTabla(FZ.T.FER),
    config: cfgRaw,
    cfgDef: CFG_DEF,
    cfg: leerConfig(),
    secciones: FZ.SECCIONES,
    proyecciones: FZ.PROY,
    colores: COLORES_CAT,
    venc: vencimientos_(m.conceptos, hoy),
    inflEsperada: Math.round(inflacionEsperada_(indices) * 1000) / 10,
    palabras: PALABRAS_CATEGORIA_,
    aprendidas: aprenderCategorias_(m.conceptos.filter(function (c) { return c.tipo === 'eventual'; }).map(function (c) { return { descripcion: c.nombre, categoria: c.categoria }; })),
    urlPlanilla: ss_().getUrl()
  };
}

function valoresDe_(modelo, ids) {
  var out = {};
  ids.forEach(function (id) {
    out[id] = [];
    var porMes = modelo.valores[id] || {};
    Object.keys(porMes).sort().forEach(function (mes) {
      var v = porMes[mes];
      out[id].push([mes, v.monto, v.cuenta, v.estado === 'estimado' ? 1 : 0]);
    });
  });
  return out;
}

/** Respuesta estándar después de un cambio de estructura. */
function estructura_(m, ids) {
  return { conceptos: m.conceptos, categorias: m.categorias, venc: vencimientos_(m.conceptos, new Date()), valores: valoresDe_(m, ids || []) };
}

/**
 * Guarda celdas editadas en la grilla.
 * @param {Array<{c:string, mes:string, texto:(string|undefined), estado:(string|undefined)}>} cambios
 *   texto '' = borrar · texto undefined + estado = solo cambiar el estado (confirmar / marcar estimado)
 * @return {{valores:Object}} valores actualizados de los conceptos tocados (incluye la proyección)
 */
function api_guardarCeldas(cambios) {
  return conLock_(function () {
    var m = cargarModelo_();
    var porId = {};
    m.conceptos.forEach(function (c) { porId[c.id] = c; });
    var tocados = [];
    cambios.forEach(function (ch) {
      var c = porId[ch.c];
      if (!c) return;
      if (!/^\d{4}-\d{2}$/.test(String(ch.mes))) throw new Error('Mes inválido: ' + ch.mes);
      var porMes = m.valores[c.id] = m.valores[c.id] || {};
      if (ch.texto === undefined || ch.texto === null) {
        if (porMes[ch.mes] && ch.estado) porMes[ch.mes].estado = ch.estado === 'estimado' ? 'estimado' : 'confirmado';
      } else if (String(ch.texto).trim() === '') {
        delete porMes[ch.mes];
      } else {
        var monto = parsearMonto(ch.texto);
        if (!monto) throw new Error('No entendí "' + ch.texto + '" (' + c.nombre + ', ' + etiquetaMes_(ch.mes) + ')');
        porMes[ch.mes] = { monto: monto.valor, cuenta: monto.formula ? monto.formula.replace(/^=/, '') : '', estado: ch.estado === 'estimado' ? 'estimado' : 'confirmado' };
      }
      if (tocados.indexOf(c.id) < 0) tocados.push(c.id);
    });
    reproyectar_(m, tocados);
    guardarValores_(m);
    return { valores: valoresDe_(m, tocados) };
  });
}

/**
 * Crea un concepto o cambia algunos de sus campos (nombre, categoria, vence, medio, proyeccion).
 * Para crear: {nombre, seccion, categoria}. Para cambiar: {id, ...campos}.
 */
function api_guardarConcepto(c) {
  return conLock_(function () {
    var m = cargarModelo_();
    var existente = c.id ? m.conceptos.filter(function (x) { return x.id === c.id; })[0] : null;
    if (c.id && !existente) throw new Error('Ese concepto ya no existe. Recargá la página.');
    var base = existente || { id: nuevoId_(), seccion: c.seccion, categoria: c.categoria, orden: 1e9 };
    var datos = {};
    ['id', 'nombre', 'seccion', 'categoria', 'vence', 'medio', 'proyeccion', 'orden'].forEach(function (k) { datos[k] = c.hasOwnProperty(k) && k !== 'id' && k !== 'orden' ? c[k] : base[k]; });
    datos.nombre = String(datos.nombre || '').trim();
    if (!datos.nombre) throw new Error('El concepto necesita un nombre.');
    var sec = seccionPorNombre_(datos.seccion);
    if (!sec) throw new Error('Sección desconocida: ' + datos.seccion);
    datos.categoria = String(datos.categoria || '').trim() || sec.nombre;
    var regla = parsearRegla(datos.vence);
    if (regla && regla.error) throw new Error(regla.error);
    asegurarCategoria_(m, sec.nombre, datos.categoria);
    var nuevo = normConcepto_(datos);
    if (existente) m.conceptos[m.conceptos.indexOf(existente)] = nuevo; else m.conceptos.push(nuevo);
    guardarConceptos_(m);
    if (!existente || c.hasOwnProperty('proyeccion')) { reproyectar_(m, [nuevo.id]); guardarValores_(m); }
    var r = estructura_(m, [nuevo.id]);
    r.id = nuevo.id;
    return r;
  });
}

function api_borrarConcepto(id) {
  return conLock_(function () {
    var m = cargarModelo_();
    m.conceptos = m.conceptos.filter(function (x) { return x.id !== id; });
    delete m.valores[id];
    guardarConceptos_(m);
    guardarValores_(m);
    return estructura_(m);
  });
}

/** Sube (-1) o baja (+1) un concepto dentro de su categoría. */
function api_moverConcepto(id, dir) {
  return conLock_(function () {
    var m = cargarModelo_();
    renumerar_(m);
    var c = m.conceptos.filter(function (x) { return x.id === id; })[0];
    if (!c) return estructura_(m);
    var grupo = m.conceptos.filter(function (x) { return x.seccion === c.seccion && x.categoria === c.categoria; });
    var i = grupo.indexOf(c), j = i + dir;
    if (j >= 0 && j < grupo.length) { var o = grupo[j].orden; grupo[j].orden = c.orden; c.orden = o; }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

/** Mueve un concepto a otra categoría (dentro de secciones del mismo tipo). */
function api_moverConceptoA(id, seccion, categoria) {
  return conLock_(function () {
    var m = cargarModelo_();
    var c = m.conceptos.filter(function (x) { return x.id === id; })[0];
    var sec = seccionPorNombre_(seccion);
    if (!c || !sec) throw new Error('No encontré el concepto o la sección.');
    if (sec.tipo !== c.tipo) throw new Error('Los gastos eventuales solo se mueven entre categorías de Eventuales.');
    asegurarCategoria_(m, sec.nombre, categoria);
    var nuevo = normConcepto_(Object.assign({}, c, { seccion: sec.nombre, categoria: categoria || sec.nombre, orden: 1e9 }));
    m.conceptos[m.conceptos.indexOf(c)] = nuevo;
    guardarConceptos_(m);
    return estructura_(m);
  });
}

/** Crea, renombra o cambia el color de una categoría. {seccion, nombre, anterior?, color?} */
function api_guardarCategoria(p) {
  return conLock_(function () {
    var m = cargarModelo_();
    var sec = seccionPorNombre_(p.seccion);
    var nombre = String(p.nombre || '').trim();
    if (!sec || !nombre) throw new Error('La categoría necesita un nombre.');
    if (norm_(nombre) === norm_(sec.nombre)) throw new Error('Elegí un nombre distinto al de la sección.');
    var cat = p.anterior ? m.categorias.filter(function (c) { return c.seccion === sec.nombre && c.nombre === p.anterior; })[0] : null;
    var choca = m.categorias.filter(function (c) { return c.seccion === sec.nombre && norm_(c.nombre) === norm_(nombre) && c !== cat; })[0];
    if (choca) throw new Error('Ya existe la categoría "' + choca.nombre + '".');
    if (cat) {
      m.conceptos.forEach(function (x) { if (x.seccion === sec.nombre && x.categoria === cat.nombre) x.categoria = nombre; });
      cat.nombre = nombre;
      if (p.color) cat.color = p.color;
    } else {
      cat = asegurarCategoria_(m, sec.nombre, nombre);
      if (p.color) cat.color = p.color;
    }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

function api_borrarCategoria(seccion, nombre) {
  return conLock_(function () {
    var m = cargarModelo_();
    var n = m.conceptos.filter(function (x) { return x.seccion === seccion && x.categoria === nombre; }).length;
    if (n) throw new Error('"' + nombre + '" tiene ' + n + ' fila(s). Borralas o movelas a otra categoría primero.');
    m.categorias = m.categorias.filter(function (c) { return !(c.seccion === seccion && c.nombre === nombre); });
    guardarConceptos_(m);
    return estructura_(m);
  });
}

function api_moverCategoria(seccion, nombre, dir) {
  return conLock_(function () {
    var m = cargarModelo_();
    renumerar_(m);
    var grupo = m.categorias.filter(function (c) { return c.seccion === seccion; });
    var i = grupo.map(function (c) { return c.nombre; }).indexOf(nombre), j = i + dir;
    if (i >= 0 && j >= 0 && j < grupo.length) { var o = grupo[j].orden; grupo[j].orden = grupo[i].orden; grupo[i].orden = o; }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

/**
 * Crea una fila de gasto eventual con su monto (y cuotas) en un paso. Lo usa la carga rápida.
 * {nombre, categoria, medio, mes:'YYYY-MM', texto, cuotas}
 */
function api_crearEventual(p) {
  return conLock_(function () {
    var m = cargarModelo_();
    var monto = parsearMonto(p.texto);
    if (!monto) throw new Error('No entendí el monto "' + p.texto + '"');
    var sec = FZ.SECCIONES.filter(function (s) { return s.tipo === 'eventual'; })[0];
    var categoria = String(p.categoria || '').trim() || 'Otros';
    asegurarCategoria_(m, sec.nombre, categoria);
    var c = normConcepto_({ id: nuevoId_(), nombre: String(p.nombre || '').trim() || 'Gasto', seccion: sec.nombre, categoria: categoria, medio: p.medio || '', orden: 1e9 });
    m.conceptos.push(c);
    var n = Math.max(1, Math.min(60, Number(p.cuotas) || 1));
    var mes = /^\d{4}-\d{2}$/.test(String(p.mes)) ? p.mes : isoMes_(new Date());
    var porMes = m.valores[c.id] = {};
    for (var k = 0; k < n; k++) {
      porMes[sumarMes_(mes, k)] = { monto: Math.round(monto.valor / n * 100) / 100, cuenta: n === 1 && monto.formula ? monto.formula.replace(/^=/, '') : '', estado: 'confirmado' };
    }
    guardarConceptos_(m);
    guardarValores_(m);
    var r = estructura_(m, [c.id]);
    r.id = c.id;
    return r;
  });
}

function api_guardarConfig(valores) {
  conLock_(function () {
    var filas = CFG_DEF.map(function (d) {
      return { clave: d.k, valor: valores.hasOwnProperty(d.k) ? String(valores[d.k]) : d.def, descripcion: d.ayuda };
    });
    escribirTabla(FZ.T.CFG, filas);
    CFG_CACHE_ = null;
    var m = cargarModelo_();
    reproyectar_(m, null);
    guardarValores_(m);
  });
  return api_datos();
}

function api_guardarFeriados(lista) {
  return conLock_(function () {
    var filas = (lista || []).filter(function (f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha)); })
      .map(function (f) { return { fecha: f.fecha, nombre: f.nombre || 'Feriado', origen: f.origen || 'manual' }; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    escribirTabla(FZ.T.FER, filas);
    FERIADOS_CACHE_ = null;
    return { feriados: filas, venc: vencimientos_(cargarModelo_().conceptos, new Date()) };
  });
}

function api_actualizarIndices() {
  var r = actualizarIndices();
  return { resultado: r, indices: leerTabla(FZ.T.IND) };
}

function api_sincronizarCalendario() {
  return sincronizarCalendario();
}
