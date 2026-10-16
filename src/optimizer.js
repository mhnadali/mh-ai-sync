/**
 * M.H. AI Sync - AI Context Optimizer & Semantic Conflict Resolver (Phase 13)
 * Analyzes agent guidelines for semantic contradictions, removes conversational bloat,
 * and distills instructions into high-density imperative rules to maximize LLM reasoning bandwidth.
 */

const { sanitize } = require('./generators');
const { estimateTokens } = require('./analyzer');

// Knowledge base of known opposing concepts & semantic patterns
const CONFLICT_DOMAINS = [
  {
    domain: 'TypeScript Strictness',
    severity: 'CRITICAL',
    patternA: /\b(strict\s*(?:mode|type|checking)?\s*(?:true|enabled|mandatory|enforce)|no\s*implicit\s*any|strict\s*null)\b/i,
    patternB: /\b(allow\s*implicit\s*any|disable\s*strict|any\s*(?:is\s*)?allowed|skip\s*type\s*check(?:ing)?)\b/i,
    recommendation: 'Decide whether TypeScript strict checking is mandatory or relaxed; mixing both confuses the compiler and the AI agent.'
  },
  {
    domain: 'JavaScript Module System',
    severity: 'CRITICAL',
    patternA: /\b(use\s*(?:es\s*modules|esm|import\s*\/\s*export)|prefer\s*import)\b/i,
    patternB: /\b(use\s*(?:commonjs|cjs|require)|prefer\s*require)\b/i,
    recommendation: 'Standardize on either ES Modules (import/export) or CommonJS (require/module.exports).'
  },
  {
    domain: 'Indentation & Style',
    severity: 'WARNING',
    patternA: /\b((?:use|indent\s*with)\s*tabs?)\b/i,
    patternB: /\b((?:use|indent\s*with)\s*(?:2|4)?\s*spaces?)\b/i,
    recommendation: 'Choose either spaces or tabs for codebase indentation.'
  },
  {
    domain: 'Git Branch Direct Push',
    severity: 'CRITICAL',
    patternA: /\b(never\s*push\s*(?:directly\s*)?to\s*main|protect\s*(?:main|master)|pr\s*only|pull\s*request\s*only)\b/i,
    patternB: /(?<!never\s+|do\s*not\s+|don't\s+|prevent\s+)\b(?:push|commit)\s*(?:directly\s*)?to\s*(?:main|master)\b/i,
    recommendation: 'Clarify branch protection policy: either direct pushes to main are prohibited, or allowed.'
  },
  {
    domain: 'Automated Testing Requirement',
    severity: 'CRITICAL',
    patternA: /\b(mandatory\s*tests?|100%\s*(?:test\s*)?coverage|always\s*write\s*tests?|all\s*functions\s*must\s*have\s*tests?)\b/i,
    patternB: /\b(skip\s*tests?|no\s*tests?\s*(?:needed|required)|do\s*not\s*write\s*tests?|tests?\s*optional)\b/i,
    recommendation: 'Harmonize testing policy: enforce mandatory tests or state that tests are optional.'
  },
  {
    domain: 'Code Editing Strategy',
    severity: 'WARNING',
    patternA: /\b(prefer\s*minimal\s*(?:and\s*)?surgical\s*edits|avoid\s*rewriting\s*entire\s*files?|surgical\s*diffs?)\b/i,
    patternB: /\b(rewrite\s*entire\s*files?|regenerate\s*full\s*files?|replace\s*whole\s*files?)\b/i,
    recommendation: 'Align edit strategy: AI models produce fewer bugs when instructed to make surgical edits rather than full rewrites.'
  },
  {
    domain: 'Third-Party Dependencies',
    severity: 'WARNING',
    patternA: /\b(zero[- ]dependency|no\s*(?:external|third-party)\s*(?:packages|deps|libraries)|forbid\s*new\s*dependencies)\b/i,
    patternB: /\b(install\s*libraries\s*freely|use\s*any\s*(?:npm|pip|cargo)\s*package|install\s*dependencies\s*as\s*needed)\b/i,
    recommendation: 'Define clear policy on whether third-party packages can be introduced.'
  },
  {
    domain: 'Naming Conventions',
    severity: 'WARNING',
    patternA: /\b(use\s*camelCase|prefer\s*camelCase)\b/i,
    patternB: /\b(use\s*snake_case|prefer\s*snake_case)\b/i,
    recommendation: 'Select a uniform identifier casing standard (camelCase vs snake_case).'
  }
];

// Conversational filler phrases and bloat patterns that inflate token budgets
const BLOAT_PATTERNS = [
  // Polite / Conversational preambles
  /^(?:please\s*(?:make\s*sure\s*(?:to|that)?|ensure\s*(?:to|that)?|remember\s*to|be\s*sure\s*to)?\s*(?:you\s*)?(?:always\s*)?)\s+/i,
  /^(?:it\s*is\s*(?:strictly\s*)?(?:important|mandatory|recommended|vital|critical|crucial)\s*(?:that|to)\s*(?:you\s*)?(?:always\s*)?)\s+/i,
  /^(?:as\s*an\s*ai\s*(?:assistant|coding\s*agent|model),?\s*(?:you\s*must|please\s*ensure\s*(?:that)?\s*(?:you)?|please\s*make\s*sure\s*(?:that)?\s*(?:you)?|please\s*remember\s*to)?\s*(?:always)?)\s+/i,
  /^(?:you\s*(?:must|should|ought\s*to|need\s*to)?\s*(?:always\s*)?)\s+/i,
  /^(?:always\s*(?:try\s*to|make\s*sure\s*to|attempt\s*to|remember\s*to)?)\s+/i,
  /^(?:whenever\s*(?:you\s*are\s*)?(?:writing|editing|modifying|creating)\s*code,?\s*(?:remember\s*to)?\s*)\s+/i,
  /^(?:in\s*order\s*to\s*maintain\s*code\s*quality,?\s*)\s+/i,
  /^(?:at\s*all\s*times,?\s*)\s+/i,
  /^(?:note\s*that\s*(?:you\s*must|it\s*is\s*important\s*to)?\s*)\s+/i,
  /^(?:developers\s*must\s*(?:always)?\s*)\s+/i
];

/**
 * Detects semantic contradictions and opposing rules across guidelines.
 */
function detectConflicts(rawConfig) {
  const config = sanitize(rawConfig);
  const conflicts = [];

  // Flatten all guidelines with source attribution
  const allRules = [];
  for (const cat of ['agentRules', 'codeStyle', 'gitPractices']) {
    for (const rule of (config.guidelines[cat] || [])) {
      if (typeof rule === 'string' && rule.trim()) {
        allRules.push({ text: rule.trim(), category: cat });
      }
    }
  }

  // Also check modular rules
  if (Array.isArray(config.modularRules)) {
    for (const mr of config.modularRules) {
      for (const rule of (mr.rules || [])) {
        if (typeof rule === 'string' && rule.trim()) {
          allRules.push({ text: rule.trim(), category: `modular:${mr.name}` });
        }
      }
    }
  }

  // Cross-examine every pair of rules against known conflict patterns
  for (let i = 0; i < allRules.length; i++) {
    for (let j = i + 1; j < allRules.length; j++) {
      const r1 = allRules[i];
      const r2 = allRules[j];

      for (const domain of CONFLICT_DOMAINS) {
        const r1MatchesA = domain.patternA.test(r1.text);
        const r1MatchesB = domain.patternB.test(r1.text);
        const r2MatchesA = domain.patternA.test(r2.text);
        const r2MatchesB = domain.patternB.test(r2.text);

        if ((r1MatchesA && r2MatchesB) || (r1MatchesB && r2MatchesA)) {
          // Avoid duplicate inverse entries
          const alreadyFound = conflicts.some(c =>
            c.domain === domain.domain &&
            ((c.ruleA.text === r1.text && c.ruleB.text === r2.text) || (c.ruleA.text === r2.text && c.ruleB.text === r1.text))
          );

          if (!alreadyFound) {
            conflicts.push({
              domain: domain.domain,
              severity: domain.severity,
              ruleA: { text: r1.text, category: r1.category },
              ruleB: { text: r2.text, category: r2.category },
              recommendation: domain.recommendation
            });
          }
        }
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    totalConflicts: conflicts.length,
    conflicts
  };
}

/**
 * Compresses an individual rule into an imperative, high-density guideline.
 */
function compressRule(ruleText) {
  if (typeof ruleText !== 'string' || !ruleText.trim()) return '';

  let cleaned = ruleText.trim();

  // Strip leading bullets or numbering if present
  cleaned = cleaned.replace(/^[-*•\d\.\s]+/, '');

  // Strip conversational bloat patterns iteratively
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of BLOAT_PATTERNS) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '');
        changed = true;
      }
    }
  }

  // Capitalize first letter of resulting imperative statement
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Normalize multiple spaces into single space
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned || ruleText.trim();
}

