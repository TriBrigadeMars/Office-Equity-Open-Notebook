# L0.1: Pin upstream revision and build provenance

This plan addresses Prompt 01 (L0.1). The objective is to make every release/runtime build identify and verify the exact upstream Open Notebook revision it consumes.

Behaviors preserved:
- Existing `prepare-runtime.js` downloading/building mechanisms.
- Default repository path fallback to `../open-notebook`.

Explicit stop conditions:
- Do not perform unrelated refactoring.
- Limit changes to 3-6 production files and 1-4 test files.
- Fail closed if the upstream commit cannot be verified and no override is supplied.

## User Review Required
No critical architectural decisions required beyond adding the `upstream.lock.json` and generating `resources/runtime/manifest.json`.

## Proposed Changes

### Configuration
#### [NEW] [upstream.lock.json](file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/upstream.lock.json)
- Add a machine-readable lock file specifying the expected upstream repository, commit SHA, and wrapper compatibility version.

### Build Scripts
#### [MODIFY] [scripts/prepare-runtime.js](file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/scripts/prepare-runtime.js)
- Read `upstream.lock.json` at the start of execution.
- Retrieve the HEAD commit of the upstream repository using `git rev-parse HEAD`.
- Fail execution if the commit does not match, unless `--override-upstream-check` is passed.
- Generate `resources/runtime/manifest.json` at the end of the script containing the wrapper commit, upstream commit, and toolchain versions.

### Testing
#### [NEW] [scripts/tests/test-upstream-lock.js](file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/scripts/tests/test-upstream-lock.js)
- Add focused tests that validate the revision matching logic (success on match, failure on mismatch, success on override).

### Documentation
#### [NEW] [docs/modernization/handoffs/L0.1.md](file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/docs/modernization/handoffs/L0.1.md)
- Document the new provenance artifact as requested.
#### [NEW] [docs/modernization/state/CURRENT.md](file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/docs/modernization/state/CURRENT.md)
- Update state file tracking the completion of L0.1.

## Verification Plan

### Automated Tests
- Run `node scripts/tests/test-upstream-lock.js`.
- Run `node scripts/prepare-runtime.js --repo ../open-notebook` (or against a dummy repo folder) to verify the build manifest is produced.
- Inspect the targeted diff with `git diff --check`.
