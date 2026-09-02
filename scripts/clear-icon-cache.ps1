# 一键刷新 Windows 图标缓存（彻底版）
# 用法：右键此文件 -> 使用 PowerShell 运行
# 说明：关闭并重启资源管理器，删除 iconcache/thumbcache/IconCache.db，
#       最后用 ie4uinit 强制刷新，使 exe/快捷方式图标在所有视图下重新从源文件提取。

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==> 关闭资源管理器..."
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 1

$cacheDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Explorer"

Write-Host "==> 删除图标缓存数据库 (iconcache_*)..."
Get-ChildItem $cacheDir -Filter "iconcache_*" -File | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host ("    已删除: " + $_.Name)
}

Write-Host "==> 删除缩略图缓存数据库 (thumbcache_*)..."
Get-ChildItem $cacheDir -Filter "thumbcache_*" -File | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host ("    已删除: " + $_.Name)
}

Write-Host "==> 删除遗留的 IconCache.db..."
$legacyDbs = @(
    (Join-Path $env:LOCALAPPDATA "IconCache.db"),
    (Join-Path $env:USERPROFILE "IconCache.db")
)
foreach ($db in $legacyDbs) {
    if (Test-Path $db) {
        Remove-Item $db -Force
        Write-Host ("    已删除: " + $db)
    }
}

Write-Host "==> 重启资源管理器..."
Start-Process explorer.exe
Start-Sleep -Seconds 2

Write-Host "==> 使用 ie4uinit 刷新系统图标缓存..."
Start-Process "ie4uinit.exe" -ArgumentList "-show" -Wait

Write-Host ""
Write-Host "完成。桌面与任务栏可能闪一下属正常，图标缓存已彻底刷新。"