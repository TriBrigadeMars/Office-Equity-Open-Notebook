# Codebase Review: Rust Conversion Plan

## Why this document exists

The desktop app bundles four long-running services (SurrealDB, a FastAPI
backend, a Python background worker, and a Node.js frontend server) and keeps
them alive for the entire lifetime of the Electron window. That is exactly the
shape of workload where memory pressure and latent leaks accumulate over a
working day.

This document records the findings of a review focused on whether moving parts
of the stack to Rust would reduce memory growth, and lays out how to do it in
incremental, independently shippable steps.

## What the app actually is

The repository is a thin Electron shell. Almost all logic lives upstream:

- `main.js` - Electron main process, window creation, service lifecycle.
- `scripts/start-services.js` - spawns and tears down all four services.
- `scripts/prepare-runtime.js` - assembles `resources/runtime/` from a clone of
  `lfnovo/open-notebook`, bundling standalone CPython 3.12, Node.js, SurrealDB,
  and a pre-downloaded tiktoken cache.
- `scripts/package.js` / `scripts/build-installer.js` - manual Windows
  packaging and NSIS installer, with no `electron-builder` involved.

Because the Python and Node runtimes are vendored rather than referenced,
any Rust component has to be built and copied into `resources/runtime/` by the
same preparation pipeline. That constraint shapes every task below.

## Findings

Memory concerns are real but they are not where JavaScript lives. The Electron
main process is small and short-lived in terms of allocation; the retained
memory sits in the Python worker and backend, plus the Node server that never
exits. Concrete observations:

- The worker is a polling loop (`--max-tasks 5`) that repeatedly deserializes
  large JSON payloads and hands them to Python object graphs. Peak memory is
  driven by payload size, not request count.
- Document ingestion is the heaviest path. Docling is pre-installed into the
  bundled runtime specifically so it is always enabled, which means the PDF
  and OCR cost is always available to be incurred on the same process that is
  also holding the task queue.
- The FastAPI backend and the worker share an interpreter's worth of baseline
  RSS each. Two Python processes is the floor today.
- The Node frontend server grows slowly but never shrinks; it is the classic
  long-lived Node profile.
- `start-services.js` tears services down in reverse order with a 1.5s grace
  period followed by `SIGKILL`. On Windows, child processes spawned this way do
  not always die with their parent, so an unclean Electron exit can orphan a
  Python worker still holding file handles and memory.

Rust does not fix the last point by itself, but a compiled worker with an
explicit shutdown path makes it tractable.

## Candidate components, ranked

| Rank | Component | Current tech | Why Rust helps |
|------|-----------|--------------|----------------|
| 1 | Background worker | Python `surreal_commands.cli.worker` | Longest-lived, owns the task queue, parsing-heavy; deterministic teardown |
| 2 | Docling / content-core extraction | Python `content-core[docling]` | CPU and allocation hotspot; can move off the GIL entirely |
| 3 | Embedding / tokenization client | Python HTTP wrappers | Large buffers and JSON round-trips; streaming avoids whole-body materialization |
| 4 | FastAPI backend | Python + uvicorn | Eliminates the second interpreter, but largest rewrite surface |
| 5 | Frontend tokenization | Node | Small win; WASM keeps the Node server untouched |
| 6 | Node runtime footprint | Node 22 standalone | No Rust needed; dependency pruning only |

Ranking is by payoff per unit of risk, not by absolute benefit. Component 4 is
the biggest theoretical win and the worst place to start.

## Component 1: Background worker

| Task | Description | Commands / files |
|------|-------------|------------------|
| 1-A | Scaffold a binary crate that will become `worker.exe`. | `cargo new onb-worker --bin` |
| 1-B | Add an async runtime. | `tokio = { version = "1", features = ["full"] }` |
| 1-C | Replicate the existing CLI surface: `--import-modules commands --max-tasks 5`. | `clap` with `derive` |
| 1-D | Implement the SurrealDB polling loop: select pending rows, mark running, process, mark done. | `surrealdb` client crate |
| 1-E | Port the model calls. Preserve request and response shapes exactly. | `reqwest` with `json`, `serde` with `derive` |
| 1-F | Match the existing log line format (ISO timestamp, `[name:stream]` tag). | `tracing`, `tracing-subscriber` |
| 1-G | Build for Windows x64. | `cargo build --release` |
| 1-H | Point the launcher at the binary instead of the Python module invocation. | `scripts/start-services.js`, worker `spawnService` call |
| 1-I | Verify end to end by uploading a document and watching the worker log. | `npm run prepare:runtime && npm start` |

Deliverable: `resources/runtime/worker/onb-worker.exe` plus a launcher change.

## Component 2: Docling / content-core extraction

