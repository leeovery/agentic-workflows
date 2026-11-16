'use strict';

// ---------------------------------------------------------------------------
// The legacy files (ledger-engine/scripts/domain/legacy-files.cjs, through
// asset.cjs, following moves through follow-moves.cjs): `engine asset
// legacy`, each place holding files the migration kept below its
// `assets/legacy/`, read from disk, the tools' sidecars left out, with its
// type, its status, its topics in discussion and its folders, each counted
// and how many of its files something names; `engine asset legacy <place>`,
// that place's folders and files, each file with how many things name it or
// a folder above it, each thing counted once and a legacy document of the
// place never, and each file and folder with what a discard of it leaves
// dead, where its findings go and its topics in discussion; `engine asset
// keep`, a file, or every file below a folder, moved to the same path under
// its place's `assets/`, a name taken there, or by a file before it,
// suffixed, and everything naming it or a folder it emptied following — a
// ledger line's citation and asset link, carried at the place it is read
// at, a document's link and embed, a folder's keeping its slash, a roadmap
// source — the commit taking the move, the ledger and every file rewritten;
// a file answering its move, a folder its count; several paths across
// places in one call and one commit; `engine asset discard`, the files
// deleted and what names them left, but what names a folder it empties
// that a keep moved some of following it to the kept folder, either order
// of keeping and discarding ending alike; each under the writer lock;
// every refusal moving and committing nothing. The menus' rows over the
// read are test-engine-start-menu.cjs's and
// test-engine-epic-menu-waits.cjs's; a retired unit's legacy files,
// test-engine-workunit-retire.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library — an epic with one topic in discussion, one decided and one
// cancelled, holding legacy files in three folders — two named so one
// prefixes the other — and beside them, one named as a file its assets
// hold already and one as the name that file's suffix would take, a
// sidecar beside them and a file beside its legacy folder. The file its
// assets hold already links the file beside, its topic's log and the
// legacy folder; that log embeds one, links another and links their
// folder; the one linked links back to a file and to another folder. A
// finding at its discovery cites one twice and links another and a
// folder, one at its spec cites the same and a folder, and a question on
// its topic cites one; roadmap items' sources are one and a folder. A
// completed feature with a topic left in discussion, a cancelled one and
// the product hold one each, the product's cited by a finding of its own —
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

const { carriedTo } = require('../../skills/ledger-engine/scripts/domain/ledger-fold.cjs');

const EPIC = 'evvi';
const LEGACY = `${EPIC}/assets/legacy`;
const RESEARCH = `${LEGACY}/research`;
const RESEARCH_OLD = `${LEGACY}/research-old`;
const DRAFTS = `${LEGACY}/drafts`;
const PLAN = `${LEGACY}/plan.md`;
const PLAN_2 = `${LEGACY}/plan-2.md`;
const DRAFT = `${DRAFTS}/draft.md`;
const OLD = `${RESEARCH_OLD}/old.md`;
const NOTES = `${RESEARCH}/notes.md`;
const SKETCH = `${RESEARCH}/sketch.png`;
const SIDECAR = `${RESEARCH}/.DS_Store`;
const BESIDE = `${EPIC}/assets/legacy-notes.md`;
const SHARED = `${EPIC}/assets/plan.md`;
const SHARED_TEXT = 'The plan the person shared, for [the sync](../topics/sync/log.md) beside [the notes](legacy-notes.md), in [the legacy](legacy/).\n';
const LOG = layout.topic(EPIC, 'sync', 'log.md');
const DONE = 'shipped';
const GONE = 'gone';
const SHIPPED = `${DONE}/assets/legacy/plan.md`;
const LEFT_BEHIND = `${GONE}/assets/legacy/left-behind.md`;
const VISION = '.product/assets/legacy/vision.md';
const NOTES_TEXT = '# Notes\n\nThe [sketch](sketch.png), the [plan](../plan.md) and the [drafts](../drafts/).\n';
const LOG_TEXT = '# Sync\n\n![The sketch](../../assets/legacy/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md), in [the research](../../assets/legacy/research/).\n';
const KEPT_RESEARCH = `${EPIC}/assets/research`;

