# Axiom Logic — 架构与接手说明

> 本文档面向**其他 AI / 开发者**，目标是让人在**不依赖原作者**的情况下快速理解、修改、构建和发布本项目。
> 请以**当前仓库代码**为准；`README.md` 中与本文冲突的描述（如模型目录、下载去向）是早期版本的残留，已被下述实现取代。

## 0. 一句话概述

**Axiom Logic** 是一个 **完全离线的 LaTeX 公式识别桌面应用**：

- 前端 = 单个静态 HTML（原生 JS + Tailwind CDN + 原生 SVG 图标）
- 桌面壳 = **Tauri 2 + Rust**（负责窗口、IPC、进程编排、自动更新）
- 推理 = **常驻 Python worker** 进程（TexTeller 3.0 模型，CPU 推理）
- 调用链：`前端 → Tauri 命令(Rust) → stdin/stdout JSONL → Python worker → TexTeller → LaTeX 原路返回`

识别请求**不经过任何远程服务**。唯一联网场景是「首次下载模型权重」和「检查软件更新」。

## 1. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | 原生 HTML/CSS/JS + Tailwind(CDN) + KaTeX(CDN) + Material Symbols(CDN) | 单文件 `Frontend/index.html`，无打包器、无框架 |
| 桌面壳 | Tauri 2（Rust）/ tao / webview2 | 无边框窗口（自绘标题栏） |
| 后端编排 | Rust commands + worker 进程管理 | 见 `src-tauri/src/*` |
| 推理 | Python 3.11 + `texteller`（TrOCR 架构）+ torch CPU | 常驻子进程 |
| 模型 | `OleehyO/TexTeller`（HuggingFace，3.0 权重 `model.safetensors` ~1.19GB） | 不随包捆绑，首次自动下载 |
| 更新 | `tauri-plugin-updater` + GitHub Releases + 自签名密钥 | CI 一键发版 |
| 构建/发版 | GitHub Actions（`release.yml`） | Windows NSIS perMachine 安装包 |

