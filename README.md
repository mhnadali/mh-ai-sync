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
├── .cursorrules                  # Target: Cursor IDE
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

### 3. Check Sync Status & Drift Detection
Inspect whether any AI config has drifted or been modified manually:
```bash
node bin/index.js status

# For CI/CD and pre-commit checks (exits with code 1 if drift detected):
node bin/index.js status --check
```

### 4. Bidirectional Import from Legacy Configs
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
