# Axiom Logic

基于 Tauri 2 + Rust + 本地 TexTeller 的公式识别 MVP。Tauri 前端入口为
`Frontend/index.html`，保留的原始设计文件为 `Frontend/code.html`；识别请求不会发送到公共远程服务。

## 当前功能

- 选择、拖拽或粘贴公式图片
- 常驻 Python worker，一次加载 TexTeller 模型后重复识别
- Rust/Tauri 通过 JSONL worker 协议调用本地推理
- LaTeX 编辑、复制、SVG 导出、本地历史记录
- 设置页软件更新（tauri-plugin-updater + GitHub Releases，见 docs/UPDATING.md）
- 标准/高精度/快速设置项已接入 UI；MVP 阶段共用同一 TexTeller 权重，后续再替换不同模型

## 开发环境

- Windows x64
- Rust/Cargo 1.77+
- Tauri CLI 2.x
- Python 3.11（当前开发机已验证）
- `texteller` 及其模型权重

项目内 `.cargo/config.toml` 默认使用 sparse rsproxy 镜像；如果你的网络环境
不需要该镜像，可以删除该文件后使用默认 crates.io。

准备模型资源（从 Hugging Face 下载 TexTeller 3.0 权重到项目内）：

```powershell
.\scripts\prepare-local-model.ps1
```

开发启动：

```powershell
npx tauri dev
```

如果 Python 不在 `py -3.11`，可以设置 worker 解释器：

```powershell
$env:AXIOM_FORMULA_PYTHON = "C:\\path\\to\\python.exe"
npx tauri dev
```

也可以通过 `AXIOM_FORMULA_WORKER_BIN` 指向未来打包的
`formula-worker.exe`，Rust IPC 接口无需修改。

## 离线打包说明

开发阶段 worker 调用本机 Python。正式发布时应将 Python worker 用
Nuitka（见 `scripts/build-worker-exe.ps1`）打成 sidecar exe，并通过
`AXIOM_FORMULA_WORKER_BIN` 指向它，用户机器无需安装 Python。

模型权重**不随安装包捆绑**：首次启动时 worker 自动从 HuggingFace 官方仓库
（`OleehyO/TexTeller`）下载到用户数据目录（国内可设 `HF_ENDPOINT=https://hf-mirror.com`），
下载完成后离线复用，与应用版本解耦。若需完全离线分发，可把模型目录拷入
`src-tauri/resources/models/texteller` 后调整 `tauri.conf.json` 的 resources。

worker 支持以下可选环境变量：
- `AXIOM_TEXTELLER_MODEL_DIR`：指定 TexTeller 权重目录（默认找捆绑资源）
- `AXIOM_TEXTELLER_ONNX=1`：改用 ONNX Runtime 推理（需 `optimum` + `onnxruntime`）
- `AXIOM_TEXTELLER_BEAMS`：解码 beam 数，默认 1，调大可提升准确率但变慢

当前前端仍使用 Tailwind、字体和 Material Symbols CDN；这不影响本地识别，
但要做完全断网的安装包，还需要把这些静态资源本地化。

## 目录

```text
Frontend/                         现有静态前端
src-tauri/src/                    Rust 命令、状态和 worker 生命周期
src-tauri/resources/formula_worker.py
                                  本地 TexTeller JSONL worker
src-tauri/resources/models/       随包模型资源
scripts/prepare-local-model.ps1   下载 TexTeller 权重
docs/API.md                       IPC 协议
```
