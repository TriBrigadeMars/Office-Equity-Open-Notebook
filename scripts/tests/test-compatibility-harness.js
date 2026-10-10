/**
 * Executable test runner for the Language-Neutral Compatibility Harness (L0.4)
 */

const fs = require('fs');
const path = require('path');
const {
  runReferenceHarness,
  validateCompatibilityResult,
} = require('../../dist/src/contracts/harness');

function runTest() {
  console.log('Testing Language-Neutral Replacement Harness (L0.4)...');

  // Step 1: Load compatibility scenarios fixture
  const fixturePath = path.join(__dirname, '../../tests/contracts/compatibility-scenarios.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture file not found: ${fixturePath}`);
  }

  const rawFixtures = fs.readFileSync(fixturePath, 'utf8');
  const fixtures = JSON.parse(rawFixtures);

  // Step 2: Run Reference Harness
  console.log('\n--- Running Reference Harness against canonical fixtures ---');
  const result = runReferenceHarness(fixtures);

  console.log(`Implementation: ${result.implementation}`);
  console.log(`Suite: ${result.suite}`);
  console.log(`Passed: ${result.passed}/${result.total}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Duration: ${result.durationMs} ms`);

  // Step 3: Validate Machine-Readable Result Schema
  const schemaValidation = validateCompatibilityResult(result);
  if (!schemaValidation.valid) {
    throw new Error(`Compatibility result schema validation failed: ${schemaValidation.errors.join(', ')}`);
  }
  console.log('  -> Machine-readable CompatibilityResult schema valid');

  if (result.failed > 0) {
    console.error('Failed test details:', result.details.filter((d) => !d.passed));
    throw new Error(`Reference harness run failed with ${result.failed} errors`);
  }
  if (result.passed < 16) {
    throw new Error(`Expected at least 16 passed tests, got ${result.passed}`);
  }

  // Step 4: Verify Intentionally Corrupted Fixtures Fail Loudly
  console.log('\n--- Testing Intentionally Corrupted Fixture Rejection ---');

  const corruptedFixtures = {
    version: '1.0.0',
    pureCases: [
      {
        id: "CORRUPT-001",
        category: "service-table",
        input: { "version": 123, "services": "not-an-array" },
        expectedValid: true // Expecting valid, but input is invalid -> MUST fail
      }
    ],
    supervisionScenarios: []
  };

  const corruptResult = runReferenceHarness(corruptedFixtures);
  if (corruptResult.failed !== 1) {
    throw new Error(`Expected corrupted fixture to produce 1 failure, got ${corruptResult.failed} failed`);
  }
  console.log('  -> Intentionally corrupted fixture correctly flagged as failure');

  // Step 5: Verify Schema Validator Catches Invalid Schema Objects
  const invalidResultObj = { implementation: "test", passed: 10 }; // missing failed, total, suite
  const invalidSchemaCheck = validateCompatibilityResult(invalidResultObj);
  if (invalidSchemaCheck.valid) {
    throw new Error('Expected schema validator to reject invalid result object, but it passed');
  }
  console.log('  -> Invalid result object correctly rejected by result schema validator');

  console.log('\n✅ Language-Neutral Replacement Harness (L0.4) tests passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Compatibility Harness test failed:', err.message);
  process.exit(1);
}
