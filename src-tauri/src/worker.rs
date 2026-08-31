use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager};

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognizeRequest {
    pub image_base64: String,
    #[serde(default)]
    pub mime: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognizeResponse {
    pub success: bool,
    pub latex: Option<String>,
    pub confidence: Option<f32>,
    pub elapsed_ms: Option<u64>,
    pub engine: Option<String>,
    pub error: Option<WorkerError>,
}

#[derive(Debug, Deserialize)]
struct WorkerMessage {
    #[serde(default)]
    id: Option<u64>,
    #[serde(rename = "type", default)]
    kind: Option<String>,
    #[serde(default)]
    ok: Option<bool>,
    #[serde(default)]
    latex: Option<String>,
    #[serde(default)]
    confidence: Option<f32>,
    #[serde(default)]
    elapsed_ms: Option<u64>,
    #[serde(default)]
    engine: Option<String>,
    #[serde(default)]
    error: Option<WorkerError>,
    // 下载进度字段（worker 启动阶段流式下载权重时上报）
    #[serde(default)]
    downloaded: Option<u64>,
    #[serde(default)]
    total: Option<u64>,
    #[serde(default)]
    speed_bps: Option<f64>,
    #[serde(default)]
    filename: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub total: u64,
    pub downloaded: u64,
    pub speed_bps: f64,
    pub filename: String,
}

pub struct FormulaWorker {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl FormulaWorker {
    pub fn spawn(
        app: &AppHandle,
        progress: Option<tauri::ipc::Channel<DownloadProgress>>,
    ) -> Result<Self, String> {
        let (program, args) = resolve_worker_command(app)?;
        let mut command = Command::new(&program);
        command
            .args(args.iter())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // The protocol owns stdout; diagnostics belong nowhere in the UI.
            .stderr(Stdio::null());

        inject_model_dir(app, &mut command);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: do not flash a console when the desktop app starts.
            command.creation_flags(0x0800_0000);
        }

        let mut child = command.spawn().map_err(|error| {
      format!(
        "无法启动本地公式模型 worker（{}）：{}。请确认 Python 3.11 和 texteller 已安装，或设置 AXIOM_FORMULA_WORKER_BIN。",
        program, error
      )
    })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "本地 worker 未提供 stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "本地 worker 未提供 stdout".to_string())?;
        let mut stdout = BufReader::new(stdout);

        let mut line = String::new();
        let ready = loop {
            line.clear();
            let bytes = stdout
                .read_line(&mut line)
                .map_err(|error| format!("读取本地模型启动状态失败：{}", error))?;
            if bytes == 0 {
                let _ = child.kill();
                return Err(format!(
                    "本地模型 worker 启动后立即退出，请检查 texteller 依赖和模型文件"
                ));
            }

            let message: WorkerMessage = serde_json::from_str(line.trim()).map_err(|error| {
                let _ = child.kill();
                format!("本地模型 worker 返回了无效启动消息：{}", error)
            })?;

            // worker 启动阶段可能边下载权重边打进度，转发给前端实时显示。
            if message.kind.as_deref() == Some("download_progress") {
                if let Some(channel) = &progress {
                    let _ = channel.send(DownloadProgress {
                        total: message.total.unwrap_or(0),
                        downloaded: message.downloaded.unwrap_or(0),
                        speed_bps: message.speed_bps.unwrap_or(0.0),
                        filename: message.filename.unwrap_or_default(),
                    });
                }
                continue;
            }

            if message.kind.as_deref() == Some("ready") && message.ok == Some(true) {
                break message;
            }
            let message_text = message
                .error
                .as_ref()
                .map(|error| error.message.clone())
                .unwrap_or_else(|| "本地模型未准备就绪".to_string());
            let _ = child.kill();
            return Err(message_text);
        };
        let _ = ready;

        Ok(Self {
            child,
            stdin,
            stdout,
        })
    }

    pub fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    pub fn recognize(&mut self, request: &RecognizeRequest) -> Result<RecognizeResponse, String> {
        if request.image_base64.trim().is_empty() {
            return Err("图片数据为空".to_string());
        }
        if request.image_base64.len() > 16 * 1024 * 1024 {
            return Err("图片数据超过 12 MB 限制".to_string());
        }

        let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let payload = serde_json::json!({
          "id": id,
          "image_base64": request.image_base64,
          "mime": request.mime,
          "model": request.model,
        });
        let line = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
        writeln!(self.stdin, "{}", line).map_err(|error| format!("发送识别请求失败：{}", error))?;
        self.stdin
            .flush()
            .map_err(|error| format!("刷新识别请求失败：{}", error))?;

        loop {
            let mut response_line = String::new();
            let bytes = self
                .stdout
                .read_line(&mut response_line)
                .map_err(|error| format!("读取识别结果失败：{}", error))?;
            if bytes == 0 {
                return Err("本地模型 worker 已退出".to_string());
            }

            let message: WorkerMessage = serde_json::from_str(response_line.trim())
                .map_err(|error| format!("本地模型返回了无效 JSON：{}", error))?;
            if message.id != Some(id) {
                // Startup/diagnostic events are allowed between requests.  Ignore
                // them and continue waiting for the matching request id.
                continue;
            }

            let success = message.ok.unwrap_or(false);
            let error = if success {
                None
            } else {
                Some(message.error.unwrap_or(WorkerError {
                    code: "inference_failed".to_string(),
                    message: "本地模型未返回识别结果".to_string(),
                }))
            };
            return Ok(RecognizeResponse {
                success,
                latex: message.latex,
                confidence: message.confidence,
                elapsed_ms: message.elapsed_ms,
                engine: message.engine,
                error,
            });
        }
    }
}

impl Drop for FormulaWorker {
    fn drop(&mut self) {
        let _ = writeln!(self.stdin, "{{\"type\":\"shutdown\"}}");
        let _ = self.stdin.flush();
        let _ = self.child.kill();
    }
}

/// 未显式设置 `AXIOM_TEXTELLER_MODEL_DIR` 且本地没有捆绑模型时，
/// 将模型目录指向用户数据目录（首次运行由 worker 自动从 HuggingFace 下载）。
fn inject_model_dir(app: &AppHandle, command: &mut Command) {
    if std::env::var("AXIOM_TEXTELLER_MODEL_DIR")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        return;
    }

    let bundled_exists = worker_script_path(app).map_or(false, |script| {
        let base = script.parent().unwrap_or_else(|| std::path::Path::new(""));
        let candidates = [
            base.join("models").join("texteller").join("config.json"),
            base.join("resources")
                .join("models")
                .join("texteller")
                .join("config.json"),
        ];
        candidates.iter().any(|path| path.is_file())
    });
    if bundled_exists {
        return;
    }

    if let Ok(data_dir) = app.path().app_data_dir() {
        let target = data_dir.join("models").join("texteller");
        if std::fs::create_dir_all(&target).is_ok() {
            command.env("AXIOM_TEXTELLER_MODEL_DIR", &target);
        }
    }
}

