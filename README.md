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
- 🖥 **Interactive Terminal TUI & Web GUI Mission Control (`mhai dashboard` / `mhai ui`):** Live full-screen terminal dashboard with real-time sync meters, token budgets, and security posture, plus a local dark-mode Web GUI on port 3840 with REST API triggers.
- 🏢 **Enterprise Monorepo & Multi-Workspace Engine (`mhai workspaces`):** Auto-discover subpackages across Turborepo, Nx, and pnpm monorepos; cascade shared architectural contracts while preserving subpackage autonomy.
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
├── AGENTS.md                     # Target: Universal Standard (Hermes, Open Standard)
├── ANTIGRAVITY.md                # Target: Google Antigravity & Agent Runtimes
├── .cursorrules                  # Target: Legacy Cursor IDE
├── .cursor/
│   └── rules/                    # Target: Modern Cursor 2.0 Rules (*.mdc)
├── skills/                       # Target: Antigravity & Hermes Modular Skills (skills/*/SKILL.md)
├── .windsurfrules                # Target: Windsurf Cascade
├── .github/copilot-instructions.md # Target: GitHub Copilot
├── .mcp.json                     # Target: Model Context Protocol (MCP) Setup
├── .clinerules                   # Target: Cline AI Assistant
├── .roomodes                     # Target: Roo Code Custom Modes (JSON)
├── CONVENTIONS.md                # Target: Aider Repository Guidelines
├── .aider.conf.yml               # Target: Aider Configuration
├── .continue/rules/project-rules.md # Target: Continue.dev Custom Prompt Rules
└── .zed/instructions.md          # Target: Zed Editor Assistant Directives
```

---

## 🚀 Quick Start

### 1. Initialize Configuration (With Stack Auto-Detection)
Automatically detects your project language (Node.js, TypeScript, Python, Rust, Go), framework (Next.js, FastAPI, etc.), and commands:
```bash
node bin/index.js init
```

### 2. Synchronize All Agents
Compile your canonical configuration across all 16 AI targets simultaneously:
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

### 8. MCP Hub & Tool Marketplace Integrator
Easily browse, install, and manage Model Context Protocol (MCP) servers with automatic synchronization into `.mcp.json`:
```bash
# Browse built-in MCP server catalog/marketplace
node bin/index.js mcp presets

# Install an MCP server from presets (e.g. filesystem, fetch, github, postgres, sqlite, brave-search, memory)
node bin/index.js mcp add fetch
node bin/index.js mcp add sqlite

# List configured MCP servers
node bin/index.js mcp

# Remove an MCP server
node bin/index.js mcp remove fetch
```

### 9. Unified Line Diff & 3-Way Merge Engine
Inspect exact line-by-line differences between files on disk and canonical configurations, and absorb rogue rules back into `mhai.config.json`:
```bash
# View colored unified diffs for all drifted files (or a specific file)
node bin/index.js diff
node bin/index.js diff CLAUDE.md

# Intelligently absorb manual/AI edits on disk back into canonical schema & sync all agents
node bin/index.js merge

# Auto-merge before building:
node bin/index.js sync --merge
```

### 10. Enterprise Monorepo & Multi-Workspace Engine
Manage large-scale monorepos (Turborepo, Nx, pnpm, Cargo, npm/yarn) with cascading rule inheritance and subpackage auto-discovery:
```bash
# Discover all workspace subpackages (apps/*, packages/*, services/*, pnpm-workspace.yaml)
node bin/index.js workspaces

# Cascade canonical root rules down to all subpackages with local stack & command detection
node bin/index.js workspaces sync
# or compile root and workspaces in a single command:
node bin/index.js build --all

# Check synchronization drift across all monorepo workspaces:
node bin/index.js workspaces status
node bin/index.js status --workspaces --check
```

### 11. Interactive Terminal TUI & Web GUI Mission Control
Launch an interactive real-time dashboard in your terminal or view in your web browser:
```bash
# Launch interactive terminal TUI dashboard
node bin/index.js dashboard
# (or use alias)
node bin/index.js ui

# Launch local dark-mode Web GUI on http://localhost:3840
node bin/index.js dashboard --web
node bin/index.js dashboard --web --port 8080

# Print static snapshot and exit (ideal for scripts or CI reports)
node bin/index.js dashboard --snapshot
```

### 12. Check Sync Status & Drift Detection
Inspect whether any AI config has drifted or been modified manually:
```bash
node bin/index.js status

# For CI/CD and pre-commit checks (exits with code 1 if drift detected):
node bin/index.js status --check
```

### 13. Install GitHub Actions CI/CD Workflow
Automatically generate `.github/workflows/ai-sync-check.yml` to block out-of-sync PRs or secret leaks:
```bash
node bin/index.js ci
```

### 14. Bidirectional Import from Legacy Configs
Import your existing `CLAUDE.md` or `.cursorrules` files into the unified schema:
```bash
# Import from Claude Code configuration
node bin/index.js import claude

# Import from Cursor configuration
node bin/index.js import cursor

