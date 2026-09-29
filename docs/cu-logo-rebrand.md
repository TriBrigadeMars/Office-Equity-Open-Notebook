# CU Logo Rebrand: What Changed and How to Test It

## Why this document exists

The app shipped with the stock Electron icon and the upstream Open Notebook
pebble mark in its sidebar. This document records the rebrand to the Office of
Equity / University of Colorado mark: what changed for each branded surface, how
the in-GUI change is kept reproducible without forking upstream, and how to
verify and test it.

Two commits on branch `oe-marscruz-cu-logo-rebrand`:

```
e6cd9be  Rebrand app with University of Colorado logo
392d84d  Add application icon pipeline for window, exe, and installer
```

## The four branded surfaces

| Surface | Lives in | Changed by |
| --- | --- | --- |
| Desktop / `.exe` / installer icon | this repo, `assets/icon.ico` | `392d84d` + new artwork |
| Window title bar + taskbar icon | this repo, `main.js` | `392d84d` |
| Sidebar mark left of "Open Notebook" | upstream frontend, `AppSidebar.tsx` | `e6cd9be`, `scripts/apply-branding.js` |
| Browser-tab favicon | upstream frontend, `src/app/favicon.ico` | `e6cd9be`, `scripts/apply-branding.js` |

## Aspect 1: desktop, exe, and installer icon

The icon pipeline already existed on an unmerged branch, but `main` was broken:
`scripts/package.js` pointed `rcedit` at
`../open-notebook/frontend/src/app/favicon.ico`, a sibling clone that does not
exist in this project, so the packaged exe **silently** fell back to the default
Electron icon.

I cherry-picked `abcab45` from `oe-marscruz-add-app-icon` as **`392d84d`**
rather than merging the branch, which would have dragged unrelated work in. It
brought in:

| File | Change |
| --- | --- |
| `scripts/build-icons.js` | *new*, 412 lines. Pure-Node PNG decode and ICO encode using only built-in `zlib`. Exports `decodePng`, `buildIco`, `fitSquare`. No new npm dependencies. |
| `main.js` | +8. `resolveIconPath()` returns `path.join(__dirname, 'assets', 'icon.ico')` when it exists; `createWindow()` passes it as `icon`. |
| `scripts/package.js` | +10/-4. Copies `assets/` into `resources/app` so the runtime icon resolves, and changes `iconSrc` to the repo-local `assets/icon.ico` (guarded by `fs.existsSync`). |
| `scripts/build-installer.js` | +6. Emits `!define MUI_ICON` / `!define MUI_UNICON` from `assets/icon.ico` (forward-slashed to avoid NSIS path escaping), omitted when the icon is absent. |
| `package.json` | Adds `"build:icons": "node scripts/build-icons.js"`. |

The source artwork was a JPG with a white background, and `build-icons.js` only
accepts PNG, so the mark was alpha-cropped, padded 6 percent, and resized to a
square PNG:

- `assets/icon.png` - 1024x1024, RGBA, 307,964 bytes
- `assets/icon.ico` - 7 frames: 16, 24, 32, 48, 64, 128, 256 px (150,637 bytes)

One icon file covers all three of the exe, the desktop shortcut, and the
installer, because all three read `assets/icon.ico`.

## Aspect 2: window title bar and taskbar icon

Same `assets/icon.ico`, wired by the `main.js` change from the cherry-pick.
`resolveIconPath()` returns `undefined` rather than a broken path when the file
is missing, so Electron falls back cleanly instead of erroring.

## Aspect 3: sidebar mark (three dots left of "Open Notebook")

This one does not live in this repo. The GUI is the upstream
`lfnovo/open-notebook` Next.js frontend, cloned to `../open-notebook` and
assembled at build time. Patching that clone directly would not survive, because
`resources/runtime/` is gitignored. Forking upstream would make future merges
painful.

So the rebrand is a **build step**. `scripts/apply-branding.js` (new, 140 lines)
patches the temp build directory before compilation:

1. Copies `assets/cu-logo.png` to `<frontend>/public/cu-logo.png`. Next serves
   `public/` verbatim, so it lands at `/cu-logo.png`.
2. Rewrites the `LogoPebbles` component in
   `frontend/src/components/layout/AppSidebar.tsx` from the three colored
   `<span>` pebbles (`bg-fern` / `bg-gold` / `bg-teal`, `size-[9px]`) to an
   `<img src="/cu-logo.png">`. It keeps the same component name and `className`
   contract so both existing call sites keep working, and uses
   `alt="" aria-hidden` because the adjacent app name already conveys the brand
   to screen readers.
3. Fixes the **collapsed** call site. The rail stacks the pebbles with
   `flex-col gap-[3px]`, which is meaningless for an image, so those classes are
   dropped and only the hover fade is kept.
