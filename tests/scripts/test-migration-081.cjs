'use strict';

//
// Tests for migration 081: reshape-finish (.cjs)
//
// The reshape's finish (21.9.2, 21.5.18) driven in process against a git
// project as the move leaves it: `.workflows/` on its code branch, the
// files it ignores beside them, and the tracker's store where its driver's
// folder declares a project from before Leeway keeps it, with the files its
// tool keeps local and a file of the person's in its folder. Each test reads
// one rule off what the finish left: the drops journaled in the state's
// cache, `{drops}`, nothing staged, nothing committed and every file still
// on disk; each unit's imports list dropped from its manifest in the state,
// a retired unit's kept as it was; the journal written whole by a rename; a
// store the branch does not hold dropped all the same, and local files with
// no store beside them no store's; a project nested in its repository
// journaling from its own folder; a run again, and one after a kill at the
// journal, writing the journal again; a task driver's folder whose
// declaration is missing or does not read named in its notice; and the
// projects it skips, writing nothing.
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
const SKILLS = path.join(__dirname, '../../skills');
const MIGRATIONS = path.join(SKILLS, 'leeway-migrate/scripts/migrations');
const TASK_DRIVERS = path.join(SKILLS, 'leeway-engine/scripts/drivers/task');
const MIGRATION = require(path.join(MIGRATIONS, '081-reshape-finish.cjs'));
const { preLeewayStores } = require(path.join(MIGRATIONS, 'reshape/shared.cjs'));

