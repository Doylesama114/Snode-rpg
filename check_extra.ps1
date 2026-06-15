$BasePath = "D:\Download\scholar-agent-main\职业页"

# Check remaining files not yet covered
$extraFiles = @("特殊专长.html", "通用·进阶.html", "首页.html") + 
    (Get-ChildItem -Path $BasePath -Filter "*·进阶.html" | ForEach-Object { $_.Name })

foreach ($fname in $extraFiles) {
    $content = Get-Content -Path (Join-Path $BasePath $fname) -Raw -Encoding utf8
    
    # Check if there are ANY spans with 施展时间
    $hasVisible = $content -match '<span class="field">施展时间：</span>'
    $hasDataSearch = $content -match "data-search"
    
    Write-Host "$fname`: visible 施展时间=$hasVisible, has data-search=$hasDataSearch, size=$($content.Length)"
}
