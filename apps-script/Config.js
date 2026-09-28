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
