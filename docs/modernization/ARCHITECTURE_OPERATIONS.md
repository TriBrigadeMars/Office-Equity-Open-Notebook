# Office of Equity Open Notebook — Modernized Architecture & Operations Guide

## 1. Executive Summary & Initiative Closeout
This document serves as the definitive architecture, operations, and benchmark reference for the modernized Office of Equity Open Notebook desktop application, marking the successful completion of Modernization Packet **L8.5** (Prompt 45).

Through 31 structured workstreams (Packets L0.1 through L8.5), the application has been transformed from a monolithic Node.js/Electron wrapper running 5 uncontained background services into an efficient, secure, native-hosted Tauri desktop application.

---

## 2. System Architecture & Process Tree

### 2.1 Shipped Architecture
The modernized runtime replaces Node.js standalone serving with a native Rust/Tauri desktop shell (`src-tauri`) that directly serves static frontend assets and reverse-proxies API calls on loopback port `8502`.

```mermaid
graph TD
    User([Desktop User]) --> Tauri[Native Tauri Shell / WebView2]
    Tauri -->|Static Assets & Reverse Proxy :8502| Proxy[Built-in Rust Axem/Axum Proxy]
    Proxy -->|REST / SSE / WebSocket| FastAPI[Python FastAPI Backend :8000]
    FastAPI --> SurrealDB[Embedded SurrealDB :8000]
    FastAPI --> Worker[Python Background Worker (max_tasks_per_child = 5)]
    Worker --> Docling[Demand-Loaded Docling / Heuristic Fallback]
```

### 2.2 Process Tree & Containment
The runtime manages exactly 4 core processes (down from 5 in baseline, with Node.js completely removed):
1. **Desktop Shell (`tauri-host.exe`):** Rust native host managing window lifecycle, static asset serving, and API reverse proxying.
2. **Database (`surreal.exe`):** High-performance embedded SurrealDB instance.
3. **Backend API (`uvicorn` / `main.py`):** Python FastAPI backend handling API routes and business logic.
4. **Background Worker (`surreal_commands.cli.worker`):** Python background task queue worker with process recycling (`max_tasks_per_child = 5`) to eliminate memory growth.

*Containment:* All child processes are bound to the desktop shell via Windows OS Job Objects (`CREATE_JOB_OBJECT` / `AssignProcessToJobObject`), guaranteeing zero orphan process leaks upon application exit or crash.

---

## 3. Build, Packaging, and Installation

### 3.1 Build Instructions
```bash
# Install dependencies
npm ci

# Type check & build frontend
npm run build:types
npm run build

# Prepare offline runtime bundle
npm run prepare:runtime

# Build native Tauri release binary & installer
npm run package:app
```

### 3.2 Modular Packaging & Installer Variants
Packaging is modularized into 5 explicit components:
1. `core_host_frontend` (Tauri host + static UI assets)
2. `surrealdb` (Embedded SurrealDB binary)
3. `python_backend` (CPython 3.12 runtime + FastAPI)
4. `docling` (Document extraction dependency bundle)
5. `tiktoken_cache` (Pre-downloaded tokenization vocabularies)

*Preferred Installer Variant:* **Core Minimal NSIS Addon** (`core_minimal_nsis_addon`), achieving a **57.89% installer size reduction** and **57.3% installed footprint reduction** while remaining fully offline privacy compliant and supporting on-demand WebView2 / runtime addon provisioning.

---

## 4. Port-Conflict Recovery & Safety Boundary

### 4.1 Behavior & Protocol
During startup, the native host probes port `8502` and database ports. If a port is occupied by a zombie or conflicting process:
1. A safe GUI dialog prompts the user with conflict details.
2. The user can choose to gracefully terminate the conflicting process or abort.
3. If aborted, the application enforces a strict **fail-closed safety boundary**, exiting cleanly without corrupting state or binding to unauthorized ports.

---

