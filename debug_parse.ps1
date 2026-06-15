$BasePath = "D:\Download\scholar-agent-main\职业页"
$fname = "战士.html"
$content = Get-Content -Path (Join-Path $BasePath $fname) -Raw

$parts = $content -split '(?=<article\s+class="skill[^"]*"\s+id="[^"]*"\s+data-search=")'
Write-Host "Total parts after split: $($parts.Count)"

# Show first part length and first 500 chars
Write-Host "Part 0 length: $($parts[0].Length)"
Write-Host "Part 0 first 200 chars:"
Write-Host $parts[0].Substring(0, [Math]::Min(200, $parts[0].Length))

Write-Host "`n--- Part 1 length: $($parts[1].Length)"
Write-Host "Part 1 first 300 chars:"
Write-Host $parts[1].Substring(0, [Math]::Min(300, $parts[1].Length))

# Check if the data-search regex matches
if ($parts[1] -match '<article\s+class="skill.*?id="([^"]*)"\s+data-search="([^"]*)"') {
    Write-Host "`nRegex matched! id=$($matches[1])"
    Write-Host "data-search (first 100 chars)=$($matches[2].Substring(0, [Math]::Min(100, $matches[2].Length)))"
} else {
    Write-Host "`nRegex did NOT match on part 1"
}

# Check for visible 施展时间
if ($parts[1] -match '<span class="field">施展时间：</span>([^<]+)</p>') {
    Write-Host "Visible 施展 time regex matched! value='$($matches[1])'"
} else {
    Write-Host "Visible 施展 time regex did NOT match"
    
    # Let's search for it manually
    $idx = $parts[1].IndexOf("施展时间")
    if ($idx -ge 0) {
        Write-Host "Found '施展时间' at index $idx in part 1"
        Write-Host "Context: ...$($parts[1].Substring([Math]::Max(0,$idx-50), [Math]::Min(200, $parts[1].Length-$idx+50)))..."
    } else {
        Write-Host "'施展时间' not found in part 1"
    }
}
