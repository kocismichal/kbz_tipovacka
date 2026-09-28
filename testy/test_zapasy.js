// Zápasy sezóny: parser stránky všech kol (skripty/stahni_tabulku_extraligy.js) – odehrané s výsledky
// i ty na programu – a rozbalovací seznam v přehledu 26/27 se záložkami, který se načte až po rozkliknutí.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const E = require('../extraliga_spolecne.js');
const S = require('../skripty/stahni_tabulku_extraligy.js');
const K = E.KONFIG, SL = E.SLOUPCE, T = K.TYMY;
const { KOREN } = require('./pomocne');
const spolecne = fs.readFileSync(path.join(KOREN, 'extraliga_spolecne.js'), 'utf8');
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#1f5fbf"/></svg>';

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

// ---------- parser stránky "Zobrazit všechna kola" ----------
// Odehraný zápas: dvě buňky se skóre a v preview__period datum se třetinami.
const odehrany = (domaci, hoste, dg, hg, datum, uvnitr) => `<tr data-href="/zapas/${1000 + dg * 10 + hg}" class="js-preview__link">
  <td class="preview__name text-right"><a href="/zapas/1"><span class="preview__name--long">${domaci}</span><span class="preview__name--medium">x</span></a></td>
  <td class="preview__score"><span class="blue">${dg}</span></td>
  <td class="preview__period"><span class="match-start-time">${datum}</span><span>(${uvnitr})</span></td>
  <td class="preview__score preview__score--right"><span class="blue">${hg}</span></td>
  <td class="preview__name"><a href="/zapas/1"><span class="preview__name--long">${hoste}</span><span class="preview__name--medium">y</span></a></td></tr>`;
// Zápas, který se ještě nehrál: místo skóre jen den, datum a čas ve třech buňkách
const budouci = (domaci, hoste, den, datum, cas) => `<tr data-href="/zapas/999" class="js-preview__link">
  <td class="preview__name text-right"><a href="/zapas/9"><span class="preview__name--long">${domaci}</span></a></td>
  <td class="preview__center" colspan="3"><div class="box-snow row"><div class="col-1_3">${den}</div><div class="col-1_3">${datum}</div><div class="col-1_3">${cas}</div></div></td>
  <td class="preview__name"><a href="/zapas/9"><span class="preview__name--long">${hoste}</span></a></td></tr>`;

const html = `<h2 class="m-t-30">1. kolo</h2><table class="preview"><tbody>
  ${odehrany('HC Oceláři Třinec', 'HC Kometa Brno', 6, 5, 'ST 16. 09.', '2:1, 2:4, 2:0')}
  ${odehrany('HC Škoda Plzeň', 'Bílí Tygři Liberec', 2, 1, 'ST 16. 09.', '1:0, 0:1, 0:0 - 0:0 - 1:0')}
  ${odehrany('Banes Motor Č. Budějovice', 'BK Mladá Boleslav', 2, 3, 'ST 16. 09.', '1:0, 1:1, 0:1 - 0:1')}
</tbody></table>
<h2 class="m-t-30">2. kolo</h2><table class="preview"><tbody>
  ${odehrany('Rytíři Kladno', 'HC Sparta Praha', 3, 2, 'PÁ 18. 09.', '0:1, 1:0, 1:1 - 0:0 - 1:0')}
  ${budouci('Bílí Tygři Liberec', 'HC VÍTKOVICE RIDERA', 'ST', '13. 01.', '18:00')}
</tbody></table>
<h2 class="m-t-30">40. kolo</h2><table class="preview"><tbody>
  ${odehrany('HC Dynamo Pardubice', 'HC VERVA Litvínov', 4, 1, 'ÚT 26. 01.', '1:0, 2:1, 1:0')}
</tbody></table>`;

const z = S.zapasyZHtml(html);
over(z.length === 6, 'parser vezme odehrané i budoucí zápasy', z.length);
over(z.filter(x => x.odehrany).length === 5, 'odehrané zápasy jsou označené', z.filter(x => x.odehrany).length);
const budouciZ = z.find(x => !x.odehrany);
over(budouciZ && budouciZ.datum === '2027-01-13' && budouciZ.cas === '18:00' && budouciZ.kolo === 2,
  'zápas na programu má datum, čas i své kolo', budouciZ);
over(budouciZ && budouciZ.domaci === 'Liberec' && budouciZ.hoste === 'Vítkovice' && budouciZ.domaci_goly === null && budouciZ.tretiny === '',
  'zápas na programu je bez skóre', budouciZ);
const trinec = z.find(x => x.domaci === 'Třinec');
over(trinec && trinec.kolo === 1 && trinec.datum === '2026-09-16' && trinec.domaci_goly === 6 && trinec.hoste_goly === 5,
  'základní zápas: kolo, datum, skóre', trinec);
