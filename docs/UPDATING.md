# 软件更新发布流程（tauri-plugin-updater + GitHub Releases）

本仓库已接入 Tauri 官方更新器：

- Rust 侧：`tauri-plugin-updater`（见 `src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`）
- 权限：`updater:default`（`src-tauri/capabilities/default.json`）
- 前端：设置页「软件更新」卡片，检查 → 下载进度 → 静默安装并重启
- 更新源：`tauri.conf.json` 的 `plugins.updater.endpoints`，指向
  `https://github.com/HITM1ss/Latex-recognition/releases/latest/download/latest.json`

## 0. 前置：签名密钥

```powershell
npx tauri signer generate -w src-tauri/updater.key -p "你的强密码" --ci
```

- `src-tauri/updater.key` 是私钥（已 gitignore，**丢失即无法再发布更新**）
- CLI 输出的 Public key 已写入 `tauri.conf.json` 的 `plugins.updater.pubkey`
- 当前仓库内 pubkey 是开发占位，正式对外发布前请重新生成并替换两端

## 1. 每次发版

1. 更新版本号 `src-tauri/tauri.conf.json` 的 `version`（如 `0.1.0` → `0.1.1`）
2. 构建安装包（`createUpdaterArtifacts: true` 已开启）：

   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$PWD\src-tauri\updater.key"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "你的强密码"
   npx tauri build
   ```

3. 签名签名（对 NSIS 安装包生成 `.sig`）：

   ```powershell
   npx tauri signer sign -f src-tauri\target\release\bundle\nsis\Axiom-Logic_0.1.1_x64-setup.exe
   ```

   会在同目录生成 `Axiom-Logic_0.1.1_x64-setup.exe.sig`。

## 2. latest.json

把签名粘贴进以下模板并另存为 `latest.json`：

```json
{
  "version": "0.1.1",
  "notes": "本次更新的说明",
  "pub_date": "2026-08-30T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "粘贴 .sig 文件内容",
      "url": "https://github.com/HITM1ss/Latex-recognition/releases/latest/download/AxiomLogic_0.1.1_x64-setup.exe"
    }
  }
}
```

## 3. 上传到 GitHub Releases

1. 新建 Release（tag 与版本一致，例如 `v0.1.1`）
2. 上传两个资产，**文件名保持固定不变**（endpoints 依赖固定
   `latest/download/` 重定向，同名资产会被覆盖）：
   - `Axiom-Logic_0.1.1_x64-setup.exe`
   - `latest.json`

> `releases/latest/download/<名字>` 会自动指向最新一次 Release 里的同名资产，
> 所以每次发版都用相同的两个文件名即可，客户端无需改配置。

## 4. 客户端验证

- 打开设置 → 软件更新 → 检查更新，应看到新版本并完成静默安装重启
- 失败排查：`pubkey` 与签名是否同一对密钥；`latest.json` 的 `url` 是否 302 到 exe；
  版本号必须大于当前版本（除非服务端允许降级）

## 已知边界

- 更新整包替换应用本体；模型（约 1.2GB）不在安装包内，由 worker 首次运行时
  自动从 HuggingFace 官方仓库下载到用户数据目录（见 `formula_worker.py` 的
  `_download_model`），与应用更新解耦，不会随版本重复下载
- Python worker 打成 sidecar exe 的流程见 `scripts/build-worker-exe.ps1`，
  正式发布时应优先使用它，避免依赖用户本机 Python