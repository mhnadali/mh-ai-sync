const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { detectStack } = require('./src/detectors');
const { checkStatus, normalizeContent } = require('./src/status');
const { generateClaudeMd } = require('./src/generators');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 1 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase1_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// 1. Stack Detector Tests
console.log('🔹 Test 1: Stack Auto-Detection...');

// 1.a Node + TypeScript + Next.js mock
const nodeMock = path.join(SANDBOX_DIR, 'node_mock');
fs.mkdirSync(nodeMock, { recursive: true });
fs.writeFileSync(path.join(nodeMock, 'package.json'), JSON.stringify({
  name: "mock-next-app",
  description: "Next.js AI App",
  dependencies: { next: "14.0.0", react: "18.0.0" },
  devDependencies: { typescript: "^5.0.0" },
  scripts: { build: "next build", test: "jest", lint: "next lint" }
}), 'utf8');

const nodeDetected = detectStack(nodeMock);
assert.strictEqual(nodeDetected.name, 'mock-next-app');
assert.ok(nodeDetected.techStack.includes('TypeScript'));
assert.ok(nodeDetected.techStack.includes('Next.js'));
assert.ok(nodeDetected.techStack.includes('React'));
assert.strictEqual(nodeDetected.commands.build, 'npm run build');
assert.strictEqual(nodeDetected.commands.test, 'npm test');
console.log('   ✔ Passed: Node.js + TypeScript + Next.js auto-detection.');

// 1.b Python mock
const pyMock = path.join(SANDBOX_DIR, 'py_mock');
fs.mkdirSync(pyMock, { recursive: true });
fs.writeFileSync(path.join(pyMock, 'pyproject.toml'), `
[tool.poetry]
name = "fastapi-service"
[tool.poetry.dependencies]
fastapi = "^0.100.0"
`, 'utf8');

const pyDetected = detectStack(pyMock);
assert.ok(pyDetected.techStack.includes('Python'));
assert.ok(pyDetected.techStack.includes('FastAPI'));
assert.strictEqual(pyDetected.commands.install, 'poetry install');
assert.ok(pyDetected.commands.test.includes('pytest'));
console.log('   ✔ Passed: Python + Poetry + FastAPI auto-detection.');

// 1.c Rust mock
const rustMock = path.join(SANDBOX_DIR, 'rust_mock');
fs.mkdirSync(rustMock, { recursive: true });
fs.writeFileSync(path.join(rustMock, 'Cargo.toml'), `
[package]
name = "my_rust_engine"
version = "0.1.0"
`, 'utf8');

const rustDetected = detectStack(rustMock);
assert.strictEqual(rustDetected.name, 'my_rust_engine');
assert.ok(rustDetected.techStack.includes('Rust'));
assert.strictEqual(rustDetected.commands.build, 'cargo build');
assert.strictEqual(rustDetected.commands.test, 'cargo test');
console.log('   ✔ Passed: Rust + Cargo auto-detection.');

// 1.d Go mock
const goMock = path.join(SANDBOX_DIR, 'go_mock');
fs.mkdirSync(goMock, { recursive: true });
fs.writeFileSync(path.join(goMock, 'go.mod'), `module github.com/user/go-gateway\ngo 1.22\n`, 'utf8');

const goDetected = detectStack(goMock);
assert.strictEqual(goDetected.name, 'go-gateway');
assert.ok(goDetected.techStack.includes('Go'));
assert.strictEqual(goDetected.commands.build, 'go build ./...');
console.log('   ✔ Passed: Go + go.mod auto-detection.');

// 2. Reference Mode Test
console.log('\n🔹 Test 2: Reference Strategy Transclusion Mode...');
const refConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));
refConfig.settings = { strategy: 'reference' };
const claudeRef = generateClaudeMd(refConfig);
assert.ok(claudeRef.includes('@AGENTS.md'), 'Claude config should contain @AGENTS.md in reference mode');
console.log('   ✔ Passed: Reference strategy generates concise @AGENTS.md transclusion.');

// 3. Status & Drift Detection Tests
console.log('\n🔹 Test 3: Status & Drift Detection Engine...');
const statusMock = path.join(SANDBOX_DIR, 'status_mock');
fs.mkdirSync(statusMock, { recursive: true });

// Stage 3.a: Missing files
let statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, statusMock);
assert.strictEqual(statusReport.hasMissing, true);
assert.strictEqual(statusReport.isClean, false);
console.log('   ✔ Passed: Missing files accurately detected.');

// Stage 3.b: In Sync
execSync(`node "${path.join(__dirname, 'bin', 'index.js')}" build`, { cwd: statusMock });
statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, statusMock);
assert.strictEqual(statusReport.hasMissing, false);
assert.strictEqual(statusReport.hasDrift, false);
assert.strictEqual(statusReport.isClean, true);
console.log('   ✔ Passed: Clean synchronized state accurately verified.');

// Stage 3.c: Manual Drift Detection
fs.appendFileSync(path.join(statusMock, 'CLAUDE.md'), '\n- Rogue Manual Rule added directly!\n', 'utf8');
statusReport = checkStatus(DEFAULT_CANONICAL_SCHEMA, statusMock);
assert.strictEqual(statusReport.hasDrift, true);
assert.strictEqual(statusReport.isClean, false);
const driftedItem = statusReport.results.find(r => r.file === 'CLAUDE.md');
assert.strictEqual(driftedItem.status, 'DRIFTED');
console.log('   ✔ Passed: Manual edits detected as DRIFTED.');

// 4. CLI Status & Check Exit Code
console.log('\n🔹 Test 4: CLI Status execution & exit codes...');
const cliPath = path.join(__dirname, 'bin', 'index.js');
try {
  execSync(`node "${cliPath}" status --check`, { cwd: statusMock, stdio: 'pipe' });
  assert.fail('status --check should have failed with exit code 1 due to drift');
} catch (err) {
  assert.strictEqual(err.status, 1, 'Process should exit with 1 on drift with --check');
  console.log('   ✔ Passed: CLI `status --check` accurately exits with code 1 when drift is detected.');
}

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 1 Tests Passed with 100% Success!\n');
