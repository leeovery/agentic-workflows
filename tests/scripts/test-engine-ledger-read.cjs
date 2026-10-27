'use strict';

// ---------------------------------------------------------------------------
// The ledger's read verbs (workflow-engine/scripts/domain/ledger-read.cjs),
// the fold they read through (domain/ledger-fold.cjs) and the one liveness
// rule (domain/ledger-units.cjs): `engine ledger record|map|product`, each a
// projection of the ledger answered as JSON — a unit's or a topic's current
// entries, each with the answers it replaced folded beneath it and the
// confirmations that it still holds, its moves and merges, and the other
// topics' current entries it relies on read from their own lines; a
// topic's questions and where each stands; the entries marked
// product-wide. Siblings stand apart; a merged duplicate is no second
// entry; a cancelled topic or unit, or a postponed topic while it waits,
// holds nothing current until it comes back, and the write verbs decide by
// the same rule. A ledger past the 64 MiB a pipe holds is read without being
// held: each read answers under a heap a reader holding its lines cannot
// fit in.
//
// Real repositories in temp folders, each with its state worktree, the work
// units' manifests written there; the lifecycle verbs cancel, postpone and
// bring topics and units back.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ENGINE, ok, refuses, stateGit, statePath, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER, validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId, shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));

const UNIT = 'fumi';
const SESSION_ID = 'session-1';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
// Every field of an event that names an entry.
const LINKS = ['id', 'answers', 'part_of', 'relies_on', 'replaces', 'cause', 'question', 'into', 'duplicate', 'entry', 'after'];
// What a reader holding the ledger's lines would need many times over, and
// what the reads need with room to spare.
const HEAP_MB = 48;

/** A discovery map row a topic's cancel and postpone take. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

const PHASES = Object.freeze({
  discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-read-');
  createManifest(dir, UNIT, { work_type: 'epic', phases: PHASES });
});

afterEach(() => {
  cleanupFixture(dir);
});

/**
 * One ledger write that must succeed: its response.
 * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
 * @param {Record<string, string|undefined>} [env]
 */
function write(verb, address, flags, content, env = SESSION) {
  return ok(dir, ['ledger', verb, address, ...flags], { env, stdin: JSON.stringify(content) });
}

/** A question asked at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] */
function ask(address, text, flags = []) {
  return write('ask', address, flags, { ...MADE, text }).id;
}

/** A finding at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
function find(address, text, flags = [], content = {}) {
  return write('find', address, flags, { ...MADE, text, how: 'seen in a spike', ...content }).id;
}

/** A decision answering `question` at `address`: its short id. @param {string} address @param {string} question @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
function decide(address, question, text, flags = [], content = {}) {
  return write('decide', address, ['--answers', question, ...flags], { ...MADE, text, why: `Why: ${text}`, ...content }).id;
}

/** `old` replaced at `address`, a changed mind: the replacement's short id. @param {string} address @param {string} old @param {string} text */
function change(address, old, text) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], text, why: `Why: ${text}` }).id;
}

/** @param {string[]} args */
function read(...args) {
  return ok(dir, ['ledger', ...args]);
}

/** The ledger's lines, as written. */
function rawLines() {
  const file = statePath(dir, LEDGER);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').slice(0, -1) : [];
}

/** The ledger's events. @returns {Record<string, any>[]} */
function events() {
  return rawLines().map((line) => JSON.parse(line));
}

/** The full id a short id shows. @param {string} short */
function full(short) {
  const ids = events().map((e) => e.id).filter((id) => id.startsWith(short));
  assert.strictEqual(ids.length, 1, `${short} names ${ids.length} ids`);
  return ids[0];
}

/**
 * The entry `short` names as a read must show it: its line as written but
 * its version, every id in it in the short form the ledger gives it now.
 * @param {string} short @returns {Record<string, unknown>}
 */
function line(short) {
  const all = events();
  const shorts = shortIds(all.map((e) => e.id));
  const { v, ...event } = /** @type {Record<string, any>} */ (all.find((e) => e.id === full(short)));
  assert.strictEqual(v, 1);
  for (const field of LINKS) {
    if (Array.isArray(event[field])) event[field] = event[field].map((/** @type {string} */ id) => shorts.get(id));
    else if (typeof event[field] === 'string') event[field] = shorts.get(event[field]);
  }
  return event;
}

