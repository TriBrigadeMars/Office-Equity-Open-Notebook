# Native Host Contract (v1)

This contract defines the strict platform responsibilities that any language-neutral native host (Rust, Go, C#) must implement in order to host the Office Equity Open Notebook application safely and reliably.

## 1. Runtime Discovery and Verification

### Inputs/Outputs
- **Input:** Installation directory, app execution context.
- **Output:** Canonical `runtimePath` containing `surreal/surreal.exe`, `backend/open_notebook`, and `frontend/server.js`.
- **Verification:** The host MUST verify the presence of all required runtime files. The runtime must parse the `manifest.json` and verify the `upstreamCommit` against expected values. Any missing component MUST abort startup.

## 2. Service Management

### Launch Ordering & Readiness
1. **SurrealDB:** Starts first. Readiness defined as connection success and basic query response.
2. **Python API:** Starts after SurrealDB is ready. Readiness defined by a successful response on its health endpoint.
3. **Python Worker:** Starts after API. Readiness is process liveness plus queue connection.
4. **Frontend:** Starts last.
- **Loopback Restriction:** ALL internal services MUST bind only to `127.0.0.1` unless overridden by explicit features.

### Environment Construction
- Secrets (e.g., `encryptionKey`) MUST NOT be passed via command line arguments if possible, or minimally must be redacted from logs.
- The host must inject the canonical paths (`dataDir`, `logDir`) and ports.

### Logging Semantics
- Stdout and stderr from all services MUST be captured by the host.
- Output MUST be formatted with a prefix tag (e.g., `[api:out]`, `[surrealdb:err]`).
- Empty whitespace data MUST be discarded (yielding `null` or ignored).

### Shutdown and Problem-Report
- **Shutdown Order:** Services MUST be terminated in reverse order (Frontend -> Worker -> API -> SurrealDB).
- **Process Containment:** The host SHOULD utilize OS-level features (e.g., Windows Job Objects) to guarantee child processes do not outlive a host crash.
- **Problem Reporting:** Crash logs must provide context without leaking secrets in the diagnostic output.

## 3. Navigation and External Link Policy

- **Allowed Navigation:** The host WebView MUST restrict in-app navigation strictly to the local app origin/content (e.g., `http://127.0.0.1:8502`).
- **External Links:** Any URL not exactly matching the local app origin (including other `http`/`https` sites) MUST be delegated to the system browser.
- **Prohibited:** File URIs (`file:///`), alternate schemes, and case variants failing origin checks MUST be denied entirely by the WebView intercept.

## 4. Data/Config Paths and Encryption-Key Handling

- The host defines `dataDir` and `logDir` within standard OS user data locations (e.g., `%LOCALAPPDATA%`).
- **Encryption Key:** The host MUST obtain or generate an encryption key using native secure storage (e.g., Windows Credential Manager). It MUST NOT be exposed in logs, crash dumps, or frontend bundles.

## 5. Port-Conflict Recovery Policy

When a required port (8000, 5055, 8502) is blocked:
1. Identify the blocking PID.
2. Classify ownership (`app-owned`, `unrelated`, or `unverified`).
3. Terminate ONLY `app-owned` conflicts, and ONLY after explicit user confirmation (interactive prompt).
4. Never terminate `unrelated` or `unverified` processes. Generic names like `python.exe` are insufficient for `app-owned` classification (the exact path must be canonicalized and checked).

## 6. Benchmark and Compatibility Harness

- The candidate MUST parse standard JSON fixtures in `tests/contracts/*.json`.
- The candidate MUST emit `CompatibilityResult` JSON schemas demonstrating parity with the reference TypeScript implementation without any regressions in pure cases or supervision scenarios.