const { chromium } = require('playwright');
const { SCR, KOREN } = require('./pomocne');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let postData = null;
  await page.route('**/*', route => {
    const url = route.request().url();
    if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765'))) return route.continue();
    if (url.includes('script.google.com')) { postData = route.request().postData(); return route.fulfill({ status: 200, body: '' }); }
    return route.abort();   // fonty, ikony, loga – offline
  });
  await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html');
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => ({
    pravidla: document.querySelector('[data-zolik="pocet"]').textContent + ' / ' + document.querySelector('[data-zolik="presne"]').textContent + ' / ' + document.querySelector('[data-zolik="b0"]').textContent,
    zoliciInfo: document.getElementById('zolici-info').textContent,
    zolikKarty: document.querySelectorAll('.zolik-card').length,
    zolikSelecty: document.querySelectorAll('select.zolik-select').length,
    zolikOptions: document.querySelector('select.zolik-select').options.length,
    otazky: Array.from(document.querySelectorAll('#bonusove-otazky label')).map(l => l.textContent.trim().slice(0, 60)),
    sekce: Array.from(document.querySelectorAll('#bonusove-otazky .section-title')).map(l => l.textContent),
    pole: Array.from(document.querySelectorAll('#bonusove-otazky select, #bonusove-otazky input')).map(p => p.tagName + ':' + p.name + (p.type ? ':' + p.type : '') + (p.max ? ':max=' + p.max : '') + (p.placeholder ? ':ph=' + p.placeholder.slice(0, 20) : '')),
    tooltipy: Array.from(document.querySelectorAll('#bonusove-otazky .tooltip-text')).map(t => t.textContent.trim()),
    tymSelectOptions: document.querySelector('select.tym-select').options.length,
    customTriggers: document.querySelectorAll('.custom-select-trigger').length,
  }));
  console.log(JSON.stringify(info, null, 1));

  // Vyplnění formuláře přes skryté selecty (custom roletky nad nimi)
  await page.evaluate(() => {
    const tymy = EXTRALIGA.KONFIG.TYMY;
    document.getElementById('jmeno').value = 'Test Tester';
    document.getElementById('email').value = 'test@example.com';
    const nastav = (sel, val) => { const s = document.querySelector(sel); s.value = val; s.dispatchEvent(new Event('change')); };
    nastav("select[name='fandim']", 'Třinec');
    tymy.forEach((t, i) => nastav(`select[name='misto${i + 1}']`, t));
    nastav("select[name='zolik1']", 'Třinec');
    nastav("select[name='zolik2']", 'Pardubice');
    document.querySelector("input[name='zolik1_body']").value = '95';
    document.querySelector("input[name='zolik2_body']").value = '90';
  });
  const stav = await page.evaluate(() => ({
    zolik1Option: Array.from(document.querySelector("select[name='zolik1']").options).find(o => o.value === 'Pardubice').textContent,
    zolik1Disabled: Array.from(document.querySelector("select[name='zolik1']").options).find(o => o.value === 'Pardubice').disabled,
    zolik1Trinec: Array.from(document.querySelector("select[name='zolik1']").options).find(o => o.value === 'Třinec').textContent,
    trigger1: document.querySelector("select[name='zolik1']").parentNode.querySelector('.custom-select-trigger').textContent.trim(),
    liveZolici: Array.from(document.querySelectorAll('#live-grid .history-team.zolik')).map(e => e.id),
    liveTitle8: document.getElementById('live-pos-8').querySelector('img').title,
  }));
  console.log(JSON.stringify(stav, null, 1));

  // Odeslání bez 3. žolíka → prohlížeč zastaví (required); hláška o chybějícím týmu
  await page.click("#tipForm button[type='submit']");
  await page.waitForTimeout(200);
  console.log('Hláška 1:', await page.evaluate(() => document.getElementById('vysledek').textContent.trim()));

  // Doplnit zbytek a odeslat
  await page.evaluate(() => {
    const nastav = (sel, val) => { const s = document.querySelector(sel); s.value = val; s.dispatchEvent(new Event('change')); };
    nastav("select[name='zolik3']", 'Sparta Praha');
    document.querySelector("input[name='zolik3_body']").value = '88';
    EXTRALIGA.BONUSY.filter(q => q.aktivni).forEach(q => {
      const el = document.querySelector(`[name='${q.klic}']`);
      if (q.vstup === 'tym') nastav(`select[name='${q.klic}']`, q.klic === 'finaleprohra' ? 'Plzeň' : 'Kladno');
      else if (q.vstup === 'anone') nastav(`select[name='${q.klic}']`, 'Ano');
      else if (q.vstup === 'cislo') el.value = '42';
      else el.value = 'Jan Novák';
    });
    document.getElementById('souhlas').checked = true;
  });
  await page.click("#tipForm button[type='submit']");
  await page.waitForTimeout(500);
  console.log('Hláška 2:', await page.evaluate(() => document.getElementById('vysledek').textContent.trim()));
  if (postData) {
    const fields = {};
    const re = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g; let m;
    while ((m = re.exec(postData))) fields[m[1]] = m[2];
    console.log('POST pole:', JSON.stringify(fields));
    // Kontrola, že každé pole z EXTRALIGA.POLE (kromě datumu) ve formuláři existuje
    const chybi = await page.evaluate(f => EXTRALIGA.POLE.filter(p => p && !(p in f) && ['finalevyhra', 'finaleprohra'].indexOf(p) === -1), fields);
    console.log('Chybějící pole vůči EXTRALIGA.POLE:', JSON.stringify(chybi));
  } else console.log('POST neproběhl!');

  await page.screenshot({ path: SCR + 'form.png', fullPage: true });
  console.log('Chyby:', errors);
  await browser.close();
})();