## 2. 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                 Axiom Logic（Windows 桌面）                    │
│                                                             │
│  Frontend/index.html （WebView，单文件）                      │
│    ├─ 标题栏（自绘）/ 侧栏导航 / 工作区 / 设置页               │
│    ├─ renderModels()   动态模型列表（下载/删除/单选）          │
│    ├─ recognize()      invoke("recognize_image")             │
│    ├─ KaTeX renderPreview()  LaTeX → 公式预览                 │
│    ├─ 更新卡片          plugin:updater 检查/下载/安装          │
│          │ invoke (Tauri IPC, withGlobalTauri)                │
│          ▼                                                    │
│  Rust 层 (src-tauri/src/)                                     │
│    ├─ commands.rs    recognize_image / list_models /          │
│    │                  download_model / delete_model /         │
│    │                  model_status                            │
│    ├─ worker.rs      FormulaWorker 子进程管理 + JSONL 协议     │
│    ├─ state.rs       AppState { worker }                     │
│    └─ lib.rs         注册插件与命令                            │
│          │ stdin/stdout JSONL（每行一个消息）                  │
│          ▼                                                    │
│  Python worker (resources/formula_worker.py)                  │
│    ├─ main()           启动时 load_model() → 发 ready          │
│    ├─ _model_root()    定位模型目录；缺失则下载                 │
│    ├─ _download_model() 流式下载（镜像/断点续传/进度/校验）      │
│    └─ recognize()      image → img2latex → latex              │
│          │                                                    │
│          ▼                                                    │
│  模型权重目录（见 §6） + torch + texteller ~2GB                │
└─────────────────────────────────────────────────────────────┘
```

## 3. 目录结构

```
d:\Latex-recognition\
├── .cargo/config.toml          # sparse rsproxy 镜像（联网受限环境可删）
├── .github/workflows/release.yml   # 一键发版 CI（构建+签名+Release）
├── Frontend/
│   ├── index.html              # ★ 全部前端 UI 与逻辑（单文件）
│   ├── code.html               # 早期设计备份（可忽略）
│   └── DESIGN.md               # 早期设计说明（可能过时）
├── docs/
│   ├── API.md                  # 识别 IPC 协议（旧版速览）
│   ├── UPDATING.md             # 手动发版流程（CI 化后已简化）
│   └── ARCHITECTURE.md         # 本文档
├── scripts/
│   ├── prepare-local-model.ps1 # 下载模型到 src-tauri/resources/models/texteller（开发用）
│   ├── build-worker-exe.ps1    # Nuitka 打包 worker 为独立 exe（可选方案）
│   └── run-worker-smoke-test.ps1
├── src-tauri/
│   ├── capabilities/default.json
│   ├── resources/
│   │   ├── formula_worker.py   # ★ Python worker（核心）
│   │   └── requirements.txt    # texteller / torch / torchvision 版本
│   ├── src/
│   │   ├── lib.rs              # 插件与命令注册
│   │   ├── commands.rs         # Tauri 命令（IPC 入口）
│   │   ├── worker.rs           # 子进程生命周期 + JSONL 协议解析
│   │   ├── state.rs            # AppState
│   │   └── main.rs
│   ├── icons/  build.rs  Cargo.toml  tauri.conf.json
├── .gitignore                  # 模型/密钥/target 不入库
└── README.md                   # 概览（部分内容已过时）
```

## 4. 各层详解

### 4.1 前端（`Frontend/index.html`，单文件）

无构建、无框架，`window.__TAURI__`（`withGlobalTauri: true`）直连 Rust。CDN 只从网络加载 `tailwindcss / KaTeX / Material Symbols / 字体`；**完全离线包需要把这些本地化**（当前未做）。

关键区块与职责：

| 区块 | 作用 |
|---|---|
| `<header id="titlebar">` | 自绘标题栏（`decorations:false` 无系统栏），拖拽区 + 最小化/关闭 |
| `<nav>` | 左侧 80px 导航：工作区 / 设置 / 升级按钮（点击升级 = 切到设置页并触发检查更新） |
| `<main>` 工作区 | 拖放/粘贴图片 → 识别 → 原始图 + KaTeX 预览 + LaTeX 源码编辑 + 底部操作栏 |
| `<main>` 设置页 | 「识别模型」动态卡片（`renderModels`）+ 「软件更新」卡片 |
| JS 函数 `renderModels()` | 从 `list_models` 拉模型列表动态渲染：就绪 → 单选点 + 删除图标按钮；未就绪 → 「下载权重」按钮（实时进度/速度） |
| JS `recognize()` | `invoke("recognize_image", {request})` → `updateLatex` → KaTeX `renderPreview` |
| JS `updateCard` 模块 | 检查更新 `plugin:updater|check` → 下载 `download_and_install`（Channel 进度）→ 静默安装重启 |
| KaTeX | 识别/编辑结果去掉 `\[...\]` 后渲染；不支持的命令以红色原文回退（`throwOnError:false`） |

**前端与 Rust 的命令映射**：

| invoke | Rust 命令 | 备注 |
|---|---|---|
| `recognize_image` | `commands::recognize_image` | 参数 `{request}`＝`{imageBase64,mime,model}` |
| `list_models` | `commands::list_models` | 返回 `ModelInfo[]`（id/label/description/icon/ready） |
| `download_model` | `commands::download_model` | 参数 `{id,onEvent:Channel}`；Channel 接收下载进度 |
| `delete_model` | `commands::delete_model` | 停 worker → 删目录，内置模型拒绝 |
| `model_status` | `commands::model_status` | "ready"/"cold" |

### 4.2 Rust 层（`src-tauri/src/`）

- **lib.rs**：挂载 `tauri_plugin_updater`，注册 5 个命令。
- **commands.rs**：
  - `list_models`：当前只登记 `texteller` 一条（`ready` 由 `worker::texteller_ready` 动态判定）。**新增模型只需在这里加一条 ModelInfo**。
  - `download_model(id, on_event: Channel<DownloadProgress>)`：确保 worker 存活；spawn 时把进度 Channel 传入，worker 启动阶段的 `download_progress` 消息会转发到该 Channel。
  - `delete_model`：若存在捆绑模型则拒绝；否则先 `*state.worker.lock() = None`（触发 Drop → kill 子进程释放文件锁），再 `remove_dir_all(模型目录)`，Windows 句柄延迟用 300ms×10 重试兜底。
  - `recognize_image`：懒拉起 worker（进程死了自动重启）→ 同步等待匹配 `id` 的响应。
- **worker.rs**：
  - `FormulaWorker::spawn(app, progress: Option<Channel<DownloadProgress>>)`：
    1. 解析 Python 命令（`AXIOM_FORMULA_WORKER_BIN` > `py -3.11 formula_worker.py`）
    2. 注入模型目录环境变量（`inject_model_dir`）
    3. `ensure_model_dir_for_spawn`：目标目录不存在时尝试创建，`Program Files` 同级等只读区则**提权创建**（UAC 一次，`ensure_dir_elevated` → powershell `Start-Process -Verb RunAs`）
    4. 启动后**循环读启动握手**：跳过 `download_progress`（转发 Channel）直到 `ready`，或返回错误
    5. worker 的 **stderr 落盘**到 `%APPDATA%\com.axiomlogic.latex\worker.log`（排障关键，不要改成丢弃）
  - `model_data_dir(app)`：确定权重目录（见 §6）
  - `recognize()`：写请求行 → 读匹配 `id` 的响应行（期间忽略无关消息）
  - `Drop`：发送 `{"type":"shutdown"}` 并 kill。

### 4.3 Python worker（`src-tauri/resources/formula_worker.py`）

- **模块头**（最重要）：进程一启动就 `os.environ.setdefault`：`HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1`（**日常必须离线**）以及 `HF_ENDPOINT=https://hf-mirror.com`（**必须在任何 huggingface_hub import 之前设置**，见 §6 的大坑）。
- **协议**：stdout 每行一个 JSON；stderr 只做日志。
- `main()`：`load_model()`（一次）→ `emit(ready)` → 循环读 stdin（每个请求 `recognize` 或 `{"type":"shutdown"}`）。
- `_model_root()`：定位/触发下载（优先级见 §6）。
- `recognize()`：base64 解码 → PIL 校验（纯白图/size 限制 12MB）→ `img2latex(model, tokenizer, [np.asarray], num_beams)` → `\\[ ... \\]` 原样返回（不做去包裹，**前端 KaTeX 负责去 `\[` `\]`**）。

