# Native Host Candidate Compatibility Guide

This guide describes how candidate native desktop hosts (Rust, Go, C#) must consume the language-neutral compatibility harness fixtures and emit standardized test results to prove behavioral parity with the reference TypeScript implementation.

## 1. Overview

Before any native host candidate (e.g. Rust/Tauri, Go/Wails, C#/WinUI) can replace Electron or wrapper scripts, it must execute against the same canonical JSON test fixtures and emit a matching machine-readable `CompatibilityResult` JSON report.

## 2. Canonical Fixture Sources

All compatibility fixtures are stored in language-neutral JSON files:

- `tests/contracts/service-table-cases.json`
- `tests/contracts/runtime-manifest-cases.json`
- `tests/contracts/runtime-resolution-cases.json`
- `tests/contracts/window-policy-cases.json`
- `tests/contracts/process-management-cases.json`
- `tests/contracts/compatibility-scenarios.json`

## 3. Machine-Readable Result Schema

Candidate runners must produce output matching this JSON schema:

```json
{
  "implementation": "rust-tauri",
  "suite": "compatibility-harness-v1",
  "version": "1.0.0",
  "passed": 48,
  "failed": 0,
  "total": 48,
  "durationMs": 85,
  "timestamp": "2026-03-05T12:00:00.000Z",
  "details": [
    {
      "id": "PURE-001",
      "category": "service-table",
      "description": "Pure case [service-table] PURE-001",
      "passed": true
    }
  ]
}
```

## 4. How Native Candidates Plug In

### Rust
- Native candidate loads `tests/contracts/compatibility-scenarios.json` using `serde_json`.
- Candidate executes contract functions (or wrapper process logic) against inputs.
- Runner asserts outputs against `expectedOutput` or `expectedValid`.
- Generates `compatibility-result-rust.json`.

### Go
- Native candidate parses fixtures with `encoding/json`.
- Runs subtests with `testing.T` and formats a `CompatibilityResult` struct.
- Emits `compatibility-result-go.json`.

### C#
- Candidate uses `System.Text.Json` to read fixtures.
- Runs `xUnit` or console test suite emitting `compatibility-result-csharp.json`.

## 5. Pass Criteria

A candidate is considered compatible if and only if:
1. `failed == 0`
2. `passed == total`
3. All supervision scenarios and pure boundary cases pass without regression.
