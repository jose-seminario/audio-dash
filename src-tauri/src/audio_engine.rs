use crate::dependencies::get_appdata_dir;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const LOUDMAX_DOWNLOAD_URL: &str =
    "https://github.com/jose-seminario/audio-dash/releases/download/v1.0.1/LoudMax64.dll";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SliderValues {
    pub pasos: f32,       // 0 - 10
    pub bombas: f32,      // 0 - 10
    pub disparos: f32,    // 0 - 10
    pub claridad: f32,    // 0 - 10
    pub compresion: f32,  // 0 - 100%
    #[serde(rename = "atenuacionPropia", alias = "atenuacion_propia", default)]
    pub atenuacion_propia: f32, // 0 a -12 dB (Canal Central C)
    pub maestro: f32,     // -12 to 0 dB
}

pub fn get_user_config_path() -> PathBuf {
    use std::path::Path;
    let default_apo = Path::new(r"C:\Program Files\EqualizerAPO");
    let x86_apo = Path::new(r"C:\Program Files (x86)\EqualizerAPO");

    if default_apo.exists() {
        let config_dir = default_apo.join("config");
        let _ = fs::create_dir_all(&config_dir);
        config_dir.join("AudioDash.txt")
    } else if x86_apo.exists() {
        let config_dir = x86_apo.join("config");
        let _ = fs::create_dir_all(&config_dir);
        config_dir.join("AudioDash.txt")
    } else {
        get_appdata_dir().join("AudioDash.txt")
    }
}

/// Ensures Equalizer APO's main config.txt includes AudioDash.txt
pub fn ensure_apo_config_linked() {
    let target_path = get_user_config_path();
    let target_str = target_path.to_string_lossy();

    let parent_dir = match target_path.parent() {
        Some(p) => p,
        None => return,
    };

    let main_config = parent_dir.join("config.txt");
    let expected_include = format!("Include: {}", target_str);

    if main_config.exists() {
        if let Ok(content) = fs::read_to_string(&main_config) {
            // If already included, no action needed
            if content.contains(&expected_include) {
                return;
            }

            // Replace any old AudioDash Include line (e.g. from AppData) or append
            let mut lines: Vec<String> = Vec::new();
            let mut replaced = false;

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Include:") && trimmed.contains("AudioDash") {
                    lines.push(expected_include.clone());
                    replaced = true;
                } else {
                    lines.push(line.to_string());
                }
            }

            if !replaced {
                lines.push(expected_include);
            }

            let new_content = lines.join("\r\n") + "\r\n";
            let _ = fs::write(&main_config, new_content.as_bytes());
        }
    } else if target_path.starts_with(r"C:\Program Files") {
        let _ = fs::write(&main_config, format!("{}\r\n", expected_include).as_bytes());
    }
}

