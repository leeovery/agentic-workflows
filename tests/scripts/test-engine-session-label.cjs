'use strict';

// ---------------------------------------------------------------------------
// `engine session label`: a place labelling itself — the arrival forms (a
// work unit alone, the roadmap and product identities), phase-hop
// recomposition, the per-checkout stash, peer-checkout isolation, user-rename
// adoption and owner identity — the conversation's position every label call
// records (position.cjs, whose own suite is test-engine-position.cjs), and the
// project manifest's stamp.
//
// Layer: verb. World: session-label-world.cjs — the shared tmux stub stands
// in for tmux, and the engine only ever sees the stub.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { world, git, stateGit, projectWith, setup, teardown, engine, resume, tmuxName, setTmuxName, setTmuxId, stashFile, stashRecords, writeStash, conversationsRoot, conversation, position, ownStartTime, optIn } = require('./session-label-world.cjs');

describe('engine session label', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('no-ops as disabled when the opt-in was never recorded', () => {
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('no-ops as disabled when the opt-in is false', () => {
    engine(['session', 'label-config', 'false']);
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });

  it('no-ops outside tmux even when opted in', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { noTmux: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'no-tmux' });
  });

  it('reports tmux-error without failing when tmux itself errors', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { fail: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'tmux-error' });
  });

  it('renames the tmux session and stashes the original in the checkout\'s cache', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(res.name, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    const file = stashFile();
    assert.ok(file, 'stash written under .leeway/.cache/.session-labels');
    assert.strictEqual(stateGit(['status', '--porcelain', '--', 'manifest.json']) + git(['status', '--porcelain', '--', '.claude']), '',
      'the label writes the cache alone — the opt-in and its hook were committed at the choice');
    const stash = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
    assert.strictEqual(stash.applied, 'proj-abc · pay · discussion · alpha');
    assert.strictEqual(stash.session_id, 'sess-1');
    assert.strictEqual(stash.tmux_id, '$7');
    assert.strictEqual(stash.socket, '/fake/sock');
    assert.strictEqual(stash.pid, process.pid, 'owner identity recorded from CLAUDE_PID');
    assert.strictEqual(stash.pid_start, ownStartTime());
  });

  it('records a pid-less stash when no CLAUDE_PID reaches the call', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha'], { claudePid: null });
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.pid, null);
    assert.strictEqual(stash.pid_start, null);
  });

  it('collapses the topic when it equals the work unit', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'scoping', 'pay']);
    assert.strictEqual(res.name, 'proj-abc · pay · scoping');
  });

  it('labels a renamed topic by the name it goes by, in its topic\'s phases alone (8.S77)', () => {
    optIn();
    fs.writeFileSync(path.join(world.dir, '.leeway', 'pay', 'manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { alpha: { source: 'discovery', summary: 'Alpha', order: 1, title: 'login' } } }, discussion: { items: { alpha: { status: 'completed' } } } },
    }));
    assert.deepStrictEqual(['discussion', 'specification'].map((phase) => engine(['session', 'label', 'pay', phase, 'alpha']).name),
      ['proj-abc · pay · discussion · login', 'proj-abc · pay · specification · alpha']);
  });

  it('recomposes from the stashed original on a phase hop', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    const res = engine(['session', 'label', 'pay', 'specification', 'alpha']);
    assert.strictEqual(res.name, 'proj-abc · pay · specification · alpha');
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
  });

  it('labels the place alone on arrival — a work unit with no phase', () => {
    optIn();
    const res = engine(['session', 'label', 'pay']);
    assert.strictEqual(res.name, 'proj-abc · pay');
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
    const stash = JSON.parse(fs.readFileSync(/** @type {string} */ (stashFile()), 'utf8'));
    assert.strictEqual(stash.original, 'proj-abc');
    assert.strictEqual(stash.applied, 'proj-abc · pay');
  });

  it('labels the roadmap and the product\'s conversation by identity — project-level places with no directory', () => {
    optIn();
    for (const place of ['roadmap', 'product']) {
      assert.ok(!fs.existsSync(path.join(world.dir, '.leeway', place)), `${place} has no work-unit directory`);
      const res = engine(['session', 'label', place]);
      assert.strictEqual(res.name, `proj-abc · ${place}`);
      assert.strictEqual(tmuxName(), `proj-abc · ${place}`);
    }
  });

  it('a phase label after an arrival, and an arrival after a phase, both recompose from the true original', () => {
    optIn();
    engine(['session', 'label', 'pay']);
    const phase = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(phase.name, 'proj-abc · pay · discussion · alpha');
    const back = engine(['session', 'label', 'pay']);
    assert.strictEqual(back.name, 'proj-abc · pay');
    assert.strictEqual(tmuxName(), 'proj-abc · pay');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'one record per terminal, whatever the hops');
    assert.strictEqual(records[0].original, 'proj-abc');
  });

  it('a peer checkout\'s cleanup and repair never touch this checkout\'s records', () => {
    optIn();
    const dirB = projectWith('engine-label-b-', ['shop']);
    try {
      engine(['session', 'label', 'pay', 'discussion', 'alpha']);
      const file = /** @type {string} */ (stashFile());
      const record = fs.readFileSync(file, 'utf8');
      const foreign = engine(['session', 'cleanup', 'sess-other'], { cwd: dirB });
      assert.strictEqual(foreign.restored, false);
      assert.strictEqual(fs.readFileSync(file, 'utf8'), record);
      // The sweep that takes a dead-owner record at home finds nothing here.
      const stash = JSON.parse(record);
      stash.pid_start = 'a start time no live process carries';
      const dead = JSON.stringify(stash) + '\n';
      fs.writeFileSync(file, dead);
      const swept = engine(['session', 'cleanup', 'sess-other'], { cwd: dirB });
      assert.strictEqual(swept.restored, false);
      const repair = engine(['session', 'repair'], { cwd: dirB });
      assert.deepStrictEqual(repair, { ok: true, repaired: false });
      assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
      assert.strictEqual(fs.readFileSync(file, 'utf8'), dead, 'this checkout\'s record is intact');
      assert.ok(!fs.existsSync(path.join(dirB, '.leeway', '.cache', '.session-labels')), 'the peer gains no records');
      const home = engine(['session', 'cleanup', 'sess-other']);
      assert.strictEqual(home.restored, true, 'the record still does its job at home');
      assert.strictEqual(tmuxName(), 'proj-abc');
    } finally {
      harness.cleanupFixture(dirB);
    }
  });

  it('adopts a user rename as the new original', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxName('my-new-name');
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.name, 'my-new-name · pay · discussion · alpha');
  });

  it('recomposes across a server restart — renumbered id, label carried in the name', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    setTmuxId('$9'); // restart: the stash key no longer matches, the labelled name survived
    const res = engine(['session', 'label', 'pay', 'specification', 'alpha'], { sessionId: 'sess-2' });
    assert.strictEqual(res.name, 'proj-abc · pay · specification · alpha');
    assert.strictEqual(tmuxName(), 'proj-abc · pay · specification · alpha');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'the drifted record is consumed, not left to compound');
    assert.strictEqual(records[0].tmux_id, '$9');
    assert.strictEqual(records[0].original, 'proj-abc');
  });

  it('chains through a polluted record to the true original', () => {
    // A polluted chain: a stranded label was adopted as the original by a
    // label that found no record for it, so the current record's `original`
    // is itself a label — whose own record still holds the true name.
    optIn();
    writeStash('old-7', { tmux_id: '$7', original: 'proj-abc', applied: 'proj-abc · pay · discussion · alpha', session_id: 'sess-old' });
    writeStash('old-9', { tmux_id: '$9', original: 'proj-abc · pay · discussion · alpha', applied: 'proj-abc · pay · discussion · alpha · pay · experiment · beta', session_id: 'sess-older' });
    setTmuxName('proj-abc · pay · discussion · alpha · pay · experiment · beta');
    setTmuxId('$9');
    const res = engine(['session', 'label', 'pay', 'planning', 'alpha']);
    assert.strictEqual(res.name, 'proj-abc · pay · planning · alpha');
    const records = stashRecords();
    assert.strictEqual(records.length, 1, 'both chain links consumed');
    assert.strictEqual(records[0].original, 'proj-abc');
  });

  it('a rename failure leaves an inert stash — the next label does not compound', () => {
    optIn();
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { failRename: true });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'tmux-error' });
    assert.strictEqual(tmuxName(), 'proj-abc');
    const retry = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(retry.name, 'proj-abc · pay · discussion · alpha');
  });

  it('reports stash-error and leaves the name alone when the stash cannot be written', () => {
    optIn();
    fs.writeFileSync(path.join(world.dir, '.leeway', '.cache'), ''); // a file where the cache world.dir must go
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'stash-error' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a bad call site fails loudly for a user who never opted in too — nothing labelled, no position recorded', () => {
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    for (const [args, error] of [[['pay', 'deploying', 'alpha'], /unknown phase/], [['ghost', 'discussion', 'alpha'], /no work unit directory/]]) {
      assert.match(engine(['session', 'label', ...args], { expectFail: true }).error, error);
    }
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
    assert.strictEqual(stashFile(), null);
  });

  it('rejects an unknown phase with labels on as well — nothing labelled, no position recorded', () => {
    optIn();
    const err = engine(['session', 'label', 'pay', 'deploying', 'alpha'], { expectFail: true });
    assert.match(err.error, /unknown phase/);
    assert.strictEqual(tmuxName(), 'proj-abc');
    assert.strictEqual(position('sess-1'), null);
  });

  it('rejects a missing work unit with labels on as well', () => {
    optIn();
    const err = engine(['session', 'label', 'ghost', 'discussion', 'alpha'], { expectFail: true });
    assert.match(err.error, /no work unit directory/);
  });

  it('rejects a phase without its topic — one argument or three, never two', () => {
    optIn();
    const err = engine(['session', 'label', 'pay', 'discussion'], { expectFail: true });
    assert.match(err.error, /Usage: engine session label <name> \[<phase> <topic>\]/);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('rejects an unknown name-only with labels on as well, and a project identity carrying a phase', () => {
    optIn();
    assert.match(engine(['session', 'label', 'ghost'], { expectFail: true }).error, /no work unit directory/);
    assert.match(engine(['session', 'label', 'roadmap', 'discovery', 'roadmap'], { expectFail: true }).error, /no work unit directory/);
    assert.strictEqual(tmuxName(), 'proj-abc');
  });
});

