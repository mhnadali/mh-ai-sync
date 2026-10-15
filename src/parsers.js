/**
 * M.H. AI Sync - Resilient Multi-Agent Context Parser Engine
 */

function parseAgentsMd(content = "") {
  const result = {
    name: "AI-Augmented Project",
    overview: "",
    commands: {},
    guidelines: { codeStyle: [], gitPractices: [], agentRules: [] }
  };
  
  if (!content || typeof content !== 'string') return result;

  const lines = content.split(/\r?\n/);
  let currentSection = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Project Name / Header
    if (trimmed.startsWith("> Project:")) {
      result.name = trimmed.replace("> Project:", "").trim();
    } else if (trimmed.startsWith("# ") && (!result.name || result.name === 'AI-Augmented Project')) {
      const titleMatch = trimmed.replace("# ", "").replace("Configuration", "").replace("Rules", "").trim();
      if (titleMatch) result.name = titleMatch;
    } 
    // Section Headers Detection
    else if (/^##\s+(Commands|Build & Test|Workflows)/i.test(trimmed)) {
      currentSection = "commands";
    } else if (/^##\s+(Development Rules|Guidelines|Rules|Agent Guidelines)/i.test(trimmed)) {
      currentSection = "guidelines";
    } else if (/^##\s+(Overview|Description|Context)/i.test(trimmed)) {
      currentSection = "overview";
    } else if (trimmed.startsWith("### Code Style")) {
      currentSection = "codeStyle";
    } else if (trimmed.startsWith("### Git Workflow")) {
      currentSection = "gitPractices";
    } else if (trimmed.startsWith("### Agent Constraints")) {
      currentSection = "agentRules";
    } 
    // Command Matching: matches key: value within commands section (with or without backticks/markdown)
    else if (currentSection === "commands" && /^[-*]\s+/.test(trimmed) && trimmed.includes(':')) {
      const withoutBullet = trimmed.replace(/^[-*]\s+/, '');
      const colonIdx = withoutBullet.indexOf(':');
      if (colonIdx > 0) {
        const rawKey = withoutBullet.slice(0, colonIdx).replace(/[`*]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
        const rawVal = withoutBullet.slice(colonIdx + 1).trim().replace(/^[`*]+|[`*]+$/g, '').trim();
        if (rawKey && rawVal) {
          result.commands[rawKey] = rawVal;
        }
      }
    }
    // Also match explicit key:val code formatting anywhere across document
    else if (/^[-*]\s*[`*]+([^`*:]+)[`*]+:\s*[`*]?([^`*]+)[`*]?/.test(trimmed)) {
      const match = trimmed.match(/^[-*]\s*[`*]+([^`*:]+)[`*]+:\s*[`*]?([^`*]+)[`*]?/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const val = match[2].trim();
        result.commands[key] = val;
      }
    }
    // Generic List Item Matching
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = trimmed.replace(/^[-*]\s+/, "").trim();
      if (currentSection === "codeStyle") {
        result.guidelines.codeStyle.push(item);
      } else if (currentSection === "gitPractices") {
        result.guidelines.gitPractices.push(item);
      } else if (currentSection === "agentRules" || currentSection === "guidelines") {
        result.guidelines.agentRules.push(item);
      }
    } 
    // Overview Content
    else if (currentSection === "overview" && !trimmed.startsWith("#") && !trimmed.startsWith(">")) {
      result.overview += (result.overview ? " " : "") + trimmed;
    }
  }
  return result;
}

function parseClaudeMd(content) {
  return parseAgentsMd(content);
}

function parseCursorRules(content = "") {
  if (!content || typeof content !== 'string') {
    return { guidelines: { agentRules: [] } };
  }

  let body = content;
  // Safely strip YAML frontmatter if present (e.g. in MDC files)
  const trimmedStart = body.trimStart();
  if (trimmedStart.startsWith('---')) {
    const afterFirst = trimmedStart.slice(3);
    const secondIndex = afterFirst.indexOf('---');
    if (secondIndex !== -1) {
      body = afterFirst.slice(secondIndex + 3);
    }
  }

  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  const agentRules = lines.map(l => l.replace(/^[-*]\s+/, "").trim()).filter(l => l.length > 0);
  return {
    guidelines: {
      agentRules
    }
  };
}

module.exports = {
  parseAgentsMd,
  parseClaudeMd,
  parseCursorRules
};
