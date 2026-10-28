// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    audio_dash_lib::setup_panic_hook();
    audio_dash_lib::dependencies::ensure_app_directories();
    audio_dash_lib::run();
}
