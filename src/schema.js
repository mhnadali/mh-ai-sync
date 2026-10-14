/**
 * M.H. AI Sync - Canonical Data Structures and Defaults
 */

const DEFAULT_CANONICAL_SCHEMA = {
  version: "1.0.0",
  project: {
    name: "AI-Augmented Project",
    overview: "Multi-agent context-aware codebase configured via M.H. AI Sync.",
    techStack: ["Node.js", "TypeScript / JavaScript"],
    architecture: "Modular layered architecture with AI agent support."
  },
  commands: {
    install: "npm install",
    build: "npm run build",
    test: "npm test",
    lint: "npm run lint",
    dev: "npm run dev"
  },
  guidelines: {
    codeStyle: [
      "Follow Clean Code and DRY principles.",
      "Write type-safe and self-documenting code with descriptive naming.",
      "Keep functions focused on a single responsibility."
    ],
    gitPractices: [
      "Use conventional commits (feat:, fix:, chore:, refactor:).",
      "Do not push broken builds or failing tests."
    ],
    agentRules: [
      "Preserve existing comments and docstrings.",
      "Always verify syntax and run test suites before finalizing changes.",
      "Prefer minimal and surgical edits over rewriting entire files."
    ]
  },
  skills: [
    {
      name: "git-workflow",
      description: "Handles repository staging, commits, and branch management safely.",
      instructions: "Always inspect git status before staging. Write descriptive, conventional commit messages."
    },
    {
      name: "test-runner",
      description: "Executes test suites and parses error stack traces.",
      instructions: "Run project tests, parse failure stack traces, and verify fixes without regressions."
    }
  ],
  modularRules: [
    {
      name: "code-standards",
      description: "Core coding guidelines and clean code practices",
      globs: "*",
      alwaysApply: true,
      rules: [
        "Follow Clean Code and DRY principles.",
        "Write type-safe and self-documenting code with descriptive naming.",
        "Keep functions focused on a single responsibility."
      ]
    },
    {
      name: "testing-policy",
      description: "Automated test writing and verification rules",
      globs: "**/*.{test,spec}.*",
      alwaysApply: false,
      rules: [
        "Ensure unit tests cover happy paths and edge cases.",
        "Do not leave failing tests before committing code."
      ]
    }
  ],
  mcpServers: {
    "gemini-docs": {
      command: "npx",
      args: ["-y", "@google/gemini-docs-mcp"]
    },
    "filesystem": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  },
  settings: {
    strategy: "compile" // "compile" (generate full file) or "reference" (e.g. @AGENTS.md transclusion)
  }
};

module.exports = {
  DEFAULT_CANONICAL_SCHEMA
};
