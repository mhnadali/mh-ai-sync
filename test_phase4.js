const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateGitHubActionWorkflow, installGitHubAction } = require('./src/ci');

console.log('🧪 Starting Phase 4 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase4_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: GitHub Action Generator Content
console.log('🔹 Test 1: GitHub Action Workflow Generator...');
const workflowYaml = generateGitHubActionWorkflow();
assert.ok(workflowYaml.includes('name: AI Agent Context & Security Sync'), 'Must define workflow name');
assert.ok(workflowYaml.includes('node bin/index.js audit --strict'), 'Must include security scan step');
assert.ok(workflowYaml.includes('node bin/index.js status --check'), 'Must include drift check step');
console.log('   ✔ Passed: Workflow YAML structure and commands verified.');

// Test 2: GitHub Action File Installation
console.log('\n🔹 Test 2: Workflow Installation on Disk...');
const installRes = installGitHubAction(SANDBOX_DIR);
assert.ok(fs.existsSync(installRes.filePath), 'Workflow file must exist on disk');
const onDiskContent = fs.readFileSync(installRes.filePath, 'utf8');
assert.strictEqual(onDiskContent, workflowYaml);
console.log('   ✔ Passed: Workflow file safely written to .github/workflows/ai-sync-check.yml.');

// Test 3: CLI `ci` command in sandbox
console.log('\n🔹 Test 3: CLI `ci` command execution...');
const cliPath = path.join(__dirname, 'bin', 'index.js');
execSync(`node "${cliPath}" ci`, { cwd: SANDBOX_DIR, stdio: 'pipe' });
assert.ok(fs.existsSync(path.join(SANDBOX_DIR, '.github', 'workflows', 'ai-sync-check.yml')), 'CLI must install workflow');
console.log('   ✔ Passed: CLI `ci` command installs workflow seamlessly.');

// Test 4: Package Manifest Integrity for npm Distribution
console.log('\n🔹 Test 4: Package Manifest & Files Array Integrity...');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
assert.strictEqual(pkg.name, 'mh-ai-sync');
assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'Package version must be valid semver format');
assert.ok(fs.existsSync(path.join(__dirname, pkg.main)), 'Main entrypoint must exist');
assert.ok(fs.existsSync(path.join(__dirname, pkg.bin['mh-ai-sync'])), 'Bin executable must exist');
for (const fileOrDir of pkg.files) {
  assert.ok(fs.existsSync(path.join(__dirname, fileOrDir)), `Bundle path '${fileOrDir}' must exist on disk`);
}
console.log('   ✔ Passed: package.json manifest is 100% valid and ready for npm publish.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 4 Tests Passed with 100% Success!\n');
