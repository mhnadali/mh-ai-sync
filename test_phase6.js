const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  loadTaskState,
  setActiveTask,
  addTaskNote,
  clearActiveTask,
  generateTaskBanner
} = require('./src/task');
const {
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules
} = require('./src/generators');
const { checkStatus } = require('./src/status');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 6 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase6_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: Task State Lifecycle in isolation
console.log('🔹 Test 1: Task State Lifecycle & Persistence...');
// Stage 1.a: Initial state
const initialState = loadTaskState(SANDBOX_DIR);
assert.strictEqual(initialState.activeTask, null);
assert.strictEqual(initialState.status, 'idle');

// Stage 1.b: Set Active Task
const updatedState = setActiveTask('Refactoring authentication middleware', { note: 'Created token table' }, SANDBOX_DIR);
assert.strictEqual(updatedState.activeTask, 'Refactoring authentication middleware');
assert.strictEqual(updatedState.status, 'in_progress');
assert.strictEqual(updatedState.recentNotes.length, 1);
assert.strictEqual(updatedState.recentNotes[0], 'Created token table');

// Stage 1.c: Add Progress Note
const withNoteState = addTaskNote('Added blacklist validator', SANDBOX_DIR);
assert.strictEqual(withNoteState.recentNotes.length, 2);
assert.strictEqual(withNoteState.recentNotes[1], 'Added blacklist validator');

// Stage 1.d: Clear Task
const clearedState = clearActiveTask(SANDBOX_DIR);
assert.strictEqual(clearedState.activeTask, null);
assert.strictEqual(clearedState.status, 'idle');
assert.strictEqual(clearedState.recentNotes.length, 0);
console.log('   ✔ Passed: Task state persistence and lifecycle operations verified.');

// Test 2: Task Banner Generation & Markdown Injection
console.log('\n🔹 Test 2: Task Banner Generation & Generator Injection...');
const testState = {
  activeTask: 'Migrate database schema to v2',
  status: 'in_progress',
  updatedAt: new Date().toISOString(),
  updatedBy: 'developer',
  recentNotes: ['Executed table creation', 'Ran migration script']
};

const banner = generateTaskBanner(testState);
assert.ok(banner.includes('CURRENT ACTIVE TASK (Cross-Agent Shared State)'));
assert.ok(banner.includes('Migrate database schema to v2'));
assert.ok(banner.includes('Executed table creation'));

// Verify generator injection
const claudeMd = generateClaudeMd(DEFAULT_CANONICAL_SCHEMA, banner);
assert.ok(claudeMd.includes(banner.trim()), 'Claude MD must contain active task banner');

const agentsMd = generateAgentsMd(DEFAULT_CANONICAL_SCHEMA, banner);
assert.ok(agentsMd.includes(banner.trim()), 'AGENTS.md must contain active task banner');

const antigravityMd = generateAntigravityConfig(DEFAULT_CANONICAL_SCHEMA, banner);
assert.ok(antigravityMd.includes(banner.trim()), 'ANTIGRAVITY.md must contain active task banner');

const cursorRules = generateCursorRules(DEFAULT_CANONICAL_SCHEMA, banner);
assert.ok(cursorRules.includes(banner.trim()), '.cursorrules must contain active task banner');
console.log('   ✔ Passed: Task banner cleanly injected into Claude, Antigravity, and Cursor targets.');

// Test 3: CLI Execution of `task` Subcommands in Sandbox
console.log('\n🔹 Test 3: CLI `task` Subcommands & Auto-Sync in Sandbox...');
const cliPath = path.join(__dirname, 'bin', 'index.js');

// Seed canonical config in sandbox
fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(DEFAULT_CANONICAL_SCHEMA, null, 2), 'utf8');

// 3.a Run initial build
execSync(`node "${cliPath}" build`, { cwd: SANDBOX_DIR, stdio: 'pipe' });

// 3.b Set task via CLI
const setOutput = execSync(`node "${cliPath}" task set "Implement OAuth2 login flow" "Initial commit done"`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(setOutput.includes('Active task set'));

// Verify task persisted in file system
const diskClaude = fs.readFileSync(path.join(SANDBOX_DIR, 'CLAUDE.md'), 'utf8');
assert.ok(diskClaude.includes('Implement OAuth2 login flow'), 'CLAUDE.md on disk must contain the task');

// Verify status check is in sync with active task
const statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, SANDBOX_DIR);
assert.strictEqual(statusReport.isClean, true, 'Status check must pass with active task banner synchronized');

// 3.c Add note via CLI
const noteOutput = execSync(`node "${cliPath}" task note "Configured redirect callback URI"`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(noteOutput.includes('Added note to active task'));

// 3.d Query task via CLI
const statusOutput = execSync(`node "${cliPath}" task`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(statusOutput.includes('Implement OAuth2 login flow'));
assert.ok(statusOutput.includes('Configured redirect callback URI'));

// 3.e Clear task via CLI
const clearOutput = execSync(`node "${cliPath}" task clear`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(clearOutput.includes('Active task cleared'));

const clearedClaude = fs.readFileSync(path.join(SANDBOX_DIR, 'CLAUDE.md'), 'utf8');
assert.ok(!clearedClaude.includes('CURRENT ACTIVE TASK'), 'Cleared CLAUDE.md must no longer have banner');
console.log('   ✔ Passed: CLI `task set`, `task note`, `task`, and `task clear` end-to-end verified.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 6 Tests Passed with 100% Success!\n');
