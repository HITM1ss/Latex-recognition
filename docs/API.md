# Recognition IPC

前端通过 Tauri `invoke(...)` 调用 Rust。`texteller` 使用 stdin/stdout JSONL 与
常驻 Python worker 通信；`custom-ai` 则由 Rust 向已配置的视觉 AI 接口发起请求，
不启动本地推理 worker。

## recognize_image

### Request

```json
{
  "image_base64": "data:image/png;base64,...",
  "mime": "image/png",
  "model": "texteller"
}
```

调用形式为 `invoke('recognize_image', {request})`。`image_base64` 支持纯 base64
或带 `data:` 前缀的 Data URL。`model` 从 `list_models` 返回的模型 id 中选择：

- `texteller`：在本机识别，不向 AI 服务发送图片。
- `custom-ai`：读取已保存配置，调用兼容所选 Responses 或 Chat Completions 协议的视觉接口，
  将图片以 Data URL 形式发送；支持 PNG、JPEG、WebP、GIF、BMP，
  原始图片不超过 12 MB。未知 `model` 值仍沿用现有本地 TexTeller 路由。

自定义 AI 由配置字段 `apiFormat` 选择协议，模型需要支持对应协议和图片输入：

- `responses`：`POST /responses`，使用 `input_text` 和 `input_image` 内容项，
  以及 `stream: false`、`store: false`。本实现不发送 `temperature`，使用模型默认值。
- `chat-completions`：`POST /chat/completions`，使用 system 提示词及包含
  `text` / `image_url` 的 user 消息，`stream: false`，发送配置的 `temperature`。

