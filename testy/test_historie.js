// Historie snímků tabulky pro graf vývoje (skripty/stahni_tabulku_extraligy.js → aktualizujHistorii):
// nový bod přibude jen po odehraných zápasech, ve dnech bez zápasů se graf nemění.
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../extraliga_spolecne.js');
const { aktualizujHistorii } = require('../skripty/stahni_tabulku_extraligy.js');
const T = E.KONFIG.TYMY;

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

const soubor = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'historie-')), 'historie.json');
const cti = () => JSON.parse(fs.readFileSync(soubor, 'utf8'));
const dnu = () => cti().snimky.map(s => s.datum);

// Stav tabulky: pořadí podle zadaných dvojic [tým, zápasy, body]
function stav(datum, radky, statistiky) {
  const s = { sezona: E.KONFIG.SEZONA, aktualizovano: datum + 'T04:30:00.000Z', zdroj: 'hokej.cz',
    poradi: radky.map(([tym, zapasy, body]) => ({ tym, zapasy, body })) };
  if (statistiky) s.statistiky = statistiky;
  return s;
}
const zaklad = T.map((t, i) => [t, 2, 14 - i]);
// Po dalším kole: první dva týmy odehrály zápas navíc, vedoucí získal 3 body
const poKole = zaklad.map((r, i) => i < 2 ? [r[0], 3, r[2] + (i === 0 ? 3 : 0)] : r.slice());
// Přerovnání beze změny součtů (web prohodí týmy se stejnými body – nehrálo se)
const prerovnane = zaklad.slice(); [prerovnane[5], prerovnane[6]] = [prerovnane[6], prerovnane[5]];

// 1) první snímek
aktualizujHistorii(stav('2026-09-16', zaklad), soubor);
over(dnu().length === 1 && dnu()[0] === '2026-09-16', 'první snímek se uloží', dnu());

// 2) druhý den bez zápasů (identická tabulka) – žádný nový bod
aktualizujHistorii(stav('2026-09-17', zaklad), soubor);
over(dnu().length === 1 && dnu()[0] === '2026-09-16', 'den bez zápasů nepřidá bod do grafu', dnu());

// 3) den bez zápasů, ale web tabulku přerovnal – poslední snímek se jen aktualizuje
aktualizujHistorii(stav('2026-09-18', prerovnane), soubor);
let h = cti();
over(h.snimky.length === 1, 'přerovnání bez hraní nepřidá bod', dnu());
over(h.snimky[0].poradi[5].tym === prerovnane[5][0], 'poslední snímek má aktuální pořadí', h.snimky[0].poradi[5].tym);
over(h.snimky[0].datum === '2026-09-16' && h.snimky[0].aktualizovano.startsWith('2026-09-18'), 'datum snímku zůstává u hracího dne, čas se aktualizuje', { datum: h.snimky[0].datum, akt: h.snimky[0].aktualizovano });

// 4) statistiky bez hraní se doplní k poslednímu snímku
const statistiky = {}; T.forEach((t, i) => { statistiky[t] = { goly: 5 + i, obdrzene: 4, presilovky: 1, tresty: 10 + i }; });
aktualizujHistorii(stav('2026-09-18', prerovnane, statistiky), soubor);
h = cti();
over(h.snimky.length === 1 && h.snimky[0].statistiky && h.snimky[0].statistiky[T[0]].goly === 5, 'statistiky se doplní bez nového bodu', h.snimky.length);

// 5) odehrané kolo v nový den → nový bod
aktualizujHistorii(stav('2026-09-19', poKole, statistiky), soubor);
over(dnu().length === 2 && dnu()[1] === '2026-09-19', 'po odehraném kole přibude bod', dnu());

// 6) další zápasy týž den (večerní) → snímek dne se přepíše, bod nepřibude
const poVecerni = poKole.map((r, i) => i === 3 ? [r[0], r[1] + 1, r[2] + 3] : r.slice());
aktualizujHistorii(stav('2026-09-19', poVecerni, statistiky), soubor);
h = cti();
over(h.snimky.length === 2 && h.snimky[1].poradi[3].body === poVecerni[3][2], 'večerní zápasy přepíšou snímek téhož dne', { pocet: h.snimky.length, body: h.snimky[1].poradi[3].body });

// 7) reprezentační přestávka: tři dny bez zápasů za sebou
['2026-09-20', '2026-09-21', '2026-09-22'].forEach(d => aktualizujHistorii(stav(d, poVecerni, statistiky), soubor));
over(dnu().length === 2, 'tři dny bez zápasů nepřidají nic', dnu());

// 8) po přestávce se zase hrálo
const poPauze = poVecerni.map((r, i) => i === 7 ? [r[0], r[1] + 1, r[2] + 2] : r.slice());
aktualizujHistorii(stav('2026-09-23', poPauze, statistiky), soubor);
over(dnu().length === 3 && dnu()[2] === '2026-09-23', 'po přestávce přibude bod až s odehraným zápasem', dnu());

fs.rmSync(path.dirname(soubor), { recursive: true, force: true });
console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Historie: všechny kontroly prošly.');
process.exit(chyb ? 1 : 0);
