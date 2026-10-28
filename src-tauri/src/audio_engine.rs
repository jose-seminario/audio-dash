use crate::dependencies::get_appdata_dir;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const LOUDMAX_DOWNLOAD_URL: &str =
    "https://github.com/jose-seminario/audio-dash/releases/download/v1.0.1/LoudMax64.dll";

const EQUALIZER_APO_DOWNLOAD_URL: &str =
    "https://sourceforge.net/projects/equalizerapo/files/1.3/EqualizerAPO64-1.3.exe/download";

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

/// Ensures Equalizer APO's main config.txt includes AudioDash.txt with quoted path and CRLF preservation
pub fn ensure_apo_config_linked() {
    let target_path = get_user_config_path();
    let target_str = target_path.to_string_lossy();

    let parent_dir = match target_path.parent() {
        Some(p) => p,
        None => return,
    };

    let main_config = parent_dir.join("config.txt");
    let expected_include = format!("Include: \"{}\"", target_str);

    if main_config.exists() {
        if let Ok(content) = fs::read_to_string(&main_config) {
            if content.contains(&expected_include) || content.contains(&format!("Include: {}", target_str)) {
                return;
            }

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
    selected_device: Option<&str>,
    test_mode: bool,
) -> String {
    let mut config = String::new();
    config.push_str("# ========================================================\n");
    config.push_str("# Audio Dash v1.4.0 - Tactical Windows 11 Audio Optimizer\n");
    config.push_str(&format!("# Active Profile: {}\n", profile));
    config.push_str("# ========================================================\n\n");

    // Si el perfil es explícitamente NORMAL y NO está en modo de prueba global, aplicar bypass neutral
    if profile.to_uppercase() == "NORMAL" && !test_mode {
        config.push_str("Preamp: 0.0 dB\n");
        config.push_str("# Neutral profile active - All competitive filters bypassed\n");
        return config;
    }

    // ENRUTAMIENTO POR DISPOSITIVO (Solo si se especificó un dispositivo real distinto al estándar)
    if !test_mode {
        if let Some(dev) = selected_device {
            let dev_clean = dev.trim();
            if !dev_clean.is_empty()
                && !dev_clean.eq_ignore_ascii_case("Dispositivo Estándar")
                && !dev_clean.eq_ignore_ascii_case("Todos los Dispositivos")
            {
                config.push_str(&format!("Device: \"{}\"\n\n", dev_clean));
            }
        }
    } else {
        config.push_str("# --- MODO DE PRUEBA ACTIVO (FILTROS GLOBALES EN TIEMPO REAL) ---\n\n");
    }

    // FASE 1: Calibración Hardware AutoEQ
    let mut autoeq_boost = 0.0f32;
    if !headphone_filters.is_empty() {
        config.push_str("# --- FASE 1: CALIBRACION HARDWARE AUTOEQ (RESPUESTA PLANA) ---\n");
        for filter in headphone_filters {
            config.push_str(filter);
            config.push('\n');

            // Analizar posibles picos de ganancia positiva en los filtros de AutoEQ para sumarlos al anti-clipping
            if let Some(pos) = filter.find("Gain +") {
                let rest = &filter[pos + 6..];
                if let Some(space_idx) = rest.find(' ') {
                    if let Ok(gain_val) = rest[..space_idx].parse::<f32>() {
                        autoeq_boost += gain_val.max(0.0);
                    }
                }
            }
        }
        config.push('\n');
    }

    // FASE 2: Atenuación del Canal Central (Pre-Mix: amortigua disparos y recargas propias)
    if values.atenuacion_propia < -0.05 {
        let att_db = values.atenuacion_propia.clamp(-12.0, 0.0);
        config.push_str("# --- ATENUACION CANAL CENTRAL (DISPAROS Y RECARGAS PROPIAS) ---\n");
        config.push_str("Stage: pre-mix\n");
        config.push_str("Channel: C\n");
        config.push_str(&format!("Preamp: {:.1} dB\n", att_db));
        config.push_str("Channel: all\n\n");
    }

    // FASE 3: Compresor Dinámico VST (LoudMax con Ataque Conservado o Distance Aware)
    let comp_ratio = (values.compresion / 100.0).clamp(0.0, 1.0);
    let mut vst_makeup_gain = 0.0f32;

    if comp_ratio > 0.02 {
        let vst_path = get_vst_plugin_path();
        vst_makeup_gain = comp_ratio * (if distance_aware { 2.5 } else { 4.5 });

        config.push_str("# --- FASE 2: COMPRESION DINAMICA VST ---\n");
        if vst_path.exists() {
            if distance_aware {
                // Modo Distancia ON: Compresión suave (-12 dB, Ceiling -1 dB, Atk 15ms, Rel 100ms)
                config.push_str(&format!(
                    "VSTPlugin: Library \"{}\" -12.0 -1.0 15.0 100.0\n",
                    vst_path.to_string_lossy()
                ));
            } else {
                // Modo Distancia OFF: Compresión agresiva (-24 dB, Ceiling -1 dB, Atk 12ms, Rel 80ms)
                config.push_str(&format!(
                    "VSTPlugin: Library \"{}\" -24.0 -1.0 12.0 80.0\n",
                    vst_path.to_string_lossy()
                ));
            }
        } else {
            config.push_str(
                "# LoudMax VST no detectado - Compensacion de ganancia nativa activa:\n",
            );
            config.push_str(&format!(
                "Filter: ON PK Fc 2500 Hz Gain +{:.2} dB Q 0.70\n",
                vst_makeup_gain
            ));
        }
        config.push('\n');
    }

    // FASE 4: Controles de Ingeniería Perceptual con Preamp Dinámico Anti-Clipping Integral
    config.push_str("# --- FASE 3: CURVA TACTICA PERCEPTUAL & PREAMP ANTI-CLIPPING ---\n");

    let pasos_ratio = (values.pasos / 10.0).clamp(0.0, 1.0);
    let gain_pasos = if pasos_ratio > 0.05 { (3.5 * pasos_ratio) + (2.5 * pasos_ratio) } else { 0.0 };

    let claridad_ratio = (values.claridad / 10.0).clamp(0.0, 1.0);
    let gain_claridad = if claridad_ratio > 0.05 { 2.0 * claridad_ratio } else { 0.0 };

    let gain_clutch = if is_clutch { 8.0 + 4.0 } else { 0.0 };

    // Anti-clipping riguroso: suma de picos + make-up gain + boosts AutoEQ + margen de seguridad (1.5 dB)
    let total_boost = gain_pasos + gain_claridad + gain_clutch + (vst_makeup_gain * 0.5) + autoeq_boost.min(6.0);
    let dynamic_anti_clip = -(total_boost + 1.5);
    let maestro_offset = values.maestro.clamp(-12.0, 0.0);
    let final_preamp = (dynamic_anti_clip + maestro_offset).clamp(-30.0, 0.0);

    config.push_str(&format!("Preamp: {:.1} dB\n", final_preamp));

    // Filtro Pasa-Altos Unificado: No duplicar el corte si el slider de bombas está activo
    let bombas_ratio = (values.bombas / 10.0).clamp(0.0, 1.0);
    let hp_cutoff = if bombas_ratio > 0.05 {
        70.0 + (50.0 * bombas_ratio)
    } else {
        70.0
    };
    config.push_str(&format!("Filter: ON HPQ Fc {:.0} Hz Q 0.707\n", hp_cutoff));

    // 1. Slider "Bombas" (0 - 10): Low-Shelf at 200 Hz
    if bombas_ratio > 0.05 {
        let ls_gain = -4.0 * bombas_ratio;
        config.push_str(&format!(
            "Filter: ON LS Fc 200 Hz Gain {:.2} dB\n",
            ls_gain
        ));
    }

    // 2. Slider "Pasos" (0 - 10): Boost 2500 Hz & 4000 Hz
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

    // MODO CLUTCH HIPER-ENFOQUE
    if is_clutch {
        config.push_str("\n# --- MODO CLUTCH HIPER-ENFOQUE ACTIVO (+8.0 dB EN 2.5 kHz) ---\n");
        config.push_str("Filter: ON PK Fc 2500 Hz Gain +8.00 dB Q 1.50\n");
        config.push_str("Filter: ON PK Fc 4000 Hz Gain +4.00 dB Q 1.20\n");
    }

    // FASE 5: Virtualización Espacial HRTF / HeSuVi
    if let Some(filename) = hrtf_filename {
        if !filename.is_empty() {
            let hrir_path = crate::hrtf_engine::get_hrir_profile_path(filename);
            if hrir_path.exists() {
                config.push_str("\n# --- FASE 4: VIRTUALIZACION ESPACIAL HRTF (7.1 SURROUND) ---\n");
                config.push_str(&format!(
                    "Convolution: \"{}\"\n",
                    hrir_path.to_string_lossy()
                ));
            }
        }
    }

    config
}

/// Helper to trigger hot-reload of audio buffer in Equalizer APO
pub fn execute_audio_refresh() {
    let path = get_user_config_path();
    if path.exists() {
        if let Ok(file) = OpenOptions::new().write(true).open(&path) {
            let _ = file.sync_all();
        }
    }
}

/// Atomically writes config into Equalizer APO folder with resilient fallback
#[tauri::command]
pub fn update_eq_profile(
    slider_values: SliderValues,
    profile: String,
    headphone_filters: Vec<String>,
    hrtf_filename: Option<String>,
    is_clutch: Option<bool>,
    distance_aware: Option<bool>,
    selected_device: Option<String>,
    test_mode: Option<bool>,
) -> Result<(), String> {
    let config_path = get_user_config_path();
    let tmp_path = config_path.with_extension("tmp");
    let clutch_active = is_clutch.unwrap_or_else(crate::clutch_mode::is_clutch_active);
    let distance_aware_active = distance_aware.unwrap_or(false);
    let is_test_mode = test_mode.unwrap_or(false);

    let content = generate_apo_config(
        &slider_values,
        &profile,
        &headphone_filters,
        hrtf_filename.as_deref(),
        clutch_active,
        distance_aware_active,
        selected_device.as_deref(),
        is_test_mode,
    );

    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // 1. Escritura en archivo temporal
    let mut tmp_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&tmp_path)
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::PermissionDenied || err.raw_os_error() == Some(5) {
                "PERMISSION_DENIED: Usa el botón 'Auto-Configurar Todo (1-Clic)' para otorgar permisos a Equalizer APO".to_string()
            } else {
                format!("Error escribiendo archivo temporal: {}", err)
            }
        })?;

    tmp_file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    tmp_file.flush().map_err(|e| e.to_string())?;
    drop(tmp_file);

    // 2. Reemplazo seguro atómico sin dejar el destino vacío
    if fs::rename(&tmp_path, &config_path).is_err() {
        // Fallback copia directa con sobreescritura atómica
        fs::copy(&tmp_path, &config_path).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!("Error al actualizar AudioDash.txt: {}", e)
        })?;
        let _ = fs::remove_file(&tmp_path);
    }

    ensure_apo_config_linked();
    execute_audio_refresh();

    Ok(())
}

