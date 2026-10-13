# Office of Equity Open Notebook
# Master Modernization, Efficiency, and Native-Runtime Migration Plan

**Status:** Engineering master plan  
**Scope:** `Office-Equity-Open-Notebook` desktop wrapper and the upstream Open Notebook runtime it packages  
**Primary platform:** Windows 10/11 x64  
**Current wrapper version observed:** `1.14.1`  
**Purpose:** Reduce installer size, installed footprint, idle/peak memory, startup cost, process count, and lifecycle complexity without sacrificing functionality, auditability, security, or upstream compatibility.
**Integrated reliability feature:** Interactive, safety-gated port-conflict detection, diagnosis, cleanup, and bounded startup retry.

---

## 1. Executive summary

The current desktop repository is small, but the application it assembles is large because it bundles several complete runtimes and keeps multiple long-lived processes alive:

```text
Electron / bundled Chromium
        |
        +-- Next.js standalone server / Node.js
                |
                +-- /api proxy --> FastAPI / Python
                                    |
                                    +-- Open Notebook Python application stack
                                    +-- LangGraph / model adapters / content processing

        +-- Python background worker
                |
                +-- command handlers / workflow graph / podcast / ingestion logic

        +-- SurrealDB native executable
```

The wrapper currently assembles this runtime through `scripts/prepare-runtime.js`, launches it through `scripts/lib/service-table.js` and `scripts/lib/supervisor.js`, and hosts the UI in Electron through `main.js`.

The safest optimization strategy is **not** a big-bang rewrite and **not** an attempt to force the entire application into one language. The recommended strategy is to progressively remove redundant runtimes, isolate heavyweight optional functionality, and replace infrastructure boundaries with small native components only where the replacement has a measurable benefit.

The desired end state is approximately:

```text
+--------------------------------------------------------+
| Native desktop host                                    |
| Rust/Tauri, Go/Wails, or C#/WinUI + WebView2          |
|                                                        |
| - native window / WebView                              |
| - process lifecycle                                    |
| - Windows Job Object containment                       |
| - diagnostics / logging                                |
| - static React asset serving                           |
| - /api reverse proxy                                   |
| - SSE streaming proxy                                  |
| - runtime verification                                 |
+----------------------+---------------------------------+
                       |
            +----------+----------+
            |                     |
            v                     v
       SurrealDB              Python AI runtime
                                  |
                                  +-- FastAPI
                                  +-- worker only when needed
                                  +-- optional Docling process/component
```

The React/TypeScript user interface can remain. Python should remain where the Open Notebook AI/ML ecosystem genuinely depends on it. SurrealDB is already a native executable and should remain unchanged unless profiling discovers a specific reason to reconsider it.

### Recommended priority order

1. Freeze and measure the current baseline.
2. Pin the upstream Open Notebook source revision used to assemble a release.
3. Formalize the wrapper's behavioral contracts, preferably in strict TypeScript first.
4. Build a repeatable benchmark, compatibility, stress, and chaos harness.
5. Add safety-gated interactive port-conflict recovery to the current host and make it part of the shared host contract.
6. Remove avoidable packaging weight before rewriting code.
7. Make Docling and other heavyweight optional functionality demand-loaded where possible.
8. Prototype native desktop hosts in Rust, Go, and/or C# against the same contracts.
9. Move process supervision into the selected native host and use Windows Job Objects.
10. Convert the frontend from a long-running Next.js server dependency to a static/client application where feasible.
11. Move static serving, API proxying, and SSE forwarding into the native host.
12. Remove bundled Node.js.
13. Remove Electron.
14. Re-profile the remaining Python runtime.
15. Optimize Python process topology and imports before rewriting Python business logic.
16. Only port individual Python hotspots after measurements prove they are worth the maintenance cost.
17. Treat a FastAPI/backend rewrite as an optional late-stage project, not an early optimization.

---

## 2. Current codebase observations

### 2.1 Wrapper-owned code

The repository itself is a comparatively thin desktop and packaging layer. Important files include:

- `main.js` — Electron lifecycle, window creation, security/navigation policy integration, service startup/shutdown.
- `preload.js` — Electron preload surface.
- `scripts/prepare-runtime.js` — assembles the self-contained runtime.
- `scripts/start-services.js` / `scripts/run-services.js` — service launch entry points.
- `scripts/lib/service-table.js` — defines the processes, environment, ports, and startup behavior.
- `scripts/lib/supervisor.js` — process launch, readiness, log capture, liveness, shutdown, and process-tree cleanup.
- `scripts/lib/window-policy.js` — local-origin and external-link security policy.
- `scripts/lib/resolve-runtimes.js` — runtime discovery.
- `scripts/lib/runtime-manifest.js` — runtime metadata/verification support.
- `scripts/lib/encryption-key.js` — encryption-key handling.
- `scripts/lib/problem-report.js` — diagnostic report/log-tail generation.
- `scripts/package.js` — app packaging.
- `scripts/build-installer.js` — NSIS installer generation.
- `scripts/verify-installer.js` — installer verification.

### 2.2 Current long-lived services

`scripts/lib/service-table.js` defines four principal runtime services:

1. **SurrealDB**
   - Native `surreal.exe`.
   - Binds to loopback.
   - Uses a local RocksDB-backed database file.

2. **FastAPI backend**
   - Bundled `python.exe`.
   - Runs `uvicorn api.main:app`.
   - Long-lived.

3. **Background worker**
   - Separate bundled `python.exe`.
   - Runs `surreal_commands.cli.worker` with `--import-modules commands --max-tasks 5`.
   - Long-lived even when there is no work.

4. **Frontend server**
   - Bundled `node.exe`.
   - Runs a Next.js standalone `server.js`.
   - Long-lived.

Electron adds another substantial runtime and Chromium process tree around those services.

### 2.3 Current runtime assembly

`scripts/prepare-runtime.js` currently builds or downloads:

- standalone CPython 3.12;
- backend Python dependencies;
- the upstream backend source;
- `content-core[docling]`;
- Next.js standalone frontend output;
- a portable Node.js runtime;
- SurrealDB;
- tiktoken cache/assets.

The runtime therefore becomes large primarily because of what the wrapper **bundles**, not because the wrapper source code is large.

### 2.4 Important existing tests

The repository already has a strong starting point for safe replacement work:

```text
scripts/test/verify-runtime.test.js
scripts/test/problem-report.test.js
scripts/test/resolve-runtimes.test.js
scripts/test/encryption-key.test.js
scripts/test/security.test.js
scripts/test/supervisor.test.js
scripts/test/stress-test.js
scripts/test/chaos-test.js
scripts/test/rag-test.js
```

The port-conflict workstream adds `scripts/test/port-conflict.test.js` and should promote its scenarios into the same language-neutral compatibility suite.

These should evolve into a language-neutral compatibility suite rather than being discarded during a migration.

---

## 3. Goals and non-goals

## 3.1 Goals

The modernization program should target measurable improvements in:

- installer size;
- installed size;
- cold-start time;
- time until UI is interactive;
- time until API is ready;
- idle working set;
- peak working set during ingestion;
- process count;
- idle CPU utilization;
- shutdown correctness;
- restart reliability;
- crash cleanup;
- update/release reproducibility;
- testability;
- auditability;
- security boundaries;
- maintainability of the wrapper;
- compatibility with future upstream Open Notebook releases.

## 3.2 Non-goals

The first modernization program should **not** attempt to:

- rewrite all of Open Notebook in Rust, Go, C#, C++, or another language;
- replace React simply because it is JavaScript/TypeScript;
- replace SurrealDB without evidence that it is a bottleneck;
- reproduce the entire Python AI ecosystem in a native language;
- fork upstream Open Notebook unnecessarily;
- optimize code before establishing a measurement baseline;
- trade correctness, privacy, or local-only operation for smaller binaries;
- introduce a new runtime unless it removes more complexity than it adds.

---

## 4. Engineering principles for every rewrite

Every task in this document should follow the same rules.

### 4.1 Measure first

A component does not earn a rewrite simply because another language is theoretically faster. Record the current behavior and resource use first.

### 4.2 Preserve externally visible contracts

A replacement should preserve:

- process inputs and outputs;
- environment-variable semantics;
- CLI behavior where applicable;
- HTTP route behavior;
- status codes;
- JSON field names and types;
- SSE framing;
- error conditions;
- shutdown semantics;
- filesystem paths;
- logging needed for support;
- security policy.

### 4.3 Keep old and new implementations runnable in parallel during development

Use a feature flag, launcher option, environment variable, or build variant so the project can switch between implementations.

Example:

```text
ONB_HOST_IMPL=js
ONB_HOST_IMPL=go
ONB_HOST_IMPL=rust
ONB_HOST_IMPL=dotnet
```

The exact mechanism may differ, but rollback must be cheap until a replacement has passed all gates.

### 4.4 Prefer boundary rewrites over business-logic rewrites

Good early native-language targets:

- process supervision;
- file verification;
- runtime discovery;
- diagnostics;
- static file serving;
- HTTP reverse proxying;
- SSE forwarding;
- installer/bootstrap utilities;
- updates;
- platform integration.

Poor early targets:

- LangGraph workflows;
- provider/model abstraction logic;
- podcast generation workflows;
- content model behavior;
- application domain logic tightly coupled to upstream Python.

### 4.5 Make every migration independently shippable

Avoid sequences where the app is broken until five rewrites land at once.

### 4.6 Keep upstream source pristine where practical

The wrapper currently tries to assemble and patch around upstream rather than maintain a permanent source fork. Preserve that advantage.

### 4.7 Delete a runtime only when nothing depends on it

The best optimization is often not making code faster; it is removing an entire always-running runtime.

### 4.8 Treat process termination as a privileged safety boundary

Any feature that terminates a process must prove app ownership before acting. A PID, port number, or generic executable name such as `python.exe`/`node.exe` is not sufficient by itself. The implementation must revalidate identity immediately before termination, require explicit user confirmation for conflict cleanup, and refuse to kill unrelated or unverifiable processes.

---

# LOCAL-LLM EXECUTION OVERLAY

This modernization initiative is intended to be executed primarily with a local LLM. The architecture, testing strategy, and work decomposition in this plan must therefore be optimized not only for software correctness but also for reliable execution by a bounded-context local coding agent.

## LLM-A. Fixed execution profile

**Primary local model:** [`unsloth/Qwen3.5-9B-GGUF`](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF)  
**Quantization:** `UD-Q4_K_XL`  
**Configured context window:** `56k` tokens  
**Execution policy:** local-LLM-first for this initiative, with the explicit exception of **Section 19 / Workstream 11** and **Section 20 / Workstream 12**.

Sections 19–20 are reserved for a non-local execution path selected by the project owner. The local model must not be used to author, approve, or silently modify the production implementation for those two sections. It may consume their completed artifacts afterward so later local work can continue from the resulting repository state.

The local model is an **implementation assistant, not the source of truth**. Tests, contracts, benchmark evidence, security rules, repository state, and explicit acceptance criteria are authoritative.

### Operating rule

Never give the local model the whole repository merely because the context window is large. A 56k window is a ceiling, not a target.

Use this default budget:

| Context use | Target budget |
|---|---:|
| Packet instructions + relevant plan excerpts | 4–7k |
| Source and test files | 16–24k |
| Prior handoff / benchmark / error evidence | 3–6k |
| Tool output during execution | 4–8k |
| Model response, patch reasoning, recovery, and slack | 12–20k |

**Preferred initial prompt size:** 20–32k tokens.  
**Soft maximum initial prompt size:** 36k tokens.  
**Hard rule:** if the required initial context is likely to exceed 36k, split the packet before implementation.

The goal is to preserve enough context for the model to inspect failures, reconsider a patch, and produce a clean handoff without truncation pressure.

---

## LLM-B. Work-packet sizing rules

Every local-LLM task must be expressed as a bounded work packet. A work packet should normally satisfy all of the following:

- one primary objective;
- one architectural boundary;
- 3–6 production files in the initial write allowlist;
- 1–4 directly relevant test files;
- preferably fewer than 500 changed lines in one packet;
- one explicit validation command set;
- one rollback point;
- one handoff artifact;
- no unrelated refactoring;
- no dependency upgrade unless the packet explicitly authorizes it;
- no simultaneous migration of two runtimes or architectural boundaries.

A packet that exceeds these limits is not automatically invalid, but it must state why it cannot be split safely.

### Mandatory split triggers

Split the task before implementation when any of these are true:

1. More than 8 source files must be understood simultaneously.
2. The task crosses more than one process boundary.
3. The task changes both an API contract and its transport implementation in the same packet.
4. The task requires understanding more than approximately 36k tokens before the first edit.
5. A failed implementation would require reverting unrelated functionality.
6. The model begins proposing opportunistic refactors outside the packet objective.
7. Test failures expose a second subsystem not listed in the packet manifest.
8. The packet contains both architecture selection and production migration.

---

## LLM-C. Required packet manifest

Create a small manifest before every local-LLM coding packet. YAML is recommended because it is easy for humans and local models to audit.

```yaml
id: L0.1
status: ready
objective: Pin the upstream Open Notebook revision used by release builds.
plan_sections:
  - 5
read_only_context:
  - docs/relevant-section.md
read_allowlist:
  - scripts/prepare-runtime.js
  - package.json
write_allowlist:
  - upstream.lock.json
  - scripts/prepare-runtime.js
  - scripts/test/upstream-lock.test.js
forbidden:
  - frontend/**
  - upstream application source
contracts_to_preserve:
  - existing release CLI behavior
validation:
  - npm test -- --runInBand
  - node scripts/verify-installer.js --help
acceptance:
  - release build fails closed when the pinned revision cannot be resolved
  - manifest records the exact upstream revision
rollback:
  - revert this packet's commit
handoff:
  - docs/modernization/handoffs/L0.1.md
```

The allowlists are guardrails, not invitations to guess. If the model discovers that another file is required, it should stop implementation, record the dependency, and expand the packet deliberately rather than wandering through the repository.

---

## LLM-D. Standard local execution loop

Every local packet follows the same seven-stage loop.

### Stage 1 — Load only the required context

Provide:

