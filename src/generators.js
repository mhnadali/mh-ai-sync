/**
 * M.H. AI Sync - Generators with Defensive Null-safety & Multi-Directory Modules
 */

function sanitize(rawConfig) {
  const config = (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) ? rawConfig : {};
  const project = (config.project && typeof config.project === 'object' && !Array.isArray(config.project)) ? config.project : {};
  const guidelines = (config.guidelines && typeof config.guidelines === 'object' && !Array.isArray(config.guidelines)) ? config.guidelines : {};
  const commands = (config.commands && typeof config.commands === 'object' && !Array.isArray(config.commands)) ? config.commands : {};
  const mcpServers = (config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers)) ? config.mcpServers : {};

  const skills = Array.isArray(config.skills)
    ? config.skills
        .filter(s => s && typeof s === 'object' && typeof s.name === 'string')
        .map(s => ({
          name: s.name.trim().replace(/[/\\:*?"<>|]/g, '-').trim(),
          description: typeof s.description === 'string' ? s.description.trim() : 'General capability',
          instructions: typeof s.instructions === 'string' ? s.instructions.trim() : (typeof s.description === 'string' ? s.description.trim() : 'Follow standard project conventions.')
        }))
    : [];

  const modularRules = Array.isArray(config.modularRules)
    ? config.modularRules
        .filter(r => r && typeof r === 'object' && typeof r.name === 'string')
        .map(r => ({
          name: r.name.trim().replace(/[/\\:*?"<>|]/g, '-').trim(),
          description: typeof r.description === 'string' ? r.description.trim() : 'Modular rule',
          globs: typeof r.globs === 'string' ? r.globs.trim() : '*',
          alwaysApply: typeof r.alwaysApply === 'boolean' ? r.alwaysApply : true,
          rules: Array.isArray(r.rules) ? r.rules.filter(x => typeof x === 'string') : []
        }))
    : [];

  const remotes = (config.remotes && typeof config.remotes === 'object' && !Array.isArray(config.remotes)) ? config.remotes : {};
  const lockedGuidelines = Array.isArray(config.lockedGuidelines) ? config.lockedGuidelines.filter(x => typeof x === 'string') : [];

  return {
    project: {
      name: typeof project.name === 'string' && project.name.trim() ? project.name.trim() : "AI-Augmented Project",
      overview: typeof project.overview === 'string' && project.overview.trim() ? project.overview.trim() : "Context-aware codebase configured with M.H. AI Sync.",
      techStack: Array.isArray(project.techStack) ? project.techStack.filter(x => typeof x === 'string') : [],
      architecture: typeof project.architecture === 'string' && project.architecture.trim() ? project.architecture.trim() : "Standard modular architecture."
    },
    commands: Object.fromEntries(
      Object.entries(commands).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
    ),
    guidelines: {
      codeStyle: Array.isArray(guidelines.codeStyle) ? guidelines.codeStyle.filter(x => typeof x === 'string') : [],
      gitPractices: Array.isArray(guidelines.gitPractices) ? guidelines.gitPractices.filter(x => typeof x === 'string') : [],
      agentRules: Array.isArray(guidelines.agentRules) ? guidelines.agentRules.filter(x => typeof x === 'string') : []
    },
    skills,
    modularRules,
    mcpServers,
    remotes,
    lockedGuidelines,
    settings: {
      strategy: config.settings?.strategy === 'reference' ? 'reference' : 'compile'
    }
  };
}

function generateClaudeMd(rawConfig, taskBanner = "") {
  const config = sanitize(rawConfig);
  if (config.settings.strategy === 'reference') {
    return `# Claude Code Configuration (${config.project.name})

${taskBanner}@AGENTS.md
`;
  }

  const techStackList = config.project.techStack.length ? config.project.techStack.map(t => `- ${t}`).join('\n') : '- Standard modern stack';
  const cmdList = Object.keys(config.commands).length ? Object.entries(config.commands).map(([cmd, script]) => `- \`${cmd}\`: \`${script}\``).join('\n') : '- None specified';
  const codeStyleList = config.guidelines.codeStyle.length ? config.guidelines.codeStyle.map(s => `- ${s}`).join('\n') : '- Follow standard clean code principles.';
  const agentRulesList = config.guidelines.agentRules.length ? config.guidelines.agentRules.map(r => `- ${r}`).join('\n') : '- Preserve existing code conventions and tests.';

  let modularSection = '';
  if (config.modularRules.length > 0) {
    modularSection = `\n## Modular Scoped Rules\n` + config.modularRules.map(r => {
      const header = `### ${r.name} (globs: \`${r.globs}\`)\n> ${r.description}`;
      const rules = r.rules.map(rule => `- ${rule}`).join('\n');
      return `${header}\n${rules}`;
    }).join('\n\n') + '\n';
  }

  return `# Claude Code Configuration (${config.project.name})

${taskBanner}## Overview
${config.project.overview}

## Tech Stack
${techStackList}

## Build & Test Commands
${cmdList}

## Architecture & Conventions
${config.project.architecture}

## Code Style & Guidelines
${codeStyleList}

## Agent Guidelines & Critical Rules
${agentRulesList}
${modularSection}`;
}

function generateAgentsMd(rawConfig, taskBanner = "") {
  const config = sanitize(rawConfig);
  const cmdList = Object.keys(config.commands).length ? Object.entries(config.commands).map(([cmd, script]) => `- **${cmd}**: \`${script}\``).join('\n') : '- **none**: `none`';
  const codeStyleList = config.guidelines.codeStyle.length ? config.guidelines.codeStyle.map(s => `- ${s}`).join('\n') : '- Standard Clean Code principles';
  const gitPracticesList = config.guidelines.gitPractices.length ? config.guidelines.gitPractices.map(g => `- ${g}`).join('\n') : '- Use conventional commits';
  const agentRulesList = config.guidelines.agentRules.length ? config.guidelines.agentRules.map(r => `- ${r}`).join('\n') : '- Write safe, tested, and maintainable code';

  let modularSection = '';
  if (config.modularRules.length > 0) {
    modularSection = `\n## Scoped Domain Policies\n` + config.modularRules.map(r => {
      const header = `### ${r.name} (applies to: \`${r.globs}\`)\n_${r.description}_`;
      const rules = r.rules.map(rule => `- ${rule}`).join('\n');
      return `${header}\n${rules}`;
    }).join('\n\n') + '\n';
  }

  return `# AGENTS.md - Universal Agent Context Standard

> Project: ${config.project.name}
> Generated via M.H. AI Sync (Single Source of Truth)

${taskBanner}## Overview
${config.project.overview}

## Commands & Workflows
${cmdList}

## Development Rules
### Code Style
${codeStyleList}

### Git Workflow
${gitPracticesList}

### Agent Constraints
${agentRulesList}
${modularSection}`;
}

function generateAntigravityConfig(rawConfig, taskBanner = "") {
  const config = sanitize(rawConfig);
  const cmdList = Object.keys(config.commands).length ? Object.entries(config.commands).map(([cmd, script]) => `- Task [${cmd}]: \`${script}\``).join('\n') : '- No standard tasks defined.';
  const agentRulesList = config.guidelines.agentRules.length ? config.guidelines.agentRules.map(r => `- DIRECTIVE: ${r}`).join('\n') : '- DIRECTIVE: Follow workspace safety guidelines.';
  const skillsList = config.skills.length ? config.skills.map(s => `- **${s.name}**: ${s.description}\n  ${s.instructions}`).join('\n') : '- General developer capabilities';

  return `# Google Antigravity & Hermes Context

${taskBanner}## Project Definition
Name: ${config.project.name}
Description: ${config.project.overview}

## Core Execution Tasks
${cmdList}

## Agent Behavioral Directives
${agentRulesList}

## Skills Available
${skillsList}
`;
}

function generateCursorRules(rawConfig, taskBanner = "") {
  const config = sanitize(rawConfig);
  const agentRulesList = config.guidelines.agentRules.length ? config.guidelines.agentRules.map(r => `- ${r}`).join('\n') : '- Follow project best practices.';
  const codeStyleList = config.guidelines.codeStyle.length ? config.guidelines.codeStyle.map(s => `- ${s}`).join('\n') : '- Clean, readable and modular.';
  const cmdList = Object.keys(config.commands).length ? Object.entries(config.commands).map(([cmd, script]) => `- ${cmd}: ${script}`).join('\n') : '- None';

  return `# Cursor Rules
You are an expert AI software engineer assisting in this repository.

${taskBanner}## Rules & Constraints
${agentRulesList}

## Code Style
${codeStyleList}

## Common Commands
${cmdList}
`;
}

function generateCursorMdcRules(rawConfig) {
  const config = sanitize(rawConfig);
  const files = {};

  // 1. General project rules
  const generalRules = [
    ...config.guidelines.agentRules,
    ...config.guidelines.codeStyle
  ];
  const generalBody = generalRules.length > 0 ? generalRules.map(r => `- ${r}`).join('\n') : '- Follow standard clean code conventions.';

  files['project-rules.mdc'] = `---
description: Universal project conventions and coding standards
globs: *
alwaysApply: true
---

# Project Conventions
${generalBody}
`;

  // 2. Modular Scoped Rules
  for (const rule of config.modularRules) {
    const filename = `${rule.name}.mdc`;
    const ruleItems = rule.rules.length > 0 ? rule.rules.map(r => `- ${r}`).join('\n') : '- Maintain strict consistency with project specifications.';

    files[filename] = `---
description: ${rule.description}
globs: ${rule.globs}
alwaysApply: ${rule.alwaysApply}
---

# ${rule.name}
> ${rule.description}

## Rules
${ruleItems}
`;
  }

  return files;
}

function generateSkillFiles(rawConfig) {
  const config = sanitize(rawConfig);
  const files = {};

  for (const skill of config.skills) {
    const filePath = `skills/${skill.name}/SKILL.md`;
    files[filePath] = `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name}

> ${skill.description}

## Instructions
${skill.instructions}
`;
  }

  return files;
}

function generateWindsurfRules(rawConfig) {
  const config = sanitize(rawConfig);
  const rules = [...config.guidelines.agentRules, ...config.guidelines.codeStyle];
  const rulesList = rules.length ? rules.map(r => `- ${r}`).join('\n') : '- Maintain strict consistency with the codebase.';

  return `# Windsurf Cascade Directives
Project: ${config.project.name}

## Context
${config.project.overview}

## Guidelines
${rulesList}
`;
}

function generateCopilotInstructions(rawConfig) {
  const config = sanitize(rawConfig);
  const rules = [...config.guidelines.codeStyle, ...config.guidelines.agentRules];
  const rulesList = rules.length ? rules.map(r => `- ${r}`).join('\n') : '- Keep code clean and well-structured.';

  return `# GitHub Copilot Instructions
${config.project.overview}

## Development Guidelines
${rulesList}
`;
}

function generateMcpConfig(rawConfig) {
  const config = sanitize(rawConfig);
  return JSON.stringify({
    mcpServers: config.mcpServers
  }, null, 2);
}

module.exports = {
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
};
