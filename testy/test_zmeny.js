const { chromium } = require('playwright');
const fs = require('fs'); const assert = require('assert');
const { SCR, KOREN } = require('./pomocne');
const snap = fs.readFileSync(require('path').join(KOREN, '2526_extraliga_data.json'), 'utf8');
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#1f5fbf"/></svg>';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('2526_extraliga_data.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: snap });
    if (url.startsWith('http://127.0.0.1:8765') || (url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765'))) return route.continue();
    if (url.includes('i.imgur.com')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO });
    if (url.includes('script.google.com')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.abort();
  });
  await page.goto('http://127.0.0.1:8765/2526_extraliga.html');
  await page.waitForTimeout(1200);

  // 1) stupně vítězů: 1. místo vlevo
  const podium = await page.evaluate(() => [1, 2, 3].map(i => { const c = document.querySelector('.podium-card.misto-' + i); return { x: Math.round(c.getBoundingClientRect().left), jmeno: c.querySelector('.podium-jmeno').innerText.trim() }; }));
  console.log('podium:', JSON.stringify(podium));
  assert(podium[0].x < podium[1].x && podium[1].x < podium[2].x, 'stupně vítězů zleva 1-2-3');
  const pod = await page.$('.podium-card.misto-1'); const podBox = await (await pod.evaluateHandle(e => e.parentElement)).asElement().boundingBox();
  await page.screenshot({ path: SCR + 'z_podium.png', fullPage: true, clip: { x: 0, y: Math.max(0, podBox.y - 70), width: 1300, height: podBox.height + 100 } });

  // 2) karta hráče bez oblíbenosti Mistrů
  const karta = await page.evaluate(() => {
    const h = vsichniHraci.find(x => x.mistrPoradi.some(m => m) && x.mistrVitez) || vsichniHraci[0];
    otevriModalJeden(h); const t = document.getElementById('playerModalContent').innerText; zavriModal('playerModal');
    return { jmeno: h.jmeno, mistrPoradi: h.mistrPoradi, oblibenost: t.includes('Oblíbenost'), vitez: t.includes('Vítěz tipovačky Mistrů') };
  });
  console.log('karta:', JSON.stringify(karta));
  assert(!karta.oblibenost, 'karta nesmí obsahovat Oblíbenost'); assert(karta.vitez, 'karta má vítěze tipovačky Mistrů');

  // 3) matice v procentech bez znaku %
  await page.click('#btn-prehled-procenta'); await page.waitForTimeout(200);
  const mat = await page.evaluate(() => { const c = document.getElementById('table-umisteni-container'); const cells = [...c.querySelectorAll('tbody td')].slice(1, 15).map(td => td.innerText.trim()); return { cells, procentoVTabulce: c.querySelector('table').innerText.includes('%'), poznamka: c.innerText.slice(-80) }; });
  console.log('matice %:', JSON.stringify(mat));
  assert(!mat.procentoVTabulce, 'v tabulce nesmí být znak %'); assert(mat.cells.some(c => /^\d+,\d$/.test(c)), 'buňky jsou desetinná čísla');
  const matBox = await (await page.$('#table-umisteni-container')).boundingBox();
  await page.screenshot({ path: SCR + 'z_matice_procenta.png', fullPage: true, clip: { x: 0, y: matBox.y - 60, width: 1300, height: Math.min(matBox.height + 70, 700) } });
  await page.click('#btn-prehled-cisla'); await page.waitForTimeout(200);
  const matC = await page.evaluate(() => [...document.querySelectorAll('#table-umisteni-container tbody td')].slice(1, 15).map(td => td.innerText.trim()));
  console.log('matice čísla:', JSON.stringify(matC));

  // 4) TOP 10: správná odpověď vždy vidět (i mimo desítku, s pořadím a počtem)
  const top = await page.evaluate(() => [...document.querySelectorAll('#bonusy-ostatni-container .matrix-container')].map(c => {
    const nadpis = c.querySelector('th').innerText.replace(/\s+/g, ' ');
    const radky = [...c.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim());
    const spravna = radky.filter((r, i) => c.querySelectorAll('tbody tr')[i].querySelector('.fa-check'));
    return { nadpis: nadpis.slice(0, 70), pocetRadku: radky.length, spravna, posledni: radky[radky.length - 1] };
  }));
  top.forEach(t => console.log(JSON.stringify(t)));
  top.filter(t => t.nadpis.includes('správně:')).forEach(t => assert(t.spravna.length >= 1, 'chybí správná odpověď v ' + t.nadpis));
  const topBox = await page.evaluate(() => { const c = [...document.querySelectorAll('#bonusy-ostatni-container .matrix-container')].find(x => x.querySelector('th').innerText.includes('NA 1. MÍSTĚ')); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height }; });
  await page.screenshot({ path: SCR + 'z_top10.png', fullPage: true, clip: { x: topBox.x - 10, y: topBox.y - 10, width: topBox.w + 20, height: topBox.h + 20 } });
  console.log('chyby 2526:', errors);

  // 5) lišta: ročník na dlaždicích, přehled 26/27: procenta bez %
  const errors2 = []; page.on('pageerror', e => errors2.push(e.message));
  await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html'); await page.waitForTimeout(1000);
  const lista = await page.evaluate(() => ({ tiles: [...document.querySelectorAll('.main-navbar .nav-tile')].map(t => t.innerText.trim()), titles: [...document.querySelectorAll('.nav-group-title')].map(t => t.innerText.trim()), oriznuto: document.querySelector('.main-navbar').scrollWidth > document.querySelector('.main-navbar').clientWidth }));
  console.log('lišta:', JSON.stringify(lista));
  assert(lista.tiles.every(t => /2[56]\/2[67]/.test(t)), 'každá dlaždice má ročník'); assert(!lista.oriznuto, 'lišta není oříznutá');
  const fp = await page.evaluate(() => { const radek = []; EXTRALIGA.KONFIG.TYMY.forEach((t, j) => { radek[SL.MISTO_OD + j] = t; }); vsichniHraci = [{ radek }, { radek }]; return { f: formatProcenta(1), html: (() => { vykresliPrehledMatrix('procenta'); const c = document.getElementById('table-umisteni-container'); return { procento: c.querySelector('table').innerText.includes('%'), pozn: c.innerText.slice(-60) }; })() }; });
  console.log('přehled 26/27 procenta:', JSON.stringify(fp));
  assert(fp.f === '50,0' && !fp.html.procento, 'přehled 26/27 bez znaku %');
  await page.screenshot({ path: SCR + 'z_lista_1300.png', clip: { x: 0, y: 0, width: 1300, height: 110 } });

  // 6) formulář: text pravidel
  await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html'); await page.waitForTimeout(1000);
  const pravidla = await page.evaluate(() => document.querySelector('.rules-box, .pravidla, #pravidla') ? '' : [...document.querySelectorAll('.note')].map(n => n.innerText.replace(/\s+/g, ' ')).join('\n'));
  console.log('pravidla:\n' + pravidla);
  assert(pravidla.includes('finále play-off (vítěz i poražený finalista) = 10 b.'), 'pravidla finále 10 b.');
  const h4 = await page.$('text=SYSTÉM BODOVÁNÍ'); const hb = await h4.boundingBox();
  await page.screenshot({ path: SCR + 'z_pravidla.png', fullPage: true, clip: { x: 0, y: hb.y - 10, width: 1300, height: 330 } });
  console.log('chyby ostatní:', errors2);
  await browser.close();
  console.log('TEST ZMĚN PROŠEL');
})().catch(e => { console.error('CHYBA TESTU:', e.message); process.exit(1); });
