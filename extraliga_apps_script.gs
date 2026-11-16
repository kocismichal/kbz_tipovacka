/**
 * extraliga_apps_script.gs  →  obsah souboru web.gs v projektu Apps Script
 * Google Apps Script tipovačky "Extraliga Mistrů světa" 2026/27 (tabulka s listy "Tipy" a "Přehled HOTOVO").
 *
 * Projekt Apps Script má víc souborů: spolecne.gs (= extraliga_spolecne.js z webu, zkopírovaný 1:1),
 * web.gs (= tento soubor) a případně další (Bodování.gs, statistiky.gs, Menu-SKRIPTY.gs), které se nemění.
 * Rozložení sloupců (EXTRALIGA.SLOUPCE), názvy sloupců (EXTRALIGA.HLAVICKA) i mapování polí formuláře
 * na sloupce (EXTRALIGA.radekZFormulare) se berou ze spolecne.gs. Všechny pomocné funkce tady mají
 * předponu "web", aby nekolidovaly s funkcemi v ostatních souborech.
 *
 * Web volá:
 *   POST <URL>                               uložení tipu z formuláře (stejný e-mail = přepsání tipu), jen do uzávěrky
 *   GET  <URL>?action=getCount               { "pocet": 12 }
 *   GET  <URL>?action=data&sheet=Tipy        celý list jako pole řádků (sloupce E-mail a Vzkaz se ven neposílají)
 *   GET  <URL>?action=data&sheet=Přehled HOTOVO
 * Jiné listy web číst nesmí.
 *
 * Postup po přidání žolíků a nových otázek (podrobně v extraliga_navod.md):
 *   1. spolecne.gs nahradit novým extraliga_spolecne.js, web.gs nahradit tímto souborem
 *   2. spustit z editoru funkci doplnHlavicky() – přidá sloupce a jejich názvy (Tipy A–AX, Přehled HOTOVO A–BL)
 *   3. Nasadit → Spravovat nasazení → tužka → Verze: Nová verze → Nasadit (URL zůstane stejná)
 *   4. poslat z webu zkušební tip a zkontrolovat, že se vyplnily i sloupce AK–AX
 */

var WEB_LIST_TIPY = "Tipy";
var WEB_LIST_HOTOVO = "Přehled HOTOVO";
var WEB_MAX_RADKU = 5000;   // víc řádků list Tipy nepřijme (ochrana před zahlcením)
var WEB_MAX_JMENO = 80;     // nejdelší jméno
var WEB_MAX_TEXT = 200;     // nejdelší odpověď
var WEB_MAX_VZKAZ = 1500;   // nejdelší vzkaz
// Automaticky stažená tabulka Extraligy (GitHub Actions v repu webu). Když existuje a je platná, bere se z ní
// pořadí a body týmů; bonusové odpovědi zůstávají v řádku 2 listu Přehled HOTOVO.
var WEB_STAV_URL = "https://raw.githubusercontent.com/kocismichal/kbz_tipovacka/main/2627_extraliga_stav.json";

// ---------- POST: uložení tipu ----------
function doPost(e) {
  // Uzávěrku hlídá i server – zavřený formulář v prohlížeči jde obejít přímým požadavkem.
  if (webPoUzaverce(new Date())) return webJson({ ok: false, error: "Po uzávěrce se tipy nepřijímají." });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WEB_LIST_TIPY);
    if (!sheet) return webJson({ ok: false, error: "Tip se nepodařilo uložit." });

    var param = (e && e.parameter) || {};
    if (EXTRALIGA.norm(param.jmeno) === "") return webJson({ ok: false, error: "Chybí jméno." });
    var row = webOcistiRadek(EXTRALIGA.radekZFormulare(param, new Date()));
    webZajistiSloupce(sheet, row.length);

    var email = EXTRALIGA.normKlic(param.email);
    var radek = email ? webNajdiRadekPodleEmailu(sheet, email) : 0;
    var prepsano = radek > 0;
    if (!prepsano) {
      // Pojistka proti zahlcení: nové řádky jen do rozumného počtu (přepis vlastního tipu jde dál)
      if (sheet.getLastRow() > WEB_MAX_RADKU) return webJson({ ok: false, error: "Tipovačka je plná." });
      radek = sheet.getLastRow() + 1;
    }
    sheet.getRange(radek, 1, 1, row.length).setValues([row]);

    return webJson({ ok: true, radek: radek, prepsano: prepsano });
  } finally {
    lock.releaseLock();
  }
}

