const { chromium } = require('playwright');
const fs = require('fs'); const assert = require('assert');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { SCR, KOREN } = require('./pomocne');
const spolecne = fs.readFileSync(require('path').join(KOREN, 'extraliga_spolecne.js'), 'utf8');
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#1f5fbf"/></svg>';

function tip(jmeno, klub, poradi, zolici, bonusy) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  (zolici || []).forEach((z, k) => { p['zolik' + (k + 1)] = z[0]; p['zolik' + (k + 1) + '_body'] = z[1]; });
  Object.assign(p, bonusy || {});
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const bonusy = { body_mistr: 99, rozdil_1_2: 4, body_posledni: 45, rekord_goly: 'Ano', tymgoly: 'Sparta Praha', baraz: 'Ne', strelec: 'Matěj Stránský', tomek_body: 28 };
const rot = n => T.slice(n).concat(T.slice(0, n));
const jsonPoradi = rot(7);                       // pořadí ze snímku = jiné než v listu
const tipy = [E.HLAVICKA.slice(0, SL.POCET_TIPU), tip('Přesný Tip', 'Třinec', jsonPoradi, [['Třinec', 20], ['Pardubice', 18], ['Sparta Praha', 30]], bonusy), tip('Listový Tip', 'Kladno', T, [], bonusy)];
function hotovo(sPoradim) {
  const r = new Array(SL.POCET).fill('');
  for (let i = 0; i < 14; i++) { r[SL.MISTO_OD + i] = sPoradim ? T[i] : ''; r[SL.BODY_MISTO_OD + i] = sPoradim ? 50 - i : ''; }
  r[E.BONUSY.find(q => q.klic === 'tymgoly').idx] = 'Sparta Praha'; r[E.BONUSY.find(q => q.klic === 'rekord_goly').idx] = 'Ano';
  return [E.HLAVICKA, r];
}
const stav = { sezona: '2026/27', aktualizovano: '2026-10-05T04:31:00Z', zdroj: 'hokej.cz', poradi: jsonPoradi.map((t, i) => ({ tym: t, zapasy: 5 + (i % 2), body: 30 - i * 2 })) };

(async () => {
  const browser = await chromium.launch();
  const scenare = [
    { n: 'po uzávěrce + JSON', bodovaniOd: '2020-01-01T00:00:00', json: stav, sheet: hotovo(true) },
    { n: 'po uzávěrce + neplatný JSON (13 týmů)', bodovaniOd: '2020-01-01T00:00:00', json: { poradi: stav.poradi.slice(1) }, sheet: hotovo(true) },
    { n: 'před uzávěrkou (odpovědi v listu se neukazují)', bodovaniOd: '2099-01-01T00:00:00', json: stav, sheet: hotovo(true) },
  ];
  for (const sc of scenare) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('extraliga_spolecne.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: spolecne.replace(/BODOVANI_OD: "[^"]+"/, `BODOVANI_OD: "${sc.bodovaniOd}"`) });
      if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sc.json) });
      if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765')) || url.startsWith('http://127.0.0.1:8765')) return route.continue();
      if (url.includes('script.google.com')) { const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || ''); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : sc.sheet) }); }
      if (url.includes('i.imgur.com')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html'); await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const c = document.getElementById('aktualni-stav-container');
      const poradi = [...c.querySelectorAll('.team-col img')].map(i => i.title);
      const body = [...c.querySelectorAll('.team-col .t-pts')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
      const radky = [...document.querySelectorAll('#tabulka-telo tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim());
      let karta = '';
      if (typeof vsichniHraci !== 'undefined' && vsichniHraci.length) { otevriModalJeden(vsichniHraci[0]); karta = document.getElementById('playerModalContent').innerText.replace(/\s+/g, ' '); zavriModal('playerModal'); }
      return { text: c.innerText.replace(/\s+/g, ' ').slice(0, 260), poradi, body, radky, bodovaniAktivni, maStav: !!stavTabulky, karta: karta.slice(0, 900), spravneVKarte: /\(Sparta Praha\)|\(Ano\)/.test(karta) };
    });
    console.log('=== ' + sc.n + ' ===\n' + JSON.stringify(info, null, 1).slice(0, 1800));
    if (sc.n.startsWith('po uzávěrce + JSON')) {
      assert(info.bodovaniAktivni && info.maStav, 'bodování zapnuté se snímkem');
      assert.deepStrictEqual(info.poradi, jsonPoradi, 'pořadí ze snímku');
      assert(info.body[0].startsWith('30 b.') && info.body[0].includes('5 z.'), 'body a zápasy ze snímku');
      assert(info.text.includes('Tabulka aktualizována') && info.text.includes('hokej.cz') && info.text.includes('průběžné pořadí'), 'text o aktualizaci');
      assert(info.radky[0].startsWith('1. Přesný Tip'), 'žebříček podle snímku');
      assert(info.spravneVKarte, 'správné odpovědi z listu v kartě po uzávěrce');
      const box = await (await page.$('#aktualni-stav-container')).boundingBox();
      await page.screenshot({ path: SCR + 'z_stav_json.png', fullPage: true, clip: { x: 0, y: box.y - 60, width: 1300, height: Math.min(box.height + 80, 700) } });
      const sh = await (await page.$('.stats-header')).boundingBox();
      await page.screenshot({ path: SCR + 'z_statistiky_2627.png', clip: { x: 0, y: Math.max(0, sh.y - 20), width: 1300, height: sh.height + 40 } });
    } else if (sc.n.includes('neplatný')) {
      assert(info.bodovaniAktivni && !info.maStav, 'neplatný snímek se ignoruje');
      assert.deepStrictEqual(info.poradi, T, 'pořadí z listu');
      assert(info.text.includes('ručního zápisu'), 'text o ručním zápisu');
      assert(info.radky[0].startsWith('1. Listový Tip'), 'žebříček podle listu');
    } else {
      assert(!info.bodovaniAktivni, 'před uzávěrkou bodování vypnuté');
      assert(!info.spravneVKarte, 'před uzávěrkou se správné odpovědi z listu neukazují');
      assert(info.text.includes('průběžné pořadí'), 'text o aktualizaci tabulky před uzávěrkou');
    }
    console.log('chyby:', errors);
    await page.close();
  }
  // panel statistik na vyhodnocení 25/26
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const snap = fs.readFileSync(require('path').join(KOREN, '2526_extraliga_data.json'), 'utf8');
  await page.route('**/*', route => { const url = route.request().url(); if (url.includes('2526_extraliga_data.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: snap }); if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765')) || url.startsWith('http://127.0.0.1:8765')) return route.continue(); if (url.includes('i.imgur.com')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO }); return route.abort(); });
  await page.goto('http://127.0.0.1:8765/2526_extraliga.html'); await page.waitForTimeout(900);
  const sh = await (await page.$('.stats-header')).boundingBox();
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.stats-header')).backgroundColor);
  console.log('stats-header pozadí 2526:', bg);
  assert(bg !== 'rgba(0, 0, 0, 0)', 'panel statistik má pozadí');
  await page.screenshot({ path: SCR + 'z_statistiky_2526.png', clip: { x: 0, y: Math.max(0, sh.y - 20), width: 1300, height: sh.height + 40 } });
  const koruna = await page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.src.includes('koruna')).map(i => i.src.split('/').pop() + ':' + i.naturalWidth));
  console.log('koruna:', koruna);
  await browser.close();
  console.log('TEST STAV PROŠEL');
})().catch(e => { console.error('CHYBA TESTU:', e.message); process.exit(1); });
