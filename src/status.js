/**
 * M.H. AI Sync - Status & Drift Detection Engine
 * Inspects all AI agent files on disk and compares them against the canonical specification.
 */

const fs = require('fs');
const path = require('path');
const {
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig
} = require('./generators');

function normalizeContent(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\r\n/g, '\n').trim();
}

function checkStatus(config, rootDir = process.cwd()) {
  const targets = [
    { name: 'CLAUDE.md', generator: generateClaudeMd },
    { name: 'AGENTS.md', generator: generateAgentsMd },
    { name: 'ANTIGRAVITY.md', generator: generateAntigravityConfig },
    { name: '.cursorrules', generator: generateCursorRules },
    { name: '.windsurfrules', generator: generateWindsurfRules },
    { name: path.join('.github', 'copilot-instructions.md'), generator: generateCopilotInstructions },
    { name: '.mcp.json', generator: generateMcpConfig }
  ];

  const results = [];
  let hasDrift = false;
  let hasMissing = false;

  for (const target of targets) {
    const fullPath = path.join(rootDir, target.name);
    const expected = normalizeContent(target.generator(config));

    if (!fs.existsSync(fullPath)) {
      results.push({
        file: target.name,
        status: 'MISSING',
        diffLines: expected.split('\n').length
      });
      hasMissing = true;
      continue;
    }

    const actual = normalizeContent(fs.readFileSync(fullPath, 'utf8'));

    if (actual === expected) {
      results.push({
        file: target.name,
        status: 'IN_SYNC'
      });
    } else {
      hasDrift = true;
      // Calculate a brief diff summary
      const actualLines = actual.split('\n');
      const expectedLines = expected.split('\n');
      const diffCount = Math.abs(actualLines.length - expectedLines.length);

      results.push({
        file: target.name,
        status: 'DRIFTED',
        actualLines: actualLines.length,
        expectedLines: expectedLines.length,
        diffHint: `Length mismatch or modified directives (${diffCount} line delta)`
      });
    }
  }

  return {
    results,
    hasDrift,
    hasMissing,
    isClean: !hasDrift && !hasMissing
  };
}

function formatStatusReport(statusReport) {
  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Status Report ===\x1b[0m\n');

  for (const item of statusReport.results) {
    let icon = '✔';
    let color = '\x1b[32m'; // green
    if (item.status === 'DRIFTED') {
      icon = '⚡';
      color = '\x1b[33m'; // yellow
    } else if (item.status === 'MISSING') {
      icon = '✖';
      color = '\x1b[31m'; // red
    }

    const statusBadge = `${color}${item.status.padEnd(10)}\x1b[0m`;
    const details = item.diffHint ? ` (${item.diffHint})` : '';
    lines.push(`  ${icon} ${statusBadge} ${item.file}${details}`);
  }

  lines.push('\n----------------------------------------');
  if (statusReport.isClean) {
    lines.push('\x1b[32m✨ All AI agent contexts are fully synchronized with source of truth.\x1b[0m');
  } else {
    lines.push('\x1b[33m⚠️ Synchronization drift detected! Run `node bin/index.js build` to re-align.\x1b[0m');
  }

  return lines.join('\n');
}

module.exports = {
  checkStatus,
  formatStatusReport,
  normalizeContent
};
