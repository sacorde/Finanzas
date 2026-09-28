/**
 * FINANZAS · sistema de administración de finanzas personales para Google Sheets.
 * Archivo generado con `npm run bundle` a partir de apps-script/*.js — no editar a mano.
 */

/* ===== Config.js ===== */

/**
 * Finanzas · Configuración general
 * Constantes de layout, paleta y lectura de la hoja "Config".
 */

var FZ = {
  VERSION: '2.0.0',
  HOJA: 'Finanzas',
  HOJA_MOV: 'Movimientos',
  HOJA_IND: 'Índices',
  HOJA_CFG: 'Config',

  // Layout de la hoja Finanzas
  FILA_ANIO: 1,
  FILA_MES: 2,
  FILAS_CONGELADAS: 6,
  COL_TIPO: 1,     // A (oculta): códigos de estructura
  COL_NOMBRE: 2,   // B: concepto
  COL_VENCE: 3,    // C: regla de vencimiento ("15", "1er hábil", ...)
  COL_PROX: 4,     // D: próximo vencimiento (automático)
  COL_MEDIO: 5,    // E: medio de pago
  COL_PROY: 6,     // F: modo de proyección
  COL_MES0: 7,     // G: primer mes

  // Códigos de la columna A
  RES: 'RES:',     // RES:I, RES:G, RES:A, RES:L (filas resumen)
  SEC: 'SEC:',     // SEC:I, SEC:G, SEC:A, SEC:G:MOV (secciones)
  CAT: 'CAT',      // encabezado de categoría (subtotal)

  PROY: ['Repetir', 'Promedio 3 meses', 'Ajustar por inflación', 'No proyectar'],

  // Movimientos (columnas)
  MOV: { FECHA: 1, DESC: 2, CAT: 3, MONTO: 4, CUOTAS: 5, MEDIO: 6, MES: 7, DESDE: 8, HASTA: 9, POR_MES: 10, NOTA: 11 },

  // Paleta (tokens)
  C: {
    tinta: '#0F172A', tinta2: '#475569', tenue: '#94A3B8', linea: '#E8ECF2',
    fondo: '#FFFFFF', fondo2: '#F8FAFC', fondoTotal: '#F1F5F9',
    cabecera: '#0F172A', cabeceraTxt: '#FFFFFF', cabecera2: '#1E293B',
    acento: '#4F46E5', acentoSuave: '#EEF2FF',
    estimado: '#94A3B8',
    ingreso: '#047857', ingresoSuave: '#ECFDF5',
    gasto: '#334155', gastoSuave: '#F1F5F9',
    eventual: '#B45309', eventualSuave: '#FFF7ED',
    ahorro: '#1D4ED8', ahorroSuave: '#EFF6FF',
    ok: '#047857', mal: '#B91C1C', malSuave: '#FEF2F2', aviso: '#92400E', avisoSuave: '#FEF3C7'
  },
  FUENTE: 'Inter',
  FORMATO_NUM: '#,##0;-#,##0;"–"',
  FORMATO_NUM_RES: '"$ "#,##0;-"$ "#,##0;"–"'
};

var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Definición de la hoja Config: etiqueta visible → clave interna. */
var CFG_DEF = [
  { k: 'horizonte', label: 'Meses a proyectar hacia adelante', def: 12, ayuda: 'Hasta cuántos meses se completan automáticamente los gastos fijos.' },
  { k: 'inflacion', label: 'Inflación mensual esperada (%)', def: '', ayuda: 'Vacío = usa la última inflación publicada (hoja Índices). Se usa para "Ajustar por inflación".' },
  { k: 'cerrarMes', label: 'Confirmar estimados al cerrar el mes', def: 'Sí', ayuda: 'Al empezar un mes nuevo, los valores estimados del mes anterior pasan a confirmados.' },
  { k: 'confirmarDA', label: 'Confirmar débitos automáticos al vencer', def: 'Sí', ayuda: 'El día del vencimiento, los conceptos con "Débito automático" se confirman solos.' },
  { k: 'tarjetaMesSig', label: 'Compras con tarjeta impactan el mes siguiente', def: 'Sí', ayuda: 'En Movimientos, una compra con tarjeta se imputa al mes siguiente (cuando se paga el resumen).' },
  { k: 'calendario', label: 'Calendario de vencimientos', def: 'Finanzas', ayuda: 'Nombre del Google Calendar donde se crean los vencimientos. Vacío = no sincronizar.' },
  { k: 'mesesCal', label: 'Meses a sincronizar en el calendario', def: 2, ayuda: 'Mes actual + los siguientes.' },
  { k: 'aviso', label: 'Aviso previo (días)', def: 1, ayuda: 'Notificación del calendario a las 9:00, N días antes del vencimiento.' },
  { k: 'dolar', label: 'Dólar de referencia', def: 'Blue', ayuda: 'Blue u Oficial (para ver montos en USD en el dashboard).' },
  { k: 'medios', label: 'Medios de pago', def: 'Débito automático, Tarjeta VISA, Tarjeta AMEX, Transferencia, Efectivo, Mercado Pago', ayuda: 'Separados por coma. Aparecen en los desplegables.' }
];
var CFG_FILA_FERIADOS = 16; // título de la tabla de feriados

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return SpreadsheetApp.openById(id);
}

function hoja_(nombre) {
  return ss_().getSheetByName(nombre || FZ.HOJA);
}

var CFG_CACHE_ = null;
function leerConfig() {
  if (CFG_CACHE_) return CFG_CACHE_;
  var cfg = {};
  CFG_DEF.forEach(function (d) { cfg[d.k] = d.def; });
  var sh = hoja_(FZ.HOJA_CFG);
  if (sh) {
    var vals = sh.getRange(1, 1, Math.min(sh.getLastRow() || 1, CFG_FILA_FERIADOS - 1), 2).getValues();
    var porLabel = {};
    vals.forEach(function (r) { porLabel[String(r[0]).trim()] = r[1]; });
    CFG_DEF.forEach(function (d) {
      if (porLabel.hasOwnProperty(d.label) && porLabel[d.label] !== '') cfg[d.k] = porLabel[d.label];
      else if (porLabel.hasOwnProperty(d.label) && d.k === 'inflacion') cfg[d.k] = '';
      else if (porLabel.hasOwnProperty(d.label) && d.k === 'calendario') cfg[d.k] = '';
    });
  }
  cfg.horizonte = Math.max(1, Math.min(36, Number(cfg.horizonte) || 12));
  cfg.mesesCal = Math.max(1, Math.min(6, Number(cfg.mesesCal) || 2));
  cfg.aviso = Math.max(0, Math.min(14, Number(cfg.aviso) || 0));
  ['cerrarMes', 'confirmarDA', 'tarjetaMesSig'].forEach(function (k) { cfg[k] = esSi_(cfg[k]); });
  cfg.medios = String(cfg.medios).split(',').map(function (s) { return s.trim(); }).filter(String);
  CFG_CACHE_ = cfg;
  return cfg;
}

