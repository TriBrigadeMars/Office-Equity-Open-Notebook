'use strict';

/**
 * Executable test runner for Loopback Networking & Navigation Security Audit (L8.1)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/loopback-audit.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/l8_1');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'security_audit_report.json');

function runTest() {
  console.log('Testing Loopback Networking & Navigation Security Audit (L8.1)...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled contract module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const {
    auditSocketBindings,
    auditProxySecurity,
    auditNavigationPolicy,
    runSecurityFuzzSuite,
    runLoopbackAndNavigationAudit,
    validateSecurityAuditReport,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 1: Audit Socket Bindings
  console.log('\n--- Step 1: Auditing Socket Bindings ---');
  const socketAudit = auditSocketBindings();
  console.log(`Services audited: ${socketAudit.services.length}`);
  for (const s of socketAudit.services) {
    console.log(`  - ${s.serviceName}: port=${s.port}, configuredHost=${s.configuredHost}, boundToLoopbackOnly=${s.boundToLoopbackOnly}`);
  }
  if (!socketAudit.allServicesLoopbackOnly) {
    throw new Error('Socket bind audit failed: Non-loopback service binding detected!');
  }
  console.log('  -> Passed: All services bind strictly to loopback (127.0.0.1).');

  // Step 2: Audit Proxy Target Pinning & Path Traversal
  console.log('\n--- Step 2: Auditing Reverse Proxy Target Pinning & Path Traversal ---');
  const proxyAudit = auditProxySecurity();
  console.log(`Target pinning cases: ${proxyAudit.targetPinningCases.length}`);
  console.log(`Header injection cases: ${proxyAudit.headerInjectionCases.length}`);
  console.log(`Path traversal cases: ${proxyAudit.pathTraversalCases.length}`);
  if (!proxyAudit.allProxyChecksPassed) {
    throw new Error('Proxy security audit failed: Unsafe target pinning, header handling, or path traversal!');
  }
  console.log('  -> Passed: Proxy target pinning, host header defense, and path traversal security operational.');

  // Step 3: Audit Navigation Policy Isolation
  console.log('\n--- Step 3: Auditing WebView Navigation Policy ---');
  const navAudit = auditNavigationPolicy();
  console.log(`Navigation cases tested: ${navAudit.cases.length}`);
  if (!navAudit.allNavigationChecksPassed) {
    const failedCases = navAudit.cases.filter((c) => !c.passed);
    console.error('Failed navigation cases:', failedCases);
    throw new Error(`Navigation security audit failed with ${failedCases.length} errors`);
  }
  console.log('  -> Passed: WebView navigation policy isolates internal origin, rejects userinfo tricks & unsafe schemes.');

  // Step 4: Run Property/Fuzz Test Suites
  console.log('\n--- Step 4: Executing Property/Fuzz Test Suites (200 iterations/suite) ---');
  const fuzzAudit = runSecurityFuzzSuite(200);
  for (const f of fuzzAudit.suites) {
    console.log(`  - ${f.category}: iterations=${f.iterations}, failures=${f.failures}`);
  }
  if (!fuzzAudit.allFuzzPassed) {
    throw new Error('Security fuzz testing failed!');
  }
  console.log('  -> Passed: Property fuzz testing executed 100% cleanly.');

  // Step 5: Full Security Audit Executor & Deliverable Report
  console.log('\n--- Step 5: Generating Full L8.1 Audit Report ---');
  const fullReport = runLoopbackAndNavigationAudit();
  console.log(`Verdict summary: ${fullReport.verdict.summary}`);
  if (!fullReport.verdict.fullyCompliant) {
    throw new Error('Full security audit report verdict is NOT fully compliant');
  }

  // Step 6: Validate Report Schema
  console.log('\n--- Step 6: Validating Audit Report Schema ---');
  const schemaVal = validateSecurityAuditReport(fullReport);
  if (!schemaVal.valid) {
    throw new Error(`Report schema validation failed: ${schemaVal.errors.join(', ')}`);
  }
  console.log('  -> Passed: Security audit report schema is valid.');

  // Step 7: Write Output Deliverable JSON
  console.log('\n--- Step 7: Saving Deliverable Report JSON ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`  -> Audit report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ Loopback Networking & Navigation Security Audit (L8.1) passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Security audit test failed:', err.message);
  process.exit(1);
}
