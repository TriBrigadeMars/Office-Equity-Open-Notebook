# Local Executor Preamble

Use this preamble with any **LOCAL** prompt in this pack when your coding environment benefits from a stable standing instruction.

## Execution profile

Use the local model **Gemini 3.1 Pro / Gemini 3.6 Flash / Gemini 3.5 Flash-Lite**, with a **1M - 2M context window**. Leverage the large context window by including necessary repository context, but remain focused on the specific work packet. Match the model tier (Pro, Flash, Flash-Lite) to the complexity of the packet.

The model is an implementation assistant, not the source of truth. Repository state, tests, contracts, benchmark evidence, security rules, and explicit acceptance criteria are authoritative.

Do **not** edit either master-plan Markdown document included in this prompt pack. They are immutable source documents.

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

## Model-specific operating guidance

- Prefer deterministic repository inspection and test output over inference.
- Keep tool output concise; summarize large logs and re-open only failing regions.
- Never assume a file exists because the master plan mentions an intended future layout; verify repository state first.
- Do not load all master-plan sections at once. Load only the packet's named sections and required cross-cutting slices.
- When a packet is marked analysis/measurement only, do not “helpfully” implement the optimization it suggests.
- When a packet depends on a handoff, treat the handoff plus current repository state as authoritative; do not reconstruct earlier work from memory.
- For high-risk process, security, installer, or native-code changes, use a fresh-context review before promotion.
