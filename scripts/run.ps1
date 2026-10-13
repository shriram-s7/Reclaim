$ErrorActionPreference = 'Stop'
$reclaimRoot = Split-Path $PSScriptRoot -Parent
Set-Location $reclaimRoot
if (-not (Test-Path '.venv/Scripts/python.exe')) { throw 'Run scripts/setup.ps1 first.' }
if (-not (Test-Path 'frontend/dist/index.html')) { throw 'Build the frontend first: cd frontend; npm run build' }
Write-Host 'Reclaim local demo: http://127.0.0.1:8000'
& '.venv/Scripts/python.exe' -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
