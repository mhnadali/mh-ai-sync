const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  MCP_PRESETS,
  getMcpPresets,
  listConfiguredServers,
  addMcpServer,
  removeMcpServer,
  formatMcpList,
  formatPresetsList
} = require('./src/mcpHub');
const { checkStatus } = require('./src/status');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 7 Comprehensive Test Suite (MCP Hub & Integrator)...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase7_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: Presets Catalog & Listing
console.log('🔹 Test 1: MCP Presets Catalog & Listing...');
const presets = getMcpPresets();
assert.ok(presets.length >= 8, 'Catalog must contain at least 8 standard presets');

const filesystemPreset = presets.find(p => p.id === 'filesystem');
assert.ok(filesystemPreset, 'Filesystem preset must exist');
assert.strictEqual(filesystemPreset.command, 'npx');
assert.ok(filesystemPreset.args.includes('@modelcontextprotocol/server-filesystem'));

const githubPreset = presets.find(p => p.id === 'github');
assert.ok(githubPreset, 'GitHub preset must exist');
assert.strictEqual(githubPreset.requiresAuth, true);

const formattedPresets = formatPresetsList();
assert.ok(formattedPresets.includes('MCP Hub Presets'));
assert.ok(formattedPresets.includes('brave-search'));
assert.ok(formattedPresets.includes('puppeteer'));
console.log('   ✔ Passed: Presets catalog verified with metadata, command flags, and auth indicators.');

// Test 2: In-Memory Add & Remove Operations
console.log('\n🔹 Test 2: In-Memory MCP Add & Remove Operations...');
const sampleConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));

// 2.a Add from preset
const addRes1 = addMcpServer(sampleConfig, 'fetch');
assert.strictEqual(addRes1.isPreset, true);
assert.ok(sampleConfig.mcpServers.fetch, 'fetch server must be added to mcpServers');
assert.strictEqual(sampleConfig.mcpServers.fetch.command, 'npx');

// 2.b Add custom server
const addRes2 = addMcpServer(sampleConfig, 'my-custom-service', {
  command: 'node',
  args: ['./servers/my-service.js', '--port', '8080'],
  env: { SERVICE_KEY: 'secret123' }
});
assert.strictEqual(addRes2.isPreset, false);
assert.ok(sampleConfig.mcpServers['my-custom-service']);
assert.strictEqual(sampleConfig.mcpServers['my-custom-service'].command, 'node');
assert.strictEqual(sampleConfig.mcpServers['my-custom-service'].env.SERVICE_KEY, 'secret123');

// 2.c List configured servers
const configured = listConfiguredServers(sampleConfig);
assert.ok(configured.some(s => s.name === 'fetch' && s.isPreset === true));
assert.ok(configured.some(s => s.name === 'my-custom-service' && s.isPreset === false));

// 2.d Remove server
const remRes1 = removeMcpServer(sampleConfig, 'my-custom-service');
assert.strictEqual(remRes1.removed, true);
assert.strictEqual(sampleConfig.mcpServers['my-custom-service'], undefined);

// 2.e Remove non-existent server
const remRes2 = removeMcpServer(sampleConfig, 'non-existent');
assert.strictEqual(remRes2.removed, false);
console.log('   ✔ Passed: In-memory MCP server additions, custom definitions, and removals verified.');

// Test 3: CLI End-to-End Workflow in Sandbox
console.log('\n🔹 Test 3: CLI End-to-End MCP Management in Sandbox...');
const cliPath = path.join(__dirname, 'bin', 'index.js');

// Seed canonical config in sandbox
fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(DEFAULT_CANONICAL_SCHEMA, null, 2), 'utf8');

// 3.a Run initial build
execSync(`node "${cliPath}" build`, { cwd: SANDBOX_DIR, stdio: 'pipe' });

// 3.b Check presets command
const presetsOutput = execSync(`node "${cliPath}" mcp presets`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(presetsOutput.includes('filesystem'));
assert.ok(presetsOutput.includes('sqlite'));

// 3.c Add preset 'fetch' via CLI
const addFetchOutput = execSync(`node "${cliPath}" mcp add fetch`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(addFetchOutput.includes('Added MCP server -> "fetch"'));

// Verify .mcp.json on disk
const diskMcp1 = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, '.mcp.json'), 'utf8'));
assert.ok(diskMcp1.mcpServers.fetch, '.mcp.json must include fetch server');
assert.ok(diskMcp1.mcpServers.fetch.args.includes('@modelcontextprotocol/server-fetch'));

// 3.d Add 'sqlite' preset via CLI
const addSqliteOutput = execSync(`node "${cliPath}" mcp add sqlite`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(addSqliteOutput.includes('Added MCP server -> "sqlite"'));

const diskMcp2 = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, '.mcp.json'), 'utf8'));
assert.ok(diskMcp2.mcpServers.sqlite, '.mcp.json must include sqlite server');

// 3.e Query MCP servers list via CLI
const listOutput = execSync(`node "${cliPath}" mcp`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(listOutput.includes('fetch'));
assert.ok(listOutput.includes('sqlite'));

// 3.f Remove 'fetch' via CLI
const removeOutput = execSync(`node "${cliPath}" mcp remove fetch`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(removeOutput.includes('Removed MCP server -> "fetch"'));

const diskMcp3 = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, '.mcp.json'), 'utf8'));
assert.strictEqual(diskMcp3.mcpServers.fetch, undefined, 'fetch must be removed from .mcp.json');
assert.ok(diskMcp3.mcpServers.sqlite, 'sqlite must remain in .mcp.json');

// 3.g Verify sync status in sandbox
const sandboxConfig = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), 'utf8'));
const statusReport = checkStatus(sandboxConfig, SANDBOX_DIR);
assert.strictEqual(statusReport.isClean, true, 'Workspace must remain 100% IN_SYNC after MCP changes');
console.log('   ✔ Passed: CLI `mcp presets`, `mcp add`, `mcp list`, `mcp remove`, and auto-sync verified.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 7 Tests Passed with 100% Success!\n');