function esSi_(v) {
  if (v === true) return true;
  var s = norm_(v);
  return s === 'si' || s === 'yes' || s === 'true' || s === '1';
}

/** Normaliza texto: minúsculas, sin acentos, espacios simples. */
function norm_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function primerDia_(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isoMes_(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

function isoDia_(d) {
  return isoMes_(d) + '-' + ('0' + d.getDate()).slice(-2);
}

function desdeIsoMes_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, 1);
}

function etiquetaMes_(d) {
  return MESES_ES[d.getMonth()].charAt(0).toUpperCase() + MESES_ES[d.getMonth()].slice(1) + ' ' + d.getFullYear();
}

function fmtPesos_(n) {
  var v = Math.round(Number(n) || 0);
  var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-$ ' : '$ ') + s;
}

/* ===== Calendario.js ===== */

/**
 * Finanzas · Sincronización con Google Calendar
 *
 * Crea un calendario propio ("Finanzas") con un evento de día completo por cada
 * vencimiento: "💸 Alquiler · $ 1.000.000". Se actualiza solo todos los días:
 * si cambia el monto o la fecha, se corrige el evento; si ya está confirmado
 * (pagado), el título pasa a "✓". Nunca toca otros calendarios.
 */

function obtenerCalendario_(nombre) {
  var cals = CalendarApp.getCalendarsByName(nombre);
  if (cals.length) return cals[0];
  var cal = CalendarApp.createCalendar(nombre, { summary: 'Vencimientos generados por la planilla Finanzas', color: CalendarApp.Color.GREEN });
  return cal;
}

/** Eventos deseados (parte pura). */
function eventosDeseados_(items, meses, valoresPorFila, estilosPorFila, fer, hoy) {
  var out = {};
  items.forEach(function (it) {
    var regla = parsearRegla(it.vence);
    if (!regla || regla.error) return;
    meses.forEach(function (m, k) {
      var v = valoresPorFila[it.fila] ? valoresPorFila[it.fila][k] : '';
      if (typeof v !== 'number' || !v) return;
      var fecha = fechaRegla(regla, m.fecha.getFullYear(), m.fecha.getMonth(), fer);
      if (!fecha) return;
      var confirmado = estilosPorFila[it.fila] && estilosPorFila[it.fila][k] !== 'italic';
      var pagado = confirmado && fecha <= hoy;
      var icono = it.clase === 'I' ? '💰' : it.clase === 'A' ? '🏦' : '💸';
      var clave = norm_(it.nombre).replace(/[^a-z0-9]+/g, '-') + '@' + m.iso;
      out[clave] = {
        fecha: fecha,
        titulo: (pagado ? '✓ ' : '') + icono + ' ' + it.nombre + ' · ' + fmtPesos_(v),
        desc: [describirRegla(regla), it.medio ? 'Medio: ' + it.medio : '', confirmado ? 'Monto confirmado' : 'Monto estimado', 'Generado por la planilla Finanzas'].filter(String).join('\n')
      };
    });
  });
  return out;
}

function sincronizarCalendario() {
  var cfg = leerConfig();
  if (!cfg.calendario) return { creados: 0, actualizados: 0, borrados: 0, omitido: true };
  var sh = hoja_();
  var est = leerEstructura(sh);
  var hoy = new Date();
  var i0 = indiceMes_(est, hoy);
  if (i0 < 0) return { creados: 0, actualizados: 0, borrados: 0 };
  var meses = est.meses.slice(i0, i0 + cfg.mesesCal);
  var items = est.items.filter(function (it) { return !it.mov && it.vence !== ''; });
  var valores = {}, estilos = {};
  if (items.length) {
    var c0 = meses[0].col, c1 = meses[meses.length - 1].col;
    var rng = sh.getRange(3, c0, est.ultimaFila - 2, c1 - c0 + 1);
    var vals = rng.getValues(), sts = rng.getFontStyles();
    items.forEach(function (it) {
      valores[it.fila] = meses.map(function (m) { return vals[it.fila - 3][m.col - c0]; });
      estilos[it.fila] = meses.map(function (m) { return sts[it.fila - 3][m.col - c0]; });
    });
  }
  var deseados = eventosDeseados_(items, meses, valores, estilos, leerFeriados(), hoy);

  var cal = obtenerCalendario_(cfg.calendario);
  var desde = new Date(meses[0].fecha.getFullYear(), meses[0].fecha.getMonth(), 1);
  var hasta = new Date(meses[meses.length - 1].fecha.getFullYear(), meses[meses.length - 1].fecha.getMonth() + 1, 1);
  var res = { creados: 0, actualizados: 0, borrados: 0 };
  cal.getEvents(desde, hasta).forEach(function (ev) {
    var clave = ev.getTag('fz');
    if (!clave) return;
    var d = deseados[clave];
    if (!d) { ev.deleteEvent(); res.borrados++; return; }
    var inicio = ev.getAllDayStartDate();
    var cambio = false;
    if (ev.getTitle() !== d.titulo) { ev.setTitle(d.titulo); cambio = true; }
    if (ev.getDescription() !== d.desc) { ev.setDescription(d.desc); cambio = true; }
    if (!inicio || claveDia_(inicio) !== claveDia_(d.fecha)) { ev.setAllDayDate(d.fecha); cambio = true; }
    if (cambio) res.actualizados++;
    delete deseados[clave];
  });
  var minutos = cfg.aviso > 0 ? cfg.aviso * 1440 - 9 * 60 : 0;
  Object.keys(deseados).forEach(function (clave) {
    var d = deseados[clave];
    var ev = cal.createAllDayEvent(d.titulo, d.fecha, { description: d.desc });
    ev.setTag('fz', clave);
    ev.removeAllReminders();
    if (minutos > 0) ev.addPopupReminder(minutos);
    res.creados++;
  });
  return res;
}

/* ===== Dashboard.js ===== */

/**
 * Finanzas · Datos para el dashboard
 * El servidor entrega todo en una sola llamada; los filtros corren en el navegador
 * (instantáneos, sin esperar al servidor).
 */