const world = fixtureFrom('asset-legacy-', (template) => {
  const topics = { sync: 'in-progress', auth: 'completed', billing: 'cancelled' };
  createManifest(template, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: Object.fromEntries(Object.keys(topics).map((topic, i) => [topic, { order: i + 1, summary: topic, source: 'discovery' }])) },
      discussion: { items: Object.fromEntries(Object.entries(topics).map(([topic, status]) => [topic, { status }])) },
    },
  });
  createManifest(template, 'empty');
  createManifest(template, DONE, { status: 'completed', phases: { discussion: { items: { [DONE]: { status: 'in-progress' } } } } });
  createManifest(template, GONE, { status: 'cancelled' });
  for (const rel of [PLAN, PLAN_2, DRAFT, OLD, SKETCH, SIDECAR, BESIDE, SHIPPED, LEFT_BEHIND, VISION]) writeState(template, rel, `${rel}\n`);
  writeState(template, NOTES, NOTES_TEXT);
  writeState(template, SHARED, SHARED_TEXT);
  writeState(template, LOG, LOG_TEXT);
  const item = (/** @type {string} */ summary, /** @type {string} */ source) => ({ horizon: 'now', summary, origin: 'harvest', sources: [source] });
  writeState(template, layout.projectManifest, JSON.stringify({
    ...JSON.parse(readState(template, layout.projectManifest)),
    roadmap: { horizons: ['now'], items: { 'old-plan': item('the old plan', PLAN), 'old-research': item('the old research', RESEARCH) } },
  }, null, 2));
  commitAll(template, 'the migration');
  const finding = (/** @type {string} */ at, /** @type {string} */ text, /** @type {{path: string, section: string}[]} */ cites) => ok(template, ['ledger', 'find', at], { env: SESSION, stdin: JSON.stringify({ ...MADE, text, how: 'read in the old plan', known: 'documented', cites }) }).id;
  const found = finding(`${EPIC}.discovery`, 'The plan ships notes first.', [{ path: PLAN, section: 'Goals' }, { path: PLAN, section: 'Order' }]);
  finding(`${EPIC}.specification`, 'The plan orders the sync first.', [{ path: PLAN, section: 'Order' }, { path: RESEARCH, section: 'research' }]);
  finding('product.discovery', 'The vision is local first.', [{ path: VISION, section: 'vision.md' }]);
  for (const linked of [NOTES, DRAFTS]) ok(template, ['asset', 'add', EPIC, linked, '--entry', found, '--status', 'reference'], { env: SESSION });
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

/** Each roadmap item's sources, by name. */
const sources = () => Object.fromEntries(Object.entries(JSON.parse(readState(dir, layout.projectManifest)).roadmap.items).map(([name, { sources: its }]) => [name, its]));

/** Each `rehomed` line of the ledger: the place it carries to, and how many lines. */
const carries = () => readState(dir, layout.ledger).trim().split('\n').map((line) => JSON.parse(line))
  .filter((event) => event.event === 'rehomed').map(({ unit, topic, phase, lines }) => ({ unit, topic, phase, lines: lines.length }));

/** The place read's discard figures: each file's and each folder's, by path. @param {string} place */
function deadIn(place) {
  const { files, folders } = asset(['legacy', place]);
  return Object.fromEntries([...files, ...folders].map(({ path, dead }) => [path, dead]));
}

