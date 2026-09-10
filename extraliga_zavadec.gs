/**
 * ZAVADĚČ tipovačky Extraliga Mistrů světa 2026/27 – jediný soubor, který musí být v Apps Scriptu.
 * Kód (extraliga_apps_script_komplet.gs) si stahuje z GitHubu, takže se do editoru už nic nevkládá:
 * změna v repu se projeví do 5 minut. Poslední stažený kód se ukládá jako záloha, kdyby GitHub nejel.
 *
 * Nasazení: smazat staré soubory spolecne.gs a web.gs, vytvořit nový soubor s tímto obsahem, spustit
 * doplnHlavicky (potvrdit oprávnění, včetně "připojení k externí službě"), Implementovat → Nová verze.
 */
var KOD_URLS = [
  "https://raw.githubusercontent.com/kocismichal/kbz_tipovacka/main/extraliga_apps_script_komplet.gs",
  "https://raw.githubusercontent.com/kocismichal/kbz_tipovacka/claude/extraliga-tips-upgrade-aazaxb/extraliga_apps_script_komplet.gs"
];

function nactiKod() {
  var cache = CacheService.getScriptCache();
  var kod = cache.get("kod_tipovacky");
  if (kod) return kod;

  for (var i = 0; i < KOD_URLS.length && !kod; i++) {
    try {
      var odpoved = UrlFetchApp.fetch(KOD_URLS[i], { muteHttpExceptions: true });
      if (odpoved.getResponseCode() === 200) kod = odpoved.getContentText();
    } catch (err) {}
  }

  var props = PropertiesService.getScriptProperties();
  if (kod) {
    var kusy = kod.match(/[\s\S]{1,6000}/g);
    var zaloha = { kod_pocet: String(kusy.length) };
    for (var j = 0; j < kusy.length; j++) zaloha["kod_" + j] = kusy[j];
    props.setProperties(zaloha);
  } else {
    var pocet = Number(props.getProperty("kod_pocet") || 0);
    if (!pocet) throw new Error("Kód tipovačky se nepodařilo stáhnout z GitHubu a záloha ještě neexistuje.");
    kod = "";
    for (var k = 0; k < pocet; k++) kod += props.getProperty("kod_" + k);
  }
  cache.put("kod_tipovacky", kod, 300);
  return kod;
}

var TIPOVACKA = new Function(nactiKod() + "\nreturn { EXTRALIGA: EXTRALIGA, doPost: doPost, doGet: doGet, doplnHlavicky: doplnHlavicky, vypisBodovaniDoProtokolu: vypisBodovaniDoProtokolu };")();
var EXTRALIGA = TIPOVACKA.EXTRALIGA;

function doPost(e) { return TIPOVACKA.doPost(e); }
function doGet(e) { return TIPOVACKA.doGet(e); }
function doplnHlavicky() { return TIPOVACKA.doplnHlavicky(); }
function vypisBodovaniDoProtokolu() { return TIPOVACKA.vypisBodovaniDoProtokolu(); }