/// Zero-Config: Ensures LoudMax64.dll is securely downloaded into %APPDATA%\AudioDash\plugins\
/// Validates HTTP status (-f) and minimum file size (>100KB) to prevent 404 HTML corruption
#[tauri::command]
pub async fn ensure_vst_plugin_installed() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        let plugin_path = get_vst_plugin_path();
        if plugin_path.exists() {
            if let Ok(meta) = fs::metadata(&plugin_path) {
                if meta.len() > 100_000 {
                    return Ok(true);
                }
            }
        }

        let _ = get_plugins_dir();
        let part_path = plugin_path.with_extension("part");

        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = fs::remove_file(&part_path);

            // 1. Try Windows native curl con flags estrictas: -f (fail on 4xx/5xx), -s, -S, -L
            let curl_res = Command::new("curl.exe")
                .arg("-f")
                .arg("-s")
                .arg("-S")
                .arg("-L")
                .arg("-o")
                .arg(&part_path)
                .arg(LOUDMAX_DOWNLOAD_URL)
                .output();

            if let Ok(out) = curl_res {
                if out.status.success() && part_path.exists() {
                    if let Ok(meta) = fs::metadata(&part_path) {
                        if meta.len() > 100_000 {
                            let _ = fs::rename(&part_path, &plugin_path);
                            return Ok(plugin_path.exists());
                        }
                    }
                }
            }

            // 2. Fallback con PowerShell
            let script = format!(
                "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                LOUDMAX_DOWNLOAD_URL,
                part_path.to_string_lossy()
            );

            let encoded = crate::system_audit::encode_powershell_script(&script);
            let ps_res = Command::new("powershell.exe")
                .arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-WindowStyle")
                .arg("Hidden")
                .arg("-EncodedCommand")
                .arg(&encoded)
                .output();

            if let Ok(ps_out) = ps_res {
                if ps_out.status.success() && part_path.exists() {
                    if let Ok(meta) = fs::metadata(&part_path) {
                        if meta.len() > 100_000 {
                            let _ = fs::rename(&part_path, &plugin_path);
                            return Ok(plugin_path.exists());
                        }
                    }
                }
            }
            let _ = fs::remove_file(&part_path);
        }

        Ok(plugin_path.exists())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Automated 1-Click Installer for Equalizer APO:
