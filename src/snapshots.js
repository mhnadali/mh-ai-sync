/**
 * M.H. AI Sync - Context Versioning, Snapshots & Time-Machine Rollback (Phase 14)
 * Provides point-in-time state capture, chronological version history, rollback,
 * and unified diffing between AI context states.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitize } = require('./generators');
const { estimateTokens } = require('./analyzer');
const { computeLineDiff, formatUnifiedDiff } = require('./merger');

const SNAPSHOTS_DIR_NAME = path.join('.mhai', 'snapshots');

function getSnapshotsDir(rootDir) {
  return path.join(rootDir, SNAPSHOTS_DIR_NAME);
}

function sanitizeTag(tag) {
  if (!tag || typeof tag !== 'string') return 'snapshot';
  return tag.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
}

/**
 * Calculates rule counts and metadata metrics from a canonical config.
 */
function calculateMetrics(config) {
  const c = sanitize(config);
  const guidelines = c.guidelines || {};
  const totalRules =
    (guidelines.codeStyle || []).length +
    (guidelines.gitPractices || []).length +
    (guidelines.agentRules || []).length;

  const totalSkills = Array.isArray(c.skills) ? c.skills.length : 0;
  const totalMcpServers = c.mcpServers ? Object.keys(c.mcpServers).length : 0;
  const rawString = JSON.stringify(c, null, 2);
  const estimatedTokens = estimateTokens(rawString);

  return {
    totalRules,
    totalSkills,
    totalMcpServers,
    estimatedTokens
  };
}

/**
 * Creates a point-in-time snapshot of the current configuration.
 */
function createSnapshot(rootDir, options = {}) {
  const snapshotsDir = getSnapshotsDir(rootDir);
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const configPath = path.join(rootDir, 'mhai.config.json');
  let configToSave;

  if (options.config) {
    configToSave = sanitize(options.config);
  } else if (fs.existsSync(configPath)) {
    try {
      configToSave = sanitize(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    } catch (err) {
      throw new Error(`Failed to read current config for snapshot: ${err.message}`);
    }
  } else {
    throw new Error('No mhai.config.json found to create a snapshot from.');
  }

  const rawJson = JSON.stringify(configToSave, null, 2);
  const checksum = crypto.createHash('sha256').update(rawJson).digest('hex').substring(0, 12);
  const now = new Date();
  const timestampIso = now.toISOString();
  const tag = sanitizeTag(options.tag || (options.auto ? 'auto' : 'snapshot'));
  const folderName = `${timestampIso.replace(/[:.]/g, '-')}_${tag}`;
  const targetFolder = path.join(snapshotsDir, folderName);

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  const metrics = calculateMetrics(configToSave);
  const metadata = {
    id: folderName,
    tag: options.tag ? options.tag.trim() : tag,
    timestamp: timestampIso,
    message: (options.message || 'Manual snapshot').trim(),
    checksum,
    metrics,
    config: configToSave
  };

  fs.writeFileSync(path.join(targetFolder, 'snapshot.json'), JSON.stringify(metadata, null, 2), 'utf8');
  fs.writeFileSync(path.join(targetFolder, 'mhai.config.json'), rawJson, 'utf8');

  return metadata;
}

/**
 * Lists all snapshots chronologically (newest first).
 */
function listSnapshots(rootDir) {
  const snapshotsDir = getSnapshotsDir(rootDir);
  if (!fs.existsSync(snapshotsDir)) return [];

  const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true });
  const snapshots = [];

  for (const ent of entries) {
    if (ent.isDirectory()) {
      const snapJsonPath = path.join(snapshotsDir, ent.name, 'snapshot.json');
      if (fs.existsSync(snapJsonPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(snapJsonPath, 'utf8'));
          snapshots.push(data);
        } catch {
          // ignore corrupted individual snapshots
        }
      }
    }
  }

  // Sort descending by timestamp
  snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return snapshots;
}

/**
 * Resolves a snapshot by exact tag, partial ID, or relative index (@0, @1, latest).
 */
function getSnapshot(rootDir, tagOrId) {
  const all = listSnapshots(rootDir);
  if (all.length === 0) return null;

  if (!tagOrId || tagOrId === 'latest' || tagOrId === '@0') {
    return all[0];
  }

  const query = String(tagOrId).trim();

  // Match relative index like @1, @2
  if (query.startsWith('@')) {
    const idx = parseInt(query.slice(1), 10);
    if (!isNaN(idx) && idx >= 0 && idx < all.length) {
      return all[idx];
    }
  }

  // Match exact ID
  const exactId = all.find(s => s.id === query);
  if (exactId) return exactId;

  // Match exact tag
  const exactTag = all.find(s => s.tag.toLowerCase() === query.toLowerCase());
  if (exactTag) return exactTag;

  // Match partial ID or tag
  const partial = all.find(s => s.id.includes(query) || s.tag.toLowerCase().includes(query.toLowerCase()));
  if (partial) return partial;

  return null;
}

/**
 * Compares a snapshot against current mhai.config.json.
 */
