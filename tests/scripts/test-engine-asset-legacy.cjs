'use strict';

// ---------------------------------------------------------------------------
// The legacy files (leeway-engine/scripts/domain/legacy-files.cjs, through
// asset.cjs, following moves through follow-moves.cjs): `engine asset
// legacy [<place>]`, the files the migration kept below each place's
// `assets/legacy/`, read from disk, the tools' sidecars left out, each with
// how many things name it, and where each place's findings go; `engine asset
// keep`, a file, or every file below a folder, moved to the same path under
// the place's `assets/`, a name taken there suffixed, and everything naming
// it following — a ledger line's citation and asset link, a document's link
// and embed, a roadmap source — the commit taking the move and every file
// rewritten; `engine asset discard`, the files deleted and nothing
// rewritten; each under the writer lock; every refusal moving and
// committing nothing. The menus' rows over the read are
// test-engine-start-menu.cjs's and test-engine-epic-menu-waits.cjs's; a
// retired unit's legacy files, test-engine-workunit-retire.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library — an epic in discussion holding legacy files in a folder and
// beside it, one named as a file its assets hold already, a sidecar beside
// them and a file beside its legacy folder; its topic's log embedding one
// and linking another, which links back to the first; a finding at its
// level citing one and linking another, and a question on its topic citing
// one; a roadmap item whose source is one;
// a completed feature, a cancelled one and the product holding one each —
// committed as the migration leaves them, built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, refusedPristine, holdLock, lockAttempts, stateGit, statePath, layout, touched, lastMessage, fixtureFrom, cleanupFixture, commitAll } = require('./engine-harness.cjs');
const { createManifest, writeState, readState } = require('./discovery-test-utils.cjs');
const { SESSION, MADE } = require('./ledger-world.cjs');

const { carriedTo } = require('../../skills/leeway-engine/scripts/domain/ledger-fold.cjs');

const EPIC = 'evvi';
const LEGACY = `${EPIC}/assets/legacy`;
const PLAN = `${LEGACY}/plan.md`;
const NOTES = `${LEGACY}/research/notes.md`;
const SKETCH = `${LEGACY}/research/sketch.png`;
const SIDECAR = `${LEGACY}/research/.DS_Store`;
const BESIDE = `${EPIC}/assets/legacy-notes.md`;
const LOG = layout.topic(EPIC, 'sync', 'log.md');
const DONE = 'shipped';
const GONE = 'gone';
const SHIPPED = `${DONE}/assets/legacy/plan.md`;
const LEFT_BEHIND = `${GONE}/assets/legacy/left-behind.md`;
const VISION = '.product/assets/legacy/vision.md';
const NOTES_TEXT = '# Notes\n\nThe [sketch](sketch.png) and the [plan](../plan.md).\n';
const LOG_TEXT = '# Sync\n\n![The sketch](../../assets/legacy/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md).\n';

