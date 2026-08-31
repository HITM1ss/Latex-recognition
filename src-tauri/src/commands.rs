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

/// 下载指定模型的权重（worker 启动时边下载边把进度推送到前端 onEvent 通道）。
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
