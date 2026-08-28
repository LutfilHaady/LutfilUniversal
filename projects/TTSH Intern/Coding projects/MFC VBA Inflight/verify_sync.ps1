# Extract modules from MFC_All_Modules.txt and compare with .bas files

$concatFile = "MFC_All_Modules.txt"
$modules = @("MainMacro", "Helpers", "CombineEFC", "ExtractDate", "FilterFCStatus", "EpicLookup", "FilterDischarge", "FilterWard", "FlagDuplicates", "BuildOutput", "OutputWriter", "Backlog", "SummaryTable", "Dropdowns", "FilePickerForm", "ProgressForm")

$modulesModified = @("CombineEFC", "FlagDuplicates", "FilterWard", "Backlog", "MainMacro", "EpicLookup", "FilterFCStatus", "FilterDischarge", "Helpers")

$lineMap = @{
    "MainMacro" = @(1, 149)
    "Helpers" = @(150, 449)
    "ConfigReader" = @(450, 781)
    "CombineEFC" = @(782, 822)
    "ExtractDate" = @(823, 947)
    "FilterFCStatus" = @(948, 1085)
    "EpicLookup" = @(1086, 1206)
    "FilterDischarge" = @(1207, 1320)
    "FilterWard" = @(1321, 1512)
    "FlagDuplicates" = @(1513, 1611)
    "BuildOutput" = @(1612, 1846)
    "OutputWriter" = @(1847, 1959)
    "Backlog" = @(1960, 2171)
    "SummaryTable" = @(2172, 2266)
    "Dropdowns" = @(2267, 2438)
    "FilePickerForm" = @(2439, 2768)
    "ProgressForm" = @(2769, 2860)
}

$results = @()

foreach ($module in $modulesModified) {
    $basFile = "$module.bas"
    
    if (-not (Test-Path $basFile)) {
        $results += "$module.bas: FILE_NOT_FOUND"
        continue
    }
    
    $lines = $lineMap[$module]
    $startLine = $lines[0]
    $endLine = $lines[1]
    
    # Extract module from concat file
    $concatContent = Get-Content $concatFile | Select-Object -First $endLine | Select-Object -Skip ($startLine - 1)
    $concatText = $concatContent -join "`n"
    
    # Read .bas file
    $basContent = Get-Content $basFile -Raw
    
    # Normalize line endings
    $concatNorm = $concatText -replace "`r`n", "`n"
    $basNorm = $basContent -replace "`r`n", "`n"
    
    if ($concatNorm -eq $basNorm) {
        $results += "$module.bas: MATCH"
    } else {
        $results += "$module.bas: MISMATCH"
    }
}

$results | ForEach-Object { Write-Host $_ }
