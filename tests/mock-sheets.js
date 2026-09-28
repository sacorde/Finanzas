// Simulador mínimo de SpreadsheetApp y servicios de Apps Script para tests de punta a punta.
// Solo implementa los métodos reales de la API que usa el proyecto: si el código llama a
// un método que no existe en Apps Script, el test falla con TypeError.

const MAX_COL_LETRAS = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const letraACol = (s) => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);

function a1aR1C1(f, fila, col) {
  const partes = String(f).split('"');
  for (let p = 0; p < partes.length; p += 2) {
    partes[p] = partes[p].replace(/(^|[^A-Za-z0-9_!'])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (_, pre, cAbs, letras, rAbs, num) => {
      const c = letraACol(letras), r = Number(num);
      const R = rAbs ? 'R' + r : (r === fila ? 'R' : 'R[' + (r - fila) + ']');
      const C = cAbs ? 'C' + c : (c === col ? 'C' : 'C[' + (c - col) + ']');
      return pre + R + C;
    });
  }
  return partes.join('"');
}

class Celda { constructor() { this.v = ''; this.f = ''; this.r1 = ''; this.style = 'normal'; this.color = '#000000'; this.bg = '#ffffff'; this.note = ''; this.dv = null; } }

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { _s: sheet, _r: r, _c: c, _nr: nr, _nc: nc }); }
  _map(fn) { const out = []; for (let i = 0; i < this._nr; i++) { const row = []; for (let j = 0; j < this._nc; j++) row.push(fn(this._s._celda(this._r + i, this._c + j), this._r + i, this._c + j)); out.push(row); } return out; }
  _set(arr, fn) {
    if (arr.length !== this._nr || arr.some((r) => r.length !== this._nc)) throw new Error(`Dimensiones ${arr.length}x${arr[0] && arr[0].length} ≠ rango ${this._nr}x${this._nc}`);
    for (let i = 0; i < this._nr; i++) for (let j = 0; j < this._nc; j++) fn(this._s._celda(this._r + i, this._c + j, true), arr[i][j], this._r + i, this._c + j);
    return this;
  }
  _all(fn) { this._map((c, r, col) => fn(this._s._celda(r, col, true), r, col)); return this; }
  getRow() { return this._r; } getColumn() { return this._c; } getNumRows() { return this._nr; } getNumColumns() { return this._nc; }
  getLastRow() { return this._r + this._nr - 1; } getLastColumn() { return this._c + this._nc - 1; }
  getSheet() { return this._s; }
  getA1Notation() { return MAX_COL_LETRAS(this._c) + this._r + ':' + MAX_COL_LETRAS(this._c + this._nc - 1) + (this._r + this._nr - 1); }
  getValues() { return this._map((c) => (c.f ? (c.v === '' ? 0 : c.v) : c.v)); }
  getValue() { return this.getValues()[0][0]; }
  getFormulas() { return this._map((c) => c.f); }
  getFormula() { return this.getFormulas()[0][0]; }
  getFormulasR1C1() { return this._map((c) => c.r1); }
  setValues(a) {
    return this._set(a, (c, v, r, col) => {
      if (typeof v === 'string' && v.charAt(0) === '=') { c.f = v; c.r1 = a1aR1C1(v, r, col); c.v = ''; }
      else { c.v = v === null || v === undefined ? '' : v; c.f = ''; c.r1 = ''; }
    });
  }
  setValue(v) { return this._all((c, r, col) => new Range(this._s, r, col, 1, 1).setValues([[v]])); }
  setFormulas(a) { return this._set(a, (c, f, r, col) => { c.f = f; c.r1 = f ? a1aR1C1(f, r, col) : ''; c.v = ''; }); }
  setFormula(f) { return this.setFormulas(this._map(() => f)); }
  setFormulasR1C1(a) { return this._set(a, (c, f, r, col) => { c.r1 = f; c.f = f ? this._s._ctx.r1c1aA1(f, r, col) : ''; c.v = ''; }); }
  setFormulaR1C1(f) { return this.setFormulasR1C1(this._map(() => f)); }
  clearContent() { return this._all((c) => { c.v = ''; c.f = ''; c.r1 = ''; }); }
  getFontStyles() { return this._map((c) => c.style); } getFontStyle() { return this.getFontStyles()[0][0]; }
  setFontStyles(a) { return this._set(a, (c, v) => { c.style = v; }); }
  setFontStyle(v) { return this._all((c) => { c.style = v; }); }
  getFontColors() { return this._map((c) => c.color); } getFontColor() { return this.getFontColors()[0][0]; }
  setFontColors(a) { return this._set(a, (c, v) => { c.color = v; }); }
  setFontColor(v) { return this._all((c) => { c.color = v; }); }
  getBackground() { return this._s._celda(this._r, this._c).bg; }
  setBackground(v) { return this._all((c) => { c.bg = v; }); }
  setNote(v) { return this._all((c) => { c.note = v; }); }
  setNotes(a) { return this._set(a, (c, v) => { c.note = v; }); }
  setDataValidation(v) { return this._all((c) => { c.dv = v; }); }
  setDataValidations(a) { return this._set(a, (c, v) => { c.dv = v; }); }
  setNumberFormat() { return this; } setHorizontalAlignment() { return this; } setVerticalAlignment() { return this; }
  setFontWeight() { return this; } setFontSize() { return this; } setFontFamily() { return this; } setWrap() { return this; }
  setBorder() { if (arguments.length !== 6 && arguments.length !== 8) throw new Error('setBorder: 6 u 8 argumentos'); return this; }
  merge() { return this; } breakApart() { return this; }
  activate() { this._s._parent._activa = this; return this; }
  shiftRowGroupDepth(d) { this._s._grupos.push(['fila', this._r, this._nr, d]); return this; }
  shiftColumnGroupDepth(d) { this._s._grupos.push(['col', this._c, this._nc, d]); return this; }
}

