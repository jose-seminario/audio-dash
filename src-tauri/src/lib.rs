pub mod audio_engine;
pub mod clutch_mode;
pub mod dependencies;
pub mod hrtf_engine;
pub mod system_audit;
pub mod window_monitor;

use audio_engine::{ensure_vst_plugin_installed, force_audio_refresh, update_eq_profile};
use clutch_mode::{get_clutch_state, init_clutch_hotkey, toggle_clutch_mode};
use dependencies::{check_system_dependencies, mark_first_run_completed};
use hrtf_engine::{ensure_hrir_installed, get_available_hrtf_profiles};
use system_audit::{audit_system, request_system_optimization};
use window_monitor::spawn_window_monitor;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Spawn the 0.0% CPU background foreground window monitor
            spawn_window_monitor(app.handle().clone());

            // Initialize global hotkey for Clutch Mode (Ctrl+Shift+C)
            init_clutch_hotkey(&app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_system_dependencies,
            mark_first_run_completed,
            update_eq_profile,
            ensure_vst_plugin_installed,
            force_audio_refresh,
            audit_system,
            request_system_optimization,
            get_available_hrtf_profiles,
            ensure_hrir_installed,
            toggle_clutch_mode,
            get_clutch_state,
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar Audio Dash");
}
