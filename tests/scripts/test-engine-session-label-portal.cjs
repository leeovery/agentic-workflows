'use strict';

// ---------------------------------------------------------------------------
// Session labels inside Portal (domain/session-label-portal.cjs): which
// multiplexer labels the session, Portal before tmux; the label applied
// after the label's base, its original stashed under the session's name and
// kept across re-labels; the label put back at session end, at boot's
// repair and on resume, only while it is exactly the one applied, reset to
// the session's name by `portal rename` with no text; and every Portal
// error, or no `portal` at all, a no-op.
//
// Layer: verb. World: session-label-world.cjs — the Portal stub stands in
// for `portal` on a pinned PATH, and the engine only ever sees the stub.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { world, ZMX_NAME, inPortal, portalLabel, setPortalLabel, portalCalls, portalStash, setup, teardown, engine, resume, tmuxName, renameCount, optIn, ownStartTime } = require('./session-label-world.cjs');

const PHASE = `${ZMX_NAME} · pay · discussion · alpha`;
const label = (/** @type {object} */ opts = {}) => engine(['session', 'label', 'pay', 'discussion', 'alpha'], { noTmux: true, ...opts });
const cleanup = (/** @type {object} */ opts = {}) => engine(['session', 'cleanup', 'sess-1'], { noTmux: true, ...opts });

describe('engine session label — which multiplexer labels the session', () => {
  beforeEach(() => { setup(); inPortal(); optIn(); });
  afterEach(teardown);

  it('Portal labels the session where `$ZMX_SESSION` is set and `portal current` answers, before tmux', () => {
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: true, name: PHASE });
    assert.strictEqual(portalLabel(), PHASE);
    assert.strictEqual(tmuxName(), 'proj-abc', 'tmux left alone');
    assert.strictEqual(renameCount(), 0);
  });

  it('tmux labels the session where Portal does not answer, or `$ZMX_SESSION` is unset', () => {
    assert.strictEqual(engine(['session', 'label', 'pay'], { portalFail: true }).name, 'proj-abc · pay');
    assert.strictEqual(engine(['session', 'label', 'roadmap'], { noZmx: true }).name, 'proj-abc · roadmap');
    assert.strictEqual(portalLabel(), ZMX_NAME);
  });

  it('inside neither, nothing is labelled: no `portal` on the PATH is no Portal', () => {
    assert.deepStrictEqual(label({ noPortal: true }), { ok: true, labelled: false, reason: 'no-multiplexer' });
    assert.deepStrictEqual(label({ portalFail: true }), { ok: true, labelled: false, reason: 'no-multiplexer' });
    assert.strictEqual(portalLabel(), ZMX_NAME);
  });
});

describe('engine session label inside Portal', () => {
  beforeEach(() => { setup(); inPortal(); });
  afterEach(teardown);

  it('labels nothing while the project has not opted in', () => {
    assert.deepStrictEqual(label(), { ok: true, labelled: false, reason: 'disabled' });
    assert.deepStrictEqual(portalCalls(), []);
  });

  it('labels `{base} · {place}` through `portal rename --`, the original stashed under the session\'s name with its owner', () => {
    optIn();
    assert.deepStrictEqual(label(), { ok: true, labelled: true, name: PHASE });
    assert.deepStrictEqual(portalCalls(), ['current', `rename -- ${PHASE}`]);
    assert.deepStrictEqual(portalStash(), { session: ZMX_NAME, original: ZMX_NAME, applied: PHASE, session_id: 'sess-1', pid: process.pid, pid_start: ownStartTime() });
  });

  it('the base is the label up to its first ` · `: a label of the person\'s own made so never stacks, and is the original', () => {
    optIn();
    setPortalLabel(`${ZMX_NAME} · user-search`);
    assert.strictEqual(label().name, PHASE);
    assert.strictEqual(portalStash().original, `${ZMX_NAME} · user-search`);
  });

  it('a re-label keeps the stashed original, and a label already worn costs no rename', () => {
    optIn();
    label();
    assert.strictEqual(engine(['session', 'label', 'pay'], { noTmux: true }).name, `${ZMX_NAME} · pay`);
    assert.strictEqual(engine(['session', 'label', 'pay'], { noTmux: true }).name, `${ZMX_NAME} · pay`);
    assert.strictEqual(portalCalls().filter((call) => call.startsWith('rename')).length, 2);
    assert.strictEqual(portalStash().original, ZMX_NAME);
  });

  it('a label the person set since is adopted as the original', () => {
    optIn();
    label();
    setPortalLabel('mine');
    assert.strictEqual(label().name, 'mine · pay · discussion · alpha');
    assert.strictEqual(portalStash().original, 'mine');
  });

  it('a stash that cannot be written leaves the label alone — stash-error', () => {
    optIn();
    fs.mkdirSync(path.join(world.dir, '.ledger', '.cache', '.session-labels'), { recursive: true });
    fs.writeFileSync(path.join(world.dir, '.ledger', '.cache', '.session-labels', 'portal'), ''); // a file where the store's folder must go
    assert.deepStrictEqual(label(), { ok: true, labelled: false, reason: 'stash-error' });
    assert.strictEqual(portalLabel(), ZMX_NAME);
  });

  it('a rename Portal refuses leaves the label alone — portal-error', () => {
    optIn();
    assert.deepStrictEqual(label({ portalFailRename: true }), { ok: true, labelled: false, reason: 'portal-error' });
    assert.strictEqual(portalLabel(), ZMX_NAME);
  });
});

