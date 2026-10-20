# Aktualizace tabulky Extraligy z tohoto počítače.
# hokej.cz odmítá roboty GitHub Actions (HTTP 403), z domácí linky ale odpovídá normálně,
# takže tabulku stahuje naplánovaná úloha odtud a změnu rovnou pošle na GitHub (= na web).
#
# Spuštění ručně:  powershell -NoProfile -ExecutionPolicy Bypass -File skripty\aktualizuj_z_pc.ps1
# Naplánování:     powershell -NoProfile -ExecutionPolicy Bypass -File skripty\nastav_ulohu.ps1
# Protokol běhů:   skripty\aktualizace.log
#
# Bez parametru se řídí programem zápasů (ve dnech bez hokeje a po zapsání všech zápasů hned skončí).
# S -Vzdy stáhne tabulku vždy.
param([switch]$Vzdy)

$ErrorActionPreference = 'Stop'
# Výpis z node je v UTF-8; bez tohohle by v protokolu byly zprzněné háčky
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repo = Split-Path -Parent $PSScriptRoot
# Protokol i zámek leží vedle skriptu (ne v AppData): složku AppData má Claude přesměrovanou jinam,
# takže by do protokolu z úlohy neviděl. Oba soubory jsou v .gitignore.
$log = Join-Path $PSScriptRoot 'aktualizace.log'
$zamek = Join-Path $PSScriptRoot 'aktualizace.lock'

function Zapis($text) {
    $radek = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $text
    Write-Output $radek
    Add-Content -Path $log -Value $radek -Encoding utf8
}

# Dva běhy naráz by si šlapaly po gitu; zámek starší než hodinu je zapomenutý po pádu.
if (Test-Path $zamek) {
    $stari = (Get-Date) - (Get-Item $zamek).LastWriteTime
    if ($stari.TotalMinutes -lt 60) { Zapis 'Jiný běh ještě pracuje, končím.'; exit 0 }
    Remove-Item $zamek -Force
}
New-Item -ItemType File -Path $zamek -Force | Out-Null

try {
    Set-Location $repo

    # Google Disk může soubory chvíli držet; když pull nejde, zkusí se příště
    & git pull --ff-only --quiet
    if ($LASTEXITCODE -ne 0) { Zapis 'git pull se nepovedl, končím (zkusí se při dalším běhu).'; exit 0 }

    $argumenty = @('skripty/stahni_tabulku_extraligy.js')
    if ($Vzdy) { $argumenty += '--vzdy' }
    $vystup = & node $argumenty 2>&1
    $kodSkriptu = $LASTEXITCODE
    foreach ($r in $vystup) { Zapis ("  " + $r) }
    if ($kodSkriptu -ne 0) { Zapis "Skript skončil chybou ($kodSkriptu)."; exit 0 }

    $soubory = @('2627_extraliga_stav.json', '2627_extraliga_historie.json', '2627_extraliga_zapasy.json')
    $zmeneno = & git status --porcelain -- $soubory
    if ([string]::IsNullOrWhiteSpace($zmeneno)) { Zapis 'Beze změny, není co posílat.'; exit 0 }

    & git add $soubory
    $popis = 'Tabulka Extraligy: aktualizace z PC ' + (Get-Date -Format 'd. M. yyyy HH:mm')
    & git commit --quiet -m $popis
    & git push --quiet origin main
    if ($LASTEXITCODE -ne 0) {
        Zapis 'Push se nepovedl – srovnávám se s main a zkusím to při dalším běhu.'
        & git fetch origin main --quiet
        & git reset --hard origin/main --quiet
        exit 0
    }
    Zapis "Odesláno na GitHub: $popis"
}
catch {
    Zapis ('CHYBA: ' + $_.Exception.Message)
}
finally {
    Remove-Item $zamek -Force -ErrorAction SilentlyContinue
}