## 5. Worker JSONL 协议（跨 Rust/Python 必须保持）

stdout 单行 JSON。分两类消息：

**启动阶段（Rust spawn 握手）**
```json
{"type":"ready","ok":true,"engine":"texteller-local","model":"texteller-3.0"}
{"type":"error","ok":false,"error":{"code":"model_unavailable","message":"..."}}
{"type":"download_progress","downloaded":123,"total":1194380980,"speed_bps":7340032,"filename":"model.safetensors"}
```

**请求/响应（识别）**

```jsonc
// Rust → worker（stdin，一行）
{"id":1,"image_base64":"<base64>","mime":"image/png","model":"texteller"}

// worker → Rust（stdout）
{"id":1,"ok":true,"latex":"\\frac{a}{b}","confidence":null,"elapsed_ms":142,"engine":"texteller-local","error":null}
```

- Rust 靠 `id` 匹配响应；识别阶段收到的 `download_progress`（无 id）会被忽略跳过。
- 错误码：`invalid_image` / `model_unavailable` / `inference_failed` / `no_formula` / `invalid_request`。
- 详情见 `docs/API.md`（其"model 字段说明"已过时，现在 `model` 是模型 id，固定 `texteller`）。

## 6. 模型权重体系（重点，历史坑最多）

### 6.1 权重目录决策顺序（`worker.rs::model_data_dir` / `worker.py::_model_root`）

