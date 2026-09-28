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
