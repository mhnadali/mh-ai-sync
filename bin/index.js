#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DEFAULT_CANONICAL_SCHEMA } = require('../src/schema');
const { parseClaudeMd, parseAgentsMd, parseCursorRules } = require('../src/parsers');
const {
  sanitize,
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateWindsurfRules,
  generateCopilotInstructions,
  generateMcpConfig
} = require('../src/generators');

const CONFIG_FILE = 'mhai.config.json';
const CWD = process.cwd();

function log(msg, color = "\x1b[32m") {
  console.log(`${color}[M.H. AI Sync]\x1b[0m ${msg}`);
}

function init() {
  const targetPath = path.join(CWD, CONFIG_FILE);
  if (fs.existsSync(targetPath)) {
    log(`Configuration file already exists at ${CONFIG_FILE}`, "\x1b[33m");
    return;
  }
  fs.writeFileSync(targetPath, JSON.stringify(DEFAULT_CANONICAL_SCHEMA, null, 2), 'utf-8');
  log(`Initialized canonical configuration file -> ${CONFIG_FILE}`);
}

function loadConfig() {
  const targetPath = path.join(CWD, CONFIG_FILE);
  if (!fs.existsSync(targetPath)) {
    // Attempt auto-import from existing CLAUDE.md or AGENTS.md
    if (fs.existsSync(path.join(CWD, 'CLAUDE.md'))) {
      log('Detected CLAUDE.md! Auto-importing into canonical format...');
      importFrom('claude');
      return loadConfig();
    } else if (fs.existsSync(path.join(CWD, 'AGENTS.md'))) {
      log('Detected AGENTS.md! Auto-importing into canonical format...');
      importFrom('agents');
      return loadConfig();
    } else {
      log(`No ${CONFIG_FILE} found. Initializing with defaults...`, "\x1b[33m");
      init();
      return DEFAULT_CANONICAL_SCHEMA;
    }
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    return sanitize(JSON.parse(raw));
  } catch (err) {
    log(`⚠️ Warning: Failed to parse ${CONFIG_FILE} (${err.message}). Falling back to safe defaults.`, "\x1b[31m");
    return DEFAULT_CANONICAL_SCHEMA;
  }
}

function importFrom(sourceType) {
  const targetPath = path.join(CWD, CONFIG_FILE);
  let baseConfig = DEFAULT_CANONICAL_SCHEMA;
  
  if (fs.existsSync(targetPath)) {
    try {
      baseConfig = sanitize(JSON.parse(fs.readFileSync(targetPath, 'utf-8')));
    } catch {
      baseConfig = DEFAULT_CANONICAL_SCHEMA;
    }
  }

  let imported = JSON.parse(JSON.stringify(baseConfig));

  if (sourceType === 'claude' && fs.existsSync(path.join(CWD, 'CLAUDE.md'))) {
    const parsed = parseClaudeMd(fs.readFileSync(path.join(CWD, 'CLAUDE.md'), 'utf-8'));
    if (parsed.name) imported.project.name = parsed.name;
    if (parsed.overview) imported.project.overview = parsed.overview;
    if (Object.keys(parsed.commands).length) imported.commands = { ...imported.commands, ...parsed.commands };
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
    if (parsed.guidelines.codeStyle.length) imported.guidelines.codeStyle = parsed.guidelines.codeStyle;
  } else if (sourceType === 'agents' && fs.existsSync(path.join(CWD, 'AGENTS.md'))) {
    const parsed = parseAgentsMd(fs.readFileSync(path.join(CWD, 'AGENTS.md'), 'utf-8'));
    if (parsed.name) imported.project.name = parsed.name;
    if (parsed.overview) imported.project.overview = parsed.overview;
    if (Object.keys(parsed.commands).length) imported.commands = { ...imported.commands, ...parsed.commands };
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
    if (parsed.guidelines.codeStyle.length) imported.guidelines.codeStyle = parsed.guidelines.codeStyle;
    if (parsed.guidelines.gitPractices.length) imported.guidelines.gitPractices = parsed.guidelines.gitPractices;
  } else if (sourceType === 'cursor' && fs.existsSync(path.join(CWD, '.cursorrules'))) {
    const parsed = parseCursorRules(fs.readFileSync(path.join(CWD, '.cursorrules'), 'utf-8'));
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
  }
  
  fs.writeFileSync(targetPath, JSON.stringify(imported, null, 2), 'utf-8');
  log(`Imported and merged rules from ${sourceType.toUpperCase()} into ${CONFIG_FILE}`);
}

