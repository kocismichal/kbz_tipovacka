const { chromium } = require('playwright');
const E = require('../extraliga_spolecne.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { SCR, KOREN } = require('./pomocne');

function tip(jmeno, klub, poradi, zolici, bonusy, mistri) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  (zolici || []).forEach((z, k) => { p['zolik' + (k + 1)] = z[0]; p['zolik' + (k + 1) + '_body'] = z[1]; });
  Object.assign(p, bonusy || {}, mistri || {});
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const bonusyA = { body_mistr: 99, rozdil_1_2: 4, body_posledni: 45, rekord_goly: 'Ano', tymgoly: 'Sparta Praha', tympresilovky: 'Pardubice', tymfauly: 'Sparta Praha', tym_nejmene_trestany: 'Olomouc', baraz: 'Ne', strelec: 'Matěj Stránský', gol_strelec: 34, stransky_ruzicka: 'Ano', trestyhrac: 'John Ludvig', icetime: 'Michal Kempný', procento_golu: 'Anthony Nellis', tomek_body: 28, duda_angazma: 'Ne', galvas_usa: 'Ano' };
const bonusyB = Object.assign({}, bonusyA, { rekord_goly: 'Ne', tymgoly: 'Pardubice', tomek_body: 22, strelec: 'anthony nellis', icetime: 'Michal kempný', duda_angazma: 'Ano' });
const rot = n => T.slice(n).concat(T.slice(0, n));
const mistri = { zajic_vitez: 'Vilda', zajic1: 'Vilda', zajic2: 'Bonifác', zajic3: 'Tlusťoch', zajic4: 'Dudák' };
const hlavicka = E.HLAVICKA.slice(0, SL.POCET_TIPU);
const tipy = [
  hlavicka,
  tip('Vilém Franěk', 'Třinec', T, [['Třinec', 95], ['Pardubice', 90], ['Sparta Praha', 88]], bonusyA, mistri),
  tip('Jan Homolka', 'Sparta Praha', rot(1), [['Sparta Praha', 99], ['Kometa Brno', 80], ['Liberec', 85]], bonusyB, mistri),
  tip('Jiří Tlustý', 'Kladno', rot(2), [['Kladno', 70], ['Pardubice', 93], ['Třinec', 75]], bonusyA, mistri),
  tip('Radek Duda', 'Karlovy Vary', rot(3), [['Karlovy Vary', 66], ['Pardubice', 91], ['Plzeň', 88]], bonusyB, mistri),
  tip('Fanoušek Starý', 'Plzeň', rot(4), [], bonusyA, mistri).slice(0, 36),   // tip z doby před žolíky
  tip('Fanda Nový', 'Vítkovice', rot(5), [['Vítkovice', 60], ['Pardubice', 92], ['Třinec', 80]], bonusyB, mistri),
];
const bodyMist = [99, 93, 90, 88, 85, 80, 78, 75, 70, 65, 60, 55, 50, 43];
function hotovo(aktivni) {
  const r = new Array(SL.POCET).fill('');
  for (let i = 0; i < 14; i++) { r[SL.MISTO_OD + i] = aktivni ? T[i] : 0; r[SL.BODY_MISTO_OD + i] = aktivni ? bodyMist[i] : 0; }
  if (aktivni) { r[E.BONUSY.find(q => q.klic === 'tymgoly').idx] = 'Sparta Praha, Pardubice'; r[E.BONUSY.find(q => q.klic === 'rekord_goly').idx] = 'Ano'; r[E.BONUSY.find(q => q.klic === 'tomek_body').idx] = 26; }
  return [E.HLAVICKA, r];
}

(async () => {
  const browser = await chromium.launch();
  for (const aktivni of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED') && !m.text().includes('404')) errors.push('console: ' + m.text()); });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 404, body: '' });
      if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765')) || url.startsWith('http://127.0.0.1:8765')) return route.continue();
      if (url.includes('script.google.com')) {
        const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || '');
        const data = sheet === 'Tipy' ? tipy : hotovo(aktivni);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html');
    await page.waitForTimeout(600);

    const info = await page.evaluate(() => {
      const txt = id => document.getElementById(id).innerText.replace(/\s+/g, ' ').trim();
      return {
        pocet: txt('count-players'),
        zebricekViditelny: document.getElementById('sekce-zebricek').style.display,
        hlavicka: txt('tabulka-hlavicka'),
        radky: Array.from(document.querySelectorAll('#tabulka-telo tr')).map(tr => tr.innerText.replace(/\s+/g, ' ').trim()),
        prehledRadky: document.querySelectorAll('#prehled-telo tr').length,
        mistri: Array.from(document.querySelectorAll('#mistri-container .zajic-card')).map(c => c.innerText.replace(/\s+/g, ' ').trim()),
        zolici: txt('zolici-container').slice(0, 400),
        bonusyTymy: document.querySelectorAll('#bonusy-tymy-container table').length,
        bonusyOstatni: Array.from(document.querySelectorAll('#bonusy-ostatni-container table thead tr:first-child th')).map(t => t.innerText.slice(0, 50)),
        anoNe: Array.from(document.querySelectorAll('#bonusy-ostatni-container table')).slice(0, 1).map(t => t.innerText.replace(/\s+/g, ' ').slice(0, 500)),
        cisla: Array.from(document.querySelectorAll('#bonusy-ostatni-container table')).slice(1, 2).map(t => t.innerText.replace(/\s+/g, ' ').slice(0, 600)),
        stav: txt('aktualni-stav-container').slice(0, 300),
      };
    });
    console.log('=== bodování aktivní:', aktivni, '===');
    console.log(JSON.stringify(info, null, 1));

    // modal Mistra Vildy (žolíci) a starého fanouška (bez žolíků)
    for (const jmeno of ['Vilém Franěk', 'Fanoušek Starý']) {
      const modal = await page.evaluate(j => {
        const h = vsichniHraci.find(x => x.jmeno === j);
        otevriModalJeden(h);
        const el = document.getElementById('playerModalContent');
        return {
          stats: Array.from(el.querySelectorAll('.modal-stat-box')).map(b => b.innerText.replace(/\s+/g, ' ').trim()),
          zolikTiles: el.querySelectorAll('.team-col.zolik').length,
          badge: el.querySelectorAll('.zolik-badge').length,
          tilesText: Array.from(el.querySelectorAll('.teams-grid-8x2')).map(g => g.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)),
          zoliciBlok: Array.from(el.querySelectorAll('.modal-subtitle')).map(s => s.innerText.trim()),
          zoliciItems: Array.from(el.querySelectorAll('.bonus-item')).slice(0, 3).map(i => i.innerText.replace(/\s+/g, ' ').trim()),
          bonusCount: el.querySelectorAll('.bonus-item').length,
          bonusPosledni: Array.from(el.querySelectorAll('.bonus-item')).slice(-3).map(i => i.innerText.replace(/\s+/g, ' ').trim()),
          text: el.innerText.replace(/\s+/g, ' ').slice(0, 0)
        };
      }, jmeno);
      console.log('--- modal', jmeno, '---');
      console.log(JSON.stringify(modal, null, 1));
      await page.screenshot({ path: `${SCR}prehled_${aktivni ? 'live' : 'pred'}_modal_${jmeno.split(' ')[0]}.png` });
      await page.evaluate(() => zavriModal('playerModal'));
    }
    if (aktivni) {
      await page.evaluate(() => zmenZalozku('zolici'));
      console.log('Záložka žolíci:', await page.evaluate(() => Array.from(document.querySelectorAll('#tabulka-telo tr')).map(tr => tr.innerText.replace(/\s+/g, ' ').trim())));
      await page.evaluate(() => zmenZalozku('celkem'));
    }
    await page.screenshot({ path: `${SCR}prehled_${aktivni ? 'live' : 'pred'}.png`, fullPage: true });
    console.log('Chyby:', errors);
    await page.close();
  }
  await browser.close();
})();
