mod commands;
mod state;
mod worker;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::recognize_image,
            commands::model_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
