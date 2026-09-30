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
    proyecciones: FZ.PROY,
    colores: COLORES_CAT,
    venc: vencimientos_(m, hoy),
    inflEsperada: Math.round(inflacionEsperada_(indices) * 1000) / 10,
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
  return { conceptos: m.conceptos, categorias: m.categorias, venc: vencimientos_(m, new Date()), valores: valoresDe_(m, ids || []) };
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
    idsConFormula_(m).forEach(function (id) { if (tocados.indexOf(id) < 0) tocados.push(id); });
    return { valores: valoresDe_(m, tocados) };
  });
}

/**
 * Crea un concepto o cambia algunos de sus campos (nombre, categoria, vence, medio, proyeccion).
 * Para crear: {nombre, categoria}. Para cambiar: {id, ...campos}.
 */
function api_guardarConcepto(c) {
  return conLock_(function () {
    var m = cargarModelo_();
    var existente = c.id ? m.conceptos.filter(function (x) { return x.id === c.id; })[0] : null;
    if (c.id && !existente) throw new Error('Ese concepto ya no existe. Recargá la página.');
    var base = existente || { id: nuevoId_(), categoria: c.categoria, orden: 1e9 };
    var datos = {};
    ['id', 'nombre', 'categoria', 'vence', 'medio', 'proyeccion', 'formula', 'orden'].forEach(function (k) { datos[k] = c.hasOwnProperty(k) && k !== 'id' && k !== 'orden' ? c[k] : base[k]; });
    datos.nombre = String(datos.nombre || '').trim();
    if (!datos.nombre) throw new Error('El concepto necesita un nombre.');
    var cat = buscarCategoria_(m.categorias, datos.categoria);
    if (!cat) throw new Error('No existe la categoría "' + datos.categoria + '".');
    if (existente && cat.tipo !== existente.tipo) throw new Error('Los gastos eventuales solo van en ' + (existente.tipo === 'eventual' ? existente.categoria : 'la categoría de eventuales') + '.');
    if (existente && cat.nombre !== existente.categoria) datos.orden = 1e9;
    var regla = parsearRegla(datos.vence);
    if (regla && regla.error) throw new Error(regla.error);
    if (datos.formula) {
      var f = parsearFormula_(datos.formula);
      if (!f) throw new Error('No entendí la fórmula "' + datos.formula + '". Ejemplo: Ingresos*20%');
      var ref = f.base === 'I' ? null : m.conceptos.filter(function (x) { return x.id === f.base; })[0];
      if (f.base !== 'I' && (!ref || ref.id === base.id || ref.formula)) throw new Error('Elegí otro concepto como base del porcentaje.');
      if (f.base === 'I' && cat.clase === 'I') throw new Error('Un ingreso no puede calcularse como porcentaje del total de ingresos.');
    }
    var nuevo = normConcepto_(datos, m.categorias);
    if (existente) m.conceptos[m.conceptos.indexOf(existente)] = nuevo; else m.conceptos.push(nuevo);
    guardarConceptos_(m);
    var recalcular = !existente || c.hasOwnProperty('proyeccion') || c.hasOwnProperty('formula');
    if (recalcular) {
      // Sin fórmula: los meses que calculaba vuelven a proyectarse como siempre
      if (existente && existente.formula && !nuevo.formula) {
        var pm = m.valores[nuevo.id] || {};
        Object.keys(pm).forEach(function (mes) { if (pm[mes].estado === 'estimado') delete pm[mes]; });
      }
      // Fórmula nueva o distinta: gobierna los meses futuros (el actual y los pasados quedan como están)
      if (nuevo.formula && (!existente || existente.formula !== nuevo.formula)) {
        var pmf = m.valores[nuevo.id] || {}, mesHoy = isoMes_(new Date());
        Object.keys(pmf).forEach(function (mes) { if (mes > mesHoy) delete pmf[mes]; });
      }
      reproyectar_(m, [nuevo.id]); guardarValores_(m);
    }
    var r = estructura_(m, [nuevo.id]);
    r.id = nuevo.id;
    return r;
  });
}

/**
 * Previsualiza una regla de vencimiento mientras se escribe en el panel.
 * @return {{error:string}|{descripcion:string, fechas:Array<string>}} fechas de los próximos 4 meses (desde el mes indicado)
 */
