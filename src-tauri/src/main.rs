#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod runner;
mod security;
mod job_object;
mod proxy;
mod static_server;
mod server;

use tauri::Manager;
use runner::{resolve_runtime_path, check_missing_files, start_services};

fn main() {
    let runtime_path = resolve_runtime_path();
    if let Err(missing) = check_missing_files(&runtime_path) {
        let msg = format!("The bundled runtime is incomplete. Please re-run `npm run prepare:runtime` and rebuild the app.\n\nMissing:\n{:#?}", missing);
        eprintln!("Office of Equity Open Notebook — runtime not found");
        eprintln!("{}", msg);
        tauri::api::dialog::blocking::MessageDialogBuilder::new("Office of Equity Open Notebook — runtime not found", &msg)
            .kind(tauri::api::dialog::MessageDialogKind::Error)
            .show();
        std::process::exit(1);
    }

    tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle();

            // Start background services and embedded static/proxy server
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_services(runtime_path.clone()).await {
                    let msg = format!("CRITICAL: Failed to start services:\n\n{}", e);
                    eprintln!("{}", msg);
                    tauri::api::dialog::blocking::MessageDialogBuilder::new("Office of Equity Open Notebook — failed to start", &msg)
                        .kind(tauri::api::dialog::MessageDialogKind::Error)
                        .show();
                    std::process::exit(1);
                }
            });

            // Apply navigation security policy to the main window
            if let Some(main_window) = handle.get_window("main") {
                security::apply_navigation_policy(&main_window);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
