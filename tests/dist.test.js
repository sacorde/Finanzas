const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { construir } = require('../scripts/bundle');

test('dist/ está actualizado (correr npm run bundle)', () => {
  for (const [f, contenido] of Object.entries(construir())) {
    const actual = fs.readFileSync(path.join(__dirname, '..', 'dist', f), 'utf8');
    assert.ok(actual === contenido, 'dist/' + f + ' desactualizado: correr `npm run bundle`');
  }
});