function build() {
  const config = loadConfig();

  // 1. CLAUDE.md (Claude Code)
  fs.writeFileSync(path.join(CWD, 'CLAUDE.md'), generateClaudeMd(config), 'utf-8');
  log('✔ Synchronized -> CLAUDE.md (Claude Code)');

  // 2. AGENTS.md (Universal Standard & Hermes / Aider)
  fs.writeFileSync(path.join(CWD, 'AGENTS.md'), generateAgentsMd(config), 'utf-8');
  log('✔ Synchronized -> AGENTS.md (Universal Standard / Hermes / Aider)');

  // 3. ANTIGRAVITY.md / GEMINI.md (Antigravity context)
  fs.writeFileSync(path.join(CWD, 'ANTIGRAVITY.md'), generateAntigravityConfig(config), 'utf-8');
  log('✔ Synchronized -> ANTIGRAVITY.md (Google Antigravity)');

  // 4. .cursorrules (Cursor IDE)
  fs.writeFileSync(path.join(CWD, '.cursorrules'), generateCursorRules(config), 'utf-8');
  log('✔ Synchronized -> .cursorrules (Cursor IDE)');

  // 5. .windsurfrules (Windsurf Cascade)
  fs.writeFileSync(path.join(CWD, '.windsurfrules'), generateWindsurfRules(config), 'utf-8');
  log('✔ Synchronized -> .windsurfrules (Windsurf)');

  // 6. .github/copilot-instructions.md (GitHub Copilot)
  const githubDir = path.join(CWD, '.github');
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), generateCopilotInstructions(config), 'utf-8');
  log('✔ Synchronized -> .github/copilot-instructions.md (Copilot)');

  // 7. .mcp.json (MCP Protocols & Tools)
  fs.writeFileSync(path.join(CWD, '.mcp.json'), generateMcpConfig(config), 'utf-8');
  log('✔ Synchronized -> .mcp.json (MCP Protocols & Tools)');

  log('\n✨ [M.H. AI Sync] All AI Agents and Coding assistants are fully aligned!', "\x1b[36m");
}

function printHelp() {
  console.log(`
\x1b[1m\x1b[36mM.H. AI Sync CLI\x1b[0m
A Unified Bridge for Multi-Agent AI Coding Systems

\x1b[1mUSAGE:\x1b[0m
  node bin/index.js <command>

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32minit\x1b[0m         Create initial mhai.config.json
  \x1b[32mbuild\x1b[0m (sync)  Compile canonical config into all AI formats:
               - CLAUDE.md (Claude Code)
               - AGENTS.md (Hermes, Aider, Open Standard)
               - ANTIGRAVITY.md (Google Antigravity)
               - .cursorrules (Cursor IDE)
               - .windsurfrules (Windsurf)
               - .github/copilot-instructions.md (GitHub Copilot)
               - .mcp.json (Model Context Protocol)
  \x1b[32mimport <src>\x1b[0m  Import from 'claude', 'cursor', or 'agents' into mhai.config.json
  \x1b[32mhelp\x1b[0m          Show this help menu
`);
}

const args = process.argv.slice(2);
const command = args[0] || 'build';

switch (command) {
  case 'init':
    init();
    break;
  case 'build':
  case 'sync':
    build();
    break;
  case 'import':
    importFrom(args[1] || 'claude');
    break;
  case 'help':
  default:
    printHelp();
    break;
}
