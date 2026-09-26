'use strict';

//
// Tests for migration 061: conversation-positions (.cjs)
//
// Happy path (each position moves into its conversation's folder, the
// emptied store directory goes), skip with nothing to move, idempotency,
// content preservation (the position's bytes, the stashes beside it, the
// folder's other files), and the guards: a folder already holding a newer
// position, entries that are not position files, a store path that is a file.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/061-conversation-positions.cjs');

let dir, updates, skips;

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
function folderFile(sessionId, name) {
  return cachePath('.conversations', sessionId, name);
}
function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const POSITION = '{\n  "name": "pay",\n  "phase": "discussion",\n  "topic": "refunds",\n  "at": "2026-09-01T10:00:00.000Z"\n}\n';

describe('migration 061: label positions move into the conversation folders', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-061-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('moves each position into its conversation folder as position.json, one update each, and the emptied store directory goes', () => {
    legacy('sess-1.json', POSITION);
    legacy('sess-2.json', '{"name":"roadmap"}');
    run();
    assert.strictEqual(read(folderFile('sess-1', 'position.json')), POSITION);
    assert.strictEqual(read(folderFile('sess-2', 'position.json')), '{"name":"roadmap"}');
    assert.strictEqual(fs.existsSync(cachePath('.session-labels', 'positions')), false);
    assert.strictEqual(updates, 2);
    assert.strictEqual(skips, 0);
  });

  it('skips cleanly when there is no position store, and makes no conversation folder', () => {
    run();
    assert.strictEqual(fs.existsSync(cachePath('.conversations')), false);
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
    fs.mkdirSync(cachePath('.conversations', 'sess-1'), { recursive: true });
    fs.writeFileSync(folderFile('sess-1', 'workflow'), '');
    fs.writeFileSync(folderFile('sess-1', 'transcript'), '/home/me/.claude/projects/p/sess-1.jsonl');
    legacy('sess-1.json', POSITION);
    run();
    assert.strictEqual(read(cachePath('.session-labels', 'abcd1234-1.json')), '{"tmux_id":"$1"}');
    assert.deepStrictEqual(fs.readdirSync(cachePath('.conversations', 'sess-1')).sort(), ['position.json', 'transcript', 'workflow']);
    assert.strictEqual(read(folderFile('sess-1', 'transcript')), '/home/me/.claude/projects/p/sess-1.jsonl');
  });

  it('a folder already holding a position keeps it — the newer write — and the legacy file is dropped', () => {
    fs.mkdirSync(cachePath('.conversations', 'sess-1'), { recursive: true });
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
    assert.deepStrictEqual(fs.readdirSync(cachePath('.conversations')), ['sess-1']);
    assert.strictEqual(updates, 1);
  });

  it('skips a store path that is a file rather than a directory, leaving it', () => {
    fs.mkdirSync(cachePath('.session-labels'), { recursive: true });
    fs.writeFileSync(cachePath('.session-labels', 'positions'), 'not a directory');
    run();
    assert.strictEqual(read(cachePath('.session-labels', 'positions')), 'not a directory');
    assert.strictEqual(fs.existsSync(cachePath('.conversations')), false);
    assert.strictEqual(skips, 1);
  });
});