pub fn get_plugins_dir() -> PathBuf {
    let mut path = get_appdata_dir();
    path.push("plugins");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

pub fn get_vst_plugin_path() -> PathBuf {
    get_plugins_dir().join("LoudMax64.dll")
}

/// Generates parametric filter, VST syntax, and HRTF convolution for Equalizer APO
pub fn generate_apo_config(
    values: &SliderValues,
    profile: &str,
    headphone_filters: &[String],
    hrtf_filename: Option<&str>,
    is_clutch: bool,
    distance_aware: bool,
) -> String {
    let mut config = String::new();
    config.push_str("# ========================================================\n");
    config.push_str("# Audio Dash v1.4.0 - Tactical Windows 11 Audio Optimizer\n");
    config.push_str(&format!("# Active Profile: {}\n", profile));
    config.push_str("# ========================================================\n\n");

    if profile.to_uppercase() == "NORMAL" {
        config.push_str("Preamp: 0.0 dB\n");
        config.push_str("# Neutral profile active - All competitive filters bypassed\n");
        return config;
    }

    // FASE 1: Calibración Hardware AutoEQ (FUERA DEL IF - AFECTA A TODO EL SISTEMA)
    if !headphone_filters.is_empty() {
        config.push_str("# --- FASE 1: CALIBRACION HARDWARE AUTOEQ (SISTEMA COMPLETO) ---\n");
        for filter in headphone_filters {
            config.push_str(filter);
            config.push('\n');
        }
        config.push('\n');
    }

    // ENRUTAMIENTO CONDICIONAL: PROTECCIÓN ANTI-DISCORD (SOLO AFECTA AL JUEGO)
    config.push_str("If: app:cod.exe\n\n");

    // 1. ATENUACIÓN DEL CANAL CENTRAL (Pre-Mix: amortigua disparos y recargas propias)
    if values.atenuacion_propia < -0.05 {
        let att_db = values.atenuacion_propia.clamp(-12.0, 0.0);
        config.push_str("# --- ATENUACION CANAL CENTRAL (DISPAROS Y RECARGAS PROPIAS) ---\n");
        config.push_str("Stage: pre-mix\n");
        config.push_str("Channel: C\n");
        config.push_str(&format!("Preamp: {:.1} dB\n", att_db));
        config.push_str("Channel: all\n\n");
    }

    // FASE 2: Compresor Dinámico VST (LoudMax con Ataque Conservado o Distance Aware)
    let comp_ratio = (values.compresion / 100.0).clamp(0.0, 1.0);
    if comp_ratio > 0.02 {
        let vst_path = get_vst_plugin_path();

        config.push_str("# --- FASE 2: COMPRESION DINAMICA VST ---\n");
        if vst_path.exists() {
            if distance_aware {
                // Modo Distancia ON: Compresión suave (-12 dB, Ceiling -1 dB, Atk 15ms, Rel 100ms) para percibir distancias
                config.push_str(&format!(
                    "VSTPlugin: Library \"{}\" -12.0 -1.0 15.0 100.0\n",
                    vst_path.to_string_lossy()
                ));
            } else {
                // Modo Distancia OFF: Compresión agresiva (-24 dB, Ceiling -1 dB, Atk 12ms, Rel 80ms) para máximo realce de pasos
                config.push_str(&format!(
                    "VSTPlugin: Library \"{}\" -24.0 -1.0 12.0 80.0\n",
                    vst_path.to_string_lossy()
                ));
            }
        } else {
            let make_up_gain = comp_ratio * (if distance_aware { 2.5 } else { 4.5 });
            config.push_str(
                "# LoudMax VST en proceso de descarga - Compensacion de ganancia nativa activa:\n",
            );
            config.push_str(&format!(
                "Filter: ON PK Fc 2500 Hz Gain +{:.2} dB Q 0.70\n",
                make_up_gain
            ));
        }
        config.push('\n');
    }

    // FASE 3: Controles de Ingeniería Perceptual con Preamp Dinámico Anti-Clipping
    config.push_str("# --- FASE 3: CURVA TACTICA PERCEPTUAL & PREAMP ANTI-CLIPPING ---\n");

    // Preamp Dinámico Anti-Clipping: Suma de picos máximos activos + margen de seguridad (-2.0 dB)
    let pasos_ratio = (values.pasos / 10.0).clamp(0.0, 1.0);
    let gain_pasos = if pasos_ratio > 0.05 { (3.5 * pasos_ratio) + (2.5 * pasos_ratio) } else { 0.0 };

    let claridad_ratio = (values.claridad / 10.0).clamp(0.0, 1.0);
    let gain_claridad = if claridad_ratio > 0.05 { 2.0 * claridad_ratio } else { 0.0 };

    let gain_clutch = if is_clutch { 8.0 + 4.0 } else { 0.0 };

    let total_boost = gain_pasos + gain_claridad + gain_clutch;
    let dynamic_anti_clip = -(total_boost + 2.0);
    let maestro_offset = values.maestro.clamp(-12.0, 0.0);
    let final_preamp = (dynamic_anti_clip + maestro_offset).clamp(-30.0, 0.0);

    config.push_str(&format!("Preamp: {:.1} dB\n", final_preamp));

    // Filtro Pasa-Altos Base Táctico (70 Hz, Q 0.707): Limpia energía sísmica e infragravitatoria independientemente de los sliders
    config.push_str("Filter: ON HPQ Fc 70 Hz Q 0.707\n");

    // 1. Slider "Pasos" (0 - 10): Boost 2500 Hz & 4000 Hz
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

    // 2. Slider "Bombas" (0 - 10): Cut low rumble
    let bombas_ratio = (values.bombas / 10.0).clamp(0.0, 1.0);
    if bombas_ratio > 0.05 {
        let hp_freq = 60.0 + (60.0 * bombas_ratio);
        let ls_gain = -4.0 * bombas_ratio;
        config.push_str(&format!("Filter: ON HP Fc {:.0} Hz\n", hp_freq));
        config.push_str(&format!(
            "Filter: ON LS Fc 200 Hz Gain {:.2} dB\n",
            ls_gain
        ));
    }

    // 3. Slider "Disparos" (0 - 10): High-Shelf at 6000 Hz
    let disparos_ratio = (values.disparos / 10.0).clamp(0.0, 1.0);
    if disparos_ratio > 0.05 {
        let hs_gain = -3.0 * disparos_ratio;
        config.push_str(&format!(
            "Filter: ON HS Fc 6000 Hz Gain {:.2} dB\n",
            hs_gain
        ));
    }

    // 4. Slider "Claridad" (0 - 10): Peaking at 1500 Hz
    if claridad_ratio > 0.05 {
        let peak_gain = 2.0 * claridad_ratio;
        config.push_str(&format!(
            "Filter: ON PK Fc 1500 Hz Gain +{:.2} dB Q 1.40\n",
            peak_gain
        ));
    }

    // MODO CLUTCH HIPER-ENFOQUE (Si está activo)
    if is_clutch {
        config.push_str("\n# --- MODO CLUTCH HIPER-ENFOQUE ACTIVO (+8.0 dB EN 2.5 kHz) ---\n");
        config.push_str("Filter: ON PK Fc 2500 Hz Gain +8.00 dB Q 1.50\n");
        config.push_str("Filter: ON PK Fc 4000 Hz Gain +4.00 dB Q 1.20\n");
    }

    // CIERRE DEL ENRUTAMIENTO CONDICIONAL
    config.push_str("\nEndIf:\n\n");

    // FASE 4: Virtualización Espacial HRTF / HeSuVi (FUERA DEL IF - AFECTA A TODO EL SISTEMA)
    if let Some(filename) = hrtf_filename {
        if !filename.is_empty() {
            let hrir_path = crate::hrtf_engine::get_hrir_profile_path(filename);
            if hrir_path.exists() {
                config.push_str("# --- FASE 4: VIRTUALIZACION ESPACIAL HRTF (7.1 SURROUND) ---\n");
                config.push_str(&format!(
                    "Convolution: \"{}\"\n",
                    hrir_path.to_string_lossy()
                ));
            }
        }
    }

    config
}

/// Atomically writes config in %APPDATA%\AudioDash\config.txt
#[tauri::command]
pub fn update_eq_profile(
    slider_values: SliderValues,
    profile: String,
    headphone_filters: Vec<String>,
    hrtf_filename: Option<String>,
    is_clutch: Option<bool>,
    distance_aware: Option<bool>,
) -> Result<(), String> {
    let config_path = get_user_config_path();
    let tmp_path = config_path.with_extension("tmp");
    let clutch_active = is_clutch.unwrap_or_else(crate::clutch_mode::is_clutch_active);
    let distance_aware_active = distance_aware.unwrap_or(false);

    let content = generate_apo_config(
        &slider_values,
        &profile,
        &headphone_filters,
        hrtf_filename.as_deref(),
        clutch_active,
        distance_aware_active,
    );

    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let write_result = (|| -> Result<(), std::io::Error> {
        let mut tmp_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp_path)?;

        tmp_file.write_all(content.as_bytes())?;
        tmp_file.flush()?;
        drop(tmp_file);

        if fs::rename(&tmp_path, &config_path).is_err() {
            fs::write(&config_path, content.as_bytes())?;
            let _ = fs::remove_file(&tmp_path);
        }
        Ok(())
    })();

    if let Err(_) = write_result {
        fs::write(&config_path, content.as_bytes())
            .map_err(|err| format!("Error escribiendo archivo de configuración: {}", err))?;
    }

    // Asegurar que el config.txt principal de Equalizer APO incluya AudioDash.txt
    ensure_apo_config_linked();

    Ok(())
}

