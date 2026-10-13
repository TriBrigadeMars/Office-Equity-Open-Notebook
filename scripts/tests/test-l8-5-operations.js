/**
 * Test L8.5: Verify Architecture & Operations Documentation and Scorecard Deliverables.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTest() {
  console.log('Running L8.5 Operations & Scorecard Verification...');

  const archOpsPath = path.join(PROJECT_ROOT, 'docs/modernization/ARCHITECTURE_OPERATIONS.md');
  assert(fs.existsSync(archOpsPath), 'Architecture & Operations doc exists');
  const archOpsContent = fs.readFileSync(archOpsPath, 'utf8');
  assert(archOpsContent.includes('Final Benchmark Scorecard'), 'Architecture doc contains scorecard');

  const scorecardJsonPath = path.join(PROJECT_ROOT, '.artifacts/reports/l8_5/final_scorecard_and_operations.json');
  assert(fs.existsSync(scorecardJsonPath), 'Final scorecard JSON report exists');
  const scorecardData = JSON.parse(fs.readFileSync(scorecardJsonPath, 'utf8'));
  assert(scorecardData.scorecard && scorecardData.scorecard.improvements, 'Scorecard JSON has improvement metrics');

  const handoffPath = path.join(PROJECT_ROOT, 'docs/modernization/handoffs/L8.5.md');
  assert(fs.existsSync(handoffPath), 'L8.5 handoff exists');

  console.log('✓ L8.5 Operations & Scorecard verification passed successfully.');
}

if (require.main === module) {
  try {
    runTest();
    process.exit(0);
  } catch (err) {
    console.error('✗ L8.5 verification failed:', err.message);
    process.exit(1);
  }
}

module.exports = { runTest };
