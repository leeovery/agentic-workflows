'use strict';

// ---------------------------------------------------------------------------
// The legacy files (leeway-engine/scripts/domain/legacy-files.cjs, through
// asset.cjs, following moves through follow-moves.cjs): `engine asset
// legacy`, each place holding files the migration kept below its
// `assets/legacy/`, read from disk, the tools' sidecars left out, with its
// folders, each counted and how many of its files something names; `engine
// asset legacy <place>`, that place's files, each with how many things name
// it, or a folder above it, each thing counted once, where its findings go
// and its topics in discussion; `engine asset keep`, a file, or every file
// below a folder, moved to the same path under the place's `assets/`, a
// name taken there, or by a file before it, suffixed, and everything naming
// it or a folder it emptied following — a ledger line's citation and asset
// link, carried at the place it is read at, a document's link and embed, a
// folder's keeping its slash, a roadmap source — the commit taking the
// move, the ledger and every file rewritten; a file answering its move, a
// folder its count; `engine asset discard`, the files deleted and nothing
// rewritten; each under the writer lock; every refusal moving and
// committing nothing. The menus' rows over the read are
// test-engine-start-menu.cjs's and test-engine-epic-menu-waits.cjs's; a
// retired unit's legacy files, test-engine-workunit-retire.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library — an epic with one topic in discussion and one decided, holding
// legacy files in two folders and beside them, one named as a file its
// assets hold already and one as the name that file's suffix would take, a
// sidecar beside them and a file beside its legacy folder, which the file
// its assets hold already links, with its topic's log; that log
// embedding one, linking another and linking their folder; the one linked
// linking back to a file and to the other folder; a finding at its
// discovery citing one twice and linking another, one at its spec citing
// the same, and a question on its topic citing one; a roadmap item whose
// source is one; a completed feature, a cancelled one and the product
// holding one each — committed as the migration leaves them, built once and
// copied for each test.
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
const RESEARCH = `${LEGACY}/research`;
const DRAFTS = `${LEGACY}/drafts`;
const PLAN = `${LEGACY}/plan.md`;
const PLAN_2 = `${LEGACY}/plan-2.md`;
const DRAFT = `${DRAFTS}/draft.md`;
const NOTES = `${RESEARCH}/notes.md`;
const SKETCH = `${RESEARCH}/sketch.png`;
const SIDECAR = `${RESEARCH}/.DS_Store`;
const BESIDE = `${EPIC}/assets/legacy-notes.md`;
const SHARED = `${EPIC}/assets/plan.md`;
const SHARED_TEXT = 'The plan the person shared, for [the sync](../topics/sync/log.md) beside [the notes](legacy-notes.md).\n';
const LOG = layout.topic(EPIC, 'sync', 'log.md');
const DONE = 'shipped';
const GONE = 'gone';
const SHIPPED = `${DONE}/assets/legacy/plan.md`;
const LEFT_BEHIND = `${GONE}/assets/legacy/left-behind.md`;
const VISION = '.product/assets/legacy/vision.md';
const NOTES_TEXT = '# Notes\n\nThe [sketch](sketch.png), the [plan](../plan.md) and the [drafts](../drafts/).\n';
const LOG_TEXT = '# Sync\n\n![The sketch](../../assets/legacy/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md), in [the research](../../assets/legacy/research/).\n';

const world = fixtureFrom('asset-legacy-', (template) => {
  createManifest(template, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { sync: { order: 1, summary: 'Sync', source: 'discovery' }, auth: { order: 2, summary: 'Auth', source: 'discovery' } } },
      discussion: { items: { sync: { status: 'in-progress' }, auth: { status: 'completed' } } },
    },
  });
  createManifest(template, 'empty');
  createManifest(template, DONE, { status: 'completed' });
  createManifest(template, GONE, { status: 'cancelled' });
  for (const rel of [PLAN, PLAN_2, DRAFT, SKETCH, SIDECAR, BESIDE, SHIPPED, LEFT_BEHIND, VISION]) writeState(template, rel, `${rel}\n`);
  writeState(template, NOTES, NOTES_TEXT);
  writeState(template, SHARED, SHARED_TEXT);
  writeState(template, LOG, LOG_TEXT);
  writeState(template, layout.projectManifest, JSON.stringify({
    ...JSON.parse(readState(template, layout.projectManifest)),
    roadmap: { horizons: ['now'], items: { 'old-plan': { horizon: 'now', summary: 'the old plan', origin: 'harvest', sources: [PLAN] } } },
  }, null, 2));
  commitAll(template, 'the migration');
  const cites = [{ path: PLAN, section: 'Goals' }, { path: PLAN, section: 'Order' }];
  const found = ok(template, ['ledger', 'find', `${EPIC}.discovery`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'The plan ships notes first.', how: 'read in the old plan', known: 'documented', cites }) }).id;
  ok(template, ['ledger', 'find', `${EPIC}.specification`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'The plan orders the sync first.', how: 'read in the old plan', known: 'documented', cites: [cites[1]] }) });
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

