$files = @(
    "BuildOutput.bas",
    "MainMacro.bas",
    "Helpers.bas",
    "EpicLookup.bas",
    "FilterFCStatus.bas",
    "FilterBedCode.bas",
    "ExtractDate.bas",
    "FlagDuplicates.bas",
    "CombineEFC.bas"
)

foreach ($name in $files) {
    $path = Join-Path $PSScriptRoot $name
    if (Test-Path $path) {
        $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        # Use string Replace for multi-char replacements
        $c = $c.Replace([string][char]0x2014, "--")   # em dash -> --
        $c = $c.Replace([string][char]0x2013, "-")    # en dash -> -
        $c = $c.Replace([string][char]0x2018, "'")    # left single quote
        $c = $c.Replace([string][char]0x2019, "'")    # right single quote
        $c = $c.Replace([string][char]0x201C, '"')    # left double quote
        $c = $c.Replace([string][char]0x201D, '"')    # right double quote
        $c = $c.Replace([string][char]0x2192, "->")   # right arrow
        $c = $c.Replace([string][char]0x00D7, "x")    # multiplication sign
        [System.IO.File]::WriteAllText($path, $c, [System.Text.Encoding]::GetEncoding(1252))
        Write-Host "Fixed: $name"
    }
}
Write-Host "Done."
