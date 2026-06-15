$BasePath = "D:\Download\scholar-agent-main\职业页"
$files = @("战士.html", "蛮斗士.html", "武僧.html", "德鲁伊.html", "圣骑士.html", "魔契师.html")
foreach ($fname in $files) {
    $content = Get-Content -Path (Join-Path $BasePath $fname) -Raw
    $parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'
    $totalSkills = 0
    $skillsWithTime = 0
    $dataSearchFound = 0
    $mismatches = 0
    $matches = 0
    
    foreach ($part in $parts) {
        if ($part -notmatch '<article\s+class="skill.*?id="([^"]*)"\s+data-search="([^"]*)"') {
            continue
        }
        $totalSkills++
        $skillId = $matches[1]
        $dataSearchRaw = $matches[2]
        
        if ($part -match '<span class="field">施展时间：</span>([^<]+)</p>') {
            $skillsWithTime++
            $visibleCastTime = $matches[1].Trim()
            
            $dataSearchCastTime = $null
            if ($dataSearchRaw -match '施展时间：([^ ]+?)(?:\s|$)') {
                $dataSearchCastTime = $matches[1].Trim()
                $dataSearchFound++
            } else {
                $tokens = $dataSearchRaw -split '\s+'
                foreach ($token in $tokens) {
                    if ($token -match '^(\d+动作|0动作|附赠动作|主要动作|反应动作|\d+分钟|\d+小时)$') {
                        $dataSearchCastTime = $token
                        $dataSearchFound++
                        break
                    }
                }
            }
            
            if ($dataSearchCastTime -eq $null) {
                Write-Host "$fname - $skillId`: MISSING in data-search, HTML='$visibleCastTime'"
                $mismatches++
            } elseif ($dataSearchCastTime -ne $visibleCastTime) {
                Write-Host "$fname - $skillId`: data-search='$dataSearchCastTime' vs HTML='$visibleCastTime'"
                $mismatches++
            } else {
                $matches++
            }
        }
    }
    Write-Host "$fname summary`: skills=$totalSkills, withTime=$skillsWithTime, dataSearchFound=$dataSearchFound, matches=$matches, mismatches=$mismatches"
    Write-Host ""
}
