use crate::dependencies::get_appdata_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const HRIR_BASE_URL: &str =
    "https://github.com/jose-seminario/audio-dash/releases/download/v1.2.0/";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HrtfProfile {
    pub id: String,
    pub name: String,
    pub brand: String,
    pub description: String,
    pub filename: String,
}

pub fn get_hrir_dir() -> PathBuf {
    let mut path = get_appdata_dir();
    path.push("hrir");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

pub fn get_hrir_profile_path(filename: &str) -> PathBuf {
    get_hrir_dir().join(filename)
}

pub fn get_default_hrtf_profiles() -> Vec<HrtfProfile> {
    vec![
        HrtfProfile {
            id: "stereo_direct".to_string(),
            name: "Estéreo Directo (Sin HRTF)".to_string(),
            brand: "Bypass".to_string(),
            description: "Audio 1:1 original sin procesado convolutivo ni virtualización espacial."
                .to_string(),
            filename: "".to_string(),
        },
        HrtfProfile {
            id: "sennheiser_gsx".to_string(),
            name: "Sennheiser GSX 1000 (7.1 Pinpoint)".to_string(),
            brand: "EPOS / Sennheiser".to_string(),
            description: "El estándar competitivo de HeSuVi: máxima precisión en pasos traseros y ángulos de 45°."
                .to_string(),
            filename: "sennheiser_gsx.wav".to_string(),
        },
        HrtfProfile {
            id: "waves_nx".to_string(),
            name: "Waves Nx (Studio Virtualization)".to_string(),
            brand: "Waves Audio".to_string(),
            description: "Separación acústica tridimensional con respuesta balanceada y sin reverberación artificial."
                .to_string(),
            filename: "waves_nx.wav".to_string(),
        },
        HrtfProfile {
            id: "dts_headphone_x".to_string(),
            name: "DTS Headphone:X v1 (Tactical Stage)".to_string(),
            brand: "DTS".to_string(),
            description: "Escenario sonoro expandido para detección temprana de vehículos y disparos lejanos."
                .to_string(),
            filename: "dts_headphone_x.wav".to_string(),
        },
        HrtfProfile {
            id: "dolby_atmos_ref".to_string(),
            name: "Dolby Atmos Binaural Reference".to_string(),
            brand: "Dolby Labs".to_string(),
            description: "Inmersión espacial con percepción clara de verticalidad (arriba/abajo)."
                .to_string(),
            filename: "dolby_atmos_ref.wav".to_string(),
        },
    ]
}

#[tauri::command]
pub fn get_available_hrtf_profiles() -> Vec<HrtfProfile> {
    get_default_hrtf_profiles()
}

/// Zero-Config: Downloads HRIR impulse response files to %APPDATA%\AudioDash\hrir\ on end-user machine
#[tauri::command]
pub async fn ensure_hrir_installed(filename: String) -> Result<bool, String> {
    if filename.is_empty() {
        return Ok(true);
    }

    tokio::task::spawn_blocking(move || {
        let dest_path = get_hrir_profile_path(&filename);
        if dest_path.exists() {
            return Ok(true);
        }

        let _ = get_hrir_dir();
        let download_url = format!("{}{}", HRIR_BASE_URL, filename);

        #[cfg(windows)]
        {
            use std::process::Command;

            // 1. Try Windows native curl
            let curl_res = Command::new("curl.exe")
                .arg("-s")
                .arg("-L")
                .arg("-o")
                .arg(&dest_path)
                .arg(&download_url)
                .output();

            if let Ok(out) = curl_res {
                if out.status.success() && dest_path.exists() {
                    return Ok(true);
                }
            }

            // 2. Fallback to PowerShell Invoke-WebRequest
            let script = format!(
                "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                download_url,
                dest_path.to_string_lossy()
            );

            let ps_res = Command::new("powershell.exe")
                .arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-WindowStyle")
                .arg("Hidden")
                .arg("-Command")
                .arg(&script)
                .output();

            if let Ok(ps_out) = ps_res {
                if ps_out.status.success() && dest_path.exists() {
                    return Ok(true);
                }
            }
        }

        Ok(dest_path.exists())
    })
    .await
    .map_err(|e| e.to_string())?
}
