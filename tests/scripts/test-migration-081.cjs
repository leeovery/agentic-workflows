'use strict';

//
// Tests for migration 081: reshape-finish (.cjs)
//
// The reshape's finish (21.9.2, 21.5.18) driven in process against a git
// project as the move leaves it: `.workflows/` on its code branch, the
// files it ignores beside them, and the tracker's store where its driver's
// frozen declaration says a project from before Leeway keeps it, with the
// files its tool keeps local and a file of the person's in its folder. Each
// test reads one rule off what the finish left: the removal of each drop the
// branch holds staged, nothing committed and every file still on disk; the
// journal in the state's cache, `{staged, drops}`, written whole by a
// rename; a store the branch does not hold dropped from disk alone, and
// local files with no store beside them no store's; a local file the branch
// holds staged with it; a project nested in its repository journaling from
// its own folder; a run again, and one after a kill at the journal, staging
// what it staged and writing the journal again; the projects it skips,
// writing nothing; and a repository with no commit refused.
//
// Layer: migration. World: a plain git project per test, in a temp folder.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, initRepo } = require('./engine-harness.cjs');
const { useTempFolder, createFile } = require('./discovery-test-utils.cjs');
const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/081-reshape-finish.cjs');
const { preLeewayStores } = require('../../skills/leeway-migrate/scripts/migrations/reshape/shared.cjs');

// Where a project from before Leeway keeps the tracker's store, as the task
// driver that declares it says, read as the finish reads it: its file, two
// files its tool keeps local, named from the first pattern, and a file of
// the person's in the store's folder that no pattern names.
const [PRE_LEEWAY] = preLeewayStores();
const [STORE] = PRE_LEEWAY.files;
const LOCAL = PRE_LEEWAY.localFiles[0].replace(/^\//, '').replace(/\*.*$/, '');
const LOCALS = [LOCAL, `${LOCAL}-wal`];
const PERSONS = path.posix.join(path.posix.dirname(STORE), 'README.md');

const JOURNAL = '.leeway/.cache/migrate/finish.json';
const OLD_FILES = ['.workflows/.gitignore', '.workflows/fumi/manifest.json'];

const folder = useTempFolder('migration-081-');

/** @param {string} dir */
function run(dir) {
  const counts = { updates: 0, skips: 0 };
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { counts.updates += 1; }, reportSkip: () => { counts.skips += 1; } });
  return counts;
}

/**
 * A project as the move leaves it at `dir`: its `.workflows/` committed with
 * a cache it ignores, and, where `store` is `tracked` or `untracked`, the
 * tracker's store beside it, the person's file in its folder committed and
 * the tool's local files on disk.
 * @param {string} dir @param {{store?: 'tracked'|'untracked'|'none'}} [options]
 */
function oldProject(dir, { store = 'tracked' } = {}) {
  initRepo(dir);
  createFile(dir, 'README.md', '# Fumi\n');
  createFile(dir, '.workflows/.gitignore', '.cache/\n');
  createFile(dir, '.workflows/fumi/manifest.json', '{"name":"fumi"}\n');
  if (store !== 'none') createFile(dir, PERSONS, '# My notes\n');
  if (store === 'tracked') createFile(dir, STORE, '{"id":"a1"}\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'today\'s layout']);
  createFile(dir, '.workflows/.cache/fumi/presence', '{}\n');
  if (store === 'untracked') createFile(dir, STORE, '{"id":"a1"}\n');
  if (store !== 'none') for (const rel of LOCALS) createFile(dir, rel, 'local\n');
  return dir;
}

/** Every file under `dir` but git's own and the state's, with its text. @param {string} dir */
function onDisk(dir) {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((rel) => !/^\.(git|leeway)(\/|$)/.test(rel) && fs.statSync(path.join(dir, rel)).isFile())
    .sort()
    .map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]));
}

/** What the index holds staged against the branch. @param {string} dir */
const staged = (dir) => git(dir, ['diff', '--cached', '--name-status']).trim().split('\n').filter(Boolean);

/** The journal, or null where there is none. @param {string} dir */
const journalOf = (dir) => (fs.existsSync(path.join(dir, JOURNAL)) ? JSON.parse(fs.readFileSync(path.join(dir, JOURNAL), 'utf8')) : null);

