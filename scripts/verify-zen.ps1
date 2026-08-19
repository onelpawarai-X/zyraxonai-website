param(
  [string]$Model = 'big-pickle'
)

if (-not $env:OPENCODE_ZEN_API_KEY -and -not $env:OPENCODE_API_KEY) {
  Write-Error 'Set OPENCODE_ZEN_API_KEY (or OPENCODE_API_KEY) before running this test.'
  exit 2
}

$env:ZEN_MODEL = $Model
node "$PSScriptRoot/verify-zen.mjs"
exit $LASTEXITCODE
