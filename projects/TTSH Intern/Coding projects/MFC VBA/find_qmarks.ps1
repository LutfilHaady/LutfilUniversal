$files = Get-ChildItem "$PSScriptRoot\*.bas"
foreach ($f in $files) {
    $hits = Select-String -Path $f.FullName -Pattern '\?'
    if ($hits) {
        Write-Host $f.Name
        foreach ($h in $hits) {
            Write-Host ("  L" + $h.LineNumber + ": " + $h.Line.Trim())
        }
    }
}