describe('migration 081: the code side\'s drops staged for the migration\'s commit', () => {
  it('stages the removal of .workflows/ and the tracker\'s store from the index alone, leaving every file on disk, committing nothing, and journals what it staged and what goes once the commit lands (21.9.2, 21.5.18)', () => {
    const dir = oldProject(folder());
    const head = git(dir, ['rev-parse', 'HEAD']);
    const before = onDisk(dir);

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0 });

    assert.deepStrictEqual(staged(dir), [...OLD_FILES, STORE].map((rel) => `D\t${rel}`).sort());
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head, 'nothing committed');
    assert.deepStrictEqual(onDisk(dir), before, 'every file left on disk as it was');
    assert.deepStrictEqual(journalOf(dir), { staged: ['.workflows', STORE], drops: ['.workflows', STORE, ...LOCALS] });
  });

  it('writes the journal whole: in a scratch in the state\'s cache first, then renamed in', (t) => {
    const dir = oldProject(folder());
    /** @type {{from: string, to: string, text: string}[]} */
    const renames = [];
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (/** @type {string} */ from, /** @type {string} */ to) => {
      renames.push({ from, to, text: fs.readFileSync(from, 'utf8') });
      return rename(from, to);
    });

    run(dir);

    const journal = path.join(dir, JOURNAL);
    assert.deepStrictEqual(renames.map(({ from, to, text }) => ({ from: path.dirname(from), to, text })), [{ from: path.join(dir, '.leeway/.cache'), to: journal, text: fs.readFileSync(journal, 'utf8') }]);
  });

  it('drops a store the code branch does not hold from disk alone, staging nothing of it', () => {
    const dir = oldProject(folder(), { store: 'untracked' });

    run(dir);

    assert.deepStrictEqual(staged(dir), OLD_FILES.map((rel) => `D\t${rel}`));
    assert.deepStrictEqual(journalOf(dir), { staged: ['.workflows'], drops: ['.workflows', STORE, ...LOCALS] });
  });

  it('takes local files with no store beside them for no store\'s: they stay', () => {
    const dir = oldProject(folder(), { store: 'none' });
    for (const rel of LOCALS) createFile(dir, rel, 'local\n');

    run(dir);

    assert.deepStrictEqual(journalOf(dir), { staged: ['.workflows'], drops: ['.workflows'] });
  });

  it('stages a local file the code branch holds with the store', () => {
    const dir = oldProject(folder());
    git(dir, ['add', '-f', '--', LOCAL]);
    git(dir, ['commit', '-q', '-m', 'a local file committed']);

    run(dir);

    assert.deepStrictEqual(staged(dir), [...OLD_FILES, STORE, LOCAL].map((rel) => `D\t${rel}`).sort());
    assert.deepStrictEqual(journalOf(dir).staged, ['.workflows', STORE, LOCAL]);
  });

  it('takes a project nested in its repository from its own folder: its .workflows/ staged there, the journal in the state at the repository\'s top, named from the project\'s folder', () => {
    const dir = initRepo(folder());
    createFile(dir, 'README.md', '# The repository\n');
    createFile(dir, 'app/.workflows/fumi/manifest.json', '{"name":"fumi"}\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'a nested project']);

    assert.deepStrictEqual(run(path.join(dir, 'app')), { updates: 1, skips: 0 });

    assert.deepStrictEqual(staged(dir), ['D\tapp/.workflows/fumi/manifest.json']);
    assert.deepStrictEqual(journalOf(dir), { staged: ['.workflows'], drops: ['.workflows'] });
    assert.ok(!fs.existsSync(path.join(dir, 'app/.leeway')), 'no state in the project\'s folder');
  });

  it('run again, stages what it staged and writes the same journal', () => {
    const dir = oldProject(folder());
    run(dir);
    const first = { index: staged(dir), journal: journalOf(dir) };

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0 });

    assert.deepStrictEqual({ index: staged(dir), journal: journalOf(dir) }, first);
  });

  it('killed at the journal, leaves its removals staged and no journal; run again, journals them whole', (t) => {
    const dir = oldProject(folder());
    const rename = fs.renameSync;
    const killed = t.mock.method(fs, 'renameSync', () => { throw new Error('killed'); });

    assert.throws(() => run(dir), /killed/);
    assert.deepStrictEqual([staged(dir).length, journalOf(dir)], [3, null]);

    killed.mock.mockImplementation(rename);
    run(dir);

    assert.deepStrictEqual(staged(dir), [...OLD_FILES, STORE].map((rel) => `D\t${rel}`).sort());
    assert.deepStrictEqual(journalOf(dir), { staged: ['.workflows', STORE], drops: ['.workflows', STORE, ...LOCALS] });
  });
});

describe('migration 081: where the migration is not under way', () => {
  it('skips a project with no .workflows/, writing nothing', () => {
    const dir = initRepo(folder());
    createFile(dir, 'README.md', '# Fumi\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'no old layout']);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1 });

    assert.deepStrictEqual([staged(dir), fs.existsSync(path.join(dir, '.leeway'))], [[], false]);
  });

  it('skips a project whose leeway-state has a commit, staging nothing', () => {
    const dir = oldProject(folder());
    git(dir, ['branch', 'leeway-state']);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1 });

    assert.deepStrictEqual([staged(dir), journalOf(dir)], [[], null]);
  });

  it('skips a folder in no repository, writing nothing', () => {
    const dir = folder();
    createFile(dir, '.workflows/fumi/manifest.json', '{"name":"fumi"}\n');

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1 });

    assert.ok(!fs.existsSync(path.join(dir, '.leeway')));
  });

  it('refuses a repository with no commit to read the drops from, staging nothing and writing no journal', () => {
    const dir = initRepo(folder());
    createFile(dir, '.workflows/fumi/manifest.json', '{"name":"fumi"}\n');
    git(dir, ['add', '-A']);

    assert.throws(() => run(dir), /git ls-tree failed/);

    assert.deepStrictEqual([git(dir, ['diff', '--cached', '--name-only']).trim(), journalOf(dir)], ['.workflows/fumi/manifest.json', null]);
  });
});
