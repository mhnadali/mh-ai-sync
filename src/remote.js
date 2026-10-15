/**
 * M.H. AI Sync - Team & Remote Standards Registry Engine (Phase 11)
 * Manages remote organization standards, centralized policy enforcement,
 * and seamless synchronization with remote Git repos, HTTP endpoints, and team policies.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const { sanitize } = require('./generators');
const { parseAgentsMd } = require('./parsers');

/**
 * Loads project mhai.config.json safely
 */
function loadConfig(rootDir = process.cwd()) {
  const configPath = path.join(rootDir, 'mhai.config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse mhai.config.json: ${err.message}`);
  }
}

/**
 * Saves project mhai.config.json safely
 */
function saveConfig(config, rootDir = process.cwd()) {
  const configPath = path.join(rootDir, 'mhai.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Adds a new remote standards registry
 */
function addRemote(name, url, options = {}, rootDir = process.cwd()) {
  if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_\-\.]+$/.test(name)) {
    throw new Error('Remote name must be alphanumeric with dashes, underscores, or dots.');
  }
  if (!url || typeof url !== 'string') {
    throw new Error('Remote URL or path is required.');
  }

  const rawConfig = loadConfig(rootDir) || { project: { name: 'AI-Augmented Project' } };
  const config = sanitize(rawConfig);
  if (!config.remotes) config.remotes = {};

  config.remotes[name] = {
    url: url.trim(),
    branch: options.branch || 'main',
    locked: !!options.locked,
    autoSync: options.autoSync !== undefined ? !!options.autoSync : true,
    addedAt: new Date().toISOString()
  };

  saveConfig(config, rootDir);
  return {
    success: true,
    remote: {
      name,
      ...config.remotes[name]
    }
  };
}

/**
 * Removes an existing remote standards registry
 */
function removeRemote(name, rootDir = process.cwd()) {
  const rawConfig = loadConfig(rootDir);
  if (!rawConfig) {
    throw new Error('mhai.config.json not found.');
  }
  const config = sanitize(rawConfig);
  if (!config.remotes || !config.remotes[name]) {
    throw new Error(`Remote "${name}" does not exist.`);
  }

  delete config.remotes[name];
  saveConfig(config, rootDir);
  return { success: true, removed: name };
}

/**
 * Lists all configured remote registries
 */
function listRemotes(rootDir = process.cwd()) {
  const rawConfig = loadConfig(rootDir);
  if (!rawConfig) return [];
  const config = sanitize(rawConfig);
  const remotes = config.remotes || {};

  return Object.entries(remotes).map(([name, meta]) => ({
    name,
    url: meta.url,
    branch: meta.branch || 'main',
    locked: !!meta.locked,
    autoSync: !!meta.autoSync,
    addedAt: meta.addedAt || null
  }));
}

/**
 * Fetches text content via HTTP / HTTPS with redirect support (up to 3 hops)
 */
function fetchHttp(targetUrl, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many HTTP redirects'));
    }

    const client = targetUrl.startsWith('https://') ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'mh-ai-sync/2.1.0 (Team Remote Standards Registry)',
        'Accept': 'application/json, text/plain, text/markdown, */*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          const parsed = new URL(targetUrl);
          redirectUrl = new URL(redirectUrl, parsed.origin).toString();
        }
        return resolve(fetchHttp(redirectUrl, maxRedirects - 1));
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Request failed'}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('HTTP request timed out (10s)'));
    });
  });
}

/**
 * Fetches content from a remote source (HTTP/HTTPS, Git repo, or local filesystem path)
 */
async function fetchRemoteContent(urlOrPath, options = {}) {
  const trimmed = urlOrPath.trim();

  // 1. HTTP / HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it's a direct git repo ending in .git over https, try cloning shallowly
    if (trimmed.endsWith('.git')) {
      return fetchFromGitRepo(trimmed, options.branch || 'main');
    }
    return await fetchHttp(trimmed);
  }

  // 2. SSH / Git protocol
  if (trimmed.startsWith('git@') || trimmed.startsWith('ssh://')) {
    return fetchFromGitRepo(trimmed, options.branch || 'main');
  }

  // 3. Local filesystem path or file:// URL
  let localPath = trimmed;
  if (localPath.startsWith('file://')) {
    localPath = localPath.replace(/^file:\/\//, '');
    if (process.platform === 'win32' && localPath.startsWith('/')) {
      localPath = localPath.slice(1);
    }
  }

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.isDirectory()) {
      const candidates = ['mhai.config.json', 'AGENTS.md', 'CLAUDE.md'];
      for (const cand of candidates) {
        const fullCandidate = path.join(localPath, cand);
        if (fs.existsSync(fullCandidate)) {
          return fs.readFileSync(fullCandidate, 'utf8');
        }
      }
      throw new Error(`Directory "${localPath}" does not contain mhai.config.json or AGENTS.md.`);
    } else {
      return fs.readFileSync(localPath, 'utf8');
    }
  }

  throw new Error(`Unable to fetch remote content from "${urlOrPath}": Path or protocol not found.`);
}

