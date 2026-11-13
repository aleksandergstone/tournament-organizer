$baseDir = "C:\Users\Aleksander G\Desktop\tournament-organizer\src\i18n"
$langs = @("en", "pl", "de", "es")

# Keys to remove (duplicates I accidentally added - keep the originals)
$keysToRemove = @("'format.round-robin':", "'format.example.round-robin':", "'format.for.round-robin':", "'format.not.round-robin':", "'format.meaning.round-robin':")

# Sailing format keys: key -> (en, pl, de, es)
$sailingKeys = @{
    "sailing.meaning.round-robin" = @("Every boat races every other boat once", "Każda łódź ściga się z każdą inną raz", "Jedes Boot segelt gegen jedes andere einmal", "Cada barco navega contra cada otro una vez");
    "sailing.example.round-robin" = @("8 boats -> everyone races everyone once", "8 łodzi -> każda ściga się z każdą raz", "8 Boote -> jedes Boot segelt gegen jedes einmal", "8 barcos -> cada barco navega contra cada uno una vez");
    "sailing.for.round-robin" = @("Small fleets where every boat should meet every other", "Mniejsze floty, gdzie każda łódź powinna spotkać każdą drugą", "Kleinere Flotten, in denen jedes Boot jedes andere treffen sollte", "Flotas pequeñas donde cada barco debería encontrarse con todos los demás");
    "sailing.not.round-robin" = @("No knockout, no medal race, no flights", "Brak finału, brak wyścigu medalowego, brak lotów", "Kein Finale, kein Medal-Rennen, keine Flights", "Sin final, sin regata de medalla, sin vuelos");
    "sailing.meaning.knockout" = @("Single-elimination bracket of match races", "Drabinka eliminacyjna wyścigów pojedynkowych", "Einzel-Eliminations-Bracket für Match-Rennen", "Bracket de eliminación simple de regatas individuales");
    "sailing.example.knockout" = @("8 boats -> quarterfinals, semifinals, final", "8 łodzi -> ćwierćfinały, półfinały, finał", "8 Boote -> Viertelfinale, Halbfinale, Finale", "8 barcos -> cuartos de final, semifinales, final");
    "sailing.for.knockout" = @("One-loss elimination series for a regatta", "Serie wyścigów eliminacyjnych z jedną porażką", "Einzel-Eliminationsserie für eine Regatta", "Serie de eliminación a un solo golpe para una regata");
    "sailing.not.knockout" = @("No fleet racing, no team racing, no round robin", "Brak wyścigów floty, brak team racingu, brak każdy z każdym", "Keine Flottenrennen, kein Team-Racing, kein Jeder-gegen-jeden", "Sin regata de flota, sin regata por equipos, sin todos contra todos");
    "sailing.meaning.group-stage-finals" = @("Group stage followed by a finals bracket", "Faza grupowa po której następuje drabinka finałowa", "Gruppenphase gefolgt von einem Final-Bracket", "Fase de grupos seguida por un bracket de finales");
    "sailing.example.group-stage-finals" = @("4 groups -> semifinals -> final", "4 grupy -> półfinały -> finał", "4 Gruppen -> Halbfinale -> Finale", "4 grupos -> semifinales -> final");
    "sailing.for.group-stage-finals" = @("Large fleets split into groups, then knockout", "Duże floty podzielone na grupy, potem drabinka", "Große Flotten in Gruppen aufgeteilt, dann K.-o.", "Flotas grandes divididas en grupos, luego eliminatoria");
    "sailing.not.group-stage-finals" = @("No single fleet, no direct medal race", "Brak jednej floty, brak bezpośredniego finału", "Keine einzelne Flotte, kein direktes Finale", "Sin flota única, sin final directo");
    "sailing.meaning.flighted-racing" = @("Fleet split into flights racing separate series", "Flota podzielona na łęgi ścigające osobne serie", "Flotte in Flights aufgeteilt, die separate Serien segeln", "Flota dividida en vuelos que navegan series separadas");
    "sailing.example.flighted-racing" = @("20 boats -> Gold/Silver flights -> separate series", "20 łodzi -> loty Złoto/Srebro -> osobne serie", "20 Boote -> Gold/Silber-Flights -> separate Serien", "20 barcos -> vuelos Oro/Plata -> series separadas");
    "sailing.for.flighted-racing" = @("Large fleets split into parallel start groups", "Duże floty podzielone na równoległe grupy startowe", "Große Flotten in parallele Startgruppen aufgeteilt", "Flotas grandes divididas en grupos de inicio paralelos");
    "sailing.not.flighted-racing" = @("No single fleet start, no medal race", "Brak jednego startu floty, brak wyścigu medalowego", "Kein einzelner Flottenstart, kein Medal-Rennen", "Sin inicio de flota único, sin regata de medalla");
    "sailing.meaning.medal-race" = @("Qualifying series topped by a medal race", "Kwalifikacyjna seria zwieńczona wyścigiem medalowym", "Qualifikationsserie gekrönt durch ein Medal-Rennen", "Serie de clasificación coronada por una regata de medalla");
    "sailing.example.medal-race" = @("Top 10 after qualifying -> one double-points decider", "Najlepsze 10 po kwalifikacjach -> jeden podwójnie punktowany finał", "Top 10 nach Qualifikation -> ein doppelt gepunktetes Entscheidungssrennen", "Top 10 después de clasificación -> una final de doble puntuación");
    "sailing.for.medal-race" = @("Olympic-style series with a final medal race", "Seria w stylu olimpijskim z finałowym wyścigiem medalowym", "Olympia-Stil Serie mit einem finalen Medal-Rennen", "Serie al estilo olímpico con una regata de medalla final");
    "sailing.not.medal-race" = @("No group stage, no flights, no team racing", "Brak fazy grupowej, brak lotów, brak team racingu", "Keine Gruppenphase, keine Flights, kein Team-Racing", "Sin fase de grupos, sin vuelos, sin regata por equipos");
    "sailing.meaning.custom-regatta" = @("Fully custom regatta with your own stages", "W pełni niestandardowa regata z własnymi etapami", "Vollkommen individuelle Regatta mit eigenen Stufen", "Regata completamente personalizada con tus propias etapas");
    "sailing.example.custom-regatta" = @("Your own stages, scoring and discard rules", "Własne etapy, punktowanie i zasady odrzutek", "Eigene Stufen, Bewertung und Streichregeln", "Tus propias etapas, puntuación y reglas de descarte");
    "sailing.for.custom-regatta" = @("Non-standard regatta formats you define yourself", "Nienormatywne formaty regat definiowane przez organizatora", "Non-Standard Regattaformate, die Sie selbst definieren", "Formatos de regata no estándar que tú defines");
    "sailing.not.custom-regatta" = @("No preset structure; you build every stage", "Brak presetowanej struktury; budujesz każdy etap sam", "Kein Preset-Struktur; Sie bauen jede Stufe selbst", "Sin estructura preestablecida; tú construyes cada etapa");
}