describe('the read', () => {
  it('answers every place holding legacy files — the units in the project\'s order, then the product — with its type, its status, its topics in discussion — a cancelled or decided one, or a completed unit\'s, never among them — and each folder holding files, how many, and how many of them something names, the sidecar and the file beside the folder never among them', () => {
    const at = (/** @type {string} */ place) => `${place}/assets/legacy`;
    assert.deepStrictEqual(asset(['legacy']), {
      ok: true,
      places: [
        {
          place: EPIC, work_type: 'epic', status: 'in-progress', in_discussion: [{ topic: 'sync', title: 'Sync' }], count: 6,
          folders: [{ path: LEGACY, count: 2, named: 2 }, { path: DRAFTS, count: 1, named: 1 }, { path: RESEARCH, count: 2, named: 2 }, { path: RESEARCH_OLD, count: 1, named: 1 }],
        },
        { place: GONE, work_type: 'feature', status: 'cancelled', in_discussion: [], count: 1, folders: [{ path: at(GONE), count: 1, named: 0 }] },
        { place: DONE, work_type: 'feature', status: 'completed', in_discussion: [], count: 1, folders: [{ path: at(DONE), count: 1, named: 0 }] },
        { place: 'product', work_type: null, status: null, in_discussion: [], count: 1, folders: [{ path: '.product/assets/legacy', count: 1, named: 1 }] },
      ],
    });
  });

  it('answers a place\'s folders and files: each file with how many things name it or a folder above it, each thing once however many ways it names the file and a legacy document of the place never; each file and folder with what discarding it leaves dead, a folder it would empty counted; where its findings go; and its topics in discussion', () => {
    assert.deepStrictEqual(asset(['legacy', EPIC]), {
      ok: true,
      place: EPIC,
      findings_at: `${EPIC}.discovery`,
      in_discussion: [{ topic: 'sync', title: 'Sync' }],
      folders: [
        { path: LEGACY, count: 2, named: 2, dead: 9 },
        { path: DRAFTS, count: 1, named: 1, dead: 1 },
        { path: RESEARCH, count: 2, named: 2, dead: 5 },
        { path: RESEARCH_OLD, count: 1, named: 1, dead: 0 },
      ],
      files: [
        { path: DRAFT, named: 2, dead: 1 },
        { path: PLAN_2, named: 1, dead: 0 },
        { path: PLAN, named: 4, dead: 3 },
        { path: NOTES, named: 5, dead: 2 },
        { path: SKETCH, named: 5, dead: 2 },
        { path: OLD, named: 1, dead: 0 },
      ],
    });
  });

  it('sends a completed unit\'s findings, a cancelled one\'s and the product\'s to the product\'s place; an empty legacy folder holds none', () => {
    const read = (/** @type {string} */ place) => {
      const { findings_at: at, files } = asset(['legacy', place]);
      return { at, files: files.length };
    };
    assert.deepStrictEqual([DONE, GONE, 'product', 'empty'].map(read), [
      { at: 'product.discovery', files: 1 },
      { at: 'product.discovery', files: 1 },
      { at: 'product.discovery', files: 1 },
      { at: 'empty.discovery', files: 0 },
    ]);
  });
});

