# 软件更新发布流程（tauri-plugin-updater + GitHub Releases）

本仓库发版已完全 CI 化：GitHub Actions 一键完成「构建 → 签名 → Release」。
手动流程仅作 CI 不可用时的兜底（见文末附录）。

- Rust 侧：`tauri-plugin-updater`（`src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`）
- 权限：`updater:default`（`src-tauri/capabilities/default.json`）
- 前端：设置页「软件更新」卡片；左侧导航「升级」按钮 = 切到设置页并自动检查
- 更新源：`tauri.conf.json` 的 `plugins.updater.endpoints`，固定指向
  `https://github.com/HITM1ss/Latex-recognition/releases/latest/download/latest.json`
- 安装方式：NSIS passive 静默安装（升级时弹一次 UAC，属预期）

## 0. 前置：签名密钥（已配置，日常无需改动）

- 私钥：`src-tauri/updater.key`（已 gitignore，**丢失即无法再发布更新**）
- 公钥：已写入 `tauri.conf.json` 的 `plugins.updater.pubkey`，与上述私钥配对、
  **正在生效**（已发布版本的安装包均由它签名）。不要按旧文档的说法把它当
  「开发占位」重新生成；确需更换时必须同步更新 `tauri.conf.json` 的 `pubkey`
  和仓库 Secrets
- CI Secrets（`.github/workflows/release.yml` 读取）：
  - `TAURI_SIGNING_PRIVATE_KEY` —— 私钥全文
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` —— 私钥密码

## 1. 发版（CI，推荐）

1. GitHub → Actions → **Release Desktop App** → Run workflow
2. 输入版本号（如 `0.1.17`）。workflow 会覆盖 `src-tauri/tauri.conf.json` 的
   `version`，并用 `vX.Y.Z` 打 tag
3. 自动完成（见 `.github/workflows/release.yml`）：

   ```text
   写版本号 → npx tauri build --bundles nsis（Secrets 在场即自动签名，产出 .sig）
   → 把安装包复制成无空格文件名（GitHub 资产名不允许空格，空格会被替换为 '.'）
   → 生成 latest.json（url 与实际上传的资产名精确一致）
   → softprops/action-gh-release：发布 vX.Y.Z Release（安装包 + latest.json）
   ```

4. 产物名固定为 `OpenTeX_{version}_x64-setup.exe`（`productName`/`mainBinaryName`
   均为无空格的 `OpenTeX`，不要改回带空格）。

## 2. latest.json（CI 自动生成，格式参考）

```json
{
  "version": "0.1.17",
  "notes": "OpenTeX 0.1.17",
  "pub_date": "2026-09-05T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<.sig 文件内容>",
      "url": "https://github.com/HITM1ss/Latex-recognition/releases/latest/download/OpenTeX_0.1.17_x64-setup.exe"
    }
  }
}
```

`releases/latest/download/<名字>` 自动指向最新 Release 的同名资产，因此
**每次发版都用固定文件名** `latest.json`（覆盖上传），客户端 endpoint 永不变。

## 3. 客户端验证

- 已装应用：设置 → 软件更新（或点左侧「升级」按钮）→ 检查更新 → 下载并安装，
  应看到下载进度并完成静默安装重启
- 排查：`pubkey` 与签名是否同一对密钥；`latest.json` 的 `url` 是否与 Release
  资产实际文件名一致；新版本号必须大于当前版本（否则客户端拒绝降级）

## 4. 已知边界

- 更新整包替换应用本体；**模型权重不随包捆绑**（约 1.2GB），由 worker 首次运行时
  从 HuggingFace 仓库 `OleehyO/TexTeller`（默认走 hf-mirror 镜像）下载：正式版到
  **安装目录同级 `OpenTeX_Model`**，开发模式到
  `%APPDATA%\com.opentex.latex\models\texteller`（见 `worker.rs::model_data_dir`）。
  与应用版本解耦，升级不会要求重新下载
- 新机器点「下载权重」会先自动准备运行环境（`worker.rs::ensure_runtime`）：
  缺 Python 3.11 则从 python.org 静默安装用户级解释器，缺依赖则 pip 安装
  torch CPU + texteller，之后再下载权重
- 免 Python 的 sidecar（`scripts/build-worker-exe.ps1`，Nuitka 打包
  `formula_worker.py`，经 `AXIOM_FORMULA_WORKER_BIN` 启用）是**备用方向**，
  当前默认仍使用用户机器的 Python

## 附录：手动发版（CI 不可用时兜底）

1. 配置签名环境变量（二选一）：
   `TAURI_SIGNING_PRIVATE_KEY`（私钥全文）或 `TAURI_SIGNING_PRIVATE_KEY_PATH`
   （指向 `src-tauri/updater.key`），以及 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
2. 先在 `src-tauri/tauri.conf.json` 手动改好 `version`，再构建
   （`createUpdaterArtifacts: true` 已开启，自动签名）：

   ```powershell
   npx tauri build --bundles nsis
   # 产物：src-tauri\target\release\bundle\nsis\OpenTeX_{v}_x64-setup.exe（+ .sig）
   ```

3. 按 §2 模板生成 `latest.json`（`signature` 填 `.sig` 文件内容，`url` 与
   上传资产名一致）
4. 新建 GitHub Release（tag `vX.Y.Z` 与版本一致），上传安装包与 `latest.json`，
   **文件名保持固定**（同名资产覆盖，客户端 endpoint 依赖固定重定向）
