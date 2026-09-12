#!/usr/bin/env node
/*
 * Sestaví extraliga_apps_script_komplet.gs = hlavička + extraliga_spolecne.js + extraliga_apps_script.gs.
 * Zavaděč v Apps Scriptu (extraliga_zavadec.gs) si tenhle soubor stahuje z větve main, takže po každé
 * změně extraliga_spolecne.js nebo extraliga_apps_script.gs spusť:   node skripty/sestav_apps_script.js
 * (test testy/test_bundle.js hlídá, že se na to nezapomnělo).
 */
const fs = require("fs");
const path = require("path");
const KOREN = path.join(__dirname, "..");
const VYSTUP = path.join(KOREN, "extraliga_apps_script_komplet.gs");

function sestav() {
  const cti = (f) => fs.readFileSync(path.join(KOREN, f), "utf8").replace(/\r\n/g, "\n");
  return cti("skripty/apps_script_hlavicka.gs") + cti("extraliga_spolecne.js") + "\n\n" + cti("extraliga_apps_script.gs");
}

if (require.main === module) {
  fs.writeFileSync(VYSTUP, sestav());
  console.log("Zapsáno " + path.relative(KOREN, VYSTUP) + " (" + Math.round(fs.statSync(VYSTUP).size / 1024) + " KB)");
}
module.exports = { sestav };
