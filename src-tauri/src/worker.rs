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
}

pub struct FormulaWorker {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl FormulaWorker {
    pub fn spawn(app: &AppHandle) -> Result<Self, String> {
        let (program, args) = resolve_worker_command(app)?;
        let mut command = Command::new(&program);
        command
            .args(args.iter())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // The protocol owns stdout; diagnostics belong nowhere in the UI.
            .stderr(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: do not flash a console when the desktop app starts.
            command.creation_flags(0x0800_0000);
        }

        let mut child = command.spawn().map_err(|error| {
      format!(
        "无法启动本地公式模型 worker（{}）：{}。请确认 Python 3.11 和 pix2tex 已安装，或设置 AXIOM_FORMULA_WORKER_BIN。",
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
        let bytes = stdout
            .read_line(&mut line)
            .map_err(|error| format!("读取本地模型启动状态失败：{}", error))?;
        if bytes == 0 {
            let _ = child.kill();
            return Err(
                "本地模型 worker 启动后立即退出，请检查 pix2tex 依赖和模型文件".to_string(),
            );
        }

        let ready: WorkerMessage = serde_json::from_str(line.trim()).map_err(|error| {
            let _ = child.kill();
            format!("本地模型 worker 返回了无效启动消息：{}", error)
        })?;
        if ready.kind.as_deref() != Some("ready") || ready.ok != Some(true) {
            let message = ready
                .error
                .map(|error| error.message)
                .unwrap_or_else(|| "本地模型未准备就绪".to_string());
            let _ = child.kill();
            return Err(message);
        }

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
