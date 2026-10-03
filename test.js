const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseClaudeMd, parseAgentsMd, parseCursorRules } = require('./src/parsers');
const {
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig
} = require('./src/generators');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting M.H. AI Sync Verification Suite...\n');

// Test 1: Parser resilience on Empty / Malformed inputs
try {
  const emptyRes = parseAgentsMd("");
  assert.strictEqual(typeof emptyRes, 'object');
  assert.strictEqual(emptyRes.guidelines.agentRules.length, 0);
  console.log('✔ Test 1 Passed: Parser handles empty inputs gracefully.');
} catch (e) {
  console.error('❌ Test 1 Failed:', e);
}

// Test 2: Incomplete Config Generation (Missing keys shouldn't crash)
try {
  const minimalConfig = {
    project: { name: "Test Mini" },
    commands: {},
    guidelines: {}
  };
  const claudeOutput = generateClaudeMd(minimalConfig);
  assert.ok(claudeOutput.includes("Test Mini"));
  const antigravityOutput = generateAntigravityConfig(minimalConfig);
  assert.ok(antigravityOutput.includes("Test Mini"));
  console.log('✔ Test 2 Passed: Generators safely handle sparse/partial configs.');
} catch (e) {
  console.error('❌ Test 2 Failed:', e);
}

// Test 3: Generator round-trip integrity
try {
  const testConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));
  testConfig.project.name = "Roundtrip Test";
  const generatedMd = generateAgentsMd(testConfig);
  const reParsed = parseAgentsMd(generatedMd);
  assert.ok(reParsed.name.includes("Roundtrip Test"));
  assert.ok(reParsed.commands.build);
  console.log('✔ Test 3 Passed: Roundtrip generation & parsing verified.');
} catch (e) {
  console.error('❌ Test 3 Failed:', e);
}

console.log('\n✨ Initial verification completed.');