function diffSnapshot(rootDir, tagOrId) {
  const snapshot = getSnapshot(rootDir, tagOrId);
  if (!snapshot) {
    throw new Error(`Snapshot not found matching "${tagOrId}".`);
  }

  const configPath = path.join(rootDir, 'mhai.config.json');
  let currentConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      currentConfig = sanitize(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    } catch {}
  }

  const currentRaw = JSON.stringify(currentConfig, null, 2);
  const snapRaw = JSON.stringify(sanitize(snapshot.config), null, 2);
  const lineDiff = computeLineDiff(snapRaw, currentRaw);
  const formattedResult = formatUnifiedDiff(`mhai.config.json (Snapshot: ${snapshot.tag})`, lineDiff);

  return {
    snapshot,
    hasChanges: formattedResult.hasChanges,
    lineDiff,
    unifiedDiffText: formattedResult.formatted
  };
}

/**
 * Reverts the project configuration to a specified snapshot.
 * Automatically saves a pre-rollback backup unless disabled.
 */
function rollbackSnapshot(rootDir, tagOrId, options = {}) {
  const targetSnapshot = getSnapshot(rootDir, tagOrId);
  if (!targetSnapshot) {
    throw new Error(`Cannot rollback: snapshot not found for "${tagOrId}".`);
  }

  const configPath = path.join(rootDir, 'mhai.config.json');

  // Create automatic pre-rollback backup if current config exists
  let backupSnapshot = null;
  if (options.createAutoBackup !== false && fs.existsSync(configPath)) {
    try {
      backupSnapshot = createSnapshot(rootDir, {
        tag: 'pre-rollback',
        message: `Auto-backup before rolling back to ${targetSnapshot.tag} (${targetSnapshot.checksum})`,
        auto: true
      });
    } catch {
      // best-effort backup
    }
  }

  // Restore snapshot configuration
  const restoredJson = JSON.stringify(targetSnapshot.config, null, 2);
  fs.writeFileSync(configPath, restoredJson, 'utf8');

  return {
    restoredSnapshot: targetSnapshot,
    backupSnapshot
  };
}

/**
 * Deletes a snapshot by tag or ID.
 */
function deleteSnapshot(rootDir, tagOrId) {
  const snapshot = getSnapshot(rootDir, tagOrId);
  if (!snapshot) {
    return false;
  }

  const targetFolder = path.join(getSnapshotsDir(rootDir), snapshot.id);
  if (fs.existsSync(targetFolder)) {
    fs.rmSync(targetFolder, { recursive: true, force: true });
    return true;
  }
  return false;
}

/**
 * Prunes older snapshots, retaining only the newest `maxKeep` entries.
 */
function pruneSnapshots(rootDir, maxKeep = 20) {
  const all = listSnapshots(rootDir);
  if (all.length <= maxKeep) {
    return { prunedCount: 0, remainingCount: all.length };
  }

  const toDelete = all.slice(maxKeep);
  let prunedCount = 0;

  for (const snap of toDelete) {
    if (deleteSnapshot(rootDir, snap.id)) {
      prunedCount++;
    }
  }

  return {
    prunedCount,
    remainingCount: all.length - prunedCount
  };
}

/**
 * Formats snapshot list into a terminal-friendly table.
 */
function formatSnapshotsList(snapshots) {
  if (!snapshots || snapshots.length === 0) {
    return '\x1b[33mNo AI context snapshots recorded yet.\x1b[0m\nUse `mhai snapshot save <tag>` to capture a point-in-time checkpoint.';
  }

  const lines = [];
  lines.push('\x1b[1m\x1b[36m=== M.H. AI Sync Context Snapshots (Time Machine) ===\x1b[0m\n');
  lines.push('INDEX  TAG                   TIMESTAMP             RULES  TOKENS  MESSAGE');
  lines.push('--------------------------------------------------------------------------------');

  snapshots.forEach((snap, idx) => {
    const indexStr = `@${idx}`.padEnd(6);
    const tagStr = (snap.tag || 'snapshot').substring(0, 20).padEnd(21);
    const dateStr = (snap.timestamp || '').substring(0, 19).replace('T', ' ').padEnd(21);
    const rulesStr = String(snap.metrics ? snap.metrics.totalRules : '-').padEnd(6);
    const tokensStr = String(snap.metrics ? snap.metrics.estimatedTokens : '-').padEnd(7);
    const msgStr = (snap.message || '').substring(0, 30);

    const isLatest = idx === 0 ? '\x1b[32m(latest)\x1b[0m ' : '';
    lines.push(`${indexStr} ${tagStr} ${dateStr} ${rulesStr} ${tokensStr} ${msgStr} ${isLatest}`.trim());
  });

  lines.push('\n\x1b[90mRun `mhai rollback <tag|@index>` to revert project context to any point in time.\x1b[0m');
  return lines.join('\n');
}

module.exports = {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  diffSnapshot,
  rollbackSnapshot,
  deleteSnapshot,
  pruneSnapshots,
  formatSnapshotsList
};
