'use strict';

// ---------------------------------------------------------------------------
// The legacy files (leeway-engine/scripts/domain/legacy-files.cjs, through
// asset.cjs): `engine asset legacy`, the files the migration kept below a
// place's `assets/legacy/`, read from disk; and `engine asset
// bring|keep|discard`, each sorting a file, or every file below a folder,
// out of it — moved to the same path under the place's `assets/`, a name
// taken there suffixed, or deleted — the folders it empties gone, and the
// change committed on the state branch; bring answering where the findings
// from the files go; every refusal moving and committing nothing. The menus'
// rows over the read are test-engine-start-menu.cjs's and
// test-engine-epic-menu-waits.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library — an epic in discussion holding legacy files in a folder and
// beside it, one of them named as a file its assets hold already; a feature
// whose legacy folder is empty, and a bugfix with none; a cancelled feature
// holding one; and the product holding one — committed as the migration
// leaves them, built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, refusedPristine, stateGit, statePath, touched, lastMessage, fixtureFrom, cleanupFixture, commitAll } = require('./engine-harness.cjs');
const { createManifest, writeState } = require('./discovery-test-utils.cjs');

const EPIC = 'evvi';
const GONE = 'gone';
const NOTES = `${EPIC}/assets/legacy/research/notes.md`;
const SKETCH = `${EPIC}/assets/legacy/research/sketch.png`;
const PLAN = `${EPIC}/assets/legacy/plan.md`;
const VISION = '.product/assets/legacy/vision.md';
const LEFT_BEHIND = `${GONE}/assets/legacy/left-behind.md`;

const world = fixtureFrom('asset-legacy-', (template) => {
  createManifest(template, EPIC, { work_type: 'epic', phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { sync: { order: 1, summary: 'Sync', source: 'discovery' } } }, discussion: { items: { sync: { status: 'in-progress' } } } } });
  createManifest(template, 'empty');
  createManifest(template, 'bare', { work_type: 'bugfix' });
  createManifest(template, GONE, { status: 'cancelled' });
  for (const rel of [NOTES, SKETCH, PLAN, VISION, LEFT_BEHIND]) writeState(template, rel, `${rel}\n`);
  writeState(template, `${EPIC}/assets/plan.md`, 'the plan the person shared\n');
  commitAll(template, 'the migration');
  fs.mkdirSync(statePath(template, 'empty', 'assets', 'legacy'), { recursive: true });
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

/** One asset call that must succeed: its response. @param {string[]} args */
const asset = (args) => ok(dir, ['asset', ...args]);

/** An asset call that must be refused, moving and committing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['asset', ...args]).error;

/** Whether the state holds `rel`. @param {string} rel */
const there = (rel) => fs.existsSync(statePath(dir, rel));

/** The short sha of the state branch's last commit. */
const tip = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

describe('the read', () => {
  it('answers a place\'s legacy files from the state root, in order, every folder below its legacy folder read — the product\'s too', () => {
    assert.deepStrictEqual(asset(['legacy', EPIC]), { ok: true, place: EPIC, files: [PLAN, NOTES, SKETCH] });
    assert.deepStrictEqual(asset(['legacy', 'product']), { ok: true, place: 'product', files: [VISION] });
  });

  it('answers none for an empty legacy folder and an absent one, and reads a cancelled unit\'s as any other', () => {
    assert.deepStrictEqual([asset(['legacy', 'empty']).files, asset(['legacy', 'bare']).files, asset(['legacy', GONE]).files], [[], [], [LEFT_BEHIND]]);
  });
});

