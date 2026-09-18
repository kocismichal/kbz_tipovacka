// Graf vývoje tipovačky z denních snímků tabulky (2627_extraliga_historie.json): série Mistrů + nejlepších
// fanoušků, přepínač body/pořadí, ruční přidání tipujícího, bez historie je sekce skrytá.
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
      legenda: document.getElementById('graf-legenda').innerText.replace(/\s+/g, ' ').trim(),
      popis: document.getElementById('graf-popis').innerText,
      moznosti: document.getElementById('graf-hrac').options.length,
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
    over(g.jmena.length === 8 && g.jmena.some(j => j.startsWith('Vilém Franěk')) && g.jmena.some(j => j.startsWith('Mistři Světa')), 'jména u konců čar včetně společného tipu', g.jmena);
    over(g.osaX.join(' ') === '16. 9. 17. 9. 18. 9.', 'osa X = data snímků', g.osaX);
    over(/b\./.test(g.legenda) && /3 snímků/.test(g.popis), 'legenda s body a popis počtu snímků', { legenda: g.legenda.slice(0, 80), popis: g.popis.slice(0, 60) });
    over(g.moznosti === 11, 'výběr obsahuje všech 10 tipujících', g.moznosti);

    // Body odpovídají průběžnému vyhodnocení podle snímku (Fanda Třetí trefil poslední snímek přesně: 14×10×1,4 = 196)
    const body = await page.evaluate(() => { const x = grafData().find(x => x.h.jmeno === 'Fanda Třetí'); return { body: x.body, poradi: x.poradi }; });
    over(body.body[2] === 196 && body.poradi[2] === 1, 'Fanda Třetí má v posledním snímku 196 b. a 1. místo', body);

    // Přepínač pořadí: osa Y v místech, jméno končí ".)"
    await page.click('#btn-graf-poradi');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.jmena.every(j => /\(\d+\.\)$/.test(j)) && /místo/.test(g.legenda), 'režim pořadí: hodnoty jako místa', { jmena: g.jmena.slice(0, 3), legenda: g.legenda.slice(0, 60) });
    await page.click('#btn-graf-body');

    // Přidání tipujícího výběrem a odebrání křížkem
    const idxPaty = await page.evaluate(() => vsichniHraci.find(h => h.jmeno === 'Fanda Pátý').originalIndex);
    await page.selectOption('#graf-hrac', String(idxPaty));
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 9 && g.jmena.some(j => j.startsWith('Fanda Pátý')), 'přidaný tipující má vlastní čáru', g.jmena);
    over((await page.evaluate(() => document.getElementById('graf-hrac').value)) === '', 'výběr se po přidání vyprázdní');
    await page.screenshot({ path: SCR + 'graf.png', fullPage: false, clip: await page.evaluate(() => { const r = document.getElementById('sekce-graf').getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 20); return { x: 0, y: 0, width: 1300, height: Math.min(720, r.height + 40) }; }) });
    await page.click('#graf-legenda button');
    await page.waitForTimeout(100);
    g = await stavGrafu();
    over(g.polyline === 8, 'křížek v legendě čáru odebere', g.polyline);

    over(errors.length === 0, 'bez chyb v konzoli', errors);
    await page.close();
  }
  await browser.close();
  console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Graf: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
