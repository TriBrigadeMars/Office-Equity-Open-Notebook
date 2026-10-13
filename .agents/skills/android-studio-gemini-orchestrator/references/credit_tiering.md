# Credit Tiering & Model Allocation Guide

## 1. Credit Pools & Quota Separation

| Environment | Authentication Tier / Source | Quota Consumption | Ideal Role |
| :--- | :--- | :--- | :--- |
| **Android Studio** | Google One AI Pro (`g1-pro-tier` under `aicode-consumers` via `nalcs.mika@gmail.com`) | Dedicated IDE daily allowance | Heavy code generation, file modifications, multi-step code refactoring, and in-repo command executions. |
| **Google Antigravity** | Antigravity AI Pro / Execution Credits | Agent runtime & conversation quota | Supervisory planning, AST indexing, dependency sequencing, automated verification, test suite execution, and regression triage. |

By delegating codebase mutations to Android Studio's Gemini Agent, all code tokens and file diff operations are billed against the Android Studio AI Pro quota, preserving Antigravity credits.

---

## 2. Model Specialization Matrix

In Android Studio, three Gemini models are available:

### 1. Gemini 3.5 Flash Lite
- **Context Window**: 1M Tokens
- **Speed & Latency**: Ultra-low latency, highest throughput
- **Relative Quota Burn**: Lowest
- **Best Suited For**:
  - Mechanical inventories (e.g. dependency listings, packaged size audits)
  - Pure documentation and markdown state handoffs
  - Small script rewrites and type stubbing
  - Straightforward lint error corrections

### 2. Gemini 3.6 Flash
- **Context Window**: 1M Tokens
- **Speed & Latency**: Fast, balanced reasoning
- **Relative Quota Burn**: Standard
- **Best Suited For**:
  - Core implementation workhorse (TypeScript wrapper ports, process management)
  - Unit test generation and test harness construction
  - Safe interactive port conflict recovery and error-handling paths
  - General feature development and API wiring

### 3. Gemini 3.1 Pro (Preview)
- **Context Window**: 1M Tokens (Advanced Reasoning)
- **Speed & Latency**: Moderate latency, deep multi-step reasoning
- **Relative Quota Burn**: Premium / Highest
- **Best Suited For**:
  - Native host architecture contracts (Rust/Tauri, Go/Wails, C#/WinUI)
  - Architectural scoring, cross-language boundary design
  - Removal of bundled runtimes (e.g. Node.js de-coupling)
  - Complex memory profiling, thread synchronization, and concurrency bottlenecks
