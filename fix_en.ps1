$path = 'C:\Users\Aleksander G\Desktop\tournament-organizer\src\i18n\en.ts'
$lines = Get-Content $path

$idx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "sailing\.not\.team.*No fleet racing, no match racing") { $idx = $i; break }
}
if ($idx -eq -1) { Write-Error 'Could not find sailing.not.team'; exit 1 }

$newKeys = @(
 ' // ---- sailing format meanings ----',
 "  'sailing.meaning.custom-regatta': 'Fully custom regatta with your own stages',",
 "  'sailing.example.custom-regatta': 'Your own stages, scoring and discard rules',",
 "  'sailing.for.custom-regatta': 'Non-standard regatta formats you define yourself',",
 "  'sailing.not.custom-regatta': 'No preset structure; you build every stage',",
 "  'sailing.meaning.flighted-racing': 'Fleet split into flights racing separate series',",
 "  'sailing.example.flighted-racing': '20 boats -> Gold/Silver flights -> separate series',",
 "  'sailing.for.flighted-racing': 'Large fleets split into parallel start groups',",
 "  'sailing.not.flighted-racing': 'No single fleet start, no medal race',",
 "  'sailing.meaning.group-stage-finals': 'Group stage followed by a finals bracket',",
 "  'sailing.example.group-stage-finals': '4 groups -> semifinals -> final',",
 "  'sailing.for.group-stage-finals': 'Large fleets split into groups, then knockout',",
 "  'sailing.not.group-stage-finals': 'No single fleet, no direct medal race',",
 "  'sailing.meaning.knockout': 'Single-elimination bracket of match races',",
 "  'sailing.example.knockout': '8 boats -> quarterfinals, semifinals, final',",
 "  'sailing.for.knockout': 'One-loss elimination series for a regatta',",
 "  'sailing.not.knockout': 'No fleet racing, no team racing, no round robin',",
 "  'sailing.meaning.medal-race': 'Qualifying series topped by a medal race',",
 "  'sailing.example.medal-race': 'Top 10 after qualifying -> one double-points decider',",
 "  'sailing.for.medal-race': 'Olympic-style series with a final medal race',",
 "  'sailing.not.medal-race': 'No group stage, no flights, no team racing',",
 "  'sailing.meaning.round-robin': 'Every boat races every other boat once',",
 "  'sailing.example.round-robin': '8 boats -> everyone races everyone once',",
 "  'sailing.for.round-robin': 'Small fleets where every boat should meet every other',",
 "  'sailing.not.round-robin': 'No knockout, no medal race, no flights',",
)

$newLines = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $lines.Count; $i++) {
    $newLines.Add($lines[$i])
    if ($i -eq $idx) {
        foreach ($k in $newKeys) { $newLines.Add($k) }
    }
}

$commentIdx = -1
for ($i = 0; $i -lt $newLines.Count; $i++) {
    if ($newLines[$i] -match 'sailing format meanings') { $commentIdx = $i; break }
}
if ($commentIdx -ge 0) {
    $newLines[$commentIdx] = '  // ---- sailing format meanings ----'
}

Set-Content -Path $path -Value $newLines
Write-Output ('Done. Total lines: ' + $newLines.Count)