1. this local-LLM execution overlay;
2. the packet manifest;
3. the relevant workstream section from this master plan;
4. only the cross-cutting policy excerpts needed for that packet;
5. the exact source/test files in the read allowlist;
6. the previous packet handoff if it is a direct dependency.

Do not load the entire master plan for routine implementation packets.

### Stage 2 — Contract restatement

Before editing, require the model to state:

- objective;
- behavior that must not change;
- files it expects to modify;
- tests it will use;
- explicit stop conditions.

If that restatement is wrong, do not allow implementation to proceed.

### Stage 3 — Small implementation plan

Require a plan of at most 8 implementation steps. The plan must map each step to a file or test. Broad statements such as "refactor the service layer" are not acceptable.

### Stage 4 — Implement only the packet

The model may edit only the packet write allowlist unless the manifest is deliberately revised.

### Stage 5 — Validate mechanically

Run the packet's exact test/build/lint commands. Never accept "the code looks correct" as a substitute for execution evidence.

### Stage 6 — Diff audit

Require at minimum:

```text
git diff --check
git diff --stat
git diff -- <packet files>
```

Then require the model to identify:

- changed behavior;
- unchanged behavior relied upon;
- new failure modes;
- security implications;
- untested assumptions.

### Stage 7 — Write a handoff and stop

A packet ends by writing a concise handoff that records:

- packet ID;
- files changed;
- tests run and exact result;
- benchmark delta if applicable;
- open risks;
- any context the next packet must know;
- commit hash when committed;
- whether rollback remains available.

Do not allow the same local session to opportunistically start the next packet.

---

## LLM-E. Recommended local-LLM state layout

Maintain durable state outside chat history so a new 56k session can resume deterministically.

```text
docs/modernization/
  packets/
    L0.1.yaml
    L0.2.yaml
    ...
  handoffs/
    L0.1.md
    L0.2.md
    ...
  decisions/
    ADR-*.md
  contracts/
    host-contract.md
    port-conflict-contract.md
    runtime-manifest-contract.md
  state/
    CURRENT.md

artifacts/modernization/
  benchmarks/
  test-results/
  chaos/
  size-reports/
  diffs/
```

`CURRENT.md` should remain intentionally small. It should identify only:

- current segment;
- last completed packet;
- next approved packet;
- active feature flags;
- known failing tests;
- current architecture variant;
- last accepted benchmark baseline.

Do not turn `CURRENT.md` into another giant design document.

---

## LLM-F. Cross-cutting context slices

Do not attach all policy sections to every packet. Use small reusable context slices.

| Slice | Master-plan sections | Load when |
|---|---|---|
| `CORE` | 3–4 | Every implementation packet |
| `SECURITY` | 41–45 | Process, network, secrets, path, installer, or native-code changes |
| `QUALITY` | 46–50 | Extraction, RAG, API behavior, or release-affecting changes |
| `ROLLBACK` | 51–53 | Any replacement/removal/migration packet |
| `LANG-RUST` | 34 | Rust work only |
| `LANG-GO` | 35 | Go work only |
| `LANG-DOTNET` | 36 | C#/.NET work only |
| `LANG-CYTHON` | 37 | Cython work only |
| `LANG-CPP` | 38 | C/C++ work only |

This keeps the local model focused while preserving the relevant controls.

---

## LLM-G. Non-local exception boundary for Sections 19–20

The local model is **not** the production executor for:

- **Section 19 — Workstream 11:** Move frontend serving and API proxying into the native host.
- **Section 20 — Workstream 12:** Remove bundled Node.js.

Treat these as an explicit external gate.

### What local execution may do before Section 19

Local packets may complete Sections 17–18 and produce:

- Next.js server-feature inventory;
- static/client frontend proof of concept;
- API route inventory;
- upload behavior fixtures;
- SSE timing fixtures;
- proxy contract tests;
- clean benchmark baseline;
- rollback build variant.

### Required handoff into Section 19

The non-local executor receives a bounded handoff bundle containing:

```text
frontend server dependency inventory
static build artifact and known limitations
API/proxy contract fixtures
SSE fixtures and expected timing
security constraints
baseline benchmark JSON
current host contract
rollback instructions
```

### Required handoff out of Section 20

Before local execution resumes, Sections 19–20 must produce:

- exact implementation commit(s);
- updated architecture state;
- changed file list;
- tests executed and results;
- clean-machine Node-free validation result;
- benchmark delta;
- known regressions or exceptions;
- rollback procedure;
- updated `docs/modernization/state/CURRENT.md`.

The next local packet must treat that handoff as repository truth and must not attempt to recreate Sections 19–20 independently.

---

## LLM-H. Local executor prompt template

Use a stable prompt shape rather than improvising a new coding request for every session.

```text
You are executing one bounded modernization work packet in an existing repository.

AUTHORITATIVE INPUTS
1. The packet manifest.
2. The referenced master-plan workstream.
3. The supplied source/test files.
4. Supplied contract, security, quality, and rollback slices.
5. Actual tool/test output from this session.

RULES
- Execute only this packet.
- Do not perform unrelated refactors.
- Do not edit outside the write allowlist without stopping and requesting a manifest change.
- Preserve all contracts listed in the packet.
- Tests and benchmark evidence outrank intuition.
- Do not suppress, weaken, or delete a failing test merely to make the packet pass.
- Do not upgrade dependencies unless explicitly authorized.
- If required context exceeds the packet boundary, stop and identify the missing dependency.
- If a destructive action is not explicitly authorized, do not perform it.

WORKFLOW
1. Restate the objective, preserved contracts, files, tests, and stop conditions.
2. Produce an implementation plan of no more than eight steps.
3. Inspect only the allowed files.
4. Implement the smallest patch that satisfies the objective.
5. Run the specified validation commands.
6. Audit the diff and identify untested assumptions.
7. Write the required handoff and stop.

SUCCESS MEANS
The packet acceptance criteria pass mechanically and the diff remains inside scope.
```

---

## LLM-I. Local-model review policy

Because the same model may generate and review a patch, self-review must be augmented with mechanical checks.

For normal packets require:

- compiler/type checker where applicable;
- lint/format checks;
- unit tests;
- targeted integration tests;
- `git diff --check`;
- packet-specific assertions.

For high-risk packets additionally require:

- an independent fresh-context local review session using only the packet manifest, diff, contracts, and test evidence;
- chaos/security fixtures where applicable;
- benchmark comparison;
- human approval for destructive process/security/installer changes.

A fresh-context review is preferred to asking the same saturated session "are you sure?"

---


# PART I — BASELINE, CONTRACTS, AND TEST INFRASTRUCTURE

## 5. Workstream 0 — Pin upstream and create a reproducible baseline

### Why this must come first

A performance comparison is meaningless if the upstream application revision changes between builds. A compatibility test is also unreliable if the source-under-test is moving.

### Step-by-step

#### 0.1 Record the exact upstream source revision

Add a machine-readable file such as:

```text
upstream.lock.json
```

Suggested fields:

```json
{
  "repository": "lfnovo/open-notebook",
  "commit": "<full commit SHA>",
  "tag": "<optional tag>",
  "wrapperCompatibility": "1"
}
```

#### 0.2 Make runtime preparation verify the revision

Before `scripts/prepare-runtime.js` assembles the runtime:

1. inspect the upstream repository HEAD;
2. compare it with the lock file;
3. fail clearly when it differs unless an explicit development override is supplied;
4. record the revision in the runtime manifest.

#### 0.3 Record toolchain versions

Capture:

- Node version;
- npm version;
- Python version;
- `uv` version;
- SurrealDB version;
- Electron version;
- NSIS version;
- native-host compiler versions once introduced.

#### 0.4 Produce a build manifest

Each release artifact should include a manifest with:

- wrapper git commit;
- upstream git commit;
- dependency lock hashes;
- runtime component versions;
- build timestamp;
- target architecture;
- hashes of major bundled executables;
- optional-feature set.

#### 0.5 Create a baseline release build

Build the application exactly as users receive it.

#### 0.6 Capture baseline metrics

At minimum record:

| Metric | Baseline |
|---|---:|
| Installer bytes | Measure |
| Installed bytes | Measure |
| Runtime directory bytes | Measure |
| Electron bytes | Measure |
| Node runtime bytes | Measure |
| Python runtime bytes | Measure |
| Python site-packages bytes | Measure |
| Docling-related bytes | Measure |
| SurrealDB bytes | Measure |
| Idle process count | Measure |
| Idle private working set | Measure |
| Idle total working set | Measure |
| Cold start to window | Measure |
| Cold start to API ready | Measure |
| Cold start to usable UI | Measure |
| Clean shutdown duration | Measure |
| Restart-after-crash success | Measure |
| Peak memory during PDF ingest | Measure |
| Peak memory during OCR ingest | Measure |
| Search latency | Measure |
| RAG response latency | Measure |

#### 0.7 Store baseline data as artifacts

Do not leave benchmark results only in a developer's notes. Store machine-readable JSON/CSV in CI artifacts and summarize them in the release report.

### Exit criteria

- A release can be rebuilt against the same upstream revision.
- Baseline measurements are repeatable.
- Every later optimization can be compared with a known build.

---

## 6. Workstream 1 — Convert wrapper contracts to strict TypeScript

### Purpose

This is primarily a correctness and migration-enablement task, not a runtime-performance task.

TypeScript can turn loosely shaped JS objects into explicit interfaces that can later be implemented by Go, Rust, or C#.

### Candidate modules

Prioritize:

```text
scripts/lib/service-table.js
scripts/lib/supervisor.js
scripts/lib/resolve-runtimes.js
scripts/lib/runtime-manifest.js
scripts/lib/problem-report.js
scripts/lib/encryption-key.js
scripts/lib/window-policy.js
scripts/lib/port-conflict.js      # once introduced by Workstream 15A
```

### Step-by-step

#### 1.1 Add TypeScript tooling without changing runtime behavior

Introduce:

- `typescript`;
- strict compiler options;
- a build output directory;
- source maps for development.

Recommended compiler stance:

```text
strict = true
noImplicitAny = true
noUncheckedIndexedAccess = true
exactOptionalPropertyTypes = true
useUnknownInCatchVariables = true
```

#### 1.2 Define core interfaces

Examples:

```text
ServiceDefinition
ServiceReadinessPolicy
ServiceHandle
ServiceExitEvent
RuntimePaths
RuntimeManifest
RuntimeComponent
RuntimeVerificationResult
ProblemReport
ShutdownResult
NavigationDecision
BackendEnvironment
PortConflict
ProcessIdentity
ProcessOwnershipClassification
PortConflictResolutionResult
StartupRetryPolicy
```

#### 1.3 Port pure modules first

Start with modules that have minimal side effects:

- URL/origin policy;
- path derivation;
- manifest parsing;
- runtime verification;
- problem-report formatting.

#### 1.4 Port process-management code after types are stable

Convert the supervisor last because it is concurrency- and lifecycle-sensitive.

#### 1.5 Keep test behavior unchanged

Existing JS tests should continue to pass during the conversion. Migrate tests only when doing so improves coverage or type safety.

#### 1.6 Export language-neutral fixtures

For pure logic, create fixtures under a path such as:

```text
tests/contracts/
```

Example files:

```text
runtime-resolution-cases.json
url-policy-cases.json
manifest-cases.json
service-table-cases.json
problem-report-cases.json
```

These fixtures can later be consumed by Rust, Go, or C# tests.

### Exit criteria

- Wrapper infrastructure builds under strict TypeScript.
- Existing tests pass.
- Core input/output shapes are explicit.
- Shared compatibility fixtures exist.

---

## 7. Workstream 2 — Build a language-neutral replacement harness

### Purpose

Every native rewrite should be judged against the current implementation using the same tests.

### 7.1 Differential testing for pure functions

Run the same fixture through old and new implementations:

```text
input fixture
   |          |
   v          v
old JS      new native
   |          |
   +---- compare ----+
```

Use this for:

- runtime discovery;
- manifest parsing;
- URL policy;
- environment construction;
- configuration validation;
- path normalization;
- installer metadata;
- diagnostics formatting where byte-for-byte matching matters.
- port-conflict message formatting and ownership classification for side-effect-free cases.

### 7.2 Property-based testing

Generate edge cases for:

- unusual Windows paths;
- spaces and Unicode paths;
- long paths;
- missing files;
- malformed JSON;
- malformed URLs;
- invalid origins;
- invalid ports;
- corrupted manifests;
- duplicate runtime entries;
- unexpected process exits.

Use the native ecosystem's established property/fuzz tools where appropriate.

### 7.3 Process-supervision scenario suite

Automate scenarios such as:

1. normal startup;
2. database startup failure;
3. API exits before readiness;
4. worker exits immediately;
5. frontend is slow;
6. port already occupied by a verified app-owned orphan;
7. port occupied by an unrelated process that must never be terminated;
8. port occupied by a process whose ownership cannot be verified;
9. user declines conflict cleanup;
10. user confirms cleanup and startup retries successfully;
11. conflicting process exits between detection and confirmation;
12. PID identity changes/reuse is detected before termination;
13. repeated conflict reaches the bounded retry limit;
14. process hangs during shutdown;
15. service spawns grandchildren;
16. app closes during startup;
17. app crashes while children are running;
18. restart immediately after crash;
19. log path unavailable;
20. malformed runtime;
21. invalid encryption key state;
22. a critical child exits during normal use.

### 7.4 Compatibility result format

Each implementation should emit a machine-readable result:

```json
{
  "implementation": "go",
  "suite": "supervisor-contract-v1",
  "passed": 128,
  "failed": 0,
  "durationMs": 12345
}
```

### Exit criteria

A component cannot replace the current implementation until it passes the shared contract and chaos suites.

---

## 8. Workstream 3 — Add a permanent performance harness

### Purpose

Prevent optimizations from being based on intuition.

### 8.1 Benchmark scenarios

Create repeatable scenarios for:

#### Startup

- cold OS-cache startup where practical;
- warm startup;
- UI visible;
- frontend usable;
- database ready;
- API ready;
- worker ready.

#### Idle

Measure after stabilization at 1, 5, 15, and 30 minutes:

- process count;
- private bytes;
- working set;
- CPU;
- handles;
- threads.

