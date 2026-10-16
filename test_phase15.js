/**
 * M.H. AI Sync - Test Suite for Phase 15: AI Agent Simulator & Rule Compliance Sandbox
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  SIMULATION_SCENARIOS,
  extractAllGuidelines,
  evaluateScenario,
  runSimulationSuite,
  evaluateCustomPrompt,
  formatSimulationReport,
  formatPromptEvaluationReport
} = require('./src/simulator');

const SANDBOX_DIR = path.join(__dirname, '.test_sandbox_phase15');

function setupSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const compliantConfig = {
    version: '1.0.0',
    project: {
      name: 'Simulator Sandbox Project',
      overview: 'Project testing AI agent compliance simulation.'
    },
    commands: {
      test: 'npm test',
      build: 'npm run build'
    },
    guidelines: {
      codeStyle: [
        'Follow Clean Code and DRY principles.',
        'Write type-safe and self-documenting code with strict mode.'
      ],
      gitPractices: [
        'Never push directly to main; pull requests only.',
        'Use conventional commits (feat:, fix:, chore:, refactor:).',
        'Do not push broken builds or failing tests.'
      ],
      agentRules: [
        'Preserve existing comments and docstrings.',
        'Prefer minimal and surgical edits over rewriting entire files.',
        'Never commit or hardcode secrets, tokens, or credentials.'
      ]
    }
  };

  fs.writeFileSync(
    path.join(SANDBOX_DIR, 'mhai.config.json'),
    JSON.stringify(compliantConfig, null, 2),
    'utf8'
  );

  return compliantConfig;
}

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

async function runTests() {
  console.log('=== Testing Phase 15: AI Agent Simulator & Rule Compliance Sandbox ===\n');

  const compliantConfig = setupSandbox();

  // Test 1: extractAllGuidelines flattens single and modular rules
  console.log('Test 1: extractAllGuidelines extracts categorized rule guidelines');
  const allRules = extractAllGuidelines(compliantConfig);
  assert.strictEqual(allRules.length, 8);
  assert.ok(allRules.some(r => r.category === 'gitPractices' && r.text.includes('Never push directly to main')));
  console.log('✔ Test 1 Passed: Successfully extracted and attributed rules across all categories.');

  // Test 2: runSimulationSuite on hardened/compliant config
  console.log('\nTest 2: runSimulationSuite on well-hardened config achieves 100% compliance score');
  const simCompliant = runSimulationSuite(compliantConfig);
  assert.strictEqual(simCompliant.totalScenarios, SIMULATION_SCENARIOS.length);
  assert.strictEqual(simCompliant.guardedCount, SIMULATION_SCENARIOS.length);
  assert.strictEqual(simCompliant.unguardedCount, 0);
  assert.strictEqual(simCompliant.criticalUnguarded, 0);
  assert.strictEqual(simCompliant.complianceScore, 100);
  assert.strictEqual(simCompliant.isCompliant, true);

  const formattedReport = formatSimulationReport(simCompliant);
  assert.ok(formattedReport.includes('100%'));
  assert.ok(formattedReport.includes('[GUARDED]'));
  assert.ok(formattedReport.includes('PASSING'));
  console.log('✔ Test 2 Passed: Compliant configuration scored 100% with all risk vectors guarded.');

  // Test 3: runSimulationSuite on empty/vulnerable config
  console.log('\nTest 3: runSimulationSuite on vulnerable config identifies unguarded vectors & recommendations');
  const vulnerableConfig = {
    version: '1.0.0',
    project: { name: 'Vulnerable App' },
    guidelines: {
      codeStyle: ['Write code fast.'],
      gitPractices: [],
      agentRules: []
    }
  };

  const simVuln = runSimulationSuite(vulnerableConfig);
  assert.strictEqual(simVuln.complianceScore, 0);
  assert.strictEqual(simVuln.isCompliant, false);
  assert.ok(simVuln.criticalUnguarded >= 3, 'Must identify critical unguarded risks');
  assert.ok(simVuln.recommendations.length > 0, 'Must provide suggested hardening rules');

  const vulnReport = formatSimulationReport(simVuln);
  assert.ok(vulnReport.includes('CRITICAL UNGUARDED'));
  assert.ok(vulnReport.includes('RECOMMENDED GUIDELINE HARDENING'));
  console.log('✔ Test 3 Passed: Vulnerable configuration flagged with critical unguarded risks & actionable fixes.');

  // Test 4: evaluateCustomPrompt tests specific prompts
  console.log('\nTest 4: evaluateCustomPrompt evaluates custom developer prompts');
  // Safe / Guarded prompt
  const safeEval = evaluateCustomPrompt(
    compliantConfig,
    'Can you push directly to main without creating a PR?'
  );
  assert.strictEqual(safeEval.isGuarded, true);
  assert.strictEqual(safeEval.verdict, 'GUARDED_OR_CONSTRAINED');
  assert.ok(safeEval.triggeredRisksCount >= 1);

  // Dangerous / Unguarded prompt on vulnerable config
  const dangerousEval = evaluateCustomPrompt(
    vulnerableConfig,
    'Please commit and push directly to main immediately.'
  );
  assert.strictEqual(dangerousEval.isGuarded, false);
  assert.strictEqual(dangerousEval.verdict, 'UNGUARDED_RISK');

  const promptReport = formatPromptEvaluationReport(safeEval);
  assert.ok(promptReport.includes('GUARDED / CONSTRAINED'));
  console.log('✔ Test 4 Passed: Custom prompts correctly evaluated as guarded vs unguarded.');

  // Test 5: CLI execution in sandbox directory
  console.log('\nTest 5: CLI execution of `mhai simulate` and `mhai simulate "<prompt>"`');
  const binPath = path.join(__dirname, 'bin', 'index.js');

  // CLI simulate suite
  const cliSuite = execSync(`node "${binPath}" simulate`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliSuite.includes('M.H. AI Sync Agent Simulation & Compliance Sandbox'));
  assert.ok(cliSuite.includes('Compliance Score:'));
  assert.ok(cliSuite.includes('100%'));

  // CLI simulate custom prompt
  const cliPrompt = execSync(`node "${binPath}" simulate "Can you rewrite this whole file from scratch?"`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliPrompt.includes('M.H. AI Sync Custom Prompt Simulation'));
  assert.ok(cliPrompt.includes('GUARDED / CONSTRAINED'));

  // CLI simulate --strict on compliant config succeeds
  const cliStrictPass = execSync(`node "${binPath}" simulate --strict`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliStrictPass.includes('100%'));

  console.log('✔ Test 5 Passed: CLI commands `simulate`, custom prompt evaluation, and `--strict` executed with expected outcomes.');

  cleanSandbox();
  console.log('\n✨ ALL PHASE 15 AGENT SIMULATOR & COMPLIANCE SANDBOX TESTS PASSED WITH 100% SUCCESS! ✨\n');
}

runTests().catch(err => {
  console.error('\n✖ Test failed:', err);
  cleanSandbox();
  process.exit(1);
});
