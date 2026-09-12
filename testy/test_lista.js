const { chromium } = require('playwright');
const { SCR, KOREN } = require('./pomocne');
(async () => {
  const browser = await chromium.launch();
  for (const w of [400, 768, 1024, 1300]) {
    const page = await browser.newPage({ viewport: { width: w, height: 700 } });
    await page.route('**/*', route => {
      const url = route.request().url();
      if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765')) || url.includes('cdnjs.cloudflare.com')) return route.continue();
      if (url.includes('script.google.com')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/2627_form_extraliga.html');
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const nav = document.querySelector('.main-navbar');
      return { scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth, oriznuto: nav.scrollWidth > nav.clientWidth, vyska: nav.offsetHeight };
    });
    console.log(w, JSON.stringify(info));
    await page.screenshot({ path: `${SCR}lista_${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(700, 520) } });
    await page.close();
  }
  await browser.close();
})();
