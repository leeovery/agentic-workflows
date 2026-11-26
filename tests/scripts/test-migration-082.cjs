'use strict';

//
// Tests for migration 082: areas (.cjs)
//
// The word "area" freed for a discussion's unit, driven in process against
// a git project whose state, `.ledger/` in its main checkout, holds what a
// release before it kept. Each test reads one rule off what the migration
// left: a bugfix's `area` renamed `part` on its investigation item and its
// investigation's close, each in its place among the keys and everything
// else kept; each finding's `area` renamed `section` in a review round's
// record and a quick-fix's notes answered, the round's other files left;
// a file written whole, from a scratch in the state's cache, nothing staged
// or committed; a run from a project nested in its repository or from a
// linked worktree of its code, on the main checkout's state; a unit's
// findings renamed where its manifest will not read; a run again changing
// nothing; and what it passes over: a project in no repository or
// with no state, a state holding nothing to rename, a record already
// naming the new field, a file that will not read, a folder of the state
// holding no manifest, and a retired unit kept in the product's assets.
//
// Layer: migration. World: a plain git project per test, in a temp folder.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { initRepo } = require('./engine-harness.cjs');
const { git, useTempFolder, createFile, readFile, filesUnder } = require('./discovery-test-utils.cjs');
const MIGRATION = require(path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations/082-areas.cjs'));

const folder = useTempFolder('migration-082-');

/** @param {string} dir */
function run(dir) {
  const counts = { updates: 0, skips: 0 };
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { counts.updates += 1; }, reportSkip: () => { counts.skips += 1; } });
  return counts;
}

/** A JSON file of the state written. @param {string} dir @param {string} rel @param {unknown} data */
const putState = (dir, rel, data) => createFile(dir, path.join('.ledger', rel), `${JSON.stringify(data, null, 2)}\n`);

/** A JSON file of the state as read. @param {string} dir @param {string} rel */
const stateJson = (dir, rel) => JSON.parse(readFile(dir, path.join('.ledger', rel)));

/** Every file of the state with its text. @param {string} dir */
const stateFiles = (dir) => Object.fromEntries(filesUnder(path.join(dir, '.ledger')).sort().map((file) => [file, fs.readFileSync(file, 'utf8')]));

/** A bugfix's manifest as a release before this one concluded it, naming the part of the feature map its bug sits in an area. */
const BUGFIX = Object.freeze({
  name: 'lost-basket',
  work_type: 'bugfix',
  status: 'completed',
  phases: { investigation: { items: { 'lost-basket': { status: 'completed', concluded_at: '2026-10-01T09:00:00.000Z', fixes: 'shop', area: 'Checkout', after_review: true } } } },
  checklists: { conclusion: { 'lost-basket': { closed: '2026-10-01T08:00:00.000Z', hunt: 'The basket was dropped on resume.', root_cause: 'lost-basket-1', fix: 'lost-basket-2', fixes: 'shop', area: 'Checkout', taken: '2026-10-01T09:00:00.000Z' } } },
});

/** A finding of a review round as a release before this one recorded it. @param {string} area */
const finding = (area) => ({ area, scope: 'in', call: 'bug', text: 'The receipt is never sent.', from: [`${area}-a#1`], fix: '4.1' });

/** A project whose state holds a bugfix and a feature reviewed over two rounds, its quick-fix sibling's notes answered at its close. @param {string} dir */
function project(dir) {
  initRepo(dir);
  putState(dir, 'manifest.json', { work_units: {} });
  putState(dir, 'lost-basket/manifest.json', BUGFIX);
  putState(dir, 'cards/manifest.json', { name: 'cards', work_type: 'feature', status: 'completed' });
  putState(dir, 'cards/review/round-1.json', { reports: ['1-cards-a.md'], passed: false, can_now: [], findings: [finding('1-cards'), finding('tests')], settled: null, scenarios: [] });
  putState(dir, 'cards/review/round-2.json', { reports: ['1-cards-a.md'], passed: true, can_now: [], findings: [], settled: null, scenarios: [] });
  putState(dir, 'cards/review/round-2-reads.json', { reads: ['1-cards', 'tests'] });
  putState(dir, 'tidy-docs/manifest.json', { name: 'tidy-docs', work_type: 'quick-fix', status: 'completed' });
  putState(dir, 'tidy-docs/build/notes-answered.json', { findings: [{ area: 'notes', scope: 'out', call: 'nit', text: 'The man page could say it too.', from: ['notes#1'], drop: 'Generated from the help.', ledger: 'tidy-docs-3' }] });
  return dir;
}

