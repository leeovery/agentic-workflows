'use strict';

// ---------------------------------------------------------------------------
// "What have you decided without me?" and "since you last looked"
// (workflow-engine/scripts/domain/ledger-since.cjs): `engine ledger since`,
// Claude's current calls showing in a unit or on a topic — where each
// stands, where it was made, and on the map of each question it answers —
// that no look on this machine has shown, the build's calls among them;
// `engine ledger shown`, the one read that adds the calls it showed to the
// mark, under the mark's own lock, taken once the read's fold is done, a
// look anywhere a call shows clearing it everywhere; the mark kept on each
// machine in the cache, never committed, through a merge that lays the
// other machine's calls before ones shown here and through the unit's
// cancel; and nothing any ledger read answers left on disk.
//
// Real repositories in temp folders, each with its state worktree, the work
// unit's manifest written there; a bare remote and a second clone stand for
// another machine.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  holdLock, lockAttempts, ok, refuses, git, stateGit, statePath, testIdentity, bareRepo, cleanupFixture,
} = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, ledgerWorld } = require('./ledger-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { createStateBranchFromRemote, addStateWorktree } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState } = require(path.join(SCRIPTS, 'domain/state-merge.cjs'));
const { stateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));

const TOPICS = Object.freeze(['note-window', 'space-homing', 'menu-bar']);

/** @type {string} */
let dir;
/** The question each place's calls answer on each machine, asked once a test. @type {Map<string, string>} */
let asked;

beforeEach(() => {
  dir = ledgerWorld('ledger-since-', { discussion: { items: Object.fromEntries(TOPICS.map((topic) => [topic, { status: 'in-progress' }])) } });
  asked = new Map();
});

afterEach(() => {
  cleanupFixture(dir);
});

/** One ledger write in `at` that must succeed: its short id. @param {string} at @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function writeIn(at, verb, address, flags, content) {
  return ok(at, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A call answering the place's question, Claude's unless `by` says whose. @param {string} address @param {string} text @param {string} [by] */
function call(address, text, by = 'claude', at = dir) {
  const place = `${at}\0${address}`;
  if (!asked.has(place)) asked.set(place, writeIn(at, 'ask', address, [], { ...MADE, text: 'What is a note?' }));
  return writeIn(at, 'decide', address, ['--answers', /** @type {string} */ (asked.get(place))], { by, who_moved_whom: 'none', text, why: `Why: ${text}` });
}

/** The calls a read answers, by id. @param {'since'|'shown'} verb @param {string[]} place */
function calls(verb, ...place) {
  return callsIn(dir, verb, ...place);
}

/** @param {string} at @param {'since'|'shown'} verb @param {string[]} place */
function callsIn(at, verb, ...place) {
  return callsOf(at, verb, UNIT, ...place);
}

/** The calls a read answers in `unit`, by id. @param {string} at @param {'since'|'shown'} verb @param {string} unit @param {string[]} topic */
function callsOf(at, verb, unit, ...topic) {
  return ok(at, ['ledger', verb, unit, ...topic]).calls.map((/** @type {{id: string}} */ c) => c.id);
}

/** The ledger's ids, in order. @param {string} at */
function ledgerIds(at) {
  return fs.readFileSync(statePath(at, '.ledger.jsonl'), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).id);
}

/** The full id a short id shows. @param {string} short @param {string} [at] */
function full(short, at = dir) {
  return /** @type {string} */ (ledgerIds(at).find((id) => id.startsWith(short)));
}

/** Where the machine keeps the unit's last-looked mark. @param {string} [at] */
function marksFile(at = dir) {
  return statePath(at, '.cache', '.marks', `${UNIT}.json`);
}

/** The machine's last-looked mark, or null where it keeps none. @param {string} [at] */
function marks(at = dir) {
  return fs.existsSync(marksFile(at)) ? JSON.parse(fs.readFileSync(marksFile(at), 'utf8')) : null;
}