function dashboardDatos() {
  var sh = hoja_();
  var est = leerEstructura(sh);
  var hoy = new Date();
  var c0 = FZ.COL_MES0, nCol = est.ultimaCol - c0 + 1, n = est.ultimaFila - 2;
  var rng = sh.getRange(3, c0, n, nCol);
  var vals = rng.getValues(), sts = rng.getFontStyles();
  var items = est.items.map(function (it) {
    var r = it.fila - 3;
    return {
      nombre: it.nombre, seccion: it.seccion, categoria: it.categoria, clase: it.clase, mov: it.mov, medio: it.medio,
      v: est.meses.map(function (m) { var x = vals[r][m.col - c0]; return typeof x === 'number' ? Math.round(x) : null; }),
      e: est.meses.map(function (m) { return sts[r][m.col - c0] === 'italic' ? 1 : 0; })
    };
  });
  var ind = leerIndices_();
  var cfg = leerConfig();
  var proximos = panelDatos().items.filter(function (i) { return i.fecha && i.fecha >= isoDia_(hoy) && i.valor; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).slice(0, 8);
  return {
    generado: isoDia_(hoy),
    mesActual: isoMes_(hoy),
    meses: est.meses.map(function (m) { return m.iso; }),
    items: items,
    inflacion: ind.inflacion,
    oficial: ind.oficial,
    blue: ind.blue,
    inflEsperada: Math.round(inflacionEsperada_() * 1000) / 10,
    dolar: norm_(cfg.dolar) === 'oficial' ? 'oficial' : 'blue',
    proximos: proximos
  };
}

/* ===== Estructura.js ===== */

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

/* ===== Fechas.js ===== */

/**
 * Finanzas · Reglas de vencimiento y días hábiles
 *
 * Se escribe la regla en palabras, como se diría en voz alta:
 *   "15"                 → el día 15
 *   "15 hábil"           → el 15, o el siguiente día hábil si cae feriado/fin de semana
 *   "15 hábil anterior"  → el 15, o el día hábil anterior
 *   "1er hábil", "5to día hábil", "segundo hábil"
 *   "último día", "anteúltimo día"
 *   "último hábil", "anteúltimo hábil"
 *   "primer lunes", "último viernes", "2do martes"
 */

var ORDINALES_ = {
  primer: 1, primero: 1, primera: 1, segundo: 2, segunda: 2, tercer: 3, tercero: 3, tercera: 3,
  cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10
};
var DIAS_SEMANA_ = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
var DIAS_CORTO_ = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "1er", "2do", "3°", "5to", "segundo" → número; null si no es ordinal. */
function ordinal_(tok) {
  if (ORDINALES_[tok]) return ORDINALES_[tok];
  var m = /^(\d{1,2})\s*(er|ro|do|to|mo|vo|no|a|o|°|º)$/.exec(tok);
  return m ? Number(m[1]) : null;
}

/**
 * Interpreta una regla escrita en castellano.
 * @return {Object|null} regla, {error} si no se entiende, o null si está vacía.
 */
function parsearRegla(texto) {
  if (texto instanceof Date) return { tipo: 'dia', dia: texto.getDate(), ajuste: null };
  if (typeof texto === 'number') texto = String(texto);
  var t = norm_(texto);
  if (!t) return null;
  t = t.replace(/[().,]/g, ' ')
    .replace(/\b(de cada mes|del mes|de mes|cada mes|todos los|todos|cada|el|los|mes)\b/g, ' ')
    .replace(/\bdias?\b/g, ' ')
    .replace(/\bhabiles\b/g, 'habil')
    .replace(/\bpenultimo\b/g, 'anteultimo')
    .replace(/(\d)\s+(er|ro|do|to|mo|vo|no)\b/g, '$1$2')
    .replace(/\s+/g, ' ').trim();

  var m;
  // Desde el final: "último hábil", "anteúltimo hábil", "último", "fin"
  if ((m = /^(ultimo|anteultimo)( habil)?$/.exec(t)) || t === 'fin' || t === 'fin habil') {
    var n = m && m[1] === 'anteultimo' ? 2 : 1;
    var habil = m ? !!m[2] : t === 'fin habil';
    return habil ? { tipo: 'habilDesdeFin', n: n } : { tipo: 'desdeFin', n: n };
  }
  // Día de la semana: "primer lunes", "último viernes"
  if ((m = /^(\S+) (lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/.exec(t))) {
    var ord = m[1] === 'ultimo' ? -1 : ordinal_(m[1]);
    if (ord) return { tipo: 'diaSemana', n: ord, dow: DIAS_SEMANA_[m[2]] };
  }
  // N-ésimo día hábil: "1er habil", "quinto habil", "habil 3"
  if ((m = /^(\S+) habil$/.exec(t)) && ordinal_(m[1]) && !/^\d+$/.test(m[1])) {
    return { tipo: 'habilN', n: ordinal_(m[1]) };
  }
  if ((m = /^habil (\d{1,2})$/.exec(t))) return { tipo: 'habilN', n: Number(m[1]) };
  // Día fijo: "15", "15 habil", "15 habil anterior"
  if ((m = /^(\d{1,2})( habil)?( siguiente| anterior| antes)?$/.exec(t))) {
    var dia = Number(m[1]);
    if (dia < 1 || dia > 31) return { error: 'El día debe estar entre 1 y 31' };
    var ajuste = m[2] ? (m[3] && m[3] !== ' siguiente' ? 'anterior' : 'siguiente') : null;
    return { tipo: 'dia', dia: dia, ajuste: ajuste };
  }
  return { error: 'No entendí "' + texto + '". Probá: 15 · 10 hábil · 1er hábil · último hábil · anteúltimo día · primer lunes' };
}

/** Texto canónico y legible de una regla. */
function describirRegla(r) {
  if (!r || r.error) return '';
  var ord = function (n) { return n + 'º'; };
  switch (r.tipo) {
    case 'dia':
      return 'Día ' + r.dia + (r.ajuste === 'siguiente' ? ' (o hábil siguiente)' : r.ajuste === 'anterior' ? ' (o hábil anterior)' : '');
    case 'desdeFin': return r.n === 1 ? 'Último día del mes' : 'Anteúltimo día del mes';
    case 'habilDesdeFin': return r.n === 1 ? 'Último día hábil' : 'Anteúltimo día hábil';
    case 'habilN': return ord(r.n) + ' día hábil';
    case 'diaSemana':
      var nd = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][r.dow];
      return (r.n === -1 ? 'Último ' : ord(r.n) + ' ') + nd;
  }
  return '';
}

function claveDia_(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** @param {Object} feriados mapa 'YYYY-MM-DD' → nombre */
function esHabil(d, feriados) {
  var w = d.getDay();
  if (w === 0 || w === 6) return false;
  return !(feriados && feriados[claveDia_(d)]);
}

function diasDelMes_(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

/** Fecha concreta de una regla para un mes (m = 0..11). */
function fechaRegla(r, y, m, feriados) {
  if (!r || r.error) return null;
  var ult = diasDelMes_(y, m), d, cuenta, i;
  switch (r.tipo) {
    case 'dia':
      d = new Date(y, m, Math.min(r.dia, ult));
      if (r.ajuste === 'siguiente') while (!esHabil(d, feriados)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (r.ajuste === 'anterior') while (!esHabil(d, feriados)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      return d;
    case 'desdeFin':
      return new Date(y, m, ult - (r.n - 1));
    case 'habilDesdeFin':
      cuenta = 0;
      for (i = ult; i >= 1; i--) {
        d = new Date(y, m, i);
        if (esHabil(d, feriados) && ++cuenta === r.n) return d;
      }
      return null;
    case 'habilN':
      cuenta = 0;
      for (i = 1; i <= ult; i++) {
        d = new Date(y, m, i);
        if (esHabil(d, feriados) && ++cuenta === r.n) return d;
      }
      return new Date(y, m, ult);
    case 'diaSemana':
      if (r.n === -1) {
        for (i = ult; i >= 1; i--) { d = new Date(y, m, i); if (d.getDay() === r.dow) return d; }
      } else {
        cuenta = 0;
        for (i = 1; i <= ult; i++) { d = new Date(y, m, i); if (d.getDay() === r.dow && ++cuenta === r.n) return d; }
      }
      return null;
  }
  return null;
}

/** Próximo vencimiento a partir de hoy (incluye hoy). */
function proximoVencimiento(r, hoy, feriados) {
  if (!r || r.error) return null;
  var base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  for (var k = 0; k < 3; k++) {
    var dm = new Date(base.getFullYear(), base.getMonth() + k, 1);
    var d = fechaRegla(r, dm.getFullYear(), dm.getMonth(), feriados);
    if (d && d >= base) return d;
  }
  return null;
}

function fechaCorta_(d) {
  return DIAS_CORTO_[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

/** Sugerencias para el desplegable de la columna Vence. */
var REGLAS_SUGERIDAS = ['1er hábil', '2do hábil', '5to hábil', '10', '10 hábil', '15', '15 hábil', '20', 'último hábil', 'anteúltimo hábil', 'último día'];

/* ---------- Feriados (tabla en hoja Config) ---------- */

var FERIADOS_CACHE_ = null;
function leerFeriados() {
  if (FERIADOS_CACHE_) return FERIADOS_CACHE_;
  var mapa = {};
  var sh = hoja_(FZ.HOJA_CFG);
  if (sh && sh.getLastRow() > CFG_FILA_FERIADOS + 1) {
    var vals = sh.getRange(CFG_FILA_FERIADOS + 2, 1, sh.getLastRow() - CFG_FILA_FERIADOS - 1, 2).getValues();
    vals.forEach(function (r) {
      if (r[0] instanceof Date) mapa[claveDia_(r[0])] = String(r[1] || 'Feriado');
    });
  }
  FERIADOS_CACHE_ = mapa;
  return mapa;
}

/* ===== Formato.js ===== */

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

/* ===== Indices.js ===== */

/**
 * Finanzas · Índices (inflación, dólar), feriados y hoja Config
 *
 * Fuentes públicas, sin claves:
 *  - Inflación mensual INDEC: api.argentinadatos.com (respaldo: apis.datos.gob.ar)
 *  - Dólar oficial y blue (promedio mensual de venta): api.argentinadatos.com
 *  - Feriados nacionales: api.argentinadatos.com (respaldo: Google Calendar "Feriados en Argentina")
 * Cualquier fila que edites a mano queda marcada "manual" y no se vuelve a pisar.
 */

var API_AD_ = 'https://api.argentinadatos.com/v1';

function traerJson_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error(url + ' → HTTP ' + r.getResponseCode());
  return JSON.parse(r.getContentText());
}

/* ---------- Hoja Índices ---------- */

function crearHojaIndices_(ss) {
  var sh = ss.getSheetByName(FZ.HOJA_IND);
  if (!sh) sh = ss.insertSheet(FZ.HOJA_IND);
  var C = FZ.C;
  sh.getRange(1, 1, 1, 5).setValues([['Mes', 'Inflación mensual (%)', 'Dólar oficial', 'Dólar blue', 'Origen']])
    .setBackground(C.cabecera).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), 5).setFontFamily(FZ.FUENTE).setFontSize(10);
  [110, 150, 120, 120, 90].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('mmm yyyy');
  sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('0.0');
  sh.getRange(2, 3, sh.getMaxRows() - 1, 2).setNumberFormat('#,##0.00');
  sh.getRange(2, 5, sh.getMaxRows() - 1, 1).setFontColor(C.tenue);
  sh.getRange(1, 5).setNote('"auto" = lo completa el sistema. Si editás una fila, pasa a "manual" y se respeta.');
  sh.setTabColor(C.ahorro);
  return sh;
}

function promedioMensual_(lista, campo) {
  var acc = {};
  lista.forEach(function (x) {
    var iso = String(x.fecha).slice(0, 7), v = Number(x[campo]);
    if (!v) return;
    acc[iso] = acc[iso] || { s: 0, n: 0 };
    acc[iso].s += v; acc[iso].n++;
  });
  var out = {};
  Object.keys(acc).forEach(function (k) { out[k] = Math.round(acc[k].s / acc[k].n * 100) / 100; });
  return out;
}

function traerInflacion_() {
  try {
    var out = {};
    traerJson_(API_AD_ + '/finanzas/indices/inflacion').forEach(function (x) { out[String(x.fecha).slice(0, 7)] = Number(x.valor); });
    if (Object.keys(out).length) return out;
  } catch (e) { console.warn('argentinadatos inflación: ' + e); }
  var j = traerJson_('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&representation_mode=percent_change&limit=1000&format=json');
  var res = {};
  j.data.forEach(function (x) { res[String(x[0]).slice(0, 7)] = Math.round(Number(x[1]) * 1000) / 10; });
  return res;
}

/** Descarga inflación y dólar y los fusiona en la hoja Índices. */
function actualizarIndices() {
  var ss = ss_();
  var sh = ss.getSheetByName(FZ.HOJA_IND) || crearHojaIndices_(ss);
  var infl = {}, oficial = {}, blue = {}, errores = [];
  try { infl = traerInflacion_(); } catch (e) { errores.push('inflación'); }
  try { oficial = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/oficial'), 'venta'); } catch (e) { errores.push('dólar oficial'); }
  try { blue = promedioMensual_(traerJson_(API_AD_ + '/cotizaciones/dolares/blue'), 'venta'); } catch (e) { errores.push('dólar blue'); }

  var existentes = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (r[0] instanceof Date) existentes[isoMes_(r[0])] = r;
    });
  }
  var fin = sh.getParent().getSheetByName(FZ.HOJA);
  var desde = new Date(new Date().getFullYear() - 3, 0, 1);
  if (fin) {
    var est = leerEstructura(fin);
    if (est.meses.length) desde = new Date(est.meses[0].fecha.getFullYear() - 1, 0, 1);
  }
  var hoy = new Date(), filas = [];
  for (var d = desde; d <= hoy; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    var iso = isoMes_(d), prev = existentes[iso];
    if (prev && prev[4] === 'manual') { filas.push(prev); continue; }
    filas.push([new Date(d), pick_(infl[iso], prev && prev[1]), pick_(oficial[iso], prev && prev[2]), pick_(blue[iso], prev && prev[3]), 'auto']);
  }
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, 5).setValues(filas);
  INDICES_CACHE_ = null;
  PropertiesService.getDocumentProperties().setProperty('indicesTs', String(Date.now()));
  return { meses: filas.length, errores: errores };
}

function pick_(nuevo, viejo) {
  return nuevo !== undefined && nuevo !== null && nuevo !== '' ? nuevo : (viejo !== undefined && viejo !== null ? viejo : '');
}

var INDICES_CACHE_ = null;
/** @return {{inflacion:Object, oficial:Object, blue:Object}} mapas 'YYYY-MM' → número */
function leerIndices_() {
  if (INDICES_CACHE_) return INDICES_CACHE_;
  var out = { inflacion: {}, oficial: {}, blue: {} };
  var sh = hoja_(FZ.HOJA_IND);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      var iso = isoMes_(r[0]);
      if (r[1] !== '' && !isNaN(Number(r[1]))) out.inflacion[iso] = Number(r[1]);
      if (Number(r[2])) out.oficial[iso] = Number(r[2]);
      if (Number(r[3])) out.blue[iso] = Number(r[3]);
    });
  }
  INDICES_CACHE_ = out;
  return out;
}

