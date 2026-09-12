#!/usr/bin/env node
/*
 * Stáhne soupisky všech 14 klubů Tipsport extraligy z hokej.cz a uloží je do extraliga_soupisky.js
 * (našeptávač jmen hráčů ve formuláři: jméno, klub, pozice). Spouští ho GitHub Actions
 * (.github/workflows/extraliga_soupisky.yml) jednou týdně, jde i ručně:
 *
 *   node skripty/stahni_soupisky.js                 stáhne soupisky a uloží soubor (jen když se něco změnilo)
 *   node skripty/stahni_soupisky.js --rezim sonda   jen vypíše, co hokej.cz vrací, nic neukládá
 *
 * Zdroj: stránka klubu na hokej.cz, záložka Soupiska (/klub/<klub>/<id>/soupiska) – tabulky
 * "table-soupiska" pod nadpisy Brankáři / Obránci / Útočníci. Uloží se jen výsledek, který projde
 * kontrolou (všech 14 klubů, každý aspoň 15 hráčů a aspoň 1 brankář, žádné prázdné jméno). Jinak skript
 * skončí chybou a soubor se nemění – web pak dál nabízí poslední uloženou soupisku.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KOREN = path.join(__dirname, "..");
const VYSTUP = path.join(KOREN, "extraliga_soupisky.js");
const rezim = (process.argv.indexOf("--rezim") !== -1) ? process.argv[process.argv.indexOf("--rezim") + 1] : "aktualizace";

// Společná konfigurace (pořadí týmů) – stejný soubor jako web
const EXTRALIGA = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(KOREN, "extraliga_spolecne.js"), "utf8") + "\nEXTRALIGA;", ctx);
  return ctx.EXTRALIGA;
})();

// Název týmu z KONFIG.TYMY → stránka klubu na hokej.cz (cesta bez /soupiska)
const KLUBY = {
  "Karlovy Vary": "/klub/hc-energie-karlovy-vary/5",
  "Kladno": "/klub/rytiri-kladno/828",
  "Liberec": "/klub/bili-tygri-liberec/18",
  "Litvínov": "/klub/hc-verva-litvinov/823",
  "Pardubice": "/klub/hc-dynamo-pardubice/12",
  "Plzeň": "/klub/hc-skoda-plzen/917",
  "Sparta Praha": "/klub/hc-sparta-praha/8",
  "Třinec": "/klub/hc-ocelari-trinec/11",
  "Vítkovice": "/klub/hc-vitkovice-ridera/7",
  "Mladá Boleslav": "/klub/bk-mlada-boleslav/89",
  "Olomouc": "/klub/hc-olomouc/24",
  "Kometa Brno": "/klub/hc-kometa-brno/22",
  "Mountfield HK": "/klub/mountfield-hk/1711",
  "České Budějovice": "/klub/banes-motor-c-budejovice/1721"
};
const POZICE = { "Brankáři": "B", "Obránci": "O", "Útočníci": "U" };
const MIN_HRACU_KLUBU = 15;

const HLAVICKY = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7"
};
async function stahni(url) {
  const r = await fetch(url, { headers: HLAVICKY, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (r.status !== 200) throw new Error(`HTTP ${r.status} pro ${url}`);
  return r.text();
}

const entity = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (h) => entity(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// Hráči z jedné stránky soupisky: sekce <h3>Brankáři</h3><table class="table-soupiska">…</table>
function parsujSoupisku(html, tym) {
  const hraci = [];
  const reSekce = /<h3>\s*(Brankáři|Obránci|Útočníci)\s*<\/h3>\s*<table class="table-soupiska">([\s\S]*?)<\/table>/g;
  let s;
  while ((s = reSekce.exec(html)) !== null) {
    const pozice = POZICE[s[1]];
    const reRadek = /<tr>([\s\S]*?)<\/tr>/g;
    let r;
    while ((r = reRadek.exec(s[2])) !== null) {
      const bunky = [];
      const reBunka = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let b;
      while ((b = reBunka.exec(r[1])) !== null) bunky.push(b[1]);
      if (bunky.length < 2) continue;
      const jmeno = text(bunky[1]);
      if (jmeno) hraci.push({ j: jmeno, t: tym, p: pozice });
    }
  }
  return hraci;
}

// Kontrola úplnosti: všech 14 klubů, dost hráčů, brankář v každém klubu
function zkontroluj(vsichni) {
  const chyby = [];
  for (const tym of EXTRALIGA.KONFIG.TYMY) {
    const hr = vsichni.filter((h) => h.t === tym);
    if (hr.length < MIN_HRACU_KLUBU) chyby.push(`${tym}: jen ${hr.length} hráčů`);
    if (!hr.some((h) => h.p === "B")) chyby.push(`${tym}: žádný brankář`);
  }
  if (vsichni.some((h) => !h.j || !/\s/.test(h.j))) chyby.push("hráč bez jména a příjmení");
  return chyby;
}

// Stabilní pořadí: podle týmů v KONFIG.TYMY, pak brankáři, obránci, útočníci, pak příjmení (bez diakritiky)
function serad(hraci) {
  const poradiTymu = EXTRALIGA.KONFIG.TYMY;
  const poradiPozic = { B: 0, O: 1, U: 2 };
  const prijmeni = (h) => { const t = EXTRALIGA.bezDiakritiky(h.j).split(" "); return t[t.length - 1]; };
  return hraci.slice().sort((a, b) =>
    poradiTymu.indexOf(a.t) - poradiTymu.indexOf(b.t) || poradiPozic[a.p] - poradiPozic[b.p]
    || prijmeni(a).localeCompare(prijmeni(b)) || a.j.localeCompare(b.j, "cs"));
}

function nactiStavajici() {
  if (!fs.existsSync(VYSTUP)) return null;
  try {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(VYSTUP, "utf8") + "\nEXTRALIGA_SOUPISKY;", ctx);
    return ctx.EXTRALIGA_SOUPISKY;
  } catch (e) { return null; }
}

function zapis(hraci, stazeno) {
  const radky = hraci.map((h) => "  " + JSON.stringify(h));
  const obsah = "// Soupisky klubů Tipsport extraligy pro našeptávač jmen ve formuláři. GENEROVÁNO skriptem\n"
    + "// skripty/stahni_soupisky.js z hokej.cz (stránky klubů → Soupiska) – neupravovat ručně.\n"
    + "// j = jméno a příjmení, t = tým (jako v EXTRALIGA.KONFIG.TYMY), p = pozice (B brankář, O obránce, U útočník).\n"
    + "var EXTRALIGA_SOUPISKY = {\n"
    + `  "zdroj": "hokej.cz",\n  "stazeno": "${stazeno}",\n  "hraci": [\n`
    + radky.join(",\n") + "\n  ]\n};\n";
  fs.writeFileSync(VYSTUP, obsah, "utf8");
}

(async () => {
  const vsichni = [];
  for (const tym of EXTRALIGA.KONFIG.TYMY) {
    const url = "https://www.hokej.cz" + KLUBY[tym] + "/soupiska";
    const html = await stahni(url);
    const hr = parsujSoupisku(html, tym);
    const sezona = (html.match(/Soupiska[^<]*?(\d{4}-\d{4})/) || [])[1] || "?";
    console.log(`${tym}: ${hr.length} hráčů (B ${hr.filter((h) => h.p === "B").length}, O ${hr.filter((h) => h.p === "O").length}, U ${hr.filter((h) => h.p === "U").length}), sezóna ${sezona}`);
    vsichni.push(...hr);
  }
  const chyby = zkontroluj(vsichni);
  console.log(`Celkem ${vsichni.length} hráčů.`);
  if (chyby.length) {
    console.error("Kontrola neprošla, soubor se nemění:\n - " + chyby.join("\n - "));
    process.exit(1);
  }
  if (rezim === "sonda") { console.log("Sonda: nic se neukládá."); return; }

  const nove = serad(vsichni);
  const stavajici = nactiStavajici();
  const stejne = stavajici && Array.isArray(stavajici.hraci) && JSON.stringify(stavajici.hraci) === JSON.stringify(nove);
  if (stejne) { console.log("Soupisky beze změny, soubor zůstává."); return; }
  const dnes = new Date().toISOString().slice(0, 10);
  zapis(nove, dnes);
  console.log(`Uloženo do ${path.basename(VYSTUP)} (${nove.length} hráčů, ${dnes}).`);
})().catch((e) => { console.error("Chyba: " + e.message); process.exit(1); });
