use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub endpoint_name: String,
    pub is_virtual_cable: bool,
}

#[cfg(windows)]
pub fn enumerate_audio_devices() -> Vec<AudioDeviceInfo> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut devices = Vec::new();
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let render_path = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";

    if let Ok(render_key) = hklm.open_subkey(render_path) {
        for subkey_name in render_key.enum_keys().filter_map(|k| k.ok()) {
            let dev_path = format!("{}\\{}", render_path, subkey_name);
            if let Ok(dev_key) = hklm.open_subkey(&dev_path) {
                // DeviceState: 1 = Active
                let state: u32 = dev_key.get_value("DeviceState").unwrap_or(0);
                if state != 1 {
                    continue;
                }

                let props_path = format!("{}\\Properties", dev_path);
                if let Ok(props_key) = hklm.open_subkey(&props_path) {
                    // Endpoint friendly name, e.g. "CABLE Input", "Altavoces"
                    let endpoint_name: String = props_key
                        .get_value("{a45c254e-df1c-4efd-8020-67d146a850e0},2")
                        .unwrap_or_default();

                    // Adapter name, e.g. "VB-Audio Virtual Cable", "Realtek(R) Audio"
                    let adapter_name: String = props_key
                        .get_value("{b3f8fa53-0004-438e-9003-51a46e139bfc},6")
                        .unwrap_or_default();

                    if endpoint_name.trim().is_empty() {
                        continue;
                    }

                    let full_name = if !adapter_name.trim().is_empty() && adapter_name != endpoint_name {
                        format!("{} ({})", endpoint_name, adapter_name)
                    } else {
                        endpoint_name.clone()
                    };

                    let lower = full_name.to_lowercase();
                    let is_virtual_cable = lower.contains("cable") || lower.contains("vb-audio");

                    devices.push(AudioDeviceInfo {
                        id: subkey_name,
                        name: full_name,
                        endpoint_name,
                        is_virtual_cable,
                    });
                }
            }
        }
    }

    // Sort: Virtual cable first, then alphabetical
    devices.sort_by(|a, b| {
        b.is_virtual_cable
            .cmp(&a.is_virtual_cable)
            .then_with(|| a.name.cmp(&b.name))
    });

    devices
}

#[cfg(not(windows))]
pub fn enumerate_audio_devices() -> Vec<AudioDeviceInfo> {
    vec![
        AudioDeviceInfo {
            id: "cable_input".to_string(),
            name: "CABLE Input (VB-Audio Virtual Cable)".to_string(),
            endpoint_name: "CABLE Input".to_string(),
            is_virtual_cable: true,
        },
        AudioDeviceInfo {
            id: "speakers".to_string(),
            name: "Altavoces (Realtek High Definition Audio)".to_string(),
            endpoint_name: "Altavoces".to_string(),
            is_virtual_cable: false,
        },
    ]
}

#[tauri::command]
pub fn get_audio_devices() -> Vec<AudioDeviceInfo> {
    enumerate_audio_devices()
}

/// Best-effort automatic routing of game process to selected virtual device
#[tauri::command]
pub async fn route_game_to_virtual_cable(
    process_name: Option<String>,
    device_name: Option<String>,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let target_process = process_name.unwrap_or_else(|| {
            let scan = crate::window_monitor::scan_game_state_internal();
            if scan.is_game {
                scan.process_name
            } else {
                "cod.exe".to_string()
            }
        });
        let _target_dev = device_name.unwrap_or_else(|| "CABLE Input".to_string());

        #[cfg(windows)]
        {
            let pid = crate::system_tweaks::find_process_id_by_name(&target_process);
            if pid.is_none() {
                return Err(format!(
                    "El juego ('{}') no está en ejecución. Inícialo primero para enrutarlo o configúralo manualmente en Windows.",
                    target_process
                ));
            }

            // Windows 10/11 per-app routing requires App Volume settings access
            Err(
                "Windows requiere asignar la salida del juego en las preferencias de volumen de la aplicación. Haz clic en 'Configuración de Windows' para asignarlo a CABLE Input."
                    .to_string(),
            )
        }
        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Opens Windows 10/11 "App volume and device preferences" page
#[tauri::command]
pub fn open_app_volume_settings() -> Result<bool, String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("cmd")
            .args(["/c", "start", "ms-settings:apps-volume"])
            .spawn();
        Ok(true)
    }
    #[cfg(not(windows))]
    Ok(true)
}

/// Opens classic Windows Sound Control Panel (mmsys.cpl)
#[tauri::command]
pub fn open_sound_control_panel() -> Result<bool, String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("mmsys.cpl").spawn();
        Ok(true)
    }
    #[cfg(not(windows))]
    Ok(true)
}