4. Regenerates `frontend/src/app/favicon.ico` from the logo at 16, 32, and
   48 px, reusing `buildIco` / `fitSquare` from `build-icons.js`, so no new
   dependency is introduced.

`assets/cu-logo.png` is 256x256 (34,436 bytes), alpha-cropped with 6 percent
padding. It is deliberately a separate file from `assets/icon.png` so the
in-GUI mark can be tuned independently of the exe icon.

### Two gotchas

- **CRLF.** The upstream clone checks out with CRLF on Windows. The first test
  run failed with `upstream LogoPebbles block not found` because the literal
  match blocks used LF. The script now detects the EOL, normalizes to LF for
  matching and patching, then restores the original EOL on write. If upstream
  changes line endings or restructures the sidebar, it throws a loud, specific
  error instead of silently doing nothing.
- **Idempotent.** If the branded block is already present, the patch returns
  early.

## Aspect 4: wiring and verification

- `scripts/prepare-runtime.js` (+8) requires `apply-branding` and calls
  `applyBranding(buildDir)` inside `buildFrontend()`, after the source copy and
  *before* the npmmirror normalization and `npm ci`. The order matters: branding
  must land before the compile so it is baked into the standalone output.
- `scripts/verify-runtime.js` (+20) adds check 5 to `verifyFrontend()`: it
  asserts `public/cu-logo.png` exists **and** that at least one
  `.next/static/**/*.js` chunk references `cu-logo.png`. Both halves are needed,
  because a present-but-unreferenced logo would mean the sidebar still renders
  the upstream pebbles. Note this is a substring scan over the static tree.
- `README.md` (+13) adds `build:icons` as a build step, documents both the app
  icon and in-app branding flows, adds two architecture-tree entries, and records
  the key decision: *branding as a build step, not a fork*.

## Verification already performed

`node scripts/prepare-runtime.js --step frontend` was run end to end, not just
checked for file presence. It succeeded: `npm ci` (748 packages), Next.js 16.3.4
Turbopack compiled in 40s, TypeScript passed, 15/15 static pages generated, and
"Assembled and verified frontend runtime" printed, meaning `verifyFrontend`
including the new check 5 passed.

A live smoke test followed, against the assembled server on port 8511:

| Request | Result |
| --- | --- |
| `GET /login` | 200 |
| `GET /favicon.ico` | 200, 15,086 bytes (the CU favicon) |
| `GET /cu-logo.png` | 200, 34,436 bytes (the CU mark) |
| `GET /_next/static/chunks/19uaz656mr4o-.js` | 200, and contains `cu-logo.png` |

The last row is the important one: it proves the patched component survived
compilation, rather than only the asset being copied.

## What is NOT done

- **The installed app is untouched.** `C:\Program Files\Office of Equity Open
  Notebook` still has the old frontend and old icon. Launching the app today
  shows no change.
- **`resources/.cache/` does not exist**, so NSIS and `rcedit` are not
  downloaded. `build-installer.js` will exit with an error, and `package.js`
  will skip the exe-icon step. It is `fs.existsSync`-guarded, so it will not
  crash; it will just fall back to the Electron icon.
- **Only the frontend runtime step was run**, so this worktree has
  `resources/runtime/frontend/` and nothing else. A bare `npm start` here will
  not fully boot.
- **The 18px sidebar mark has not been visually confirmed** inside a running
  Electron window. It was sized to sit level with the "Open Notebook" text, but
  the CU crest is detailed and may read as a small badge. This is the most
  likely thing to want tuning: change `size-[18px]` in the `BRAND_BLOCK`
  constant in `scripts/apply-branding.js`.

## How to test

```powershell
npm run prepare:runtime          # all steps; needs network, ~2 GB
npm start                        # dev-mode Electron window
```

To also see the exe and installer icon, download NSIS 3.x into
`resources/.cache/nsis/nsis-3.09/` and `rcedit.exe` into `resources/.cache/rcedit/`,
then:

```powershell
npm run package:app
npm run installer                # reinstalling needs admin
```

To rebrand later, drop a replacement PNG at `assets/cu-logo.png` for the in-GUI
mark or `assets/icon.png` for the app icon, and rerun
`npm run prepare:runtime -- --step frontend` or `npm run build:icons`
respectively.

## Pre-existing bug found, not fixed

`scripts/start-server.js` does `require('./.next/standalone/server.js')`, but
`prepare-runtime.js` flattens `standalone` to the frontend root, so `server.js`
actually sits at `resources/runtime/frontend/server.js`. `start-services.js`
does this correctly by spawning `node server.js`; `start-server.js` would fail.
This is unrelated to branding and is present on `main` too.
