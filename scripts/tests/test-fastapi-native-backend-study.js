'use strict';

/**
 * test-fastapi-native-backend-study.js
 *
 * Contract test suite for Packet L7.6 (Study FastAPI backend routes and native migration options without implementing a rewrite).
 * Validates route group dependency mappings, process removal feasibility, IPC/streaming complexity,
 * upstream sync burden, resource win estimates, parity test plan, feasibility matrix, report generation, and persisted JSON artifact.
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
  'l7_6',
  'fastapi_native_backend_study.json'
);

const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'fastapi-native-backend-study.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  getL76RouteGroupMappings,
  getL76IpcStreamingComplexity,
  getL76UpstreamSyncBurden,
  getL76ResourceWinEstimate,
  getL76ParityTestPlan,
  getL76FeasibilityMatrix,
  generateFastApiNativeBackendStudyReport,
  validateFastApiNativeBackendStudyReport,
} = require(contractsPath);

console.log('Testing FastAPI / Native Backend Feasibility Study Contracts (L7.6)...\n');

// --- Suite 1: Route Group Mappings & Downstream Dependencies ---
console.log('--- Suite 1: Route Group Mappings & Downstream Dependencies ---');
const mappings = getL76RouteGroupMappings();
assert.ok(Array.isArray(mappings) && mappings.length >= 5, 'Must map at least 5 route groups');

for (const g of mappings) {
  assert.ok(g.groupId, 'Route group must specify groupId');
  assert.ok(g.groupName, 'Route group must specify groupName');
  assert.ok(Array.isArray(g.routes) && g.routes.length > 0, 'Route group must list routes');
  assert.ok(Array.isArray(g.downstreamDependencies) && g.downstreamDependencies.length > 0, 'Route group must list downstream dependencies');
  assert.strictEqual(g.pythonProcessRemovalPossible, false, 'Python process removal must be impossible for all route groups');
  assert.ok(g.removalReasoning.length > 20, 'Removal reasoning must be descriptive');
}
console.log('  -> Route group mappings and Python dependency graphs validated.');

// --- Suite 2: IPC, Serialization, and Streaming Complexity ---
console.log('\n--- Suite 2: IPC, Serialization, and Streaming Complexity ---');
const ipcComplexity = getL76IpcStreamingComplexity();
assert.strictEqual(ipcComplexity.overallIpcComplexityRating, 'extreme');
assert.ok(ipcComplexity.ipcProtocolComplexity.length > 20);
assert.ok(ipcComplexity.serializationOverhead.length > 20);
assert.ok(ipcComplexity.streamingHandlingComplexity.length > 20);
assert.ok(ipcComplexity.multipartUploadHandling.length > 20);
console.log('  -> IPC, serialization, and unbuffered SSE streaming complexity evaluated.');

// --- Suite 3: Upstream Synchronization & Parity Test Burden ---
console.log('\n--- Suite 3: Upstream Synchronization & Parity Test Burden ---');
const syncBurden = getL76UpstreamSyncBurden();
assert.strictEqual(syncBurden.upstreamSyncRisk, 'extreme');
assert.ok(syncBurden.reasonsForSyncBurden.length >= 3, 'Must list reasons for sync burden');

const testPlan = getL76ParityTestPlan();
assert.ok(testPlan.requiredSuites.length >= 4, 'Must require at least 4 parity test suites');
assert.strictEqual(testPlan.totalEndpointsCovered, 12);
for (const suite of testPlan.requiredSuites) {
  assert.ok(suite.suiteName, 'Suite must specify name');
  assert.ok(suite.coveredEndpoints.length > 0, 'Suite must cover endpoints');
  assert.ok(suite.verificationCriteria.length > 0, 'Suite must specify verification criteria');
}
console.log('  -> Upstream sync burden and parity test plan verified.');

// --- Suite 4: Resource Win Estimates & Measured Benefit Assessment ---
console.log('\n--- Suite 4: Resource Win Estimates & Measured Benefit Assessment ---');
const wins = getL76ResourceWinEstimate();
assert.strictEqual(wins.currentUvicornMemoryRssMb, 120.0);
assert.strictEqual(wins.netMemorySavingsMb, 0.0, 'Net memory savings must be 0 MB due to retained Python ML requirements');
assert.strictEqual(wins.coldStartImpactMs, 0.0);
assert.ok(wins.measuredBenefitAssessment.includes('Negligible resource wins'));
console.log('  -> Resource win estimates and measured benefit assessment verified.');

// --- Suite 5: Feasibility Matrix & Candidate/No-Go Decisions ---
console.log('\n--- Suite 5: Feasibility Matrix & Candidate/No-Go Decisions ---');
const matrix = getL76FeasibilityMatrix();
assert.strictEqual(matrix.length, 5, 'Must evaluate 5 route groups in feasibility matrix');

for (const item of matrix) {
  assert.ok(item.decision === 'NO_GO' || item.decision === 'REJECT_REWRITE', 'Decisions must be NO_GO or REJECT_REWRITE');
  assert.ok(item.rationale.length > 20, 'Rationale must be descriptive');
  assert.ok(item.pros.length >= 1, 'Must list pros');
  assert.ok(item.cons.length >= 1, 'Must list cons');
}
console.log('  -> Feasibility matrix candidate/no-go decisions validated.');

// --- Suite 6: Report Generation & Persisted Artifact Deliverable ---
console.log('\n--- Suite 6: Report Generation & Persisted Artifact Deliverable ---');
const report = generateFastApiNativeBackendStudyReport();
assert.strictEqual(report.packetId, 'L7.6');
assert.strictEqual(report.status, 'STUDY_COMPLETE_NO_REWRITE');
assert.strictEqual(validateFastApiNativeBackendStudyReport(report), true, 'Generated report must pass validation');

assert.ok(fs.existsSync(REPORT_PATH), 'Persisted report file must exist at .artifacts/reports/l7_6/fastapi_native_backend_study.json');

const fileData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
assert.strictEqual(fileData.packetId, 'L7.6');
assert.strictEqual(fileData.status, 'STUDY_COMPLETE_NO_REWRITE');
assert.strictEqual(validateFastApiNativeBackendStudyReport(fileData), true, 'Persisted JSON file must pass contract validation');
console.log('  -> Report generation and persisted report deliverable verified.');

console.log('\n✅ All FastAPI / Native Backend Feasibility Study Contract tests passed successfully.');
