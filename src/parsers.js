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
    } else if (trimmed.startsWith("# ") && !result.name.length) {
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
    // Command Matching (Handles both within commands section or anywhere with explicit key:val code formatting)
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
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  return {
    guidelines: {
      agentRules: lines.filter(l => l.startsWith('-') || l.startsWith('*')).map(l => l.replace(/^[-*]\s+/, ""))
    }
  };
}

module.exports = {
  parseAgentsMd,
  parseClaudeMd,
  parseCursorRules
};
