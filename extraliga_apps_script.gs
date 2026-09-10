/**
 * extraliga_apps_script.gs
 * Google Apps Script tipovačky "Extraliga Mistrů světa" 2026/27 (tabulka s listy "Tipy" a "Přehled HOTOVO").
 *
 * V projektu Apps Script musí být VEDLE tohoto souboru i soubor extraliga_spolecne.js z webu (zkopírovaný 1:1,
 * v editoru Apps Scriptu pojmenovaný třeba "extraliga_spolecne.gs"). Odtud se bere rozložení sloupců
 * (EXTRALIGA.SLOUPCE), názvy sloupců (EXTRALIGA.HLAVICKA) i mapování polí formuláře na sloupce
 * (EXTRALIGA.radekZFormulare). Po každé změně extraliga_spolecne.js na webu ho v Apps Scriptu přepiš
 * a nasaď novou verzi (Nasadit → Spravovat nasazení → tužka → Verze: Nová verze → Nasadit; URL zůstane stejná).
 *
 * Web volá:
 *   POST <URL>                               uložení tipu z formuláře (stejný e-mail = přepsání tipu)
 *   GET  <URL>?action=getCount               { "pocet": 12 }
 *   GET  <URL>?action=data&sheet=Tipy        celý list jako pole řádků (sloupec E-mail se ven neposílá)
 *   GET  <URL>?action=data&sheet=Přehled HOTOVO
 *
 * Postup po přidání žolíků a nových otázek (podrobně v extraliga_navod.md):
 *   1. spusť z editoru funkci doplnHlavicky() – doplní názvy nových sloupců AK–AX (Tipy) a AK–BL (Přehled HOTOVO)
 *   2. nasaď novou verzi
 *   3. pošli z webu zkušební tip a zkontroluj, že se vyplnily i sloupce AK–AX
 */

var LIST_TIPY = "Tipy";
var LIST_HOTOVO = "Přehled HOTOVO";

// ---------- POST: uložení tipu ----------
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIST_TIPY);
    if (!sheet) return json({ ok: false, error: "List nenalezen: " + LIST_TIPY });

    var param = (e && e.parameter) || {};
    var row = EXTRALIGA.radekZFormulare(param, new Date());
    zajistiSloupce(sheet, row.length);

    var email = EXTRALIGA.normKlic(param.email);
    var radek = email ? najdiRadekPodleEmailu(sheet, email) : 0;
    var prepsano = radek > 0;
    if (!prepsano) radek = sheet.getLastRow() + 1;
    sheet.getRange(radek, 1, 1, row.length).setValues([row]);

    return json({ ok: true, radek: radek, prepsano: prepsano });
  } finally {
    lock.releaseLock();
  }
}

// ---------- GET: data pro web ----------
function doGet(e) {
  var param = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (param.action === "getCount") {
    return json({ pocet: pocetTipu(ss.getSheetByName(LIST_TIPY)) });
  }
  if (param.action === "data") {
    var nazev = param.sheet || LIST_TIPY;
    var sheet = ss.getSheetByName(nazev);
    if (!sheet) return json({ error: "List nenalezen: " + nazev });
    return json(dataListu(sheet, nazev === LIST_TIPY));
  }
  return json({ error: "Neznámá akce. Použij ?action=getCount nebo ?action=data&sheet=Tipy" });
}

// Celý list jako pole řádků. U listu Tipy se e-maily (osobní údaj) nahradí prázdným textem, datum se převede na text.
function dataListu(sheet, skryjEmail) {
  var data = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  return data.map(function (r, i) {
    return r.map(function (v, j) {
      if (skryjEmail && i > 0 && j === EXTRALIGA.SLOUPCE.EMAIL) return "";
      if (v instanceof Date) return Utilities.formatDate(v, tz, "d.M.yyyy H:mm");
      return v;
    });
  });
}

// Počet řádků s vyplněným jménem (bez hlavičky).
function pocetTipu(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var jmena = sheet.getRange(2, EXTRALIGA.SLOUPCE.JMENO + 1, sheet.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < jmena.length; i++) if (EXTRALIGA.norm(jmena[i][0]) !== "") n++;
  return n;
}

// Číslo řádku (1 = hlavička) s daným e-mailem (porovnává se bez mezer a velikosti písmen), jinak 0.
function najdiRadekPodleEmailu(sheet, email) {
  if (sheet.getLastRow() < 2) return 0;
  var emaily = sheet.getRange(2, EXTRALIGA.SLOUPCE.EMAIL + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < emaily.length; i++) {
    if (EXTRALIGA.normKlic(emaily[i][0]) === email) return i + 2;
  }
  return 0;
}

// List musí mít aspoň tolik sloupců, kolik zapisujeme (jinak getRange spadne).
function zajistiSloupce(sheet, pocet) {
  var max = sheet.getMaxColumns();
  if (max < pocet) sheet.insertColumnsAfter(max, pocet - max);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- POMOCNÉ FUNKCE (spouštějí se ručně z editoru) ----------

/**
 * Doplní názvy sloupců do řádku 1 listů Tipy (A–AX) a Přehled HOTOVO (A–BL) podle EXTRALIGA.HLAVICKA.
 * Přepisuje jen PRÁZDNÉ buňky hlavičky, existující názvy nechá být.
 */
function doplnHlavicky() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  doplnHlavicku(ss.getSheetByName(LIST_TIPY), EXTRALIGA.SLOUPCE.POCET_TIPU);
  doplnHlavicku(ss.getSheetByName(LIST_HOTOVO), EXTRALIGA.SLOUPCE.POCET);
}

function doplnHlavicku(sheet, pocet) {
  if (!sheet) return;
  zajistiSloupce(sheet, pocet);
  var range = sheet.getRange(1, 1, 1, pocet);
  var hodnoty = range.getValues()[0];
  for (var i = 0; i < pocet; i++) {
    if (EXTRALIGA.norm(hodnoty[i]) === "") hodnoty[i] = EXTRALIGA.HLAVICKA[i];
  }
  range.setValues([hodnoty]);
}

/**
 * Kontrola bodování přímo v tabulce: do protokolu (Zobrazit → Protokoly) vypíše body všech tipujících
 * podle řádku 2 listu Přehled HOTOVO – stejný výpočet, jaký dělá web.
 */
function vypisBodovani() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tipy = ss.getSheetByName(LIST_TIPY).getDataRange().getValues();
  var hotovo = ss.getSheetByName(LIST_HOTOVO).getDataRange().getValues();
  var vysledky = hotovo.length > 1 ? hotovo[1] : [];
  Logger.log("Výsledky k dispozici: " + EXTRALIGA.jsouVysledky(vysledky));
  for (var i = 1; i < tipy.length; i++) {
    var jmeno = EXTRALIGA.norm(tipy[i][EXTRALIGA.SLOUPCE.JMENO]);
    if (jmeno === "") continue;
    var v = EXTRALIGA.vyhodnot(tipy[i], vysledky);
    Logger.log(jmeno + ": celkem " + v.celkem + " (pořadí " + v.umisteni.celkem + ", žolíci " + v.zolici.celkem + ", bonusy " + v.bonusy.celkem + ")");
  }
}
