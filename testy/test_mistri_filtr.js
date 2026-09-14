// Společný tip podcastu „Mistři světa“ (pátá karta mezi Mistry, logo, štítek, bez koruny, není mezi fanoušky)
// a filtr matice „Jak vidíte tabulku vy?“ podle oblíbeného klubu (počty v nabídce, matice i procenta z podmnožiny).
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
// Pořadí, kde je daný tým první (zbytek v pořadí konfigurace)
const prvni = t => [t].concat(T.filter(x => x !== t));
const tipy = [
  E.HLAVICKA.slice(0, SL.POCET_TIPU),
  tip('Vilém Franěk', 'Plzeň', rot(1)),
  tip('Bonifác', 'Olomouc', rot(2)),
  tip('Jiří Tlusty', 'Kladno', rot(3)),
  tip('Radek Duda', 'Plzeň', rot(6)),                 // rot(4) by začínal Pardubicemi a kazil počty níž
  tip('Mistři Světa', 'Olomouc', rot(5)),          // společný tip podcastu, klub Olomouc
  tip('Fanda Pardubák', 'Pardubice', prvni('Pardubice')),
  tip('Fanda Perník', 'Pardubice', prvni('Pardubice')),
  tip('Fanda Dynamo', 'Pardubice', prvni('Pardubice')),
  tip('Fanda Sparťan', 'Sparta Praha', prvni('Sparta Praha')),
];
const hotovoPrazdne = [E.HLAVICKA, new Array(SL.POCET).fill('')];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 404, body: '' });
    if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
    if (url.includes('script.google.com')) {
      const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : hotovoPrazdne) });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html');
  await page.waitForTimeout(600);

  // --- Karty Mistrů ---
  const karty = await page.evaluate(() => Array.from(document.querySelectorAll('#mistri-container .zajic-card')).map(c => ({
    text: c.innerText.replace(/\s+/g, ' ').trim(),
    spolecny: c.classList.contains('spolecny-tip'),
    logo: (c.querySelector('.zajic-avatar img') || {}).getAttribute ? (c.querySelector('.zajic-avatar img') || { getAttribute: () => '' }).getAttribute('src') : '',
    koruna: !!c.querySelector('img[src*="koruna"]'),
  })));
  over(karty.length === 5, 'pět karet Mistrů (4 jednotlivci + společný tip)', karty.map(k => k.text.slice(0, 20)));
  const posledni = karty[karty.length - 1] || {};
  over(posledni.spolecny && posledni.text.startsWith('Mistři Světa'), 'společný tip je poslední karta', posledni.text);
  over(/spole[čc]n[ýy] tip/i.test(posledni.text), 'karta má štítek „Společný tip“ (CSS ho ukazuje velkými písmeny)', posledni.text);
  over(posledni.logo === 'mistri_sveta_logo.png', 'avatar společného tipu je logo podcastu', posledni.logo);
  over(karty.slice(0, 4).every(k => !k.spolecny), 'jednotliví Mistři nemají štítek', karty.map(k => k.spolecny));
  const fanousci = await page.evaluate(() => Array.from(document.querySelectorAll('#prehled-telo tr')).map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  over(fanousci.length === 4 && !fanousci.some(t => /Mistři Světa/.test(t)), 'společný tip není v přehledu fanoušků', fanousci);

  // --- Filtr matice podle klubu ---
  const moznosti = await page.evaluate(() => Array.from(document.getElementById('matrix-klub').options).map(o => o.textContent));
  over(moznosti[0] === 'Všichni tipující (9)', 'první možnost = všichni s počtem', moznosti[0]);
  over(moznosti[1] === 'Pardubice (3)', 'kluby seřazené od nejpočetnějšího, s počty', moznosti.slice(0, 4));
  over(moznosti.includes('Olomouc (2)') && moznosti.includes('Sparta Praha (1)'), 'v nabídce jsou i Olomouc (2) a Sparta Praha (1)', moznosti);

  const prvniBunka = () => page.evaluate(() => {
    const radek = Array.from(document.querySelectorAll('#table-umisteni-container tbody tr')).find(tr => tr.innerText.includes('Pardubice'));
    return radek ? radek.querySelectorAll('td')[1].innerText.trim() : null;
  });
  over((await prvniBunka()) === '3', 'bez filtru: Pardubice na 1. místě u 3 tipujících', await prvniBunka());
  over((await page.evaluate(() => getComputedStyle(document.getElementById('matrix-filtr-info')).display)) === 'none', 'bez filtru není informační štítek');

  await page.selectOption('#matrix-klub', 'Pardubice');
  await page.waitForTimeout(150);
  const info = await page.evaluate(() => ({ text: document.getElementById('matrix-filtr-info').innerText.replace(/\s+/g, ' ').trim(), display: getComputedStyle(document.getElementById('matrix-filtr-info')).display, logo: !!document.querySelector('#matrix-filtr-info img') }));
  over(info.display !== 'none' && /Pardubice/.test(info.text) && /3 tipující/.test(info.text), 'štítek: fanoušci klubu Pardubice · 3 tipující', info);
  over((await prvniBunka()) === '3', 'filtr Pardubice: 3 fanoušci mají Pardubice první', await prvniBunka());
  const spartaRadek = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('#table-umisteni-container tbody tr')).find(tr => tr.innerText.includes('Sparta Praha')); return r ? r.querySelectorAll('td')[1].innerText.trim() : null; });
  over(spartaRadek === '-', 'filtr Pardubice: Sparta nikdo první nedal', spartaRadek);
  await page.screenshot({ path: SCR + 'matice_filtr.png', fullPage: true });

  await page.click('#btn-prehled-procenta');
  await page.waitForTimeout(150);
  over((await prvniBunka()) === '100,0', 'procenta z podmnožiny: Pardubice první u 100,0 % fanoušků klubu', await prvniBunka());

  await page.selectOption('#matrix-klub', '');
  await page.waitForTimeout(150);
  over((await prvniBunka()) === '33,3', 'zpět na všechny: 3 z 9 = 33,3 %', await prvniBunka());
  over((await page.evaluate(() => getComputedStyle(document.getElementById('matrix-filtr-info')).display)) === 'none', 'po zrušení filtru štítek zmizí');

  over(errors.length === 0, 'bez chyb v konzoli', errors);
  await browser.close();
  console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Společný tip a filtr: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
