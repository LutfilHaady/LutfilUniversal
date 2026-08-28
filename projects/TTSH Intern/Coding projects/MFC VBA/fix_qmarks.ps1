$files = Get-ChildItem "$PSScriptRoot\*.bas"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::GetEncoding(1252))
    if ($c.Contains("?")) {
        # Only replace ? that appear in comment lines (lines starting with ' after optional whitespace)
        $lines = $c -split "`r`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $trimmed = $lines[$i].TrimStart()
            if ($trimmed.StartsWith("'") -and $lines[$i].Contains("?")) {
                $lines[$i] = $lines[$i].Replace("?", "--")
            }
        }
        $c = $lines -join "`r`n"
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::GetEncoding(1252))
        Write-Host "Fixed: $($f.Name)"
    }
}
Write-Host "Done."
