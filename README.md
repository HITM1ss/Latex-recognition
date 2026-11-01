# OpenTeX

基于 Tauri 2 + Rust + 本地 TexTeller 的公式识别 MVP。Tauri 前端入口为
`Frontend/index.html`。TexTeller 本地模式不上传公式图片；选择自定义 AI 模型后，
图片会发送到用户配置的服务接口。

前端按三个文件维护：`index.html` 负责页面结构，`styles.css` 负责样式和动画，
`app.js` 负责 Tailwind 主题配置及所有 JavaScript 交互，无需额外打包工具。

主页上传区按 HaloDropzone 的磨砂面板、主题绿色光晕和周界流光样式适配为原生
HTML/CSS/JS，保持原上传区的全宽和 124px 高度，支持减少动态效果的系统设置。
识别中显示真实处理状态，结果短暂显示后恢复选择提示。

## 当前功能

- Halo 风格上传区：选择、拖拽或粘贴单张公式图片，最大 12 MB
- 常驻 Python worker，一次加载 TexTeller 模型后重复识别
- Rust/Tauri 通过 JSONL worker 协议调用本地推理
- LaTeX 编辑、复制 LaTeX / 复制 MathML、本地历史记录
- 设置页软件更新（tauri-plugin-updater + GitHub Releases，见 docs/UPDATING.md）
- 设置页「识别模型」卡片动态渲染模型列表，支持下载/删除权重、打开权重目录
- 自定义视觉 AI：创建多个命名配置，分别保存接口、密钥、模型及提示词，获取模型列表、测试连接并切换识别引擎

## 配置自定义 AI 模型

1. 设置页的配置表单默认不加载已有端点和模型。在「配置自定义 AI 模型」中选择接口协议，再填写地址、API Key 和模型 ID。
   新配置默认使用 Responses API，已有 Chat Completions 配置继续使用原协议。
   地址可为 API 根地址、`/v1` 地址，或完整的 `/responses`、`/chat/completions` 地址；远程接口
   使用 HTTPS，本机 `localhost`、`127.0.0.1`、`::1` 服务可使用 HTTP 并留空密钥。
   程序保留所填写的根路径，不自动补 `/v1`；服务需要 `/v1` 时请显式填写。
2. 可点击「获取模型」展开完整模型列表，也可手填模型 ID；输入时可筛选，右侧箭头可重新展开全部结果。请选择支持图片输入、并兼容所选
   Responses 或 Chat Completions 协议的视觉模型。
3. 根据需要设置提示词和超时（10–300 秒）。Chat Completions 可设置温度（0–2）；
   Responses 使用模型默认温度，温度输入框禁用，切回 Chat 后保留原值。「测试连接」会发送
   内置公式图片，检查模型能否正确识别；测试和获取模型列表都不会保存草稿。
4. 点击「新建配置」，在弹窗输入配置名称并确认。该操作只保存在本机，不测试连接，
   不切换当前识别模型；可以创建多个不同名称的配置，名称最多 64 个字符且不能重复。
   创建完成后表单恢复空白，新条目按配置名称显示在上方「识别模型」中，点击条目可切换识别引擎。
5. 点击某条自定义模型右侧的「配置」，才会载入该项内容。修改后点击「保存修改」更新原配置，
   「取消编辑」返回空白表单；「新建配置」始终把当前内容另存为独立条目。自定义 AI 无需本地模型权重。
6. 配置按钮旁的删除图标可移除该项。确认后先保存本机恢复副本，再从识别列表移除；
   删除当前选中项时切回 TexTeller，删除正在编辑的项时清空编辑表单，其他配置和草稿保留。

DeepSeek 图片识别示例：协议选 Responses API，地址填 `https://api.deepseek.com/responses`，
模型填 `deepseek-flash`；这是视觉 Responses 接口，无需配置 Search 工具。[官方说明](https://api-docs.deepseek.com/zh-cn/guides/responses_api/)

API Key 使用 Windows DPAPI 加密，随配置保存在当前用户的应用配置目录
`custom-ai-profiles.json` 中，不写入浏览器存储或回显已保存的明文。旧版 `custom-ai.json`
会保留，并迁移为「默认配置」。编辑已载入的配置时，密钥输入留空表示
保留该配置的原密钥；以它新建配置时，可沿用该来源在同一服务的密钥。空白表单新建不会复用其他配置的密钥。
输入新值可替换；「清除密钥」需保存后生效。更换接口服务器时需
重新填写密钥，旧密钥不会自动发往新服务器。远程接口缺少密钥时不可选用。

已删除配置的完整加密副本及恢复说明保存在 `%TEMP%\OpenTeX\profile-archive\`，
不在删除操作中解密密钥。恢复时需检查原 ID 和名称均未被当前配置占用。

识别图片只会在选择自定义 AI 并执行识别时发往配置的服务；TexTeller 的公式
识别仍由本机 worker 完成。测试会产生一次内置图片请求，可能有少量调用费用。
Responses 请求使用 `stream: false`、`store: false`；该参数请求服务不保存响应，
具体数据处理仍由所配置服务决定。协议实现依据 [OpenAI 图像输入文档](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)
和 [Responses 迁移文档](https://developers.openai.com/api/docs/guides/migrate-to-responses)，尚不代表已通过真实服务商联调。

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

> 注意：该脚本走官方 `huggingface.co` 端点做**全量** `snapshot_download`（约 6GB，
> 含 onnx 变体等非必需文件）。国内网络建议先设 `$env:HF_ENDPOINT = "https://hf-mirror.com"`
> 再运行；日常更推荐直接用应用设置页的「下载权重」按钮（最小文件集 + 镜像 + 断点续传）。

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

**新机器零配置**：应用设置页点「下载权重」会自动执行环境准备——检测
Python 3.11，缺失则静默安装官方解释器；随后自动安装 texteller/torch
（CPU），全部就绪后再下载模型权重。全程按钮实时显示阶段文字。

模型权重**不随安装包捆绑**：首次启动时 worker 自动从 HuggingFace 仓库
（`OleehyO/TexTeller`，默认走 hf-mirror 镜像）下载到**安装目录同级**
（如 `D:\Program Files\OpenTeX_Model`），下载完成后离线复用，与应用版本
解耦。若需完全离线分发，可把模型目录拷入
`src-tauri/resources/models/texteller` 后调整 `tauri.conf.json` 的 resources。

worker 支持以下可选环境变量：
- `AXIOM_TEXTELLER_MODEL_DIR`：指定 TexTeller 权重目录（默认找捆绑资源）
- `AXIOM_TEXTELLER_ONNX=1`：改用 ONNX Runtime 推理（需 `optimum` + `onnxruntime`）
- `AXIOM_TEXTELLER_BEAMS`：解码 beam 数，默认 1，调大可提升准确率但变慢
- `AXIOM_FORMULA_WORKER_BIN`：手动指定 worker（sidecar exe 或脚本）

当前前端仍使用 Tailwind、字体和 Material Symbols CDN；这不影响本地识别，
但要做完全断网的安装包，还需要把这些静态资源本地化。

## 目录

```text
Frontend/index.html              页面结构与资源引用
Frontend/styles.css              页面样式与动画
Frontend/app.js                  Tailwind 主题配置与交互逻辑
src-tauri/src/                    Rust 命令、状态和 worker 生命周期
src-tauri/resources/formula_worker.py
                                  本地 TexTeller JSONL worker
src-tauri/resources/models/       随包模型资源
scripts/prepare-local-model.ps1   下载 TexTeller 权重
docs/API.md                       IPC 协议
```
