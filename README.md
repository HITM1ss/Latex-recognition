# Axiom Logic

基于 Tauri 2 + Rust + 本地 pix2tex 的公式识别 MVP。Tauri 前端入口为
`Frontend/index.html`，保留的原始设计文件为 `Frontend/code.html`；识别请求不会发送到公共远程服务。

## 当前功能

- 选择、拖拽或粘贴公式图片
- 常驻 Python worker，一次加载 pix2tex 模型后重复识别
- Rust/Tauri 通过 JSONL worker 协议调用本地推理
- LaTeX 编辑、复制、SVG 导出、本地历史记录
- 标准/高精度/快速设置项已接入 UI；MVP 阶段共用同一 pix2tex 权重，后续再替换不同模型

## 开发环境

- Windows x64
- Rust/Cargo 1.77+
- Tauri CLI 2.x
- Python 3.11（当前开发机已验证）
- `pix2tex==0.1.4` 及其模型文件

项目内 `.cargo/config.toml` 默认使用 sparse rsproxy 镜像；如果你的网络环境
不需要该镜像，可以删除该文件后使用默认 crates.io。

准备模型资源（会复制约 120 MB 到项目内）：

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
PyInstaller/Nuitka 打成 sidecar，并随安装包提供 Python 运行时、依赖和
`src-tauri/resources/models/pix2tex/model` 模型资源；运行时设置
`HF_HUB_OFFLINE=1` 与 `TRANSFORMERS_OFFLINE=1`，不要在用户机器上自动下载权重。

当前前端仍使用 Tailwind、字体和 Material Symbols CDN；这不影响本地识别，
但要做完全断网的安装包，还需要把这些静态资源本地化。

## 目录

```text
Frontend/                         现有静态前端
src-tauri/src/                    Rust 命令、状态和 worker 生命周期
src-tauri/resources/formula_worker.py
                                  本地 pix2tex JSONL worker
src-tauri/resources/models/       随包模型资源
scripts/prepare-local-model.ps1   准备模型资源
docs/API.md                       IPC 协议
```
