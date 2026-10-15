#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DEFAULT_CANONICAL_SCHEMA } = require('../src/schema');
const { parseClaudeMd, parseAgentsMd, parseCursorRules } = require('../src/parsers');
const { detectStack } = require('../src/detectors');
const { checkStatus, formatStatusReport } = require('../src/status');
const { auditConfig, formatAuditReport, redactSecrets } = require('../src/security');
const { startWatcher } = require('../src/watcher');
const { installGitHubAction } = require('../src/ci');
const { installHook, uninstallHook, isHookInstalled } = require('../src/hooks');
const { analyzePromptBudget, formatAnalysisReport } = require('../src/analyzer');
const {
  loadTaskState,
  setActiveTask,
  addTaskNote,
  clearActiveTask,
  generateTaskBanner
} = require('../src/task');
const {
  getMcpPresets,
  listConfiguredServers,
  addMcpServer,
  removeMcpServer,
  saveMcpConfig,
  formatMcpList,
  formatPresetsList
} = require('../src/mcpHub');
const {
  inspectDiffs,
  mergeAllDriftedFiles
} = require('../src/merger');
const {
  discoverWorkspaces,
  syncAllWorkspaces,
  checkWorkspacesStatus,
  formatWorkspacesReport
} = require('../src/monorepo');
const {
  sanitize,
  generateClaudeMd,
  generateAgentsMd,
  generateAntigravityConfig,
  generateCursorRules,
  generateCursorMdcRules,
  generateSkillFiles,
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

  // Auto-detect project stack
  log('Analyzing workspace repository stack...');
  const detected = detectStack(CWD);
  const initialSchema = JSON.parse(JSON.stringify(DEFAULT_CANONICAL_SCHEMA));

  initialSchema.project.name = detected.name;
  initialSchema.project.overview = detected.overview;
  initialSchema.project.techStack = detected.techStack;
  initialSchema.commands = { ...initialSchema.commands, ...detected.commands };

  log(`Auto-detected stack: ${detected.techStack.join(', ')}`, "\x1b[36m");
  fs.writeFileSync(targetPath, JSON.stringify(initialSchema, null, 2), 'utf-8');
  log(`Initialized canonical configuration file -> ${CONFIG_FILE}`);
}

