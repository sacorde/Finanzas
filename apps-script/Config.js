/**
 * Finanzas · Configuración y esquema de la base de datos
 *
 * La planilla de Google Sheets es solo la base de datos: una hoja por tabla,
 * fila 1 = encabezados, una fila por registro. Toda la interfaz es la app web.
 */

var FZ = {
  VERSION: '5.0.0',
  T: { CONCEPTOS: 'Conceptos', VALORES: 'Valores', CAT: 'Categorias', IND: 'Indices', FER: 'Feriados', CFG: 'Config' },
  PROY: ['Repetir', 'Promedio 3 meses', 'Ajustar por inflación', 'No proyectar'],
  /**
   * Categorías de la planilla (un solo nivel: categoría → filas).
   * clase: I ingreso · G gasto · A ahorro. tipo: fijo (se proyecta) · eventual (una fila por gasto).
   */
  CATEGORIAS: [
    { nombre: 'Ingresos', clase: 'I', tipo: 'fijo', color: '#138A62' },
    { nombre: 'Vivienda', clase: 'G', tipo: 'fijo', color: '#2A78D6' },
    { nombre: 'Servicios', clase: 'G', tipo: 'fijo', color: '#B7791F' },
    { nombre: 'Suscripciones', clase: 'G', tipo: 'fijo', color: '#5B45C2' },
    { nombre: 'Transporte', clase: 'G', tipo: 'fijo', color: '#0E7490' },
    { nombre: 'Supermercado', clase: 'G', tipo: 'fijo', color: '#D9531E' },
    { nombre: 'Préstamos', clase: 'G', tipo: 'fijo', color: '#C53030' },
    { nombre: 'Ahorro e Inversión', clase: 'A', tipo: 'fijo', color: '#7C5E10' },
    { nombre: 'Eventuales', clase: 'G', tipo: 'eventual', color: '#C2447A' }
  ],
  /** Filas que siempre tiene Ingresos. */
  INGRESOS: ['Salario', 'Aguinaldo', 'Bonos', 'Otros']
};

/** Columnas de cada tabla. `texto`: columnas que se guardan como texto plano (evita que Sheets las convierta en fechas o fórmulas). */
var ESQUEMA = {
  // formula: "Ingresos*20%" (20 % del total de ingresos) o "#<id>*20%" (20 % de otro concepto)
  // meses: cuándo se repite ('' todos los meses · 'no' no se repite · '6,12' meses específicos)
  // proyeccion: con qué monto (Repetir · Promedio 3 meses · Ajustar por inflación · "Aumento 5%")
  Conceptos: { cols: ['id', 'nombre', 'categoria', 'clase', 'tipo', 'vence', 'medio', 'meses', 'proyeccion', 'formula', 'orden'], texto: ['id', 'nombre', 'categoria', 'clase', 'tipo', 'vence', 'medio', 'meses', 'proyeccion', 'formula'] },
  Valores: { cols: ['concepto', 'mes', 'monto', 'cuenta', 'estado'], texto: ['concepto', 'mes', 'cuenta', 'estado'] },
  Categorias: { cols: ['nombre', 'clase', 'tipo', 'color', 'orden'], texto: ['nombre', 'clase', 'tipo', 'color'] },
  Indices: { cols: ['mes', 'inflacion', 'dolar_oficial', 'dolar_blue', 'origen'], texto: ['mes', 'origen'] },
  Feriados: { cols: ['fecha', 'nombre', 'origen'], texto: ['fecha', 'nombre', 'origen'] },
  Config: { cols: ['clave', 'valor', 'descripcion'], texto: ['clave', 'valor', 'descripcion'] }
};

/** Tabla Movimientos de la versión 3 (solo para migrarla). */
var ESQUEMA_MOV_V3 = ['id', 'fecha', 'descripcion', 'categoria', 'monto', 'cuenta', 'cuotas', 'medio', 'mes', 'nota'];

/** Colores de categoría (legibles como texto sobre blanco y sobre oscuro). */
var COLORES_CAT = ['#138A62', '#2A78D6', '#B7791F', '#5B45C2', '#0E7490', '#D9531E', '#C53030', '#7C5E10', '#C2447A', '#2F7D32', '#475467', '#9E3FB5'];

