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
    #[serde(default)]
    pub custom_game_exes: Vec<String>,
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

    let (installed, found_path, config_file_path) = if default_apo_path.exists() {
        (
            true,
            Some(default_apo_path.to_string_lossy().to_string()),
            Some(default_apo_path.join("config").join("config.txt")),
        )
    } else if x86_apo_path.exists() {
        (
            true,
            Some(x86_apo_path.to_string_lossy().to_string()),
            Some(x86_apo_path.join("config").join("config.txt")),
        )
    } else {
        (false, None, None)
    };

    let settings = load_settings();

    // Comprobación real y verídica del enlace en config.txt
    let config_linked = if let Some(cfg_path) = config_file_path {
        if let Ok(content) = fs::read_to_string(&cfg_path) {
            content.contains("AudioDash")
        } else {
            false
        }
    } else {
        false
    };

    let details = if installed && config_linked {
        "Equalizer APO instalado y vinculado correctamente en config.txt.".to_string()
    } else if installed {
        "Equalizer APO detectado, pero config.txt requiere ser vinculado con el botón 'Auto-Configurar'.".to_string()
    } else {
        "Equalizer APO no está instalado. Usa el botón 'Instalar Equalizer APO' para instalarlo automáticamente.".to_string()
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

#[tauri::command]
pub fn add_custom_game_exe(exe_name: String) -> Result<Vec<String>, String> {
    let mut settings = load_settings();
    let clean = exe_name.trim().to_lowercase();
    if clean.is_empty() {
        return Err("El nombre del ejecutable no puede estar vacío.".to_string());
    }

    if !settings.custom_game_exes.contains(&clean) {
        settings.custom_game_exes.push(clean);
        save_settings(&settings)?;
    }

    Ok(settings.custom_game_exes)
}

#[tauri::command]
pub fn get_custom_game_exes() -> Vec<String> {
    load_settings().custom_game_exes
}
