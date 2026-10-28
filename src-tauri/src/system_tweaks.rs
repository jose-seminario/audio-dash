#[cfg(windows)]
use windows::Win32::Foundation::CloseHandle;
#[cfg(windows)]
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
#[cfg(windows)]
use windows::Win32::System::SystemInformation::{GetSystemInfo, SYSTEM_INFO};
#[cfg(windows)]
use windows::Win32::System::Threading::{
    OpenProcess, SetPriorityClass, SetProcessAffinityMask, HIGH_PRIORITY_CLASS,
    PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION,
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

/// Dynamically calculates a safe affinity mask based on actual hardware topology
#[cfg(windows)]
fn calculate_safe_affinity_mask() -> (usize, u32) {
    unsafe {
        let mut sys_info = SYSTEM_INFO::default();
        GetSystemInfo(&mut sys_info);
        let num_cpus = sys_info.dwNumberOfProcessors.max(1);

        let mask = if num_cpus >= 4 {
            // Reservar CPU 0 y 1 para interrupciones del SO y red; anclar audiodg a CPU 2 y 3
            0x0C
        } else if num_cpus >= 2 {
            // Sistema de 2 o 3 núcleos: usar todos los disponibles
            (1 << num_cpus) - 1
        } else {
            1
        };

        (mask, num_cpus)
    }
}

/// Pins audiodg.exe and sets high priority to prevent micro-stutters and DPC audio latency
#[tauri::command]
pub async fn apply_audiodg_affinity() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            let pid = find_process_id_by_name("audiodg.exe").ok_or_else(|| {
                "El proceso 'audiodg.exe' no está activo. Reproduce cualquier sonido o abre un juego para que Windows lo inicie."
                    .to_string()
            })?;

            let (affinity_mask, num_cpus) = calculate_safe_affinity_mask();

            // 1. Intento directo con Win32 API
            let win32_success = unsafe {
                if let Ok(handle) = OpenProcess(
                    PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION,
                    false,
                    pid,
                ) {
                    let _ = SetPriorityClass(handle, HIGH_PRIORITY_CLASS);
                    let res = SetProcessAffinityMask(handle, affinity_mask);
                    let _ = CloseHandle(handle);
                    res.is_ok()
                } else {
                    false
                }
            };

            if win32_success {
                return Ok(format!(
                    "audiodg.exe (PID {}) optimizado: Alta Prioridad y afinidad adaptativa (0x{:X} en {} núcleos).",
                    pid, affinity_mask, num_cpus
                ));
            }

            // 2. Fallback con PowerShell si audiodg.exe requiere elevación
            use std::process::Command;
            let script = format!(
                "$p = Get-Process -Id {} -ErrorAction SilentlyContinue; if ($p) {{ $p.ProcessorAffinity = [IntPtr]{}; $p.PriorityClass = 'High'; 'OK' }}",
                pid, affinity_mask
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

            if let Ok(out) = ps_res {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if stdout.contains("OK") {
                    return Ok(format!(
                        "audiodg.exe (PID {}) optimizado vía PowerShell: Alta Prioridad y afinidad (0x{:X}).",
                        pid, affinity_mask
                    ));
                }
            }

            Err("No se pudo ajustar la afinidad de audiodg.exe. Reabre Audio Dash como Administrador.".to_string())
        }
        #[cfg(not(windows))]
        {
            Ok("Optimización simulada en entorno no-Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
