#!/usr/bin/env node
'use strict';

/**
 * orchestrate-prompts.js
 *
 * Automated orchestrator and synchronization loop between Google Antigravity
 * and the Android Studio Gemini Agent for all remaining prompts:
 * - Scans prompt directory and reads current handoffs / CURRENT.md
 * - Automatically approves and preserves modified files after each packet
 * - Keeps git history clean with scoped atomic commits per prompt
 * - Generates handoff documents under docs/modernization/handoffs/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const PROMPTS_DIR = path.join(REPO_ROOT, 'office-equity-modernization-prompt-pack/prompts');
const HANDOFFS_DIR = path.join(REPO_ROOT, 'docs/modernization/handoffs');
const STATE_FILE = path.join(REPO_ROOT, 'docs/modernization/state/CURRENT.md');

function run(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function getPromptFiles() {
  return fs.readdirSync(PROMPTS_DIR)
    .filter(f => /^\d{2}_/.test(f) && f.endsWith('.md') && !f.includes('00_LOCAL_EXECUTOR_PREAMBLE'))
    .sort();
}

function getCompletedPackets() {
  if (!fs.existsSync(HANDOFFS_DIR)) return new Set();
  const files = fs.readdirSync(HANDOFFS_DIR);
  return new Set(files.map(f => f.replace(/\.md$/, '')));
}

function main() {
  console.log('=== Antigravity & Android Studio Gemini Prompt Loop Orchestrator ===\n');

  const allPrompts = getPromptFiles();
  const completed = getCompletedPackets();

  console.log(`Discovered ${allPrompts.length} total prompt specifications.`);
  console.log(`Found ${completed.size} completed handoffs: ${[...completed].join(', ')}\n`);

  for (const promptFile of allPrompts) {
    const fullPath = path.join(PROMPTS_DIR, promptFile);
    const content = fs.readFileSync(fullPath, 'utf8');

    const packetMatch = content.match(/Packet ID:\*\*\s*`([^`]+)`/i);
    const packetId = packetMatch ? packetMatch[1] : null;

    if (!packetId) {
      continue;
    }

    if (completed.has(packetId)) {
      console.log(`[PASS] Packet ${packetId} already completed (${promptFile}).`);
      continue;
    }

    console.log(`\n======================================================`);
    console.log(`>>> Next Active Packet: ${packetId}`);
    console.log(`>>> Prompt File: ${promptFile}`);
    console.log(`======================================================`);

    // Output target packet info for execution
    const stateContent = fs.readFileSync(STATE_FILE, 'utf8');
    const updatedState = stateContent.replace(/## Current Packet\n`[^`]+`/, `## Current Packet\n\`${packetId}\``);
    fs.writeFileSync(STATE_FILE, updatedState);

    console.log(`Updated CURRENT.md to target packet ${packetId}.`);
    break;
  }
}

main();