/** An entry as a record shows it on its own or in a chain: its line, and the confirmations that it holds. @param {string} short @param {string[]} [holds] */
function held(short, holds = []) {
  return { ...line(short), holds: holds.map(line) };
}

/** A current entry as a record shows it: its line, its confirmations, and the entries it replaced beneath it. @param {string} short @param {string[]} replaced @param {string[]} [holds] */
function current(short, replaced = [], holds = []) {
  return { ...held(short, holds), replaced: replaced.map((old) => held(old)) };
}

/** @param {{id: string}[]} shown */
function ids(shown) {
  return shown.map((entry) => entry.id);
}

describe('a record (5.6.5, 5.8.4)', () => {
  it('shows a decision replaced through `ledger replace` with "a changed mind" by the replacement, the decision folded beneath it, its line byte for byte unchanged (2.S11, 5.S8)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A near-frameless floating note.');
    const before = rawLines();

    const replacement = change(NOTE, old, 'A frameless surface.');

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the replacement edited a line before it');
    assert.deepStrictEqual([events().at(-1).event, events().at(-1).replaces, events().at(-1).reason], ['replaced', full(old), 'changed-mind']);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record, {
      ok: true, unit: UNIT, topic: 'note-window', live: true,
      questions: [current(question)], findings: [], decisions: [current(replacement, [old])], moved: [], merged: [], other_topics: [],
    });
  });

  it('shows a chain three deep with the current answer first and the answers it replaced beneath it, newest first and oldest last', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const first = decide(NOTE, question, 'A window.');
    const second = change(NOTE, first, 'A panel.');
    const third = change(NOTE, second, 'A frameless surface.');

    const { decisions } = read('record', UNIT, 'note-window');

    assert.deepStrictEqual(decisions, [current(third, [second, first])]);
    assert.deepStrictEqual([decisions[0].text, ...decisions[0].replaced.map((/** @type {{text: string}} */ e) => e.text)], ['A frameless surface.', 'A panel.', 'A window.']);
  });

  it('keeps siblings apart (5.3.13): one answer replaced leaves the other current, and the question\'s current answer is the untouched sibling and the replacement', () => {
    const question = ask(NOTE, 'How does a note look?');
    const frame = decide(NOTE, question, 'Near-frameless.');
    const hover = decide(NOTE, question, 'Its controls appear on hover.');

    const reframed = change(NOTE, frame, 'Frameless.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(hover), current(reframed, [frame])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([rowShown.stands, rowShown.answers.map((/** @type {{id: string}} */ a) => a.id)], ['answered', [hover, reframed]]);
  });

  it('shows each confirmation that an entry still holds beneath the entry it confirms (5.6.5)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const relying = find(NOTE, 'A window takes focus.', ['--relies-on', old]);
    const replacement = change(NOTE, old, 'A panel.');

    const confirmed = write('hold', NOTE, ['--entry', relying, '--after', replacement], MADE).id;

    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);
    assert.strictEqual(line(confirmed).after, replacement);
  });

  it('shows another topic\'s current answer it relies on from that topic\'s own entry, and the new one once it is replaced (5.S20)', () => {
    const theirs = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person.');
    const ours = decide(NOTE, ask(NOTE, 'Does a note float?'), 'Notes float above every Space.', ['--relies-on', theirs]);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').other_topics, [{ ...line(theirs), named: [theirs] }]);

    const replaced = change(SPACE, theirs, 'A note follows the person, on every display.');

    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record.other_topics, [{ ...line(replaced), named: [theirs] }]);
    assert.deepStrictEqual(record.decisions, [current(ours)], 'the record restated the other topic\'s answer');
  });

  it('shows a question moved to another topic in the old topic\'s record and on the new topic\'s map (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    assert.deepStrictEqual([events().at(-1).event, events().at(-1).question, events().at(-1).to], ['moved', full(question), 'space-homing']);
    const old = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([old.moved, old.questions], [[{ ...line(moved), text: 'Which Space does a new note open on?' }], []]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(question)]);
    const [movedIn] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([movedIn.id, movedIn.stands, movedIn.moved_from], [question, 'open', 'note-window']);
    const [movedAway] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([movedAway.id, movedAway.stands, movedAway.moved_to], [question, 'moved-away', 'space-homing']);
  });

  it('reads a unit\'s every current entry, its topics\' and those made at its level, the replaced ones only beneath what replaced them', () => {
    const asked = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, asked, 'A window.');
    const replacement = change(NOTE, old, 'A panel.');
    const elsewhere = ask(SPACE, 'Where does a note open?');
    const unitLevel = ask(`${UNIT}.specification`, 'Does the spec cover a second display?');

    const record = read('record', UNIT);

    assert.deepStrictEqual([record.topic, record.live, ids(record.questions), record.decisions], [null, true, [asked, elsewhere, unitLevel], [current(replacement, [old])]]);
    assert.deepStrictEqual(record.questions.map((/** @type {{topic: string|null}} */ q) => q.topic), ['note-window', 'space-homing', null]);
  });

  it('tags an entry with the unit whose session wrote it, and a session in a later unit reads that unit\'s entries directly (5.S28)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A panel.', why: 'It floats.' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    assert.deepStrictEqual(events().map((e) => [e.unit, e.session]), [[UNIT, 'fumi-session'], [UNIT, 'fumi-session']]);

    write('ask', 'mint.discussion.mint', [], { ...MADE, text: 'Does Mint import Fumi\'s notes?' }, { CLAUDE_CODE_SESSION_ID: 'mint-session' });
    const fromMint = ok(dir, ['ledger', 'record', UNIT], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } });

    assert.deepStrictEqual([ids(fromMint.questions), fromMint.decisions], [[question], [current(decided)]]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } }).decisions, [current(decided)]);
  });

  it('leaves both replacements of one entry current where two clones each replaced it, each with the entry beneath it', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const here = change(NOTE, old, 'A panel.');
    const fields = /** @type {Record<string, any>} */ (events().find((e) => e.id === full(here)));
    const { v: _v, id: _id, at: _at, ...replacement } = fields;
    const there = /** @type {string} */ (appendEntry(statePath(dir), { ...replacement, session: 'other-clone', text: 'A sheet.' }, []).id).slice(0, 6);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(here, [old]), current(there, [old])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [here, there]);
    const refusal = refuses(dir, ['ledger', 'replace', NOTE, '--replaces', old, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${old}, which ${here} replaced — the current ones are ${here}, ${there}$`));
  });
});

describe('a topic\'s map (5.8.5)', () => {
  it('shows each question with where it stands, who asked it, and its current answers with whose they are', () => {
    const open = ask(NOTE, 'Does a note snap to the grid?');
    const answered = write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Is a note a window?' }).id;
    const answer = decide(NOTE, answered, 'A panel.', [], { by: 'person' });

    const map = read('map', UNIT, 'note-window');

    assert.deepStrictEqual(map.questions, [
      { id: open, text: 'Does a note snap to the grid?', by: 'claude', at: line(open).at, stands: 'open', moved_from: null, moved_to: null, part_of: null, parts: [], answers: [] },
      {
        id: answered, text: 'Is a note a window?', by: 'person', at: line(answered).at, stands: 'answered', moved_from: null, moved_to: null, part_of: null, parts: [],
        answers: [{ id: answer, unit: UNIT, topic: 'note-window', by: 'person', text: 'A panel.' }],
      },
    ]);
    assert.deepStrictEqual([map.unit, map.topic, map.live], [UNIT, 'note-window', true]);
  });

  it('puts the unsettled part of a question an answer settles in part on the map as its own question, linked to the first (5.S15)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    decide(NOTE, whole, 'It looks frameless.');

    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.part_of, r.parts]), [
      [whole, 'answered', null, [part]],
      [part, 'open', whole, []],
    ]);
  });

  it('keeps one entry, the owner\'s, unchanged, where another topic reaches the same decision, and shows that topic\'s question answered by it (5.S17)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const before = rawLines();

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners], MADE).id;

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the merge edited a line before it');
    assert.deepStrictEqual(events().filter((e) => e.event === 'decided' || e.event === 'replaced').map((e) => e.id), [full(owners)], 'the ledger holds a second decision');
    const [rowShown] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([rowShown.id, rowShown.stands, rowShown.answers], [reached, 'merged', [{ id: owners, unit: UNIT, topic: 'note-window', by: 'claude', text: 'Notes float above every Space.' }]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[], [line(merged)], [{ ...line(owners), named: [owners] }]]);
  });

  it('takes a duplicate merged where it is found out of the current entries, so its question stands answered by the owner\'s entry alone, and no write names it as current (5.5.4, 5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').decisions, []);
    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [owners]);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', duplicate, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${duplicate}, which ${merged} merged as a duplicate — the current one is ${owners}$`));
  });

  it('follows the entry a question was merged into down its chain to the current one', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const replaced = change(NOTE, owners, 'Notes float above every Space and display.');

    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [replaced]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replaced), named: [owners] }]);
  });
});

