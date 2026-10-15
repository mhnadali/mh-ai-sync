/**
 * M.H. AI Sync - Enterprise Monorepo & Multi-Workspace Engine
 * Discovers subpackages, manages cascading rule inheritance, and synchronizes
 * AI agent contexts across all workspaces (Turborepo, Nx, pnpm, Cargo, npm/yarn).
 */

const fs = require('fs');
const path = require('path');
const { detectStack } = require('./detectors');
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
  generateMcpConfig,
  generateClineRules,
  generateRooModes,
  generateAiderConventions,
  generateAiderConfig,
  generateContinueRules,
  generateZedInstructions
} = require('./generators');
const { loadTaskState, saveTaskState, clearActiveTask, generateTaskBanner } = require('./task');
const { checkStatus } = require('./status');

/**
 * Parses globs from pnpm-workspace.yaml or package.json
 */
function extractWorkspacePatterns(rootDir = process.cwd()) {
  const patterns = [];

  // 1. Check pnpm-workspace.yaml
  const pnpmPath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmPath)) {
    try {
      const content = fs.readFileSync(pnpmPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith("'") || trimmed.startsWith('"')) {
          const clean = trimmed.replace(/^[-'"\s]+|['",\s]+$/g, '');
          if (clean && !clean.startsWith('#') && clean !== 'packages:') {
            patterns.push(clean);
          }
        }
      }
    } catch {}
  }

  // 2. Check package.json workspaces
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (Array.isArray(pkg.workspaces)) {
        patterns.push(...pkg.workspaces);
      } else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
        patterns.push(...pkg.workspaces.packages);
      }
    } catch {}
  }

  // 3. Check lerna.json
  const lernaPath = path.join(rootDir, 'lerna.json');
  if (fs.existsSync(lernaPath)) {
    try {
      const lerna = JSON.parse(fs.readFileSync(lernaPath, 'utf8'));
      if (Array.isArray(lerna.packages)) {
        patterns.push(...lerna.packages);
      }
    } catch {}
  }

  // 4. Check Cargo.toml [workspace]
  const cargoPath = path.join(rootDir, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const cargoContent = fs.readFileSync(cargoPath, 'utf8');
      const membersMatch = cargoContent.match(/members\s*=\s*\[([\s\S]*?)\]/);
      if (membersMatch && membersMatch[1]) {
        const rawMembers = membersMatch[1].match(/"([^"]+)"|'([^']+)'/g);
        if (rawMembers) {
          for (const m of rawMembers) {
            const clean = m.replace(/['"]/g, '').trim();
            if (clean) patterns.push(clean);
          }
        }
      }
    } catch {}
  }

  // 5. Fallback conventional directory patterns
  if (patterns.length === 0) {
    patterns.push('apps/*', 'packages/*', 'services/*', 'libs/*');
  }

  return [...new Set(patterns)];
}

const IGNORED_WORKSPACE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'target', 'coverage',
  '.turbo', '.git', '.next', '.nuxt', '.output', '.cache'
]);

/**
 * Discovers all workspace subpackages in the repository.
 */
function discoverWorkspaces(rootDir = process.cwd()) {
  const patterns = extractWorkspacePatterns(rootDir);
  const workspaces = [];
  const seenPaths = new Set();

  for (const pattern of patterns) {
    // Standard folder pattern: e.g. "packages/*", "apps/*", "services"
    const baseDir = pattern.replace(/\/\*.*$/, '');
    const isWildcard = pattern.includes('*');

    const fullBaseDir = path.join(rootDir, baseDir);
    if (!fs.existsSync(fullBaseDir)) continue;

    try {
      const stat = fs.statSync(fullBaseDir);
      if (!stat.isDirectory()) continue;

      if (!isWildcard) {
        // Direct single workspace directory
        const norm = path.resolve(fullBaseDir);
        if (!seenPaths.has(norm)) {
          seenPaths.add(norm);
          const detected = detectStack(fullBaseDir);
          workspaces.push({
            name: path.basename(fullBaseDir),
            relativePath: baseDir.replace(/\\/g, '/'),
            fullPath: fullBaseDir,
            techStack: detected.techStack,
            commands: detected.commands
          });
        }
      } else {
        // Wildcard directory traversal
        const entries = fs.readdirSync(fullBaseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && !IGNORED_WORKSPACE_DIRS.has(entry.name)) {
            const subDir = path.join(fullBaseDir, entry.name);
            const norm = path.resolve(subDir);
            if (!seenPaths.has(norm)) {
              seenPaths.add(norm);
              const detected = detectStack(subDir);
              const rel = path.join(baseDir, entry.name).replace(/\\/g, '/');

              workspaces.push({
                name: entry.name,
                relativePath: rel,
                fullPath: subDir,
                techStack: detected.techStack,
                commands: detected.commands
              });
            }
          }
        }
      }
    } catch {}
  }

  return workspaces;
}

