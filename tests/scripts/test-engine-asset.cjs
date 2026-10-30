'use strict';

// ---------------------------------------------------------------------------
// Spikes and assets (leeway-engine/scripts/domain/asset.cjs): `engine asset
// spike`, a spike's numbered folder and its twin under the cache, and
// `engine asset add|status|lift`, each appending the ledger's asset event
// from an entry to a file — its first link giving its status, a later one
// changing it or recording a lift into the project — tagged as the entry is
// and committing the ledger to the state branch; every refusal writing and
// committing nothing; and the files a call Claude spiked to settle shows
// beside it, in its record and in "what have you decided without me?"
// (domain/ledger-since.cjs). How the fold reads the links is
// test-engine-ledger-provenance.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the epic's manifest and a feature's written there, Claude's
// question and call on the note window and a person's decision written
// through the ledger's verbs, a file the person shared in the epic's
// assets/ and a spike begun — built once and copied for each test; and for
// a link while the migration runs, the migration's project, its
// `leeway-state` with no commit yet (migration-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, refuses, refusedPristine, head, holdLock, lockAttempts, stateGit, statePath, layout, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { commitUncommitted } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { withStateLock } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { midMigration, stateUnborn, UNIT: MIGRATING } = require('./migration-world.cjs');

const { shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { ignoresCase } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));

// Whether the filesystem every folder of these tests is on ignores case.
const IGNORES_CASE = ignoresCase(fs.realpathSync(os.tmpdir()));

const { UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, PHASES, NOTE_COPY, ids, ledgerHelpers, ledgerReadHelpers } = require('./ledger-world.cjs');

const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const MOCK = `${UNIT}/assets/note-mock.png`;
const FRAME = `${UNIT}/spikes/001-frame/Frame.swift`;
const LIFTED = 'Sources/Note/Frame.swift';

/** Each entry the world holds, by its name: its short id. @type {Record<string, string>} */
const made = {};

const world = fixtureFrom('asset-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
  const { write } = ledgerHelpers(() => template);
  made.look = write('ask', NOTE, [], { ...MADE, text: 'What does a note look like?' }).id;
  made.frameless = write('decide', NOTE, ['--answers', made.look], { ...MADE, text: 'A frameless panel.', why: 'Lighter on the desk.' }).id;
  made.opens = write('ask', SPACE, [], { ...MADE, text: 'Which Space does a note open on?' }).id;
  made.active = write('decide', SPACE, ['--answers', made.opens], { ...PERSON, text: 'The active Space.', why: 'Where the person is.' }).id;
  made.minted = write('ask', 'mint.discussion.mint', [], { ...MADE, text: 'What is a mint?' }).id;
  fs.mkdirSync(statePath(template, UNIT, 'assets'), { recursive: true });
  fs.writeFileSync(statePath(template, MOCK), 'a mock the person shared\n');
  ok(template, ['asset', 'spike', UNIT, 'frame']);
  fs.writeFileSync(statePath(template, FRAME), 'struct Frame {}\n');
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, rawLines, entries, full, read, decide, ask } = ledgerReadHelpers(() => dir);

/** One asset call that must succeed: its response. @param {string[]} args @param {Record<string, string|undefined>} [env] */
function asset(args, env = SESSION) {
  return ok(dir, ['asset', ...args], { env });
}

/** An asset call that must be refused, writing and committing nothing: its error. @param {string[]} args @param {Record<string, string|undefined>} [env] */
function refused(args, env = SESSION) {
  return refusedPristine(dir, ['asset', ...args], { env }).error;
}

/** A file written in the state at `rel`. @param {string} rel @param {string} [text] */
function saved(rel, text = 'a file\n') {
  fs.mkdirSync(path.dirname(statePath(dir, rel)), { recursive: true });
  fs.writeFileSync(statePath(dir, rel), text);
  return rel;
}

