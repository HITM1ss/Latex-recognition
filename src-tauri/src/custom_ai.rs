use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::PathBuf, time::{Duration, Instant}};
use tauri::{AppHandle, Manager};

use crate::worker::{RecognizeRequest, RecognizeResponse};

const DEFAULT_PROMPT: &str = "请识别图片中的数学公式，只输出对应的 LaTeX 公式本体，不要解释，不要 Markdown 代码块，不要添加数学定界符。";
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;
const MAX_ERROR_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_IMAGE_BYTES: usize = 12 * 1024 * 1024;
const TEST_IMAGE: &[u8] = include_bytes!("../resources/connection-test.png");

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ApiFormat {
    Responses,
    #[default]
    ChatCompletions,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAiConfigInput {
    pub base_url: String,
    #[serde(default)]
    pub api_format: ApiFormat,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub clear_api_key: bool,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub temperature: f64,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
}

fn default_timeout() -> u64 { 60 }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAiConfigView {
    pub base_url: String,
    pub api_format: ApiFormat,
    pub model: String,
    pub prompt: String,
    pub temperature: f64,
    pub timeout_seconds: u64,
    pub has_api_key: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredConfig {
    base_url: String,
    #[serde(default)]
    api_format: ApiFormat,
    model: String,
    prompt: String,
    temperature: f64,
    timeout_seconds: u64,
    #[serde(default)]
    protected_api_key: Option<String>,
}

struct ResolvedConfig {
    base_url: reqwest::Url,
    api_format: ApiFormat,
    api_key: String,
    model: String,
    prompt: String,
    temperature: f64,
    timeout_seconds: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub message: String,
    pub elapsed_ms: u64,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map(|dir| dir.join("custom-ai.json"))
        .map_err(|_| "无法定位自定义 AI 配置目录".to_string())
}

fn read_config(app: &AppHandle) -> Result<Option<StoredConfig>, String> {
    let path = config_path(app)?;
    match std::fs::read(&path) {
        Ok(bytes) => {
            if bytes.len() > 128 * 1024 { return Err("自定义 AI 配置文件过大".into()); }
            serde_json::from_slice(&bytes).map(Some)
                .map_err(|_| "自定义 AI 配置文件格式有误，请检查配置文件".to_string())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("无法读取自定义 AI 配置文件".into()),
    }
}

fn view(stored: &StoredConfig) -> CustomAiConfigView {
    CustomAiConfigView {
        base_url: stored.base_url.clone(), api_format: stored.api_format, model: stored.model.clone(),
        prompt: stored.prompt.clone(), temperature: stored.temperature,
        timeout_seconds: stored.timeout_seconds,
        has_api_key: stored.protected_api_key.as_ref().is_some_and(|key| !key.is_empty()),
    }
}

fn is_loopback(url: &reqwest::Url) -> bool {
    url.host_str().is_some_and(|host| host.eq_ignore_ascii_case("localhost") ||
        host.trim_matches(['[', ']']).parse::<std::net::IpAddr>().is_ok_and(|ip| ip.is_loopback()))
}

fn normalize_base_url(input: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(input.trim())
        .map_err(|_| "请输入完整接口地址，例如 https://api.example.com/v1".to_string())?;
    if url.host_str().is_none() || !url.username().is_empty() || url.password().is_some()
        || url.query().is_some() || url.fragment().is_some() {
        return Err("接口地址不能包含用户名、密码、查询参数或片段".into());
    }
    if url.scheme() != "https" && !(url.scheme() == "http" && is_loopback(&url)) {
        return Err("接口需使用 HTTPS；仅本机 localhost / 回环地址可使用 HTTP".into());
    }
    let path = url.path().trim_end_matches('/');
    let path = if path.is_empty() { "/" } else { path };
    let path = path.to_string();
    url.set_path(&path);
    Ok(url)
}

fn endpoint(base: &reqwest::Url, resource: &str) -> String {
    let value = base.as_str().trim_end_matches('/');
    let prefix = value.strip_suffix("/chat/completions")
        .or_else(|| value.strip_suffix("/responses")).unwrap_or(value);
    format!("{prefix}/{resource}")
}

fn validate_settings(input: &CustomAiConfigInput, require_model: bool) -> Result<reqwest::Url, String> {
    let url = normalize_base_url(&input.base_url)?;
    if require_model && input.model.trim().is_empty() { return Err("请填写模型 ID".into()); }
    if input.model.len() > 512 { return Err("模型 ID 过长".into()); }
    if input.prompt.len() > 16000 { return Err("识别提示词不能超过 16000 字节".into()); }
    if !input.temperature.is_finite() || !(0.0..=2.0).contains(&input.temperature) {
        return Err("Temperature 需在 0 到 2 之间".into());
    }
    if !(10..=300).contains(&input.timeout_seconds) { return Err("请求超时需为 10 到 300 秒".into()); }
    if let Some(key) = &input.api_key {
        if key.len() > 8192 || key.chars().any(|c| c == '\r' || c == '\n' || c == '\0') {
            return Err("API Key 格式不正确".into());
        }
    }
    if input.clear_api_key && input.api_key.as_ref().is_some_and(|key| !key.trim().is_empty()) {
        return Err("请在重新输入 API Key 与清除已保存密钥之间选择一项".into());
    }
    Ok(url)
}

fn resolve_config(input: CustomAiConfigInput, old: Option<&StoredConfig>, require_model: bool) -> Result<ResolvedConfig, String> {
    let base_url = validate_settings(&input, require_model)?;
    let entered_key = input.api_key.as_deref().unwrap_or("").trim();
    let api_key = if input.clear_api_key { String::new() }
        else if !entered_key.is_empty() { entered_key.to_string() }
        else if let Some(old) = old {
            if let Some(protected) = old.protected_api_key.as_ref().filter(|key| !key.is_empty()) {
                let previous = normalize_base_url(&old.base_url)?;
                if previous.origin() != base_url.origin() {
                    return Err("接口服务器已改变，请重新输入 API Key；旧密钥不会发送到新服务器".into());
                }
                unprotect_key(protected)?
            } else { String::new() }
        } else { String::new() };
    Ok(ResolvedConfig {
        base_url, api_format: input.api_format, api_key, model: input.model.trim().to_string(),
        prompt: if input.prompt.trim().is_empty() { DEFAULT_PROMPT.to_string() } else { input.prompt.trim().to_string() },
        temperature: input.temperature, timeout_seconds: input.timeout_seconds,
    })
}

fn input_from_stored(stored: &StoredConfig) -> CustomAiConfigInput {
    CustomAiConfigInput { base_url: stored.base_url.clone(), api_format: stored.api_format, api_key: None, clear_api_key: false,
        model: stored.model.clone(), prompt: stored.prompt.clone(), temperature: stored.temperature,
        timeout_seconds: stored.timeout_seconds }
}

fn new_config_view() -> CustomAiConfigView {
    CustomAiConfigView { base_url: String::new(), api_format: ApiFormat::Responses, model: String::new(),
        prompt: DEFAULT_PROMPT.to_string(), temperature: 0.0, timeout_seconds: default_timeout(), has_api_key: false }
}

#[tauri::command]
pub fn get_custom_ai_config(app: AppHandle) -> Result<CustomAiConfigView, String> {
    Ok(match read_config(&app)? {
        Some(stored) => view(&stored),
        None => new_config_view(),
    })
}

#[tauri::command]
pub fn save_custom_ai_config(app: AppHandle, config: CustomAiConfigInput) -> Result<CustomAiConfigView, String> {
    let old = read_config(&app)?;
    let resolved = resolve_config(config, old.as_ref(), true)?;
    let stored = StoredConfig {
        base_url: resolved.base_url.to_string(), api_format: resolved.api_format, model: resolved.model,
        prompt: resolved.prompt, temperature: resolved.temperature, timeout_seconds: resolved.timeout_seconds,
        protected_api_key: if resolved.api_key.is_empty() { None } else { Some(protect_key(&resolved.api_key)?) },
    };
    let path = config_path(&app)?;
    let parent = path.parent().ok_or("无法定位配置目录")?;
    std::fs::create_dir_all(parent).map_err(|_| "无法创建自定义 AI 配置目录".to_string())?;
    let data = serde_json::to_vec_pretty(&stored).map_err(|_| "无法序列化 AI 配置".to_string())?;
    std::fs::write(path, data).map_err(|_| "保存 AI 配置失败，请检查目录权限".to_string())?;
    Ok(view(&stored))
}

pub fn configured_model(app: &AppHandle) -> Option<(String, bool)> {
    let stored = read_config(app).ok()??;
    let url = validate_settings(&input_from_stored(&stored), true).ok()?;
    let ready = is_loopback(&url) || stored.protected_api_key.as_ref().is_some_and(|key| !key.is_empty());
    Some((stored.model, ready))
}

fn client(config: &ResolvedConfig) -> Result<reqwest::Client, String> {
    // The updater also uses ring, but its first check may not have run yet.
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .timeout(Duration::from_secs(config.timeout_seconds))
        .connect_timeout(Duration::from_secs(config.timeout_seconds.min(15)))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| "无法初始化 AI 接口连接".to_string())
}

fn request_builder(config: &ResolvedConfig, builder: reqwest::RequestBuilder) -> Result<reqwest::RequestBuilder, String> {
    if config.api_key.is_empty() {
        if !is_loopback(&config.base_url) { return Err("请填写 API Key；只有本机接口允许不填密钥".into()); }
        Ok(builder)
    } else { Ok(builder.bearer_auth(&config.api_key)) }
}

fn network_error(error: reqwest::Error) -> String {
    if error.is_timeout() { "AI 接口请求超时，请检查地址或增加超时时间".into() }
    else if error.is_connect() { "无法连接 AI 接口，请检查网络、服务地址与端口".into() }
    else { "AI 接口请求失败，请检查接口格式与服务状态".into() }
}

fn http_error_summary(status: u16) -> String {
    match status {
            401 | 403 => "接口认证失败，请检查 API Key 与模型访问权限".to_string(),
            404 => "接口或模型不存在，请检查 Base URL 和模型 ID".to_string(),
            413 => "接口拒绝了图片大小，请使用更小的图片".to_string(),
            429 => "接口调用受限，请检查额度或稍后再试".to_string(),
            400 | 422 => "接口拒绝了识别请求，请确认模型支持图片输入及所选 API 协议".to_string(),
            300..=399 => "接口返回重定向，请填写最终接口地址（为保护密钥不会自动跳转）".to_string(),
            _ => "AI 服务请求失败，请稍后重试".to_string(),
    }
}

fn safe_server_reason(message: &str, api_key: &str) -> Option<String> {
    let lower = message.to_ascii_lowercase();
    // Error messages sometimes echo an entire image payload; omit that detail completely.
    if lower.contains("data:image") || lower.contains("base64,") { return None; }
    let masked = if api_key.is_empty() { message.to_string() }
        else { message.replace(api_key, "[已隐藏密钥]") };
    let characters: Vec<char> = masked.chars().map(|character| {
        if character.is_control() || matches!(character, '\u{200b}'..='\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2060}'..='\u{2069}' | '\u{feff}') { ' ' } else { character }
    }).collect();
    let starts = |position: usize, word: &str| characters[position..].iter().take(word.len())
        .map(char::to_ascii_lowercase).eq(word.chars());
    let token_character = |character: char| character.is_ascii_alphanumeric() || "-_+/=.".contains(character);
    let mut result = String::new();
    let mut position = 0;
    while position < characters.len() {
        if starts(position, "bearer") {
            result.push_str("Bearer [已隐藏]");
            position += 6;
            while position < characters.len() && (characters[position].is_whitespace() || matches!(characters[position], ':' | '=' | '\'' | '"' | '`')) { position += 1; }
            while position < characters.len() && !characters[position].is_whitespace() && !matches!(characters[position], ',' | ';' | '\'' | '"' | '`' | ')' | ']' | '}') { position += 1; }
        } else if starts(position, "sk-") {
            result.push_str("[已隐藏密钥]");
            position += 3;
            while position < characters.len() && token_character(characters[position]) { position += 1; }
        } else if token_character(characters[position]) {
            let start = position;
            while position < characters.len() && token_character(characters[position]) {
                if position > start && (starts(position, "sk-") || starts(position, "bearer")) { break; }
                position += 1;
            }
            if position - start >= 64 { result.push_str("[已隐藏长令牌]"); }
            else { result.extend(characters[start..position].iter().copied()); }
        } else {
            result.push(characters[position]); position += 1;
        }
    }
    let result = result.split_whitespace().collect::<Vec<_>>().join(" ");
    if result.is_empty() { None } else { Some(result) }
}

fn http_error(status: u16, value: Option<&Value>, api_key: &str, extra: Option<&str>) -> String {
    let reason = value.and_then(|value| ["/error/message", "/error/msg", "/message", "/msg"].iter()
        .find_map(|path| value.pointer(path).and_then(Value::as_str)))
        .and_then(|message| safe_server_reason(message, api_key));
    let mut message = format!("HTTP {status} · {}", http_error_summary(status));
    if let Some(reason) = reason { message.push_str("；服务端原因："); message.push_str(&reason); }
    if let Some(extra) = extra { message.push_str("；"); message.push_str(extra); }
    message.chars().take(500).collect()
}

async fn read_json(mut response: reqwest::Response, api_key: &str) -> Result<Value, String> {
    let status = response.status();
    let limit = if status.is_success() { MAX_RESPONSE_BYTES } else { MAX_ERROR_RESPONSE_BYTES };
    let oversized = || if status.is_success() { "AI 接口返回内容过大".to_string() }
        else { http_error(status.as_u16(), None, api_key, Some("服务端错误信息过大，未展示")) };
    if response.content_length().is_some_and(|size| size > limit as u64) { return Err(oversized()); }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| if status.is_success() { network_error(error) }
        else { http_error(status.as_u16(), None, api_key, Some("服务端错误信息读取失败")) })? {
        if body.len() + chunk.len() > limit { return Err(oversized()); }
        body.extend_from_slice(&chunk);
    }
    let value = serde_json::from_slice(&body);
    if !status.is_success() { return Err(http_error(status.as_u16(), value.as_ref().ok(), api_key, None)); }
    value.map_err(|_| "AI 接口未返回有效 JSON，请检查接口地址与协议".into())
}

fn clean_latex(text: &str) -> String {
    let mut text = text.trim();
    if text.starts_with("```") && text.ends_with("```") {
        text = text.strip_prefix("```").unwrap_or(text);
        if let Some((first, rest)) = text.split_once('\n') {
            if matches!(first.trim().to_lowercase().as_str(), "latex" | "tex" | "math" | "") { text = rest; }
        }
        text = text.strip_suffix("```").unwrap_or(text).trim();
    }
    for (start, end) in [("\\[", "\\]"), ("\\(", "\\)"), ("$$", "$$"), ("$", "$")] {
        if text.starts_with(start) && text.ends_with(end) && text.len() >= start.len() + end.len() {
            text = text[start.len()..text.len() - end.len()].trim();
            break;
        }
    }
    text.to_string()
}

fn parse_latex(value: &Value) -> Result<String, String> {
    let choice = value.pointer("/choices/0").ok_or("AI 接口没有返回识别结果，请检查模型与协议")?;
    if choice.get("finish_reason").and_then(Value::as_str) == Some("length") {
        return Err("AI 返回的公式被截断，请缩小图片或减少公式内容".into());
    }
    if choice.get("finish_reason").and_then(Value::as_str) == Some("content_filter")
        || choice.pointer("/message/refusal").is_some_and(|refusal| !refusal.is_null() && refusal.as_str() != Some("")) {
        return Err("AI 模型拒绝处理这张图片，请更换图片或模型".into());
    }
    let content = choice.pointer("/message/content").ok_or("AI 模型未返回文本内容")?;
    let text = if let Some(text) = content.as_str() { text.to_string() }
        else if let Some(parts) = content.as_array() {
            parts.iter().filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>().join("\n")
        } else { return Err("AI 返回内容格式不受支持".into()); };
    let latex = clean_latex(&text);
    if latex.is_empty() { return Err("AI 模型返回了空内容，请确认模型支持图片识别".into()); }
    Ok(latex)
}

fn parse_responses_latex(value: &Value) -> Result<String, String> {
    if value.get("error").is_some_and(|error| !error.is_null()) {
        return Err("AI 服务未能完成识别，请检查模型与接口设置后重试".into());
    }
    match value.get("status").and_then(Value::as_str) {
        Some("completed") => {}
        Some("incomplete") => return Err("AI 返回的公式不完整，请缩小图片或减少公式内容后重试".into()),
        Some("failed" | "cancelled") => return Err("AI 识别任务未能完成，请稍后重试".into()),
        Some("queued" | "in_progress") => return Err("AI 接口尚未返回最终结果，请检查接口是否支持同步 Responses 请求".into()),
        _ => return Err("AI 接口未返回有效的 Responses 完成状态，请检查 API 协议".into()),
    }
    let output = value.get("output").and_then(Value::as_array)
        .ok_or("AI 接口未返回 Responses 输出，请检查 API 协议")?;
    let mut texts = Vec::new();
    for item in output {
        // Reasoning, tool calls and other non-message items are never formula output.
        if item.get("type").and_then(Value::as_str) != Some("message")
            || item.get("role").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        if item.get("status").and_then(Value::as_str).is_some_and(|status| status != "completed") {
            return Err("AI 返回的消息不完整，请重试".into());
        }
        let content = item.get("content").and_then(Value::as_array)
            .ok_or("AI 返回的消息格式有误，请检查 API 协议")?;
        for part in content {
            match part.get("type").and_then(Value::as_str) {
                Some("refusal") => return Err("AI 模型拒绝处理这张图片，请更换图片或模型".into()),
                Some("output_text") => {
                    let text = part.get("text").and_then(Value::as_str)
                        .ok_or("AI 返回的文本格式有误，请检查 API 协议")?;
                    texts.push(text);
                }
                _ => {}
            }
        }
    }
    let latex = clean_latex(&texts.join("\n"));
    if latex.is_empty() { return Err("AI 模型返回了空内容，请确认模型支持图片识别".into()); }
    Ok(latex)
}

fn image_data_url(request: &RecognizeRequest) -> Result<String, String> {
    let input = request.image_base64.trim();
    if input.len() > (MAX_IMAGE_BYTES * 4 / 3) + 1024 { return Err("图片不能超过 12 MB".into()); }
    let (mime, encoded) = if let Some(rest) = input.strip_prefix("data:") {
        let (header, encoded) = rest.split_once(',').ok_or("图片数据格式有误")?;
        (header.strip_suffix(";base64").ok_or("图片需使用 Base64 格式")?, encoded)
    } else { (request.mime.as_deref().unwrap_or("image/png"), input) };
    if !matches!(mime, "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/bmp") {
        return Err("不支持此图片格式，请选择 PNG、JPG、WebP、GIF 或 BMP".into());
    }
    let image = STANDARD.decode(encoded).map_err(|_| "图片 Base64 数据无效")?;
    if image.is_empty() || image.len() > MAX_IMAGE_BYTES { return Err("图片为空或超过 12 MB".into()); }
    Ok(format!("data:{mime};base64,{encoded}"))
}

async fn call_recognition(config: &ResolvedConfig, data_url: String) -> Result<String, String> {
    let (resource, payload) = match config.api_format {
        ApiFormat::Responses => ("responses", json!({
            "model": config.model, "instructions": config.prompt, "stream": false, "store": false,
            "input": [{"role": "user", "content": [
                {"type": "input_text", "text": "请将这张图片中的公式转为 LaTeX。"},
                {"type": "input_image", "image_url": data_url, "detail": "auto"}
            ]}]
        })),
        ApiFormat::ChatCompletions => ("chat/completions", json!({
            "model": config.model, "temperature": config.temperature, "stream": false,
            "messages": [
                {"role": "system", "content": config.prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": "请将这张图片中的公式转为 LaTeX。"},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]}
            ]
        })),
    };
    let endpoint = endpoint(&config.base_url, resource);
    let request = request_builder(config, client(config)?.post(endpoint).json(&payload))?;
    let response = read_json(request.send().await.map_err(network_error)?, &config.api_key).await?;
    match config.api_format {
        ApiFormat::Responses => parse_responses_latex(&response),
        ApiFormat::ChatCompletions => parse_latex(&response),
    }
}

#[tauri::command]
pub async fn test_custom_ai_config(app: AppHandle, config: CustomAiConfigInput) -> Result<ConnectionTestResult, String> {
    let old = read_config(&app)?;
    let config = resolve_config(config, old.as_ref(), true)?;
    let start = Instant::now();
    let latex = call_recognition(&config, format!("data:image/png;base64,{}", STANDARD.encode(TEST_IMAGE))).await?;
    let canonical: String = latex.chars().filter(|character| !character.is_whitespace()).collect();
    if canonical.replace("\\left", "").replace("\\right", "").replace(['{', '}'], "") != "x+1=2" {
        return Err("接口已连通，但未正确识别内置测试公式；请确认模型支持视觉识别，并检查提示词".into());
    }
    Ok(ConnectionTestResult { message: "连接成功，模型已正确识别测试图片：x + 1 = 2".into(), elapsed_ms: start.elapsed().as_millis() as u64 })
}

#[tauri::command]
pub async fn list_custom_ai_models(app: AppHandle, config: CustomAiConfigInput) -> Result<Vec<String>, String> {
    let old = read_config(&app)?;
    let config = resolve_config(config, old.as_ref(), false)?;
    let endpoint = endpoint(&config.base_url, "models");
    let request = request_builder(&config, client(&config)?.get(endpoint))?;
    let data = read_json(request.send().await.map_err(network_error)?, &config.api_key).await?;
    let mut models: Vec<String> = data.get("data").and_then(Value::as_array)
        .ok_or("模型列表格式不受支持，请手动填写模型 ID")?.iter()
        .filter_map(|item| item.get("id").and_then(Value::as_str))
        .filter(|id| !id.trim().is_empty() && id.len() <= 512)
        .take(2000).map(str::to_string).collect();
    models.sort(); models.dedup();
    if models.is_empty() { return Err("接口没有返回模型列表，请手动填写模型 ID".into()); }
    Ok(models)
}

pub async fn recognize(app: &AppHandle, request: &RecognizeRequest) -> Result<RecognizeResponse, String> {
    let stored = read_config(app)?.ok_or("请先在设置中保存自定义 AI 配置")?;
    let config = resolve_config(input_from_stored(&stored), Some(&stored), true)?;
    let data_url = image_data_url(request)?;
    let start = Instant::now();
    let latex = call_recognition(&config, data_url).await?;
    Ok(RecognizeResponse { success: true, latex: Some(latex), confidence: None,
        elapsed_ms: Some(start.elapsed().as_millis() as u64), engine: Some(format!("custom-ai/{}", config.model)), error: None })
}

#[cfg(windows)]
mod dpapi {
    use std::{ffi::c_void, ptr};
    #[repr(C)]
    struct Blob { size: u32, data: *mut u8 }
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(input: *const Blob, description: *const u16, entropy: *const Blob,
            reserved: *mut c_void, prompt: *mut c_void, flags: u32, output: *mut Blob) -> i32;
        fn CryptUnprotectData(input: *const Blob, description: *mut *mut u16, entropy: *const Blob,
            reserved: *mut c_void, prompt: *mut c_void, flags: u32, output: *mut Blob) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" { fn LocalFree(memory: *mut c_void) -> *mut c_void; }

    pub fn transform(bytes: &[u8], protect: bool) -> Result<Vec<u8>, String> {
        let input = Blob { size: bytes.len() as u32, data: bytes.as_ptr() as *mut u8 };
        let mut output = Blob { size: 0, data: ptr::null_mut() };
        // CRYPTPROTECT_UI_FORBIDDEN: bind the secret to this Windows user without prompting.
        let succeeded = unsafe { if protect {
            CryptProtectData(&input, ptr::null(), ptr::null(), ptr::null_mut(), ptr::null_mut(), 1, &mut output)
        } else {
            CryptUnprotectData(&input, ptr::null_mut(), ptr::null(), ptr::null_mut(), ptr::null_mut(), 1, &mut output)
        } };
        if succeeded == 0 { return Err(if protect { "无法使用 Windows 加密保护 API Key" } else { "无法解密已保存 API Key，请重新输入" }.into()); }
        let result = unsafe { std::slice::from_raw_parts(output.data, output.size as usize).to_vec() };
        unsafe { LocalFree(output.data.cast()); }
        Ok(result)
    }
}

fn protect_key(key: &str) -> Result<String, String> {
    #[cfg(windows)] { return dpapi::transform(key.as_bytes(), true).map(|bytes| STANDARD.encode(bytes)); }
    #[cfg(not(windows))] { let _ = key; Err("此版本仅支持 Windows 加密保存 API Key".into()) }
}

fn unprotect_key(protected: &str) -> Result<String, String> {
    #[cfg(windows)] {
        let bytes = STANDARD.decode(protected).map_err(|_| "已保存密钥格式有误，请重新输入")?;
        return String::from_utf8(dpapi::transform(&bytes, false)?).map_err(|_| "已保存密钥格式有误，请重新输入".into());
    }
    #[cfg(not(windows))] { let _ = protected; Err("此版本仅支持 Windows 解密 API Key".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_crc32(bytes: &[u8]) -> u32 {
        let mut crc = !0u32;
        for byte in bytes {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = (crc >> 1) ^ (0xedb88320 & 0u32.wrapping_sub(crc & 1));
            }
        }
        !crc
    }

    #[test]
    fn embedded_connection_image_is_a_complete_rgb_png_with_valid_crcs() {
        let bytes = TEST_IMAGE;
        assert!(bytes.len() >= 8);
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");
        let mut offset = 8usize;
        let (mut has_ihdr, mut has_idat, mut has_iend) = (false, false, false);
        while offset < bytes.len() {
            assert!(bytes.len() - offset >= 12, "truncated PNG chunk header");
            let length = u32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
            let data_start = offset + 8;
            let data_end = data_start.checked_add(length).expect("PNG chunk length overflow");
            let chunk_end = data_end.checked_add(4).expect("PNG chunk CRC offset overflow");
            assert!(chunk_end <= bytes.len(), "PNG chunk exceeds image bounds");
            let kind = &bytes[offset + 4..data_start];
            let expected_crc = u32::from_be_bytes(bytes[data_end..chunk_end].try_into().unwrap());
            assert_eq!(png_crc32(&bytes[offset + 4..data_end]), expected_crc, "invalid PNG chunk CRC");
            if offset == 8 { assert_eq!(kind, b"IHDR"); }
            match kind {
                b"IHDR" => {
                    assert!(!has_ihdr, "duplicate IHDR");
                    assert_eq!(length, 13);
                    assert!(u32::from_be_bytes(bytes[data_start..data_start + 4].try_into().unwrap()) > 0);
                    assert!(u32::from_be_bytes(bytes[data_start + 4..data_start + 8].try_into().unwrap()) > 0);
                    assert_eq!(bytes[data_start + 8], 8, "fixture must use 8-bit samples");
                    assert_eq!(bytes[data_start + 9], 2, "fixture must use RGB colour type");
                    assert_eq!(&bytes[data_start + 10..data_start + 12], &[0, 0]);
                    assert!(bytes[data_start + 12] <= 1);
                    has_ihdr = true;
                }
                b"IDAT" => { assert!(has_ihdr); assert!(length > 0); has_idat = true; }
                b"IEND" => { assert_eq!(length, 0); assert!(has_idat); has_iend = true; }
                _ => {}
            }
            offset = chunk_end;
            if has_iend { break; }
        }
        assert!(has_ihdr && has_idat && has_iend);
        assert_eq!(offset, bytes.len(), "unexpected data after IEND");
    }

    fn assert_fixture_data_url(value: &Value) {
        let encoded = value.as_str().unwrap().strip_prefix("data:image/png;base64,").unwrap();
        assert_eq!(STANDARD.decode(encoded).unwrap().as_slice(), TEST_IMAGE);
    }

    fn input(base_url: &str) -> CustomAiConfigInput {
        CustomAiConfigInput { base_url: base_url.into(), api_format: ApiFormat::ChatCompletions, api_key: None, clear_api_key: false,
            model: "vision-model".into(), prompt: String::new(), temperature: 0.0, timeout_seconds: 60 }
    }

    #[test]
    fn preserves_old_config_protocol_and_defaults_new_config_to_responses() {
        let old = json!({"baseUrl":"https://api.example.com/v1", "model":"vision-model", "prompt":"",
            "temperature":0.0, "timeoutSeconds":60});
        let stored: StoredConfig = serde_json::from_value(old.clone()).unwrap();
        let input: CustomAiConfigInput = serde_json::from_value(old).unwrap();
        assert_eq!(stored.api_format, ApiFormat::ChatCompletions);
        assert_eq!(input.api_format, ApiFormat::ChatCompletions);
        assert_eq!(input_from_stored(&stored).api_format, ApiFormat::ChatCompletions);
        assert_eq!(serde_json::to_value(view(&stored)).unwrap()["apiFormat"], "chat-completions");
        assert_eq!(new_config_view().api_format, ApiFormat::Responses);
        assert_eq!(serde_json::to_value(new_config_view()).unwrap()["apiFormat"], "responses");
        assert!(serde_json::from_value::<ApiFormat>(json!("unknown")).is_err());
    }

    #[test]
    fn normalizes_urls_and_restricts_plaintext() {
        assert_eq!(normalize_base_url("https://api.example.com").unwrap().as_str(), "https://api.example.com/");
        assert_eq!(normalize_base_url("https://api.example.com/v1/chat/completions/").unwrap().as_str(), "https://api.example.com/v1/chat/completions");
        assert_eq!(endpoint(&normalize_base_url("https://api.example.com/chat/completions").unwrap(), "chat/completions"), "https://api.example.com/chat/completions");
        assert_eq!(endpoint(&normalize_base_url("https://api.example.com/v1/chat/completions").unwrap(), "models"), "https://api.example.com/v1/models");
        for (url, resource, expected) in [
            ("https://api.example.com", "responses", "https://api.example.com/responses"),
            ("https://api.example.com/", "models", "https://api.example.com/models"),
            ("https://api.example.com/v1", "models", "https://api.example.com/v1/models"),
            ("https://api.example.com/responses", "responses", "https://api.example.com/responses"),
            ("https://api.example.com/responses", "chat/completions", "https://api.example.com/chat/completions"),
            ("https://api.example.com/chat/completions", "responses", "https://api.example.com/responses"),
            ("https://api.example.com/responses", "models", "https://api.example.com/models"),
            ("https://api.example.com/v1/responses/", "models", "https://api.example.com/v1/models"),
            ("https://api.example.com/v1/responses", "chat/completions", "https://api.example.com/v1/chat/completions"),
            ("https://api.example.com/v1/chat/completions", "responses", "https://api.example.com/v1/responses"),
            ("https://api.example.com/v1", "responses", "https://api.example.com/v1/responses"),
        ] {
            assert_eq!(endpoint(&normalize_base_url(url).unwrap(), resource), expected);
        }
        assert!(normalize_base_url("http://127.0.0.1:1234/v1").is_ok());
        assert!(normalize_base_url("http://[::1]:1234/v1").is_ok());
        for url in ["http://example.com/v1", "https://secret@example.com/v1", "https://api.example.com/v1?key=secret", "file:///foo"] {
            assert!(normalize_base_url(url).is_err(), "{url}");
        }
    }

    #[test]
    fn parses_compatible_text_and_refuses_truncated_results() {
        assert_eq!(parse_latex(&json!({"choices":[{"message":{"content":"```latex\n\\[ x^2 \\]\n```"}}]})).unwrap(), "x^2");
        assert_eq!(parse_latex(&json!({"choices":[{"message":{"content":[{"type":"text","text":"$$x+1=2$$"}]}}]})).unwrap(), "x+1=2");
        assert!(parse_latex(&json!({"choices":[{"finish_reason":"length","message":{"content":"x"}}]})).is_err());
        assert!(parse_latex(&json!({"choices":[{"message":{"content":" "}}]})).is_err());
        assert!(parse_latex(&json!({"choices":[{"message":{"content":"x","refusal":"private service text"}}]})).is_err());
    }

    #[test]
    fn responses_parser_reads_assistant_text_after_reasoning_only() {
        let response = json!({"status":"completed", "output":[
            {"type":"reasoning", "summary":[{"type":"summary_text","text":"do not render reasoning"}]},
            {"type":"message", "role":"user", "content":[{"type":"output_text","text":"do not render user"}]},
            {"type":"message", "role":"assistant", "status":"completed", "content":[{"type":"output_text","text":"\\[x+1=2\\]","annotations":[]}]}
        ]});
        assert_eq!(parse_responses_latex(&response).unwrap(), "x+1=2");
        let separated = json!({"status":"completed", "output":[
            {"type":"message", "role":"assistant", "content":[
                {"type":"output_text","text":"x=1"}, {"type":"output_text","text":"y=2"}
            ]}
        ]});
        assert_eq!(parse_responses_latex(&separated).unwrap(), "x=1\ny=2");
    }

    #[test]
    fn responses_parser_rejects_unfinished_refused_and_empty_outputs() {
        for status in ["failed", "incomplete", "cancelled", "queued", "in_progress"] {
            let response = json!({"status":status, "output":[
                {"type":"message","role":"assistant","content":[{"type":"output_text","text":"x=1"}]}
            ]});
            assert!(parse_responses_latex(&response).is_err(), "{status}");
        }
        for response in [
            json!({"status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"x=1"},{"type":"refusal","refusal":"private refusal detail"}]}]}),
            json!({"status":"completed","output":[{"type":"message","role":"assistant","status":"incomplete","content":[{"type":"output_text","text":"x=1"}]}]}),
            json!({"status":"completed","output":[{"type":"reasoning","summary":[{"type":"summary_text","text":"reasoning only"}]}]}),
            json!({"status":"completed","output":[],"output_text":"SDK helper must not be used"}),
            json!({"status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":" "}]}]}),
            json!({"status":"completed","error":{"message":"private provider detail"},"output":[]}),
            json!({"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"x=1"}]}]}),
        ] {
            let error = parse_responses_latex(&response).unwrap_err();
            assert!(!error.contains("private"));
        }
    }

    #[test]
    fn validates_settings_and_image_payloads() {
        let mut config = input("http://localhost:1234/v1");
        config.temperature = 2.1; assert!(validate_settings(&config, true).is_err());
        config.temperature = 0.0; config.timeout_seconds = 301; assert!(validate_settings(&config, true).is_err());
        config.timeout_seconds = 60; config.model.clear();
        assert!(validate_settings(&config, false).is_ok()); assert!(validate_settings(&config, true).is_err());
        let image = RecognizeRequest { image_base64: format!("data:image/png;base64,{}", STANDARD.encode(TEST_IMAGE)), mime: None, model: None };
        assert!(image_data_url(&image).is_ok());
        let invalid = RecognizeRequest { image_base64: "data:image/svg+xml;base64,AAAA".into(), mime: None, model: None };
        assert!(image_data_url(&invalid).is_err());
    }

    #[test]
    fn never_reuses_stored_key_at_new_origin() {
        let old = StoredConfig { base_url: "https://old.example/v1".into(), model: "m".into(), prompt: String::new(),
            api_format: ApiFormat::ChatCompletions, temperature: 0.0, timeout_seconds: 60, protected_api_key: Some("opaque".into()) };
        assert!(resolve_config(input("https://new.example/v1"), Some(&old), true).err().unwrap().contains("服务器已改变"));
        let mut changed = input("https://new.example/v1"); changed.clear_api_key = true;
        assert!(resolve_config(changed, Some(&old), true).unwrap().api_key.is_empty());
    }

    fn mock_raw_server<F>(status: u16, body: String, inspect: F) -> (std::net::SocketAddr, std::thread::JoinHandle<()>)
    where F: FnOnce(&str, &Value) + Send + 'static {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            let mut request = Vec::new(); let mut buffer = [0u8; 4096];
            loop {
                let count = stream.read(&mut buffer).unwrap(); if count == 0 { break; }
                request.extend_from_slice(&buffer[..count]);
                if let Some(end) = request.windows(4).position(|window| window == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length: usize = headers.lines().find_map(|line| line.to_lowercase().strip_prefix("content-length:").map(|length| length.trim().parse().unwrap())).unwrap_or(0);
                    if request.len() >= end + 4 + length { break; }
                }
            }
            let text = String::from_utf8(request).unwrap();
            let (headers, payload) = text.split_once("\r\n\r\n").unwrap();
            inspect(headers, &if payload.is_empty() { Value::Null } else { serde_json::from_str(payload).unwrap() });
            // Large-response tests deliberately close the client without consuming the body.
            let _ = write!(stream, "HTTP/1.1 {status} Mock\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        });
        (address, server)
    }

    fn mock_server<F>(response: Value, inspect: F) -> (std::net::SocketAddr, std::thread::JoinHandle<()>)
    where F: FnOnce(&str, &Value) + Send + 'static {
        mock_raw_server(200, response.to_string(), inspect)
    }

    fn read_mock_json(status: u16, body: String, api_key: &str) -> Result<Value, String> {
        let (address, server) = mock_raw_server(status, body, |headers, _| {
            assert!(headers.starts_with("GET /error "));
        });
        let config = resolve_config(input(&format!("http://{address}")), None, true).unwrap();
        let result = tauri::async_runtime::block_on(async {
            let response = client(&config).unwrap().get(format!("http://{address}/error")).send().await.unwrap();
            read_json(response, api_key).await
        });
        server.join().unwrap(); result
    }

    #[test]
    fn mock_http_errors_show_status_and_structured_server_reason() {
        for field in ["message", "msg"] {
            let body = json!({"error":{(field):"model does not support this parameter"}}).to_string();
            let error = read_mock_json(400, body, "").unwrap_err();
            assert!(error.starts_with("HTTP 400"));
            assert!(error.contains("所选 API 协议"));
            assert!(error.contains("model does not support this parameter"));
        }
    }

    #[test]
    fn error_reason_redacts_credentials_before_limiting_display() {
        let api_key = format!("private-{}", "k".repeat(600));
        let reason = format!("{} key={} auth=Bearer opaque-secret api_key=sk-unknown-secret\r\n{}", "错".repeat(100), api_key, "A".repeat(100));
        let error = http_error(422, Some(&json!({"error":{"message":reason}})), &api_key, None);
        assert!(error.starts_with("HTTP 422"));
        assert!(error.chars().count() <= 500);
        assert!(!error.contains("private-"));
        assert!(!error.contains("opaque-secret"));
        assert!(!error.contains("sk-unknown-secret"));
        assert!(!error.contains(&"A".repeat(64)));
        assert!(!error.chars().any(char::is_control));
        for echoed_image in ["bad image data:image/png;BASE64,AAAA", "invalid base64,AAAA"] {
            let error = http_error(400, Some(&json!({"error":{"message":echoed_image}})), "", None);
            assert!(!error.contains("服务端原因"));
        }
        let decode_error = http_error(400, Some(&json!({"error":{"message":"invalid base64 payload"}})), "", None);
        assert!(decode_error.contains("服务端原因：invalid base64 payload"));
        let long = read_mock_json(400, json!({"error":{"message":"错".repeat(1000)}}).to_string(), "").unwrap_err();
        assert_eq!(long.chars().count(), 500);
    }

    #[test]
    fn mock_http_errors_do_not_echo_raw_or_oversized_bodies() {
        let invalid = read_mock_json(400, "private raw body is not JSON".into(), "").unwrap_err();
        assert!(invalid.starts_with("HTTP 400"));
        assert!(!invalid.contains("private raw body"));
        let oversized = read_mock_json(422, "x".repeat(MAX_ERROR_RESPONSE_BYTES + 1), "").unwrap_err();
        assert!(oversized.starts_with("HTTP 422"));
        assert!(oversized.contains("错误信息过大"));
        assert_eq!(read_mock_json(200, "x".repeat(MAX_RESPONSE_BYTES + 1), "").unwrap_err(), "AI 接口返回内容过大");
        assert_eq!(read_mock_json(200, "not json".into(), "").unwrap_err(), "AI 接口未返回有效 JSON，请检查接口地址与协议");
    }

    #[test]
    fn mock_server_receives_chat_image_request_and_returns_latex() {
        let (address, server) = mock_server(json!({"choices":[{"message":{"content":"\\[x+1=2\\]"}}]}), |headers, payload| {
            assert!(headers.starts_with("POST /v1/chat/completions "));
            assert_eq!(payload["model"], "vision-model");
            assert_eq!(payload["temperature"], 0.0);
            assert_eq!(payload["messages"][0]["role"], "system");
            assert_eq!(payload["messages"][1]["content"][1]["type"], "image_url");
            assert_fixture_data_url(&payload["messages"][1]["content"][1]["image_url"]["url"]);
            assert!(payload.get("input").is_none());
        });
        let config = resolve_config(input(&format!("http://{address}/v1")), None, true).unwrap();
        let result = tauri::async_runtime::block_on(call_recognition(&config, format!("data:image/png;base64,{}", STANDARD.encode(TEST_IMAGE))));
        assert_eq!(result.unwrap(), "x+1=2"); server.join().unwrap();
    }

    #[test]
    fn mock_server_receives_responses_schema_and_parses_raw_output() {
        let (address, server) = mock_server(json!({"status":"completed", "output":[
            {"type":"reasoning", "summary":[]},
            {"type":"message", "role":"assistant", "status":"completed", "content":[{"type":"output_text","text":"\\[x+1=2\\]"}]}
        ]}), |headers, payload| {
            assert!(headers.starts_with("POST /responses "));
            assert_eq!(payload["model"], "vision-model");
            assert_eq!(payload["instructions"], DEFAULT_PROMPT);
            assert_eq!(payload["store"], false);
            assert_eq!(payload["stream"], false);
            assert!(payload.get("temperature").is_none());
            assert!(payload.get("messages").is_none());
            assert_eq!(payload["input"][0]["role"], "user");
            assert_eq!(payload["input"][0]["content"][0]["type"], "input_text");
            let image = &payload["input"][0]["content"][1];
            assert_eq!(image["type"], "input_image");
            assert_eq!(image["detail"], "auto");
            assert_fixture_data_url(&image["image_url"]);
        });
        let mut config_input = input(&format!("http://{address}"));
        config_input.api_format = ApiFormat::Responses;
        let config = resolve_config(config_input, None, true).unwrap();
        let result = tauri::async_runtime::block_on(call_recognition(&config, format!("data:image/png;base64,{}", STANDARD.encode(TEST_IMAGE))));
        assert_eq!(result.unwrap(), "x+1=2"); server.join().unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn windows_dpapi_round_trip() {
        let protected = protect_key("test-key-not-a-real-secret").unwrap();
        assert!(!protected.contains("test-key"));
        assert_eq!(unprotect_key(&protected).unwrap(), "test-key-not-a-real-secret");
    }

    #[cfg(windows)]
    #[test]
    fn switching_protocol_at_same_origin_keeps_synthetic_key() {
        let old = StoredConfig { base_url: "https://api.example.com/v1/chat/completions".into(),
            api_format: ApiFormat::ChatCompletions, model: "vision-model".into(), prompt: String::new(),
            temperature: 0.0, timeout_seconds: 60, protected_api_key: Some(protect_key("synthetic-test-key").unwrap()) };
        let mut changed = input("https://api.example.com/v1/responses");
        changed.api_format = ApiFormat::Responses;
        let resolved = resolve_config(changed, Some(&old), true).unwrap();
        assert_eq!(resolved.api_format, ApiFormat::Responses);
        assert_eq!(resolved.api_key, "synthetic-test-key");
    }
}
