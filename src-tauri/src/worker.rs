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
    /// 环境准备阶段的文字状态（如"正在安装 Python…"），下载进度事件为 None。
    #[serde(default)]
    pub stage: Option<String>,
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
            // The protocol owns stdout; worker diagnostics go to a log file so
            // that download/inference failures are debuggable after the fact.
            .stderr(Stdio::piped());

        inject_model_dir(app, &mut command);
        // 启动前确保模型目标目录可写（首次在 Program Files 同级仅需创建时提权）。
        ensure_model_dir_for_spawn(app)?;

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

        // 后台线程把 worker 的 stderr 追加写入应用数据目录 worker.log，
        // 下载/推理失败时用于排查（stderr 不参与协议流）。
        if let Some(stderr) = child.stderr.take() {
            let log_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("worker.log");
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut line = String::new();
                loop {
                    line.clear();
                    match reader.read_line(&mut line) {
                        Ok(0) | Err(_) => break,
                        Ok(_) => {
                            let _ = std::fs::OpenOptions::new()
                                .create(true)
                                .append(true)
                                .open(&log_path)
                                .map(|mut file| {
                                    let _ = writeln!(file, "{}", line.trim_end());
                                });
                        }
                    }
                }
            });
        }

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
                        stage: None,
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

/// 捆绑模型是否存在于 worker 脚本旁（resources/models/texteller 等）。
pub fn has_bundled_model(app: &AppHandle) -> bool {
    worker_script_path(app).map_or(false, |script| {
        let base = script.parent().unwrap_or_else(|| std::path::Path::new(""));
        let configs = [
            base.join("models").join("texteller").join("config.json"),
            base.join("resources")
                .join("models")
                .join("texteller")
                .join("config.json"),
        ];
        configs.iter().any(|path| path.is_file())
    })
}

/// 决定权重目录：
/// 1. 用户显式设置 `AXIOM_TEXTELLER_MODEL_DIR`（最高优先）
/// 2. 正式版：安装目录同级 `OpenTeX_Model`（如 D:\Program Files\OpenTeX_Model）
///    —— 与安装目录平级，避免升级覆盖、又常驻在用户可见位置
/// 3. 开发模式 / 兜底：应用数据目录 models/texteller
pub fn model_data_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(explicit) = env::var("AXIOM_TEXTELLER_MODEL_DIR") {
        let explicit = explicit.trim();
        if !explicit.is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }
    if !cfg!(debug_assertions) {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(install_parent) = exe.parent().and_then(|p| p.parent()) {
                return Some(install_parent.join("OpenTeX_Model"));
            }
        }
    }
    app.path()
        .app_data_dir()
        .ok()
        .map(|data| data.join("models").join("texteller"))
}

/// 首次运行时目标目录在 Program Files 同级（只读区）下，普通进程无权创建。
/// 通过一次提权的 PowerShell 创建目录并授予 Users 完全控制，之后即可直接读写。
#[cfg(windows)]
fn ensure_dir_elevated(dir: &std::path::Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;

    let escaped = dir.display().to_string().replace('\'', "''");
    let script = format!(
        "New-Item -ItemType Directory -Force -Path '{escaped}' | Out-Null\n"
    );
    let script_path = std::env::temp_dir().join("opentex_ensure_model_dir.ps1");
    std::fs::write(&script_path, script)?;
    let launch = format!(
        "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','{}'",
        script_path.display()
    );
    let status = Command::new("powershell")
        .args(["-NoProfile", "-Command", &launch])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW：父窗口不闪烁控制台
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "用户取消了提权，模型目录将使用默认位置",
        ))
    }
}

/// spawn 前保证模型目标目录可写（创建不存在的目录；必要时提权）。
fn ensure_model_dir_for_spawn(app: &AppHandle) -> Result<(), String> {
    if env::var("AXIOM_TEXTELLER_MODEL_DIR")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        || has_bundled_model(app)
    {
        return Ok(());
    }
    let Some(dir) = model_data_dir(app) else {
        return Ok(());
    };
    if dir.join("config.json").is_file() {
        return Ok(());
    }
    let create = || std::fs::create_dir_all(&dir);
    let result: std::io::Result<()> = if cfg!(windows) {
        create().or_else(|_| ensure_dir_elevated(&dir).and_then(|_| create()))
    } else {
        create()
    };
    result.map_err(|error| format!("无法创建模型目录 {}：{}", dir.display(), error))
}

/// 未显式设置 `AXIOM_TEXTELLER_MODEL_DIR` 且本地没有捆绑模型时，
/// 注入模型的下载/加载目录（正式版为安装目录同级 OpenTeX_Model）。
fn inject_model_dir(app: &AppHandle, command: &mut Command) {
    if env::var("AXIOM_TEXTELLER_MODEL_DIR")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        || has_bundled_model(app)
    {
        return;
    }
    if let Some(dir) = model_data_dir(app) {
        command.env("AXIOM_TEXTELLER_MODEL_DIR", &dir);
    }
}