# Import from AGENTS.md
node bin/index.js import agents
```

### 15. Team & Remote Standards Registry (Phase 11)
Synchronize organization-wide AI guidelines, security baselines, and shared MCP servers from a centralized Git repo, URL, or shared network folder:
```bash
# Add a remote team standards registry (with policy locking)
node bin/index.js remote add org-standards https://github.com/my-org/ai-guidelines.git --locked

# List all configured remote registries
node bin/index.js remote list

# Pull and merge remote team standards into local project configuration
node bin/index.js pull org-standards

# Audit local project compliance against mandatory team policies
node bin/index.js remote check org-standards
```

### 16. AI Context Optimizer & Semantic Conflict Resolver (Phase 13)
Analyze guidelines for contradictory rules, eliminate conversational bloat to maximize LLM reasoning bandwidth, and view compression analytics:
```bash
# Analyze rules for conversational bloat & preview token savings
node bin/index.js optimize

# Automatically apply compressed, imperative guidelines to mhai.config.json
node bin/index.js optimize --apply

# Check guidelines for semantic contradictions across categories
node bin/index.js conflicts

# Enforce zero contradictions in CI/CD pipelines (exits code 1 on conflict)
node bin/index.js conflicts --strict
```

### 17. Context Versioning, Snapshots & Time-Machine Rollback (Phase 14)
Capture point-in-time snapshots of AI context, view chronological history and unified diffs, and revert canonical rules with automatic pre-rollback safety checkpoints:
```bash
# Save a named context snapshot with custom message
node bin/index.js snapshot save v1.0-baseline -m "Project baseline before refactor"

# List all historical context snapshots (sorted newest first)
node bin/index.js snapshot list

# Diff current project guidelines against a previous snapshot (@0, @1, tag)
node bin/index.js snapshot diff v1.0-baseline

# Roll back canonical context and auto-realign all 16 AI targets immediately
node bin/index.js rollback v1.0-baseline

# Prune older checkpoints retaining only the newest N snapshots
node bin/index.js snapshot prune 20
```

### 18. AI Agent Simulator & Rule Compliance Sandbox (Phase 15)
Simulate developer prompts and risky boundary scenarios against active guidelines to measure agent obedience and discover unguarded failure modes:
```bash
# Run benchmark simulation suite across all standard risk vectors
node bin/index.js simulate

# Test a custom developer prompt or action against active project rules
node bin/index.js simulate "Can you rewrite this entire file from scratch?"

# Enforce strict compliance in CI/CD (exits code 1 if score < 75% or critical risks)
node bin/index.js simulate --strict
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

## 🤖 Supported AI Ecosystem Matrix

| AI Assistant / Agent | Config Output Target | Format & Capabilities |
|:---|:---|:---|
| **Claude Code** | `CLAUDE.md` | Single file, `@AGENTS.md` reference transclusion mode, active task banner |
| **Google Antigravity** | `ANTIGRAVITY.md` | Directives, modular skills catalog, workflow rules |
| **Antigravity & Hermes Skills**| `skills/*/SKILL.md` | Modular skill packages with YAML frontmatter |
| **Modern Cursor 2.0** | `.cursor/rules/*.mdc` | Scoped glob matching (`globs`), descriptions, `alwaysApply` flags |
| **Legacy Cursor** | `.cursorrules` | Direct project guidelines and agent constraints |
| **Windsurf (Cascade)** | `.windsurfrules` | Cascade workspace directives & style conventions |
| **GitHub Copilot** | `.github/copilot-instructions.md`| Repository-level copilot instructions |
| **Hermes / Open Standard** | `AGENTS.md` | Multi-agent universal context standard |
| **Cline** | `.clinerules` | Architectural guidelines, system prompt constraints |
| **Roo Code** | `.roomodes` | Custom modes (Architect, Code, Debug, Ask) with custom tool groups |
| **Aider** | `CONVENTIONS.md`, `.aider.conf.yml` | Conventions transclusion, git commit formatting |
| **Continue.dev** | `.continue/rules/project-rules.md` | Context-aware rules & system instructions |
| **Zed Editor** | `.zed/instructions.md` | Slash command rules and assistant configuration |
| **Model Context Protocol (MCP)** | `.mcp.json` | Protocol server declarations, arguments, and environment keys |

---

## 🧪 Testing & Verification

The project includes 21 comprehensive test suites verifying functionality, edge cases, defensive sanitization, optimizer conflict resolution, context snapshots & rollback, agent simulation sandbox, and end-to-end sandbox operations:

```bash
# Run all 21 test suites (Phase 1 through 15 + Deep Audits + E2E)
npm test

# Run individual test suites
node test_deep_audit_v2_5.js # Deep architectural audit & bug resolution verification
node test_phase15.js      # AI agent simulator & compliance sandbox tests
node test_phase14.js      # Context versioning, snapshots & rollback tests
node test_phase13.js      # Context optimizer & conflict resolver tests
node test_phase12.js      # Cline, Roo, Aider, Continue, Zed generators
node test_deep.js         # Deep sanitization & crash-immunity tests
node test_e2e.js          # Full E2E import/export stress tests
node test_audit_deep.js   # Edge-case & modular scanner tests
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by **M.H. Nadali** (Single Source of Truth for Multi-Agent AI Coding).

