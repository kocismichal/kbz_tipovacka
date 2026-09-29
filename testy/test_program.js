// Dnešní zápasy (z uloženého rozpisu i ze stránky hokej.cz) a rozhodování, kdy stahovat tabulku
// (skripty/stahni_tabulku_extraligy.js):
// den bez hokeje se nestahuje, před prvním zápasem taky ne, během zápasů a po nich ano – dokud počet
// odehraných zápasů v tabulce nesedí s programem.
const E = require('../extraliga_spolecne.js');
const S = require('../skripty/stahni_tabulku_extraligy.js');
const T = E.KONFIG.TYMY;

let chyb = 0;
function over(podminka, popis, detail) {
  if (podminka) console.log('OK    ' + popis);
  else { chyb++; console.log('CHYBA ' + popis + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}

// Řádek rozpisu: s časem = ještě se nehrál, s výsledkem po třetinách = odehraný
const radek = (stred) => `<tr data-href="/zapas/${Math.floor(Math.random() * 1e6)}" class="js-preview__link">
  <td class="preview__name"><a href="/zapas/1"><span>HC Oceláři Třinec</span></a></td>
  <td class="preview__date">${stred}</td>
  <td class="preview__name"><a href="/zapas/1"><span>HC Kometa Brno</span></a></td></tr>`;
const html = (...stredy) => '<table class="preview"><tbody>' + stredy.map(radek).join('') + '</tbody></table>';
// Pražský čas jako skutečný okamžik (v září je Praha UTC+2)
const cas = (den, hodina, minuta) => new Date(Date.UTC(2026, 8, den, hodina - 2, minuta || 0));
const tabulka = (odehranychCelkem) => ({ poradi: T.map((t, i) => ({ tym: t, zapasy: i < 2 ? Math.ceil(odehranychCelkem * 2 / 14) : Math.floor(odehranychCelkem * 2 / 14), body: 3 })) });
// Přesná tabulka: rozdělí daný počet odehraných zápasů (každý se počítá dvěma týmům)
const tabulkaPresne = (odehranych) => {
  const zapasu = T.map(() => 0);
  for (let i = 0; i < odehranych; i++) { zapasu[(2 * i) % 14]++; zapasu[(2 * i + 1) % 14]++; }
  return { poradi: T.map((t, i) => ({ tym: t, zapasy: zapasu[i], body: zapasu[i] })) };
};

// ---------- parser ----------
const program = S.programZapasu(html('ÚT 15. 09. (0:1, 0:0, 0:1)', 'SO 19. 09. 18:00', 'NE 20. 09. 17:00', 'ST 13. 01. 18:00'), cas(18, 21));
over(program.length === 4, 'parser najde všechny čtyři zápasy', program.length);
const odehrany = program.find(z => z.datum === '2026-09-15');
over(odehrany && odehrany.odehrany === true && odehrany.zacatek === null, 'odehraný zápas se pozná podle výsledku místo času', odehrany);
const sobota = program.find(z => z.datum === '2026-09-19');
over(sobota && sobota.cas === '18:00' && !sobota.odehrany, 'neodehraný zápas má čas začátku', sobota);
over(sobota.zacatek.toISOString() === '2026-09-19T16:00:00.000Z', 'čas se bere jako pražský (v září UTC+2)', sobota.zacatek.toISOString());
const leden = program.find(z => z.cas === '18:00' && z.datum.startsWith('2027'));
over(leden && leden.datum === '2027-01-13', 'lednový zápas dostane příští rok (sezóna přes Nový rok)', leden && leden.datum);

// ---------- hlášení pro hlídač ve workflow ----------
// Skript vypisuje poslední řádek "KONTROLA: hotovo" / "KONTROLA: ceka <sekundy>", podle kterého
// workflow pozná, jestli má za pět minut zkusit znovu. Kontroluje se níže u jednotlivých situací.

// ---------- rozhodování ----------
const dnesniProgram = html('PÁ 18. 09. 17:00', 'PÁ 18. 09. 17:30', 'SO 19. 09. 18:00');
const zapasy = (ted) => S.programZapasu(dnesniProgram, ted);
const rozhodni = (ted, stav, zaklad) => S.rozhodniStahovani(zapasy(ted), ted, stav, zaklad === undefined ? 7 : zaklad);

// den bez zápasů (20. 9. v tomto rozpisu nic není)
let r = rozhodni(cas(20, 18), tabulkaPresne(9));
over(!r.stahovat && /dnes se nehraje/.test(r.duvod), 'den bez zápasů: nestahovat', r.duvod);
over(r.konec === true, 'den bez zápasů: hlídač může skončit', r.konec);

// ráno hracího dne
r = rozhodni(cas(18, 9), tabulkaPresne(7));
over(!r.stahovat && /začíná až v 17:00/.test(r.duvod), 'ráno před zápasy: nestahovat', r.duvod);
// hlídač nemá kontrolovat po pěti minutách, ale počkat rovnou k výkopu (v 9:00 zbývá do 16:50 sedm hodin padesát minut)
over(r.konec === false && r.cekat === (7 * 60 + 50) * 60, 'ráno před zápasy: hlídač počká až k výkopu', r.cekat);

// deset minut před prvním zápasem
r = rozhodni(cas(18, 16, 55), tabulkaPresne(7));
over(r.stahovat, 'těsně před prvním zápasem: stahovat', r.duvod);

// během zápasů
r = rozhodni(cas(18, 18, 30), tabulkaPresne(7));
over(r.stahovat && /dohraných 0/.test(r.duvod), 'během zápasů: stahovat', r.duvod);
over(r.konec === false && r.cekat === 300, 'během zápasů: další kontrola za pět minut', r.cekat);

// po prvním zápase, v tabulce zatím nic navíc
r = rozhodni(cas(18, 20, 0), tabulkaPresne(7));
over(r.stahovat && /dohraných 1/.test(r.duvod), 'po prvním zápase a nezapsané tabulce: stahovat', r.duvod);

// první zápas zapsaný, druhý ještě běží – kontroluje se dál
r = rozhodni(cas(18, 20, 0), tabulkaPresne(8));
over(r.stahovat && /v tabulce 1/.test(r.duvod), 'první zapsaný, druhý běží: kontrolovat dál', r.duvod);

// po obou zápasech, zapsaný jen jeden
r = rozhodni(cas(18, 21, 0), tabulkaPresne(8));
over(r.stahovat && /dohraných 2/.test(r.duvod), 'druhý zápas ještě chybí: stahovat', r.duvod);

// oba zápasy zapsané – i během večera se přestane kontrolovat
r = rozhodni(cas(18, 21, 30), tabulkaPresne(9));
over(!r.stahovat && /vše zapsané/.test(r.duvod), 'oba zápasy zapsané: nestahovat', r.duvod);
over(r.konec === true, 'oba zápasy zapsané: hlídač končí', r.konec);
r = rozhodni(cas(18, 18, 30), tabulkaPresne(9));
over(!r.stahovat && /vše zapsané/.test(r.duvod), 'zapsané dřív, než se čekalo: taky nestahovat', r.duvod);

// dlouho po zápasech bez zápisu se přestane zkoušet (dorovná ranní běh)
r = rozhodni(cas(18, 23, 30), tabulkaPresne(7));
over(!r.stahovat && /ranní běh/.test(r.duvod), 'pozdě v noci bez zápisu: nechat na ráno', r.duvod);
over(r.konec === true, 'pozdě v noci: hlídač končí', r.konec);

// bez historie (na začátku sezóny) se raději stahuje
r = rozhodni(cas(18, 21, 30), tabulkaPresne(9), null);
over(r.stahovat, 'bez známého základu z historie se stahuje dál', r.duvod);

// odehraný zápas bez času se počítá jako dohraný i hned po půlnoci
const poDnesku = S.programZapasu(html('PÁ 18. 09. (2:1, 0:0, 1:1)', 'PÁ 18. 09. (3:2, 1:0, 0:1)'), cas(18, 23));
over(S.melySkoncit(poDnesku, cas(18, 23)) === 2, 'odehrané zápasy se počítají jako dohrané', S.melySkoncit(poDnesku, cas(18, 23)));
r = S.rozhodniStahovani(poDnesku, cas(18, 23), tabulkaPresne(9), 7);
over(!r.stahovat && /vše zapsané/.test(r.duvod), 'večer po zápasech se zapsanou tabulkou: nestahovat', r.duvod);
r = S.rozhodniStahovani(poDnesku, cas(18, 23), tabulkaPresne(8), 7);
over(r.stahovat, 'večer po zápasech s chybějícím zápisem: stahovat (čas začátku web u odehraných neuvádí)', r.duvod);

// pomocné funkce
over(S.odehranoZTabulky(tabulkaPresne(5).poradi) === 5, 'počet odehraných zápasů z tabulky', S.odehranoZTabulky(tabulkaPresne(5).poradi));
over(S.dnesVPraze(new Date('2026-09-18T23:30:00Z')) === '2026-09-19', 'pozdě večer v UTC je v Praze už další den', S.dnesVPraze(new Date('2026-09-18T23:30:00Z')));

// ---------- dnešní zápasy z uloženého rozpisu ----------
// Během zápasů hokej.cz v rozpisu místo data ukazuje průběžné skóre, takže se na web nespoléháme.
const fs = require('fs'); const os = require('os'); const path = require('path');
const slozka = fs.mkdtempSync(path.join(os.tmpdir(), 'rozpis-'));
const souborRozpisu = path.join(slozka, 'zapasy.json');
fs.writeFileSync(souborRozpisu, JSON.stringify({ zapasy: [
  { datum: '2026-09-29', cas: '', odehrany: true },
  { datum: '2026-09-29', cas: '', odehrany: true },
  { datum: '2026-09-30', cas: '17:30', odehrany: false },
  { datum: '2027-01-13', cas: '18:00', odehrany: false }
] }));
const zeSouboru = S.zapasyZeSouboru(souborRozpisu);
over(zeSouboru.length === 4, 'rozpis ze souboru má všechny zápasy', zeSouboru.length);
const zitra = zeSouboru.find(z => z.datum === '2026-09-30');
over(zitra.zacatek && zitra.zacatek.toISOString() === '2026-09-30T15:30:00.000Z', 'čas začátku se bere jako pražský', zitra.zacatek);
over(zeSouboru.filter(z => z.odehrany).every(z => z.zacatek === null), 'odehraný zápas nemá čas začátku', zeSouboru[0]);
over(S.zapasyZeSouboru(path.join(slozka, 'neexistuje.json')).length === 0, 'chybějící soubor vrátí prázdno');

// klíčová regrese: dnešní zápasy bez času (běží nebo dohrané) se pořád počítají jako dnešní
const stav35 = { poradi: T.map((t) => ({ tym: t, zapasy: 5, body: 5 })) };
const rr = S.rozhodniStahovani(zeSouboru, cas(29, 19, 10), stav35, 35);
over(rr.stahovat && /2 zápasů dnes/.test(rr.duvod), 'během dnešních zápasů se kontroluje dál, i když nemají čas', rr.duvod);
fs.rmSync(slozka, { recursive: true, force: true });

console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Program zápasů: všechny kontroly prošly.');
process.exit(chyb ? 1 : 0);
