/**
 * Finanzas · Proyección automática ("arrastre" de precios)
 *
 * Idea: lo que escribís vos es CONFIRMADO. Lo que completa el sistema es
 * ESTIMADO (se ve en gris itálica). Cuando confirmás un valor nuevo —por
 * ejemplo, la luz aumentó en septiembre— todos los meses siguientes que estaban
 * estimados pasan a ese precio, hasta el próximo valor que hayas cargado vos.
 *
 * Reglas:
 *  - Solo se proyecta desde el mes actual en adelante (nunca se inventa el pasado).
 *  - Si el mes anterior quedó vacío, el concepto se considera dado de baja y no se proyecta.
 *    Para dar de baja algo, poné 0 en el mes que deja de existir.
 *  - Nunca se pisa un valor que cargaste vos.
 *  - Borrar un mes futuro lo devuelve al estimado automático. Para "no se paga", poné 0.
 *  - Con meses específicos (ej. aguinaldo en junio y diciembre) solo se completan esos meses,
 *    tomando el último monto cargado aunque haya meses vacíos en el medio.
 *
 * Montos: igual al último · promedio de los últimos 3 · ajustado por inflación · aumento fijo X % por mes.
 */

/** "Aumento 5%" → 0.05 (null si no es ese modo). */
function aumentoMensual_(modo) {
  var m = /^aumento\s+(\d+(?:[.,]\d+)?)\s*%$/i.exec(String(modo || '').trim());
  return m ? Number(m[1].replace(',', '.')) / 100 : null;
}

function celdaVacia_(c) {
  return !c.f && (c.v === '' || c.v === null || c.v === undefined);
}

function numero_(v) {
  var n = typeof v === 'number' ? v : Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Cálculo puro de la proyección de una fila.
 * @param {Array<{v:*, f:string, proy:boolean}>} celdas  una por mes (f = cuenta, ej. '=100+50')
 * @param {number} idxInicio  índice del mes actual
 * @param {number} idxFin     último índice a proyectar (inclusive)
 * @param {string} modo       uno de FZ.PROY o "Aumento X%"
 * @param {number} infl       inflación mensual esperada (0.03 = 3%)
 * @param {{meses:Array<number>, numMes:Array<number>}=} opts  meses específicos (1–12) y el número de mes de cada celda
 * @return {Array<{i:number, v:*, f:string, borrar:boolean}>} cambios (celdas que quedan estimadas o se limpian)
 */
function calcularProyeccion(celdas, idxInicio, idxFin, modo, infl, opts) {
  var cambios = [];
  var ultimo = -1, historia = [];
  var noProyectar = modo === 'No proyectar';
  var soloMeses = opts && opts.meses && opts.meses.length ? opts.meses : null;
  var aumento = aumentoMensual_(modo);
  for (var i = 0; i < celdas.length; i++) {
    var c = celdas[i];
    var vacia = celdaVacia_(c);
    if (i < idxInicio) {
      // Con meses específicos los meses vacíos del medio son normales (no es una baja)
      if (vacia) { if (!soloMeses) { ultimo = -1; historia = []; } }
      else { ultimo = i; historia.push(numero_(c.v)); }
      continue;
    }
    if (!vacia && !c.proy) { ultimo = i; historia.push(numero_(c.v)); continue; }
    // Celda vacía o estimada dentro de la zona de proyección
    var fueraDeMes = soloMeses && soloMeses.indexOf(opts.numMes[i]) < 0;
    if (noProyectar || ultimo < 0 || i > idxFin || fueraDeMes) {
      // Estimados sin origen o fuera del horizonte se limpian; lo cargado a mano nunca
      if (c.proy && !vacia) cambios.push({ i: i, borrar: true });
      continue;
    }
    var fuente = celdas[ultimo], nuevo;
    if (modo === 'Promedio 3 meses') {
      var ult3 = historia.slice(-3);
      nuevo = { v: Math.round(ult3.reduce(function (a, b) { return a + b; }, 0) / ult3.length), f: '' };
    } else if (modo === 'Ajustar por inflación' || aumento !== null) {
      nuevo = { v: Math.round(numero_(fuente.v) * Math.pow(1 + (aumento !== null ? aumento : infl || 0), i - ultimo)), f: '' };
    } else if (fuente.f) {
      nuevo = { v: numero_(fuente.v), f: fuente.f }; // copia la cuenta
    } else {
      nuevo = { v: fuente.v, f: '' };
    }
    var igual = nuevo.f ? c.f === nuevo.f : (!c.f && numero_(c.v) === numero_(nuevo.v) && !vacia);
    if (!igual || !c.proy) cambios.push({ i: i, v: nuevo.v, f: nuevo.f, borrar: false });
  }
  return cambios;
}

/** Inflación mensual esperada (0.035 = 3,5%). */
function inflacionEsperada_(indices) {
  var cfg = leerConfig();
  if (cfg.inflacion !== '' && !isNaN(Number(cfg.inflacion))) return Number(cfg.inflacion) / 100;
  var lista = (indices || leerTabla(FZ.T.IND)).filter(function (r) { return r.inflacion !== '' && r.inflacion !== null; })
    .sort(function (a, b) { return a.mes < b.mes ? -1 : 1; });
  return lista.length ? Number(lista[lista.length - 1].inflacion) / 100 : 0.03;
}
