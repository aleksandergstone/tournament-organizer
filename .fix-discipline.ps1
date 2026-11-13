$s = 'src/engine/discipline.ts'
$c = Get-Content $s -Raw
$c = $c -replace '
?
', '`n'
$l = $c -split '`n'
$a = @()
for ($i=0; $i -lt $l.Length; $i++) { if ($l[$i].Trim() -eq "id: 'sailing'") { $a += $i } }
if ($a.Count -gt 1) {
  $st = $a[1]; $en = $st
  while ($en -lt $l.Length -and $l[$en].Trim() -ne '],') { $en++ }
  $r = @()
  for ($i=0; $i -lt $l.Length; $i++) { if ($i -ge $st -and $i -le $en) { continue } $r += $l[$i] }
  $c = $r -join '`n'
  $c = $c -replace '``n', '`n'
  $c -replace '
?
', "`r`n" | Set-Content $s -Encoding utf8
  Write-OUTPUT "Removed duplicate sailing block from line $st to $en"
}