/**
 * Clones a git repo shallowly into a temporary directory to extract standards file
 */
function fetchFromGitRepo(gitUrl, branch = 'main') {
  const tmpDir = path.join(process.cwd(), '.mhai', 'tmp', `git-${Date.now()}`);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`git clone --depth 1 --branch ${branch} "${gitUrl}" "${tmpDir}"`, {
      stdio: 'ignore',
      timeout: 20000
    });

    const candidates = ['mhai.config.json', 'AGENTS.md', 'CLAUDE.md'];
    for (const cand of candidates) {
      const target = path.join(tmpDir, cand);
      if (fs.existsSync(target)) {
        return fs.readFileSync(target, 'utf8');
      }
    }
    throw new Error(`No mhai.config.json or AGENTS.md found in remote repository: ${gitUrl}`);
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

/**
 * Parses raw remote standards content (JSON or Markdown) into structured configuration
 */
function parseRemoteStandards(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Remote standards content is empty.');
  }

  // Try JSON first
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return sanitize(parsed);
    } catch {}
  }

  // Fallback to Markdown parsing
  const parsedMd = parseAgentsMd(trimmed);
  return sanitize({
    project: {
      name: parsedMd.name || 'Remote Standards',
      overview: parsedMd.overview || 'Remote Team Standards'
    },
    commands: parsedMd.commands || {},
    guidelines: parsedMd.guidelines || {
      codeStyle: [],
      gitPractices: [],
      agentRules: []
    }
  });
}

/**
 * Normalizes rule string for duplicate/locked comparisons
 */
function normalizeRule(text) {
  return (text || '').toLowerCase().replace(/[`*_#\s\.\,\;]/g, '').trim();
}

/**
 * Pulls remote standards and merges them into local mhai.config.json
 */
async function pullRemote(remoteName, options = {}, rootDir = process.cwd()) {
  const rawConfig = loadConfig(rootDir);
  if (!rawConfig) {
    throw new Error('mhai.config.json not found in current directory. Run `mhai init` first.');
  }
  const config = sanitize(rawConfig);

  const remotes = config.remotes || {};
  const remoteMeta = remotes[remoteName];
  if (!remoteMeta) {
    throw new Error(`Remote "${remoteName}" is not configured. Use \`mhai remote add ${remoteName} <url>\` first.`);
  }

  const rawRemoteContent = await fetchRemoteContent(remoteMeta.url, { branch: remoteMeta.branch });
  const remoteStandards = parseRemoteStandards(rawRemoteContent);

  const changes = [];
  const shouldLock = remoteMeta.locked || !!options.lockAll;

  if (!config.lockedGuidelines) {
    config.lockedGuidelines = [];
  }

  // 1. Merge guidelines (codeStyle, gitPractices, agentRules)
  const categories = ['agentRules', 'codeStyle', 'gitPractices'];
  for (const cat of categories) {
    const incomingRules = (remoteStandards.guidelines && remoteStandards.guidelines[cat]) || [];
    for (const rule of incomingRules) {
      if (typeof rule === 'string' && rule.trim()) {
        const trimmedRule = rule.trim();
        const norm = normalizeRule(trimmedRule);

        // Check if rule already exists in any category
        const exists = categories.some(c =>
          (config.guidelines[c] || []).some(r => normalizeRule(r) === norm)
        );

        if (!exists) {
          config.guidelines[cat].push(trimmedRule);
          changes.push({ type: 'rule', category: cat, rule: trimmedRule });
        }

        // Lock if remote is marked as locked
        if (shouldLock) {
          const alreadyLocked = config.lockedGuidelines.some(r => normalizeRule(r) === norm);
          if (!alreadyLocked) {
            config.lockedGuidelines.push(trimmedRule);
          }
        }
      }
    }
  }

  // 2. Also inherit remote lockedGuidelines if remote declared them
  if (Array.isArray(remoteStandards.lockedGuidelines)) {
    for (const lockedRule of remoteStandards.lockedGuidelines) {
      const norm = normalizeRule(lockedRule);
      if (!config.lockedGuidelines.some(r => normalizeRule(r) === norm)) {
        config.lockedGuidelines.push(lockedRule.trim());
      }
    }
  }

  // 3. Inherit remote MCP servers
  if (remoteStandards.mcpServers && typeof remoteStandards.mcpServers === 'object') {
    if (!config.mcpServers) config.mcpServers = {};
    for (const [sName, sDef] of Object.entries(remoteStandards.mcpServers)) {
      if (!config.mcpServers[sName]) {
        config.mcpServers[sName] = sDef;
        changes.push({ type: 'mcpServer', key: sName });
      }
    }
  }

  // 4. Inherit remote skills
  if (Array.isArray(remoteStandards.skills)) {
    if (!config.skills) config.skills = [];
    for (const skill of remoteStandards.skills) {
      if (!config.skills.some(s => s.name === skill.name)) {
        config.skills.push(skill);
        changes.push({ type: 'skill', name: skill.name });
      }
    }
  }

  // Save updated config
  saveConfig(config, rootDir);

  return {
    success: true,
    remoteName,
    url: remoteMeta.url,
    changesCount: changes.length,
    changes,
    totalLockedRules: config.lockedGuidelines.length
  };
}