/// 判断 TexTeller 权重是否已本地就绪（显式目录 / 安装同级模型目录 / 捆绑资源）。
pub fn texteller_ready(app: &AppHandle) -> bool {
    let has_config = |dir: std::path::PathBuf| dir.join("config.json").is_file();

    if let Ok(explicit) = env::var("AXIOM_TEXTELLER_MODEL_DIR") {
        let explicit = explicit.trim();
        if !explicit.is_empty() && has_config(std::path::PathBuf::from(explicit)) {
            return true;
        }
    }
    if let Some(dir) = model_data_dir(app) {
        if has_config(dir) {
            return true;
        }
    }

    has_bundled_model(app)
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

// ---------------------------------------------------------------------------
// 运行环境准备：Python 3.11 + texteller/torch（新机器点“下载权重”时自动完成）
// ---------------------------------------------------------------------------

const PYTHON_INSTALLER_URL: &str =
    "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe";

/// 发送一条阶段状态消息（供前端按钮显示安装进度文字）。
fn emit_stage(channel: Option<&tauri::ipc::Channel<DownloadProgress>>, text: &str) {
    if let Some(ch) = channel {
        let _ = ch.send(DownloadProgress {
            total: 0,
            downloaded: 0,
            speed_bps: 0.0,
            filename: String::new(),
            stage: Some(text.to_string()),
        });
    }
}

/// 静默运行命令并等待结束；stderr 被丢弃（错误统一走 Err）。
fn run_silent(program: &str, args: &[&str], timeout_secs: u64) -> Result<(), String> {
    let mut command = program_command(program, args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动 {program}：{error}"))?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("等待 {program} 结束失败：{error}"))?
        {
            if status.success() {
                return Ok(());
            }
            return Err(format!("{program} 执行失败（退出码 {:?}）", status.code()));
        }
        if std::time::Instant::now() > deadline {
            let _ = child.kill();
            return Err(format!("{program} 执行超时（{} 秒）", timeout_secs));
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
}

fn program_command(program: &str, args: &[&str]) -> std::process::Command {
    let mut command = std::process::Command::new(program);
    command.args(args);
    command
}

/// 让 `py -3.11` 打印其真实 python 可执行文件路径。
fn python_exe_from_launcher() -> Option<String> {
    let output = program_command("py", &["-3.11", "-c", "import sys;print(sys.executable)"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

/// 用户级安装的 Python 3.11（默认路径）。
fn python_exe_from_user_install() -> Option<String> {
    let appdata = std::env::var_os("LOCALAPPDATA")?;
    let candidate = PathBuf::from(appdata)
        .join("Programs")
        .join("Python")
        .join("Python311")
        .join("python.exe");
    candidate.is_file().then(|| candidate.to_string_lossy().into_owned())
}

/// 探测可用的 Python 3.11（launcher 优先，其次用户级安装）。
fn detect_python() -> Option<String> {
    python_exe_from_launcher().or_else(python_exe_from_user_install)
}

/// 用官方安装器静默安装 Python 3.11（当前用户级，无需管理员）。
fn install_python() -> Result<(), String> {
    let installer = std::env::temp_dir().join("python-3.11.9-amd64.exe");
    if !installer.is_file() {
        // Windows 10+ 自带 curl。
        run_silent(
            "curl.exe",
            &[
                "-L",
                "-sS",
                "--fail",
                "-o",
                installer.to_str().unwrap_or_default(),
                PYTHON_INSTALLER_URL,
            ],
            600,
        )?;
    }
    run_silent(
        installer.to_str().unwrap_or_default(),
        &[
            "/quiet",
            "InstallAllUsers=0",
            "PrependPath=0",
            "Include_launcher=1",
            "Include_test=0",
        ],
        1200,
    )
}

/// 检查 Python 环境是否已具备 texteller / torch / torchvision。
fn has_deps(python: &str) -> bool {
    run_silent(
        python,
        &[
            "-c",
            "import texteller, torch, torchvision",
        ],
        60,
    )
    .is_ok()
}

/// 安装识别依赖（torch CPU 版 + texteller）。
fn install_deps(python: &str) -> Result<(), String> {
    run_silent(
        python,
        &[
            "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
            "torch==2.13.0", "torchvision==0.28.0",
            "--index-url", "https://download.pytorch.org/whl/cpu",
        ],
        1800,
    )?;
    run_silent(
        python,
        &[
            "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
            "texteller",
        ],
        900,
    )
}

/// 确保运行环境就绪（Python 3.11 + texteller/torch），未就绪则自动安装。
/// 完成后会把可用的 python 可执行文件写入 AXIOM_FORMULA_PYTHON，
/// 供 resolve_worker_command 使用。
pub fn ensure_runtime(
    progress: Option<&tauri::ipc::Channel<DownloadProgress>>,
) -> Result<(), String> {
    if cfg!(not(windows)) {
        return Err("当前仅支持 Windows 上的自动环境安装".to_string());
    }

    emit_stage(progress, "检查 Python 环境…");
    let python = match detect_python() {
        Some(exe) => exe,
        None => {
            emit_stage(progress, "正在安装 Python 3.11（首次约需 1-2 分钟）…");
            install_python()?;
            emit_stage(progress, "验证 Python 安装…");
            detect_python().ok_or_else(|| {
                "Python 3.11 安装完成但未能定位，请尝试重新点击下载权重".to_string()
            })?
        }
    };
    std::env::set_var("AXIOM_FORMULA_PYTHON", &python);

    if !has_deps(&python) {
        emit_stage(
            progress,
            "正在安装识别依赖（texteller / torch CPU），首次约需数分钟…",
        );
        install_deps(&python)?;
    }
    emit_stage(progress, "运行环境就绪");
    Ok(())
}
