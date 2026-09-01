use serde::Serialize;
use tauri::{AppHandle, State};

use crate::state::AppState;
use crate::worker::{DownloadProgress, RecognizeRequest, RecognizeResponse};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub label: String,
    pub description: String,
    pub icon: String,
    pub ready: bool,
}

/// 当前可用的识别模型清单（新增模型时在此登记；模型权重就绪与否动态判定）。
#[tauri::command]
pub fn list_models(app: AppHandle) -> Vec<ModelInfo> {
    vec![ModelInfo {
        id: "texteller".to_string(),
        label: "TexTeller 3.0".to_string(),
        description: "默认引擎，速度快，适合印刷体与清晰截图".to_string(),
        icon: "bolt".to_string(),
        ready: crate::worker::texteller_ready(&app),
    }]
}

/// 下载指定模型：先确保运行环境（Python 3.11 + texteller/torch，缺失自动装），
/// 再拉起 worker（其启动阶段会下载权重，进度经 onEvent 通道推送）。
#[tauri::command]
pub fn download_model(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    on_event: tauri::ipc::Channel<DownloadProgress>,
) -> Result<String, String> {
    if id != "texteller" {
        return Err(format!("未知模型: {id}"));
    }
    // 环境准备（新机器自动安装 Python/依赖），阶段消息复用下载进度通道。
    crate::worker::ensure_runtime(Some(&on_event))?;

    let mut worker_slot = state
        .worker
        .lock()
        .map_err(|_| "本地模型状态锁已损坏".to_string())?;
    let should_spawn = match worker_slot.as_mut() {
        Some(worker) => !worker.is_alive(),
        None => true,
    };
    if should_spawn {
        *worker_slot = Some(crate::worker::FormulaWorker::spawn(&app, Some(on_event))?);
    }
    Ok("ready".to_string())
}

/// 删除指定模型的本地权重（会先停掉 worker 以释放文件句柄）。
/// 随包内置的模型不可删除。
#[tauri::command]
pub fn delete_model(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    if id != "texteller" {
        return Err(format!("未知模型: {id}"));
    }
    if crate::worker::has_bundled_model(&app) {
        return Err("当前模型为随包内置，不可删除".to_string());
    }
    // 先释放 worker，确保 Python 进程退出、文件锁释放后再删目录。
    if let Ok(mut slot) = state.worker.lock() {
        *slot = None;
    }
    let dir = crate::worker::model_data_dir(&app).ok_or("无法定位模型权重目录")?;
    if !dir.exists() {
        return Ok("nothing_to_delete".to_string());
    }
    // Windows 下进程退出到句柄释放有延迟，重试几次。
    for attempt in 0..10 {
        match std::fs::remove_dir_all(&dir) {
            Ok(_) => return Ok("deleted".to_string()),
            Err(error) => {
                if error.kind() == std::io::ErrorKind::NotFound {
                    return Ok("deleted".to_string());
                }
                if attempt == 9 {
                    return Err(format!("删除模型权重失败：{}", error));
                }
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        }
    }
    Err("删除模型权重失败".to_string())
}

#[tauri::command]
pub fn recognize_image(
    app: AppHandle,
    state: State<'_, AppState>,
    request: RecognizeRequest,
) -> Result<RecognizeResponse, String> {
    let mut worker_slot = state
        .worker
        .lock()
        .map_err(|_| "本地模型状态锁已损坏".to_string())?;

    let should_spawn = match worker_slot.as_mut() {
        Some(worker) => !worker.is_alive(),
        None => true,
    };
    if should_spawn {
        *worker_slot = Some(crate::worker::FormulaWorker::spawn(&app, None)?);
    }

    worker_slot
        .as_mut()
        .ok_or_else(|| "本地模型 worker 未创建".to_string())?
        .recognize(&request)
}

#[tauri::command]
pub fn model_status(state: State<'_, AppState>) -> Result<String, String> {
    let mut worker_slot = state
        .worker
        .lock()
        .map_err(|_| "本地模型状态锁已损坏".to_string())?;
    Ok(
        if worker_slot
            .as_mut()
            .map(|worker| worker.is_alive())
            .unwrap_or(false)
        {
            "ready".to_string()
        } else {
            "cold".to_string()
        },
    )
}
