#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod runner;
mod security;
mod job_object;

use tauri::Manager;
use runner::{resolve_runtime_path, check_missing_files, start_services};

fn main() {
    let runtime_path = resolve_runtime_path();
    if let Err(missing) = check_missing_files(&runtime_path) {
        eprintln!("Office of Equity Open Notebook — runtime not found");
        eprintln!("Missing: {:?}", missing);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle();

            // Start background services
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_services(runtime_path.clone()).await {
                    eprintln!("CRITICAL: Failed to start services: {}", e);
                    std::process::exit(1);
                }
            });

            // Apply navigation security policy to the main window
            let main_window = handle.get_window("main").unwrap();
            security::apply_navigation_policy(&main_window);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
