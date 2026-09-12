const { chromium } = require('playwright');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { SCR, KOREN } = require('./pomocne');
const fs = require('fs');
// loga týmů z imgur nejsou dostupná → místo nich lokální barevné SVG, ať je vidět oddělení od podkladu
const svgLogo = (txt, barva) => `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${barva}"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">${txt}</text></svg>`);
const barvy = ['#111', '#c8102e', '#1f5fbf', '#f5c400', '#222', '#0a7a3c', '#7a1f1f', '#333', '#0b5', '#0b2a4a', '#c60', '#1b3', '#600', '#fc0'];

function tip(jmeno, klub, poradi, zolici, bonusy, mistri) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  (zolici || []).forEach((z, k) => { p['zolik' + (k + 1)] = z[0]; p['zolik' + (k + 1) + '_body'] = z[1]; });
  Object.assign(p, bonusy || {}, mistri || {});
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const bonusyA = { body_mistr: 99, rozdil_1_2: 4, body_posledni: 45, rekord_goly: 'Ano', tymgoly: 'Sparta Praha', tympresilovky: 'Pardubice', tymfauly: 'Sparta Praha', tym_nejmene_trestany: 'Olomouc', baraz: 'Ne', strelec: 'Matěj Stránský', gol_strelec: 34, stransky_ruzicka: 'Ano', trestyhrac: 'John Ludvig', icetime: 'Michal Kempný', procento_golu: 'Anthony Nellis', tomek_body: 28, duda_angazma: 'Ne', galvas_usa: 'Ano' };
const rot = n => T.slice(n).concat(T.slice(0, n));
const mistri = { zajic_vitez: 'Vilda', zajic1: 'Vilda', zajic2: 'Bonifác', zajic3: 'Tlusťoch', zajic4: 'Dudák' };
const tipy = [E.HLAVICKA.slice(0, SL.POCET_TIPU),
  tip('Vilém Franěk', 'Třinec', T, [['Třinec', 95], ['Pardubice', 90], ['Sparta Praha', 88]], bonusyA, mistri),
  tip('Jan Homolka', 'Sparta Praha', rot(1), [['Sparta Praha', 99], ['Kometa Brno', 80], ['Liberec', 85]], bonusyA, mistri),
  tip('Jiří Tlustý', 'Kladno', rot(2), [['Kladno', 70], ['Pardubice', 93], ['Třinec', 75]], bonusyA, mistri),
  tip('Radek Duda', 'Karlovy Vary', rot(3), [['Karlovy Vary', 66], ['Pardubice', 91], ['Plzeň', 88]], bonusyA, mistri),
  tip('Fanoušek Starý', 'Plzeň', rot(4), [], bonusyA, mistri).slice(0, 36),
  tip('Fanda Nový', 'Vítkovice', rot(5), [['Vítkovice', 60], ['Pardubice', 92], ['Třinec', 80]], bonusyA, mistri)];
const bodyMist = [99, 93, 90, 88, 85, 80, 78, 75, 70, 65, 60, 55, 50, 43];
function hotovo(sVysledky) {
  const r = new Array(SL.POCET).fill('');
  for (let i = 0; i < 14; i++) { r[SL.MISTO_OD + i] = sVysledky ? T[i] : 0; r[SL.BODY_MISTO_OD + i] = sVysledky ? bodyMist[i] : 0; }
  if (sVysledky) { r[23] = 'Sparta Praha, Pardubice'; r[42] = 'Ano'; r[47] = 26; }
  return [E.HLAVICKA, r];
}

(async () => {
  const browser = await chromium.launch();
  const scenare = [
    { nazev: 'pred', vysledky: true, cas: null },                 // výsledky v tabulce, ale před uzávěrkou → jen tipy
    { nazev: 'live', vysledky: true, cas: '2026-10-05T12:00:00' } // po uzávěrce → bodování
  ];
  const sirky = [{ n: 'desktop', w: 1300, h: 900 }, { n: 'ipad', w: 1024, h: 1366 }, { n: 'mobil', w: 400, h: 850 }];
  const chyby = [];
  for (const sc of scenare) {
    for (const s of sirky) {
      const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
      page.on('pageerror', e => chyby.push(`${sc.nazev}/${s.n}: ${e.message}`));
      if (sc.cas) await page.clock.setFixedTime(new Date(sc.cas));
      await page.route('**/*', route => {
        const url = route.request().url();
        if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765'))) return route.continue();
        if (url.includes('script.google.com')) {
          const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || '');
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : hotovo(sc.vysledky)) });
        }
        if (url.includes('i.imgur.com')) {
          const i = Math.abs(url.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 14;
          return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${barvy[i]}"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="bold">${i + 1}</text></svg>` });
        }
        return route.abort();
      });
      // přehled
      await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html');
      await page.waitForTimeout(700);
      const stav = await page.evaluate(() => ({ bodovani: bodovaniAktivni, zebricek: document.getElementById('sekce-zebricek').style.display, stavText: document.getElementById('aktualni-stav-container').innerText.replace(/\s+/g, ' ').slice(0, 160) }));
      console.log(sc.nazev, s.n, JSON.stringify(stav));
      await page.screenshot({ path: `${SCR}v_prehled_${sc.nazev}_${s.n}.png`, fullPage: s.n !== 'mobil' });
      if (s.n === 'desktop') {
        await page.evaluate(() => otevriModalJeden(vsichniHraci[0]));
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${SCR}v_modal_${sc.nazev}.png` });
        await page.evaluate(() => zavriModal('playerModal'));
      }
      // formulář (jen před uzávěrkou)
      if (!sc.cas) {
        await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html');
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const nastav = (sel, val) => { const el = document.querySelector(sel); el.value = val; el.dispatchEvent(new Event('change')); };
          EXTRALIGA.KONFIG.TYMY.forEach((t, i) => nastav(`select[name='misto${i + 1}']`, t));
          nastav("select[name='zolik1']", 'Třinec'); nastav("select[name='zolik2']", 'Pardubice');
          document.getElementById('hist-2526').style.display = 'grid';
        });
        await page.screenshot({ path: `${SCR}v_form_${s.n}.png`, fullPage: s.n !== 'mobil' });
        if (s.n === 'desktop') {
          // otevřená roletka
          await page.click("select[name='zolik3'] ~ .custom-select-trigger");
          await page.waitForTimeout(200);
          await page.screenshot({ path: `${SCR}v_form_roletka.png`, clip: { x: 0, y: 0, width: 1300, height: 900 } });
        }
      }
      await page.close();
    }
  }
  console.log('Chyby:', chyby);
  await browser.close();
})();
