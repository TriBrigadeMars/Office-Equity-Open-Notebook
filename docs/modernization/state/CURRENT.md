# Modernization State

## Current Packet
`L1.2` (Ready to begin)

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

## Current Status
- Strict TypeScript tooling configured (`tsconfig.json`, `npm run typecheck`, `npm run build:types`).
- Core boundary interfaces defined under `src/types/index.ts`.
- Service contract module and tests operational under `src/contracts/service-table.ts` and `scripts/tests/test-service-contracts.js`.
- Pure wrapper modules ported to TypeScript (`runtime-manifest.ts`, `runtime-resolution.ts`, `window-policy.ts`).
- Process-management wrapper modules ported to TypeScript (`process-manager.ts`).
- Port-conflict recovery contract and interactive fail-closed validation operational under `src/contracts/port-conflict.ts`.
- Dependency and packaged-size inventory generated at `.artifacts/reports/l1_1/size_and_dependency_inventory.json`.
- Ready to proceed to `L1.2`: Build and validate a no-Docling core runtime.
