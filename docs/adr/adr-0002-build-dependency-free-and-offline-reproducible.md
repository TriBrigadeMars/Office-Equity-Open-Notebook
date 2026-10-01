# ADR-0002: Keep the build dependency-free and offline-reproducible

- **Status:** Accepted
- **Date:** 2026-09-30
- **Context:** `scripts/build-icons.js`, `scripts/lib/*`, `package.json`, `README.md`

## Context

The build tooling must run on arbitrary Windows machines (build agents, admin
and non-admin users' desktops) and must remain reproducible and offline. Two
tempting shortcuts exist:

1. Add npm packages for image processing (e.g. `sharp`, `pngjs`, `ico`), TOML
   parsing (`toml`), checksumming, or packaging (`electron-builder`, `asar`).
2. Repurpose upstream-supplied tooling that happens to already be on disk (e.g.
   `start-server.js` from the assembled frontend runtime) instead of writing the
   code this repo needs.

## Decision

**The build stays dependency-free.** Every build-time capability is implemented
with Node's standard library only, and upstream tooling is never treated as a
reusable library:

- `build-icons.js` implements its own PNG decode/encode (via built-in `zlib`),
  ICO assembly, area-average resampling, and 32-bit DIB encoding — no image
  library, no new npm dependencies. It exports `decodePng`, `buildIco`,
  `fitSquare` and is reused as *this repo's own* library by
  `apply-branding.js` to regenerate the favicon.
- `prepare-runtime.js` parses upstream `pyproject.toml` with Python's built-in
  `tomllib` (3.11+), not a JS TOML package, since Python is guaranteed present
  in the build pipeline.
- `verify-installer.js` reads the NSIS length header directly from the binary
  and computes SHA-256 with `crypto` — no installer SDK dependency.
- Icon sizes (16–256 px), SurrealDB/Node versions, and their SHA-256 checksums
  are pinned as constants in `prepare-runtime.js`; update them together when
  bumping versions.
- Shared primitives live in `scripts/lib/` (`paths.js` is the single source of
  truth for name/version/dirs/ports, `cli.js` for argv and process running,
  `fsx.js` for filesystem ops). New script code should reach for these before
  adding anything.
- Downloads (SurrealDB, Node) are checksum-verified before use, so "no
  dependency" does not mean "unverified".

## Consequences

- **Good:** zero-install builds on machines with only Node 18+, `git`, and `uv`;
  offline reproducibility; no supply-chain surface in the build itself.
- **Bad:** some hand-maintained low-level code (PNG filters, ICO directory
  layout, NSIS header offsets) that a library would provide — accepted because
  the formats used are small, stable, and now well-documented in-tree.
- **Reuse rule:** when adding a build capability, first check `scripts/lib/` and
  `build-icons.js` exports; only consider a new npm dependency if the pure-Node
  implementation would be genuinely large and the dependency can be pinned and
  audited. Do not import from the assembled upstream runtime (`resources/`)
  under any circumstances.
- **Alternative rejected:** adopting `electron-builder`. Rejected specifically
  because it fails on non-admin Windows (7-Zip cannot create macOS symlinks in
  its code-signing cache without admin/Developer Mode); `package.js` and
  `build-installer.js` do the same job with `fs.cpSync` + NSIS.