地址可含 `/v1` 或完整的 `/responses`、`/chat/completions`，后端按所选协议
拼接实际端点，并为获取模型移除端点后缀；保留用户填写的原始根路径，不自动补 `/v1`。
例如 `https://api.deepseek.com` 在 Responses 模式请求 `/responses`；若服务需要
`/v1/responses`，应显式填写带 `/v1` 的根地址或完整端点。
实现依据 [OpenAI 图像输入文档](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)
及 [Responses 迁移文档](https://developers.openai.com/api/docs/guides/migrate-to-responses)。

### Response

```json
{
  "success": true,
  "latex": "\\frac{a}{b}",
  "confidence": null,
  "elapsed_ms": 142,
  "engine": "texteller-local",
  "error": null
}
```

两个引擎的成功响应使用相同结构；自定义 AI 的 `engine` 为
`custom-ai/<配置的模型 ID>`，`confidence` 为 `null`。Chat Completions 响应支持
`choices[0].message.content` 为字符串或文本片段数组；Responses 从原始 HTTP
响应的 `output[].content[]` 中提取 `type: "output_text"` 的 `text`，不依赖 SDK
专用的顶层 `output_text` 便利属性。两种协议均清理代码块及数学定界符。
空内容、截断结果、认证失败、超时等通过 Tauri `invoke` rejection 返回可读错误。

TexTeller 未暴露校准后的置信度输出，因此 `confidence` 暂时为 `null`，不伪造
分数。本地 worker 失败时（Tauri 调用仍可 resolve，`success: false`）：

```json
{
  "success": false,
  "latex": null,
  "confidence": null,
  "elapsed_ms": null,
  "engine": "texteller-local",
  "error": {
    "code": "invalid_image | model_unavailable | inference_failed | no_formula | invalid_request",
    "message": "可读的中文错误信息"
  }
}
```

`invalid_request` 由 worker 主循环返回，表示请求行不是合法的 JSON 对象。

## 其他 IPC 命令（src-tauri/src/commands.rs）

| invoke | 参数 | 返回 / 行为 |
| --- | --- | --- |
| `list_models` | 无 | `ModelInfo[]`：`{id,label,description,icon,ready}`；本地模型按权重判定 `ready`，保存有效自定义配置后增加 `custom-ai`；远程配置缺密钥时 `ready: false`，本机免鉴权接口允许无密钥 |
| `download_model` | `{id, onEvent: Channel}` | 阻塞到就绪并返回 `"ready"`。先 `ensure_runtime`（缺 Python 3.11 / torch / texteller 时自动安装），再拉起 worker。`onEvent` 收到 `{stage}`（环境准备阶段文字）或 `{total, downloaded, speedBps, filename}`（权重下载进度，camelCase 序列化） |
| `delete_model` | `{id}` | 停 worker → 删权重目录，返回 `"deleted"`；目录不存在返回 `"nothing_to_delete"`；随包内置模型拒绝删除 |
| `open_model_dir` | 无 | 打开（不存在则创建）权重目录并返回目录路径字符串 |
| `model_status` | 无 | `"ready"`（worker 进程存活）/ `"cold"`；当前前端未调用，保留作状态探测 |

## 自定义 AI 配置命令（src-tauri/src/custom_ai.rs）

配置输入 `config` 使用 camelCase：

```json
{
  "apiFormat": "responses",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "",
  "clearApiKey": false,
  "model": "your-vision-model",
  "prompt": "只输出图片中数学公式的 LaTeX，不要解释。",
  "temperature": 0,
  "timeoutSeconds": 60
}
```

`apiFormat` 取 `responses` 或 `chat-completions`。全新配置默认 `responses`；
旧存档缺少该字段时按 `chat-completions` 读取，前端也保留此兼容回退，不自动迁移旧配置。
测试、保存、获取模型列表均传递当前草稿的 `apiFormat`。

`temperature` 范围为 0–2，作为数值保留在配置中；Responses 不发送该参数，
前端禁用温度输入并标明使用模型默认值，切回 Chat 后恢复原值。
`timeoutSeconds` 为 10–300 的整数；`prompt` 留空
使用默认提示词。获取模型列表时可省略 `model`，保存和测试时必须提供。
`apiKey` 省略或为空表示保留已保存密钥，`clearApiKey: true` 表示清除，不能
同时传入新密钥。更换 URL origin 时不能复用旧密钥，需重新输入或明确清除。

| invoke | 参数 | 返回 / 行为 |
| --- | --- | --- |
| `get_custom_ai_config` | 无 | 配置视图 `{apiFormat,baseUrl,model,prompt,temperature,timeoutSeconds,hasApiKey}`；不返回密钥 |
| `save_custom_ai_config` | `{config}` | 校验、持久化并返回配置视图；不执行网络请求，保存草稿不代表连接测试成功 |
| `test_custom_ai_config` | `{config}` | 使用草稿调用视觉接口，内置图片公式 `x + 1 = 2` 正确识别后返回 `{message,elapsedMs}`；不保存草稿 |
| `list_custom_ai_models` | `{config}` | 对对应 API 根路径执行 `GET /models`，返回去重排序的模型 ID 字符串数组；不保存草稿，列表不保证全部模型支持视觉 |

配置写入 Tauri `app_config_dir()/custom-ai.json`，API Key 通过 Windows DPAPI
绑定当前用户加密保存，前端仅获取 `hasApiKey`。远程地址要求 HTTPS 并提供密钥；
本机回环 HTTP 接口可免鉴权。不跟随重定向，避免密钥被转发到其他服务。
选择自定义 AI 后的识别请求会传输公式图片；本地 TexTeller 模式不通过此链路。

## Worker protocol

worker 启动后先输出：

```json
{"type":"ready","ok":true,"engine":"texteller-local","model":"texteller-3.0"}
```

随后每行一个请求和一个带同一 `id` 的响应。stdout 只用于协议，诊断日志
写入 stderr。发送 `{"type":"shutdown"}` 请求可以结束进程。

启动阶段若需下载权重，worker 会先输出若干条无 `id` 的
`{"type":"download_progress","downloaded":...,"total":...,"speed_bps":...,"filename":...}`
消息（这一层是 Rust↔worker 的原生 JSONL，snake_case）；Rust 侧转发给前端
Channel 后跳过这些消息，继续等待 `ready`。
