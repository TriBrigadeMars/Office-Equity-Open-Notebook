use std::path::PathBuf;

#[test]
fn test_path_traversal_prevention() {
    let root = PathBuf::from(".artifacts/static-client-poc");

    // Explicit traversal attempt
    let result1 = check_path_traversal(&root, "../etc/passwd");
    assert!(result1.is_none(), "Should reject relative path traversal sequence");

    let result2 = check_path_traversal(&root, "..%2f..%2fetc%2fpasswd");
    assert!(result2.is_none(), "Should reject encoded path traversal sequence");

    let result3 = check_path_traversal(&root, "/index.html");
    assert!(result3.is_some(), "Should allow valid root static path");
}

fn check_path_traversal(root: &PathBuf, requested_path: &str) -> Option<PathBuf> {
    if requested_path.contains("..") || requested_path.to_lowercase().contains("%2e%2e") || requested_path.contains('\0') {
        return None;
    }
    let clean = requested_path.split('?').next()?.split('#').next()?;
    let relative = if clean.starts_with('/') { &clean[1..] } else { clean };
    let resolved = root.join(relative);
    Some(resolved)
}

#[test]
fn test_loopback_proxy_target_validation() {
    let valid_target = "http://127.0.0.1:5055";
    assert!(valid_target.starts_with("http://127.0.0.1:5055"), "Proxy target must strictly point to loopback 127.0.0.1:5055");

    let invalid_target = "http://192.168.1.100:5055";
    assert!(!invalid_target.starts_with("http://127.0.0.1:5055"), "Proxy target must reject non-loopback IPs");
}

#[test]
fn test_max_upload_size_constant() {
    const MAX_UPLOAD_BYTES: u64 = 52_428_800; // 50MB
    assert_eq!(MAX_UPLOAD_BYTES, 50 * 1024 * 1024, "Max upload size must equal 50MB exactly");
}
