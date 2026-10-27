#[cfg(windows)]
use windows::Win32::Foundation::CloseHandle;
#[cfg(windows)]
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
#[cfg(windows)]
use windows::Win32::System::Threading::{
    OpenProcess, SetProcessAffinityMask, PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION,
};

/// Finds the process ID of a given process name
#[cfg(windows)]
pub fn find_process_id_by_name(process_name: &str) -> Option<u32> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut found_pid = None;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let name = String::from_utf16_lossy(&entry.szExeFile);
                let name_clean = name.trim_matches('\0').to_lowercase();
                if name_clean == process_name.to_lowercase() {
                    found_pid = Some(entry.th32ProcessID);
                    break;
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
        found_pid
    }
}

/// Pins audiodg.exe to Performance Cores (P-Cores) to prevent micro-stutters and DPC audio latency
#[tauri::command]
pub async fn apply_audiodg_affinity() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            let pid = find_process_id_by_name("audiodg.exe").ok_or_else(|| {
                "El proceso 'audiodg.exe' no está activo. Reproduce cualquier sonido o abre un juego para que Windows lo inicie."
                    .to_string()
            })?;

            // P-Core Affinity Mask: 0b00001100 = 0x0C (CPU 2 y 3)
            // Esto ancla audiodg a núcleos de rendimiento físicos y libera CPU 0/1 para interrupciones del SO
            let affinity_mask: usize = 0x0C;

            // 1. Intento directo con Win32 API
            let win32_success = unsafe {
                if let Ok(handle) = OpenProcess(
                    PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION,
                    false,
                    pid,
                ) {
                    let res = SetProcessAffinityMask(handle, affinity_mask);
                    let _ = CloseHandle(handle);
                    res.is_ok()
                } else {
                    false
                }
            };

            if win32_success {
                return Ok(format!(
                    "audiodg.exe (PID {}) anclado con éxito a núcleos P-Cores (Máscara 0x0C).",
                    pid
                ));
            }

            // 2. Fallback con PowerShell si audiodg.exe está protegido por el subsistema de aislamiento
            use std::process::Command;
            let script = format!(
                "$p = Get-Process -Id {} -ErrorAction SilentlyContinue; if ($p) {{ $p.ProcessorAffinity = [IntPtr]{}; 'OK' }}",
                pid, affinity_mask
            );

            let ps_res = Command::new("powershell.exe")
                .arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-WindowStyle")
                .arg("Hidden")
                .arg("-Command")
                .arg(&script)
                .output();

            if let Ok(out) = ps_res {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if stdout.contains("OK") {
                    return Ok(format!(
                        "audiodg.exe (PID {}) anclado exitosamente a P-Cores vía PowerShell.",
                        pid
                    ));
                }
            }

            Err("No se pudo modificar la afinidad de audiodg.exe. Ejecuta Audio Dash con permisos para gestionar servicios protegidos.".to_string())
        }
        #[cfg(not(windows))]
        {
            Ok("Optimización de audiodg simulada (Plataforma no Windows)".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
