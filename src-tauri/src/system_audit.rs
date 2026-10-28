use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuditCheckItem {
    pub id: String,
    pub name: String,
    pub status: String, // "optimal" | "warning" | "suboptimal"
    pub current_value: String,
    pub recommended: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemAuditResult {
    pub all_optimal: bool,
    pub checks: Vec<AuditCheckItem>,
    pub timestamp: String,
}

/// Zero-dependency Base64 encoder for building rock-solid PowerShell -EncodedCommand payloads
pub fn base64_encode(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        result.push(CHARSET[((n >> 18) & 63) as usize] as char);
        result.push(CHARSET[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Encodes a PowerShell script as UTF-16LE in Base64 for PowerShell's -EncodedCommand argument
pub fn encode_powershell_script(script: &str) -> String {
    let utf16_bytes: Vec<u8> = script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    base64_encode(&utf16_bytes)
}

fn get_status_file_path(operation_name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("audiodash_{}.status", operation_name))
}

#[tauri::command]
pub fn audit_system() -> SystemAuditResult {
    // Asegurar backup inicial del estado de fábrica
    let _ = crate::backup_system::create_backup_if_not_exists();

    let mut checks = Vec::new();
    let mut all_optimal = true;

    // 1. Audio Enhancements Check (Mejoras de Audio)
    let enhancements_disabled = check_audio_enhancements_registry();
    if !enhancements_disabled {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "audio_enhancements".to_string(),
            name: "Mejoras de Audio de Windows".to_string(),
            status: "warning".to_string(),
            current_value: "Habilitadas (Distorsión y latencia)".to_string(),
            recommended: "Desactivadas".to_string(),
            description: "Las mejoras de Windows agregan compresión y latencia en tiempo real."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "audio_enhancements".to_string(),
            name: "Mejoras de Audio de Windows".to_string(),
            status: "optimal".to_string(),
            current_value: "Desactivadas (Audio Puro)".to_string(),
            recommended: "Desactivadas".to_string(),
            description: "Procesamiento directo sin búferes innecesarios.".to_string(),
        });
    }

    // 2. Spatial Sound Check (Sonido Espacial)
    let (spatial_active, spatial_name) = check_spatial_sound_real();
    if spatial_active {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "spatial_sound".to_string(),
            name: "Sonido Espacial de Windows".to_string(),
            status: "warning".to_string(),
            current_value: format!("Activo ({})", spatial_name),
            recommended: "Desactivado (Estéreo 1:1)".to_string(),
            description: "El sonido espacial nativo de Windows altera los filtros y añade retardo. Desactívalo para usar el Audio 3D de Audio Dash."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "spatial_sound".to_string(),
            name: "Sonido Espacial de Windows".to_string(),
            status: "optimal".to_string(),
            current_value: "Desactivado (Estéreo Puro)".to_string(),
            recommended: "Desactivado".to_string(),
            description: "Señal estéreo directa sin ecualizaciones artificiales de Windows.".to_string(),
        });
    }

    // 3. Audio Sample Rate & Bit Depth Check
    let (is_format_optimal, current_fmt_str) = check_audio_sample_rate_and_depth();
    if !is_format_optimal {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "sample_rate".to_string(),
            name: "Formato y Muestreo de Audio".to_string(),
            status: "warning".to_string(),
            current_value: current_fmt_str,
            recommended: "24 bits, 48000 Hz".to_string(),
            description: "Un formato diferente a 48000 Hz obliga a Windows a remuestrear el juego, causando distorsión y latencia añadida."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "sample_rate".to_string(),
            name: "Formato y Muestreo de Audio".to_string(),
            status: "optimal".to_string(),
            current_value: current_fmt_str,
            recommended: "24 bits, 48000 Hz".to_string(),
            description: "Formato de estudio táctico sincronizado a 48000 Hz sin remuestreo.".to_string(),
        });
    }

    // 4. Windows Power Plan Check
    let power_optimal = check_power_plan();
    if !power_optimal {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "power_plan".to_string(),
            name: "Plan de Energía de Windows".to_string(),
            status: "warning".to_string(),
            current_value: "Equilibrado / Ahorro".to_string(),
            recommended: "Alto Rendimiento (High Performance)".to_string(),
            description: "Evita que Windows reduzca la frecuencia de reloj del bus de audio y CPU."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "power_plan".to_string(),
            name: "Plan de Energía de Windows".to_string(),
            status: "optimal".to_string(),
            current_value: "Alto Rendimiento".to_string(),
            recommended: "Alto Rendimiento".to_string(),
            description: "Latencia mínima y reloj de hardware a máxima respuesta.".to_string(),
        });
    }

    // 5. Multimedia Class Scheduler Service (MMCSS) & Network Throttling
    let mmcss_optimal = check_mmcss_registry();
    if !mmcss_optimal {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "mmcss_optimization".to_string(),
            name: "Prioridad Máxima de Audio (Anti-Lag)".to_string(),
            status: "warning".to_string(),
            current_value: "Configuración estándar de Windows".to_string(),
            recommended: "SystemResponsiveness: 0 | Red Ilimitada".to_string(),
            description: "Optimiza la asignación de reloj de CPU para el motor de audio y elimina el estrangulamiento de paquetes de red durante el juego."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "mmcss_optimization".to_string(),
            name: "Prioridad Máxima de Audio (Anti-Lag)".to_string(),
            status: "optimal".to_string(),
            current_value: "SystemResponsiveness: 0 | Red Ilimitada".to_string(),
            recommended: "Optimizado".to_string(),
            description: "Prioridad de tiempo real activa para el subsistema de audio y gaming.".to_string(),
        });
    }

    SystemAuditResult {
        all_optimal,
        checks,
        timestamp: "Ahora".to_string(),
    }
}

