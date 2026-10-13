#!/usr/bin/env node

/**
 * Mechanical Verifier for Antigravity-Android Studio Orchestrator.
 * Executes TypeScript builds and contract/regression test suites.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LOCAL_NODE_BIN = path.join(PROJECT_ROOT, '.local_tools/node-v22.14.0-linux-x64/bin');

function getEnvironment() {
  const env = { ...process.env };
  if (fs.existsSync(LOCAL_NODE_BIN)) {
    env.PATH = `${LOCAL_NODE_BIN}:${env.PATH}`;
  }
  return env;
}

function runCommand(command, cwd = PROJECT_ROOT) {
  try {
    const stdout = execSync(command, {
      cwd,
      env: getEnvironment(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, output: stdout.trim() };
  } catch (err) {
    return {
      passed: false,
      output: (err.stdout ? err.stdout : '') + (err.stderr ? err.stderr : err.message),
    };
  }
}

function runVerification() {
  const env = getEnvironment();
  const results = [];

  console.log('--- [1/2] Running TypeScript Type Check & Build ---');
  const typecheck = runCommand('npm run build:types');
  results.push({ name: 'build:types', passed: typecheck.passed, output: typecheck.output });
  if (typecheck.passed) {
    console.log('✓ TypeScript build succeeded.');
  } else {
    console.error('✗ TypeScript build failed:\n' + typecheck.output);
  }

  console.log('\n--- [2/2] Running Mechanical Test Suites ---');
  const testDir = path.join(PROJECT_ROOT, 'scripts/tests');
  const testFiles = fs.readdirSync(testDir)
    .filter(file => file.startsWith('test-') && file.endsWith('.js'))
    .sort();

  for (const file of testFiles) {
    const res = runCommand(`node scripts/tests/${file}`);
    results.push({ name: file, passed: res.passed, output: res.output });
    if (res.passed) {
      console.log(`✓ ${file}: PASSED`);
    } else {
      console.error(`✗ ${file}: FAILED\n${res.output}`);
    }
  }

  const allPassed = results.every(r => r.passed);
  console.log('\n========================================');
  console.log(`Verification Summary: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  console.log(`Total Suites: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);
  console.log('========================================');

  return { allPassed, results };
}

if (require.main === module) {
  const { allPassed } = runVerification();
  process.exit(allPassed ? 0 : 1);
}

module.exports = { runVerification };
