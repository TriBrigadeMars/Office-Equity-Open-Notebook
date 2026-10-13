# Prompt 12 — L1.4: Profile Python API and worker import/memory overlap

**Execution class:** GEMINI — Gemini 3.6 Flash / 1M tokens  
**Packet ID:** `L1.4`  
**Master-plan source:** `11 / Workstream 6, especially 11.1–11.2; 26`  
**Dependencies:** L1.1  
**Context slices:** `CORE + QUALITY`

## Execution profile

Use the model **Gemini 3.6 Flash** with a **1M tokens context window**. You may include larger chunks of repository context due to the expanded context window, but maintain strict adherence to the packet boundary. Do not implement outside the designated scope.

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

Measure how much duplicate Python runtime/import state is retained by the API and worker before proposing topology changes.

## Task

1. Capture import-time profiles for API and worker.
2. Capture per-process idle memory after warm startup.
3. Identify overlapping heavy modules and optional imports.
4. Identify modules that can be lazy-loaded without behavior changes.
5. Prototype only clearly safe lazy imports in a separate small patch if evidence supports it.
6. Produce a ranked table of retained-memory contributors.

## Validation requirements

- Run API/worker startup tests before and after any lazy-loading patch.
- Compare idle memory and first-use latency.

## Required deliverables

- Import profiles
- Overlap report
- Optional safe lazy-load patch
- Metric delta
- L1.4 handoff

## Completion response

At the end, report only evidence-backed results: files changed, tests/builds/benchmarks run with outcomes, behavior intentionally changed, behavior intentionally preserved, unresolved risks, rollback status, and the path to the handoff artifact. If this packet cannot be completed safely within scope, stop with a dependency/risk note instead of widening the task.
