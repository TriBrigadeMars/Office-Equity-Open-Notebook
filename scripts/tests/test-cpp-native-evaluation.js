'use strict';

/**
 * test-cpp-native-evaluation.js
 *
 * Contract test suite for Packet L7.3 (C/C++ Native Library Integration & Leaf Evaluation).
 * Validates frozen native contracts, FFI safety analysis, rejection criteria,
 * persisted report deliverables, and preservation of 100% Python/Tauri fallback behavior.
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
  'l7_3',
  'c_cpp_native_evaluation.json'
);

const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'cpp-native-evaluation.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  getL73EvaluatedCandidates,
  getL73SafetyAndAuditEvidence,
  generateCppNativeEvaluationReport,
  validateCppNativeEvaluationReport,
} = require(contractsPath);

console.log('Testing C/C++ Native Leaf Evaluation Contracts (L7.3)...\n');

// --- Suite 1: Candidate Evaluations & Frozen Input/Output Contracts ---
console.log('--- Suite 1: Candidate Evaluations & Frozen Input/Output Contracts ---');
const candidates = getL73EvaluatedCandidates();
assert.ok(Array.isArray(candidates) && candidates.length >= 2, 'Must evaluate at least 2 native candidates');

for (const cand of candidates) {
  assert.ok(cand.candidate, 'Candidate must have a name');
  assert.ok(cand.targetFunction, 'Candidate must specify a target function');
  assert.ok(cand.contract, 'Candidate must specify a contract');
  assert.ok(cand.contract.inputs.length > 0, 'Contract must define inputs');
  assert.ok(cand.contract.outputs.length > 0, 'Contract must define outputs');
  assert.ok(cand.contract.lifecycle, 'Contract must define lifecycle management');
  assert.strictEqual(cand.decision, 'REJECT_REWRITE', 'All candidates should be REJECT_REWRITE based on L6 evidence');
  assert.ok(cand.safetyRisks.length >= 3, 'Must list at least 3 safety risks for C/C++ FFI wrappers');
}
console.log('  -> Frozen candidate contracts and safety risk vectors validated.');

// --- Suite 2: Safety & Audit Evidence ---
console.log('\n--- Suite 2: Safety & Audit Evidence ---');
const safetyEvidence = getL73SafetyAndAuditEvidence();
assert.ok(safetyEvidence.asanUbsanStatus, 'Must record ASan/UBSan toolchain status');
assert.ok(safetyEvidence.abiStability, 'Must record ABI stability risks');
assert.ok(safetyEvidence.isolationMechanism, 'Must document process isolation mechanisms');
console.log('  -> Safety and audit evidence recorded.');

// --- Suite 3: Full Evaluation Report Generation & Validation ---
console.log('\n--- Suite 3: Full Evaluation Report Generation & Validation ---');
const report = generateCppNativeEvaluationReport();
assert.strictEqual(report.packetId, 'L7.3');
assert.strictEqual(report.status, 'REJECTED_SKIPPED');
assert.strictEqual(report.dependencies.l6HotspotIdentified, false);
assert.strictEqual(report.dependencies.approvedNativeLibraryRequirement, false);
assert.strictEqual(report.verdict.integrateCppLeaf, false);
assert.strictEqual(report.verdict.retainPythonFallback, true);

const isValid = validateCppNativeEvaluationReport(report);
assert.strictEqual(isValid, true, 'Report must pass validation check');
console.log('  -> Report generation and validation passed.');

// --- Suite 4: Persisted Artifact Deliverable Verification ---
console.log('\n--- Suite 4: Persisted Artifact Deliverable Verification ---');
assert.ok(fs.existsSync(REPORT_PATH), 'Persisted report file must exist at .artifacts/reports/l7_3/c_cpp_native_evaluation.json');

const fileData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
assert.strictEqual(fileData.packetId, 'L7.3');
assert.strictEqual(fileData.status, 'REJECTED_SKIPPED');
assert.strictEqual(validateCppNativeEvaluationReport(fileData), true, 'Persisted JSON file must pass contract validation');
console.log('  -> Persisted report deliverable verified.');

console.log('\n✅ All C/C++ Native Leaf Evaluation Contract tests passed successfully.');
