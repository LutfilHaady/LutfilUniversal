$basePath = 'c:\Users\lutfi\OneDrive\Desktop\TTSH Intern\Coding projects\FC Masterlist VBA'

$modules = @(
    'Helpers.bas',
    'DesignationCleanup.bas',
    'ReshapeBuilder.bas',
    'PivotRepair.bas',
    'ColorCoding.bas',
    'MainMacro.bas'
)

$header = "============================================================`r`nFC MASTERLIST CLEANUP MACRO - ALL MODULES`r`nCopy each section into a separate VBA module in the VBA Editor.`r`nThe module name is shown in the header of each section.`r`n============================================================`r`n"

$output = $header

foreach ($mod in $modules) {
    $filePath = Join-Path $basePath $mod
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $separator = "`r`n`r`n============================================================`r`nMODULE: $mod`r`n============================================================`r`n`r`n"
        $output += $separator + $content
    } else {
        Write-Host "WARNING: $mod not found"
    }
}

$outPath = Join-Path $basePath 'FC_Masterlist_All_Modules.txt'
[System.IO.File]::WriteAllText($outPath, $output, [System.Text.Encoding]::UTF8)
Write-Host "FC_Masterlist_All_Modules.txt regenerated successfully"
$fileSize = (Get-Item $outPath).Length
Write-Host "Total size: $fileSize bytes"