#### Workloads

- ingest small text file;
- ingest large text file;
- ingest text PDF;
- ingest OCR-heavy PDF;
- create embeddings;
- run search;
- perform representative RAG question;
- create podcast if relevant to deployed use;
- repeated ingest/delete cycle.

#### Long-session stability

Run representative work for several hours in an automated soak test and observe:

- memory trend;
- handle trend;
- process count;
- failed jobs;
- orphaned children.

### 8.2 Benchmark output

Store every run in a schema such as:

```json
{
  "build": "...",
  "host": "electron-js",
  "featureSet": ["docling"],
  "metrics": {
    "installerBytes": 0,
    "idlePrivateBytes": 0,
    "startupToInteractiveMs": 0
  }
}
```

### 8.3 Required performance gates

Example initial policy:

- no new orphan processes;
- no security-test regressions;
- no RAG correctness regression;
- no significant ingestion throughput regression without an explicit tradeoff decision;
- startup should not regress materially;
- idle memory should improve for a resource-reduction migration;
- packaged size should improve for a packaging-reduction migration.

Do not lock arbitrary percentages until baseline variance is known. First measure natural run-to-run noise, then set thresholds outside that noise band.

---

# PART II — HIGH-VALUE REDUCTIONS THAT DO NOT REQUIRE A LARGE REWRITE

## 9. Workstream 4 — Produce a dependency and size inventory

### Purpose

Before rewriting code, identify what actually consumes disk and memory.

### Step-by-step

#### 4.1 Generate directory size reports

Break down:

```text
resources/runtime/python
resources/runtime/python/.../site-packages
resources/runtime/backend
resources/runtime/frontend
resources/runtime/node
resources/runtime/surreal
resources/runtime/tiktoken-cache
Electron runtime/package
```

#### 4.2 Generate a Python package size report

Sort installed packages by bytes and group transitive families.

Pay special attention to:

- Docling;
- OCR/image libraries;
- Torch or similar ML frameworks if present;
- scientific packages;
- optional provider SDKs;
- unused extras.

#### 4.3 Generate a frontend dependency report

Identify which packages are needed at:

- build time only;
- browser runtime;
- Node server runtime.

#### 4.4 Record imports during representative Python workloads

This reveals installed packages that never load in the deployed workflows.

#### 4.5 Produce an allowlist for packaged components

Shift from "copy everything that the build produced" toward an explicit package/runtime manifest where feasible.

### Exit criteria

The team can answer exactly which components dominate installer size and idle memory.

---

## 10. Workstream 5 — Make Docling optional or demand-loaded

### Why this is high priority

The wrapper explicitly installs `content-core[docling]` and sets:

```text
OPEN_NOTEBOOK_ENABLE_DOCLING=true
```

This means every installation pays the disk cost of the advanced extraction stack whether or not a user needs it.

### Recommended design

Separate the product into:

```text
Core application
    |
    +-- standard ingestion capabilities
    |
    +-- optional Advanced Document Extraction component
            |
            +-- Docling/OCR dependencies
```

### Step-by-step

#### 5.1 Establish actual Docling use cases

Run a representative corpus through the existing pipeline and classify documents as:

- handled well without Docling;
- materially improved by Docling;
- dependent on OCR/advanced extraction.

#### 5.2 Measure the Docling dependency footprint

Record:

- installer contribution;
- installed bytes;
- Python import time;
- memory after import;
- peak extraction memory.

#### 5.3 Add an explicit feature flag

The runtime should support both:

```text
OPEN_NOTEBOOK_ENABLE_DOCLING=false
OPEN_NOTEBOOK_ENABLE_DOCLING=true
```

without requiring code changes.

#### 5.4 Build a core-only runtime variant

Do not install the Docling extra.

#### 5.5 Verify standard workflows

Run all non-Docling ingestion, search, RAG, and UI tests.

#### 5.6 Design optional installation

Possible strategies, in preferred order:

1. installer feature/component;
2. downloadable first-use feature pack;
3. separately installed local worker environment;
4. separate companion package.

The best choice depends on offline-installation requirements.

#### 5.7 Consider process isolation

A very effective memory design is:

```text
main Python API
    |
    +-- spawn Docling extraction process only for a Docling job
            |
            +-- extract
            +-- return structured output
            +-- exit
```

When the process exits, the OS reclaims all memory held by the extraction stack.

#### 5.8 Add golden-corpus comparison tests

For a curated set of PDFs/documents compare:

- extracted text;
- page count;
- metadata;
- ordering;
- OCR quality;
- downstream chunk count;
- downstream retrieval quality.

### Exit criteria

- Core installs do not require Docling unless policy requires it.
- Advanced extraction remains available and testable.
- The RAG corpus demonstrates no unacceptable regression.

---

## 11. Workstream 6 — Reduce Python idle cost before rewriting Python

### 11.1 Profile Python startup/imports

Measure:

- module import time;
- memory after imports;
- modules loaded by the API;
- modules loaded by the worker;
- overlap between the two processes.

### 11.2 Lazy-load heavy optional modules

Where upstream architecture permits, avoid importing heavyweight functionality until the route/job actually needs it.

Do this only when import-order behavior and thread safety are understood.

### 11.3 Evaluate worker concurrency

`--max-tasks 5` caps concurrent work, not lifetime. Test whether the deployed machine and workload genuinely benefit from five concurrent tasks.

Benchmark:

```text
1 task
2 tasks
3 tasks
5 tasks
```

For each, record:

- throughput;
- peak memory;
- latency;
- failure rate;
- user-perceived responsiveness.

The correct desktop default may be lower than the current value.

### 11.4 Evaluate an on-demand worker

Current model:

```text
app starts
  -> worker starts
  -> worker remains resident until app closes
```

Candidate model:

```text
app starts
  -> no worker
job appears
  -> supervisor starts worker
worker processes work
idle timeout / queue empty
  -> worker exits
```

#### Implementation experiment

1. identify how jobs are enqueued;
2. determine whether the native host or API can detect pending work safely;
3. start the unmodified Python worker when work appears;
4. allow the worker to drain work;
5. exit it after a controlled idle condition;
6. restart automatically for new work;
7. preserve retries and error state;
8. stress concurrent submissions.

This retains Python behavior while eliminating idle worker cost.

### 11.5 Evaluate one Python host only as a separate experiment

Another possibility is combining API and worker tasks in one Python process.

Potential advantage:

- shared interpreter;
- shared imported modules;
- lower baseline RSS.

Potential disadvantages:

- weaker failure isolation;
- long-running extraction can affect API responsiveness;
- memory retained by one workload stays in the API process;
- lifecycle becomes more coupled.

Because process isolation is valuable for desktop stability, this should be compared empirically against an on-demand worker rather than assumed to be better.

### Exit criteria

Choose the Python process topology based on measured idle memory, peak memory, reliability, and responsiveness.

---

# PART III — NATIVE DESKTOP HOST OPTIONS

## 12. Workstream 7 — Define the native-host contract before selecting a language

Any native host must provide the same platform responsibilities regardless of implementation language.

### Required host capabilities

1. Create and manage the application window.
2. Use the system WebView on Windows where possible.
3. Restrict in-app navigation to the local app origin/content.
4. Open approved external `http`/`https` links in the system browser.
5. Locate the packaged runtime safely.
6. Verify required runtime components.
7. Manage data and log directories.
8. Obtain or generate the application encryption key.
9. Start SurrealDB.
10. Start the Python API.
11. Start the worker according to the selected policy.
12. Capture stdout/stderr.
13. Perform readiness/liveness checks.
14. Report startup errors with useful context.
15. Detect critical child exits.
16. Terminate the complete child process tree.
17. Prevent orphan services after host failure.
18. Eventually serve static frontend assets.
19. Eventually reverse-proxy `/api/*`.
20. Eventually forward SSE without buffering.
21. Detect startup port conflicts and identify the owning process.
22. Classify whether a conflicting process is verified app-owned, unrelated, or unverifiable.
23. Present an explicit user-confirmation flow before terminating any verified app-owned conflict.
24. Refuse to terminate unrelated or unverifiable processes.
25. Retry startup only through a bounded policy after successful cleanup.
26. Expose diagnostics needed by support/testing.

### Stable host configuration schema

Create a versioned schema rather than hard-code everything into one implementation.

Example conceptual structure:

```text
HostConfig v1
- frontend
- ports
- paths
- services
- timeouts
- environment
- optionalFeatures
- logging
- portConflictPolicy
- startupRetryPolicy
```

This makes prototype comparison substantially easier.

---

## 13. Workstream 8A — Rust/Tauri host prototype

### Appropriate role

Rust is a strong choice for:

- native host;
- supervisor;
- static server;
- reverse proxy;
- runtime verification;
- installer/bootstrap utilities;
- high-confidence native leaf libraries.

### Step-by-step

#### 8A.1 Scaffold a minimal Tauri application

Do not port logic yet. Prove:

- application launches;
- WebView renders a local test page;
- development and release builds succeed on supported Windows versions.

#### 8A.2 Reproduce the current window security policy

Implement and test:

- local content/origin allowlist;
- denial of unexpected navigation;
- external `http`/`https` handoff;
- denial of unsafe schemes.

Use the same fixtures as the TypeScript policy tests.

#### 8A.3 Implement runtime-path resolution

Port the runtime discovery contract and test against shared fixtures.

#### 8A.4 Implement runtime verification

Verify:

- required executable presence;
- manifest consistency;
- configured optional components;
- readable/writable data locations.

#### 8A.5 Implement process launch only

Initially launch the exact same four services as today. Do not combine migrations.

#### 8A.6 Add readiness checks

Match current behavior for:

- port-based readiness;
- portless-worker liveness settle period;
- startup timeouts;
- early exits;
- log-tail error reporting.

#### 8A.6A Implement the shared port-conflict recovery contract

Reproduce Workstream 15A behavior before the Rust host is considered feature-complete: identify the listener, verify ownership, show the user exactly what is affected, require confirmation, terminate only verified app-owned conflicts, revalidate identity immediately before termination, and retry startup through the same bounded policy. Prefer Windows APIs over shell parsing in the mature native implementation.

#### 8A.7 Add Windows Job Object containment

All child processes should be assigned to a Job Object configured so host termination reliably tears down the service tree.

Test both:

- graceful host close;
- forced host termination.

#### 8A.8 Add structured logging

Preserve human-readable logs while optionally recording structured events for diagnostics.

#### 8A.9 Run the complete supervisor contract suite

The Rust host must pass all startup/shutdown/chaos cases before replacing Electron in a release build.

#### 8A.10 Benchmark against Electron

Compare:

- installed bytes;
- process count;
- idle memory;
- startup time;
- shutdown correctness.

### Do not port yet

Do not make the Rust host simultaneously replace:

- FastAPI;
- the Python worker logic;
- LangGraph workflows;
- Docling;
- the React UI.

That would destroy the ability to identify which change caused a regression.

---

## 14. Workstream 8B — Go/Wails host prototype

### Why prototype Go

Go maps cleanly to the orchestration problem:

- processes;
- HTTP;
- reverse proxying;
- static assets;
- concurrent readiness checks;
- diagnostics;
- a single native executable.

Wails provides a native desktop/WebView model while preserving a web frontend.

### Step-by-step

#### 8B.1 Scaffold Wails with the existing React concept

Use a minimal placeholder frontend first.

#### 8B.2 Implement host security/navigation behavior

Use the shared policy fixtures.

#### 8B.3 Implement runtime discovery and verification

Use the same contract corpus as TypeScript/Rust.

#### 8B.4 Implement process supervision

Model each service as a typed structure with:

- executable;
- args;
- cwd;
- environment;
- readiness policy;
- criticality;
- timeout.

#### 8B.4A Implement the shared port-conflict recovery contract

Match Workstream 15A, including verified ownership, explicit confirmation, identity revalidation, unrelated-process protection, and bounded retry. Keep OS-specific process inspection behind an adapter so the contract is testable without actually killing arbitrary processes.

#### 8B.5 Add Windows Job Object support

Use Windows-native process containment rather than relying only on killing a root PID.

#### 8B.6 Add HTTP/static capabilities behind flags

Even while the existing Node server remains, prototype:

- static file serving;
- reverse proxy;
- streaming/SSE proxy.

#### 8B.7 Run Go race detection

Exercise the supervision and logging tests under Go's race detector.

#### 8B.8 Run shared chaos tests

Verify no deadlocks, orphan children, leaked goroutines, or shutdown races.

#### 8B.9 Benchmark against Rust and Electron

Use identical hardware and test scenarios.

### Selection value

Go should be judged on measured behavior and maintenance simplicity, not on abstract benchmark reputation.

---

## 15. Workstream 8C — C#/.NET + WinUI/WebView2 host prototype

### Why prototype C#

For a Windows-first application, C# has excellent access to:

- WebView2;
- process APIs;
- Job Objects through native interop when needed;
- Windows paths and known folders;
- Windows security facilities;
- native installer/deployment ecosystems;
- eventing and diagnostics.

### Step-by-step

#### 8C.1 Scaffold a WinUI desktop application

Prove supported Windows versions and packaging behavior.

#### 8C.2 Host the existing web frontend with WebView2

Initially point it at the current frontend URL to minimize variables.

#### 8C.3 Implement navigation policy

Use the shared policy fixtures and explicit URI parsing.

#### 8C.4 Implement runtime resolution/verification

Use the language-neutral fixtures.

#### 8C.5 Implement child process supervision

Include stdout/stderr capture, startup timeouts, and critical-exit reporting.

#### 8C.6 Implement Windows Job Object containment

Before finalizing containment, implement the shared Workstream 15A port-conflict recovery contract using Windows process/network APIs where practical. The C# host must preserve the same explicit-confirmation, ownership-verification, identity-revalidation, and bounded-retry rules as the interim Electron implementation.

Set kill-on-job-close semantics and prove them in chaos tests.

#### 8C.7 Add static/proxy experiments

Implement equivalents of the future Node-removal functionality.

#### 8C.8 Compare deployment modes

Measure conventional framework-dependent/self-contained/trimming/AOT-compatible options as applicable. Do not require NativeAOT unless the actual host design is compatible and it wins measured benchmarks.

