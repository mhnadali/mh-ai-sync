const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { detectStack } = require('./src/detectors');
const { parseAgentsMd, parseCursorRules } = require('./src/parsers');
const { auditConfig } = require('./src/security');
const { analyzePromptBudget } = require('./src/analyzer');
const { syncAllWorkspaces, checkWorkspacesStatus } = require('./src/monorepo');
const { setActiveTask, clearActiveTask } = require('./src/task');
const { sanitize, generateSkillFiles } = require('./src/generators');

console.log('\x1b[1m\x1b[36m=== Testing Deep Debugged v2.0.0 Architecture & Edge Cases ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_deep_debug_v2');

function setupTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

function cleanupTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

try {
  setupTestDir();

  // Test 1: Python dev runner without double 'python python'
  console.log('Test 1: Python command detection cleanly formats runner without duplication');
  const pyDir = path.join(testDir, 'py_test');
  fs.mkdirSync(pyDir, { recursive: true });
  fs.writeFileSync(path.join(pyDir, 'requirements.txt'), 'flask\n');
  const pyDetected = detectStack(pyDir);
  assert.strictEqual(pyDetected.commands.dev, 'python main.py', 'Should not produce "python python main.py"');
  console.log('✔ Test 1 Passed: Python dev command correctly formatted as "python main.py".');

  // Test 2: Title header parsing without '> Project:'
  console.log('\nTest 2: Markdown header # Title parsing without explicit > Project: line');
  const customDoc = `# Falcon Engine
Some overview text here.

## Commands
- test: pytest
`;
  const parsedDoc = parseAgentsMd(customDoc);
  assert.strictEqual(parsedDoc.name, 'Falcon Engine', 'Should extract project name from top-level H1 header');
  console.log('✔ Test 2 Passed: H1 title correctly parsed as project name.');

  // Test 3: Cursor MDC frontmatter stripping in parseCursorRules
  console.log('\nTest 3: MDC frontmatter stripping in parseCursorRules');
  const mdcContent = `---
description: Universal project conventions and coding standards
globs: *
alwaysApply: true
---

# Project Conventions
- Follow standard clean code conventions.
- Never push broken tests.
`;
  const parsedMdc = parseCursorRules(mdcContent);
  assert.strictEqual(parsedMdc.guidelines.agentRules.length, 2);
  assert.ok(!parsedMdc.guidelines.agentRules.some(r => r.includes('description:') || r.includes('globs:')));
  console.log('✔ Test 3 Passed: YAML frontmatter successfully stripped, preventing rule leakage.');

  // Test 4: .mcp.json secret auditing
  console.log('\nTest 4: .mcp.json secret credentials scanning');
  const mcpDir = path.join(testDir, 'mcp_leak_test');
  fs.mkdirSync(mcpDir, { recursive: true });
  fs.writeFileSync(path.join(mcpDir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      github: {
        env: { GITHUB_TOKEN: ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_') }
      }
    }
  }, null, 2));

  const auditRes = auditConfig({}, mcpDir);
  assert.strictEqual(auditRes.isSecure, false, 'Should flag leaked secret in .mcp.json');
  assert.ok(auditRes.findings.some(f => f.file === '.mcp.json'), 'Finding must reference .mcp.json');
  assert.strictEqual(typeof auditRes.totalIssues, 'number');
  console.log('✔ Test 4 Passed: Secret credentials in .mcp.json successfully caught by auditor.');

  // Test 5: analyzePromptBudget rating calculation
  console.log('\nTest 5: analyzePromptBudget rating consistency');
  const analysis = analyzePromptBudget({
    project: { name: 'Test', overview: 'test', techStack: [] },
    guidelines: { codeStyle: [], gitPractices: [], agentRules: [] },
    commands: {}
  });
  assert.ok(['OPTIMAL', 'GOOD (NEEDS TUNING)', 'CRITICAL BLOAT'].includes(analysis.rating));
  console.log('✔ Test 5 Passed: Prompt rating property cleanly provided.');

  // Test 6: syncAllWorkspaces effective banner propagation
  console.log('\nTest 6: syncAllWorkspaces effectiveBanner propagation when task is active');
  const monoDir = path.join(testDir, 'monorepo_banner_test');
  fs.mkdirSync(path.join(monoDir, 'packages', 'core'), { recursive: true });
  fs.writeFileSync(path.join(monoDir, 'packages', 'core', 'package.json'), '{}');
  setActiveTask('Refactor Core Engine', { note: 'Sprint v2' }, monoDir);

  const syncRes = syncAllWorkspaces({ project: { name: 'Root' } }, monoDir); // Note: taskBanner omitted!
  assert.strictEqual(syncRes.workspacesCount, 1);

  const subClaude = fs.readFileSync(path.join(monoDir, 'packages', 'core', 'CLAUDE.md'), 'utf8');
  assert.ok(subClaude.includes('Refactor Core Engine'), 'Subpackage CLAUDE.md must inherit effective banner');

  const wsStatus = checkWorkspacesStatus({ project: { name: 'Root' } }, monoDir);
  assert.strictEqual(wsStatus.isAllClean, true, 'Workspace must be in sync with inherited task banner');
  clearActiveTask(monoDir);
  console.log('✔ Test 6 Passed: Effective task banner seamlessly propagated across monorepo workspaces.');

  // Test 7: Skill and modular rule filesystem character sanitization
  console.log('\nTest 7: Skill and modular rule names sanitized against forbidden characters');
  const dirtyConfig = sanitize({
    skills: [
      { name: 'test:illegal/name', description: 'desc', instructions: 'inst' }
    ],
    modularRules: [
      { name: 'rule?illegal*name', description: 'desc', globs: '*', rules: [] }
    ]
  });
  assert.strictEqual(dirtyConfig.skills[0].name, 'test-illegal-name');
  assert.strictEqual(dirtyConfig.modularRules[0].name, 'rule-illegal-name');

  const generatedSkills = generateSkillFiles(dirtyConfig);
  assert.ok(generatedSkills['skills/test-illegal-name/SKILL.md']);
  console.log('✔ Test 7 Passed: Invalid filename characters cleanly replaced with hyphens.');

  // Test 8: Git worktree / submodule hooks directory resolution
  console.log('\nTest 8: Git worktree / submodule hooks directory resolution');
  const { getGitHooksDir } = require('./src/hooks');
  const worktreeRepo = path.join(testDir, 'worktree_repo');
  const realGitDir = path.join(testDir, 'real_git_dir');
  fs.mkdirSync(worktreeRepo, { recursive: true });
  fs.mkdirSync(path.join(realGitDir, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRepo, '.git'), `gitdir: ${realGitDir}\n`);

  const resolvedHooks = getGitHooksDir(worktreeRepo);
  assert.strictEqual(path.resolve(resolvedHooks), path.resolve(path.join(realGitDir, 'hooks')), 'Should resolve hooks path from gitdir file');
  console.log('✔ Test 8 Passed: Git worktree / submodule hooks directory resolved accurately.');

  // Test 9: Expanded secret patterns in auditConfig
  console.log('\nTest 9: Expanded high-risk secret patterns (Google AI, Stripe, NPM, HuggingFace)');
  const secretDir = path.join(testDir, 'secret_test');
  fs.mkdirSync(secretDir, { recursive: true });
  fs.writeFileSync(path.join(secretDir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      ai: { env: { KEY: ['AIza', 'SyD_fake_key_1234567890abcdefghijkl'].join('') } },
      stripe: { env: { KEY: ['sk', 'live', '1234567890abcdefghijklmnopqrstuv'].join('_') } },
      npm: { env: { TOKEN: ['npm', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_') } },
      hf: { env: { TOKEN: ['hf', 'abcdefghijklmnopqrstuvwxyz01234567'].join('_') } }
    }
  }, null, 2));
  const secretAudit = auditConfig({}, secretDir);
  assert.strictEqual(secretAudit.isSecure, false);
  assert.ok(secretAudit.totalIssues >= 4, 'Must detect all 4 leaked secrets');
  console.log('✔ Test 9 Passed: Google Cloud, Stripe, NPM, and HuggingFace API tokens correctly flagged.');

  // Test 10: Subsection flexible markdown header parsing
  console.log('\nTest 10: Subsection flexible markdown header parsing in parseAgentsMd');
  const flexibleMd = `# Test Project
## Development Rules
### **Code Style**
- Use ESLint and Prettier.
### Coding Standards
- Write modular functions.
### Critical Rules
- Never delete prod databases.
`;
  const parsedFlexible = parseAgentsMd(flexibleMd);
  assert.ok(parsedFlexible.guidelines.codeStyle.length >= 2, 'Should match Code Style and Coding Standards');
  assert.ok(parsedFlexible.guidelines.agentRules.length >= 1, 'Should match Critical Rules');
  console.log('✔ Test 10 Passed: Flexible subsection headings (bold, standards, critical rules) parsed successfully.');

  // Test 11: hasRule punctuation & markdown deduplication in mergeFileIntoConfig
  console.log('\nTest 11: hasRule punctuation and markdown deduplication in mergeFileIntoConfig');
  const { mergeFileIntoConfig } = require('./src/merger');
  const baseConfig = {
    project: { name: 'P' },
    commands: {},
    guidelines: {
      agentRules: ['Never push broken builds.'],
      codeStyle: [],
      gitPractices: []
    }
  };
  const incomingAgentMd = `# P
## Development Rules
### Agent Rules
- **Never push broken builds**
- \`Never push broken builds\`
- Never push broken builds;
- A completely new rule.
`;
  const mergeResult = mergeFileIntoConfig('AGENTS.md', incomingAgentMd, baseConfig);
  const allAgentRules = mergeResult.config.guidelines.agentRules;
  assert.strictEqual(allAgentRules.length, 2, 'Should not duplicate rule with formatting or punctuation variants');
  assert.strictEqual(allAgentRules[1], 'A completely new rule.');
  console.log('✔ Test 11 Passed: Duplicate rules with trailing punctuation or bold/code markdown deduplicated.');

  // Test 12: Monorepo Cargo.toml / lerna.json workspaces & build dir exclusions
  console.log('\nTest 12: Monorepo Cargo.toml / lerna.json workspaces & build dir exclusions');
  const { discoverWorkspaces } = require('./src/monorepo');
  const cargoWorkspaceDir = path.join(testDir, 'cargo_workspace');
  fs.mkdirSync(path.join(cargoWorkspaceDir, 'crates', 'backend'), { recursive: true });
  fs.mkdirSync(path.join(cargoWorkspaceDir, 'crates', 'target'), { recursive: true }); // build dir
  fs.mkdirSync(path.join(cargoWorkspaceDir, 'crates', '.git'), { recursive: true }); // hidden dir
  fs.writeFileSync(path.join(cargoWorkspaceDir, 'crates', 'backend', 'Cargo.toml'), '[package]\nname = "backend"\n');
  fs.writeFileSync(path.join(cargoWorkspaceDir, 'Cargo.toml'), `[workspace]
members = [
    "crates/*"
]
`);
  const foundCargoWs = discoverWorkspaces(cargoWorkspaceDir);
  assert.strictEqual(foundCargoWs.length, 1, 'Must find crates/backend and ignore target and .git');
  assert.strictEqual(foundCargoWs[0].name, 'backend');
  console.log('✔ Test 12 Passed: Cargo.toml members parsed and build/artifact dirs correctly ignored.');

  console.log('\n\x1b[1m\x1b[32m✨ ALL DEEP DEBUGGED ARCHITECTURAL TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
} finally {
  cleanupTestDir();
}
