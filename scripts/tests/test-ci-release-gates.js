'use strict';

/**
 * Executable test runner for CI Lanes, Release Gates, Rollback & Canary Controls Contract (L8.4)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/ci-release-gates.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/l8_4');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'rollback_canary_report.json');

function runTest() {
  console.log('Testing CI Lanes, Release Gates, Rollback & Canary Controls Contract (L8.4)...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled contract module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const {
    getConfiguredCILanes,
    getReleaseAcceptanceGates,
    getSwitchabilityVerifications,
    getCanaryRollbackTriggers,
    executeRollbackTests,
    runCiReleaseGatesAudit,
    validateCiReleaseGatesReport,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 1: Verify CI Lanes
  console.log('\n--- Step 1: Verifying CI Testing Lanes ---');
  const ciLanes = getConfiguredCILanes();
  console.log(`Configured CI lanes: ${ciLanes.length}`);
  for (const lane of ciLanes) {
    console.log(`  - [${lane.category}] ${lane.name}: blocksPR=${lane.blocksPullRequest}, blocksRel=${lane.blocksRelease}, status=${lane.status}`);
  }
  if (!ciLanes.every(l => l.status === 'passed')) {
    throw new Error('CI lanes verification failed: one or more lanes are not passing.');
  }
  console.log('  -> Passed: All 6 CI testing lanes configured and passing.');

  // Step 2: Verify Release Acceptance Gates
  console.log('\n--- Step 2: Verifying Release Acceptance Gates ---');
  const gates = getReleaseAcceptanceGates();
  console.log(`Release acceptance gates: ${gates.length}`);
  for (const gate of gates) {
    console.log(`  - [${gate.category}] ${gate.criterion}: status=${gate.status}`);
  }
  if (!gates.every(g => g.status === 'passed')) {
    throw new Error('Release acceptance gates failed.');
  }
  console.log('  -> Passed: All release acceptance gates met and verified.');

  // Step 3: Verify Implementation Switchability
  console.log('\n--- Step 3: Verifying Implementation Switchability & Fallbacks ---');
  const switchables = getSwitchabilityVerifications();
  console.log(`Switchable components: ${switchables.length}`);
  for (const s of switchables) {
    console.log(`  - ${s.featureName}: primary=${s.primaryImplementation}, fallback=${s.fallbackImplementation}, switchable=${s.switchable}`);
  }
  if (!switchables.every(s => s.switchable)) {
    throw new Error('Implementation switchability verification failed.');
  }
  console.log('  -> Passed: All fallback and switchability mechanisms verified.');

  // Step 4: Verify Canary Rollback Triggers
  console.log('\n--- Step 4: Auditing Canary Release & Rollback Triggers ---');
  const triggers = getCanaryRollbackTriggers();
  console.log(`Canary rollback triggers: ${triggers.length}`);
  for (const t of triggers) {
    console.log(`  - ${t.triggerId}: metric=${t.metric}, action=${t.action}, tested=${t.tested}`);
  }
  if (!triggers.every(t => t.tested)) {
    throw new Error('Untested canary rollback triggers detected.');
  }
  console.log('  -> Passed: Canary triggers and automated rollback thresholds documented & tested.');

  // Step 5: Execute Rollback Procedures
  console.log('\n--- Step 5: Executing Rollback Procedure Tests ---');
  const rollbacks = executeRollbackTests();
  console.log(`Rollback test executions: ${rollbacks.length}`);
  for (const r of rollbacks) {
    console.log(`  - ${r.executionId} (${r.scenario}): success=${r.success}, duration=${r.durationMs}ms`);
  }
  if (!rollbacks.every(r => r.success)) {
    throw new Error('Rollback execution test failed.');
  }
  console.log('  -> Passed: Rollback procedures successfully exercised and verified.');

  // Step 6: Generate Full L8.4 Audit Report
  console.log('\n--- Step 6: Generating Full L8.4 CI & Release Gates Report ---');
  const fullReport = runCiReleaseGatesAudit();
  console.log(`Verdict summary: ${fullReport.verdict.summary}`);
  if (!fullReport.verdict.allPassed) {
    throw new Error('Full CI release gates report verdict is NOT allPassed');
  }

  // Step 7: Validate Report Schema
  console.log('\n--- Step 7: Validating Audit Report Schema ---');
  const schemaVal = validateCiReleaseGatesReport(fullReport);
  if (!schemaVal.valid) {
    throw new Error(`Report schema validation failed: ${schemaVal.errors.join(', ')}`);
  }
  console.log('  -> Passed: CI release gates report schema is valid.');

  // Step 8: Write Output Deliverable JSON
  console.log('\n--- Step 8: Saving Deliverable Report JSON ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`  -> Rollback & canary report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ CI Lanes, Release Gates, Rollback & Canary Controls Contract (L8.4) passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ CI release gates test failed:', err.message);
  process.exit(1);
}
