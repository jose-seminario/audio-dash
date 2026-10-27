use crate::dependencies::get_appdata_dir;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WindowsBackup {
    pub system_responsiveness: u32,
    pub network_throttling_index: u32,
    pub power_scheme_guid: String,
    pub timestamp: String,
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

    let backup = WindowsBackup {
        system_responsiveness: sys_resp,
        network_throttling_index: net_throttle,
        power_scheme_guid: power_guid,
        timestamp: chrono_now_string(),
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

fn chrono_now_string() -> String {
    // Lightweight timestamp without external crate
    "Original Factory State".to_string()
}

/// Restores original factory settings (Panic Button / Rollback)
#[tauri::command]
pub async fn restore_defaults() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        // 1. Reset %APPDATA%\AudioDash\config.txt to neutral bypass
        let config_path = crate::audio_engine::get_user_config_path();
        if let Ok(mut file) = OpenOptions::new().create(true).write(true).truncate(true).open(&config_path) {
            let neutral = "# --- Audio Dash Neutral Bypass / Factory Reset ---\nPreamp: 0.0 dB\n";
            let _ = file.write_all(neutral.as_bytes());
        }

        // 2. Read backup values
        let backup_path = get_backup_file_path();
        let (sys_resp, net_throttle, power_guid) = if backup_path.exists() {
            if let Ok(content) = fs::read_to_string(&backup_path) {
                if let Ok(b) = serde_json::from_str::<WindowsBackup>(&content) {
                    (b.system_responsiveness, b.network_throttling_index, b.power_scheme_guid)
                } else {
                    (20, 10, "381b4222-f694-41f0-9685-ff5bb260df2e".to_string())
                }
            } else {
                (20, 10, "381b4222-f694-41f0-9685-ff5bb260df2e".to_string())
            }
        } else {
            (20, 10, "381b4222-f694-41f0-9685-ff5bb260df2e".to_string())
        };

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

            let script = format!(
                r#"
                $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
                if (Test-Path $sysProfile) {{
                    Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value {} -Type DWord -Force
                    Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value {} -Type DWord -Force
                }}

                # Restaurar plan de energia original del usuario
                powercfg /setactive {}

                # Reiniciar servicio de audio para recargar valores
                Restart-Service -Name audiosrv -Force
                "#,
                sys_resp, net_throttle, power_guid
            );

            let file_wide: Vec<u16> = OsStr::new("powershell.exe")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let verb_wide: Vec<u16> = OsStr::new("runas")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let params_wide: Vec<u16> = OsStr::new(&format!("-NoProfile -NonInteractive -WindowStyle Hidden -Command \"{}\"", script))
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

            let is_success = (instance.0 as isize) > 32;
            Ok(is_success)
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
                                // 0xFFFFFFFF (all cores mask)
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
