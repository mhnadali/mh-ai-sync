const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseAgentsMd, parseClaudeMd, parseCursorRules } = require('./src/parsers');
const { auditConfig } = require('./src/security');
const { detectStack } = require('./src/detectors');
const { findDuplicateRules, analyzePromptBudget, estimateTokens } = require('./src/analyzer');
const { mergeFileIntoConfig, inspectDiffs } = require('./src/merger');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🔬 Starting Comprehensive Deep Audit & Edge-Case Verification Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_audit_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// 1. Parser Resilience: Plain commands, Bold commands, Bulletless cursor rules
console.log('🔹 Test 1: Parser Edge Cases (Plain commands, Bold commands, Bulletless rules)...');
const agentsWithPlainCommands = `
# Project Commands
## Commands
- build: npm run build
- test: pytest -v
- **lint**: eslint .
- \`dev\`: nodemon index.js
`;
const parsedPlain = parseAgentsMd(agentsWithPlainCommands);
assert.strictEqual(parsedPlain.commands.build, 'npm run build');
assert.strictEqual(parsedPlain.commands.test, 'pytest -v');
assert.strictEqual(parsedPlain.commands.lint, 'eslint .');
assert.strictEqual(parsedPlain.commands.dev, 'nodemon index.js');

const cursorBulletless = `
# Cursor Rules
Always write type-safe TypeScript code.
Never use any type in production code.
- Follow Clean Code principles.
`;
const parsedCursor = parseCursorRules(cursorBulletless);
assert.ok(parsedCursor.guidelines.agentRules.includes('Always write type-safe TypeScript code.'));
assert.ok(parsedCursor.guidelines.agentRules.includes('Never use any type in production code.'));
assert.ok(parsedCursor.guidelines.agentRules.includes('Follow Clean Code principles.'));
console.log('   ✔ Passed: Parsers handle plain text, bold markdown, and bulletless sentences.');

// 2. Security Auditor: Modular Cursor Rules & Modular Skills Secret Scanning
console.log('\n🔹 Test 2: Security Auditor Modular Scanning (.cursor/rules & skills)...');
const cursorRulesDir = path.join(SANDBOX_DIR, '.cursor', 'rules');
fs.mkdirSync(cursorRulesDir, { recursive: true });
fs.writeFileSync(path.join(cursorRulesDir, 'secret-rule.mdc'), `---
description: leaked rule
---
- Use this secret token: ghp_111111111122222222223333333333444444
`, 'utf8');

const skillsDir = path.join(SANDBOX_DIR, 'skills', 'deploy-tool');
fs.mkdirSync(skillsDir, { recursive: true });
fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), `---
name: deploy-tool
---
Export your key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890
`, 'utf8');

const auditResult = auditConfig(DEFAULT_CANONICAL_SCHEMA, SANDBOX_DIR);
assert.strictEqual(auditResult.isSecure, false);
assert.ok(auditResult.findings.some(f => f.file.includes('secret-rule.mdc')));
assert.ok(auditResult.findings.some(f => f.file.includes('SKILL.md')));
console.log('   ✔ Passed: Security auditor catches secrets across modular rules and skills.');

// 3. Detector Enhancements: compose.yaml & requirements-dev.txt
console.log('\n🔹 Test 3: Detector Enhancements (compose.yaml & requirements-dev.txt)...');
const composeSandbox = path.join(SANDBOX_DIR, 'compose_mock');
fs.mkdirSync(composeSandbox, { recursive: true });
fs.writeFileSync(path.join(composeSandbox, 'compose.yaml'), 'services:\n  app:\n    image: node:18', 'utf8');
fs.writeFileSync(path.join(composeSandbox, 'requirements-dev.txt'), 'pytest==8.0.0\nruff==0.3.0', 'utf8');

const detected = detectStack(composeSandbox);
assert.ok(detected.techStack.includes('Docker'));
assert.ok(detected.techStack.includes('Python'));
assert.ok(detected.commands.install.includes('requirements-dev.txt'));
console.log('   ✔ Passed: Detectors recognize compose.yaml and requirements-dev.txt.');

// 4. Analyzer Safety against Null, Undefined, and Corrupted Inputs
console.log('\n🔹 Test 4: Analyzer Resilience against Null, Undefined, and Corrupted Configs...');
assert.doesNotThrow(() => findDuplicateRules(null));
assert.doesNotThrow(() => findDuplicateRules(undefined));
assert.doesNotThrow(() => findDuplicateRules({}));
assert.doesNotThrow(() => analyzePromptBudget(null));
assert.doesNotThrow(() => analyzePromptBudget(undefined));
assert.doesNotThrow(() => analyzePromptBudget("corrupted string"));
console.log('   ✔ Passed: Analyzer functions are completely immune to malformed inputs.');

// 5. 3-Way Merge on .mcp.json
console.log('\n🔹 Test 5: 3-Way Merge on .mcp.json...');
const mcpContent = JSON.stringify({
  mcpServers: {
    "my-analytics": {
      command: "npx",
      args: ["-y", "@company/analytics-mcp"]
    }
  }
});
const mergeMcpRes = mergeFileIntoConfig('.mcp.json', mcpContent, DEFAULT_CANONICAL_SCHEMA);
assert.ok(mergeMcpRes.config.mcpServers['my-analytics']);
assert.strictEqual(mergeMcpRes.config.mcpServers['my-analytics'].command, 'npx');
assert.ok(mergeMcpRes.changes.some(c => c.type === 'mcpServer' && c.key === 'my-analytics'));
console.log('   ✔ Passed: .mcp.json direct modifications cleanly absorbed by smart merge.');

// Cleanup
cleanSandbox();
console.log('\n🌟 Deep Audit & Verification Suite Passed with 100% Success!\n');
