param(
    [string]$BasePath = "D:\Download\scholar-agent-main\职业页"
)

$ErrorActionPreference = "Stop"
$files = Get-ChildItem -Path $BasePath -Filter "*.html" | Where-Object { $_.Name -ne "萨满祭司.html" } | Sort-Object Name

$grandTotal = 0
$allResults = @()
$fileCounts = @{}

foreach ($file in $files) {
    $fileName = $file.Name
    $content = Get-Content -Path $file.FullName -Raw -Encoding utf8
    $fileResults = @()
    
    $parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'
    
    foreach ($part in $parts) {
        if ($part -notmatch '<article\s+class="skill.*?id="([^"]*)"\s+data-search="([^"]*)"') {
            continue
        }
        
        $skillId = $matches[1]
        if ([string]::IsNullOrWhiteSpace($skillId)) {
            continue
        }
        $dataSearchRaw = $matches[2]
        
        if ($part -notmatch '<span class="field">施展时间：</span>([^<]+)</p>') {
            continue
        }
        $visibleCastTime = $matches[1].Trim()
        
        $dataSearchCastTime = $null
        
        if ($dataSearchRaw -match '施展时间：([^ ]+?)(?:\s|$)') {
            $dataSearchCastTime = $matches[1].Trim()
        } else {
            $tokens = $dataSearchRaw -split '\s+'
            foreach ($token in $tokens) {
                $token = $token.Trim()
                if ($token -match '^(\d+动作|0动作|附赠动作|主要动作|反应动作|\d+分钟|\d+小时)$') {
                    $dataSearchCastTime = $token
                    break
                }
            }
        }
        
        if ($dataSearchCastTime -eq $null) {
            $fileResults += [PSCustomObject]@{
                File = $fileName
                SkillId = $skillId
                DataSearch = "[MISSING]"
                Visible = $visibleCastTime
            }
            $grandTotal++
        }
        elseif ($dataSearchCastTime -ne $visibleCastTime) {
            $fileResults += [PSCustomObject]@{
                File = $fileName
                SkillId = $skillId
                DataSearch = $dataSearchCastTime
                Visible = $visibleCastTime
            }
            $grandTotal++
        }
    }
    
    if ($fileResults.Count -gt 0) {
        $allResults += $fileResults
        $fileCounts[$fileName] = $fileResults.Count
    }
}

$currentFile = ""
foreach ($r in $allResults | Sort-Object File, SkillId) {
    if ($r.File -ne $currentFile) {
        if ($currentFile -ne "") { Write-Host "" }
        $currentFile = $r.File
        $cnt = $fileCounts[$currentFile]
        $label = "FILE: " + $currentFile + "  (" + $cnt + " mismatches)"
        Write-Host ("=" * 60)
        Write-Host $label
        Write-Host ("=" * 60)
    }
    if ($r.DataSearch -eq "[MISSING]") {
        $line = "  " + $r.SkillId + ": data-search=[MISSING] vs HTML=`"" + $r.Visible + "`""
        Write-Host $line
    } else {
        $line = "  " + $r.SkillId + ": data-search=`"" + $r.DataSearch + "`" vs HTML=`"" + $r.Visible + "`""
        Write-Host $line
    }
}

Write-Host ""
Write-Host ("=" * 60)
Write-Host "SUMMARY BY FILE:"
Write-Host ("=" * 60)
foreach ($f in ($allResults | Sort-Object File | Select-Object -ExpandProperty File -Unique)) {
    $cnt = $fileCounts[$f]
    Write-Host ("  " + $f + ": " + $cnt)
}
Write-Host ""
Write-Host ("=" * 60)
Write-Host ("GRAND TOTAL: " + $grandTotal + " mismatches found across " + $fileCounts.Count + " files")
Write-Host ("=" * 60)
