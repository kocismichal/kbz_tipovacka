# Extraliga Mistrů světa 26/27 – žolíci a nové otázky: co udělat v Google Sheets

Web (formulář, přehled i bodování) je hotový. Aby se nové tipy ukládaly a bodovaly, je potřeba
**doplnit sloupce v tabulce a nasadit novou verzi Apps Scriptu**. Původní sloupce A–AJ zůstávají
beze změny, všechno nové je přidané **na konec**, takže se nic neposouvá a staré tipy zůstávají platné.

## 1. Nové sloupce

### List `Tipy` (zapisuje formulář, A–AX)

| Sloupec | Název (hlavička) | Co v něm je |
|---------|------------------|-------------|
| A–AJ | *(beze změny)* | datum, jméno, e-mail, klub, 1.–14. místo, původní bonusy, Mistři, vzkaz |
| AK | Žolík 1 | tým 1. žolíka |
| AL | Žolík 1 body | tip, kolik bodů 1. žolík získá v základní části |
| AM | Žolík 2 | tým 2. žolíka |
| AN | Žolík 2 body | tip bodů 2. žolíka |
| AO | Žolík 3 | tým 3. žolíka |
| AP | Žolík 3 body | tip bodů 3. žolíka |
| AQ | Rekord gólů ZČ | Ano/Ne – překonání rekordu v celkovém počtu gólů základní části |
| AR | Nejméně trestaný tým | tým |
| AS | Stránský vs. Růžička | Ano/Ne – překoná Stránský 40 gólů Růžičky (ZČ 2012/13) |
| AT | Největší icetime | jméno hráče v poli |
| AU | Procento gólů týmu | jméno hráče |
| AV | Body P. Tomek | číslo (body Petra Tomka v základní části) |
| AW | Duda angažmá | Ano/Ne |
| AX | Galvas do USA | Ano/Ne |

### List `Přehled HOTOVO` (řádek 2 = správné výsledky, A–BL)

Řádek 2 má stejné rozložení jako `Tipy`, navíc na konci:

| Sloupec | Název | Co do něj dát |
|---------|-------|---------------|
| AK–AP | Žolík 1 … Žolík 3 body | nic (žolíky má každý jiné, správné body týmů jsou v AY–BL) |
| AQ–AX | nové otázky | správné odpovědi po konci základní části (stejně jako S–AD) – `Ano`/`Ne`, název týmu, jméno hráče, číslo |
| AY–BL | Body 1. místa … Body 14. místa | **body týmu, který je na 1.–14. místě** (ve stejném pořadí jako názvy týmů v E2–R2) |

Do AY2–BL2 dej buď vzorce na sloupec s body v tabulce pořadí (řádky 11–24 – stejně jako E2–R2 odkazují
na názvy týmů, např. `=H11` … `=H24`, podle toho, ve kterém sloupci máš body), nebo je vyplň ručně až po
konci základní části. Dokud jsou prázdné, tipy na body žolíků se prostě nebodují (0 b.), body za umístění
žolíků se násobí hned od prvního kola.

U textových odpovědí platí stejné pravidlo jako dosud: víc přijatelných variant odděl čárkou
(`Sparta Praha, Pardubice`), porovnává se bez ohledu na velikost písmen.

## 2. Postup (cca 5 minut)

1. V tabulce otevři **Rozšíření → Apps Script**.
2. Soubor se společnou konfigurací (obsah `extraliga_spolecne.js` z webu) **přepiš novou verzí** 1:1.
   Pokud v projektu ještě není, přidej ho jako nový soubor (např. `extraliga_spolecne.gs`).
3. Obsah `extraliga_apps_script.gs` vlož místo dosavadního kódu s `doPost` / `doGet`
   (chování pro web je stejné: `POST` = uložení tipu s přepsáním podle e-mailu, `?action=getCount`,
   `?action=data&sheet=…`, e-maily se ven neposílají).
4. V editoru vyber funkci **`doplnHlavicky`** a spusť ji – doplní názvy nových sloupců do řádku 1 obou
   listů (přepisuje jen prázdné buňky hlavičky). Při prvním spuštění potvrď oprávnění.