#### 8C.9 Benchmark against Go/Rust/Electron

The Windows integration advantage must be weighed against binary/runtime footprint and maintenance characteristics.

---

## 16. Native host selection matrix

Do not decide solely from personal language preference. Score actual prototypes.

Suggested categories:

| Category | Weight | Rust/Tauri | Go/Wails | C#/WinUI |
|---|---:|---:|---:|---:|
| Idle memory | High | Measure | Measure | Measure |
| Installed size | High | Measure | Measure | Measure |
| Startup | High | Measure | Measure | Measure |
| Process containment | High | Test | Test | Test |
| WebView behavior | High | Test | Test | Test |
| HTTP/SSE correctness | High | Test | Test | Test |
| Security auditability | High | Review | Review | Review |
| Build complexity | Medium | Measure | Measure | Measure |
| Developer maintainability | High | Assess | Assess | Assess |
| Windows integration | Medium/High | Assess | Assess | Assess |
| Cross-platform optionality | Medium | Assess | Assess | Assess |
| CI reproducibility | High | Test | Test | Test |
| Dependency risk | High | Audit | Audit | Audit |

A prototype that is 5 MB smaller but substantially harder for the team to maintain may not be the best product decision.

---

# PART IV — REMOVE NODE AND ELECTRON SAFELY

## 17. Workstream 9 — Inventory Next.js server dependencies

### Goal

Determine whether the desktop frontend can become a static/client application without changing user-facing behavior.

### Step-by-step

#### 9.1 Classify all frontend routes/components

For each route, identify use of:

- server components;
- server actions;
- Next route handlers;
- middleware;
- rewrites;
- dynamic server rendering;
- filesystem-dependent server behavior;
- server-only environment variables.

#### 9.2 Identify desktop-specific server responsibilities

Likely responsibilities include:

- serving frontend assets;
- SPA/page routing;
- proxying `/api/*` to FastAPI;
- handling streaming/SSE routes correctly.

#### 9.3 Separate UI dependencies from Next server dependencies

The target is to preserve as much as possible of:

- React components;
- TypeScript models;
- Tailwind/styles;
- Zustand state;
- TanStack Query;
- forms;
- localization;
- Markdown rendering;
- browser-side API modules.

#### 9.4 Build a route-compatibility map

Example:

| Existing route | New browser route | Static fallback needed | API dependency | Streaming |
|---|---|---|---|---|
| `/` | `/` | Yes | Maybe | No |
| `/notebooks/:id` | same | Yes | Yes | Maybe |

#### 9.5 Identify blocking Next features

Any feature that genuinely requires a Next server should be listed explicitly rather than discovered after Node removal.

### Exit criteria

A documented migration map proves whether a static React build is feasible and identifies the exact exceptions.

---

## 18. Workstream 10 — Create a static/client frontend build

### Preferred strategy

Preserve React and TypeScript while replacing the server dependency.

A common implementation would use a static Vite-style build, but the tooling decision should follow compatibility testing.

### Step-by-step

#### 10.1 Create a parallel frontend build target

Do not delete the existing Next build.

Example conceptual scripts:

```text
frontend:next
frontend:static
```

#### 10.2 Port routing

Use client-side routing compatible with the existing URL structure where practical.

#### 10.3 Replace server-only environment access

Move required desktop configuration to:

- build-time constants only when truly static; or
- a runtime `/config` endpoint served by the native host.

Avoid embedding secrets into browser assets.

#### 10.4 Redirect API calls to the native-host proxy

The browser should continue to use a stable same-origin path such as:

```text
/api/...
```

rather than learning internal FastAPI ports directly.

#### 10.5 Implement SPA fallback

Unknown browser routes should return `index.html` when they are application routes, not API/static-resource misses.

#### 10.6 Validate streaming behavior

SSE/event streams must be tested for:

- no buffering;
- timely event delivery;
- cancellation when the UI disconnects;
- correct headers;
- connection cleanup.

#### 10.7 Run UI regression testing

At minimum cover:

- launch;
- notebook navigation;
- source upload;
- source processing status;
- search;
- RAG chat;
- settings;
- provider configuration;
- streaming responses;
- failure dialogs.

### Exit criteria

The static/client build passes the same functional suite as the current Next standalone desktop build.

---

## 19. Workstream 11 — Move frontend serving and API proxying into the native host — NON-LOCAL-LLM EXECUTION

> **Execution boundary:** This workstream is one of the two explicit exceptions to the Qwen3.5-9B local-LLM execution policy. Do not use the local model to author or approve its production implementation. Enter this workstream only with the Section LLM-G handoff bundle, and return the documented handoff before local execution resumes.

### Desired host HTTP surface

Conceptually:

```text
127.0.0.1:<frontend-port>

GET /assets/*       -> packaged static assets
GET /api/*          -> proxy to Python API
GET /streaming/*    -> streaming/SSE proxy
GET /*              -> SPA index fallback
```

### Step-by-step

#### 11.1 Implement static asset serving

Requirements:

- correct MIME types;
- cache policy for hashed assets;
- no directory traversal;
- no access outside packaged frontend root;
- deterministic 404 behavior.

#### 11.2 Implement reverse proxy

Preserve:

- method;
- query string;
- headers where safe;
- request body streaming;
- response status;
- response headers;
- body streaming;
- cancellation.

#### 11.3 Restrict upstream target

The proxy must only target the expected loopback API endpoint. Do not create a generic open proxy.

#### 11.4 Implement SSE pass-through tests

Use a synthetic test server that emits known event timing and content. Verify the client receives events incrementally rather than at response completion.

#### 11.5 Add request limits and timeouts deliberately

Avoid accidental differences from current behavior, especially for large file uploads and long-running model operations.

#### 11.6 Run differential API smoke tests

Send the same request through:

- current Next proxy;
- candidate native proxy.

Compare relevant status/headers/body behavior.

### Exit criteria

The native host can fully replace the desktop responsibilities of the Next server.

---

## 20. Workstream 12 — Remove bundled Node.js — NON-LOCAL-LLM EXECUTION

> **Execution boundary:** This workstream is the second explicit exception to the Qwen3.5-9B local-LLM execution policy. Do not use the local model to author or approve the production Node-removal changes. Local execution resumes only after the non-local handoff records clean-machine validation, test evidence, benchmark deltas, and rollback instructions.

Only perform this step after Workstreams 9–11 pass.

### Step-by-step

1. Add a build option that omits `resources/runtime/node`.
2. Stop generating/copying the Next standalone server for the native build.
3. Package only static frontend assets.
4. Remove the frontend service from the service table/native service configuration.
5. Make the native host own the frontend port/content.
6. Run all unit/integration/security/RAG tests.
7. Run fresh-install tests on a machine without developer Node.js installed.
8. Confirm no runtime code shells out to `node` or `npm`.
9. Measure installer and installed-size reduction.
10. Preserve the old Node build as a rollback variant until release confidence is established.

### Exit criteria

The application runs on a clean supported Windows machine without any bundled or system Node dependency.

---

## 21. Workstream 13 — Remove Electron

This may occur before Node removal if the selected native host initially loads the existing Next server. That is a valid low-risk sequencing choice.

### Step-by-step

1. Build the selected native host around the existing service model.
2. Reproduce window/navigation/security behavior.
3. Reproduce startup error presentation.
4. Reproduce external-link behavior.
5. Reproduce application-close semantics.
6. Use Windows Job Object containment.
7. Exercise forced-crash/restart tests.
8. Verify data directories and upgrade paths.
9. Build a native installer variant.
10. Test installation on a clean VM.
11. Test uninstall/reinstall while preserving or deliberately removing user data according to policy.
12. Measure footprint/startup/memory.
13. Remove Electron dependencies only after the native build passes acceptance gates.

### Exit criteria

The release no longer packages Electron/Chromium and preserves the user-visible desktop behavior.

---

# PART V — PROCESS SUPERVISION AND WINDOWS INTEGRATION

## 22. Workstream 14 — Replace PID-tree cleanup with OS-owned process containment

### Current risk

The JS supervisor tracks PIDs and invokes `taskkill /PID <pid> /T /F` on Windows. This is careful, but the native host can use stronger OS ownership semantics.

### Target design

Create a Windows Job Object and assign all owned services to it.

Conceptually:

```text
Native host
   |
   +-- Job Object (kill on close)
          |
          +-- surreal.exe
          +-- python API
          +-- python worker
          +-- optional extraction subprocesses
```

### Step-by-step

1. Create Job Object at host startup.
2. Configure kill-on-job-close behavior.
3. Launch child process suspended if needed for reliable assignment.
4. Assign child to job before allowing normal execution.
5. Capture stdout/stderr through pipes.
6. Track individual service status for diagnostics.
7. On graceful shutdown, ask services to stop where supported.
8. Enforce a bounded graceful period.
9. Close/terminate remaining children through the job.
10. Verify no owned ports remain bound.
11. Force-kill the host in a test and confirm children die automatically.
12. Start the application immediately afterward and verify database locks/ports are clear.

### Exit criteria

No orphaned app-owned service can survive normal or forced host termination in supported scenarios.

Job Object containment should make port conflicts caused by *future* host crashes much rarer, but the interactive resolver remains necessary for stale processes from older builds, manually launched services, upgrade edge cases, or another app instance.

---

## 23. Workstream 15 — Improve readiness and health semantics

A TCP port being open is not always equivalent to a healthy service.

### Step-by-step

#### 15.1 Define readiness per service

- SurrealDB: connection/auth/basic query if practical.
- API: dedicated health route or known safe endpoint.
- Worker: explicit ready signal if upstream allows it; otherwise process liveness plus queue interaction test.

#### 15.2 Separate readiness from ongoing health

Startup readiness answers "can the app proceed?"

Health monitoring answers "did a critical service fail after startup?"

#### 15.3 Avoid noisy polling

Use event-driven process exit detection and conservative health intervals.

#### 15.4 Preserve useful error context

A startup failure should include:

- service name;
- command category, without exposing secrets;
- exit code;
- readiness timeout;
- recent log tail;
- runtime verification result;
- relevant port conflict information.

---

## 23A. Workstream 15A — Interactive port-conflict detection and safe recovery

### Problem

The application currently has a dead-end startup failure when one of its required local ports is already occupied. The initial conflict set is:

```text
8000
5055
8502
```

These conflicts are commonly caused by orphaned Open Notebook services after a crash or force-kill, but the listener may also belong to an unrelated application. The recovery feature must therefore solve two problems at once: recover automatically from *verified app-owned* stale processes and protect unrelated user processes from accidental termination.

### User-facing behavior

When a required port is blocked:

1. detect the listener PID for each blocked port;
2. inspect and identify the process;
3. classify the process as `app-owned`, `unrelated`, or `unverified`;
4. show the user the port, process name, PID, executable path when available, and classification;
5. offer **Kill conflicting app processes and retry** only when every process selected for termination is verified app-owned;
6. require explicit confirmation before termination;
7. revalidate process identity and port ownership immediately before killing;
8. terminate the verified app-owned process tree;
9. confirm the ports are free;
10. retry startup;
11. stop after a bounded retry count, initially **2 attempts**, and surface diagnostics rather than loop forever.

If the port belongs to an unrelated or unverifiable process, the app must **not** kill it. The dialog should clearly explain that the user must close/reconfigure that process or exit the app.

### 15A.1 Define language-neutral data contracts first

Create serializable structures equivalent to:

```text
PortConflict
- port
- pid
- processName
- executablePath?
- commandLine?
- processStartTime?
- ownership: app-owned | unrelated | unverified
- ownershipEvidence[]

PortConflictResolutionResult
- conflicts[]
- terminated[]
- skipped[]
- portsFreed[]
- retryAllowed
- retryAttempt
```

Do not make UI text or platform command output the contract. The JS, Rust, Go, and C# implementations should all map platform-specific process information into the same conceptual structure.

### 15A.2 Add the interim JS module

Create:

```text
scripts/lib/port-conflict.js
```

Initial responsibilities:

- `findProcessOnPort(port)` — locate the listener PID; the proposal uses `netstat -ano` on Windows and `lsof -i` on POSIX;
- `getProcessInfo(pid)` — collect process identity details;
- `classifyProcessOwnership(processInfo, runtimePaths)` — determine whether the process is safely app-owned;
- `killProcess(pid)` — delegate process-tree termination to the existing supervisor only after safety validation;
- `resolvePortConflicts(ports)` — inspect all required ports and return structured conflict information;
- `formatConflictMessage(conflicts)` — produce human-readable dialog content;
- `revalidateConflict(conflict)` — verify that the same process still owns the same port immediately before termination.

**Integration refinement:** the proposal names `tasklist` for Windows process information. `tasklist` is useful for basic identity, but the safety decision requires a trustworthy executable path and ideally process start time/command line. During the interim JS implementation, use a Windows mechanism that can actually retrieve the required metadata (for example, PowerShell/CIM where available) and treat missing/ambiguous metadata as `unverified`. The eventual native host should prefer documented Windows APIs rather than shell-text parsing.

### 15A.3 Define strict app-ownership rules

Never terminate a process merely because:

- it owns one of the expected ports;
- its executable is named `python.exe`;
- its executable is named `node.exe`;
- its executable is named `surreal.exe`;
- its PID was previously recorded.

A process may be classified as `app-owned` only when there is strong evidence such as:

- executable path is under the installed application's verified runtime directory; and
- executable/service identity matches an expected runtime component; or
- command-line path points at the verified application runtime/source path and matches the expected service definition.

For generic executables such as Python and Node, the path/command association is mandatory. A same-named executable elsewhere on the machine is unrelated.

Where feasible, include process start time or an OS process handle in the identity snapshot. Before termination, re-query the process and port and confirm the identity has not changed. This mitigates PID reuse/time-of-check-to-time-of-use errors.

### 15A.4 Modify `scripts/start-services.js`

When the existing port preflight fails:

1. call the resolver rather than immediately throwing a generic startup failure;
2. attach structured details as `err.portConflicts`;
3. export a `checkPortsWithResolution`-style function whose confirmation callback is supplied by the host/UI layer;
4. keep detection/classification separate from termination so it is easy to unit test;
5. after termination, verify the ports are actually free before allowing a retry.