/** The epic's findings as its record shows them: where each cites, and the files linked from each. */
function findings() {
  return ok(dir, ['ledger', 'record', EPIC]).findings.map((/** @type {{cites: {path: string}[], assets: {path: string}[]}} */ found) => ({
    cites: found.cites.map((cite) => cite.path),
    assets: found.assets.map((link) => link.path),
  }));
}

/** The roadmap item's sources. */
const sources = () => JSON.parse(readState(dir, layout.projectManifest)).roadmap.items['old-plan'].sources;

/** Each `rehomed` line of the ledger: the place it carries to, and how many lines. */
const carries = () => readState(dir, layout.ledger).trim().split('\n').map((line) => JSON.parse(line))
  .filter((event) => event.event === 'rehomed').map(({ unit, topic, phase, lines }) => ({ unit, topic, phase, lines: lines.length }));

describe('the read', () => {
  it('answers every place holding legacy files — the units in the project\'s order, then the product — with each folder holding files, how many, and how many of them something names, the sidecar and the file beside the folder never among them', () => {
    assert.deepStrictEqual(asset(['legacy']), {
      ok: true,
      places: [
        { place: EPIC, count: 5, folders: [{ path: LEGACY, count: 2, named: 1 }, { path: DRAFTS, count: 1, named: 1 }, { path: RESEARCH, count: 2, named: 2 }] },
        { place: GONE, count: 1, folders: [{ path: `${GONE}/assets/legacy`, count: 1, named: 0 }] },
        { place: DONE, count: 1, folders: [{ path: `${DONE}/assets/legacy`, count: 1, named: 0 }] },
        { place: 'product', count: 1, folders: [{ path: '.product/assets/legacy', count: 1, named: 0 }] },
      ],
    });
  });

  it('answers a place\'s files, each with how many things name it or a folder above it, each thing once however many ways it names the file; where its findings go, an epic in progress its own level; and its topics in discussion, never one decided', () => {
    assert.deepStrictEqual(asset(['legacy', EPIC]), {
      ok: true,
      place: EPIC,
      findings_at: `${EPIC}.discovery`,
      in_discussion: [{ topic: 'sync', title: 'Sync' }],
      files: [{ path: DRAFT, named: 1 }, { path: PLAN_2, named: 0 }, { path: PLAN, named: 4 }, { path: NOTES, named: 2 }, { path: SKETCH, named: 3 }],
    });
  });

  it('sends a completed unit\'s findings, a cancelled one\'s and the product\'s to the product\'s place, with no topic in discussion; an empty legacy folder holds none', () => {
    const read = (/** @type {string} */ place) => {
      const { findings_at: at, in_discussion: topics, files } = asset(['legacy', place]);
      return { at, topics, files: files.length };
    };
    assert.deepStrictEqual([DONE, GONE, 'product', 'empty'].map(read), [
      { at: 'product.discovery', topics: [], files: 1 },
      { at: 'product.discovery', topics: [], files: 1 },
      { at: 'product.discovery', topics: [], files: 1 },
      { at: 'empty.discovery', topics: [], files: 0 },
    ]);
  });
});