5. **Nasadit → Spravovat nasazení → tužka → Verze: Nová verze → Nasadit.** URL zůstane stejná,
   na webu se nic měnit nemusí.
6. Pošli z formuláře zkušební tip a zkontroluj, že se v `Tipy` vyplnily i sloupce AK–AX. Zkušební řádek
   pak smaž.
7. Funkce **`vypisBodovani`** vypíše do protokolu body všech tipujících podle řádku 2 listu
   `Přehled HOTOVO` – stejný výpočet, jaký dělá web (hodí se na kontrolu během sezóny).

## 3. Pravidla žolíků (jak jsou naprogramovaná)

- Každý vybere **3 žolíky** ze svého pořadí (3 různé týmy) a u každého tipne **body v základní části**.
- **Umístění žolíka se počítá 2x**: přesně = 20 b., o 1 místo vedle = 18 b., … Bonusové násobky za
  přesné trefy (1,1x–1,4x) se pak počítají z celého součtu včetně žolíků.
- **Tip na body žolíka** = dvojnásobek běžné číselné škály: přesně 20 b., o 1 vedle 16, o 2 = 12,
  o 3 = 8, o 4 = 4 b. Body se berou podle toho, na kterém místě žolík skutečně skončil (E2–R2 → AY2–BL2).
- V přehledu je nová záložka **Body za žolíky** a sloupec v celkovém pořadí, v kartě hráče sekce Žolíci
  a žolíkové týmy mají v mřížce žlutý štítek.

Počet žolíků a násobky jsou v `extraliga_spolecne.js` (`POCET_ZOLIKU`, `ZOLIK_NASOBEK_UMISTENI`,
`ZOLIK_NASOBEK_BODU`) – při změně počtu žolíků se mění i sloupce, tak to raději nech na 3.

## 4. Nové bonusové otázky a jejich bodování

| Otázka | Typ | Body |
|--------|-----|------|
| Bude v základní části překonán rekord v celkovém počtu vstřelených gólů (všechny týmy dohromady)? | Ano/Ne | 10 |
| Který tým bude v základní části nejméně trestaný? | tým | 20 |
| Překoná Matěj Stránský (Pardubice) rekord Martina Růžičky v počtu gólů za jednu základní část? (40 gólů, 2012/13) | Ano/Ne | 10 |
| Který hráč v poli bude mít za základní část největší celkový čas na ledě (icetime)? | hráč | 20 |
| Který hráč vstřelí největší procento gólů svého týmu? | hráč | 20 |
| Kolik bodů (góly + asistence) udělá Petr Tomek (Karlovy Vary)? | číslo | 10/8/6/4/2 |
| Bude Radek Duda v průběhu sezóny angažován do některého hokejového klubu? | Ano/Ne | 10 |
| Odejde Tomáš Galvas v průběhu sezóny z Liberce do USA (Pittsburgh), nebo za Liberec vůbec nenastoupí? | Ano/Ne | 10 |

Texty otázek, nápovědy „Odpověď 25/26“ i pořadí ve formuláři jsou na jednom místě:
`extraliga_spolecne.js` → `BONUSY` a `KONFIG.ODPOVEDI_2526`. Formulář i přehled si otázky
generují samy, takže další otázka = jeden řádek v `BONUSY` (+ sloupec v tabulce).

**Doplnit:** do `KONFIG.REKORDY.goly_zakladni_cast` napiš rekordní počet gólů základní části
(např. `"1 234 gólů, sezóna 2024/25"`) – doplní se automaticky do textu otázky. Zatím je prázdné,
otázka je bez čísla.

## 5. Na co myslet

- Tipy odeslané **před** touto změnou nemají žolíky ani nové odpovědi (web u nich ukáže „bez žolíků“ /
  „Nevyplněno“ a 0 b.). Stačí, když dotyčný vyplní formulář znovu se stejným e-mailem – tip se přepíše.
- Změny na webu jsou jen v sekci Extraliga (`2627_form_extraliga.html`, `2627_prehled_extraliga.html`,
  `extraliga_spolecne.js`), Chance liga a ChNL zůstaly beze změny.