The service launcher must remain usable headlessly. In non-interactive contexts, default to **report-only / no kill** unless an explicit test-only or administrative policy says otherwise.

### 15A.5 Modify the Electron `main.js` flow

Until Electron is retired:

1. catch the structured port-conflict error separately;
2. render conflict details with `dialog.showMessageBox`;
3. when all selected conflicts are verified app-owned, provide:
   - **Kill conflicting app processes and retry**;
   - **Exit**;
4. when any blocking process is unrelated or unverified, do not present an unsafe kill action; show identification details and an exit/manual-resolution path instead;
5. if the user confirms, revalidate identity, terminate the app-owned process trees, confirm ports are free, and call `startServices` again;
6. cap automatic retry at two attempts;
7. include the final conflict data in the existing problem-report/startup-error path.

### 15A.6 Add `scripts/test/port-conflict.test.js`

Required tests from the feature proposal:

- `findProcessOnPort` using a real local listener;
- `getProcessInfo` against the current test process;
- `resolvePortConflicts` with a mixture of free and busy ports;
- `formatConflictMessage` output;
- mock-based dialog/retry-flow tests.

Add safety/adversarial coverage:

- known app-owned runtime process is eligible for user-confirmed cleanup;
- unrelated `python.exe`/`node.exe` is classified as unrelated and never killed;
- same executable name at the wrong path is never killed;
- missing executable path/metadata becomes `unverified`;
- user chooses **Exit** and no termination occurs;
- process exits before confirmation;
- port changes owner before termination;
- PID identity/start-time mismatch aborts termination;
- cleanup succeeds and startup retry occurs once;
- cleanup fails and no infinite retry occurs;
- maximum two retry attempts are enforced;
- no shell-argument injection is possible through process/path metadata used by inspection helpers.

Prefer tests that launch a harmless purpose-built listener fixture instead of killing arbitrary host-machine processes. CI must never depend on terminating unrelated machine services.

### 15A.7 Update project wiring and documentation

Modify:

```text
package.json
README.md
```

- add `port-conflict.test.js` to the test command or test discovery path;
- document automatic recovery in Troubleshooting;
- explicitly document that only verified app-owned processes can be terminated and that confirmation is always required;
- explain what users should do when another application legitimately owns one of the ports.

### 15A.8 Add diagnostics without leaking sensitive data

Problem reports may include:

- blocked port;
- PID;
- process name;
- ownership classification;
- whether cleanup was offered/accepted/succeeded;
- retry count.

Executable paths and command lines may contain usernames, directory names, tokens, or arguments. Apply the same redaction policy used for other diagnostics before persisting or copying them into support reports.

### 15A.9 Make the feature part of the native-host contract

The interim JS implementation is not disposable. Its fixtures and behavior become the compatibility target for Rust/Tauri, Go/Wails, or C#/WinUI. Native implementations should replace shell-command parsing with platform APIs where practical while keeping the same user-visible safety policy.

Windows Job Object containment from Workstream 14 remains the primary prevention mechanism for new orphaned services. The resolver is the recovery layer for conflicts that containment cannot prevent, including stale processes from older releases, another application instance, manually launched services, or unrelated software.

### 15A.10 Acceptance gates

The feature is complete only when all of the following are true:

- app-owned orphan conflict is correctly identified;
- the dialog identifies exactly what is proposed for termination;
- no process is killed without user confirmation;
- unrelated and unverifiable processes are never killed;
- process identity is revalidated immediately before termination;
- successful cleanup frees the blocked ports;
- startup retry succeeds when the conflict was the only blocker;
- retry is bounded and cannot loop indefinitely;
- diagnostic information is useful and appropriately redacted;
- Windows tests pass;
- POSIX support, if maintained, follows the same safety contract;
- all existing supervisor/security/chaos tests continue to pass.

### 15A.11 Rollback

Keep the resolver behind an engineering feature flag during initial rollout, for example:

```text
ONB_PORT_CONFLICT_RESOLUTION=report-only
ONB_PORT_CONFLICT_RESOLUTION=interactive
```

`report-only` should detect and display conflicts but never terminate a process. If the interactive implementation produces unexpected behavior, a release can fall back to report-only without reverting the broader supervisor work.

---

# PART VI — INSTALLER, PACKAGING, AND UPDATE EFFICIENCY

## 24. Workstream 16 — Modularize runtime packaging

### Goal

Stop thinking of the runtime as one indivisible directory.

### Suggested component model

```text
core-host
frontend-assets
python-core
python-backend
surrealdb
tiktoken-assets
advanced-extraction-docling
optional-provider-assets
```

### Step-by-step

1. Generate a manifest for every component.
2. Record version and SHA-256 hashes.
3. Define required vs optional dependencies.
4. Have installer/build tooling compose a feature set from components.
5. Verify component hashes before first run or installation completion.
6. Report missing/corrupt optional components separately from corrupt required components.
7. Make support reports include the installed component set.

### Benefits

- smaller base installer;
- optional advanced features;
- easier updates;
- easier auditing;
- clearer source of disk growth;
- easier reproducibility.

---

## 25. Workstream 17 — Installer experiments

Do not assume the existing NSIS approach must be discarded. Compare alternatives based on functionality and artifact size.

### Required installer behaviors

- per-machine/per-user choice as product policy requires;
- correct application data handling;
- clean upgrades;
- optional component support;
- uninstall behavior;
- digital signature support;
- WebView2 provisioning policy if required;
- offline install policy;
- deterministic file inventory;
- hash verification.

### Test matrix

- clean install;
- upgrade from current Electron release;
- repair/reinstall;
- uninstall;
- install without internet;
- install as non-admin where supported;
- paths with spaces;
- long user profile path;
- missing WebView2 scenario if applicable;
- corrupt installer/component;
- interrupted installation.

---

# PART VII — PYTHON OPTIMIZATION AND SELECTIVE NATIVE MODULES

## 26. Workstream 18 — Profile the remaining Python runtime after host cleanup

Do this **after** Node/Electron/Docling improvements whenever possible. Otherwise time may be spent optimizing a component that is not the final bottleneck.

### Profile dimensions

- import time;
- idle RSS/private bytes;
- heap growth across repeated jobs;
- allocation hotspots;
- CPU hotspots;
- time waiting on HTTP/model providers;
- database waits;
- serialization cost;
- tokenization cost;
- extraction cost;
- large-object lifetimes.

### Classify each hotspot

Every hotspot should be labeled:

```text
CPU-bound
memory-allocation-bound
I/O-bound
network/model-bound
database-bound
startup/import-bound
```

Only CPU/allocation-heavy local code is a strong candidate for a native rewrite.

---

## 27. Workstream 19 — Cython for narrow Python CPU hotspots

### When to use

Use Cython when:

- the code is already naturally Python-facing;
- the function is CPU-bound;
- the public Python API should remain stable;
- converting an entire subsystem would be excessive.

### Good candidates

Only after profiling, possibly:

- tight normalization loops;
- scoring loops;
- parsing loops;
- chunk transforms;
- numerical operations not already delegated to native libraries.

### Bad candidates

Do not use Cython simply around code that mainly waits on:

- HTTP;
- LLM inference;
- filesystem;
- database calls.

### Step-by-step

1. capture a representative benchmark;
2. freeze input/output behavior with fixtures;
3. add property tests;
4. implement Cython version behind a feature flag;
5. compare output;
6. profile again;
7. package the compiled extension into the bundled Python environment;
8. test on a clean machine;
9. keep Python fallback until confidence is high.

---

## 28. Workstream 20 — Rust native Python extensions for selected leaf functions

Rust can also be used through a Python extension boundary, for example via PyO3-style tooling.

### Appropriate target characteristics

- clear, narrow input/output contract;
- CPU or allocation intensive;
- minimal dependency on Python object graphs;
- high test coverage;
- deterministic behavior;
- worth the extra build complexity.

### Step-by-step

1. define JSON-like or typed boundary;
2. create golden fixtures from the Python implementation;
3. build native implementation;
4. expose it as a Python extension;
5. run differential tests;
6. benchmark real workloads;
7. fuzz malformed/edge inputs;
8. package per supported architecture;
9. retain Python fallback during rollout.

### Avoid

Do not use a Rust extension merely to wrap network requests or orchestration code. The FFI/build cost would outweigh the benefit.

---

## 29. Workstream 21 — C/C++ only for established native-library use cases

C/C++ can be appropriate for a very small, performance-critical leaf component, but it carries additional memory-safety and ABI risk.

### Accept only when

- a mature library already exists and is clearly superior;
- the API surface can be tiny;
- fuzzing and sanitizers are practical;
- the function is isolated from application state.

### Required audit controls

- AddressSanitizer/UndefinedBehaviorSanitizer in CI where available;
- fuzz tests;
- strict boundary validation;
- no direct access to secrets or broad filesystem state unless essential;
- versioned ABI/API wrapper;
- clean crash containment where possible.

C++ should not become the general replacement language for the desktop wrapper.

---

## 30. Workstream 22 — Go or C# native helper utilities

Even if the desktop host is written in another language, a helper executable may make sense when it has a standalone contract.

Potential examples:

- updater;
- installer bootstrapper;
- diagnostics collector;
- offline component installer;
- runtime verifier.

Avoid proliferating helper executables unless they materially improve isolation or lifecycle behavior. One native host is preferable to a collection of tiny processes with overlapping responsibility.

---

# PART VIII — PYTHON WORKER AND BACKEND: WHAT NOT TO REWRITE EARLY

## 31. Workstream 23 — Treat the Python worker as a late migration candidate

### Important architectural correction

The existing `docs/rust-conversion-plan.md` ranks the background worker as the first Rust target. That ranking should be revised.

The worker executable/loop itself is not the majority of the functionality it executes. Its command handlers call into the Python application ecosystem: ingestion workflows, model/provider infrastructure, transformations, podcast generation, and related upstream code.

Therefore replacing the worker daemon with Rust/Go/C# while keeping feature parity can quickly become a rewrite of the Python application engine rather than a small queue consumer.

### Safer alternatives first

1. lower concurrency if benchmarks justify it;
2. lazy imports;
3. on-demand worker process;
4. job-specific subprocesses;
5. isolate heavyweight extraction;
6. improve worker shutdown/restart;
7. profile memory retention between jobs.

### When a native worker becomes reasonable

Only reconsider after documenting that individual job handlers can be represented as stable external contracts without reimplementing the application graph.

A possible hybrid future design is:

```text
Native scheduler/supervisor
       |
       +-- dequeue/observe job
       |
       +-- launch short-lived Python job runner
               |
               +-- execute existing upstream workflow
               +-- report result
               +-- exit
```

This can gain deterministic memory reclamation without reimplementing the workflows.

---

## 32. Workstream 24 — FastAPI/native backend rewrite only as an optional late phase

### Why it is risky

Replacing FastAPI syntax is easy compared with replacing the Python ecosystem behind the routes.

A native API that immediately calls Python for all meaningful logic may add IPC without removing Python.

A native API that reimplements all meaningful logic becomes a permanent upstream fork.

### Entry criteria before considering this work

All must be true:

- Electron and/or Node reductions are already complete or rejected by measurement;
- Python API memory or CPU remains a top bottleneck;
- route contracts are fully captured;
- OpenAPI/API fixtures exist;
- ownership for long-term divergence from upstream is accepted;
- there is a measurable target worth the maintenance cost.

### If pursued

Implement resource groups incrementally behind a routing gateway:

```text
/api/resourceA -> native implementation
/api/resourceB -> Python implementation
```

This permits route-by-route validation and rollback.

### Required parity tests

- OpenAPI schema comparison;
- status codes;
- JSON shape;
- validation errors;
- streaming behavior;
- auth/local policy if applicable;
- concurrency;
- database transaction semantics;
- RAG workflow integration.

---

# PART IX — LANGUAGE-SPECIFIC GUIDANCE

## 33. TypeScript

### Best role

- formalize existing wrapper contracts;
- maintain React frontend;
- reduce logic ambiguity;
- create fixtures used by native implementations.

### Expected efficiency impact

Low direct runtime improvement, high engineering-safety improvement.

### Recommended stance

Use strict TypeScript as the specification bridge, not as the final solution for process/runtime footprint.

---

## 34. Rust

### Best role

- native host;
- supervisor;
- proxy/static server;
- runtime verifier;
- high-performance Python leaf extensions;
- platform utilities.

### Strengths

- memory safety without garbage collection;
- strong type system;
- small native deployment model;
- excellent fit for long-running infrastructure;
- strong control over streaming and process lifecycle.

### Risks

- higher implementation learning curve;
- Windows-specific platform code still requires care;
- easy to overextend into rewriting upstream Python unnecessarily.

---

## 35. Go

### Best role

- native desktop host via Wails-style architecture;
- process supervisor;
- HTTP proxy;
- static server;
- updater/bootstrapper;
- diagnostics.

### Strengths

- simple concurrency model;
- strong standard HTTP/process libraries;
- single native executable deployment;
- race detector useful for supervisor correctness;
- relatively low implementation complexity.

### Risks

- garbage-collected runtime, though generally acceptable for this host role;
- Windows-native integration may need explicit syscall/interoperability work.

### Recommendation

If creating a second prototype beside Rust, Go is an excellent comparison candidate.

---

## 36. C#/.NET

### Best role

- Windows-first native host;
- WebView2 integration;
- process and Windows integration;
- installer/update support;
- diagnostics.

### Strengths

- natural fit for Windows APIs;
- strong tooling;
- mature async/HTTP ecosystem;
- memory-safe managed code;
- first-class WebView2 ecosystem.

### Risks

- deployment mode must be measured carefully;
- AOT/trimming constraints may affect some designs;
- weaker cross-platform story if WinUI-specific implementation is chosen.

### Recommendation

If this application is intentionally Windows-only, C# deserves a serious prototype rather than being dismissed in favor of a fashionable systems language.

---

## 37. Cython

Use only for measured Python CPU hotspots. It is a surgical optimization tool, not an application architecture.

---

## 38. C/C++

Use only for narrow, well-contained native library work where mature implementations already exist or benchmarks justify the added safety burden.

