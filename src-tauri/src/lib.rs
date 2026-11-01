mod commands;
mod custom_ai;
mod state;
mod worker;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::recognize_image,
            commands::model_status,
            commands::list_models,
            commands::download_model,
            commands::delete_model,
            commands::open_model_dir,
            custom_ai::get_custom_ai_config,
            custom_ai::save_custom_ai_config,
            custom_ai::list_custom_ai_profiles,
            custom_ai::create_custom_ai_profile,
            custom_ai::update_custom_ai_profile,
            custom_ai::archive_custom_ai_profile,
            custom_ai::test_custom_ai_config,
            custom_ai::list_custom_ai_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
