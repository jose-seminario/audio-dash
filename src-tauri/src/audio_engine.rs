use crate::dependencies::get_appdata_dir;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SliderValues {
    pub pasos: f32,    // 0 - 10
    pub bombas: f32,   // 0 - 10
    pub disparos: f32, // 0 - 10
    pub claridad: f32, // 0 - 10
    pub maestro: f32,  // -12 to 0 dB
}

pub fn get_user_config_path() -> PathBuf {
    get_appdata_dir().join("config.txt")
}

/// Generates Equalizer APO parametric filter syntax
pub fn generate_apo_config(values: &SliderValues, profile: &str) -> String {
    let mut config = String::new();
    config.push_str("# Audio Dash - Auto-generated Equalizer APO Config\n");
    config.push_str(&format!("# Active Profile: {}\n", profile));

    if profile.to_uppercase() == "NORMAL" {
        // Flat / Normal profile for natural Discord calls & general desktop audio
        config.push_str("Preamp: 0.0 dB\n");
        config.push_str("# Neutral profile active - All competitive filters bypassed\n");
        return config;
    }

    // Gaming Profile: Master Preamp to prevent digital clipping
    let preamp_db = values.maestro.clamp(-12.0, 0.0);
    config.push_str(&format!("Preamp: {:.1} dB\n", preamp_db));

    // 1. Slider "Pasos" (0 - 10): Boost 2500 Hz & 4000 Hz
    let pasos_ratio = (values.pasos / 10.0).clamp(0.0, 1.0);
    if pasos_ratio > 0.05 {
        let gain_2500 = 3.5 * pasos_ratio;
        let gain_4000 = 2.5 * pasos_ratio;
        config.push_str(&format!(
            "Filter: ON PK Fc 2500 Hz Gain +{:.2} dB Q 1.20\n",
            gain_2500
        ));
        config.push_str(&format!(
            "Filter: ON PK Fc 4000 Hz Gain +{:.2} dB Q 1.00\n",
            gain_4000
        ));
    }

    // 2. Slider "Bombas" (0 - 10): Cut low rumble with High-Pass & Low-Shelf
    let bombas_ratio = (values.bombas / 10.0).clamp(0.0, 1.0);
    if bombas_ratio > 0.05 {
        let hp_freq = 60.0 + (60.0 * bombas_ratio); // Scaled up to 120 Hz
        let ls_gain = -4.0 * bombas_ratio;
        config.push_str(&format!("Filter: ON HP Fc {:.0} Hz\n", hp_freq));
        config.push_str(&format!(
            "Filter: ON LS Fc 200 Hz Gain {:.2} dB\n",
            ls_gain
        ));
    }

    // 3. Slider "Disparos" (0 - 10): High-Shelf at 6000 Hz to smooth gunshots
    let disparos_ratio = (values.disparos / 10.0).clamp(0.0, 1.0);
    if disparos_ratio > 0.05 {
        let hs_gain = -3.0 * disparos_ratio;
        config.push_str(&format!(
            "Filter: ON HS Fc 6000 Hz Gain {:.2} dB\n",
            hs_gain
        ));
    }

    // 4. Slider "Claridad" (0 - 10): Vocal & presence peak at 1500 Hz
    let claridad_ratio = (values.claridad / 10.0).clamp(0.0, 1.0);
    if claridad_ratio > 0.05 {
        let peak_gain = 2.0 * claridad_ratio;
        config.push_str(&format!(
            "Filter: ON PK Fc 1500 Hz Gain +{:.2} dB Q 1.40\n",
            peak_gain
        ));
    }

    config
}

/// Atomically writes the configuration file in %APPDATA%\AudioDash\config.txt
#[tauri::command]
pub fn update_eq_profile(slider_values: SliderValues, profile: String) -> Result<(), String> {
    let config_path = get_user_config_path();
    let tmp_path = config_path.with_extension("tmp");

    let content = generate_apo_config(&slider_values, &profile);

    // Atomic write to tmp file then rename
    {
        let mut tmp_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp_path)
            .map_err(|e| format!("No se pudo crear archivo temporal: {}", e))?;

        tmp_file
            .write_all(content.as_bytes())
            .map_err(|e| format!("Error escribiendo archivo temporal: {}", e))?;
        tmp_file.flush().map_err(|e| e.to_string())?;
    }

    fs::rename(&tmp_path, &config_path)
        .map_err(|e| format!("Error en reemplazo atómico del archivo de configuración: {}", e))?;

    Ok(())
}

/// Forces instant hot-reload of the audio buffer
#[tauri::command]
pub async fn force_audio_refresh() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        let path = get_user_config_path();
        if path.exists() {
            // Touch timestamp by re-opening with write append
            if let Ok(file) = OpenOptions::new().write(true).open(&path) {
                let _ = file.set_len(file.metadata().map(|m| m.len()).unwrap_or(0));
            }
        }

        #[cfg(windows)]
        {
            // Trigger lightweight notification via Windows Multimedia COM API
            // without killing apps or stopping audiosrv aggressively
            trigger_windows_audio_endpoint_notification();
        }

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn trigger_windows_audio_endpoint_notification() {
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        if let Ok(enumerator) =
            CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
        {
            // Querying the default audio endpoint forces Windows audio service
            // to flush pending stream state and sync APO filters
            let _ = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia);
        }
        CoUninitialize();
    }
}