---

## 39. Java/Kotlin

Not recommended as a primary migration target for this application. Adding/replacing Node/Electron with a JVM does not obviously simplify the runtime stack enough to justify another large managed runtime.

---

## 40. Zig

Technically capable for native utilities and low-level code, but not preferred here because Rust, Go, and C# have stronger alignment with the stated goals of common tooling, auditability, maintainability, and desktop ecosystem support.

---

# PART X — SECURITY AND AUDIT REQUIREMENTS

## 41. Preserve loopback-only network exposure

All internal services should remain bound to loopback unless an explicit product feature requires otherwise.

Automated tests should fail if internal service listeners unexpectedly bind to all interfaces.

---

## 42. Preserve navigation isolation

The current URL policy correctly distinguishes the local application origin from merely similar URL prefixes. Every new WebView host must preserve this principle.

Test:

- correct local origin;
- user-info URL tricks;
- case variants;
- alternate schemes;
- `file:`;
- `javascript:`;
- malformed URLs;
- external HTTPS links.

---

## 42A. Port-conflict termination safety

Treat port-conflict recovery as a privileged operation, not a convenience helper. Security review must verify:

- listener identification cannot be spoofed into killing an unrelated process;
- generic names (`python.exe`, `node.exe`, `surreal.exe`) are insufficient ownership evidence;
- verified runtime paths are canonicalized before comparison;
- path comparisons handle case, links/reparse points, and normalization correctly on the target OS;
- PID reuse/TOCTOU is mitigated by identity revalidation immediately before termination;
- user confirmation cannot be bypassed in normal interactive operation;
- diagnostic rendering treats process names/paths/command lines as untrusted text;
- shell helpers do not interpolate untrusted metadata into commands;
- headless/test mode defaults to no-kill unless explicitly configured;
- unrelated/confidential process command lines are not unnecessarily persisted.

---

## 43. Secrets handling

Do not expose secrets through:

- browser bundles;
- command-line arguments when avoidable;
- logs;
- diagnostics reports;
- crash dumps more than necessary.

Review whether native Windows credential facilities can improve storage of any long-lived sensitive values without breaking portability requirements.

---

## 44. Dependency auditing

For every ecosystem used:

- lock dependencies;
- scan known vulnerabilities;
- review transitive dependency growth;
- store component versions in build manifests;
- verify downloaded runtime artifacts with cryptographic hashes;
- prefer reproducible release sources.

---

## 45. Fuzzing targets

High-value fuzz targets include:

- runtime manifest parser;
- configuration parser;
- URL policy;
- native HTTP header/proxy handling;
- document-extraction boundary formats;
- native/Python FFI boundary;
- installer/component manifests.

---

# PART XI — CORRECTNESS, RAG, AND GOLDEN-DATA TESTING

## 46. Golden document corpus

Create a version-controlled or securely stored test corpus representing real document classes without containing production-sensitive material.

Include:

- plain text;
- Markdown;
- simple PDF;
- multi-column PDF;
- scanned PDF;
- tables;
- images;
- large document;
- malformed/corrupt document;
- Unicode-heavy content.

Record expected properties, not only exact text where exactness is unstable.

---

## 47. Retrieval/RAG regression suite

For each corpus version, record:

- source count;
- chunk count;
- representative retrieved chunks for fixed queries;
- ranking metrics where possible;
- expected answer facts;
- unacceptable hallucinations/omissions.

A lower-memory extraction implementation is not acceptable if retrieval quality deteriorates significantly.

---

## 48. API contract suite

Capture representative request/response fixtures for every desktop-used API route.

Tests should distinguish:

- exact parity requirements;
- semantically equivalent values;
- nondeterministic fields such as timestamps/IDs.

---

# PART XII — CI/CD AND RELEASE GATES

## 49. CI lanes

Suggested lanes:

### Fast lane

- lint/typecheck;
- unit tests;
- pure contract fixtures;
- native unit tests;
- security-policy tests.

### Integration lane

- assembled runtime verification;
- process startup/shutdown;
- proxy tests;
- clean temporary data directory;
- failure injection.

### Stress/chaos lane

- repeated startup/shutdown;
- forced process exits;
- forced host kill;
- app-owned orphan port conflict with confirmed cleanup;
- unrelated-process port conflict with mandatory no-kill behavior;
- stale/PID-reuse conflict identity revalidation;
- bounded retry after cleanup failure;
- job bursts;
- restart after crash.

### RAG lane

- golden corpus ingestion;
- retrieval tests;
- representative model tests where deterministic/local test configuration permits.

### Packaging lane

- build installer;
- verify hashes;
- clean-VM install smoke test where infrastructure permits;
- artifact-size report.

### Performance lane

May run less frequently because of cost, but must run before architecture-changing releases.

---

## 50. Release acceptance gates

A migration should not ship as the default until:

1. all relevant compatibility tests pass;
2. security tests pass;
3. stress and chaos suites pass;
4. no owned process remains after shutdown/crash tests;
5. fresh install succeeds on supported Windows versions;
6. upgrade from the previous release succeeds;
7. user data remains compatible;
8. RAG behavior remains within accepted bounds;
9. measured resource goals are met or the tradeoff is explicitly approved;
10. port-conflict recovery tests prove verified app-owned cleanup and unrelated-process protection;
11. rollback is documented.

---

# PART XIII — FEATURE FLAGS, ROLLBACK, AND MIGRATION CONTROL

## 51. Keep replacements switchable during development

Examples:

```text
Host implementation:
  electron
  rust
  go
  dotnet

Frontend mode:
  next-server
  static-native-host

Worker mode:
  resident
  on-demand

Extraction mode:
  core
  docling

Port conflict recovery:
  report-only
  interactive
```

These do not all need to become user-facing settings. They are engineering controls.

---

## 52. Shadow mode for pure behavior

For safe pure functions, run both implementations and compare results while still using the old result operationally.

Good candidates:

- path resolution;
- manifest verification;
- URL classification;
- runtime detection;
- configuration normalization.

Do not shadow operations with harmful duplicate side effects, such as actually launching two databases or executing a job twice.

---

## 53. Canary release strategy

For major host migrations:

1. internal/dev builds;
2. automated clean-VM suite;
3. limited pilot group;
4. compare diagnostics/performance;
5. promote new host to default;
6. retain one release cycle of fallback build tooling where practical;
7. delete dead implementation only after confidence is established.

---

# PART XIV — LOCAL-LLM SEGMENTED IMPLEMENTATION SEQUENCE

The detailed workstreams above remain the engineering specification. This part defines **how to execute them with the configured local Qwen3.5-9B model without overloading a single session**.

The local model should execute packets, not phases. A phase is a coordination unit; a packet is the unit of code change, validation, audit, and rollback.

## Local execution dependency graph

The program should be treated as two early execution lanes that later converge:

```text
L0  Repository control, contracts, baseline, port recovery
 |
 +----------------------+-------------------------+
 |                      |                         |
 v                      v                         v
L1  Packaging/Python   L2  Native-host contract  L3  Frontend preparation
    low-risk work          and bake-off               only
                           |
                           v
                       L4  Native host/process lane
                           |                         
                           +------------+------------+
                                        |
                                        v
                              X19 / X20 NON-LOCAL GATE
                         native serving/proxy + Node removal
                                        |
                                        v
                               local execution resumes
                                        |
                             +----------+----------+
                             |                     |
                             v                     v
                         L5 packaging           L6 re-profile
                                                   |
                                                   v
                                              L7 evidence-backed
                                                 hotspots/backend
                                                   |
                                                   v
                                              L8 release hardening
```

Sections 19–20 are the only planned implementation gap in the local-LLM chain. Everything entering that gate must be packaged so the non-local executor does not need to rediscover the preceding architecture, and everything leaving it must be documented so Qwen can resume without reconstructing what changed.

---

## Segment L0 — Repository control, contracts, and measurement

**Primary workstream references:** Sections 5–8 plus the integrated port-conflict resolver requirements.  
**Local execution:** Yes.  
**Recommended context slice:** `CORE`; add `SECURITY` for port-conflict work and `QUALITY` for benchmark/test-harness packets.

### L0.1 — Pin upstream and record build provenance

**Objective:** Make every release identify the exact upstream Open Notebook source it packages.

**Suggested write scope:**

```text
upstream.lock.json
scripts/prepare-runtime.js
build-manifest generation code
targeted tests
```

**Steps:**

1. Inspect how the upstream sibling checkout is currently discovered.
2. Define the lock-file schema.
3. Add fail-closed revision verification.
4. Add revision/build-manifest output.
5. Add targeted tests for match, mismatch, missing lock, and malformed lock.
6. Run existing runtime/build tests.
7. Record the exact behavior in the packet handoff.

**Exit gate:** a build cannot silently package an unintended upstream revision.

### L0.2 — Capture the untouched baseline

**Objective:** Create reproducible before-state evidence before optimization.

**Steps:**

1. Define machine-readable benchmark JSON.
2. Capture installer and installed sizes.
3. Capture runtime directory composition.
4. Capture idle process tree and private working set.
5. Capture startup-to-window and startup-to-API-ready timing.
6. Capture a representative ingestion/search workload.
7. Save raw and summarized results without modifying runtime architecture.

**Exit gate:** subsequent packets can calculate objective deltas against a named baseline.

### L0.3 — Convert wrapper boundary contracts to strict TypeScript

**Objective:** Turn implicit JavaScript shapes into explicit migration contracts without changing architecture.

**Packetization:** Do not convert the entire wrapper in one session. Split by boundary:

```text
L0.3a service definition + service table
L0.3b runtime manifest + runtime resolution
L0.3c problem report + diagnostic types
L0.3d encryption/security-facing contracts
L0.3e supervisor public interface
```

For each subpacket:

1. Type the existing inputs/outputs first.
2. Preserve behavior exactly.
3. Add compile/type checks.
4. Run the existing targeted tests unchanged.
5. Only then improve internal implementation if a later packet authorizes it.

**Exit gate:** native implementations have explicit data/behavior contracts to target.

### L0.4 — Extract the language-neutral replacement harness

**Objective:** Make the current implementation the behavioral oracle for replacements.

**Steps:**

1. Identify reusable fixtures from supervisor/security/runtime tests.
2. Move scenario data away from JS-specific assumptions.
3. Define stable fixture input/output formats.
4. Add runner adapters for the current JS implementation.
5. Prove current behavior still passes.
6. Document how a Rust/Go/C# candidate consumes the same fixtures.

### L0.5 — Build the permanent performance harness

**Objective:** Ensure every architecture change emits comparable metrics.

Split resource collection from reporting:

```text
L0.5a process-tree sampling
L0.5b startup timing
L0.5c disk/runtime inventory
L0.5d workload runner
L0.5e scorecard generator
```

Do not let the local model optimize code while creating the measuring tool.

### L0.6 — Implement safe port-conflict recovery

**Objective:** Remove dead-end startup failures while preserving strict process-ownership safety.

**Required context:** load the port-conflict proposal/contract, supervisor public interface, service ports, Electron startup error flow, and `SECURITY` slice. Do not load unrelated frontend/backend code.

**Steps:**

1. Define `PortConflict`, `ProcessIdentity`, ownership classification, and retry policy.
2. Implement listener discovery.
3. Implement process identity/path lookup with an explicit `unverified` result.
4. Permit termination only for positively verified app-owned processes.
5. Revalidate PID identity and port ownership immediately before termination.
6. Add user confirmation and bounded retry.
7. Add unrelated-process, PID-reuse, mixed-conflict, refusal, and successful-retry tests.
8. Add report-only rollback mode.

**Exit gate:** unrelated or unverifiable processes cannot be offered for automatic termination.

### Segment L0 completion gate

Do not begin destructive runtime removal until:

- upstream revision is pinned;
- baseline is stored;
- replacement fixtures exist;
- benchmark harness works;
- port recovery passes safety tests;
- every L0 packet has its own handoff.

---

## Segment L1 — Packaging reductions and Python topology without workflow rewrites

**Primary workstream references:** Sections 9–11.  
**Local execution:** Yes.  
**Recommended context slices:** `CORE`, `QUALITY`; add `ROLLBACK` for runtime packaging changes.

### L1.1 — Produce a component and package size inventory

1. Report size by top-level runtime component.
2. Report largest Python packages/directories.
3. Separate required runtime files from build-only/transient assets.
4. Record Docling-specific footprint.
5. Do not delete anything in this packet.

### L1.2 — Build a no-Docling core runtime variant

1. Add a build feature/variant that excludes advanced Docling dependencies.
2. Preserve existing full-runtime build as rollback.
3. Build both variants.
4. Run runtime verification.
5. Measure installer/runtime differences.
6. Run golden document corpus against both.

### L1.3 — Prototype demand-loaded or isolated Docling

Keep this separate from L1.2 so build-pruning evidence is available first.

1. Define the extraction boundary.
2. Define feature discovery/error UX when advanced extraction is unavailable.
3. Prototype process/component activation.
4. Run golden corpus.
5. Measure peak memory and cleanup after extraction.
6. Preserve full-runtime fallback until accepted.

### L1.4 — Profile API and worker import/memory overlap

This is measurement only.

1. Capture cold import memory for API.
2. Capture cold import memory for worker.
3. Capture overlapping modules.
4. Capture idle worker cost.
5. Capture post-job retained memory.
6. Do not restructure Python yet.

### L1.5 — Benchmark worker concurrency

Test supported concurrency levels against representative jobs. Record throughput, peak memory, failure behavior, and queue latency.

### L1.6 — Prototype on-demand worker lifecycle

1. Keep the current resident worker as the control.
2. Implement the smallest start-on-demand trigger.
3. Define idle-stop behavior.
4. Test jobs arriving during startup/shutdown.
5. Test worker crash/restart.
6. Compare idle/peak memory and latency.
7. Accept only if reliability and queue semantics remain correct.

### Segment L1 completion gate

Proceed only with changes whose benchmark evidence is positive and whose golden/queue behavior remains compatible.

---

## Segment L2 — Native-host contract and candidate bake-off

**Primary workstream references:** Sections 12–16.  
**Local execution:** Yes.  
**Recommended context:** `CORE` + one language slice at a time + `SECURITY` for process/window work.

