// Společné cesty pro testy: kořen repa, složka pro screenshoty a adresa lokálního serveru (spouští ho spust_vse.js).
const path = require('path');
const fs = require('fs');
const KOREN = path.join(__dirname, '..');
const VYSTUP = path.join(__dirname, 'vystup');
fs.mkdirSync(VYSTUP, { recursive: true });
module.exports = { KOREN, SCR: VYSTUP + path.sep, WEB: 'http://127.0.0.1:8765' };
