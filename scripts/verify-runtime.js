'use strict';

/**
 * verify-runtime.js
 *
 * Sanity checks for the assembled Next.js frontend runtime. A Next.js
 * "standalone" build can look fine on disk yet be unusable:
 *
 *   - server.js is nested under a sub-folder (Next infers a workspace root
 *     above the build dir when it finds another lockfile, e.g. this repo's own
 *     package-lock.json).
 *   - node_modules/next (or another package) is a stub with no `dist/`.
 *   - .next/static comes from a different build than .next/server, so the HTML
 *     references JS chunks that 404 and the window stays blank.
 *
 * Usage:
 *   node scripts/verify-runtime.js [frontend-dir]
 *
 * Exits non-zero and prints every problem found.
 */

const fs = require('fs');
const path = require('path');
const { walk } = require('./lib/fsx');
const { RUNTIME_DIR } = require('./lib/paths');
const { verifyRuntimeFiles } = require('./lib/runtime-manifest');

const DEFAULT_FRONTEND = path.join(RUNTIME_DIR, 'frontend');

/**
 * @param {string} frontendDir  Path to runtime/frontend.
 * @returns {{check: string, message: string}[]} Structured problems (empty
 *   when the frontend runtime looks good).
 */
function verifyFrontend(frontendDir = DEFAULT_FRONTEND) {
  const problems = [];
  const rel = (p) => path.relative(frontendDir, p) || '.';

  if (!fs.existsSync(frontendDir)) {
    return [{ check: 'frontend-dir', message: `Frontend directory not found: ${frontendDir}` }];
  }

  // 1. Entry point must sit at the top level.
  const serverJs = path.join(frontendDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    problems.push({ check: 'server-js-root', message: 'server.js is missing from the frontend root.' });
    const nested = [];
    walk(frontendDir, (f) => {
      if (path.basename(f) === 'server.js' && !f.includes(`${path.sep}node_modules${path.sep}`)) nested.push(f);
    });
    if (nested.length > 0) {
      problems.push({
        check: 'server-js-root',
        message:
          `Found server.js nested at ${rel(nested[0])}. Next.js inferred a workspace root above the build ` +
          'directory (another lockfile in a parent folder). Build the frontend outside the project tree.',
      });
    }
    return problems;
  }

  // 2. node_modules must contain real packages, not stubs.
  const nodeModules = path.join(frontendDir, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    problems.push({ check: 'node-modules-stub', message: 'node_modules is missing from the frontend root.' });
  } else {
    const critical = [
      path.join('next', 'dist', 'server', 'next.js'),
      path.join('next', 'dist', 'server', 'lib', 'start-server.js'),
      path.join('@next', 'env', 'dist', 'index.js'),
      path.join('react', 'index.js'),
      path.join('react-dom', 'index.js'),
    ];
    // Only check files the server is known to load. Standalone tracing
    // legitimately prunes unused files from other packages, so a generic
    // "does every package's main exist" scan would report false positives.
    for (const file of critical) {
      if (!fs.existsSync(path.join(nodeModules, file))) {
        problems.push({
          check: 'node-modules-stub',
          message: `node_modules/${file.split(path.sep).join('/')} is missing (stub or incomplete package).`,
        });
      }
    }
  }

  // 3. .next build output must be internally consistent.
  const nextDir = path.join(frontendDir, '.next');
  const buildIdFile = path.join(nextDir, 'BUILD_ID');
  const staticDir = path.join(nextDir, 'static');
  if (!fs.existsSync(buildIdFile)) {
    problems.push({ check: 'build-id-mismatch', message: '.next/BUILD_ID is missing.' });
  } else if (!fs.existsSync(staticDir)) {
    problems.push({ check: 'build-id-mismatch', message: '.next/static is missing.' });
  } else {
    const buildId = fs.readFileSync(buildIdFile, 'utf8').trim();
    if (!fs.existsSync(path.join(staticDir, buildId))) {
      problems.push({
        check: 'build-id-mismatch',
        message:
          `.next/BUILD_ID is "${buildId}" but .next/static/${buildId} does not exist. ` +
          '.next/static was copied from a different build than .next/server.',
      });
    }
  }

  // 4. Every asset referenced by the prerendered HTML must exist on disk.
  const serverDir = path.join(nextDir, 'server');
  if (!fs.existsSync(serverDir)) {
    problems.push({ check: 'missing-assets', message: '.next/server is missing.' });
  } else {
    const missingAssets = new Set();
    const pattern = /\/_next\/static\/([^"'\\\s<>]+\.(?:js|css))/g;
    walk(serverDir, (file) => {
      if (!file.endsWith('.html')) return;
      const html = fs.readFileSync(file, 'utf8');
      let m;
      while ((m = pattern.exec(html)) !== null) {
        let asset = m[1];
        try {
          asset = decodeURIComponent(asset);
        } catch (_) {
          /* keep raw */
        }
        if (!fs.existsSync(path.join(staticDir, asset))) missingAssets.add(asset);
      }
    });
    if (missingAssets.size > 0) {
      const sample = [...missingAssets].slice(0, 5).join(', ');
      problems.push({
        check: 'missing-assets',
        message:
          `${missingAssets.size} asset(s) referenced by prerendered pages are missing from .next/static ` +
          `(the UI would render blank). e.g. ${sample}`,
      });
    }
  }

  // 5. The Office of Equity rebrand must have reached the build. The sidebar
  // mark ships as a static file in public/ plus a <img src="/cu-logo.png"> in a
  // client chunk, so a passing check needs both halves present.
  const brandedLogo = path.join(frontendDir, 'public', 'cu-logo.png');
  if (!fs.existsSync(brandedLogo)) {
    problems.push({ check: 'branding', message: 'public/cu-logo.png is missing (Office of Equity branding was not applied).' });
  }
  let referencesBrand = false;
  if (fs.existsSync(staticDir)) {
    walk(staticDir, (file) => {
      if (referencesBrand || !file.endsWith('.js')) return;
      if (fs.readFileSync(file, 'utf8').includes('cu-logo.png')) referencesBrand = true;
    });
  }
  if (!referencesBrand) {
    problems.push({
      check: 'branding',
      message: 'No client chunk references cu-logo.png (the sidebar still renders the upstream pebble mark).',
    });
  }

  return problems;
}

/**
 * One-call verdict on the whole assembled runtime: manifest required-file
 * checks plus the deep frontend verification.
 *
 * @param {string} runtimeDir  Path to the assembled runtime directory.
 * @returns {{check: string, message: string}[]} Structured problems (empty =
 *   healthy).
 */
function verifyRuntime(runtimeDir) {
  return [...verifyRuntimeFiles(runtimeDir), ...verifyFrontend(path.join(runtimeDir, 'frontend'))];
}

module.exports = { verifyFrontend, verifyRuntime };

if (require.main === module) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FRONTEND;
  const problems = verifyFrontend(dir);
  if (problems.length > 0) {
    console.error(`Frontend runtime check FAILED for ${dir}:`);
    problems.forEach((p) => console.error(`  - ${p.message}`));
    process.exit(1);
  }
  console.log(`Frontend runtime check passed for ${dir}`);
}
