// Našeptávač jmen hráčů ve formuláři (soupisky z hokej.cz v extraliga_soupisky.js):
// nabídka podle začátku jména i příjmení, klub u každého hráče, výběr klávesnicí, brankáři mimo icetime.
const { chromium } = require('playwright');
const { SCR } = require('./pomocne');

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // Loga a fonty se v testu blokují (offline), jejich "Failed to load resource" není chyba stránky
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
    if (url.includes('script.google.com')) return route.fulfill({ status: 200, body: '' });
    return route.abort();   // fonty, ikony, loga – offline
  });
  await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html');
  await page.waitForTimeout(300);

  const data = await page.evaluate(() => ({
    nacteno: typeof EXTRALIGA_SOUPISKY !== 'undefined' && Array.isArray(EXTRALIGA_SOUPISKY.hraci),
    pocet: typeof EXTRALIGA_SOUPISKY !== 'undefined' ? EXTRALIGA_SOUPISKY.hraci.length : 0,
    tymy: typeof EXTRALIGA_SOUPISKY !== 'undefined' ? new Set(EXTRALIGA_SOUPISKY.hraci.map(h => h.t)).size : 0,
    obaleno: document.querySelectorAll('#bonusove-otazky .hrac-naseptavac input[type="text"]').length,
    textovych: document.querySelectorAll('#bonusove-otazky input[type="text"]').length,
  }));
  over(data.nacteno && data.pocet >= 300, 'soupisky načtené (aspoň 300 hráčů)', data);
  over(data.tymy === 14, 'hráči ze všech 14 klubů', data.tymy);
  over(data.obaleno === data.textovych && data.obaleno >= 4, 'našeptávač je u všech textových otázek na hráče', data);

  const polozky = (sel) => page.evaluate(s => Array.from(document.querySelector(s).parentNode.querySelectorAll('.hrac-polozka')).map(p => p.textContent.replace(/\s+/g, ' ').trim()), sel);
  const viditelna = (sel) => page.evaluate(s => getComputedStyle(document.querySelector(s).parentNode.querySelector('.hrac-nabidka')).display === 'block', sel);

  // Začátek příjmení bez diakritiky → nabídka s klubem
  await page.fill('#otazka-strelec', 'str');
  await page.waitForTimeout(100);
  let seznam = await polozky('#otazka-strelec');
  over(await viditelna('#otazka-strelec'), 'nabídka se po napsání "str" zobrazí');
  over(seznam.some(t => t.startsWith('Matěj Stránský') && t.includes('Pardubice')), 'Matěj Stránský s klubem Pardubice v nabídce', seznam.slice(0, 5));
  over(seznam.length <= 12, 'nabídka má nejvýš 12 položek', seznam.length);
  const vyrez = await page.evaluate(() => { const r = document.getElementById('otazka-strelec').getBoundingClientRect(); return { y: Math.max(0, r.top + window.scrollY - 90) }; });
  await page.screenshot({ path: SCR + 'naseptavac.png', fullPage: true, clip: { x: 0, y: vyrez.y, width: 1000, height: 520 } });

  // Jméno i příjmení, každé jen začátkem
  await page.fill('#otazka-strelec', 'mat str');
  await page.waitForTimeout(100);
  seznam = await polozky('#otazka-strelec');
  over(seznam.length >= 1 && seznam.every(t => t.startsWith('Matěj Stránský')), '"mat str" najde jen Matěje Stránského', seznam);

  // Výběr klávesnicí: šipka dolů + Enter vyplní přesné jméno, nabídka se zavře, formulář se neodešle
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  over((await page.inputValue('#otazka-strelec')) === 'Matěj Stránský', 'Enter vyplní "Matěj Stránský"', await page.inputValue('#otazka-strelec'));
  over(!(await viditelna('#otazka-strelec')), 'nabídka se po výběru zavře');
  over((await page.evaluate(() => document.getElementById('vysledek').textContent.trim())) === '', 'Enter v nabídce formulář neodeslal');

  // Brankáři: v otázce na střelce jsou, u icetime (hráči v poli) ne
  await page.fill('#otazka-strelec', 'subban');
  await page.waitForTimeout(100);
  over((await polozky('#otazka-strelec')).some(t => t.startsWith('Malcolm Subban')), 'brankář Subban je v nabídce střelců');
  await page.fill('#otazka-icetime', 'subban');
  await page.waitForTimeout(100);
  over(!(await viditelna('#otazka-icetime')), 'brankář Subban není v nabídce icetime (hráči v poli)');
  await page.fill('#otazka-icetime', 'Petr Tom');
  await page.waitForTimeout(100);
  seznam = await polozky('#otazka-icetime');
  over(seznam.some(t => t.startsWith('Petr Tomek') && t.includes('Karlovy Vary')), 'Petr Tomek s klubem Karlovy Vary u icetime', seznam);

  // Neznámé jméno: nabídka zmizí, volný text zůstane
  await page.fill('#otazka-trestyhrac', 'Xyz Nikdo');
  await page.waitForTimeout(100);
  over(!(await viditelna('#otazka-trestyhrac')), 'pro neznámé jméno není nabídka');
  over((await page.inputValue('#otazka-trestyhrac')) === 'Xyz Nikdo', 'volný text zůstává');

  // Escape zavře nabídku, text zůstane
  await page.fill('#otazka-procento_golu', 'nel');
  await page.waitForTimeout(100);
  over(await viditelna('#otazka-procento_golu'), 'nabídka pro "nel"');
  await page.keyboard.press('Escape');
  over(!(await viditelna('#otazka-procento_golu')), 'Escape zavře nabídku');
  over((await page.inputValue('#otazka-procento_golu')) === 'nel', 'text po Escape zůstává');

  over(errors.length === 0, 'bez chyb v konzoli', errors);
  await browser.close();
  console.log(chyb ? `\n${chyb} kontrol selhalo.` : '\nNašeptávač: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
