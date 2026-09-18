// Graf vývoje tipovačky z denních snímků tabulky (2627_extraliga_historie.json): legenda ve dvou řádcích
// se zaškrtávátky, osa podle rozsahu hodnot (ne od nuly), přepínač „jen Mistři“, přidání tipujícího psaním
// i výběrem ze seznamu, bez historie je sekce skrytá.
const { chromium } = require('playwright');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { SCR } = require('./pomocne');

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}
function tip(jmeno, klub, poradi) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const rot = n => T.slice(n).concat(T.slice(0, n));
const tipy = [
  E.HLAVICKA.slice(0, SL.POCET_TIPU),
  tip('Vilém Franěk', 'Plzeň', T),
  tip('Bonifác', 'Olomouc', rot(1)),
  tip('Jiří Tlusty', 'Kladno', rot(2)),
  tip('Radek Duda', 'Plzeň', rot(3)),
  tip('Mistři Světa', 'Olomouc', rot(4)),
  tip('Fanda První', 'Pardubice', rot(7)),
  tip('Fanda Druhý', 'Sparta Praha', rot(8)),
  tip('Fanda Třetí', 'Třinec', rot(9)),
  tip('Fanda Čtvrtý', 'Liberec', rot(10)),
  tip('Fanda Pátý', 'Kladno', rot(11)),
];
const snimek = (datum, poradi) => ({ datum, aktualizovano: datum + 'T04:30:00Z', poradi: poradi.map((t, i) => ({ tym: t, zapasy: 2, body: 20 - i })) });
const historie = { sezona: K.SEZONA, snimky: [snimek('2026-09-16', rot(7)), snimek('2026-09-17', rot(8)), snimek('2026-09-18', rot(9))] };
const stav = Object.assign({ sezona: K.SEZONA, zdroj: 'hokej.cz' }, historie.snimky[2]);
const hotovoPrazdne = [E.HLAVICKA, new Array(SL.POCET).fill('')];

