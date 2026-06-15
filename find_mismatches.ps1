param(
    [string]$BasePath = "D:\Download\scholar-agent-main\职业页"
)

$ErrorActionPreference = "Stop"
$files = Get-ChildItem -Path $BasePath -Filter "*.html" | Where-Object { $_.Name -ne "萨满祭司.html" } | Sort-Object Name

$grandTotal = 0
$allResults = @()

foreach ($file in $files) {
    $fileName = $file.Name
    $content = Get-Content -Path $file.FullName -Raw
    $fileResults = @()
    
    # Split by <article class="skill" to get individual skill blocks
    $parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'
    
    foreach ($part in $parts) {
        # Skip non-skill parts (first part is usually before the first skill)
        if ($part -notmatch '<article\s+class="skill.*?id="([^"]*)"\s+data-search="([^"]*)"') {
            continue
        }
        
        $skillId = $matches[1]
        $dataSearchRaw = $matches[2]
        
        # Check if visible HTML has 施展时间 field
        if ($part -notmatch '<span class="field">施展时间：</span>([^<]+)</p>') {
            continue  # Skip talent-type skills without visible 施展时间
        }
        $visibleCastTime = $matches[1].Trim()
        
        # Extract 施展时间 from data-search
        $dataSearchCastTime = $null
        
        # Strategy 1: Look for "施展时间：VALUE" pattern (old verbose format)
        if ($dataSearchRaw -match '施展时间：([^ ]+?)(?:\s|$)') {
            $dataSearchCastTime = $matches[1].Trim()
        }
        # Strategy 2: Look for compact format - find first token matching casting time pattern
        else {
            # Split data-search into tokens
            $tokens = $dataSearchRaw -split '\s+'
            foreach ($token in $tokens) {
                $token = $token.Trim()
                if ($token -match '^(\d+动作|0动作|附赠动作|主要动作|反应动作|\d+分钟|\d+小时)$') {
                    $dataSearchCastTime = $token
                    break
                }
            }
        }
        
        # Compare
        if ($dataSearchCastTime -eq $null) {
            # If visible has 施展时间 but data-search doesn't
            $fileResults += [PSCustomObject]@{
                File = $fileName
                SkillId = $skillId
                DataSearch = "MISSING (not found in data-search)"
                Visible = $visibleCastTime
                MatchType = "MISSING"
            }
            $grandTotal++
        }
        elseif ($dataSearchCastTime -ne $visibleCastTime) {
            $fileResults += [PSCustomObject]@{
                File = $fileName
                SkillId = $skillId
                DataSearch = $dataSearchCastTime
                Visible = $visibleCastTime
                MatchType = "MISMATCH"
            }
            $grandTotal++
        }
        # else: they match, skip
    }
    
    if ($fileResults.Count -gt 0) {
        $allResults += $fileResults
    }
}

# Output results grouped by file
$currentFile = ""
foreach ($r in $allResults | Sort-Object File, SkillId) {
    if ($r.File -ne $currentFile) {
        if ($currentFile -ne "") { Write-Host "" }
        $currentFile = $r.File
        $countInFile = @($allResults | Where-Object { $_.File -eq $currentFile }).Count
        Write-Host "FILE: $currentFile ($countInFile mismatches)"
    }
    if ($r.MatchType -eq "MISSING") {
        Write-Host "  $($r.SkillId): data-search=[MISSING] vs HTML=`"$($r.Visible)`""
    } else {
        Write-Host "  $($r.SkillId): data-search=`"$($r.DataSearch)`" vs HTML=`"$($r.Visible)`""
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "GRAND TOTAL: $grandTotal mismatches found"
Write-Host "========================================"
