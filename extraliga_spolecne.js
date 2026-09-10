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
    // Od kdy web ukazuje body (do té doby jen tipy). Výchozí = uzávěrka tipování; kdyby měly body běžet dřív, stačí posunout.
    BODOVANI_OD: "2026-09-30T23:59:59",
    POCET_MIST: 14,
    MAX_BODU_TYMU: 156,
    // Žolíci: každý tipující označí POCET_ZOLIKU týmů ze svého pořadí jako žolíky a u každého tipne,
    // kolik bodů v základní části získá.
    POCET_ZOLIKU: 3,
    ZOLIK_NASOBEK_UMISTENI: 2,   // body za umístění žolíkového týmu se počítají tolikrát
    ZOLIK_NASOBEK_BODU: 2,       // tip na bodový zisk žolíka: běžná číselná škála (10/8/6/4/2) krát tohle
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
    // Rekordy, které se doplňují přímo do textu otázek. Prázdný text = do otázky se nic nedoplní.
    REKORDY: {
      // Nejvíc gólů jednoho hráče v jedné základní části samostatné extraligy.
      ruzicka_goly_sezona: "40 gólů, Martin Růžička, Třinec, základní část 2012/13",
      // Rekordní celkový počet gólů všech týmů v jedné základní části – DOPLNIT (např. "1 234 gólů, sezóna 2024/25").
      goly_zakladni_cast: ""
    },
    // Správné odpovědi 2025/26 pro nápovědy u otázek (klíč = klíč otázky). Otázka bez záznamu nápovědu nemá.
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
      trestyhrac: "John Ludvig",
      tomek_body: "20 bodů (13 gólů + 7 asistencí)"
    }
  };

  // Sloupce listu Tipy (index v poli řádku, 0 = sloupec A). List Přehled HOTOVO má v řádku 2 stejné rozložení.
  // Nové sloupce sezóny 26/27 jsou přidané na konec, aby se původní nemusely posouvat.
  var SLOUPCE = {
    DATUM: 0, JMENO: 1, EMAIL: 2, KLUB: 3,
    MISTO_OD: 4, MISTO_DO: 17,                // E–R: tip na pořadí 1.–14.
    BONUS_OD: 18, BONUS_DO: 29,               // S–AD: původní bonusové otázky
    MISTR_VITEZ: 30, MISTR_OD: 31, MISTR_DO: 34,
    VZKAZ: 35,                                // AJ
    ZOLIK_OD: 36, ZOLIK_DO: 41,               // AK–AP: žolík 1 tým, žolík 1 body, žolík 2 tým, ... žolík 3 body
    BONUS2_OD: 42, BONUS2_DO: 49,             // AQ–AX: nové bonusové otázky
    BODY_MISTO_OD: 50, BODY_MISTO_DO: 63,     // AY–BL: jen v listu Přehled HOTOVO – body týmu na 1.–14. místě
    POCET_TIPU: 50,                           // kolik sloupců zapisuje formulář do listu Tipy (A–AX)
    POCET: 64                                 // celková šířka řádku výsledků (A–BL)
  };

  function sRekordem(text, rekord) {
    return rekord ? text + " (rekord: " + rekord + ")" : text;
  }

  // Bonusové otázky. Pořadí v poli = pořadí ve formuláři a v přehledu, idx = sloupec listu.
  // typ:    "cislo" = 10/8/6/4/2 bodů podle odchylky, "text10" = 10 bodů za shodu, "text20" = 20 bodů za shodu.
  // vstup:  "cislo" = číselné pole, "tym" = výběr týmu, "anone" = Ano/Ne, "text" = jméno hráče.
  // skupina = nadpis sekce ve formuláři, nadpis = krátký název sloupce v tabulce, popis = pro hlášku o chybějícím výběru.
  var BONUSY = [
    { idx: 20, klic: "body_mistr",    typ: "cislo",  aktivni: true, vstup: "cislo", max: "tymy", skupina: "Tabulka po základní části", nadpis: "Body 1. místa",
      otazka: "Kolik bodů získá tým na 1. místě po základní části?" },
    { idx: 21, klic: "rozdil_1_2",    typ: "cislo",  aktivni: true, vstup: "cislo", max: "tymy", skupina: "Tabulka po základní části", nadpis: "Rozdíl 1.–2.",
      otazka: "Jaký bude bodový rozdíl mezi 1. a 2. místem po základní části?" },
    { idx: 22, klic: "body_posledni", typ: "cislo",  aktivni: true, vstup: "cislo", max: "tymy", skupina: "Tabulka po základní části", nadpis: "Body posledního",
      otazka: "Kolik bodů získá poslední tým tabulky po základní části?" },
    { idx: 42, klic: "rekord_goly",   typ: "text10", aktivni: true, vstup: "anone", skupina: "Tabulka po základní části", nadpis: "Rekord gólů ZČ",
      otazka: sRekordem("Bude v základní části překonán rekord v celkovém počtu vstřelených gólů (všechny týmy dohromady)?", KONFIG.REKORDY.goly_zakladni_cast) },

    { idx: 18, klic: "finalevyhra",   typ: "text20", aktivni: true, vstup: "tym", skupina: "Play-off", nadpis: "Vítěz finále", popis: "vítěz finále play-off",
      otazka: "Který tým vyhraje finále play-off?" },
    { idx: 19, klic: "finaleprohra",  typ: "text20", aktivni: true, vstup: "tym", skupina: "Play-off", nadpis: "Poražený finalista", popis: "poražený finalista",
      otazka: "Který tým prohraje ve finále play-off?" },

    { idx: 23, klic: "tymgoly",       typ: "text20", aktivni: true, vstup: "tym", skupina: "Týmové statistiky", nadpis: "Nejvíc gólů", popis: "tým s nejvíce góly",
      otazka: "Který tým vstřelí nejvíce gólů v základní části?" },
    { idx: 24, klic: "tympresilovky", typ: "text20", aktivni: true, vstup: "tym", skupina: "Týmové statistiky", nadpis: "Nejvíc přesilovek", popis: "tým s nejvíce přesilovkami",
      otazka: "Který tým využije nejvíce přesilovek?" },
    { idx: 25, klic: "tymfauly",      typ: "text20", aktivni: true, vstup: "tym", skupina: "Týmové statistiky", nadpis: "Nejtrestanější tým", popis: "nejtrestanější tým",
      otazka: "Který tým bude v základní části nejtrestanější?" },
    { idx: 43, klic: "tym_nejmene_trestany", typ: "text20", aktivni: true, vstup: "tym", skupina: "Týmové statistiky", nadpis: "Nejméně trestaný tým", popis: "nejméně trestaný tým",
      otazka: "Který tým bude v základní části nejméně trestaný (nejméně trestných minut)?" },
    { idx: 26, klic: "baraz",         typ: "text10", aktivni: true, vstup: "anone", skupina: "Týmové statistiky", nadpis: "Baráž",
      otazka: "Sestoupí extraligový tým do Maxa ligy po prohře v baráži?" },

    { idx: 27, klic: "strelec",       typ: "text20", aktivni: true, vstup: "text", skupina: "Hráči", nadpis: "Nejlepší střelec",
      otazka: "Nejlepší střelec základní části", placeholder: "např. Anthony Nellis (snaž se napsat celé jméno správně)" },
    { idx: 28, klic: "gol_strelec",   typ: "cislo",  aktivni: true, vstup: "cislo", max: 100, skupina: "Hráči", nadpis: "Góly střelce",
      otazka: "Kolik gólů vstřelí nejlepší střelec?" },
    { idx: 44, klic: "stransky_ruzicka", typ: "text10", aktivni: true, vstup: "anone", skupina: "Hráči", nadpis: "Stránský vs. Růžička",
      otazka: sRekordem("Překoná Matěj Stránský (Pardubice) rekord Martina Růžičky v počtu gólů za jednu základní část?", KONFIG.REKORDY.ruzicka_goly_sezona) },
    { idx: 29, klic: "trestyhrac",    typ: "text20", aktivni: true, vstup: "text", skupina: "Hráči", nadpis: "Nejtrestanější hráč",
      otazka: "Nejtrestanější hráč základní části", placeholder: "např. John Ludvig (snaž se napsat celé jméno správně)" },
    { idx: 45, klic: "icetime",       typ: "text20", aktivni: true, vstup: "text", skupina: "Hráči", nadpis: "Největší icetime",
      otazka: "Který hráč v poli bude mít za základní část největší celkový čas na ledě (icetime)?", placeholder: "Jméno a příjmení hráče (brankáři se nepočítají)" },
    { idx: 46, klic: "procento_golu", typ: "text20", aktivni: true, vstup: "text", skupina: "Hráči", nadpis: "Procento gólů týmu",
      otazka: "Který hráč vstřelí největší procento gólů svého týmu v základní části?", placeholder: "Jméno a příjmení hráče" },
    { idx: 47, klic: "tomek_body",    typ: "cislo",  aktivni: true, vstup: "cislo", max: 100, skupina: "Hráči", nadpis: "Body P. Tomek",
      otazka: "Kolik bodů (góly + asistence) udělá Petr Tomek (Karlovy Vary) v základní části?" },

    { idx: 48, klic: "duda_angazma",  typ: "text10", aktivni: true, vstup: "anone", skupina: "Speciál Mistrů světa", nadpis: "Duda angažmá",
      otazka: "Bude Radek Duda v průběhu sezóny angažován do některého hokejového klubu?" },
    { idx: 49, klic: "galvas_usa",    typ: "text10", aktivni: true, vstup: "anone", skupina: "Speciál Mistrů světa", nadpis: "Galvas do USA",
      otazka: "Odejde Tomáš Galvas v průběhu sezóny z Liberce do USA (Pittsburgh), nebo za Liberec vůbec nenastoupí?" }
  ];

  // Pole formuláře (atribut name) → index sloupce listu Tipy. Používá formulář i Apps Script (doPost).
  var POLE = [];
  POLE[SLOUPCE.JMENO] = "jmeno";
  POLE[SLOUPCE.EMAIL] = "email";
  POLE[SLOUPCE.KLUB] = "fandim";
  (function () {
    var i, k;
    for (i = 0; i < KONFIG.POCET_MIST; i++) POLE[SLOUPCE.MISTO_OD + i] = "misto" + (i + 1);
    for (i = 0; i < BONUSY.length; i++) POLE[BONUSY[i].idx] = BONUSY[i].klic;
    POLE[SLOUPCE.MISTR_VITEZ] = "zajic_vitez";
    for (i = 0; i <= SLOUPCE.MISTR_DO - SLOUPCE.MISTR_OD; i++) POLE[SLOUPCE.MISTR_OD + i] = "zajic" + (i + 1);
    POLE[SLOUPCE.VZKAZ] = "poznamky";
    for (k = 0; k < KONFIG.POCET_ZOLIKU; k++) {
      POLE[SLOUPCE.ZOLIK_OD + 2 * k] = "zolik" + (k + 1);
      POLE[SLOUPCE.ZOLIK_OD + 2 * k + 1] = "zolik" + (k + 1) + "_body";
    }
  })();

  // Názvy sloupců (hlavička listu Tipy = prvních POCET_TIPU, list Přehled HOTOVO všech POCET).
  var HLAVICKA = [];
  (function () {
    var i, k;
    HLAVICKA[SLOUPCE.DATUM] = "Datum";
    HLAVICKA[SLOUPCE.JMENO] = "Jméno";
    HLAVICKA[SLOUPCE.EMAIL] = "E-mail";
    HLAVICKA[SLOUPCE.KLUB] = "Oblíbený klub";
    for (i = 0; i < KONFIG.POCET_MIST; i++) HLAVICKA[SLOUPCE.MISTO_OD + i] = (i + 1) + ". místo";
    for (i = 0; i < BONUSY.length; i++) HLAVICKA[BONUSY[i].idx] = BONUSY[i].nadpis;
    HLAVICKA[SLOUPCE.MISTR_VITEZ] = "Vítěz Mistrů";
    for (i = 0; i <= SLOUPCE.MISTR_DO - SLOUPCE.MISTR_OD; i++) HLAVICKA[SLOUPCE.MISTR_OD + i] = "Mistr " + (i + 1) + ".";
    HLAVICKA[SLOUPCE.VZKAZ] = "Vzkaz";
    for (k = 0; k < KONFIG.POCET_ZOLIKU; k++) {
      HLAVICKA[SLOUPCE.ZOLIK_OD + 2 * k] = "Žolík " + (k + 1);
      HLAVICKA[SLOUPCE.ZOLIK_OD + 2 * k + 1] = "Žolík " + (k + 1) + " body";
    }
    for (i = 0; i < KONFIG.POCET_MIST; i++) HLAVICKA[SLOUPCE.BODY_MISTO_OD + i] = "Body " + (i + 1) + ". místa";
    for (i = 0; i < SLOUPCE.POCET; i++) if (HLAVICKA[i] === undefined) HLAVICKA[i] = "";
  })();

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

  // Název týmu z buňky s pořadím: vrací kanonický název z KONFIG.TYMY (bez ohledu na velikost písmen a diakritiku).
  // Prázdná buňka, pouhé číslo (např. 0, které vrátí vzorec =F11 na prázdný řádek) nebo neznámý text = "zatím neznámé".
  function normTym(v) {
    var s = norm(v);
    if (s === "" || cislo(s) !== null) return "";
    var k = bezDiakritiky(s);
    for (var i = 0; i < KONFIG.TYMY.length; i++) {
      if (bezDiakritiky(KONFIG.TYMY[i]) === k) return KONFIG.TYMY[i];
    }
    return "";
  }

  function nasobitel(presne) {
    if (presne >= 13) return 1.4;
    if (presne >= 11) return 1.3;
    if (presne >= 9) return 1.2;
    if (presne >= 7) return 1.1;
    return 1.0;
  }

  // Body za číselnou otázku: přesně 10, o 1 vedle 8, o 2 = 6, o 3 = 4, o 4 = 2, jinak 0.
  // Volitelný násobek (žolíci) vynásobí celou škálu.
  function bodyZaCislo(tip, spravne, nasobek) {
    var a = cislo(tip), b = cislo(spravne);
    if (a === null || b === null) return 0;
    var rozdil = Math.round(Math.abs(a - b) * 100) / 100;
    var body = 0;
    if (rozdil === 0) body = 10;
    else if (rozdil === 1) body = 8;
    else if (rozdil === 2) body = 6;
    else if (rozdil === 3) body = 4;
    else if (rozdil === 4) body = 2;
    return body * (nasobek || 1);
  }

  // Body za textovou otázku. Správná odpověď může obsahovat víc přijatelných variant oddělených čárkou.
  function bodyZaText(tip, spravne, hodnota) {
    var t = normKlic(tip);
    var s = norm(spravne);
    if (t === "" || s === "") return 0;
    var varianty = s.split(",").map(function (x) { return x.trim().toLowerCase(); });
    return varianty.indexOf(t) !== -1 ? hodnota : 0;
  }

  // Oficiální pořadí z řádku výsledků (prázdný text = místo zatím neznámé).
  function seznamOficialni(vysledkyRow) {
    var o = [];
    for (var j = 0; j < KONFIG.POCET_MIST; j++) o.push(normTym(vysledkyRow ? vysledkyRow[SLOUPCE.MISTO_OD + j] : ""));
    return o;
  }

  // Jsou už k dispozici výsledky (aspoň jedno místo v řádku výsledků vyplněné)?
  function jsouVysledky(vysledkyRow) {
    if (!vysledkyRow) return false;
    for (var j = SLOUPCE.MISTO_OD; j <= SLOUPCE.MISTO_DO; j++) {
      if (normTym(vysledkyRow[j]) !== "") return true;
    }
    return false;
  }

  // Bodování se zobrazuje až od KONFIG.BODOVANI_OD a jen když už jsou v tabulce výsledky (jinak jen tipy).
  function bodovaniZapnuto(vysledkyRow, ted) {
    var od = new Date(KONFIG.BODOVANI_OD);
    var nyni = ted === undefined ? new Date() : new Date(ted);
    return nyni >= od && jsouVysledky(vysledkyRow);
  }

  // Indexy sloupců k-tého žolíka (k od 0).
  function sloupceZolika(k) {
    return { tym: SLOUPCE.ZOLIK_OD + 2 * k, body: SLOUPCE.ZOLIK_OD + 2 * k + 1 };
  }

  // Názvy žolíkových týmů z řádku tipu (prázdný text = nevyplněno).
  function zolikTymy(tipRow) {
    var t = [];
    for (var k = 0; k < KONFIG.POCET_ZOLIKU; k++) t.push(norm(tipRow ? tipRow[sloupceZolika(k).tym] : ""));
    return t;
  }

  // Body za pořadí týmů. Za každý tým v oficiálním pořadí: 10 mínus rozdíl míst (min 0),
  // u žolíkového týmu krát ZOLIK_NASOBEK_UMISTENI. Součet se pak násobí bonusem za přesné trefy.
  function bodyUmisteni(tipRow, vysledkyRow) {
    var tipy = [], oficialni = seznamOficialni(vysledkyRow), body = [], bodyZaklad = [], zolik = [];
    var zolici = zolikTymy(tipRow);
    var j, soucet = 0, presne = 0;
    for (j = 0; j < KONFIG.POCET_MIST; j++) tipy.push(norm(tipRow ? tipRow[SLOUPCE.MISTO_OD + j] : ""));
    for (j = 0; j < KONFIG.POCET_MIST; j++) {
      var tym = oficialni[j];
      var b = 0, jeZolik = tym !== "" && zolici.indexOf(tym) !== -1;
      if (tym !== "") {
        var k = tipy.indexOf(tym);
        if (k !== -1) b = Math.max(0, 10 - Math.abs(k - j));
        if (tipy[j] === tym) presne++;
      }
      bodyZaklad.push(b);
      if (jeZolik) b = b * KONFIG.ZOLIK_NASOBEK_UMISTENI;
      body.push(b);
      zolik.push(jeZolik);
      soucet += b;
    }
    var n = nasobitel(presne);
    return { body: body, bodyZaklad: bodyZaklad, zolik: zolik, soucet: soucet, presne: presne, nasobitel: n, celkem: zaokrouhli(soucet * n) };
  }

  // Body za tipy na bodový zisk žolíků. Skutečné body týmu se berou z řádku výsledků (sloupce Body 1.–14. místa)
  // podle toho, na kterém místě žolík v oficiálním pořadí skončil.
  function bodyZolici(tipRow, vysledkyRow) {
    var oficialni = seznamOficialni(vysledkyRow);
    var polozky = [], celkem = 0;
    for (var k = 0; k < KONFIG.POCET_ZOLIKU; k++) {
      var sl = sloupceZolika(k);
      var tym = norm(tipRow ? tipRow[sl.tym] : "");
      var tipBody = norm(tipRow ? tipRow[sl.body] : "");
      var pozice = tym !== "" ? oficialni.indexOf(tym) : -1;
      var skutecne = pozice !== -1 && vysledkyRow ? norm(vysledkyRow[SLOUPCE.BODY_MISTO_OD + pozice]) : "";
      var b = bodyZaCislo(tipBody, skutecne, KONFIG.ZOLIK_NASOBEK_BODU);
      polozky.push({ k: k, tym: tym, tipBody: tipBody, skutecne: skutecne, pozice: pozice, body: b });
      celkem += b;
    }
    return { polozky: polozky, celkem: celkem };
  }

  // Body za bonusové otázky (původní S až AD i nové AQ až AX).
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
      polozky.push({ idx: q.idx, klic: q.klic, typ: q.typ, vstup: q.vstup, aktivni: q.aktivni, otazka: q.otazka,
        tip: norm(tip), spravne: norm(spravne), body: b });
    }
    return { polozky: polozky, celkem: celkem };
  }

  // Kompletní vyhodnocení jednoho tipu.
  function vyhodnot(tipRow, vysledkyRow) {
    var u = bodyUmisteni(tipRow, vysledkyRow);
    var z = bodyZolici(tipRow, vysledkyRow);
    var b = bodyBonusy(tipRow, vysledkyRow);
    return { umisteni: u, zolici: z, bonusy: b, celkem: zaokrouhli(u.celkem + z.celkem + b.celkem) };
  }

  // Řádek listu Tipy z odeslaného formuláře (param = objekt name → hodnota, v Apps Scriptu e.parameter).
  function radekZFormulare(param, datum) {
    var row = [];
    for (var i = 0; i < SLOUPCE.POCET_TIPU; i++) {
      var pole = POLE[i];
      row.push(pole && param ? norm(param[pole]) : "");
    }
    row[SLOUPCE.DATUM] = datum === undefined ? "" : datum;
    return row;
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
    POLE: POLE,
    HLAVICKA: HLAVICKA,
    norm: norm,
    normKlic: normKlic,
    normTym: normTym,
    cislo: cislo,
    zaokrouhli: zaokrouhli,
    nasobitel: nasobitel,
    bodyZaCislo: bodyZaCislo,
    bodyZaText: bodyZaText,
    seznamOficialni: seznamOficialni,
    jsouVysledky: jsouVysledky,
    bodovaniZapnuto: bodovaniZapnuto,
    sloupceZolika: sloupceZolika,
    zolikTymy: zolikTymy,
    bodyUmisteni: bodyUmisteni,
    bodyZolici: bodyZolici,
    bodyBonusy: bodyBonusy,
    vyhodnot: vyhodnot,
    radekZFormulare: radekZFormulare,
    bezDiakritiky: bezDiakritiky,
    najdiMistra: najdiMistra,
    jeMistr: jeMistr,
    fotoMistra: fotoMistra
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = EXTRALIGA;
}
