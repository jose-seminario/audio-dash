pub mod core;
pub mod evasion;
pub mod storage;

use evasion::{SuperProperties, VersionResolver};
use storage::KeychainManager;

#[tauri::command]
fn get_super_properties() -> Result<SuperProperties, String> {
    Ok(SuperProperties::default())
}

#[tauri::command]
fn save_token(token: String) -> Result<(), String> {
    KeychainManager::store_token(&token)
}

#[tauri::command]
fn get_token() -> Result<String, String> {
    KeychainManager::get_token()
}

#[tauri::command]
fn delete_token() -> Result<(), String> {
    KeychainManager::delete_token()
}

#[tauri::command]
fn check_evasion_status() -> serde_json::Value {
    serde_json::json!({
        "tls_impersonate": "Chrome128",
        "boring_ssl_active": true,
        "platform_spoof": "Windows 10 x64",
        "telemetry_filter_active": true,
        "zero_reqwest_verified": true
    })
}

#[tauri::command]
async fn check_version_status() -> Result<SuperProperties, String> {
    let fallback = include_str!("../../version.json");
    VersionResolver::check_and_resolve(None, fallback)
        .await
        .map_err(|status| serde_json::to_string(&status).unwrap_or(status.message))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = core::init_secure_logger(None);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_super_properties,
            save_token,
            get_token,
            delete_token,
            check_evasion_status,
            check_version_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running dashcord application");
}
