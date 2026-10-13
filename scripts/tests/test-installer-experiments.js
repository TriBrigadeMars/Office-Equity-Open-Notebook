'use strict';

/**
 * test-installer-experiments.js
 *
 * Contract test suite for L5.2 Installer Variant Experiments.
 * Validates installer variant definitions, WebView2 provisioning policies,
 * automated lifecycle simulation, offline compliance, and decision matrix output.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');

const contractsPath = path.join(DIST_DIR, 'src', 'contracts', 'installer-experiments.js');

if (!fs.existsSync(contractsPath)) {
  console.error('Built contract modules not found. Run `npm run build:types` first.');
  process.exit(1);
}

const {
  WEBVIEW2_REG_KEY,
  DEFAULT_WEBVIEW2_POLICY,
  INSTALLER_VARIANT_DEFINITIONS,
  evaluateWebView2Requirement,
  simulateInstallerLifecycle,
  calculateVariantScore,
  generateInstallerComparisonMatrix,
} = require(contractsPath);

console.log('Testing Installer Variant Experiments Contracts (L5.2)...\n');

// --- Suite 1: Installer Variant Definitions ---
console.log('--- Suite 1: Installer Variant Definitions & Configurations ---');
const variantKeys = Object.keys(INSTALLER_VARIANT_DEFINITIONS);
assert.strictEqual(variantKeys.length, 4, 'Must define exactly 4 installer variants');
assert.ok(INSTALLER_VARIANT_DEFINITIONS.monolithic_full_nsis, 'Monolithic variant defined');
assert.ok(INSTALLER_VARIANT_DEFINITIONS.core_minimal_nsis_addon, 'Core minimal variant defined');
assert.ok(INSTALLER_VARIANT_DEFINITIONS.web_bootstrapper_stub, 'Web bootstrapper variant defined');
assert.ok(INSTALLER_VARIANT_DEFINITIONS.portable_zip_per_user, 'Portable zip variant defined');

const coreMinimal = INSTALLER_VARIANT_DEFINITIONS.core_minimal_nsis_addon;
assert.strictEqual(coreMinimal.requiresAdmin, false, 'Core minimal variant should support non-admin per-user install');
assert.strictEqual(coreMinimal.supportsOfflineInstall, true, 'Core minimal variant must support offline install');
assert.ok(
  coreMinimal.installerSizeBytes < INSTALLER_VARIANT_DEFINITIONS.monolithic_full_nsis.installerSizeBytes,
  'Core minimal installer size must be strictly smaller than monolithic'
);
console.log('  -> All 4 installer variant definitions validated.');

// --- Suite 2: WebView2 Detection & Provisioning Policies ---
console.log('\n--- Suite 2: WebView2 Detection & Provisioning Policies ---');
assert.strictEqual(DEFAULT_WEBVIEW2_POLICY.systemDetectionRegKey, WEBVIEW2_REG_KEY);

// System has WebView2
const res1 = evaluateWebView2Requirement(true, false);
assert.strictEqual(res1.ready, true);
assert.strictEqual(res1.actionRequired, 'none');

// System missing WebView2, online, silent_bootstrap policy
const res2 = evaluateWebView2Requirement(false, false, {
  ...DEFAULT_WEBVIEW2_POLICY,
  fallbackStrategy: 'silent_bootstrap',
});
assert.strictEqual(res2.ready, false);
assert.strictEqual(res2.actionRequired, 'silent_download');

// System missing WebView2, offline, with redistributable fallback
const res3 = evaluateWebView2Requirement(false, true, {
  ...DEFAULT_WEBVIEW2_POLICY,
  offlineFallbackInstallerPath: 'resources/redist/MicrosoftEdgeWebview2Setup.exe',
});
assert.strictEqual(res3.ready, false);
assert.strictEqual(res3.actionRequired, 'use_offline_redist');

console.log('  -> WebView2 detection and offline fallback policies validated.');

// --- Suite 3: Automated Lifecycle Simulation & Checks ---
console.log('\n--- Suite 3: Automated Lifecycle Simulation & Checks ---');
for (const variantId of variantKeys) {
  const lifecycle = simulateInstallerLifecycle(variantId);
  assert.ok(lifecycle.checks.length >= 5, `Variant ${variantId} must run at least 5 lifecycle checks`);

  const cleanInstall = lifecycle.checks.find((c) => c.action === 'clean_install');
  assert.ok(cleanInstall, `Variant ${variantId} missing clean_install check`);

  const upgrade = lifecycle.checks.find((c) => c.action === 'upgrade');
  assert.ok(upgrade, `Variant ${variantId} missing upgrade check`);
  assert.strictEqual(upgrade.preservedUserData, true, `Variant ${variantId} upgrade must preserve user data`);

  const uninstall = lifecycle.checks.find((c) => c.action === 'uninstall');
  assert.ok(uninstall, `Variant ${variantId} missing uninstall check`);
  assert.strictEqual(uninstall.preservedUserData, true, `Variant ${variantId} uninstall must preserve user data`);
}

// Test simulated failure handling
const failedLifecycle = simulateInstallerLifecycle('core_minimal_nsis_addon', { mockErrorOnAction: 'upgrade' });
assert.strictEqual(failedLifecycle.allPassed, false, 'Simulated upgrade failure correctly reflected in allPassed flag');
const failedCheck = failedLifecycle.checks.find((c) => c.action === 'upgrade');
assert.strictEqual(failedCheck.passed, false);
assert.ok(failedCheck.error, 'Error message present on failed check');

console.log('  -> Lifecycle checks (clean install, upgrade, repair, uninstall, offline) validated.');

// --- Suite 4: Offline Privacy & Air-Gap Verification ---
console.log('\n--- Suite 4: Offline Privacy & Air-Gap Verification ---');
const offlineCore = simulateInstallerLifecycle('core_minimal_nsis_addon', { isOffline: true });
const offlineCheck = offlineCore.checks.find((c) => c.action === 'offline_install');
assert.strictEqual(offlineCheck.passed, true, 'Core minimal variant must pass offline install check');

const offlineBootstrapper = simulateInstallerLifecycle('web_bootstrapper_stub', { isOffline: true });
const offlineBootCheck = offlineBootstrapper.checks.find((c) => c.action === 'offline_install');
assert.strictEqual(offlineBootCheck.passed, false, 'Web bootstrapper variant must fail offline install check');

console.log('  -> Offline privacy and air-gap constraints verified.');

// --- Suite 5: Variant Scoring & Preferred Variant Matrix Decision ---
console.log('\n--- Suite 5: Variant Scoring & Preferred Variant Matrix Decision ---');
const matrix = generateInstallerComparisonMatrix();

assert.ok(matrix.variants.core_minimal_nsis_addon, 'Core minimal in matrix');
assert.strictEqual(matrix.preferredVariantId, 'core_minimal_nsis_addon', 'Preferred variant must be core_minimal_nsis_addon');
assert.strictEqual(matrix.offlinePrivacyCompliant, true, 'Matrix decision must be offline privacy compliant');
assert.ok(matrix.metrics.maxSizeSavingsPercent > 50, 'Max size savings should exceed 50%');
assert.ok(matrix.decisionReasoning.length >= 4, 'Decision reasoning should provide at least 4 detailed points');

console.log('  -> Preferred variant selection engine and comparison matrix validated.');

console.log('\n✅ All Installer Variant Experiments Contract tests passed successfully.');
