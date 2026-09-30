'use strict';

/**
 * package.js — manual Windows packaging.
 *
 * Assembles a self-contained unpacked app directory without electron-builder,
 * which on non-admin Windows fails to extract its code-signing cache (7-Zip
 * cannot create the macOS symlinks without admin/Developer Mode).
 *
 * The output is a runnable `Office of Equity Open Notebook.exe` with the app code and the
 * bundled runtime in `resources/`.
 *
 * Usage:
 *   node scripts/package.js [--out <dir>]
 */

const fs = require('fs');
const path = require('path');
const { verifyFrontend } = require('./verify-runtime');
const { arg, run } = require('./lib/cli');
const { rmrf, cp } = require('./lib/fsx');
const { PROJECT_DIR, RUNTIME_DIR, CACHE_DIR, OUT_DIR, PRODUCT_NAME, VERSION } = require('./lib/paths');

const ELECTRON_DIST = path.join(PROJECT_DIR, 'node_modules', 'electron', 'dist');

function main() {
  const outDir = arg('--out', OUT_DIR);
  const appDir = path.join(outDir, PRODUCT_NAME);

  if (!fs.existsSync(ELECTRON_DIST)) {
    console.error(`Electron dist not found at ${ELECTRON_DIST}. Run \`npm install\` first.`);
    process.exit(1);
  }

  const required = [
    ['python', 'python.exe'],
    ['backend', 'open_notebook'],
    ['surreal', 'surreal.exe'],
    ['node', 'node.exe'],
    ['frontend', 'server.js'],
  ];
  const missing = required
    .map(([dir, file]) => path.join(RUNTIME_DIR, dir, file))
    .filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    console.error('Runtime not prepared or incomplete. Run `npm run prepare:runtime` first.\nMissing:');
    missing.forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }

  const frontendProblems = verifyFrontend(path.join(RUNTIME_DIR, 'frontend'));
  if (frontendProblems.length > 0) {
    console.error('Frontend runtime is incomplete. Re-run `npm run prepare:runtime -- --step frontend`.');
    frontendProblems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }

  console.log(`Packaging app into ${appDir}`);
  rmrf(appDir);

  // 1. Copy the Electron runtime
  console.log('  copying Electron runtime...');
  cp(ELECTRON_DIST, appDir);

  // 2. Rename the executable
  const exe = path.join(appDir, 'electron.exe');
  const productExe = path.join(appDir, `${PRODUCT_NAME}.exe`);
  fs.renameSync(exe, productExe);

  // 3. Replace the default app with our app code (loose files, no asar)
  const appRes = path.join(appDir, 'resources', 'app');
  rmrf(path.join(appDir, 'resources', 'default_app.asar'));
  rmrf(appRes);
  fs.mkdirSync(appRes, { recursive: true });
  for (const item of ['main.js', 'preload.js', 'package.json']) {
    cp(path.join(PROJECT_DIR, item), path.join(appRes, item));
  }
  cp(path.join(PROJECT_DIR, 'scripts'), path.join(appRes, 'scripts'));
  // The window/taskbar icon is loaded at runtime from `assets/icon.ico`
  // relative to the app code, so it has to ship alongside it.
  const assetsDir = path.join(PROJECT_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    cp(assetsDir, path.join(appRes, 'assets'));
  }

  // 4. Copy the bundled runtime into resources/runtime
  console.log('  copying bundled runtime (this is large)...');
  cp(RUNTIME_DIR, path.join(appDir, 'resources', 'runtime'));

  // 5. Ensure Python bytecode (.pyc) is compiled so read-only installations
  // (like Program Files) do not suffer slow cold starts and AST re-parsing.
  const packagedPython = path.join(appDir, 'resources', 'runtime', 'python', 'python.exe');
  const packagedBackend = path.join(appDir, 'resources', 'runtime', 'backend');
  const packagedLib = path.join(appDir, 'resources', 'runtime', 'python', 'Lib');
  if (fs.existsSync(packagedPython)) {
    console.log('  verifying/compiling Python bytecode (.pyc)...');
    try {
      if (fs.existsSync(packagedLib)) {
        run(packagedPython, ['-m', 'compileall', '-q', '-j', '0', packagedLib], { timeout: 600000 });
      }
      if (fs.existsSync(packagedBackend)) {
        run(packagedPython, ['-m', 'compileall', '-q', '-j', '0', packagedBackend], { timeout: 300000 });
      }
    } catch (err) {
      console.warn(`  warning during bytecode compilation: ${err.message}`);
    }
  }

  // 6. Set icon and version metadata on the exe using rcedit.
  const iconSrc = path.join(PROJECT_DIR, 'assets', 'icon.ico');
  const rcedit = path.join(CACHE_DIR, 'rcedit', 'rcedit.exe');
  if (fs.existsSync(productExe) && fs.existsSync(rcedit) && fs.existsSync(iconSrc)) {
    console.log('  setting exe icon and metadata...');
    run(rcedit, [
      productExe,
      '--set-icon', iconSrc,
      '--set-version-string', 'FileDescription', PRODUCT_NAME,
      '--set-version-string', 'ProductName', PRODUCT_NAME,
      '--set-version-string', 'CompanyName', `${PRODUCT_NAME} Desktop`,
      '--set-version-string', 'OriginalFilename', `${PRODUCT_NAME}.exe`,
      '--set-version-string', 'InternalName', PRODUCT_NAME,
      '--set-file-version', VERSION,
      '--set-product-version', VERSION,
    ]);
  } else {
    console.warn('  rcedit or icon not found; exe will use default Electron metadata.');
  }

  console.log(`\n✅ Packaged app: ${productExe}`);
  console.log(`Run it directly, or build the installer with \`npm run installer\`.`);
}

main();