describe('migration 082: "area" freed for a discussion\'s unit', () => {
  it('bug parts: a bugfix\'s area is its part, on its investigation item and its close, each in its place among the keys, all else kept', () => {
    const dir = project(folder());

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0 });

    const manifest = stateJson(dir, 'lost-basket/manifest.json');
    assert.deepStrictEqual(Object.entries(manifest.phases.investigation.items['lost-basket']), [
      ['status', 'completed'], ['concluded_at', '2026-10-01T09:00:00.000Z'], ['fixes', 'shop'], ['part', 'Checkout'], ['after_review', true],
    ]);
    assert.deepStrictEqual(Object.entries(manifest.checklists.conclusion['lost-basket']), [
      ['closed', '2026-10-01T08:00:00.000Z'], ['hunt', 'The basket was dropped on resume.'], ['root_cause', 'lost-basket-1'], ['fix', 'lost-basket-2'], ['fixes', 'shop'], ['part', 'Checkout'], ['taken', '2026-10-01T09:00:00.000Z'],
    ]);
    assert.deepStrictEqual({ ...manifest, phases: null, checklists: null }, { ...BUGFIX, phases: null, checklists: null });
  });

  it('finding sections: each finding\'s area is its section, in a review round\'s record and a quick-fix\'s notes answered, the round\'s other files as they were', () => {
    const dir = project(folder());
    const reads = readFile(dir, '.ledger/cards/review/round-2-reads.json');
    const passed = readFile(dir, '.ledger/cards/review/round-2.json');

    run(dir);

    assert.deepStrictEqual(stateJson(dir, 'cards/review/round-1.json').findings.map(Object.keys), [
      ['section', 'scope', 'call', 'text', 'from', 'fix'], ['section', 'scope', 'call', 'text', 'from', 'fix'],
    ]);
    assert.deepStrictEqual(stateJson(dir, 'cards/review/round-1.json').findings.map(({ section }) => section), ['1-cards', 'tests']);
    assert.deepStrictEqual(stateJson(dir, 'tidy-docs/build/notes-answered.json').findings, [{ section: 'notes', scope: 'out', call: 'nit', text: 'The man page could say it too.', from: ['notes#1'], drop: 'Generated from the help.', ledger: 'tidy-docs-3' }]);
    assert.deepStrictEqual([readFile(dir, '.ledger/cards/review/round-2-reads.json'), readFile(dir, '.ledger/cards/review/round-2.json')], [reads, passed]);
  });

  it('writes each file whole: from a scratch in the state\'s cache, renamed in, none left behind', (t) => {
    const dir = project(folder());
    /** @type {{from: string, to: string}[]} */
    const renames = [];
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (/** @type {string} */ from, /** @type {string} */ to) => {
      renames.push({ from: path.dirname(from), to: path.relative(path.join(dir, '.ledger'), to) });
      return rename(from, to);
    });

    run(dir);

    const scratch = path.join(dir, '.ledger/.cache/migrate');
    assert.deepStrictEqual(renames, ['lost-basket/manifest.json', 'cards/review/round-1.json', 'tidy-docs/build/notes-answered.json'].map((to) => ({ from: scratch, to })));
    assert.deepStrictEqual(fs.readdirSync(scratch), []);
  });

  it('is idempotent: a run again renames nothing and leaves every file as it was', () => {
    const dir = project(folder());
    run(dir);
    const after = stateFiles(dir);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1 });
    assert.deepStrictEqual(stateFiles(dir), after);
  });

  it('skips a project in no repository, and one whose repository holds no state', () => {
    const loose = folder();
    createFile(loose, '.ledger/lost-basket/manifest.json', JSON.stringify(BUGFIX));
    const bare = initRepo(path.join(folder(), 'bare'));

    assert.deepStrictEqual([run(loose), run(bare)], [{ updates: 0, skips: 1 }, { updates: 0, skips: 1 }]);
    assert.deepStrictEqual(JSON.parse(readFile(loose, '.ledger/lost-basket/manifest.json')), BUGFIX);
  });

  it('runs from a project nested in its repository, on the state in the main checkout', () => {
    const dir = project(folder());
    const nested = path.join(dir, 'packages', 'app');
    fs.mkdirSync(nested, { recursive: true });

    assert.deepStrictEqual(run(nested), { updates: 1, skips: 0 });
    assert.strictEqual(stateJson(dir, 'lost-basket/manifest.json').phases.investigation.items['lost-basket'].part, 'Checkout');
  });

  it('stages nothing and commits nothing: the index and HEAD are as they were', () => {
    const dir = project(folder());
    createFile(dir, 'README.md', '# Shop\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'the state as a release before left it']);
    const head = git(dir, ['rev-parse', 'HEAD']);

    assert.deepStrictEqual(run(dir), { updates: 1, skips: 0 });
    assert.deepStrictEqual([git(dir, ['diff', '--cached', '--name-only']), git(dir, ['rev-parse', 'HEAD'])], ['', head]);
  });

  it('runs from a linked worktree of the code, on the state in the main checkout', () => {
    const dir = project(folder());
    createFile(dir, 'README.md', '# Shop\n');
    git(dir, ['add', 'README.md']);
    git(dir, ['commit', '-q', '-m', 'the code']);
    const linked = path.join(path.dirname(dir), `${path.basename(dir)}-linked`);
    git(dir, ['worktree', 'add', '-q', linked]);

    try {
      assert.deepStrictEqual(run(linked), { updates: 1, skips: 0 });
      assert.strictEqual(stateJson(dir, 'lost-basket/manifest.json').phases.investigation.items['lost-basket'].part, 'Checkout');
    } finally {
      fs.rmSync(linked, { recursive: true, force: true });
    }
  });

  it('renames a unit\'s findings where its manifest will not read', () => {
    const dir = project(folder());
    createFile(dir, '.ledger/cards/manifest.json', '{"name": ');
    createFile(dir, '.ledger/cards/build/notes-answered.json', `${JSON.stringify({ findings: [finding('notes')] })}\n`);

    run(dir);

    assert.deepStrictEqual([
      stateJson(dir, 'cards/review/round-1.json').findings.map(({ section }) => section),
      stateJson(dir, 'cards/build/notes-answered.json').findings.map(({ section }) => section),
      readFile(dir, '.ledger/cards/manifest.json'),
    ], [['1-cards', 'tests'], ['notes'], '{"name": ']);
  });

  it('passes over a record already naming the new field, a file that will not read, a folder holding no manifest and a retired unit kept as reference', () => {
    const dir = folder();
    initRepo(dir);
    const both = { ...finding('1-cards'), section: '1-cards' };
    putState(dir, 'cards/manifest.json', { name: 'cards' });
    putState(dir, 'cards/review/round-1.json', { findings: [both] });
    createFile(dir, '.ledger/cards/review/round-2.json', '{"findings": [');
    putState(dir, 'loose/review/round-1.json', { findings: [finding('1-cards')] });
    putState(dir, '.product/assets/old-bug/manifest.json', BUGFIX);
    const before = stateFiles(dir);

    assert.deepStrictEqual(run(dir), { updates: 0, skips: 1 });
    assert.deepStrictEqual(stateFiles(dir), before);
  });
});