function loadConfig() {
  const targetPath = path.join(CWD, CONFIG_FILE);
  if (!fs.existsSync(targetPath)) {
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

  const sourceFiles = {
    claude: 'CLAUDE.md',
    agents: 'AGENTS.md',
    cursor: '.cursorrules'
  };

  const relFile = sourceFiles[sourceType];
  if (!relFile) {
    log(`✖ Unknown import source "${sourceType}". Supported sources: 'claude', 'agents', 'cursor'`, "\x1b[31m");
    return;
  }

  const fullSourcePath = path.join(CWD, relFile);
  if (!fs.existsSync(fullSourcePath)) {
    log(`✖ Source file not found: ${relFile}`, "\x1b[31m");
    return;
  }

  let imported = JSON.parse(JSON.stringify(baseConfig));

  if (sourceType === 'claude') {
    const parsed = parseClaudeMd(fs.readFileSync(fullSourcePath, 'utf-8'));
    if (parsed.name) imported.project.name = parsed.name;
    if (parsed.overview) imported.project.overview = parsed.overview;
    if (Object.keys(parsed.commands).length) imported.commands = { ...imported.commands, ...parsed.commands };
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
    if (parsed.guidelines.codeStyle.length) imported.guidelines.codeStyle = parsed.guidelines.codeStyle;
  } else if (sourceType === 'agents') {
    const parsed = parseAgentsMd(fs.readFileSync(fullSourcePath, 'utf-8'));
    if (parsed.name) imported.project.name = parsed.name;
    if (parsed.overview) imported.project.overview = parsed.overview;
    if (Object.keys(parsed.commands).length) imported.commands = { ...imported.commands, ...parsed.commands };
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
    if (parsed.guidelines.codeStyle.length) imported.guidelines.codeStyle = parsed.guidelines.codeStyle;
    if (parsed.guidelines.gitPractices.length) imported.guidelines.gitPractices = parsed.guidelines.gitPractices;
  } else if (sourceType === 'cursor') {
    const parsed = parseCursorRules(fs.readFileSync(fullSourcePath, 'utf-8'));
    if (parsed.guidelines.agentRules.length) imported.guidelines.agentRules = parsed.guidelines.agentRules;
  }
  
  fs.writeFileSync(targetPath, JSON.stringify(imported, null, 2), 'utf-8');
  log(`Imported and merged rules from ${sourceType.toUpperCase()} into ${CONFIG_FILE}`);
}

function build(redact = false, syncWorkspaces = false) {
  const config = loadConfig();
  const taskState = loadTaskState(CWD);
  const taskBanner = generateTaskBanner(taskState);

  function processContent(content) {
    return redact ? redactSecrets(content) : content;
  }

  // 1. CLAUDE.md (Claude Code)
  fs.writeFileSync(path.join(CWD, 'CLAUDE.md'), processContent(generateClaudeMd(config, taskBanner)), 'utf-8');
  log('✔ Synchronized -> CLAUDE.md (Claude Code)');

  // 2. AGENTS.md (Universal Standard & Hermes / Aider)
  fs.writeFileSync(path.join(CWD, 'AGENTS.md'), processContent(generateAgentsMd(config, taskBanner)), 'utf-8');
  log('✔ Synchronized -> AGENTS.md (Universal Standard / Hermes / Aider)');

  // 3. ANTIGRAVITY.md / GEMINI.md (Antigravity context)
  fs.writeFileSync(path.join(CWD, 'ANTIGRAVITY.md'), processContent(generateAntigravityConfig(config, taskBanner)), 'utf-8');
  log('✔ Synchronized -> ANTIGRAVITY.md (Google Antigravity)');

  // 4. .cursorrules (Cursor IDE)
  fs.writeFileSync(path.join(CWD, '.cursorrules'), processContent(generateCursorRules(config, taskBanner)), 'utf-8');
  log('✔ Synchronized -> .cursorrules (Cursor IDE)');

  // 5. .windsurfrules (Windsurf Cascade)
  fs.writeFileSync(path.join(CWD, '.windsurfrules'), processContent(generateWindsurfRules(config)), 'utf-8');
  log('✔ Synchronized -> .windsurfrules (Windsurf)');

  // 6. .github/copilot-instructions.md (GitHub Copilot)
  const githubDir = path.join(CWD, '.github');
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), processContent(generateCopilotInstructions(config)), 'utf-8');
  log('✔ Synchronized -> .github/copilot-instructions.md (Copilot)');

  // 7. .mcp.json (MCP Protocols & Tools)
  fs.writeFileSync(path.join(CWD, '.mcp.json'), processContent(generateMcpConfig(config)), 'utf-8');
  log('✔ Synchronized -> .mcp.json (MCP Protocols & Tools)');

  // 8. .cursor/rules/*.mdc (Modern Cursor 2.0 Rules)
  const cursorRulesDir = path.join(CWD, '.cursor', 'rules');
  if (!fs.existsSync(cursorRulesDir)) fs.mkdirSync(cursorRulesDir, { recursive: true });
  const mdcFiles = generateCursorMdcRules(config);
  for (const [filename, content] of Object.entries(mdcFiles)) {
    fs.writeFileSync(path.join(cursorRulesDir, filename), processContent(content), 'utf-8');
  }
  log(`✔ Synchronized -> .cursor/rules/ (${Object.keys(mdcFiles).length} modular MDC rules)`);

  // 9. skills/*/SKILL.md (Antigravity & Hermes Modular Skills)
  const skillFiles = generateSkillFiles(config);
  for (const [relPath, content] of Object.entries(skillFiles)) {
    const fullSkillPath = path.join(CWD, relPath);
    const skillDir = path.dirname(fullSkillPath);
    if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(fullSkillPath, processContent(content), 'utf-8');
  }
  log(`✔ Synchronized -> skills/ (${Object.keys(skillFiles).length} modular Agent skills)`);

  if (taskState.activeTask && taskState.status !== 'idle') {
    log(`✔ Active Task Bridge active: "${taskState.activeTask}" synchronized across agents!`, "\x1b[36m");
  }

  if (syncWorkspaces) {
    const wsRes = syncAllWorkspaces(config, CWD, taskBanner);
    if (wsRes.workspacesCount > 0) {
      log(`✔ Synchronized across ${wsRes.workspacesCount} monorepo workspaces!`, "\x1b[36m");
    }
  }

  log('\n✨ [M.H. AI Sync] All AI Agents and Coding assistants are fully aligned!', "\x1b[36m");
}