function api_probarVence(texto, mesDesde) {
  var r = parsearRegla(texto);
  if (!r) return { descripcion: '', fechas: [] };
  if (r.error) return { error: r.error };
  var fer = leerFeriados();
  var ini = /^\d{4}-\d{2}$/.test(String(mesDesde)) ? desdeIsoMes_(mesDesde) : new Date();
  var fechas = [];
  for (var k = 0; k < 4; k++) {
    var d = new Date(ini.getFullYear(), ini.getMonth() + k, 1);
    var f = fechaRegla(r, d.getFullYear(), d.getMonth(), fer);
    if (f) fechas.push(isoDia_(f));
  }
  return { descripcion: describirRegla(r), fechas: fechas };
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
    var grupo = m.conceptos.filter(function (x) { return x.categoria === c.categoria; });
    var i = grupo.indexOf(c), j = i + dir;
    if (j >= 0 && j < grupo.length) { var o = grupo[j].orden; grupo[j].orden = c.orden; c.orden = o; }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

/** Mueve un concepto a otra categoría (del mismo tipo: fijo o eventual). */
function api_moverConceptoA(id, categoria) {
  return api_guardarConcepto({ id: id, categoria: categoria });
}

/** Crea, renombra o cambia el color o la clase (I/G/A) de una categoría. {nombre, anterior?, color?, clase?} */
function api_guardarCategoria(p) {
  return conLock_(function () {
    var m = cargarModelo_();
    var nombre = String(p.nombre || '').trim();
    if (!nombre) throw new Error('La categoría necesita un nombre.');
    var cat = p.anterior ? buscarCategoria_(m.categorias, p.anterior) : null;
    var choca = buscarCategoria_(m.categorias, nombre);
    if (choca && choca !== cat) throw new Error('Ya existe la categoría "' + choca.nombre + '".');
    if (cat) {
      m.conceptos.forEach(function (x) { if (x.categoria === cat.nombre) x.categoria = nombre; });
      cat.nombre = nombre;
    } else {
      cat = asegurarCategoria_(m, nombre, { clase: p.clase || 'G', tipo: 'fijo' });
    }
    if (p.color) cat.color = String(p.color);
    if (/^[IGA]$/.test(String(p.clase || ''))) {
      cat.clase = String(p.clase);
      m.conceptos.forEach(function (x) { if (x.categoria === cat.nombre) x.clase = cat.clase; });
    }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

function api_borrarCategoria(nombre) {
  return conLock_(function () {
    var m = cargarModelo_();
    var n = m.conceptos.filter(function (x) { return x.categoria === nombre; }).length;
    if (n) throw new Error('"' + nombre + '" tiene ' + n + ' fila(s). Borralas o movelas a otra categoría primero.');
    m.categorias = m.categorias.filter(function (c) { return c.nombre !== nombre; });
    guardarConceptos_(m);
    return estructura_(m);
  });
}

function api_moverCategoria(nombre, dir) {
  return conLock_(function () {
    var m = cargarModelo_();
    renumerar_(m);
    var i = m.categorias.map(function (c) { return c.nombre; }).indexOf(nombre), j = i + dir;
    // Solo dentro de su grupo (ingresos, gastos o ahorro)
    if (i >= 0 && j >= 0 && j < m.categorias.length && m.categorias[j].clase === m.categorias[i].clase) { var o = m.categorias[j].orden; m.categorias[j].orden = m.categorias[i].orden; m.categorias[i].orden = o; }
    guardarConceptos_(m);
    return estructura_(m);
  });
}

/**
 * Crea una fila de gasto eventual con su monto (y cuotas) en un paso. Lo usa la carga rápida.
 * {nombre, medio, mes:'YYYY-MM', texto, cuotas}
 */
function api_crearEventual(p) {
  return conLock_(function () {
    var m = cargarModelo_();
    var monto = parsearMonto(p.texto);
    if (!monto) throw new Error('No entendí el monto "' + p.texto + '"');
    var cat = categoriaEventual_(m);
    var c = normConcepto_({ id: nuevoId_(), nombre: String(p.nombre || '').trim() || 'Gasto', categoria: cat.nombre, medio: p.medio || '', orden: 1e9 }, m.categorias);
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
    return { feriados: filas, venc: vencimientos_(cargarModelo_(), new Date()) };
  });
}

function api_actualizarIndices() {
  var r = actualizarIndices();
  return { resultado: r, indices: leerTabla(FZ.T.IND) };
}

function api_sincronizarCalendario() {
  return sincronizarCalendario();
}
