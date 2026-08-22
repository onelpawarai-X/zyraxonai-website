# ZYRAXON Agent Engine — ensures a shell runtime exists on this deployment runner.
# Windows runners get PowerShell 7 (pwsh) installed automatically if missing.
# Linux/macOS runners already ship bash — nothing to do.

$ErrorActionPreference = 'Stop'

function Test-Pwsh { try { $null = & pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'; return ($LASTEXITCODE -eq 0) } catch { return $false } }

if (Test-Pwsh) {
    Write-Host "[engine] pwsh already available:" (& pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()')
    exit 0
}

if ($env:RUNNER_OS -eq 'Linux' -or (Get-Platform -ErrorAction SilentlyContinue) -or $IsLinux) {
    Write-Host '[engine] Linux runner detected — bash is preinstalled, nothing to set up.'
    exit 0
}

Write-Host '[engine] Installing PowerShell 7 for the ZYRAXON Agent Engine...'

$installed = $false
try {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host '[engine] via winget...'
        & winget install --id Microsoft.PowerShell --source winget --accept-package-agreements --accept-source-agreements --silent
        $installed = $true
    }
} catch { Write-Warning "winget failed: $_" }

if (-not $installed) {
    try {
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Host '[engine] via chocolatey...'
            & choco install powershell-core -y --no-progress
            $installed = $true
        }
    } catch { Write-Warning "choco failed: $_" }
}

if (-not $installed) {
    Write-Host '[engine] via MSI direct download...'
    $msi = Join-Path $env:TEMP 'PowerShell-7-latest-win-x64.msi'
    Invoke-WebRequest -Uri 'https://github.com/PowerShell/PowerShell/releases/latest/download/PowerShell-7.4.6-win-x64.msi' -OutFile $msi -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn ADD_EXPLORER_CONTEXT_MENU_OPENPOWERSHELL=0 REGISTER_MANIFEST=1" -Wait
}

if (Test-Pwsh) {
    Write-Host '[engine] SUCCESS — ZYRAXON Agent Engine runtime ready.'
    exit 0
}

Write-Host '[engine] pwsh not on PATH yet; the built-in fallback (Windows PowerShell 5.1 / bash) will still work.'
exit 0
