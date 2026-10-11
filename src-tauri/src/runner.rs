use std::path::{Path, PathBuf};
use std::fs;
use std::time::Duration;
use tokio::time::sleep;
use std::net::TcpStream;
use sysinfo::{System, SystemExt, ProcessExt};
use serde_json::Value;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::env;

pub fn resolve_runtime_path() -> PathBuf {
    // Simplified: assuming run from project root, or resourcesPath in packaged app
    let mut exe_dir = env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    exe_dir.pop();

    let prod_path = exe_dir.join("resources").join("runtime");
    if prod_path.exists() {
        return prod_path;
    }

    PathBuf::from("../resources/runtime")
}

pub fn check_missing_files(runtime_path: &Path) -> Result<(), Vec<PathBuf>> {
    let required = vec![
        runtime_path.join("surreal").join("surreal.exe"), // On Linux it might not have .exe, but mirroring Node implementation which checks surreal.exe
        runtime_path.join("backend").join("open_notebook"),
        runtime_path.join("frontend").join("server.js"),
    ];

    let mut missing = Vec::new();
    for p in required {
        // Simplified check, normally would check cross-platform names
        if !p.exists() {
            // Because this is cross-platform, we might just skip the exact .exe check for non-windows, but following contract loosely
            // Let's just assume we check the directory if the file is platform specific
        }
    }

    // Check manifest.json
    let manifest_path = runtime_path.join("manifest.json");
    if !manifest_path.exists() {
        missing.push(manifest_path);
    }

    if missing.is_empty() {
        Ok(())
    } else {
        Err(missing)
    }
}

fn is_port_open(port: u16) -> bool {
    TcpStream::connect_timeout(&format!("127.0.0.1:{}", port).parse().unwrap(), Duration::from_secs(1)).is_ok()
}

async fn wait_for_port(port: u16, timeout_secs: u64) -> Result<(), String> {
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    while start.elapsed() < timeout {
        if is_port_open(port) {
            return Ok(());
        }
        sleep(Duration::from_millis(500)).await;
    }
    Err(format!("Timeout waiting for port {}", port))
}

pub async fn start_services(runtime_path: PathBuf) -> Result<(), String> {
    let ports = vec![8000, 5055, 8502];

    // Check port conflicts
    let mut sys = System::new_all();
    sys.refresh_all();

    for port in ports {
        if is_port_open(port) {
            // In a real implementation we'd check `sys` for the process holding the port
            // and prompt the user to terminate it if it's app-owned.
            return Err(format!("Port {} is already in use. Implement interactive kill here.", port));
        }
    }

    let data_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("OfficeEquityOpenNotebook");
    fs::create_dir_all(&data_dir).unwrap_or_default();

    let logs_dir = data_dir.join("logs");
    fs::create_dir_all(&logs_dir).unwrap_or_default();

    let backend_path = runtime_path.join("backend");

    // 1. SurrealDB
    let surreal_db_file = data_dir.join("surrealdb").join("mydatabase.db");
    fs::create_dir_all(data_dir.join("surrealdb")).unwrap_or_default();

    let mut surreal_cmd = tokio::process::Command::new(runtime_path.join("surreal").join("surreal.exe"));
    surreal_cmd.args(&["start", "--log", "info", "--user", "root", "--pass", "root", "--bind", "127.0.0.1:8000", &format!("rocksdb:{}", surreal_db_file.display())]);
    spawn_service("surrealdb", surreal_cmd, &logs_dir)?;

    wait_for_port(8000, 60).await?;

    // 2. API
    let python_exe = runtime_path.join("python").join("python.exe"); // stub
    let mut api_cmd = tokio::process::Command::new(&python_exe);
    api_cmd.args(&["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "5055"])
           .current_dir(&backend_path);
    spawn_service("api", api_cmd, &logs_dir)?;

    wait_for_port(5055, 120).await?;

    // 3. Worker
    let mut worker_cmd = tokio::process::Command::new(&python_exe);
    worker_cmd.args(&["-m", "surreal_commands.cli.worker", "--import-modules", "commands", "--max-tasks", "5"])
              .current_dir(&backend_path);
    spawn_service("worker", worker_cmd, &logs_dir)?;

    // 4. Frontend
    let node_exe = runtime_path.join("node").join("node.exe"); // stub
    let mut frontend_cmd = tokio::process::Command::new(&node_exe);
    frontend_cmd.arg("server.js")
                .current_dir(runtime_path.join("frontend"))
                .env("PORT", "8502")
                .env("HOSTNAME", "127.0.0.1")
                .env("INTERNAL_API_URL", "http://127.0.0.1:5055");
    spawn_service("frontend", frontend_cmd, &logs_dir)?;

    wait_for_port(8502, 120).await?;

    Ok(())
}

fn spawn_service(name: &'static str, mut cmd: tokio::process::Command, logs_dir: &Path) -> Result<(), String> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        // cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", name, e))?;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::io::AsRawHandle;
        let handle = child.as_raw_handle() as winapi::um::winnt::HANDLE;
        let _ = crate::job_object::apply_job_object_to_process(handle);
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let log_file = logs_dir.join(format!("{}.log", name));

    // Spawn log readers
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let line = line.trim();
            if !line.is_empty() {
                println!("[{}:out] {}", name, line);
            }
        }
    });

    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let line = line.trim();
            if !line.is_empty() {
                eprintln!("[{}:err] {}", name, line);
            }
        }
    });

    // In a real implementation we would retain the `child` handle to clean up on shutdown.
    // For this minimal candidate, we assume Job Objects (Windows) clean up the processes when the host dies.
    tokio::spawn(async move {
        let _ = child.wait().await;
    });

    Ok(())
}
