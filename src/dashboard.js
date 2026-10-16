/**
 * M.H. AI Sync - Interactive Terminal TUI & Web GUI Dashboard
 * Provides real-time visual inspection of multi-agent synchronization,
 * security health, token budgets, active tasks, MCP tools, and monorepos.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

const { sanitize } = require('./generators');
const { checkStatus } = require('./status');
const { auditConfig } = require('./security');
const { analyzePromptBudget } = require('./analyzer');
const { loadTaskState, setActiveTask, addTaskNote, clearActiveTask } = require('./task');
const { listConfiguredServers } = require('./mcpHub');
const { discoverWorkspaces, checkWorkspacesStatus } = require('./monorepo');
const { listRemotes } = require('./remote');
const { detectConflicts } = require('./optimizer');
const { createSnapshot, listSnapshots, rollbackSnapshot } = require('./snapshots');

/**
 * Aggregates all project state for both TUI and Web dashboards.
 */
function getDashboardState(rootDir = process.cwd()) {
  const configPath = path.join(rootDir, 'mhai.config.json');
  let rawConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }
  const config = sanitize(rawConfig);

  const status = checkStatus(config, rootDir);
  const audit = auditConfig(config, rootDir);
  const analysis = analyzePromptBudget(config);
  const task = loadTaskState(rootDir);
  const mcpServers = listConfiguredServers(config);
  const workspaces = discoverWorkspaces(rootDir);
  const workspacesStatus = workspaces.length > 0 ? checkWorkspacesStatus(config, rootDir) : null;
  const remotesList = listRemotes(rootDir);
  const conflicts = detectConflicts(config);
  const snapshotsList = listSnapshots(rootDir);

  return {
    timestamp: new Date().toISOString(),
    project: config.project,
    status: {
      isClean: status.isClean,
      hasDrift: status.hasDrift,
      hasMissing: status.hasMissing,
      targets: status.results
    },
    audit: {
      isSecure: audit.isSecure,
      totalIssues: audit.totalIssues,
      findings: audit.findings
    },
    analysis: {
      healthScore: analysis.healthScore,
      rating: analysis.healthScore >= 80 ? 'OPTIMAL' : (analysis.healthScore >= 60 ? 'ACCEPTABLE' : 'DEGRADED'),
      totalTokens: analysis.totalTokens,
      agentEstimates: {
        claudeCode: (analysis.fileStats || []).find(f => f.name === 'CLAUDE.md')?.tokens || 0,
        cursor: (analysis.fileStats || []).find(f => f.name === '.cursorrules')?.tokens || 0
      },
      duplicatesCount: (analysis.duplicates || []).length,
      recommendations: analysis.recommendations || []
    },
    conflicts: {
      hasConflicts: conflicts.hasConflicts,
      totalConflicts: conflicts.totalConflicts,
      list: conflicts.conflicts
    },
    snapshots: {
      count: snapshotsList.length,
      latest: snapshotsList[0] || null,
      list: snapshotsList.slice(0, 10).map(s => ({
        id: s.id,
        tag: s.tag,
        timestamp: s.timestamp,
        message: s.message,
        rules: s.metrics?.totalRules || 0,
        tokens: s.metrics?.estimatedTokens || 0
      }))
    },
    task: {
      activeTask: task.activeTask,
      status: task.status,
      updatedAt: task.updatedAt,
      updatedBy: task.updatedBy,
      notes: task.recentNotes
    },
    mcp: {
      count: mcpServers.length,
      servers: mcpServers
    },
    workspaces: {
      count: workspaces.length,
      list: workspaces.map(w => ({ name: w.name, path: w.relativePath, stack: w.techStack })),
      isAllClean: workspacesStatus ? workspacesStatus.isAllClean : true
    },
    remotes: {
      count: remotesList.length,
      list: remotesList
    }
  };
}

/**
 * Generates an ANSI text-based progress/meter bar
 */
function renderBar(score, max = 100, width = 20) {
  const ratio = Math.max(0, Math.min(1, score / max));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  let color = '\x1b[32m'; // green
  if (score < 60) color = '\x1b[31m'; // red
  else if (score < 80) color = '\x1b[33m'; // yellow

  return `${color}${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m ${score}/${max}`;
}

/**
 * Formats a terminal-friendly TUI dashboard view.
 */
