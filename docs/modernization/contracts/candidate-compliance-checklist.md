# Native Host Candidate Compliance Checklist

Before a native host candidate (Rust/Tauri, Go/Wails, C#/WinUI) can be merged as the primary host, it MUST pass the following mechanical and architectural checks as defined by the v1 Native Host Contract.

## Discovery & Filesystem
- [ ] Successfully locates `runtimePath` relative to the executable.
- [ ] Validates `manifest.json` against `upstreamCommit`.
- [ ] Validates existence of all expected binary artifacts prior to service launch.
- [ ] Configures `dataDir` and `logDir` using OS-specific appropriate paths (e.g., `%LOCALAPPDATA%`).

## Process Supervision
- [ ] Spawns services in correct order: SurrealDB -> API -> Worker -> Frontend.
- [ ] Waits for explicit readiness signals (TCP, HTTP, or Process) for each step before proceeding.
- [ ] Captures stdout/stderr uniformly with `[service:stream]` tags.
- [ ] Groups processes under a Windows Job Object (or OS equivalent) to prevent orphans upon host crash.
- [ ] Reverses startup sequence exactly during shutdown (Frontend -> Worker -> API -> SurrealDB).
- [ ] Recognizes intentional termination (e.g., exit codes from stop signals) vs unexpected crashes.

## Security & Network
- [ ] Binds all internal services strictly to `127.0.0.1`.
- [ ] Isolates WebView navigation to the exact local origin.
- [ ] Defers all external HTTP/HTTPS links to the system's default browser.
- [ ] Denies `file://` scheme navigations completely.
- [ ] Stores encryption keys safely using OS native vaults; redacts them from diagnostic logs and avoids passing them via command line if possible.

## Port Conflict Resolution
- [ ] Detects conflicting PID without falsely flagging healthy runs.
- [ ] Accurately canonicalizes paths to differentiate `app-owned` vs `unrelated` processes.
- [ ] Requests explicit user confirmation prior to killing any verified app-owned orphan.
- [ ] Immediately aborts instead of killing unverified/unrelated processes.

## Mechanical Verification
- [ ] Successfully reads `tests/contracts/*.json` fixtures.
- [ ] Produces a `compatibility-result-<lang>.json` passing 100% of pure boundary cases and supervision scenarios without regression.
- [ ] Provides documented benchmark results for startup time and memory footprint overhead.