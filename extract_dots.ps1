$tmp = "$env:TEMP\docx_ext2"
$xml = Get-Content -LiteralPath "$tmp\word\document.xml" -Raw -Encoding UTF8
$tMatches = [regex]::Matches($xml, '<w:t[^>]*>([^<]*)</w:t>')
$texts = @()
foreach ($m in $tMatches) { $texts += $m.Groups[1].Value }
$full = $texts -join ''

# Find all dot-like characters
$dotChars = @{}
for ($i = 0; $i -lt $full.Length -and $dotChars.Count -lt 20; $i++) {
    $c = $full[$i]
    $code = [int]$c
    if ($code -gt 127 -and $code -ne 0x25CF -and $c -match '[^\p{IsCJKUnifiedIdeographs}\p{IsCJKSymbolsAndPunctuation}]' -eq $false) {
        # This might be our dot
    }
    if ($c -eq [char]0x25CF -or $c -eq [char]0x2022) {
        if (-not $dotChars.ContainsKey($code)) {
            $ctx = $full.Substring([Math]::Max(0, $i-5), [Math]::Min(20, $full.Length-[Math]::Max(0, $i-5)))
            $dotChars[$code] = $ctx
        }
    }
}

Write-Output "Found char codes:"
foreach ($k in $dotChars.Keys) { Write-Output "  U+$($k.ToString('X4')): $($dotChars[$k] -replace '\u000D','\r' -replace '\u000A','\n')" }

# Now extract sections with dots
$sections = $full -split '-------------------------------------------------------'
Write-Output "`nTotal sections: $($sections.Count)"
$i = 0
foreach ($s in $sections) {
    $t = $s.Trim()
    if ($t.Length -gt 0 -and $t -match '[\u25CF\u2022]') {
        $nameMatch = [regex]::Match($t, '^(.{2,30}?)前置条件')
        $name = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { "UNKNOWN-$i" }
        $dots = [regex]::Matches($t, '[\u25CF\u2022]+')
        $dotCounts = ($dots | ForEach-Object { $_.Length }) -join ','
        Write-Output "  $name :: dots=$dotCounts"
    }
    $i++
}