describe('engine session label — the position record', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the calling session\'s position in its conversation\'s folder', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('a name-only label records the name alone', () => {
    optIn();
    engine(['session', 'label', 'roadmap']);
    assert.deepStrictEqual(position('sess-1'), { name: 'roadmap' });
  });

  it('a re-label rewrites the one file — the latest position, never a history', () => {
    optIn();
    engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    engine(['session', 'label', 'pay', 'specification', 'alpha']);
    assert.strictEqual(position('sess-1').phase, 'specification');
    assert.deepStrictEqual(fs.readdirSync(conversation('sess-1')).sort(), ['position.json', 'workflow']);
  });

  it('a no-op label records the position all the same — disabled, outside tmux, a tmux error, a failed rename', () => {
    optIn();
    engine(['session', 'label-config', 'false']);
    engine(['session', 'label', 'pay', 'experiment', 'alpha']);
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'experiment', topic: 'alpha' }, 'disabled');
    optIn();
    for (const [phase, opts] of [['discussion', { noTmux: true }], ['specification', { fail: true }], ['planning', { failRename: true }]]) {
      engine(['session', 'label', 'pay', phase, 'alpha'], opts);
      assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase, topic: 'alpha' }, JSON.stringify(opts));
    }
  });

  it('a failed stash records the position all the same', () => {
    optIn();
    fs.writeFileSync(path.join(world.dir, '.leeway', '.cache'), '');
    assert.deepStrictEqual(engine(['session', 'label', 'pay', 'discussion', 'alpha']), { ok: true, labelled: false, reason: 'stash-error' });
    assert.deepStrictEqual(position('sess-1'), { name: 'pay', phase: 'discussion', topic: 'alpha' });
  });

  it('a position that cannot be written never fails the landed label — a courtesy, never a failure', () => {
    optIn();
    fs.mkdirSync(path.join(conversation('sess-1'), 'position.json'), { recursive: true }); // a directory where the position must go
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
    assert.strictEqual(tmuxName(), 'proj-abc · pay · discussion · alpha');
    assert.ok(stashFile(), 'the stash landed');
  });

  it('a hook-supplied session id never escapes the store — the folder is named by its safe characters alone', () => {
    optIn();
    engine(['session', 'label', 'pay'], { sessionId: 'a/../../evil' });
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), ['aevil', 'sess-1'], 'beside the opt-in\'s own');
    assert.deepStrictEqual(position('aevil'), { name: 'pay' });
    assert.deepStrictEqual(fs.readdirSync(world.configDir), ['conversations']);
  });

  it('a landed label with no session id records no position — there is no id to resume under', () => {
    optIn();
    assert.strictEqual(engine(['session', 'label', 'pay'], { sessionId: null }).labelled, true);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1'], 'the opt-in\'s own, and nothing more');
    assert.strictEqual(position('sess-1'), null);
  });
});