over(trinec && trinec.hoste === 'Kometa Brno' && trinec.tretiny === '2:1, 2:4, 2:0' && trinec.konec === '',
  'jména týmů podle konfigurace a třetiny', trinec);
const prodlouzeni = z.find(x => x.domaci === 'České Budějovice');
over(prodlouzeni && prodlouzeni.konec === 'pp' && prodlouzeni.tretiny === '1:0, 1:1, 0:1', 'prodloužení se pozná (pp)', prodlouzeni);
const najezdy = z.find(x => x.domaci === 'Plzeň');
over(najezdy && najezdy.konec === 'sn' && najezdy.tretiny === '1:0, 0:1, 0:0', 'samostatné nájezdy se poznají (sn)', najezdy);
const leden = z.find(x => x.kolo === 40);
over(leden && leden.datum === '2027-01-26', 'lednový zápas patří do druhého roku sezóny', leden && leden.datum);
over(z.map(x => x.datum).join(',') === [...z].map(x => x.datum).sort().join(','), 'zápasy jsou seřazené podle data', z.map(x => x.datum));
over(z.every(x => x.id && T.includes(x.domaci) && T.includes(x.hoste)), 'každý zápas má id a oba týmy z konfigurace');

// ---------- rozbalovací seznam v přehledu ----------
function tip(jmeno, klub, poradi) {
  const p = { jmeno, email: '', fandim: klub };
  poradi.forEach((t, i) => p['misto' + (i + 1)] = t);
  return E.radekZFormulare(p, '5.9.2026 20:00');
}
const tipy = [E.HLAVICKA.slice(0, SL.POCET_TIPU), tip('První Tip', 'Třinec', T), tip('Druhý Tip', 'Kladno', T)];
const hotovo = [E.HLAVICKA, new Array(SL.POCET).fill('')];
const stav = { sezona: '2026/27', aktualizovano: '2026-09-27T18:36:00Z', zdroj: 'hokej.cz',
  poradi: T.map((t, i) => ({ tym: t, zapasy: 5, body: 30 - i * 2 })) };