describe('keep: everything naming a file, or a folder it empties, follows it', () => {
  it('the legacy folder kept whole: each file moved to its path under the assets, a name taken there or by a file before it suffixed; the log\'s embed, link and folder link, the moved document\'s links, the assets\' link to the legacy folder, the findings\' citations and asset links, of files and folders, and the roadmap\'s sources all follow; one commit takes the moves, the ledger and every file rewritten, and the answer counts', () => {
    const kept = asset(['keep', EPIC, LEGACY]);

    const to = (/** @type {string} */ rel) => `${EPIC}/assets/${rel}`;
    const moved = { plan2: to('plan-2.md'), plan: to('plan-3.md'), draft: to('drafts/draft.md'), old: to('research-old/old.md'), notes: to('research/notes.md'), sketch: to('research/sketch.png') };
    assert.deepStrictEqual(kept, { ok: true, kept: 6, to: `${EPIC}/assets`, left: 0, committed: tip() });
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, moved.notes), readState(dir, moved.plan2), readState(dir, SHARED)], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md), in [the research](../../assets/research/).\n',
      NOTES_TEXT.replace('../plan.md', '../plan-3.md'),
      `${PLAN_2}\n`,
      SHARED_TEXT.replace('(legacy/)', '(./)'),
    ]);
    assert.deepStrictEqual([findings(), sources()], [
      [{ cites: [moved.plan, moved.plan], assets: [moved.notes, to('drafts')] }, { cites: [moved.plan, KEPT_RESEARCH], assets: [] }],
      { 'old-plan': [moved.plan], 'old-research': [KEPT_RESEARCH] },
    ]);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [
      ...Object.values(moved).map((rel) => `A\t${rel}`), `D\t${DRAFT}`, `D\t${PLAN_2}`, `D\t${PLAN}`, `D\t${OLD}`, `D\t${NOTES}`, `D\t${SKETCH}`,
      `M\t${layout.ledger}`, `M\t${layout.projectManifest}`, `M\t${SHARED}`, `M\t${LOG}`,
    ].sort());
    assert.strictEqual(lastMessage(dir), `asset(${EPIC}): keep ${LEGACY}`);
    assert.ok(there(SIDECAR) && !there(`${EPIC}/assets/research/.DS_Store`), 'the sidecar is left where it was');
  });

  it('a folder kept alone, a folder its name prefixes staying: a link to it follows it, its slash kept; its document\'s links to what stays rebased from where it moved; the answer counts, a folder of one file\'s too', () => {
    assert.deepStrictEqual(asset(['keep', EPIC, RESEARCH]), { ok: true, kept: 2, to: KEPT_RESEARCH, left: 4, committed: tip() });
    assert.deepStrictEqual(asset(['keep', EPIC, DRAFTS]), { ok: true, kept: 1, to: `${EPIC}/assets/drafts`, left: 3, committed: tip() });
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, `${KEPT_RESEARCH}/notes.md`)], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md), in [the research](../../assets/research/).\n',
      '# Notes\n\nThe [sketch](sketch.png), the [plan](../legacy/plan.md) and the [drafts](../drafts/).\n',
    ]);
  });

  it('files kept one at a time, each answering its move and the documents rewritten: the log\'s embed follows the image and its folder link stays while the folder holds a file; the document left in legacy relinks to it; the plan\'s citations and roadmap source follow the plan', () => {
    assert.deepStrictEqual(asset(['keep', EPIC, SKETCH]), { ok: true, from: SKETCH, to: `${KEPT_RESEARCH}/sketch.png`, rewritten: [NOTES, LOG], left: 5, committed: tip() });
    asset(['keep', EPIC, PLAN]);

    const plan = `${EPIC}/assets/plan-2.md`;
    assert.deepStrictEqual([readState(dir, LOG), readState(dir, NOTES), findings().map(({ cites }) => cites), sources()['old-plan']], [
      '# Sync\n\n![The sketch](../../assets/research/sketch.png)\n\nSee [the notes](../../assets/legacy/research/notes.md), in [the research](../../assets/legacy/research/).\n',
      '# Notes\n\nThe [sketch](../../research/sketch.png), the [plan](../../plan-2.md) and the [drafts](../drafts/).\n',
      [[plan, plan], [plan, RESEARCH]],
      [plan],
    ]);
  });

  it('the asset link follows a file kept on its own, and its status changes at the new path', () => {
    asset(['keep', EPIC, NOTES]);
    asset(['status', EPIC, `${KEPT_RESEARCH}/notes.md`, 'canonical']);

    assert.deepStrictEqual(ok(dir, ['ledger', 'record', EPIC]).findings[0].assets[0], { path: `${KEPT_RESEARCH}/notes.md`, status: 'canonical', into: null });
  });

  it('carries each line citing a file kept to the place it stands — one carry for each place, the unit\'s discovery and its spec apart — so the topic\'s opening reads no earlier record: the question cites the file where it moved', () => {
    asset(['keep', EPIC, SKETCH]);
    asset(['keep', EPIC, PLAN]);

    const [question] = ok(dir, ['ledger', 'record', EPIC, 'sync']).questions;
    assert.deepStrictEqual([question.cites, carriedTo(statePath(dir), EPIC, 'sync', [])], [[{ path: `${KEPT_RESEARCH}/sketch.png`, section: 'sketch.png' }], false]);
    assert.deepStrictEqual(carries(), [
      { unit: EPIC, topic: 'sync', phase: 'discussion', lines: 1 },
      { unit: EPIC, topic: null, phase: 'discovery', lines: 1 },
      { unit: EPIC, topic: null, phase: 'specification', lines: 1 },
    ]);
  });

  it('several paths across places in one call: every file moved and what names each followed, in one commit, the answer how many files in how many places', () => {
    const before = tip();

    assert.deepStrictEqual(asset(['keep', EPIC, RESEARCH, DONE, SHIPPED, 'product', VISION]), {
      ok: true,
      kept: 4,
      places: 3,
      left: 4,
      committed: tip(),
    });
    assert.strictEqual(stateGit(dir, ['rev-list', '--count', `${before}..HEAD`]).trim(), '1');
    assert.strictEqual(lastMessage(dir), 'asset: keep 3 paths in 3 places');
    assert.deepStrictEqual([
      findings()[0].assets,
      ok(dir, ['ledger', 'product']).discovery.map((/** @type {{cites: {path: string}[]}} */ found) => found.cites.map(({ path }) => path)),
      there(`${DONE}/assets/plan.md`),
    ], [[`${KEPT_RESEARCH}/notes.md`, DRAFTS], [['.product/assets/vision.md']], true]);
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
    assert.deepStrictEqual([sources()['old-research'], readState(dir, LOG)], [[RESEARCH], LOG_TEXT]);
    assert.ok(!there('.product/assets/legacy') && there('.product/assets'), 'the legacy folder emptied goes, the assets stay');
    assert.strictEqual(stateGit(dir, ['show', `${before}:${VISION}`]), `${VISION}\n`);
  });

  it('a folder part kept and the rest discarded ends as the other order does: its folder link, the roadmap source and the citation naming it follow to the kept folder either way, the discarded file\'s embed left', () => {
    const ending = () => [readState(dir, LOG), sources()['old-research'], findings()[1].cites];
    const ended = [
      '# Sync\n\n![The sketch](../../assets/legacy/research/sketch.png)\n\nSee [the notes](../../assets/research/notes.md), in [the research](../../assets/research/).\n',
      [KEPT_RESEARCH],
      [PLAN, KEPT_RESEARCH],
    ];

    asset(['keep', EPIC, NOTES]);
    asset(['discard', EPIC, RESEARCH]);
    assert.deepStrictEqual(ending(), ended);

    cleanupFixture(dir);
    dir = world();
    asset(['discard', EPIC, SKETCH]);
    asset(['keep', EPIC, RESEARCH]);
    assert.deepStrictEqual(ending(), ended);
  });

  it('counts what a discard leaves dead: a file\'s own namers — a document kept among them — and a folder\'s only where the discard empties it and no keep moved any of it, the legacy folder\'s always; the legacy folder emptied by a discard is never followed', () => {
    asset(['keep', EPIC, NOTES]);

    const dead = deadIn(EPIC);
    assert.deepStrictEqual([dead[SKETCH], dead[RESEARCH], dead[DRAFT], dead[LEGACY]], [3, 3, 2, 8]);
    asset(['discard', EPIC, LEGACY]);
    assert.strictEqual(readState(dir, SHARED), SHARED_TEXT);
  });
});

