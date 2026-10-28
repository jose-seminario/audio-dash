use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProcessScanResult {
    pub process_name: String,
    pub window_title: String,
    pub is_game: bool,
    pub matched_by: String,
}

/// Evaluates if a given process or window title matches a supported competitive game
pub fn is_competitive_game(
    exe_name: &str,
    window_title: &str,
    custom_exes: &[String],
) -> (bool, &'static str) {
    let exe = exe_name.trim().to_lowercase();
    let title = window_title.trim().to_lowercase();

    if exe.is_empty() {
        return (false, "none");
    }

    // 1. Excluir herramientas de desarrollo y ejecutables que comparten prefijo "cod" (ej. VS Code, Codex)
    if exe == "code.exe"
        || exe.starts_with("code_")
        || exe == "codex.exe"
        || exe == "codec.exe"
        || exe == "code.cmd"
    {
        return (false, "ignored_dev_tool");
    }

    // 2. Excluir ejecutables específicos de launchers y herramientas (sin perjudicar juegos con 'steam' en el nombre)
    let is_launcher = exe == "steam.exe"
        || exe == "steamservice.exe"
        || exe == "steamwebhelper.exe"
        || exe == "battle.net.exe"
        || exe == "agent.exe"
        || exe == "epicgameslauncher.exe"
        || exe == "discord.exe"
        || exe == "audiodash.exe"
        || exe == "explorer.exe"
        || exe == "taskmgr.exe"
        || exe.contains("crashhandler")
        || exe.contains("crash_handler")
        || exe.contains("reportcod");

    if is_launcher {
        return (false, "ignored_launcher");
    }

    // 3. Comprobar ejecutables personalizados agregados por el usuario
    for custom in custom_exes {
        let clean_custom = custom.trim().to_lowercase();
        if !clean_custom.is_empty() && (exe == clean_custom || exe == format!("{}.exe", clean_custom)) {
            return (true, "custom_exe");
        }
    }

    // 4. Familia Call of Duty / Warzone (Indestructible contra actualizaciones y temporadas)
    // Coincide con cod.exe, cod23-cod.exe, cod24-cod.exe, warzone.exe, ModernWarfare.exe, etc.
    let is_cod_exe = exe == "cod.exe"
        || (exe.starts_with("cod2") && exe.ends_with(".exe"))
        || exe.starts_with("warzone")
        || exe.starts_with("callofduty")
        || exe.contains("modernwarfare")
        || exe.contains("blackops")
        || exe.contains("vanguard");

    let is_cod_title = title.contains("call of duty")
        || title.contains("warzone")
        || title.contains("modern warfare")
        || title.contains("black ops");

    if is_cod_exe || is_cod_title {
        return (true, "cod_family");
    }

    // 5. Otros shooters competitivos populares
    if exe == "cs2.exe" || exe == "csgo.exe" || title.contains("counter-strike") {
        return (true, "cs2");
    }
    if exe.starts_with("valorant") || title.contains("valorant") {
        return (true, "valorant");
    }
    if exe == "r5apex.exe" || title.contains("apex legends") {
        return (true, "apex_legends");
    }
    if exe.contains("tarkov") || title.contains("escape from tarkov") {
        return (true, "tarkov");
    }
    if exe == "tslgame.exe" || (title.contains("pubg") && !title.contains("browser")) {
        return (true, "pubg");
    }
    if exe.contains("rainbowsix") || title.contains("rainbow six") {
        return (true, "rainbow_six");
    }
    if exe.contains("deltaforce") || title.contains("delta force") {
        return (true, "delta_force");
    }

    (false, "none")
}

#[cfg(windows)]
fn get_foreground_window_info() -> (String, String, u32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0 == 0 as _ {
            return ("Escritorio".to_string(), "".to_string(), 0);
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if len > 0 {
            String::from_utf16_lossy(&title_buf[..len as usize])
        } else {
            String::new()
        };

        let process_name = get_process_name_by_pid(pid).unwrap_or_else(|| "Desconocido".to_string());

        (process_name, title, pid)
    }
}

