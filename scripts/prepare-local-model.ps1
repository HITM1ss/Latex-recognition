param(
  [string]$PythonRoot = "C:\Users\Admin\AppData\Local\Programs\Python\Python311"
)

$ErrorActionPreference = "Stop"
$source = Join-Path $PythonRoot "Lib\site-packages\pix2tex\model"
$destination = Join-Path $PSScriptRoot "..\src-tauri\resources\models\pix2tex\model"

if (-not (Test-Path -LiteralPath $source)) {
  throw "pix2tex model directory not found: $source. Install pix2tex in Python 3.11 first."
}

New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $source "settings") -Destination $destination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source "dataset") -Destination $destination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $source "checkpoints") -Destination $destination -Recurse -Force
Write-Output "Prepared local pix2tex model: $destination"