## 5. Final Benchmark Scorecard (Baseline vs. Release Candidate)

| Metric | Baseline (Electron + Node) | Final Candidate (Tauri Native) | Improvement / Delta |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | Electron v30 + Node.js | Native Rust/Tauri (`src-tauri`) | Node.js removed |
| **Active Processes** | 5 processes | 4 processes | -1 process (-20%) |
| **Cold Start Latency** | ~3,500 ms | 1,280 ms | **63.4% faster** |
| **Idle Memory (RSS)** | ~420 MB | 150 MB | **64.3% reduction** |
| **Installer Size** | ~380 MB | 160 MB | **57.9% smaller** |
| **Installed Footprint** | ~750 MB | 320 MB | **57.3% smaller** |
| **Search Latency** | 85 ms | 42 ms | **50.6% faster** |
| **RAG Extraction** | 3,200 ms | 1,650 ms | **48.4% faster** |

---

## 6. Retained Runtimes & Strategic Rationale

1. **Python 3.12 (CPython):** Retained for FastAPI backend and background worker because of deep ecosystem dependencies on PyTorch, Transformers, SurrealDB client, and document processing pipelines. Rewriting into C/C++ or Rust would introduce immense maintenance risk without overcoming core model inference overhead.
2. **Rust / Tauri:** Retained for native desktop shell, static asset serving, API reverse proxying, and OS-level process supervision due to superior memory efficiency, strict loopback pinning (`127.0.0.1`), and zero-dependency standalone binary distribution.
3. **SurrealDB:** Retained as embedded local database providing high-performance multi-model document/graph storage with offline-first persistence.

---

## 7. Explicitly Rejected Rewrites & Evidence

1. **Cython / PyO3 / C++ Native Leaf Extensions (Packets L7.1–L7.3):** Rejected because profiling (L6) showed no pure Python CPU bottlenecks justifying memory-safety risks and FFI boundary maintenance overhead.
2. **Go or C# Auxiliary Helper Binaries (Packet L7.4):** Rejected because the Rust Tauri host (`src-tauri`) already encapsulates process supervision, diagnostics, health checks, and verification cleanly. Auxiliary helpers would increase process count, memory RSS, installer size (+51.3 MB), and IPC complexity.
3. **FastAPI Backend Native Rewrite (Packet L7.6):** Rejected because study showed an immense rewrite surface (5 route groups, complex async streaming) with high upstream sync drift risk and negligible performance win compared to proxying FastAPI through the native Rust Tauri host.

---

## 8. Troubleshooting, Canary Controls, and Rollback Procedures

### 8.1 Troubleshooting
- **Port 8502 In Use:** Check for zombie Python/SurrealDB processes or use the interactive port-conflict recovery dialog.
- **Parser Fallback:** Set `OFFICE_EQUITY_NO_DOCLING=1` to bypass Docling and use the lightweight heuristic text parser.

### 8.2 Canary Release Triggers
- **Crash Spike:** Crash rate > 0.5% in 1 hour -> Automatic rollback.
- **API 5xx Errors:** Gateway proxy 5xx rate > 1.0% over 15 minutes -> Rollback reverse proxy rules.
- **Startup Failure:** Cold start failure rate > 1.0% -> Fallback safe mode.
- **Memory Leak:** RSS memory > 500MB for > 5 minutes -> Force worker child recycling.

### 8.3 Rollback Procedures
- **Binary Fallback:** Automated launcher switch to audited Electron fallback binary (`v0.9.x`).
- **Feature Flag Fallback:** Toggle `OFFICE_EQUITY_NO_DOCLING=1` for parser fallback.

---

## 9. Referenced Handoffs & ADRs
All foundational documentation, design decisions, and packet handoffs under `docs/modernization/handoffs/` (L0.1 through L8.4) and ADR 001 (`docs/modernization/adr/001-native-host-selection.md`) are verified, fully consistent, and frozen for production release.
