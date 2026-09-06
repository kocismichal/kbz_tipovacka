/*
 * extraliga_spolecne.js
 * Společná konfigurace a bodování tipovačky "Extraliga Mistrů světa" 2026/27.
 * Používá ho formulář, přehled tipů i Google Apps Script v tabulce.
 * Čistý JavaScript bez DOM a bez modulů, aby šel zkopírovat 1:1 do Apps Scriptu.
 */
var EXTRALIGA = (function () {
  "use strict";

  var KONFIG = {
    SEZONA: "2026/27",
    NAZEV: "Extraliga Mistrů světa",
    DEADLINE: "2026-09-30T23:59:59",
    DEADLINE_TEXT: "STŘEDA 30. 9. 2026 23:59",
    DEADLINE_DATUM_TEXT: "30. 9. 2026",
    POCET_MIST: 14,
    MAX_BODU_TYMU: 156,
    TYMY: [
      "Karlovy Vary", "Kladno", "Liberec", "Litvínov", "Pardubice", "Plzeň",
      "Sparta Praha", "Třinec", "Vítkovice", "Mladá Boleslav",
      "Olomouc", "Kometa Brno", "Mountfield HK", "České Budějovice"
    ],
    LOGA: {
      "Karlovy Vary": "https://i.imgur.com/O4w3Sfn.png",
      "Kladno": "https://i.imgur.com/RU6Pup9.png",
      "Liberec": "https://i.imgur.com/gOphoYa.png",
      "Litvínov": "https://i.imgur.com/PZkCLfw.png",
      "Pardubice": "https://i.imgur.com/isU5OoU.png",
      "Plzeň": "https://i.imgur.com/oHghBc2.png",
      "Sparta Praha": "https://i.imgur.com/FBNmltI.png",
      "Třinec": "https://i.imgur.com/emb2cCW.png",
      "Vítkovice": "https://i.imgur.com/6wXEaRP.png",
      "Mladá Boleslav": "https://i.imgur.com/NsyBU2q.png",
      "Olomouc": "https://i.imgur.com/8ZPHMmW.png",
      "Kometa Brno": "https://i.imgur.com/A93pjvG.png",
      "Mountfield HK": "https://i.imgur.com/uAKXaDa.png",
      "České Budějovice": "https://i.imgur.com/iUnx3A5.png"
    },
    MISTRI: ["Vilda", "Bonifác", "Tlusťoch", "Dudák"],
    // Tipy Mistrů jsou v řádcích 2 až 5 listu Tipy = indexy 1 až 4 v poli dat (řádek 0 je hlavička).
    MISTRI_INDEXY: [1, 2, 3, 4],
    // Mistři: přezdívka, varianty jména pro rozpoznání tipu (bez diakritiky, malými písmeny, celé jméno nebo
    // nezaměnitelná přezdívka jako samostatné slovo) a soubor s fotkou v repu webu.
    MISTRI_DETAIL: [
      { prezdivka: "Vilda",    jmena: ["vilem franek"],                          foto: "vilda.jpg" },
      { prezdivka: "Bonifác",  jmena: ["honza homolka", "jan homolka", "bonifac"], foto: "bonifac.jpg" },
      { prezdivka: "Tlusťoch", jmena: ["jiri tlusty", "tlustoch"],               foto: "tlustoch.jpg" },
      { prezdivka: "Dudák",    jmena: ["radek duda"],                            foto: "dudak.jpg" }
    ],
    // Konečné pořadí základní části 2025/26 (list Přehled HOTOVO loňské tabulky).
    PORADI_2526: [
      "Pardubice", "Plzeň", "Liberec", "Mountfield HK", "Třinec", "Karlovy Vary", "Sparta Praha",
      "Kometa Brno", "České Budějovice", "Kladno", "Vítkovice", "Olomouc", "Mladá Boleslav", "Litvínov"
    ],
    // Správné odpovědi 2025/26 pro nápovědy u otázek.
    ODPOVEDI_2526: {
      body_mistr: "99 bodů",
      rozdil_1_2: "6 bodů",
      body_posledni: "43 bodů",
      tymgoly: "Sparta Praha a Pardubice (shodně)",
      tympresilovky: "Pardubice",
      tymfauly: "Sparta Praha",
      baraz: "Ne",
      strelec: "Anthony Nellis",
      gol_strelec: "25 gólů",
      trestyhrac: "John Ludvig"
    }
  };

  // Sloupce listu Tipy (index v poli řádku, 0 = sloupec A).
  var SLOUPCE = {
    DATUM: 0, JMENO: 1, EMAIL: 2, KLUB: 3,
    MISTO_OD: 4, MISTO_DO: 17,
    BONUS_OD: 18, BONUS_DO: 29,
    MISTR_VITEZ: 30, MISTR_OD: 31, MISTR_DO: 34,
    VZKAZ: 35,
    POCET: 36
  };

  // Bonusové otázky v pořadí sloupců S až AD listu Tipy.
  // typ: "cislo" = 10/8/6/4/2 bodů podle odchylky, "text10" = 10 bodů za shodu, "text20" = 20 bodů za shodu.
  var BONUSY = [
    { idx: 18, klic: "finalevyhra",   typ: "text10", aktivni: false, otazka: "Který tým vyhraje finále play-off?" },
    { idx: 19, klic: "finaleprohra",  typ: "text10", aktivni: false, otazka: "Který tým prohraje ve finále play-off?" },
    { idx: 20, klic: "body_mistr",    typ: "cislo",  aktivni: true,  otazka: "Kolik bodů získá tým na 1. místě po základní části?" },
    { idx: 21, klic: "rozdil_1_2",    typ: "cislo",  aktivni: true,  otazka: "Jaký bude bodový rozdíl mezi 1. a 2. místem po základní části?" },
    { idx: 22, klic: "body_posledni", typ: "cislo",  aktivni: true,  otazka: "Kolik bodů získá poslední tým tabulky po základní části?" },
    { idx: 23, klic: "tymgoly",       typ: "text20", aktivni: true,  otazka: "Který tým vstřelí nejvíce gólů v základní části?" },
    { idx: 24, klic: "tympresilovky", typ: "text20", aktivni: true,  otazka: "Který tým využije nejvíce přesilovek?" },
    { idx: 25, klic: "tymfauly",      typ: "text20", aktivni: true,  otazka: "Který tým bude v základní části nejtrestanější?" },
    { idx: 26, klic: "baraz",         typ: "text10", aktivni: true,  otazka: "Sestoupí extraligový tým do Maxa ligy po prohře v baráži?" },
    { idx: 27, klic: "strelec",       typ: "text20", aktivni: true,  otazka: "Nejlepší střelec základní části" },
    { idx: 28, klic: "gol_strelec",   typ: "cislo",  aktivni: true,  otazka: "Kolik gólů vstřelí nejlepší střelec?" },
    { idx: 29, klic: "trestyhrac",    typ: "text20", aktivni: true,  otazka: "Nejtrestanější hráč základní části" }
  ];

  function norm(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  function normKlic(v) {
    return norm(v).toLowerCase();
  }

  function cislo(v) {
    var s = norm(v).replace(",", ".");
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  function zaokrouhli(x) {
    return Math.round(x * 10) / 10;
  }

  function nasobitel(presne) {
    if (presne >= 13) return 1.4;
    if (presne >= 11) return 1.3;
    if (presne >= 9) return 1.2;
    if (presne >= 7) return 1.1;
    return 1.0;
  }

  // Body za číselnou otázku: přesně 10, o 1 vedle 8, o 2 = 6, o 3 = 4, o 4 = 2, jinak 0.
  function bodyZaCislo(tip, spravne) {
    var a = cislo(tip), b = cislo(spravne);
    if (a === null || b === null) return 0;
    var rozdil = Math.round(Math.abs(a - b) * 100) / 100;
    if (rozdil === 0) return 10;
    if (rozdil === 1) return 8;
    if (rozdil === 2) return 6;
    if (rozdil === 3) return 4;
    if (rozdil === 4) return 2;
    return 0;
  }

  // Body za textovou otázku. Správná odpověď může obsahovat víc přijatelných variant oddělených čárkou.
  function bodyZaText(tip, spravne, hodnota) {
    var t = normKlic(tip);
    var s = norm(spravne);
    if (t === "" || s === "") return 0;
    var varianty = s.split(",").map(function (x) { return x.trim().toLowerCase(); });
    return varianty.indexOf(t) !== -1 ? hodnota : 0;
  }

  // Jsou už k dispozici výsledky (aspoň jedno místo v řádku výsledků vyplněné)?
  function jsouVysledky(vysledkyRow) {
    if (!vysledkyRow) return false;
    for (var j = SLOUPCE.MISTO_OD; j <= SLOUPCE.MISTO_DO; j++) {
      if (norm(vysledkyRow[j]) !== "") return true;
    }
    return false;
  }

  // Body za pořadí týmů. Za každý tým v oficiálním pořadí: 10 mínus rozdíl míst (min 0).
  function bodyUmisteni(tipRow, vysledkyRow) {
    var tipy = [], oficialni = [], body = [];
    var j, soucet = 0, presne = 0;
    for (j = 0; j < KONFIG.POCET_MIST; j++) {
      tipy.push(norm(tipRow ? tipRow[SLOUPCE.MISTO_OD + j] : ""));
      oficialni.push(norm(vysledkyRow ? vysledkyRow[SLOUPCE.MISTO_OD + j] : ""));
    }
    for (j = 0; j < KONFIG.POCET_MIST; j++) {
      var tym = oficialni[j];
      var b = 0;
      if (tym !== "") {
        var k = tipy.indexOf(tym);
        if (k !== -1) b = Math.max(0, 10 - Math.abs(k - j));
        if (tipy[j] === tym) presne++;
      }
      body.push(b);
      soucet += b;
    }
    var n = nasobitel(presne);
    return { body: body, soucet: soucet, presne: presne, nasobitel: n, celkem: zaokrouhli(soucet * n) };
  }

  // Body za bonusové otázky (sloupce S až AD).
  function bodyBonusy(tipRow, vysledkyRow) {
    var polozky = [], celkem = 0;
    for (var i = 0; i < BONUSY.length; i++) {
      var q = BONUSY[i];
      var tip = tipRow ? tipRow[q.idx] : "";
      var spravne = vysledkyRow ? vysledkyRow[q.idx] : "";
      var b = 0;
      if (q.typ === "cislo") b = bodyZaCislo(tip, spravne);
      else if (q.typ === "text10") b = bodyZaText(tip, spravne, 10);
      else b = bodyZaText(tip, spravne, 20);
      celkem += b;
      polozky.push({ idx: q.idx, klic: q.klic, typ: q.typ, aktivni: q.aktivni, otazka: q.otazka,
        tip: norm(tip), spravne: norm(spravne), body: b });
    }
    return { polozky: polozky, celkem: celkem };
  }

  // Kompletní vyhodnocení jednoho tipu.
  function vyhodnot(tipRow, vysledkyRow) {
    var u = bodyUmisteni(tipRow, vysledkyRow);
    var b = bodyBonusy(tipRow, vysledkyRow);
    return { umisteni: u, bonusy: b, celkem: zaokrouhli(u.celkem + b.celkem) };
  }

  // Jméno bez diakritiky, malými písmeny, s jednoduchými mezerami (pro porovnávání jmen Mistrů).
  function bezDiakritiky(v) {
    var s = norm(v).toLowerCase();
    if (typeof s.normalize === "function") s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.replace(/\s+/g, " ").trim();
  }

  // Najde Mistra podle jména v tipu (celé jméno nebo přezdívka jako samostatné slovo), jinak null.
  function najdiMistra(jmeno) {
    var j = bezDiakritiky(jmeno);
    if (j === "") return null;
    j = " " + j + " ";
    for (var i = 0; i < KONFIG.MISTRI_DETAIL.length; i++) {
      var m = KONFIG.MISTRI_DETAIL[i];
      for (var k = 0; k < m.jmena.length; k++) {
        if (j.indexOf(" " + m.jmena[k] + " ") !== -1) return m;
      }
    }
    return null;
  }

  function jeMistr(jmeno) {
    return najdiMistra(jmeno) !== null;
  }

  // Soubor s fotkou Mistra podle jména v tipu, nebo "" (pak se použijí iniciály).
  function fotoMistra(jmeno) {
    var m = najdiMistra(jmeno);
    return m ? m.foto : "";
  }

  return {
    KONFIG: KONFIG,
    SLOUPCE: SLOUPCE,
    BONUSY: BONUSY,
    norm: norm,
    cislo: cislo,
    zaokrouhli: zaokrouhli,
    nasobitel: nasobitel,
    bodyZaCislo: bodyZaCislo,
    bodyZaText: bodyZaText,
    jsouVysledky: jsouVysledky,
    bodyUmisteni: bodyUmisteni,
    bodyBonusy: bodyBonusy,
    vyhodnot: vyhodnot,
    bezDiakritiky: bezDiakritiky,
    najdiMistra: najdiMistra,
    jeMistr: jeMistr,
    fotoMistra: fotoMistra
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = EXTRALIGA;
}
