$basePath = $PSScriptRoot

$modules = @(
    'MainMacro.bas',
    'Helpers.bas',
    'PunchParser.bas',
    'ReportBuilder.bas',
    'FilePickerForm.bas',
    'ProgressForm.bas'
)

$header = "============================================================`r`nATTENDANCE REPORT MACRO - ALL MODULES`r`nCopy each section into a separate VBA module (or UserForm, per its`r`nIMPORT NOTE) in the VBA Editor. The module name is shown in the`r`nheader of each section.`r`n============================================================`r`n"

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

$outPath = Join-Path $basePath 'Attendance_All_Modules.txt'
[System.IO.File]::WriteAllText($outPath, $output, [System.Text.Encoding]::UTF8)
Write-Host "Attendance_All_Modules.txt regenerated successfully"
$fileSize = (Get-Item $outPath).Length
Write-Host "Total size: $fileSize bytes"
