/**
 * M.H. AI Sync - MCP Hub & Marketplace Integrator
 * Catalog, management, and synchronization of Model Context Protocol (MCP) servers.
 */

const fs = require('fs');
const path = require('path');
const { sanitize } = require('./generators');

const MCP_PRESETS = {
  filesystem: {
    description: 'Local file system operations within designated workspace directory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    env: {}
  },
  fetch: {
    description: 'Web page fetching and HTML-to-markdown content extraction',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    env: {}
  },
  github: {
    description: 'GitHub repository management, issues, PRs, and branch operations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' },
    requiresAuth: true
  },
  postgres: {
    description: 'PostgreSQL database inspection, schema introspection, and SQL queries',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    env: {}
  },
  sqlite: {
    description: 'Direct SQLite database inspection and local query execution',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './app.db'],
    env: {}
  },
  'brave-search': {
    description: 'Web search and local query engine via Brave Search API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
    requiresAuth: true
  },
  puppeteer: {
    description: 'Headless browser automation, scraping, and screenshot capture',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    env: {}
  },
  memory: {
    description: 'Graph-based persistent memory server across AI sessions',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {}
  },
  docker: {
    description: 'Docker container, image, and volume management',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-docker'],
    env: {}
  },
  slack: {
    description: 'Slack workspace channel management and interactive messaging',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' },
    requiresAuth: true
  }
};

function getMcpPresets() {
  return Object.entries(MCP_PRESETS).map(([id, meta]) => ({
    id,
    ...meta
  }));
}

function listConfiguredServers(rawConfig) {
  const config = sanitize(rawConfig);
  const servers = [];

  for (const [name, def] of Object.entries(config.mcpServers || {})) {
    const isPreset = Boolean(MCP_PRESETS[name]);
    servers.push({
      name,
      command: def.command || 'npx',
      args: Array.isArray(def.args) ? def.args : [],
      env: def.env || {},
      isPreset,
      description: isPreset ? MCP_PRESETS[name].description : 'Custom MCP server'
    });
  }

  return servers;
}

function addMcpServer(rawConfig, serverName, customOptions = {}) {
  const config = sanitize(rawConfig);
  if (!config.mcpServers) config.mcpServers = {};

  const name = String(serverName).trim().toLowerCase();
  if (!name) {
    throw new Error('Server name or preset identifier is required');
  }

  let serverDef;
  if (MCP_PRESETS[name]) {
    const preset = MCP_PRESETS[name];
    serverDef = {
      command: customOptions.command || preset.command,
      args: customOptions.args && customOptions.args.length > 0 ? customOptions.args : [...preset.args],
      env: { ...(preset.env || {}), ...(customOptions.env || {}) }
    };
  } else {
    serverDef = {
      command: customOptions.command || 'npx',
      args: Array.isArray(customOptions.args) ? customOptions.args : (customOptions.args ? [customOptions.args] : []),
      env: customOptions.env || {}
    };
  }

  config.mcpServers[name] = serverDef;
  return { config, serverDef, isPreset: Boolean(MCP_PRESETS[name]) };
}

function removeMcpServer(rawConfig, serverName) {
  const config = sanitize(rawConfig);
  const name = String(serverName).trim().toLowerCase();

  if (!config.mcpServers || !config.mcpServers[name]) {
    return { config, removed: false, reason: `Server "${serverName}" is not configured.` };
  }

  delete config.mcpServers[name];
  return { config, removed: true, name };
}

function saveMcpConfig(config, rootDir = process.cwd()) {
  const configPath = path.join(rootDir, 'mhai.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function formatMcpList(rawConfig) {
  const servers = listConfiguredServers(rawConfig);
  const lines = [];

  lines.push('\x1b[1m\x1b[36m=== Configured MCP Servers (.mcp.json) ===\x1b[0m\n');
  if (servers.length === 0) {
    lines.push('  No MCP servers configured yet.');
    lines.push('  💡 Tip: Run `node bin/index.js mcp presets` to view ready-to-use servers.');
  } else {
    for (const s of servers) {
      const typeBadge = s.isPreset ? '\x1b[32m[Preset]\x1b[0m' : '\x1b[35m[Custom]\x1b[0m';
      lines.push(`  • \x1b[1m${s.name}\x1b[0m ${typeBadge}`);
      lines.push(`    Command: ${s.command} ${(s.args || []).join(' ')}`);
      if (s.description) lines.push(`    Info:    ${s.description}`);
      if (Object.keys(s.env).length > 0) {
        lines.push(`    Env:     ${Object.keys(s.env).join(', ')}`);
      }
      lines.push('');
    }
  }

  lines.push('----------------------------------------');
  lines.push(`Total: ${servers.length} server(s) active.`);
  return lines.join('\n');
}

function formatPresetsList() {
  const presets = getMcpPresets();
  const lines = [];

  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync MCP Hub Presets ===\x1b[0m\n');
  for (const p of presets) {
    const authBadge = p.requiresAuth ? ' \x1b[33m(Requires API Key/Token)\x1b[0m' : '';
    lines.push(`  \x1b[32m${p.id.padEnd(14)}\x1b[0m - ${p.description}${authBadge}`);
    lines.push(`                 \x1b[90mCommand: ${p.command} ${p.args.join(' ')}\x1b[0m`);
  }

  lines.push('\n----------------------------------------');
  lines.push('💡 To install a preset into your project, run:');
  lines.push('   \x1b[36mnode bin/index.js mcp add <preset-name>\x1b[0m');
  return lines.join('\n');
}

module.exports = {
  MCP_PRESETS,
  getMcpPresets,
  listConfiguredServers,
  addMcpServer,
  removeMcpServer,
  saveMcpConfig,
  formatMcpList,
  formatPresetsList
};
