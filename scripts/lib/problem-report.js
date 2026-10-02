'use strict';

const fs = require('fs');

function captureLogTail(text, n = 15) {
  const lineLimit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (lineLimit === 0 || text == null || String(text).trim() === '') return '';
  return String(text).trim().split(/\r?\n/).filter(Boolean).slice(-lineLimit).join('\n');
}

function getLogTail(file, recentLines = [], maxLines = 15) {
  const fromMemory = captureLogTail(recentLines.join('\n'), maxLines);
  if (fromMemory) return `Log file: ${file}\nRecent log output:\n${fromMemory}`;
  try {
    if (fs.existsSync(file)) {
      const fromFile = captureLogTail(fs.readFileSync(file, 'utf8'), maxLines);
      return `Log file: ${file}\nRecent log output:\n${fromFile}`;
    }
  } catch (_) {
    // Log files are best-effort context only.
  }
  return `Log file: ${file}`;
}

function createProblemReport() {
  const entries = [];

  function add(code, message, options = {}) {
    const problem = {
      code: String(code),
      message: String(message),
      severity: ['error', 'warning', 'info'].includes(options.severity) ? options.severity : 'error',
    };
    for (const key of ['detail', 'logTail', 'stack']) {
      if (options[key] != null && options[key] !== '') problem[key] = String(options[key]);
    }
    entries.push(problem);
    return problem;
  }

  return {
    add,
    problems: entries,
    hasErrors() {
      return entries.some((problem) => problem.severity === 'error');
    },
    render(renderer = consoleRenderer, options = {}) {
      return renderProblems(entries, { ...options, renderer });
    },
    exitCode() {
      return entries.some((problem) => problem.severity === 'error') ? 1 : 0;
    },
  };
}

function renderProblems(problems, { renderer = consoleRenderer, ...options } = {}) {
  if (typeof renderer !== 'function') throw new TypeError('A problem renderer function is required.');
  return renderer(problems, options);
}

function consoleRenderer(problems, options = {}) {
  const { style = 'structured', header = '' } = options;
  let output;

  if (style === 'plain') {
    output = problems
      .map((problem) => [problem.message, problem.detail, problem.logTail].filter(Boolean).join('\n\n'))
      .join('\n');
  } else if (style === 'list') {
    const items = problems.map((problem) => `  - ${problem.message}`).join('\n');
    output = [header, items].filter(Boolean).join('\n');
  } else {
    const blocks = problems.map((problem) => {
      const marker = problem.severity === 'warning' ? '⚠' : problem.severity === 'info' ? '✓' : '✗';
      const lines = [`${marker} ${problem.code}: ${problem.message}`];
      for (const key of ['detail', 'logTail']) {
        if (problem[key]) lines.push(...problem[key].split(/\r?\n/).map((line) => `  ${line}`));
      }
      return lines.join('\n');
    });
    output = [header, blocks.join('\n\n')].filter(Boolean).join('\n');
  }

  if (output) process.stderr.write(`${output}\n`);
  return output;
}

module.exports = { createProblemReport, renderProblems, consoleRenderer, captureLogTail, getLogTail };
