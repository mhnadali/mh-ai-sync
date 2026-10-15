# M.H. AI Sync 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Universal Agent Standard](https://img.shields.io/badge/Agentic_AI-Universal_Context-9cf.svg)](https://github.com/agentic-ai-foundation/agents.md)

> **A High-Performance Universal Multi-Agent Bridge & Context Synchronizer for Modern AI Coding Environments**

`M.H. AI Sync` is an production-grade bidirectional synchronization engine that seamlessly unifies project context, instructions, skills, shell tasks, coding conventions, and MCP (Model Context Protocol) configurations across major AI coding agents: **Claude Code (`CLAUDE.md`)**, **Google Antigravity (`ANTIGRAVITY.md`)**, **Hermes / Open Standard (`AGENTS.md`)**, **Cursor (`.cursorrules`)**, **Windsurf (`.windsurfrules`)**, and **GitHub Copilot (`copilot-instructions.md`)**.

---

## 💡 Why M.H. AI Sync?

Modern AI software development suffers from **"Rule Drift"** and fragmented context configurations. Each AI agent enforces its own proprietary instructions format:
* Claude Code requires `CLAUDE.md`.
* Cursor requires `.cursorrules`.
* GitHub Copilot looks for `.github/copilot-instructions.md`.
* Windsurf Cascade parses `.windsurfrules`.
* Google Antigravity & Hermes leverage `ANTIGRAVITY.md` and `AGENTS.md`.

`M.H. AI Sync` solves this fragmentation by providing a **Single Source of Truth (`mhai.config.json`)** with bidirectional import capabilities and instantaneous, null-safe compilation into all target agent formats.

---

## 🌟 Features

- ⚡ **Single Source of Truth:** Centralize project overview, tech stack, build/test scripts, agent safety directives, and skills in a clean JSON schema.
- 🧮 **Token Budget & Prompt Health Analyzer (`mhai analyze`):** Calculate exact token consumption per agent, detect duplicate rules, and measure prompt dilution risk with a 0-100 Prompt Health Score.
- 🪝 **Native Git Hooks (`mhai hook install`):** Zero-dependency pre-commit hook that automatically blocks local commits if secret keys leak or AI contexts drift.
- 🎯 **Modern Cursor 2.0 (`.cursor/rules/*.mdc`):** Generates modular Cursor rules with scoped file glob matching (`globs`), descriptions, and `alwaysApply` flags.
- 🌌 **Antigravity & Hermes Skills Packager:** Compiles modular skills into standard `skills/<skill>/SKILL.md` packages with structured YAML frontmatter.
- 🔍 **Stack Auto-Detector:** Automatically inspects project workspace to configure Node.js, Python, Rust, Go, frameworks, and commands.
- 📊 **Drift Detection & CI/CD Status:** Easily audit whether manual changes broke synchronization (`node bin/index.js status --check`).
- 🔄 **Bidirectional Migration:** Effortlessly import existing legacy `CLAUDE.md` or `.cursorrules` into a canonical format without losing guidelines or commands.
- 🛡 **Defensive & Fault-Tolerant:** Built with robust sanitization and regex parsing that gracefully handles malformed inputs, corrupted files, and sparse structures.
- 🔌 **Native Model Context Protocol (MCP) Integration:** Auto-compiles `.mcp.json` tool declarations alongside project context.
- 🧪 **Zero-Dependency Core:** Runs natively on Node.js without heavy external dependencies.

---

## 📦 File Architecture & Mappings

```text
├── mhai.config.json              # Canonical Master Config (Source of Truth)
│
├── CLAUDE.md                     # Target: Claude Code CLI
├── AGENTS.md                     # Target: Universal Standard (Hermes, Aider, etc.)
├── ANTIGRAVITY.md                # Target: Google Antigravity & Agent Runtimes
├── .cursorrules                  # Target: Legacy Cursor IDE
├── .cursor/
│   └── rules/                    # Target: Modern Cursor 2.0 Rules
│       ├── project-rules.mdc
│       └── *.mdc (scoped domain rules)
├── skills/                       # Target: Antigravity & Hermes Modular Skills
│   └── <skill-name>/
│       └── SKILL.md
├── .windsurfrules                # Target: Windsurf Cascade
├── .github/
│   └── copilot-instructions.md   # Target: GitHub Copilot
└── .mcp.json                     # Target: Model Context Protocol (MCP) Server Setup
```

