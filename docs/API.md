# Local recognition IPC

前端通过 Tauri `invoke("recognize_image", { request })` 调用 Rust；Rust
再通过 stdin/stdout JSONL 与常驻 Python worker 通信。

## Request

```json
{
  "image_base64": "data:image/png;base64,...",
  "mime": "image/png",
  "model": "standard"
}
```

`model` 当前可取 `fast`、`standard`、`high`。MVP 统一使用本地
`pix2tex-base`，保留该字段是为了后续接入 RapidLaTeX-OCR 或其他本地模型。

## Response

```json
{
  "success": true,
  "latex": "\\frac{a}{b}",
  "confidence": null,
  "elapsed_ms": 142,
  "engine": "pix2tex-local",
  "error": null
}
```

pix2tex 没有校准后的置信度输出，因此 `confidence` 暂时为 `null`，不伪造
分数。失败时：

```json
{
  "success": false,
  "latex": null,
  "confidence": null,
  "elapsed_ms": null,
  "engine": "pix2tex-local",
  "error": {
    "code": "invalid_image | model_unavailable | inference_failed | no_formula",
    "message": "可读的中文错误信息"
  }
}
```

## Worker protocol

worker 启动后先输出：

```json
{"type":"ready","ok":true,"engine":"pix2tex-local","model":"pix2tex-base"}
```

随后每行一个请求和一个带同一 `id` 的响应。stdout 只用于协议，诊断日志
写入 stderr。发送 `{"type":"shutdown"}` 请求可以结束进程。
