/**
 * M.H. AI Sync - Real-time Live Watcher Engine
 * Monitors configuration and agent instruction files on disk and automatically
 * triggers synchronization with debounce safety.
 */

const fs = require('fs');
const path = require('path');

function startWatcher(rootDir = process.cwd(), onSync = () => {}, debounceMs = 300) {
  const configFile = 'mhai.config.json';
  const targetFiles = [
    configFile,
    'CLAUDE.md',
    'AGENTS.md',
    'ANTIGRAVITY.md',
    '.cursorrules'
  ];

  let debounceTimer = null;
  const watchedPaths = [];
  const activeWatchers = [];

  function triggerSync(changedFile) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        console.log(`\n\x1b[36m[M.H. AI Sync Watcher]\x1b[0m Change detected in \x1b[33m${changedFile}\x1b[0m. Synchronizing...`);
        onSync(changedFile);
        console.log(`\x1b[32m[M.H. AI Sync Watcher]\x1b[0m Synchronized at ${new Date().toLocaleTimeString()}\n`);
      } catch (err) {
        console.error(`\x1b[31m[M.H. AI Sync Watcher Error]\x1b[0m ${err.message}`);
      }
    }, debounceMs);
  }

  // Watch individual files if they exist or watch directory
  const configFullPath = path.join(rootDir, configFile);
  if (fs.existsSync(configFullPath)) {
    try {
      const watcher = fs.watch(configFullPath, (eventType) => {
        if (eventType === 'change') {
          triggerSync(configFile);
        }
      });
      activeWatchers.push(watcher);
      watchedPaths.push(configFile);
    } catch {
      // Fallback to directory watch below
    }
  }

  // Also watch the workspace root for creation or modification
  try {
    const dirWatcher = fs.watch(rootDir, (eventType, filename) => {
      if (!filename) return;
      const baseName = path.basename(filename);
      if (targetFiles.includes(baseName)) {
        triggerSync(baseName);
      }
    });
    activeWatchers.push(dirWatcher);
    watchedPaths.push(rootDir);
  } catch (err) {
    console.warn(`[M.H. AI Sync] Directory watcher warning: ${err.message}`);
  }

  console.log(`\x1b[1m\x1b[32m✔ [M.H. AI Sync Watcher]\x1b[0m Active. Listening for changes in workspace... (Press Ctrl+C to exit)\n`);

  return {
    watchedPaths,
    stop() {
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const w of activeWatchers) {
        try {
          w.close();
        } catch {}
      }
    }
  };
}

module.exports = {
  startWatcher
};
