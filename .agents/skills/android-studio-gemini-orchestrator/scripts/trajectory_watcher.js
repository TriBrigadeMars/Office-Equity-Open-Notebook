#!/usr/bin/env node

/**
 * Trajectory Watcher for Android Studio Gemini Agent.
 * Tracks conversation steps in ~/.android/studio/agent/conversations/
 * and detects when the Agent completes a coding task turn.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getConversationBase() {
  if (process.env.STUDIO_CONVERSATION_DIR) return process.env.STUDIO_CONVERSATION_DIR;
  const root = path.join(os.homedir(), '.android/studio/agent/conversations');
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      path: path.join(root, d.name),
      mtime: fs.statSync(path.join(root, d.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return dirs.length > 0 ? dirs[0].path : null;
}

function getConversations() {
  const convBase = getConversationBase();
  if (!convBase || !fs.existsSync(convBase)) {
    return [];
  }

  const entries = fs.readdirSync(convBase, { withFileTypes: true });
  const conversations = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(convBase, entry.name);
    const metaPath = path.join(dir, 'metadata.json');
    const stepsPath = path.join(dir, 'steps.jsonl');

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const stat = fs.statSync(metaPath);
        conversations.push({
          id: entry.name,
          dir,
          meta,
          metaPath,
          stepsPath,
          mtime: stat.mtimeMs,
          model: meta.modelId ? meta.modelId.id : 'unknown',
          title: meta.title || '(untitled)',
          plannerState: meta.plannerState ? meta.plannerState.type : 'unknown',
        });
      } catch (e) {
        // ignore parse error
      }
    }
  }

  return conversations.sort((a, b) => b.mtime - a.mtime);
}

function getLatestStep(stepsPath) {
  if (!fs.existsSync(stepsPath)) return null;
  const content = fs.readFileSync(stepsPath, 'utf8').trim();
  if (!content) return null;

  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const step = JSON.parse(lines[i]);
      return step;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function getSessionStatus(conversationId = null) {
  const convs = getConversations();
  if (convs.length === 0) {
    return { found: false, message: 'No Android Studio agent sessions found.' };
  }

  const target = conversationId
    ? convs.find(c => c.id === conversationId)
    : convs[0];

  if (!target) {
    return { found: false, message: `Session ${conversationId} not found.` };
  }

  const latestStep = getLatestStep(target.stepsPath);
  const isDone = latestStep && latestStep.type === 'ModelResponseStep' && latestStep.status === 'DONE';

  return {
    found: true,
    id: target.id,
    model: target.model,
    title: target.title,
    plannerState: target.plannerState,
    lastModified: new Date(target.mtime).toISOString(),
    isDone,
    latestStepType: latestStep ? latestStep.type : 'none',
    latestStepText: latestStep && latestStep.text ? latestStep.text.slice(0, 300) : '',
    usage: latestStep && latestStep.usage ? latestStep.usage : null,
  };
}

function watchForCompletion(conversationId = null, onDone, pollIntervalMs = 2000, maxWaitMs = 600000) {
  console.log(`Starting trajectory watch on Android Studio Agent (poll every ${pollIntervalMs}ms)...`);
  const startTime = Date.now();
  let lastCheckedMtime = 0;

  const timer = setInterval(() => {
    const status = getSessionStatus(conversationId);
    if (!status.found) {
      console.log('Waiting for active session...');
      return;
    }

    const currentMtime = new Date(status.lastModified).getTime();

    if (status.isDone && currentMtime > startTime) {
      console.log(`\n✓ Detected Agent completion in session ${status.id} (${status.model})!`);
      if (status.usage) {
        console.log(`Token usage: ${status.usage.totalTokens} tokens (Input: ${status.usage.inputTokens}, Output: ${status.usage.outputTokens})`);
      }
      clearInterval(timer);
      if (onDone) onDone(status);
    } else {
      process.stdout.write(`.`);
    }

    if (Date.now() - startTime > maxWaitMs) {
      console.log('\nTimed out waiting for agent completion.');
      clearInterval(timer);
    }
  }, pollIntervalMs);

  return timer;
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'watch') {
    watchForCompletion(process.argv[3], (status) => {
      console.log('Completion callback executed successfully.');
    });
  } else {
    const status = getSessionStatus(process.argv[2]);
    console.log(JSON.stringify(status, null, 2));
  }
}

module.exports = { getConversations, getSessionStatus, watchForCompletion };
