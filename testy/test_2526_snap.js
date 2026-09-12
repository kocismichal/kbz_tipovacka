const { chromium } = require('playwright');
const fs = require('fs');
const { SCR, KOREN } = require('./pomocne');
const snap = fs.readFileSync(require('path').join(KOREN, '2526_extraliga_data.json'), 'utf8');
(async () => {
  const browser = await chromium.launch();
  for (const [n, w, h] of [['desktop', 1300, 900], ['ipad', 1024, 1366]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('2526_extraliga_data.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: snap });
      if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
      if (url.includes('i.imgur.com/isU5OoU')) return route.fulfill({ status: 404, body: '' });   // mrtvé logo Pardubic
      if (url.includes('i.imgur.com')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#1f5fbf"/></svg>' });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2526_extraliga.html');
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => ({
      pocet: document.getElementById('count-players').innerText, vitez: document.getElementById('vitez-jmeno').innerText,
      top3: Array.from(document.querySelectorAll('.podium-card .podium-jmeno')).map(e => e.innerText.trim()),
      radky: Array.from(document.querySelectorAll('#tabulka-telo tr')).slice(0, 4).map(tr => tr.innerText.replace(/\s+/g, ' ').trim()),
      mistri: Array.from(document.querySelectorAll('#mistri-container .zajic-card')).map(c => c.innerText.replace(/\s+/g, ' ').trim()),
      spravne: document.getElementById('vysledky-container').innerText.replace(/\s+/g, ' ').slice(0, 260),
      kocis: (() => { const h = vsichniHraci.find(x => x.jmeno === 'Michal Kočiš'); return h ? { celkem: h.body.celkem, poradi: h.poradiKat.celkem, sheet: h.umisteniSheet, tipy: h.poradi.slice(0, 3), bodyMista: h.bodyMista.slice(0, 4), bodyOtazky: h.bodyOtazky } : null; })(),
      fallbackLoga: Array.from(document.querySelectorAll('img')).filter(i => i.src.endsWith('logo_neznamy.svg')).length,
      mistriStat: document.getElementById('mistri-stat-container').innerText.replace(/\s+/g, ' ').slice(0, 200)
    }));
    console.log('===', n, '===', JSON.stringify(info, null, 1));
    const modal = await page.evaluate(() => { const h = vsichniHraci.find(x => x.jmeno === 'Michal Kočiš'); otevriModalJeden(h); const el = document.getElementById('playerModalContent'); return { stats: Array.from(el.querySelectorAll('.modal-stat-box')).map(b => b.innerText.replace(/\s+/g, ' ')), tip: el.querySelectorAll('.teams-grid-8x2')[1].innerText.replace(/\s+/g, ' ').slice(0, 220), bonus: Array.from(el.querySelectorAll('.bonus-item')).slice(0, 5).map(b => b.innerText.replace(/\s+/g, ' ')), ikony: el.querySelectorAll('.shoda-ano').length + '/' + el.querySelectorAll('.shoda-ne').length }; });
    console.log('karta Kočiš:', JSON.stringify(modal, null, 1));
    await page.screenshot({ path: `${SCR}v2526s_modal_${n}.png` });
    await page.evaluate(() => zavriModal('playerModal'));
    await page.screenshot({ path: `${SCR}v2526s_${n}.png`, fullPage: true });
    console.log('chyby:', errors);
    await page.close();
  }
  await browser.close();
})();
