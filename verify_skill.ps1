$BasePath = "D:\Download\scholar-agent-main\职业页"
$content = Get-Content -Path (Join-Path $BasePath "战士.html") -Raw -Encoding utf8
$parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'

# Show full part for w-starting-skill-3
foreach ($i in 1..($parts.Count-1)) {
    if ($parts[$i] -match 'id="w-starting-skill-3"') {
        Write-Host "Full part for w-starting-skill-3:"
        Write-Host $parts[$i]
        break
    }
}
