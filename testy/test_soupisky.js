// Stahování soupisek (skripty/stahni_soupisky.js): opakované pokusy, náhrada z minulé soupisky,
// když hokej.cz klub odmítne (runnerům GitHubu umí vrátit HTTP 403), a mez, kdy už jde o chybu.
const E = require('../extraliga_spolecne.js');
const S = require('../skripty/stahni_soupisky.js');
const T = E.KONFIG.TYMY;

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

// Stránka soupisky, jak ji vrací hokej.cz: sekce s nadpisem a tabulkou hráčů
const stranka = (jmena) => `<h2>Soupiska 2026-2027</h2>
  <h3>Brankáři</h3><table class="table-soupiska"><tr><td>1</td><td>${jmena[0]}</td><td>1998</td></tr></table>
  <h3>Obránci</h3><table class="table-soupiska">${jmena.slice(1, 9).map((j, i) => `<tr><td>${i + 2}</td><td>${j}</td><td>1999</td></tr>`).join('')}</table>
  <h3>Útočníci</h3><table class="table-soupiska">${jmena.slice(9).map((j, i) => `<tr><td>${i + 20}</td><td>${j}</td><td>2000</td></tr>`).join('')}</table>`;
const jmenaKlubu = (tym) => Array.from({ length: 18 }, (_, i) => 'Hráč' + i + ' ' + E.bezDiakritiky(tym).replace(/[^a-z]/g, ''));
const tymZUrl = (url) => T.find((t) => url.includes(S.KLUBY[t]));

// Minulá soupiska v souboru: každý klub má 20 hráčů
const stavajici = { hraci: [].concat(...T.map((t) => Array.from({ length: 20 }, (_, i) => ({ j: 'Starý' + i + ' Hráč', t, p: i === 0 ? 'B' : (i < 8 ? 'O' : 'U') })))) };
const bezPauzy = () => Promise.resolve();

function stahniFn(padajici) {
  const pocty = {};
  const fn = async (url) => {
    const tym = tymZUrl(url);
    pocty[tym] = (pocty[tym] || 0) + 1;
    if (padajici.includes(tym)) throw new Error('HTTP 403 pro ' + url);
    return stranka(jmenaKlubu(tym));
  };
  fn.pocty = pocty;
  return fn;
}

(async () => {
  // 1) všechno v pořádku
  let fn = stahniFn([]);
  let v = await S.soupiskyKlubu(fn, stavajici, bezPauzy);
  over(v.nahrazene.length === 0 && v.vsichni.length === T.length * 18, 'běžný běh stáhne všechny kluby', { nahrazene: v.nahrazene, hracu: v.vsichni.length });
  over(T.every((t) => fn.pocty[t] === 1), 'každý klub se stahuje jednou', fn.pocty);
  over(S.zkontroluj(v.vsichni).length === 0, 'stažené soupisky projdou kontrolou', S.zkontroluj(v.vsichni));

  // 2) jeden klub odmítnutý – zkusí se třikrát a pak se vezme minulá soupiska
  fn = stahniFn(['Karlovy Vary']);
  v = await S.soupiskyKlubu(fn, stavajici, bezPauzy);
  over(fn.pocty['Karlovy Vary'] === S.POKUSY, 'odmítnutý klub se zkouší ' + S.POKUSY + '×', fn.pocty['Karlovy Vary']);
  over(v.nahrazene.join() === 'Karlovy Vary', 'odmítnutý klub se označí jako nahrazený', v.nahrazene);
  const kv = v.vsichni.filter((h) => h.t === 'Karlovy Vary');
  over(kv.length === 20 && kv.every((h) => /^Starý/.test(h.j)), 'u odmítnutého klubu se použije minulá soupiska', kv.length);
  over(v.vsichni.filter((h) => h.t === 'Kladno').length === 18, 'ostatní kluby se stáhnou normálně', v.vsichni.filter((h) => h.t === 'Kladno').length);
  over(S.zkontroluj(v.vsichni).length === 0, 'výsledek s náhradou projde kontrolou', S.zkontroluj(v.vsichni));

  // 3) odmítnutý klub, který v souboru ještě není → chyba, ať se na to přijde
  const bezKV = { hraci: stavajici.hraci.filter((h) => h.t !== 'Karlovy Vary') };
  let chyba = null;
  try { await S.soupiskyKlubu(stahniFn(['Karlovy Vary']), bezKV, bezPauzy); } catch (e) { chyba = e.message; }
  over(chyba && /Karlovy Vary/.test(chyba) && /403/.test(chyba), 'bez minulé soupisky skript skončí chybou', chyba);

  // 4) první stažení vůbec (prázdný soubor) a všechno v pořádku
  v = await S.soupiskyKlubu(stahniFn([]), null, bezPauzy);
  over(v.vsichni.length === T.length * 18, 'bez minulého souboru se dá stáhnout všechno', v.vsichni.length);

  // 5) hodně odmítnutých klubů = mez pro chybu ve skriptu
  v = await S.soupiskyKlubu(stahniFn(T.slice(0, 4)), stavajici, bezPauzy);
  over(v.nahrazene.length === 4 && v.nahrazene.length > S.MAX_NAHRAZENYCH, 'čtyři nahrazené kluby jsou nad mezí (skript skončí chybou)', v.nahrazene);

  // 6) kontrola pozná neúplnou soupisku
  const malo = v.vsichni.filter((h) => !(h.t === 'Kladno' && h.p !== 'B'));
  over(S.zkontroluj(malo).some((x) => /Kladno/.test(x)), 'kontrola pozná klub s málo hráči', S.zkontroluj(malo));

  console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Soupisky: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
