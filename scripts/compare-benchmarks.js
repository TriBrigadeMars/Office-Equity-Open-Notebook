/**
 * Baseline vs Candidate Benchmark Comparison CLI Utility (L0.5)
 */

const fs = require('fs');
const path = require('path');
const {
  compareBenchmarkToBaseline,
  validatePerformanceBenchmarkResult,
} = require('../dist/src/contracts/performance-harness');

function main() {
  const args = process.argv.slice(2);
  const baselinePath = args[0] || path.join(__dirname, '../artifacts/modernization/benchmarks/baseline.json');
  const candidatePath = args[1] || baselinePath;
  const failOnRegression = args.includes('--fail-on-regression');

  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline benchmark file not found at: ${baselinePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(candidatePath)) {
    console.error(`Candidate benchmark file not found at: ${candidatePath}`);
    process.exit(1);
  }

  const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const candidateData = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

  const baseVal = validatePerformanceBenchmarkResult(baselineData);
  if (!baseVal.valid) {
    console.error('Invalid baseline benchmark file:', baseVal.errors.join('; '));
    process.exit(1);
  }

  const candVal = validatePerformanceBenchmarkResult(candidateData);
  if (!candVal.valid) {
    console.error('Invalid candidate benchmark file:', candVal.errors.join('; '));
    process.exit(1);
  }

  const report = compareBenchmarkToBaseline(baselineData, candidateData);

  console.log('================================================================');
  console.log('                 PERFORMANCE BENCHMARK COMPARISON               ');
  console.log('================================================================');
  console.log(`Baseline Timestamp : ${report.baselineTimestamp}`);
  console.log(`Candidate Timestamp: ${report.candidateTimestamp}`);
  console.log(`Candidate Host     : ${report.candidateHost}`);
  console.log(`Noise Threshold    : +/- ${report.noiseThresholdPercent}%\n`);

  console.log('Metric                            Baseline       Candidate      Delta %   Status');
  console.log('--------------------------------------------------------------------------------');

  for (const [key, comp] of Object.entries(report.comparisons)) {
    const baseStr = String(comp.baselineValue).padEnd(14);
    const candStr = String(comp.candidateValue).padEnd(14);
    const deltaSign = comp.deltaPercent >= 0 ? '+' : '';
    const deltaStr = `${deltaSign}${comp.deltaPercent.toFixed(2)}%`.padEnd(9);
    const statusTag = comp.status === 'regressed' ? '❌ REGRESSED' : comp.status === 'improved' ? '✅ IMPROVED' : '  UNCHANGED';
    console.log(`${key.padEnd(32)} ${baseStr} ${candStr} ${deltaStr} ${statusTag}`);
  }

  console.log('--------------------------------------------------------------------------------');
  if (report.hasRegressions) {
    console.log('\n❌ Regressions detected outside noise threshold band.');
    if (failOnRegression) {
      process.exit(1);
    }
  } else {
    console.log('\n✅ No regressions detected outside noise threshold band.');
  }
}

if (require.main === module) {
  main();
}
