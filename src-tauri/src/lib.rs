pub mod audio_engine;
pub mod audio_router;
pub mod backup_system;
pub mod clutch_mode;
pub mod com_guard;
pub mod dependencies;
pub mod hrtf_engine;
pub mod system_audit;
pub mod system_tweaks;
pub mod window_monitor;

use audio_engine::{auto_install_equalizer_apo, ensure_vst_plugin_installed, force_audio_refresh, update_eq_profile};
use audio_router::{get_audio_devices, open_app_volume_settings, open_sound_control_panel, route_game_to_virtual_cable};
use backup_system::restore_defaults;
use clutch_mode::{get_clutch_state, init_clutch_hotkey, toggle_clutch_mode};
use dependencies::{add_custom_game_exe, check_system_dependencies, get_custom_game_exes, mark_first_run_completed};
use hrtf_engine::{ensure_hrir_installed, get_available_hrtf_profiles};
use system_audit::{apply_leq_tweak, audit_system, open_windows_sound_settings, request_system_optimization};
use system_tweaks::apply_audiodg_affinity;
use window_monitor::{get_running_processes_list, scan_running_game_now, spawn_window_monitor};

/// Crash logger panic hook: logs any panic with file and line to %APPDATA%\AudioDash\crash.log
pub fn setup_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        let appdata_dir = dependencies::get_appdata_dir();
        let _ = std::fs::create_dir_all(&appdata_dir);
        let log_path = appdata_dir.join("crash.log");

        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Error desconocido (sin mensaje descriptivo)".to_string()
        };

        let location = if let Some(loc) = panic_info.location() {
            format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
        } else {
            "Ubicacion desconocida".to_string()
        };

        use std::time::{SystemTime, UNIX_EPOCH};
        let epoch_sec = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let log_entry = format!(
            "==================== CRASH REPORT ====================\n             Timestamp Unix: {} s\n             Error: {}\n             Ubicacion: {}\n             ======================================================\n\n",
            epoch_sec, payload, location
        );

        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            use std::io::Write;
            let _ = file.write_all(log_entry.as_bytes());
        }

        #[cfg(windows)]
        unsafe {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
            let title = HSTRING::from("Audio Dash - Error Inesperado");
            let body = HSTRING::from(format!(
                "Audio Dash ha sufrido un error inesperado:\n\n{}\n\nUbicacion:\n{}\n\nSe ha generado un registro en:\n{}",
                payload,
                location,
                log_path.display()
            ));
            let _ = MessageBoxW(None, &body, &title, MB_OK | MB_ICONERROR);
        }
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Asegurar creación de directorios en %APPDATA%\AudioDash
            dependencies::ensure_app_directories();

            // Inicializar atajo de Clutch Mode protegido contra panics
            init_clutch_hotkey(&app.handle());

            // Iniciar escáner inteligente de juego en segundo plano
            spawn_window_monitor(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_system_dependencies,
            mark_first_run_completed,
            update_eq_profile,
            ensure_vst_plugin_installed,
            auto_install_equalizer_apo,
            force_audio_refresh,
            audit_system,
            request_system_optimization,
            apply_leq_tweak,
            apply_audiodg_affinity,
            get_available_hrtf_profiles,
            ensure_hrir_installed,
            toggle_clutch_mode,
            get_clutch_state,
            restore_defaults,
            open_windows_sound_settings,
            get_audio_devices,
            route_game_to_virtual_cable,
            open_app_volume_settings,
            open_sound_control_panel,
            scan_running_game_now,
            get_running_processes_list,
            add_custom_game_exe,
            get_custom_game_exes,
        ]);

    if let Err(err) = builder.run(tauri::generate_context!()) {
        let appdata_dir = dependencies::get_appdata_dir();
        let log_path = appdata_dir.join("crash.log");
        let err_msg = format!("Error al ejecutar Audio Dash: {}\n", err);
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            use std::io::Write;
            let _ = file.write_all(err_msg.as_bytes());
        }

        #[cfg(windows)]
        unsafe {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
            let title = HSTRING::from("Audio Dash - Error de Ejecucion");
            let body = HSTRING::from(format!(
                "No se pudo iniciar la interfaz de Audio Dash:\n\n{}\n\nDetalles guardados en:\n{}",
                err,
                log_path.display()
            ));
            let _ = MessageBoxW(None, &body, &title, MB_OK | MB_ICONERROR);
        }
    }
}
