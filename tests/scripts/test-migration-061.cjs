'use strict';

//
// Tests for migration 061: conversation-positions (.cjs)
//
// Happy path (each position moves into its conversation's folder beside the
// system config — `WORKFLOWS_CONFIG_DIR`, else `~/.config/workflows` — and
// the emptied store directory goes), skip with nothing to move, idempotency,
// content preservation (the position's bytes, the stashes beside it, the
// folder's other files), and the guards: a folder already holding a newer
// position, entries that are not position files, a store path that is a
// file, a position another boot's run moved first, a move across file
// systems, and a move that fails with its position still there.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/061-conversation-positions.cjs');

let dir, config, pinned, updates, skips;

function run() {
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}
function cachePath(...parts) {
  return path.join(dir, '.workflows', '.cache', ...parts);
}
function legacy(name, content) {
  const file = cachePath('.session-labels', 'positions', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function conversationsPath(...parts) {
  return path.join(config, 'conversations', ...parts);
}
function folderFile(sessionId, name) {
  return conversationsPath(sessionId, name);
}
function read(file) {
  return fs.readFileSync(file, 'utf8');
}
/** Run with `fsFn` of `fs` standing in for the real one. */
function runWith(name, fsFn) {
  const real = fs[name];
  fs[name] = fsFn(real);
  try {
    run();
  } finally {
    fs[name] = real;
  }
}
/** Run while another boot's run of the migration acts between this run's read of the store and its moves. */
function runBeside(other) {
  runWith('readdirSync', (readdirSync) => function (...args) {
    const entries = readdirSync.apply(this, args);
    if (args[0] === cachePath('.session-labels', 'positions')) other();
    return entries;
  });
}

const POSITION = '{\n  "name": "pay",\n  "phase": "discussion",\n  "topic": "refunds",\n  "at": "2026-09-01T10:00:00.000Z"\n}\n';

describe('migration 061: label positions move into the conversation folders', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-061-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-061-config-'));
    pinned = process.env.WORKFLOWS_CONFIG_DIR;
    process.env.WORKFLOWS_CONFIG_DIR = config;
    updates = 0;
    skips = 0;
  });
  afterEach(() => {
    process.env.WORKFLOWS_CONFIG_DIR = pinned;
    for (const d of [dir, config]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('moves each position into its conversation folder beside the system config as position.json, one update each, and the emptied store directory goes', () => {
    legacy('sess-1.json', POSITION);
    legacy('sess-2.json', '{"name":"roadmap"}');
    run();
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), POSITION);
    assert.strictEqual(read(folderFile('sess-2', 'position.json')), '{"name":"roadmap"}');
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 2);
    assert.strictEqual(skips, 0);
  });

  it('with no WORKFLOWS_CONFIG_DIR — unset or empty — the folders sit in the home directory\'s `.config/workflows`', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-061-home-'));
    const before = process.env.HOME;
    process.env.HOME = home;
    try {
      delete process.env.WORKFLOWS_CONFIG_DIR;
      legacy('sess-1.json', POSITION);
      run();
      process.env.WORKFLOWS_CONFIG_DIR = '';
      legacy('sess-2.json', POSITION);
      run();
      assert.deepStrictEqual(fs.readdirSync(path.join(home, '.config', 'workflows', 'conversations')).sort(), ['sess-1', 'sess-2']);
      assert.strictEqual(read(path.join(home, '.config', 'workflows', 'conversations', 'sess-1', 'position.json')), POSITION);
    } finally {
      process.env.HOME = before;
      fs.rmSync(home, { recursive: true, force: true });
    }
    assert.strictEqual(fs.existsSync(conversationsPath()), false);
  });

  it('skips cleanly when there is no position store, and makes no conversation folder', () => {
    run();
    assert.strictEqual(fs.existsSync(conversationsPath()), false);
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('an empty position store goes, and counts as nothing moved', () => {
    fs.mkdirSync(cachePath('.session-labels', 'positions'), { recursive: true });
    run();
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('is idempotent — a second run finds nothing to move and leaves the folders as the first left them', () => {
    legacy('sess-1.json', POSITION);
    run();
    updates = 0;
    skips = 0;
    run();
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), POSITION);
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('preserves the stashes beside the store and every other file in the conversation folder', () => {
    fs.mkdirSync(cachePath('.session-labels'), { recursive: true });
    fs.writeFileSync(cachePath('.session-labels', 'abcd1234-1.json'), '{"tmux_id":"$1"}');
    fs.mkdirSync(conversationsPath('sess-1'), { recursive: true });
    fs.writeFileSync(folderFile('sess-1', 'workflow'), '');
    fs.writeFileSync(folderFile('sess-1', 'transcript'), '/home/me/.claude/projects/p/sess-1.jsonl');
    legacy('sess-1.json', POSITION);
    run();
    assert.strictEqual(read(cachePath('.session-labels', 'abcd1234-1.json')), '{"tmux_id":"$1"}');
    assert.deepStrictEqual(fs.readdirSync(conversationsPath('sess-1')).sort(), ['position.json', 'transcript', 'workflow']);
    assert.strictEqual(read(folderFile('sess-1', 'transcript')), '/home/me/.claude/projects/p/sess-1.jsonl');
  });

  it('a folder already holding a position keeps it — the newer write — and the legacy file is dropped', () => {
    fs.mkdirSync(conversationsPath('sess-1'), { recursive: true });
    fs.writeFileSync(folderFile('sess-1', 'position.json'), '{"name":"billing"}');
    legacy('sess-1.json', POSITION);
    run();
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), '{"name":"billing"}');
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 1);
  });

  it('leaves what is not a position file the engine wrote — a directory, another extension, an unsafe name — and the store directory holding it', () => {
    fs.mkdirSync(cachePath('.session-labels', 'positions', 'sess-dir.json'), { recursive: true });
    legacy('notes.txt', 'mine');
    legacy('odd name.json', POSITION);
    legacy('.json', POSITION);
    legacy('sess-1.json', POSITION);
    run();
    assert.deepStrictEqual(fs.readdirSync(cachePath('.session-labels', 'positions')).sort(), ['.json', 'notes.txt', 'odd name.json', 'sess-dir.json']);
    assert.deepStrictEqual(fs.readdirSync(conversationsPath()), ['sess-1']);
    assert.strictEqual(updates, 1);
  });

  it('a position another boot moved first is left to it — no error, and not counted here', () => {
    legacy('sess-1.json', POSITION);
    legacy('sess-2.json', '{"name":"roadmap"}');
    runBeside(() => {
      fs.mkdirSync(conversationsPath('sess-1'), { recursive: true });
      fs.renameSync(cachePath('.session-labels', 'positions', 'sess-1.json'), folderFile('sess-1', 'position.json'));
    });
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), POSITION);
    assert.strictEqual(read(folderFile('sess-2', 'position.json')), '{"name":"roadmap"}');
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
  });

  it('a position gone before its folder is there is left too — the other boot\'s move is still landing', () => {
    legacy('sess-1.json', POSITION);
    runBeside(() => fs.unlinkSync(cachePath('.session-labels', 'positions', 'sess-1.json')));
    assert.strictEqual(fs.existsSync(folderFile('sess-1', 'position.json')), false);
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('a move across file systems — a rename refused as cross-device — copies the position and removes the legacy file', () => {
    legacy('sess-1.json', POSITION);
    runWith('renameSync', () => () => {
      throw Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' });
    });
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), POSITION);
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 1);
  });

  it('a move that fails with its position still in the store fails the run', () => {
    legacy('sess-1.json', POSITION);
    fs.mkdirSync(conversationsPath(), { recursive: true });
    fs.writeFileSync(conversationsPath('sess-1'), 'a file where the folder must go');
    assert.throws(() => run());
    assert.strictEqual(read(cachePath('.session-labels', 'positions', 'sess-1.json')), POSITION);
  });

  it('a rename that fails for any reason but the file systems fails the run, the position still in the store', () => {
    legacy('sess-1.json', POSITION);
    assert.throws(() => runWith('renameSync', () => () => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    }), /EACCES/);
    assert.strictEqual(read(cachePath('.session-labels', 'positions', 'sess-1.json')), POSITION);
    assert.strictEqual(fs.existsSync(folderFile('sess-1', 'position.json')), false);
  });

  it('skips a store path that is a file rather than a directory, leaving it', () => {
    fs.mkdirSync(cachePath('.session-labels'), { recursive: true });
    fs.writeFileSync(cachePath('.session-labels', 'positions'), 'not a directory');
    run();
    assert.strictEqual(read(cachePath('.session-labels', 'positions')), 'not a directory');
    assert.strictEqual(fs.existsSync(conversationsPath()), false);
    assert.strictEqual(skips, 1);
  });
});