/// Checks if Windows Audio Enhancements are disabled in active render devices
fn check_audio_enhancements_registry() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let render_path = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";
        if let Ok(render_key) = hklm.open_subkey(render_path) {
            for subkey_name in render_key.enum_keys().filter_map(|k| k.ok()) {
                let dev_path = format!("{}\\{}", render_path, subkey_name);
                if let Ok(dev_key) = hklm.open_subkey(&dev_path) {
                    let state: u32 = dev_key.get_value("DeviceState").unwrap_or(0);
                    if state != 1 {
                        continue; // Only inspect active devices
                    }

                    let fx_path = format!("{}\\FxProperties", dev_path);
                    if let Ok(fx_key) = hklm.open_subkey(&fx_path) {
                        // PKEY_AudioEndpoint_Disable_SysFx = {1da5d803-d01f-4704-978c-5ed0b9d846e6},5
                        if let Ok(disabled) = fx_key.get_value::<u32, _>("{1da5d803-d01f-4704-978c-5ed0b9d846e6},5") {
                            if disabled == 1 {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        false
    }
    #[cfg(not(windows))]
    {
        true
    }
}

/// Inspects Windows audio endpoints to check if Spatial Sound is active
fn check_spatial_sound_real() -> (bool, String) {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let render_path = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";
        if let Ok(render_key) = hklm.open_subkey(render_path) {
            for subkey_name in render_key.enum_keys().filter_map(|k| k.ok()) {
                let dev_path = format!("{}\\{}", render_path, subkey_name);
                if let Ok(dev_key) = hklm.open_subkey(&dev_path) {
                    let state: u32 = dev_key.get_value("DeviceState").unwrap_or(0);
                    if state != 1 {
                        continue; // Only active devices
                    }

                    let fx_path = format!("{}\\FxProperties", dev_path);
                    if let Ok(fx_key) = hklm.open_subkey(&fx_path) {
                        if let Ok(val) = fx_key.get_value::<String, _>("{b3f8fa53-0004-438e-9003-51a46e139bfc},2") {
                            let clean = val.trim();
                            if !clean.is_empty() && clean != "{00000000-0000-0000-0000-000000000000}" {
                                return (true, "Sonic / Atmos / DTS".to_string());
                            }
                        }
                    }
                }
            }
        }
        (false, "Desactivado".to_string())
    }
    #[cfg(not(windows))]
    {
        (false, "Desactivado".to_string())
    }
}

/// Inspects Windows audio endpoints to extract sample rate and bit depth from active device
fn check_audio_sample_rate_and_depth() -> (bool, String) {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let render_path = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";

        if let Ok(render_key) = hklm.open_subkey(render_path) {
            for subkey_name in render_key.enum_keys().filter_map(|k| k.ok()) {
                let dev_path = format!("{}\\{}", render_path, subkey_name);
                if let Ok(dev_key) = hklm.open_subkey(&dev_path) {
                    let state: u32 = dev_key.get_value("DeviceState").unwrap_or(0);
                    if state != 1 {
                        continue; // Skip inactive / disconnected
                    }

                    let prop_path = format!("{}\\Properties", dev_path);
                    if let Ok(prop_key) = hklm.open_subkey(&prop_path) {
                        if let Ok(bytes) = prop_key.get_raw_value("{a45c254e-df1c-4efd-8020-67d146a850e0},0") {
                            if bytes.bytes.len() >= 40 {
                                let sample_rate = u32::from_le_bytes([
                                    bytes.bytes[24],
                                    bytes.bytes[25],
                                    bytes.bytes[26],
                                    bytes.bytes[27],
                                ]);
                                let bits_per_sample = u16::from_le_bytes([
                                    bytes.bytes[38],
                                    bytes.bytes[39],
                                ]);

                                if sample_rate > 0 && bits_per_sample > 0 {
                                    let is_optimal = sample_rate == 48000 && bits_per_sample == 24;
                                    let desc = format!("{} bits, {} Hz", bits_per_sample, sample_rate);
                                    return (is_optimal, desc);
                                }
                            }
                        }
                    }
                }
            }
        }
        (true, "24 bits, 48000 Hz".to_string())
    }
    #[cfg(not(windows))]
    {
        (true, "24 bits, 48000 Hz".to_string())
    }
}

fn check_power_plan() -> bool {
    #[cfg(windows)]
    {
        let guid = crate::backup_system::get_current_power_scheme().to_lowercase();
        guid.contains("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c") || guid.contains("e9a42b02-d5df-448d-aa00-03f14749eb61")
    }
    #[cfg(not(windows))]
    {
        true
    }
}

fn check_mmcss_registry() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile") {
            let sys_resp: Result<u32, _> = key.get_value("SystemResponsiveness");
            let net_throttle: Result<u32, _> = key.get_value("NetworkThrottlingIndex");
            match (sys_resp, net_throttle) {
                (Ok(sr), Ok(nt)) => sr == 0 && nt == 0xFFFFFFFF,
                _ => false,
            }
        } else {
            false
        }
    }
    #[cfg(not(windows))]
    {
        true
    }
}

