const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateCursorMdcRules, generateSkillFiles, sanitize } = require('./src/generators');
const { checkStatus } = require('./src/status');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 2 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase2_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: Cursor MDC Generator
console.log('🔹 Test 1: Cursor 2.0 MDC Rules Generation...');
const mdcRules = generateCursorMdcRules(DEFAULT_CANONICAL_SCHEMA);
assert.ok(mdcRules['project-rules.mdc'], 'project-rules.mdc must be generated');
assert.ok(mdcRules['code-standards.mdc'], 'code-standards.mdc must be generated');
assert.ok(mdcRules['testing-policy.mdc'], 'testing-policy.mdc must be generated');

// Validate YAML frontmatter in MDC
const codeStandardsContent = mdcRules['code-standards.mdc'];
assert.ok(codeStandardsContent.includes('---'), 'MDC file must have YAML frontmatter delimiter');
assert.ok(codeStandardsContent.includes('globs: *'), 'MDC file must have globs');
assert.ok(codeStandardsContent.includes('alwaysApply: true'), 'MDC file must have alwaysApply');
console.log('   ✔ Passed: Cursor MDC generator produces valid YAML frontmatter and scoped rules.');

// Test 2: Skill Files Generator (Antigravity & Hermes)
console.log('\n🔹 Test 2: Antigravity & Hermes Modular Skills Generator...');
const skillFiles = generateSkillFiles(DEFAULT_CANONICAL_SCHEMA);
assert.ok(skillFiles['skills/git-workflow/SKILL.md'], 'git-workflow/SKILL.md must be generated');
assert.ok(skillFiles['skills/test-runner/SKILL.md'], 'test-runner/SKILL.md must be generated');

const gitSkillContent = skillFiles['skills/git-workflow/SKILL.md'];
assert.ok(gitSkillContent.includes('name: git-workflow'), 'SKILL.md must define name in frontmatter');
assert.ok(gitSkillContent.includes('## Instructions'), 'SKILL.md must define instructions');
console.log('   ✔ Passed: Modular skills generator produces valid SKILL.md files.');

// Test 3: CLI Build in Sandbox with Modular Targets
console.log('\n🔹 Test 3: CLI Multi-Directory Synchronization...');
const cliPath = path.join(__dirname, 'bin', 'index.js');
execSync(`node "${cliPath}" build`, { cwd: SANDBOX_DIR, stdio: 'pipe' });

// Check single files
assert.ok(fs.existsSync(path.join(SANDBOX_DIR, 'CLAUDE.md')), 'CLAUDE.md must exist');
assert.ok(fs.existsSync(path.join(SANDBOX_DIR, 'AGENTS.md')), 'AGENTS.md must exist');
assert.ok(fs.existsSync(path.join(SANDBOX_DIR, 'ANTIGRAVITY.md')), 'ANTIGRAVITY.md must exist');

// Check modular Cursor rules directory
const cursorRulesDir = path.join(SANDBOX_DIR, '.cursor', 'rules');
assert.ok(fs.existsSync(path.join(cursorRulesDir, 'project-rules.mdc')), '.cursor/rules/project-rules.mdc must exist');
assert.ok(fs.existsSync(path.join(cursorRulesDir, 'code-standards.mdc')), '.cursor/rules/code-standards.mdc must exist');
assert.ok(fs.existsSync(path.join(cursorRulesDir, 'testing-policy.mdc')), '.cursor/rules/testing-policy.mdc must exist');

// Check modular Skills directory
const skillsDir = path.join(SANDBOX_DIR, 'skills');
assert.ok(fs.existsSync(path.join(skillsDir, 'git-workflow', 'SKILL.md')), 'skills/git-workflow/SKILL.md must exist');
assert.ok(fs.existsSync(path.join(skillsDir, 'test-runner', 'SKILL.md')), 'skills/test-runner/SKILL.md must exist');
console.log('   ✔ Passed: All modular files and directories successfully created by CLI build.');

// Test 4: Modular Drift & Status Detection
console.log('\n🔹 Test 4: Modular Status and Drift Verification...');
let statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, SANDBOX_DIR);
assert.strictEqual(statusReport.isClean, true, 'Status should be clean right after build');

// Modify a modular rule manually to trigger drift
fs.appendFileSync(path.join(cursorRulesDir, 'testing-policy.mdc'), '\n# Rogue Drift Rule\n', 'utf8');
statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, SANDBOX_DIR);
assert.strictEqual(statusReport.hasDrift, true, 'Drift must be detected in modular file');
const driftedMdc = statusReport.results.find(r => r.file.includes('testing-policy.mdc'));
assert.ok(driftedMdc, 'Drifted MDC file must be found in results');
assert.strictEqual(driftedMdc.status, 'DRIFTED');
console.log('   ✔ Passed: Drift in modular files (.cursor/rules/*.mdc) detected accurately.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 2 Tests Passed with 100% Success!\n');
