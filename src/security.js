/**
 * M.H. AI Sync - Security Linter & Secret Redactor
 * Scans AI agent instructions and canonical configs for accidentally committed API keys,
 * tokens, connection strings, and private credentials.
 */

const SECRET_PATTERNS = [
  { name: 'GitHub Personal Access Token (Classic)', regex: /ghp_[a-zA-Z0-9]{36,40}/g },
  { name: 'GitHub Fine-Grained Token', regex: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g },
  { name: 'OpenAI API Key', regex: /\bsk-(?!ant-)[a-zA-Z0-9_\-]{20,64}/g },
  { name: 'Anthropic API Key', regex: /\bsk-ant-[a-zA-Z0-9_\-]{20,80}/g },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Database Connection URI with Credentials', regex: /[a-zA-Z0-9_]+:\/\/[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9.-]+:[0-9]+/g },
  { name: 'Slack Bot Token', regex: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/g },
  { name: 'Generic Bearer Token in Text', regex: /Bearer\s+[a-zA-Z0-9_\-\.]{30,}/g }
];

function scanText(content = "", filename = "unknown") {
  if (typeof content !== 'string') return [];
  const findings = [];

  const lines = content.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    for (const pattern of SECRET_PATTERNS) {
      // Reset regex state
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          file: filename,
          rule: pattern.name,
          line: lineIndex + 1,
          matchedSnippet: match[0].length > 12 ? `${match[0].substring(0, 4)}...${match[0].substring(match[0].length - 4)}` : '***'
        });
      }
    }
  }

  return findings;
}

function redactSecrets(content = "") {
  if (typeof content !== 'string') return content;
  let redacted = content;

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    redacted = redacted.replace(pattern.regex, '[REDACTED_SECRET]');
  }

  return redacted;
}

function auditConfig(config, rootDir = process.cwd()) {
  const fs = require('fs');
  const path = require('path');
  const findings = [];

  // 1. Audit canonical config content
  const configStr = JSON.stringify(config, null, 2);
  findings.push(...scanText(configStr, 'mhai.config.json'));

  // 2. Audit generated agent files if they exist on disk
  const targetFiles = [
    'CLAUDE.md',
    'AGENTS.md',
    'ANTIGRAVITY.md',
    '.cursorrules',
    '.windsurfrules',
    '.mcp.json',
    path.join('.github', 'copilot-instructions.md')
  ];

  for (const relFile of targetFiles) {
    const fullPath = path.join(rootDir, relFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      findings.push(...scanText(content, relFile));
    }
  }

  // 3. Audit modular cursor rules
  const cursorRulesDir = path.join(rootDir, '.cursor', 'rules');
  if (fs.existsSync(cursorRulesDir)) {
    try {
      const files = fs.readdirSync(cursorRulesDir);
      for (const file of files) {
        if (file.endsWith('.mdc')) {
          const fullPath = path.join(cursorRulesDir, file);
          const content = fs.readFileSync(fullPath, 'utf8');
          findings.push(...scanText(content, path.join('.cursor', 'rules', file)));
        }
      }
    } catch {}
  }

  // 4. Audit modular skills
  const skillsDir = path.join(rootDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      const skillDirs = fs.readdirSync(skillsDir);
      for (const sDir of skillDirs) {
        const skillFile = path.join(skillsDir, sDir, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          const content = fs.readFileSync(skillFile, 'utf8');
          findings.push(...scanText(content, path.join('skills', sDir, 'SKILL.md')));
        }
      }
    } catch {}
  }

  return {
    findings,
    totalIssues: findings.length,
    isSecure: findings.length === 0
  };
}

function formatAuditReport(auditResult) {
  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Security & Secret Audit ===\x1b[0m\n');

  if (auditResult.isSecure) {
    lines.push('\x1b[32m✔ No sensitive credentials, private keys, or API tokens found.\x1b[0m');
    lines.push('✨ Your AI agent instructions are safe to commit publicly.');
  } else {
    lines.push(`\x1b[31m⚠️ Security Warning: ${auditResult.findings.length} sensitive credential(s) detected!\x1b[0m\n`);
    for (const f of auditResult.findings) {
      lines.push(`  \x1b[31m✖ [${f.rule}]\x1b[0m in \x1b[33m${f.file}:${f.line}\x1b[0m (preview: ${f.matchedSnippet})`);
    }
    lines.push('\n\x1b[31mPlease remove or redact credentials before pushing to a remote repository!\x1b[0m');
  }

  return lines.join('\n');
}

module.exports = {
  scanText,
  redactSecrets,
  auditConfig,
  formatAuditReport
};
