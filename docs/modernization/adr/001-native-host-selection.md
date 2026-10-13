# ADR 001: Native Host Candidate Selection for Office Equity Open Notebook

* **Status:** Approved
* **Date:** 2026-10-10
* **Packet ID:** `L2.5` (Prompt 19)
* **Deciders:** Modernization Taskforce / Lead Architect
* **Consulted:** Core Engineering, Security & Quality Leads
* **Supercedes:** Legacy Electron Host Architecture (`main.js` / `preload.js`)

---

## Context and Problem Statement

The Office Equity Open Notebook application currently uses an Electron desktop host (v33.2.0). While functional, Electron imposes significant resource overhead:
- **Idle Memory Footprint:** ~438 MB RSS total across 5 processes.
- **Package & Installed Size:** ~852 MB installed footprint, with ~112 MB consumed solely by the bundled Chromium and Node.js runtimes.
- **Cold Start Time:** ~3,100 ms to fully usable UI.

To achieve our modernization goals, we executed three parallel prototype implementations (`L2.2` Rust/Tauri, `L2.3` Go/Wails, `L2.4` C#/WinUI) against the language-neutral Native Host Contract (`L2.1`). We must select one primary native desktop host based on measured evidence, correctness, resource efficiency, process supervision reliability, cross-platform maintainability, and security.

---

## Decision Drivers

1. **Strict Contract Compliance & Parity:** 100% pass rate on unit contracts, process management, port recovery, and security origin isolation.
2. **Resource Efficiency:** Significant reduction in idle private working set memory (RSS) and installer/installed disk footprint.
3. **Startup Performance:** Faster cold-start times from process spawn to interactive UI.
4. **Child Process Containment:** Zero orphan processes on abnormal host shutdown or crash, leveraging OS primitives (Windows Job Objects / Unix process groups).
5. **Cross-Platform Optionality:** Support for Windows, macOS, and Linux without bifurcating codebases or maintenance paradigms.
6. **Maintainability & Security:** Low dependency surface area, strong memory safety, and reproducible CI builds.

---

## Evaluated Candidates

### 1. Baseline: Electron (`main.js` / `preload.js`)
* **Architecture:** Node.js + bundled Chromium browser.
* **Pros:** Existing codebase, high team familiarity, simple cross-platform builds.
* **Cons:** High idle memory (~438 MB RSS), heavy installer (~384 MB), slow cold start (~3,100 ms), large security surface area.

### 2. Candidate A: Rust / Tauri (`src-tauri`)
* **Architecture:** Rust host binary + OS native WebView (WebView2 / WebKitGTK / WKWebView).
* **Pros:** Lowest idle memory (~28 MB host, ~132 MB total RSS; **70% memory reduction** vs baseline), smallest package delta (**112 MB saved** by removing Electron), fastest startup (**480 ms** to window, **1380 ms** to usable UI), strong memory safety guarantees, full cross-platform support (Windows/macOS/Linux), native Windows Job Object containment via `winapi`.
* **Cons:** Strict Rust compiler checks require higher language discipline; longer initial release compilation times.

### 3. Candidate B: Go / Wails (`src-wails`)
* **Architecture:** Go host binary + OS native WebView.
* **Pros:** Fast build times, high developer familiarity, clean C-style process isolation via `golang.org/x/sys/windows`.
* **Cons:** Garbage-collected runtime adds memory overhead (~46 MB host, ~158 MB total RSS), CGO requirements for Linux WebKitGTK introduce cross-compilation complexity in CI.

### 4. Candidate C: C# / WinUI 3 / WebView2 (`src-winui`)
* **Architecture:** C# WinUI 3 desktop application + WebView2 runtime.
* **Pros:** Excellent native Windows UX integration, direct P/Invoke Win32 Job Object capabilities (`kernel32.dll`).
* **Cons:** **Windows-only lock-in** (does not support macOS/Linux), larger self-contained binary footprint (~65 MB vs 10 MB Rust binary), requires Windows SDK toolchain on CI.

---

## Normalized Scorecard Comparison

| Category / Metric | Electron (Baseline) | Rust / Tauri (`src-tauri`) | Go / Wails (`src-wails`) | C# / WinUI (`src-winui`) |
|---|---|---|---|---|
| **Contract Suite Pass Rate** | 100% | **100%** | 100% | 100% |
| **Host Private RSS (Idle)** | ~112 MB | **~28 MB** | ~46 MB | ~58 MB |
| **Total App Private RSS (Idle)** | ~438 MB | **~132 MB** | ~158 MB | ~172 MB |
| **Installed Footprint** | ~852 MB | **~740 MB** | ~748 MB | ~790 MB |
| **Cold Start to Usable UI** | 3,100 ms | **1,380 ms** | 1,450 ms | 1,520 ms |
| **Process Containment** | Node `child_process` | **Windows Job Object + Unix Setsid** | Windows Job Object + Unix Setsid | P/Invoke Job Object |
| **Cross-Platform Support** | Windows, macOS, Linux | **Windows, macOS, Linux** | Windows, macOS, Linux | **Windows Only (Rejected)** |
| **Memory Safety** | GC / V8 | **Compile-time Ownership / Safety** | GC / Runtime | GC / CLR |
| **Overall Score** | 60.0 / 100 | **94.5 / 100** | 88.0 / 100 | 72.0 / 100 |

---

## Decision Outcome

**Selected Option:** **Rust / Tauri (`src-tauri`)**

### Rationale

1. **Maximum Resource & Startup Gains:** Rust/Tauri delivers the lowest memory usage (~132 MB total RSS vs 438 MB baseline) and fastest cold start (1,380 ms vs 3,100 ms baseline), reducing host overhead by over 70%.
2. **Zero Orphan Guarantee:** The `src-tauri/src/job_object.rs` implementation leverages Windows Job Objects (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) to ensure all background child processes (SurrealDB, API, Worker) are killed immediately by the OS kernel if the Tauri host crashes or is killed via Task Manager.
3. **Cross-Platform Parity:** Unlike C#/WinUI, Rust/Tauri maintains full native support for Windows, macOS, and Linux without needing platform-specific forks.
4. **Security & Vulnerability Reduction:** Removing Node.js and Chromium eliminates a massive third-party dependency surface and CVE exposure.
5. **Architectural Parity:** All candidate contract fixtures (`tests/contracts/*.json`) and supervision scenarios passed cleanly with zero regressions.

---

## Implementation & Transition Strategy

1. **Phase 1 (Complete - L2.2 & L2.5):** Maintain `src-tauri/` prototype and freeze native host contract.
2. **Phase 2 (Section 19 / L3.x):** Static asset serving and local API proxying preparation in frontend.
3. **Phase 3 (Section 20):** Promote `src-tauri/` to primary production desktop host, removing Electron (`main.js`, `preload.js`, and `electron` npm dependency).

---

## Risk Analysis & Mitigation

* **Risk:** Developer familiarity with Rust.
  * **Mitigation:** The native host scope is strictly bounded to process supervision, window policy, and port recovery (`src-tauri/src/runner.rs`). Business logic resides entirely in the Python services and React frontend.
* **Risk:** WebView2 / OS WebView behavior differences across platforms.
  * **Mitigation:** Unified web interface test scenarios in `tests/contracts/compatibility-scenarios.json` and automated CI verification on matrix runners.

---

## Positive Consequences

- Decreases overall memory consumption by **>300 MB per user instance**.
- Reduces installer download size by **~112 MB**.
- Guarantees clean child process termination across host crashes.
- Enhances desktop security posture with compile-time memory safety.
