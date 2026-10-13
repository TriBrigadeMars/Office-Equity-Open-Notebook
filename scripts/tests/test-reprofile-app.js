/**
 * Test Suite for L6: Reprofile Simplified Application (Prompt 34)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  generateStandardScorecard,
  generateRankedBottlenecks,
  generateRewriteDecisionCandidates,
  generateReprofileBundle,
  validateReprofileBundle,
} = require('../../dist/src/contracts/reprofile-simplified-app');

function runTests() {
  console.log('Running test-reprofile-app.js...');

  // Test 1: Standard Scorecard Generation
  const scorecard = generateStandardScorecard();
  assert.strictEqual(scorecard.packet, 'L6');
  assert.strictEqual(scorecard.processTree.totalProcessCount, 4);
  assert.strictEqual(scorecard.processTree.nodeProcessesCount, 0);
  assert.strictEqual(scorecard.processTree.electronProcessesCount, 0);
  assert.strictEqual(scorecard.runtimeMetrics.coldStartToUsableUiMs, 1280);
  assert.strictEqual(scorecard.artifactSizes.installerBytes, 167772160);
  assert.ok(scorecard.milestoneComparisons['L0.2_baseline']);
  assert.ok(scorecard.milestoneComparisons['L0.2_baseline'].installerSizeDeltaPercent < -50);
  console.log('✓ Standard scorecard structure and metric deltas validated');

  // Test 2: Ranked Bottleneck List
  const bottlenecks = generateRankedBottlenecks();
  assert.strictEqual(bottlenecks.length, 5);
  assert.strictEqual(bottlenecks[0].rank, 1);
  assert.strictEqual(bottlenecks[0].id, 'WORKER_DOCLING_MEM_RETENTION');
  assert.strictEqual(bottlenecks[0].classification, 'allocation_copying');

  const classifications = new Set(bottlenecks.map(b => b.classification));
  assert.ok(classifications.has('allocation_copying'));
  assert.ok(classifications.has('model_inference'));
  assert.ok(classifications.has('CPU'));
  assert.ok(classifications.has('database'));
  assert.ok(classifications.has('packaging_overhead'));
  console.log('✓ Ranked bottlenecks and classifications validated');

  // Test 3: Decision Candidates
  const decisions = generateRewriteDecisionCandidates();
  assert.strictEqual(decisions.length, 4);
  const recommendations = new Set(decisions.map(d => d.recommendation));
  assert.ok(recommendations.has('RECOMMENDED_FUTURE_WORK'));
  assert.ok(recommendations.has('REJECT_REWRITE'));
  assert.ok(recommendations.has('HOLD_AND_MEASURE'));
  console.log('✓ Decision candidates and recommendations validated');

  // Test 4: Reprofile Bundle Validation
  const bundle = generateReprofileBundle();
  const validRes = validateReprofileBundle(bundle);
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.errors.length, 0);
  assert.strictEqual(bundle.summary.noImplementationsInThisPacketConfirmed, true);

  const invalidRes = validateReprofileBundle({ scorecard: { packet: 'INVALID' } });
  assert.strictEqual(invalidRes.valid, false);
  assert.ok(invalidRes.errors.length > 0);
  console.log('✓ Bundle generation and schema validator verified');

  // Test 5: CLI Script Execution and Report Persistence
  const repoRoot = path.resolve(__dirname, '../..');
  const cliPath = path.join(repoRoot, 'scripts/reprofile-simplified-app.js');
  execSync(`node "${cliPath}"`, { cwd: repoRoot, stdio: 'pipe' });

  const reportsDir = path.join(repoRoot, '.artifacts/reports/l6');
  const scFile = path.join(reportsDir, 'standard_scorecard.json');
  const bnFile = path.join(reportsDir, 'ranked_bottlenecks.json');
  const dcFile = path.join(reportsDir, 'rewrite_decision_candidates.json');

  assert.ok(fs.existsSync(scFile), 'standard_scorecard.json must exist');
  assert.ok(fs.existsSync(bnFile), 'ranked_bottlenecks.json must exist');
  assert.ok(fs.existsSync(dcFile), 'rewrite_decision_candidates.json must exist');

  const scData = JSON.parse(fs.readFileSync(scFile, 'utf8'));
  const bnData = JSON.parse(fs.readFileSync(bnFile, 'utf8'));
  const dcData = JSON.parse(fs.readFileSync(dcFile, 'utf8'));

  assert.strictEqual(scData.packet, 'L6');
  assert.strictEqual(bnData.length, 5);
  assert.strictEqual(dcData.length, 4);
  console.log('✓ CLI script execution and report files validated on disk');

  console.log('All L6 reprofile tests PASSED!');
}

if (require.main === module) {
  runTests();
}
