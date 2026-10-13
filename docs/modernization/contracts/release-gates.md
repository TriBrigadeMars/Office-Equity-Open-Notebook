# Release Gate Policy & CI Enforcement Contract

## Overview
This document defines the release acceptance gates, CI lane blocking policy, canary release triggers, and tested rollback procedures for the Office of Equity Open Notebook application.

---

## 1. CI Testing Lanes & Blocking Policy

| Lane ID | Lane Name | Category | PR Blocking | Release Blocking | Associated Test Suites |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LANE_FAST** | Fast Lane | Fast | **Yes** | **Yes** | `build:types`, `test-service-contracts`, `test-readiness` |
| **LANE_INTEGRATION** | Integration Lane | Integration | **Yes** | **Yes** | `test-native-host-proxy`, `test-loopback-audit`, `test-process-management` |
| **LANE_STRESS_CHAOS** | Stress & Chaos Lane | Stress/Chaos | No | **Yes** | `test-port-conflict`, `test-compatibility-harness` |
| **LANE_RAG_EXTRACTION** | RAG & Golden Extraction | RAG | **Yes** | **Yes** | `test-golden-regression`, `test-no-docling-runtime` |
| **LANE_PACKAGING** | Packaging & Installer | Packaging | No | **Yes** | `test-modular-packaging`, `test-installer-experiments`, `test-clean-machine-validation` |
| **LANE_PERFORMANCE** | Performance & Worker | Performance | No | **Yes** | `test-performance-harness`, `test-worker-concurrency`, `test-reprofile-app` |

---

## 2. Release Acceptance Gates

1. **Correctness Gate:** 25/25 mechanical test suites passing at 100% with zero regressions.
2. **Security Gate:** Zero high/critical CVEs; loopback binding strictly pinned to `127.0.0.1`; credential and path sanitization enforced.
3. **Process Cleanup Gate:** Zero orphan processes or background service leaks after application shutdown or uninstallation (enforced via OS job objects).
4. **Packaging Gate:** Core minimal NSIS installer variant achieving >= 50% size reduction (57.89% actual) with SHA-256 cryptographic verification.
5. **Performance Gate:** Cold start latency < 1,500ms (1,280ms actual); idle memory RSS < 200MB (150MB actual); Python worker memory recycling active.

---

## 3. Switchability & Feature Flags

- **Core Runtime Parser:** Native Rust/Tauri parser with demand-loaded Docling / heuristic fallback toggled via `OFFICE_EQUITY_NO_DOCLING=1`.
- **Desktop Shell UI:** Native Tauri host (`src-tauri`) as primary; legacy Electron shell retained as audited fallback binary in packaging configuration.
- **Worker Process Recycling:** Configured via `max_tasks_per_child = 5` to reclaim 100% of retained PyTorch memory post-job with zero code fork.

---

## 4. Canary Release & Rollback Triggers

- **Crash Spike Trigger:** Crash rate > 0.5% in 1 hour -> Automatic rollback to stable release binary.
- **API 5xx Error Trigger:** Gateway proxy 5xx rate > 1.0% over 15 minutes -> Automatic rollback of reverse proxy routing rules.
- **Startup Failure Trigger:** Cold start failure rate > 1.0% -> Fallback safe mode prompt.
- **Memory Leak Trigger:** RSS memory > 500MB for > 5 minutes -> Throttle canary and force worker child recycling.

---

## 5. Rollback Verification

Rollback procedures are tested continuously in the validation suite (`test-ci-release-gates.js`), exercising binary fallback switching (Tauri to Electron) and parser mode toggles (Docling to heuristic) successfully.