describe('the refusals', () => {
  it('refuses a unit the project lacks, a path below no legacy folder of the place\'s — beside it, another place\'s — one naming nothing there and one not written plain; a keep of several, any of them, whole', () => {
    assert.match(refused(['keep', 'nope', PLAN]), /there is no work unit "nope"/);
    assert.match(refused(['keep', EPIC, BESIDE]), new RegExp(`${BESIDE} is not among ${EPIC}'s legacy files, which are under ${LEGACY}/`));
    assert.match(refused(['discard', EPIC, LEFT_BEHIND]), /is not among evvi's legacy files/);
    assert.match(refused(['discard', EPIC, `${LEGACY}/gone.md`]), /names no legacy file of evvi's — asset legacy evvi lists them/);
    assert.match(refused(['keep', EPIC, `${LEGACY}/../plan.md`]), /is no path from the state root written plain/);
    assert.match(refused(['keep', DONE, SHIPPED, EPIC, `${LEGACY}/gone.md`]), /names no legacy file of evvi's/);
    assert.match(refused(['keep', DONE, SHIPPED, EPIC, BESIDE]), /is not among evvi's legacy files/);
    assert.match(refused(['legacy', 'nope']), /there is no work unit "nope"/);
  });

  it('refuses a keep whose files the ledger names with no session to tag the carry with', () => {
    assert.match(refused(['keep', EPIC, PLAN], {}), /asset keep: ledger entries name what moves/);
  });

  it('refuses positionals of another count, with its usage', () => {
    assert.match(refused(['keep', EPIC]), /Usage: engine asset keep <work-unit\|product> <path> \[<work-unit\|product> <path> …\]/);
    assert.match(refused(['keep', EPIC, PLAN, DONE]), /Usage: engine asset keep/);
    assert.match(refused(['discard', EPIC, PLAN, DONE, SHIPPED]), /Usage: engine asset discard <work-unit\|product> <path>$/m);
    assert.match(refused(['legacy', EPIC, PLAN]), /Usage: engine asset legacy \[<work-unit\|product>\]/);
  });
});
