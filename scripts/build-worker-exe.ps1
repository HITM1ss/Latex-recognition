# Build the Python formula worker as a standalone .exe (PyInstaller sidecar).
#
# Run from the repo root:
#   .\scripts\build-worker-exe.ps1
#
# Output: src-tauri\resources\worker-dist\formula-worker\formula-worker.exe
# (onedir layout - the whole folder is shipped inside the Tauri bundle and
#  located automatically by worker.rs, so end users never need Python.)
#
# Why PyInstaller over Nuitka: torch/transformers/tokenizers all ship mature
# hooks in pyinstaller-hooks-contrib (DLLs + data files auto-collected), which
# makes failures like "exe starts and exits instantly" far less likely.

param(
  [string]$Python = "py",
  [string]$Worker = "src-tauri\resources\formula_worker.py",
  [string]$OutDist = "src-tauri\resources\worker-dist"
)

$ErrorActionPreference = "Stop"
# PowerShell 7 会把原生命令（pip/python）的 stderr 输出视为 ErrorRecord，
# 这里显式关闭，避免成功运行的命令因警告被当作致命错误。
$PSNativeCommandUseErrorActionPreference = $false

Write-Output "==> Ensuring PyInstaller (dev dependency)"
& $Python -3.11 -m pip install -q pyinstaller

Write-Output "==> Building standalone worker exe (takes a while on first run)"
$buildDir = Join-Path $PSScriptRoot "..\build\worker-pyinst"
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

& $Python -3.11 -m PyInstaller `
  --noconfirm --clean `
  --distpath (Join-Path $buildDir "dist") `
  --workpath (Join-Path $buildDir "work") `
  --specpath (Join-Path $buildDir "spec") `
  --onedir `
  --name formula-worker `
  --collect-all texteller `
  --collect-all transformers `
  --collect-all tokenizers `
  --collect-all huggingface_hub `
  --collect-submodules torch `
  --collect-submodules torchvision `
  --hidden-import=torchvision.transforms.v2 `
  --hidden-import=regex `
  --hidden-import=safetensors `
  --hidden-import=typing_extensions `
  --hidden-import=certifi `
  --hidden-import=requests `
  --hidden-import=urllib3 `
  --hidden-import=PIL `
  $Worker

if ($LASTEXITCODE -ne 0) {
  throw "PyInstaller build failed."
}

$src = Join-Path $buildDir "dist\formula-worker"
$target = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\src-tauri")).Path "resources\worker-dist\formula-worker"
$targetParent = Split-Path $target -Parent
New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item $src $target -Recurse

$exe = Join-Path $target "formula-worker.exe"
$sizeB = (Get-ChildItem $target -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Output ""
Write-Output "Built: $exe"
Write-Output "Folder size: {0:N1} MB" -f ($sizeB / 1MB)
Write-Output "Runtime dependency on system Python: NONE (self-contained)."
Write-Output "Rust will prefer this sidecar automatically; keep AXIOM_FORMULA_WORKER_BIN unset."