function status(checkOnly = false, checkWorkspaces = false) {
  const config = loadConfig();
  const report = checkStatus(config, CWD);
  console.log(formatStatusReport(report));

  let isClean = report.isClean;

  if (checkWorkspaces) {
    const wsStatus = checkWorkspacesStatus(config, CWD);
    if (wsStatus.totalWorkspaces > 0) {
      console.log(`\n\x1b[1m\x1b[36m=== Monorepo Workspaces Status (${wsStatus.totalWorkspaces} workspaces) ===\x1b[0m`);
      for (const item of wsStatus.reports) {
        const badge = item.status.isClean ? '\x1b[32m✔ IN_SYNC\x1b[0m' : '\x1b[33m⚡ DRIFTED\x1b[0m';
        console.log(`  ${badge} ${item.path} (${item.workspace})`);
      }
      if (!wsStatus.isAllClean) isClean = false;
    }
  }

  if (checkOnly && !isClean) {
    process.exit(1);
  }
}

function manageWorkspaces(action = 'list') {
  const config = loadConfig();
  const workspaces = discoverWorkspaces(CWD);

  if (action === 'sync' || action === 'build') {
    const taskState = loadTaskState(CWD);
    const banner = generateTaskBanner(taskState);
    const res = syncAllWorkspaces(config, CWD, banner);
    log(`✔ Synchronized AI contexts across ${res.workspacesCount} monorepo workspaces!`);
  } else if (action === 'status' || action === 'check') {
    const wsStatus = checkWorkspacesStatus(config, CWD);
    console.log(formatWorkspacesReport(workspaces));
    if (wsStatus.isAllClean) {
      log('✨ All monorepo workspaces are fully synchronized!');
    } else {
      log('⚠️ Synchronization drift detected in one or more workspaces. Run `mhai monorepo sync` to re-align.', "\x1b[33m");
      if (args.includes('--check')) process.exit(1);
    }
  } else {
    console.log(formatWorkspacesReport(workspaces));
    log('💡 Run `mhai monorepo sync` to cascade canonical configurations down to all subpackages.');
  }
}

function audit(strict = false) {
  const config = loadConfig();
  const auditResult = auditConfig(config, CWD);
  console.log(formatAuditReport(auditResult));

  if (strict && !auditResult.isSecure) {
    process.exit(1);
  }
}

function watch() {
  log('Starting real-time live synchronization watcher...', "\x1b[36m");
  build();
  startWatcher(CWD, (changedFile) => {
    if (changedFile && changedFile !== CONFIG_FILE) {
      smartMerge(changedFile);
    } else {
      build();
    }
  });
}

function setupCi() {
  const res = installGitHubAction(CWD);
  log(`✔ Installed GitHub Action CI/CD workflow -> ${res.relativePath}`);
  log('✨ Your repository will now automatically enforce AI sync & secret checks on every PR!', "\x1b[36m");
}

function manageHook(action = 'install') {
  if (action === 'install') {
    try {
      const res = installHook(CWD);
      log(`✔ Installed native Git pre-commit hook -> ${res.relativePath}`);
      log('Local commits will now automatically enforce secret audit & drift checks!', "\x1b[36m");
    } catch (err) {
      log(`✖ Failed to install Git hook: ${err.message}`, "\x1b[31m");
      process.exit(1);
    }
  } else if (action === 'uninstall') {
    try {
      const res = uninstallHook(CWD);
      if (res.removed) {
        log('✔ Removed M.H. AI Sync pre-commit hook.');
      } else {
        log(`ℹ ${res.reason}.`, "\x1b[33m");
      }
    } catch (err) {
      log(`✖ Failed to uninstall Git hook: ${err.message}`, "\x1b[31m");
      process.exit(1);
    }
  } else {
    const installed = isHookInstalled(CWD);
    log(`Pre-commit Git Hook Status: ${installed ? '\x1b[32mActive (Installed)\x1b[0m' : '\x1b[33mNot Installed\x1b[0m'}`);
  }
}

function manageTask(subcommand, arg1, arg2) {
  if (subcommand === 'set') {
    if (!arg1) {
      log('✖ Please provide a task description: mhai task set "<description>" [note]', "\x1b[31m");
      process.exit(1);
    }
    setActiveTask(arg1, { note: arg2 }, CWD);
    log(`✔ Active task set -> "${arg1}"`);
    build();
  } else if (subcommand === 'note') {
    if (!arg1) {
      log('✖ Please provide note text: mhai task note "<note text>"', "\x1b[31m");
      process.exit(1);
    }
    addTaskNote(arg1, CWD);
    log(`✔ Added note to active task -> "${arg1}"`);
    build();
  } else if (subcommand === 'clear' || subcommand === 'done') {
    clearActiveTask(CWD);
    log('✔ Active task cleared. AI agents reset to idle.');
    build();
  } else {
    const state = loadTaskState(CWD);
    console.log('\n\x1b[1m\x1b[36m=== M.H. AI Sync Shared Agent Memory ===\x1b[0m\n');
    if (!state.activeTask || state.status === 'idle') {
      console.log('  Status: \x1b[33mIdle (No active task set)\x1b[0m');
      console.log('  Hint: Run `node bin/index.js task set "<goal>"` to broadcast a task to all agents.\n');
    } else {
      console.log(`  Active Goal:  \x1b[32m${state.activeTask}\x1b[0m`);
      console.log(`  Status:       \x1b[33m${state.status.toUpperCase()}\x1b[0m`);
      console.log(`  Updated:      ${state.updatedAt ? new Date(state.updatedAt).toLocaleString() : 'N/A'} (by ${state.updatedBy})`);
      if (state.recentNotes.length > 0) {
        console.log('\n  Progress Notes:');
        for (const note of state.recentNotes) {
          console.log(`    • ${note}`);
        }
      }
      console.log('\n----------------------------------------');
      console.log('✨ This active task is injected into Claude Code, Antigravity, and Cursor contexts.\n');
    }
  }
}

