'use strict';

// The roadmap and the inbox (skills/leeway-engine/scripts/domain/roadmap.cjs),
// driven through the engine CLI: inbox notes moved onto the roadmap as items
// under one commit — the kind from the note's folder, the origin its file
// stem, the note the item's one source — each refusal before anything moves;
// and a removed item's note sent to the inbox archive. The rollbacks are
// reached by failing a rename in process — the disk fault no CLI sequence can
// stage.
//
// Layer: verb. World: the roadmap's (roadmap-world.cjs), the inbox's notes on
// top.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createManifest } = require('./discovery-test-utils.cjs');
const { git, stateGit, commitAll, cleanupFixture: cleanup, ok } = require('./engine-harness.cjs');
const { roadmapWorld, inState, runOk, runFail, readProject, projectManifestText, joinedTo } = require('./roadmap-world.cjs');

describe('engine CLI: inbox notes onto the roadmap, and back to the archive', () => {
  let dir;
  const IDEA = '.leeway/.inbox/ideas/2026-03-01--dark-mode.md';
  const BUG = '.leeway/.inbox/bugs/2026-03-02--login-crash.md';
  const QUICKFIX = '.leeway/.inbox/quickfixes/2026-03-03--footer-typo.md';
  const IDEA_NOTE = '.leeway/.roadmap/notes/ideas/2026-03-01--dark-mode.md';
  const BUG_NOTE = '.leeway/.roadmap/notes/bugs/2026-03-02--login-crash.md';

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

  it('moves every note off the inbox and lands every item — kind from the folder, origin the file stem, the note the one source — under one commit', () => {
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
      horizon: 'later', summary: 'a dark theme', kind: 'idea', origin: 'inbox:2026-03-01--dark-mode', sources: ['.roadmap/notes/ideas/2026-03-01--dark-mode.md'],
    });
    assert.deepStrictEqual(items['login-crash'], {
      horizon: 'later', summary: 'sign-in crashes', kind: 'bug', origin: 'inbox:2026-03-02--login-crash', sources: ['.roadmap/notes/bugs/2026-03-02--login-crash.md'],
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

  it('refuses before anything moves — a clash, a contradicting kind, an origin or sources beside a note, a note not in the live inbox, one named twice, a taken home', () => {
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
    fs.mkdirSync(path.dirname(path.join(dir, IDEA_NOTE)), { recursive: true });
    fs.writeFileSync(path.join(dir, IDEA_NOTE), 'taken\n');
    assert.match(runFail(dir, batch([fresh])).error, /add-batch: destination already exists/);

    assert.ok(exists(IDEA) && exists(BUG), 'every note stays in the inbox');
    assert.strictEqual(projectManifestText(dir), before);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('a move that throws midway puts back every note it moved and restores the manifest — no note is left in neither place', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const before = projectManifestText(dir);
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    // A file where the bugs folder belongs: the idea's note moves, the bug's cannot.
    fs.mkdirSync(path.join(dir, '.leeway/.roadmap/notes'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.roadmap/notes/bugs'), 'in the way\n');

    runFail(dir, batch([
      { name: 'dark-mode', horizon: 'later', summary: 's', note: IDEA },
      { name: 'login-crash', horizon: 'later', summary: 's', note: BUG },
    ]));

    assert.ok(exists(IDEA) && exists(BUG), 'both notes are back in the inbox');
    assert.strictEqual(exists(IDEA_NOTE), false);
    assert.strictEqual(projectManifestText(dir), before, 'the manifest as it was read');
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('a remove whose archive move throws leaves the item and its note as they were', () => {
    runOk(dir, batch([{ name: 'login-crash', horizon: 'later', summary: 's', note: BUG }]));
    const before = projectManifestText(dir);
    fs.mkdirSync(path.join(dir, '.leeway/.inbox/.archived'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.inbox/.archived/bugs'), 'in the way\n');

    runFail(dir, ['remove', 'login-crash']);

    assert.ok(exists(BUG_NOTE), 'the note stays on the roadmap, named by its item');
    assert.strictEqual(projectManifestText(dir), before);
  });

  describe('a rollback rethrows the failure that started it, every reversal attempted', () => {
    const ARCHIVED_IDEA = '.leeway/.inbox/.archived/ideas/2026-03-01--dark-mode.md';
    const ARCHIVED_BUG = '.leeway/.inbox/.archived/bugs/2026-03-02--login-crash.md';
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

    it('coming on: a move that fails puts every note back and restores the manifest, the move\'s error rethrown', (t) => {
      const before = projectManifestText(dir);
      failRenames(t, (_from, to) => (to.endsWith(BUG_NOTE) ? 'the bug note would not move' : null));
      assert.strictEqual(runFail(dir, batch(both)).error, 'the bug note would not move');
      assert.ok(exists(IDEA) && exists(BUG), 'both notes are back in the inbox');
      assert.strictEqual(exists(IDEA_NOTE), false);
      assert.strictEqual(projectManifestText(dir), before);
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

    it('leaving: a manifest write that fails puts every note back on the roadmap, its error rethrown', (t) => {
      runOk(dir, batch(both));
      const before = projectManifestText(dir);
      failRenames(t, (_from, to) => (to === manifestPath() ? 'the manifest would not write' : null));
      assert.strictEqual(runFail(dir, ['remove', 'dark-mode']).error, 'the manifest would not write');
      assert.ok(exists(IDEA_NOTE), 'the note is back on the roadmap');
      assert.strictEqual(exists(ARCHIVED_IDEA), false);
      assert.strictEqual(projectManifestText(dir), before);
    });

    it('leaving: a note that will not go back is named after the write\'s error, and the rest still go back', (t) => {
      runOk(dir, batch(both));
      // One item naming both notes, so one remove moves the two.
      const manifest = readProject(dir);
      manifest.roadmap.items['dark-mode'].sources.push('.roadmap/notes/bugs/2026-03-02--login-crash.md');
      delete manifest.roadmap.items['login-crash'];
      fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2));
      const before = projectManifestText(dir);
      failRenames(t, (_from, to) => {
        if (to === manifestPath()) return 'the manifest would not write';
        return to.endsWith(BUG_NOTE) ? 'the bug note would not go back' : null;
      });
      assert.strictEqual(runFail(dir, ['remove', 'dark-mode']).error,
        `the manifest would not write — and a file could not be put back: "${path.join(dir, ARCHIVED_BUG)}" (belongs at "${path.join(dir, BUG_NOTE)}")`);
      assert.ok(exists(IDEA_NOTE), 'the idea note, put back after the bug note failed');
      assert.ok(exists(ARCHIVED_BUG), 'the bug note stays where the failed put-back left it');
      assert.strictEqual(projectManifestText(dir), before);
    });
  });

  it('remove of a waiting item sends its roadmap note to the inbox archive under the same commit', () => {
    runOk(dir, batch([{ name: 'login-crash', horizon: 'later', summary: 's', note: BUG }]));
    const res = runOk(dir, ['remove', 'login-crash']);

    const archived = '.leeway/.inbox/.archived/bugs/2026-03-02--login-crash.md';
    assert.deepStrictEqual(res.notes_moved, [{ from: path.join(dir, BUG_NOTE), to: path.join(dir, archived) }]);
    assert.strictEqual(exists(BUG_NOTE), false);
    assert.ok(exists(archived));
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: remove login-crash');
    assert.deepStrictEqual(committedPaths(), ['M\tmanifest.json', `R100\t${inState(BUG_NOTE)}\t${inState(archived)}`]);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '');
    // Restorable: the archive's own verb takes it back to the inbox.
    ok(dir, ['inbox', 'restore', archived]);
    assert.ok(exists(BUG));
  });

  it('remove leaves a note another item still names, and an item with no note moves nothing', () => {
    runOk(dir, batch([{ name: 'dark-mode', horizon: 'later', summary: 's', note: IDEA }]));
    runOk(dir, ['add', 'light-mode', '--horizon', 'later', '--summary', 's', '--source', '.roadmap/notes/ideas/2026-03-01--dark-mode.md']);
    runOk(dir, ['add', 'plain', '--horizon', 'later', '--summary', 's']);

    assert.strictEqual('notes_moved' in runOk(dir, ['remove', 'dark-mode']), false);
    assert.ok(exists(IDEA_NOTE), 'the note waits on with light-mode');
    assert.deepStrictEqual(runOk(dir, ['remove', 'light-mode']).notes_moved,
      [{ from: path.join(dir, IDEA_NOTE), to: path.join(dir, '.leeway/.inbox/.archived/ideas/2026-03-01--dark-mode.md') }]);
    assert.strictEqual('notes_moved' in runOk(dir, ['remove', 'plain']), false);
  });

  it('remove refuses where the archive already holds the note\'s name — nothing moves, the item stays', () => {
    runOk(dir, batch([{ name: 'dark-mode', horizon: 'later', summary: 's', note: IDEA }]));
    const archived = '.leeway/.inbox/.archived/ideas/2026-03-01--dark-mode.md';
    fs.mkdirSync(path.dirname(path.join(dir, archived)), { recursive: true });
    fs.writeFileSync(path.join(dir, archived), 'an older copy\n');
    const before = projectManifestText(dir);

    assert.match(runFail(dir, ['remove', 'dark-mode']).error, /destination already exists/);
    assert.ok(exists(IDEA_NOTE));
    assert.strictEqual(projectManifestText(dir), before);
  });

  it('a pulled item\'s note stays where it is — the remove refuses as for any pulled item', () => {
    runOk(dir, batch([{ name: 'login-crash', horizon: 'later', summary: 's', note: BUG }]));
    createManifest(dir, 'login-crash', { work_type: 'bugfix', status: 'in-progress' });
    joinedTo(dir, 'login-crash', 'login-crash');
    assert.match(runFail(dir, ['remove', 'login-crash']).error, /joined to work unit "login-crash"/);
    assert.ok(exists(BUG_NOTE));
  });
});
