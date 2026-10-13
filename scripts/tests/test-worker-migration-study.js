'use strict';

/**
 * test-worker-migration-study.js
 *
 * Contract test suite for Packet L7.5 (Study Python worker migration options without implementing a rewrite).
 * Validates mapped command handlers, responsibility splits, native coordinator estimates,
 * options/impact table, upstream sync risks, generated report, and persisted JSON artifact.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');
const REPORT_PATH = path.join(
  PROJECT_DIR,
  '.artifacts',
  'reports',
  'l7_5',
  'python_worker_migration_study.json'
);

const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'worker-migration-study.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  getL75CommandMappings,
  getL75ResponsibilitySplit,
  getL75NativeCoordinatorQuantification,
  getL75IpcProcessStartEstimate,
  getL75UpstreamSyncBurden,
  getL75OptionsTable,
  generateWorkerMigrationStudyReport,
  validateWorkerMigrationStudyReport,
} = require(contractsPath);

console.log('Testing Python Worker Migration Options Study Contracts (L7.5)...\n');

// --- Suite 1: Command Handler Mappings & Dependencies ---
console.log('--- Suite 1: Command Handler Mappings & Dependencies ---');
const mappings = getL75CommandMappings();
assert.ok(Array.isArray(mappings) && mappings.length >= 5, 'Must map at least 5 worker command handlers');

for (const m of mappings) {
  assert.ok(m.commandHandler, 'Mapping must specify a command handler name');
  assert.ok(m.pythonModule, 'Mapping must specify a downstream Python module');
  assert.ok(Array.isArray(m.downstreamDependencies) && m.downstreamDependencies.length > 0, 'Mapping must specify downstream dependencies');
  assert.ok(m.executionCategory, 'Mapping must specify an execution category');
  assert.ok(m.averageExecutionTimeMs > 0, 'Average execution time must be positive');
  assert.ok(m.peakMemoryRssMb > 0, 'Peak memory RSS must be positive');
}
console.log('  -> Worker command handler mappings and ML dependency graphs validated.');

// --- Suite 2: Queue vs Business Responsibility Split ---
console.log('\n--- Suite 2: Queue vs Business Responsibility Split ---');
const splits = getL75ResponsibilitySplit();
assert.strictEqual(splits.length, 2, 'Must split responsibilities into queue_and_lease and business_workflow');

const queueSplit = splits.find((s) => s.category === 'queue_and_lease');
assert.ok(queueSplit, 'queue_and_lease category must exist');
assert.ok(queueSplit.responsibilities.length >= 5, 'Queue category must list at least 5 responsibilities');
assert.strictEqual(queueSplit.potentialOwner, 'native_host_coordinator');

const bizSplit = splits.find((s) => s.category === 'business_workflow');
assert.ok(bizSplit, 'business_workflow category must exist');
assert.ok(bizSplit.responsibilities.length >= 4, 'Business category must list at least 4 responsibilities');
assert.strictEqual(bizSplit.potentialOwner, 'python_subprocess_executor');

console.log('  -> Infrastructure vs business workflow responsibility decoupling verified.');

// --- Suite 3: Native Coordinator Quantification & IPC/Start Estimates ---
console.log('\n--- Suite 3: Native Coordinator Quantification & IPC/Start Estimates ---');
const nativeQuant = getL75NativeCoordinatorQuantification();
assert.ok(nativeQuant.replacedCapabilities.length >= 3, 'Must list replaced capabilities');
assert.ok(nativeQuant.retainedPythonWorkflows.length >= 3, 'Must list retained Python workflows');
assert.strictEqual(nativeQuant.idleMemorySavingsRssMb, 160.0, 'Idle RAM savings must be 160 MB');
assert.strictEqual(nativeQuant.gilContentionEliminated, true);

const ipcEstimate = getL75IpcProcessStartEstimate();
assert.strictEqual(ipcEstimate.cpythonColdStartMs, 180.0);
assert.strictEqual(ipcEstimate.cpythonImportHeavyMlStartMs, 650.0);
assert.ok(ipcEstimate.analysisNote.length > 20, 'Analysis note must be descriptive');
console.log('  -> Native coordinator quantification and CPython start overhead estimates validated.');

// --- Suite 4: Options Evaluation Table & Upstream Sync Burden ---
console.log('\n--- Suite 4: Options Evaluation Table & Upstream Sync Burden ---');
const syncBurden = getL75UpstreamSyncBurden();
assert.strictEqual(syncBurden.upstreamSyncRisk, 'extreme');
assert.ok(syncBurden.reasonsForSyncBurden.length >= 3, 'Must detail reasons for upstream sync burden');

const options = getL75OptionsTable();
assert.strictEqual(options.length, 4, 'Must present 4 distinct architecture options');

const recOption = options.find((o) => o.recommendationStatus === 'RECOMMENDED');
assert.ok(recOption, 'Must have a RECOMMENDED option');
assert.strictEqual(recOption.optionId, 'on_demand_recycling');
assert.strictEqual(recOption.idleRssMb, 0.0);

const rejOption = options.find((o) => o.optionId === 'deeper_native_rewrite');
assert.ok(rejOption, 'Must evaluate deeper_native_rewrite option');
assert.strictEqual(rejOption.recommendationStatus, 'REJECTED');

console.log('  -> Options table and upstream synchronization risk analysis verified.');

// --- Suite 5: Report Generation & Persisted Artifact Deliverable ---
console.log('\n--- Suite 5: Report Generation & Persisted Artifact Deliverable ---');
const report = generateWorkerMigrationStudyReport();
assert.strictEqual(report.packetId, 'L7.5');
assert.strictEqual(report.status, 'STUDY_COMPLETE_NO_REWRITE');
assert.strictEqual(validateWorkerMigrationStudyReport(report), true, 'Generated report must pass validation');

assert.ok(fs.existsSync(REPORT_PATH), 'Persisted report file must exist at .artifacts/reports/l7_5/python_worker_migration_study.json');

const fileData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
assert.strictEqual(fileData.packetId, 'L7.5');
assert.strictEqual(fileData.status, 'STUDY_COMPLETE_NO_REWRITE');
assert.strictEqual(validateWorkerMigrationStudyReport(fileData), true, 'Persisted JSON file must pass contract validation');
console.log('  -> Report generation and persisted report deliverable verified.');

console.log('\n✅ All Python Worker Migration Study Contract tests passed successfully.');
