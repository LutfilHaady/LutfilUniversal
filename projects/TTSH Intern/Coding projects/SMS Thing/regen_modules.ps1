$basePath = $PSScriptRoot

$modules = @(
    'MainMacro.bas',
    'Helpers.bas',
    'ConfigReader.bas',
    'CaseMatcher.bas',
    'BroadcastBuilder.bas',
    'FilePickerForm.bas',
    'ReviewForm.bas',
    'ProgressForm.bas'
)

$header = "============================================================`nMCAF-M SMS BROADCAST AUTOMATION - ALL MODULES`nCopy each section into a separate VBA module (or UserForm, per its`nIMPORT NOTE) in the VBA Editor. The module name is shown in the`nheader of each section.`n============================================================`n"

$output = $header

foreach ($mod in $modules) {
    $filePath = Join-Path $basePath $mod
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $separator = "`n`n============================================================`nMODULE: $mod`n============================================================`n`n"
        $output += $separator + $content
    } else {
        Write-Host "WARNING: $mod not found"
    }
}

$output += "`n`n"

$outPath = Join-Path $basePath 'SMS_Broadcast_All_Modules.txt'
$utf8NoBOM = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $output, $utf8NoBOM)
Write-Host "SMS_Broadcast_All_Modules.txt regenerated successfully"
$fileSize = (Get-Item $outPath).Length
Write-Host "Total size: $fileSize bytes"