// ---------- GET: data pro web ----------
function doGet(e) {
  var param = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (param.action === "getCount") {
    return webJson({ pocet: webPocetTipu(ss.getSheetByName(WEB_LIST_TIPY)) });
  }
  if (param.action === "data") {
    // Web smí číst jen tyto dva listy. Rozhoduje skutečný název nalezeného listu, ne text z adresy:
    // getSheetByName nerozlišuje velikost písmen, takže "sheet=tipy" dřív obešlo skrytí e-mailů.
    var sheet = ss.getSheetByName(param.sheet || WEB_LIST_TIPY);
    var nazev = sheet ? sheet.getName() : "";
    if (nazev !== WEB_LIST_TIPY && nazev !== WEB_LIST_HOTOVO) return webJson({ error: "List nenalezen." });
    return webJson(webDataListu(sheet));
  }
  return webJson({ error: "Neznámá akce. Použij ?action=getCount nebo ?action=data&sheet=Tipy" });
}

// Celý list jako pole řádků. E-maily (osobní údaj) a vzkazy se vždy nahradí prázdným textem – web je nepotřebuje
// a oba listy mají stejné rozložení sloupců. Datum se převede na text.
function webDataListu(sheet) {
  var data = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  return data.map(function (r, i) {
    return r.map(function (v, j) {
      if (i > 0 && (j === EXTRALIGA.SLOUPCE.EMAIL || j === EXTRALIGA.SLOUPCE.VZKAZ)) return "";
      if (v instanceof Date) return Utilities.formatDate(v, tz, "d.M.yyyy H:mm");
      return v;
    });
  });
}

// Je po uzávěrce? (KONFIG.DEADLINE má časovou zónu, takže nezáleží na nastavení projektu skriptu)
function webPoUzaverce(ted) {
  return ted.getTime() >= new Date(EXTRALIGA.KONFIG.DEADLINE).getTime();
}

// Úprava hodnot před zápisem do tabulky:
// - text začínající = + - @ by tabulka uložila jako vzorec (dal by se jím přečíst cizí sloupec včetně e-mailů
//   nebo napsat tip, který se sám srovná podle výsledků) – apostrof na začátku z něj udělá obyčejný text,
// - délka se omezí, ať jedno pole nezahltí tabulku ani přehled.
function webOcistiRadek(row) {
  return row.map(function (v, j) {
    if (typeof v !== "string") return v;
    var max = j === EXTRALIGA.SLOUPCE.VZKAZ ? WEB_MAX_VZKAZ : (j === EXTRALIGA.SLOUPCE.JMENO ? WEB_MAX_JMENO : WEB_MAX_TEXT);
    if (v.length > max) v = v.slice(0, max);
    return /^[=+@-]/.test(v) ? "'" + v : v;
  });
}

// Počet řádků s vyplněným jménem (bez hlavičky).
function webPocetTipu(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var jmena = sheet.getRange(2, EXTRALIGA.SLOUPCE.JMENO + 1, sheet.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < jmena.length; i++) if (EXTRALIGA.norm(jmena[i][0]) !== "") n++;
  return n;
}

// Číslo řádku (1 = hlavička) s daným e-mailem (porovnává se bez mezer a velikosti písmen), jinak 0.
function webNajdiRadekPodleEmailu(sheet, email) {
  if (sheet.getLastRow() < 2) return 0;
  var emaily = sheet.getRange(2, EXTRALIGA.SLOUPCE.EMAIL + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < emaily.length; i++) {
    if (EXTRALIGA.normKlic(emaily[i][0]) === email) return i + 2;
  }
  return 0;
}

