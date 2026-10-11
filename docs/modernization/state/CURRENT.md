# Modernization State

## Current Packet
`L2.2` (Ready to begin)

## Completed Packets
- `L0.1`: Pin upstream revision and build provenance. (Completed)
- `L0.2`: Capture untouched baseline build and metrics. (Completed)
- `L0.3a`: Add strict TypeScript tooling and boundary interfaces. (Completed)
- `L0.3b`: Port pure wrapper modules to TypeScript. (Completed)
- `L0.3c`: Port process-management wrapper modules to TypeScript. (Completed)
- `L0.4`: Build the language-neutral replacement harness. (Completed)
- `L0.5`: Create the permanent performance harness. (Completed)
- `L0.6`: Implement safe interactive port-conflict recovery. (Completed)
- `L1.1`: Produce dependency and packaged-size inventory. (Completed)
- `L1.2`: Build and validate a no-Docling core runtime. (Completed)
- `L1.5`: Benchmark Python worker concurrency settings. (Completed)
- `L2.1`: Freeze the native-host contract. (Completed)

## Current Status
- Strict TypeScript tooling configured (`tsconfig.json`, `npm run typecheck`, `npm run build:types`).
- Core boundary interfaces defined under `src/types/index.ts`.
- Service contract module and tests operational under `src/contracts/service-table.ts` and `scripts/tests/test-service-contracts.js`.
- Pure wrapper modules ported to TypeScript (`runtime-manifest.ts`, `runtime-resolution.ts`, `window-policy.ts`).
- Process-management wrapper modules ported to TypeScript (`process-manager.ts`).
- Port-conflict recovery contract and interactive fail-closed validation operational under `src/contracts/port-conflict.ts`.
- Dependency and packaged-size inventory generated at `.artifacts/reports/l1_1/size_and_dependency_inventory.json`.
- No-Docling core runtime configuration and fallback validated under `scripts/tests/test-no-docling-runtime.js`.
- Worker concurrency benchmark matrix generated at `.artifacts/reports/l1_5/worker_concurrency_benchmark.json` and validated by `scripts/tests/test-worker-concurrency.js`. Recommended default: 2 tasks.
- Prompt 15 (`L2.1`) completed. Native-host contract, schema, and compliance checklist defined under `docs/modernization/contracts/`. Ready to proceed to `L2.2`.