function analyze() {
  const config = loadConfig();
  const analysis = analyzePromptBudget(config);
  console.log(formatAnalysisReport(analysis));
}

function manageMcp(subcommand, arg1, ...restArgs) {
  const config = loadConfig();

  if (subcommand === 'presets' || subcommand === 'hub') {
    console.log(formatPresetsList());
  } else if (subcommand === 'add' || subcommand === 'install') {
    if (!arg1) {
      log('✖ Please specify an MCP server preset or name: mhai mcp add <name>', "\x1b[31m");
      log('💡 Run `node bin/index.js mcp presets` to view all available presets.');
      process.exit(1);
    }
    try {
      const customOptions = {};
      if (restArgs.length > 0) {
        customOptions.args = restArgs;
      }
      const { config: updatedConfig, serverDef, isPreset } = addMcpServer(config, arg1, customOptions);
      saveMcpConfig(updatedConfig, CWD);
      log(`✔ Added MCP server -> "${arg1}" ${isPreset ? '(from preset)' : '(custom)'}`);
      if (serverDef.env && Object.keys(serverDef.env).length > 0) {
        log(`ℹ Note: Requires environment variables: ${Object.keys(serverDef.env).join(', ')}`, "\x1b[33m");
      }
      build();
    } catch (err) {
      log(`✖ Failed to add MCP server: ${err.message}`, "\x1b[31m");
      process.exit(1);
    }
  } else if (subcommand === 'remove' || subcommand === 'rm' || subcommand === 'delete') {
    if (!arg1) {
      log('✖ Please specify the server name to remove: mhai mcp remove <name>', "\x1b[31m");
      process.exit(1);
    }
    const { config: updatedConfig, removed, reason } = removeMcpServer(config, arg1);
    if (!removed) {
      log(`✖ ${reason}`, "\x1b[31m");
      process.exit(1);
    }
    saveMcpConfig(updatedConfig, CWD);
    log(`✔ Removed MCP server -> "${arg1}"`);
    build();
  } else {
    // default: list
    console.log(formatMcpList(config));
  }
}

function showDiff(filterFile = null) {
  const config = loadConfig();
  const diffs = inspectDiffs(config, CWD, filterFile);

  if (diffs.length === 0) {
    log('✔ No drift detected. All target files are identical to canonical state.');
    return;
  }

  console.log('\n\x1b[1m\x1b[36m=== M.H. AI Sync Unified Diff Report ===\x1b[0m\n');
  for (const item of diffs) {
    console.log(item.diff);
    console.log('\n----------------------------------------\n');
  }
  log(`Found drift in ${diffs.length} file(s).`, "\x1b[33m");
  log('💡 Run `node bin/index.js merge` to absorb these changes into mhai.config.json, or `build` to overwrite with canonical state.');
}

function smartMerge(filterFile = null) {
  const config = loadConfig();
  log('Analyzing drifted files for rules and command changes...', "\x1b[36m");
  const mergeResult = mergeAllDriftedFiles(config, CWD, filterFile);

  if (!mergeResult.hasMerged) {
    log('ℹ No new rules or command updates were found to merge.');
    build();
    return;
  }

  for (const item of mergeResult.mergedFiles) {
    log(`✔ Merged updates from ${item.file}:`);
    for (const ch of item.changes) {
      if (ch.type === 'command') {
        console.log(`    • Updated command \x1b[32m"${ch.key}"\x1b[0m: ${ch.newVal}`);
      } else if (ch.type === 'rule') {
        console.log(`    • Absorbed new rule into \x1b[32m${ch.category}\x1b[0m: "${ch.rule}"`);
      }
    }
  }

  log('✔ Successfully absorbed changes into mhai.config.json');
  build();
}

