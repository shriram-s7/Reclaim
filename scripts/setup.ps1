$ErrorActionPreference = 'Stop'
$reclaimRoot = Split-Path $PSScriptRoot -Parent
Set-Location $reclaimRoot
if (-not (Test-Path '.venv/Scripts/python.exe')) {
  python -m venv .venv
  if ($LASTEXITCODE -ne 0) { throw 'Python virtual environment setup failed.' }
}
python -m pip --python .venv/Scripts/python.exe install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
Push-Location frontend
try {
  npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
& '.venv/Scripts/python.exe' samples/make_sample.py
if ($LASTEXITCODE -ne 0) { throw 'Sample generation failed.' }