// List musí mít aspoň tolik sloupců, kolik zapisujeme (jinak getRange spadne).
function webZajistiSloupce(sheet, pocet) {
  var max = sheet.getMaxColumns();
  if (max < pocet) sheet.insertColumnsAfter(max, pocet - max);
}

function webJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- POMOCNÉ FUNKCE (spouštějí se ručně z editoru) ----------

/**
 * Doplní názvy sloupců do řádku 1 listů Tipy (A–AX) a Přehled HOTOVO (A–BL) podle EXTRALIGA.HLAVICKA.
 * Přepisuje jen PRÁZDNÉ buňky hlavičky, existující názvy nechá být.
 */
function doplnHlavicky() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  webDoplnHlavickuListu(ss.getSheetByName(WEB_LIST_TIPY), EXTRALIGA.SLOUPCE.POCET_TIPU);
  webDoplnHlavickuListu(ss.getSheetByName(WEB_LIST_HOTOVO), EXTRALIGA.SLOUPCE.POCET);
}

function webDoplnHlavickuListu(sheet, pocet) {
  if (!sheet) return;
  webZajistiSloupce(sheet, pocet);
  var range = sheet.getRange(1, 1, 1, pocet);
  var hodnoty = range.getValues()[0];
  for (var i = 0; i < pocet; i++) {
    if (EXTRALIGA.norm(hodnoty[i]) === "") hodnoty[i] = EXTRALIGA.HLAVICKA[i];
  }
  range.setValues([hodnoty]);
}

// Stáhne snímek automatické tabulky z GitHubu; vrátí null, když neexistuje nebo neprojde kontrolou.
function webNactiStavTabulky() {
  try {
    var odpoved = UrlFetchApp.fetch(WEB_STAV_URL + "?v=" + Date.now(), { muteHttpExceptions: true });
    if (odpoved.getResponseCode() !== 200) return null;
    var stav = JSON.parse(odpoved.getContentText());
    return EXTRALIGA.platnyStavTabulky(stav) ? stav : null;
  } catch (err) {
    return null;
  }
}

/**
 * Kontrola bodování přímo v tabulce: do protokolu (Zobrazit → Protokoly) vypíše body všech tipujících
 * podle řádku 2 listu Přehled HOTOVO – stejný výpočet, jaký dělá web.
 */
function vypisBodovaniDoProtokolu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tipy = ss.getSheetByName(WEB_LIST_TIPY).getDataRange().getValues();
  var hotovo = ss.getSheetByName(WEB_LIST_HOTOVO).getDataRange().getValues();
  var vysledky = hotovo.length > 1 ? hotovo[1] : [];
  var stav = webNactiStavTabulky();
  if (stav) Logger.log("Pořadí a body týmů: automatická tabulka z " + stav.aktualizovano + " (" + stav.zdroj + ")");
  else Logger.log("Pořadí a body týmů: řádek 2 listu " + WEB_LIST_HOTOVO + " (automatická tabulka není k dispozici)");
  // Stejné složení výsledků jako na webu: průběžně jen pořadí a týmové otázky ze statistik, ve finále i řádek 2 listu
  vysledky = EXTRALIGA.sestavVysledky(vysledky, stav);
  Logger.log("Režim bodování: " + (EXTRALIGA.KONFIG.FINALE ? "finále (řádek 2 listu + automatická tabulka)" : "průběžně (jen pořadí z tabulky a týmové otázky ze statistik hokej.cz)"));
  Logger.log("Výsledky k dispozici: " + EXTRALIGA.jsouVysledky(vysledky));
  for (var i = 1; i < tipy.length; i++) {
    var jmeno = EXTRALIGA.norm(tipy[i][EXTRALIGA.SLOUPCE.JMENO]);
    if (jmeno === "") continue;
    var v = EXTRALIGA.vyhodnot(tipy[i], vysledky);
    Logger.log(jmeno + ": celkem " + v.celkem + " (pořadí " + v.umisteni.celkem + ", žolíci " + v.zolici.celkem + ", bonusy " + v.bonusy.celkem + ")");
  }
}
