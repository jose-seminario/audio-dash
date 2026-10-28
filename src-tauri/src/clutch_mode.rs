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
fn adjust_discord_volume_internal(target_volume: f32) -> Option<f32> {
    use crate::com_guard::ComGuard;
    use winmix::WinMix;

    let _com = ComGuard::new_mta();
    let winmix = unsafe { WinMix::default() };
    let sessions = unsafe { winmix.enumerate().ok()? };
    let mut captured_volume = None;

    for session in sessions {
        let p = session.path.to_lowercase();
        // Coincidencia estricta con el ejecutable de Discord
        if p.ends_with("discord.exe") || p.ends_with("\\discord.exe") {
            if captured_volume.is_none() {
                captured_volume = unsafe { session.vol.get_master_volume().ok() };
            }
            let _ = unsafe { session.vol.set_master_volume(target_volume) };
        }
    }

    captured_volume
}

pub fn toggle_clutch(app_handle: &AppHandle) -> Result<bool, String> {
    // Transición de estado atómica segura contra condiciones de carrera
    let previous_state = CLUTCH_ACTIVE.fetch_xor(true, Ordering::SeqCst);
    let new_state = !previous_state;

    // Delegar ajuste de volumen a un hilo desacoplado para no bloquear el callback global
    std::thread::spawn(move || {
        #[cfg(windows)]
        {
            if new_state {
                // Activar Clutch: atenuar Discord a 10%
                let original_vol = adjust_discord_volume_internal(0.10);
                if let Ok(mut saved) = SAVED_DISCORD_VOLUME.lock() {
                    if original_vol.is_some() {
                        *saved = original_vol;
                    }
                }
            } else {
                // Desactivar Clutch: restaurar volumen si fue capturado previamente
                let restore_val = if let Ok(mut saved) = SAVED_DISCORD_VOLUME.lock() {
                    saved.take()
                } else {
                    None
                };

                if let Some(vol) = restore_val {
                    adjust_discord_volume_internal(vol);
                }
            }
        }
    });

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

/// Registers the global shortcut Ctrl+Shift+C without panics
pub fn init_clutch_hotkey(app: &AppHandle) {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyC);
    let app_clone = app.clone();

    let _ = app
        .global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = toggle_clutch(&app_clone);
            }
        });
}
