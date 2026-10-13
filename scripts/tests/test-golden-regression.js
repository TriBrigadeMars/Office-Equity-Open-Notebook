'use strict';

/**
 * Executable test runner for Golden Extraction, RAG, and API Contract Regression (L8.3)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/golden-regression.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/l8_3');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'golden_regression_report.json');

function runTest() {
  console.log('Testing Golden Extraction, RAG, and API Contract Regression (L8.3)...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled contract module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const {
    runGoldenExtractionCorpus,
    runRagRegressionScenarios,
    runApiContractRegression,
    getGoldenDataDeltas,
    getReleaseBlockingIssues,
    runGoldenRegressionAudit,
    validateGoldenRegressionReport,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 1: Golden Extraction Corpus
  console.log('\n--- Step 1: Running Golden Document Extraction Corpus ---');
  const extractionChecks = runGoldenExtractionCorpus();
  console.log(`Extraction corpus checks: ${extractionChecks.length}`);
  for (const c of extractionChecks) {
    console.log(`  - [${c.extractionPath}] ${c.docId}: matchStatus=${c.matchStatus}`);
  }
  if (!extractionChecks.every((c) => c.matchStatus === 'exact' || c.matchStatus === 'tolerated')) {
    throw new Error('Golden extraction corpus regression detected!');
  }
  console.log('  -> Passed: Golden extraction corpus verified successfully.');

  // Step 2: RAG Regression Scenarios
  console.log('\n--- Step 2: Running RAG Regression Scenarios ---');
  const ragChecks = runRagRegressionScenarios();
  console.log(`RAG scenarios: ${ragChecks.length}`);
  for (const r of ragChecks) {
    console.log(`  - ${r.scenarioId}: status=${r.status}, relevance=${r.relevanceScore}, latency=${r.latencyMs}ms`);
  }
  if (!ragChecks.every((r) => r.status === 'passed' || r.status === 'degraded')) {
    throw new Error('RAG regression scenarios failed!');
  }
  console.log('  -> Passed: RAG retrieval scenarios verified successfully.');

  // Step 3: API Contract Regression
  console.log('\n--- Step 3: Running API Contract Regression Tests ---');
  const apiChecks = runApiContractRegression();
  console.log(`API contract checks: ${apiChecks.length}`);
  for (const a of apiChecks) {
    console.log(`  - [${a.method}] ${a.endpoint} (${a.category}): status=${a.status}, code=${a.responseCode}, latency=${a.latencyMs}ms`);
  }
  if (!apiChecks.every((a) => a.status === 'passed')) {
    throw new Error('API contract regression tests failed!');
  }
  console.log('  -> Passed: API contract tests passed successfully.');

  // Step 4: Golden Data Deltas & Release Blocking Triage
  console.log('\n--- Step 4: Reviewing Golden Data Deltas & Release Blocking Issues ---');
  const deltas = getGoldenDataDeltas();
  const blockingIssues = getReleaseBlockingIssues();
  console.log(`Approved golden data deltas: ${deltas.length}`);
  console.log(`Release-blocking issues: ${blockingIssues.length}`);
  if (blockingIssues.some((i) => i.severity === 'blocking')) {
    throw new Error('Release-blocking issues detected in L8.3 audit!');
  }
  console.log('  -> Passed: Zero blocking issues; deltas properly documented.');

  // Step 5: Full Golden Regression Audit Report & Validation
  console.log('\n--- Step 5: Generating & Validating Full L8.3 Report ---');
  const fullReport = runGoldenRegressionAudit();
  console.log(`Verdict summary: ${fullReport.verdict.summary}`);
  if (!fullReport.verdict.allPassed) {
    throw new Error('Full golden regression audit verdict is NOT allPassed');
  }

  const schemaVal = validateGoldenRegressionReport(fullReport);
  if (!schemaVal.valid) {
    throw new Error(`Report schema validation failed: ${schemaVal.errors.join(', ')}`);
  }
  console.log('  -> Passed: Golden regression report schema is valid.');

  // Step 6: Save Output Deliverable JSON
  console.log('\n--- Step 6: Saving Deliverable Report JSON ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`  -> Audit report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ Golden Extraction, RAG, and API Contract Regression (L8.3) passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Golden regression audit test failed:', err.message);
  process.exit(1);
}
