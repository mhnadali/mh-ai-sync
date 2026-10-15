const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  addRemote,
  removeRemote,
  listRemotes,
  fetchRemoteContent,
  parseRemoteStandards,
  pullRemote,
  checkCompliance,
  formatRemoteList,
  formatComplianceReport
} = require('./src/remote');

console.log('\x1b[1m\x1b[36m=== Testing Phase 11: Team & Remote Standards Registry ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_test_phase11');

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

(async () => {
  try {
    setupTestDir();

    // Test 1: addRemote, listRemotes, and validation
    console.log('Test 1: Adding and listing remote standards registries');
    const projectDir = path.join(testDir, 'proj1');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'mhai.config.json'), JSON.stringify({
      project: { name: 'Local App' },
      guidelines: { agentRules: ['Local custom rule 1'], codeStyle: [], gitPractices: [] }
    }, null, 2));

    const addRes = addRemote('org-core', 'https://github.com/acme/ai-standards.git', {
      locked: true,
      branch: 'prod'
    }, projectDir);

    assert.strictEqual(addRes.success, true);
    assert.strictEqual(addRes.remote.name, 'org-core');
    assert.strictEqual(addRes.remote.locked, true);
    assert.strictEqual(addRes.remote.branch, 'prod');

    const remotes = listRemotes(projectDir);
    assert.strictEqual(remotes.length, 1);
    assert.strictEqual(remotes[0].name, 'org-core');
    assert.strictEqual(remotes[0].locked, true);

    const formattedList = formatRemoteList(remotes);
    assert.ok(formattedList.includes('org-core'));
    assert.ok(formattedList.includes('[LOCKED]'));
    console.log('✔ Test 1 Passed: Remote successfully added, validated, and listed.');

    // Test 2: removeRemote
    console.log('\nTest 2: Removing remote standards registry');
    addRemote('temp-remote', 'https://example.com/rules.json', {}, projectDir);
    assert.strictEqual(listRemotes(projectDir).length, 2);

    const removeRes = removeRemote('temp-remote', projectDir);
    assert.strictEqual(removeRes.success, true);
    assert.strictEqual(listRemotes(projectDir).length, 1);
    console.log('✔ Test 2 Passed: Remote registry removed cleanly.');

    // Test 3: parseRemoteStandards (JSON and Markdown)
    console.log('\nTest 3: Parsing remote standards from JSON and Markdown');
    const jsonStandards = JSON.stringify({
      project: { name: 'Acme Standards' },
      guidelines: {
        agentRules: ['Never commit AWS keys', 'Always write tests'],
        codeStyle: ['Use 2 spaces']
      },
      lockedGuidelines: ['Never commit AWS keys'],
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] }
      }
    });

    const parsedJson = parseRemoteStandards(jsonStandards);
    assert.strictEqual(parsedJson.guidelines.agentRules.length, 2);
    assert.strictEqual(parsedJson.lockedGuidelines.length, 1);
    assert.ok(parsedJson.mcpServers.github);

    const mdStandards = `# Team Security Policy
## Development Rules
### Agent Constraints
- Always use multi-factor authentication.
- Never disable automated linting in CI.
`;
    const parsedMd = parseRemoteStandards(mdStandards);
    assert.strictEqual(parsedMd.guidelines.agentRules.length, 2);
    assert.ok(parsedMd.guidelines.agentRules.includes('Always use multi-factor authentication.'));
    console.log('✔ Test 3 Passed: Both JSON and Markdown remote standards parsed accurately.');

    // Test 4: pullRemote from local directory/file source with rule merge & policy locking
    console.log('\nTest 4: pullRemote from filesystem path with policy locking');
    const sharedStandardsDir = path.join(testDir, 'shared-standards');
    fs.mkdirSync(sharedStandardsDir, { recursive: true });
    fs.writeFileSync(path.join(sharedStandardsDir, 'mhai.config.json'), jsonStandards);

    addRemote('corp-standards', sharedStandardsDir, { locked: true }, projectDir);

    const pullRes = await pullRemote('corp-standards', {}, projectDir);
    assert.strictEqual(pullRes.success, true);
    assert.ok(pullRes.changesCount > 0);

    const updatedConfig = JSON.parse(fs.readFileSync(path.join(projectDir, 'mhai.config.json'), 'utf8'));
    // Local rule must be preserved
    assert.ok(updatedConfig.guidelines.agentRules.includes('Local custom rule 1'));
    // Remote rules must be added
    assert.ok(updatedConfig.guidelines.agentRules.includes('Never commit AWS keys'));
    assert.ok(updatedConfig.guidelines.agentRules.includes('Always write tests'));
    assert.ok(updatedConfig.guidelines.codeStyle.includes('Use 2 spaces'));
    // Policy locking: lockedGuidelines must contain remote locked rules
    assert.ok(updatedConfig.lockedGuidelines.includes('Never commit AWS keys'));
    // Remote MCP server must be inherited
    assert.ok(updatedConfig.mcpServers.github);
    console.log('✔ Test 4 Passed: Remote standards pulled, merged without clobbering, and locked rules recorded.');

    // Test 5: checkCompliance against mandatory standards
    console.log('\nTest 5: Compliance audit against remote mandatory policies');
    const compBefore = await checkCompliance('corp-standards', projectDir);
    assert.strictEqual(compBefore.isCompliant, true);
    assert.strictEqual(compBefore.missingCount, 0);

    // Tamper with local config: remove a locked mandatory rule
    updatedConfig.guidelines.agentRules = updatedConfig.guidelines.agentRules.filter(r => !r.includes('Never commit AWS keys'));
    fs.writeFileSync(path.join(projectDir, 'mhai.config.json'), JSON.stringify(updatedConfig, null, 2));

    const compAfter = await checkCompliance('corp-standards', projectDir);
    assert.strictEqual(compAfter.isCompliant, false);
    assert.strictEqual(compAfter.missingCount, 1);
    assert.ok(compAfter.missingRules.some(r => r.includes('Never commit AWS keys')));

    const compReport = formatComplianceReport(compAfter);
    assert.ok(compReport.includes('Non-Compliant'));
    console.log('✔ Test 5 Passed: Compliance audit successfully catches missing mandatory rules.');

    // Test 6: Network HTTP Fetch & Pull via Mock HTTP Server
    console.log('\nTest 6: pullRemote over HTTP protocol with mock server');
    const httpPort = 3987;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        project: { name: 'Cloud Registry Standards' },
        guidelines: {
          agentRules: ['Cloud policy: All microservices must export Prometheus metrics.']
        },
        lockedGuidelines: ['Cloud policy: All microservices must export Prometheus metrics.']
      }));
    });

    await new Promise((resolve) => server.listen(httpPort, resolve));

    try {
      addRemote('cloud-http', `http://127.0.0.1:${httpPort}/standards.json`, { locked: true }, projectDir);
      const httpPullRes = await pullRemote('cloud-http', {}, projectDir);
      assert.strictEqual(httpPullRes.success, true);

      const finalConfig = JSON.parse(fs.readFileSync(path.join(projectDir, 'mhai.config.json'), 'utf8'));
      assert.ok(finalConfig.guidelines.agentRules.some(r => r.includes('Prometheus metrics')));
      assert.ok(finalConfig.lockedGuidelines.some(r => r.includes('Prometheus metrics')));
      console.log('✔ Test 6 Passed: HTTP remote standards registry fetched, parsed, and merged over network.');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    // Test 7: CLI Integration (remote list, check, and pull)
    console.log('\nTest 7: CLI subcommands integration (`mhai remote` & `mhai pull`)');
    const binPath = path.join(__dirname, 'bin', 'index.js');
    const cliListOut = execSync(`node "${binPath}" remote list`, { cwd: projectDir, encoding: 'utf8' });
    assert.ok(cliListOut.includes('corp-standards'));
    assert.ok(cliListOut.includes('cloud-http'));

    const cliPullOut = execSync(`node "${binPath}" pull corp-standards`, { cwd: projectDir, encoding: 'utf8' });
    assert.ok(cliPullOut.includes('Successfully synchronized'));

    console.log('✔ Test 7 Passed: CLI `mhai remote` and `mhai pull` executed with zero errors.');

    console.log('\n\x1b[1m\x1b[32m✨ ALL PHASE 11 TEAM & REMOTE REGISTRY TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  } finally {
    cleanupTestDir();
  }
})();
