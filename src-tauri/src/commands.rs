use tauri::{AppHandle, State};

use crate::state::AppState;
use crate::worker::{RecognizeRequest, RecognizeResponse};

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
        *worker_slot = Some(crate::worker::FormulaWorker::spawn(&app)?);
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
