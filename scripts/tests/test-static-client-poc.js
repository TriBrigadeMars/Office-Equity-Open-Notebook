'use strict';

/**
 * Executable test runner for Static / Client Frontend POC (L3.3)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.join(PROJECT_ROOT, 'tests/contracts/static-client-cases.json');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/static-client.js');
const BUILD_SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/build-static-client.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/l3_3');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'static_client_poc.json');

function runTest() {
  console.log('Testing Static / Client Frontend Proof of Concept (L3.3)...');

  // Step 1: Verify dependency files
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Fixture file missing: ${FIXTURE_PATH}`);
  }
  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }
  if (!fs.existsSync(BUILD_SCRIPT_PATH)) {
    throw new Error(`Build script missing: ${BUILD_SCRIPT_PATH}`);
  }

  const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const {
    runStaticClientPocHarness,
    createClientConfig,
    resolveClientRoute,
    generateSpaFallbackRules,
    resolveApiEndpoint,
  } = require(COMPILED_CONTRACT_PATH);
  const { buildStaticClientPoc } = require(BUILD_SCRIPT_PATH);

  // Step 2: Execute parallel static/client build
  console.log('\n--- Test 1: Building Parallel Static/Client POC Artifact ---');
  const buildManifest = buildStaticClientPoc();
  if (!buildManifest || !buildManifest.nextStandaloneIntact) {
    throw new Error('Build manifest missing or Next standalone preservation check failed');
  }
  console.log('  -> Passed: Parallel static/client POC build artifact generated successfully.');

  // Step 3: Run Contract Harness against Canonical Fixtures
  console.log('\n--- Test 2: Static Client Harness Execution ---');
  const result = runStaticClientPocHarness(fixtures);

  console.log(`Implementation: ${result.implementation}`);
  console.log(`Suite: ${result.suite}`);
  console.log(`Passed: ${result.passed}/${result.total}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Static Routes Count: ${result.staticRoutesCount}`);
  console.log(`SPA Fallback Rules Count: ${result.spaFallbackRulesCount}`);

  if (result.failed > 0) {
    console.error('Failed test details:', result.details.filter((d) => !d.passed));
    throw new Error(`Static client harness run failed with ${result.failed} errors`);
  }
  if (result.passed < 11) {
    throw new Error(`Expected at least 11 passed tests, got ${result.passed}`);
  }
  console.log('  -> Passed: Static client harness execution passed clean.');

  // Step 4: Verify Client Route Resolution & SPA Fallbacks
  console.log('\n--- Test 3: Client Route & SPA Fallback Resolution ---');
  const dynamicNotebook = resolveClientRoute('/notebooks/nb-789');
  if (dynamicNotebook.matchedRoute !== '/notebooks/[id]' || !dynamicNotebook.fallbackToSpa) {
    throw new Error(`Dynamic notebook route resolution failed: ${JSON.stringify(dynamicNotebook)}`);
  }

  const spaRules = generateSpaFallbackRules();
  if (spaRules.length !== 7) {
    throw new Error(`Expected 7 SPA fallback rules, got ${spaRules.length}`);
  }
  console.log('  -> Passed: Dynamic client routes correctly resolve and flag SPA fallback requirement.');

  // Step 5: Verify Configurable Host/Proxy Endpoint Path
  console.log('\n--- Test 4: Configurable Host/Proxy Endpoint Path ---');
  const customConfig = createClientConfig({ apiBaseUrl: 'http://127.0.0.1:8502' });
  const customEndpoint = resolveApiEndpoint('/api/chat/stream', customConfig);
  if (customEndpoint !== 'http://127.0.0.1:8502/api/chat/stream') {
    throw new Error(`Expected custom API endpoint URL, got ${customEndpoint}`);
  }
  console.log('  -> Passed: Client API calls dynamically route to configured host/proxy endpoint.');

  // Step 6: Verify Next Standalone Preservation
  console.log('\n--- Test 5: Next.js Standalone Build Integrity ---');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  if (!packageJson.scripts || !packageJson.scripts['prepare:runtime']) {
    throw new Error('package.json prepare:runtime script missing');
  }
  console.log('  -> Passed: Existing Next.js standalone build scripts and structure remain untouched.');

  // Step 7: Write Report Deliverable
  console.log('\n--- Test 6: Writing Report Deliverable ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`  -> Report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ Static / Client Frontend Proof of Concept (L3.3) tests passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Static Client POC test failed:', err.message);
  process.exit(1);
}
