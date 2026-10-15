/**
 * M.H. AI Sync - Shared Agent Memory & Active Task Bridge
 * Manages shared work-in-progress state, task goals, and progress notes
 * synchronized across all AI coding agents (Claude, Antigravity, Cursor, Hermes).
 */

const fs = require('fs');
const path = require('path');

const STATE_DIR = '.mhai';
const STATE_FILE = 'state.json';

function getStateFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, STATE_DIR, STATE_FILE);
}

const DEFAULT_TASK_STATE = {
  version: "1.0.0",
  activeTask: null,
  status: "idle", // "idle" | "in_progress" | "blocked" | "completed"
  updatedAt: null,
  updatedBy: "developer",
  recentNotes: [],
  decisionLog: []
};

function loadTaskState(rootDir = process.cwd()) {
  const filePath = getStateFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_TASK_STATE };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || "1.0.0",
      activeTask: typeof parsed.activeTask === 'string' ? parsed.activeTask.trim() : null,
      status: typeof parsed.status === 'string' ? parsed.status : "idle",
      updatedAt: parsed.updatedAt || null,
      updatedBy: parsed.updatedBy || "developer",
      recentNotes: Array.isArray(parsed.recentNotes) ? parsed.recentNotes.filter(n => typeof n === 'string') : [],
      decisionLog: Array.isArray(parsed.decisionLog) ? parsed.decisionLog : []
    };
  } catch {
    return { ...DEFAULT_TASK_STATE };
  }
}

function saveTaskState(state, rootDir = process.cwd()) {
  const dirPath = path.join(rootDir, STATE_DIR);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (Array.isArray(state.recentNotes) && state.recentNotes.length > 20) {
    state.recentNotes = state.recentNotes.slice(-20);
  }

  const filePath = getStateFilePath(rootDir);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

function setActiveTask(taskDescription, options = {}, rootDir = process.cwd()) {
  const state = loadTaskState(rootDir);
  state.activeTask = taskDescription.trim();
  state.status = options.status || "in_progress";
  state.updatedAt = new Date().toISOString();
  state.updatedBy = options.updatedBy || "developer";

  if (options.note) {
    state.recentNotes.push(options.note.trim());
  }

  return saveTaskState(state, rootDir);
}

function addTaskNote(noteText, rootDir = process.cwd()) {
  const state = loadTaskState(rootDir);
  if (!state.activeTask) {
    state.activeTask = "General task in progress";
    state.status = "in_progress";
  }
  state.recentNotes.push(noteText.trim());
  state.updatedAt = new Date().toISOString();
  return saveTaskState(state, rootDir);
}

function clearActiveTask(rootDir = process.cwd()) {
  const state = loadTaskState(rootDir);
  state.activeTask = null;
  state.status = "idle";
  state.recentNotes = [];
  state.updatedAt = new Date().toISOString();
  return saveTaskState(state, rootDir);
}

function generateTaskBanner(taskState) {
  if (!taskState || !taskState.activeTask || taskState.status === 'idle') {
    return '';
  }

  const statusIcons = {
    in_progress: '⚡ [IN PROGRESS]',
    blocked: '🛑 [BLOCKED]',
    completed: '✔ [COMPLETED]'
  };

  const statusLabel = statusIcons[taskState.status] || `[${taskState.status.toUpperCase()}]`;
  const timeFormatted = taskState.updatedAt ? new Date(taskState.updatedAt).toLocaleString() : 'recently';

  let banner = `> 🚨 **CURRENT ACTIVE TASK (Cross-Agent Shared State)**:\n`;
  banner += `> **Task**: ${taskState.activeTask}\n`;
  banner += `> **Status**: ${statusLabel} (Updated: ${timeFormatted} by ${taskState.updatedBy})\n`;

  if (taskState.recentNotes.length > 0) {
    banner += `> **Latest Progress Notes**:\n`;
    for (const note of taskState.recentNotes.slice(-5)) {
      banner += `> - ${note}\n`;
    }
  }

  banner += `\n`;
  return banner;
}

module.exports = {
  loadTaskState,
  saveTaskState,
  setActiveTask,
  addTaskNote,
  clearActiveTask,
  generateTaskBanner
};