const world = fixtureFrom('asset-legacy-', (template) => {
  createManifest(template, EPIC, { work_type: 'epic', phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { sync: { order: 1, summary: 'Sync', source: 'discovery' } } }, discussion: { items: { sync: { status: 'in-progress' } } } } });
  createManifest(template, 'empty');
  createManifest(template, DONE, { status: 'completed' });
  createManifest(template, GONE, { status: 'cancelled' });
  for (const rel of [PLAN, SKETCH, SIDECAR, BESIDE, SHIPPED, LEFT_BEHIND, VISION]) writeState(template, rel, `${rel}\n`);
  writeState(template, NOTES, NOTES_TEXT);
  writeState(template, `${EPIC}/assets/plan.md`, 'the plan the person shared\n');
  writeState(template, LOG, LOG_TEXT);
  writeState(template, layout.projectManifest, JSON.stringify({
    ...JSON.parse(readState(template, layout.projectManifest)),
    roadmap: { horizons: ['now'], items: { 'old-plan': { horizon: 'now', summary: 'the old plan', origin: 'harvest', sources: [PLAN] } } },
  }, null, 2));
  commitAll(template, 'the migration');
  const found = ok(template, ['ledger', 'find', `${EPIC}.discovery`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'The plan ships notes first.', how: 'read in the old plan', known: 'documented', cites: [{ path: PLAN, section: 'plan.md' }] }) }).id;
  ok(template, ['asset', 'add', EPIC, NOTES, '--entry', found, '--status', 'reference'], { env: SESSION });
  ok(template, ['ledger', 'ask', `${EPIC}.discussion.sync`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Does the sketch still hold?', cites: [{ path: SKETCH, section: 'sketch.png' }] }) });
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

/** One asset call in the conversation that must succeed: its response. @param {string[]} args */
const asset = (args) => ok(dir, ['asset', ...args], { env: SESSION });

/** An asset call that must be refused, moving and committing nothing: its error. @param {string[]} args @param {Record<string, string|undefined>} [env] */
const refused = (args, env = SESSION) => refusedPristine(dir, ['asset', ...args], { env }).error;

/** Whether the state holds `rel`. @param {string} rel */
const there = (rel) => fs.existsSync(statePath(dir, rel));

/** The short sha of the state branch's last commit. */
const tip = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

/** The finding at the epic's level as its record shows it: where it cites, and the files linked from it. */
function finding() {
  const [found] = ok(dir, ['ledger', 'record', EPIC]).findings;
  return { cites: found.cites.map((/** @type {{path: string}} */ cite) => cite.path), assets: found.assets.map((/** @type {{path: string}} */ link) => link.path) };
}

/** The roadmap item's sources. */
const sources = () => JSON.parse(readState(dir, layout.projectManifest)).roadmap.items['old-plan'].sources;

describe('the read', () => {
  it('answers every place holding legacy files — the units in the project\'s order, then the product — each file with how many things name it, the sidecar and the file beside the folder never among them, and where each place\'s findings go: an epic in progress its own level, a completed unit, a cancelled one and the product the product\'s', () => {
    assert.deepStrictEqual(asset(['legacy']), {
      ok: true,
      places: [
        { place: EPIC, findings_at: `${EPIC}.discovery`, files: [{ path: PLAN, named: 3 }, { path: NOTES, named: 2 }, { path: SKETCH, named: 3 }] },
        { place: GONE, findings_at: 'product.discovery', files: [{ path: LEFT_BEHIND, named: 0 }] },
        { place: DONE, findings_at: 'product.discovery', files: [{ path: SHIPPED, named: 0 }] },
        { place: 'product', findings_at: 'product.discovery', files: [{ path: VISION, named: 0 }] },
      ],
    });
  });

  it('answers the one place named, whatever it holds: an empty legacy folder none', () => {
    assert.deepStrictEqual(asset(['legacy', 'empty']), { ok: true, places: [{ place: 'empty', findings_at: 'empty.discovery', files: [] }] });
  });
});

describe('keep: everything naming a file follows it', () => {
  it('a folder kept: each file moved to its path under the assets, a name taken suffixed; the log\'s embed and link, the moved document\'s own link, the finding\'s citation and asset link and the roadmap source all follow; one commit takes the moves and every file rewritten', () => {
    const kept = asset(['keep', EPIC, LEGACY]);

    const moved = { plan: `${EPIC}/assets/plan-2.md`, notes: `${EPIC}/assets/research/notes.md`, sketch: `${EPIC}/assets/research/sketch.png` };
    assert.deepStrictEqual(kept, {
      ok: true,
      moved: [{ from: PLAN, to: moved.plan }, { from: NOTES, to: moved.notes }, { from: SKETCH, to: moved.sketch }],
      rewritten: [moved.notes, LOG, layout.projectManifest],
      left: 0,
      committed: tip(),
    });
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, moved.notes)], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md).\n',
      '# Notes\n\nThe [sketch](sketch.png) and the [plan](../plan-2.md).\n',
    ]);
    assert.deepStrictEqual([finding(), sources()], [{ cites: [moved.plan], assets: [moved.notes] }, [moved.plan]]);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD').filter((change) => !change.endsWith(layout.ledger)), [
      `A\t${moved.plan}`, `A\t${moved.notes}`, `A\t${moved.sketch}`, `D\t${PLAN}`, `D\t${NOTES}`, `D\t${SKETCH}`, `M\t${layout.projectManifest}`, `M\t${LOG}`,
    ].sort());
    assert.strictEqual(lastMessage(dir), `asset(${EPIC}): keep ${LEGACY}`);
    assert.ok(there(SIDECAR) && !there(`${EPIC}/assets/research/.DS_Store`), 'the sidecar is left where it was');
  });

  it('files kept one at a time: the log\'s embed follows the image, the document left in legacy relinks to it, and the plan\'s citation and roadmap source follow the plan', () => {
    asset(['keep', EPIC, SKETCH]);
    asset(['keep', EPIC, PLAN]);

    assert.deepStrictEqual([readState(dir, LOG), readState(dir, NOTES), finding().cites, sources()], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md).\n',
      '# Notes\n\nThe [sketch](../../research/sketch.png) and the [plan](../../plan-2.md).\n',
      [`${EPIC}/assets/plan-2.md`],
      [`${EPIC}/assets/plan-2.md`],
    ]);
  });

  it('the asset link follows a file kept on its own, and its status changes at the new path', () => {
    asset(['keep', EPIC, NOTES]);
    asset(['status', EPIC, `${EPIC}/assets/research/notes.md`, 'canonical']);

    assert.deepStrictEqual(ok(dir, ['ledger', 'record', EPIC]).findings[0].assets, [{ path: `${EPIC}/assets/research/notes.md`, status: 'canonical', into: null }]);
  });

  it('carries the topic\'s question citing a file kept to the place it stands, so its topic\'s opening reads no earlier record: the question cites the file where it moved', () => {
    asset(['keep', EPIC, SKETCH]);

    const [question] = ok(dir, ['ledger', 'record', EPIC, 'sync']).questions;
    assert.deepStrictEqual([question.cites, carriedTo(statePath(dir), EPIC, 'sync', [])], [[{ path: `${EPIC}/assets/research/sketch.png`, section: 'sketch.png' }], false]);
  });

  it('holds the writer lock around the moves: a peer holding it, nothing has moved while the keep waits', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    /** @type {boolean[]} */
    const waitedWith = [];
    lockAttempts(t, lock, () => {
      waitedWith.push(there(SHIPPED));
      fs.unlinkSync(lock);
    });

    asset(['keep', DONE, SHIPPED]);

    assert.deepStrictEqual(waitedWith, [true]);
  });
});