/** Al editar la hoja Índices a mano, la fila pasa a "manual". */
function alEditarIndices_(e) {
  var r = e.range;
  if (r.getRow() < 2 || r.getColumn() > 4) return;
  r.getSheet().getRange(r.getRow(), 5, r.getNumRows(), 1).setValue('manual');
}

/* ---------- Hoja Config ---------- */

function crearHojaConfig_(ss) {
  var sh = ss.getSheetByName(FZ.HOJA_CFG);
  var previos = {};
  if (sh) {
    sh.getRange(1, 1, CFG_FILA_FERIADOS - 1, 2).getValues().forEach(function (r) { previos[String(r[0]).trim()] = r[1]; });
  } else {
    sh = ss.insertSheet(FZ.HOJA_CFG);
  }
  var C = FZ.C;
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), 3).setFontFamily(FZ.FUENTE).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1).setValue('Configuración').setFontSize(14).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(2, 1).setValue('Todo lo demás se configura en la hoja Finanzas, fila por fila. Acá solo hay preferencias generales.').setFontColor(C.tinta2);
  var filas = CFG_DEF.map(function (d) {
    return [d.label, previos.hasOwnProperty(d.label) ? previos[d.label] : d.def, d.ayuda];
  });
  sh.getRange(3, 1, filas.length, 3).setValues(filas);
  sh.getRange(3, 1, filas.length, 1).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(3, 2, filas.length, 1).setBackground(C.acentoSuave).setHorizontalAlignment('left');
  sh.getRange(3, 3, filas.length, 1).setFontColor(C.tenue).setFontSize(9);
  sh.getRange(3, 1, filas.length, 3).setBorder(null, null, null, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);
  var siNo = SpreadsheetApp.newDataValidation().requireValueInList(['Sí', 'No'], true).build();
  CFG_DEF.forEach(function (d, i) {
    if (['cerrarMes', 'confirmarDA', 'tarjetaMesSig'].indexOf(d.k) >= 0) sh.getRange(3 + i, 2).setDataValidation(siNo);
    if (d.k === 'dolar') sh.getRange(3 + i, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Blue', 'Oficial'], true).build());
  });
  sh.setColumnWidth(1, 320); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 520);
  sh.setRowHeights(3, filas.length, 28);

  sh.getRange(CFG_FILA_FERIADOS, 1).setValue('Feriados y días no laborables').setFontSize(12).setFontWeight('bold').setFontColor(C.tinta);
  sh.getRange(CFG_FILA_FERIADOS, 2).setValue('Se usan para calcular días hábiles. Podés agregar los tuyos (ej. asueto de tu empresa).').setFontColor(C.tinta2);
  sh.getRange(CFG_FILA_FERIADOS + 1, 1, 1, 3).setValues([['Fecha', 'Nombre', 'Origen']]).setBackground(C.cabecera).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(CFG_FILA_FERIADOS + 2, 1, sh.getMaxRows() - CFG_FILA_FERIADOS - 1, 1).setNumberFormat('ddd dd/mm/yyyy');
  sh.setTabColor(C.tenue);
  CFG_CACHE_ = null;
  return sh;
}