describe('keep: everything naming a file, or a folder it empties, follows it', () => {
  it('the legacy folder kept whole: each file moved to its path under the assets, a name taken there or by a file before it suffixed; the log\'s embed, link and folder link, the moved document\'s links, the findings\' citations and asset link and the roadmap source all follow; one commit takes the moves, the ledger and every file rewritten, and the answer counts', () => {
    const kept = asset(['keep', EPIC, LEGACY]);

    const moved = { plan2: `${EPIC}/assets/plan-2.md`, plan: `${EPIC}/assets/plan-3.md`, draft: `${EPIC}/assets/drafts/draft.md`, notes: `${EPIC}/assets/research/notes.md`, sketch: `${EPIC}/assets/research/sketch.png` };
    assert.deepStrictEqual(kept, { ok: true, kept: 5, to: `${EPIC}/assets`, left: 0, committed: tip() });
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, moved.notes), readState(dir, moved.plan2)], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md), in [the research](../../assets/research/).\n',
      NOTES_TEXT.replace('../plan.md', '../plan-3.md'),
      `${PLAN_2}\n`,
    ]);
    assert.deepStrictEqual([findings(), sources()], [[{ cites: [moved.plan, moved.plan], assets: [moved.notes] }, { cites: [moved.plan], assets: [] }], [moved.plan]]);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [
      `A\t${moved.draft}`, `A\t${moved.plan2}`, `A\t${moved.plan}`, `A\t${moved.notes}`, `A\t${moved.sketch}`,
      `D\t${DRAFT}`, `D\t${PLAN_2}`, `D\t${PLAN}`, `D\t${NOTES}`, `D\t${SKETCH}`,
      `M\t${layout.ledger}`, `M\t${layout.projectManifest}`, `M\t${LOG}`,
    ].sort());
    assert.strictEqual(readState(dir, SHARED), SHARED_TEXT, 'a document the assets held already is rebased from nowhere');
    assert.strictEqual(lastMessage(dir), `asset(${EPIC}): keep ${LEGACY}`);
    assert.ok(there(SIDECAR) && !there(`${EPIC}/assets/research/.DS_Store`), 'the sidecar is left where it was');
  });

  it('a folder kept alone: a link to it follows it, its slash kept; its document\'s links to what stays rebased from where it moved; the answer counts, a folder of one file\'s too', () => {
    assert.deepStrictEqual(asset(['keep', EPIC, RESEARCH]), { ok: true, kept: 2, to: `${EPIC}/assets/research`, left: 3, committed: tip() });
    assert.deepStrictEqual(asset(['keep', EPIC, DRAFTS]), { ok: true, kept: 1, to: `${EPIC}/assets/drafts`, left: 2, committed: tip() });
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, `${EPIC}/assets/research/notes.md`)], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md), in [the research](../../assets/research/).\n',
      '# Notes\n\nThe [sketch](sketch.png), the [plan](../legacy/plan.md) and the [drafts](../drafts/).\n',
    ]);
  });

  it('files kept one at a time, each answering its move and the documents rewritten: the log\'s embed follows the image and its folder link stays while the folder holds a file; the document left in legacy relinks to it; the plan\'s citations and roadmap source follow the plan', () => {
    assert.deepStrictEqual(asset(['keep', EPIC, SKETCH]), { ok: true, from: SKETCH, to: `${EPIC}/assets/research/sketch.png`, rewritten: [NOTES, LOG], left: 4, committed: tip() });
    asset(['keep', EPIC, PLAN]);

    assert.deepStrictEqual([readState(dir, LOG), readState(dir, NOTES), findings().map(({ cites }) => cites), sources()], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md), in [the research](../../assets/legacy/research/).\n',
      '# Notes\n\nThe [sketch](../../research/sketch.png), the [plan](../../plan-2.md) and the [drafts](../drafts/).\n',
      [[`${EPIC}/assets/plan-2.md`, `${EPIC}/assets/plan-2.md`], [`${EPIC}/assets/plan-2.md`]],
      [`${EPIC}/assets/plan-2.md`],
    ]);
  });

  it('the asset link follows a file kept on its own, and its status changes at the new path', () => {
    asset(['keep', EPIC, NOTES]);
    asset(['status', EPIC, `${EPIC}/assets/research/notes.md`, 'canonical']);

    assert.deepStrictEqual(ok(dir, ['ledger', 'record', EPIC]).findings[0].assets, [{ path: `${EPIC}/assets/research/notes.md`, status: 'canonical', into: null }]);
  });

  it('carries each line citing a file kept to the place it stands — one carry for each place, the unit\'s discovery and its spec apart — so the topic\'s opening reads no earlier record: the question cites the file where it moved', () => {
    asset(['keep', EPIC, SKETCH]);
    asset(['keep', EPIC, PLAN]);

    const [question] = ok(dir, ['ledger', 'record', EPIC, 'sync']).questions;
    assert.deepStrictEqual([question.cites, carriedTo(statePath(dir), EPIC, 'sync', [])], [[{ path: `${EPIC}/assets/research/sketch.png`, section: 'sketch.png' }], false]);
    assert.deepStrictEqual(carries(), [
      { unit: EPIC, topic: 'sync', phase: 'discussion', lines: 1 },
      { unit: EPIC, topic: null, phase: 'discovery', lines: 1 },
      { unit: EPIC, topic: null, phase: 'specification', lines: 1 },
    ]);
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
  it('deletes the files and rewrites nothing that names them, the removal committed, the file kept in the history, the answer counting; the legacy folder goes with its last file', () => {
    const before = tip();

    assert.deepStrictEqual(asset(['discard', 'product', VISION]), { ok: true, discarded: 1, left: 0, committed: tip() });
    assert.deepStrictEqual(asset(['discard', EPIC, RESEARCH]).discarded, 2);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`D\t${NOTES}`, `D\t${SKETCH}`]);
    assert.deepStrictEqual([sources(), readState(dir, LOG)], [[PLAN], LOG_TEXT]);
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
