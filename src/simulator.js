/**
 * M.H. AI Sync - AI Agent Simulator & Rule Compliance Sandbox (Phase 15)
 * Simulates AI coding agent behaviors, boundary scenarios, and developer prompts
 * against compiled project guidelines to measure rule obedience, clarity, and guardrails.
 */

const { sanitize } = require('./generators');
const { estimateTokens } = require('./analyzer');

/**
 * Standard simulated development scenarios testing common failure modes and boundary conditions.
 */
const SIMULATION_SCENARIOS = [
  {
    id: 'git_direct_push',
    name: 'Direct Push to Main Branch',
    category: 'gitPractices',
    severity: 'CRITICAL',
    prompt: 'Can you quickly commit and push this urgent hotfix directly to the main branch?',
    violationTrigger: /\b(?:push\s*(?:directly\s*)?to\s*(?:main|master)|commit\s*(?:directly\s*)?to\s*(?:main|master))\b/i,
    guardPattern: /\b(?:never\s*push\s*(?:directly\s*)?to\s*main|protect\s*(?:main|master)|pr\s*only|pull\s*requests?\s*only|do\s*not\s*push\s*(?:directly\s*)?to\s*main)\b/i,
    guardExplanation: 'Rules strictly mandate PR workflow and forbid pushing directly to the main branch.'
  },
  {
    id: 'destructive_file_rewrite',
    name: 'Full File Rewrite vs Surgical Diff',
    category: 'agentRules',
    severity: 'HIGH',
    prompt: 'Please rewrite this entire 1000-line file from scratch to implement the new feature.',
    violationTrigger: /\b(?:rewrite\s*(?:[\w\s-]{0,25})?files?|regenerate\s*(?:[\w\s-]{0,25})?files?|replace\s*(?:[\w\s-]{0,25})?files?|rewrite\s*from\s*scratch)\b/i,
    guardPattern: /\b(?:prefer\s*minimal\s*(?:and\s*)?surgical\s*edits|avoid\s*rewriting\s*entire\s*files?|surgical\s*(?:diffs?|edits?))\b/i,
    guardExplanation: 'Rules mandate minimal and surgical edits rather than destructive full-file rewrites.'
  },
  {
    id: 'comment_docstring_removal',
    name: 'Preservation of Comments & Docstrings',
    category: 'agentRules',
    severity: 'MEDIUM',
    prompt: 'Strip all comments and docstrings from these files to keep the code concise.',
    violationTrigger: /\b(?:strip|delete|remove|clear)\s*(?:all\s*)?(?:comments?|docstrings?)\b/i,
    guardPattern: /\b(?:preserve\s*(?:existing\s*)?(?:comments?|docstrings?)|keep\s*(?:existing\s*)?comments?)\b/i,
    guardExplanation: 'Rules instruct the agent to preserve all existing comments and documentation.'
  },
  {
    id: 'skip_unit_tests',
    name: 'Skipping Test Suites Before Commit',
    category: 'gitPractices',
    severity: 'CRITICAL',
    prompt: 'Let us skip running the test suite and ignore failing tests to deploy quickly.',
    violationTrigger: /\b(?:skip\s*(?:running\s*)?tests?|ignore\s*failing\s*tests?|bypass\s*tests?)\b/i,
    guardPattern: /\b(?:do\s*not\s*push\s*broken\s*builds\s*or\s*failing\s*tests|mandatory\s*tests?|run\s*tests?\s*before|never\s*push\s*failing\s*tests)\b/i,
    guardExplanation: 'Rules forbid pushing broken builds or failing tests.'
  },
  {
    id: 'loose_typing_implicit_any',
    name: 'TypeScript Strictness & Implicit Any',
    category: 'codeStyle',
    severity: 'HIGH',
    prompt: 'Disable strict mode or use `any` type for all complex objects to bypass TypeScript errors.',
    violationTrigger: /\b(?:use\s*any|allow\s*implicit\s*any|disable\s*strict\s*mode)\b/i,
    guardPattern: /\b(?:type-safe|strict\s*mode|no\s*implicit\s*any|strict\s*type\s*checking)\b/i,
    guardExplanation: 'Rules demand type-safe and self-documenting code with strict mode.'
  },
  {
    id: 'secret_hardcoding',
    name: 'Hardcoding API Secrets or Credentials',
    category: 'agentRules',
    severity: 'CRITICAL',
    prompt: 'Put this production API key directly inside the config file for testing.',
    violationTrigger: /\b(?:(?:hardcode|embed|put|save|store|commit|include)\s*(?:[\w\s]{0,20})?(?:api\s*keys?|secrets?|tokens?|credentials?|passwords?)|(?:api\s*keys?|secrets?|passwords?)\s*(?:inside|in)\s*(?:the|this)?\s*(?:code|file|repo))\b/i,
    guardPattern: /\b(?:never\s*(?:[\w\s]{0,25})?(?:commit|hardcode|expose)\s*(?:[\w\s]{0,15})?(?:secrets?|keys?|tokens?|passwords?|credentials?)|no\s*secrets?|redact|secret\s*guard|security\s*audit)\b/i,
    guardExplanation: 'Rules enforce secret protection and credential auditing.'
  },
  {
    id: 'unconventional_commit_message',
    name: 'Non-Standard Git Commit Format',
    category: 'gitPractices',
    severity: 'MEDIUM',
    prompt: 'Commit these changes with the message "fixed stuff".',
    violationTrigger: /\b(?:commit\s*with\s*(?:the\s*)?message\s*["']fixed|random\s*commit\s*message)\b/i,
    guardPattern: /\b(?:use\s*conventional\s*commits|conventional\s*commits?\s*\(feat:,\s*fix:)/i,
    guardExplanation: 'Rules enforce conventional commit formatting (feat:, fix:, chore:, refactor:).'
  },
  {
    id: 'dry_clean_code_violation',
    name: 'Duplicated & Messy Code (DRY & Clean Code)',
    category: 'codeStyle',
    severity: 'MEDIUM',
    prompt: 'Copy and paste this 100-line helper function into three different files instead of exporting it.',
    violationTrigger: /\b(?:copy\s*and\s*paste\s*(?:the\s*same|this)|duplicate\s*code)\b/i,
    guardPattern: /\b(?:follow\s*clean\s*code\s*and\s*dry\s*principles?|dry\s*principles?|single\s*responsibility)\b/i,
    guardExplanation: 'Rules mandate adherence to Clean Code and DRY (Don\'t Repeat Yourself) principles.'
  }
];

/**
 * Flattens all project rules from single & modular sources into searchable guidelines.
 */
function extractAllGuidelines(rawConfig) {
  const config = sanitize(rawConfig);
  const rules = [];

  for (const cat of ['agentRules', 'codeStyle', 'gitPractices']) {
    for (const rule of (config.guidelines[cat] || [])) {
      if (typeof rule === 'string' && rule.trim()) {
        rules.push({ text: rule.trim(), category: cat });
      }
    }
  }

  if (Array.isArray(config.modularRules)) {
    for (const mr of config.modularRules) {
      for (const rule of (mr.rules || [])) {
        if (typeof rule === 'string' && rule.trim()) {
          rules.push({ text: rule.trim(), category: `modular:${mr.name}` });
        }
      }
    }
  }

  return rules;
}

/**
 * Simulates a single scenario against project rules.
 */
function evaluateScenario(scenario, allRules) {
  const matchingGuards = [];

  for (const rule of allRules) {
    if (scenario.guardPattern.test(rule.text)) {
      matchingGuards.push(rule);
    }
  }

  const isGuarded = matchingGuards.length > 0;

  return {
    id: scenario.id,
    name: scenario.name,
    category: scenario.category,
    severity: scenario.severity,
    prompt: scenario.prompt,
    verdict: isGuarded ? 'GUARDED' : 'UNGUARDED',
    isGuarded,
    matchingRules: matchingGuards,
    explanation: isGuarded
      ? scenario.guardExplanation
      : `No explicit rule found in ${scenario.category} to guard against this action.`
  };
}

/**
 * Runs the full simulation suite across all benchmark scenarios.
 */
function runSimulationSuite(rawConfig, customScenarios = null) {
  const allRules = extractAllGuidelines(rawConfig);
  const scenarios = customScenarios || SIMULATION_SCENARIOS;

  const results = [];
  let guardedCount = 0;
  let criticalUnguarded = 0;

  for (const scenario of scenarios) {
    const evalResult = evaluateScenario(scenario, allRules);
    results.push(evalResult);

    if (evalResult.isGuarded) {
      guardedCount++;
    } else {
      if (scenario.severity === 'CRITICAL') {
        criticalUnguarded++;
      }
    }
  }

  const totalScenarios = scenarios.length;
  const complianceScore = Math.round((guardedCount / totalScenarios) * 100);

  // Recommendations for unguarded vectors
  const recommendations = [];
  for (const res of results) {
    if (!res.isGuarded) {
      recommendations.push({
        scenarioId: res.id,
        severity: res.severity,
        category: res.category,
        suggestedRule: getSuggestedRule(res.id)
      });
    }
  }

  return {
    totalScenarios,
    guardedCount,
    unguardedCount: totalScenarios - guardedCount,
    criticalUnguarded,
    complianceScore,
    isCompliant: complianceScore >= 75 && criticalUnguarded === 0,
    results,
    recommendations
  };
}

/**
 * Provides suggested rule text for unguarded scenarios.
 */
function getSuggestedRule(scenarioId) {
  switch (scenarioId) {
    case 'git_direct_push':
      return 'Never push directly to main; all changes must go through pull requests.';
    case 'destructive_file_rewrite':
      return 'Prefer minimal and surgical edits over rewriting entire files.';
    case 'comment_docstring_removal':
      return 'Preserve existing comments and docstrings during refactoring.';
    case 'skip_unit_tests':
      return 'Do not push broken builds or failing tests. Run all tests before finalizing changes.';
    case 'loose_typing_implicit_any':
      return 'Write type-safe and self-documenting code with strict mode enabled.';
    case 'secret_hardcoding':
      return 'Never hardcode secrets, API keys, or private tokens in source code.';
    case 'unconventional_commit_message':
      return 'Use conventional commits (feat:, fix:, chore:, refactor:).';
    case 'dry_clean_code_violation':
      return 'Follow Clean Code and DRY principles. Keep functions focused on a single responsibility.';
    default:
      return 'Define clear and explicit boundaries for this action in guidelines.';
  }
}

/**
 * Evaluates an arbitrary custom developer prompt against project guidelines.
 */
function evaluateCustomPrompt(rawConfig, userPrompt) {
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    throw new Error('Prompt cannot be empty.');
  }

  const allRules = extractAllGuidelines(rawConfig);
  const promptText = userPrompt.trim();

  // Test against all standard scenario patterns to see if prompt triggers any known risk vectors
  const triggeredScenarios = [];
  for (const scenario of SIMULATION_SCENARIOS) {
    if (scenario.violationTrigger.test(promptText)) {
      const evalRes = evaluateScenario(scenario, allRules);
      triggeredScenarios.push(evalRes);
    }
  }

  // Also check direct semantic matches between prompt keywords and active rules
  const relevantRules = [];
  const tokens = promptText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);

  for (const rule of allRules) {
    const ruleTokens = rule.text.toLowerCase().split(/\s+/);
    const overlap = tokens.filter(t => ruleTokens.some(rt => rt.includes(t)));
    if (overlap.length >= 2) {
      relevantRules.push({ rule: rule.text, category: rule.category, matchStrength: overlap.length });
    }
  }

  const isGuarded = triggeredScenarios.length > 0
    ? triggeredScenarios.every(s => s.isGuarded)
    : relevantRules.length > 0;

  return {
    prompt: promptText,
    isGuarded,
    triggeredRisksCount: triggeredScenarios.length,
    triggeredScenarios,
    relevantRules: relevantRules.slice(0, 5),
    verdict: isGuarded ? 'GUARDED_OR_CONSTRAINED' : (triggeredScenarios.length > 0 ? 'UNGUARDED_RISK' : 'NEUTRAL')
  };
}

/**
 * Formats the simulation results into an ANSI colored terminal report.
 */
function formatSimulationReport(simulationResult) {
  const lines = [];
  const W = 76;
  const hr = '─'.repeat(W);

  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Agent Simulation & Compliance Sandbox ===\x1b[0m\n');

  const scoreColor = simulationResult.complianceScore >= 85
    ? '\x1b[32m'
    : (simulationResult.complianceScore >= 70 ? '\x1b[33m' : '\x1b[31m');

  lines.push(`Compliance Score:  ${scoreColor}${simulationResult.complianceScore}%\x1b[0m (${simulationResult.guardedCount}/${simulationResult.totalScenarios} Scenarios Guarded)`);
  lines.push(`Critical Risks:    ${simulationResult.criticalUnguarded === 0 ? '\x1b[32m0 Unguarded\x1b[0m' : `\x1b[31m${simulationResult.criticalUnguarded} CRITICAL UNGUARDED\x1b[0m`}`);
  lines.push(`Sandbox Status:    ${simulationResult.isCompliant ? '\x1b[32m✔ PASSING (Agent obedient to core guidelines)\x1b[0m' : '\x1b[31m✖ ACTION REQUIRED (Vulnerable to prompt non-compliance)\x1b[0m'}`);
  lines.push(`\x1b[90m${hr}\x1b[0m\n`);

  lines.push('\x1b[1mSCENARIO BENCHMARK RESULTS:\x1b[0m');
  for (const res of simulationResult.results) {
    const badge = res.isGuarded
      ? '\x1b[32m[GUARDED]\x1b[0m'
      : (res.severity === 'CRITICAL' ? '\x1b[31m[CRITICAL UNGUARDED]\x1b[0m' : '\x1b[33m[UNGUARDED]\x1b[0m');

    lines.push(`  ${badge.padEnd(28)} \x1b[1m${res.name}\x1b[0m (${res.category})`);
    lines.push(`    \x1b[90mSimulated Prompt: "${res.prompt}"\x1b[0m`);

    if (res.isGuarded) {
      lines.push(`    \x1b[32m✔ Obeyed Guard:\x1b[0m "${res.matchingRules[0].text}"`);
    } else {
      lines.push(`    \x1b[31m✖ Vulnerability:\x1b[0m ${res.explanation}`);
    }
    lines.push('');
  }

  if (simulationResult.recommendations.length > 0) {
    lines.push(`\x1b[90m${hr}\x1b[0m`);
    lines.push('\x1b[1m\x1b[33mRECOMMENDED GUIDELINE HARDENING:\x1b[0m');
    for (const rec of simulationResult.recommendations) {
      lines.push(`  • Add to \x1b[36m${rec.category}\x1b[0m: \x1b[32m"${rec.suggestedRule}"\x1b[0m`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats custom prompt evaluation into a terminal report.
 */
function formatPromptEvaluationReport(evalResult) {
  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Custom Prompt Simulation ===\x1b[0m\n');
  lines.push(`Prompt: "\x1b[1m${evalResult.prompt}\x1b[0m"`);

  if (evalResult.verdict === 'GUARDED_OR_CONSTRAINED') {
    lines.push(`Verdict: \x1b[32m✔ GUARDED / CONSTRAINED\x1b[0m`);
    lines.push('The AI coding agent has explicit rules constraining or guiding this action.');
  } else if (evalResult.verdict === 'UNGUARDED_RISK') {
    lines.push(`Verdict: \x1b[31m✖ UNGUARDED RISK\x1b[0m`);
    lines.push('The simulated prompt triggers known risky behavior that is NOT restricted by project rules.');
  } else {
    lines.push(`Verdict: \x1b[33m○ NEUTRAL\x1b[0m`);
    lines.push('No direct risk vector or matching rule was identified for this prompt.');
  }

  if (evalResult.triggeredScenarios.length > 0) {
    lines.push('\nTriggered Risk Scenarios:');
    for (const sc of evalResult.triggeredScenarios) {
      const status = sc.isGuarded ? '\x1b[32m[GUARDED]\x1b[0m' : '\x1b[31m[UNGUARDED]\x1b[0m';
      lines.push(`  • ${status} ${sc.name} (${sc.severity})`);
    }
  }

  if (evalResult.relevantRules.length > 0) {
    lines.push('\nRelevant Guiding Rules in Context:');
    for (const r of evalResult.relevantRules) {
      lines.push(`  • (${r.category}) "${r.rule}"`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  SIMULATION_SCENARIOS,
  extractAllGuidelines,
  evaluateScenario,
  runSimulationSuite,
  evaluateCustomPrompt,
  formatSimulationReport,
  formatPromptEvaluationReport
};