/** Agrega los feriados nacionales de un año a la tabla de Config (sin duplicar). */
function actualizarFeriados_(anio) {
  var sh = hoja_(FZ.HOJA_CFG);
  if (!sh) return 0;
  var lista = [];
  try {
    lista = traerJson_(API_AD_ + '/feriados/' + anio).map(function (x) {
      var p = String(x.fecha).split('-');
      return [new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])), x.nombre, 'auto'];
    });
  } catch (e) {
    try {
      var cal = CalendarApp.getCalendarById('es.ar#holiday@group.v.calendar.google.com');
      lista = cal.getEvents(new Date(anio, 0, 1), new Date(anio + 1, 0, 1)).map(function (ev) {
        var d = ev.getAllDayStartDate();
        return [new Date(d.getFullYear(), d.getMonth(), d.getDate()), ev.getTitle(), 'auto'];
      });
    } catch (e2) { console.warn('Sin feriados para ' + anio + ': ' + e2); }
  }
  var inicio = CFG_FILA_FERIADOS + 2;
  var existentes = sh.getLastRow() >= inicio ? sh.getRange(inicio, 1, sh.getLastRow() - inicio + 1, 3).getValues().filter(function (r) { return r[0] instanceof Date; }) : [];
  var claves = {};
  existentes.forEach(function (r) { claves[claveDia_(r[0])] = true; });
  var nuevos = lista.filter(function (r) { return !claves[claveDia_(r[0])]; });
  if (!nuevos.length) return 0;
  var todos = existentes.concat(nuevos).sort(function (a, b) { return a[0] - b[0]; });
  sh.getRange(inicio, 1, todos.length, 3).setValues(todos);
  FERIADOS_CACHE_ = null;
  return nuevos.length;
}

/* ===== Main.js ===== */

