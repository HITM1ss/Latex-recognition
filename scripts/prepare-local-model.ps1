param(
  [string]$Python = "py",
  [string]$ModelRepo = "OleehyO/TexTeller"
)

$ErrorActionPreference = "Stop"
$destination = Resolve-Path (Join-Path $PSScriptRoot "..\src-tauri\resources") | Select-Object -ExpandProperty Path
$destination = Join-Path $destination "models\texteller"

Write-Output "Downloading TexTeller 3.0 weights from Hugging Face: $ModelRepo"
Write-Output "Destination: $destination"
New-Item -ItemType Directory -Path $destination -Force | Out-Null

& $Python -3.11 -c "from huggingface_hub import snapshot_download; snapshot_download('$ModelRepo', local_dir=r'$destination')"

if ($LASTEXITCODE -ne 0) {
  throw "Failed to download TexTeller model weights."
}

Write-Output "Prepared local TexTeller model: $destination"