| Task | Description | Commands / files |
|------|-------------|------------------|
| 2-A | Scaffold a library crate. | `cargo new onb-docling --lib` |
| 2-B | Add PDF text extraction. | `lopdf` or `pdf` |
| 2-C | Add OCR only if required; it pulls a native dependency. | `tesseract` bindings |
| 2-D | Expose a stable entry point returning plain text plus metadata. | `pub fn extract(path: &Path) -> Result<Doc, Error>` |
| 2-E | Produce a Python extension so the backend can adopt it without an API change. | `pyo3` with `extension-module`, built via `maturin` |
| 2-F | Switch the importer once parity is proven. | Python side: import the new module |
| 2-G | Diff output against the current engine on a sample corpus. | integration script |
| 2-H | Copy the built extension into the bundled site-packages so it ships offline. | `resources/runtime/python/Lib/site-packages/` |

Deliverable: a Python-importable Rust extractor, initially behind a flag.

## Component 3: Embedding and tokenization client

| Task | Description | Commands / files |
|------|-------------|------------------|
| 3-A | Scaffold a binary crate. | `cargo new onb-embed --bin` |
| 3-B | Implement the provider HTTP calls. | `reqwest` |
| 3-C | Stream response bodies instead of buffering whole payloads. | `bytes_stream()` |
| 3-D | Keep the existing CLI flags so callers do not change. | `--model`, `--input`, `--output` |
| 3-E | Build. | `cargo build --release` |
| 3-F | Replace the Python helper in the launcher, if one is spawned. | `scripts/start-services.js` |
| 3-G | Confirm identical JSON output and comparable latency. | manual + integration check |

Deliverable: `onb-embed.exe` with byte-identical wire behavior.

## Component 4: FastAPI backend (optional, do last)

Only pursue this if profiling shows the API layer is the bottleneck, or if
consolidating to a single native process is a stated goal.

| Task | Description | Commands / files |
|------|-------------|------------------|
| 4-A | Scaffold a binary crate. | `cargo new onb-api --bin` |
| 4-B | Choose a framework with OpenAPI generation. | `axum` plus `utoipa` |
| 4-C | Re-implement routes from `api/main.py` one resource at a time. | e.g. documents, embeddings |
| 4-D | Preserve every environment variable the Python backend reads. | `SURREAL_URL`, `DATA_FOLDER`, `OPEN_NOTEBOOK_ENCRYPTION_KEY`, and the rest of the block in `start-services.js` |
| 4-E | Emit an OpenAPI document matching the FastAPI spec so the frontend keeps working unchanged. | `utoipa` |
| 4-F | Swap the launcher to the new binary. | `scripts/start-services.js` |
| 4-G | Smoke test the documented endpoints and compare payloads. | `/docs` and a few routes |

Deliverable: a native API only after the worker and extractor have proven the
pattern.

## Component 5: Frontend tokenization via WebAssembly

| Task | Description | Commands / files |
|------|-------------|------------------|
| 5-A | Scaffold a library crate targeting WASM. | `cargo new onb-wasm --lib --target wasm32-unknown-unknown` |
| 5-B | Implement encoding with the same vocabulary the backend uses. | `tiktoken-rs` |
| 5-C | Build with the web target. | `wasm-pack build --target web` |
| 5-D | Import the generated module in the frontend where token counting happens. | frontend tokenizer module |
| 5-E | Ship the artifacts as static assets. | `public/wasm/` |
| 5-F | Verify token counts match the Python implementation on sample text. | integration check |
| 5-G | Stop here unless the Node server is also being replaced. | - |

Deliverable: tokenization runs in the browser, reducing Node heap pressure.

## Component 6: Node runtime footprint (no Rust)

| Task | Description | Commands / files |
|------|-------------|------------------|
| 6-A | Inventory production dependencies inside the assembled frontend. | `npm ls --prod` |
| 6-B | Remove anything unused from the bundled output. | `resources/runtime/frontend` |
| 6-C | Rebuild the standalone output so the bundle stays consistent. | `npm ci && npm run build` |
| 6-D | Confirm the UI still works before shipping a smaller installer. | manual smoke test |

Deliverable: smaller installer and lower idle RSS, no new language.

## Cross-cutting guidance

1. One branch per component, one PR per component. Do not batch the worker and
   the extractor into a single review.
2. Every component needs an integration check that starts the real services and
   exercises a real request, because none of this is unit-testable in isolation
   from the bundled runtime.
3. Copy each build artifact into `resources/runtime/` and let
   `prepare-runtime.js` pick it up, so the offline guarantee is preserved.
4. Add `cargo test --all-targets` for each crate to CI alongside
   `npm run package:app`.
5. Treat the worker shutdown path as a first-class requirement, not a follow-up.
   The current force-kill behavior on Windows is the likeliest source of the
   memory symptoms that prompted this review.
6. Document each new binary in the README with its rebuild command.

## Recommended sequence

Start with Component 1 (worker) because it is the longest-lived process and the
pattern-setter for everything else. Then Component 2, since extraction is the
allocation hotspot. Component 3 is small and independent, so it can run in
parallel. Defer Component 4 until profiling justifies it, and treat Components
5 and 6 as opportunistic cleanups.
