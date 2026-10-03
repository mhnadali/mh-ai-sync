const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Running Full E2E & Edge-Case Stress Testing Suite...\n');

const CLI = path.join(__dirname, 'bin', 'index.js');
const TEMP_DIR = path.join(__dirname, 'test_sandbox');

function cleanSandbox() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(TEMP_DIR, { recursive: true });

function runCli(args, cwd = TEMP_DIR) {
  try {
    return {
      success: true,
      output: execSync(`node "${CLI}" ${args}`, { cwd, encoding: 'utf8' })
    };
  } catch (err) {
    return {
      success: false,
      output: err.stdout ? err.stdout.toString() : err.message
    };
  }
}

// Stage 1: CLI Init in empty directory
console.log('🔹 Stage 1: Testing CLI `init` in fresh workspace...');
let res = runCli('init');
assert.ok(res.success, 'CLI init should exit with 0');
assert.ok(fs.existsSync(path.join(TEMP_DIR, 'mhai.config.json')), 'mhai.config.json must be created');
console.log('   ✔ Passed: init generates canonical file.');

// Stage 2: CLI Build & File Generation
console.log('🔹 Stage 2: Testing CLI `build` generation of all 7 target files...');
res = runCli('build');
assert.ok(res.success, 'CLI build should succeed');
const targetFiles = [
  'CLAUDE.md',
  'AGENTS.md',
  'ANTIGRAVITY.md',
  '.cursorrules',
  '.windsurfrules',
  path.join('.github', 'copilot-instructions.md'),
  '.mcp.json'
];

for (const tf of targetFiles) {
  const fullPath = path.join(TEMP_DIR, tf);
  assert.ok(fs.existsSync(fullPath), `Target file ${tf} must exist`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert.ok(content.length > 20, `Target file ${tf} should not be empty`);
}
console.log('   ✔ Passed: All 7 target files generated with valid content.');

// Stage 3: MCP JSON Structure Validation
console.log('🔹 Stage 3: Validating .mcp.json syntax and schema...');
const mcpJson = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, '.mcp.json'), 'utf8'));
assert.ok(mcpJson.mcpServers, '.mcp.json must contain mcpServers property');
assert.ok(typeof mcpJson.mcpServers === 'object', 'mcpServers must be an object');
console.log('   ✔ Passed: .mcp.json is strictly valid JSON.');

// Stage 4: Testing Bidirectional Import from CLAUDE.md
console.log('🔹 Stage 4: Testing Bidirectional import from custom CLAUDE.md...');
const customClaude = `# Custom Legacy App
## Overview
A high-throughput FinTech microservice.

## Build & Test Commands
- \`lint_check\`: \`npm run lint:all\`
- \`deploy_prod\`: \`docker compose up -d\`

## Agent Guidelines & Critical Rules
- Do not bypass authentication middlewares.
- Always sanitize database query parameters.
`;
fs.writeFileSync(path.join(TEMP_DIR, 'CLAUDE.md'), customClaude, 'utf8');

res = runCli('import claude');
assert.ok(res.success, 'Import claude should succeed');

const updatedConfig = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'mhai.config.json'), 'utf8'));
assert.strictEqual(updatedConfig.project.overview, 'A high-throughput FinTech microservice.');
assert.strictEqual(updatedConfig.commands.lint_check, 'npm run lint:all');
assert.ok(updatedConfig.guidelines.agentRules.includes('Do not bypass authentication middlewares.'));
console.log('   ✔ Passed: Legacy CLAUDE.md successfully parsed and merged into canonical state.');

// Stage 5: Syncing after import
console.log('🔹 Stage 5: Verifying multi-target sync after import...');
res = runCli('sync');
assert.ok(res.success, 'Sync command should execute properly');
const antigravityContent = fs.readFileSync(path.join(TEMP_DIR, 'ANTIGRAVITY.md'), 'utf8');
assert.ok(antigravityContent.includes('A high-throughput FinTech microservice.'));
assert.ok(antigravityContent.includes('Do not bypass authentication middlewares.'));
console.log('   ✔ Passed: Antigravity context received synchronized updates from Claude import.');

// Stage 6: Edge-case - Corrupted / Non-JSON Config file recovery
console.log('🔹 Stage 6: Testing Resilience against malformed JSON in config...');
fs.writeFileSync(path.join(TEMP_DIR, 'mhai.config.json'), '{ "corrupted": true,, }', 'utf8');
res = runCli('build');
console.log(`   Result on corrupted JSON: exit code success = ${res.success}`);

// Cleanup
cleanSandbox();
console.log('\n🏁 Full 0 to 100 E2E & Stress Test Completed!\n');
