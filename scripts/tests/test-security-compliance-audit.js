'use strict';

/**
 * Executable test runner for Secrets, Paths, Diagnostics, Dependencies & Licenses Audit (L8.2)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMPILED_CONTRACT_PATH = path.join(PROJECT_ROOT, 'dist/src/contracts/security-compliance-audit.js');
const REPORT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.artifacts/reports/l8_2');
const REPORT_FILE_PATH = path.join(REPORT_OUTPUT_DIR, 'security_and_compliance_audit.json');

function runTest() {
  console.log('Testing Secrets, Paths, Diagnostics, Dependencies & Licenses Audit (L8.2)...');

  if (!fs.existsSync(COMPILED_CONTRACT_PATH)) {
    throw new Error(`Compiled contract module missing: ${COMPILED_CONTRACT_PATH}. Run 'npm run build:types' first.`);
  }

  const {
    sanitizeSensitiveData,
    traceSecretsAndDiagnostics,
    runRedactionTests,
    auditDependencies,
    generateLicenseInventory,
    triageVulnerabilities,
    runSecurityComplianceAudit,
    validateSecurityComplianceAuditReport,
  } = require(COMPILED_CONTRACT_PATH);

  // Step 1: Trace Secrets & Diagnostics
  console.log('\n--- Step 1: Tracing Secrets & Diagnostics Handling ---');
  const secretTrace = traceSecretsAndDiagnostics();
  console.log(`Trace checks: ${secretTrace.length}`);
  for (const st of secretTrace) {
    console.log(`  - [${st.category}] ${st.targetField}: passed=${st.passed}`);
  }
  if (!secretTrace.every((s) => s.passed)) {
    throw new Error('Secret trace audit failed: unredacted secret handling detected.');
  }
  console.log('  -> Passed: Secrets and diagnostics handling properly secured and redacted.');

  // Step 2: Run Redaction Tests
  console.log('\n--- Step 2: Executing Redaction Property Tests ---');
  const redactions = runRedactionTests();
  console.log(`Redaction test cases: ${redactions.length}`);
  for (const r of redactions) {
    console.log(`  - ${r.id} (${r.sensitiveField}): passed=${r.passed} | output: ${r.redactedOutput}`);
  }
  if (!redactions.every((r) => r.passed)) {
    throw new Error('Redaction property tests failed!');
  }
  console.log('  -> Passed: All redaction test cases verified successfully.');

  // Step 3: Audit Dependencies & Pinned Versions
  console.log('\n--- Step 3: Auditing Dependencies & Version Pinning ---');
  const deps = auditDependencies();
  console.log(`Dependencies audited: ${deps.length}`);
  for (const d of deps) {
    console.log(`  - ${d.componentName} (${d.sourceType} v${d.version}): pinned=${d.pinned}, status=${d.status}`);
  }
  if (!deps.every((d) => d.status === 'compliant')) {
    throw new Error('Dependency audit failed!');
  }
  console.log('  -> Passed: Dependencies and version pinning compliant.');

  // Step 4: Generate License Inventory
  console.log('\n--- Step 4: Generating License Inventory ---');
  const licenses = generateLicenseInventory();
  console.log(`License inventory items: ${licenses.length}`);
  for (const l of licenses) {
    console.log(`  - ${l.componentName} (${l.version}): license=${l.license}, redistributable=${l.redistributable}`);
  }
  if (!licenses.every((l) => l.license)) {
    throw new Error('License inventory check failed!');
  }
  console.log('  -> Passed: License inventory verified.');

  // Step 5: Triage Vulnerabilities
  console.log('\n--- Step 5: Triaging Vulnerability Scans ---');
  const vulns = triageVulnerabilities();
  console.log(`Vulnerability triage items: ${vulns.length}`);
  for (const v of vulns) {
    console.log(`  - ${v.cveId} (${v.component}): severity=${v.severity}, status=${v.status}`);
  }
  console.log('  -> Passed: Vulnerability triage complete.');

  // Step 6: Full Security Compliance Audit Report
  console.log('\n--- Step 6: Generating Full L8.2 Audit Report ---');
  const fullReport = runSecurityComplianceAudit();
  console.log(`Verdict summary: ${fullReport.verdict.summary}`);
  if (!fullReport.verdict.fullyCompliant) {
    throw new Error('Full security compliance audit report verdict is NOT fully compliant');
  }

  // Step 7: Validate Report Schema
  console.log('\n--- Step 7: Validating Audit Report Schema ---');
  const schemaVal = validateSecurityComplianceAuditReport(fullReport);
  if (!schemaVal.valid) {
    throw new Error(`Report schema validation failed: ${schemaVal.errors.join(', ')}`);
  }
  console.log('  -> Passed: Security compliance audit report schema is valid.');

  // Step 8: Write Output Deliverable JSON
  console.log('\n--- Step 8: Saving Deliverable Report JSON ---');
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`  -> Audit report saved to: ${REPORT_FILE_PATH}`);

  console.log('\n✅ Secrets, Paths, Diagnostics, Dependencies & Licenses Audit (L8.2) passed successfully.');
}

try {
  runTest();
} catch (err) {
  console.error('\n❌ Security compliance audit test failed:', err.message);
  process.exit(1);
}
