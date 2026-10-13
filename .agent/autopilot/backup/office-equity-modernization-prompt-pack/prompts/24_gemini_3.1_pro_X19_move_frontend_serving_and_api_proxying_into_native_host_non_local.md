# Prompt 24 — X19: Move frontend serving and API proxying into native host — NON-LOCAL

**Execution class:** GEMINI (NON-LOCAL) — Gemini 3.1 Pro / 2M tokens
**Packet ID:** `X19`  
**Master-plan source:** `19 / Workstream 11; External Gate X19–X20`  
**Dependencies:** L3.4 and selected native host  
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

Move static frontend serving, API reverse proxying, and SSE pass-through into the selected native host while preserving the frozen compatibility/security contract.

## Task

1. Implement static asset serving with correct path, MIME, cache, and traversal protections.
2. Implement a reverse proxy restricted to the intended loopback backend target.
3. Preserve methods, bodies/uploads, required headers, status codes, cancellation, and error behavior.
4. Implement SSE as true incremental pass-through with no buffering regression.
5. Apply deliberate request limits/timeouts without breaking established contracts.
6. Run differential API/proxy/static/streaming tests against the current implementation.
7. Keep a rollback build available.

## Validation requirements

- Static-serving security tests.
- Proxy/upload compatibility suite.
- SSE framing/timing/cancellation suite.
- Benchmark host overhead and startup impact.

## Required deliverables

- Production native serving/proxy implementation
- Exact commits/changed files
- Test and benchmark evidence
- Rollback procedure
- X19 handoff

## Completion response

At the end, report only evidence-backed results: files changed, tests/builds/benchmarks run with outcomes, behavior intentionally changed, behavior intentionally preserved, unresolved risks, rollback status, and the path to the handoff artifact. If this packet cannot be completed safely within scope, stop with a dependency/risk note instead of widening the task.
