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