/** The files the entry `id` links as the note window's or space homing's record shows them. @param {string} topic @param {string} id */
function assetsOf(topic, id) {
  const record = read('record', UNIT, topic);
  return [...record.questions, ...record.findings, ...record.decisions].find((/** @type {{id: string}} */ e) => e.id === id).assets;
}

/** The short id the ledger gives the full id `id` now. @param {string} id */
function shortOf(id) {
  return /** @type {string} */ (shortIds(entries().map((e) => e.id)).get(id));
}

/** The files the state branch's last commit holds a change to, sorted. */
function committedFiles() {
  return stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
}

/** The ledger's asset lines, each as `[entry, path, status, into]`. */
function links() {
  return entries().filter((e) => e.event === 'asset').map((e) => [e.entry, e.path, e.status, e.into]);
}

describe('a spike (9.10.10, 4.11.13)', () => {
  it('9.S32, 9.S66: numbers each spike in the order spikes start, its folder under the unit\'s spikes/ and its twin at the same path under the cache, answered whole, nothing committed', () => {
    const before = head(dir);

    const scroll = asset(['spike', UNIT, 'scroll-feel']);
    const sheet = asset(['spike', UNIT, 'sheet']);

    assert.deepStrictEqual([scroll, sheet], [
      { ok: true, spike: '002-scroll-feel', path: `${UNIT}/spikes/002-scroll-feel`, folder: statePath(dir, UNIT, 'spikes', '002-scroll-feel'), cache: statePath(dir, '.cache', UNIT, 'spikes', '002-scroll-feel') },
      { ok: true, spike: '003-sheet', path: `${UNIT}/spikes/003-sheet`, folder: statePath(dir, UNIT, 'spikes', '003-sheet'), cache: statePath(dir, '.cache', UNIT, 'spikes', '003-sheet') },
    ]);
    for (const { folder, cache } of [scroll, sheet]) assert.ok(fs.statSync(folder).isDirectory() && fs.statSync(cache).isDirectory(), `${folder} or ${cache} is not made`);
    assert.strictEqual(head(dir), before);
  });

  it('numbers past the highest spike, a gap in the numbers left as it is', () => {
    fs.renameSync(statePath(dir, UNIT, 'spikes', '001-frame'), statePath(dir, UNIT, 'spikes', '004-frame'));

    assert.strictEqual(asset(['spike', UNIT, 'sheet']).spike, '005-sheet');
  });

  it('refuses a slug one of the unit\'s spikes has, a slug that is none, a unit the project lacks and a unit set aside, making nothing', () => {
    ok(dir, ['workunit', 'cancel', 'mint']);
    const spikes = () => fs.readdirSync(statePath(dir, UNIT, 'spikes'));
    const before = spikes();

    assert.strictEqual(refused(['spike', UNIT, 'frame']), `asset spike: ${UNIT} has a spike "frame" already, spikes/001-frame — carry on in it, or name the new one apart`);
    assert.strictEqual(refused(['spike', UNIT, 'Scroll Feel']), 'asset spike: "Scroll Feel" is no slug — lowercase letters and digits, joined by single hyphens');
    assert.strictEqual(refused(['spike', 'dock', 'frame']), 'asset spike: there is no work unit "dock"');
    assert.match(refused(['spike', 'mint', 'frame']), /^asset spike: mint takes no spike — .*cancelled/);
    assert.deepStrictEqual(spikes(), before);
    assert.strictEqual(fs.existsSync(statePath(dir, 'mint', 'spikes')), false);
  });
});

