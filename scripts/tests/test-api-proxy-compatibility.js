'use strict';

/**
 * Executable test runner for API Proxy, Upload, and SSE Compatibility Harness (L3.2)
 */

const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(__dirname, '..', '..', 'tests', 'contracts', 'api-proxy-cases.json');
const COMPILED_CONTRACT_PATH = path.join(__dirname, '..', '..', 'dist', 'src', 'contracts', 'api-proxy.js');

function runTest() {
  console.log('Testing API Proxy, Upload & SSE Compatibility Harness (L3.2)...');

  // Step 1: Check fixture and compiled module existence
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Fixture file missing: ${FIXTURE_PATH}`);
  }
  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const {
    runApiProxyHarness,
    validateApiProxyResult,
    simulateUploadRequest,
    simulateSseStream,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 2: Run Reference Harness against canonical fixtures
  console.log('\n--- Test 1: Canonical Reference Execution ---');
  const result = runApiProxyHarness(fixtures);

  console.log(`Implementation: ${result.implementation}`);
  console.log(`Suite: ${result.suite}`);
  console.log(`Passed: ${result.passed}/${result.total}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Duration: ${result.durationMs} ms`);

  if (result.failed > 0) {
    console.error('Failed test details:', result.details.filter((d) => !d.passed));
    throw new Error(`Reference harness run failed with ${result.failed} errors`);
  }
  if (result.passed < 11) {
    throw new Error(`Expected at least 11 passed tests, got ${result.passed}`);
  }
  console.log('  -> Passed: Canonical reference execution succeeds clean.');

  // Step 3: Validate Machine-Readable Result Schema
  console.log('\n--- Test 2: Machine-Readable Schema Validation ---');
  const schemaValidation = validateApiProxyResult(result);
  if (!schemaValidation.valid) {
    throw new Error(`Compatibility result schema validation failed: ${schemaValidation.errors.join(', ')}`);
  }
  console.log('  -> Passed: Compatibility result schema is valid.');

  // Step 4: Verify Intentionally Buffered SSE Stream Fails Loudly
  console.log('\n--- Test 3: Intentionally Buffered SSE Stream Rejection ---');
  const bufferedResult = runApiProxyHarness(fixtures, { testBufferedFailure: true });
  if (bufferedResult.failed !== 1) {
    throw new Error(`Expected forced buffering test to produce 1 failure, got ${bufferedResult.failed} failed`);
  }
  const failedDetail = bufferedResult.details.find((d) => !d.passed);
  if (!failedDetail || failedDetail.id !== 'SSE_CHAT_STREAM_001') {
    throw new Error(`Expected failure for SSE_CHAT_STREAM_001, got ${failedDetail ? failedDetail.id : 'none'}`);
  }
  console.log('  -> Passed: Intentionally buffered SSE stream correctly flagged as failure.');

  // Step 5: Verify Upload Error Cases
  console.log('\n--- Test 4: Upload Error Case Validation ---');
  const oversizeFixture = fixtures.uploadCases.find((u) => u.id === 'UPLOAD_ERR_413_TOO_LARGE');
  const oversizeRes = simulateUploadRequest(oversizeFixture);
  if (oversizeRes.statusCode !== 413) {
    throw new Error(`Expected 413 Payload Too Large, got ${oversizeRes.statusCode}`);
  }

  const missingFileFixture = fixtures.uploadCases.find((u) => u.id === 'UPLOAD_ERR_400_MISSING_FILE');
  const missingFileRes = simulateUploadRequest(missingFileFixture);
  if (missingFileRes.statusCode !== 400) {
    throw new Error(`Expected 400 Bad Request, got ${missingFileRes.statusCode}`);
  }
  console.log('  -> Passed: Upload payload limits and missing file validation operating as specified.');

  // Step 6: Verify SSE Client Disconnect & Cancellation
  console.log('\n--- Test 5: SSE Cancellation & Disconnect Simulation ---');
  const cancelFixture = fixtures.sseCases.find((s) => s.id === 'SSE_CLIENT_CANCEL_001');
  const cancelRes = simulateSseStream(cancelFixture);
  if (!cancelRes.cancelled) {
    throw new Error('Expected cancelRes.cancelled to be true');
  }
  if (cancelRes.chunks.length !== 2) {
    throw new Error(`Expected 2 chunks delivered before disconnect, got ${cancelRes.chunks.length}`);
  }
  console.log('  -> Passed: SSE client disconnect halts stream delivery without hanging.');

  console.log('\n✅ API Proxy, Upload & SSE Compatibility Harness (L3.2) tests passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ API Proxy Compatibility test failed:', err.message);
  process.exit(1);
}
