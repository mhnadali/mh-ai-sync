/**
 * M.H. AI Sync - Token Budget & Prompt Health Analyzer
 * Analyzes token consumption across all AI coding agent instructions, calculates
 * prompt health scores, detects duplicate rules, and provides optimization insights.
 */

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
  generateClineRules,
  generateRooModes,
  generateAiderConventions,
  generateAiderConfig,
  generateContinueRules,
  generateZedInstructions
} = require('./generators');

function estimateTokens(text = "") {
  if (typeof text !== 'string' || !text.trim()) return 0;
  const clean = text.trim();
  const charCount = clean.length;
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Blended heuristic: standard LLM BPE averages ~3.8 chars/token for formatted markdown & code
  const tokenEstimate = Math.ceil((charCount / 3.8) * 0.7 + (wordCount * 1.3) * 0.3);
  return Math.max(1, tokenEstimate);
}

function normalizeRuleText(text = "") {
  return text.toLowerCase()
    .replace(/^[-*`#\s]+/, '')
    .replace(/[`"'.,!?:;()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicateRules(rawConfig) {
  const config = sanitize(rawConfig);
  const allRules = [];
  const duplicates = [];

  const sources = [
    { category: 'codeStyle', items: config.guidelines.codeStyle || [] },
    { category: 'gitPractices', items: config.guidelines.gitPractices || [] },
    { category: 'agentRules', items: config.guidelines.agentRules || [] }
  ];

  for (const src of sources) {
    for (const rule of src.items) {
      if (typeof rule !== 'string' || !rule.trim()) continue;
      const normalized = normalizeRuleText(rule);
      const existing = allRules.find(r => r.normalized === normalized);

      if (existing) {
        duplicates.push({
          rule: rule.trim(),
          categoryA: existing.category,
          categoryB: src.category
        });
      } else {
        allRules.push({ original: rule, normalized, category: src.category });
      }
    }
  }

  return duplicates;
}

function analyzePromptBudget(rawConfig) {
  const config = sanitize(rawConfig);
  const targets = [
    { name: 'CLAUDE.md', content: generateClaudeMd(config) },
    { name: 'AGENTS.md', content: generateAgentsMd(config) },
    { name: 'ANTIGRAVITY.md', content: generateAntigravityConfig(config) },
    { name: '.cursorrules', content: generateCursorRules(config) },
    { name: '.windsurfrules', content: generateWindsurfRules(config) },
    { name: 'copilot-instructions.md', content: generateCopilotInstructions(config) },
    { name: '.clinerules', content: generateClineRules(config) },
    { name: '.roomodes', content: generateRooModes(config) },
    { name: 'CONVENTIONS.md', content: generateAiderConventions(config) },
    { name: '.aider.conf.yml', content: generateAiderConfig(config) },
    { name: '.continue/rules/project-rules.md', content: generateContinueRules(config) },
    { name: '.zed/instructions.md', content: generateZedInstructions(config) }
  ];

  const mdcRules = generateCursorMdcRules(config);
  for (const [filename, content] of Object.entries(mdcRules)) {
    targets.push({ name: `.cursor/rules/${filename}`, content });
  }

  const skillFiles = generateSkillFiles(config);
  for (const [relPath, content] of Object.entries(skillFiles)) {
    targets.push({ name: relPath, content });
  }

  const fileStats = targets.map(t => {
    const tokens = estimateTokens(t.content);
    const chars = t.content.length;
    const lines = t.content.split('\n').length;
    return { name: t.name, tokens, chars, lines };
  });

  const totalTokens = fileStats.reduce((sum, f) => sum + f.tokens, 0);
  const avgTokens = Math.round(totalTokens / (fileStats.length || 1));
  const duplicates = findDuplicateRules(config);

  // Health Score Calculation (0 to 100)
  let healthScore = 100;
  const recommendations = [];

  // 1. Token bloat penalty (Optimal single prompt context is < 1,500 tokens)
  const maxSingleToken = Math.max(...fileStats.map(f => f.tokens));
  if (maxSingleToken > 3500) {
    healthScore -= 30;
    recommendations.push('High Prompt Dilution: Single file exceeds 3,500 tokens. LLM instruction compliance will degrade.');
  } else if (maxSingleToken > 1800) {
    healthScore -= 15;
    recommendations.push('Moderate Context Size: Single file exceeds 1,800 tokens. Consider trimming verbose sections.');
  }

  // 2. Duplicate rules penalty
  if (duplicates.length > 0) {
    const penalty = Math.min(25, duplicates.length * 5);
    healthScore -= penalty;
    recommendations.push(`Redundancy Detected: Found ${duplicates.length} overlapping/duplicate rule(s) across categories.`);
  }

  // 3. Modularization recommendation
  if (!config.modularRules || config.modularRules.length === 0) {
    healthScore -= 5;
    recommendations.push('No Scoped Modular Rules: Use modularRules for file-type specific instructions (e.g. tests vs styles).');
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  let rating = 'OPTIMAL';
  if (healthScore < 60) {
    rating = 'CRITICAL BLOAT';
  } else if (healthScore < 85) {
    rating = 'GOOD (NEEDS TUNING)';
  }

  return {
    fileStats,
    totalTokens,
    avgTokens,
    maxSingleToken,
    duplicates,
    healthScore,
    rating,
    recommendations
  };
}

function formatAnalysisReport(analysis) {
  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Prompt Health & Token Budget ===\x1b[0m\n');

  // Score Badge
  let scoreColor = '\x1b[32m'; // Green
  let rating = 'OPTIMAL';
  if (analysis.healthScore < 60) {
    scoreColor = '\x1b[31m'; // Red
    rating = 'CRITICAL BLOAT';
  } else if (analysis.healthScore < 85) {
    scoreColor = '\x1b[33m'; // Yellow
    rating = 'GOOD (NEEDS TUNING)';
  }

  lines.push(`  Prompt Health Score: ${scoreColor}${analysis.healthScore}/100 [${rating}]\x1b[0m`);
  lines.push(`  Total Generated Token Footprint: ~${analysis.totalTokens} tokens (Avg: ~${analysis.avgTokens} tokens/agent)\n`);

  lines.push('  \x1b[1mTarget Breakdown:\x1b[0m');
  for (const f of analysis.fileStats) {
    let tokenColor = '\x1b[32m';
    if (f.tokens > 3000) tokenColor = '\x1b[31m';
    else if (f.tokens > 1500) tokenColor = '\x1b[33m';

    const tokenStr = `${tokenColor}~${f.tokens.toString().padStart(5)} tokens\x1b[0m`;
    lines.push(`    • ${f.name.padEnd(35)} ${tokenStr}  (${f.lines} lines, ${f.chars} chars)`);
  }

  if (analysis.duplicates.length > 0) {
    lines.push('\n  \x1b[33m⚡ Duplicate Rules Found:\x1b[0m');
    for (const d of analysis.duplicates) {
      lines.push(`    - "${d.rule}" (in ${d.categoryA} & ${d.categoryB})`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('\n  \x1b[1m\x1b[36m💡 Actionable Optimizations:\x1b[0m');
    for (const rec of analysis.recommendations) {
      lines.push(`    → ${rec}`);
    }
  } else {
    lines.push('\n  \x1b[32m✨ Excellent prompt economy! All instructions are concise and well-scoped.\x1b[0m');
  }

  lines.push('\n----------------------------------------');
  return lines.join('\n');
}

module.exports = {
  estimateTokens,
  findDuplicateRules,
  analyzePromptBudget,
  formatAnalysisReport
};