/**
 * Resolves a scoped configuration for a workspace, inheriting root rules and
 * combining with local package stack and commands.
 */
function resolveWorkspaceConfig(rootConfig, workspace) {
  const base = JSON.parse(JSON.stringify(sanitize(rootConfig)));

  // If workspace has its own local mhai.config.json, merge it
  const localConfigPath = path.join(workspace.fullPath, 'mhai.config.json');
  let localConfig = {};
  if (fs.existsSync(localConfigPath)) {
    try {
      localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    } catch {}
  }

  const mergedConfig = {
    version: rootConfig.version || '1.0.0',
    project: {
      name: `${base.project.name} [${workspace.name}]`,
      overview: `${base.project.overview} (Scoped workspace: ${workspace.name})`,
      techStack: [...new Set([...(workspace.techStack || []), ...(localConfig.project?.techStack || [])])],
      architecture: localConfig.project?.architecture || base.project.architecture
    },
    commands: {
      ...base.commands,
      ...(workspace.commands || {}),
      ...(localConfig.commands || {})
    },
    guidelines: {
      codeStyle: [...new Set([...base.guidelines.codeStyle, ...(localConfig.guidelines?.codeStyle || [])])],
      gitPractices: [...new Set([...base.guidelines.gitPractices, ...(localConfig.guidelines?.gitPractices || [])])],
      agentRules: [...new Set([
        ...base.guidelines.agentRules,
        `Scoped workspace rule: Focus changes within ${workspace.relativePath} without breaking shared contracts.`,
        ...(localConfig.guidelines?.agentRules || [])
      ])]
    },
    skills: [...base.skills, ...(localConfig.skills || [])],
    modularRules: [...base.modularRules, ...(localConfig.modularRules || [])],
    mcpServers: { ...base.mcpServers, ...(localConfig.mcpServers || {}) },
    settings: base.settings
  };

  return sanitize(mergedConfig);
}

/**
 * Synchronizes AI contexts across all discovered workspaces in the monorepo.
 */
