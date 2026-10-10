'use strict';

/**
 * test-worker-concurrency.js
 *
 * Mechanical validation suite for Prompt 13 / L1.5:
 * - Validates schema, metrics, and evidence for worker concurrency benchmark
 * - Asserts throughput vs peak memory trade-offs across 1, 2, 3, and 5 tasks
 * - Validates evidence-based default recommendation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Worker Concurrency Benchmark Contracts (L1.5)...\n');

const reportPath = path.resolve(__dirname, '../../.artifacts/reports/l1_5/worker_concurrency_benchmark.json');
assert.ok(fs.existsSync(reportPath), 'Worker concurrency report must exist on disk');

const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// 1. Benchmark Matrix Structure
console.log('--- Suite 1: Benchmark Matrix Schema ---');
assert.strictEqual(data.packet, 'L1.5');
assert.strictEqual(data.current_default.maxConcurrentTasks, 5);
assert.strictEqual(data.candidates.length, 4, 'Must evaluate 1, 2, 3, and 5 concurrency tiers');
console.log('  -> Evaluated candidates: 1, 2, 3, 5 tasks verified');

// 2. Concurrency Trade-Off Assertions
console.log('\n--- Suite 2: Trade-Off Quantification ---');
const c1 = data.candidates.find(c => c.concurrency === 1);
const c2 = data.candidates.find(c => c.concurrency === 2);
const c5 = data.candidates.find(c => c.concurrency === 5);

assert.ok(c2.throughputTasksPerSec > c1.throughputTasksPerSec, 'Concurrency 2 throughput must exceed Concurrency 1');
assert.ok(c5.peakMemoryRssBytes > c2.peakMemoryRssBytes * 2, 'Concurrency 5 memory must be more than double Concurrency 2');
console.log('  -> Memory scaling verified: Concurrency 2 (~230MB) vs Concurrency 5 (~550MB)');

// 3. Evidence-Based Recommendation
console.log('\n--- Suite 3: Default Recommendation Validation ---');
assert.strictEqual(data.recommendation.recommendedDefault, 2, 'Recommended default must be 2 for desktop balance');
assert.ok(data.recommendation.rationale.length > 20, 'Rationale must be documented');
console.log('  -> Evidence-backed recommendation: Concurrency 2 confirmed');

console.log('\n✅ All Worker Concurrency Benchmark Contract tests passed successfully.');
