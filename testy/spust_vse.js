#!/usr/bin/env node
/*
 * Spustí testy tipovačky Extraligy. Nejdřív zapne malý webový server na http://127.0.0.1:8765 (kořen repa),
 * protože stránky si stahují JSON a to z file:// nejde, pak postupně spustí všechny testy test_*.js.
 *
 *   node spust_vse.js            všechny testy
 *   node spust_vse.js form stav  jen testy, které mají v názvu "form" nebo "stav"
 *
 * Předpoklady: cd testy && npm install && npx playwright install chromium
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { KOREN } = require('./pomocne');

const PORT = 8765;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.gs': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const soubor = path.normalize(path.join(KOREN, p));
  if (!soubor.startsWith(KOREN) || !fs.existsSync(soubor) || fs.statSync(soubor).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(soubor).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(soubor).pipe(res);
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} je obsazený – běží už jiný server? Ukonči ho a spusť testy znovu.` : e.message);
  process.exit(1);
});

const vsechny = fs.readdirSync(__dirname).filter((f) => /^test_.*\.js$/.test(f)).sort();
const filtr = process.argv.slice(2);
const vybrane = filtr.length ? vsechny.filter((f) => filtr.some((a) => f.includes(a))) : vsechny;
if (!vybrane.length) { console.error('Žádný test neodpovídá filtru: ' + filtr.join(' ')); process.exit(1); }

// Testy se spouští asynchronně (ne spawnSync), aby server v tomto procesu mohl během testu obsluhovat požadavky.
const spustTest = (t) => new Promise((resolve) => {
  const dite = spawn(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit', env: process.env });
  dite.on('close', (kod) => resolve(kod === 0));
});

server.listen(PORT, '127.0.0.1', async () => {
  const vysledky = [];
  for (const t of vybrane) {
    console.log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));
    vysledky.push({ t, ok: await spustTest(t) });
  }
  server.close();
  console.log('\n' + '-'.repeat(72));
  vysledky.forEach((v) => console.log((v.ok ? 'OK    ' : 'CHYBA ') + v.t));
  const chyb = vysledky.filter((v) => !v.ok).length;
  console.log(chyb ? `\n${chyb} test(ů) selhalo.` : '\nVšechny testy prošly.');
  process.exit(chyb ? 1 : 0);
});