Never ask the 9B model to compare or implement all three host candidates in one context.

### L2.1 — Freeze the host contract

Specify, test, and document:

- runtime path discovery;
- service definitions;
- readiness semantics;
- startup error reporting;
- navigation/external-link policy;
- port-conflict contract;
- log capture;
- process termination semantics;
- data-directory behavior;
- upgrade expectations.

### L2.2 — Rust/Tauri minimal candidate

Use a fresh session containing only the host contract, Rust guidance, and exact prototype files.

Minimum candidate behavior:

1. open a window;
2. load the existing frontend server;
3. launch existing sidecars;
4. wait for readiness;
5. capture logs;
6. implement safe shutdown/containment;
7. consume shared fixtures.

Do not implement frontend static serving here; that belongs to the later non-local gate.

### L2.3 — Go/Wails minimal candidate

Repeat the same contract in a separate fresh session. Do not let the Rust prototype's internal design become an accidental requirement.

### L2.4 — C#/WinUI/WebView2 minimal candidate

Repeat the same contract in a separate fresh session. Use Windows-native facilities where appropriate, but preserve behavior rather than inventing new product semantics.

### L2.5 — Candidate scorecard and selection

This packet should be **analysis-only** unless a small documentation update is required.

Compare:

- startup;
- idle memory;
- binary/runtime footprint;
- process supervision correctness;
- Windows integration;
- packaging complexity;
- test pass rate;
- implementation complexity;
- maintainability.

Select one host based on evidence and record an ADR.

---

## Segment L3 — Frontend preparation before the non-local gate

**Primary workstream references:** Sections 17–18.  
**Local execution:** Yes.  
**Recommended context:** `CORE`, `QUALITY`, relevant frontend files only.

### L3.1 — Inventory every Next.js server responsibility

Categorize each as:

```text
static build concern
client routing concern
API proxy concern
SSE/streaming concern
upload/body concern
server-only framework dependency
not needed on desktop
```

This packet is inventory-only.

### L3.2 — Freeze proxy and streaming compatibility fixtures

Before changing the frontend build:

1. record representative API requests/responses;
2. record upload behavior;
3. record SSE framing and incremental timing;
4. record cancellation behavior;
5. record relevant headers/statuses;
6. create synthetic fixtures where production services are too variable.

### L3.3 — Build a static/client frontend proof of concept

Split route fixes from build-system changes if necessary.

1. create the static/client target;
2. identify incompatible server components/features;
3. migrate only the minimum required routing/data-fetching behavior;
4. keep the existing Next standalone build intact;
5. run UI/API regression tests;
6. record unresolved blockers for the Section 19 handoff.

### L3.4 — Prepare the Section 19 handoff bundle

Package:

- Next dependency inventory;
- static build artifacts/instructions;
- blockers;
- proxy fixtures;
- SSE fixtures;
- security constraints;
- benchmark baseline;
- selected native-host contract;
- rollback build.

**Exit gate:** the non-local executor does not need to rediscover frontend/server behavior.

---

## Segment L4 — Native host, process ownership, and Electron retirement

**Primary workstream references:** Sections 21–23.  
**Local execution:** Yes.  
**Important sequencing:** this segment may begin after L2 host selection and can proceed while L3 is being completed. Electron removal does not have to wait for Node removal if the selected native host temporarily loads the existing Next server.

### L4.1 — Productionize the selected host against existing services

1. preserve the existing frontend server temporarily;
2. integrate runtime discovery;
3. integrate logging/problem reports;
4. integrate safe port-conflict UI;
5. preserve window/navigation policy;
6. preserve data paths;
7. add feature flag/build variant for fallback.

### L4.2 — Replace ad hoc process-tree cleanup with OS-owned containment

On Windows, introduce Job Object ownership or the language-appropriate wrapper around it.

Test:

- graceful close;
- host crash;
- force kill;
- child crash;
- restart after crash;
- no surviving app-owned listener.

### L4.3 — Improve readiness and health semantics

Split readiness changes by service if necessary. Keep "port open" compatibility until a richer readiness check is proven.

### L4.4 — Remove Electron behind a rollback build

1. reproduce window behavior;
2. reproduce navigation/external-link policy;
3. reproduce startup/error UX;
4. package native build;
5. run clean-VM tests;
6. compare scorecard;
7. retain Electron rollback variant for the defined canary period.

### L4.5 — Chaos and security review

Run the shared supervisor, crash, stale-port, unrelated-process, path, and restart scenarios against the selected host.

---

## External Gate X19–X20 — Non-local implementation only

**Section 19 / Workstream 11:** Move frontend serving and API proxying into the native host.  
**Section 20 / Workstream 12:** Remove bundled Node.js.

These two implementation steps are intentionally excluded from the Qwen3.5-9B local execution path.

### Entry requirements

- L2 selected native host exists.
- L3 handoff bundle is complete.
- Proxy/SSE fixtures pass against the current implementation.
- Static/client frontend proof of concept exists.
- Rollback build remains available.

### Exit requirements

- native static serving passes path/MIME/cache/security tests;
- API proxy compatibility tests pass;
- SSE is demonstrably incremental and not buffered;
- clean supported machine runs with no bundled/system Node dependency;
- updated benchmark scorecard exists;
- exact commits and changed files are documented;
- rollback procedure is documented;
- `CURRENT.md` identifies the new architecture state.

### Resumption rule

Start the next local session with the X19–X20 handoff, relevant tests, and current repository state. Do not ask the local model to reconstruct or second-guess the implementation history.

---

## Segment L5 — Runtime packaging and installer refinement

**Primary workstream references:** Sections 24–25.  
**Local execution:** Yes.  
**Recommended context:** `CORE`, `ROLLBACK`, `SECURITY` for installer/path changes.

### L5.1 — Modularize runtime packaging

Separate logical components in the build graph without changing product behavior first.

Suggested units:

```text
core host/frontend
SurrealDB
Python core backend
optional extraction/Docling
optional provider/model extras where feasible
```

### L5.2 — Installer variant experiments

Evaluate only variants that can be installed and verified automatically. Keep offline/privacy requirements explicit.

### L5.3 — Clean-machine validation

Test supported clean Windows environments, upgrade paths, uninstall/reinstall, path edge cases, and missing shared-runtime behavior where applicable.

---

## Segment L6 — Re-profile the simplified application

**Primary workstream reference:** Section 26.  
**Local execution:** Yes.  
**Nature:** measurement and decision support; no optimization should be bundled into this packet.

Expected process tree may now approximate:

```text
native host
surreal.exe
python API
python worker only when required
optional extraction process only when required
```

Repeat the entire scorecard and answer:

- What dominates idle memory now?
- What dominates peak memory?
- What dominates startup?
- Does the worker retain memory?
- Is extraction the dominant spike?
- Are any local CPU loops measurably expensive?
- Did native host/Node/Electron removal expose new bottlenecks?

The output is a ranked evidence table, not a rewrite proposal.

---

## Segment L7 — Evidence-backed leaf optimization and late backend studies

**Primary workstream references:** Sections 27–32.  
**Local execution:** Yes, but only after L6 provides evidence.  
**Recommended context:** one language slice and one hotspot at a time.

### L7.1 — Cython leaf packet

Use only for a measured Python CPU loop with a stable Python-facing API. One function/module per packet when practical.

### L7.2 — Rust Python extension packet

Use only where allocation/copying or CPU cost justifies the additional native toolchain. Preserve Python fallback until accepted.

### L7.3 — C/C++ leaf integration packet

Only wrap an established native library or unavoidable native interface. Require memory-safety tooling and a minimal FFI surface.

### L7.4 — Go/C# helper packet

Use only when a discrete OS utility has a simpler standalone boundary than adding it to the main host.

### L7.5 — Python worker migration study

Analysis first. Map every command handler to Python workflow dependencies. Do not start with "rewrite worker in Rust/Go/C#."

### L7.6 — FastAPI/native backend feasibility study

Split by route group. Each packet should answer:

- What Python dependency graph is behind this route?
- Would replacing the route actually remove a Python dependency/process?
- What IPC would be introduced?
- What upstream-sync burden results?
- What measurable resource win is expected?

A decision not to rewrite is a successful result when evidence says so.

---

## Segment L8 — Cross-cutting hardening, release, and documentation

**Primary references:** Sections 41–53 and 63–72.  
**Local execution:** Yes.  
**Execution style:** small review/documentation/test packets; do not load all cross-cutting sections at once.

Suggested packets:

```text
L8.1 network/loopback security audit
L8.2 navigation/external-link audit
L8.3 secrets/path diagnostic audit
L8.4 dependency/license/vulnerability audit
L8.5 fuzz targets and corpus seeding
L8.6 golden extraction/RAG regression pass
L8.7 API contract pass
L8.8 CI lane finalization
L8.9 release gates and rollback verification
L8.10 architecture + operations documentation refresh
L8.11 final benchmark scorecard
```

Each packet should produce evidence suitable for a release review rather than prose-only confidence.

---

## Local-LLM packet completion checklist

No packet is complete until all applicable boxes are checked:

- [ ] Objective remained unchanged during the session.
- [ ] Read/write allowlists were respected or deliberately revised.
- [ ] No unrelated refactor was added.
- [ ] Relevant contracts still pass.
- [ ] Compiler/type checker passes where applicable.
- [ ] Targeted tests pass.
- [ ] Broader regression lane required by the packet passes.
- [ ] `git diff --check` passes.
- [ ] Diff was reviewed in a fresh context for high-risk changes.
- [ ] Benchmark was recorded when performance/packaging was affected.
- [ ] Security impact was recorded when processes/network/files/secrets were affected.
- [ ] Rollback remains available until the packet's promotion gate.
- [ ] Handoff file was written.
- [ ] `CURRENT.md` was updated only with concise state changes.

---

## Conditions that require stopping the local model

The local executor must stop and produce a dependency/risk note instead of improvising when:

- required files exceed the packet/context budget;
- behavior is undocumented and tests disagree;
- upstream API semantics are unclear;
- a change would cross into Sections 19–20;
- destructive process termination cannot prove app ownership;
- a security control would need to be weakened to make a test pass;
- a dependency upgrade becomes necessary but was not authorized;
- the model cannot reproduce a failure mechanically;
- test results are flaky enough that correctness cannot be established;
- the patch would silently fork upstream business logic.

Stopping cleanly is preferable to completing an uncertain patch.

---

# PART XV — BENCHMARK SCORECARD

## 63. Standard scorecard template

Every architecture-changing pull request or release candidate should populate a scorecard similar to this:

| Metric | Baseline Electron | Candidate | Delta | Pass? |
|---|---:|---:|---:|---|
| Installer size | TBD | TBD | TBD | TBD |
| Installed size | TBD | TBD | TBD | TBD |
| Runtime size | TBD | TBD | TBD | TBD |
| Process count idle | TBD | TBD | TBD | TBD |
| Idle private bytes | TBD | TBD | TBD | TBD |
| Idle total working set | TBD | TBD | TBD | TBD |
| Startup to window | TBD | TBD | TBD | TBD |
| Startup to API ready | TBD | TBD | TBD | TBD |
| Startup to usable UI | TBD | TBD | TBD | TBD |
| Idle CPU | TBD | TBD | TBD | TBD |
| Peak text ingest memory | TBD | TBD | TBD | TBD |
| Peak PDF ingest memory | TBD | TBD | TBD | TBD |
| Peak OCR ingest memory | TBD | TBD | TBD | TBD |
| Text ingest duration | TBD | TBD | TBD | TBD |
| PDF ingest duration | TBD | TBD | TBD | TBD |
| Search p50 | TBD | TBD | TBD | TBD |
| Search p95 | TBD | TBD | TBD | TBD |
| Clean shutdown | TBD | TBD | TBD | TBD |
| Verified app-owned port-conflict recovery | TBD | TBD | — | Required |
| Unrelated process terminated during conflict test | 0 required | 0 required | — | Required |
| Orphan processes | 0 required | 0 required | — | Required |
| RAG regression | none accepted without review | TBD | — | Required |
| Security regression | none | TBD | — | Required |

---

# PART XVI — DECISION RULES

## 64. When to rewrite a component

Rewrite only when most of these are true:

- it appears in profiling as a meaningful cost;
- it has a narrow boundary;
- behavior can be specified with tests;
- replacement removes a runtime/process/dependency or materially reduces resource use;
- long-term maintenance is acceptable;
- rollback is practical;
- upstream changes are unlikely to constantly invalidate the implementation.

---

## 65. When not to rewrite

Do not rewrite when:

- the code is mostly waiting on an LLM/network/database;
- the replacement still requires the old runtime anyway;
- the component is deeply entangled with upstream business logic;
- the optimization is smaller than benchmark variance;
- the new code would create a permanent fork for little user-visible gain;
- an installation/configuration change provides the same benefit more safely.

---

# PART XVII — PROPOSED TARGET ARCHITECTURES

## 66. Conservative target

```text
Native host
+ React frontend served by existing Node/Next
+ SurrealDB
+ Python API
+ Python worker
```

Benefit: removes Electron/Chromium packaging first with minimal application change.

---

## 67. Recommended medium-term target

```text
Native host
+ React static/client frontend
+ native static server / API proxy / SSE
+ SurrealDB
+ Python API
+ on-demand Python worker
+ optional Docling process/component
```

Benefit: removes both Electron and bundled Node while preserving Python where ecosystem value is highest.

---

## 68. Aggressive target, only if later evidence supports it

```text
Native host
+ React frontend
+ SurrealDB
+ partially native API
+ Python compatibility/workflow service for remaining AI features
+ isolated optional extraction services
```

This is substantially more expensive and should not be assumed necessary.

---

# PART XVIII — LOCAL-LLM FIRST PACKET QUEUE

This backlog is intentionally expressed as **small restartable packets**. The detailed requirements live in the referenced workstream sections and Part XIV. Do not merge adjacent packets merely to reduce the number of sessions.

## 69. Initial local-LLM packet queue

