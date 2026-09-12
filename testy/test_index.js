const { chromium } = require('playwright');
const { SCR, KOREN } = require('./pomocne');
(async () => {
  const browser = await chromium.launch();
  for (const [n, w, h] of [['desktop', 1300, 900], ['mobil', 400, 850]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if ((url.startsWith('file://') || url.startsWith('http://127.0.0.1:8765'))) return route.continue();
      if (url.includes('script.google.com')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"pocet":7}' });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8765/index.html'); await page.waitForTimeout(500);
    await page.screenshot({ path: SCR + `v_index_${n}.png`, fullPage: true });
    console.log('index', n, 'chyby:', errors);
    await page.close();
  }
  await browser.close();
})();