/**
 * Finanzas · Menú, disparadores y automatizaciones
 *
 *  onOpen      → menú + foco en el mes actual (años anteriores colapsados)
 *  onEdit      → arrastre de precios, vencimientos, fórmulas, categorías
 *  alCambiar   → al insertar/borrar filas, recalcula subtotales (instalable)
 *  tareaDiaria → cierre de mes, débitos automáticos, índices, calendario (7 AM)
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💰 Finanzas')
    .addItem('➕ Cargar gasto o ingreso', 'abrirPanel')
    .addItem('📊 Dashboard', 'abrirDashboard')
    .addItem('🎯 Ir al mes actual', 'irAlMesActual')
    .addSeparator()
    .addItem('🗓️ Sincronizar calendario ahora', 'menuCalendario')
    .addItem('📈 Actualizar inflación y dólar', 'menuIndices')
    .addItem('🔧 Reparar fórmulas y formato', 'menuReparar')
    .addSeparator()
    .addItem('⚙️ Instalar / actualizar sistema', 'menuInstalar')
    .addToUi();
  try {
    var sh = hoja_();
    if (sh && estaInstalado_(sh)) enfocarMesActual(sh);
  } catch (e) { console.warn(e); }
}

function estaInstalado_(sh) {
  return String(sh.getRange(3, FZ.COL_TIPO).getValue()) === 'RES:I';
}

function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet(), nombre = sh.getName();
  try {
    if (nombre === FZ.HOJA) alEditarFinanzas_(e);
    else if (nombre === FZ.HOJA_MOV) alEditarMovimientos_(e);
    else if (nombre === FZ.HOJA_IND) alEditarIndices_(e);
  } catch (err) {
    console.error(err);
    e.source.toast(String(err && err.message || err), '⚠️ Finanzas', 6);
  }
}

function alEditarFinanzas_(e) {
  var r = e.range, sh = r.getSheet();
  var f0 = r.getRow(), f1 = r.getLastRow(), c0 = r.getColumn(), c1 = r.getLastColumn();
  if (f1 < 3 || !estaInstalado_(sh)) return;
  var est = leerEstructura(sh);
  var enRango = function (it) { return it.fila >= f0 && it.fila <= f1; };
  var toca = function (col) { return c0 <= col && c1 >= col; };
  var ss = e.source;

  // Nombre: fila nueva o renombrada → fórmulas, validaciones y valores por defecto
  if (toca(FZ.COL_NOMBRE)) {
    est.items.filter(function (it) { return enRango(it) && !it.mov; }).forEach(function (it) {
      if (!sh.getRange(it.fila, FZ.COL_PROY).getValue()) sh.getRange(it.fila, FZ.COL_PROY).setValue(modoProyeccionSugerido(it.nombre));
    });
    reconstruirFormulas(sh, est);
    aplicarValidaciones_(sh, est);
    if (est.items.some(function (it) { return enRango(it) && it.mov; })) actualizarValidacionMovimientos_(est);
  }

  // Vencimiento: interpretar la regla y mostrar el próximo
  if (toca(FZ.COL_VENCE)) {
    actualizarProximos(sh, est);
    if (f0 === f1) {
      var regla = parsearRegla(sh.getRange(f0, FZ.COL_VENCE).getValue());
      if (regla && regla.error) ss.toast(regla.error, '🤔 Vencimiento', 8);
      else if (regla) {
        var prox = proximoVencimiento(regla, new Date(), leerFeriados());
        ss.toast(describirRegla(regla) + (prox ? ' · próximo: ' + fechaCorta_(prox) : ''), '📅 Vencimiento', 5);
      }
    }
  }

  // Modo de proyección cambiado
  if (toca(FZ.COL_PROY)) {
    reproyectar(sh, est, est.items.filter(enRango).map(function (it) { return it.fila; }));
  }

  // Montos
  if (c1 >= FZ.COL_MES0) {
    var estructurales = [];
    Object.keys(est.resumen).forEach(function (k) { estructurales.push(est.resumen[k]); });
    est.secciones.forEach(function (s) { estructurales.push(s.fila); });
    est.categorias.forEach(function (c) { estructurales.push(c.fila); });
    var tocaTotal = est.totales.some(function (t) { return toca(t.col); });
    if (tocaTotal || estructurales.some(function (f) { return f >= f0 && f <= f1; })) {
      reconstruirFormulas(sh, est);
      ss.toast('Los totales y subtotales se calculan solos: se restauró la fórmula.', 'Finanzas', 4);
    }
    var items = est.items.filter(enRango);
    var fijos = items.filter(function (it) { return !it.mov; });
    if (items.some(function (it) { return it.mov; })) reconstruirFormulas(sh, est);
    if (!fijos.length) return;
    var desde = Math.max(c0, FZ.COL_MES0);
    fijos.forEach(function (it) { marcarConfirmado_(sh.getRange(it.fila, desde, 1, c1 - desde + 1)); });
    var n = reproyectar(sh, est, fijos.map(function (it) { return it.fila; }));
    if (n && fijos.length === 1) {
      ss.toast('Los meses siguientes de "' + fijos[0].nombre + '" se actualizaron (' + n + ').', '↻ Arrastre', 4);
    }
  }
}

/** Disparador instalable onChange: filas insertadas o borradas. */
function alCambiar(e) {
  if (!e || ['INSERT_ROW', 'REMOVE_ROW', 'INSERT_COLUMN', 'REMOVE_COLUMN'].indexOf(e.changeType) < 0) return;
  var sh = hoja_();
  if (!sh || !estaInstalado_(sh)) return;
  var est = leerEstructura(sh);
  if (e.changeType === 'INSERT_ROW') limpiarFilasNuevas_(sh, est);
  reconstruirFormulas(sh, est);
  aplicarGrupos_(sh, est);
  aplicarValidaciones_(sh, est);
}

/** Filas en blanco dentro de una sección: estilo de ítem (no heredan el de un encabezado). */
function limpiarFilasNuevas_(sh, est) {
  var izq = sh.getRange(1, 1, est.ultimaFila, 2).getValues();
  var lc = est.ultimaCol;
  for (var f = 3; f < est.ultimaFila; f++) {
    var vacia = !String(izq[f - 1][0]).trim() && !String(izq[f - 1][1]).trim();
    var siguienteEsSeccion = String(izq[f][0]).indexOf(FZ.SEC) === 0;
    if (!vacia || siguienteEsSeccion) continue;
    if (sh.getRowHeight(f) > 12 && sh.getRange(f, FZ.COL_NOMBRE).getBackground() === FZ.C.fondo) continue;
    sh.setRowHeight(f, 26);
    sh.getRange(f, 1, 1, lc).setBackground(FZ.C.fondo).setFontWeight('normal').setFontColor(FZ.C.tinta).setFontStyle('normal').setFontSize(10)
      .setBorder(false, false, true, false, false, false, FZ.C.linea, SpreadsheetApp.BorderStyle.SOLID);
    est.totales.forEach(function (t) { sh.getRange(f, t.col).setBackground(FZ.C.fondoTotal).setFontWeight('bold'); });
  }
}

