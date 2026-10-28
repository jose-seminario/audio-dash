use crate::dependencies::get_appdata_dir;
use crate::system_audit::encode_powershell_script;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WindowsBackup {
    pub system_responsiveness: u32,
    pub network_throttling_index: u32,
    pub power_scheme_guid: String,
    pub timestamp_unix: u64,
}

pub fn get_backup_file_path() -> PathBuf {
    get_appdata_dir().join("windows_backup.json")
}

/// Reads the currently active power plan GUID using Windows powercfg
pub fn get_current_power_scheme() -> String {
    #[cfg(windows)]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("powercfg").arg("/getactivescheme").output() {
            let text = String::from_utf8_lossy(&output.stdout);
            for word in text.split_whitespace() {
                let clean = word.trim_matches(|c| c == '{' || c == '}' || c == '(' || c == ')');
                if clean.len() == 36 && clean.chars().filter(|&c| c == '-').count() == 4 {
                    return clean.to_string();
                }
            }
        }
    }
    // Fallback standard Windows Balanced scheme GUID
    "381b4222-f694-41f0-9685-ff5bb260df2e".to_string()
}

/// Creates a backup of the original Windows registry values and power scheme before applying any tweaks.
pub fn create_backup_if_not_exists() -> Result<(), String> {
    let backup_path = get_backup_file_path();
    if backup_path.exists() {
        return Ok(());
    }

    let mut sys_resp: u32 = 20; // Default Windows standard value
    let mut net_throttle: u32 = 10; // Default Windows standard value

    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile") {
            if let Ok(val) = key.get_value("SystemResponsiveness") {
                sys_resp = val;
            }
            if let Ok(val) = key.get_value("NetworkThrottlingIndex") {
                net_throttle = val;
            }
        }
    }

    let power_guid = get_current_power_scheme();
    let now_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let backup = WindowsBackup {
        system_responsiveness: sys_resp,
        network_throttling_index: net_throttle,
        power_scheme_guid: power_guid,
        timestamp_unix: now_unix,
    };

    let json_bytes = serde_json::to_vec_pretty(&backup)
        .map_err(|e| format!("Error serializando backup: {}", e))?;

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&backup_path)
        .map_err(|e| format!("Error creando archivo de backup: {}", e))?;

    file.write_all(&json_bytes)
        .map_err(|e| format!("Error escribiendo backup: {}", e))?;

    Ok(())
}

/// Restores original factory settings (Panic Button / Rollback)
#[tauri::command]
pub async fn restore_defaults() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        // 1. Reset Equalizer APO config files to neutral bypass
        let config_path = crate::audio_engine::get_user_config_path();
        if let Ok(mut file) = OpenOptions::new().create(true).write(true).truncate(true).open(&config_path) {
            let neutral = "# --- Audio Dash Neutral Bypass / Factory Reset ---\nPreamp: 0.0 dB\n";
            let _ = file.write_all(neutral.as_bytes());
        }

        // 2. Read backup values (Fail cleanly if backup file does not exist)
        let backup_path = get_backup_file_path();
        if !backup_path.exists() {
            return Err("No se encontró archivo de respaldo previo (windows_backup.json). Ninguna optimización fue aplicada aún.".to_string());
        }

        let content = fs::read_to_string(&backup_path)
            .map_err(|e| format!("Error leyendo archivo de respaldo: {}", e))?;
        let backup: WindowsBackup = serde_json::from_str(&content)
            .map_err(|e| format!("Archivo de respaldo corrupto: {}", e))?;

        // 3. Reset audiodg.exe CPU affinity to all cores
        reset_audiodg_affinity_to_all_cores();

        // 4. Elevate via UAC runas to restore registry and power plan
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

            let status_file = std::env::temp_dir().join("audiodash_restore.status");
            let _ = std::fs::remove_file(&status_file);
            let status_path_str = status_file.to_string_lossy();

            let script = format!(
                r#"
$statusFile = "{status_path_str}"
try {{
    $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
    if (Test-Path $sysProfile) {{
        Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value {sys_resp} -Type DWord -Force
        Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value {net_throttle} -Type DWord -Force
    }}

    # Restaurar plan de energia original del usuario
    powercfg /setactive {power_guid} 2>$null

    # Reiniciar servicio de audio para recargar valores
    Restart-Service -Name audiosrv -Force 2>$null

    Set-Content -Path $statusFile -Value "SUCCESS" -Force
}} catch {{
    Set-Content -Path $statusFile -Value ("ERROR: " + $_.Exception.Message) -Force
}}
                "#,
                status_path_str = status_path_str,
                sys_resp = backup.system_responsiveness,
                net_throttle = backup.network_throttling_index,
                power_guid = backup.power_scheme_guid
            );

            let encoded_command = encode_powershell_script(&script);

            let file_wide: Vec<u16> = OsStr::new("powershell.exe")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let verb_wide: Vec<u16> = OsStr::new("runas")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let params_wide: Vec<u16> = OsStr::new(&format!("-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand {}", encoded_command))
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let instance = unsafe {
                ShellExecuteW(
                    None,
                    PCWSTR(verb_wide.as_ptr()),
                    PCWSTR(file_wide.as_ptr()),
                    PCWSTR(params_wide.as_ptr()),
                    PCWSTR(std::ptr::null()),
                    SW_HIDE,
                )
            };

            let launched = (instance.0 as isize) > 32;
            if !launched {
                return Ok(false);
            }

            for _ in 0..16 {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if status_file.exists() {
                    if let Ok(content) = std::fs::read_to_string(&status_file) {
                        let clean = content.trim();
                        if clean == "SUCCESS" {
                            let _ = std::fs::remove_file(&status_file);
                            return Ok(true);
                        } else if clean.starts_with("ERROR") {
                            let _ = std::fs::remove_file(&status_file);
                            return Err(clean.to_string());
                        }
                    }
                }
            }

            Ok(true)
        }
        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Resets CPU affinity mask of audiodg.exe back to all available logical processors
fn reset_audiodg_affinity_to_all_cores() {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };
        use windows::Win32::System::Threading::{
            OpenProcess, SetProcessAffinityMask, PROCESS_SET_INFORMATION,
        };

        unsafe {
            if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
                let mut entry = PROCESSENTRY32W {
                    dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                    ..Default::default()
                };

                if Process32FirstW(snapshot, &mut entry).is_ok() {
                    loop {
                        let name_len = entry
                            .szExeFile
                            .iter()
                            .position(|&c| c == 0)
                            .unwrap_or(entry.szExeFile.len());
                        let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);

                        if name.eq_ignore_ascii_case("audiodg.exe") {
                            if let Ok(handle) = OpenProcess(
                                PROCESS_SET_INFORMATION,
                                false,
                                entry.th32ProcessID,
                            ) {
                                let _ = SetProcessAffinityMask(handle, usize::MAX);
                                let _ = CloseHandle(handle);
                            }
                        }

                        if Process32NextW(snapshot, &mut entry).is_err() {
                            break;
                        }
                    }
                }
                let _ = CloseHandle(snapshot);
            }
        }
    }
}
