use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DependencyStatus {
    pub equalizer_apo_installed: bool,
    pub config_linked: bool,
    pub installed_path: Option<String>,
    pub first_run_completed: bool,
    pub details: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AppSettings {
    pub first_run_completed: bool,
    pub last_selected_profile: String,
    pub profile_mode: String,
}

pub fn get_appdata_dir() -> PathBuf {
    let mut path = match dirs::config_dir() {
        Some(d) => d,
        None => PathBuf::from("."),
    };
    path.push("AudioDash");
    let _ = fs::create_dir_all(&path);
    path
}

pub fn ensure_app_directories() {
    let base = get_appdata_dir();
    let _ = fs::create_dir_all(&base);
    let _ = fs::create_dir_all(base.join("plugins"));
    let _ = fs::create_dir_all(base.join("hrir"));
}

pub fn get_settings_path() -> PathBuf {
    let mut path = get_appdata_dir();
    path.push("settings.json");
    path
}

pub fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_system_dependencies() -> DependencyStatus {
    ensure_app_directories();
    crate::audio_engine::ensure_apo_config_linked();
    let default_apo_path = Path::new(r"C:\Program Files\EqualizerAPO");
    let x86_apo_path = Path::new(r"C:\Program Files (x86)\EqualizerAPO");

    let (installed, found_path) = if default_apo_path.exists() {
        (true, Some(default_apo_path.to_string_lossy().to_string()))
    } else if x86_apo_path.exists() {
        (true, Some(x86_apo_path.to_string_lossy().to_string()))
    } else {
        (false, None)
    };

    let settings = load_settings();

    // Check if AudioDash configuration file is linked and exists
    let user_config_path = crate::audio_engine::get_user_config_path();
    let config_linked = user_config_path.exists();

    let details = if installed {
        "Equalizer APO detectado en el sistema.".to_string()
    } else {
        "Equalizer APO no se encuentra en las rutas estándar de Program Files.".to_string()
    };

    DependencyStatus {
        equalizer_apo_installed: installed,
        config_linked,
        installed_path: found_path,
        first_run_completed: settings.first_run_completed,
        details,
    }
}

#[tauri::command]
pub fn mark_first_run_completed() -> Result<(), String> {
    let mut settings = load_settings();
    settings.first_run_completed = true;
    save_settings(&settings)
}