describe('engine session label — the manifest stamp', () => {
  beforeEach(setup);
  afterEach(teardown);

  function writeProjectManifest(defaults) {
    fs.writeFileSync(path.join(world.dir, '.leeway', 'manifest.json'), JSON.stringify({ defaults }, null, 2) + '\n');
  }

  it('a manifest stamped false — the prose-test world — is disabled, whatever was recorded before', () => {
    optIn();
    writeProjectManifest({ tmux_labels: false });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(tmuxName(), 'proj-abc');
  });

  it('a manifest stamped true enables without label-config having run', () => {
    writeProjectManifest({ tmux_labels: true });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.strictEqual(res.labelled, true);
  });

  it('only a boolean counts — anything else reads as never asked', () => {
    writeProjectManifest({ tmux_labels: 'true' });
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });

  it('a manifest that does not parse, or whose root or defaults is no object, reads as never asked — never a throw', () => {
    for (const content of ['{not json', '[]', 'null', JSON.stringify({ defaults: [true] })]) {
      fs.writeFileSync(path.join(world.dir, '.leeway', 'manifest.json'), content);
      const res = engine(['session', 'label', 'pay', 'discussion', 'alpha']);
      assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' }, content);
    }
  });

  it('the opt-in is the manifest alone — a system config carrying one is never read', () => {
    const ownConfig = path.join(world.dir, '.wf-config');
    fs.mkdirSync(ownConfig, { recursive: true });
    fs.writeFileSync(path.join(ownConfig, 'config.json'), JSON.stringify({ session: { tmux_labels: true } }) + '\n');
    const res = engine(['session', 'label', 'pay', 'discussion', 'alpha'], { extraEnv: { LEEWAY_CONFIG_DIR: ownConfig } });
    assert.deepStrictEqual(res, { ok: true, labelled: false, reason: 'disabled' });
  });
});