function printHelp() {
  console.log(`
\x1b[1m\x1b[36mM.H. AI Sync CLI v1.9.0\x1b[0m
A Unified Bridge for Multi-Agent AI Coding Systems

\x1b[1mUSAGE:\x1b[0m
  node bin/index.js <command> [subcommand] [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32minit\x1b[0m          Auto-detect project stack & create customized mhai.config.json
  \x1b[32mbuild\x1b[0m (sync)   Compile canonical config into all AI formats:
                - CLAUDE.md (Claude Code)
                - AGENTS.md (Hermes, Aider, Open Standard)
                - ANTIGRAVITY.md (Google Antigravity)
                - .cursorrules (Legacy Cursor IDE)
                - .cursor/rules/*.mdc (Modern Cursor 2.0 Modular Rules)
                - skills/*/SKILL.md (Antigravity & Hermes Modular Skills)
                - .windsurfrules (Windsurf)
                - .github/copilot-instructions.md (GitHub Copilot)
                - .mcp.json (Model Context Protocol)
  \x1b[32mdiff\x1b[0m [file]    Show unified line-by-line colored diff of modified files on disk
  \x1b[32mmerge\x1b[0m [file]   3-Way merge: absorb manual/AI edits on disk back into mhai.config.json
  \x1b[32mmcp\x1b[0m           Manage Model Context Protocol (MCP) servers & Marketplace:
                - mcp                  : List configured MCP servers
                - mcp presets          : Browse built-in MCP server marketplace
                - mcp add <preset>     : Install MCP server and auto-sync .mcp.json
                - mcp remove <name>    : Remove MCP server and update .mcp.json
  \x1b[32mtask\x1b[0m (memory)  Manage shared active task memory across all AI agents:
                - task set "<goal>" [note] : Broadcast new task to all agents
                - task note "<note>"       : Append progress note
                - task clear               : Mark task finished and reset
                - task                     : Show current shared task status
  \x1b[32mwatch\x1b[0m         Start real-time live watcher to auto-sync on file changes
  \x1b[32mstatus\x1b[0m        Check synchronization status and detect rule drift
  \x1b[32maudit\x1b[0m (lint)   Scan instructions for exposed API keys, tokens & credentials
  \x1b[32manalyze\x1b[0m (tokens) Calculate token budget consumption & prompt health score
  \x1b[32mhook install\x1b[0m   Install native Git pre-commit hook to guard local commits
  \x1b[32mhook uninstall\x1b[0m Remove native Git pre-commit hook
  \x1b[32mworkspaces\x1b[0m (monorepo) Manage enterprise monorepos & subpackage workspaces:
                - workspaces               : Discover and list all workspace subpackages
                - workspaces sync          : Cascade root rules down to all subpackages
                - workspaces status        : Verify synchronization across all workspaces
  \x1b[32mimport <src>\x1b[0m   Import from 'claude', 'cursor', or 'agents' into mhai.config.json
  \x1b[32mhelp\x1b[0m           Show this help menu

\x1b[1mOPTIONS:\x1b[0m
  --check       When running 'status', exit with code 1 if drift or missing files detected
  --strict      When running 'audit', exit with code 1 if any credentials are found
  --redact      When running 'build', automatically redact detected secrets
  --merge       When running 'build' or 'sync', automatically merge disk edits first
  --workspaces  (or --all) Also compile or check across all monorepo workspaces
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
    if (args.includes('--merge')) {
      smartMerge();
    } else {
      build(args.includes('--redact'), args.includes('--workspaces') || args.includes('--all'));
    }
    break;
  case 'diff':
    showDiff(args[1]);
    break;
  case 'merge':
    smartMerge(args[1]);
    break;
  case 'watch':
    watch();
    break;
  case 'status':
    status(args.includes('--check'), args.includes('--workspaces') || args.includes('--all'));
    break;
  case 'audit':
  case 'lint':
    audit(args.includes('--strict'));
    break;
  case 'analyze':
  case 'tokens':
  case 'token':
    analyze();
    break;
  case 'mcp':
    manageMcp(args[1], args[2], ...args.slice(3));
    break;
  case 'task':
  case 'memory':
    manageTask(args[1], args[2], args[3]);
    break;
  case 'workspaces':
  case 'monorepo':
  case 'ws':
    manageWorkspaces(args[1] || 'list');
    break;
  case 'hook':
  case 'hooks':
    manageHook(args[1] || 'status');
    break;
  case 'ci':
  case 'github-action':
    setupCi();
    break;
  case 'import':
    importFrom(args[1] || 'claude');
    break;
  case 'help':
  default:
    printHelp();
    break;
}
