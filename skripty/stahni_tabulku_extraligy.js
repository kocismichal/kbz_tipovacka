#!/usr/bin/env node
/*
 * Stáhne aktuální tabulku Tipsport extraligy a uloží ji do 2627_extraliga_stav.json
 * (pořadí, odehrané zápasy a body každého týmu). Spouští ho GitHub Actions
 * (.github/workflows/extraliga_tabulka.yml) každé ráno – web i Apps Script pak berou pořadí a body
 * týmů z tohoto souboru, bonusové odpovědi zůstávají v listu "Přehled HOTOVO".
 *
 *   node skripty/stahni_tabulku_extraligy.js                 stáhne tabulku a uloží JSON
 *   node skripty/stahni_tabulku_extraligy.js --rezim sonda   jen vypíše, co zdroje vracejí (ladění)
 *
 * Pořadí se ukládá jen tehdy, když projde kontrolou: přesně 14 týmů z konfigurace, každý jednou,
 * body i zápasy jsou čísla. Jinak skript skončí chybou a JSON se nemění (web spadne na ruční tabulku).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KOREN = path.join(__dirname, "..");
const VYSTUP = path.join(KOREN, "2627_extraliga_stav.json");
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

// ---------- Parser HTML tabulky (řádky <tr>, buňky <td>/<th>) ----------
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
// Z řádků tabulky vytáhne 14 týmů: tým = první buňka s poznaným názvem, zápasy = první číslo za ní, body = poslední číslo řádku
function poradiZRadku(radky) {
  const out = [];
  for (const bunky of radky) {
    let iTym = -1, tym = "";
    for (let i = 0; i < bunky.length; i++) { const t = poznejTym(bunky[i]); if (t && !/^\d+$/.test(bunky[i])) { iTym = i; tym = t; break; } }
    if (iTym === -1) continue;
    const cisla = bunky.slice(iTym + 1).map((x) => x.replace(/\s/g, "")).filter((x) => /^-?\d+$/.test(x)).map(Number);
    if (cisla.length < 2) continue;
    if (out.some((o) => o.tym === tym)) continue;
    out.push({ tym, zapasy: cisla[0], body: cisla[cisla.length - 1], _bunky: bunky });
  }
  return out;
}

const ZDROJE = [
  { nazev: "hokej.cz", url: "https://www.hokej.cz/tipsport-extraliga/tabulka" },
  { nazev: "hokej.cz (úvod)", url: "https://www.hokej.cz/" },
  { nazev: "hokej.cz (soutěž)", url: "https://www.hokej.cz/tipsport-extraliga" },
  { nazev: "hokej.cz (tabulky)", url: "https://www.hokej.cz/tabulky" },
  { nazev: "telh.cz", url: "https://www.telh.cz/tabulka" },
  { nazev: "telh.cz bez www", url: "https://telh.cz/" },
  { nazev: "cs.wikipedia (wikitext)", url: "https://cs.wikipedia.org/w/index.php?title=%C4%8Cesk%C3%A1_hokejov%C3%A1_extraliga_2026/2027&action=raw" }
];

async function sonda() {
  for (const z of ZDROJE) {
    console.log("\n==================== " + z.nazev + " ====================\n" + z.url);
    try {
      const r = await stahni(z.url);
      const txt = r.text;
      const tymu = Object.keys(KLICE).filter((t) => KLICE[t].some((k) => bezDiakritiky(txt).includes(k))).length;
      const titul = (txt.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1].replace(/\s+/g, " ").trim();
      console.log(`status ${r.status} | ${r.typ} | ${txt.length} znaků | finální URL ${r.url} | <table: ${(txt.match(/<table/gi) || []).length} | poznaných týmů: ${tymu} | title: ${titul}`);
      const odkazy = Array.from(new Set((txt.match(/href="([^"]*)"/gi) || []).map((h) => h.slice(6, -1)).filter((h) => /tabulk|extralig|soutez|standing|competition/i.test(h)).map((h) => h.split("?")[0])));
      if (odkazy.length) console.log("odkazy (tabulk/extralig/soutez): " + odkazy.slice(0, 60).join("  |  "));
      const api = Array.from(new Set((txt.match(/https?:\/\/[^"'\s<>]*(api|json|standing)[^"'\s<>]*/gi) || []))).slice(0, 15);
      if (api.length) console.log("URL s api/json: " + api.join("  |  "));
      if (/wiki/.test(z.url)) {
        const it = txt.search(/==\s*Tabulka/i);
        console.log("--- wikitext kolem 'Tabulka' ---\n" + (it !== -1 ? txt.slice(it, it + 3000) : "(sekce Tabulka nenalezena) " + txt.slice(0, 1500)).replace(/\s+/g, " "));
      } else {
        // všechny tabulky: hlavička + první 2 řádky (zkráceně)
        const tabulky = txt.match(/<table[\s\S]*?<\/table>/gi) || [];
        tabulky.slice(0, 8).forEach((t, i) => {
          const radky = radkyTabulky(t);
          console.log(`--- tabulka ${i + 1}: ${radky.length} řádků; prvních 3: ${JSON.stringify(radky.slice(0, 3)).slice(0, 400)}`);
        });
      }
      const poradi = poradiZRadku(radkyTabulky(txt));
      console.log("--- parser: " + poradi.length + " týmů ---");
      poradi.forEach((p, i) => console.log(`${i + 1}. ${p.tym} | zápasy ${p.zapasy} | body ${p.body} | buňky: ${JSON.stringify(p._bunky).slice(0, 200)}`));
    } catch (e) {
      console.log("CHYBA: " + e.message + (e.cause ? " | příčina: " + (e.cause.code || e.cause.message || JSON.stringify(e.cause)) : ""));
    }
  }
}

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

async function aktualizace() {
  const chyby = [];
  for (const z of ZDROJE.filter((x) => x.url.includes("hokej.cz") || x.url.includes("telh.cz"))) {
    try {
      const r = await stahni(z.url);
      if (r.status !== 200) { chyby.push(z.nazev + ": HTTP " + r.status); continue; }
      const poradi = poradiZRadku(radkyTabulky(r.text));
      const chyba = overPoradi(poradi);
      if (chyba) { chyby.push(z.nazev + ": " + chyba); continue; }
      const vysledek = {
        sezona: EXTRALIGA.KONFIG.SEZONA,
        aktualizovano: new Date().toISOString(),
        zdroj: z.nazev,
        zdroj_url: z.url,
        poradi: poradi.map((p) => ({ tym: p.tym, zapasy: p.zapasy, body: p.body }))
      };
      let stary = null;
      try { stary = JSON.parse(fs.readFileSync(VYSTUP, "utf8")); } catch (e) {}
      if (stary && JSON.stringify(stary.poradi) === JSON.stringify(vysledek.poradi)) {
        console.log("Tabulka se od minula nezměnila (" + z.nazev + ") – JSON zůstává.");
        return;
      }
      fs.writeFileSync(VYSTUP, JSON.stringify(vysledek, null, 2) + "\n");
      console.log("Uloženo " + path.basename(VYSTUP) + " ze zdroje " + z.nazev + ":");
      vysledek.poradi.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.tym.padEnd(18)} ${String(p.zapasy).padStart(2)} z.  ${String(p.body).padStart(3)} b.`));
      return;
    } catch (e) {
      chyby.push(z.nazev + ": " + e.message);
    }
  }
  console.error("Tabulku se nepodařilo stáhnout z žádného zdroje:\n - " + chyby.join("\n - "));
  process.exit(1);
}

(rezim === "sonda" ? sonda() : aktualizace()).catch((e) => { console.error(e); process.exit(1); });
