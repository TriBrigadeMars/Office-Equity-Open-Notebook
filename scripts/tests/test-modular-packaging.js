'use strict';

/**
 * Contract verification test suite for L5.1 Modular Runtime Packaging.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.join(__dirname, '../..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const modularPackagingPath = path.join(DIST_DIR, 'src', 'contracts', 'modular-packaging.js');
const runtimeManifestPath = path.join(DIST_DIR, 'src', 'contracts', 'runtime-manifest.js');

if (!fs.existsSync(modularPackagingPath) || !fs.existsSync(runtimeManifestPath)) {
  console.error('Error: Built contract modules not found in dist/src/contracts/. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  MODULAR_COMPONENT_DEFINITIONS,
  validateRuntimeAllowlist,
  verifyComponentRequirements,
  generateModularPackagingGraph,
  comparePackagingVariants,
} = require(modularPackagingPath);

const {
  verifyRuntimePaths,
} = require(runtimeManifestPath);

console.log('Testing Modular Runtime Packaging Contracts (L5.1)...\n');

// ============================================================================
// Test Suite 1: Component Definition Inventory
// ============================================================================
console.log('--- Suite 1: Component Definitions & Requirements ---');
{
  assert.ok(MODULAR_COMPONENT_DEFINITIONS.core_host_frontend, 'Core host component defined');
  assert.ok(MODULAR_COMPONENT_DEFINITIONS.surrealdb, 'SurrealDB component defined');
  assert.ok(MODULAR_COMPONENT_DEFINITIONS.python_backend, 'Python backend component defined');
  assert.ok(MODULAR_COMPONENT_DEFINITIONS.docling, 'Docling component defined');
  assert.ok(MODULAR_COMPONENT_DEFINITIONS.tiktoken_cache, 'Tiktoken cache component defined');

  assert.strictEqual(MODULAR_COMPONENT_DEFINITIONS.core_host_frontend.category, 'required');
  assert.strictEqual(MODULAR_COMPONENT_DEFINITIONS.surrealdb.category, 'required');
  assert.strictEqual(MODULAR_COMPONENT_DEFINITIONS.python_backend.category, 'required');
  assert.strictEqual(MODULAR_COMPONENT_DEFINITIONS.docling.category, 'optional');
  assert.strictEqual(MODULAR_COMPONENT_DEFINITIONS.tiktoken_cache.category, 'optional');

  console.log('  -> All 5 modular component definitions validated');
}

// ============================================================================
// Test Suite 2: Allowlist Path Validation
// ============================================================================
console.log('\n--- Suite 2: Allowlist Path Enforcement ---');
{
  const validFiles = [
    'frontend/static/index.html',
    'surreal/surreal.exe',
    'python/python.exe',
    'python/Lib/site-packages/docling/index.py',
    'backend/open_notebook/main.py',
    'tiktoken-cache/o200k_base.tiktoken',
    'manifest.json',
  ];

  const validRes = validateRuntimeAllowlist(validFiles);
  assert.strictEqual(validRes.valid, true, 'Valid file list must pass allowlist');
  assert.strictEqual(validRes.unallowlistedPaths.length, 0);
  console.log('  -> Allowlisted file tree passed validation');

  const invalidFiles = [
    'frontend/static/index.html',
    'surreal/surreal.exe',
    'unauthorized_binary.exe',
    'temp/secret_dump.txt',
  ];

  const invalidRes = validateRuntimeAllowlist(invalidFiles);
  assert.strictEqual(invalidRes.valid, false, 'Unallowlisted files must fail allowlist');
  assert.deepStrictEqual(invalidRes.unallowlistedPaths, ['unauthorized_binary.exe', 'temp/secret_dump.txt']);
  console.log('  -> Unallowlisted files correctly rejected');
}

// ============================================================================
// Test Suite 3: Required Component Omission Check
// ============================================================================
console.log('\n--- Suite 3: Required vs Optional Component Omission ---');
{
  const fullComponents = ['core_host_frontend', 'surrealdb', 'python_backend', 'docling', 'tiktoken_cache'];
  const fullReqCheck = verifyComponentRequirements(fullComponents);
  assert.strictEqual(fullReqCheck.valid, true);
  assert.strictEqual(fullReqCheck.missingRequired.length, 0);
  console.log('  -> Full component set passes required check');

  const coreComponents = ['core_host_frontend', 'surrealdb', 'python_backend'];
  const coreReqCheck = verifyComponentRequirements(coreComponents);
  assert.strictEqual(coreReqCheck.valid, true);
  assert.strictEqual(coreReqCheck.missingRequired.length, 0);
  console.log('  -> Core component set (without optional docling/tiktoken) passes required check');

  const missingSurreal = ['core_host_frontend', 'python_backend'];
  const missingSurrealCheck = verifyComponentRequirements(missingSurreal);
  assert.strictEqual(missingSurrealCheck.valid, false);
  assert.deepStrictEqual(missingSurrealCheck.missingRequired, ['surrealdb']);
  console.log('  -> Missing required component (surrealdb) fails with explicit error');
}

// ============================================================================
// Test Suite 4: Modular Packaging Graph & Variant Comparison
// ============================================================================
console.log('\n--- Suite 4: Graph Generation & Variant Size Comparison ---');
{
  const fullGraph = generateModularPackagingGraph({
    upstreamCommit: 'a1b2c3d',
    wrapperCommit: 'e5f6g7h',
    buildTimestamp: '2025-01-01T00:00:00Z',
    targetArchitecture: 'x64',
    variant: 'full',
    components: {
      core_host_frontend: { name: 'Core Host & Frontend', path: 'frontend/static', status: 'present', category: 'required', sizeBytes: 25000000 },
      surrealdb: { name: 'SurrealDB', path: 'surreal/surreal.exe', status: 'present', category: 'required', sizeBytes: 45000000 },
      python_backend: { name: 'Python Core Backend', path: 'python', status: 'present', category: 'required', sizeBytes: 250000000 },
      docling: { name: 'Docling Extraction Engine', path: 'python/Lib/site-packages/docling', status: 'present', category: 'optional', sizeBytes: 350000000 },
      tiktoken_cache: { name: 'Tiktoken Cache', path: 'tiktoken-cache', status: 'present', category: 'optional', sizeBytes: 15000000 },
    },
    runtimeFiles: [
      'frontend/static/index.html',
      'surreal/surreal.exe',
      'python/python.exe',
      'backend/open_notebook/main.py',
      'python/Lib/site-packages/docling/index.py',
      'tiktoken-cache/cache.bin',
      'manifest.json',
    ],
  });

  assert.strictEqual(fullGraph.variant, 'full');
  assert.strictEqual(fullGraph.totalSizeBytes, 685000000);
  assert.strictEqual(fullGraph.allowlistPassed, true);
  console.log('  -> Full packaging graph generated successfully');

  const coreGraph = generateModularPackagingGraph({
    upstreamCommit: 'a1b2c3d',
    wrapperCommit: 'e5f6g7h',
    buildTimestamp: '2025-01-01T00:00:00Z',
    targetArchitecture: 'x64',
    variant: 'core_minimal',
    components: {
      core_host_frontend: { name: 'Core Host & Frontend', path: 'frontend/static', status: 'present', category: 'required', sizeBytes: 25000000 },
      surrealdb: { name: 'SurrealDB', path: 'surreal/surreal.exe', status: 'present', category: 'required', sizeBytes: 45000000 },
      python_backend: { name: 'Python Core Backend', path: 'python', status: 'present', category: 'required', sizeBytes: 250000000 },
    },
    runtimeFiles: [
      'frontend/static/index.html',
      'surreal/surreal.exe',
      'python/python.exe',
      'backend/open_notebook/main.py',
      'manifest.json',
    ],
  });

  assert.strictEqual(coreGraph.variant, 'core_minimal');
  assert.strictEqual(coreGraph.totalSizeBytes, 320000000);
  assert.strictEqual(coreGraph.allowlistPassed, true);
  console.log('  -> Core minimal packaging graph generated successfully');

  const comparison = comparePackagingVariants(fullGraph, coreGraph);
  assert.strictEqual(comparison.fullSizeBytes, 685000000);
  assert.strictEqual(comparison.coreSizeBytes, 320000000);
  assert.strictEqual(comparison.savingsBytes, 365000000);
  assert.strictEqual(comparison.savingsPercent, 53.28);
  assert.deepStrictEqual(comparison.omittedComponents, ['docling', 'tiktoken_cache']);

  console.log(`  -> Size comparison validated: Core savings of ${comparison.savingsBytes} bytes (${comparison.savingsPercent}%)`);
}

// ============================================================================
// Test Suite 5: Extended verifyRuntimePaths with Allowlist
// ============================================================================
console.log('\n--- Suite 5: Integrated Path Verification ---');
{
  const existingFiles = new Set([
    '/runtime/surreal/surreal.exe',
    '/runtime/backend/open_notebook',
    '/runtime/frontend/static',
  ]);

  const validRes = verifyRuntimePaths('/runtime', (p) => existingFiles.has(p), {
    allowlistFn: validateRuntimeAllowlist,
    allRuntimeFiles: ['surreal/surreal.exe', 'backend/open_notebook', 'frontend/static'],
  });

  assert.strictEqual(validRes.valid, true);
  console.log('  -> Integrated verifyRuntimePaths passed on clean tree');

  const unallowlistedRes = verifyRuntimePaths('/runtime', (p) => existingFiles.has(p), {
    allowlistFn: validateRuntimeAllowlist,
    allRuntimeFiles: ['surreal/surreal.exe', 'backend/open_notebook', 'frontend/static', 'unknown_payload.exe'],
  });

  assert.strictEqual(unallowlistedRes.valid, false);
  assert.deepStrictEqual(unallowlistedRes.unallowlistedPaths, ['unknown_payload.exe']);
  console.log('  -> Integrated verifyRuntimePaths failed on unallowlisted tree');
}

console.log('\n✅ All Modular Runtime Packaging Contract tests passed successfully.');
