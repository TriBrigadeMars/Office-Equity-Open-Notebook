'use strict';

/**
 * Contract verification test suite for L0.3b runtime manifest, runtime resolution,
 * and window policy modules.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.join(__dirname, '../..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Resolve built contracts from dist/src/contracts/
const runtimeManifestPath = path.join(DIST_DIR, 'src', 'contracts', 'runtime-manifest.js');
const runtimeResolutionPath = path.join(DIST_DIR, 'src', 'contracts', 'runtime-resolution.js');
const windowPolicyPath = path.join(DIST_DIR, 'src', 'contracts', 'window-policy.js');

if (!fs.existsSync(runtimeManifestPath) || !fs.existsSync(runtimeResolutionPath) || !fs.existsSync(windowPolicyPath)) {
  console.error('Error: Built contract modules not found in dist/src/contracts/. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  parseRuntimeManifest,
  validateRuntimeManifest,
  verifyRuntimePaths,
} = require(runtimeManifestPath);

const {
  resolvePython,
  resolveNode,
  parsePythonVersion,
  parseNodeVersion,
} = require(runtimeResolutionPath);

const {
  evaluateNavigationPolicy,
} = require(windowPolicyPath);

console.log('Testing Runtime & Navigation Policy Contracts...');

// ============================================================================
// Test Suite 1: Runtime Manifest Contracts
// ============================================================================

console.log('\n--- Suite 1: Runtime Manifest ---');
const manifestCases = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'tests', 'contracts', 'runtime-manifest-cases.json'), 'utf8')
);

// 1.1 Valid Manifests
for (const [idx, tc] of manifestCases.validManifests.entries()) {
  const result = parseRuntimeManifest(tc.input);
  assert.strictEqual(result.upstreamCommit, tc.expectedUpstreamCommit);
  console.log(`  -> Valid manifest case ${idx + 1} passed`);
}

// 1.2 Invalid Manifests
for (const [idx, tc] of manifestCases.invalidManifests.entries()) {
  assert.throws(
    () => parseRuntimeManifest(tc.input),
    (err) => err instanceof Error && err.message.length > 0,
    `Failed to throw on invalid manifest: ${tc.description}`
  );
  console.log(`  -> Invalid manifest case ${idx + 1} (${tc.description}) passed`);
}

// 1.3 Path Verification
for (const [idx, tc] of manifestCases.pathVerificationCases.entries()) {
  const existingSet = new Set(tc.existingFiles);
  const verification = verifyRuntimePaths(tc.runtimePath, (p) => existingSet.has(p));
  assert.strictEqual(verification.valid, tc.expectedValid);
  assert.deepStrictEqual(verification.missingPaths, tc.expectedMissing);
  console.log(`  -> Path verification case ${idx + 1} passed`);
}

// ============================================================================
// Test Suite 2: Runtime Resolution Contracts
// ============================================================================

console.log('\n--- Suite 2: Runtime Resolution ---');
const resolutionCases = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'tests', 'contracts', 'runtime-resolution-cases.json'), 'utf8')
);

// 2.1 Python Resolution Cases
for (const tc of resolutionCases.pythonCases) {
  const existingSet = new Set(tc.existingFiles);
  const result = resolvePython(tc.runtimePath, {
    fileExists: (p) => existingSet.has(p),
    findOnPath: (cmd) => (tc.systemPath && (cmd === 'python.exe' || cmd === 'python') ? tc.systemPath : null),
    getVersion: (cmdPath) => (cmdPath === tc.systemPath ? tc.versionOutput : null),
    pathJoin: (...parts) => parts.join('/'),
  });

  if (tc.expectedResultNull) {
    assert.strictEqual(result, null);
  } else {
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.source, tc.expectedSource);
    assert.strictEqual(result.path, tc.expectedPath);
    if (tc.expectedInvalidVersion !== undefined && tc.expectedInvalidVersion !== null) {
      assert.strictEqual(result.invalidVersion, tc.expectedInvalidVersion);
    } else {
      assert.strictEqual(result.invalidVersion, undefined);
    }
  }
  console.log(`  -> Python case passed: ${tc.description}`);
}

// 2.2 Node Resolution Cases
for (const tc of resolutionCases.nodeCases) {
  const existingSet = new Set(tc.existingFiles);
  const result = resolveNode(tc.runtimePath, {
    fileExists: (p) => existingSet.has(p),
    findOnPath: (cmd) => (tc.systemPath && (cmd === 'node.exe' || cmd === 'node') ? tc.systemPath : null),
    getVersion: (cmdPath) => (cmdPath === tc.systemPath ? tc.versionOutput : null),
    pathJoin: (...parts) => parts.join('/'),
  });

  if (tc.expectedResultNull) {
    assert.strictEqual(result, null);
  } else {
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.source, tc.expectedSource);
    assert.strictEqual(result.path, tc.expectedPath);
    if (tc.expectedInvalidVersion !== undefined && tc.expectedInvalidVersion !== null) {
      assert.strictEqual(result.invalidVersion, tc.expectedInvalidVersion);
    } else {
      assert.strictEqual(result.invalidVersion, undefined);
    }
  }
  console.log(`  -> Node case passed: ${tc.description}`);
}

// 2.3 Version Parser Helpers
assert.deepStrictEqual(parsePythonVersion('Python 3.12.1'), { major: 3, minor: 12 });
assert.deepStrictEqual(parseNodeVersion('v22.14.0'), { major: 22 });
console.log('  -> Version parser helper tests passed');

// ============================================================================
// Test Suite 3: Navigation & Window Policy Contracts
// ============================================================================

console.log('\n--- Suite 3: Window Navigation Policy ---');
const windowCases = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'tests', 'contracts', 'window-policy-cases.json'), 'utf8')
);

for (const tc of windowCases.cases) {
  const decision = evaluateNavigationPolicy(tc.targetUrl, windowCases.frontendUrl);
  assert.strictEqual(decision.action, tc.expectedAction);
  assert.ok(
    decision.reason && decision.reason.includes(tc.expectedReasonSubstring),
    `Reason "${decision.reason}" did not contain "${tc.expectedReasonSubstring}"`
  );
  console.log(`  -> Policy case passed: ${tc.description}`);
}

console.log('\n✅ All Runtime & Navigation Policy Contract tests passed successfully.');
