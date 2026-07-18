$ErrorActionPreference = "Stop"

function Find-CommandPath {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    return $null
}

$npmPath = Find-CommandPath @("npm.cmd", "npm")

if (-not $npmPath) {
    Write-Error "npm was not found on PATH. Install Node.js from https://nodejs.org/ and rerun this script."
}

Write-Host "Using npm at: $npmPath"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    & $npmPath install
}

Write-Host "Building Windows executable..."
& $npmPath run make:exe

Write-Host ""
Write-Host "Done. Your executable files are in the .\release folder."
