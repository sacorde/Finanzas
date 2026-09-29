const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Apps Script: no hay dos archivos con el mismo nombre (ej. Dashboard.js y Dashboard.html)', () => {
  const vistos = {};
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'apps-script'))) {
    if (f === 'appsscript.json') continue;
    const base = f.replace(/\.(js|gs|html)$/, '').toLowerCase();
    assert.ok(!vistos[base], `"${f}" choca con "${vistos[base]}": Apps Script no permite nombres repetidos`);
    vistos[base] = f;
  }
});
