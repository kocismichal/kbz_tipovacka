// Program zápasů z hokej.cz a rozhodování, kdy stahovat tabulku (skripty/stahni_tabulku_extraligy.js):
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

// ---------- rozhodování ----------
const dnesniProgram = html('PÁ 18. 09. 17:00', 'PÁ 18. 09. 17:30', 'SO 19. 09. 18:00');
const zapasy = (ted) => S.programZapasu(dnesniProgram, ted);
const rozhodni = (ted, stav, zaklad) => S.rozhodniStahovani(zapasy(ted), ted, stav, zaklad === undefined ? 7 : zaklad);

// den bez zápasů (20. 9. v tomto rozpisu nic není)
let r = rozhodni(cas(20, 18), tabulkaPresne(9));
over(!r.stahovat && /dnes se nehraje/.test(r.duvod), 'den bez zápasů: nestahovat', r.duvod);

// ráno hracího dne
r = rozhodni(cas(18, 9), tabulkaPresne(7));
over(!r.stahovat && /začíná až v 17:00/.test(r.duvod), 'ráno před zápasy: nestahovat', r.duvod);

// deset minut před prvním zápasem
r = rozhodni(cas(18, 16, 55), tabulkaPresne(7));
over(r.stahovat, 'těsně před prvním zápasem: stahovat', r.duvod);

// během zápasů
r = rozhodni(cas(18, 18, 30), tabulkaPresne(7));
over(r.stahovat && /dohraných 0/.test(r.duvod), 'během zápasů: stahovat', r.duvod);

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
r = rozhodni(cas(18, 18, 30), tabulkaPresne(9));
over(!r.stahovat && /vše zapsané/.test(r.duvod), 'zapsané dřív, než se čekalo: taky nestahovat', r.duvod);

// dlouho po zápasech bez zápisu se přestane zkoušet (dorovná ranní běh)
r = rozhodni(cas(18, 23, 30), tabulkaPresne(7));
over(!r.stahovat && /ranní běh/.test(r.duvod), 'pozdě v noci bez zápisu: nechat na ráno', r.duvod);

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

console.log(chyb ? (chyb + ' kontrol selhalo.') : 'Program zápasů: všechny kontroly prošly.');
process.exit(chyb ? 1 : 0);
