$cli = Join-Path (Split-Path $PSScriptRoot) 'snode.cmd'
$previousMachine = $env:SNODE_CLI_MACHINE
try {
  $env:SNODE_CLI_MACHINE = '1'
  $lines = & $cli @args 2>&1
  $code = $LASTEXITCODE
} finally {
  if ($null -eq $previousMachine) { Remove-Item Env:SNODE_CLI_MACHINE -ErrorAction SilentlyContinue }
  else { $env:SNODE_CLI_MACHINE = $previousMachine }
}
$raw = ($lines | ForEach-Object { $_.ToString() }) -join "`n"

if ($raw) {
  try {
    $value = ConvertFrom-Json -InputObject $raw -ErrorAction Stop
    if ($raw.TrimStart().StartsWith('[')) {
      $display = ConvertTo-Json -InputObject @($value) -Depth 100
    } else {
      $display = ConvertTo-Json -InputObject $value -Depth 100
    }
  } catch {
    $display = $raw
  }
  if ($code -eq 0) { Write-Output $display }
  else { [Console]::Error.WriteLine($display) }
}

exit $code
