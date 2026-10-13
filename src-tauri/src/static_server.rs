use hyper::{Body, Request, Response, StatusCode};
use hyper::header::{CONTENT_TYPE, CACHE_CONTROL};
use std::path::{Path, PathBuf};
use std::fs;

#[derive(Clone)]
pub struct StaticFileServer {
    root_dir: PathBuf,
}

impl StaticFileServer {
    pub fn new(root_dir: PathBuf) -> Self {
        Self { root_dir }
    }

    /// Validates path traversal security for static asset requests.
    pub fn validate_path_traversal(root: &Path, requested_path: &str) -> Option<PathBuf> {
        let normalized_root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());

        // Check 1: Explicit traversal sequences or null bytes
        if requested_path.contains("..") || requested_path.to_lowercase().contains("%2e%2e") || requested_path.contains('\0') {
            return None;
        }

        let clean_path = requested_path.split('?').next()?.split('#').next()?;
        let relative = if clean_path.starts_with('/') { &clean_path[1..] } else { clean_path };
        let target = normalized_root.join(relative);

        if let Ok(canonical) = fs::canonicalize(&target) {
            if canonical.starts_with(&normalized_root) {
                return Some(canonical);
            }
        } else {
            // For non-existent files, ensure path calculation stays inside root
            let resolved = normalized_root.join(relative);
            if resolved.starts_with(&normalized_root) {
                return Some(resolved);
            }
        }

        None
    }

    /// Serves static asset or applies SPA route fallback (`try_files $uri /index.html`).
    pub async fn handle_request(&self, req: Request<Body>) -> Result<Response<Body>, hyper::Error> {
        let raw_path = req.uri().path();

        // 1. Path Traversal Security Check
        let target_path = match Self::validate_path_traversal(&self.root_dir, raw_path) {
            Some(p) => p,
            None => {
                let err_res = Response::builder()
                    .status(StatusCode::FORBIDDEN)
                    .header(CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"error":"Forbidden: Path traversal sequence detected"}"#))
                    .unwrap();
                return Ok(err_res);
            }
        };

        // 2. Check if file exists on disk
        if target_path.is_file() {
            if let Ok(contents) = fs::read(&target_path) {
                let mime = mime_guess::from_path(&target_path)
                    .first_raw()
                    .unwrap_or("application/octet-stream");

                let cache_ctrl = if mime.contains("html") {
                    "no-cache"
                } else {
                    "public, max-age=31536000, immutable"
                };

                let res = Response::builder()
                    .status(StatusCode::OK)
                    .header(CONTENT_TYPE, mime)
                    .header(CACHE_CONTROL, cache_ctrl)
                    .body(Body::from(contents))
                    .unwrap();
                return Ok(res);
            }
        }

        // 3. SPA Fallback to index.html for client dynamic routes
        let index_path = self.root_dir.join("index.html");
        let html_content = if index_path.is_file() {
            fs::read_to_string(&index_path).unwrap_or_else(|_| "<html><body>SPA Shell</body></html>".to_string())
        } else {
            "<!DOCTYPE html><html><body><div id=\"root\">SPA Shell</div></body></html>".to_string()
        };

        let res = Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, "text/html; charset=utf-8")
            .header(CACHE_CONTROL, "no-cache, no-store, must-revalidate")
            .header("X-SPA-Fallback", "true")
            .body(Body::from(html_content))
            .unwrap();

        Ok(res)
    }
}