| 优先级 | 条件 | 目标目录 |
|---|---|---|
| 1 | 环境变量 `AXIOM_TEXTELLER_MODEL_DIR` 显式指定 | 该路径（空则下载到它，**不回落捆绑**） |
| 2 | 正式版（release，非 debug） | **安装目录父级下 `Axiom_Logic_Model`**，如 `D:\Program Files\Axiom_Logic_Model` |
| 3 | 开发模式（debug）/兜底 | `%APPDATA%\com.axiomlogic.latex\models\texteller` |
| 4 | 捆绑模型（仅当未走 1-3） | `resources/models/texteller`（随包场景，日常未启用） |

设计原因：
- **不放在安装目录内**：perMachine 安装目录对普通用户只读；且升级会覆盖安装目录（权重会被清、要求重下）。
- **放安装目录同级**：用户可见可控、不随升级变动。
- **首次创建目录需要 UAC 一次**（`ensure_dir_elevated`），之后普通权限可写。

### 6.2 worker 下载器（`formula_worker.py::_stream_download`）——历史反复踩坑后的最终形态

1. **文件清单**：直接用 `requests`（**`verify=False`**）请求 `{endpoint}/api/models/{MODEL_REPO}?blobs=true&expand[]=siblings`。
   - ⚠️ `hf-mirror.com` 的 **REST API 会 302 回源官方** `huggingface.co`（只有 `/resolve` 文件下载由镜像缓存），所以清单请求必须跟随重定向且 `verify=False`（本机 CA 库缺失场景的兜底）。
   - ❌ 不要用 `HfApi().model_info()`：huggingface_hub 的 `ENDPOINT` 是模块级绑定，运行期覆盖 `constants.ENDPOINT` 无效，会请求官方域名然后被本机 SSL 卡死。
2. **最小文件集**：只下 9 个必需文件（`model.safetensors` + tokenizer/配置 json/txt，合计 ~1.2GB），**跳过** `*.onnx`（4 个变体）、`pytorch_model.bin`（与 safetensors 重复）、`README*`。若全量下载约 6GB 且权重排最后，任何一次断流都轮不到权重（早期 bug 根因）。
3. **排序**：`model.safetensors` 排第一。
4. **断点续传 + 重试**：`Range: bytes=N-` 续传，3 次重试（断流 `IncompleteRead` 场景），每次文件完成后**按期望大小校验**，不符即删重下。
5. **进度上报**：每 0.5s emit 一条 `download_progress`（`downloaded/total/speed_bps`），Rust 转发给前端 Channel。
6. **收尾清理**：删除目录里残留的 onnx/pytorch_model.bin。
7. **完整性校验**：`_download_model` 结束检查 `model.safetensors`（或 bin）与 `config.json` 存在且非零，缺失时抛明确中文错误（**别让 transformers 直接报 "no file named ..."**）。
8. fallback `snapshot_download` **已移除**（无法传入 `verify=False`，会在 SSL 卡死）。

### 6.3 模型「就绪」判定（`worker::texteller_ready`）

检查顺序：显式 env → `model_data_dir` 对应目录含 `config.json` → 捆绑模型。身上没有 `config.json` 即视为未就绪，前端显示「下载权重」按钮。

### 6.4 模型状态开关

- 下载：`download_model`（阻塞到 ready，进度走 Channel）
- 删除：`delete_model`（停 worker → 删目录 → 前端刷新为可下载态）
- 识别加卸载模型同时可用（worker 每次请求可指定 `model`，当前只有 texteller）

## 7. 自动更新体系

- **插件**：`tauri-plugin-updater`，`tauri.conf.json` 配置 `endpoints`（当前指向 `.../releases/latest/download/latest.json`）与公钥 `pubkey`。
- **签名**：`tauri build` 在设了 `TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD` 环境变量时自动签名安装包并产出 `.sig`。密钥文件 `src-tauri/updater.key(.pub)` 已 gitignore；**仓库 Secrets 里配的是私钥全文与密码**（`yml` 构建步骤读取同名环境变量）。
- **latest.json 格式**（CI 生成，固定文件名覆盖上传，客户端 endpoint 永不变）：