(async () => {
  const browser = await chromium.launch();
  for (const sHistorii of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stav) });
      if (url.includes('2627_extraliga_historie.json')) return sHistorii ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(historie) }) : route.fulfill({ status: 404, body: '' });
      if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
      if (url.includes('script.google.com')) {
        const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || '');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : hotovoPrazdne) });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html');
    await page.waitForTimeout(700);

    const stavGrafu = () => page.evaluate(() => ({
      viditelny: document.getElementById('sekce-graf').style.display,
      bodovani: bodovaniAktivni,
      snimku: historieTabulky.length,
      polyline: document.querySelectorAll('#graf-platno polyline').length,
      kruhu: document.querySelectorAll('#graf-platno circle').length,
      jmena: Array.from(document.querySelectorAll('#graf-platno text.jmeno')).map(t => t.textContent),
      osaX: Array.from(document.querySelectorAll('#graf-platno text.popisek')).map(t => t.textContent).filter(t => /\d+\. \d+\./.test(t)),
      osaY: Array.from(document.querySelectorAll('#graf-platno text.popisek')).map(t => t.textContent).filter(t => !/\d+\. \d+\./.test(t)),
      radky: Array.from(document.querySelectorAll('#graf-legenda .graf-legenda-radek')).map(r => r.innerText.replace(/\s+/g, ' ').trim()),
      polozek: document.querySelectorAll('#graf-legenda .graf-polozka').length,
      zaskrtnutych: document.querySelectorAll('#graf-legenda input[type=checkbox]:checked').length,
      popis: document.getElementById('graf-popis').innerText,
      moznosti: document.getElementById('graf-hraci').options.length,
      hlaska: document.getElementById('graf-platno').innerText.trim(),
    }));

    if (!sHistorii) {
      const g = await stavGrafu();
      over(g.bodovani && g.viditelny === 'none' && g.snimku === 0, 'bez historie je sekce grafu skrytá (bodování přitom běží)', g);
      over(errors.length === 0, 'bez historie žádné chyby', errors);
      await page.close();
      continue;
    }

    let g = await stavGrafu();
    over(g.viditelny === 'block' && g.snimku === 3, 'sekce grafu se 3 snímky je vidět', g);
    over(g.polyline === 8, 'výchozí série: 5 Mistrů + 3 nejlepší fanoušci = 8 čar', g.polyline);
    over(g.kruhu === 24, '3 body na každou z 8 sérií', g.kruhu);
    over(g.osaX.join(' ') === '16. 9. 17. 9. 18. 9.', 'osa X = data snímků', g.osaX);
    over(g.moznosti === 10, 'seznam pro psaní obsahuje všech 10 tipujících', g.moznosti);

    // Legenda: dva řádky (Mistři, Tipující), vše zaškrtnuté
    over(g.radky.length === 2 && /^mistři:/i.test(g.radky[0]) && /^tipující:/i.test(g.radky[1]), 'legenda má řádek Mistři a řádek Tipující', g.radky.map(r => r.slice(0, 40)));
    over(g.radky[0].includes('Vilém Franěk') && g.radky[0].includes('Mistři Světa') && !g.radky[0].includes('Fanda'), 'první řádek jen Mistři vč. společného tipu', g.radky[0].slice(0, 120));
    over(g.radky[1].includes('Fanda') && !g.radky[1].includes('Vilém'), 'druhý řádek jen fanoušci', g.radky[1].slice(0, 120));
    over(g.polozek === 8 && g.zaskrtnutych === 8, 'osm položek, všechny zaškrtnuté', g);

    // Osa Y nezačíná od nuly (nejnižší hodnota v datech je hodně nad 0)
    const nuly = g.osaY.filter(t => t === '0');
    over(nuly.length === 0, 'osa Y nezačíná nulou (rozsah podle hodnot)', g.osaY);
    const minY = Math.min.apply(null, g.osaY.map(Number).filter(n => !isNaN(n)));
    over(minY >= 30, 'nejnižší popisek osy odpovídá nejmenší hodnotě v grafu', { osaY: g.osaY, minY });

    // Body odpovídají průběžnému vyhodnocení podle snímku (Fanda Třetí trefil poslední snímek přesně: 14×10×1,4 = 196)
    const body = await page.evaluate(() => { const x = grafData().find(x => x.h.jmeno === 'Fanda Třetí'); return { body: x.body, poradi: x.poradi }; });
    over(body.body[2] === 196 && body.poradi[2] === 1, 'Fanda Třetí má v posledním snímku 196 b. a 1. místo', body);

    // Odškrtnutí série v legendě
    await page.uncheck('#graf-serie-' + (await page.evaluate(() => vsichniHraci.find(h => h.jmeno === 'Bonifác').originalIndex)));
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 7 && !g.jmena.some(j => j.startsWith('Bonifác')), 'odškrtnutá série se nekreslí', { polyline: g.polyline, jmena: g.jmena });
    over(g.polozek === 8 && g.zaskrtnutych === 7, 'odškrtnutá položka v legendě zůstává', g);
    // Barvy ostatních se odškrtnutím nezmění (Vilém Franěk = první barva)
    const barvaVildy = await page.evaluate(() => { const t = [...document.querySelectorAll('#graf-platno text.jmeno')].find(t => t.textContent.startsWith('Vilém')); return t.getAttribute('fill'); });
    over(barvaVildy === '#c8102e', 'barvy sérií se odškrtnutím nemění', barvaVildy);
    await page.check('#graf-serie-' + (await page.evaluate(() => vsichniHraci.find(h => h.jmeno === 'Bonifác').originalIndex)));

    // Přepínač „jen Mistři“
    await page.check('#graf-jen-mistri');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 5 && g.jmena.every(j => !j.startsWith('Fanda')), 'jen Mistři: 5 čar bez fanoušků', { polyline: g.polyline, jmena: g.jmena });
    over(/^tipující:/i.test(g.radky[1]), 'řádek tipujících v legendě zůstává (jen ztlumený)', g.radky[1].slice(0, 40));
    await page.screenshot({ path: SCR + 'graf_jen_mistri.png', clip: await page.evaluate(() => { const r = document.getElementById('sekce-graf').getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 20); return { x: 0, y: 0, width: 1300, height: Math.min(700, r.height + 40) }; }) });
    await page.uncheck('#graf-jen-mistri');

    // Přidání tipujícího psaním jména (Enter) – i s diakritikou napsanou jinak
    await page.fill('#graf-hrac', 'fanda paty');
    await page.press('#graf-hrac', 'Enter');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 9 && g.jmena.some(j => j.startsWith('Fanda Pátý')), 'psané jméno přidá čáru', g.jmena);
    over((await page.inputValue('#graf-hrac')) === '', 'pole se po přidání vyprázdní');

    // Přidání výběrem ze seznamu (hodnota „Jméno (klub)“ jako z datalistu)
    await page.evaluate(() => { const i = document.getElementById('graf-hrac'); i.value = 'Fanda První (Pardubice)'; i.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 10 && g.jmena.some(j => j.startsWith('Fanda První')), 'výběr ze seznamu („Jméno (klub)“) přidá čáru', g.jmena);
    await page.screenshot({ path: SCR + 'graf.png', clip: await page.evaluate(() => { const r = document.getElementById('sekce-graf').getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 20); return { x: 0, y: 0, width: 1300, height: Math.min(760, r.height + 40) }; }) });

    // Neznámé jméno: nic se nepřidá, pole se označí
    await page.fill('#graf-hrac', 'Nikdo Neznámý');
    await page.press('#graf-hrac', 'Enter');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 10 && (await page.getAttribute('#graf-hrac', 'class') || '').includes('nenalezeno'), 'neznámé jméno nic nepřidá a pole se označí', g.polyline);
    await page.fill('#graf-hrac', '');

    // Odebrání ručně přidaného křížkem
    await page.click('#graf-legenda .graf-polozka button');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 9, 'křížek odebere ručně přidaného', g.polyline);

    // Režim pořadí: hodnoty jako místa, osa od nejlepšího místa
    await page.click('#btn-graf-poradi');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.jmena.every(j => /\(\d+\.\)$/.test(j)), 'režim pořadí: hodnoty jako místa', g.jmena.slice(0, 3));
    over(g.osaY.every(t => /^\d+\.$/.test(t)), 'osa Y v režimu pořadí má místa', g.osaY);
    await page.click('#btn-graf-body');

    // Odškrtnutí všeho → hláška místo grafu
    await page.evaluate(() => { grafSkryte = vsichniHraci.map(h => h.originalIndex); vykresliGraf(grafRezim); });
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 0 && /Zaškrtni aspoň jednoho/.test(g.hlaska), 'bez zaškrtnuté série je místo grafu hláška', g.hlaska.slice(0, 60));

    over(errors.length === 0, 'bez chyb v konzoli', errors);
    await page.close();
  }
  await browser.close();
  console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Graf: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