foreach ($lang in $langs) {
    $path = "$baseDir\$lang.ts"
    $content = Get-Content $path
    
    # Remove duplicate keys
    $newContent = $content | Where-Object {
        $shouldRemove = $false
        foreach ($k in $keysToRemove) {
            if ($_ -match [regex]::Escape($k)) { $shouldRemove = $true }
        }
        -not $shouldRemove
    }
    
    # Find insert point after preset.unseededKnockout.why
    $insertIdx = -1
    for ($i = $newContent.Length - 1; $i -ge 0; $i--) {
        if ($newContent[$i] -match "preset\.unseededKnockout\.why") {
            $insertIdx = $i + 1
            break
        }
    }
    
    if ($insertIdx -eq -1) {
        Write-Host "$lang: Could not find insert point"
        continue
    }
    
    # Build sailing key lines
    $langIndex = $langs.IndexOf($lang)
    $sailingLines = @("  // ---- sailing format meanings --------------------------------------------")
    foreach ($kv in $sailingKeys.GetEnumerator()) {
        $key = $kv.Key
        $value = $kv.Value[$langIndex]
        $escaped = $value.Replace("'", "\'").Replace("\", "\\")
        $sailingLines += "  '$key': '$escaped',"
    }
    
    # Insert sailing keys
    $finalContent = ($newContent[0..($insertIdx-1)] + $sailingLines + $newContent[$insertIdx..($newContent.Length-1)])
    Set-Content -Path $path -Value $finalContent -Encoding UTF8
    Write-Host "$lang: Fixed duplicates and added sailing keys"
}

Write-Host "Done!"
