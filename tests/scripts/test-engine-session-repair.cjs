'use strict';

// ---------------------------------------------------------------------------
// `engine session repair`, boot's repair of the label store (orphan pruning,
// the repair's own-label restore), and `engine session resume`, SessionStart's
// target, re-applying the conversation's position and answering on stderr.
//
// Layer: verb. World: session-label-world.cjs — the shared tmux stub stands
// in for tmux, and the engine only ever sees the stub.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { processStartTime } = require('../../skills/leeway-engine/scripts/kernel/process.cjs');
const harness = require('./engine-harness.cjs');
const { world, RESUME_STDIN, projectWith, setup, teardown, engine, resume, tmuxName, renameCount, setTmuxName, setTmuxId, stashFile, stashRecords, writeStash, conversation, position, writePosition, peerIdentity, optIn, head } = require('./session-label-world.cjs');

describe('engine session repair', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** A stranded label on the current terminal: dead owner, name still worn. */
  function strand() {
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    setTmuxName('proj-abc · pay · discussion · alpha');
  }

  it('no-ops as disabled — a stranded label included', () => {
    strand();
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the stash is not pruned');
  });

  it('no-ops outside tmux', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair'], { noTmux: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
  });

  it('restores a stranded label\'s true original and consumes the record', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('repairs a multi-hop compounded name through the chain', () => {
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · experiment · beta', session_id: 'sess-older' });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · experiment · beta');
    setTmuxId('$9');
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null, 'both links consumed');
  });

  it('restores the calling session\'s own label — the start menu is the original name', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('drops the calling session\'s own position as it restores its own label — the start menu is no position', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.ok(position('sess-1'));
    assert.deepStrictEqual(engine(['session', 'repair']), { ok: true, repaired: true });
    assert.strictEqual(position('sess-1'), null);
  });

  it('a dead-owner restore keeps the dead session\'s position — that session may yet be resumed', () => {
    optIn();
    strand();
    writePosition('sess-old', { name: 'pay', phase: 'discussion', topic: 'alpha' });
    assert.deepStrictEqual(engine(['session', 'repair']), { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-old'), 'kept for the resume');
  });

  it('the calling session\'s own position comes off whatever the label does — a failed rename, labels off, outside tmux', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(engine(['session', 'repair'], { failRename: true }), { ok: true, repaired: false });
    assert.strictEqual(position('sess-1'), null);
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { noTmux: true });
    assert.deepStrictEqual(engine(['session', 'repair'], { noTmux: true }), { ok: true, repaired: false });
    assert.strictEqual(position('sess-1'), null);
    engine(['session', 'label-config', 'false']);
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(engine(['session', 'repair']), { ok: true, repaired: false });
    assert.strictEqual(position('sess-1'), null);
  });

  it('ages no position out — a position lives as long as its conversation\'s folder, opted in or not', () => {
    writePosition('sess-old', { name: 'pay' });
    engine(['session', 'repair']);
    optIn();
    engine(['session', 'repair']);
    assert.deepStrictEqual(position('sess-old'), { name: 'pay' });
  });

  it('owns its label through the pid arm — a later conversation in the same process, whose predecessor keeps its position', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const res = engine(['session', 'repair'], { sessionId: 'sess-2' });
    assert.deepStrictEqual(res, { ok: true, repaired: true });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
    assert.ok(position('sess-1'), 'the position describes the conversation, and that conversation may yet be resumed');
    assert.strictEqual(position('sess-2'), null);
  });

  it('leaves a live peer\'s label — another process, still running', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: 'sess-peer', claudePid: process.ppid });
    const res = engine(['session', 'repair'], { sessionId: 'sess-2' });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('prunes a dead-owner orphan no live name needs, and keeps a needed link', () => {
    optIn();
    // The orphan: a label for a session this server no longer has, worn by
    // nothing. The link: dead-owner too, but the live compounded name still
    // chains through it (its head record's owner — a peer process — runs;
    // repair defers).
    writeStash('orphan', { tmux_id: '$4', original: 'gone-proj', applied: 'gone-proj · shop · planning', session_id: 'sess-gone' });
    writeStash('link-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('head-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · experiment · beta', session_id: 'sess-2', ...peerIdentity() });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · experiment · beta');
    setTmuxId('$9');
    const res = engine(['session', 'repair']);
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    const records = stashRecords();
    assert.strictEqual(records.length, 2, 'orphan pruned, live head and its link kept');
    assert.ok(records.every((r) => r.original !== 'gone-proj'));
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha · pay · experiment · beta');
  });

  it('keeps a dead-owner record when the server cannot be listed', () => {
    optIn();
    writeStash('orphan', { tmux_id: '$4', original: 'gone-proj', applied: 'gone-proj · shop · planning', session_id: 'sess-gone' });
    const res = engine(['session', 'repair'], { failLs: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.ok(stashFile(), 'an unverifiable name proves nothing — nothing pruned');
  });

  it('no-ops on any tmux error', () => {
    optIn();
    strand();
    const res = engine(['session', 'repair'], { fail: true });
    assert.deepStrictEqual(res, { ok: true, repaired: false });
    assert.ok(stashFile(), 'the record keeps the repair available');
  });
});

