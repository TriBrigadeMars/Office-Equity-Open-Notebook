# Prompt 25 — X20: Remove bundled Node.js — NON-LOCAL

**Execution class:** GEMINI (NON-LOCAL) — Gemini 3.1 Pro / 2M tokens
**Packet ID:** `X20`  
**Master-plan source:** `20 / Workstream 12; External Gate X19–X20`  
**Dependencies:** X19  
**Context slices:** `NON-LOCAL`

## Execution profile

This packet is one of the two explicit **non-local execution exceptions**. Do **not** use the Qwen3.5-9B local executor to author, approve, or silently modify the production implementation for this packet. Use the project owner's selected non-local execution path.

Repository state, tests, contracts, benchmark evidence, security rules, and explicit acceptance criteria are authoritative. Do **not** edit either master-plan Markdown document included in this prompt pack. They are immutable source documents.

## Source of truth to load

Read the relevant headings from `MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md` named above. Also load the immediately preceding handoff(s), relevant contract/decision files, and only the source/tests needed for this packet. The pre-local-LLM master document is historical reference only and should not override the current master plan.

## Required working method

1. Consume the bounded handoff prepared by the local execution lane; do not rediscover already frozen behavior unless evidence is inconsistent.
2. Restate the compatibility contract, security constraints, rollback path, and required tests before implementation.
3. Keep the implementation scoped to this packet.
4. Preserve a rollback build/commit until the exit gate is accepted.
5. Run all proxy/streaming/static-serving or Node-removal validation required by the master plan.
6. Produce an exact implementation handoff containing commits, changed files, test results, benchmark delta, known exceptions, rollback procedure, and updated architecture state.
7. Do not edit either master document.

## Objective

Eliminate the bundled/system Node.js runtime from the supported desktop execution path only after native serving/proxy compatibility is proven.

## Task

1. Identify every remaining runtime dependency on Node/Next standalone server.
2. Remove Node from runtime preparation, manifest, service table, packaging, and installer inputs.
3. Ensure static frontend assets are served entirely by the selected native host.
4. Remove dead Node-specific startup/recovery paths only after tests prove they are unused.
5. Run clean-machine validation that fails if a hidden system Node dependency exists.
6. Update architecture state and package-size benchmarks.
7. Preserve rollback to the pre-X20 build until acceptance.

## Validation requirements

- Clean machine/VM launch with no Node installed.
- Full API/upload/SSE/UI regression suite.
- Installer/package inventory confirms Node absence.
- Benchmark size/startup/idle deltas.

## Required deliverables

- Node-free production build
- Clean-machine evidence
- Updated scorecard
- Exact commits/changed files
- Rollback procedure
- X20 handoff + updated CURRENT.md

## Completion response

At the end, report only evidence-backed results: files changed, tests/builds/benchmarks run with outcomes, behavior intentionally changed, behavior intentionally preserved, unresolved risks, rollback status, and the path to the handoff artifact. If this packet cannot be completed safely within scope, stop with a dependency/risk note instead of widening the task.
