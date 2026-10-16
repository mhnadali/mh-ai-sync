/**
 * M.H. AI Sync - Test Suite for Phase 14: Context Versioning, Snapshots & Time-Machine Rollback
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  diffSnapshot,
  rollbackSnapshot,
  deleteSnapshot,
  pruneSnapshots,
  formatSnapshotsList
} = require('./src/snapshots');

const SANDBOX_DIR = path.join(__dirname, '.test_sandbox_phase14');

function setupSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const initialConfig = {
    version: '1.0.0',
    project: {
      name: 'Time Machine Project',
      overview: 'Project testing context snapshots and rollback.',
      techStack: ['Node.js', 'TypeScript']
    },
    commands: {
      test: 'npm test',
      build: 'npm run build'
    },
    guidelines: {
      codeStyle: ['Follow Clean Code and DRY principles.'],
      gitPractices: ['Never push directly to main.'],
      agentRules: ['Preserve existing comments and docstrings.']
    },
    skills: [
      { name: 'git-flow', description: 'Manages git branch workflow' }
    ],
    mcpServers: {
      memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] }
    }
  };

  fs.writeFileSync(
    path.join(SANDBOX_DIR, 'mhai.config.json'),
    JSON.stringify(initialConfig, null, 2),
    'utf8'
  );

  return initialConfig;
}

function cleanSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

async function runTests() {
  console.log('=== Testing Phase 14: Context Versioning, Snapshots & Time-Machine Rollback ===\n');

  const initialConfig = setupSandbox();

  // Test 1: createSnapshot creates timestamped checkpoint with metrics
  console.log('Test 1: createSnapshot creates timestamped snapshot with metrics and checksum');
  const snap1 = createSnapshot(SANDBOX_DIR, {
    tag: 'v1.0-baseline',
    message: 'Initial project baseline'
  });

  assert.ok(snap1.id);
  assert.strictEqual(snap1.tag, 'v1.0-baseline');
  assert.strictEqual(snap1.message, 'Initial project baseline');
  assert.strictEqual(snap1.metrics.totalRules, 3);
  assert.strictEqual(snap1.metrics.totalSkills, 1);
  assert.strictEqual(snap1.metrics.totalMcpServers, 1);
  assert.ok(snap1.metrics.estimatedTokens > 0);
  assert.ok(snap1.checksum.length >= 8);

  const snapshotPath = path.join(SANDBOX_DIR, '.mhai', 'snapshots', snap1.id, 'snapshot.json');
  assert.ok(fs.existsSync(snapshotPath), 'snapshot.json must exist on disk');
  console.log('✔ Test 1 Passed: Snapshot created with accurate metrics, checksum, and file persistence.');

  // Test 2: listSnapshots lists snapshots in reverse chronological order
  console.log('\nTest 2: listSnapshots lists checkpoints newest first');
  // Add small delay to get different timestamp
  await new Promise(r => setTimeout(r, 20));

  // Modify config and save snap2
  const modifiedConfig = JSON.parse(JSON.stringify(initialConfig));
  modifiedConfig.guidelines.agentRules.push('Always write unit tests before implementation.');
  fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(modifiedConfig, null, 2), 'utf8');

  const snap2 = createSnapshot(SANDBOX_DIR, {
    tag: 'v1.1-tdd-rules',
    message: 'Added TDD rule'
  });

  const list = listSnapshots(SANDBOX_DIR);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, snap2.id, 'Newest snapshot must appear first');
  assert.strictEqual(list[1].id, snap1.id, 'Older snapshot must appear second');

  const formatted = formatSnapshotsList(list);
  assert.ok(formatted.includes('v1.0-baseline'));
  assert.ok(formatted.includes('v1.1-tdd-rules'));
  assert.ok(formatted.includes('(latest)'));
  console.log('✔ Test 2 Passed: Snapshots chronologically sorted and list report rendered cleanly.');

  // Test 3: getSnapshot resolves by tag, ID, or relative index (@0, @1, latest)
  console.log('\nTest 3: getSnapshot resolves by exact tag, relative index, and partial query');
  const byLatest = getSnapshot(SANDBOX_DIR, 'latest');
  assert.strictEqual(byLatest.id, snap2.id);

  const byIndex0 = getSnapshot(SANDBOX_DIR, '@0');
  assert.strictEqual(byIndex0.id, snap2.id);

  const byIndex1 = getSnapshot(SANDBOX_DIR, '@1');
  assert.strictEqual(byIndex1.id, snap1.id);

  const byTag = getSnapshot(SANDBOX_DIR, 'v1.0-baseline');
  assert.strictEqual(byTag.id, snap1.id);
  console.log('✔ Test 3 Passed: Snapshots successfully resolved via tags and relative @index pointers.');

  // Test 4: diffSnapshot compares current config against historical checkpoint
  console.log('\nTest 4: diffSnapshot calculates line differences between disk config and snapshot');
  const diffResult = diffSnapshot(SANDBOX_DIR, 'v1.0-baseline');
  assert.strictEqual(diffResult.hasChanges, true);
  assert.ok(diffResult.unifiedDiffText.includes('+'));
  assert.ok(diffResult.unifiedDiffText.includes('Always write unit tests'));

  const diffIdentical = diffSnapshot(SANDBOX_DIR, 'latest');
  assert.strictEqual(diffIdentical.hasChanges, false);
  console.log('✔ Test 4 Passed: Snapshot diff accurately highlights added rules and detect zero change when identical.');

  // Test 5: rollbackSnapshot reverts config and auto-creates pre-rollback backup
  console.log('\nTest 5: rollbackSnapshot restores historical configuration with safety backup');
  const rollbackResult = rollbackSnapshot(SANDBOX_DIR, 'v1.0-baseline');
  assert.strictEqual(rollbackResult.restoredSnapshot.tag, 'v1.0-baseline');
  assert.ok(rollbackResult.backupSnapshot, 'Must automatically capture pre-rollback backup');
  assert.strictEqual(rollbackResult.backupSnapshot.tag, 'pre-rollback');

  // Verify disk mhai.config.json is restored
  const currentOnDisk = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), 'utf8'));
  assert.strictEqual(currentOnDisk.guidelines.agentRules.length, 1);
  assert.strictEqual(currentOnDisk.guidelines.agentRules[0], 'Preserve existing comments and docstrings.');
  console.log('✔ Test 5 Passed: Project context successfully restored to v1.0-baseline with automatic safety backup.');

  // Test 6: pruneSnapshots removes older checkpoints keeping maxKeep
  console.log('\nTest 6: pruneSnapshots purges older checkpoints retaining newest N');
  for (let i = 0; i < 5; i++) {
    createSnapshot(SANDBOX_DIR, { tag: `temp-snap-${i}`, message: `Prune test ${i}` });
  }
  const beforePrune = listSnapshots(SANDBOX_DIR);
  assert.ok(beforePrune.length >= 7);

  const pruneResult = pruneSnapshots(SANDBOX_DIR, 3);
  assert.strictEqual(pruneResult.remainingCount, 3);
  const afterPrune = listSnapshots(SANDBOX_DIR);
  assert.strictEqual(afterPrune.length, 3);
  console.log(`✔ Test 6 Passed: Pruning removed ${pruneResult.prunedCount} older snapshots, preserving newest 3.`);

  // Test 7: CLI integration in sandbox
  console.log('\nTest 7: CLI integration (`mhai snapshot save`, `list`, `diff`, `rollback`)');
  const binPath = path.join(__dirname, 'bin', 'index.js');

  // CLI snapshot save
  const cliSave = execSync(`node "${binPath}" snapshot save cli-checkpoint -m "Created via CLI"`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliSave.includes('Snapshot saved successfully'));

  // CLI snapshot list
  const cliList = execSync(`node "${binPath}" snapshot list`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliList.includes('cli-checkpoint'));

  // Modify config to produce diff
  const cfg = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), 'utf8'));
  cfg.commands.lint = 'eslint .';
  fs.writeFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), JSON.stringify(cfg, null, 2), 'utf8');

  // CLI snapshot diff
  const cliDiff = execSync(`node "${binPath}" snapshot diff cli-checkpoint`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliDiff.includes('eslint .'));

  // CLI rollback
  const cliRollback = execSync(`node "${binPath}" rollback cli-checkpoint`, {
    cwd: SANDBOX_DIR,
    encoding: 'utf8'
  });
  assert.ok(cliRollback.includes('Successfully rolled back to snapshot'));
  assert.ok(cliRollback.includes('Rebuilding and synchronizing all AI agent target configurations'));

  // Verify restored state on disk
  const finalDiskCfg = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'mhai.config.json'), 'utf8'));
  assert.strictEqual(finalDiskCfg.commands.lint, undefined);
  console.log('✔ Test 7 Passed: CLI commands `snapshot save`, `list`, `diff`, and `rollback` executed successfully.');

  cleanSandbox();
  console.log('\n✨ ALL PHASE 14 CONTEXT VERSIONING & TIME-MACHINE TESTS PASSED WITH 100% SUCCESS! ✨\n');
}

runTests().catch(err => {
  console.error('\n✖ Test failed:', err);
  cleanSandbox();
  process.exit(1);
});
