# Prompt 02 — L0.2: Capture untouched baseline build and metrics

**Execution class:** GEMINI — Gemini 3.5 Flash-Lite / 1M tokens  
**Packet ID:** `L0.2`  
**Master-plan source:** `5 / Workstream 0, especially 0.5–0.7; 8; 63`  
**Dependencies:** L0.1  
**Context slices:** `CORE + QUALITY`

## Execution profile

Use the model **Gemini 3.5 Flash-Lite** with a **1M tokens context window**. You may include larger chunks of repository context due to the expanded context window, but maintain strict adherence to the packet boundary. Do not implement outside the designated scope.

The model is an implementation assistant, not the source of truth. Repository state, tests, contracts, benchmark evidence, security rules, and explicit acceptance criteria are authoritative.

Do **not** edit either master-plan Markdown document included in this prompt pack. They are immutable source documents.

## Source of truth to load

Read the relevant headings from `MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md` named above. Also load the immediately preceding handoff(s), relevant contract/decision files, and only the source/tests needed for this packet. The pre-local-LLM master document is historical reference only and should not override the current master plan.

## Required working method

1. Load only the master-plan sections named below, the directly relevant source/test files, and the immediately preceding handoff if this packet depends on it.
2. Before editing, restate: the objective, behaviors that must not change, files expected to change, tests to run, and explicit stop conditions.
3. Produce an implementation plan of **no more than 8 steps**, mapping each step to a file or test.
4. Keep the write set narrow. Prefer **3–6 production files** and **1–4 directly relevant test files**. If the task cannot safely fit that boundary, split it and document why.
5. Do not perform unrelated refactors, dependency upgrades, architectural migrations, or business-logic rewrites.
6. Validate mechanically. Never substitute “looks correct” for tests/build/lint/benchmark evidence.
7. Audit the diff with `git diff --check`, `git diff --stat`, and a targeted diff of packet files.
8. Finish by writing a concise handoff under `docs/modernization/handoffs/` and update `docs/modernization/state/CURRENT.md` only with concise state changes.
9. Stop after this packet. Do not opportunistically begin the next prompt.

### Global stop conditions

Stop and produce a dependency/risk note instead of improvising if: required context exceeds the packet budget; behavior is undocumented and tests disagree; a dependency upgrade becomes necessary but is not authorized; a security control would need weakening; a destructive process action cannot prove app ownership; test results are too flaky to establish correctness; the work would cross into Sections 19–20; or the patch would silently fork upstream business logic.

## Objective

Create a reproducible pre-modernization baseline that later packets can compare against.

## Task

1. Build the application from the pinned source using the current architecture.
2. Record installer size and installed size.
3. Record process count, idle working set/RSS, idle CPU, cold-start-to-window, cold-start-to-API-ready, and shutdown time.
4. Run representative document ingestion/search/RAG workloads and capture peak memory and latency.
5. Capture long-session/orphan-process observations where practical.
6. Store raw results under `artifacts/modernization/benchmarks/` in a machine-readable form.

## Validation requirements

- Confirm the baseline can be rebuilt from the recorded provenance.
- Confirm benchmark artifacts are parseable and include units/environment metadata.

## Required deliverables

- Baseline release artifact metadata
- Baseline benchmark JSON/CSV
- Environment/toolchain metadata
- L0.2 handoff

## Completion response

At the end, report only evidence-backed results: files changed, tests/builds/benchmarks run with outcomes, behavior intentionally changed, behavior intentionally preserved, unresolved risks, rollback status, and the path to the handoff artifact. If this packet cannot be completed safely within scope, stop with a dependency/risk note instead of widening the task.
