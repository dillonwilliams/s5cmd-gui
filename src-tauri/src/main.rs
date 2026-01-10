// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod keychain;
mod logging;
mod profiles;
mod s5cmd;
mod settings;
mod sso;

use log::info;
use tauri::Manager;

fn main() {
    // Initialize logging
    if let Err(e) = logging::init() {
        eprintln!("Failed to initialize logging: {}", e);
    }

    info!("Starting S5cmd GUI application");

    tauri::Builder::default()
        .setup(|app| {
            // Initialize settings with app handle
            let app_data_dir = app.path_resolver().app_data_dir();
            if let Some(dir) = app_data_dir {
                std::fs::create_dir_all(&dir).ok();
                info!("App data directory: {:?}", dir);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Profile management
            commands::get_profiles,
            commands::save_profile,
            commands::delete_profile,
            commands::test_profile_connection,
            commands::set_active_profile,
            // S3 operations
            commands::list_buckets,
            commands::list_objects,
            commands::delete_objects,
            commands::copy_objects,
            commands::move_objects,
            commands::create_folder,
            commands::download_objects,
            commands::upload_objects,
            commands::get_object_metadata,
            // SSO
            commands::start_sso_login,
            commands::check_sso_status,
            // Settings
            commands::get_settings,
            commands::save_settings,
            // Logging
            commands::get_logs,
            commands::clear_logs,
            commands::get_log_path,
            // Progress
            commands::cancel_operation,
            // Utility
            commands::get_s5cmd_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
