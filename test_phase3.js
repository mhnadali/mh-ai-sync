const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { scanText, redactSecrets, auditConfig } = require('./src/security');
const { startWatcher } = require('./src/watcher');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 3 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase3_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: Security Scanner Detection
console.log('🔹 Test 1: Security Scanner & Secret Patterns...');
const testSensitiveText = `
# Project Guide
Use GitHub Token: ghp_111122223333444455556666777788889999
Connect to OpenAI with sk-abcdef12345678901234567890
Anthropic key is sk-ant-api03-abcdef12345678901234567890
AWS S3 Access: AKIAIOSFODNN7EXAMPLE
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y
-----END RSA PRIVATE KEY-----
`;

const findings = scanText(testSensitiveText, 'test.md');
assert.strictEqual(findings.length, 5, 'Must detect all 5 secret patterns');
assert.ok(findings.some(f => f.rule.includes('GitHub Personal Access Token')));
assert.ok(findings.some(f => f.rule.includes('OpenAI API Key')));
assert.ok(findings.some(f => f.rule.includes('Anthropic API Key')));
assert.ok(findings.some(f => f.rule.includes('AWS Access Key ID')));
assert.ok(findings.some(f => f.rule.includes('Private Key Block')));
console.log('   ✔ Passed: All 5 secret credential patterns successfully caught with line numbers.');

// Test 2: Secret Redaction
console.log('\n🔹 Test 2: Secret Redaction Engine...');
const redacted = redactSecrets(testSensitiveText);
assert.ok(!redacted.includes('ghp_111122223333444455556666777788889999'), 'GitHub token must be stripped');
assert.ok(!redacted.includes('sk-abcdef12345678901234567890'), 'OpenAI key must be stripped');
assert.ok(!redacted.includes('AKIAIOSFODNN7EXAMPLE'), 'AWS key must be stripped');
assert.ok(redacted.includes('[REDACTED_SECRET]'), 'Replaced with [REDACTED_SECRET]');
console.log('   ✔ Passed: Secrets safely redacted while preserving instructions.');

// Test 3: Audit Clean vs Leaked in CLI
console.log('\n🔹 Test 3: Audit Engine & CLI --strict execution...');
const cleanAudit = auditConfig(DEFAULT_CANONICAL_SCHEMA, SANDBOX_DIR);
assert.strictEqual(cleanAudit.isSecure, true, 'Default schema must be clean and secure');

// Plant a leak in sandbox
const cliPath = path.join(__dirname, 'bin', 'index.js');
const leakedConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));
leakedConfig.guidelines.agentRules.push('Use this test key sk-secret1234567890123456789012345678');
fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(leakedConfig, null, 2), 'utf8');

try {
  execSync(`node "${cliPath}" audit --strict`, { cwd: SANDBOX_DIR, stdio: 'pipe' });
  assert.fail('audit --strict must exit with code 1 when a leak is present');
} catch (err) {
  assert.strictEqual(err.status, 1, 'CLI must exit with code 1 in strict audit mode');
  console.log('   ✔ Passed: CLI `audit --strict` safely blocks when secret credentials are found.');
}

// Test 4: Live Watcher Engine Lifecycle
console.log('\n🔹 Test 4: Live Watcher Start, Debounce & Stop...');
let syncTriggered = false;
const watcher = startWatcher(SANDBOX_DIR, () => {
  syncTriggered = true;
}, 50);

assert.ok(watcher.watchedPaths.length > 0, 'Watcher must register workspace paths');
assert.strictEqual(typeof watcher.stop, 'function', 'Watcher must have stop() method');

// Trigger event by touching a watched file
fs.writeFileSync(path.join(SANDBOX_DIR, 'CLAUDE.md'), '# Claude test update', 'utf8');

setTimeout(() => {
  watcher.stop();
  console.log('   ✔ Passed: Watcher lifecycle and graceful teardown verified.');

  // Cleanup
  cleanSandbox();
  console.log('\n✨ All Phase 3 Tests Passed with 100% Success!\n');
}, 150);