class Sheet {
  constructor(parent, name, ctx) { this._parent = parent; this._name = name; this._ctx = ctx; this._cells = new Map(); this._maxR = 1000; this._maxC = 26; this._grupos = []; this._alturas = {}; this._cf = []; }
  _celda(r, c, crear) {
    if (r < 1 || c < 1 || r > this._maxR || c > this._maxC) throw new Error(`Fuera de la grilla: ${r},${c} (max ${this._maxR}x${this._maxC}) en ${this._name}`);
    const k = r + ',' + c;
    let x = this._cells.get(k);
    if (!x) { x = new Celda(); if (crear) this._cells.set(k, x); }
    return x;
  }
  getName() { return this._name; } setName(n) { this._name = n; return this; }
  getParent() { return this._parent; }
  getMaxRows() { return this._maxR; } getMaxColumns() { return this._maxC; }
  getLastRow() { let m = 0; for (const [k, c] of this._cells) if (c.v !== '' || c.f) m = Math.max(m, Number(k.split(',')[0])); return m; }
  getLastColumn() { let m = 0; for (const [k, c] of this._cells) if (c.v !== '' || c.f) m = Math.max(m, Number(k.split(',')[1])); return m; }
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') {
      const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
      const c0 = letraACol(m[1]), r0 = Number(m[2]);
      return new Range(this, r0, c0, m[4] ? Number(m[4]) - r0 + 1 : 1, m[3] ? letraACol(m[3]) - c0 + 1 : 1);
    }
    if (nr === 0 || nc === 0) throw new Error('Rango vacío');
    return new Range(this, r, c, nr || 1, nc || 1);
  }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  _mover(fn) { const n = new Map(); for (const [k, c] of this._cells) { const [r, col] = k.split(',').map(Number); const d = fn(r, col); if (d) n.set(d[0] + ',' + d[1], c); } this._cells = n; }
  insertColumnsAfter(c, n) { this._mover((r, col) => [r, col > c ? col + n : col]); this._maxC += n; return this; }
  insertRowsAfter(r, n) { this._mover((row, col) => [row > r ? row + n : row, col]); this._maxR += n; return this; }
  insertRowBefore(r) { this._mover((row, col) => [row >= r ? row + 1 : row, col]); this._maxR += 1; return this; }
  deleteColumns(c, n) { this._mover((r, col) => (col >= c && col < c + n ? null : [r, col >= c + n ? col - n : col])); this._maxC -= n; return this; }
  setHiddenGridlines() { return this; } setTabColor() { return this; }
  setColumnWidth() { return this; } setColumnWidths() { return this; } hideColumns() { return this; }
  setRowHeight(r, h) { this._alturas[r] = h; return this; } setRowHeights() { return this; } getRowHeight(r) { return this._alturas[r] || 21; }
  setFrozenRows(n) { this._frozenR = n; return this; } setFrozenColumns(n) { this._frozenC = n; return this; }
  setConditionalFormatRules(r) { this._cf = r; return this; }
  setRowGroupControlPosition() { return this; } setColumnGroupControlPosition() { return this; }
  getColumnGroup() { return { collapse() { return this; }, expand() { return this; } }; }
}

