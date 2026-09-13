// Lišta na ledové stránce: nikde se neořezává a na počítači (od 1250 px) je na jednom řádku.
// Měří se SE SKUTEČNÝMI FONTY (Oswald, Inter z fonts.googleapis.com) – s náhradními fonty je obsah užší
// a test by ořez neodhalil. Bez internetu fonty nedojedou a test to jen ohlásí.
const { chromium } = require('playwright');
const { SCR } = require('./pomocne');
let chyb = 0;
(async () => {
  const browser = await chromium.launch();
  for (const w of [400, 768, 1024, 1194, 1300, 1440]) {
    const page = await browser.newPage({ viewport: { width: w, height: 700 } });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith('http://127.0.0.1:8765') || url.includes('cdnjs.cloudflare.com') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return route.continue();
      if (url.includes('script.google.com')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html');
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const nav = document.querySelector('.main-navbar');
      const navR = nav.getBoundingClientRect();
      const mimo = [...nav.querySelectorAll('a')].filter(a => { const r = a.getBoundingClientRect(); return r.right > navR.right + 1 || r.left < navR.left - 1; }).map(a => a.textContent.trim());
      return { fonty: document.fonts.check('700 16px Oswald') && document.fonts.check('700 16px Inter'), scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth, oriznuto: nav.scrollWidth > nav.clientWidth, mimo, vyska: nav.offsetHeight };
    });
    console.log(w, JSON.stringify(info));
    if (!info.fonty) console.log('  (fonty se nenačetly – měření je jen orientační)');
    if (info.oriznuto || info.mimo.length) { chyb++; console.log(`  CHYBA: lišta je při ${w} px oříznutá`); }
    if (w >= 1250 && info.vyska > 90) { chyb++; console.log(`  CHYBA: lišta při ${w} px není na jednom řádku (výška ${info.vyska})`); }
    await page.screenshot({ path: `${SCR}lista_${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(700, 520) } });
    await page.close();
  }
  await browser.close();
  console.log(chyb ? (chyb + ' kontrol lišty selhalo.') : 'Lišta: všechny kontroly prošly.');
  process.exit(chyb ? 1 : 0);
})();