describe('the product record (5.8.6)', () => {
  it('holds every current entry marked product-wide, from every unit and topic, each with the answers it replaced beneath it', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const finding = find(NOTE, 'Notes sync through iCloud.', [], { product_wide: true });
    find(NOTE, 'A spike floated a panel.');
    const old = decide(SPACE, ask(SPACE, 'Is Fumi a menu-bar app?'), 'Fumi lives in the menu bar.', [], { product_wide: true });
    const replaced = change(SPACE, old, 'Fumi lives in the menu bar and the dock.');
    const minted = decide('mint.discussion.mint', ask('mint.discussion.mint', 'Is Mint free?'), 'Mint is free.', [], { product_wide: true });

    const product = read('product');

    assert.deepStrictEqual(product, { ok: true, findings: [current(finding)], decisions: [current(replaced, [old]), current(minted)] });
    assert.strictEqual(line(replaced).product_wide, true, 'the replacement did not keep the mark');
  });
});

describe('liveness (5.8.17)', () => {
  /**
   * A topic's entries and another topic's relying on them, and every read
   * that shows them.
   */
  function relyingTopics() {
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const relying = decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.', ['--relies-on', decided]);
    return { decided, relying };
  }

  /** Every read over the unit. */
  function reads() {
    return {
      note: read('record', UNIT, 'note-window'),
      map: read('map', UNIT, 'note-window'),
      space: read('record', UNIT, 'space-homing'),
      unit: read('record', UNIT),
      product: read('product'),
    };
  }

  /**
   * Assert the note window's entries are not current: off its record and
   * its map, off the unit's record and the product record, off the record
   * relying on them, and refused where a write needs a current entry, the
   * ledger keeping every line.
   * @param {string} decided @param {RegExp} reason @param {{note: boolean, unit: boolean}} live
   */
  function assertSetAside(decided, reason, live) {
    const lines = rawLines();
    const now = reads();
    const empty = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
    assert.deepStrictEqual(now.note, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, ...empty });
    assert.deepStrictEqual(now.map, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, questions: [] });
    assert.deepStrictEqual(now.product.decisions, []);
    assert.deepStrictEqual(now.space.other_topics, []);
    assert.strictEqual(now.unit.live, live.unit);
    assert.ok(!JSON.stringify(now.unit).includes(`"id":"${decided}"`), 'the unit\'s record shows an entry that is not current');
    const refusal = refuses(dir, ['ledger', 'hold', SPACE, '--entry', decided, '--after', decided], { env: SESSION, stdin: JSON.stringify(MADE) });
    assert.match(refusal.error, reason);
    assert.deepStrictEqual(rawLines(), lines, 'the ledger did not keep its lines');
  }

  it('takes a cancelled topic\'s entries out of every read until the topic is reactivated, the ledger holding them throughout', () => {
    const { decided } = relyingTopics();
    const before = reads();

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assertSetAside(decided, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is cancelled$`), { note: false, unit: true });

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a postponed topic\'s entries out of every read while it waits, and back once it is pulled back into its own epic', () => {
    const { decided } = relyingTopics();
    const before = reads();

    ok(dir, ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    assertSetAside(decided, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is postponed$`), { note: false, unit: true });

    ok(dir, ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a cancelled unit\'s entries out of every read, another unit\'s included, until the unit is reactivated', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const { decided } = relyingTopics();
    decide('mint.discussion.mint', ask('mint.discussion.mint', 'Does Mint float its notes too?'), 'Yes, as Fumi does.', ['--relies-on', decided]);
    const before = { ...reads(), mint: read('record', 'mint') };

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(read('record', 'mint').other_topics, []);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').decisions, []);
    assertSetAside(decided, new RegExp(`^ledger hold --entry names ${decided}, which is not current: ${UNIT} is cancelled$`), { note: false, unit: false });

    ok(dir, ['workunit', 'reactivate', UNIT]);
    assert.deepStrictEqual({ ...reads(), mint: read('record', 'mint') }, before);
  });
});

