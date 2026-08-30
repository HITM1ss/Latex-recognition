$ErrorActionPreference = "Stop"
$worker = Join-Path $PSScriptRoot "..\src-tauri\resources\formula_worker.py"
$env:NO_ALBUMENTATIONS_UPDATE = "1"
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
& py -3.11 $worker
