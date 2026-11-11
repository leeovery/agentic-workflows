'use strict';

// The roadmap and the inbox (skills/leeway-engine/scripts/domain/roadmap.cjs),
// driven through the engine CLI: inbox notes moved into the product's notes
// as roadmap items under one commit — the kind from the note's folder, the
// origin its file stem, the note the item's one source — each refusal before
// anything moves; one name across the inbox and the product's notes, a
// capture of a name any kind holds taking the next free one; and an archived item's note kept where it is. The rollbacks
// are reached by failing a rename in process — the disk fault no CLI sequence
// can stage.
//
// Layer: verb. World: the roadmap's (roadmap-world.cjs), the inbox's notes on
// top.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createManifest } = require('./discovery-test-utils.cjs');
const { git, stateGit, commitAll, cleanupFixture: cleanup, output, okSections, withFrozenClock } = require('./engine-harness.cjs');
const { roadmapWorld, inState, runOk, runFail, readProject, projectManifestText, joinedTo } = require('./roadmap-world.cjs');

describe('engine CLI: inbox notes onto the roadmap, kept in the product\'s notes', () => {
  let dir;
  const IDEA = '.leeway/.inbox/ideas/2026-03-01--dark-mode.md';
  const BUG = '.leeway/.inbox/bugs/2026-03-02--login-crash.md';
  const QUICKFIX = '.leeway/.inbox/quickfixes/2026-03-03--footer-typo.md';
  const IDEA_NOTE = '.leeway/.product/notes/2026-03-01--dark-mode.md';
  const BUG_NOTE = '.leeway/.product/notes/2026-03-02--login-crash.md';

  const setup = roadmapWorld((at) => {
    for (const rel of [IDEA, BUG, QUICKFIX]) {
      fs.mkdirSync(path.dirname(path.join(at, rel)), { recursive: true });
      fs.writeFileSync(path.join(at, rel), `# ${path.basename(rel)}\n`);
    }
    commitAll(at, 'inbox');
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  const exists = (rel) => fs.existsSync(path.join(dir, rel));
  const batch = (entries) => {
    fs.writeFileSync(path.join(dir, 'batch.json'), JSON.stringify(entries));
    return ['add-batch', '--file', 'batch.json'];
  };
  const committedPaths = () => stateGit(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort();

  it('moves every note off the inbox into the product\'s notes under its inbox name and lands every item — kind from the folder, origin the file stem, the note the one source — under one commit (4.S34)', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = runOk(dir, batch([
      { name: 'dark-mode', horizon: 'later', summary: 'a dark theme', note: IDEA },
      { name: 'login-crash', horizon: 'later', summary: 'sign-in crashes', note: BUG, kind: 'bug' },
      { name: 'loyalty', horizon: 'v1', summary: 'rewards' },
    ]));

    assert.deepStrictEqual(res.added, [
      { name: 'dark-mode', horizon: 'later', kind: 'idea' },
      { name: 'login-crash', horizon: 'later', kind: 'bug' },
      { name: 'loyalty', horizon: 'v1', kind: 'idea' },
    ]);
    assert.deepStrictEqual(res.notes_moved, [{ from: IDEA, to: IDEA_NOTE }, { from: BUG, to: BUG_NOTE }]
      .map(({ from, to }) => ({ from: path.join(dir, from), to: path.join(dir, to) })));
    const items = readProject(dir).roadmap.items;
    assert.deepStrictEqual(items['dark-mode'], {
      horizon: 'later', summary: 'a dark theme', kind: 'idea', origin: 'inbox:2026-03-01--dark-mode', sources: ['.product/notes/2026-03-01--dark-mode.md'],
    });
    assert.deepStrictEqual(items['login-crash'], {
      horizon: 'later', summary: 'sign-in crashes', kind: 'bug', origin: 'inbox:2026-03-02--login-crash', sources: ['.product/notes/2026-03-02--login-crash.md'],
    });
    assert.strictEqual(exists(IDEA), false);
    assert.strictEqual(exists(BUG), false);
    assert.strictEqual(fs.readFileSync(path.join(dir, IDEA_NOTE), 'utf8'), '# 2026-03-01--dark-mode.md\n');
    assert.ok(exists(QUICKFIX), 'an inbox item the batch never named stays');

    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: add 3 items');
    assert.deepStrictEqual(committedPaths(), [
      'M\tmanifest.json', `R100\t${inState(BUG)}\t${inState(BUG_NOTE)}`, `R100\t${inState(IDEA)}\t${inState(IDEA_NOTE)}`,
    ]);
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '');
  });

  it('refuses before anything moves — a clash, a contradicting kind, an origin or sources beside a note, a note not in the live inbox, one named twice, two bound for one home, a taken home', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    fs.mkdirSync(path.dirname(path.join(dir, '.leeway/.inbox/.archived/ideas/x.md')), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-01-01--old.md'), 'old\n');
    const before = projectManifestText(dir);
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const fresh = { name: 'dark-mode', horizon: 'later', summary: 's', note: IDEA };

    assert.match(runFail(dir, batch([fresh, { name: 'loyalty', horizon: 'v1', summary: 's', note: BUG }])).error,
      /add-batch: "loyalty" is already on the roadmap — edit it, or pick a different name/);
    assert.strictEqual(runFail(dir, batch([{ ...fresh, kind: 'bug' }])).error,
      `add-batch: entry 1 — "kind" is bug, but the note "${IDEA}" is a idea — a note's kind is its inbox folder's`);
    assert.match(runFail(dir, batch([{ ...fresh, origin: 'harvest' }])).error, /entry 1 — a note sets the entry's origin and source/);
    assert.match(runFail(dir, batch([{ ...fresh, sources: [] }])).error, /entry 1 — a note sets the entry's origin and source/);
    assert.match(runFail(dir, batch([{ ...fresh, note: '.leeway/.inbox/.archived/ideas/2026-01-01--old.md' }])).error, /entry 1 — not a live inbox path/);
    assert.match(runFail(dir, batch([{ ...fresh, note: '.leeway/.inbox/ideas/2026-09-09--ghost.md' }])).error, /add-batch: inbox file not found/);
    assert.match(runFail(dir, batch([fresh, { name: 'twin', horizon: 'later', summary: 's', note: IDEA }])).error, /add-batch: duplicate inbox path/);
    assert.match(runFail(dir, batch([{ ...fresh, note: 42 }])).error, /entry 1 — "note" must be a live inbox path/);
    const spaced = '.leeway/.inbox/ideas/2026-03-04--dark mode.md';
    fs.writeFileSync(path.join(dir, spaced), 'a hand-dropped file\n');
    assert.match(runFail(dir, batch([{ ...fresh, note: spaced }])).error, /^add-batch: entry 1 — the note "\.leeway\/\.inbox\/ideas\/2026-03-04--dark mode\.md" has a space in its file name — a note's name can't carry spaces; rename the file$/);
    const sameName = '.leeway/.inbox/bugs/2026-03-01--dark-mode.md';
    fs.writeFileSync(path.join(dir, sameName), '# a bug of the same name\n');
    assert.strictEqual(runFail(dir, batch([fresh, { name: 'dark-crash', horizon: 'later', summary: 's', note: sameName }])).error,
      `add-batch: the notes "${path.join(dir, IDEA)}" and "${path.join(dir, sameName)}" share the name 2026-03-01--dark-mode.md, which the product's notes hold once — rename one in the inbox`);
    fs.mkdirSync(path.dirname(path.join(dir, IDEA_NOTE)), { recursive: true });
    fs.writeFileSync(path.join(dir, IDEA_NOTE), 'taken\n');
    assert.match(runFail(dir, batch([fresh])).error, /add-batch: destination already exists/);

    assert.ok(exists(IDEA) && exists(BUG), 'every note stays in the inbox');
    assert.strictEqual(projectManifestText(dir), before);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  describe('a rollback rethrows the failure that started it, every reversal attempted', () => {
    const manifestPath = () => path.join(dir, '.leeway', 'manifest.json');
    const both = [
      { name: 'dark-mode', horizon: 'later', summary: 's', note: IDEA },
      { name: 'login-crash', horizon: 'later', summary: 's', note: BUG },
    ];

    /**
     * Fail each rename `fails` names a reason for — a note's move or the
     * project manifest's atomic write, the two halves a transaction undoes
     * between — every other rename going through.
     * @param {import('node:test').TestContext} t
     * @param {(from: string, to: string) => string|null} fails
     */
    const failRenames = (t, fails) => {
      const rename = fs.renameSync;
      t.mock.method(fs, 'renameSync', (/** @type {string} */ from, /** @type {string} */ to) => {
        const reason = fails(String(from), String(to));
        if (reason) throw new Error(reason);
        return rename(from, to);
      });
    };

    it('coming on: a manifest write that fails is the error, and nothing moves', (t) => {
      const before = projectManifestText(dir);
      failRenames(t, (_from, to) => (to === manifestPath() ? 'the manifest would not write' : null));
      assert.strictEqual(runFail(dir, batch(both)).error, 'the manifest would not write');
      assert.ok(exists(IDEA) && exists(BUG));
      assert.strictEqual(projectManifestText(dir), before);
    });

    it('coming on: a move that fails puts every note back and restores the manifest, the move\'s error rethrown — no note is left in neither place', (t) => {
      const before = projectManifestText(dir);
      const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
      failRenames(t, (_from, to) => (to.endsWith(BUG_NOTE) ? 'the bug note would not move' : null));
      assert.strictEqual(runFail(dir, batch(both)).error, 'the bug note would not move');
      assert.ok(exists(IDEA) && exists(BUG), 'both notes are back in the inbox');
      assert.strictEqual(exists(IDEA_NOTE), false);
      assert.strictEqual(projectManifestText(dir), before);
      assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
    });

    it('coming on: a restore that fails too follows the move\'s error, never replaces it — every note still put back', (t) => {
      let manifestWrites = 0;
      failRenames(t, (_from, to) => {
        if (to.endsWith(BUG_NOTE)) return 'the bug note would not move';
        return to === manifestPath() && ++manifestWrites === 2 ? 'the manifest would not restore' : null;
      });
      assert.strictEqual(runFail(dir, batch(both)).error,
        'the bug note would not move — and the project manifest could not be restored: the manifest would not restore');
      assert.ok(exists(IDEA) && exists(BUG), 'both notes are back in the inbox');
      assert.deepStrictEqual(Object.keys(readProject(dir).roadmap.items), ['dark-mode', 'login-crash'],
        'the manifest names notes still in the inbox — never a note nothing names');
    });
  });

  it('archive keeps the item on the manifest, off its horizon, and its note where it is; the home leaves it out; a move brings it back with its note and pointers (18.S67)', () => {
    runOk(dir, batch([
      { name: 'login-crash', horizon: 'later', summary: 'sign-in crashes', note: BUG },
      { name: 'dark-mode', horizon: 'later', summary: 'a dark theme', note: IDEA },
    ]));
    const kept = readProject(dir).roadmap.items['login-crash'];

    const res = withFrozenClock(() => runOk(dir, ['archive', 'login-crash']));
    assert.strictEqual('notes_moved' in res, false);
    const { horizon: _horizon, ...pointers } = kept;
    assert.deepStrictEqual(readProject(dir).roadmap.items['login-crash'], { ...pointers, archived: { at: '2026-01-01T00:00:00Z', horizon: 'later' } });
    assert.strictEqual(fs.readFileSync(path.join(dir, BUG_NOTE), 'utf8'), '# 2026-03-02--login-crash.md\n', 'the note stays in the product\'s notes');
    assert.deepStrictEqual(committedPaths(), ['M\tmanifest.json']);
    const home = output(dir, ['render', 'roadmap-view']);
    assert.match(home, /Dark Mode/);
    assert.doesNotMatch(home, /Login Crash/);

    runOk(dir, ['move', 'login-crash', '--horizon', 'later']);
    assert.deepStrictEqual(readProject(dir).roadmap.items['login-crash'], kept);
    assert.ok(exists(BUG_NOTE));
    assert.match(output(dir, ['render', 'roadmap-view']), /Login Crash/);
  });

  it('one name across the inbox: a title captured the same day in every kind takes the next free -{n} where any kind holds it, live, archived or in the product\'s notes, and every one reaches the roadmap, together and one after the other (4.11.16)', () => {
    const capture = (/** @type {string} */ kind) =>
      path.relative(dir, withFrozenClock(() => okSections(dir, ['inbox', 'capture', kind], { stdin: '# Offline Mode\n' })).res.captured);
    const item = (/** @type {string} */ name, /** @type {string} */ note) => ({ name, horizon: 'later', summary: 's', note });
    const idea = capture('idea');
    const bug = capture('bug');
    withFrozenClock(() => okSections(dir, ['inbox', 'archive', bug]));
    const fix = capture('quick-fix');
    runOk(dir, batch([item('offline-mode', idea), item('offline-typo', fix)]));
    const archived = bug.replace('/.inbox/', '/.inbox/.archived/');
    withFrozenClock(() => okSections(dir, ['inbox', 'restore', archived]));
    runOk(dir, batch([item('offline-crash', bug)]));
    const again = capture('bug');

    assert.deepStrictEqual([idea, bug, fix, again], [
      '.leeway/.inbox/ideas/2026-01-01--offline-mode.md',
      '.leeway/.inbox/bugs/2026-01-01--offline-mode-2.md',
      '.leeway/.inbox/quickfixes/2026-01-01--offline-mode-3.md',
      '.leeway/.inbox/bugs/2026-01-01--offline-mode-4.md',
    ]);
    assert.deepStrictEqual(['offline-mode', 'offline-crash', 'offline-typo'].map((name) => readProject(dir).roadmap.items[name].sources),
      [['.product/notes/2026-01-01--offline-mode.md'], ['.product/notes/2026-01-01--offline-mode-2.md'], ['.product/notes/2026-01-01--offline-mode-3.md']]);
  });

  it('a pulled item\'s note stays where it is — the archive refuses as for any pulled item', () => {
    runOk(dir, batch([{ name: 'login-crash', horizon: 'later', summary: 's', note: BUG }]));
    createManifest(dir, 'login-crash', { work_type: 'bugfix', status: 'in-progress' });
    joinedTo(dir, 'login-crash', 'login-crash');
    assert.match(runFail(dir, ['archive', 'login-crash']).error, /joined to work unit "login-crash"/);
    assert.ok(exists(BUG_NOTE));
  });
});
