const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseAgentsMd, parseClaudeMd, parseCursorRules } = require('./src/parsers');
const {
  sanitize,
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig
} = require('./src/generators');

console.log('🔬 Starting Deep Unit, Sanitization & Edge-Case Audit...\n');

// 1. Sanitize Edge cases
console.log('1️⃣ Testing sanitize() with primitive, null, undefined, corrupted types...');
assert.deepStrictEqual(sanitize(null).project.name, "AI-Augmented Project");
assert.deepStrictEqual(sanitize(undefined).commands, {});
assert.deepStrictEqual(sanitize({ project: "invalid_type" }).project.name, "AI-Augmented Project");
assert.deepStrictEqual(sanitize({ guidelines: { codeStyle: "not an array" } }).guidelines.codeStyle, []);
assert.deepStrictEqual(sanitize({ mcpServers: "corrupted string" }).mcpServers, {});
console.log('   ✔ Passed: sanitize() guarantees rock-solid structure on any data type.');

// 2. Parsers Edge Cases
console.log('2️⃣ Testing parsers with non-string, binary-like, or malformed inputs...');
assert.deepStrictEqual(parseAgentsMd(12345).name, "AI-Augmented Project");
assert.deepStrictEqual(parseAgentsMd(null).overview, "");
assert.deepStrictEqual(parseCursorRules(undefined).guidelines.agentRules, []);

const messyMarkdown = `
# Random Title with no section
Some random text
- Invalid command format without colon
- \`valid_cmd\`: \`node run.js\`
### Code Style
- Use strict equality ===
`;
const parsedMessy = parseAgentsMd(messyMarkdown);
assert.strictEqual(parsedMessy.commands.valid_cmd, 'node run.js');
assert.ok(parsedMessy.guidelines.codeStyle.includes('Use strict equality ==='));
console.log('   ✔ Passed: Parsers safely ignore malformed lines without throwing.');

// 3. Generator Output Validity
console.log('3️⃣ Testing all generators against null inputs...');
const blank = {};
assert.ok(generateClaudeMd(blank).includes('Claude Code Configuration'));
assert.ok(generateAgentsMd(blank).includes('AGENTS.md'));
assert.ok(generateAntigravityConfig(blank).includes('Google Antigravity'));
assert.ok(generateCursorRules(blank).includes('Cursor Rules'));
assert.ok(generateWindsurfRules(blank).includes('Windsurf Cascade Directives'));
assert.ok(generateCopilotInstructions(blank).includes('GitHub Copilot Instructions'));
assert.strictEqual(generateMcpConfig(blank), '{\n  "mcpServers": {}\n}');
console.log('   ✔ Passed: All 7 generators return valid templates even on empty objects.');

console.log('\n🌟 Deep Audit Successful: Zero unhandled exceptions or edge-case crashes.');