function renderTuiDashboard(state) {
  const lines = [];
  const W = 72;
  const hr = '─'.repeat(W);
  const dhr = '═'.repeat(W);

  lines.push(`\x1b[1m\x1b[36m╔${dhr}╗\x1b[0m`);
  lines.push(`\x1b[1m\x1b[36m║  ⚡ M.H. AI Sync - Multi-Agent Mission Control & TUI Dashboard     ║\x1b[0m`);
  lines.push(`\x1b[1m\x1b[36m╚${dhr}╝\x1b[0m\n`);

  // Section 1: Project & Active Task Banner
  lines.push(`\x1b[1mProject:\x1b[0m  \x1b[32m${state.project.name}\x1b[0m  |  \x1b[90mStack: ${(state.project.techStack || []).join(', ') || 'Auto-detected'}\x1b[0m`);
  if (state.task.activeTask && state.task.status !== 'idle') {
    lines.push(`\x1b[1mTask:\x1b[0m     \x1b[33m● [${state.task.status.toUpperCase()}]\x1b[0m \x1b[1m${state.task.activeTask}\x1b[0m`);
    if (state.task.notes.length > 0) {
      lines.push(`          \x1b[90mLatest note: ${state.task.notes[state.task.notes.length - 1]}\x1b[0m`);
    }
  } else {
    lines.push(`\x1b[1mTask:\x1b[0m     \x1b[90m○ Idle (No active task broadcasted)\x1b[0m`);
  }
  lines.push(`\x1b[90m${hr}\x1b[0m`);

  // Section 2: Health & Security Meters
  const syncBadge = state.status.isClean ? '\x1b[32m✔ IN_SYNC\x1b[0m' : '\x1b[31m⚡ DRIFTED\x1b[0m';
  const secBadge = state.audit.isSecure ? '\x1b[32m✔ SECURE (0 Leaks)\x1b[0m' : `\x1b[31m✖ AT RISK (${state.audit.totalIssues} Leaks)\x1b[0m`;
  lines.push(`\x1b[1mContext Sync:\x1b[0m  ${syncBadge}     \x1b[1mSecurity Guard:\x1b[0m  ${secBadge}`);
  lines.push(`\x1b[1mHealth Score:\x1b[0m  ${renderBar(state.analysis.healthScore)}  (\x1b[36m${state.analysis.rating}\x1b[0m)`);
  lines.push(`\x1b[1mToken Usage:\x1b[0m   ~${state.analysis.totalTokens} tokens (Claude: ~${state.analysis.agentEstimates.claudeCode}, Cursor: ~${state.analysis.agentEstimates.cursor})`);
  lines.push(`\x1b[90m${hr}\x1b[0m`);

  // Section 3: Target Agents & Formats Grid
  lines.push(`\x1b[1m\x1b[35mTarget Agent Contexts & Files:\x1b[0m`);
  for (const t of state.status.targets) {
    const icon = t.status === 'IN_SYNC' ? '\x1b[32m✔\x1b[0m' : (t.status === 'DRIFTED' ? '\x1b[33m⚡\x1b[0m' : '\x1b[31m✖\x1b[0m');
    const statusCol = t.status === 'IN_SYNC' ? '\x1b[32mIN_SYNC\x1b[0m' : `\x1b[33m${t.status}\x1b[0m`;
    const fileName = t.file.padEnd(34, ' ');
    lines.push(`  ${icon} ${fileName} ${statusCol}`);
  }
  lines.push(`\x1b[90m${hr}\x1b[0m`);

  // Section 4: MCP & Monorepo Workspaces
  const mcpNames = (state.mcp.servers || []).map(s => s.name);
  const mcpDisplay = mcpNames.length > 0 ? mcpNames.join(', ') : 'None configured';
  lines.push(`\x1b[1mMCP Servers:\x1b[0m   \x1b[36m${state.mcp.count} active\x1b[0m (${mcpDisplay})`);

  if (state.workspaces.count > 0) {
    const wsBadge = state.workspaces.isAllClean ? '\x1b[32m✔ All Clean\x1b[0m' : '\x1b[33m⚡ Drift Detected\x1b[0m';
    lines.push(`\x1b[1mWorkspaces:\x1b[0m    \x1b[36m${state.workspaces.count} subpackages\x1b[0m (${wsBadge})`);
  }

  if (state.remotes && state.remotes.count > 0) {
    const remoteNames = state.remotes.list.map(r => r.name).join(', ');
    lines.push(`\x1b[1mTeam Remotes:\x1b[0m  \x1b[36m${state.remotes.count} linked\x1b[0m (${remoteNames})`);
  }
  lines.push(`\x1b[90m${hr}\x1b[0m`);

  // Section 5: Interactive Shortcuts
  lines.push(`\x1b[1mShortcuts:\x1b[0m  \x1b[36m[s]\x1b[0m Sync All  \x1b[36m[m]\x1b[0m 3-Way Merge  \x1b[36m[t]\x1b[0m Set Task  \x1b[36m[a]\x1b[0m Audit  \x1b[36m[r]\x1b[0m Refresh  \x1b[36m[q]\x1b[0m Quit`);

  return lines.join('\n');
}

/**
 * Starts interactive TUI in raw terminal mode.
 */