describe('sorting a legacy file', () => {
  it('keep: moves the file to its path under the assets, a name taken there suffixed, untouched, and commits the move', () => {
    const kept = asset(['keep', EPIC, PLAN]);

    assert.deepStrictEqual(kept, { ok: true, moved: [{ from: PLAN, to: `${EPIC}/assets/plan-2.md` }], left: 2, committed: tip() });
    assert.strictEqual(fs.readFileSync(statePath(dir, `${EPIC}/assets/plan-2.md`), 'utf8'), `${PLAN}\n`);
    assert.strictEqual(fs.readFileSync(statePath(dir, `${EPIC}/assets/plan.md`), 'utf8'), 'the plan the person shared\n');
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`A\t${EPIC}/assets/plan-2.md`, `D\t${PLAN}`]);
    assert.strictEqual(lastMessage(dir), `asset(${EPIC}): keep ${PLAN}`);
  });

  it('bring: moves every file below a folder named, the folder it empties gone, and answers the unit\'s own level in its discovery for the findings', () => {
    const folder = `${EPIC}/assets/legacy/research`;

    assert.deepStrictEqual(asset(['bring', EPIC, folder]), {
      ok: true,
      moved: [{ from: NOTES, to: `${EPIC}/assets/research/notes.md` }, { from: SKETCH, to: `${EPIC}/assets/research/sketch.png` }],
      findings_at: `${EPIC}.discovery`,
      left: 1,
      committed: tip(),
    });
    assert.ok(!there(folder) && there(`${EPIC}/assets/legacy`), 'the folder emptied goes, the legacy folder holding a file stays');
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`A\t${EPIC}/assets/research/notes.md`, `A\t${EPIC}/assets/research/sketch.png`, `D\t${NOTES}`, `D\t${SKETCH}`]);
    assert.strictEqual(lastMessage(dir), `asset(${EPIC}): bring in ${folder}`);
  });

  it('bring: answers the product\'s place for the findings from the product\'s files and from a unit no longer live', () => {
    const fromProduct = asset(['bring', 'product', VISION]);
    const fromGone = asset(['bring', GONE, LEFT_BEHIND]);

    assert.deepStrictEqual([fromProduct.moved, fromProduct.findings_at], [[{ from: VISION, to: '.product/assets/vision.md' }], 'product.discovery']);
    assert.deepStrictEqual([fromGone.moved, fromGone.findings_at], [[{ from: LEFT_BEHIND, to: `${GONE}/assets/left-behind.md` }], 'product.discovery']);
  });

  it('discard: deletes the file, the legacy folder going with the last, and commits the removal, the file kept in the history', () => {
    const before = tip();

    assert.deepStrictEqual(asset(['discard', 'product', VISION]), { ok: true, discarded: [VISION], left: 0, committed: tip() });
    assert.ok(!there('.product/assets/legacy') && there('.product/assets'), 'the legacy folder emptied goes, the assets stay');
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`D\t${VISION}`]);
    assert.strictEqual(stateGit(dir, ['show', `${before}:${VISION}`]), `${VISION}\n`);
    assert.strictEqual(asset(['legacy', 'product']).files.length, 0, 'the read answers none once the folder is gone');
  });

  it('sorts the whole legacy folder named at once', () => {
    assert.deepStrictEqual(asset(['discard', EPIC, `${EPIC}/assets/legacy`]).discarded, [PLAN, NOTES, SKETCH]);
    assert.ok(!there(`${EPIC}/assets/legacy`));
  });
});

describe('the refusals', () => {
  it('refuses a unit the project lacks, a path below no legacy folder of the place\'s, one naming nothing there and one not written plain', () => {
    assert.match(refused(['keep', 'nope', PLAN]), /there is no work unit "nope"/);
    assert.match(refused(['keep', EPIC, `${EPIC}/assets/plan.md`]), new RegExp(`${EPIC}/assets/plan\\.md is not among ${EPIC}'s legacy files, which are under ${EPIC}/assets/legacy/`));
    assert.match(refused(['bring', EPIC, LEFT_BEHIND]), /is not among evvi's legacy files/);
    assert.match(refused(['discard', EPIC, `${EPIC}/assets/legacy/gone.md`]), /names no legacy file of evvi's — asset legacy evvi lists them/);
    assert.match(refused(['keep', EPIC, `${EPIC}/assets/legacy/../plan.md`]), /is no path from the state root written plain/);
    assert.match(refused(['legacy', 'nope']), /there is no work unit "nope"/);
  });

  it('refuses positionals of another count, with its usage', () => {
    assert.match(refused(['keep', EPIC]), /Usage: engine asset keep <work-unit\|product> <path>/);
    assert.match(refused(['legacy']), /Usage: engine asset legacy <work-unit\|product>/);
  });
});
