const test = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./harness');
const G = cargar();

const d = (y, m, dd) => new Date(y, m - 1, dd);
const k = (x) => x && `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
const fer = { '2026-10-12': 'Diversidad cultural', '2026-11-23': 'Soberanía (trasladado)' };

test('parsea reglas en castellano', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(G.parsearRegla('15'))), { tipo: 'dia', dia: 15, ajuste: null });
  assert.strictEqual(G.parsearRegla('día 15').dia, 15);
  assert.strictEqual(G.parsearRegla('15 hábil').ajuste, 'siguiente');
  assert.strictEqual(G.parsearRegla('10 (hábil)').ajuste, 'siguiente');
  assert.strictEqual(G.parsearRegla('18 hábil anterior').ajuste, 'anterior');
  assert.strictEqual(G.parsearRegla('1er hábil').tipo, 'habilN');
  assert.strictEqual(G.parsearRegla('primer día hábil').n, 1);
  assert.strictEqual(G.parsearRegla('5to día hábil').n, 5);
  assert.strictEqual(G.parsearRegla('5 to hábil').n, 5);
  assert.strictEqual(G.parsearRegla('segundo hábil').n, 2);
  assert.strictEqual(G.parsearRegla('3° hábil').n, 3);
  assert.strictEqual(G.parsearRegla('último hábil').tipo, 'habilDesdeFin');
  assert.strictEqual(G.parsearRegla('anteúltimo hábil').n, 2);
  assert.strictEqual(G.parsearRegla('penúltimo día hábil').n, 2);
  assert.strictEqual(G.parsearRegla('último día').tipo, 'desdeFin');
  assert.strictEqual(G.parsearRegla('anteultimo dia del mes').n, 2);
  assert.strictEqual(G.parsearRegla('fin de mes').tipo, 'desdeFin');
  assert.strictEqual(G.parsearRegla('último viernes').dow, 5);
  assert.strictEqual(G.parsearRegla('primer lunes').n, 1);
  assert.strictEqual(G.parsearRegla('el 10 de cada mes').dia, 10);
  assert.strictEqual(G.parsearRegla(''), null);
  assert.ok(G.parsearRegla('cuando pinte').error);
  assert.ok(G.parsearRegla('45').error);
});

test('calcula fechas con fines de semana y feriados', () => {
  // Octubre 2026: jueves 1. Lunes 12 feriado.
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('1er hábil'), 2026, 9, fer)), '2026-10-1');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('2do hábil'), 2026, 9, fer)), '2026-10-2');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('3er hábil'), 2026, 9, fer)), '2026-10-5');
  // 10/10/2026 es sábado → hábil siguiente = lunes 12 feriado → martes 13
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('10 hábil'), 2026, 9, fer)), '2026-10-13');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('10 hábil anterior'), 2026, 9, fer)), '2026-10-9');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('10'), 2026, 9, fer)), '2026-10-10');
  // 31/10/2026 sábado → último hábil viernes 30, anteúltimo jueves 29
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('último hábil'), 2026, 9, fer)), '2026-10-30');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('anteúltimo hábil'), 2026, 9, fer)), '2026-10-29');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('último día'), 2026, 1, fer)), '2026-2-28');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('31'), 2026, 1, fer)), '2026-2-28');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('último viernes'), 2026, 9, fer)), '2026-10-30');
  assert.strictEqual(k(G.fechaRegla(G.parsearRegla('primer lunes'), 2026, 9, fer)), '2026-10-5');
});

test('próximo vencimiento salta al mes siguiente si ya pasó', () => {
  const r = G.parsearRegla('15');
  assert.strictEqual(k(G.proximoVencimiento(r, d(2026, 9, 28), fer)), '2026-10-15');
  assert.strictEqual(k(G.proximoVencimiento(r, d(2026, 9, 15), fer)), '2026-9-15');
  assert.strictEqual(k(G.proximoVencimiento(r, d(2026, 12, 20), fer)), '2027-1-15');
});

test('describe reglas', () => {
  assert.strictEqual(G.describirRegla(G.parsearRegla('10 hábil')), 'Día 10 (o hábil siguiente)');
  assert.strictEqual(G.describirRegla(G.parsearRegla('5to hábil')), '5º día hábil');
  assert.strictEqual(G.describirRegla(G.parsearRegla('último viernes')), 'Último viernes');
});
