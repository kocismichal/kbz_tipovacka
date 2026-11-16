/**
 * ZAVADĚČ tipovačky Extraliga Mistrů světa 2026/27 – jediný soubor, který musí být v Apps Scriptu.
 * Kód (extraliga_apps_script_komplet.gs) si stahuje z GitHubu z větve main, takže se do editoru už nic
 * nevkládá: změna v repu se projeví do 5 minut. Poslední funkční kód se ukládá jako záloha.
 *
 * Pojistky (verze 16. 11. 2026):
 *  - kód se bere jen z větve main (dřív byla záložní adresa na starou větev se zářijovým kódem),
 *  - stažený kód se nejdřív zkusí spustit a teprve potom se uloží jako záloha – rozbitý commit na main
 *    tak zálohu nepřepíše a web jede dál na poslední funkční verzi,
 *  - když GitHub neodpoví nebo je kód rozbitý, použije se záloha.
 *
 * Nasazení: v editoru Apps Scriptu nahradit obsah souboru tímto textem, uložit,
 * Implementovat → Spravovat implementace → tužka → Verze: Nová verze → Implementovat (adresa zůstane stejná).
 */
var KOD_URL = "https://raw.githubusercontent.com/kocismichal/kbz_tipovacka/main/extraliga_apps_script_komplet.gs";
var KOD_KONEC = "\nreturn { EXTRALIGA: EXTRALIGA, doPost: doPost, doGet: doGet, doplnHlavicky: doplnHlavicky, vypisBodovaniDoProtokolu: vypisBodovaniDoProtokolu };";

// Spustí kód a vrátí jeho funkce; když něco chybí nebo kód spadne, vyhodí chybu.
function spustKod(kod) {
  var t = new Function(kod + KOD_KONEC)();
  if (!t || !t.EXTRALIGA || !t.EXTRALIGA.KONFIG) throw new Error("V kódu chybí EXTRALIGA.");
  // Funkce musí pocházet ze staženého kódu. Když v něm některá chybí, najde se místo ní stejnojmenná funkce
  // zavaděče (na konci souboru) a ta by pak volala sama sebe.
  var obaly = { doPost: doPost, doGet: doGet, doplnHlavicky: doplnHlavicky, vypisBodovaniDoProtokolu: vypisBodovaniDoProtokolu };
  for (var nazev in obaly) {
    if (typeof t[nazev] !== "function" || t[nazev] === obaly[nazev]) throw new Error("V kódu chybí funkce " + nazev + ".");
  }
  return t;
}

function ulozZalohu(props, kod) {
  var kusy = kod.match(/[\s\S]{1,6000}/g);
  var zaloha = { kod_pocet: String(kusy.length) };
  for (var j = 0; j < kusy.length; j++) zaloha["kod_" + j] = kusy[j];
  props.setProperties(zaloha);
}

function nactiZalohu(props) {
  var pocet = Number(props.getProperty("kod_pocet") || 0);
  if (!pocet) return "";
  var kod = "";
  for (var k = 0; k < pocet; k++) kod += props.getProperty("kod_" + k);
  return kod;
}

function nactiTipovacku() {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();

  // 1) kód ověřený v posledních 5 minutách
  var kod = cache.get("kod_tipovacky");
  if (kod) {
    try { return spustKod(kod); } catch (err) {}
  }

  // 2) čerstvý kód z GitHubu – použije se a uloží, jen když jde spustit
  try {
    var odpoved = UrlFetchApp.fetch(KOD_URL, { muteHttpExceptions: true });
    if (odpoved.getResponseCode() === 200) {
      var novy = odpoved.getContentText();
      var hotovo = spustKod(novy);
      ulozZalohu(props, novy);
      cache.put("kod_tipovacky", novy, 300);
      return hotovo;
    }
  } catch (err) {}

  // 3) záloha (GitHub neodpověděl nebo je kód na main rozbitý)
  var zaloha = nactiZalohu(props);
  if (!zaloha) throw new Error("Kód tipovačky se nepodařilo stáhnout z GitHubu a záloha ještě neexistuje.");
  var zeZalohy = spustKod(zaloha);
  cache.put("kod_tipovacky", zaloha, 300);
  return zeZalohy;
}

var TIPOVACKA = nactiTipovacku();
var EXTRALIGA = TIPOVACKA.EXTRALIGA;

function doPost(e) { return TIPOVACKA.doPost(e); }
function doGet(e) { return TIPOVACKA.doGet(e); }
function doplnHlavicky() { return TIPOVACKA.doplnHlavicky(); }
function vypisBodovaniDoProtokolu() { return TIPOVACKA.vypisBodovaniDoProtokolu(); }
