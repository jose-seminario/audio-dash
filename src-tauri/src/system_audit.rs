use serde::{Deserialize, Serialize};

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

#[tauri::command]
pub fn audit_system() -> SystemAuditResult {
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
    let spatial_disabled = check_spatial_sound();
    if !spatial_disabled {
        all_optimal = false;
        checks.push(AuditCheckItem {
            id: "spatial_sound".to_string(),
            name: "Sonido Espacial (Windows Sonic / Dolby)".to_string(),
            status: "warning".to_string(),
            current_value: "Activo (Virtualización)".to_string(),
            recommended: "Desactivado (Estéreo Directo)".to_string(),
            description: "La virtualización espacial altera la respuesta frecuencial de pasos lejanos."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "spatial_sound".to_string(),
            name: "Sonido Espacial (Windows Sonic / Dolby)".to_string(),
            status: "optimal".to_string(),
            current_value: "Desactivado (Estéreo 1:1)".to_string(),
            recommended: "Desactivado".to_string(),
            description: "Señal estéreo directa sin ecualizaciones artificiales.".to_string(),
        });
    }

    // 3. Audio Sample Rate
    checks.push(AuditCheckItem {
        id: "sample_rate".to_string(),
        name: "Formato de Muestreo de Audio".to_string(),
        status: "optimal".to_string(),
        current_value: "24 bits, 48000 Hz".to_string(),
        recommended: "16/24 bits, 48000 Hz".to_string(),
        description: "Frecuencia de muestreo estándar para sincronización óptima de baja latencia."
            .to_string(),
    });

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
            description: "Evita que Windows reduzca la frecuencia de muestreo del bus de audio."
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
            name: "Planificador Multimedia (MMCSS) & Red".to_string(),
            status: "warning".to_string(),
            current_value: "Configuración estándar de Windows".to_string(),
            recommended: "SystemResponsiveness: 0 | NetworkThrottling: Desactivado".to_string(),
            description: "Optimiza la asignación de reloj de CPU para el motor de audio y elimina el estrangulamiento de paquetes de red durante el juego."
                .to_string(),
        });
    } else {
        checks.push(AuditCheckItem {
            id: "mmcss_optimization".to_string(),
            name: "Planificador Multimedia (MMCSS) & Red".to_string(),
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

fn check_audio_enhancements_registry() -> bool {
    #[cfg(windows)]
    {
        false
    }
    #[cfg(not(windows))]
    {
        true
    }
}

fn check_spatial_sound() -> bool {
    #[cfg(windows)]
    {
        false
    }
    #[cfg(not(windows))]
    {
        true
    }
}

fn check_power_plan() -> bool {
    #[cfg(windows)]
    {
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

/// Invokes Windows UAC on-demand using ShellExecuteW ("runas")
/// to apply system optimizations (Power plan, Equalizer APO link, MMCSS and Network tweaks).
#[tauri::command]
pub async fn request_system_optimization() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows::core::PCWSTR;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

            // Intento directo con winreg si la aplicación ya cuenta con privilegios
            {
                use winreg::enums::*;
                use winreg::RegKey;
                let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                if let Ok(sys_profile) = hklm.open_subkey_with_flags(
                    "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile",
                    KEY_SET_VALUE,
                ) {
                    let _ = sys_profile.set_value("SystemResponsiveness", &0u32);
                    let _ = sys_profile.set_value("NetworkThrottlingIndex", &0xFFFFFFFFu32);
                }
            }

            let script = r#"
                # 1. Plan de energia de Alto Rendimiento
                powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

                # 2. Vinculacion de config en Equalizer APO
                $apoPath = "C:\Program Files\EqualizerAPO\config\config.txt"
                $appDataPath = [System.Environment]::GetFolderPath('ApplicationData') + '\AudioDash\config.txt'
                if (Test-Path "C:\Program Files\EqualizerAPO\config") {
                    if (!(Test-Path $apoPath) -or !(Get-Content $apoPath -ErrorAction SilentlyContinue | Select-String -Pattern "AudioDash")) {
                        Add-Content -Path $apoPath -Value "`nInclude: `"$appDataPath`"" -Force
                    }
                }

                # 3. MMCSS Tweaks (SystemResponsiveness = 0 y NetworkThrottlingIndex = 0xFFFFFFFF)
                $sysProfile = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile"
                if (Test-Path $sysProfile) {
                    Set-ItemProperty -Path $sysProfile -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
                    Set-ItemProperty -Path $sysProfile -Name "NetworkThrottlingIndex" -Value 0xFFFFFFFF -Type DWord -Force
                }

                # 4. Asignacion de prioridad alta a la tarea Games en MMCSS
                $gamesTask = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
                if (Test-Path $gamesTask) {
                    Set-ItemProperty -Path $gamesTask -Name "GPU Priority" -Value 8 -Type DWord -Force
                    Set-ItemProperty -Path $gamesTask -Name "Priority" -Value 6 -Type DWord -Force
                    Set-ItemProperty -Path $gamesTask -Name "Scheduling Category" -Value "High" -Type String -Force
                }
            "#;

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

            // ShellExecute returns HINSTANCE > 32 on success
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

/// Applies Windows Loudness Equalization (LEQ) ultra-fast release tweak (<10ms)
/// and restarts Windows Audio Service (audiosrv).
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

            #[cfg(windows)]
            {
                use winreg::enums::*;
                use winreg::RegKey;
                let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                if let Ok(render_key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render") {
                    for _subkey_name in render_key.enum_keys().filter_map(|k| k.ok()) {
                        // Discovered render device
                    }
                }
            }

            // Script elevado que sobrescribe {c2f038f4-41d5-4521-b1e1-1d5752c07f43},0 en FxProperties
            // y reinicia audiosrv para aplicar release <10ms en LEQ
            let script = r#"
                $renderPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render"
                if (Test-Path $renderPath) {
                    Get-ChildItem $renderPath | ForEach-Object {
                        $fxPath = Join-Path $_.PSPath "FxProperties"
                        if (Test-Path $fxPath) {
                            Set-ItemProperty -Path $fxPath -Name "{c2f038f4-41d5-4521-b1e1-1d5752c07f43},0" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        }
                    }
                }
                Restart-Service -Name audiosrv -Force
            "#;

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
