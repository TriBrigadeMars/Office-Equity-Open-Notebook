---
name: android-studio-gemini-orchestrator
description: >-
  Orchestrates Android Studio's Gemini Agent (Gemini 3.6 Flash, Gemini 3.5 Flash Lite,
  Gemini 3.1 Pro) from Antigravity. Enables dual-agent credit optimization by offloading
  heavy code generation and editing to Android Studio AI Pro quota while retaining
  Antigravity for supervisory planning, trajectory monitoring, and mechanical test verification.
version: 1.0.0
author: Local contributor, Antigravity Agent
platforms: [linux]
metadata:
  tags: [AndroidStudio, Gemini, Orchestration, MultiAgent, AIPro, Credits, Quota, MCP, TrajectoryWatcher]
---

# Android Studio Gemini Orchestrator

Orchestrate the autonomous coding agent in Android Studio directly from Google Antigravity, distributing work across **Gemini 3.6 Flash**, **Gemini 3.5 Flash Lite**, and **Gemini 3.1 Pro** while maximizing separate AI Pro credit quotas.

---

## 1. Credit Separation Principle

- **Android Studio AI Pro Pool**: Bound to your Google One AI Pro tier (`g1-pro-tier` under `aicode-consumers` for `nalcs.mika@gmail.com`). All file mutations, multi-step code generation, and in-IDE executions consume **Android Studio AI Pro quota**.
- **Antigravity AI Pro Pool**: Used exclusively for high-level roadmap sequencing, AST analysis, trajectory monitoring, automated test verification, and regression recovery.

For a full breakdown of token allowances and pricing models, see [credit_tiering.md](./references/credit_tiering.md).

---

## 2. Workload Allocation Matrix

Route work packets according to prompt complexity:

| Model Tier in Android Studio | Context | Quota Burn | Assigned Responsibilities |
| :--- | :--- | :--- | :--- |
| **Gemini 3.5 Flash Lite** | 1M Tokens | Lowest | Inventories, size profiling, documentation updates, simple wrapper ports, lint cleanups. |
| **Gemini 3.6 Flash** | 1M Tokens | Standard | Core feature development, unit test harness creation, process supervision, error recovery. |
| **Gemini 3.1 Pro** | 1M Tokens | Premium | Native host contracts (Rust/Tauri, Go/Wails, C#/WinUI), cross-language boundaries, synchronization algorithms. |

---

## 3. Orchestration Workflows

### Mode A: Model Context Protocol (MCP) Bridge (Autonomous Pull)
Android Studio Agent connects directly to Antigravity's MCP server, allowing the IDE agent to pull work packets and request automated test verification.

1. **Verify or Setup MCP Configuration**:
   ```bash
   ./scripts/setup_mcp.sh
   ```
   This registers `antigravity-orchestrator` in `~/.var/app/com.google.AndroidStudio/config/Google/AndroidStudio*/mcp.json`.

2. **In Android Studio Agent Window**:
   Instruct the agent:
   ```text
   Use the antigravity_get_active_task tool to fetch the current task and implement it.
   ```
   The agent reads the task, executes file changes, and calls `antigravity_run_mechanical_verification` to confirm test suite status.

---

### Mode B: Staging Anchor + Trajectory Watcher (Supervised Push)
Antigravity stages the active prompt packet into `.agent/CURRENT_TASK.md` and updates `AGENTS.md`, then monitors `steps.jsonl` for turn completion.

1. **Check Status & Active Packet**:
   ```bash
   node ./scripts/orchestrator.js status
   ```

2. **Stage Active Task for Android Studio**:
   ```bash
   node ./scripts/orchestrator.js stage
   ```
   This writes `.agent/CURRENT_TASK.md` and updates `AGENTS.md` with strict packet boundaries.

3. **Trigger in Android Studio**:
   Switch to the tab corresponding to the assigned model and send:
   ```text
   Execute the active task staged in .agent/CURRENT_TASK.md
   ```

4. **Watch and Auto-Verify**:
   In Antigravity terminal:
   ```bash
   node ./scripts/orchestrator.js watch
   ```
   Antigravity continuously monitors the session in `~/.android/studio/agent/conversations/`. As soon as `status: "DONE"` is recorded, Antigravity executes the mechanical verification test suite (`npm run build:types` + test runners) and reports results.

5. **Run Manual Verification Anytime**:
   ```bash
   node ./scripts/verifier.js
   ```

---

## 4. Key References & Scripts

- [credit_tiering.md](./references/credit_tiering.md): Detailed quota boundaries and model selection guidance.
- [android_studio_internals.md](./references/android_studio_internals.md): Schema for `steps.jsonl`, `metadata.json`, and option XML files.
- [`scripts/orchestrator.js`](./scripts/orchestrator.js): CLI entrypoint for staging, status, and watching.
- [`scripts/trajectory_watcher.js`](./scripts/trajectory_watcher.js): Real-time monitor for Android Studio agent sessions.
- [`scripts/verifier.js`](./scripts/verifier.js): Mechanical build and test runner.
- [`scripts/mcp_server.py`](./scripts/mcp_server.py): JSON-RPC 2.0 MCP server for Android Studio.
