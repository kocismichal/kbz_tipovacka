// Přehled Extraligy musí přežít „zlý“ tip: hodnoty constructor / __proto__ (dřív shodily celý přehled,
// protože se používaly jako klíče obyčejného objektu) a kód v textech (nesmí se spustit).
const { chromium } = require('playwright');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { SCR } = require('./pomocne');

function tip(jmeno, klub, poradi, zolici, mistri) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => { p['misto' + (i + 1)] = t; });
  zolici.forEach((z, k) => { p['zolik' + (k + 1)] = z[0]; p['zolik' + (k + 1) + '_body'] = z[1]; });
  Object.assign(p, mistri);
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const KOD = '<img src=x onerror="window.__spusteno=1">';
const mistri = { zajic_vitez: 'Vilda', zajic1: 'Vilda', zajic2: 'Bonifác', zajic3: 'Tlusťoch', zajic4: 'Dudák' };
const zlePoradi = ['constructor', '__proto__', 'toString', KOD].concat(T.slice(4));
const tipy = [
  E.HLAVICKA.slice(0, SL.POCET_TIPU),
  tip('Vilém Franěk', 'Třinec', T, [['Třinec', 95], ['Pardubice', 90], ['Sparta Praha', 88]], mistri),
  tip('Fanda Běžný', 'Vítkovice', T.slice(1).concat(T.slice(0, 1)), [['Vítkovice', 60], ['Pardubice', 92], ['Třinec', 80]], mistri),
  tip('Zlý ' + KOD, '__proto__', zlePoradi, [['__proto__', 50], ['constructor', 60], [KOD, 70]],
    { zajic_vitez: 'constructor', zajic1: '__proto__', zajic2: 'constructor', zajic3: 'hasOwnProperty', zajic4: KOD }),
];
const hotovo = () => {
  const r = new Array(SL.POCET).fill('');
  for (let i = 0; i < 14; i++) { r[SL.MISTO_OD + i] = T[i]; r[SL.BODY_MISTO_OD + i] = 90 - 3 * i; }
  return [E.HLAVICKA, r];
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const chyby = [];
  page.on('pageerror', (e) => chyby.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED') && !m.text().includes('404')) chyby.push('console: ' + m.text()); });
  page.on('dialog', (d) => { chyby.push('dialog: ' + d.message()); d.dismiss(); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 404, body: '' });
    if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
    if (url.includes('script.google.com')) {
      const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : hotovo()) });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:8765/' + (process.env.STRANKA || '2627_prehled_extraliga.html'));   // STRANKA = zkouška na jiné verzi
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => ({
    pocet: document.getElementById('count-players').innerText.trim(),
    mistriStat: document.getElementById('mistri-stat-container').innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
    zolici: document.getElementById('zolici-container').innerText.replace(/\s+/g, ' ').trim().length,
    matice: document.querySelectorAll('#matrix-klub option').length,
    spusteno: window.__spusteno === 1,
    znecisteno: ['pocet', 'soucetBodu', 'pocetBodu', '0'].filter((k) => ({})[k] !== undefined),
    nedostupne: document.body.innerText.includes('Data zatím nejsou k dispozici'),
    kodJakoText: document.body.innerText.includes('onerror='),
  }));
  await page.screenshot({ path: SCR + '/zly_tip.png', fullPage: false });
  await browser.close();

  let ok = true;
  const over = (podminka, popis, detail) => { console.log((podminka ? 'OK    ' : 'CHYBA ') + popis + (podminka || detail === undefined ? '' : ' → ' + JSON.stringify(detail))); if (!podminka) ok = false; };
  over(info.pocet === '3', 'přehled se načetl i se zlým tipem (3 tipující)', info.pocet);
  over(!info.nedostupne, 'přehled nespadl do hlášky „Data zatím nejsou k dispozici“');
  over(/Kdo vyhraje tipovačku Mistrů/i.test(info.mistriStat), 'statistiky Mistrů se vykreslily', info.mistriStat);
  over(info.zolici > 50 && info.matice >= 2, 'žolíci i filtr klubů se vykreslili', { zolici: info.zolici, matice: info.matice });
  over(!info.spusteno, 'kód vložený do jména, týmu a žolíka se nespustil');
  over(info.kodJakoText, 'kód se zobrazil jen jako text');
  over(info.znecisteno.length === 0, 'tip nezměnil vestavěné objekty prohlížeče', info.znecisteno);
  over(chyby.length === 0, 'žádná chyba ve stránce', chyby);
  console.log(ok ? 'ZLÝ TIP: přehled drží.' : 'ZLÝ TIP: selhalo.');
  process.exit(ok ? 0 : 1);
})();