function startTui(rootDir = process.cwd(), options = {}) {
  const isSnapshot = !!options.snapshot || !process.stdin.isTTY;

  function refresh() {
    const state = getDashboardState(rootDir);
    if (!isSnapshot) {
      // Clear console
      process.stdout.write('\x1b[2J\x1b[0f');
    }
    console.log(renderTuiDashboard(state));
  }

  refresh();

  if (isSnapshot) {
    return;
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.exit();
    }
    if (key.name === 'q') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log('\n👋 Exiting M.H. AI Sync Dashboard.');
      process.exit(0);
    }
    if (key.name === 'r') {
      refresh();
    }
    if (key.name === 's') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" build`, { cwd: rootDir, stdio: 'ignore' });
      } catch {}
      refresh();
    }
    if (key.name === 'm') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" merge`, { cwd: rootDir, stdio: 'ignore' });
      } catch {}
      refresh();
    }
    if (key.name === 'a') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" audit`, { cwd: rootDir, stdio: 'ignore' });
      } catch {}
      refresh();
    }
    if (key.name === 't') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('\n\x1b[36mEnter new active task goal (or press Enter to cancel):\x1b[0m ', (ans) => {
        rl.close();
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        if (ans && ans.trim()) {
          setActiveTask(ans.trim(), {}, rootDir);
          try {
            const { execSync } = require('child_process');
            execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" build`, { cwd: rootDir, stdio: 'ignore' });
          } catch {}
        }
        refresh();
      });
    }
  });
}

/**
 * Generates modern dark-mode responsive HTML Dashboard for Web UI.
 */
function getWebDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M.H. AI Sync | Mission Control</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 29, 47, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #38bdf8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --glow: rgba(56, 189, 248, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    h1 span { color: var(--accent); }
    .actions { display: flex; gap: 8px; }
    button { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }
    button:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; backdrop-filter: blur(10px); }
    .card h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
    .card .val { font-size: 26px; font-weight: 700; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: var(--success); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .table-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .table-card h2 { font-size: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    td { padding: 12px 10px; border-bottom: 1px solid var(--border); }
    .task-box { background: rgba(56, 189, 248, 0.05); border: 1px dashed var(--accent); border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .task-box h4 { color: var(--accent); margin-bottom: 6px; font-size: 14px; }
    .bar-container { background: rgba(255,255,255,0.06); border-radius: 6px; height: 10px; overflow: hidden; margin-top: 8px; }
    .bar-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ <span>M.H. AI Sync</span> Mission Control</h1>
      <div class="actions">
        <button onclick="triggerAction('sync')">⚡ Sync All</button>
        <button onclick="triggerAction('merge')">🔄 Smart Merge</button>
        <button onclick="triggerAction('audit')">🛡 Security Audit</button>
        <button onclick="loadDashboard()">↻ Refresh</button>
      </div>
    </header>

    <div id="taskContainer" class="task-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4>🧠 Active Shared Task Bridge</h4>
        <div style="display: flex; gap: 6px;">
          <button style="padding: 4px 8px; font-size: 11px;" onclick="promptTask()">✏️ Set Task</button>
          <button style="padding: 4px 8px; font-size: 11px;" onclick="clearTask()">✖ Clear</button>
        </div>
      </div>
      <p id="taskContent" style="font-size: 14px; font-weight: 500;">Loading shared agent memory...</p>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Context Alignment</h3>
        <div id="syncStatus" class="val">-</div>
      </div>
      <div class="card">
        <h3>Prompt Health Score</h3>
        <div id="healthScore" class="val">-</div>
        <div class="bar-container"><div id="healthBar" class="bar-fill" style="width: 0%;"></div></div>
      </div>
      <div class="card">
        <h3>Security Posture</h3>
        <div id="securityStatus" class="val">-</div>
      </div>
      <div class="card">
        <h3>Token Budget</h3>
        <div id="tokenUsage" class="val">-</div>
      </div>
    </div>

    <div class="table-card">
      <h2>Synchronized AI Agent Targets</h2>
      <table>
        <thead>
          <tr>
            <th>Target Agent / File</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody id="targetsTable">
          <tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Loading targets...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    async function loadDashboard() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        // Task
        const taskBox = document.getElementById('taskContent');
        if (data.task && data.task.activeTask && data.task.status !== 'idle') {
          taskBox.innerHTML = '<strong>' + data.task.activeTask + '</strong> <span class="badge badge-warning">' + data.task.status.toUpperCase() + '</span>';
        } else {
          taskBox.innerHTML = '<span style="color: var(--text-muted)">Idle (No active task broadcasted)</span>';
        }

        // Sync Status
        const syncElem = document.getElementById('syncStatus');
        if (data.status.isClean) {
          syncElem.innerHTML = '<span class="badge badge-success">IN_SYNC</span>';
        } else {
          syncElem.innerHTML = '<span class="badge badge-danger">DRIFT DETECTED</span>';
        }

        // Health & Security
        document.getElementById('healthScore').innerText = data.analysis.healthScore + ' / 100 (' + data.analysis.rating + ')';
        document.getElementById('healthBar').style.width = data.analysis.healthScore + '%';
        
        const secElem = document.getElementById('securityStatus');
        if (data.audit.isSecure) {
          secElem.innerHTML = '<span class="badge badge-success">0 LEAKS</span>';
        } else {
          secElem.innerHTML = '<span class="badge badge-danger">' + data.audit.totalIssues + ' VULNERABLE</span>';
        }

        document.getElementById('tokenUsage').innerText = '~' + data.analysis.totalTokens + ' tokens';

        // Targets table
        const tbody = document.getElementById('targetsTable');
        tbody.innerHTML = '';
        data.status.targets.forEach(t => {
          const row = document.createElement('tr');
          const isOk = t.status === 'IN_SYNC';
          const badgeClass = isOk ? 'badge-success' : 'badge-warning';
          row.innerHTML = '<td><strong>' + t.file + '</strong></td>' +
                          '<td><span class="badge ' + badgeClass + '">' + t.status + '</span></td>' +
                          '<td>' + (t.diffHint || 'Up to date with canonical schema') + '</td>';
          tbody.appendChild(row);
        });
      } catch (err) {
        console.error(err);
      }
    }

    async function triggerAction(action) {
      await fetch('/api/' + action, { method: 'POST' });
      await loadDashboard();
    }

    async function promptTask() {
      const task = prompt("Enter new active goal to broadcast across Claude, Cursor, Antigravity:");
      if (task && task.trim()) {
        const note = prompt("Optional progress note (or leave blank):") || "";
        await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', task: task.trim(), note: note.trim() })
        });
        await triggerAction('sync');
      }
    }

    async function clearTask() {
      if (confirm("Reset active task across all AI agents?")) {
        await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' })
        });
        await triggerAction('sync');
      }
    }

    loadDashboard();
    setInterval(loadDashboard, 5000);
  </script>
