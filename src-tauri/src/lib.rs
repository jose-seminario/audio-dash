pub mod audio_engine;
pub mod dependencies;
pub mod system_audit;
pub mod window_monitor;

use audio_engine::{force_audio_refresh, update_eq_profile};
use dependencies::{check_system_dependencies, mark_first_run_completed};
use system_audit::{audit_system, request_system_optimization};
use window_monitor::spawn_window_monitor;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn the 0.0% CPU background foreground window monitor
            spawn_window_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_system_dependencies,
            mark_first_run_completed,
            update_eq_profile,
            force_audio_refresh,
            audit_system,
            request_system_optimization,
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar Audio Dash");
}