/** Todos los días a la mañana. */
function tareaDiaria() {
  var sh = hoja_();
  if (!sh || !estaInstalado_(sh)) return;
  var props = PropertiesService.getDocumentProperties();
  var cfg = leerConfig(), hoy = new Date();
  if (asegurarLineaDeTiempo(sh)) {
    var e0 = leerEstructura(sh);
    reconstruirFormulas(sh, e0);
    aplicarFormato(sh, e0);
  }
  var est = leerEstructura(sh);
  var idx = indiceMes_(est, hoy);
  var opts = { confirmar: [] };
  if (props.getProperty('ultimoMes') !== isoMes_(hoy) && cfg.cerrarMes) opts.confirmarAntesDe = idx;
  if (cfg.confirmarDA && idx >= 0) {
    var fer = leerFeriados();
    est.items.forEach(function (it) {
      if (it.mov || !/debito|automatico/.test(norm_(it.medio))) return;
      var regla = parsearRegla(it.vence);
      if (!regla || regla.error) return;
      var f = fechaRegla(regla, hoy.getFullYear(), hoy.getMonth(), fer);
      if (f && f <= hoy) opts.confirmar.push({ fila: it.fila, idx: idx });
    });
  }
  reproyectar(sh, est, null, opts);
  props.setProperty('ultimoMes', isoMes_(hoy));
  actualizarProximos(sh, est);

  var ts = Number(props.getProperty('indicesTs') || 0);
  if (Date.now() - ts > 6 * 864e5) { try { actualizarIndices(); } catch (e) { console.warn(e); } }
  try {
    var fers = leerFeriados();
    var prox = String(hoy.getFullYear() + 1);
    if (!Object.keys(fers).some(function (k) { return k.indexOf(prox) === 0; }) && hoy.getMonth() >= 9) actualizarFeriados_(hoy.getFullYear() + 1);
  } catch (e) { console.warn(e); }
  try { sincronizarCalendario(); } catch (e) { console.warn(e); }
}

/* ------------------------------------------------------------------ */
/* Menú                                                                */
/* ------------------------------------------------------------------ */

function abrirPanel() {
  var t = HtmlService.createTemplateFromFile('Panel');
  t.modo = 'sheets';
  t.urlWeb = '';
  SpreadsheetApp.getUi().showSidebar(t.evaluate().setTitle('Finanzas'));
}

function abrirDashboard() {
  var t = HtmlService.createTemplateFromFile('Dashboard');
  t.modo = 'sheets';
  var html = t.evaluate().setWidth(1280).setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard');
}

