'use strict';

/**
 * Contract test suite for Clean Machine Installation & Upgrade Validation (L5.3).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');
const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'clean-machine-validation.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  SUPPORTED_WINDOWS_ENVIRONMENTS,
  validateInstallPaths,
  validatePrerequisites,
  validateLegacyUpgrade,
  validateProcessCleanup,
  generateInstallerHashes,
  generateCleanMachineReport,
} = require(contractsPath);

function runTests() {
  console.log('Running Clean Machine Installation & Upgrade Validation Contract Tests (L5.3)...\n');

  // Test 1: Supported Windows Environments
  console.log('Test 1: Windows Environment Matrix');
  assert.ok(SUPPORTED_WINDOWS_ENVIRONMENTS.win10_x64_clean, 'Windows 10 x64 clean environment must exist');
  assert.ok(SUPPORTED_WINDOWS_ENVIRONMENTS.win11_x64_clean, 'Windows 11 x64 clean environment must exist');
  assert.ok(SUPPORTED_WINDOWS_ENVIRONMENTS.win11_arm64_prism, 'Windows 11 ARM64 Prism environment must exist');
  assert.ok(SUPPORTED_WINDOWS_ENVIRONMENTS.win_server2022_x64, 'Windows Server 2022 x64 environment must exist');
  console.log('✓ Windows Environment Matrix definitions verified.');

  // Test 2: Installation Path Edge Cases
  console.log('\nTest 2: Installation Path Edge Cases');
  const pathCases = validateInstallPaths();
  assert.strictEqual(pathCases.length, 4, 'Must evaluate 4 path edge cases');

  const spacesCase = pathCases.find((c) => c.id === 'custom_program_files_spaces');
  assert.ok(spacesCase && spacesCase.hasSpaces, 'Program Files spaces case must be present and flagged');

  const unicodeCase = pathCases.find((c) => c.id === 'unicode_accented_profile');
  assert.ok(unicodeCase && unicodeCase.hasUnicode, 'Unicode profile case must be present and flagged');

  const driveCase = pathCases.find((c) => c.id === 'non_default_drive');
  assert.ok(driveCase && driveCase.isCustomDrive, 'Non-default drive case must be present and flagged');
  console.log('✓ Install path edge cases verified.');

  // Test 3: Prerequisite Recovery Messaging
  console.log('\nTest 3: Prerequisite Recovery Messaging');
  const win10Config = SUPPORTED_WINDOWS_ENVIRONMENTS.win10_x64_clean;
  const prereqs = validatePrerequisites(win10Config);
  assert.strictEqual(prereqs.length, 4, 'Must evaluate 4 prerequisites');

  const wvPrereq = prereqs.find((p) => p.prerequisiteId === 'webview2');
  assert.ok(wvPrereq && !wvPrereq.presentInEnvironment, 'WebView2 must be missing in clean Win10');
  assert.ok(wvPrereq.gracefulFallbackPassed, 'WebView2 fallback check must pass');
  console.log('✓ Prerequisite recovery messaging verified.');

  // Test 4: Legacy Upgrade Path Simulation
  console.log('\nTest 4: Legacy Upgrade Path');
  const upgrade = validateLegacyUpgrade();
  assert.strictEqual(upgrade.sourceVersion, 'v0.9.5-electron');
  assert.strictEqual(upgrade.targetVersion, 'v1.0.0-tauri');
  assert.strictEqual(upgrade.userDataPreserved, true, 'User data must be preserved');
  assert.strictEqual(upgrade.legacyFilesCleaned, true, 'Legacy files must be cleaned');
  assert.strictEqual(upgrade.passed, true);
  console.log('✓ Legacy upgrade path verified.');

  // Test 5: Process and Service Containment
  console.log('\nTest 5: Zero Orphan Process Cleanup');
  const shutdownCleanup = validateProcessCleanup('after_shutdown');
  assert.strictEqual(shutdownCleanup.zeroOrphansVerified, true);
  assert.strictEqual(shutdownCleanup.activeProcessesFound.length, 0);

  const uninstallCleanup = validateProcessCleanup('after_uninstall');
  assert.strictEqual(uninstallCleanup.zeroOrphansVerified, true);
  assert.strictEqual(uninstallCleanup.orphanServicesFound.length, 0);
  console.log('✓ Zero orphan process cleanup verified.');

  // Test 6: Installer Cryptographic Hashes
  console.log('\nTest 6: Installer Cryptographic Checksums');
  const hashes = generateInstallerHashes();
  assert.strictEqual(hashes.length, 4, 'Must produce hashes for 4 installer artifacts');
  for (const h of hashes) {
    assert.ok(h.sha256 && h.sha256.length === 64, 'SHA-256 hash must be 64 characters hex');
    assert.ok(h.md5 && h.md5.length === 32, 'MD5 hash must be 32 characters hex');
  }
  console.log('✓ Installer cryptographic checksums verified.');

  // Test 7: Master Report Generation
  console.log('\nTest 7: Clean Machine Validation Report Generation');
  const report = generateCleanMachineReport();
  assert.strictEqual(report.packet, 'L5.3');
  assert.strictEqual(report.allPassed, true);
  assert.strictEqual(report.preferredVariantId, 'core_minimal_nsis_addon');
  console.log('✓ Clean Machine validation report generation verified.');

  console.log('\n✅ All Clean Machine Validation contract tests PASSED!');
}

runTests();