describe('a large ledger (5.7.6, 5.7.8)', () => {
  /**
   * `args` run by the engine in a process of its own, its heap held to
   * `HEAP_MB`: what it answered, or how it died.
   * @param {string[]} args
   */
  function underHeap(args) {
    const res = spawnSync(process.execPath, [`--max-old-space-size=${HEAP_MB}`, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 24 });
    return { status: res.status, signal: res.signal, out: res.status === 0 ? JSON.parse(res.stdout) : null, err: res.stderr.slice(0, 400) };
  }

  it('reads a ledger past the 64 MiB a pipe holds without holding it: each read answers under a heap that a reader holding its lines cannot fit in', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.', [], { product_wide: true });
    const file = statePath(dir, LEDGER);
    const fd = fs.openSync(file, 'a');
    let size = fs.statSync(file).size;
    try {
      while (size <= READ_BUDGET_BYTES) {
        const bulk = `${JSON.stringify(validEvent({
          v: 1, id: newId(), event: 'found', unit: UNIT, topic: 'space-homing', phase: 'discussion', session: SESSION_ID, at: '2026-10-27T09:00:00Z',
          ...MADE, text: 'x'.repeat(2000), how: 'measured', relies_on: [], product_wide: false,
        }))}\n`;
        fs.writeSync(fd, bulk);
        size += Buffer.byteLength(bulk);
      }
    } finally {
      fs.closeSync(fd);
    }
    stateGit(dir, ['add', LEDGER]);
    stateGit(dir, ['commit', '-q', '-m', 'state: a long ledger']);

    const record = underHeap([ENGINE, 'ledger', 'record', UNIT, 'note-window']);
    const map = underHeap([ENGINE, 'ledger', 'map', UNIT, 'note-window']);
    const product = underHeap([ENGINE, 'ledger', 'product']);

    for (const [name, res] of Object.entries({ record, map, product })) assert.strictEqual(res.status, 0, `${name} did not answer under ${HEAP_MB} MB: ${res.signal} ${res.err}`);
    assert.deepStrictEqual([ids(record.out.questions), ids(record.out.decisions)], [[question], [decided]]);
    assert.deepStrictEqual(ids(map.out.questions), [question]);
    assert.deepStrictEqual([ids(product.out.decisions), product.out.findings], [[decided], []]);
    const holding = underHeap(['-e', `const lines = []; for (const l of require('fs').readFileSync(${JSON.stringify(file)}, 'utf8').split('\\n')) lines.push(l); console.log('{}')`]);
    assert.notStrictEqual(holding.status, 0, `a reader holding the ledger's lines fit in ${HEAP_MB} MB, so the heap proves nothing`);
  });
});

describe('refusals', () => {
  it('refuses a read naming no unit, a unit there is none of, a topic the unit does not have, or anything but its places', () => {
    assert.match(refuses(dir, ['ledger', 'record']).error, /^Usage: engine ledger record <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT]).error, /^Usage: engine ledger map <work-unit> <topic>$/);
    assert.match(refuses(dir, ['ledger', 'product', UNIT]).error, /^Usage: engine ledger product$/);
    assert.match(refuses(dir, ['ledger', 'record', UNIT, '--topic', 'note-window']).error, /^Usage: engine ledger record /);
    assert.match(refuses(dir, ['ledger', 'record', 'mint']).error, /^ledger record: there is no work unit "mint"$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT, 'menu-bar']).error, /^ledger map: fumi has no topic "menu-bar"$/);
  });

  it('answers a ledger with no entries yet with nothing current', () => {
    assert.deepStrictEqual(read('record', UNIT, 'note-window'), {
      ok: true, unit: UNIT, topic: 'note-window', live: true, questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [],
    });
    assert.deepStrictEqual(read('product'), { ok: true, findings: [], decisions: [] });
  });
});