const zapasyJson = { sezona: '2026/27', aktualizovano: '2026-09-27T18:36:00Z', zdroj: 'hokej.cz', zapasy: z };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  let stahnutoZapasu = 0;
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('extraliga_spolecne.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: spolecne.replace(/BODOVANI_OD: "[^"]+"/, 'BODOVANI_OD: "2020-01-01T00:00:00"') });
    if (url.includes('2627_extraliga_zapasy.json')) { stahnutoZapasu++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(zapasyJson) }); }
    if (url.includes('2627_extraliga_historie.json')) return route.fulfill({ status: 404, body: '' });
    if (url.includes('2627_extraliga_stav.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stav) });
    if (url.includes('script.google.com')) { const sheet = decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1] || ''); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet === 'Tipy' ? tipy : hotovo) }); }
    if (url.includes('i.imgur.com')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO });
    if (url.startsWith('http://127.0.0.1:8765')) return route.continue();
    return route.abort();
  });
  await page.goto('http://127.0.0.1:8765/2627_prehled_extraliga.html');
  await page.waitForSelector('#zapasy-rozbal', { timeout: 10000 });

  const zavreno = await page.evaluate(() => {
    const d = document.getElementById('zapasy-rozbal');
    return { open: d.open, summary: d.querySelector('summary').innerText.replace(/\s+/g, ' ').trim(), radky: d.querySelectorAll('.zapas-radek').length };
  });
  over(zavreno.open === false, 'seznam je po načtení zavřený', zavreno);
  over(/Zápasy a výsledky/i.test(zavreno.summary) && /odehráno 35/.test(zavreno.summary), 'v nadpisu je počet odehraných z tabulky', zavreno.summary);
  over(stahnutoZapasu === 0, 'dokud se neklikne, soubor se zápasy se nestahuje', stahnutoZapasu);
  over(zavreno.radky === 0, 'zavřený seznam nemá vykreslené zápasy', zavreno.radky);

  await page.click('#zapasy-rozbal > summary');
  await page.waitForFunction(() => document.querySelectorAll('#zapasy-obsah .zapas-radek').length > 0, { timeout: 10000 });
  const otevreno = await page.evaluate(() => {
    const d = document.getElementById('zapasy-rozbal');
    const radky = [...d.querySelectorAll('.zapas-radek')].map(r => ({
      text: r.innerText.replace(/\s+/g, ' ').trim(),
      vitez: [...r.querySelectorAll('.zapas-vitez')].map(v => v.textContent),
      odkaz: (r.querySelector('.zapas-skore a') || {}).href || ''
    }));
    return {
      summary: d.querySelector('summary').innerText.replace(/\s+/g, ' ').trim(),
      zalozky: [...d.querySelectorAll('.zapasy-tabs .tab-btn')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).join(' | '),
      dny: [...d.querySelectorAll('.zapasy-den')].map(e => e.textContent),
      radky,
      zdroj: (d.querySelector('.zapasy-zdroj') || {}).innerText || '',
      sirka: d.querySelector('.zapas-radek').getBoundingClientRect().width
    };
  });
  over(otevreno.radky.length === 5, 'po rozkliknutí se vykreslí odehrané zápasy', otevreno.radky.length);
  over(stahnutoZapasu === 1, 'soubor se zápasy se stáhne jen jednou', stahnutoZapasu);
  over(/odehráno 5 z 6/.test(otevreno.summary), 'počet v nadpisu se po načtení srovná se seznamem', otevreno.summary);
  over(/odehrané \(5\)/i.test(otevreno.zalozky) && /program \(1\)/i.test(otevreno.zalozky), 'jsou vidět obě záložky s počty', otevreno.zalozky);
  over(otevreno.dny[0] === 'Út 26. 1.' && otevreno.dny[otevreno.dny.length - 1] === 'St 16. 9.',
    'hrací dny jsou od nejnovějšího s českým názvem dne', otevreno.dny);
  const prvni = otevreno.radky[0].text;
  over(/40\. kolo/.test(prvni) && /Pardubice/.test(prvni) && /4:1/.test(prvni) && /\(1:0, 2:1, 1:0\)/.test(prvni),
    'řádek zápasu má kolo, týmy, skóre i třetiny', prvni);
  over(otevreno.radky[0].vitez.length === 1 && otevreno.radky[0].vitez[0] === 'Pardubice', 'vítěz je zvýrazněný', otevreno.radky[0].vitez);
  over(/hokej\.cz\/zapas\//.test(otevreno.radky[0].odkaz), 'skóre odkazuje na detail zápasu', otevreno.radky[0].odkaz);
  const pp = otevreno.radky.find(r => /Budějovice/.test(r.text));
  over(pp && /2:3 ?pp/.test(pp.text.replace(/\s+/g, ' ')), 'u prodloužení je značka pp', pp && pp.text);
  const sn = otevreno.radky.find(r => /Kladno/.test(r.text));
  over(sn && /3:2 ?sn/.test(sn.text.replace(/\s+/g, ' ')), 'u nájezdů je značka sn', sn && sn.text);
  over(/hokej\.cz/.test(otevreno.zdroj) && /pp/.test(otevreno.zdroj) && /sn/.test(otevreno.zdroj), 'pod seznamem je zdroj a vysvětlení zkratek', otevreno.zdroj);

  await page.evaluate(() => document.getElementById('zapasy-rozbal').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'vystup', 'zapasy_desktop.png'), fullPage: false });

  // záložka Program: zápasy, které se teprve hrají, s časem začátku
  await page.click('#btn-zapasy-program');
  await page.waitForTimeout(200);
  const program = await page.evaluate(() => {
    const d = document.getElementById('zapasy-rozbal');
    return {
      radky: [...d.querySelectorAll('.zapas-radek')].map(r => r.innerText.replace(/\s+/g, ' ').trim()),
      dny: [...d.querySelectorAll('.zapasy-den')].map(e => e.textContent),
      cas: [...d.querySelectorAll('.zapas-cas')].map(e => e.textContent),
      skore: d.querySelectorAll('.zapas-skore').length,
      aktivni: (d.querySelector('.zapasy-tabs .tab-btn.active') || {}).id || ''
    };
  });
  over(program.aktivni === 'btn-zapasy-program', 'kliknutí přepne záložku na program', program.aktivni);
  over(program.radky.length === 1 && /2\. kolo/.test(program.radky[0]) && /Liberec/.test(program.radky[0]) && /Vítkovice/.test(program.radky[0]),
    'program ukazuje zápas, který se teprve hraje', program.radky);
  over(program.cas.length === 1 && program.cas[0] === '18:00', 'u zápasu na programu je čas začátku', program.cas);
  over(program.skore === 0 && program.dny[0] === 'St 13. 1.', 'program je bez skóre a s datem zápasu', program);
  await page.click('#btn-zapasy-odehrane');
  await page.waitForTimeout(200);
  const zpet = await page.evaluate(() => document.querySelectorAll('#zapasy-obsah .zapas-radek').length);
  over(zpet === 5, 'zpátky na odehrané zápasy', zpet);

  // mobil: řádek se nesmí roztáhnout mimo obrazovku
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobil = await page.evaluate(() => {
    const r = document.querySelector('#zapasy-obsah .zapas-radek');
    return { sirka: Math.round(r.getBoundingClientRect().width), telo: document.documentElement.scrollWidth, okno: window.innerWidth };
  });
  over(mobil.telo <= mobil.okno + 1, 'na mobilu se stránka neroztahuje do šířky', mobil);
  await page.evaluate(() => document.getElementById('zapasy-rozbal').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'vystup', 'zapasy_mobil.png'), fullPage: false });

  over(errors.length === 0, 'stránka je bez chyb v konzoli', errors);
  await browser.close();
  console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Odehrané zápasy: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