</body>
</html>`;
}

/**
 * Creates lightweight, zero-dependency HTTP server for the Web Dashboard.
 */
function createDashboardServer(rootDir = process.cwd(), port = 3840) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    
    // Set standard CORS & JSON headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // REST API Endpoints
    if (url.pathname === '/api/status') {
      const state = getDashboardState(rootDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    if (url.pathname === '/api/sync' && req.method === 'POST') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" build`, { cwd: rootDir, stdio: 'ignore' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Synchronized all agents' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (url.pathname === '/api/merge' && req.method === 'POST') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" merge`, { cwd: rootDir, stdio: 'ignore' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Absorbed manual drift into canonical state' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (url.pathname === '/api/pull' && req.method === 'POST') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" pull`, { cwd: rootDir, stdio: 'ignore' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Pulled team standards from remote registry' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (url.pathname === '/api/optimize' && req.method === 'POST') {
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" optimize --apply`, { cwd: rootDir, stdio: 'ignore' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Optimized guidelines and pruned token bloat' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (url.pathname === '/api/snapshots' && req.method === 'GET') {
      const snaps = listSnapshots(rootDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: snaps.length, snapshots: snaps }));
      return;
    }

    if (url.pathname === '/api/snapshots' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const created = createSnapshot(rootDir, {
            tag: payload.tag,
            message: payload.message
          });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, snapshot: created }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/rollback' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = rollbackSnapshot(rootDir, payload.tag || payload.id);
          const { execSync } = require('child_process');
          execSync(`node "${path.join(__dirname, '..', 'bin', 'index.js')}" build`, { cwd: rootDir, stdio: 'ignore' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/audit' && req.method === 'POST') {
      const state = getDashboardState(rootDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state.audit));
      return;
    }

    if (url.pathname === '/api/task' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload.action === 'set' && payload.task) {
            setActiveTask(payload.task, { note: payload.note }, rootDir);
          } else if (payload.action === 'note' && payload.note) {
            addTaskNote(payload.note, rootDir);
          } else if (payload.action === 'clear') {
            clearActiveTask(rootDir);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Default: Web Dashboard HTML UI
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getWebDashboardHtml());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\x1b[31m[ERROR]\x1b[0m Port ${port} is already in use by another process.`);
    } else {
      console.error(`\x1b[31m[ERROR]\x1b[0m Dashboard server error:`, err.message);
    }
  });

  return server;
}

module.exports = {
  getDashboardState,
  renderBar,
  renderTuiDashboard,
  startTui,
  getWebDashboardHtml,
  createDashboardServer
};