describe('discard', () => {
  it('deletes the files and rewrites nothing that names them, the removal committed, the file kept in the history; the legacy folder goes with its last file', () => {
    const before = tip();

    assert.deepStrictEqual(asset(['discard', 'product', VISION]), { ok: true, discarded: [VISION], left: 0, committed: tip() });
    assert.deepStrictEqual(asset(['discard', EPIC, PLAN]).discarded, [PLAN]);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`D\t${PLAN}`]);
    assert.deepStrictEqual([sources(), finding().cites], [[PLAN], [PLAN]]);
    assert.ok(!there('.product/assets/legacy') && there('.product/assets'), 'the legacy folder emptied goes, the assets stay');
    assert.strictEqual(stateGit(dir, ['show', `${before}:${VISION}`]), `${VISION}\n`);
  });
});

describe('the refusals', () => {
  it('refuses a unit the project lacks, a path below no legacy folder of the place\'s — beside it, another place\'s — one naming nothing there and one not written plain', () => {
    assert.match(refused(['keep', 'nope', PLAN]), /there is no work unit "nope"/);
    assert.match(refused(['keep', EPIC, BESIDE]), new RegExp(`${BESIDE} is not among ${EPIC}'s legacy files, which are under ${LEGACY}/`));
    assert.match(refused(['discard', EPIC, LEFT_BEHIND]), /is not among evvi's legacy files/);
    assert.match(refused(['discard', EPIC, `${LEGACY}/gone.md`]), /names no legacy file of evvi's — asset legacy evvi lists them/);
    assert.match(refused(['keep', EPIC, `${LEGACY}/../plan.md`]), /is no path from the state root written plain/);
    assert.match(refused(['legacy', 'nope']), /there is no work unit "nope"/);
  });

  it('refuses a keep whose files the ledger names with no session to tag the carry with', () => {
    assert.match(refused(['keep', EPIC, PLAN], {}), /asset keep: ledger entries name what moves/);
  });

  it('refuses positionals of another count, with its usage', () => {
    assert.match(refused(['keep', EPIC]), /Usage: engine asset keep <work-unit\|product> <path>/);
    assert.match(refused(['legacy', EPIC, PLAN]), /Usage: engine asset legacy \[<work-unit\|product>\]/);
  });
});