/**
 * Compresses all rules in guidelines object while deduplicating near-identical statements.
 */
function compressGuidelines(guidelines = {}) {
  const compressed = {
    codeStyle: [],
    gitPractices: [],
    agentRules: []
  };

  const seenNorms = new Set();

  function norm(str) {
    return str.toLowerCase().replace(/[`*_#\s\.\,\;]/g, '').trim();
  }

  for (const cat of ['codeStyle', 'gitPractices', 'agentRules']) {
    const rawList = Array.isArray(guidelines[cat]) ? guidelines[cat] : [];
    for (const r of rawList) {
      if (typeof r === 'string' && r.trim()) {
        const distilled = compressRule(r);
        const normalized = norm(distilled);
        if (distilled && !seenNorms.has(normalized)) {
          seenNorms.add(normalized);
          compressed[cat].push(distilled);
        }
      }
    }
  }

  return compressed;
}

/**
 * Optimizes canonical configuration by resolving bloat, calculating token reduction,
 * and reporting semantic conflicts.
 */
function optimizeContext(rawConfig, options = {}) {
  const config = sanitize(rawConfig);
  const conflictsReport = detectConflicts(config);

  const originalJson = JSON.stringify(config.guidelines);
  const originalTokens = estimateTokens(originalJson);

  const compressedGuidelines = compressGuidelines(config.guidelines);
  const optimizedJson = JSON.stringify(compressedGuidelines);
  const optimizedTokens = estimateTokens(optimizedJson);

  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const reductionPercent = originalTokens > 0
    ? Math.round((savedTokens / originalTokens) * 100)
    : 0;

  const optimizedConfig = JSON.parse(JSON.stringify(config));
  optimizedConfig.guidelines = compressedGuidelines;

  return {
    optimizedConfig,
    stats: {
      originalTokens,
      optimizedTokens,
      savedTokens,
      reductionPercent
    },
    conflicts: conflictsReport
  };
}

/**
 * Formats conflicts analysis into a readable CLI report.
 */
function formatConflictsReport(conflictsResult) {
  const lines = ['\x1b[1m\x1b[36m=== M.H. AI Sync Semantic Conflict Audit ===\x1b[0m\n'];

  if (!conflictsResult.hasConflicts) {
    lines.push('\x1b[32m✔ Zero Contradictions: All guidelines across agents are semantically aligned and coherent.\x1b[0m');
    return lines.join('\n');
  }

  lines.push(`\x1b[31m⚠️ Found ${conflictsResult.totalConflicts} contradictory rule pair(s) in context guidelines:\x1b[0m\n`);

  conflictsResult.conflicts.forEach((c, idx) => {
    const sevBadge = c.severity === 'CRITICAL' ? '\x1b[31m[CRITICAL]\x1b[0m' : '\x1b[33m[WARNING]\x1b[0m';
    lines.push(`  ${idx + 1}. ${sevBadge} \x1b[1mDomain: ${c.domain}\x1b[0m`);
    lines.push(`     • Rule A (${c.ruleA.category}): "\x1b[33m${c.ruleA.text}\x1b[0m"`);
    lines.push(`     • Rule B (${c.ruleB.category}): "\x1b[31m${c.ruleB.text}\x1b[0m"`);
    lines.push(`     💡 \x1b[90mResolution: ${c.recommendation}\x1b[0m\n`);
  });

  return lines.join('\n');
}

/**
 * Formats context optimization into a readable CLI report.
 */
function formatOptimizationReport(optimizationResult) {
  const { stats, conflicts } = optimizationResult;
  const lines = ['\x1b[1m\x1b[36m=== M.H. AI Sync Context Optimization Report ===\x1b[0m\n'];

  lines.push(`\x1b[1mToken Efficiency:\x1b[0m  ~${stats.originalTokens} tokens ➔ ~${stats.optimizedTokens} tokens`);
  lines.push(`\x1b[1mTokens Saved:\x1b[0m      \x1b[32m${stats.savedTokens} tokens (${stats.reductionPercent}% reduction)\x1b[0m`);
  lines.push(`\x1b[1mReasoning Space:\x1b[0m   \x1b[36m+${stats.reductionPercent}% prompt headroom for LLM inference\x1b[0m\n`);

  if (conflicts.hasConflicts) {
    lines.push(`\x1b[33m⚡ Note: ${conflicts.totalConflicts} semantic conflict(s) detected. Run \`mhai conflicts\` to review.\x1b[0m\n`);
  }

  return lines.join('\n');
}

module.exports = {
  CONFLICT_DOMAINS,
  detectConflicts,
  compressRule,
  compressGuidelines,
  optimizeContext,
  formatConflictsReport,
  formatOptimizationReport
};
