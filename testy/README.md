# Testy tipovačky Extraligy

Web sám o sobě nic nepotřebuje (statické HTML na GitHub Pages). Testy běží v Node.js a v prohlížeči
Chromium přes Playwright. Google tabulka ani loga z imgur se při testech nestahují – všechno je podstrčené
(mock), takže testy běží offline a nic nezapisují do ostré tabulky.

## Příprava (jednou)

1. Nainstaluj Node.js 20 nebo novější (https://nodejs.org).
2. V terminálu:

```
cd testy
npm install
npx playwright install chromium
```

## Spuštění

```
cd testy
npm test                 # všechny testy
node spust_vse.js form   # jen testy s "form" v názvu
```

`spust_vse.js` zapne lokální server na http://127.0.0.1:8765 (kořen repa) a pustí testy po jednom.
Screenshoty se ukládají do `testy/vystup/` (složka je v .gitignore).

## Co který test hlídá

| Test | Co kontroluje |
|------|---------------|
| `test_bodovani.js` | čisté bodování v `extraliga_spolecne.js`: umístění, násobky, žolíci, bonusové otázky |
| `test_bundle.js` | že `extraliga_apps_script_komplet.gs` odpovídá zdrojům (po změně spusť `node skripty/sestav_apps_script.js`) |
| `test_form.js` | formulář: výběr týmů, žolíci, generované otázky, kontrola před odesláním, odeslaná pole |
| `test_prehled.js` | přehled 26/27 před uzávěrkou (jen tipy) i po ní (body, záložky, karta hráče) |
| `test_stav.js` | automatická tabulka: platný snímek, neplatný snímek (záloha z listu), před uzávěrkou nic z výsledků |
| `test_zmeny.js` | vyhodnocení 25/26: stupně vítězů, karta bez oblíbenosti, matice bez %, TOP 10 se správnou odpovědí, lišta s ročníkem, text pravidel |
| `test_2526_snap.js` | vyhodnocení 25/26 ze snímku dat (298 tipujících, vítěz, karta) |
| `test_lista.js` | lišta se nikde neořezává (400–1300 px) |
| `test_index.js` | úvodní stránka bez chyb v konzoli |
| `test_vzhled.js` | screenshoty formuláře a přehledu (desktop/iPad/mobil) do `vystup/` |
