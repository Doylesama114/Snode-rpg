$BasePath = "D:\Download\scholar-agent-main\职业页"
$fname = "战士.html"
$content = Get-Content -Path (Join-Path $BasePath $fname) -Raw -Encoding utf8
$parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'

foreach ($i in 1..($parts.Count-1)) {
    $part = $parts[$i]
    if ($part -match '<article\s+class="skill.*?id="([^"]*)"\s+data-search="([^"]*)"') {
        $skillId = $matches[1]
        if ($skillId -eq "") {
            Write-Host ("Part " + $i + ": EMPTY skill ID")
            Write-Host ("First 200 chars: " + $part.Substring(0, [Math]::Min(200, $part.Length)))
            Write-Host ""
        }
    }
}

# Find and show starting-skill-3
foreach ($i in 1..($parts.Count-1)) {
    if ($parts[$i] -match 'id="w-starting-skill-3"') {
        Write-Host ("Part " + $i + " contains w-starting-skill-3")
        $m = [regex]::Match($parts[$i], '<span class="field">施展时间：</span>([^<]+)</p>')
        if ($m.Success) {
            Write-Host ("Visible 施展时间: " + $m.Groups[1].Value)
        }
        $m2 = [regex]::Match($parts[$i], '施展时间：([^ ]+?)(?:\s|$)')
        if ($m2.Success) {
            Write-Host ("Data-search 施展时间: " + $m2.Groups[1].Value)
        }
        break
    }
}
