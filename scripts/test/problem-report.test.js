'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createProblemReport,
  renderProblems,
  consoleRenderer,
  captureLogTail,
} = require('../lib/problem-report');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let output = '';
  process.stderr.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    return { result: fn(), output: () => output };
  } finally {
    process.stderr.write = originalWrite;
  }
}

test('collecting and rendering mixed warnings and errors sets exit code 1', () => {
  const report = createProblemReport();
  report.add('OPTIONAL_FILE', 'Optional file is absent.', { severity: 'warning' });
  report.add('REQUIRED_FILE', 'Required file is absent.');
  const captured = captureStderr(() => report.render());

  assert.strictEqual(report.hasErrors(), true);
  assert.strictEqual(report.exitCode(), 1);
  assert.strictEqual(captured.output(),
    '⚠ OPTIONAL_FILE: Optional file is absent.\n\n✗ REQUIRED_FILE: Required file is absent.\n');
});

test('captureLogTail preserves short logs and exactly-N windows', () => {
  assert.strictEqual(captureLogTail('one\ntwo', 3), 'one\ntwo');
  assert.strictEqual(captureLogTail('one\ntwo\nthree', 3), 'one\ntwo\nthree');
});

test('captureLogTail returns only the tail window for longer logs', () => {
  assert.strictEqual(captureLogTail('one\ntwo\nthree\nfour', 2), 'three\nfour');
});

test('captureLogTail handles empty text and zero-length windows', () => {
  assert.strictEqual(captureLogTail('', 3), '');
  assert.strictEqual(captureLogTail('one\ntwo', 0), '');
});

test('renderer substitution receives the same structured problem data', () => {
  const report = createProblemReport();
  report.add('EXAMPLE', 'Example failure.', { detail: 'More information.' });
  const problems = report.problems;
  let consoleData;
  let dialogData;
  const captured = captureStderr(() => {
    renderProblems(problems, { renderer: (data) => { consoleData = data; } });
    renderProblems(problems, { renderer: (data) => { dialogData = data; } });
  });

  assert.strictEqual(captured.output(), '');
  assert.strictEqual(consoleData, problems);
  assert.strictEqual(dialogData, problems);
  assert.deepStrictEqual(problems[0], {
    code: 'EXAMPLE',
    message: 'Example failure.',
    severity: 'error',
    detail: 'More information.',
  });
});

test('consoleRenderer output matches the golden structured format', () => {
  const problems = [
    { code: 'MISSING_CONFIG', message: 'Config file is missing.', severity: 'error', detail: 'Expected it in the app folder.' },
    { code: 'SLOW_START', message: 'Startup took longer than expected.', severity: 'warning', logTail: 'service started late' },
  ];
  const captured = captureStderr(() => consoleRenderer(problems));
  const expected =
    '✗ MISSING_CONFIG: Config file is missing.\n' +
    '  Expected it in the app folder.\n\n' +
    '⚠ SLOW_START: Startup took longer than expected.\n' +
    '  service started late';

  assert.strictEqual(captured.result, expected);
  assert.strictEqual(captured.output(), `${expected}\n`);
});

test('verify-runtime CLI retains its existing failure block format', () => {
  const missingDir = path.join(require('os').tmpdir(), `onb-missing-frontend-${process.pid}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'verify-runtime.js'), missingDir], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stdout, '');
  assert.strictEqual(
    result.stderr,
    `Frontend runtime check FAILED for ${missingDir}:\n  - Frontend directory not found: ${missingDir}\n`
  );
});

console.log(`\n${passed} tests passed`);