---

## 🚀 Quick Start

### 1. Initialize Configuration (With Stack Auto-Detection)
Automatically detects your project language (Node.js, TypeScript, Python, Rust, Go), framework (Next.js, FastAPI, etc.), and commands:
```bash
node bin/index.js init
```

### 2. Synchronize All Agents
Compile your canonical configuration across all 7 AI targets:
```bash
node bin/index.js build
# or
node bin/index.js sync
```

### 3. Real-Time Live Watcher (Auto-Sync)
Keep all AI files continuously synchronized in background as you edit `mhai.config.json`:
```bash
node bin/index.js watch
```

### 4. Security Audit & Credential Scanner
Scan instructions and canonical configs to ensure no API keys or tokens are leaked:
```bash
node bin/index.js audit

# For CI/CD blocking (exits with code 1 on findings):
node bin/index.js audit --strict

# Automatically sanitize & redact secrets when building:
node bin/index.js build --redact
```

### 5. Prompt Health & Token Budget Analyzer
Analyze LLM token footprint per agent, uncover duplicate rules, and measure prompt dilution risk:
```bash
node bin/index.js analyze
```

### 6. Native Git Hooks (Pre-Commit Guard)
Install zero-dependency Git hooks to verify security & synchronization before every local commit:
```bash
# Install local pre-commit hook
node bin/index.js hook install

# Check hook status
node bin/index.js hook

# Uninstall hook if needed
node bin/index.js hook uninstall
```

### 7. Shared Agent Memory & Active Task Bridge
Broadcast an active working task and real-time progress notes to all AI agents seamlessly:
```bash
# Set active goal across Claude, Antigravity, and Cursor
node bin/index.js task set "Refactor auth middleware to OAuth2" "Database schema migration applied"

# Add progress notes as you work
node bin/index.js task note "Updated bearer token verification tests"

# Check active task status
node bin/index.js task

# Clear active task when done
node bin/index.js task clear
```

### 8. Check Sync Status & Drift Detection
Inspect whether any AI config has drifted or been modified manually:
```bash
node bin/index.js status

# For CI/CD and pre-commit checks (exits with code 1 if drift detected):
node bin/index.js status --check
```

### 9. Install GitHub Actions CI/CD Workflow
Automatically generate `.github/workflows/ai-sync-check.yml` to block out-of-sync PRs or secret leaks:
```bash
node bin/index.js ci
```

### 10. Bidirectional Import from Legacy Configs
Import your existing `CLAUDE.md` or `.cursorrules` files into the unified schema:
```bash
# Import from Claude Code configuration
node bin/index.js import claude

# Import from Cursor configuration
node bin/index.js import cursor

# Import from AGENTS.md
node bin/index.js import agents
```

---

## ⚙️ Configuration Schema (`mhai.config.json`)

```json
{
  "version": "1.0.0",
  "project": {
    "name": "My-Awesome-App",
    "overview": "High-performance full-stack web application.",
    "techStack": ["Node.js", "TypeScript", "PostgreSQL"],
    "architecture": "Event-driven microservices architecture."
  },
  "commands": {
    "install": "npm install",
    "build": "npm run build",
    "test": "npm test",
    "lint": "npm run lint",
    "dev": "npm run dev"
  },
  "guidelines": {
    "codeStyle": [
      "Follow Clean Code and DRY principles.",
      "Write type-safe and self-documenting code."
    ],
    "gitPractices": [
      "Use conventional commits (feat:, fix:, chore:).",
      "Do not push broken builds or failing tests."
    ],
    "agentRules": [
      "Preserve existing comments and docstrings.",
      "Prefer minimal and surgical edits over rewriting entire files."
    ]
  },
  "skills": [
    {
      "name": "git-workflow",
      "description": "Handles branch management and pull requests."
    }
  ],
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

---

## 🧪 Testing & Verification

Run the end-to-end and deep sanitization audit test suites:
```bash
# Run unit & defensive sanitization tests
node test_deep.js

# Run full 0-to-100 End-to-End stress test
node test_e2e.js
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
