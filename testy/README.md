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
| `test_bodovani.js` | čisté bodování v `extraliga_spolecne.js`: umístění, násobky, žolíci, bonusové otázky, průběžný a finálový režim (`sestavVysledky`, `prubezneOdpovedi`) |
| `test_historie.js` | historie snímků pro graf: bod přibude jen po odehraných zápasech, den bez zápasů nic nepřidá, víc zápasů v jednom dni přepíše snímek dne |
| `test_program.js` | program zápasů z hokej.cz a rozhodnutí, kdy stahovat tabulku: odehraný zápas bez času, sezóna přes Nový rok, den bez hokeje, kontroly během zápasů, brzda „vše zapsané“, přenechání zbytku rannímu běhu a pokyn pro hlídače (`konec`, `cekat`) |
| `test_graf.js` | graf vývoje tipovačky z denních snímků: legenda ve dvou řádcích se zaškrtávátky, přepínač „jen Mistři“, osa podle rozsahu hodnot, přidání tipujícího psaním i výběrem, bez historie skrytý |
| `test_bundle.js` | že `extraliga_apps_script_komplet.gs` odpovídá zdrojům (po změně spusť `node skripty/sestav_apps_script.js`) |
| `test_form.js` | formulář: výběr týmů, žolíci, generované otázky, kontrola před odesláním, odeslaná pole |
| `test_prehled.js` | přehled 26/27 před uzávěrkou (jen tipy) i po ní (body, záložky, karta hráče) |
| `test_stav.js` | automatická tabulka: platný snímek (finále), neplatný snímek (záloha z listu), před startem nic z výsledků, průběžně jen pořadí a týmové otázky ze statistik |
| `test_zmeny.js` | vyhodnocení 25/26: stupně vítězů, karta bez oblíbenosti, matice bez %, TOP 10 se správnou odpovědí, lišta s ročníkem, text pravidel |
| `test_2526_snap.js` | vyhodnocení 25/26 ze snímku dat (298 tipujících, vítěz, karta) |
| `test_lista.js` | lišta se nikde neořezává (400–1440 px) a od 1250 px je na jednom řádku; měří se skutečnými fonty (potřebuje internet) |
| `test_mistri_filtr.js` | společný tip „Mistři světa“ jako pátá karta s logem a bez koruny, není mezi fanoušky; filtr matice podle oblíbeného klubu (počty, procenta z podmnožiny) |
| `test_naseptavac.js` | našeptávač jmen hráčů ve formuláři: nabídka podle jména i příjmení, klub u hráče, výběr klávesnicí, brankáři mimo icetime |
| `test_index.js` | úvodní stránka bez chyb v konzoli |
| `test_vzhled.js` | screenshoty formuláře a přehledu (desktop/iPad/mobil) do `vystup/` |