describe('engine session cleanup, repair and resume inside Portal', () => {
  beforeEach(() => { setup(); inPortal(); optIn(); });
  afterEach(teardown);

  it('cleanup resets the label to the session\'s name by `portal rename` with no text, and drops the record', () => {
    label();
    assert.deepStrictEqual(cleanup(), { ok: true, restored: true });
    assert.strictEqual(portalLabel(), ZMX_NAME);
    assert.strictEqual(portalCalls().at(-1), 'rename');
    assert.strictEqual(portalStash(), null);
  });

  it('cleanup puts an original of the person\'s own back by `portal rename --`', () => {
    setPortalLabel('mine');
    label();
    assert.deepStrictEqual(cleanup(), { ok: true, restored: true });
    assert.strictEqual(portalLabel(), 'mine');
    assert.strictEqual(portalCalls().at(-1), 'rename -- mine');
  });

  it('cleanup puts nothing back where the label is no longer exactly the one applied, and drops the record', () => {
    label();
    setPortalLabel(`${PHASE} · more`);
    assert.deepStrictEqual(cleanup(), { ok: true, restored: false });
    assert.strictEqual(portalLabel(), `${PHASE} · more`);
    assert.strictEqual(portalStash(), null);
  });

  it('cleanup leaves a live peer\'s label and record alone, and keeps a record whose rename failed', () => {
    label({ sessionId: 'peer', claudePid: process.ppid });
    assert.deepStrictEqual(cleanup(), { ok: true, restored: false });
    assert.strictEqual(portalLabel(), PHASE);
    assert.notStrictEqual(portalStash(), null);
    assert.deepStrictEqual(engine(['session', 'cleanup', 'peer'], { noTmux: true, portalFailRename: true }), { ok: true, restored: false });
    assert.notStrictEqual(portalStash(), null);
  });

  it('cleanup without `portal` on the PATH, or with Portal erroring, is a no-op', () => {
    label();
    assert.deepStrictEqual(cleanup({ noPortal: true }), { ok: true, restored: false });
    assert.deepStrictEqual(cleanup({ portalFail: true }), { ok: true, restored: false });
    assert.strictEqual(portalLabel(), PHASE);
    assert.notStrictEqual(portalStash(), null);
  });

  it('boot\'s repair puts the calling session\'s own label back, and leaves a live peer\'s', () => {
    label({ sessionId: 'peer', claudePid: process.ppid });
    assert.deepStrictEqual(engine(['session', 'repair'], { noTmux: true }), { ok: true, repaired: false });
    assert.strictEqual(portalLabel(), PHASE);
    label();
    assert.deepStrictEqual(engine(['session', 'repair'], { noTmux: true }), { ok: true, repaired: true });
    assert.strictEqual(portalLabel(), ZMX_NAME);
    assert.strictEqual(portalStash(), null);
  });

  it('resume brings the conversation\'s label back after the session ended', () => {
    label();
    cleanup();
    assert.deepStrictEqual(resume(['sess-1'], { noTmux: true }), { ok: true, resumed: true });
    assert.strictEqual(portalLabel(), PHASE);
  });
});