describe('a first link (9.10.5–9.10.7, 9.10.22)', () => {
  it('9.S33: links a file the person shared in the unit\'s assets/ from the entry it informs, with the status Claude proposes — the line tagged as the entry is, in the conversation\'s session — and commits the file with the ledger; the record and its copy show it', () => {
    const res = asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'canonical']);

    const { id, at, v } = entries().at(-1);
    assert.strictEqual(rawLines().at(-1), JSON.stringify({ v, id, event: 'asset', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION_ID, at, entry: full(made.frameless), path: MOCK, status: 'canonical', into: null }));
    assert.deepStrictEqual(res, { ok: true, path: MOCK, links: [{ id: shortOf(id), entry: made.frameless }], committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), `ledger(${UNIT}): asset ${shortOf(id)} in note-window`);
    assert.deepStrictEqual(committedFiles(), [layout.ledger, MOCK].sort());
    assert.deepStrictEqual(assetsOf('note-window', made.frameless), [{ path: MOCK, status: 'canonical', into: null }]);
    assert.ok(fs.readFileSync(statePath(dir, NOTE_COPY), 'utf8').includes(`Assets:\n- ${MOCK}, canonical\n`), 'the copy does not show the file');
    assert.strictEqual(fs.existsSync(statePath(dir, UNIT, 'imports')), false);
  });

  it('9.S34: a spike\'s file — draft code — is reference unless the status is said, and a file outside a spike takes the status said, refused without one', () => {
    const product = saved('.product/assets/brand.png');

    asset(['add', UNIT, FRAME, '--entry', made.frameless]);
    asset(['add', UNIT, product, '--entry', made.frameless, '--status', 'reference']);

    assert.deepStrictEqual(assetsOf('note-window', made.frameless), [{ path: FRAME, status: 'reference', into: null }, { path: product, status: 'reference', into: null }]);
    assert.strictEqual(refused(['add', UNIT, MOCK, '--entry', made.frameless]), 'asset add: a first link gives the file its status — --status <canonical|reference>');
  });

  it('9.S65: refuses a path naming no file, to be corrected or skipped before anything lands', () => {
    assert.strictEqual(refused(['add', UNIT, `${UNIT}/assets/pasted.png`, '--entry', made.frameless, '--status', 'reference']),
      `asset add: ${UNIT}/assets/pasted.png names no file — save it there first, or correct the path`);
  });

  it('9.S33: refuses a file anywhere but below a home — the unit\'s imports/, another unit\'s assets, a folder in spikes/ that is no spike, a topic\'s folder, the assets folder itself — and a path not written plain', () => {
    const homes = `${UNIT}/assets/, a spike of ${UNIT}'s, ${UNIT}/spikes/NNN-{slug}/, or the product's .product/assets/ or .product/spikes/NNN-{slug}/`;
    for (const rel of [saved(`${UNIT}/imports/brief.pdf`), saved('mint/assets/mock.png'), saved(`${UNIT}/spikes/frame/Frame.swift`), saved(`${UNIT}/topics/note-window/sketch.png`), `${UNIT}/assets`, `${UNIT}/spikes`]) {
      assert.strictEqual(refused(['add', UNIT, rel, '--entry', made.frameless, '--status', 'reference']), `asset add: ${rel} is not where an asset lives — ${homes}`);
    }
    for (const rel of [`${UNIT}/assets/../assets/note-mock.png`, `./${MOCK}`, statePath(dir, MOCK)]) {
      assert.strictEqual(refused(['add', UNIT, rel, '--entry', made.frameless, '--status', 'reference']), `asset add: "${rel}" is no path from the state root written plain — no part of it empty, . or ..`);
    }
  });

  it('refuses a link from what is no current entry of the unit — an entry replaced, an asset link, another unit\'s entry — and from an entry linking the file already, and one without a session or a status that is none', () => {
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    const link = shortOf(entries().at(-1).id);
    const panel = write('replace', NOTE, ['--replaces', made.frameless, '--reason', 'changed-mind'], { ...MADE, drops: ['frameless'], text: 'A panel with a hairline frame.', why: 'Easier to grab.' }).id;
    const add = (/** @type {string} */ entry) => refused(['add', UNIT, FRAME, '--entry', entry]);

    assert.match(add(made.frameless), new RegExp(`^asset add --entry names ${made.frameless}, which ${panel} replaced — the current one is ${panel}$`));
    assert.strictEqual(add(link), `asset add --entry names ${link}, a asset event — it must name an entry`);
    assert.strictEqual(add(made.minted), `asset add --entry names ${made.minted}, an entry of mint — an asset of ${UNIT}'s is linked from ${UNIT}'s own entries`);
    asset(['add', UNIT, FRAME, '--entry', panel]);
    assert.strictEqual(add(panel), `asset add: ${panel} links ${FRAME} already, reference — its status changes through asset status`);
    assert.strictEqual(refused(['add', UNIT, MOCK, '--entry', made.active, '--status', 'lifted']), 'asset add: "lifted" is no status — canonical or reference');
    assert.strictEqual(refused(['add', UNIT, MOCK, '--entry', made.active, '--status', 'reference'], {}), 'asset add: no session to tag the link with — CLAUDE_CODE_SESSION_ID is not set');
  });
});

