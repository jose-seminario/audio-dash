use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static CLUTCH_ACTIVE: AtomicBool = AtomicBool::new(false);
static SAVED_DISCORD_VOLUME: Mutex<Option<f32>> = Mutex::new(None);

pub fn is_clutch_active() -> bool {
    CLUTCH_ACTIVE.load(Ordering::SeqCst)
}

#[cfg(windows)]
fn adjust_discord_volume(target_volume: f32) -> Option<f32> {
    let handle = std::thread::Builder::new()
        .name("discord-volume-adjuster".to_string())
        .spawn(move || {
            use crate::com_guard::ComGuard;
            use winmix::WinMix;

            let _com = ComGuard::new_mta();
            let winmix = unsafe { WinMix::default() };
            let sessions = unsafe { winmix.enumerate().ok()? };
            let mut prev_volume = None;

            for session in sessions {
                let p = session.path.to_lowercase();
                if p.contains("discord.exe") {
                    if prev_volume.is_none() {
                        prev_volume = unsafe { session.vol.get_master_volume().ok() };
                    }
                    let _ = unsafe { session.vol.set_master_volume(target_volume) };
                }
            }

            prev_volume
        });

    match handle {
        Ok(thread_handle) => thread_handle.join().unwrap_or(None),
        Err(_) => None,
    }
}

#[cfg(not(windows))]
fn adjust_discord_volume(_target_volume: f32) -> Option<f32> {
    None
}

pub fn toggle_clutch(app_handle: &AppHandle) -> Result<bool, String> {
    let current = CLUTCH_ACTIVE.load(Ordering::SeqCst);
    let new_state = !current;

    if new_state {
        // Activate Clutch: Lower Discord to 10% (0.10)
        let previous = adjust_discord_volume(0.10);
        let mut saved = SAVED_DISCORD_VOLUME
            .lock()
            .map_err(|e| format!("Mutex error: {}", e))?;
        *saved = previous.or(Some(1.0));
    } else {
        // Deactivate Clutch: Restore previous Discord volume
        let restore_val = {
            let saved = SAVED_DISCORD_VOLUME
                .lock()
                .map_err(|e| format!("Mutex error: {}", e))?;
            saved.unwrap_or(1.0)
        };
        adjust_discord_volume(restore_val);
    }

    CLUTCH_ACTIVE.store(new_state, Ordering::SeqCst);

    // Emit event to frontend
    let _ = app_handle.emit("clutch_mode_toggled", new_state);

    Ok(new_state)
}

#[tauri::command]
pub fn toggle_clutch_mode(app_handle: AppHandle) -> Result<bool, String> {
    toggle_clutch(&app_handle)
}

#[tauri::command]
pub fn get_clutch_state() -> bool {
    is_clutch_active()
}

/// Registers the global shortcut Ctrl+Shift+C
pub fn init_clutch_hotkey(app: &AppHandle) {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyC);
        let app_clone = app.clone();

        let _ = app
            .global_shortcut()
            .on_shortcut(shortcut, move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = toggle_clutch(&app_clone);
                }
            });
    }))
    .ok();
}
