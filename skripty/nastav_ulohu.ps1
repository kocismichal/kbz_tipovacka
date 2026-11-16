# Naplánuje aktualizaci tabulky Extraligy na tomto počítači (Plánovač úloh Windows).
# Úloha "KBZ tipovacka - tabulka Extraligy" spouští skripty\aktualizuj_z_pc.ps1:
#   - ráno v 8:00 jednou,
#   - od 16:00 do 23:30 každých 30 minut (hrací večery).
# Běží jen když je počítač zapnutý a uživatel přihlášený, počítač nebudí a bez sítě se nespustí.
#
# Spuštění:  powershell -NoProfile -ExecutionPolicy Bypass -File skripty\nastav_ulohu.ps1
# Zrušení:   powershell -NoProfile -ExecutionPolicy Bypass -File skripty\nastav_ulohu.ps1 -Zrusit
param([switch]$Zrusit)

$ErrorActionPreference = 'Stop'
$nazev = 'KBZ tipovacka - tabulka Extraligy'
$skript = Join-Path $PSScriptRoot 'aktualizuj_z_pc.ps1'

if ($Zrusit) {
    Unregister-ScheduledTask -TaskName $nazev -Confirm:$false -ErrorAction SilentlyContinue
    Write-Output "Úloha '$nazev' zrušena."
    exit 0
}

if (-not (Test-Path $skript)) { throw "Nenašel jsem $skript" }

$akce = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $skript + '"')

$rano = New-ScheduledTaskTrigger -Daily -At 8:00am
$vecer = New-ScheduledTaskTrigger -Daily -At 4:00pm
$vecer.Repetition = (New-ScheduledTaskTrigger -Once -At 4:00pm `
    -RepetitionInterval (New-TimeSpan -Minutes 30) `
    -RepetitionDuration (New-TimeSpan -Hours 7 -Minutes 30)).Repetition
# Čas spouštěče bez posunu zóny = místní čas. S posunem (+01:00 / +02:00), který se vytvoří sám, by se úloha
# po změně času o hodinu posunula (stalo se po 25. 10. 2026: běžela v 7:00 a 15:00–22:30).
$rano.StartBoundary = (Get-Date -Hour 8 -Minute 0 -Second 0).ToString('yyyy-MM-ddTHH:mm:ss')
$vecer.StartBoundary = (Get-Date -Hour 16 -Minute 0 -Second 0).ToString('yyyy-MM-ddTHH:mm:ss')

$nastaveni = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nazev -Action $akce -Trigger @($rano, $vecer) `
    -Settings $nastaveni -Description 'Stáhne tabulku Extraligy z hokej.cz a pošle změnu na GitHub (web tipovačky).' `
    -Force | Out-Null

Write-Output "Úloha '$nazev' nastavena: 8:00 a pak od 16:00 do 23:30 po půl hodině."
Write-Output ('Protokol běhů: ' + (Join-Path $PSScriptRoot 'aktualizace.log'))