describe('engine session resume', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** A session that labelled, then ended: name restored, stash gone, position kept. */
  function ended(args = ['pay', 'discussion', 'alpha']) {
    optIn();
    engine(['session', 'label', ...args]);
    engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
    assert.ok(position('sess-1'));
  }

  it('brings the label back from the hook\'s stdin JSON, the stash owned by the resuming process — the SessionStart contract', () => {
    ended();
    const res = resume([], { input: RESUME_STDIN('sess-1'), claudePid: process.ppid });
    assert.deepStrictEqual(res, { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.session_id, 'sess-1');
    assert.strictEqual(stash.pid, process.ppid, 'the new process owns the label it wears');
    assert.strictEqual(stash.pid_start, processStartTime(process.ppid));
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('takes the session id as an argument too — usable by hand', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('a name-only position comes back as the arrival label', () => {
    ended(['pay']);
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
  });

  it('over a live peer\'s label it is the last label — last label wins, as any label does', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: 'sess-peer', claudePid: process.ppid });
    writePosition('sess-1', { name: 'pay', phase: 'planning', topic: 'pay' });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · planning');
    assert.strictEqual(stashRecords().length, 1);
    assert.strictEqual(stashRecords()[0].session_id, 'sess-1');
  });

  it('is idempotent when the name is already worn — no rename, one record', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const renames = renameCount();
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(renameCount(), renames);
    assert.strictEqual(stashRecords().length, 1);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('answers nothing without a position — a fresh id, or no id at all', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-fresh']), { ok: true, resumed: false });
    for (const input of ['', '{}', 'not json']) {
      assert.deepStrictEqual(resume([], { input }), { ok: true, resumed: false });
    }
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-1'), 'untouched');
  });

  it('is gated like label — outside tmux and disabled both answer nothing and keep the position', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { noTmux: true }), { ok: true, resumed: false });
    engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.ok(position('sess-1'));
  });

  it('a tmux error answers nothing and keeps the position for the next resume', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { fail: true }), { ok: true, resumed: false });
    assert.ok(position('sess-1'));
  });

  it('never throws on a work unit the project no longer has — it labels nothing and keeps the position, which goes with its folder', () => {
    ended();
    fs.rmSync(path.join(world.dir, '.leeway', 'pay'), { recursive: true });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a phase the engine no longer knows labels nothing and keeps the position too', () => {
    optIn();
    writePosition('sess-1', { name: 'pay', phase: 'deploying', topic: 'alpha' });
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: false });
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'deploying', topic: 'alpha' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  /** A second workflows project, opted in, with the work units named — another checkout. */
  function otherProject(/** @type {string[]} */ units) {
    const other = projectWith('engine-label-other-', units);
    fs.writeFileSync(path.join(other, '.leeway', 'manifest.json'), JSON.stringify({ defaults: { tmux_labels: true } }) + '\n');
    return other;
  }

  it('the position is the conversation\'s, found from any project — resumed in another checkout that has its work unit, the label comes back there', () => {
    ended();
    const other = otherProject(['pay']);
    try {
      assert.deepStrictEqual(resume(['sess-1'], { cwd: other }), { ok: true, resumed: true });
      assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    } finally {
      harness.cleanupFixture(other);
    }
  });

  it('resumed in a project without its work unit, it labels nothing and keeps the position — back in its own project, the label returns', () => {
    ended();
    const other = otherProject([]);
    try {
      assert.deepStrictEqual(resume([], { cwd: other, input: RESUME_STDIN('sess-1') }), { ok: true, resumed: false });
      assert.strictEqual(tmuxName(), 'proj-abc');
      assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
    } finally {
      harness.cleanupFixture(other);
    }
    assert.deepStrictEqual(resume(['sess-1']), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('a hook fired outside the project root finds the store through CLAUDE_PROJECT_DIR', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { cwd: world.stubDir, projectDir: world.dir }), { ok: true, resumed: true });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
  });

  it('a hook fired outside the project root with no CLAUDE_PROJECT_DIR labels nothing and keeps the position', () => {
    ended();
    assert.deepStrictEqual(resume(['sess-1'], { cwd: world.stubDir }), { ok: true, resumed: false });
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('refuses a second argument loudly — an authoring bug, never a silent no-op', () => {
    const err = engine(['session', 'resume', 'a', 'b'], { expectFail: true });
    assert.match(err.error, /Usage: engine session resume \[session-id\]/);
  });
});