/** Every file under `root`, git's own aside, by its path from it. @param {string} root @returns {string[]} */
function files(root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((rel) => rel !== '.git')
    .sort();
}

describe('since you last looked (5.8.7, 5.8.14, 5.8.15)', () => {
  it('lists Claude\'s calls on a topic no look has shown: a plain read moves nothing, as opening the board is not looking, and `ledger shown` adds each call it showed to the mark (5.S30)', () => {
    const first = call(NOTE, 'A note is a panel.');
    call(NOTE, 'A note keeps its size.', 'person');
    const second = call(NOTE, 'A note has no title bar.');
    call(SPACE, 'A note opens on the active Space.');

    assert.deepStrictEqual(calls('shown', 'note-window'), [first, second]);
    assert.deepStrictEqual(marks(), { shown: [full(first), full(second)] });

    const third = call(NOTE, 'A note snaps to the grid.');
    assert.deepStrictEqual(calls('since', 'note-window'), [third]);
    assert.deepStrictEqual(calls('since', 'note-window'), [third], 'a plain read moved the mark');
    assert.deepStrictEqual(calls('shown', 'note-window'), [third]);
    assert.deepStrictEqual(calls('since', 'note-window'), []);
    assert.deepStrictEqual(calls('shown', 'note-window'), []);
    assert.deepStrictEqual(marks(), { shown: [full(first), full(second), full(third)] });
  });

  it('answers "what have you decided without me?" across the unit, a discussion\'s calls and the build\'s alike, a call shown on its topic\'s map shown for the unit too (5.S19)', () => {
    const noted = call(NOTE, 'A note is a panel.');
    const homed = call(SPACE, 'A note opens on the active Space.');
    const built = call(`${UNIT}.implementation`, 'The panel is an NSPanel.');

    const res = ok(dir, ['ledger', 'since', UNIT]);
    assert.deepStrictEqual(res.calls.map((/** @type {Record<string, any>} */ c) => [c.id, c.by, c.phase, c.standing]), [
      [noted, 'claude', 'discussion', { unit: UNIT, topic: 'note-window' }],
      [homed, 'claude', 'discussion', { unit: UNIT, topic: 'space-homing' }],
      [built, 'claude', 'implementation', { unit: UNIT, topic: null }],
    ]);

    assert.deepStrictEqual(calls('shown', 'note-window'), [noted]);
    assert.deepStrictEqual(calls('since'), [homed, built]);
    assert.deepStrictEqual(calls('shown'), [homed, built]);
    assert.deepStrictEqual(marks(), { shown: [full(noted), full(homed), full(built)] });
    assert.deepStrictEqual(calls('since'), []);
  });

  it('lists a later unit\'s call replacing a finished unit\'s decision in both units: on the later unit\'s map and in its record as the other place\'s current answer, a look there clearing it from both (5.8.19, 5.S39)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const decided = call(NOTE, 'A note is a panel.', 'person');
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);
    const sheet = writeIn(dir, 'replace', 'mint.discussion.mint', ['--replaces', decided, '--reason', 'changed-mind'], { ...MADE, drops: ['a panel'], text: 'A note is a sheet.', why: 'Mint draws sheets.' });
    const since = () => [callsOf(dir, 'since', UNIT), callsOf(dir, 'since', UNIT, 'note-window'), callsOf(dir, 'since', 'mint'), callsOf(dir, 'since', 'mint', 'mint')];
    assert.deepStrictEqual(since(), [[sheet], [sheet], [sheet], [sheet]]);

    const [row] = ok(dir, ['ledger', 'map', 'mint', 'mint']).questions;
    assert.deepStrictEqual([row.stands, row.stands_in, row.answers.map((/** @type {{id: string}} */ a) => a.id)], ['elsewhere', { unit: UNIT, topic: 'note-window' }, [sheet]]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', 'mint', 'mint']).other_topics.map((/** @type {{id: string}} */ e) => e.id), [sheet]);
    assert.deepStrictEqual(callsOf(dir, 'shown', 'mint', 'mint'), [sheet]);

    assert.deepStrictEqual(since(), [[], [], [], []]);
    assert.deepStrictEqual([callsOf(dir, 'shown', UNIT), marks()], [[], null]);
  });

  it('counts a look in a unit set aside since: the call it showed stays shown where it shows now (5.8.15)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const decided = call(NOTE, 'A note is a panel.', 'person');
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);
    const sheet = writeIn(dir, 'replace', 'mint.discussion.mint', ['--replaces', decided, '--reason', 'changed-mind'], { ...MADE, drops: ['a panel'], text: 'A note is a sheet.', why: 'Mint draws sheets.' });
    assert.deepStrictEqual(calls('shown', 'note-window'), [sheet]);

    ok(dir, ['workunit', 'reactivate', UNIT]);
    ok(dir, ['workunit', 'cancel', UNIT]);

    const rows = ok(dir, ['ledger', 'map', 'mint', 'mint']).questions;
    assert.deepStrictEqual(rows.map((/** @type {{id: string, stands: string}} */ r) => [r.id, r.stands]), [[sheet, 'question-set-aside']]);
    assert.deepStrictEqual([callsOf(dir, 'since', 'mint'), callsOf(dir, 'since', 'mint', 'mint')], [[], []]);
  });

  it('lists a call on the map of the question it answers, moved to another topic, as where it stands, a look at either clearing it from both (5.8.19)', () => {
    const question = writeIn(dir, 'ask', NOTE, [], { ...MADE, text: 'Which Space does a note open on?' });
    const answer = writeIn(dir, 'decide', NOTE, ['--answers', question], { ...MADE, text: 'The active Space.', why: 'Furniture.' });
    writeIn(dir, 'move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    assert.deepStrictEqual([calls('since', 'note-window'), calls('since', 'space-homing'), calls('since', 'menu-bar')], [[answer], [answer], []]);

    assert.deepStrictEqual(calls('shown', 'space-homing'), [answer]);

    assert.deepStrictEqual([calls('since', 'note-window'), calls('since')], [[], []]);
  });

  it('lists only a current call: one replaced leaves the list, Claude\'s replacement taking its place, and the person\'s replacement lists nothing', () => {
    const first = call(NOTE, 'A note is a panel.');
    const second = writeIn(dir, 'replace', NOTE, ['--replaces', first, '--reason', 'changed-mind'], { ...MADE, drops: ['a panel'], text: 'A frameless window.', why: 'Lighter.' });
    assert.deepStrictEqual(calls('since', 'note-window'), [second]);

    writeIn(dir, 'replace', NOTE, ['--replaces', second, '--reason', 'changed-mind'], { by: 'person', who_moved_whom: 'person-moved-claude', drops: ['a frameless window'], text: 'A sheet.', why: 'Mine.' });

    assert.deepStrictEqual(calls('since'), []);
  });

  it('keeps the mark on each machine, off the state branch: a look makes no commit, each clone counts from its own looks, and a call merged in from the other is new though it lands before one shown here (5.S33)', () => {
    const world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-since-machines-')));
    try {
      const bare = bareRepo(path.join(world, 'fumi.git'), ['--initial-branch=main']);
      git(dir, ['remote', 'add', 'origin', bare]);
      git(dir, ['push', '-q', 'origin', 'main']);
      stateGit(dir, ['add', '-A']);
      stateGit(dir, ['commit', '-q', '-m', 'state: the unit']);
      stateGit(dir, ['push', '-q', 'origin', 'leeway-state']);
      const first = call(NOTE, 'A note is a panel.');
      const second = call(NOTE, 'A note has no title bar.');
      const other = path.join(world, 'other-machine');
      git(world, ['clone', '-q', bare, other]);
      testIdentity(other);
      createStateBranchFromRemote(stateRoot(other));
      addStateWorktree(stateRoot(other));
      const branch = () => [stateGit(dir, ['rev-list', '--count', 'leeway-state']).trim(), git(bare, ['rev-parse', 'leeway-state']).trim()];
      const before = branch();

      assert.deepStrictEqual(calls('shown', 'note-window'), [first, second]);

      assert.deepStrictEqual(branch(), before, 'a look made a commit');
      assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--untracked-files=all']), '');
      assert.deepStrictEqual(marks(), { shown: [full(first), full(second)] });
      assert.deepStrictEqual([callsIn(other, 'since', 'note-window'), marks(other)], [[first, second], null]);
      assert.deepStrictEqual(callsIn(other, 'shown', 'note-window'), [first, second]);

      const third = call(NOTE, 'A note snaps to the grid.');
      git(other, ['config', 'remote.origin.pushurl', path.join(world, 'nowhere.git')]);
      const fourth = call(NOTE, 'A note fades when idle.', 'claude', other);
      git(other, ['config', '--unset', 'remote.origin.pushurl']);
      assert.deepStrictEqual(callsIn(other, 'shown', 'note-window'), [fourth]);
      catchUpState(stateRoot(other));
      const merged = ledgerIds(other);
      assert.ok(merged.indexOf(full(third, other)) < merged.indexOf(full(fourth, other)), 'the merge laid the call made here after the other\'s');

      assert.deepStrictEqual([calls('since', 'note-window'), callsIn(other, 'since', 'note-window')], [[third], [third]]);
      assert.deepStrictEqual(callsIn(other, 'shown', 'note-window'), [third]);
      assert.deepStrictEqual([calls('since', 'note-window'), callsIn(other, 'since', 'note-window')], [[third], []]);
    } finally {
      fs.rmSync(world, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('keeps the mark through the unit\'s cancel and reactivation, which clear its own cache', () => {
    const first = call(NOTE, 'A note is a panel.');
    assert.deepStrictEqual(calls('shown'), [first]);

    ok(dir, ['workunit', 'cancel', UNIT]);
    ok(dir, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual([marks(), calls('since')], [{ shown: [full(first)] }, []]);
  });

  it('adds to the mark under the mark\'s own lock: a look waits on a peer holding it and reads the mark only once it holds it, so the peer\'s look is never lost; a plain read never tries the lock', (t) => {
    const [noted, homed, barred] = TOPICS.map((topic) => call(`${UNIT}.discussion.${topic}`, `A call on ${topic}.`));
    const lock = holdLock(`${marksFile()}.lock`);
    let looking = false;
    /** @type {unknown[]} */
    const whileHeld = [];
    // Once the look has found the lock held and tried again, the peer shows
    // space-homing's call, as its own look would, and lets go.
    const attempts = lockAttempts(t, lock, (taken) => {
      assert.ok(looking, 'a plain read waited on the lock');
      whileHeld.push(marks());
      if (taken < 2) return;
      fs.writeFileSync(marksFile(), JSON.stringify({ shown: [full(homed)] }));
      fs.unlinkSync(lock);
    });

    assert.deepStrictEqual(calls('since'), [noted, homed, barred]);
    looking = true;
    assert.deepStrictEqual(calls('shown', 'note-window'), [noted]);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(whileHeld, [null, null], 'a look moved the mark while a peer held its lock');
    assert.deepStrictEqual(marks(), { shown: [full(homed), full(noted)] }, 'the peer\'s look was lost');
  });

  it('takes the mark\'s lock only once its fold is done: a look whose check waits on the writer lock for a landing to finish holds no mark lock meanwhile', (t) => {
    const [noted, sized] = ['A note is a panel.', 'A note keeps its size.'].map((text) => call(NOTE, text));
    const lines = fs.readFileSync(statePath(dir, '.ledger.jsonl'), 'utf8').split('\n');
    fs.writeFileSync(statePath(dir, '.ledger.jsonl'), [lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n'));
    const writer = holdLock(statePath(dir, '.lock'));
    /** @type {boolean[]} */
    const markLocked = [];
    // Once the look waits on the writer lock, the landing it waits on lands
    // the rewritten ledger and lets go.
    lockAttempts(t, writer, () => {
      markLocked.push(fs.existsSync(`${marksFile()}.lock`));
      stateGit(dir, ['commit', '-q', '-m', 'state: the landing moves the branch', '--', '.ledger.jsonl']);
      fs.unlinkSync(writer);
    });

    assert.deepStrictEqual(calls('shown', 'note-window'), [sized, noted]);

    assert.deepStrictEqual(markLocked, [false]);
  });

  it('refuses a read naming no unit, a topic the unit does not have, or a mark it cannot read, naming the mark', () => {
    assert.match(refuses(dir, ['ledger', 'since']).error, /^Usage: engine ledger since <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'shown', UNIT, 'dock']).error, /^ledger shown: fumi has no topic "dock"$/);
    const file = marksFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"shown":');
    assert.match(refuses(dir, ['ledger', 'since', UNIT]).error, new RegExp(`^the last-looked mark at ${file} is no JSON — `));
    for (const wrong of ['[]', '{"spec":null}', '{"shown":"Ab12"}', '{"shown":[12]}', '{"shown":["Ab12"]}', '{"shown":[],"spec":null}']) {
      fs.writeFileSync(file, wrong);
      assert.strictEqual(refuses(dir, ['ledger', 'shown', UNIT]).error, `the last-looked mark at ${file} is not {"shown": [<id>, …]}, the ids of the calls shown`, wrong);
    }
  });
});

describe('nothing on disk (4.11.9)', () => {
  it('leaves no record, map, product record, list of calls, list of what a replacement affects or verdict queue on the state branch or in the unit\'s folder, a look\'s mark in the cache alone (4.S24, 5.S18)', () => {
    const relied = call(NOTE, 'A note is a panel.');
    writeIn(dir, 'find', SPACE, ['--relies-on', relied], { ...MADE, text: 'A panel takes no focus.', how: 'a spike', product_wide: true });
    writeIn(dir, 'replace', NOTE, ['--replaces', relied, '--reason', 'changed-mind'], { by: 'person', who_moved_whom: 'person-moved-claude', drops: ['a panel'], text: 'A frameless window.', why: 'Lighter.' });
    call(SPACE, 'A note opens on the active Space.');
    stateGit(dir, ['add', '-A']);
    stateGit(dir, ['commit', '-q', '-m', 'state: the unit']);
    const tree = () => stateGit(dir, ['ls-tree', '-r', '--name-only', 'leeway-state']).trim().split('\n');
    const branch = tree();
    const head = stateGit(dir, ['rev-parse', 'leeway-state']);
    const onDisk = files(statePath(dir));

    const answers = [
      ok(dir, ['ledger', 'record', UNIT]).decisions, ok(dir, ['ledger', 'record', UNIT, 'note-window']).decisions,
      ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions, ok(dir, ['ledger', 'product']).findings,
      ok(dir, ['ledger', 'affected', UNIT]).affected, ok(dir, ['ledger', 'verdicts']).departures,
      ok(dir, ['ledger', 'since', UNIT]).calls, ok(dir, ['ledger', 'shown', UNIT]).calls,
    ];

    assert.ok(answers.every((answer) => answer.length > 0), 'a read answered nothing, so proves nothing');
    assert.deepStrictEqual(branch, ['.gitignore', '.ledger.jsonl', `${UNIT}/manifest.json`]);
    assert.deepStrictEqual([tree(), stateGit(dir, ['rev-parse', 'leeway-state'])], [branch, head], 'a read committed');
    assert.deepStrictEqual(files(statePath(dir)), [...onDisk, `.cache/.marks/${UNIT}.json`].sort());
    assert.deepStrictEqual(fs.readdirSync(statePath(dir, UNIT)), ['manifest.json']);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--untracked-files=all']), '');
  });
});
