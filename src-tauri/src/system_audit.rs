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
    let mut checks = Vec::new();
    let mut all_optimal = true;

    // 1. Audio Processing Objects (APO / SysFx) Check
    // Equalizer APO requiere que el procesamiento APO de Windows NO esté bloqueado (Disable_SysFx != 1)
    let apo_processing_enabled = check_audio_enhancements_registry();
    if !apo_processing_enabled {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "audio_enhancements".to_string(),
            name: "Procesamiento APO de Windows".to_string(),
            status: "warning".to_string(),
            current_value: "Bloqueado (Desactiva Equalizer APO)".to_string(),
            recommended: "Habilitado (Motor APO Activo)".to_string(),
            description: "Si Windows desactiva las mejoras de audio (Disable_SysFx = 1), Equalizer APO queda apagado y las perillas no surten efecto."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "audio_enhancements".to_string(),
            name: "Procesamiento APO de Windows".to_string(),
            status: "optimal".to_string(),
            current_value: "Habilitado (Motor APO Activo)".to_string(),
            recommended: "Habilitado".to_string(),
            description: "Canal de procesamiento abierto para que Equalizer APO aplique los filtros en tiempo real.".to_string(),
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

/// Checks that Windows Audio Processing Objects (SysFx / Equalizer APO) are NOT blocked (`Disable_SysFx != 1`)
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
                        // Si es 1, Windows está bloqueando Equalizer APO en este dispositivo activo
                        if let Ok(disabled) = fx_key.get_value::<u32, _>("{1da5d803-d01f-4704-978c-5ed0b9d846e6},5") {
                            if disabled == 1 {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        true
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

/// Inspects Windows audio endpoints to extract sample rate and bit depth from active physical devices
fn check_audio_sample_rate_and_depth() -> (bool, String) {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let render_path = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";
        let mut fallback_desc: Option<(bool, String)> = None;

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
                        let adapter_name: String = prop_key
                            .get_value::<String, _>("{b3f8fa53-0004-438e-9003-51a46e139bfc},6")
                            .unwrap_or_default()
                            .to_lowercase();
                        let is_virtual = adapter_name.contains("vb-audio") || adapter_name.contains("cable");

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
                                    if is_optimal && !is_virtual {
                                        return (true, desc);
                                    }
                                    if fallback_desc.is_none() || !is_virtual {
                                        fallback_desc = Some((is_optimal, desc));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        fallback_desc.unwrap_or((true, "24 bits, 48000 Hz".to_string()))
    }
    #[cfg(not(windows))]
    {
        (true, "24 bits, 48000 Hz".to_string())
    }
}

fn check_power_plan() -> bool {
    #[cfg(windows)]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("powercfg").arg("/getactivescheme").output() {
            let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if text.contains("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c")
                || text.contains("e9a42b02-d5df-448d-aa00-03f14749eb61")
                || text.contains("high performance")
                || text.contains("alto rendimiento")
                || text.contains("ultimate")
                || text.contains("máximo rendimiento")
            {
                return true;
            }
        }
        false
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
    # 1. Activar Plan de Alto Rendimiento (compatible con laptops Modern Standby)
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    if ($LASTEXITCODE -ne 0) {{
        $dupOut = powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
        if ($dupOut -match "([0-9a-fA-F]{{8}}-([0-9a-fA-F]{{4}}-){{3}}[0-9a-fA-F]{{12}})") {{
            powercfg /setactive $matches[1] 2>$null
        }}
    }}

    # 2. Desbloquear el motor APO en dispositivos activos (Disable_SysFx = 0)
    $renderPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render"
    if (Test-Path $renderPath) {{
        Get-ChildItem $renderPath | ForEach-Object {{
            $fxPath = Join-Path $_.PSPath "FxProperties"
            if (Test-Path $fxPath) {{
                Set-ItemProperty -Path $fxPath -Name "{{1da5d803-d01f-4704-978c-5ed0b9d846e6}},5" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            }}
        }}
    }}

    # 3. Otorgar permisos NTFS completos al usuario en la carpeta de Equalizer APO
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

    # 4. MMCSS Tweaks (SystemResponsiveness = 0 y NetworkThrottlingIndex = 0xFFFFFFFF)
    $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
    if (Test-Path $sysProfile) {{
        Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
        Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force
    }}

    # 5. Asignacion de prioridad alta a la tarea Games en MMCSS
    $gamesTask = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
    if (Test-Path $gamesTask) {{
        Set-ItemProperty -Path $gamesTask -Name "GPU Priority" -Value 8 -Type DWord -Force
        Set-ItemProperty -Path $gamesTask -Name "Priority" -Value 6 -Type DWord -Force
        Set-ItemProperty -Path $gamesTask -Name "Scheduling Category" -Value "High" -Type String -Force
    }}

    # 6. Reiniciar audiosrv para aplicar configuraciones limpiamente
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

            // Poll for status file up to 30 seconds (60 * 500ms)
            for _ in 0..60 {
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

            Ok(false)
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

            for _ in 0..60 {
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

            Ok(false)
        }
        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The "Verdadero Botón Mágico (1-Clic)"
/// Elevated PowerShell orchestration that automatically:
/// 1. Grants NTFS full control permissions to Users on EqualizerAPO config directory.
/// 2. Ensures AudioDash.txt is linked in config.txt.
/// 3. Checks and installs VB-Audio Virtual Cable driver silently if not present.
/// 4. Finds CABLE Input and Default Playback device, injecting Equalizer APO CLSIDs in FxProperties (Disable_SysFx = 0).
/// 5. Automatically configures CABLE Output to "Listen to this device" routed to the user's default physical playback device.
/// 6. Applies High Performance power plan & MMCSS gaming audio real-time priorities.
/// 7. Restarts Windows Audio Service (audiosrv).
#[tauri::command]
pub async fn run_one_click_magic_setup() -> Result<bool, String> {
    let _ = crate::backup_system::create_backup_if_not_exists();

    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

            let status_file = get_status_file_path("magic");
            let _ = std::fs::remove_file(&status_file);
            let status_path_str = status_file.to_string_lossy();

            let script = format!(r#"
$statusFile = "{status_path_str}"
try {{
    # 1. Otorgar permisos NTFS completos a las carpetas de Equalizer APO
    $apoDirs = @("C:\Program Files\EqualizerAPO\config", "C:\Program Files (x86)\EqualizerAPO\config")
    foreach ($dir in $apoDirs) {{
        if (Test-Path $dir) {{
            & icacls "$dir" /grant "*S-1-5-32-545:(OI)(CI)F" /T /Q 2>$null
            & icacls "$dir" /grant "Users:(OI)(CI)F" /T /Q 2>$null
            & icacls "$dir" /grant "*S-1-5-11:(OI)(CI)F" /T /Q 2>$null
            & icacls "$dir" /grant "Todos:(OI)(CI)F" /T /Q 2>$null

            # Asegurar include de AudioDash.txt en config.txt
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

    # 2. Comprobar / Instalar VB-Audio Virtual Cable silenciosamente si no existe
    $renderPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render"
    $hasCable = $false
    if (Test-Path $renderPath) {{
        $devs = Get-ChildItem $renderPath
        foreach ($d in $devs) {{
            $propPath = Join-Path $d.PSPath "Properties"
            if (Test-Path $propPath) {{
                $name = (Get-ItemProperty -Path $propPath -Name "{{a45c254e-df1c-4efd-8020-67d146a850e0}},2" -ErrorAction SilentlyContinue)."{{a45c254e-df1c-4efd-8020-67d146a850e0}},2"
                if ($name -match "CABLE Input") {{
                    $hasCable = $true
                    break
                }}
            }}
        }}
    }}

    if (-not $hasCable) {{
        $zipUrl = "https://download.vb-audio.com/Download_CAB/VBCABLE_Driver_Pack43.zip"
        $tempZip = Join-Path $env:TEMP "VBCABLE_Driver_Pack43.zip"
        $tempExtract = Join-Path $env:TEMP "VBCABLE_Driver"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing -ErrorAction SilentlyContinue
        if (Test-Path $tempZip) {{
            Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force -ErrorAction SilentlyContinue
            $inf64 = Join-Path $tempExtract "VBCABLE64_Setup.exe"
            $infDriver = Join-Path $tempExtract "vbcable64_win10.inf"
            if (Test-Path $infDriver) {{
                & pnputil.exe /add-driver $infDriver /install 2>$null
            }}
            if (Test-Path $inf64) {{
                & $inf64 -i -h 2>$null
            }}
        }}
    }}

    # 3. Detectar dispositivos de Render: CABLE Input y Dispositivo Predeterminado / Altavoces
    $cableInputGuid = $null
    $defaultRenderGuid = $null

    if (Test-Path $renderPath) {{
        Get-ChildItem $renderPath | ForEach-Object {{
            $guid = $_.PSChildName
            $devKey = $_.PSPath
            $state = (Get-ItemProperty -Path $devKey -Name "DeviceState" -ErrorAction SilentlyContinue).DeviceState
            if ($state -eq 1) {{
                $propPath = Join-Path $devKey "Properties"
                if (Test-Path $propPath) {{
                    $epName = (Get-ItemProperty -Path $propPath -Name "{{a45c254e-df1c-4efd-8020-67d146a850e0}},2" -ErrorAction SilentlyContinue)."{{a45c254e-df1c-4efd-8020-67d146a850e0}},2"
                    if ($epName -match "CABLE Input") {{
                        $cableInputGuid = $guid
                    }} elseif ($null -eq $defaultRenderGuid) {{
                        $defaultRenderGuid = $guid
                    }}
                }}

                # Desbloquear procesamiento APO en todos los dispositivos activos
                $fxPath = Join-Path $devKey "FxProperties"
                if (Test-Path $fxPath) {{
                    Set-ItemProperty -Path $fxPath -Name "{{1da5d803-d01f-4704-978c-5ed0b9d846e6}},5" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                }}
            }}
        }}
    }}

    # 4. Inyectar Equalizer APO en FxProperties (LFX/GFX universal y SFX/EFX para Windows 11 Realtek)
    Get-ChildItem $renderPath | ForEach-Object {{
        $devKey = $_.PSPath
        $state = (Get-ItemProperty -Path $devKey -Name "DeviceState" -ErrorAction SilentlyContinue).DeviceState
        if ($state -eq 1) {{
            $fxPath = Join-Path $devKey "FxProperties"
            if (Test-Path $fxPath) {{
                # LFX & GFX (Compatibilidad universal)
                Set-ItemProperty -Path $fxPath -Name "{{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}},5" -Value "{{EACD2258-FCAC-4FF4-B36D-419E924A6D79}}" -Type String -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $fxPath -Name "{{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}},6" -Value "{{EC1CC9CE-FAED-4822-828A-82A81A6F018F}}" -Type String -Force -ErrorAction SilentlyContinue
                
                # SFX & EFX (Obligatorio en Windows 11 para Realtek y tarjetas modernas)
                Set-ItemProperty -Path $fxPath -Name "{{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}},13" -Value "{{EACD2258-FCAC-4FF4-B36D-419E924A6D79}}" -Type String -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $fxPath -Name "{{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}},15" -Value "{{EC1CC9CE-FAED-4822-828A-82A81A6F018F}}" -Type String -Force -ErrorAction SilentlyContinue

                # Desbloquear procesamiento de efectos
                Set-ItemProperty -Path $fxPath -Name "{{1da5d803-d01f-4704-978c-5ed0b9d846e6}},5" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            }}
        }}
    }}

    # 5. Enrutar CABLE Output hacia el dispositivo de reproducción físico ("Escuchar este dispositivo")
    if ($null -ne $defaultRenderGuid) {{
        $capturePath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture"
        if (Test-Path $capturePath) {{
            Get-ChildItem $capturePath | ForEach-Object {{
                $captKey = $_.PSPath
                $propPath = Join-Path $captKey "Properties"
                if (Test-Path $propPath) {{
                    $epName = (Get-ItemProperty -Path $propPath -Name "{{a45c254e-df1c-4efd-8020-67d146a850e0}},2" -ErrorAction SilentlyContinue)."{{a45c254e-df1c-4efd-8020-67d146a850e0}},2"
                    if ($epName -match "CABLE Output") {{
                        # PKEY_AudioEndpoint_ListenForCapture target endpoint
                        $endpointTarget = "{{0.0.0.00000000}}." + $defaultRenderGuid
                        Set-ItemProperty -Path $propPath -Name "{{24dbb0fc-9311-4b3d-9cf0-18ff155639d4}},0" -Value $endpointTarget -Type String -Force -ErrorAction SilentlyContinue
                        
                        # PKEY_AudioEndpoint_ListenForCapture enabled flag (VT_BOOL TRUE = -1)
                        [byte[]]$boolBytes = 11,0,0,0,1,0,0,0,255,255,0,0
                        Set-ItemProperty -Path $propPath -Name "{{24dbb0fc-9311-4b3d-9cf0-18ff155639d4}},1" -Value $boolBytes -Type Binary -Force -ErrorAction SilentlyContinue
                    }}
                }}
            }}
        }}
    }}

    # 6. Activar Plan de Alto Rendimiento (High Performance)
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    if ($LASTEXITCODE -ne 0) {{
        $dupOut = powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
        if ($dupOut -match "([0-9a-fA-F]{{8}}-([0-9a-fA-F]{{4}}-){{3}}[0-9a-fA-F]{{12}})") {{
            powercfg /setactive $matches[1] 2>$null
        }}
    }}

    # 7. MMCSS Tweaks (SystemResponsiveness = 0 y NetworkThrottlingIndex = 0xFFFFFFFF)
    $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
    if (Test-Path $sysProfile) {{
        Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force -ErrorAction SilentlyContinue
    }}

    $gamesTask = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
    if (Test-Path $gamesTask) {{
        Set-ItemProperty -Path $gamesTask -Name "GPU Priority" -Value 8 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gamesTask -Name "Priority" -Value 6 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $gamesTask -Name "Scheduling Category" -Value "High" -Type String -Force -ErrorAction SilentlyContinue
    }}

    # 8. Reiniciar audiosrv para aplicar cambios limpiamente
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

            // Poll for status file up to 45 seconds (90 * 500ms)
            for _ in 0..90 {
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

            Ok(false)
        }
        #[cfg(not(windows))]
        {
            Ok(true)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
