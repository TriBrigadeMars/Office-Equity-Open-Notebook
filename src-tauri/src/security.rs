use tauri::{Window, Manager};
use tauri::api::shell::open;

pub fn apply_navigation_policy(window: &Window) {
    let window_clone = window.clone();
    window.on_navigation(move |url| {
        // Allow strictly local app origin (http://127.0.0.1:8502) without userinfo
        let is_local_origin = url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port() == Some(8502)
            && url.username().is_empty()
            && url.password().is_none();

        if is_local_origin {
            return true; // allow internal navigation
        }

        let url_str = url.as_str();

        // Deny file URIs and other local schemes
        if url.scheme() == "file" || url_str.starts_with("file://") {
            return false; // deny
        }

        // Delegate external http/https to system browser
        if url.scheme() == "http" || url.scheme() == "https" {
            let _ = open(&window_clone.shell_scope(), url_str, None);
        }

        false // deny navigation in webview
    });
}
