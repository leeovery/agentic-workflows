'use strict';

// ---------------------------------------------------------------------------
// `engine session cleanup`, SessionEnd's target: the label put back, restore
// ownership, id drift across a server restart (chain resolution, the drifted
// restore) and the hook's stdin contract.
//
// Layer: verb. World: session-label-world.cjs — the shared tmux stub stands
// in for tmux, and the engine only ever sees the stub.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { world, setup, teardown, engine, resume, tmuxName, setTmuxName, setTmuxId, stashFile, stashRecords, writeStash, position, ownStartTime, optIn, head } = require('./session-label-world.cjs');

describe('engine session cleanup', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('restores the original name and drops the stash for the owning session', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores the original from a name-only label', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores the name and leaves the position — what the resume reads', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const before = position('sess-1');
    assert.strictEqual(engine(['session', 'cleanup', 'sess-1']).restored, true);
    assert.strictEqual(stashFile(), null);
    assert.deepStrictEqual(position('sess-1'), before);
  });

  it('touches nothing without a session id — argument, stdin JSON, or otherwise', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    for (const input of ['', '{}', 'not json']) {
      const res = engine(['session', 'cleanup'], { input });
      assert.deepStrictEqual(res, { ok: true, restored: false });
    }
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('reads the owning session id from the hook stdin JSON', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup'], { input: '{"session_id":"sess-1"}' });
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a hook fired outside the project root finds the store through CLAUDE_PROJECT_DIR', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { cwd: world.stubDir, projectDir: world.dir });
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('a hook fired outside the project root with no CLAUDE_PROJECT_DIR touches nothing', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { cwd: world.stubDir });
    assert.deepStrictEqual(res, { ok: true, restored: false });
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the record waits for a sweep that can find it');
  });

  it('leaves another session\'s stash alone while its owner still runs', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-other']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile());
  });

  it('sweeps another session\'s stash once its owner is dead', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const file = /** @type {string} */ (stashFile());
    const stash = JSON.parse(fs.readFileSync(file, 'utf8'));
    stash.pid_start = 'a start time no live process carries';
    fs.writeFileSync(file, JSON.stringify(stash) + '\n');
    const res = engine(['session', 'cleanup', 'sess-other']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores across a server restart — the label found by name under a renumbered id', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('restores a polluted stash to the chain-resolved true original', () => {
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · experiment · beta', session_id: 'sess-1' });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · experiment · beta');
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc', 'never the polluted intermediate');
    assert.strictEqual(stashFile(), null, 'both links consumed');
  });

  it('keeps a link a live session\'s name still chains through', () => {
    optIn();
    // sess-2 wears the compounded name and still runs; sess-1's link record
    // holds the only path to the true original — its sweep must not drop it.
    writeStash('link-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-1' });
    writeStash('head-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · experiment · beta', session_id: 'sess-2', pid: process.pid, pid_start: ownStartTime() });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · experiment · beta');
    setTmuxId('$9');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(stashRecords().length, 2, 'the link survives for sess-2\'s recomposition');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha · pay · experiment · beta');
  });

  it('restores an ownerless stash for whichever session sweeps', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { sessionId: null });
    const res = engine(['session', 'cleanup', 'sess-any']);
    assert.strictEqual(res.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('never clobbers a manual rename — stash dropped, name kept', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxName('renamed-by-hand');
    const res = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(res.restored, false);
    assert.strictEqual(tmuxName(), 'renamed-by-hand');
    assert.strictEqual(stashFile(), null);
  });

  it('keeps the stash when the restore rename fails, and restores on the next sweep', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { failRename: true });
    assert.strictEqual(res.restored, false);
    assert.ok(stashFile(), 'stash kept for the next sweep');
    const retry = engine(['session', 'cleanup', 'sess-1']);
    assert.strictEqual(retry.restored, true);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(stashFile(), null);
  });

  it('survives the tmux session being gone', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'cleanup', 'sess-1'], { fail: true });
    assert.strictEqual(res.restored, false);
    assert.strictEqual(stashFile(), null);
  });
});