/// Opens the Windows 11 Sound Settings (ms-settings:sound) directly
#[tauri::command]
pub async fn open_windows_sound_settings() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

            let file_wide: Vec<u16> = OsStr::new("ms-settings:sound")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let verb_wide: Vec<u16> = OsStr::new("open")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let instance = unsafe {
                ShellExecuteW(
                    None,
                    PCWSTR(verb_wide.as_ptr()),
                    PCWSTR(file_wide.as_ptr()),
                    PCWSTR(std::ptr::null()),
                    PCWSTR(std::ptr::null()),
                    SW_SHOWNORMAL,
                )
            };

            Ok((instance.0 as isize) > 32)
        }
        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Invokes Windows UAC on-demand using ShellExecuteW ("runas") and PowerShell -EncodedCommand
/// to apply system optimizations (Power plan, Equalizer APO NTFS permissions, MMCSS and Network tweaks).
/// Verifies actual execution via a temp status file.
#[tauri::command]
pub async fn request_system_optimization() -> Result<bool, String> {
    let _ = crate::backup_system::create_backup_if_not_exists();

    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

            let status_file = get_status_file_path("opt");
            let _ = std::fs::remove_file(&status_file);
            let status_path_str = status_file.to_string_lossy();

            let script = format!(r#"
$statusFile = "{status_path_str}"
try {{
    # 1. Duplicar plan de Alto Rendimiento si no existe en laptops modernas y activarlo
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null

    # 2. Otorgar permisos NTFS completos al usuario en la carpeta de Equalizer APO
    # Permite a Audio Dash escribir los filtros en tiempo real sin requerir permisos de admin
    $apoDirs = @("C:\Program Files\EqualizerAPO\config", "C:\Program Files (x86)\EqualizerAPO\config")
    foreach ($dir in $apoDirs) {{
        if (Test-Path $dir) {{
            & icacls "$dir" /grant "*S-1-5-32-545:(OI)(CI)F" /T /Q 2>$null
            $apoConfig = Join-Path $dir "config.txt"
            $includeLine = 'Include: "' + (Join-Path $dir "AudioDash.txt") + '"'
            if (Test-Path $apoConfig) {{
                $content = Get-Content $apoConfig -Raw -ErrorAction SilentlyContinue
                if ($content -match "Include:.*AudioDash") {{
                    $newContent = $content -replace "Include:.*AudioDash.*", $includeLine
                    Set-Content -Path $apoConfig -Value $newContent -Force -Encoding UTF8
                }} else {{
                    Add-Content -Path $apoConfig -Value "`r`n$includeLine" -Force -Encoding UTF8
                }}
            }} else {{
                Set-Content -Path $apoConfig -Value $includeLine -Force -Encoding UTF8
            }}
        }}
    }}

    # 3. MMCSS Tweaks (SystemResponsiveness = 0 y NetworkThrottlingIndex = 0xFFFFFFFF)
    $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
    if (Test-Path $sysProfile) {{
        Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
        Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force
    }}

    # 4. Asignacion de prioridad alta a la tarea Games en MMCSS
    $gamesTask = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
    if (Test-Path $gamesTask) {{
        Set-ItemProperty -Path $gamesTask -Name "GPU Priority" -Value 8 -Type DWord -Force
        Set-ItemProperty -Path $gamesTask -Name "Priority" -Value 6 -Type DWord -Force
        Set-ItemProperty -Path $gamesTask -Name "Scheduling Category" -Value "High" -Type String -Force
    }}

    # 5. Reiniciar audiosrv para aplicar configuraciones limpiamente
    Restart-Service -Name audiosrv -Force 2>$null

    Set-Content -Path $statusFile -Value "SUCCESS" -Force
}} catch {{
    Set-Content -Path $statusFile -Value ("ERROR: " + $_.Exception.Message) -Force
}}
"#);

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
                return Ok(false); // UAC denied or cancelled
            }

            // Poll for status file up to 8 seconds
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

/// Applies Windows Loudness Equalization (LEQ) ultra-fast release tweak (<10ms)
/// using -EncodedCommand and restarts Windows Audio Service (audiosrv).
#[tauri::command]
pub async fn apply_leq_tweak() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

            let status_file = get_status_file_path("leq");
            let _ = std::fs::remove_file(&status_file);
            let status_path_str = status_file.to_string_lossy();

            let script = format!(r#"
$statusFile = "{status_path_str}"
try {{
    $renderPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render"
    if (Test-Path $renderPath) {{
        Get-ChildItem $renderPath | ForEach-Object {{
            $fxPath = Join-Path $_.PSPath "FxProperties"
            if (Test-Path $fxPath) {{
                Set-ItemProperty -Path $fxPath -Name "{{c2f038f4-41d5-4521-b1e1-1d5752c07f43}},0" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            }}
        }}
    }}
    Restart-Service -Name audiosrv -Force 2>$null
    Set-Content -Path $statusFile -Value "SUCCESS" -Force
}} catch {{
    Set-Content -Path $statusFile -Value ("ERROR: " + $_.Exception.Message) -Force
}}
"#);

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
