/**
 * M.H. AI Sync - GitHub Action CI/CD Generator
 * Generates automated workflows to verify rule synchronization and security in CI pipelines.
 */

const fs = require('fs');
const path = require('path');

function generateGitHubActionWorkflow() {
  return `name: AI Agent Context & Security Sync

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  ai-sync-verify:
    name: Verify AI Rules & Secret Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 🛡️ Security Audit (Scan for Leaked API Keys / Secrets)
        run: node bin/index.js audit --strict

      - name: ⚡ Synchronization Drift Check (Verify AI Rule Alignment)
        run: node bin/index.js status --check
`;
}

function installGitHubAction(rootDir = process.cwd()) {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  const targetPath = path.join(workflowDir, 'ai-sync-check.yml');
  fs.writeFileSync(targetPath, generateGitHubActionWorkflow(), 'utf-8');

  return {
    filePath: targetPath,
    relativePath: path.join('.github', 'workflows', 'ai-sync-check.yml')
  };
}

module.exports = {
  generateGitHubActionWorkflow,
  installGitHubAction
};