describe('what a link commits (9.10.4)', () => {
  it('takes every file a link names into each ledger commit after: an edit since its link and a linked folder\'s new file land with the next unrelated ledger write, and none removes a linked file; a spike\'s file no entry links stays untracked (9.S38)', () => {
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    const designs = asset(['spike', UNIT, 'note-design']).path;
    const round = [saved(`${designs}/round-2/note-b.png`), saved(`${designs}/round-2/note-b.url`)];
    const unlinked = saved(`${designs}/round-1/note-a.png`);
    asset(['add', UNIT, `${designs}/round-2`, '--entry', made.frameless, '--status', 'canonical']);
    const linked = committedFiles();
    fs.writeFileSync(statePath(dir, MOCK), 'the mock, edited\n');
    const added = saved(`${designs}/round-2/note-c.png`);
    fs.rmSync(statePath(dir, round[1]));

    ask(SPACE, 'Does a note snap to the grid?');

    assert.deepStrictEqual(linked, [layout.ledger, ...round].sort());
    assert.deepStrictEqual([committedFiles(), stateGit(dir, ['show', `HEAD:${MOCK}`])], [[layout.ledger, MOCK, added].sort(), 'the mock, edited\n']);
    assert.deepStrictEqual(stateGit(dir, ['ls-files', '--', designs, FRAME]).trim().split('\n'), [...round, added].sort(), `a linked file was removed, or ${unlinked} or ${FRAME}, linked from nothing, is tracked`);
  });

  it('catches up a link whose commit was refused, its file with it, at the next ledger write and at boot\'s catch-up', () => {
    const stray = saved(`${UNIT}/tmp/notes.md`);
    const pending = asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    fs.rmSync(statePath(dir, stray));
    ask(SPACE, 'Does a note snap to the grid?');
    const caught = committedFiles();
    saved(stray);
    asset(['add', UNIT, FRAME, '--entry', made.frameless]);
    fs.rmSync(statePath(dir, stray));

    withStateLock(statePath(dir), () => commitUncommitted(statePath(dir), 'ledger: the entries a write left uncommitted'));

    assert.deepStrictEqual([pending.committed, pending.note], [null, 'commit pending — the link is in the ledger, and the next ledger write or boot commits it']);
    assert.deepStrictEqual([caught, committedFiles()], [[layout.ledger, MOCK].sort(), [layout.ledger, FRAME].sort()]);
  });

  it('holds no ledger commit up on a linked file gone before any commit took it: the next ledger write commits the ledger', () => {
    const stray = saved(`${UNIT}/tmp/notes.md`);
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    fs.rmSync(statePath(dir, stray));
    fs.rmSync(statePath(dir, MOCK));

    const res = write('ask', SPACE, [], { ...MADE, text: 'Does a note snap to the grid?' });

    assert.deepStrictEqual([res.committed, committedFiles()], [stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), [layout.ledger]]);
  });

  it('links a spike\'s folder whole, named with or without its trailing slash, stored without it — reference, as a spike\'s file is', () => {
    const spike = `${UNIT}/spikes/001-frame`;

    asset(['add', UNIT, `${spike}/`, '--entry', made.frameless]);
    asset(['add', UNIT, spike, '--entry', made.active, '--status', 'canonical']);

    assert.deepStrictEqual(links(), [[full(made.frameless), spike, 'reference', null], [full(made.active), spike, 'canonical', null]]);
    assert.ok(committedFiles().includes(layout.ledger) && stateGit(dir, ['ls-files', '--', FRAME]).trim() === FRAME, `${FRAME} is not tracked`);
  });

  it('stores a path as the file system spells it, so one file is one path: where it ignores case, a link named in another case links the file as it is named on disk; where it keeps case, nothing is there', () => {
    const otherCase = `${UNIT}/Assets/Note-Mock.png`;

    if (IGNORES_CASE) {
      asset(['add', UNIT, otherCase, '--entry', made.frameless, '--status', 'reference']);
      assert.deepStrictEqual([links(), committedFiles()], [[[full(made.frameless), MOCK, 'reference', null]], [layout.ledger, MOCK].sort()]);
    } else {
      assert.strictEqual(refused(['add', UNIT, otherCase, '--entry', made.frameless, '--status', 'reference']), `asset add: ${otherCase} names no file — save it there first, or correct the path`);
    }
  });
});