/** App web (para el celular): /exec?v=panel o /exec (dashboard). */
function doGet(e) {
  var v = e && e.parameter && e.parameter.v === 'panel' ? 'Panel' : 'Dashboard';
  var t = HtmlService.createTemplateFromFile(v);
  t.modo = 'web';
  t.urlWeb = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(v === 'Panel' ? 'Cargar · Finanzas' : 'Dashboard · Finanzas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function irAlMesActual() {
  var sh = hoja_();
  ss_().setActiveSheet(sh);
  enfocarMesActual(sh);
}

function menuCalendario() {
  var r = sincronizarCalendario();
  ss_().toast(r.omitido ? 'No hay calendario configurado (hoja Config).' :
    'Creados ' + r.creados + ' · actualizados ' + r.actualizados + ' · borrados ' + r.borrados, '🗓️ Calendario', 6);
}

function menuIndices() {
  var r = actualizarIndices();
  ss_().toast(r.errores.length ? 'No se pudo descargar: ' + r.errores.join(', ') : 'Listo: ' + r.meses + ' meses actualizados.', '📈 Índices', 6);
}

function menuReparar() {
  var sh = hoja_();
  CFG_CACHE_ = null;
  asegurarLineaDeTiempo(sh);
  var est = leerEstructura(sh);
  reconstruirFormulas(sh, est);
  aplicarFormato(sh, est);
  reproyectar(sh, est);
  actualizarProximos(sh, est);
  actualizarValidacionMovimientos_(est);
  var shm = hoja_(FZ.HOJA_MOV);
  if (shm) shm.getRange(1, FZ.MOV.DESDE, 1, 3).setFormulas([formulasMovimientos_(leerConfig().tarjetaMesSig)]);
  enfocarMesActual(sh, est);
  ss_().toast('Fórmulas, formato y proyecciones al día.', '🔧 Finanzas', 5);
}

function menuInstalar() {
  var ui = SpreadsheetApp.getUi();
  var ss = ss_();
  var sh = ss.getSheetByName(FZ.HOJA);
  if (sh && estaInstalado_(sh)) {
    instalarDisparadores_();
    menuReparar();
    ui.alert('Sistema actualizado', 'Disparadores reinstalados y planilla reparada. Tus datos no se tocaron.', ui.ButtonSet.OK);
    return;
  }
  var usarLegado = false;
  if (sh) {
    var resp = ui.alert('Instalar Finanzas',
      'Encontré tu hoja "Finanzas".\n\n¿Importo sus datos al sistema nuevo?\n\n' +
      '• Sí: se importan meses, conceptos, vencimientos y eventuales.\n' +
      '• No: se crea una planilla nueva vacía.\n\n' +
      'Tu hoja original no se borra: queda como "Finanzas (original)".', ui.ButtonSet.YES_NO_CANCEL);
    if (resp === ui.Button.CANCEL || resp === ui.Button.CLOSE) return;
    usarLegado = resp === ui.Button.YES;
  }
  ss.toast('Armando tu planilla… (puede tardar un minuto)', '⚙️ Finanzas', 60);
  var res = instalarSistema_(usarLegado);
  instalarDisparadores_();
  var extra = [];
  try { var ri = actualizarIndices(); if (ri.errores.length) extra.push('No se pudo descargar: ' + ri.errores.join(', ')); } catch (e) { extra.push('Índices: ' + e.message); }
  try { sincronizarCalendario(); } catch (e) { extra.push('Calendario: ' + e.message); }
  mostrarBienvenida_(res, extra);
}

function instalarDisparadores_() {
  var ss = ss_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['alCambiar', 'tareaDiaria'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('alCambiar').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(7).create();
}

function mostrarBienvenida_(res, extra) {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var html = '<div style="font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A;padding:4px 8px">' +
    '<h2 style="margin:0 0 6px;font-size:20px">¡Listo! 🎉</h2>' +
    '<p style="margin:0 0 14px;color:#475569">' + (res.origen === 'importado'
      ? 'Importé <b>' + res.items + '</b> conceptos y <b>' + res.movimientos + '</b> gastos eventuales (' + res.meses + ' meses).'
      : 'Creé una planilla nueva con ' + res.items + ' conceptos de ejemplo.') + '</p>' +
    '<div style="display:grid;gap:10px">' +
    tip_('✍️', 'Escribí como en Excel', 'Números o cuentas (=1500*3). Lo que cargás vos queda en <b>negro</b>; lo que completa el sistema, en <i style="color:#94A3B8">gris itálica</i>.') +
    tip_('↻', 'Arrastre de precios', 'Si la luz aumenta en septiembre, escribilo ahí: los meses siguientes se actualizan solos.') +
    tip_('📅', 'Vencimientos en palabras', 'En la columna Vence: <b>15</b>, <b>10 hábil</b>, <b>1er hábil</b>, <b>último hábil</b>… Van solos a tu Google Calendar.') +
    tip_('🧾', 'Gastos sueltos y cuotas', 'Menú <b>💰 Finanzas → Cargar</b>: escribí “heladera 900000 6 cuotas visa” y listo.') +
    tip_('📊', 'Dashboard', 'Salario real contra inflación, aumentos por concepto, gastos por categoría.') +
    '</div>' +
    (res.avisos && res.avisos.length ? '<details style="margin-top:14px;color:#475569"><summary>' + res.avisos.length + ' fórmulas con referencias se importaron como valor</summary><ul style="font-size:12px">' +
      res.avisos.slice(0, 40).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></details>' : '') +
    (extra.length ? '<p style="margin-top:12px;color:#92400E;font-size:12px">' + extra.map(esc).join('<br>') + '</p>' : '') +
    '<p style="margin-top:16px"><button onclick="google.script.host.close()" style="background:#4F46E5;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer">Empezar</button></p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(560), 'Finanzas');
}

function tip_(icono, titulo, texto) {
  return '<div style="display:flex;gap:10px;align-items:flex-start;background:#F8FAFC;border-radius:10px;padding:10px 12px">' +
    '<div style="font-size:18px;line-height:1.2">' + icono + '</div><div><b>' + titulo + '</b><br><span style="color:#475569;font-size:13px">' + texto + '</span></div></div>';
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/* ===== Migracion.js ===== */

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

/* ===== Montos.js ===== */

/**
 * Finanzas · Montos y expresiones
 * Acepta el formato argentino ("1.234,56"), sufijos ("150k", "1,5M")
 * y cuentas simples ("2828*3*4", "10615+178223", "(100+50)/2").
 */

/** Normaliza un número escrito a mano. "1.234,5" → 1234.5 · "89.423" → 89423 · "150k" → 150000 */
function normalizarNumero_(tok) {
  var s = String(tok).trim().toLowerCase();
  var mult = 1;
  if (/k$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
  else if (/(m|mm|palos?)$/.test(s)) { mult = 1e6; s = s.replace(/(mm|m|palos?)$/, ''); }
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  var n = Number(s);
  return isNaN(n) ? null : n * mult;
}

/**
 * Convierte texto en monto.
 * @return {{valor:number, formula:string|null}|null}
 *   formula: "=a+b" (sintaxis de Sheets) cuando el texto era una cuenta.
 */
function parsearMonto(texto) {
  if (typeof texto === 'number') return { valor: texto, formula: null };
  var s = String(texto == null ? '' : texto).replace(/\$/g, '').replace(/\s+/g, '').replace(/^=/, '').replace(/^\+/, '');
  if (!s) return null;
  if (!/^[\d.,kKmM()+\-*/x×%]+$/.test(s.replace(/palos?/gi, ''))) return null;
  s = s.replace(/[x×]/g, '*');
  var toks = [], re = /(\d[\d.,]*(?:palos?|mm|k|m)?)|([+\-*/()%])/gi, m, pos = 0;
  while ((m = re.exec(s))) {
    if (m.index !== pos) return null;
    pos = re.lastIndex;
    if (m[1]) { var n = normalizarNumero_(m[1]); if (n === null) return null; toks.push(n); }
    else toks.push(m[2]);
  }
  if (pos !== s.length || !toks.length) return null;
  var i = 0;
  function expr() {
    var v = term();
    while (toks[i] === '+' || toks[i] === '-') { var op = toks[i++]; var r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    var v = factor();
    while (toks[i] === '*' || toks[i] === '/') { var op = toks[i++]; var r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function factor() {
    var t = toks[i++], v;
    if (t === '-') return -factor();
    if (t === '(') { v = expr(); if (toks[i++] !== ')') throw new Error('paréntesis'); }
    else if (typeof t === 'number') v = t;
    else throw new Error('token');
    if (toks[i] === '%') { i++; v = v / 100; }
    return v;
  }
  var valor;
  try { valor = expr(); } catch (e) { return null; }
  if (i !== toks.length || !isFinite(valor)) return null;
  valor = Math.round(valor * 100) / 100;
  var esCuenta = toks.some(function (t) { return typeof t === 'string' && t !== '%'; }) && toks.length > 2;
  var formula = esCuenta ? '=' + toks.map(function (t) { return typeof t === 'number' ? String(t) : t; }).join('') : null;
  return { valor: valor, formula: formula };
}

/** ¿La fórmula es solo aritmética con números (sin referencias a celdas)? */
function esFormulaAritmetica(f) {
  return /^=\s*[\d\s.+\-*/()%]+$/.test(String(f || ''));
}

/**
 * Convierte una fórmula R1C1 a A1 para una celda destino.
 * Soporta RC, R[-1]C[2], R2C5 y rangos (RC7:RC18). Ignora texto entre comillas.
 */
function r1c1aA1(f, fila, col) {
  var partes = String(f).split('"');
  for (var p = 0; p < partes.length; p += 2) {
    partes[p] = partes[p].replace(/(^|[^A-Za-z0-9_.$!])R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?(?![A-Za-z0-9_(])/g,
      function (_, pre, r, c) {
        var abs = function (x) { return x !== undefined && x !== '' && x.charAt(0) !== '[' ? '$' : ''; };
        return pre + abs(c) + colLetra_(resolver_(c, col)) + abs(r) + resolver_(r, fila);
      });
  }
  return partes.join('"');
  function resolver_(x, base) {
    if (x === undefined || x === '') return base;
    if (x.charAt(0) === '[') return base + Number(x.slice(1, -1));
    return Number(x);
  }
}

function colLetra_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ===== Movimientos.js ===== */

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

/* ===== Proyeccion.js ===== */

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
