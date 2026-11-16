// Server (Apps Script) vyzkoušený v node: balík se spustí s napodobeninou tabulky a ověří se, že
//  – e-maily a vzkazy se nedají přečíst žádným zápisem názvu listu (dřív stačilo "sheet=tipy"),
//  – jiný list než Tipy a Přehled HOTOVO web nepřečte,
//  – po uzávěrce se nic nezapíše,
//  – text začínající = + - @ se uloží jako text, ne jako vzorec, a dlouhé texty se zkrátí.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { KOREN } = require('./pomocne');

const kod = fs.readFileSync(path.join(KOREN, 'extraliga_apps_script_komplet.gs'), 'utf8');

function list(nazev, data, radku) {
  return {
    nazev, data, zapsano: [],
    getName() { return nazev; },
    getDataRange() { return { getValues: () => data.map((r) => r.slice()) }; },
    getLastRow() { return radku || data.length; },
    getMaxColumns() { return 64; },
    insertColumnsAfter() {},
    getRange(r, c, nr, nc) {
      const self = this;
      return {
        getValues: () => {
          const vystup = [];
          for (let i = 0; i < nr; i++) {
            const zdroj = data[r - 1 + i] || [];
            const radek = [];
            for (let j = 0; j < nc; j++) radek.push(zdroj[c - 1 + j] === undefined ? '' : zdroj[c - 1 + j]);
            vystup.push(radek);
          }
          return vystup;
        },
        setValues: (v) => { self.zapsano.push({ radek: r, hodnoty: v[0].slice() }); data[r - 1] = v[0].slice(); },
      };
    },
  };
}

function prostredi(listy) {
  const ctx = {
    // Skutečný getSheetByName nerozlišuje velikost písmen – napodobenina taky ne
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => listy.find((l) => l.nazev.toLowerCase() === String(n).toLowerCase()) || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
    Session: { getScriptTimeZone: () => 'Europe/Prague' },
    Utilities: { formatDate: () => 'datum' },
    Logger: { log() {} },
    UrlFetchApp: {},
  };
  vm.createContext(ctx);
  vm.runInContext(kod, ctx);
  return ctx;
}

function sestavListy(E, radkuTipy) {
  const S = E.SLOUPCE;
  const radek = (jmeno, email, vzkaz) => {
    const r = new Array(S.POCET_TIPU).fill('');
    r[S.DATUM] = '1.9.2026 10:00'; r[S.JMENO] = jmeno; r[S.EMAIL] = email; r[S.VZKAZ] = vzkaz;
    return r;
  };
  const tipy = list('Tipy', [E.HLAVICKA.slice(0, S.POCET_TIPU), radek('Anna Nováková', 'anna@example.com', 'soukromý vzkaz'), radek('Petr Dvořák', 'petr@example.com', '')], radkuTipy);
  const hotovo = list('Přehled HOTOVO', [E.HLAVICKA.slice(), radek('výsledky', 'omyl@example.com', '')]);
  const tajny = list('Tajný list', [['e-mail'], ['tajne@example.com']]);
  return { tipy, hotovo, tajny, vse: [tipy, hotovo, tajny] };
}

const E0 = prostredi([]).EXTRALIGA;
assert.ok(/(Z|[+-]\d\d:\d\d)$/.test(E0.KONFIG.DEADLINE), 'KONFIG.DEADLINE musí mít časovou zónu, jinak server počítá uzávěrku podle nastavení projektu');

// ---------- čtení ----------
{
  const L = sestavListy(E0);
  const ctx = prostredi(L.vse);
  const S = ctx.EXTRALIGA.SLOUPCE;
  const cti = (sheet) => { const p = { action: 'data' }; if (sheet !== undefined) p.sheet = sheet; const t = ctx.doGet({ parameter: p }).text; return { text: t, json: JSON.parse(t) }; };

  for (const nazev of [undefined, 'Tipy', 'tipy', 'TIPY', 'TiPy']) {
    const o = cti(nazev);
    assert.ok(Array.isArray(o.json) && o.json.length === 3, 'list Tipy se má vrátit celý (' + nazev + ')');
    assert.ok(!o.text.includes('@'), 'e-mail se nesmí vrátit ani přes sheet=' + nazev);
    assert.ok(!o.text.includes('soukromý vzkaz'), 'vzkaz se nesmí vrátit (sheet=' + nazev + ')');
    assert.strictEqual(o.json[1][S.JMENO], 'Anna Nováková', 'jméno se vrací dál');
    assert.strictEqual(o.json[1][S.EMAIL], '', 'sloupec E-mail je prázdný');
  }
  for (const nazev of ['Přehled HOTOVO', 'přehled hotovo']) {
    const o = cti(nazev);
    assert.ok(Array.isArray(o.json) && o.json.length === 2, 'Přehled HOTOVO se má vrátit (' + nazev + ')');
    assert.ok(!o.text.includes('@'), 'ani Přehled HOTOVO nevrací e-mail');
  }
  for (const nazev of ['Tajný list', 'tajný list', 'neexistuje', 'Tipy ']) {
    const o = cti(nazev);
    assert.ok(!Array.isArray(o.json) && o.json.error, 'jiný list web nepřečte (' + nazev + ')');
    assert.ok(!o.text.includes('@') && !o.text.includes('Tajn') && !o.text.includes('neexistuje'), 'chyba neprozrazuje obsah ani název listu');
  }
  assert.strictEqual(JSON.parse(ctx.doGet({ parameter: { action: 'getCount' } }).text).pocet, 2, 'getCount počítá tipy');
  console.log('✔ čtení: e-maily ani vzkazy nejdou přečíst, jiný list než Tipy a Přehled HOTOVO web nevydá');
}

