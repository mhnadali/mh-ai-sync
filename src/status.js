/**
 * M.H. AI Sync - Status & Drift Detection Engine
 * Inspects all AI agent files on disk (both single-file and modular directories)
 * and compares them against the canonical specification.
 */

const fs = require('fs');
const path = require('path');
const {
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateCursorMdcRules,
  generateSkillFiles,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig,
  generateClineRules,
  generateRooModes,
  generateAiderConventions,
  generateAiderConfig,
  generateContinueRules,
  generateZedInstructions
} = require('./generators');

const { loadTaskState, generateTaskBanner } = require('./task');

function normalizeContent(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\r\n/g, '\n').trim();
}

function checkStatus(config, rootDir = process.cwd()) {
  const taskState = loadTaskState(rootDir);
  const taskBanner = generateTaskBanner(taskState);

  const fileTargets = [
    { name: 'CLAUDE.md', expected: normalizeContent(generateClaudeMd(config, taskBanner)) },
    { name: 'AGENTS.md', expected: normalizeContent(generateAgentsMd(config, taskBanner)) },
    { name: 'ANTIGRAVITY.md', expected: normalizeContent(generateAntigravityConfig(config, taskBanner)) },
    { name: '.cursorrules', expected: normalizeContent(generateCursorRules(config, taskBanner)) },
    { name: '.windsurfrules', expected: normalizeContent(generateWindsurfRules(config)) },
    { name: path.join('.github', 'copilot-instructions.md'), expected: normalizeContent(generateCopilotInstructions(config)) },
    { name: '.mcp.json', expected: normalizeContent(generateMcpConfig(config)) },
    { name: '.clinerules', expected: normalizeContent(generateClineRules(config, taskBanner)) },
    { name: '.roomodes', expected: normalizeContent(generateRooModes(config, taskBanner)) },
    { name: 'CONVENTIONS.md', expected: normalizeContent(generateAiderConventions(config, taskBanner)) },
    { name: '.aider.conf.yml', expected: normalizeContent(generateAiderConfig(config)) },
    { name: path.join('.continue', 'rules', 'project-rules.md'), expected: normalizeContent(generateContinueRules(config, taskBanner)) },
    { name: path.join('.zed', 'instructions.md'), expected: normalizeContent(generateZedInstructions(config, taskBanner)) }
  ];

  // Add Modular Cursor MDC Rules
  const mdcRules = generateCursorMdcRules(config);
  for (const [filename, content] of Object.entries(mdcRules)) {
    fileTargets.push({
      name: path.join('.cursor', 'rules', filename),
      expected: normalizeContent(content)
    });
  }

  // Add Antigravity & Hermes Skills
  const skillFiles = generateSkillFiles(config);
  for (const [relPath, content] of Object.entries(skillFiles)) {
    fileTargets.push({
      name: relPath,
      expected: normalizeContent(content)
    });
  }

  const results = [];
  let hasDrift = false;
  let hasMissing = false;

  for (const target of fileTargets) {
    const fullPath = path.join(rootDir, target.name);

    if (!fs.existsSync(fullPath)) {
      results.push({
        file: target.name,
        status: 'MISSING',
        diffLines: target.expected.split('\n').length
      });
      hasMissing = true;
      continue;
    }

    let actual;
    try {
      actual = normalizeContent(fs.readFileSync(fullPath, 'utf8'));
    } catch (readErr) {
      results.push({
        file: target.name,
        status: 'UNREADABLE',
        diffHint: readErr.message
      });
      hasDrift = true;
      continue;
    }

    if (actual === target.expected) {
      results.push({
        file: target.name,
        status: 'IN_SYNC'
      });
    } else {
      hasDrift = true;
      const actualLines = actual.split('\n');
      const expectedLines = target.expected.split('\n');
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
    lines.push('\x1b[32m✨ All AI agent contexts (single & modular) are fully synchronized.\x1b[0m');
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