/// Downloads the official 64-bit installer to %TEMP% and runs it with /S via elevated UAC
#[tauri::command]
pub async fn auto_install_equalizer_apo() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        let temp_dir = std::env::temp_dir();
        let installer_part = temp_dir.join("EqualizerAPO64-1.3.exe.part");
        let installer_exe = temp_dir.join("EqualizerAPO64-1.3.exe");

        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = fs::remove_file(&installer_part);

            // Descarga segura con curl
            let curl_res = Command::new("curl.exe")
                .arg("-f")
                .arg("-s")
                .arg("-S")
                .arg("-L")
                .arg("-o")
                .arg(&installer_part)
                .arg(EQUALIZER_APO_DOWNLOAD_URL)
                .output();

            let mut downloaded = false;
            if let Ok(out) = curl_res {
                if out.status.success() && installer_part.exists() {
                    if let Ok(meta) = fs::metadata(&installer_part) {
                        if meta.len() > 2_000_000 {
                            let _ = fs::rename(&installer_part, &installer_exe);
                            downloaded = true;
                        }
                    }
                }
            }

            if !downloaded {
                return Err("No se pudo descargar el instalador oficial de Equalizer APO. Verifica tu conexión a internet.".to_string());
            }

            // Ejecución silenciosa elevada con /S
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

            let file_wide: Vec<u16> = OsStr::new(&installer_exe)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let verb_wide: Vec<u16> = OsStr::new("runas")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let params_wide: Vec<u16> = OsStr::new("/S")
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
                    SW_SHOWNORMAL,
                )
            };

            let launched = (instance.0 as isize) > 32;
            Ok(launched)
        }

        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Forces instant hot-reload of the audio buffer
#[tauri::command]
pub async fn force_audio_refresh() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        execute_audio_refresh();
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}