/**
 * Checks compliance of local rules against mandatory remote standards
 */
async function checkCompliance(remoteName, rootDir = process.cwd()) {
  const rawConfig = loadConfig(rootDir);
  if (!rawConfig) {
    throw new Error('mhai.config.json not found in current directory.');
  }
  const config = sanitize(rawConfig);
  const remoteMeta = (config.remotes || {})[remoteName];
  if (!remoteMeta) {
    throw new Error(`Remote "${remoteName}" is not configured.`);
  }

  const rawRemoteContent = await fetchRemoteContent(remoteMeta.url, { branch: remoteMeta.branch });
  const remoteStandards = parseRemoteStandards(rawRemoteContent);

  // All rules from remote that are either explicitly in lockedGuidelines,
  // or all guidelines if remote is configured as locked
  const requiredRules = new Set();

  if (Array.isArray(remoteStandards.lockedGuidelines) && remoteStandards.lockedGuidelines.length > 0) {
    for (const r of remoteStandards.lockedGuidelines) requiredRules.add(r.trim());
  } else if (remoteMeta.locked) {
    for (const cat of ['agentRules', 'codeStyle', 'gitPractices']) {
      for (const r of (remoteStandards.guidelines[cat] || [])) requiredRules.add(r.trim());
    }
  }

  // Collect all local normalized rules
  const localNormalizedRules = new Set();
  for (const cat of ['agentRules', 'codeStyle', 'gitPractices']) {
    for (const r of (config.guidelines[cat] || [])) {
      localNormalizedRules.add(normalizeRule(r));
    }
  }

  const missingRules = [];
  for (const req of requiredRules) {
    if (!localNormalizedRules.has(normalizeRule(req))) {
      missingRules.push(req);
    }
  }

  return {
    remoteName,
    url: remoteMeta.url,
    isCompliant: missingRules.length === 0,
    requiredCount: requiredRules.size,
    missingCount: missingRules.length,
    missingRules
  };
}

/**
 * Formats remote list as a readable CLI table/view
 */
function formatRemoteList(remotes) {
  if (remotes.length === 0) {
    return '\x1b[90mNo remote standards registries configured. Use `mhai remote add <name> <url>` to link one.\x1b[0m';
  }

  const lines = ['\x1b[1m\x1b[36m=== Configured Remote Standards Registries ===\x1b[0m\n'];
  for (const r of remotes) {
    const lockBadge = r.locked ? '\x1b[33m[LOCKED]\x1b[0m' : '\x1b[90m[OPEN]\x1b[0m';
    const autoBadge = r.autoSync ? '\x1b[32m(auto-sync)\x1b[0m' : '\x1b[90m(manual)\x1b[0m';
    lines.push(`  \x1b[1m● ${r.name.padEnd(16)}\x1b[0m ${lockBadge} ${autoBadge}`);
    lines.push(`    \x1b[90mURL:    ${r.url} (branch: ${r.branch})\x1b[0m`);
    if (r.addedAt) {
      lines.push(`    \x1b[90mLinked: ${r.addedAt}\x1b[0m`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Formats compliance check result
 */
function formatComplianceReport(report) {
  const lines = [`\x1b[1m\x1b[36m=== Compliance Check: Remote "${report.remoteName}" ===\x1b[0m\n`];
  if (report.isCompliant) {
    lines.push(`\x1b[32m✔ 100% Compliant: All ${report.requiredCount} mandatory team standards are active in local configuration.\x1b[0m`);
  } else {
    lines.push(`\x1b[31m✖ Non-Compliant: ${report.missingCount} of ${report.requiredCount} mandatory team rules are missing!\x1b[0m\n`);
    for (const m of report.missingRules) {
      lines.push(`  \x1b[31m- Missing Rule:\x1b[0m "${m}"`);
    }
    lines.push(`\n\x1b[33mRun \`mhai pull ${report.remoteName}\` to restore full compliance.\x1b[0m`);
  }
  return lines.join('\n');
}

module.exports = {
  loadConfig,
  saveConfig,
  addRemote,
  removeRemote,
  listRemotes,
  fetchHttp,
  fetchRemoteContent,
  parseRemoteStandards,
  normalizeRule,
  pullRemote,
  checkCompliance,
  formatRemoteList,
  formatComplianceReport
};