/// Zero-Config: Ensures LoudMax64.dll is downloaded locally into %APPDATA%\AudioDash\plugins\
#[tauri::command]
pub async fn ensure_vst_plugin_installed() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        let plugin_path = get_vst_plugin_path();
        if plugin_path.exists() {
            return Ok(true);
        }

        let _ = get_plugins_dir();

        #[cfg(windows)]
        {
            use std::process::Command;
            // 1. Try Windows native curl
            let curl_res = Command::new("curl.exe")
                .arg("-s")
                .arg("-L")
                .arg("-o")
                .arg(&plugin_path)
                .arg(LOUDMAX_DOWNLOAD_URL)
                .output();

            if let Ok(out) = curl_res {
                if out.status.success() && plugin_path.exists() {
                    return Ok(true);
                }
            }

            // 2. Fallback to PowerShell Invoke-WebRequest
            let script = format!(
                "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                LOUDMAX_DOWNLOAD_URL,
                plugin_path.to_string_lossy()
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
                if ps_out.status.success() && plugin_path.exists() {
                    return Ok(true);
                }
            }
        }

        Ok(plugin_path.exists())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Forces instant hot-reload of the audio buffer
#[tauri::command]
pub async fn force_audio_refresh() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        let path = get_user_config_path();
        if path.exists() {
            if let Ok(file) = OpenOptions::new().write(true).open(&path) {
                let _ = file.set_len(file.metadata().map(|m| m.len()).unwrap_or(0));
            }
        }

        #[cfg(windows)]
        {
            trigger_windows_audio_endpoint_notification();
        }

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn trigger_windows_audio_endpoint_notification() {
    use crate::com_guard::ComGuard;
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    let _com = ComGuard::new_mta();
    unsafe {
        if let Ok(enumerator) =
            CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
        {
            let _ = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia);
        }
    }
}
