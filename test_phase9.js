const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');
const {
  extractWorkspacePatterns,
  discoverWorkspaces,
  resolveWorkspaceConfig,
  syncAllWorkspaces,
  checkWorkspacesStatus,
  formatWorkspacesReport
} = require('./src/monorepo');
const { setActiveTask, generateTaskBanner, loadTaskState } = require('./src/task');

console.log('\x1b[1m\x1b[36m=== Testing Phase 9: Enterprise Monorepo & Multi-Workspace Engine ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_test_phase9');

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

  // Test 1: extractWorkspacePatterns - default fallback conventions
  console.log('Test 1: Default conventional workspace patterns fallback');
  const defaultPatterns = extractWorkspacePatterns(testDir);
  assert.ok(defaultPatterns.includes('apps/*'), 'Should include apps/*');
  assert.ok(defaultPatterns.includes('packages/*'), 'Should include packages/*');
  console.log('✔ Test 1 Passed: Default fallback patterns recognized.');

  // Test 2: extractWorkspacePatterns - pnpm-workspace.yaml & package.json
  console.log('\nTest 2: pnpm-workspace.yaml pattern extraction');
  fs.writeFileSync(path.join(testDir, 'pnpm-workspace.yaml'), `packages:
  - 'packages/*'
  - 'apps/*'
  - 'services/backend'
`);
  const pnpmPatterns = extractWorkspacePatterns(testDir);
  assert.deepStrictEqual(pnpmPatterns.sort(), ['apps/*', 'packages/*', 'services/backend'].sort());
  console.log('✔ Test 2 Passed: pnpm-workspace.yaml parsed correctly.');

  // Test 3: discoverWorkspaces in monorepo layout
  console.log('\nTest 3: discoverWorkspaces with multi-package monorepo layout');
  const webAppDir = path.join(testDir, 'apps', 'web');
  const uiPkgDir = path.join(testDir, 'packages', 'ui');
  const backendDir = path.join(testDir, 'services', 'backend');

  fs.mkdirSync(webAppDir, { recursive: true });
  fs.mkdirSync(uiPkgDir, { recursive: true });
  fs.mkdirSync(backendDir, { recursive: true });

  // Web app (Next.js / TypeScript)
  fs.writeFileSync(path.join(webAppDir, 'package.json'), JSON.stringify({
    name: '@monorepo/web',
    dependencies: { next: '^14.0.0', react: '^18.2.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: { dev: 'next dev', build: 'next build' }
  }, null, 2));

  // UI package (React component library)
  fs.writeFileSync(path.join(uiPkgDir, 'package.json'), JSON.stringify({
    name: '@monorepo/ui',
    dependencies: { react: '^18.2.0' },
    scripts: { build: 'tsc' }
  }, null, 2));

  // Backend service (Python / FastAPI)
  fs.writeFileSync(path.join(backendDir, 'requirements.txt'), 'fastapi\nuvicorn\n');

  const discovered = discoverWorkspaces(testDir);
  assert.strictEqual(discovered.length, 3, 'Should discover all 3 subpackages');

  const webWs = discovered.find(w => w.name === 'web');
  assert.ok(webWs, 'Should find web workspace');
  assert.ok(webWs.techStack.includes('Next.js') || webWs.techStack.includes('TypeScript'), 'Should detect web stack');

  const uiWs = discovered.find(w => w.name === 'ui');
  assert.ok(uiWs, 'Should find ui workspace');

  const backendWs = discovered.find(w => w.name === 'backend');
  assert.ok(backendWs, 'Should find backend workspace');
  assert.ok(backendWs.techStack.includes('Python'), 'Should detect backend stack');
  console.log('✔ Test 3 Passed: Workspaces discovered with automatic stack detection.');

  // Test 4: resolveWorkspaceConfig - Cascading Rule Inheritance & Local Overrides
  console.log('\nTest 4: Cascading Rule Inheritance & Local Overrides');
  const rootConfig = {
    version: '1.0.0',
    project: {
      name: 'Super Monorepo',
      overview: 'Enterprise multi-agent monorepo',
      techStack: ['Turborepo', 'TypeScript']
    },
    commands: {
      lint: 'turbo lint',
      test: 'turbo test'
    },
    guidelines: {
      codeStyle: ['Global DRY principle', 'Root typescript strict rules'],
      gitPractices: ['Conventional commits (feat:, fix:)'],
      agentRules: ['Never break shared contracts']
    },
    modularRules: [],
    skills: []
  };

  // Give backend its own local mhai.config.json to test local override/extension
  fs.writeFileSync(path.join(backendDir, 'mhai.config.json'), JSON.stringify({
    project: { architecture: 'Microservices Clean Architecture' },
    guidelines: {
      codeStyle: ['Follow PEP8 guidelines'],
      agentRules: ['Ensure type annotations on FastAPI routes']
    }
  }, null, 2));

  const resolvedBackend = resolveWorkspaceConfig(rootConfig, backendWs);
  assert.strictEqual(resolvedBackend.project.name, 'Super Monorepo [backend]');
  assert.strictEqual(resolvedBackend.project.architecture, 'Microservices Clean Architecture');
  assert.ok(resolvedBackend.guidelines.codeStyle.includes('Global DRY principle'), 'Should inherit root code style');
  assert.ok(resolvedBackend.guidelines.codeStyle.includes('Follow PEP8 guidelines'), 'Should merge local code style');
  assert.ok(resolvedBackend.guidelines.agentRules.includes('Never break shared contracts'), 'Should inherit root agent rules');
  assert.ok(resolvedBackend.guidelines.agentRules.includes('Ensure type annotations on FastAPI routes'), 'Should merge local agent rules');
  assert.ok(resolvedBackend.guidelines.agentRules.some(r => r.includes('Focus changes within services/backend')), 'Should contain scoped boundary guideline');
  console.log('✔ Test 4 Passed: Cascading rule inheritance and local overrides resolved successfully.');

  // Test 5: syncAllWorkspaces & File Generation
  console.log('\nTest 5: syncAllWorkspaces - Generates scoped context files in all subpackages');
  setActiveTask('Build Monorepo Support', { note: 'Sprint 9 kickoff' }, testDir);
  const taskState = loadTaskState(testDir);
  const banner = generateTaskBanner(taskState);
  const syncResult = syncAllWorkspaces(rootConfig, testDir, banner);
  assert.strictEqual(syncResult.workspacesCount, 3, 'Should sync 3 workspaces');

  // Verify files generated in web workspace
  assert.ok(fs.existsSync(path.join(webAppDir, 'CLAUDE.md')), 'apps/web/CLAUDE.md must exist');
  assert.ok(fs.existsSync(path.join(webAppDir, 'AGENTS.md')), 'apps/web/AGENTS.md must exist');
  assert.ok(fs.existsSync(path.join(webAppDir, 'ANTIGRAVITY.md')), 'apps/web/ANTIGRAVITY.md must exist');
  assert.ok(fs.existsSync(path.join(webAppDir, '.cursorrules')), 'apps/web/.cursorrules must exist');
  assert.ok(fs.existsSync(path.join(webAppDir, '.cursor', 'rules')), 'apps/web/.cursor/rules must exist');

  const claudeContent = fs.readFileSync(path.join(webAppDir, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeContent.includes('Super Monorepo [web]'), 'Should contain scoped workspace name');
  assert.ok(claudeContent.includes('Build Monorepo Support'), 'Should contain task banner');

  // Verify backend files
  const backendAgents = fs.readFileSync(path.join(backendDir, 'AGENTS.md'), 'utf8');
  assert.ok(backendAgents.includes('Follow PEP8 guidelines'), 'Backend AGENTS.md should contain local rule');
  console.log('✔ Test 5 Passed: All subpackages populated with scoped AI agent context files.');

  // Test 6: checkWorkspacesStatus - Drift Detection Across Subpackages
  console.log('\nTest 6: checkWorkspacesStatus - Drift detection');
  const initialStatus = checkWorkspacesStatus(rootConfig, testDir);
  assert.strictEqual(initialStatus.isAllClean, true, 'All workspaces should be in sync right after build');

  // Modify apps/web/CLAUDE.md to simulate drift
  fs.appendFileSync(path.join(webAppDir, 'CLAUDE.md'), '\n// Stray manual edit\n');
  const driftedStatus = checkWorkspacesStatus(rootConfig, testDir);
  assert.strictEqual(driftedStatus.isAllClean, false, 'Should detect drift in drifted workspace');
  const webReport = driftedStatus.reports.find(r => r.workspace === 'web');
  assert.strictEqual(webReport.status.isClean, false, 'Web workspace status should be unclean');
  console.log('✔ Test 6 Passed: Cross-workspace drift detection works correctly.');

  // Test 7: formatWorkspacesReport
  console.log('\nTest 7: formatWorkspacesReport');
  const reportOutput = formatWorkspacesReport(discovered);
  assert.ok(reportOutput.includes('Super Monorepo') || reportOutput.includes('web'));
  assert.ok(reportOutput.includes('Discovered: 3 workspace(s)'));
  console.log('✔ Test 7 Passed: Report formatting works.');

  // Test 8: CLI Integration Tests (workspaces list, sync, build --workspaces, status --workspaces)
  console.log('\nTest 8: CLI commands integration');
  const cliPath = path.join(__dirname, 'bin', 'index.js');

  // Run `node bin/index.js workspaces` in root repository
  const listOut = execSync(`node "${cliPath}" workspaces`, { encoding: 'utf8' });
  assert.ok(listOut.includes('M.H. AI Sync Monorepo Workspaces'), 'CLI should output workspaces header');

  // Run `node bin/index.js help` to verify new commands are documented
  const helpOut = execSync(`node "${cliPath}" help`, { encoding: 'utf8' });
  assert.ok(helpOut.includes('workspaces'), 'Help should document workspaces command');
  assert.ok(helpOut.includes('--workspaces'), 'Help should document --workspaces flag');
  console.log('✔ Test 8 Passed: CLI execution passes cleanly.');

  console.log('\n\x1b[1m\x1b[32m✨ ALL PHASE 9 MONOREPO & WORKSPACES TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
} finally {
  cleanupTestDir();
}
