use tauri::{Window, Manager};
use tauri::api::shell::open;

pub fn apply_navigation_policy(window: &Window) {
    let window_clone = window.clone();
    window.on_navigation(move |url| {
        let url_str = url.as_str();
        // Allow strictly local app origin
        if url_str.starts_with("http://127.0.0.1:8502") {
            return true; // allow
        }

        // Deny file URIs and other local schemes
        if url_str.starts_with("file://") {
            return false; // deny
        }

        // Delegate http/https to system browser
        if url_str.starts_with("http://") || url_str.starts_with("https://") {
            let _ = open(&window_clone.shell_scope(), url_str, None);
        }

        false // deny navigation in webview
    });
}
