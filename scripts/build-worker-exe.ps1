# Build the Python formula worker as a standalone .exe (Nuitka sidecar).

# Run from the repo root:
#   .\scripts\build-worker-exe.ps1
#
# The produced exe can be pointed to via AXIOM_FORMULA_WORKER_BIN so the
# Rust side never touches a system Python. Note: bundling torch against
# Nuitka is heavy (multi-GB output, long build time); run it on a release
# machine and commit nothing to git.

param(
  [string]$Python = "py",
  [string]$Worker = "src-tauri\resources\formula_worker.py",
  [string]$OutDir = "dist\worker"
)

$ErrorActionPreference = "Stop"

Write-Output "==> Installing Nuitka (dev dependency)"
& $Python -3.11 -m pip install nuitka 2>$null

Write-Output "==> Building standalone worker exe (this takes a while on first run)"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
& $Python -3.11 -m nuitka `
  --standalone `
  --windows-console-mode=disable `
  --output-dir=$OutDir `
  --output-filename=formula-worker.exe `
  $Worker

if ($LASTEXITCODE -ne 0) {
  throw "Nuitka build failed."
}

$exe = Join-Path $OutDir "formula-worker.dist\formula-worker.exe"
Write-Output ""
Write-Output "Built: $(Resolve-Path $exe)"
Write-Output "Usage in the app:"
Write-Output "  `$env:AXIOM_FORMULA_WORKER_BIN = '$(Resolve-Path $exe)'"
Write-Output ""
Write-Output "Tip: ship the .dist folder next to your installer and set"
Write-Output "AXIOM_FORMULA_WORKER_BIN to the bundled exe path at launch."