var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Preferencias generales (tabla Config). */
var CFG_DEF = [
  { k: 'horizonte', def: '12', ayuda: 'Meses hacia adelante que se completan automáticamente.' },
  { k: 'inflacion', def: '', ayuda: 'Inflación mensual esperada (%). Vacío = última publicada. Se usa en "Ajustar por inflación".' },
  { k: 'cerrarMes', def: 'Sí', ayuda: 'Al empezar un mes, los estimados del mes anterior pasan a confirmados.' },
  { k: 'confirmarDA', def: 'Sí', ayuda: 'El día del vencimiento, los débitos automáticos se confirman solos.' },
  { k: 'tarjetaMesSig', def: 'Sí', ayuda: 'Las compras con tarjeta impactan el mes siguiente.' },
  { k: 'calendario', def: 'Finanzas', ayuda: 'Google Calendar donde se crean los vencimientos. Vacío = no sincronizar.' },
  { k: 'mesesCal', def: '2', ayuda: 'Meses a sincronizar en el calendario (el actual + los siguientes).' },
  { k: 'aviso', def: '1', ayuda: 'Aviso del calendario a las 9:00, N días antes.' },
  { k: 'dolar', def: 'Blue', ayuda: 'Blue u Oficial, para ver montos en USD.' },
  { k: 'medios', def: 'Débito automático, Tarjeta VISA, Tarjeta AMEX, Transferencia, Efectivo, Mercado Pago', ayuda: 'Medios de pago, separados por coma.' }
];

function ss_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { /* app web */ }
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw new Error('No encuentro la planilla. Abrí la planilla una vez y usá el menú Finanzas → Abrir la app.');
  return SpreadsheetApp.openById(id);
}

var CFG_CACHE_ = null;
/** Config normalizada (con valores por defecto). */
function leerConfig() {
  if (CFG_CACHE_) return CFG_CACHE_;
  var cfg = {};
  CFG_DEF.forEach(function (d) { cfg[d.k] = d.def; });
  leerTabla(FZ.T.CFG).forEach(function (r) {
    if (r.clave && cfg.hasOwnProperty(r.clave)) cfg[r.clave] = String(r.valor == null ? '' : r.valor);
  });
  CFG_CACHE_ = normalizarConfig_(cfg);
  return CFG_CACHE_;
}

function normalizarConfig_(cfg) {
  var out = {};
  Object.keys(cfg).forEach(function (k) { out[k] = cfg[k]; });
  out.horizonte = Math.max(1, Math.min(36, Number(cfg.horizonte) || 12));
  out.mesesCal = Math.max(1, Math.min(6, Number(cfg.mesesCal) || 2));
  out.aviso = Math.max(0, Math.min(14, Number(cfg.aviso) || 0));
  ['cerrarMes', 'confirmarDA', 'tarjetaMesSig'].forEach(function (k) { out[k] = esSi_(cfg[k]); });
  out.medios = String(cfg.medios).split(',').map(function (s) { return s.trim(); }).filter(String);
  out.dolar = norm_(cfg.dolar) === 'oficial' ? 'oficial' : 'blue';
  return out;
}

function esSi_(v) {
  if (v === true) return true;
  var s = norm_(v);
  return s === 'si' || s === 'yes' || s === 'true' || s === '1';
}

/** Minúsculas, sin acentos, espacios simples. */
function norm_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
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

function desdeIsoDia_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
}

/** 'YYYY-MM' + k meses. */
function sumarMes_(iso, k) {
  var d = desdeIsoMes_(iso);
  return isoMes_(new Date(d.getFullYear(), d.getMonth() + k, 1));
}

function etiquetaMes_(iso) {
  var d = desdeIsoMes_(iso);
  return MESES_ES[d.getMonth()].charAt(0).toUpperCase() + MESES_ES[d.getMonth()].slice(1) + ' ' + d.getFullYear();
}

function fmtPesos_(n) {
  var v = Math.round(Number(n) || 0);
  var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-$ ' : '$ ') + s;
}

var ID_SEQ_ = 0;
function nuevoId_() {
  ID_SEQ_++;
  return (Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) + ID_SEQ_.toString(36)).slice(-10);
}
