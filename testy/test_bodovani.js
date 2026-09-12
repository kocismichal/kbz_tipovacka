const assert = require('assert');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE;

// Řádek tipu z formulářových polí
function tip(poradi, zolici, bonusy) {
  const p = { jmeno: 'Test', email: 'a@b.cz', fandim: 'Třinec' };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  (zolici || []).forEach((z, k) => { p['zolik' + (k + 1)] = z[0]; p['zolik' + (k + 1) + '_body'] = z[1]; });
  Object.assign(p, bonusy || {});
  return E.radekZFormulare(p, '1.1.2026');
}
// Řádek výsledků: pořadí + body týmů podle místa + odpovědi
function vysledky(poradi, bodyMist, odpovedi) {
  const r = new Array(SL.POCET).fill('');
  poradi.forEach((t, i) => r[SL.MISTO_OD + i] = t);
  (bodyMist || []).forEach((b, i) => r[SL.BODY_MISTO_OD + i] = b);
  E.BONUSY.forEach(q => { if (odpovedi && odpovedi[q.klic] !== undefined) r[q.idx] = odpovedi[q.klic]; });
  return r;
}

const T = K.TYMY;
// 1) mapování řádku
const r = tip(T, [['Třinec', 95], ['Pardubice', 90], ['Sparta Praha', 88]], { rekord_goly: 'Ano', tomek_body: 30, icetime: 'Jan Novák' });
assert.strictEqual(r.length, SL.POCET_TIPU);
assert.strictEqual(r[SL.JMENO], 'Test');
assert.strictEqual(r[SL.ZOLIK_OD], 'Třinec'); assert.strictEqual(r[SL.ZOLIK_OD + 1], '95');
assert.strictEqual(r[SL.ZOLIK_OD + 5], '88');
assert.strictEqual(r[42], 'Ano'); assert.strictEqual(r[47], '30'); assert.strictEqual(r[45], 'Jan Novák');
assert.strictEqual(r[SL.DATUM], '1.1.2026');
assert.strictEqual(E.HLAVICKA.length, SL.POCET);
assert.ok(E.HLAVICKA.slice(0, SL.POCET_TIPU).every(h => h !== ''), 'hlavička Tipy bez děr');
console.log('✔ mapování řádku a hlavička');

// 2) bez výsledků → 0 bodů všude
let v = E.vyhodnot(r, new Array(SL.POCET).fill(''));
assert.strictEqual(v.celkem, 0); assert.strictEqual(v.zolici.celkem, 0); assert.strictEqual(v.umisteni.presne, 0);
// nuly ze vzorců = zatím neznámé
const nuly = new Array(SL.POCET).fill(0);
assert.strictEqual(E.jsouVysledky(nuly), false);
v = E.vyhodnot(r, nuly); assert.strictEqual(v.celkem, 0);
console.log('✔ bez výsledků nula');

// 3) přesná trefa všeho: pořadí = oficiální, žolíci Třinec (8.), Pardubice (5.), Sparta (7.)
const body = [99, 93, 90, 88, 85, 80, 78, 75, 70, 65, 60, 55, 50, 43];  // body týmů podle místa
const ok = vysledky(T, body, {});
v = E.vyhodnot(r, ok);
assert.strictEqual(v.umisteni.presne, 14);
assert.strictEqual(v.umisteni.nasobitel, 1.4);
// základ 14*10 = 140, žolíci +3*10 = 170, *1.4 = 238
assert.strictEqual(v.umisteni.soucet, 170);
assert.strictEqual(v.umisteni.celkem, 238);
assert.deepStrictEqual(v.umisteni.body[7], 20); assert.deepStrictEqual(v.umisteni.bodyZaklad[7], 10); assert.strictEqual(v.umisteni.zolik[7], true);
assert.strictEqual(v.umisteni.zolik[0], false);
// žolík body: Třinec je 8. → 75 b., tip 95 → 0; Pardubice 5. → 85, tip 90 → rozdíl 5 → 0; Sparta 7. → 78, tip 88 → 0
assert.strictEqual(v.zolici.celkem, 0);
assert.strictEqual(v.zolici.polozky[0].skutecne, '75'); assert.strictEqual(v.zolici.polozky[0].pozice, 7);
console.log('✔ umístění se žolíky a násobkem');

