'use strict';

/**
 * Executable test runner for Native Host Proxy & Static Serving (X19)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/native-proxy.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/x19');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'native_host_proxy.json');

function runTest() {
  console.log('Testing Native Host Proxy & Static Serving Implementation (X19)...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled contract module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const {
    runNativeProxyHarness,
    validateNativeProxyResult,
    validatePathTraversal,
    simulateNativeStaticRequest,
    simulateNativeProxyRequest,
    simulateNativeSseStream,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 1: Execute Native Host Proxy Harness
  console.log('\n--- Test 1: Native Host Proxy Harness Execution ---');
  const result = runNativeProxyHarness();

  console.log(`Implementation: ${result.implementation}`);
  console.log(`Suite: ${result.suite}`);
  console.log(`Passed: ${result.passed}/${result.total}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Duration: ${result.durationMs} ms`);

  if (result.failed > 0) {
    console.error('Failed test details:', result.details.filter((d) => !d.passed));
    throw new Error(`Native host proxy harness failed with ${result.failed} errors`);
  }
  if (result.passed < 18) {
    throw new Error(`Expected at least 18 passed tests, got ${result.passed}`);
  }
  console.log('  -> Passed: Native host proxy harness execution succeeded clean.');

  // Step 2: Validate Compatibility Schema
  console.log('\n--- Test 2: Schema Validation ---');
  const schemaValidation = validateNativeProxyResult(result);
  if (!schemaValidation.valid) {
    throw new Error(`Result schema validation failed: ${schemaValidation.errors.join(', ')}`);
  }
  console.log('  -> Passed: Native proxy result schema is valid.');

  // Step 3: Validate Path Traversal Protections
  console.log('\n--- Test 3: Path Traversal Security Checks ---');
  const malicious1 = validatePathTraversal('/var/www/static', '../etc/passwd');
  if (malicious1.isSafe) {
    throw new Error('Failed to block explicit path traversal sequence (../etc/passwd)');
  }

  const malicious2 = validatePathTraversal('/var/www/static', '..%2f..%2fetc%2fpasswd');
  if (malicious2.isSafe) {
    throw new Error('Failed to block URL-encoded traversal sequence (..%2f..%2fetc%2fpasswd)');
  }

  const safePath = validatePathTraversal('/var/www/static', '/assets/app.js');
  if (!safePath.isSafe) {
    throw new Error('Incorrectly blocked valid path (/assets/app.js)');
  }
  console.log('  -> Passed: Path traversal security protections operational.');

  // Step 4: Validate Static SPA Fallback
  console.log('\n--- Test 4: SPA Fallback Serving ---');
  const spaRes = simulateNativeStaticRequest('/notebooks/nb-dynamic-123');
  if (spaRes.statusCode !== 200 || spaRes.servedFile !== 'index.html' || !spaRes.headers['x-spa-fallback']) {
    throw new Error(`Expected SPA fallback to index.html, got status=${spaRes.statusCode}, file=${spaRes.servedFile}`);
  }
  console.log('  -> Passed: SPA deep route fallbacks to index.html with 200 OK.');

  // Step 5: Validate 50MB Upload Payload Limit
  console.log('\n--- Test 5: Upload Size Enforcement ---');
  const oversizeRes = simulateNativeProxyRequest('/api/sources/upload', 'POST', {
    isUpload: true,
    payloadSizeBytes: 60000000, // 60MB > 50MB limit
  });
  if (oversizeRes.statusCode !== 413) {
    throw new Error(`Expected 413 Payload Too Large, got status=${oversizeRes.statusCode}`);
  }
  console.log('  -> Passed: Upload payload limit (50MB) correctly enforced with 413.');

  // Step 6: Validate SSE Unbuffered Pass-Through
  console.log('\n--- Test 6: SSE Unbuffered Streaming Pass-Through ---');
  const sseRes = simulateNativeSseStream('/api/chat/stream');
  if (sseRes.bufferingDetected || !sseRes.headersValid) {
    throw new Error('SSE streaming failed unbuffered pass-through check');
  }
  console.log('  -> Passed: SSE event streaming operates unbuffered with required headers.');

  // Step 7: Save Report Deliverable
  console.log('\n--- Test 7: Writing X19 Deliverable Report ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`  -> Report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ Native Host Proxy & Static Serving (X19) tests passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Native Host Proxy test failed:', err.message);
  process.exit(1);
}
