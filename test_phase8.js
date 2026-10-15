const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  computeLineDiff,
  formatUnifiedDiff,
  inspectDiffs,
  mergeFileIntoConfig,
  mergeAllDriftedFiles
} = require('./src/merger');
const { checkStatus } = require('./src/status');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 8 Comprehensive Test Suite (3-Way Merge & Diff Engine)...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase8_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: LCS-Based Unified Line Diff Engine
console.log('🔹 Test 1: LCS-Based Unified Line Diff Engine...');

// 1.a Identical text
const identicalDiff = computeLineDiff("line 1\nline 2", "line 1\nline 2");
const formattedIdentical = formatUnifiedDiff('file.txt', identicalDiff);
assert.strictEqual(formattedIdentical.hasChanges, false);
assert.strictEqual(identicalDiff.every(d => d.type === 'same'), true);

// 1.b Additions and Deletions
const oldText = "first line\nsecond line\nthird line";
const newText = "first line\nmodified second line\nthird line\nfourth line";
const lineDiff = computeLineDiff(oldText, newText);
const formatted = formatUnifiedDiff('file.txt', lineDiff);

assert.strictEqual(formatted.hasChanges, true);
assert.ok(lineDiff.some(d => d.type === 'del' && d.line === 'second line'));
assert.ok(lineDiff.some(d => d.type === 'add' && d.line === 'modified second line'));
assert.ok(lineDiff.some(d => d.type === 'add' && d.line === 'fourth line'));
assert.ok(formatted.formatted.includes('+ modified second line'));
assert.ok(formatted.formatted.includes('- second line'));
console.log('   ✔ Passed: Line-by-line unified diff calculation & formatting verified.');

// Test 2: In-Memory Smart Merge
console.log('\n🔹 Test 2: In-Memory Smart 3-Way Merge...');
const baseConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));

const modifiedClaude = `# Claude Code Configuration
## Commands
- \`build\`: \`npm run build:prod\`
- \`test\`: \`jest --coverage\`

## Guidelines
- Follow Clean Code and DRY principles.
- Use structured logging with correlation IDs.
- Ensure all database queries are parameter-bound.
`;

const mergeResult = mergeFileIntoConfig('CLAUDE.md', modifiedClaude, baseConfig);
assert.ok(mergeResult.changes.length >= 2, 'Merge must detect commands and new rules');

// Verify updated commands
assert.strictEqual(mergeResult.config.commands.build, 'npm run build:prod');
assert.strictEqual(mergeResult.config.commands.test, 'jest --coverage');

// Verify absorbed guidelines
assert.ok(mergeResult.config.guidelines.agentRules.includes('Use structured logging with correlation IDs.'));
assert.ok(mergeResult.config.guidelines.agentRules.includes('Ensure all database queries are parameter-bound.'));

// Verify no duplicate for existing rule
const existingCount = mergeResult.config.guidelines.codeStyle.filter(r => r === 'Follow Clean Code and DRY principles.').length;
assert.strictEqual(existingCount, 1, 'Existing rules must not be duplicated');
console.log('   ✔ Passed: Smart merge safely absorbs rules, updates commands, and prevents duplicates.');

// Test 3: CLI End-to-End Workflow in Sandbox
console.log('\n🔹 Test 3: CLI `diff`, `merge`, and `sync --merge` in Sandbox...');
const cliPath = path.join(__dirname, 'bin', 'index.js');

// Seed canonical config in sandbox
fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(DEFAULT_CANONICAL_SCHEMA, null, 2), 'utf8');

// 3.a Initial build
execSync(`node "${cliPath}" build`, { cwd: SANDBOX_DIR, stdio: 'pipe' });

// Verify initially clean diff
const initialDiff = execSync(`node "${cliPath}" diff`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(initialDiff.includes('No drift detected'));

// 3.b Inject rogue manual rule into CLAUDE.md
const claudePath = path.join(SANDBOX_DIR, 'CLAUDE.md');
fs.appendFileSync(claudePath, '\n- Critical Policy: Never commit .env files\n', 'utf8');

// 3.c Run CLI diff and verify report
const reportedDiff = execSync(`node "${cliPath}" diff`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(reportedDiff.includes('CLAUDE.md'));
assert.ok(reportedDiff.includes('+ - Critical Policy: Never commit .env files'));

// 3.d Run CLI merge
const mergeCliOutput = execSync(`node "${cliPath}" merge`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(mergeCliOutput.includes('Absorbed new rule'));
assert.ok(mergeCliOutput.includes('Never commit .env files'));

// 3.e Verify mhai.config.json received the rule
const updatedConfigOnDisk = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), 'utf8'));
assert.ok(updatedConfigOnDisk.guidelines.agentRules.includes('Critical Policy: Never commit .env files'));

// 3.f Verify other agent targets (like ANTIGRAVITY.md and .cursorrules) received the new rule
const antigravityContent = fs.readFileSync(path.join(SANDBOX_DIR, 'ANTIGRAVITY.md'), 'utf8');
assert.ok(antigravityContent.includes('Critical Policy: Never commit .env files'), 'ANTIGRAVITY.md must have synced the merged rule');

const cursorContent = fs.readFileSync(path.join(SANDBOX_DIR, '.cursorrules'), 'utf8');
assert.ok(cursorContent.includes('Critical Policy: Never commit .env files'), '.cursorrules must have synced the merged rule');

// 3.g Verify status is now 100% in sync
const finalStatus = checkStatus(updatedConfigOnDisk, SANDBOX_DIR);
assert.strictEqual(finalStatus.isClean, true, 'Status check must be clean after merge');
console.log('   ✔ Passed: CLI `diff` reports drift, `merge` absorbs updates across all agents, and restores sync.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 8 Tests Passed with 100% Success!\n');
