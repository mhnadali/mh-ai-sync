const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  generateClineRules,
  generateRooModes,
  generateAiderConventions,
  generateAiderConfig,
  generateContinueRules,
  generateZedInstructions
} = require('./src/generators');

const { checkStatus } = require('./src/status');
const { parseAgentsMd } = require('./src/parsers');

console.log('\x1b[1m\x1b[36m=== Testing Phase 12: Next-Gen Agent Ecosystem (Cline, Roo, Aider, Continue, Zed) ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_test_phase12');

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

  const sampleConfig = {
    project: {
      name: 'Falcon Engine',
      overview: 'High-speed distributed stream processor.',
      techStack: ['Node.js', 'Rust', 'Kafka'],
      architecture: 'Event-driven modular pipeline.'
    },
    commands: {
      build: 'cargo build --release',
      test: 'cargo test',
      dev: 'cargo run'
    },
    guidelines: {
      codeStyle: ['Follow Clean Architecture principles.', 'Strict type-safety across all layers.'],
      gitPractices: ['Use conventional commits (feat:, fix:).', 'Never push directly to main.'],
      agentRules: ['Preserve existing comments and tests.', 'Prefer surgical edits over rewrites.']
    }
  };

  const sampleBanner = '🔴 ACTIVE TASK: Optimize Kafka Consumer Pipeline\n\n';

  // Test 1: Cline generator (.clinerules)
  console.log('Test 1: generateClineRules (.clinerules)');
  const clineOutput = generateClineRules(sampleConfig, sampleBanner);
  assert.ok(clineOutput.includes('# Cline Rules & Project Directives'));
  assert.ok(clineOutput.includes('Falcon Engine'));
  assert.ok(clineOutput.includes('ACTIVE TASK: Optimize Kafka Consumer Pipeline'));
  assert.ok(clineOutput.includes('cargo test'));
  assert.ok(clineOutput.includes('Follow Clean Architecture principles.'));
  console.log('✔ Test 1 Passed: Cline rules generated with commands, banner, and guidelines.');

  // Test 2: Roo Code custom modes generator (.roomodes)
  console.log('\nTest 2: generateRooModes (.roomodes JSON)');
  const rooOutput = generateRooModes(sampleConfig, sampleBanner);
  const rooParsed = JSON.parse(rooOutput);
  assert.ok(Array.isArray(rooParsed.customModes));
  assert.strictEqual(rooParsed.customModes.length, 3);

  const slugs = rooParsed.customModes.map(m => m.slug);
  assert.ok(slugs.includes('code'));
  assert.ok(slugs.includes('architect'));
  assert.ok(slugs.includes('test-engineer'));

  const codeMode = rooParsed.customModes.find(m => m.slug === 'code');
  assert.ok(codeMode.roleDefinition.includes('Falcon Engine'));
  assert.ok(codeMode.customInstructions.includes('ACTIVE TASK'));
  assert.ok(codeMode.groups.includes('edit'));
  console.log('✔ Test 2 Passed: Roo Code custom modes JSON generated with roles and tool groups.');

  // Test 3: Aider conventions (CONVENTIONS.md) and configuration (.aider.conf.yml)
  console.log('\nTest 3: generateAiderConventions & generateAiderConfig');
  const aiderConventions = generateAiderConventions(sampleConfig, sampleBanner);
  assert.ok(aiderConventions.includes('CONVENTIONS.md - Aider Repository Guidelines'));
  assert.ok(aiderConventions.includes('cargo test'));
  assert.ok(aiderConventions.includes('Use conventional commits'));

  const aiderConfig = generateAiderConfig(sampleConfig);
  assert.ok(aiderConfig.includes('read:'));
  assert.ok(aiderConfig.includes('- CONVENTIONS.md'));
  assert.ok(aiderConfig.includes('test-cmd: cargo test'));
  console.log('✔ Test 3 Passed: Aider CONVENTIONS.md and .aider.conf.yml generated accurately.');

  // Test 4: Continue.dev prompt rules (.continue/rules/project-rules.md)
  console.log('\nTest 4: generateContinueRules (.continue/rules/project-rules.md)');
  const continueRules = generateContinueRules(sampleConfig, sampleBanner);
  assert.ok(continueRules.includes('# Continue.dev Custom Prompt Rules'));
  assert.ok(continueRules.includes('Falcon Engine'));
  assert.ok(continueRules.includes('Follow Clean Architecture principles.'));
  console.log('✔ Test 4 Passed: Continue.dev prompt rules generated cleanly.');

  // Test 5: Zed Editor Assistant instructions (.zed/instructions.md)
  console.log('\nTest 5: generateZedInstructions (.zed/instructions.md)');
  const zedInstructions = generateZedInstructions(sampleConfig, sampleBanner);
  assert.ok(zedInstructions.includes('# Zed Assistant Instructions'));
  assert.ok(zedInstructions.includes('High-speed distributed stream processor.'));
  assert.ok(zedInstructions.includes('cargo build --release'));
  console.log('✔ Test 5 Passed: Zed Assistant instructions generated cleanly.');

  // Test 6: CLI Build & Drift Status in Sandbox with all 16 target files
  console.log('\nTest 6: End-to-end sandbox build and status verification for all platforms');
  const sandboxDir = path.join(testDir, 'sandbox');
  fs.mkdirSync(sandboxDir, { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'mhai.config.json'), JSON.stringify(sampleConfig, null, 2), 'utf8');

  const binPath = path.join(__dirname, 'bin', 'index.js');
  const buildOut = execSync(`node "${binPath}" build`, { cwd: sandboxDir, encoding: 'utf8' });

  assert.ok(buildOut.includes('.clinerules'));
  assert.ok(buildOut.includes('.roomodes'));
  assert.ok(buildOut.includes('CONVENTIONS.md'));
  assert.ok(buildOut.includes('.aider.conf.yml'));
  assert.ok(buildOut.includes('.continue/rules/project-rules.md'));
  assert.ok(buildOut.includes('.zed/instructions.md'));

  // Verify all files exist on disk
  assert.ok(fs.existsSync(path.join(sandboxDir, '.clinerules')));
  assert.ok(fs.existsSync(path.join(sandboxDir, '.roomodes')));
  assert.ok(fs.existsSync(path.join(sandboxDir, 'CONVENTIONS.md')));
  assert.ok(fs.existsSync(path.join(sandboxDir, '.aider.conf.yml')));
  assert.ok(fs.existsSync(path.join(sandboxDir, '.continue', 'rules', 'project-rules.md')));
  assert.ok(fs.existsSync(path.join(sandboxDir, '.zed', 'instructions.md')));

  const statusReport = checkStatus(sampleConfig, sandboxDir);
  assert.strictEqual(statusReport.isClean, true, 'All targets on disk must match expected canonical state');
  console.log('✔ Test 6 Passed: Full compilation and 100% drift-free status confirmed across all targets.');

  // Test 7: Bidirectional Import from Cline and Aider
  console.log('\nTest 7: Bidirectional import from .clinerules and CONVENTIONS.md');
  const importDir = path.join(testDir, 'import_sandbox');
  fs.mkdirSync(importDir, { recursive: true });
  fs.writeFileSync(path.join(importDir, '.clinerules'), `# Custom Cline App
## Overview
A specialized trading terminal.

## Commands & Workflows
- test: cargo test --lib
- build: cargo build

## Agent Directives & Constraints
- Always check order books before executing trades.
`, 'utf8');

  execSync(`node "${binPath}" import cline`, { cwd: importDir });
  const importedConfig = JSON.parse(fs.readFileSync(path.join(importDir, 'mhai.config.json'), 'utf8'));
  assert.strictEqual(importedConfig.project.name, 'Custom Cline App');
  assert.strictEqual(importedConfig.commands.test, 'cargo test --lib');
  assert.ok(importedConfig.guidelines.agentRules.includes('Always check order books before executing trades.'));
  console.log('✔ Test 7 Passed: Successfully imported project directives from .clinerules into canonical config.');

  console.log('\n\x1b[1m\x1b[32m✨ ALL PHASE 12 NEXT-GEN AGENT ECOSYSTEM TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
} finally {
  cleanupTestDir();
}
