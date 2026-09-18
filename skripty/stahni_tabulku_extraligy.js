#!/usr/bin/env node
/*
 * Stáhne aktuální tabulku Tipsport extraligy a uloží ji do 2627_extraliga_stav.json
 * (pořadí, odehrané zápasy a body každého týmu; z hokej.cz i statistiky týmů: vstřelené góly,
 * góly v přesilovkách a trestné minuty – z nich web průběžně vyhodnocuje čtyři týmové otázky).
 * Každý nový stav tabulky se navíc přidá do 2627_extraliga_historie.json (graf vývoje na webu). Spouští ho GitHub Actions
 * (.github/workflows/extraliga_tabulka.yml) každé ráno – web i Apps Script pak berou pořadí a body
 * týmů z tohoto souboru, bonusové odpovědi zůstávají v listu "Přehled HOTOVO".
 *
 *   node skripty/stahni_tabulku_extraligy.js                 stáhne tabulku a uloží JSON (když se změnila)
 *   node skripty/stahni_tabulku_extraligy.js --rezim sonda   jen vypíše, co zdroje vracejí (ladění)
 *
 * Zdroje v pořadí: hokej.cz (stránka tabulky), hokej.cz (stránka soutěže s malou tabulkou),
 * česká Wikipedie (šablona {{Hokejová tabulka}} – aktualizují ji dobrovolníci, jen záloha).
 * Uloží se jen tabulka, která projde kontrolou: přesně 14 týmů z konfigurace, každý jednou, body i zápasy
 * jsou čísla, body ≤ 3 × zápasy a pořadí jde podle bodů. Jinak skript skončí chybou a JSON se nemění
 * (web pak bere pořadí z ručního zápisu v listu Přehled HOTOVO).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KOREN = path.join(__dirname, "..");
const VYSTUP = path.join(KOREN, "2627_extraliga_stav.json");
const HISTORIE = path.join(KOREN, "2627_extraliga_historie.json");
const rezim = (process.argv.indexOf("--rezim") !== -1) ? process.argv[process.argv.indexOf("--rezim") + 1] : "aktualizace";

// Společná konfigurace (seznam týmů) – stejný soubor jako web
const EXTRALIGA = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(KOREN, "extraliga_spolecne.js"), "utf8") + "\nEXTRALIGA;", ctx);
  return ctx.EXTRALIGA;
})();

// Klíčová slova, podle kterých se pozná tým v názvu z webu (bez diakritiky, malá písmena)
const KLICE = {
  "Karlovy Vary": ["karlovy vary", "energie"],
  "Kladno": ["kladno", "rytiri"],
  "Liberec": ["liberec", "bili tygri"],
  "Litvínov": ["litvinov", "verva"],
  "Pardubice": ["pardubice", "dynamo"],
  "Plzeň": ["plzen", "skoda"],
  "Sparta Praha": ["sparta"],
  "Třinec": ["trinec", "ocelari"],
  "Vítkovice": ["vitkovice", "ridera"],
  "Mladá Boleslav": ["boleslav"],
  "Olomouc": ["olomouc", "kohouti"],
  "Kometa Brno": ["kometa", "brno"],
  "Mountfield HK": ["mountfield", "hradec"],
  "České Budějovice": ["budejovice", "motor"]
};
const bezDiakritiky = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function poznejTym(text) {
  const t = bezDiakritiky(text);
  if (/\b(b|juniori|junior|u20|u17|dorost)\b/.test(t)) return "";   // "HC Dynamo Pardubice B", juniorky apod.
  for (const [tym, klice] of Object.entries(KLICE)) if (klice.some((k) => t.includes(k))) return tym;
  return "";
}

const HLAVICKY = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7"
};
async function stahni(url) {
  const r = await fetch(url, { headers: HLAVICKY, redirect: "follow", signal: AbortSignal.timeout(25000) });
  return { status: r.status, typ: r.headers.get("content-type") || "", text: await r.text(), url: r.url };
}

// ---------- HTML tabulky (hokej.cz) ----------
const odstranTagy = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function radkyTabulky(html) {
  const radky = [];
  const reTr = /<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = reTr.exec(html)) !== null) {
    const bunky = [];
    const reTd = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let b;
    while ((b = reTd.exec(m[0])) !== null) bunky.push(odstranTagy(b[1]));
    if (bunky.length) radky.push(bunky);
  }
  return radky;
}
const jeCislo = (x) => /^-?\d+$/.test(String(x).replace(/\s/g, ""));
// Jedna HTML tabulka → pořadí. Sloupce Z a B se berou podle hlavičky ("Z", "B"/"Body"); bez hlavičky
// je zápasy = první číslo za názvem týmu a body = poslední číslo řádku.
function poradiZTabulky(radky) {
  const hlavicka = radky.find((r) => r.some((c) => /^(z|záp\.?|zápasy)$/i.test(c)) && r.some((c) => /^(b|body)$/i.test(c)));
  let iZ = -1, iB = -1, iKlub = -1, iSkore = -1, iPresilovky = -1, iTresty = -1, posun = 0;
  if (hlavicka) {
    iZ = hlavicka.findIndex((c) => /^(z|záp\.?|zápasy)$/i.test(c));
    iB = hlavicka.findIndex((c) => /^(b|body)$/i.test(c));
    iKlub = hlavicka.findIndex((c) => /^(klub|tým|team)$/i.test(c));
    // Široká tabulka na hokej.cz: Skóre (VG:OG), GPř (góly v přesilovkách), T (trestné minuty)
    iSkore = hlavicka.findIndex((c) => /^sk[oó]re$/i.test(c));
    iPresilovky = hlavicka.findIndex((c) => /^gp[řr]$/i.test(c));
    iTresty = hlavicka.findIndex((c) => /^t$/i.test(c));
  }
  const out = [];
  for (const bunky of radky) {
    if (bunky === hlavicka) continue;
    let iTym = -1, tym = "";
    for (let i = 0; i < bunky.length; i++) { const t = poznejTym(bunky[i]); if (t && !jeCislo(bunky[i])) { iTym = i; tym = t; break; } }
    if (iTym === -1 || out.some((o) => o.tym === tym)) continue;
    let zapasy, body, statistiky;
    if (hlavicka && iZ !== -1 && iB !== -1) {
      // Datové řádky mívají o buňku víc než hlavička (např. logo) – posun podle pozice názvu klubu
      posun = iKlub !== -1 ? iTym - iKlub : bunky.length - hlavicka.length;
      const z = bunky[iZ + posun], b = bunky[iB + posun];
      if (!jeCislo(z) || !jeCislo(b)) continue;
      zapasy = Number(z); body = Number(b);
      // Statistiky týmu (jen když tabulka sloupce má a hodnoty jsou čísla)
      const skore = iSkore !== -1 ? String(bunky[iSkore + posun] || "").match(/^(\d+)\s*:\s*(\d+)$/) : null;
      const gp = iPresilovky !== -1 ? bunky[iPresilovky + posun] : undefined;
      const tr = iTresty !== -1 ? bunky[iTresty + posun] : undefined;
      if (skore && jeCislo(gp) && jeCislo(tr)) {
        statistiky = { goly: Number(skore[1]), obdrzene: Number(skore[2]), presilovky: Number(gp), tresty: Number(tr) };
      }
    } else {
      const cisla = bunky.slice(iTym + 1).map((x) => x.replace(/\s/g, "")).filter(jeCislo).map(Number);
      if (cisla.length < 2) continue;
      zapasy = cisla[0]; body = cisla[cisla.length - 1];
    }
    out.push({ tym, zapasy, body, statistiky, _bunky: bunky });
  }
  return out;
}
// Statistiky všech 14 týmů (goly, obdrzene, presilovky, tresty), nebo null, když je některý tým bez nich
function statistikyZPoradi(poradi) {
  const out = {};
  for (const p of poradi) {
    if (!p.statistiky) return null;
    out[p.tym] = p.statistiky;
  }
  return out;
}
// Ze všech tabulek na stránce vybere první, která dá přesně 14 známých týmů
function poradiZHtml(html) {
  const tabulky = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let nejlepsi = [];
  for (const t of tabulky) {
    const p = poradiZTabulky(radkyTabulky(t));
    if (p.length === EXTRALIGA.KONFIG.POCET_MIST) return p;
    if (p.length > nejlepsi.length) nejlepsi = p;
  }
  return nejlepsi;
}

// ---------- Wikipedie: {{Hokejová tabulka|1.|[[Klub]]|Z|V|VP|PP|P|VG|OG|'''B'''|barva|2.|...}} ----------
function poradiZWikitextu(txt) {
  const m = txt.match(/\{\{Hokejová tabulka\|([\s\S]*?)\}\}/i);
  if (!m) return [];
  const casti = m[1].split("|").map((x) => x.trim());
  const out = [];
  for (let i = 0; i < casti.length; i++) {
    const link = casti[i].match(/^\[\[([^\]|]+)/);
    if (!link) continue;
    const tym = poznejTym(link[1]);
    if (!tym || out.some((o) => o.tym === tym)) continue;
    const cisla = [];
    for (let j = i + 1; j < casti.length && !/^\[\[/.test(casti[j]) && !/^\d+\.$/.test(casti[j]); j++) {
      const c = casti[j].replace(/'''/g, "").trim();
      if (jeCislo(c)) cisla.push({ n: Number(c), tucne: /'''/.test(casti[j]) });
    }
    if (cisla.length < 2) continue;
    const tucne = cisla.find((c) => c.tucne);
    out.push({ tym, zapasy: cisla[0].n, body: (tucne || cisla[cisla.length - 1]).n, _bunky: casti.slice(i, i + 11) });
  }
  return out;
}

const ZDROJE = [
  { nazev: "hokej.cz", url: "https://www.hokej.cz/tipsport-extraliga/table", parser: poradiZHtml },
  { nazev: "hokej.cz", url: "https://www.hokej.cz/tipsport-extraliga", parser: poradiZHtml },
  { nazev: "cs.wikipedia.org", url: "https://cs.wikipedia.org/w/index.php?title=%C4%8Cesk%C3%A1_hokejov%C3%A1_extraliga_2026/2027&action=raw", parser: poradiZWikitextu }
];

function overPoradi(poradi) {
  const tymy = EXTRALIGA.KONFIG.TYMY;
  if (poradi.length !== tymy.length) return "počet týmů " + poradi.length + " místo " + tymy.length;
  const videne = new Set();
  for (const p of poradi) {
    if (!tymy.includes(p.tym)) return "neznámý tým " + p.tym;
    if (videne.has(p.tym)) return "tým dvakrát: " + p.tym;
    if (!Number.isInteger(p.body) || !Number.isInteger(p.zapasy) || p.body < 0 || p.zapasy < 0) return "špatná čísla u " + p.tym;
    if (p.body > p.zapasy * 3) return "víc bodů než 3 na zápas u " + p.tym;
    videne.add(p.tym);
  }
  for (let i = 1; i < poradi.length; i++) if (poradi[i].body > poradi[i - 1].body) return "pořadí není podle bodů (" + poradi[i].tym + ")";
  return "";
}

async function sonda() {
  for (const z of ZDROJE) {
    console.log("\n==================== " + z.nazev + " ====================\n" + z.url);
    try {
      const r = await stahni(z.url);
      const titul = (r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1].replace(/\s+/g, " ").trim();
      console.log(`status ${r.status} | ${r.typ} | ${r.text.length} znaků | <table: ${(r.text.match(/<table/gi) || []).length} | title: ${titul}`);
      if (z.parser === poradiZHtml) {
        (r.text.match(/<table[\s\S]*?<\/table>/gi) || []).slice(0, 10).forEach((t, i) => {
          const radky = radkyTabulky(t);
          console.log(`--- tabulka ${i + 1}: ${radky.length} řádků; první 3: ${JSON.stringify(radky.slice(0, 3)).slice(0, 500)}`);
        });
      }
      const poradi = z.parser(r.text);
      const chyba = overPoradi(poradi);
      console.log("--- parser: " + poradi.length + " týmů | kontrola: " + (chyba || "OK") + " | statistiky: " + (statistikyZPoradi(poradi) ? "ano" : "ne") + " ---");
      poradi.forEach((p, i) => console.log(`${i + 1}. ${p.tym} | zápasy ${p.zapasy} | body ${p.body}` + (p.statistiky ? ` | góly ${p.statistiky.goly}:${p.statistiky.obdrzene}, přesilovky ${p.statistiky.presilovky}, tresty ${p.statistiky.tresty} min` : "") + ` | ${JSON.stringify(p._bunky).slice(0, 120)}`));
    } catch (e) {
      console.log("CHYBA: " + e.message + (e.cause ? " | příčina: " + (e.cause.code || e.cause.message) : ""));
    }
  }
}

// Historie snímků pro graf vývoje tipovačky. Nový bod v grafu přibude JEN když se od posledního snímku
// hrálo – tedy když se změnil součet odehraných zápasů nebo součet bodů všech týmů. Ve dnech bez zápasů
// (volný den v programu, reprezentační přestávka) se nic nepřidává, takže graf má na ose jen hrací dny.
// Když se nehrálo, ale tabulka se přesto mírně liší (web přerovná týmy se stejnými body nebo doplní
// statistiky), aktualizuje se poslední snímek na místě – bod v grafu nepřibude.
// Víc běhů v jeden den (odpolední a večerní zápasy) přepíše poslední snímek téhož dne.
function aktualizujHistorii(stav, souborHistorie) {
  const soubor = souborHistorie || HISTORIE;
  let historie = { sezona: EXTRALIGA.KONFIG.SEZONA, snimky: [] };
  try {
    const h = JSON.parse(fs.readFileSync(soubor, "utf8"));
    if (h && Array.isArray(h.snimky)) historie = h;
  } catch (e) {}
  const datum = String(stav.aktualizovano || new Date().toISOString()).slice(0, 10);
  const novy = { datum, aktualizovano: stav.aktualizovano, poradi: stav.poradi };
  if (stav.statistiky) novy.statistiky = stav.statistiky;
  const posledni = historie.snimky[historie.snimky.length - 1];
  const soucet = (poradi, klic) => (poradi || []).reduce((s, p) => s + (Number(p[klic]) || 0), 0);
  const hralo = !posledni
    || soucet(novy.poradi, "zapasy") !== soucet(posledni.poradi, "zapasy")
    || soucet(novy.poradi, "body") !== soucet(posledni.poradi, "body");

  let zmena = "";
  if (!posledni) {
    historie.snimky.push(novy);
    zmena = "první snímek";
  } else if (!hralo) {
    // Od posledního snímku se nehrálo – bod v grafu nepřibývá
    const stejne = JSON.stringify(posledni.poradi) === JSON.stringify(novy.poradi)
      && JSON.stringify(posledni.statistiky || null) === JSON.stringify(novy.statistiky || null);
    if (!stejne) {
      posledni.poradi = novy.poradi;
      if (novy.statistiky) posledni.statistiky = novy.statistiky;
      posledni.aktualizovano = novy.aktualizovano;
      zmena = "od minula se nehrálo – aktualizován poslední snímek (bez nového bodu)";
    }
  } else if (posledni.datum === datum) {
    historie.snimky[historie.snimky.length - 1] = novy;
    zmena = "snímek dne přepsán";
  } else {
    historie.snimky.push(novy);
    zmena = "nový snímek";
  }

  if (!zmena) { console.log("Historie: beze změny, od minula se nehrálo (" + historie.snimky.length + " snímků)."); return; }
  fs.writeFileSync(soubor, JSON.stringify(historie, null, 1) + "\n");
  console.log("Historie: " + zmena + " (" + historie.snimky.length + " snímků, poslední " + historie.snimky[historie.snimky.length - 1].datum + ").");
}

async function aktualizace() {
  const chyby = [];
  for (const z of ZDROJE) {
    try {
      const r = await stahni(z.url);
      if (r.status !== 200) { chyby.push(z.nazev + " (" + z.url + "): HTTP " + r.status); continue; }
      const poradi = z.parser(r.text);
      const chyba = overPoradi(poradi);
      if (chyba) { chyby.push(z.nazev + " (" + z.url + "): " + chyba); continue; }
      if (poradi.every((p) => p.zapasy === 0)) {
        console.log("Sezóna ještě nezačala (všechny týmy 0 zápasů) – zdroj " + z.nazev + ", JSON se neukládá.");
        return;
      }
      const statistiky = statistikyZPoradi(poradi);
      const vysledek = {
        sezona: EXTRALIGA.KONFIG.SEZONA,
        aktualizovano: new Date().toISOString(),
        zdroj: z.nazev,
        zdroj_url: z.url,
        poradi: poradi.map((p) => ({ tym: p.tym, zapasy: p.zapasy, body: p.body }))
      };
      if (statistiky) vysledek.statistiky = statistiky;
      let stary = null;
      try { stary = JSON.parse(fs.readFileSync(VYSTUP, "utf8")); } catch (e) {}
      const stejne = stary && JSON.stringify(stary.poradi) === JSON.stringify(vysledek.poradi)
        && JSON.stringify(stary.statistiky || null) === JSON.stringify(vysledek.statistiky || null);
      if (stejne) {
        console.log("Tabulka se od minula nezměnila (" + z.nazev + ") – JSON zůstává.");
        aktualizujHistorii(stary);
        return;
      }
      fs.writeFileSync(VYSTUP, JSON.stringify(vysledek, null, 2) + "\n");
      console.log("Uloženo " + path.basename(VYSTUP) + " ze zdroje " + z.nazev + (statistiky ? " (včetně statistik týmů)" : " (bez statistik týmů)") + ":");
      vysledek.poradi.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.tym.padEnd(18)} ${String(p.zapasy).padStart(2)} z.  ${String(p.body).padStart(3)} b.`));
      aktualizujHistorii(vysledek);
      return;
    } catch (e) {
      chyby.push(z.nazev + " (" + z.url + "): " + e.message);
    }
  }
  console.error("Tabulku se nepodařilo stáhnout z žádného zdroje:\n - " + chyby.join("\n - "));
  process.exit(1);
}

if (require.main === module) {
  (rezim === "sonda" ? sonda() : aktualizace()).catch((e) => { console.error(e); process.exit(1); });
} else {
  // Načtení přes require (testy): jen funkce, nic se nestahuje ani neukládá
  module.exports = { aktualizujHistorii, poradiZHtml, poradiZTabulky, statistikyZPoradi, overPoradi, poznejTym };
}