describe('while the migration runs (21.9.3)', () => {
  const folder = useTempFolder('asset-migration-');

  it('a link holds its commit, the file with the line: the link in the ledger, the branch with no commit yet', () => {
    const at = midMigration(folder());
    const found = ok(at, ['ledger', 'find', `${MIGRATING}.discussion.search`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Ranking reads the title first.', how: 'seen in a spike', known: 'spike' }) }).id;
    fs.mkdirSync(statePath(at, MIGRATING, 'assets'), { recursive: true });
    fs.writeFileSync(statePath(at, MIGRATING, 'assets', 'ranking.png'), 'a chart\n');

    const res = ok(at, ['asset', 'add', MIGRATING, `${MIGRATING}/assets/ranking.png`, '--entry', found, '--status', 'reference'], { env: SESSION });

    assert.deepStrictEqual([res.committed, res.note, stateUnborn(at)], [null, 'held for the migration\'s commit', true]);
  });
});

describe('a status changed (9.10.7)', () => {
  it('9.S56: a later link gives every current entry of the unit linking the file the status the person asked for, and the status stands — an entry since replaced keeps its own, and another unit\'s entry linking a product file is never changed', () => {
    const brand = saved('.product/assets/brand.png');
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    asset(['add', UNIT, MOCK, '--entry', made.active, '--status', 'reference']);
    asset(['add', 'mint', brand, '--entry', made.minted, '--status', 'reference']);
    asset(['add', UNIT, brand, '--entry', made.active, '--status', 'reference']);
    const panel = write('replace', NOTE, ['--replaces', made.frameless, '--reason', 'changed-mind'], { ...MADE, drops: ['frameless'], text: 'A panel with a hairline frame.', why: 'Easier to grab.' }).id;
    asset(['add', UNIT, MOCK, '--entry', panel, '--status', 'reference']);
    const spec = `${UNIT}.specification`;
    const specced = decide(spec, write('ask', spec, [], { ...MADE, text: 'Does the spec carry the mock?' }).id, 'It does.');
    asset(['add', UNIT, MOCK, '--entry', specced, '--status', 'reference']);
    const before = entries().length;

    const res = asset(['status', UNIT, MOCK, 'canonical']);
    asset(['status', UNIT, brand, 'canonical']);

    const written = entries().slice(before).map((e) => [e.id, e.phase, e.topic, e.entry, e.path, e.status, e.into]);
    assert.deepStrictEqual(written.map(([, ...link]) => link), [
      ['discussion', 'space-homing', full(made.active), MOCK, 'canonical', null],
      ['discussion', 'note-window', full(panel), MOCK, 'canonical', null],
      ['specification', null, full(specced), MOCK, 'canonical', null],
      ['discussion', 'space-homing', full(made.active), brand, 'canonical', null],
    ]);
    assert.deepStrictEqual(res, {
      ok: true, path: MOCK, links: [[written[0][0], made.active], [written[1][0], panel], [written[2][0], specced]].map(([id, entry]) => ({ id: shortOf(id), entry })), committed: res.committed,
    });
    assert.deepStrictEqual([assetsOf('note-window', panel), assetsOf('space-homing', made.active)], [
      [{ path: MOCK, status: 'canonical', into: null }],
      [{ path: MOCK, status: 'canonical', into: null }, { path: brand, status: 'canonical', into: null }],
    ]);
    assert.deepStrictEqual(read('record', 'mint', 'mint').questions[0].assets, [{ path: brand, status: 'reference', into: null }]);
  });

  it('changes the one entry named alone, and a change giving no entry anything new writes and commits nothing', () => {
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'canonical']);
    asset(['add', UNIT, MOCK, '--entry', made.active, '--status', 'canonical']);

    asset(['status', UNIT, MOCK, 'reference', '--entry', made.active]);
    const at = { lines: rawLines(), head: head(dir) };
    const unchanged = asset(['status', UNIT, MOCK, 'reference', '--entry', made.active]);

    assert.deepStrictEqual([assetsOf('note-window', made.frameless), assetsOf('space-homing', made.active)], [[{ path: MOCK, status: 'canonical', into: null }], [{ path: MOCK, status: 'reference', into: null }]]);
    assert.deepStrictEqual(unchanged, { ok: true, path: MOCK, links: [], committed: null, note: 'nothing written — every entry named already gives the file that' });
    assert.deepStrictEqual({ lines: rawLines(), head: head(dir) }, at);
  });

  it('refuses a file no current entry of the unit links, an entry named that does not link it — a first link is add\'s — and a status that is none', () => {
    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);

    assert.strictEqual(refused(['status', UNIT, FRAME, 'canonical']), `asset status: no current entry of ${UNIT} links ${FRAME} — asset add links it first, giving its status`);
    assert.strictEqual(refused(['status', UNIT, MOCK, 'canonical', '--entry', made.active]), `asset status: ${made.active} does not link ${MOCK} — a first link gives its status, through asset add`);
    assert.strictEqual(refused(['status', UNIT, MOCK, 'lifted']), 'asset status: "lifted" is no status — canonical or reference');
  });
});

