$ErrorActionPreference = 'Stop'
$reclaimRoot = Split-Path $PSScriptRoot -Parent
Set-Location $reclaimRoot
New-Item -ItemType Directory -Force tmp | Out-Null
& '.venv/Scripts/python.exe' -m pytest backend/tests -q --basetemp=tmp/pytest-verify
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
Push-Location frontend
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