class Spreadsheet {
  constructor(ctx) { this._ctx = ctx; this._sheets = []; this._toasts = []; }
  getId() { return 'ss-test'; }
  getSheetByName(n) { return this._sheets.find((s) => s._name === n) || null; }
  getSheets() { return this._sheets.slice(); }
  insertSheet(n, idx) {
    if (this.getSheetByName(n)) throw new Error('Ya existe la hoja ' + n);
    const s = new Sheet(this, n, this._ctx);
    if (idx === undefined) this._sheets.push(s); else this._sheets.splice(idx, 0, s);
    return s;
  }
  setSpreadsheetTimeZone() { return this; } setSpreadsheetLocale() { return this; }
  setActiveSheet(s) { this._activa = s; return s; }
  toast(msg, titulo) { this._toasts.push((titulo || '') + ': ' + msg); }
}

function builderCF() {
  const b = { _r: {} };
  ['whenFormulaSatisfied', 'whenNumberLessThan', 'whenNumberGreaterThan', 'setBackground', 'setFontColor', 'setBold', 'setRanges'].forEach((m) => { b[m] = (x) => { b._r[m] = x; return b; }; });
  b.build = () => b._r;
  return b;
}
function builderDV() {
  const b = { _r: {} };
  ['requireValueInList', 'requireNumberBetween', 'setAllowInvalid', 'setHelpText'].forEach((m) => { b[m] = (...x) => { b._r[m] = x; return b; }; });
  b.build = () => b._r;
  return b;
}

class Props { constructor() { this._p = {}; } getProperty(k) { return this._p.hasOwnProperty(k) ? this._p[k] : null; } setProperty(k, v) { this._p[k] = String(v); return this; } deleteProperty(k) { delete this._p[k]; return this; } }

function crearEntorno(ctx) {
  const ss = new Spreadsheet(ctx);
  const doc = new Props(), user = new Props(), script = new Props();
  const eventos = [];
  const cal = {
    getEvents: (a, b) => eventos.filter((e) => e._d >= a && e._d < b && !e._borrado),
    createAllDayEvent: (t, d, o) => {
      const e = { _t: t, _d: d, _desc: o && o.description, _tags: {}, _rem: [],
        getTag: (k) => e._tags[k] || null, setTag: (k, v) => { e._tags[k] = v; return e; },
        getTitle: () => e._t, setTitle: (x) => { e._t = x; return e; }, getDescription: () => e._desc || '', setDescription: (x) => { e._desc = x; return e; },
        getAllDayStartDate: () => e._d, setAllDayDate: (x) => { e._d = x; return e; }, deleteEvent: () => { e._borrado = true; },
        removeAllReminders: () => { e._rem = []; return e; }, addPopupReminder: (m) => { e._rem.push(m); return e; } };
      eventos.push(e); return e;
    }
  };
  Object.assign(ctx, {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, openById: () => ss, flush: () => {},
      newConditionalFormatRule: builderCF, newDataValidation: builderDV,
      BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' },
      GroupControlTogglePosition: { BEFORE: 'BEFORE', AFTER: 'AFTER' },
      getUi: () => ({ alert: () => 'YES', Button: {}, ButtonSet: {} })
    },
    PropertiesService: { getDocumentProperties: () => doc, getUserProperties: () => user, getScriptProperties: () => script },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: { fetch: () => { throw new Error('sin red en tests'); } },
    CalendarApp: { getCalendarsByName: () => [], createCalendar: () => cal, getCalendarById: () => { throw new Error('sin calendario'); }, Color: { GREEN: 'GREEN' } }
  });
  return { ss, doc, user, eventos };
}

module.exports = { crearEntorno, a1aR1C1 };