```json
{
  "version": "0.1.16",
  "notes": "Axiom Logic 0.1.16",
  "pub_date": "2026-08-31T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<.sig 文件内容>",
      "url": "https://github.com/HITM1ss/Latex-recognition/releases/latest/download/Axiom_Logic_0.1.16_x64-setup.exe"
    }
  }
}
```

- **前端更新卡片**：`plugin:updater|check` → 有更新显示「下载并安装」→ `download_and_install(rid, onEvent(Channel 进度), restartAfterInstall:true)`；静默安装为 NSIS perMachine（升级时会弹一次 UAC，属预期）。
- **旁路入口**：左侧导航「升级」按钮 = 切到设置页 + 自动 check。

## 8. CI 发布流程（`release.yml`）

手动触发：Actions → **Release Desktop App** → 填版本号 → 自动完成：

```
写版本号(tauri.conf.json) → npx tauri build --bundles nsis（自动签名）
→ Locate installer：把安装包复制成无空格名（GitHub 上传资产会吞空格，空格→点）
→ 生成 latest.json（url 与资产名精确一致）
→ softprops/action-gh-release：打 vX.Y.Z tag + Release（安装包 + latest.json）
```

**必须记住的三个坑**：
1. `nsis.artifactName` **在 Tauri 2 schema 中不存在**（`NsisConfig` 无此字段，任何值都报 anyOf 错）——不要配置它。产物名 = `{productName}_{version}_x64-setup.exe`。
2. GitHub Releases **资产名不允许空格**（空格自动替换为 `.`）。latest.json 的 url 必须与**实际上传到 GitHub 的名字**一致（CI 已做无空格改名）。
3. `productName` 已统一为 `Axiom_Logic`（无空格），窗口 `title` 同步；改动它会影响安装路径与更新一致性，**不要随意改回带空格**。

## 9. 关键 Tauri 配置（`src-tauri/tauri.conf.json`）

| 字段 | 当前值 | 说明 |
|---|---|---|
| `productName` | `Axiom_Logic` | 安装/产物/注册表名，勿改回带空格 |
| `app.windows[0]` | 1000×905，min 700×700，`decorations:false` | 无系统标题栏，自绘 |
| `bundle.createUpdaterArtifacts` | `true` | 产出可更新签名 |
| `bundle.resources` | worker.py + requirements.txt | 模型不打包 |
| `bundle.windows.nsis.installMode` | `perMachine` | 与老版安装同目录升级；升级/安装都会 UAC 提权 |
| `plugins.updater.endpoints/pubkey` | GitHub latest/download + 签名公钥 | 发布新包前密钥若有更换需同步 |
| `app.security.csp` | `null` | 开发方便；正式离线化时应收紧 |

`capabilities/default.json` 授权了窗口拖拽/最小化/关闭 + `updater:default`。

## 10. 开发环境 / 常用命令

前置：Windows x64、Rust 1.77+、Node（npx）、Python 3.11（`texteller`/`torch`/`torchvision` 已装）。

```powershell
# 开发运行（前端热更；Rust 改动触发重编译）
npx tauri dev

# 指定 Python 解释器（worker 用）
$env:AXIOM_FORMULA_PYTHON = "C:\...\python.exe"
npx tauri dev

# 编译校验（改 Rust 后快速验证）
cargo check                      # dev profile
cargo check --release            # 验证生产分支代码（cfg!(debug_assertions) 分支）

# 本地打包
npx tauri build --bundles nsis
# 产物：src-tauri\target\release\bundle\nsis\Axiom_Logic_{v}_x64-setup.exe (+ .sig)
```

**发一个版本**：直接跑 GitHub Actions workflow（推荐，替代本地手动 UPDATING.md 流程）。

### 排障入口