describe('a lift (9.10.16)', () => {
  it('9.S51: records spike code lifted into the product as a link naming the path in the project and giving no status; a later status change leaves the lift standing', () => {
    asset(['add', UNIT, FRAME, '--entry', made.frameless]);
    fs.mkdirSync(path.join(dir, path.dirname(LIFTED)), { recursive: true });
    fs.writeFileSync(path.join(dir, LIFTED), 'struct Frame {}\n');

    asset(['lift', UNIT, FRAME, '--into', LIFTED, '--entry', made.frameless]);
    const lifted = links().at(-1);
    asset(['status', UNIT, FRAME, 'canonical']);

    assert.deepStrictEqual(lifted, [full(made.frameless), FRAME, null, LIFTED]);
    assert.deepStrictEqual(assetsOf('note-window', made.frameless), [{ path: FRAME, status: 'canonical', into: LIFTED }]);
    assert.deepStrictEqual(asset(['lift', UNIT, FRAME, '--into', LIFTED, '--entry', made.frameless]).links, [], 'the same lift again was written');
  });

  it('a lift after the spike\'s file moved into the product commits the ledger alone: no removal of the linked file', () => {
    asset(['add', UNIT, FRAME, '--entry', made.frameless]);
    fs.mkdirSync(path.join(dir, path.dirname(LIFTED)), { recursive: true });
    fs.renameSync(statePath(dir, FRAME), path.join(dir, LIFTED));

    asset(['lift', UNIT, FRAME, '--into', LIFTED, '--entry', made.frameless]);

    assert.deepStrictEqual([committedFiles(), stateGit(dir, ['ls-files', '--', FRAME]).trim()], [[layout.ledger], FRAME]);
  });

  it('refuses a lift into a path the project lacks or one not written plain, and from an entry not linking the file — its first link gives its status', () => {
    asset(['add', UNIT, FRAME, '--entry', made.frameless]);
    fs.mkdirSync(path.join(dir, path.dirname(LIFTED)), { recursive: true });
    fs.writeFileSync(path.join(dir, LIFTED), 'struct Frame {}\n');

    assert.strictEqual(refused(['lift', UNIT, FRAME, '--into', 'Sources/Note/Panel.swift', '--entry', made.frameless]), 'asset lift: --into Sources/Note/Panel.swift names nothing in the project — a lift is recorded once the code is there');
    assert.strictEqual(refused(['lift', UNIT, FRAME, '--into', `../${LIFTED}`, '--entry', made.frameless]), `asset lift: --into "../${LIFTED}" is no path in the project from its root written plain — no part of it empty, . or ..`);
    assert.strictEqual(refused(['lift', UNIT, FRAME, '--into', LIFTED, '--entry', made.active]), `asset lift: ${made.active} does not link ${FRAME} — a first link gives its status, through asset add`);
  });
});