function syncAllWorkspaces(rawRootConfig, rootDir = process.cwd(), taskBanner = "") {
  const rootConfig = sanitize(rawRootConfig);
  const workspaces = discoverWorkspaces(rootDir);
  const results = [];

  const rootTaskState = loadTaskState(rootDir);
  const effectiveBanner = taskBanner || generateTaskBanner(rootTaskState);

  for (const ws of workspaces) {
    const wsConfig = resolveWorkspaceConfig(rootConfig, ws);
    const targetDir = ws.fullPath;

    // Propagate shared task state to workspace
    if (rootTaskState.activeTask && rootTaskState.status !== 'idle') {
      saveTaskState(rootTaskState, targetDir);
    } else {
      clearActiveTask(targetDir);
    }

    // 1. CLAUDE.md
    fs.writeFileSync(path.join(targetDir, 'CLAUDE.md'), generateClaudeMd(wsConfig, effectiveBanner), 'utf8');

    // 2. AGENTS.md
    fs.writeFileSync(path.join(targetDir, 'AGENTS.md'), generateAgentsMd(wsConfig, effectiveBanner), 'utf8');

    // 3. ANTIGRAVITY.md
    fs.writeFileSync(path.join(targetDir, 'ANTIGRAVITY.md'), generateAntigravityConfig(wsConfig, effectiveBanner), 'utf8');

    // 4. .cursorrules
    fs.writeFileSync(path.join(targetDir, '.cursorrules'), generateCursorRules(wsConfig, effectiveBanner), 'utf8');

    // 5. .windsurfrules
    fs.writeFileSync(path.join(targetDir, '.windsurfrules'), generateWindsurfRules(wsConfig), 'utf8');

    // 6. .github/copilot-instructions.md
    const ghDir = path.join(targetDir, '.github');
    if (!fs.existsSync(ghDir)) fs.mkdirSync(ghDir, { recursive: true });
    fs.writeFileSync(path.join(ghDir, 'copilot-instructions.md'), generateCopilotInstructions(wsConfig), 'utf8');

    // 7. .mcp.json
    fs.writeFileSync(path.join(targetDir, '.mcp.json'), generateMcpConfig(wsConfig), 'utf8');

    // 8. .cursor/rules/*.mdc
    const cursorRulesDir = path.join(targetDir, '.cursor', 'rules');
    if (!fs.existsSync(cursorRulesDir)) fs.mkdirSync(cursorRulesDir, { recursive: true });
    const mdcFiles = generateCursorMdcRules(wsConfig);
    for (const [filename, content] of Object.entries(mdcFiles)) {
      fs.writeFileSync(path.join(cursorRulesDir, filename), content, 'utf8');
    }

    // 9. skills/*/SKILL.md
    const skillFiles = generateSkillFiles(wsConfig);
    for (const [relPath, content] of Object.entries(skillFiles)) {
      const fullSkillPath = path.join(targetDir, relPath);
      const skillDir = path.dirname(fullSkillPath);
      if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(fullSkillPath, content, 'utf8');
    }

    // 10. .clinerules
    fs.writeFileSync(path.join(targetDir, '.clinerules'), generateClineRules(wsConfig, effectiveBanner), 'utf8');

    // 11. .roomodes
    fs.writeFileSync(path.join(targetDir, '.roomodes'), generateRooModes(wsConfig, effectiveBanner), 'utf8');

    // 12. CONVENTIONS.md
    fs.writeFileSync(path.join(targetDir, 'CONVENTIONS.md'), generateAiderConventions(wsConfig, effectiveBanner), 'utf8');

    // 13. .aider.conf.yml
    fs.writeFileSync(path.join(targetDir, '.aider.conf.yml'), generateAiderConfig(wsConfig), 'utf8');

    // 14. .continue/rules/project-rules.md
    const continueDir = path.join(targetDir, '.continue', 'rules');
    if (!fs.existsSync(continueDir)) fs.mkdirSync(continueDir, { recursive: true });
    fs.writeFileSync(path.join(continueDir, 'project-rules.md'), generateContinueRules(wsConfig, effectiveBanner), 'utf8');

    // 15. .zed/instructions.md
    const zedDir = path.join(targetDir, '.zed');
    if (!fs.existsSync(zedDir)) fs.mkdirSync(zedDir, { recursive: true });
    fs.writeFileSync(path.join(zedDir, 'instructions.md'), generateZedInstructions(wsConfig, effectiveBanner), 'utf8');

    results.push({
      workspace: ws.name,
      path: ws.relativePath,
      filesGenerated: 13 + Object.keys(mdcFiles).length + Object.keys(skillFiles).length
    });
  }

  return {
    workspacesCount: workspaces.length,
    results
  };
}

/**
 * Checks drift across all workspaces in monorepo.
 */
function checkWorkspacesStatus(rawRootConfig, rootDir = process.cwd()) {
  const rootConfig = sanitize(rawRootConfig);
  const workspaces = discoverWorkspaces(rootDir);
  const reports = [];

  let isAllClean = true;

  for (const ws of workspaces) {
    const wsConfig = resolveWorkspaceConfig(rootConfig, ws);
    const status = checkStatus(wsConfig, ws.fullPath);
    if (!status.isClean) isAllClean = false;

    reports.push({
      workspace: ws.name,
      path: ws.relativePath,
      status
    });
  }

  return {
    isAllClean,
    totalWorkspaces: workspaces.length,
    reports
  };
}

/**
 * Formats a terminal report of all workspaces.
 */
function formatWorkspacesReport(workspaces, statusReport = null) {
  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Monorepo Workspaces ===\x1b[0m\n');

  if (workspaces.length === 0) {
    lines.push('  No subpackage workspaces detected in repository.');
    lines.push('  (Checked pnpm-workspace.yaml, package.json#workspaces, and standard apps/*, packages/* conventions)');
  } else {
    for (const ws of workspaces) {
      lines.push(`  📁 \x1b[1m${ws.name}\x1b[0m (\x1b[33m${ws.relativePath}\x1b[0m)`);
      lines.push(`     Stack:    ${(ws.techStack || []).join(', ') || 'Standard'}`);
      if (ws.commands && Object.keys(ws.commands).length > 0) {
        lines.push(`     Commands: ${Object.entries(ws.commands).map(([k, v]) => `${k}="${v}"`).join(', ')}`);
      }
      lines.push('');
    }
  }

  lines.push('----------------------------------------');
  lines.push(`Discovered: ${workspaces.length} workspace(s).`);
  return lines.join('\n');
}

module.exports = {
  extractWorkspacePatterns,
  discoverWorkspaces,
  resolveWorkspaceConfig,
  syncAllWorkspaces,
  checkWorkspacesStatus,
  formatWorkspacesReport
};
