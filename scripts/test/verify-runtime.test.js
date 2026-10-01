'use strict';

/**
 * Plain Node tests for the runtime verifier (ADR-0002: dependency-free).
 * Fixture frontends are built from empty files in a temp dir — no real
 * runtime needed. Run with `npm test`.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyFrontend, verifyRuntime } = require('../verify-runtime');
const { REQUIRED_RUNTIME_FILES, verifyRuntimeFiles } = require('../lib/runtime-manifest');

const fixtures = [];

function write(rel) {
  return (root) => {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
  };
}

function buildFrontendFixture() {
  const buildId = 'testbuild123';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onb-verify-'));
  fixtures.push(root);

  [
    'server.js',
    'node_modules/next/dist/server/next.js',
    'node_modules/next/dist/server/lib/start-server.js',
    'node_modules/@next/env/dist/index.js',
    'node_modules/react/index.js',
    'node_modules/react-dom/index.js',
    '.next/BUILD_ID',
    `.next/static/${buildId}/chunk.js`,
    '.next/server/page.html',
    'public/cu-logo.png',
  ].forEach((rel) => write(rel)(root));

  fs.writeFileSync(path.join(root, '.next', 'BUILD_ID'), buildId, 'utf8');
  // Prerendered HTML referencing the static chunk by build id.
  fs.writeFileSync(
    path.join(root, '.next', 'server', 'page.html'),
    `<script src="/_next/static/${buildId}/chunk.js"></script>`,
    'utf8'
  );
  // A client chunk containing the branding string (check 5).
  fs.writeFileSync(
    path.join(root, '.next', 'static', buildId, 'chunk.js'),
    'module.exports = "<img src=/cu-logo.png>";',
    'utf8'
  );
  return root;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// --- healthy fixture --------------------------------------------------------

const frontend = buildFrontendFixture();

test('healthy fixture yields zero problems', () => {
  assert.deepStrictEqual(verifyFrontend(frontend), []);
});

// --- one mutation at a time ---------------------------------------------------

function withMutation(name, mutate, expectedCheck, messagePart, expectedCount = 1) {
  const root = buildFrontendFixture();
  mutate(root);
  test(name, () => {
    const problems = verifyFrontend(root);
    assert.strictEqual(problems.length, expectedCount, `expected ${expectedCount} problems, got: ${JSON.stringify(problems)}`);
    assert.strictEqual(problems[0].check, expectedCheck);
    const last = problems[problems.length - 1];
    assert.ok(last.message.includes(messagePart), `message should include ${messagePart}`);
  });
}

withMutation(
  'missing server.js reports nested-hint when a nested copy exists',
  (root) => {
    fs.rmSync(path.join(root, 'server.js'));
    write('nested/server.js')(root);
  },
  'server-js-root',
  'Found server.js nested at',
  2
);

withMutation(
  'stubbed react package is reported',
  (root) => {
    fs.rmSync(path.join(root, 'node_modules', 'react', 'index.js'));
  },
  'node-modules-stub',
  'node_modules/react/index.js is missing'
);

withMutation(
  'BUILD_ID / static mismatch is reported',
  (root) => {
    fs.writeFileSync(path.join(root, '.next', 'BUILD_ID'), 'otherbuild', 'utf8');
  },
  'build-id-mismatch',
  '.next/static/otherbuild does not exist'
);

withMutation(
  'missing cu-logo.png is reported',
  (root) => {
    fs.rmSync(path.join(root, 'public', 'cu-logo.png'));
  },
  'branding',
  'public/cu-logo.png is missing'
);

withMutation(
  'no client chunk referencing cu-logo.png is reported',
  (root) => {
    fs.writeFileSync(
      path.join(root, '.next', 'static', 'testbuild123', 'chunk.js'),
      'module.exports = "nothing branded here";',
      'utf8'
    );
  },
  'branding',
  'No client chunk references cu-logo.png'
);

// --- manifest / runtime-level checks -----------------------------------------

test('REQUIRED_RUNTIME_FILES has the canonical five entries', () => {
  assert.deepStrictEqual(REQUIRED_RUNTIME_FILES, [
    'python/python.exe',
    'backend/open_notebook',
    'surreal/surreal.exe',
    'node/node.exe',
    'frontend/server.js',
  ]);
});

test('empty runtime dir yields 5 file-exists problems', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onb-runtime-'));
  fixtures.push(root);
  const problems = verifyRuntimeFiles(root);
  assert.strictEqual(problems.length, 5);
  problems.forEach((p) => {
    assert.strictEqual(p.check, 'file-exists');
    assert.ok(p.message.length > 0);
  });
});

test('verifyRuntime composes file checks with frontend checks', () => {
  // All required runtime files present; the copied-in frontend is healthy
  // except for the missing branding logo — expect exactly one problem.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onb-runtime2-'));
  fixtures.push(root);
  REQUIRED_RUNTIME_FILES.forEach((f) => write(f)(root));
  fs.cpSync(frontend, path.join(root, 'frontend'), { recursive: true });
  fs.rmSync(path.join(root, 'frontend', 'public', 'cu-logo.png'));

  const problems = verifyRuntime(root);
  assert.strictEqual(problems.length, 1);
  assert.strictEqual(problems[0].check, 'branding');
});

// --- cleanup -------------------------------------------------------------------

fixtures.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
console.log(`\n${passed} tests passed`);