// Where a project from before Leeway keeps the tracker's store, as the task
// driver's folder declares it, read as the finish reads it: its file, two
// files its tool keeps local, named from the first pattern, and a file of
// the person's in the store's folder that no pattern names.
const [PRE_LEEWAY] = preLeewayStores().stores;
const [STORE] = PRE_LEEWAY.files;
const LOCAL = PRE_LEEWAY.localFiles[0].replace(/^\//, '').replace(/\*.*$/, '');
const LOCALS = [LOCAL, `${LOCAL}-wal`];
const PERSONS = path.posix.join(path.posix.dirname(STORE), 'README.md');

const JOURNAL = '.leeway/.cache/migrate/finish.json';

const folder = useTempFolder('migration-081-');

/** @param {string} dir @param {typeof MIGRATION} [migration] */
function run(dir, migration = MIGRATION) {
  const counts = { updates: 0, skips: 0 };
  const handed = migration.run({ projectDir: dir, reportUpdate: () => { counts.updates += 1; }, reportSkip: () => { counts.skips += 1; } });
  return { ...counts, handed };
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

describe('migration 081: the code side\'s drops journaled for the migration\'s commit', () => {
  it('journals .workflows/ and the tracker\'s store with its local files as the drops, staging nothing, committing nothing, every file left on disk (21.9.2, 21.5.18)', () => {
    const dir = oldProject(folder());
    const head = git(dir, ['rev-parse', 'HEAD']);
    const before = onDisk(dir);

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0, handed: undefined });

    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows', STORE, ...LOCALS] });
    assert.deepStrictEqual(staged(dir), [], 'nothing staged');
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head, 'nothing committed');
    assert.deepStrictEqual(onDisk(dir), before, 'every file left on disk as it was');
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

  it('drops a store the code branch does not hold all the same', () => {
    const dir = oldProject(folder(), { store: 'untracked' });

    run(dir);

    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows', STORE, ...LOCALS] });
  });

  it('takes local files with no store beside them for no store\'s: they stay', () => {
    const dir = oldProject(folder(), { store: 'none' });
    for (const rel of LOCALS) createFile(dir, rel, 'local\n');

    run(dir);

    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows'] });
  });

  it('takes a project nested in its repository from its own folder: the journal in the state at the repository\'s top, named from the project\'s folder', () => {
    const dir = initRepo(folder());
    createFile(dir, 'README.md', '# The repository\n');
    createFile(dir, 'app/.workflows/fumi/manifest.json', '{"name":"fumi"}\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'a nested project']);

    assert.deepStrictEqual(run(path.join(dir, 'app')), { updates: 1, skips: 0, handed: undefined });

    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows'] });
    assert.deepStrictEqual(staged(dir), []);
    assert.ok(!fs.existsSync(path.join(dir, 'app/.leeway')), 'no state in the project\'s folder');
  });

  it('drops each unit\'s imports list, every other field as it was, a manifest holding none untouched, and a retired unit\'s, kept in the product\'s assets, as it was kept; run again, finds them dropped (21.5.7)', () => {
    const dir = oldProject(folder());
    const listed = { name: 'shop', work_type: 'epic', imports: [{ path: 'assets/stars.md', imported_at: '2026-01-06T10:00:00Z', origin: 'discussion/reviews' }], phases: {} };
    const manifests = {
      shop: `${JSON.stringify(listed, null, 2)}\n`,
      gateway: '{"name":"gateway","work_type":"epic"}\n',
      retired: `${JSON.stringify({ ...listed, name: 'caching', work_type: 'cross-cutting' })}\n`,
    };
    const at = { shop: '.leeway/shop/manifest.json', gateway: '.leeway/gateway/manifest.json', retired: '.leeway/.product/assets/caching/manifest.json' };
    for (const [unit, rel] of Object.entries(at)) createFile(dir, rel, manifests[/** @type {keyof typeof manifests} */ (unit)]);
    const { imports: _, ...dropped } = listed;
    const read = () => Object.values(at).map((rel) => fs.readFileSync(path.join(dir, rel), 'utf8'));

    run(dir);

    assert.deepStrictEqual(read(), [`${JSON.stringify(dropped, null, 2)}\n`, manifests.gateway, manifests.retired]);
    run(dir);
    assert.deepStrictEqual(read(), [`${JSON.stringify(dropped, null, 2)}\n`, manifests.gateway, manifests.retired]);
  });

  it('run again, writes the same journal', () => {
    const dir = oldProject(folder());
    run(dir);
    const first = journalOf(dir);

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0, handed: undefined });

    assert.deepStrictEqual(journalOf(dir), first);
  });

  it('killed at the journal, leaves no journal; run again, journals the drops whole', (t) => {
    const dir = oldProject(folder());
    const rename = fs.renameSync;
    const killed = t.mock.method(fs, 'renameSync', () => { throw new Error('killed'); });

    assert.throws(() => run(dir), /killed/);
    assert.strictEqual(journalOf(dir), null);

    killed.mock.mockImplementation(rename);
    run(dir);

    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows', STORE, ...LOCALS] });
  });

  it('names in its notice each task driver\'s folder whose declaration is missing or does not read, journaling the stores the rest declare', () => {
    const skills = path.join(folder(), 'skills');
    const migrations = path.join(skills, 'leeway-migrate/scripts/migrations');
    const drivers = path.join(skills, 'leeway-engine/scripts/drivers/task');
    fs.mkdirSync(path.join(migrations, 'reshape'), { recursive: true });
    for (const rel of ['081-reshape-finish.cjs', 'reshape/shared.cjs']) fs.copyFileSync(path.join(MIGRATIONS, rel), path.join(migrations, rel));
    fs.cpSync(TASK_DRIVERS, drivers, { recursive: true });
    createFile(drivers, 'broken/pre-leeway-store.json', '{"files": [".broken/store"');
    createFile(drivers, 'bare/driver.cjs', '\'use strict\';\n');
    const dir = oldProject(path.join(folder(), 'project'));

    const { handed } = run(dir, require(path.join(migrations, '081-reshape-finish.cjs')));

    assert.deepStrictEqual(handed, {
      notice: `The task driver folders ${path.join(drivers, 'bare')}, ${path.join(drivers, 'broken')} hold no pre-leeway-store.json that reads, so the migration's commit drops no store declared there: a store this project kept for such a tracker stays on the default branch and on disk.`,
    });
    assert.deepStrictEqual(journalOf(dir), { drops: ['.workflows', STORE, ...LOCALS] });
  });
});

describe('migration 081: where the migration is not under way', () => {
  it('skips a project with no .workflows/, writing nothing', () => {
    const dir = initRepo(folder());
    createFile(dir, 'README.md', '# Fumi\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'no old layout']);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1, handed: undefined });

    assert.ok(!fs.existsSync(path.join(dir, '.leeway')));
  });

  it('skips a project whose leeway-state has a commit, journaling nothing', () => {
    const dir = oldProject(folder());
    git(dir, ['branch', 'leeway-state']);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1, handed: undefined });

    assert.strictEqual(journalOf(dir), null);
  });

  it('skips a folder in no repository, writing nothing', () => {
    const dir = folder();
    createFile(dir, '.workflows/fumi/manifest.json', '{"name":"fumi"}\n');

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1, handed: undefined });

    assert.ok(!fs.existsSync(path.join(dir, '.leeway')));
  });
});