### Queue 0 — Establish trustworthy state

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L0.1` | P0 | Yes | upstream lock + provenance |
| `L0.2` | P0 | Yes | untouched benchmark baseline |
| `L0.3a` | P0 | Yes | typed service-definition contract |
| `L0.3b` | P0 | Yes | typed runtime manifest/resolution contracts |
| `L0.4` | P0 | Yes | language-neutral replacement fixtures |
| `L0.5a` | P0 | Yes | process-tree resource sampler |
| `L0.5b` | P0 | Yes | startup timing harness |
| `L0.6` | P0 | Yes | safe interactive port-conflict recovery |

### Queue 1 — Remove waste without changing product architecture

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L1.1` | P1 | Yes | component/package size report |
| `L1.2` | P1 | Yes | no-Docling runtime variant |
| `L1.3` | P1 | Yes | optional/demand-loaded Docling prototype |
| `L1.4` | P1 | Yes | API/worker memory/import profile |
| `L1.5` | P1 | Yes | worker concurrency benchmark |
| `L1.6` | P1 | Yes | on-demand worker prototype |

### Queue 2 — Choose the native host safely

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L2.1` | P1 | Yes | frozen host contract |
| `L2.2` | P2 | Yes | Rust/Tauri candidate |
| `L2.3` | P2 | Yes | Go/Wails candidate |
| `L2.4` | P2 | Yes | C#/WinUI candidate |
| `L2.5` | P2 | Yes | measured ADR selecting host |

Only build as many serious candidates as needed to make a defensible choice. Do not force all three to production quality.

### Queue 3 — Prepare frontend evidence

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L3.1` | P2 | Yes | Next server dependency inventory |
| `L3.2` | P2 | Yes | API/SSE compatibility fixtures |
| `L3.3` | P2 | Yes | static/client frontend proof of concept |
| `L3.4` | P2 | Yes | X19 entry handoff bundle |

### Queue 4 — Native host/process lane

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L4.1` | P2 | Yes | selected host running existing services |
| `L4.2` | P2 | Yes | OS-owned process containment |
| `L4.3` | P2 | Yes | improved readiness semantics |
| `L4.4` | P2 | Yes | Electron-free rollback-capable build |
| `L4.5` | P2 | Yes | chaos/security evidence |

### Queue X — Explicit non-local gate

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `X19` | P2 | **No** | native static/API/SSE serving |
| `X20` | P2 | **No** | verified Node-free runtime/build |

The Qwen3.5-9B local model must not implement or approve these production changes. Resume local execution only from the documented X20 handoff.

### Queue 5 — Packaging and installation

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L5.1` | P2 | Yes | modular runtime build graph |
| `L5.2` | P2 | Yes | installer variant measurements |
| `L5.3` | P2 | Yes | clean-machine/upgrade validation |

### Queue 6 — Re-profile before further rewrites

| Packet | Priority | Local model? | Primary output |
|---|---|---|---|
| `L6.1` | P2 | Yes | new full benchmark baseline |
| `L6.2` | P2 | Yes | ranked remaining bottlenecks |
| `L6.3` | P2 | Yes | optimization decision memo |

### Queue 7 — Evidence-backed optimization only

Create these packets only if L6 evidence justifies them:

| Packet family | Local model? | Gate |
|---|---|---|
| `L7-CY-*` Cython | Yes | measured Python CPU hotspot |
| `L7-RS-*` Rust Python extension | Yes | measured native-worthy hotspot |
| `L7-CPP-*` C/C++ leaf | Yes | established native library/interface |
| `L7-HELPER-*` Go/C# helper | Yes | narrow OS utility boundary |
| `L7-WORKER-*` worker migration study | Yes | Python worker remains material bottleneck |
| `L7-API-*` backend feasibility slices | Yes | Python baseline remains unacceptable after prior work |

### Queue 8 — Release hardening

Run after the architecture is stable enough to release:

- [ ] `L8.1` network/loopback audit.
- [ ] `L8.2` navigation policy audit.
- [ ] `L8.3` secrets/path/diagnostic audit.
- [ ] `L8.4` dependency audit.
- [ ] `L8.5` fuzz targets.
- [ ] `L8.6` golden extraction/RAG regression.
- [ ] `L8.7` API contract regression.
- [ ] `L8.8` CI lane verification.
- [ ] `L8.9` release/rollback gate verification.
- [ ] `L8.10` documentation refresh.
- [ ] `L8.11` final scorecard.

---

## Packet scheduling rules

1. One active production packet per architectural boundary.
2. Benchmark/inventory packets may run in parallel because they are non-destructive.
3. Do not run two local model sessions that can edit the same files concurrently.
4. Do not start a dependent packet until the predecessor handoff exists.
5. Keep each packet in its own branch or commit boundary where practical.
6. Rebase/merge repository state before generating the next packet's context bundle.
7. When a packet fails, create a recovery packet rather than expanding the failed packet indefinitely.
8. Delete or archive stale context bundles after the repository state changes materially.

---

## Recommended first execution order

For the first implementation cycle, execute:

```text
L0.1  upstream pinning
L0.2  baseline capture
L0.3a service contract typing
L0.3b runtime manifest/resolution typing
L0.4  replacement fixture extraction
L0.5a process resource sampler
L0.5b startup timing harness
L0.6  port-conflict resolver
L1.1  size inventory
L1.4  API/worker memory profile
L1.2  no-Docling variant
L2.1  host contract
```

At that point, reassess packet sizing using actual Qwen3.5-9B performance on this repository. If the model consistently handles these packets with large unused context and clean validation, packet limits can be loosened modestly. If it loses scope, misses contracts, or struggles to recover from test failures, split subsequent packets more aggressively rather than increasing prompt size.

---

# PART XIX — DOCUMENTATION TO MAINTAIN ALONGSIDE THE WORK

## 70. Recommended engineering documents

Create or maintain:

```text
docs/architecture-current.md
docs/architecture-target.md
docs/runtime-components.md
docs/host-contract.md
docs/benchmark-methodology.md
docs/security-boundaries.md
docs/release-build-reproducibility.md
docs/upstream-compatibility.md
docs/migration-rollbacks.md
docs/port-conflict-recovery.md
```

The existing `docs/rust-conversion-plan.md` should either be superseded by this master plan or revised to clearly state that Rust is one candidate implementation strategy inside a broader architecture program.

---

# PART XX — DEFINITION OF SUCCESS

## 71. Technical success

The modernization succeeds when the product has fewer always-running runtimes and processes, reliably cleans up after itself, starts faster or no slower within accepted bounds, uses materially less idle memory, and has a smaller install footprint while preserving application behavior.

A successful end state should ideally achieve most of the following:

- Electron removed;
- bundled Chromium removed in favor of system WebView where supported;
- bundled Node removed;
- React retained;
- Python retained only for the application/AI ecosystem that benefits from it;
- Python worker not resident when unnecessary, if validated;
- Docling/advanced extraction optional or isolated, if policy permits;
- SurrealDB kept as native service;
- native host owns process containment and lifecycle;
- deterministic runtime manifest and build provenance;
- repeatable benchmark suite;
- reusable compatibility suite;
- no orphan processes;
- app-owned stale-process port conflicts can be recovered interactively without a dead-end launch failure;
- unrelated or unverifiable processes are never terminated by conflict recovery;
- no regression in local/private operation;
- no unacceptable RAG-quality regression.

## 72. Maintenance success

The project should also become easier, not merely smaller.

Success means:

- upstream updates remain practical;
- wrapper-owned responsibilities are explicit;
- replacement boundaries are narrow;
- architecture is documented;
- runtime components are versioned;
- tests explain expected behavior;
- support reports identify installed components and versions;
- future optimizations can be evaluated with data instead of intuition.

---

# 73. Final recommendation

The most productive strategy is **progressive runtime elimination**, not wholesale language conversion.

The recommended core direction is:

```text
Native systems/platform layer
    Rust OR Go OR C#

React/TypeScript UI
    keep and simplify

Python
    retain for upstream AI/application workflows
    optimize process lifetime and optional imports/components

SurrealDB
    retain as native database
```

The first native-host rewrite should replace infrastructure the wrapper already owns. It should not rewrite Open Notebook's core AI workflows. Once Electron, Node, unconditional Docling packaging, and unnecessary resident Python processes have been addressed, the project should be re-profiled from scratch.

If the remaining Python code is no longer a meaningful bottleneck, stop there. That is a successful modernization.

If profiling still finds narrow CPU or allocation hotspots, optimize them individually with Cython, Rust extensions, or carefully contained native libraries while retaining the existing Python-facing contract.

The governing rule for the entire effort should be:

> **Every rewrite must remove measurable cost, preserve a testable contract, remain auditable, and have a rollback path.**

That rule keeps the modernization program focused on product efficiency rather than language preference.

---

## Appendix A — Suggested repository layout during migration

```text
Office-Equity-Open-Notebook/
|
+-- app-host/
|   +-- rust/                 # if Rust prototype is active
|   +-- go/                   # if Go prototype is active
|   +-- dotnet/               # if C# prototype is active
|
+-- frontend-static/          # static frontend experiment, if separated
|
+-- contracts/
|   +-- schemas/
|   +-- fixtures/
|   +-- supervisor/
|   +-- api/
|   +-- navigation/
|   +-- port-conflict/
|
+-- benchmarks/
|   +-- scenarios/
|   +-- schema/
|   +-- baselines/
|
+-- docs/
|   +-- MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md
|   +-- architecture-current.md
|   +-- architecture-target.md
|   +-- benchmark-methodology.md
|   +-- security-boundaries.md
|
+-- scripts/
|   +-- ... existing build tools ...
|
+-- scripts/test/
    +-- ... existing tests ...
```

This is illustrative. Do not reorganize the repository merely to match this tree unless the move improves build/test ownership.

---

## Appendix B — Native-host prototype checklist

Each serious native host candidate should be able to answer **yes** to every item below before final selection:

- [ ] Can build reproducibly in CI.
- [ ] Can render the application in the Windows system WebView.
- [ ] Passes local-origin navigation policy tests.
- [ ] Opens approved external web links outside the app.
- [ ] Resolves packaged and development runtime paths.
- [ ] Verifies required runtime files.
- [ ] Starts SurrealDB.
- [ ] Starts FastAPI.
- [ ] Starts current worker.
- [ ] Starts current Node frontend during the initial prototype phase.
- [ ] Captures stdout/stderr without deadlock.
- [ ] Detects early child exit.
- [ ] Supports per-service startup timeout.
- [ ] Detects listeners blocking required ports.
- [ ] Identifies and classifies conflicting process ownership.
- [ ] Requires explicit confirmation before killing verified app-owned conflicts.
- [ ] Never kills unrelated or unverifiable processes.
- [ ] Revalidates process identity before termination and enforces bounded retry.
- [ ] Provides useful error diagnostics.
- [ ] Uses Windows Job Object containment.
- [ ] Leaves zero orphan processes after normal shutdown.
- [ ] Leaves zero orphan processes after forced host termination.
- [ ] Restarts successfully immediately after forced termination.
- [ ] Can serve static frontend assets.
- [ ] Can reverse-proxy API traffic.
- [ ] Can proxy SSE incrementally without buffering.
- [ ] Has acceptable idle memory.
- [ ] Has acceptable startup performance.
- [ ] Produces an acceptable packaged binary/installer size.
- [ ] Can be maintained by the project team.

---

## Appendix C — Rewrite proposal template

Before approving any future rewrite, fill this out:

```markdown
# Component Rewrite Proposal

## Component

## Current implementation

## Measured problem
- CPU:
- Memory:
- Startup:
- Disk:
- Reliability:

## Proposed implementation/language

## Expected measurable improvement

## Contract boundary

## Existing tests

## New tests required

## Differential/shadow test strategy

## Security considerations

## Process-termination / privileged-operation considerations
- Does this component inspect or terminate processes?
- What proves process ownership?
- How is PID reuse/TOCTOU handled?
- Is explicit user confirmation required?

## Packaging impact

## Upstream compatibility impact

## Rollback plan

## Acceptance metrics

## Result after prototype

## Decision
- [ ] Adopt
- [ ] Reject
- [ ] Revisit later
```

This template is intentionally evidence-oriented. "Language X is faster" is not enough to approve a rewrite.

---

## Appendix D — Example migration scorecard for a native host

```markdown
# Native Host Candidate Scorecard

Candidate: __________________
Commit: _____________________
Upstream revision: __________

## Correctness
- Unit contract suite: PASS / FAIL
- Supervisor integration: PASS / FAIL
- Chaos suite: PASS / FAIL
- Security suite: PASS / FAIL
- RAG suite: PASS / FAIL
- Upgrade test: PASS / FAIL

## Resource metrics
- Installer bytes:
- Installed bytes:
- Host private bytes idle:
- Total app private bytes idle:
- Total process count idle:
- Startup to window:
- Startup to API ready:
- Startup to usable UI:
- Shutdown duration:

## Reliability
- Orphans after normal close: 0 required
- Orphans after forced host kill: 0 required
- Immediate restart: PASS / FAIL
- 100-cycle startup/shutdown: PASS / FAIL

## Maintenance
- Build complexity:
- CI complexity:
- Platform API complexity:
- Team familiarity:
- Dependency surface:

## Decision
```

---

## Appendix E — Superseding the existing Rust plan

The repository currently contains `docs/rust-conversion-plan.md`. Its useful ideas should be retained, but its priority order should be updated.

### Keep

- incremental replacement;
- stable interfaces;
- benchmarking;
- native implementation for appropriate infrastructure/hotspots;
- avoiding a giant one-shot rewrite.

### Change

The background worker should **not** be treated as the first low-risk Rust conversion. Its command execution depends on the broader Python Open Notebook ecosystem. Replacing it completely is substantially more invasive than replacing the desktop shell or supervisor.

### New recommended order

1. baseline and pin upstream;
2. contracts and tests;
3. safe interactive port-conflict recovery and reusable resolver fixtures;
4. packaging/dependency reduction;
5. Docling optionalization/isolation;
6. Python process-topology experiments;
7. native desktop host;
8. Windows Job Object supervision;
9. static frontend/native proxy;
10. remove Node;
11. remove Electron if not already removed;
12. re-profile;
13. native leaf optimizations only when justified;
14. backend/worker rewrites only after a separate feasibility decision.

