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
| `skripty/stahni_tabulku_extraligy.js` + `.github/workflows/extraliga_tabulka.yml` | Automatická tabulka: denně 4:30 UTC (i ručně) stáhne pořadí a body z hokej.cz (záloha cs.wikipedia), zkontroluje a uloží `2627_extraliga_stav.json`. |
| `extraliga_soupisky.js` | **Generovaný** seznam hráčů 14 klubů (jméno, tým, pozice) pro našeptávač u otázek na hráče ve formuláři. Vytváří ho `skripty/stahni_soupisky.js` z hokej.cz (stránky klubů → Soupiska); workflow `.github/workflows/extraliga_soupisky.yml` ho obnovuje každé pondělí (i ručně). Neupravovat ručně. |
| `extraliga_navod.md` | Návod pro majitele (sloupce tabulky, žolíci, otázky, automatika). Při změně chování aktualizuj. |
| `testy/` | Testy (Node + Playwright), viz `testy/README.md`. |

## Jak to funguje (klíčové věci)

- **Data**: Google tabulka s listy `Tipy` (řádek 1 hlavička, řádky 2–5 tipy Mistrů, dál fanoušci) a
  `Přehled HOTOVO` (řádek 2 = výsledky). Web čte přes Apps Script `?action=data&sheet=…`, e-maily se nevrací.
  Indexy sloupců (0-based) jsou v `SLOUPCE`: pořadí E–R (4–17), bonusy 18–29 a 42–49, žolíci 36–41,
  body týmů na 1.–14. místě AY–BL (50–63, jen v Přehled HOTOVO).
- **Pořadí a body týmů** bere web i Apps Script z `2627_extraliga_stav.json` (automatika); řádek 2 listu
  je záloha. **Odpovědi na bonusové otázky** se vyplňují ručně v řádku 2 (sloupce S–AX).
- **Body se ukazují až od `KONFIG.BODOVANI_OD`** (30. 9. 2026) a jen když jsou známé týmy ve výsledcích.
  Do té doby se z řádku výsledků neukazuje nic (ani správné odpovědi v kartách).
- **Bodování**: umístění 10 − |rozdíl míst| (min 0), násobek 1,1/1,2/1,3/1,4 za 7/9/11/13 přesných;
  žolíci: umístění 2×, tip na body žolíka = číselná škála 2× (20/16/12/8/4); číselné otázky 10/8/6/4/2;
  týmové a hráčské 20 b.; finále play-off a Ano/Ne 10 b. Text pravidel ve formuláři musí sedět s kódem.
- **Loga týmů** jsou z imgur (`KONFIG.LOGA`), při chybě náhradní `logo_neznamy.svg` (`onerror`).
- **Lišta** (`navbar.js`): dlaždice nesou ročník, obsah se musí vejít do 1200 px (test `test_lista.js`).
  Na ledových stránkách je tmavě modrá (kontrast k ledu) a do 1150 px šířky se zalamuje do více řádků místo
  skrytého vodorovného posuvníku (iPad).
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

- V řádku 2 listu `Přehled HOTOVO` jsou zatím **loňské výsledky** – před 30. 9. 2026 je majitel smaže
  (jinak by se po uzávěrce počítaly jako letošní odpovědi).
- Sezóna Extraligy startuje 16. 9. 2026; do té doby automatika hlásí „sezóna ještě nezačala“.
- `KONFIG.REKORDY.goly_zakladni_cast` je prázdné (rekordní počet gólů základní části se doplní do otázky).
- GitHub vypne plánované workflow po 60 dnech bez aktivity v repu – stačí ho znovu povolit.
