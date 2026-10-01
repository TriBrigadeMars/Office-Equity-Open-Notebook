# ADR-0001: Do not fork upstream; assemble the runtime from a pristine clone with build-time patches

- **Status:** Accepted
- **Date:** 2026-09-30
- **Context:** `scripts/prepare-runtime.js`, `scripts/apply-branding.js`, `scripts/verify-runtime.js`, `scripts/build-installer.js`

## Context

The desktop app wraps the upstream `lfnovo/open-notebook` stack. The GUI is the
upstream Next.js frontend and the backend is the upstream Python code. Both need
Office-of-Equity-specific changes: the sidebar mark and favicon must be rebranded,
and the backend's `config.py` must honor a `DATA_FOLDER` env var because the app
runs the backend from a read-only install directory. This repo owns only the
Electron shell, the build/packaging tooling, and the artwork.

A future explorer will notice that branded/logic-bearing code (e.g.
`AppSidebar.tsx`, `config.py`) lives upstream, not here, and will face the same
choice we did: fork upstream, or keep the clone pristine.

## Decision

**Never fork `lfnovo/open-notebook`.** This repo clones it to a sibling path,
assembles a self-contained runtime from it at build time, and applies every
required modification as a reproducible, verified build-time patch over a *copy*
of the clone, never over the clone itself:

1. `prepare-runtime.js` copies the frontend source into a temp build directory
   (`os.tmpdir()/onb-frontend-build`), applies branding there
   (`apply-branding.js`), normalizes the npmmirror lockfile URLs, builds, and
   assembles `resources/runtime/frontend/`. The temp dir lives *outside* this
   project tree so Next.js cannot infer a workspace root above it and misplace
   `server.js`.
2. `buildBackend()` copies `api/`, `open_notebook/`, `commands/`, `prompts/` into
   `resources/runtime/backend/` and rewrites `DATA_FOLDER = "./data"` to honor
   `os.environ.get("DATA_FOLDER", ...)` — mirroring upstream's own recommended
   modification in `docs/1-INSTALLATION/windows-native.md`.
3. Patches are expected to be **loud, not silent**: `apply-branding.js` throws
   when the upstream `LogoPebbles` block is missing (restructured upstream) or
   already branded (idempotency), and handles the upstream checkout's CRLF
   line endings by normalizing to LF for matching and restoring EOL on write.
4. Every patch is verified to have survived assembly: `verify-runtime.js` fails
   the build unless `public/cu-logo.png` exists *and* a compiled client chunk
   references `cu-logo.png` (a present-but-unreferenced logo means the sidebar
   still renders upstream pebbles). `package.js` and `build-installer.js` run
   the same check on the assembled and staged frontend respectively.

Concretely: the branding patch is one command (`npm run prepare:runtime -- --step
frontend`); source artwork lives here (`assets/cu-logo.png`), so no fork is
needed and the two brand surfaces are rebranded with one script.

## Consequences

- **Good:** upstream updates remain cheap (clone, re-run `prepare:runtime`, fix
  any loud patch errors); no divergent fork to maintain or merge into; every
  modification is visible in one script instead of scattered across a fork's
  history.
- **Bad:** patches are matched against upstream source by literal string, so any
  upstream restructure of a patched region breaks the build until the patch is
  updated — accepted, because the failure is loud and specific, not silent.
- **Verification is mandatory:** `verify-runtime.js` is the guard that makes
  this decision safe; it must keep asserting that patches survive the build, not
  merely that files exist. `build-installer.js` additionally stages with
  robocopy `/XD <full-path>` (not bare names) so verification is meaningful.
- **Alternative rejected:** forking upstream. Rejected because it makes every
  future upstream pull a merge effort and forces this repo to maintain upstream
  code in place, instead of small, verifiable patches.

## Notes

`scripts/start-server.js` (upstream helper, present in the assembled frontend
runtime) contains a pre-existing bug unrelated to this decision: it
`require`s `./.next/standalone/server.js` while `prepare-runtime.js` flattens
`standalone/` to the frontend root. `start-services.js` does it correctly by
spawning `node server.js`. Do not "fix" this by forking.