- worker 日志：`%APPDATA%\com.axiomlogic.latex\worker.log`（Python stderr 全量落这里）
- 权重目录（正式装）：`<安装目录父级>\Axiom_Logic_Model\`
- 开发模式权重（debug）：`%APPDATA%\com.axiomlogic.latex\models\texteller\`
- **本地开发注意**：若 `src-tauri/resources/models/texteller` 存在（捆绑），worker 默认用它加载、永远不会触发下载按钮，难以本地复现下载路径；想测试下载逻辑，临时改名该目录或设 `AXIOM_TEXTELLER_MODEL_DIR`。

## 11. 环境变量速查

| 变量 | 作用 |
|---|---|
| `AXIOM_TEXTELLER_MODEL_DIR` | 权重目录（最高优先） |
| `AXIOM_FORMULA_PYTHON` | 指定 Python 解释器 |
| `AXIOM_FORMULA_WORKER_BIN` | 指定打包后的 worker exe |
| `AXIOM_TEXTELLER_ONNX=1` | 切 ONNX 推理（需额外依赖，默认关） |
| `AXIOM_TEXTELLER_BEAMS` | beam 数，默认 1 |
| `HF_ENDPOINT` | HF 端点/镜像（默认 `https://hf-mirror.com`；下载时 `verify=False`） |
| `HF_HUB_OFFLINE` / `TRANSFORMERS_OFFLINE` | worker 内强制 `1`（日常离线），仅在下载模型期间临时放开 |

## 12. 常见坑清单（改动前必读）

1. **镜像 API 302 回源**：`hf-mirror` 的 API 会跳官方，清单请求必须 `verify=False` + 跟随；不要在 worker 里用会走官方验证的 `HfApi`。
2. **SSL_VERIFY_FAILED**：不少用户环境 CA 库不完整（公司代理/证书问题）；下载走 `verify=False` + 大小校验，评分兜底。
3. **不要引入 `snapshot_download` 作为兜底**（无法关闭 SSL 校验）。
4. **下载别拉全量**（onnx/重复权重会先于 safetensors，且占 6GB）——维持 `skip_names` 白名单 + safetensors 优先。
5. **`createUpdaterArtifacts` + 签名 Secrets 缺一不可**，否则 CI 找不到 `.sig` 报错。
6. **GitHub 资产名空格→点**；latest.json 的 url 必须 = 资产实际名（CI 已处理）。
7. **Tauri schema 不支持 `nsis.artifactName`**；`bundle.windows.nsis` 只可用真字段（`installMode` 等）。
8. **模型与密钥都是 gitignore**；换机器先跑 `prepare-local-model.ps1` 或点应用内下载；密钥重生成需同时更新 `tauri.conf.json` 的 `pubkey` 和 Secrets。
9. **KaTeX 是 CDN**：若做完全断网安装包，需把 Tailwind/KaTeX/图标/字体本地化（当前通过 jsdelivr + 系统字体）。

## 13. 主要代码索引

| 需求 | 文件/函数 |
|---|---|
| 前端全部 UI/逻辑 | `Frontend/index.html`（renderModels / recognize / renderPreview / updateCard / 删除按钮 CSS） |
| IPC 命令 | `src-tauri/src/commands.rs` |
| worker 进程与握手 | `src-tauri/src/worker.rs`（spawn / recognize / model_data_dir / ensure_dir_elevated / texteller_ready） |
| 模型加载与下载 | `resources/formula_worker.py`（main / _model_root / _download_model / _stream_download / _emit_progress） |
| 更新配置/发布 | `src-tauri/tauri.conf.json` + `.github/workflows/release.yml` + `docs/UPDATING.md` |
| 权限 | `src-tauri/capabilities/default.json` |
| 底层协议 | `docs/API.md` |

## 14. 已知未完成 / 可扩展方向

- 前端静态资源 still CDN，未本地化 → 完全离线安装包需要处理。
- 模型选择只有 TexTeller；`list_models` 已设计成数组，新增模型注册一条 + 实现对应 worker 下载即可。
- worker 仍依赖用户机器 Python 3.11；`scripts/build-worker-exe.ps1`（Nuitka sidecar）是既定但尚未启用的方向。
- 模型存储的迁移/清理（新老目录并存）未做自动处理。
- 更新下载/安装的交互细节（如强制重试、失败日志展示）可再打磨。