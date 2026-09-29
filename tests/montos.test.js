const test = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./harness');
const G = cargar();
const val = (s) => { const r = G.parsearMonto(s); return r && r.valor; };

test('números en formato argentino', () => {
  assert.strictEqual(val('89423'), 89423);
  assert.strictEqual(val('89.423'), 89423);
  assert.strictEqual(val('1.234.567'), 1234567);
  assert.strictEqual(val('1.234,56'), 1234.56);
  assert.strictEqual(val('$ 5.600'), 5600);
  assert.strictEqual(val('12.5'), 12.5);
  assert.strictEqual(val('150k'), 150000);
  assert.strictEqual(val('1,5M'), 1500000);
  assert.strictEqual(val('abc'), null);
  assert.strictEqual(val(''), null);
});

test('cuentas se conservan como fórmula', () => {
  assert.deepStrictEqual({ ...G.parsearMonto('10615+178223') }, { valor: 188838, formula: '=10615+178223' });
  assert.strictEqual(G.parsearMonto('2828*3*4').valor, 33936);
  assert.strictEqual(G.parsearMonto('=384500/2+17200').valor, 209450);
  assert.strictEqual(G.parsearMonto('(100+50)/2').valor, 75);
  assert.strictEqual(G.parsearMonto('1.000x3').valor, 3000);
  assert.strictEqual(G.parsearMonto('-500').formula, null);
  assert.strictEqual(G.parsearMonto('1+'), null);
});

test('fórmulas aritméticas', () => {
  assert.ok(G.esFormulaAritmetica('=10615+178223'));
  assert.ok(G.esFormulaAritmetica('= 17200/2'));
  assert.ok(!G.esFormulaAritmetica('=AK8*20%'));
});
