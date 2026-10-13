#!/usr/bin/env node

/**
 * Antigravity Orchestrator for Android Studio Gemini Agent.
 * Bridges prompt packs, model allocations, task staging,
 * trajectory monitoring, and mechanical verification.
 */

const fs = require('fs');
const path = require('path');
const { getSessionStatus, watchForCompletion } = require('./trajectory_watcher');
const { runVerification } = require('./verifier');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROMPT_DIR = path.join(PROJECT_ROOT, 'office-equity-modernization-prompt-pack/prompts');
const STATE_FILE = path.join(PROJECT_ROOT, 'docs/modernization/state/CURRENT.md');
const ACTIVE_TASK_FILE = path.join(PROJECT_ROOT, '.agent/CURRENT_TASK.md');
const AGENTS_MD_FILE = path.join(PROJECT_ROOT, 'AGENTS.md');

function getCurrentPacketInfo() {
  if (!fs.existsSync(STATE_FILE)) {
    return { packetId: null, raw: '' };
  }
  const content = fs.readFileSync(STATE_FILE, 'utf8');
  const match = content.match(/## Current Packet\s*\n\s*`([^`]+)`\s*(?:\([^)]*Prompt\s*(\d+)[^)]*\))?/i);
  if (!match) {
    return { packetId: null, raw: content };
  }
  const packetId = match[1];
  const promptNumber = match[2] ? parseInt(match[2], 10) : null;
  return { packetId, promptNumber };
}

function findPromptFile(packetId, promptNumber) {
  if (!fs.existsSync(PROMPT_DIR)) return null;
  const files = fs.readdirSync(PROMPT_DIR);

  if (promptNumber) {
    const padNum = String(promptNumber).padStart(2, '0');
    const byNum = files.find(f => f.startsWith(`${padNum}_`));
    if (byNum) return path.join(PROMPT_DIR, byNum);
  }

  const byPacket = files.find(f => f.includes(`_${packetId}_`));
  if (byPacket) return path.join(PROMPT_DIR, byPacket);

  return null;
}

function parsePromptMetadata(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let title = path.basename(filePath, '.md');
  let model = 'gemini-3.6-flash'; // default
  let packetId = '';

  for (const line of lines.slice(0, 15)) {
    if (line.startsWith('# ')) {
      title = line.replace('# ', '').trim();
    }
    if (line.includes('Execution class:')) {
      if (line.includes('3.5 Flash-Lite') || line.includes('3.5 Flash Lite') || line.includes('flash_lite')) {
        model = 'gemini-3.5-flash-lite';
      } else if (line.includes('3.1 Pro') || line.includes('3.1-pro')) {
        model = 'gemini-3.1-pro-preview';
      } else if (line.includes('3.6 Flash') || line.includes('3.6-flash')) {
        model = 'gemini-3.6-flash';
      }
    }
    if (line.includes('Packet ID:')) {
      const m = line.match(/`([^`]+)`/);
      if (m) packetId = m[1];
    }
  }

  return { title, model, packetId, filePath, content };
}

function showStatus() {
  console.log('========================================================');
  console.log('       ANTIGRAVITY -> ANDROID STUDIO ORCHESTRATOR       ');
  console.log('========================================================\n');

  const { packetId, promptNumber } = getCurrentPacketInfo();
  console.log(`Current Roadmap State: Packet [${packetId || 'UNKNOWN'}] (Prompt #${promptNumber || '?'})`);

  const promptFile = findPromptFile(packetId, promptNumber);
  if (promptFile) {
    const meta = parsePromptMetadata(promptFile);
    console.log(`Active Prompt File:    ${path.basename(promptFile)}`);
    console.log(`Prompt Title:          ${meta.title}`);
    console.log(`Designated Model:      ${meta.model.toUpperCase()}`);
  } else {
    console.log('Active Prompt File:    (None found)');
  }

  console.log('\n--- Android Studio Agent Status ---');
  const studioStatus = getSessionStatus();
  if (studioStatus.found) {
    console.log(`Latest Studio Session: ${studioStatus.id}`);
    console.log(`Studio Model In Use:   ${studioStatus.model}`);
    console.log(`Last Agent Title:      "${studioStatus.title}"`);
    console.log(`Turn Status:           ${studioStatus.isDone ? 'DONE (Ready for verification)' : 'IN PROGRESS'}`);
    console.log(`Last Activity:         ${studioStatus.lastModified}`);
  } else {
    console.log(`Studio Session:        ${studioStatus.message}`);
  }
  console.log('========================================================\n');
}

function stageTask(promptOverride) {
  let { packetId, promptNumber } = getCurrentPacketInfo();
  if (promptOverride) {
    promptNumber = parseInt(promptOverride, 10);
    packetId = null;
  }
  const promptFile = findPromptFile(packetId, promptNumber);
  if (!promptFile) {
    console.error(`Cannot find prompt file for packet ${packetId} / prompt ${promptNumber}.`);
    process.exit(1);
  }

  const meta = parsePromptMetadata(promptFile);
  const agentDir = path.dirname(ACTIVE_TASK_FILE);
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  const taskPayload = `# ACTIVE TASK FOR ANDROID STUDIO GEMINI AGENT

> **Assigned Model:** \`${meta.model}\`
> **Packet ID:** \`${meta.packetId}\`
> **Prompt Source:** \`${path.basename(promptFile)}\`

---

## Unattended-run contract (applies on top of the packet below)
- No human is available to answer questions. Make the most conservative reasonable choice, record it in the handoff, and continue.
- Run all shell commands non-interactively. Node is at \`.local_tools/node-v22.14.0-linux-x64/bin\` (prepend it to PATH). Python 3 is available.
- Cargo, Go and .NET are NOT installed on this machine. Use Docker (\`docker run --rm -v "$PWD":/work -w /work <image> ...\`, e.g. \`rust:latest\`, \`golang:latest\`, \`mcr.microsoft.com/dotnet/sdk:8.0\`) when a toolchain is required. If something truly cannot be built here (for example WinUI/WebView2, which needs Windows), deliver the contract/spec/source plus an explicit \`BLOCKED-ON-WINDOWS\` note in the handoff rather than faking results.
- Do NOT modify \`MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN*.md\` or anything under \`office-equity-modernization-prompt-pack/\`.
- Do NOT run \`git commit\`, \`git push\`, \`git reset\`, \`git checkout\` or \`git clean\`; the orchestrator commits after verification.
- When finished you MUST: (1) write \`docs/modernization/handoffs/${meta.packetId}.md\`; (2) add this packet to "Completed Packets" and a one-line entry to "Current Status" in \`docs/modernization/state/CURRENT.md\`, leaving the "## Current Packet" pointer for the orchestrator to advance; (3) run \`node scripts/orchestrator/verifier.js\` and fix any failure; (4) stop. Do not begin the next prompt.

---

## Instructions
Execute the following prompt packet completely and adhere strictly to packet boundaries.

${meta.content}
`;

  fs.writeFileSync(ACTIVE_TASK_FILE, taskPayload, 'utf8');

  // Update root AGENTS.md so Android Studio Agent automatically ingests current priority
  const agentsMdContent = `# AGENTS INSTRUCTIONS FOR ANDROID STUDIO

## ACTIVE PRIORITY
Currently executing **Packet ${meta.packetId}** (\`${path.basename(promptFile)}\`).
Assigned model: **${meta.model}**.

Read and execute the instructions specified in:
\`file://${ACTIVE_TASK_FILE}\`

## MECHANICAL VERIFICATION RULES
1. Never guess build or test outcomes.
2. Run mechanical checks after every file edit:
   \`export PATH="$PWD/.local_tools/node-v22.14.0-linux-x64/bin:$PATH"\`
   \`npm run build:types\`
3. Keep diffs strictly focused on this packet's deliverables.
`;

  fs.writeFileSync(AGENTS_MD_FILE, agentsMdContent, 'utf8');

  console.log(`✓ Staged active task into: ${ACTIVE_TASK_FILE}`);
  console.log(`✓ Updated repository AGENTS.md anchor`);
  console.log(`\n--------------------------------------------------------`);
  console.log(`TARGET MODEL: [ ${meta.model} ]`);
  console.log(`IN ANDROID STUDIO:`);
  console.log(`1. Switch to/open the tab running model: ${meta.model}`);
  console.log(`2. Send prompt:`);
  console.log(`   "Execute the active task staged in .agent/CURRENT_TASK.md"`);
  console.log(`--------------------------------------------------------\n`);
}

function watchAndVerify(maxWaitMs = 1800000) {
  stageTask();
  console.log('Waiting for Android Studio Agent completion to trigger automatic verification...');
  watchForCompletion(null, (status) => {
    console.log('\nAgent run finished. Running mechanical test suites now...\n');
    const { allPassed } = runVerification();
    if (allPassed) {
      console.log('\n✓ Mechanical verification PASSED! All suites green.');
      console.log('You can now run: node scripts/orchestrator/orchestrator.js advance');
    } else {
      console.error('\n✗ Verification had failures. Review errors above.');
    }
  }, 2000, maxWaitMs);
}

function main() {
  const cmd = process.argv[2] || 'status';

  switch (cmd) {
    case 'status':
      showStatus();
      break;
    case 'stage':
      stageTask(process.argv[3]);
      break;
    case 'verify':
      runVerification();
      break;
    case 'watch':
      watchAndVerify();
      break;
    default:
      console.log(`Usage: node scripts/orchestrator/orchestrator.js [status|stage|verify|watch]`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { showStatus, stageTask, getCurrentPacketInfo, findPromptFile, parsePromptMetadata };
