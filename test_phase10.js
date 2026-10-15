const fs = require('fs');
const path = require('path');
const assert = require('assert');
const http = require('http');
const { execSync } = require('child_process');

const {
  getDashboardState,
  renderBar,
  renderTuiDashboard,
  getWebDashboardHtml,
  createDashboardServer
} = require('./src/dashboard');

console.log('\x1b[1m\x1b[36m=== Testing Phase 10: Interactive TUI & Web GUI Dashboard ===\x1b[0m\n');

const testDir = path.join(__dirname, 'temp_test_phase10');

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

function makeRequest(port, pathname, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  try {
    setupTestDir();

    // Setup sample config
    fs.writeFileSync(path.join(testDir, 'mhai.config.json'), JSON.stringify({
      version: '1.0.0',
      project: {
        name: 'Dashboard Test Project',
        overview: 'Testing TUI & Web GUI Mission Control',
        techStack: ['Node.js', 'Express', 'React']
      },
      commands: { test: 'npm test' },
      guidelines: {
        codeStyle: ['Clean code'],
        gitPractices: ['Conventional commits'],
        agentRules: ['Never break contracts']
      },
      modularRules: [],
      skills: []
    }, null, 2));

    // Test 1: getDashboardState on freshly initialized workspace
    console.log('Test 1: getDashboardState structure and integrity');
    const state = getDashboardState(testDir);
    assert.strictEqual(state.project.name, 'Dashboard Test Project');
    assert.ok(Array.isArray(state.status.targets), 'Should have targets array');
    assert.strictEqual(typeof state.audit.isSecure, 'boolean');
    assert.strictEqual(typeof state.analysis.healthScore, 'number');
    assert.strictEqual(typeof state.mcp.count, 'number');
    assert.strictEqual(typeof state.workspaces.count, 'number');
    console.log('✔ Test 1 Passed: Dashboard state correctly aggregates all subsystem telemetry.');

    // Test 2: renderBar helper
    console.log('\nTest 2: renderBar progress meter rendering');
    const barHigh = renderBar(95, 100, 20);
    assert.ok(barHigh.includes('95/100'), 'Should format score');
    const barLow = renderBar(40, 100, 20);
    assert.ok(barLow.includes('40/100'), 'Should format score');
    console.log('✔ Test 2 Passed: Visual meter bar renders accurately.');

    // Test 3: renderTuiDashboard
    console.log('\nTest 3: renderTuiDashboard output formatting');
    const tuiOutput = renderTuiDashboard(state);
    assert.ok(tuiOutput.includes('Mission Control & TUI Dashboard'), 'Should have title header');
    assert.ok(tuiOutput.includes('Dashboard Test Project'), 'Should show project name');
    assert.ok(tuiOutput.includes('Health Score:'), 'Should show health score');
    assert.ok(tuiOutput.includes('Shortcuts:'), 'Should display shortcut legend');
    console.log('✔ Test 3 Passed: TUI terminal layout renders cleanly.');

    // Test 4: Web Dashboard Server & REST API Endpoints
    console.log('\nTest 4: createDashboardServer REST APIs');
    const testPort = 3848;
    const server = createDashboardServer(testDir, testPort);

    await new Promise((resolve) => server.listen(testPort, '127.0.0.1', resolve));

    try {
      // 4.1 GET / (HTML)
      const htmlRes = await makeRequest(testPort, '/');
      assert.strictEqual(htmlRes.statusCode, 200);
      assert.ok(htmlRes.headers['content-type'].includes('text/html'));
      assert.ok(htmlRes.data.includes('M.H. AI Sync'));

      // 4.2 GET /api/status (JSON)
      const statusRes = await makeRequest(testPort, '/api/status');
      assert.strictEqual(statusRes.statusCode, 200);
      const statusJson = JSON.parse(statusRes.data);
      assert.strictEqual(statusJson.project.name, 'Dashboard Test Project');

      // 4.3 POST /api/task (Set active task)
      const setTaskRes = await makeRequest(testPort, '/api/task', 'POST', JSON.stringify({
        action: 'set',
        task: 'Implement Mission Control Dashboard',
        note: 'Web API connected'
      }));
      assert.strictEqual(setTaskRes.statusCode, 200);

      // Verify task updated via status API
      const updatedStatusRes = await makeRequest(testPort, '/api/status');
      const updatedStatusJson = JSON.parse(updatedStatusRes.data);
      assert.strictEqual(updatedStatusJson.task.activeTask, 'Implement Mission Control Dashboard');

      // 4.4 POST /api/audit
      const auditRes = await makeRequest(testPort, '/api/audit', 'POST');
      assert.strictEqual(auditRes.statusCode, 200);
      const auditJson = JSON.parse(auditRes.data);
      assert.strictEqual(typeof auditJson.isSecure, 'boolean');

      // 4.5 POST /api/task (Clear active task)
      const clearTaskRes = await makeRequest(testPort, '/api/task', 'POST', JSON.stringify({
        action: 'clear'
      }));
      assert.strictEqual(clearTaskRes.statusCode, 200);

      const clearedStatusRes = await makeRequest(testPort, '/api/status');
      const clearedStatusJson = JSON.parse(clearedStatusRes.data);
      assert.strictEqual(clearedStatusJson.task.activeTask, null);

      console.log('✔ Test 4 Passed: Web Dashboard HTTP Server and REST APIs verified.');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }

    // Test 5: CLI Integration (dashboard --snapshot, ui --snapshot, help)
    console.log('\nTest 5: CLI Dashboard snapshot and help integration');
    const cliPath = path.join(__dirname, 'bin', 'index.js');

    const snapOut = execSync(`node "${cliPath}" dashboard --snapshot`, { encoding: 'utf8' });
    assert.ok(snapOut.includes('Mission Control & TUI Dashboard'), 'CLI dashboard should print header');
    assert.ok(snapOut.includes('Health Score:'), 'CLI dashboard should print health meter');

    const uiSnapOut = execSync(`node "${cliPath}" ui --snapshot`, { encoding: 'utf8' });
    assert.ok(uiSnapOut.includes('Mission Control & TUI Dashboard'), 'CLI ui alias should work');

    const helpOut = execSync(`node "${cliPath}" help`, { encoding: 'utf8' });
    assert.ok(helpOut.includes('dashboard'), 'Help should document dashboard');
    assert.ok(helpOut.includes('--web'), 'Help should document --web flag');
    console.log('✔ Test 5 Passed: CLI commands pass cleanly in non-interactive snapshot mode.');

    console.log('\n\x1b[1m\x1b[32m✨ ALL PHASE 10 DASHBOARD & MISSION CONTROL TESTS PASSED WITH 100% SUCCESS! ✨\x1b[0m\n');
  } finally {
    cleanupTestDir();
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
