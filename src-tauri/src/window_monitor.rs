use serde::Serialize;
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Debug)]
pub struct WindowChangeEvent {
    pub process_name: String,
    pub is_game: bool,
}

const KNOWN_GAME_BINARIES: &[&str] = &[
    "cod.exe",
    "modernwarfare.exe",
    "bootstrapper.exe",
    "cs2.exe",
    "csgo.exe",
    "valorant-win64-shipping.exe",
    "r5apex.exe",
    "fortniteclient-win64-shipping.exe",
    "overwatch.exe",
    "rainbowsix.exe",
    "pubg.exe",
    "tslgame.exe",
    "warzone.exe",
    "escapefromtarkov.exe",
    "rustclient.exe",
];

pub fn is_competitive_game(exe_name: &str) -> bool {
    let lower = exe_name.to_lowercase();
    KNOWN_GAME_BINARIES.iter().any(|&game| lower == game)
}

#[cfg(windows)]
pub fn get_foreground_process_name() -> Option<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == (0 as _) {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            let mut buffer = [0u16; 1024];
            let mut size = buffer.len() as u32;

            let success = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_FORMAT(0),
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            );

            let _ = CloseHandle(handle);

            if success.is_ok() {
                let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
                let file_name = Path::new(&full_path)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or(full_path);
                return Some(file_name);
            }
        }
    }
    None
}

#[cfg(not(windows))]
pub fn get_foreground_process_name() -> Option<String> {
    Some("desktop".to_string())
}

/// Spawns the zero-overhead 500ms background loop
pub fn spawn_window_monitor(app_handle: AppHandle) {
    tokio::spawn(async move {
        let mut last_detected = String::new();

        loop {
            let current = get_foreground_process_name().unwrap_or_else(|| "Escritorio".to_string());

            if current != last_detected {
                last_detected = current.clone();
                let is_game = is_competitive_game(&current);

                let event = WindowChangeEvent {
                    process_name: current,
                    is_game,
                };

                let _ = app_handle.emit("window_changed", event);
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });
}
