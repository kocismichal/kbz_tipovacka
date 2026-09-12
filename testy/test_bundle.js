// Hlídá, že extraliga_apps_script_komplet.gs (stahuje si ho zavaděč v Apps Scriptu) odpovídá zdrojům.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { KOREN } = require('./pomocne');
const { sestav } = require('../skripty/sestav_apps_script.js');
const aktualni = fs.readFileSync(path.join(KOREN, 'extraliga_apps_script_komplet.gs'), 'utf8').replace(/\r\n/g, '\n');
assert.strictEqual(aktualni, sestav(), 'extraliga_apps_script_komplet.gs neodpovídá zdrojům – spusť: node skripty/sestav_apps_script.js');
console.log('✔ extraliga_apps_script_komplet.gs odpovídá extraliga_spolecne.js + extraliga_apps_script.gs');
