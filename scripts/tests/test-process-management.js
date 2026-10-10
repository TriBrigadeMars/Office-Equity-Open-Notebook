'use strict';

/**
 * Contract verification test suite for L0.3c Process Manager module.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.join(__dirname, '../..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const COMPILED_CONTRACT_PATH = path.join(DIST_DIR, 'src', 'contracts', 'process-manager.js');
const FIXTURE_PATH = path.join(ROOT_DIR, 'tests', 'contracts', 'process-management-cases.json');

async function run() {
  console.log('Testing Process Manager & Supervision Contracts...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    console.error(`Error: Compiled contract module missing at ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' or 'npx tsc' first.`);
    process.exit(1);
  }

  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`Error: Fixture file missing at ${FIXTURE_PATH}`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const {
    DEFAULT_SERVICE_PORTS,
    isPortOpen,
    waitForPort,
    formatLogLine,
    calculateShutdownSequence,
    createServiceExitEvent,
    validateStartServicesConfig,
  } = require(COMPILED_CONTRACT_PATH);

  // 1. Verify Default Ports
  console.log('\n--- Suite 1: Default Service Ports ---');
  assert.strictEqual(DEFAULT_SERVICE_PORTS.surreal, cases.defaultPorts.surreal);
  assert.strictEqual(DEFAULT_SERVICE_PORTS.api, cases.defaultPorts.api);
  assert.strictEqual(DEFAULT_SERVICE_PORTS.frontend, cases.defaultPorts.frontend);
  console.log('  -> Default ports match fixture contract');

  // 2. Verify Log Formatting
  console.log('\n--- Suite 2: Log Line Formatting ---');
  for (const tc of cases.logFormattingCases) {
    const formatted = formatLogLine(tc.name, tc.stream, tc.data, new Date('2026-01-01T00:00:00.000Z'));
    if (tc.expectedNull) {
      assert.strictEqual(formatted, null);
    } else {
      assert.notStrictEqual(formatted, null);
      assert.ok(formatted.includes(tc.expectedTag), `Expected tag ${tc.expectedTag} in ${formatted}`);
      assert.ok(formatted.endsWith(tc.expectedContent), `Expected line to end with ${tc.expectedContent}`);
    }
    console.log(`  -> Log format test passed: ${tc.description}`);
  }

  // 3. Verify Shutdown Sequence Calculation
  console.log('\n--- Suite 3: Shutdown Sequence Calculation ---');
  const calculatedOrder = calculateShutdownSequence(cases.shutdownSequence.inputServices);
  assert.deepStrictEqual(calculatedOrder, cases.shutdownSequence.expectedShutdownOrder);
  console.log('  -> Shutdown sequence reverse calculation passed');

  // 4. Verify Exit Event Creation
  console.log('\n--- Suite 4: Service Exit Event Creation ---');
  for (const tc of cases.exitEventCases) {
    const event = createServiceExitEvent(tc.serviceName, tc.exitCode, tc.signal, tc.killedIntentional);
    assert.strictEqual(event.serviceName, tc.serviceName);
    assert.strictEqual(event.exitCode, tc.exitCode);
    assert.strictEqual(event.signal, tc.signal);
    assert.strictEqual(event.unexpected, tc.expectedUnexpected);
    assert.ok(typeof event.timestamp === 'string' && event.timestamp.length > 0);
    console.log(`  -> Exit event test passed: ${tc.description}`);
  }

  // 5. Verify Config Validation
  console.log('\n--- Suite 5: Config Validation ---');
  for (const validItem of cases.configValidationCases.valid) {
    const validated = validateStartServicesConfig(validItem.input);
    assert.strictEqual(validated.runtimePath, validItem.expectedRuntimePath);
    assert.strictEqual(validated.dataDir, validItem.expectedDataDir);
    assert.strictEqual(validated.encryptionKey, validItem.expectedEncryptionKey);
    console.log('  -> Valid StartServicesConfig passed');
  }

  for (const invalidItem of cases.configValidationCases.invalid) {
    assert.throws(
      () => validateStartServicesConfig(invalidItem.input),
      (err) => err instanceof TypeError && err.message.includes(invalidItem.expectedErrorSubstring),
      `Expected TypeError containing ${invalidItem.expectedErrorSubstring}`
    );
    console.log(`  -> Invalid config test passed: ${invalidItem.description}`);
  }

  // 6. Verify Port Polling Helpers
  console.log('\n--- Suite 6: Port Polling Helpers ---');
  let attemptCount = 0;
  const mockPortCheck = async (port) => {
    attemptCount++;
    return attemptCount >= 3;
  };

  const pollResult = await waitForPort(9999, 5000, 'MockService', '127.0.0.1', mockPortCheck);
  assert.strictEqual(pollResult, true);
  assert.strictEqual(attemptCount, 3);
  console.log('  -> waitForPort polling helper passed');

  let failedPollThrew = false;
  try {
    await waitForPort(9999, 200, 'MockFailService', '127.0.0.1', async () => false);
  } catch (err) {
    failedPollThrew = true;
    assert.ok(err.message.includes('Timed out waiting for MockFailService'));
  }
  assert.strictEqual(failedPollThrew, true);
  console.log('  -> waitForPort timeout error handling passed');

  console.log('\n✅ All Process Manager Contract tests passed successfully.');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