describe('a spike as evidence (9.10.8–9.10.17)', () => {
  it('9.S37: a call Claude spiked to settle shows with its reference assets beside it in "what have you decided without me?" and in its record', () => {
    asset(['add', UNIT, FRAME, '--entry', made.frameless]);

    const [call] = read('since', UNIT, 'note-window').calls;

    assert.deepStrictEqual([call.id, call.assets], [made.frameless, [{ path: FRAME, status: 'reference', into: null }]]);
    assert.deepStrictEqual(assetsOf('note-window', made.frameless), call.assets);
  });

  it('9.S35, 9.S36, 9.S38, 9.S50, 9.S66: a design spike over rounds closes "which design?" with the person\'s choice, the design canonical where it lies with no copy, the rejected one reference; a later spike\'s challenge replaces the lock, the old design folded beneath it; scaffolding nobody discussed shows on no record', () => {
    const designs = asset(['spike', UNIT, 'note-design']).path;
    const [first, chosen, link, scaffold] = [saved(`${designs}/round-1/note-a.png`), saved(`${designs}/round-2/note-b.png`), saved(`${designs}/round-2/note-b.url`), saved(`${designs}/round-2/scaffold.js`)];
    const which = ask(NOTE, 'Which design?');
    const lost = write('find', NOTE, [], { ...MADE, text: 'Round 1\'s note reads as a window.', how: 'the person looked at it', known: 'spike' }).id;
    const lock = decide(NOTE, which, 'Round 2\'s design.', [], PERSON);
    asset(['add', UNIT, first, '--entry', lost]);
    asset(['add', UNIT, chosen, '--entry', lock, '--status', 'canonical']);
    asset(['add', UNIT, link, '--entry', lock, '--status', 'canonical']);

    const challenge = saved(`${asset(['spike', UNIT, 'note-design-dark']).path}/note-c.png`);
    const dark = write('replace', NOTE, ['--replaces', lock, '--reason', 'new-fact', '--cause', lost], { ...PERSON, drops: ['round 2'], text: 'The dark design.', why: 'It held up in the dark-mode spike.' }).id;
    asset(['add', UNIT, challenge, '--entry', dark, '--status', 'canonical']);

    const record = read('record', UNIT, 'note-window');
    const decision = record.decisions.find((/** @type {{id: string}} */ d) => d.id === dark);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions.find((/** @type {{id: string}} */ q) => q.id === which).stands, 'answered');
    assert.deepStrictEqual([decision.assets, decision.replaced.map((/** @type {{id: string, assets: unknown}} */ d) => [d.id, d.assets])], [
      [{ path: challenge, status: 'canonical', into: null }],
      [[lock, [{ path: chosen, status: 'canonical', into: null }, { path: link, status: 'canonical', into: null }]]],
    ]);
    assert.deepStrictEqual(assetsOf('note-window', lost), [{ path: first, status: 'reference', into: null }]);
    assert.deepStrictEqual(fs.readdirSync(statePath(dir, UNIT, 'assets')), ['note-mock.png'], 'a design was copied into assets/');
    for (const rel of [first, chosen, link, scaffold]) assert.ok(fs.existsSync(statePath(dir, rel)), `${rel} is gone`);
    const everyAsset = [...record.questions, ...record.findings, ...record.decisions].flatMap((e) => [e, ...(e.replaced ?? [])]).flatMap((e) => e.assets.map((/** @type {{path: string}} */ a) => a.path));
    assert.deepStrictEqual([everyAsset.includes(scaffold), ids(record.decisions).includes(dark)], [false, true]);
  });
});

