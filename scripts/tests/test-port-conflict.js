'use strict';

/**
 * test-port-conflict.js
 *
 * Mechanical validation suite for Prompt 08 / L0.6:
 * - Language-neutral conflict/process/ownership result structures
 * - Distinguishing app-owned from external/ambiguous processes
 * - Explicit user confirmation requirement
 * - Pre-kill TOCTOU PID validation
 * - Bounded retry and redaction of diagnostic reports
 */

const assert = require('assert');
const {
  classifyProcessOwnership,
  safelyRecoverPortConflict,
  redactSensitivePathInfo,
} = require('../../dist/src/contracts/port-conflict');

console.log('Testing Port Conflict & Safe Interactive Recovery (L0.6)...\n');

// 1. Process Ownership Classification Tests
console.log('--- Suite 1: Ownership Classification ---');
{
  const appOrphan = {
    pid: 1234,
    name: 'python',
    commandLine: 'python -m surreal_commands.cli.worker',
  };
  const classification = classifyProcessOwnership(appOrphan);
  assert.strictEqual(classification, 'orphaned_app', 'Should classify app worker as orphaned_app');
  console.log('  -> App-owned worker orphan correctly identified');

  const externalProc = {
    pid: 5678,
    name: 'nginx',
    commandLine: 'nginx: master process /usr/sbin/nginx',
  };
  const extClassification = classifyProcessOwnership(externalProc);
  assert.strictEqual(extClassification, 'external_process', 'Should classify nginx as external_process');
  console.log('  -> Unrelated external process correctly identified');

  const unknownProc = classifyProcessOwnership(null);
  assert.strictEqual(unknownProc, 'unknown', 'Null identity should classify as unknown');
  console.log('  -> Ambiguous/null process correctly identified as unknown');
}

// 2. Safe Recovery Confirmation & Fail-Closed Gate
console.log('\n--- Suite 2: User Confirmation & Fail-Closed Behavior ---');
(async () => {
  // Test: External process must NEVER be killed, even if user erroneously confirmed
  const externalConflict = {
    port: 8000,
    serviceName: 'surreal',
    occupyingProcess: { pid: 9999, name: 'other_db', commandLine: 'other_db --port 8000' },
    ownership: 'external_process',
    isRecoverable: false,
    diagnostic: 'Port 8000 occupied by external process',
  };

  let confirmCalled = false;
  const externalResult = await safelyRecoverPortConflict(externalConflict, {
    confirmTermination: async () => {
      confirmCalled = true;
      return true;
    },
  });

  assert.strictEqual(externalResult.resolved, false, 'External conflict must fail closed');
  assert.strictEqual(confirmCalled, false, 'Confirmation must not even be prompted for external procs');
  console.log('  -> External process fails closed immediately without prompt');

  // Test: App orphan declined by user
  const appConflict = {
    port: 5055,
    serviceName: 'api',
    occupyingProcess: { pid: 4444, name: 'python', commandLine: 'python -m uvicorn api.main:app' },
    ownership: 'orphaned_app',
    isRecoverable: true,
    diagnostic: 'Port 5055 occupied by orphaned api',
  };

  const declinedResult = await safelyRecoverPortConflict(appConflict, {
    confirmTermination: async () => false, // User clicks "Cancel"
  });
  assert.strictEqual(declinedResult.resolved, false, 'Declined termination must not resolve');
  console.log('  -> User refusal to terminate orphan aborts cleanly');

  // Test: App orphan confirmed and killed safely
  let killedPid = null;
  const acceptedResult = await safelyRecoverPortConflict(appConflict, {
    confirmTermination: async () => true,
    inspector: {
      isProcessAlive: () => true,
      getProcessCommandLine: () => 'python -m uvicorn api.main:app',
      killProcess: (pid) => {
        killedPid = pid;
        return true;
      },
    },
  });
  assert.strictEqual(acceptedResult.resolved, true, 'Confirmed termination succeeds');
  assert.strictEqual(killedPid, 4444, 'Correct PID was terminated');
  console.log('  -> User-confirmed app orphan terminated safely');

  // Test: TOCTOU safety violation detection
  let toctouKilled = false;
  const toctouResult = await safelyRecoverPortConflict(appConflict, {
    confirmTermination: async () => true,
    inspector: {
      isProcessAlive: () => true,
      // Process PID was recycled by another process right before kill!
      getProcessCommandLine: () => '/usr/bin/unrelated-system-daemon',
      killProcess: () => {
        toctouKilled = true;
        return true;
      },
    },
  });
  assert.strictEqual(toctouResult.resolved, false, 'TOCTOU change must fail closed');
  assert.strictEqual(toctouKilled, false, 'Must not kill recycled PID');
  console.log('  -> TOCTOU pre-kill verification successfully prevents killing recycled PID');

  // 3. Diagnostic Redaction
  console.log('\n--- Suite 3: Sensitive Path & Secret Redaction ---');
  const rawDiag = 'Path: /home/mars/StudioProjects/secret_key=xyz123 on port 8000';
  const redacted = redactSensitivePathInfo(rawDiag);
  assert.ok(!redacted.includes('/home/mars'), 'Username must be redacted');
  assert.ok(!redacted.includes('xyz123'), 'Secret value must be redacted');
  console.log('  -> Diagnostics correctly redacts username and tokens');

  console.log('\n✅ All Port Conflict & Recovery Contract tests passed successfully.');
})();
