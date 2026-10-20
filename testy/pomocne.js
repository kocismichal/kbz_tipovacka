// Společné cesty pro testy: kořen repa, složka pro screenshoty a adresa lokálního serveru (spouští ho spust_vse.js).
const path = require('path');
const fs = require('fs');
const KOREN = path.join(__dirname, '..');
const VYSTUP = path.join(__dirname, 'vystup');
fs.mkdirSync(VYSTUP, { recursive: true });
// Formulář se po uzávěrce (KONFIG.DEADLINE) zavře a místo polí ukáže hlášku, takže testy, které potřebují
// otevřený formulář, si podstrčí konfiguraci s uzávěrkou v budoucnu. Podstrčení musí přijít až po obecném
// page.route('**/*'), aby mělo přednost (Playwright bere poslední zaregistrované pravidlo).
const UZAVERKA_OTEVRENO = '2099-12-31T23:59:00';
const UZAVERKA_ZAVRENO = '2000-01-01T00:00:00';
async function podstrcUzaverku(page, datum) {
  const zdroj = fs.readFileSync(path.join(KOREN, 'extraliga_spolecne.js'), 'utf8');
  const upraveny = zdroj.replace(/DEADLINE: "[^"]+"/, 'DEADLINE: "' + datum + '"');
  if (upraveny === zdroj) throw new Error('v extraliga_spolecne.js se nenašlo KONFIG.DEADLINE');
  await page.route('**/extraliga_spolecne.js*', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: upraveny }));
}

module.exports = { KOREN, SCR: VYSTUP + path.sep, WEB: 'http://127.0.0.1:8765',
  podstrcUzaverku, UZAVERKA_OTEVRENO, UZAVERKA_ZAVRENO };