describe('the writer lock', () => {
  it('refuses what the request alone settles while a peer holds the lock, never trying it', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('a refusal waited on the lock'); });

    for (const [args, env, refusal] of /** @type {[string[], Record<string, string>, RegExp][]} */ ([
      [['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference'], {}, /no session to tag the link with/],
      [['add', UNIT, `${UNIT}/assets/pasted.png`, '--entry', made.frameless, '--status', 'reference'], SESSION, /names no file/],
      [['add', 'dock', MOCK, '--entry', made.frameless, '--status', 'reference'], SESSION, /there is no work unit "dock"/],
      [['lift', UNIT, FRAME, '--into', LIFTED, '--entry', made.frameless], SESSION, /names nothing in the project/],
      [['spike', UNIT, 'Scroll Feel'], SESSION, /is no slug/],
    ])) {
      assert.match(refuses(dir, ['asset', ...args], { env }).error, refusal);
    }
    assert.deepStrictEqual(attempts, []);
  });

  it('a link and a spike wait on a peer holding the lock, and land once it lets go', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    // The peer lets go as soon as the call finds the lock held.
    const attempts = lockAttempts(t, lock, () => fs.unlinkSync(lock));

    asset(['add', UNIT, MOCK, '--entry', made.frameless, '--status', 'reference']);
    const linked = attempts.splice(0);
    holdLock(lock);
    asset(['spike', UNIT, 'sheet']);

    assert.deepStrictEqual([linked[0], attempts[0]], ['taken', 'taken']);
    assert.deepStrictEqual([links().length, fs.existsSync(statePath(dir, UNIT, 'spikes', '002-sheet'))], [1, true]);
  });
});

describe('the verb\'s argv', () => {
  it('refuses a verb it lacks, a flag it does not take or given twice, a missing flag it needs, and positionals of another count, each with its usage', () => {
    const usage = 'Usage: engine asset <spike|add|status|lift> …\nasset spike <work-unit> <slug>\nasset add <work-unit> <path> --entry <id> [--status <canonical|reference>]\n'
      + 'asset status <work-unit> <path> <canonical|reference> [--entry <id>]\nasset lift <work-unit> <path> --into <path-in-project> --entry <id>';
    assert.strictEqual(refused(['move', UNIT, MOCK]), usage);
    assert.strictEqual(refused(['add', UNIT, MOCK, '--entry', made.frameless, '--into', LIFTED]), 'Usage: engine asset add <work-unit> <path> --entry <id> [--status <canonical|reference>]');
    assert.strictEqual(refused(['add', UNIT, MOCK, '--entry', made.frameless, '--entry', made.active]), 'Usage: engine asset add <work-unit> <path> --entry <id> [--status <canonical|reference>]');
    assert.strictEqual(refused(['lift', UNIT, FRAME, '--into', LIFTED]), 'Usage: engine asset lift <work-unit> <path> --into <path-in-project> --entry <id>');
    assert.strictEqual(refused(['status', UNIT, MOCK]), 'Usage: engine asset status <work-unit> <path> <canonical|reference> [--entry <id>]');
    assert.strictEqual(refused(['spike', UNIT]), 'Usage: engine asset spike <work-unit> <slug>');
  });
});
