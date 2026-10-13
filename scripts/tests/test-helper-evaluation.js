'use strict';

/**
 * test-helper-evaluation.js
 *
 * Contract test suite for Packet L7.4 (Discrete Go / C# Native Helper Evaluation).
 * Validates discrete helper contracts, timeout/error handling specs, process/package overhead,
 * rejection criteria, persisted report deliverables, and retention of single Rust/Tauri host architecture.
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
  'l7_4',
  'go_csharp_helper_evaluation.json'
);

const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'helper-evaluation.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  getL74EvaluatedCandidates,
  generateHelperEvaluationReport,
  validateHelperEvaluationReport,
} = require(contractsPath);

console.log('Testing Discrete Go / C# Helper Evaluation Contracts (L7.4)...\n');

// --- Suite 1: Helper Candidates & IPC/CLI Contracts ---
console.log('--- Suite 1: Helper Candidates & IPC/CLI Contracts ---');
const candidates = getL74EvaluatedCandidates();
assert.ok(Array.isArray(candidates) && candidates.length >= 2, 'Must evaluate at least 2 helper candidates');

for (const cand of candidates) {
  assert.ok(cand.candidateId, 'Candidate must have an ID');
  assert.ok(cand.name, 'Candidate must have a name');
  assert.ok(['Go', 'C#'].includes(cand.language), 'Language must be Go or C#');
  assert.ok(cand.contract, 'Candidate must specify a contract spec');
  assert.ok(['CLI_FLAGS', 'JSON_RPC_STDIO', 'HTTP_REST_LOOPBACK'].includes(cand.contract.ipcProtocol), 'Must specify valid IPC protocol');
  assert.ok(cand.contract.singleResponsibility, 'Must specify single responsibility');
  assert.ok(cand.contract.inputs.length > 0, 'Contract must specify inputs');
  assert.ok(cand.contract.outputs.length > 0, 'Contract must specify outputs');
  assert.strictEqual(cand.decision, 'REJECT_HELPER', 'All candidates should be REJECT_HELPER based on host integration advantages');
}
console.log('  -> Helper candidate contracts and IPC specifications validated.');

// --- Suite 2: Timeout, Error Recovery & Version Compatibility ---
console.log('\n--- Suite 2: Timeout, Error Recovery & Version Compatibility ---');
for (const cand of candidates) {
  const eb = cand.contract.errorAndTimeoutBehavior;
  assert.ok(typeof eb.timeoutMs === 'number' && eb.timeoutMs > 0, 'Must define positive timeout in ms');
  assert.ok(eb.failureRecoveryStrategy, 'Must specify failure recovery strategy');
  assert.ok(eb.versionCompatibilityCheck, 'Must specify version compatibility check');
}
console.log('  -> Timeout, failure recovery, and version compatibility specs validated.');

// --- Suite 3: Process/Package Overhead & Host Integration Alternatives ---
console.log('\n--- Suite 3: Process/Package Overhead & Host Integration Alternatives ---');
for (const cand of candidates) {
  assert.ok(cand.startupLatencyMs > 0, 'Startup latency must be recorded');
  assert.ok(cand.memoryRssMb > 0, 'Memory RSS must be recorded');
  assert.ok(cand.binaryPackageImpactMb > 0, 'Binary package impact must be recorded');
  assert.ok(cand.toolchainRequirement, 'Toolchain requirement must be documented');
  assert.ok(cand.hostIntegrationAlternative.implementationLocation, 'Host alternative location must be specified');
  assert.ok(cand.hostIntegrationAlternative.advantagesOverHelper.length >= 3, 'Must document at least 3 advantages of in-host integration');
}
console.log('  -> Overhead metrics and host integration alternatives verified.');

// --- Suite 4: Full Report Generation & Validation ---
console.log('\n--- Suite 4: Full Report Generation & Validation ---');
const report = generateHelperEvaluationReport();
assert.strictEqual(report.packetId, 'L7.4');
assert.strictEqual(report.status, 'REJECTED_SKIPPED');
assert.strictEqual(report.dependencies.l6HotspotIdentified, false);
assert.strictEqual(report.dependencies.approvedHelperBoundary, false);
assert.strictEqual(report.verdict.buildSeparateHelper, false);
assert.strictEqual(report.verdict.retainInHostIntegration, true);

const isValid = validateHelperEvaluationReport(report);
assert.strictEqual(isValid, true, 'Report must pass validation check');
console.log('  -> Full report generation and validation passed.');

// --- Suite 5: Persisted Artifact Deliverable Verification ---
console.log('\n--- Suite 5: Persisted Artifact Deliverable Verification ---');
assert.ok(fs.existsSync(REPORT_PATH), 'Persisted report file must exist at .artifacts/reports/l7_4/go_csharp_helper_evaluation.json');

const fileData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
assert.strictEqual(fileData.packetId, 'L7.4');
assert.strictEqual(fileData.status, 'REJECTED_SKIPPED');
assert.strictEqual(validateHelperEvaluationReport(fileData), true, 'Persisted JSON file must pass contract validation');
console.log('  -> Persisted report deliverable verified.');

console.log('\n✅ All Discrete Go / C# Helper Evaluation Contract tests passed successfully.');
