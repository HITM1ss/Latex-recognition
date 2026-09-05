# Local recognition IPC

前端通过 Tauri `invoke(...)` 调用 Rust；识别链路上 Rust 再通过 stdin/stdout
JSONL 与常驻 Python worker 通信。

## recognize_image

### Request

```json
{
  "image_base64": "data:image/png;base64,...",
  "mime": "image/png",
  "model": "texteller"
}
```

`image_base64` 支持纯 base64 或带 `data:` 前缀的 Data URL（worker 会自动剥掉前缀）。
`model` 当前固定为 `texteller`（前端从 `list_models` 返回的模型 id 中选择），字段保留
是为了后续接入其他本地模型；后端目前不校验该值，未知值同样由本地 TexTeller 推理。

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

TexTeller 未暴露校准后的置信度输出，因此 `confidence` 暂时为 `null`，不伪造
分数。失败时（HTTP 层仍是 Ok，`success: false`）：

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
| `list_models` | 无 | `ModelInfo[]`：`{id,label,description,icon,ready}`；`ready` 按本地权重动态判定 |
| `download_model` | `{id, onEvent: Channel}` | 阻塞到就绪并返回 `"ready"`。先 `ensure_runtime`（缺 Python 3.11 / torch / texteller 时自动安装），再拉起 worker。`onEvent` 收到 `{stage}`（环境准备阶段文字）或 `{total, downloaded, speedBps, filename}`（权重下载进度，camelCase 序列化） |
| `delete_model` | `{id}` | 停 worker → 删权重目录，返回 `"deleted"`；目录不存在返回 `"nothing_to_delete"`；随包内置模型拒绝删除 |
| `open_model_dir` | 无 | 打开（不存在则创建）权重目录并返回目录路径字符串 |
| `model_status` | 无 | `"ready"`（worker 进程存活）/ `"cold"`；当前前端未调用，保留作状态探测 |

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
