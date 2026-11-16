// Zavaděč Apps Scriptu (extraliga_zavadec.gs) vyzkoušený v node s napodobeninou služeb Googlu:
//  – kód bere jen z větve main,
//  – rozbitý kód z GitHubu nepřepíše zálohu a web jede dál na poslední funkční verzi,
//  – při výpadku GitHubu se použije záloha.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { KOREN } = require('./pomocne');

const zavadec = fs.readFileSync(path.join(KOREN, 'extraliga_zavadec.gs'), 'utf8');
const balik = fs.readFileSync(path.join(KOREN, 'extraliga_apps_script_komplet.gs'), 'utf8');

const adresy = zavadec.match(/https:\/\/raw\.githubusercontent\.com\/[^"'\s]+/g) || [];
assert.deepStrictEqual(adresy, ['https://raw.githubusercontent.com/kocismichal/kbz_tipovacka/main/extraliga_apps_script_komplet.gs'],
  'zavaděč smí stahovat kód jen z větve main');

// Spustí zavaděč; odpoved = { kod: 200, text } nebo null (GitHub neodpovídá). Vrací kontext a stav úložišť.
function spust(odpoved, uloziste) {
  const u = uloziste || { cache: {}, props: {} };
  let stazeno = 0;
  const ctx = {
    CacheService: { getScriptCache: () => ({ get: (k) => (k in u.cache ? u.cache[k] : null), put: (k, v) => { u.cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in u.props ? u.props[k] : null),
      setProperties: (o) => { Object.assign(u.props, o); },
    }) },
    UrlFetchApp: { fetch: () => { stazeno++; if (!odpoved) throw new Error('síť nejede'); return { getResponseCode: () => odpoved.kod, getContentText: () => odpoved.text }; } },
    SpreadsheetApp: {}, LockService: {}, ContentService: {}, Session: {}, Utilities: {}, Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(zavadec, ctx);
  return { ctx, u, stazeno: () => stazeno };
}
const zaloha = (u) => { let k = ''; for (let i = 0; i < Number(u.props.kod_pocet || 0); i++) k += u.props['kod_' + i]; return k; };

// 1) dobrý kód z GitHubu: použije se, uloží do zálohy i do mezipaměti
let b = spust({ kod: 200, text: balik });
assert.strictEqual(typeof b.ctx.doGet, 'function');
assert.strictEqual(b.ctx.EXTRALIGA.KONFIG.SEZONA, '2026/27', 'kód z GitHubu běží');
assert.strictEqual(zaloha(b.u), balik, 'funkční kód se uloží jako záloha');
assert.strictEqual(b.u.cache.kod_tipovacky, balik, 'a do mezipaměti');
const dobre = b.u;

// 2) další požadavek do 5 minut bere kód z mezipaměti, GitHub se nevolá
b = spust({ kod: 200, text: 'tohle se nesmí použít(' }, { cache: Object.assign({}, dobre.cache), props: Object.assign({}, dobre.props) });
assert.strictEqual(b.stazeno(), 0, 's kódem v mezipaměti se nic nestahuje');
assert.strictEqual(b.ctx.EXTRALIGA.KONFIG.SEZONA, '2026/27');

// 3) rozbitý kód na main (syntaktická chyba / chybějící funkce): záloha zůstane a použije se
for (const rozbity of ['var EXTRALIGA = {;', 'var EXTRALIGA = {}; function doGet() {}', '<html>404</html>']) {
  b = spust({ kod: 200, text: rozbity }, { cache: {}, props: Object.assign({}, dobre.props) });
  assert.strictEqual(zaloha(b.u), balik, 'rozbitý kód nesmí přepsat zálohu');
  assert.strictEqual(b.ctx.EXTRALIGA.KONFIG.SEZONA, '2026/27', 'web jede dál na záloze');
  assert.strictEqual(b.u.cache.kod_tipovacky, balik, 'do mezipaměti jde funkční kód, ne rozbitý');
}

// 4) GitHub neodpovídá nebo vrací chybu: záloha
for (const odpoved of [null, { kod: 404, text: 'Not Found' }, { kod: 500, text: '' }]) {
  b = spust(odpoved, { cache: {}, props: Object.assign({}, dobre.props) });
  assert.strictEqual(b.ctx.EXTRALIGA.KONFIG.SEZONA, '2026/27', 'při výpadku GitHubu běží záloha');
  assert.strictEqual(zaloha(b.u), balik);
}

// 5) první spuštění bez zálohy a bez GitHubu: srozumitelná chyba
assert.throws(() => spust(null), /záloha ještě neexistuje/, 'bez kódu i zálohy se zavaděč ozve');

// 6) rozbitý kód v mezipaměti (nemělo by nastat) nezpůsobí výpadek, stáhne se znovu
b = spust({ kod: 200, text: balik }, { cache: { kod_tipovacky: 'var x = {;' }, props: {} });
assert.strictEqual(b.ctx.EXTRALIGA.KONFIG.SEZONA, '2026/27');
assert.strictEqual(b.stazeno(), 1);

console.log('✔ zavaděč: jen větev main, rozbitý kód nepřepíše zálohu, při výpadku běží záloha');
