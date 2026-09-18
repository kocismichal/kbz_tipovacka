# Tipovačky – kontext projektu pro Claude Code

Statický web (GitHub Pages z větve `main`, https://kocismichal.github.io/kbz_tipovacka/) se dvěma
tipovačkami: **KBZ** (Chance liga, ChNL – podcast Kudy běží zajíc) a **Mistři světa · Extraliga**
(podcast Mistři světa). Čisté HTML/CSS/JS bez build kroku, UI, komentáře i commity **česky**.
Majitel pracuje často jen z iPadu, proto má vše jít nasadit bez PC (PR → merge do `main`).

## Zlaté pravidlo

**Stránky KBZ se nemění** (`2627_prehled_chance.html`, `2627_prehled_chnl.html`, `2526_chanceliga.html`,
`2526_chnl.html`, jejich data a obrázky), pokud to majitel výslovně nezadá. Sdílené soubory
(`navbar.js`, `style.css`, `index.html`) měň jen opatrně a ověř, že KBZ stránky vypadají stejně.

## Sekce Extraliga (Mistři světa) – soubory

| Soubor | Role |
|--------|------|
| `extraliga_spolecne.js` | **Jediné místo pravdy**: konfigurace (`KONFIG`: sezóna, uzávěrka, `BODOVANI_OD`, týmy, loga, Mistři), sloupce tabulky (`SLOUPCE`), bonusové otázky (`BONUSY`, data-driven – formulář i přehled se z nich generují), bodování (`vyhodnot`, `bodyUmisteni`, `bodyZolici`, `bodyBonusy`), sloučení automatické tabulky (`platnyStavTabulky`, `slucStavTabulky`). Čistý JS bez DOM – používá ho web i Apps Script. |
| `2627_form_extraliga.html` | Formulář tipu 2026/27 (pořadí 14 týmů, 3 žolíci, bonusové otázky, tipy Mistrů), POST do Apps Scriptu. |
| `2627_prehled_extraliga.html` | Přehled tipů 2026/27: před uzávěrkou jen tipy, po ní body, žebříček, karty hráčů, statistiky. |
| `2526_extraliga.html` + `2526_extraliga_data.json` | Vyhodnocení ročníku 2025/26 ze snímku dat (298 tipujících, bez e-mailů). |
| `extraliga.css` | Ledový vzhled, jen pod `body.extraliga` (červené nadpisy, bílé panely, pozadí `mistri_led.jpg`). |
| `extraliga_apps_script.gs` | Kód Google Apps Scriptu (doPost ukládá tip, doGet vrací data listů, `doplnHlavicky`, `vypisBodovaniDoProtokolu`). |
| `extraliga_apps_script_komplet.gs` | **Generovaný** bundle = `skripty/apps_script_hlavicka.gs` + `extraliga_spolecne.js` + `extraliga_apps_script.gs`. Po změně zdrojů spusť `node skripty/sestav_apps_script.js` (test `test_bundle.js` to hlídá). |
| `extraliga_zavadec.gs` | Jediný soubor v projektu Apps Scriptu u majitele: stahuje bundle z `main` (cache 5 min, záloha v PropertiesService). Změna v repu se v tabulce projeví sama, nic se nekopíruje. |
| `skripty/stahni_tabulku_extraligy.js` + `.github/workflows/extraliga_tabulka.yml` | Automatická tabulka: denně 4:30 UTC (i ručně) stáhne pořadí, body a statistiky týmů (góly, góly v přesilovkách, trestné minuty ze sloupců Skóre/GPř/T široké tabulky) z hokej.cz (záloha cs.wikipedia bez statistik), zkontroluje a uloží `2627_extraliga_stav.json`; každý nový stav tabulky přidá do `2627_extraliga_historie.json` (snímky pro graf). |
| `extraliga_soupisky.js` | **Generovaný** seznam hráčů 14 klubů (jméno, tým, pozice) pro našeptávač u otázek na hráče ve formuláři. Vytváří ho `skripty/stahni_soupisky.js` z hokej.cz (stránky klubů → Soupiska); workflow `.github/workflows/extraliga_soupisky.yml` ho obnovuje každé pondělí (i ručně). Neupravovat ručně. |
| `extraliga_navod.md` | Návod pro majitele (sloupce tabulky, žolíci, otázky, automatika). Při změně chování aktualizuj. |
| `testy/` | Testy (Node + Playwright), viz `testy/README.md`. |

## Jak to funguje (klíčové věci)

- **Data**: Google tabulka s listy `Tipy` (řádek 1 hlavička, řádky 2–5 tipy Mistrů, dál fanoušci) a
  `Přehled HOTOVO` (řádek 2 = výsledky). Web čte přes Apps Script `?action=data&sheet=…`, e-maily se nevrací.
  Indexy sloupců (0-based) jsou v `SLOUPCE`: pořadí E–R (4–17), bonusy 18–29 a 42–49, žolíci 36–41,
  body týmů na 1.–14. místě AY–BL (50–63, jen v Přehled HOTOVO).
- **Pořadí a body týmů** bere web i Apps Script z `2627_extraliga_stav.json` (automatika); řádek 2 listu
  je záloha pořadí. **Odpovědi na bonusové otázky** se vyplňují ručně v řádku 2 (sloupce S–AX) – platí až ve finále.
- **Dva režimy bodování** (`EXTRALIGA.sestavVysledky(vysledkyRow, stav)` skládá řádek výsledků):
  *průběžně* (`KONFIG.FINALE: false`, od startu sezóny `BODOVANI_OD` 16. 9. 2026) se bodují jen pořadí (žolíci 2×)
  a otázky z `KONFIG.PRUBEZNE_BONUSY` (nejvíc gólů, nejvíc gólů v přesilovkách, nejvíc / nejméně trestných minut)
  podle `stav.statistiky` (`prubezneOdpovedi`); body týmů se do řádku nedávají (tipy na body žolíků = 0) a ruční
  odpovědi z listu se ignorují. *Finále* (`FINALE: true`, přepnout po konci základní části) = řádek 2 listu +
  snímek jako dřív; ruční odpověď má přednost, prázdnou průběžnou otázku doplní statistika. Web podle režimu skrývá
  sloupec a záložku žolíků a u nevyhodnocených položek ukazuje „po sezóně“.
- **Graf vývoje** (`vykresliGraf` v přehledu): z každého snímku historie spočítá průběžné body všech tipujících,
  kreslí inline SVG (body / pořadí) pro Mistry + 3 nejlepší fanoušky + ručně přidané. Bez historie je sekce skrytá.
- **Bodování**: umístění 10 − |rozdíl míst| (min 0), násobek 1,1/1,2/1,3/1,4 za 7/9/11/13 přesných;
  žolíci: umístění 2×, tip na body žolíka = číselná škála 2× (20/16/12/8/4); číselné otázky 10/8/6/4/2;
  týmové a hráčské 20 b.; finále play-off a Ano/Ne 10 b. Text pravidel ve formuláři musí sedět s kódem.
- **Loga týmů** jsou z imgur (`KONFIG.LOGA`), při chybě náhradní `logo_neznamy.svg` (`onerror`).
- **Lišta** (`navbar.js`): dlaždice nesou ročník, obsah se musí vejít do 1200 px (test `test_lista.js`).
  Na ledových stránkách je tmavě modrá (kontrast k ledu), nikdy se neořezává (co se nevejde, zalomí se pod
  řádek, např. iPad) a na počítači je se skutečnými fonty na jednom řádku. `test_lista.js` proto fonty
  z fonts.googleapis.com načítá – s náhradními fonty je obsah užší a ořez by se neodhalil.
- **Mistři v přehledu**: karty se poznávají podle jména tipu (`KONFIG.MISTRI_DETAIL`, `jeMistr`). Pátá položka
  je **společný tip podcastu** odeslaný pod jménem „Mistři světa“ (`spolecny: true`, `jeSpolecnyTip`): má kartu
  s logem `mistri_sveta_logo.png` a štítkem, řadí se poslední, nedostává korunu, není ve fanoušcích ani v otázkách
  „Kdo z Mistrů…“ (ty jdou z `KONFIG.MISTRI`). V žebříčku soutěží jako kdokoli jiný.
- **Filtr matice „Jak vidíte tabulku vy?“**: výběr `#matrix-klub` (fanoušci klubu podle oblíbeného týmu z tipu,
  s počty) přepočítá matici i procenta jen z vybrané podmnožiny (`spocitejMatici(hraci)`, `formatProcenta(pocet, zaklad)`).
- **Našeptávač hráčů** (formulář, `initNaseptavacHracu`): u každé textové otázky (střelec, nejtrestanější hráč,
  icetime, procento gólů) nabízí jména z `extraliga_soupisky.js` podle začátku jména nebo příjmení bez diakritiky,
  s klubem a pozicí; výběr doplní přesné „Jméno Příjmení“ (tak se pak boduje shoda textu). U icetime jsou brankáři
  vynechaní. Volný text zůstává možný (test `test_naseptavac.js`).

## Pracovní postup

1. Větev → změny → `cd testy && npm test` (poprvé `npm install` a `npx playwright install chromium`).
2. Po změně `extraliga_spolecne.js` / `extraliga_apps_script.gs`: `node skripty/sestav_apps_script.js`.
3. Commit česky, PR do `main`, po merge se web sám přegeneruje (GitHub Pages).
4. Screenshoty z testů jsou v `testy/vystup/` – při vzhledových změnách je zkontroluj (desktop, iPad, mobil).

## Na co myslet (stav k 12. 9. 2026)

- V řádku 2 listu `Přehled HOTOVO` jsou zatím **loňské výsledky** – průběžně se pro bonusy ignorují, ale pořadí
  E2–R2 by se použilo, kdyby selhal snímek tabulky; majitel má řádek vyčistit a před přepnutím `FINALE` vyplnit
  letošní odpovědi.
- Sezóna Extraligy běží od 16. 9. 2026, bodování pořadí je průběžné; tipování je otevřené do 30. 9. 2026.
- `KONFIG.REKORDY.goly_zakladni_cast` je prázdné (rekordní počet gólů základní části se doplní do otázky).
- GitHub vypne plánované workflow po 60 dnech bez aktivity v repu – stačí ho znovu povolit.
