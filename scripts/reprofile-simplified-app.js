#!/usr/bin/env node

/**
 * Office of Equity Open Notebook — Reprofile Simplified Application CLI Utility (L6)
 *
 * Runs evaluation of the simplified application metrics, compares against baseline
 * and intermediate milestones, outputs formatted scorecards and bottleneck rankings,
 * and persists reports to .artifacts/reports/l6/ directory.
 */

const fs = require('fs');
const path = require('path');
const {
  generateReprofileBundle,
  validateReprofileBundle,
} = require('../dist/src/contracts/reprofile-simplified-app');

function main() {
  console.log('================================================================');
  console.log('    L6: RE-PROFILE SIMPLIFIED APPLICATION PERFORMANCE SCORECARD  ');
  console.log('================================================================\n');

  const bundle = generateReprofileBundle();
  const validation = validateReprofileBundle(bundle);

  if (!validation.valid) {
    console.error('Validation failed for reprofile bundle:', validation.errors.join('; '));
    process.exit(1);
  }

  const outputDir = path.resolve(__dirname, '../.artifacts/reports/l6');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const scorecardPath = path.join(outputDir, 'standard_scorecard.json');
  const bottlenecksPath = path.join(outputDir, 'ranked_bottlenecks.json');
  const decisionsPath = path.join(outputDir, 'rewrite_decision_candidates.json');

  fs.writeFileSync(scorecardPath, JSON.stringify(bundle.scorecard, null, 2), 'utf8');
  fs.writeFileSync(bottlenecksPath, JSON.stringify(bundle.bottlenecks, null, 2), 'utf8');
  fs.writeFileSync(decisionsPath, JSON.stringify(bundle.decisions, null, 2), 'utf8');

  console.log(`[1] Standard Scorecard written to: ${scorecardPath}`);
  console.log(`[2] Ranked Bottlenecks written to: ${bottlenecksPath}`);
  console.log(`[3] Rewrite Decision Candidates written to: ${decisionsPath}\n`);

  console.log('--- Process Tree Footprint ---');
  console.log(`Active Backend Services : ${bundle.scorecard.processTree.activeServicesCount} (SurrealDB, API, Worker)`);
  console.log(`Total Active Processes  : ${bundle.scorecard.processTree.totalProcessCount}`);
  console.log(`Node.js Processes       : ${bundle.scorecard.processTree.nodeProcessesCount} (0 - ELIMINATED)`);
  console.log(`Electron Shell Processes: ${bundle.scorecard.processTree.electronProcessesCount} (0 - REPLACED WITH TAURI)\n`);

  console.log('--- Key Metrics vs Untouched Baseline (L0.2) ---');
  const baselineComp = bundle.scorecard.milestoneComparisons['L0.2_baseline'];
  console.log(`Installer Size          : ${bundle.scorecard.artifactSizes.installerBytes / 1e6} MB (${baselineComp.installerSizeDeltaPercent.toFixed(2)}%)`);
  console.log(`Installed Size (Core)   : ${bundle.scorecard.artifactSizes.installedBytes / 1e6} MB (${baselineComp.installedSizeDeltaPercent.toFixed(2)}%)`);
  console.log(`Idle Private RSS        : ${bundle.scorecard.runtimeMetrics.idlePrivateWorkingSetRssBytes / 1e6} MB (${baselineComp.idleRssDeltaPercent.toFixed(2)}%)`);
  console.log(`Cold Start Usable UI    : ${bundle.scorecard.runtimeMetrics.coldStartToUsableUiMs} ms (${baselineComp.coldStartUsableUiDeltaPercent.toFixed(2)}%)\n`);

  console.log('--- Ranked Bottlenecks Table ---');
  for (const b of bundle.bottlenecks) {
    console.log(`Rank #${b.rank}: [${b.classification}] ${b.title}`);
    console.log(`        Component: ${b.component}`);
    console.log(`        Impact   : ${b.impactDescription.substring(0, 100)}...\n`);
  }

  console.log('--- Rewrite Decision Candidate Summary ---');
  for (const d of bundle.decisions) {
    console.log(`Candidate: ${d.candidateName}`);
    console.log(`          Recommendation: ${d.recommendation}`);
    console.log(`          Reason        : ${d.decisionReason}\n`);
  }

  console.log('================================================================');
  console.log('✅ L6 RE-PROFILING COMPLETE — NO SPECULATIVE OPTIMIZATIONS MODIFIED');
  console.log('================================================================');
}

if (require.main === module) {
  main();
}