// ---------- zápis po uzávěrce ----------
{
  const L = sestavListy(E0);
  const ctx = prostredi(L.vse);
  ctx.EXTRALIGA.KONFIG.DEADLINE = '2000-01-01T00:00:00+02:00';
  const o = JSON.parse(ctx.doPost({ parameter: { jmeno: 'Pozdní Tip', email: 'anna@example.com', misto1: 'Sparta' } }).text);
  assert.strictEqual(o.ok, false, 'po uzávěrce server tip odmítne');
  assert.strictEqual(L.tipy.zapsano.length, 0, 'po uzávěrce se nic nezapíše (ani přepis vlastního tipu)');
  console.log('✔ zápis: po uzávěrce se nic nepřijme');
}

// ---------- zápis před uzávěrkou ----------
{
  const L = sestavListy(E0);
  const ctx = prostredi(L.vse);
  const S = ctx.EXTRALIGA.SLOUPCE;
  ctx.EXTRALIGA.KONFIG.DEADLINE = '2099-12-31T23:59:00+02:00';
  const posli = (p) => JSON.parse(ctx.doPost({ parameter: p }).text);

  let o = posli({ jmeno: '=CONCATENATE(C2:C999)', email: 'novy@example.com', misto1: '+Sparta', misto2: '-Kometa', misto3: '@x', poznamky: 'x'.repeat(5000), fandim: 'y'.repeat(900) });
  assert.strictEqual(o.ok, true, 'před uzávěrkou se tip uloží');
  assert.strictEqual(o.prepsano, false);
  assert.strictEqual(o.radek, 4, 'nový tip jde na první volný řádek');
  const z = L.tipy.zapsano[0].hodnoty;
  assert.strictEqual(z[S.JMENO], "'=CONCATENATE(C2:C999)", 'vzorec ve jméně se uloží jako text');
  for (const v of z) if (typeof v === 'string') assert.ok(!/^[=+@-]/.test(v), 'žádná hodnota nesmí začínat = + - @: ' + v.slice(0, 20));
  assert.ok(z[S.VZKAZ].length <= 1500, 'vzkaz se zkrátí');
  assert.ok(z[S.KLUB].length <= 200, 'dlouhá odpověď se zkrátí');
  assert.strictEqual(z[S.EMAIL], 'novy@example.com', 'e-mail se uloží beze změny (podle něj se tip přepisuje)');

  o = posli({ jmeno: 'Anna Nováková', email: ' ANNA@example.com ', misto1: 'Sparta' });
  assert.strictEqual(o.prepsano, true, 'stejný e-mail přepíše vlastní tip');
  assert.strictEqual(o.radek, 2);

  const pred = L.tipy.zapsano.length;
  o = posli({ jmeno: '   ', email: 'bez@example.com' });
  assert.strictEqual(o.ok, false, 'tip bez jména se nepřijme');
  assert.strictEqual(L.tipy.zapsano.length, pred, 'a nic se nezapíše');
  console.log('✔ zápis: vzorce se ukládají jako text, délky se omezí, tip bez jména se nepřijme');
}

// ---------- plná tabulka ----------
{
  const L = sestavListy(E0, 6000);
  const ctx = prostredi(L.vse);
  ctx.EXTRALIGA.KONFIG.DEADLINE = '2099-12-31T23:59:00+02:00';
  const o = JSON.parse(ctx.doPost({ parameter: { jmeno: 'Další', email: 'dalsi@example.com' } }).text);
  assert.strictEqual(o.ok, false, 'do zahlcené tabulky se nové řádky nepřidávají');
  assert.strictEqual(L.tipy.zapsano.length, 0);
  console.log('✔ zápis: zahlcená tabulka další řádky nepřijme');
}
