/**
 * M.H. AI Sync - 3-Way Merge & Interactive Rule Conflict Resolver Engine
 * Computes unified diffs between disk files and canonical state, and intelligently
 * merges rogue/manual edits from AI agents back into mhai.config.json.
 */

const fs = require('fs');
const path = require('path');
const { parseClaudeMd, parseAgentsMd, parseCursorRules } = require('./parsers');
const {
  sanitize,
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateCursorMdcRules,
  generateSkillFiles,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig
} = require('./generators');
const { loadTaskState, generateTaskBanner } = require('./task');
const { normalizeContent, checkStatus } = require('./status');

/**
 * Computes an LCS-based line-by-line diff between two strings.
 * Returns an array of { type: 'add' | 'del' | 'same', line: string }
 */
function computeLineDiff(textExpected, textActual) {
  const linesExp = normalizeContent(textExpected).split('\n');
  const linesAct = normalizeContent(textActual).split('\n');

  const m = linesExp.length;
  const n = linesAct.length;

  // Build DP table for LCS
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesExp[i] === linesAct[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to construct diff
  const diff = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesExp[i - 1] === linesAct[j - 1]) {
      diff.unshift({ type: 'same', line: linesExp[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', line: linesAct[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'del', line: linesExp[i - 1] });
      i--;
    }
  }

  return diff;
}

/**
 * Formats line diff into a human-readable, colored unified diff snippet.
 */
function formatUnifiedDiff(filename, lineDiff) {
  const lines = [];
  lines.push(`\x1b[1m\x1b[36m--- ${filename} (Expected Canonical)\x1b[0m`);
  lines.push(`\x1b[1m\x1b[36m+++ ${filename} (Actual on Disk)\x1b[0m`);

  let hasChanges = false;
  for (const entry of lineDiff) {
    if (entry.type === 'add') {
      hasChanges = true;
      lines.push(`\x1b[32m+ ${entry.line}\x1b[0m`);
    } else if (entry.type === 'del') {
      hasChanges = true;
      lines.push(`\x1b[31m- ${entry.line}\x1b[0m`);
    } else {
      lines.push(`\x1b[90m  ${entry.line}\x1b[0m`);
    }
  }

  return { formatted: lines.join('\n'), hasChanges };
}

/**
 * Retrieves expected vs actual content pairs for all targets.
 */
function getExpectedFileTargets(config, rootDir = process.cwd()) {
  const taskState = loadTaskState(rootDir);
  const taskBanner = generateTaskBanner(taskState);

  const targets = [
    { name: 'CLAUDE.md', parser: parseClaudeMd, expected: normalizeContent(generateClaudeMd(config, taskBanner)) },
    { name: 'AGENTS.md', parser: parseAgentsMd, expected: normalizeContent(generateAgentsMd(config, taskBanner)) },
    { name: 'ANTIGRAVITY.md', parser: parseAgentsMd, expected: normalizeContent(generateAntigravityConfig(config, taskBanner)) },
    { name: '.cursorrules', parser: parseCursorRules, expected: normalizeContent(generateCursorRules(config, taskBanner)) },
    { name: '.windsurfrules', parser: parseAgentsMd, expected: normalizeContent(generateWindsurfRules(config)) },
    { name: path.join('.github', 'copilot-instructions.md'), parser: parseAgentsMd, expected: normalizeContent(generateCopilotInstructions(config)) }
  ];

  return targets;
}

/**
 * Inspects all files in rootDir and returns diff reports for any drifted files.
 */
function inspectDiffs(rawConfig, rootDir = process.cwd(), filterFile = null) {
  const config = sanitize(rawConfig);
  const targets = getExpectedFileTargets(config, rootDir);
  const diffReports = [];

  for (const target of targets) {
    if (filterFile && !target.name.toLowerCase().includes(filterFile.toLowerCase())) {
      continue;
    }

    const fullPath = path.join(rootDir, target.name);
    if (!fs.existsSync(fullPath)) continue;

    const actual = normalizeContent(fs.readFileSync(fullPath, 'utf8'));
    if (actual !== target.expected) {
      const lineDiff = computeLineDiff(target.expected, actual);
      const { formatted, hasChanges } = formatUnifiedDiff(target.name, lineDiff);
      if (hasChanges) {
        diffReports.push({
          file: target.name,
          diff: formatted,
          lineDiff
        });
      }
    }
  }

  return diffReports;
}

/**
 * Intelligently merges rules, commands, and options from an actual file into canonicalConfig.
 */
function mergeFileIntoConfig(targetFileName, actualContent, rawConfig) {
  const config = JSON.parse(JSON.stringify(sanitize(rawConfig)));
  const changes = [];

  let parsed;
  const lowerName = targetFileName.toLowerCase();
  if (lowerName.includes('cursor')) {
    parsed = parseCursorRules(actualContent);
  } else if (lowerName.includes('claude')) {
    parsed = parseClaudeMd(actualContent);
  } else {
    parsed = parseAgentsMd(actualContent);
  }

  // 1. Merge Commands
  if (parsed.commands && typeof parsed.commands === 'object') {
    if (!config.commands) config.commands = {};
    for (const [cmdKey, cmdVal] of Object.entries(parsed.commands)) {
      if (typeof cmdVal === 'string' && cmdVal.trim()) {
        const existing = config.commands[cmdKey];
        if (existing !== cmdVal.trim()) {
          config.commands[cmdKey] = cmdVal.trim();
          changes.push({
            type: 'command',
            key: cmdKey,
            oldVal: existing || null,
            newVal: cmdVal.trim()
          });
        }
      }
    }
  }

  // Helper to check rule existence
  function hasRule(ruleList, text) {
    const clean = text.toLowerCase().trim();
    return ruleList.some(r => r.toLowerCase().trim() === clean);
  }

  // 2. Merge Guidelines (codeStyle, gitPractices, agentRules)
  const categories = ['agentRules', 'codeStyle', 'gitPractices'];
  for (const cat of categories) {
    const incomingRules = (parsed.guidelines && parsed.guidelines[cat]) || [];
    for (const rule of incomingRules) {
      if (typeof rule === 'string' && rule.trim()) {
        const trimmedRule = rule.trim();
        // Check across all guidelines categories so we don't duplicate
        const alreadyExists = categories.some(c => hasRule(config.guidelines[c], trimmedRule));
        if (!alreadyExists) {
          config.guidelines[cat].push(trimmedRule);
          changes.push({
            type: 'rule',
            category: cat,
            rule: trimmedRule
          });
        }
      }
    }
  }

  return { config, changes };
}

/**
 * Automatically merges all drifted files in rootDir back into canonical mhai.config.json.
 */
function mergeAllDriftedFiles(rawConfig, rootDir = process.cwd(), filterFile = null) {
  let currentConfig = sanitize(rawConfig);
  const targets = getExpectedFileTargets(currentConfig, rootDir);
  const allChanges = [];

  for (const target of targets) {
    if (filterFile && !target.name.toLowerCase().includes(filterFile.toLowerCase())) {
      continue;
    }

    const fullPath = path.join(rootDir, target.name);
    if (!fs.existsSync(fullPath)) continue;

    const actual = normalizeContent(fs.readFileSync(fullPath, 'utf8'));
    if (actual !== target.expected) {
      const { config: updated, changes } = mergeFileIntoConfig(target.name, actual, currentConfig);
      if (changes.length > 0) {
        currentConfig = updated;
        allChanges.push({
          file: target.name,
          changes
        });
      }
    }
  }

  // Persist updated config
  if (allChanges.length > 0) {
    const configPath = path.join(rootDir, 'mhai.config.json');
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
  }

  return {
    config: currentConfig,
    hasMerged: allChanges.length > 0,
    mergedFiles: allChanges
  };
}

module.exports = {
  computeLineDiff,
  formatUnifiedDiff,
  inspectDiffs,
  mergeFileIntoConfig,
  mergeAllDriftedFiles
};