// 4) žolík body – škála 2x
const r2 = tip(T, [['Třinec', 75], ['Pardubice', 84], ['Sparta Praha', 76]]);
v = E.vyhodnot(r2, ok);
assert.deepStrictEqual(v.zolici.polozky.map(p => p.body), [20, 16, 12]);   // přesně, o 1 vedle, o 2 vedle (škála 2x)
assert.strictEqual(v.zolici.celkem, 48);
assert.strictEqual(v.celkem, 238 + 48);
console.log('✔ tipy na body žolíků');

// 5) žolík na jiném místě než tipováno: tip Třinec 1., skutečně 8. → 10-7 = 3 → žolík 6
const poradi2 = ['Třinec'].concat(T.filter(t => t !== 'Třinec'));
const r3 = tip(poradi2, [['Třinec', 75], ['Kladno', 93], ['Liberec', 90]]);
v = E.vyhodnot(r3, ok);
const kTrinec = T.indexOf('Třinec');
assert.strictEqual(v.umisteni.bodyZaklad[kTrinec], 3); assert.strictEqual(v.umisteni.body[kTrinec], 6);
// Kladno: tip 3. (index 2), skutečně 2. → 9 → žolík 18; Liberec tip 4., skut. 3. → 9 → 18
assert.strictEqual(v.umisteni.body[1], 18); assert.strictEqual(v.umisteni.body[2], 18);
assert.strictEqual(v.zolici.polozky[0].body, 20);           // Třinec 75 přesně
assert.strictEqual(v.zolici.polozky[1].body, 20);           // Kladno 93 přesně
assert.strictEqual(v.zolici.polozky[2].body, 20);           // Liberec 90 přesně
console.log('✔ žolík mimo tipované místo');

// 6) žolík zatím bez známých bodů (sloupec prázdný) → 0, ale umístění se násobí
const okBezBodu = vysledky(T, [], {});
v = E.vyhodnot(r2, okBezBodu);
assert.strictEqual(v.zolici.celkem, 0); assert.strictEqual(v.zolici.polozky[0].skutecne, '');
assert.strictEqual(v.umisteni.celkem, 238);
console.log('✔ žolík bez bodů týmu');

// 7) starý řádek bez žolíků (36 sloupců) – nic nepadá
const stary = r.slice(0, 36);
v = E.vyhodnot(stary, ok);
assert.strictEqual(v.zolici.celkem, 0); assert.strictEqual(v.umisteni.celkem, 140 * 1.4);
assert.deepStrictEqual(E.zolikTymy(stary), ['', '', '']);
console.log('✔ starý řádek bez žolíků');

// 8) nové bonusové otázky
const r4 = tip(T, [], { rekord_goly: 'Ano', stransky_ruzicka: 'Ne', tym_nejmene_trestany: 'Olomouc', icetime: 'Jan Novák', procento_golu: 'Petr Král', tomek_body: 28, duda_angazma: 'ano', galvas_usa: 'Ano', tymgoly: 'Sparta Praha', baraz: 'Ne' });
const ok4 = vysledky(T, body, { rekord_goly: 'Ano', stransky_ruzicka: 'Ano', tym_nejmene_trestany: 'Olomouc', icetime: 'Jan Novák', procento_golu: 'petr král', tomek_body: 30, duda_angazma: 'Ano', galvas_usa: 'Ne', tymgoly: 'Sparta Praha, Pardubice', baraz: 'Ne' });
v = E.vyhodnot(r4, ok4);
const b = {}; v.bonusy.polozky.forEach(p => b[p.klic] = p.body);
assert.strictEqual(b.rekord_goly, 10); assert.strictEqual(b.stransky_ruzicka, 0); assert.strictEqual(b.tym_nejmene_trestany, 20);
assert.strictEqual(b.icetime, 20); assert.strictEqual(b.procento_golu, 20); assert.strictEqual(b.tomek_body, 6);
assert.strictEqual(b.duda_angazma, 10); assert.strictEqual(b.galvas_usa, 0); assert.strictEqual(b.tymgoly, 20); assert.strictEqual(b.baraz, 10);
assert.strictEqual(v.bonusy.celkem, 116);
console.log('✔ nové bonusové otázky');

// 9) bodyZaCislo s násobkem
assert.strictEqual(E.bodyZaCislo(10, 10, 2), 20); assert.strictEqual(E.bodyZaCislo(10, 14, 2), 4); assert.strictEqual(E.bodyZaCislo(10, 15, 2), 0);
assert.strictEqual(E.bodyZaCislo('99', '99'), 10);
console.log('✔ bodyZaCislo');
console.log('VŠECHNY TESTY BODOVÁNÍ PROŠLY');
