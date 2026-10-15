const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { installHook, uninstallHook, isHookInstalled } = require('./src/hooks');
const { estimateTokens, findDuplicateRules, analyzePromptBudget } = require('./src/analyzer');
const { DEFAULT_CANONICAL_SCHEMA } = require('./src/schema');

console.log('🧪 Starting Phase 5 Comprehensive Test Suite...\n');

const SANDBOX_DIR = path.join(__dirname, 'test_phase5_sandbox');

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

cleanSandbox();
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// Test 1: Native Git Hooks Lifecycle
console.log('🔹 Test 1: Native Git Hooks Lifecycle...');
const gitDir = path.join(SANDBOX_DIR, '.git');
fs.mkdirSync(gitDir, { recursive: true });

// Stage 1.a: Check not installed
assert.strictEqual(isHookInstalled(SANDBOX_DIR), false);

// Stage 1.b: Install Hook
const hookRes = installHook(SANDBOX_DIR);
assert.strictEqual(hookRes.success, true);
assert.ok(fs.existsSync(hookRes.hookPath), 'Hook file must exist on disk');
assert.strictEqual(isHookInstalled(SANDBOX_DIR), true);

const hookContent = fs.readFileSync(hookRes.hookPath, 'utf8');
assert.ok(hookContent.includes('node bin/index.js audit --strict'), 'Hook must run security audit');
assert.ok(hookContent.includes('node bin/index.js status --check'), 'Hook must run status drift check');

// Stage 1.c: Uninstall Hook
const uninsRes = uninstallHook(SANDBOX_DIR);
assert.strictEqual(uninsRes.success, true);
assert.strictEqual(uninsRes.removed, true);
assert.strictEqual(isHookInstalled(SANDBOX_DIR), false);
console.log('   ✔ Passed: Git pre-commit hook installation, content verification, and teardown.');

// Test 2: Token Budget Estimator
console.log('\n🔹 Test 2: Token Budget Estimator Accuracy...');
const shortText = "Follow clean code and write tests.";
const tokensShort = estimateTokens(shortText);
assert.ok(tokensShort >= 6 && tokensShort <= 12, 'Short phrase should estimate ~6-12 tokens');

const longMarkdown = `# Section\n` + `Here is a descriptive rule about database migration and schema handling.\n`.repeat(50);
const tokensLong = estimateTokens(longMarkdown);
assert.ok(tokensLong > 400 && tokensLong < 1200, 'Repeated markdown should estimate proportionally');
console.log('   ✔ Passed: Token estimation algorithm yields realistic token counts.');

// Test 3: Duplicate Rule Detection
console.log('\n🔹 Test 3: Duplicate Rule Detection...');
const duplicateConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));
duplicateConfig.guidelines.codeStyle.push('Write type-safe and self-documenting code with descriptive naming.'); // Duplicate in codeStyle
duplicateConfig.guidelines.agentRules.push('Follow Clean Code and DRY principles.'); // Duplicate across categories

const dupes = findDuplicateRules(duplicateConfig);
assert.strictEqual(dupes.length, 2, 'Must detect both duplicate rules');
console.log('   ✔ Passed: Duplicate and redundant rules detected across guideline categories.');

// Test 4: Prompt Health Score Calculation
console.log('\n🔹 Test 4: Prompt Health Score Calculation...');
const cleanAnalysis = analyzePromptBudget(DEFAULT_CANONICAL_SCHEMA);
assert.ok(cleanAnalysis.healthScore >= 80, 'Default schema should have a high health score');
assert.strictEqual(cleanAnalysis.duplicates.length, 0);

const bloatedConfig = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));
// Inject massive prompt bloat
bloatedConfig.project.overview = "A very long detailed overview.\n".repeat(400);
const bloatedAnalysis = analyzePromptBudget(bloatedConfig);
assert.ok(bloatedAnalysis.healthScore < cleanAnalysis.healthScore, 'Bloated config must receive lower health score');
assert.ok(bloatedAnalysis.recommendations.some(r => r.includes('Dilution') || r.includes('Context Size')));
console.log('   ✔ Passed: Health score reflects token size, dilution risk, and redundancies.');

// Test 5: CLI Execution of Analyze and Hook Commands
console.log('\n🔹 Test 5: CLI `analyze` and `hook` commands execution...');
const cliPath = path.join(__dirname, 'bin', 'index.js');

// Run analyze command in sandbox
const analyzeOutput = execSync(`node "${cliPath}" analyze`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(analyzeOutput.includes('Prompt Health Score'), 'CLI analyze output must include score');
assert.ok(analyzeOutput.includes('Target Breakdown'), 'CLI analyze output must include breakdown');

// Run hook install in sandbox
const hookOutput = execSync(`node "${cliPath}" hook install`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(hookOutput.includes('Installed native Git pre-commit hook'));
assert.strictEqual(isHookInstalled(SANDBOX_DIR), true);

// Run hook status
const hookStatusOutput = execSync(`node "${cliPath}" hook`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(hookStatusOutput.includes('Active (Installed)'));

// Run hook uninstall
const hookUninsOutput = execSync(`node "${cliPath}" hook uninstall`, { cwd: SANDBOX_DIR, encoding: 'utf8' });
assert.ok(hookUninsOutput.includes('Removed M.H. AI Sync pre-commit hook'));
console.log('   ✔ Passed: CLI `analyze` and `hook` commands executed successfully.');

// Cleanup
cleanSandbox();
console.log('\n✨ All Phase 5 Tests Passed with 100% Success!\n');
