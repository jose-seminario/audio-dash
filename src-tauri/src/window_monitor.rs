// Process detection replaced by hardware-level Virtual Cable device routing.
// This module is kept for backward compatibility and clean compilation.

use tauri::AppHandle;

pub fn spawn_window_monitor(_app_handle: AppHandle) {
    // Obsolete: Filter is now applied directly to the Virtual Cable device
}