#[cfg(windows)]
fn get_process_name_by_pid(target_pid: u32) -> Option<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut found_name = None;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == target_pid {
                    let name_len = entry
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);
                    found_name = Some(name);
                    break;
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
        found_name
    }
}

#[cfg(windows)]
fn scan_all_running_processes_for_games(custom_exes: &[String]) -> Option<(String, &'static str)> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut matched_game = None;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let name_len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);

                let (is_game, matched_by) = is_competitive_game(&name, "", custom_exes);
                if is_game {
                    matched_game = Some((name, matched_by));
                    break;
                }

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
        matched_game
    }
}

/// Gathers the list of all active user processes
#[cfg(windows)]
pub fn list_active_processes() -> Vec<String> {
    use std::collections::BTreeSet;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let mut set = BTreeSet::new();

    unsafe {
        if let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };

            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    let name_len = entry
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);
                    let lower = name.to_lowercase();

                    if lower.ends_with(".exe")
                        && !lower.starts_with("svchost")
                        && !lower.starts_with("conhost")
                        && !lower.starts_with("runtimebroker")
                        && lower != "system"
                        && lower != "system.exe"
                        && !lower.starts_with("dllhost")
                        && !lower.starts_with("taskhostw")
                    {
                        set.insert(name);
                    }

                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }
    }

    set.into_iter().collect()
}

#[cfg(not(windows))]
pub fn list_active_processes() -> Vec<String> {
    vec!["cod.exe".to_string(), "warzone.exe".to_string()]
}

/// Performs a full scan of the active game state
pub fn scan_game_state_internal() -> ProcessScanResult {
    let custom_exes = crate::dependencies::load_settings().custom_game_exes;

    #[cfg(windows)]
    {
        let (fg_process, fg_title, _pid) = get_foreground_window_info();

        // 1. Check if foreground window is a game
        let (is_fg_game, fg_match) = is_competitive_game(&fg_process, &fg_title, &custom_exes);
        if is_fg_game {
            return ProcessScanResult {
                process_name: fg_process,
                window_title: fg_title,
                is_game: true,
                matched_by: fg_match.to_string(),
            };
        }

        // 2. If foreground is not a game (e.g. user Alt-Tabbed to Audio Dash or browser),
        // check if a game is running in the background!
        if let Some((bg_game_exe, bg_match)) = scan_all_running_processes_for_games(&custom_exes) {
            return ProcessScanResult {
                process_name: bg_game_exe,
                window_title: "Ejecutándose en segundo plano".to_string(),
                is_game: true,
                matched_by: bg_match.to_string(),
            };
        }

        ProcessScanResult {
            process_name: fg_process,
            window_title: fg_title,
            is_game: false,
            matched_by: "none".to_string(),
        }
    }

    #[cfg(not(windows))]
    {
        ProcessScanResult {
            process_name: "cod.exe".to_string(),
            window_title: "Call of Duty".to_string(),
            is_game: true,
            matched_by: "simulation".to_string(),
        }
    }
}

/// Tauri Command: Instant manual re-scan of the running game
#[tauri::command]
pub fn scan_running_game_now() -> Result<ProcessScanResult, String> {
    Ok(scan_game_state_internal())
}

/// Tauri Command: Returns list of running .exe processes for custom selection
#[tauri::command]
pub fn get_running_processes_list() -> Result<Vec<String>, String> {
    Ok(list_active_processes())
}

/// Spawns the lightweight background process & window monitor
pub fn spawn_window_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_game_state: Option<bool> = None;
        let mut last_process_name: String = String::new();

        loop {
            tokio::time::sleep(Duration::from_millis(3000)).await;

            let result = scan_game_state_internal();

            let state_changed = last_game_state != Some(result.is_game);
            let process_changed = last_process_name != result.process_name;

            if state_changed || process_changed {
                last_game_state = Some(result.is_game);
                last_process_name = result.process_name.clone();

                let _ = app_handle.emit("window_changed", &result);
            }
        }
    });
}