/// 判断 TexTeller 权重是否已本地就绪（显式目录 / 捆绑资源 / 用户数据目录）。
pub fn texteller_ready(app: &AppHandle) -> bool {
    let has_config = |dir: std::path::PathBuf| dir.join("config.json").is_file();

    if let Ok(explicit) = env::var("AXIOM_TEXTELLER_MODEL_DIR") {
        let explicit = explicit.trim();
        if !explicit.is_empty() && has_config(std::path::PathBuf::from(explicit)) {
            return true;
        }
    }

    let bundled_exists = worker_script_path(app).map_or(false, |script| {
        let base = script.parent().unwrap_or_else(|| std::path::Path::new(""));
        [
            base.join("models").join("texteller"),
            base.join("resources").join("models").join("texteller"),
        ]
        .iter()
        .any(|dir| has_config(dir.clone()))
    });
    if bundled_exists {
        return true;
    }

    if let Ok(data_dir) = app.path().app_data_dir() {
        return has_config(data_dir.join("models").join("texteller"));
    }
    false
}

fn resolve_worker_command(app: &AppHandle) -> Result<(String, Vec<String>), String> {
    if let Ok(binary) = env::var("AXIOM_FORMULA_WORKER_BIN") {
        let binary = binary.trim();
        if !binary.is_empty() {
            return Ok((binary.to_string(), Vec::new()));
        }
    }

    let script = worker_script_path(app).ok_or_else(|| {
        "找不到 resources/formula_worker.py；请确认 Tauri 资源配置或源码目录完整".to_string()
    })?;
    let python = env::var("AXIOM_FORMULA_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) {
            "py".to_string()
        } else {
            "python3".to_string()
        }
    });

    let mut args = Vec::new();
    if cfg!(windows) && python.eq_ignore_ascii_case("py") {
        args.push("-3.11".to_string());
    }
    args.push(script.to_string_lossy().into_owned());
    Ok((python, args))
}

fn worker_script_path(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates =
        vec![PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/formula_worker.py")];
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("formula_worker.py"));
        candidates.push(resource_dir.join("resources/formula_worker.py"));
    }
    candidates
        .into_iter()
        .find(|path| fs::metadata(path).is_ok())
}
