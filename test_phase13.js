const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  detectConflicts,
  compressRule,
  compressGuidelines,
  optimizeContext,
  formatConflictsReport,
  formatOptimizationReport
} = require('./src/optimizer');

console.log('\x1b[1m\x1b[36m=== Testing Phase 13: AI Context Optimizer & Semantic Conflict Resolver ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_test_phase13');

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

  // Test 1: compressRule removes polite preambles and conversational padding
  console.log('Test 1: compressRule prunes conversational bloat & maintains imperative form');
  const bloatedRules = [
    {
      input: 'Please make sure to always use conventional commits (feat:, fix:, chore:).',
      expected: 'Use conventional commits (feat:, fix:, chore:).'
    },
    {
      input: 'It is strictly mandatory that you preserve existing comments and docstrings.',
      expected: 'Preserve existing comments and docstrings.'
    },
    {
      input: 'As an AI assistant, please ensure that you never push directly to main.',
      expected: 'Never push directly to main.'
    },
    {
      input: 'Whenever you are writing code, remember to write unit tests for every function.',
      expected: 'Write unit tests for every function.'
    }
  ];

  for (const item of bloatedRules) {
    const compressed = compressRule(item.input);
    assert.strictEqual(compressed, item.expected, `Expected "${item.expected}", got "${compressed}"`);
  }
  console.log('✔ Test 1 Passed: Bloat preambles cleanly stripped, preserving imperative meaning.');

  // Test 2: detectConflicts identifies contradictory rule pairs
  console.log('\nTest 2: detectConflicts identifies semantic contradictions across guidelines');
  const conflictingConfig = {
    project: { name: 'Conflict Project' },
    guidelines: {
      codeStyle: [
        'Strict mode enabled and no implicit any.',
        'Use tabs for all indentation.'
      ],
      gitPractices: [
        'Never push directly to main; pull requests only.',
        'Commit directly to main for fast patches.' // Conflict!
      ],
      agentRules: [
        'Allow implicit any in loose modules.', // Conflict with codeStyle!
        'Indent with 2 spaces in all files.' // Conflict with codeStyle!
      ]
    }
  };

  const conflictsReport = detectConflicts(conflictingConfig);
  assert.strictEqual(conflictsReport.hasConflicts, true);
  assert.ok(conflictsReport.totalConflicts >= 3);

  const domains = conflictsReport.conflicts.map(c => c.domain);
  assert.ok(domains.includes('TypeScript Strictness'), 'Must detect TypeScript strictness contradiction');
  assert.ok(domains.includes('Indentation & Style'), 'Must detect Indentation contradiction');
  assert.ok(domains.includes('Git Branch Direct Push'), 'Must detect Git push contradiction');

  const formattedConflicts = formatConflictsReport(conflictsReport);
  assert.ok(formattedConflicts.includes('[CRITICAL]'));
  assert.ok(formattedConflicts.includes('Resolution:'));
  console.log('✔ Test 2 Passed: Semantic contradictions detected across different guideline categories.');

  // Test 3: detectConflicts on coherent guidelines
  console.log('\nTest 3: detectConflicts reports clean status on non-contradictory guidelines');
  const coherentConfig = {
    project: { name: 'Clean Project' },
    guidelines: {
      codeStyle: ['Follow Clean Code and DRY principles.', 'Strict mode enabled across all TypeScript files.'],
      gitPractices: ['Use conventional commits (feat:, fix:).', 'Never push directly to main.'],
      agentRules: ['Preserve existing comments and docstrings.']
    }
  };
  const cleanReport = detectConflicts(coherentConfig);
  assert.strictEqual(cleanReport.hasConflicts, false);
  assert.strictEqual(cleanReport.totalConflicts, 0);
  console.log('✔ Test 3 Passed: Coherent rules produce zero conflict false positives.');

  // Test 4: compressGuidelines & optimizeContext token reduction calculation
  console.log('\nTest 4: optimizeContext measures token reduction and pruning statistics');
  const verboseConfig = {
    project: { name: 'Verbose App', overview: 'A large app.' },
    commands: { test: 'npm test' },
    guidelines: {
      codeStyle: [
        'Please make sure to write clean, modular, and self-documenting code with descriptive naming.',
        'It is strictly recommended that you follow Clean Code and DRY principles at all times.'
      ],
      gitPractices: [
        'Whenever creating commits, you should always use conventional commits like feat:, fix:, chore:.',
        'Always try to make sure that you never push broken builds or failing tests.'
      ],
      agentRules: [
        'As an AI coding agent, please ensure that you preserve existing comments and docstrings.',
        'You must always write type-safe and self-documenting code with descriptive naming.' // duplicate concept
      ]
    }
  };

  const optimization = optimizeContext(verboseConfig);
  assert.ok(optimization.stats.originalTokens > optimization.stats.optimizedTokens, 'Optimized tokens must be fewer');
  assert.ok(optimization.stats.savedTokens > 0, 'Saved tokens must be positive');
  assert.ok(optimization.stats.reductionPercent > 10, 'Reduction should be significant (> 10%)');

  const formattedReport = formatOptimizationReport(optimization);
  assert.ok(formattedReport.includes('Tokens Saved:'));
  assert.ok(formattedReport.includes('Reasoning Space:'));
  console.log(`✔ Test 4 Passed: Optimization achieved ${optimization.stats.reductionPercent}% token reduction (${optimization.stats.savedTokens} tokens saved).`);

  // Test 5: Sandbox CLI execution (`mhai optimize --apply` and `mhai conflicts`)
  console.log('\nTest 5: CLI execution of `mhai optimize --apply` and `mhai conflicts` in sandbox');
  const sandboxDir = path.join(testDir, 'sandbox');
  fs.mkdirSync(sandboxDir, { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'mhai.config.json'), JSON.stringify(verboseConfig, null, 2), 'utf8');

  const binPath = path.join(__dirname, 'bin', 'index.js');

  // Run dry optimize
  const dryOptOut = execSync(`node "${binPath}" optimize`, { cwd: sandboxDir, encoding: 'utf8' });
  assert.ok(dryOptOut.includes('Token Efficiency:'));
  assert.ok(dryOptOut.includes('--apply'));

  // Run apply optimize
  const applyOptOut = execSync(`node "${binPath}" optimize --apply`, { cwd: sandboxDir, encoding: 'utf8' });
  assert.ok(applyOptOut.includes('Applied compressed guidelines to mhai.config.json'));
  assert.ok(applyOptOut.includes('Synchronized -> CLAUDE.md'));
  assert.ok(applyOptOut.includes('.clinerules'));

  // Check mhai.config.json on disk was actually compressed
  const onDiskConfig = JSON.parse(fs.readFileSync(path.join(sandboxDir, 'mhai.config.json'), 'utf8'));
  assert.ok(!onDiskConfig.guidelines.codeStyle.some(r => r.startsWith('Please make sure to')));
  assert.ok(!onDiskConfig.guidelines.agentRules.some(r => r.startsWith('As an AI coding agent')));

  // Test conflicts CLI command
  fs.writeFileSync(path.join(sandboxDir, 'mhai.config.json'), JSON.stringify(conflictingConfig, null, 2), 'utf8');
  let conflictExitedWithError = false;
  try {
    execSync(`node "${binPath}" conflicts --strict`, { cwd: sandboxDir, stdio: 'pipe' });
  } catch (err) {
    conflictExitedWithError = true;
    assert.strictEqual(err.status, 1, 'Conflicts with --strict must exit with code 1');
  }
  assert.strictEqual(conflictExitedWithError, true);
  console.log('✔ Test 5 Passed: CLI `optimize --apply` and `conflicts --strict` executed with expected exit codes.');

  console.log('\n\x1b[1m\x1b[32m✨ ALL PHASE 13 OPTIMIZER & CONFLICT RESOLVER TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
} finally {
  cleanupTestDir();
}
