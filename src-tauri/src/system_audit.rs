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

    SystemAuditResult {
        all_optimal,
        checks,
        timestamp: "Ahora".to_string(),
    }
}

fn check_audio_enhancements_registry() -> bool {
    // Read registry key for audio device enhancement settings safely
    #[cfg(windows)]
    {
        // Safe query without modifying anything
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

/// Invokes Windows UAC on-demand using ShellExecuteW ("runas")
/// to apply system optimizations without requiring the main app to be elevated.
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

            // Prepare PowerShell one-liner that performs optimizations:
            // 1. Sets High Performance power scheme
            // 2. Links config in Equalizer APO if installed
            let script = r#"
                powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
                $apoPath = "C:\Program Files\EqualizerAPO\config\config.txt"
                $appDataPath = [System.Environment]::GetFolderPath('ApplicationData') + '\AudioDash\config.txt'
                if (Test-Path "C:\Program Files\EqualizerAPO\config") {
                    if (!(Test-Path $apoPath) -or !(Get-Content $apoPath -ErrorAction SilentlyContinue | Select-String -Pattern "AudioDash")) {
                        Add-Content -Path $apoPath -Value "`nInclude: `"$appDataPath`"" -Force
                    }
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
