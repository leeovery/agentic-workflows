'use strict';

// ---------------------------------------------------------------------------
// The ledger's read verbs (workflow-engine/scripts/domain/ledger-read.cjs),
// the fold they read through (domain/ledger-fold.cjs) and the one liveness
// rule (domain/ledger-units.cjs): `engine ledger record|map|product`, each a
// projection of the ledger answered as JSON — the current entries standing
// in a unit or a topic, each where the earliest entry of its chain in a
// live place was made, with the live answers it replaced folded beneath it
// and the confirmations that it still holds, its moves as history, its
// merges each with its duplicate and whether it holds, and the current
// entries standing elsewhere that it relies on, that a merge that holds
// went into, or that answer its questions, read from their own lines; a
// topic's questions, where each stands now and its answers, which its
// record shows too, a question moved in or away shown by a live move the
// map's own unit made alone; the entries marked product-wide. Siblings
// stand apart; a reworded question keeps its answers and its parts; a
// merged duplicate is no second entry; a finished unit stays finished when
// a later one replaces its decision; a cancelled topic or unit, or a
// postponed topic while it waits, holds nothing current until it comes
// back — and a replacement, a merge or a confirmation made there counts
// for nothing meanwhile, while a question moved away stays where it was
// moved, and another unit's replacement of an entry there stands where it
// was made — and the write verbs decide by the same rule; of merges
// crossing each other, the later holds, whichever entry is read first. A ledger past the 64 MiB a pipe holds is read
// without being held: each read answers under a heap a reader holding its
// lines cannot fit in.
//
// Real repositories in temp folders, each with its state worktree, the work
// units' manifests written there; the lifecycle verbs cancel, postpone and
// bring topics and units back.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const it = require('./shards.cjs').shardedIt(__filename);

const { ENGINE, ok, refuses, stateGit, statePath, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER, validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId, shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { ID_FACTS, foldLedger, isCurrent, currentsOf, mergeHolds } = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { liveness } = require(path.join(SCRIPTS, 'domain/ledger-units.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));

const UNIT = 'fumi';
const SESSION_ID = 'session-1';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const MENU = `${UNIT}.discussion.menu-bar`;
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

/**
 * A merge as a record shows it: its line, the duplicate it named while that
 * is live, and whether it holds.
 * @param {string} short @param {string|null} duplicate @param {boolean} holds
 */
function shownMerge(short, duplicate, holds) {
  return { ...line(short), duplicate_entry: duplicate === null ? null : line(duplicate), holds };
}

/** @param {{id: string}[]} shown */
function ids(shown) {
  return shown.map((entry) => entry.id);
}

/** A topic's map, each row its question, where it stands, and its answers' ids. @param {string} topic */
function answered(topic) {
  return read('map', UNIT, topic).questions.map((/** @type {{id: string, stands: string, answers: {id: string}[]}} */ r) => [r.id, r.stands, ids(r.answers)]);
}

/**
 * Assert a topic's map and its record agree: the record shows each question
 * standing on the map, and every answer the map shows it, among its own
 * decisions or from where it stands, tied to the question it answers.
 * @param {string} topic
 */
function assertAgree(topic) {
  const record = read('record', UNIT, topic);
  const rows = read('map', UNIT, topic).questions.filter((/** @type {{stands: string}} */ r) => r.stands !== 'moved-away');
  assert.deepStrictEqual(ids(rows), ids(record.questions), `${topic}'s map and record show different questions`);
  for (const row of rows) {
    for (const { id } of row.answers) {
      const elsewhere = record.other_topics.find((/** @type {{id: string}} */ o) => o.id === id);
      assert.ok(ids(record.decisions).includes(id) || elsewhere?.named.includes(row.id), `${topic}'s record does not show ${id}, which its map shows answering ${row.id}`);
    }
  }
}

/** `old` replaced from the spec, at the unit's level, a changed mind: the replacement's short id. @param {string} old @param {Record<string, unknown>} content */
function changeFromSpec(old, content) {
  return write('replace', `${UNIT}.specification`, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], ...content }).id;
}

/** `question` reworded at `address`: the new wording's short id. @param {string} address @param {string} question @param {string} text */
function reword(address, question, text) {
  return write('replace', address, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], text }).id;
}

/** A third topic on the unit, the menu bar. */
function menuBar() {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { ...PHASES.discovery.items, 'menu-bar': row(3, 'The menu bar') } },
      discussion: { items: { ...PHASES.discussion.items, 'menu-bar': { status: 'in-progress' } } },
    },
  });
}

/** A second unit on the project, mint, a feature discussing itself. */
function mint() {
  createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
}

/** A second epic on the project, dock, discussing a topic named as one of fumi's is, space homing, and its badge. */
function dock() {
  createManifest(dir, 'dock', {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'space-homing': row(1, 'Where the dock homes notes'), badge: row(2, 'The badge') } },
      discussion: { items: { 'space-homing': { status: 'in-progress' }, badge: { status: 'in-progress' } } },
    },
  });
}

/** Each row of a topic's map: its question, where it stands, and the topics it moved in from and away to. @param {string} unit @param {string} topic */
function moves(unit, topic) {
  return read('map', unit, topic).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.moved_from, r.moved_to]);
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
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[], [shownMerge(merged, null, true)], [{ ...line(owners), named: [reached, owners] }]]);
    assertAgree('space-homing');
  });

  it('takes a duplicate merged where it is found out of the current entries, so its question stands answered by the owner\'s entry alone, and no write names it as current (5.5.4, 5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;

    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged], [[], [shownMerge(merged, duplicate, true)]], 'the merge does not show the duplicate it set aside');
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
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replaced), named: [reached, owners] }]);
  });

  it('keeps a reworded question\'s answers: a decision naming any earlier wording answers the current one, beside one naming it (5.3.13)', () => {
    const first = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, first, 'A panel.', [], { product_wide: true });

    const reworded = reword(NOTE, first, 'Is a note a window or a panel?');

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided]]]);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.decisions], [[current(reworded, [first])], [current(decided)]]);
    assert.deepStrictEqual(read('product').decisions, [current(decided)]);
    const later = decide(NOTE, reworded, 'A panel, on every display.');
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided, later]]]);
    assertAgree('note-window');
  });

  it('keeps a reworded question merged: it stands answered by the entry an earlier wording was merged into (5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const reworded = reword(SPACE, reached, 'Does a note stay on the Space it opened on?');

    assert.deepStrictEqual(answered('space-homing'), [[reworded, 'merged', [owners]]]);
    assertAgree('space-homing');
  });

  it('lists a reworded question\'s parts, each shown part of the question\'s current wording (5.3.11)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const reworded = reword(NOTE, whole, 'How does a note look, behave and sound?');
    const later = ask(NOTE, 'How does a note sound?', ['--part-of', reworded]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.part_of, r.parts]), [
      [part, reworded, []],
      [reworded, null, [part, later]],
      [later, reworded, []],
    ]);
  });
});

describe('where an entry stands (5.3.3, 5.8.4)', () => {
  it('keeps a decision replaced from the spec on its topic\'s record and map, the replacement current with the decision beneath it, and once on the unit\'s record', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = changeFromSpec(decided, { text: 'A sheet.', why: 'Sheets stack.' });

    assert.strictEqual(line(replacement).topic, null);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rowShown.answers, [{ id: replacement, unit: UNIT, topic: null, by: 'claude', text: 'A sheet.' }]);
    assert.deepStrictEqual(read('record', UNIT).decisions, [current(replacement, [decided])]);
    assertAgree('note-window');
  });

  it('keeps another unit\'s replacement of a topic\'s decision on that topic\'s record and map, where its chain stands, and off the replacing unit\'s record (5.6.1)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = change('mint.discussion.mint', decided, 'A sheet.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers, [{ id: replacement, unit: 'mint', topic: 'mint', by: 'claude', text: 'A sheet.' }]);
    assert.deepStrictEqual(read('record', 'mint').decisions, []);
    assertAgree('note-window');
  });

  it('leaves a finished unit finished when a later unit replaces its decision: its entries stay current until replaced, and its record shows the new answer with the old beneath it (5.S10)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', decided]);
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);
    const finished = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([finished.questions, finished.findings, finished.decisions], [[current(question)], [current(relying)], [current(decided)]]);

    const minted = change('mint.discussion.mint', decided, 'A sheet.');

    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, UNIT, 'manifest.json'), 'utf8')).status, 'completed', 'the replacement reopened the finished unit');
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.findings, record.decisions], [[current(question)], [current(relying)], [current(minted, [decided])]]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [minted]]]);
    assertAgree('note-window');
  });

  it('keeps a question reworded from the spec on its topic\'s map and record, the old wording beneath it', () => {
    const first = ask(NOTE, 'Is a note a window?');

    const reworded = changeFromSpec(first, { text: 'Is a note a window or a panel?' });

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'open', []]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(ids(read('record', UNIT).questions), [reworded]);
  });

  it('shows a question moved after it was answered with its answer on the topic it moved to, read from the answer\'s own line where it was given (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const decided = decide(NOTE, question, 'The active one.');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    const there = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([there.questions, there.decisions, there.other_topics], [[current(question)], [], [{ ...line(decided), named: [question] }]]);
    assert.deepStrictEqual(answered('space-homing'), [[question, 'answered', [decided]]]);
    const here = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([here.questions, here.decisions, ids(here.moved)], [[], [current(decided)], [moved]]);
    assertAgree('space-homing');
    assertAgree('note-window');
  });

  it('moves a reworded question whole: its every wording stands where it moved, and the old topic\'s map shows it moved away', () => {
    const first = ask(NOTE, 'Which Space does a new note open on?');
    const reworded = reword(NOTE, first, 'Which Space, on which display, does a new note open on?');

    write('move', NOTE, ['--question', reworded, '--to', 'space-homing'], MADE);

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, []);
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'moved-away', []]]);
  });

  it('leads a question moved away to its current wording and the topic it stands on now, however often it moved on', () => {
    menuBar();
    const first = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', first, '--to', 'space-homing'], MADE);
    const reworded = reword(SPACE, first, 'Which Space, on which display, does a new note open on?');

    write('move', SPACE, ['--question', reworded, '--to', 'menu-bar'], MADE);

    const away = (/** @type {string} */ topic) => read('map', UNIT, topic).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.moved_to]);
    assert.deepStrictEqual([away('note-window'), away('space-homing')], [[[reworded, 'moved-away', 'menu-bar']], [[reworded, 'moved-away', 'menu-bar']]]);
    assert.deepStrictEqual(answered('menu-bar'), [[reworded, 'open', []]]);
  });
});

describe('a question moved, as its map shows it now (5.3.3, 5.8.5)', () => {
  it('shows no move another unit made: a question one unit moved and another reworded stands, while the first is cancelled, where the rewording was made, moved from nowhere', () => {
    mint();
    const question = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    const reworded = reword('mint.discussion.mint', question, 'Which Space, on which display, does a new note open on?');
    assert.deepStrictEqual([moves(UNIT, 'note-window'), moves(UNIT, 'space-homing'), moves('mint', 'mint')], [
      [[reworded, 'moved-away', null, 'space-homing']], [[reworded, 'open', 'note-window', null]], [],
    ]);

    ok(dir, ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual(moves('mint', 'mint'), [[reworded, 'open', null, null]]);
  });

  it('leads a question moved away only to a topic of the unit it stands in: another unit\'s move, made while the question stood there, shows on no map once it stands where it was asked again — the first unit\'s topic of the same name\'s included — and on its record as history', () => {
    dock();
    const question = ask(NOTE, 'Does a note show on the dock?');
    const reworded = reword('dock.discussion.space-homing', question, 'Does a note badge the dock icon?');
    ok(dir, ['workunit', 'cancel', UNIT]);
    const moved = write('move', 'dock.discussion.space-homing', ['--question', reworded, '--to', 'badge'], MADE).id;
    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge')], [[[reworded, 'moved-away', null, 'badge']], [[reworded, 'open', 'space-homing', null]]]);

    ok(dir, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge'), moves(UNIT, 'note-window'), moves(UNIT, 'space-homing')], [[], [], [[reworded, 'open', null, null]], []]);
    assert.deepStrictEqual(read('record', 'dock', 'space-homing').moved, [{ ...line(moved), text: 'Does a note badge the dock icon?' }]);
  });

  it('shows no row for a question moved to a topic set aside, the topic it moved from keeping the move on its record as history alone, until the topic it moved to is reactivated', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);

    assert.deepStrictEqual(moves(UNIT, 'note-window'), []);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').moved, [{ ...line(moved), text: 'Which Space does a new note open on?' }]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(moves(UNIT, 'note-window'), [[question, 'moved-away', null, 'space-homing']]);
  });

  it('places a question where the last move its unit made of it took it, a move outliving the topic it was made from: it stands there, set aside with that topic alone, and names where it moved from while that is live', () => {
    menuBar();
    const once = ask(NOTE, 'Does a note snap to the grid?');
    write('move', NOTE, ['--question', once, '--to', 'space-homing'], MADE);
    const twice = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', twice, '--to', 'space-homing'], MADE);
    write('move', SPACE, ['--question', twice, '--to', 'menu-bar'], MADE);
    const maps = () => ['note-window', 'space-homing', 'menu-bar'].map((topic) => moves(UNIT, topic));
    assert.deepStrictEqual(maps(), [
      [[once, 'moved-away', null, 'space-homing'], [twice, 'moved-away', null, 'menu-bar']],
      [[once, 'open', 'note-window', null], [twice, 'moved-away', null, 'menu-bar']],
      [[twice, 'open', 'space-homing', null]],
    ]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(maps(), [[], [[once, 'open', null, null], [twice, 'moved-away', null, 'menu-bar']], [[twice, 'open', 'space-homing', null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(maps(), [[[twice, 'moved-away', null, 'menu-bar']], [], [[twice, 'open', null, null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    assert.deepStrictEqual(maps(), [[[once, 'moved-away', null, 'space-homing']], [[once, 'open', 'note-window', null]], []]);
  });
});

describe('merges crossing each other (5.5.5)', () => {
  /**
   * Two questions on two topics, each answered there, the first moved to the
   * menu bar and merged into the second's answer, its own answer the
   * duplicate; the menu bar cancelled, so the second is merged the other way
   * while the first merge is set aside; the menu bar reactivated.
   */
  function crossed() {
    menuBar();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    write('move', NOTE, ['--question', first, '--to', 'menu-bar'], MADE);
    const earlier = write('merge', MENU, ['--question', first, '--into', stays, '--duplicate', floats], MADE).id;
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    const later = write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE).id;
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'menu-bar']);
    return { first, floats, second, stays, earlier, later };
  }

  it('lets the later merge hold and the earlier not, so the decision the later went into stays current, through a reactivate of the earlier', () => {
    const { first, floats, second, stays, earlier, later } = crossed();

    assert.deepStrictEqual([answered('menu-bar'), answered('space-homing')], [[[first, 'answered', [floats]]], [[second, 'merged', [floats]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(floats)]);
    const space = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([space.decisions, space.merged, space.other_topics], [[], [shownMerge(later, stays, true)], [{ ...line(floats), named: [second, floats] }]]);
    const menu = read('record', UNIT, 'menu-bar');
    assert.deepStrictEqual([menu.merged, menu.other_topics], [[shownMerge(earlier, floats, false)], [{ ...line(floats), named: [first] }]],
      'the record tied the entry a merge that does not hold went into');
    for (const topic of ['note-window', 'space-homing', 'menu-bar']) assertAgree(topic);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', stays, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${stays}, which ${later} merged as a duplicate — the current one is ${floats}$`));
    change(NOTE, floats, 'Notes float above every Space and display.');
  });

  it('works out which merge holds the same whichever entry or merge is read first', () => {
    const { floats, stays, earlier, later } = crossed();
    const facts = foldLedger(statePath(dir), ID_FACTS, []);
    const asked = [floats, stays, earlier, later].map(full);
    /** Each asked id's answers from a fresh read, the ids asked in `order`. @param {string[]} order */
    const readIn = (order) => {
      const folded = { facts, live: liveness(statePath(dir)) };
      const answers = new Map(order.map((id) => [id, [isCurrent(folded, id), currentsOf(folded, id), mergeHolds(folded, id)]]));
      return asked.map((id) => answers.get(id));
    };

    const forwards = readIn(asked);
    assert.deepStrictEqual(readIn([...asked].reverse()), forwards);
    assert.deepStrictEqual(readIn([asked[3], asked[1], asked[0], asked[2]]), forwards);
    assert.deepStrictEqual(forwards.map(([current_, currents, holds]) => [current_, currents, holds]), [
      [true, [full(floats)], false], [false, [full(floats)], false], [false, [], false], [false, [], true],
    ]);
  });

  it('takes a later merge whose entry leads on only through an earlier merge once the earlier is taken', () => {
    menuBar();
    const settled = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, settled, 'Notes float above every Space.');
    write('move', NOTE, ['--question', settled, '--to', 'menu-bar'], MADE);
    const owners = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person, floating.');
    const reached = ask(MENU, 'Does a note stay on its Space?');
    const stays = decide(MENU, reached, 'Notes float, and never stay.');
    write('merge', MENU, ['--question', settled, '--into', owners, '--duplicate', floats], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    write('merge', MENU, ['--question', reached, '--into', floats, '--duplicate', stays], MADE);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    assert.deepStrictEqual(answered('menu-bar'), [[settled, 'merged', [owners]], [reached, 'merged', [owners]]]);
    assert.deepStrictEqual(read('record', UNIT, 'menu-bar').decisions, []);
    assertAgree('menu-bar');
  });

  it('lets the later merge hold where the earlier set aside another unit\'s replacement, that unit cancelled while the later was made and reactivated since', () => {
    mint();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float.');
    const minted = change('mint.discussion.mint', floats, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    const earlier = write('merge', NOTE, ['--question', first, '--into', stays, '--duplicate', minted], MADE).id;
    ok(dir, ['workunit', 'cancel', 'mint']);
    write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').merged, [shownMerge(earlier, null, true)], 'a merge showed a duplicate that is not live');

    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual([answered('note-window'), answered('space-homing')], [[[first, 'answered', [minted]]], [[second, 'merged', [minted]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(minted, [floats])]);
    assertAgree('note-window');
    assertAgree('space-homing');
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
   * A topic's entries, a question it moved to another topic, and another
   * topic's entries relying on them.
   */
  function relyingTopics() {
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const moving = ask(NOTE, 'Which Space does a new note open on?');
    const moved = write('move', NOTE, ['--question', moving, '--to', 'space-homing'], MADE).id;
    const relying = decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.', ['--relies-on', decided]);
    return { decided, moving, moved, relying };
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
   * ledger keeping every line; while the unit is live, the question it
   * moved away stays where it moved, its move on the unit's record.
   * @param {{decided: string, moving: string, moved: string}} topics @param {RegExp} reason @param {{note: boolean, unit: boolean}} live @param {string} [from] where the write is made
   */
  function assertSetAside({ decided, moving, moved }, reason, live, from = SPACE) {
    const lines = rawLines();
    const now = reads();
    const empty = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
    assert.deepStrictEqual(now.note, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, ...empty });
    assert.deepStrictEqual(now.map, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, questions: [] });
    assert.deepStrictEqual(now.product.decisions, []);
    assert.deepStrictEqual(now.space.other_topics, []);
    assert.deepStrictEqual([now.unit.live, ids(now.unit.moved), ids(now.space.questions).includes(moving)], [live.unit, live.unit ? [moved] : [], live.unit]);
    assert.ok(!JSON.stringify(now.unit).includes(`"id":"${decided}"`), 'the unit\'s record shows an entry that is not current');
    const refusal = refuses(dir, ['ledger', 'hold', from, '--entry', decided, '--after', decided], { env: SESSION, stdin: JSON.stringify(MADE) });
    assert.match(refusal.error, reason);
    assert.deepStrictEqual(rawLines(), lines, 'the ledger did not keep its lines');
  }

  it('takes a cancelled topic\'s entries out of every read until the topic is reactivated, the ledger holding them throughout', () => {
    const topics = relyingTopics();
    const { decided } = topics;
    const before = reads();

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is cancelled$`), { note: false, unit: true });

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a postponed topic\'s entries out of every read while it waits, and back once it is pulled back into its own epic', () => {
    const topics = relyingTopics();
    const { decided } = topics;
    const before = reads();

    ok(dir, ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is postponed$`), { note: false, unit: true });

    ok(dir, ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a cancelled unit\'s entries out of every read, another unit\'s included, until the unit is reactivated', () => {
    mint();
    const topics = relyingTopics();
    const { decided } = topics;
    decide('mint.discussion.mint', ask('mint.discussion.mint', 'Does Mint float its notes too?'), 'Yes, as Fumi does.', ['--relies-on', decided]);
    const before = { ...reads(), mint: read('record', 'mint') };

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(read('record', 'mint').other_topics, []);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').decisions, []);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: ${UNIT} is cancelled$`), { note: false, unit: false }, 'mint.discussion.mint');

    ok(dir, ['workunit', 'reactivate', UNIT]);
    assert.deepStrictEqual({ ...reads(), mint: read('record', 'mint') }, before);
  });

  it('counts a replacement only while it is live: another unit\'s, cancelled with its unit, leaves what it replaced current, until the unit is reactivated', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const before = { record: read('record', UNIT, 'note-window'), map: read('map', UNIT, 'note-window') };

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(decided)]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [decided]]]);
    assertAgree('note-window');

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual({ record: read('record', UNIT, 'note-window'), map: read('map', UNIT, 'note-window') }, before);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [minted]]]);
  });

  it('reads a chain as though a replacement that is not live were not there: what it replaced stands again, and what replaced it stands with nothing beneath', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const reworked = change(NOTE, minted, 'A sheet that stacks.');
    const before = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(before.decisions, [current(reworked, [minted, decided])]);

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(decided), current(reworked)]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [decided, reworked]]]);
    assertAgree('note-window');

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window'), before);
  });

  it('leads an entry to its live replacements alone: a replacement that is not live, and what replaced it, are no current form of it', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.');
    find(SPACE, 'Homing reads the note\'s frame.', ['--relies-on', decided]);
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const reworked = change(NOTE, minted, 'A sheet that stacks.');
    ok(dir, ['workunit', 'cancel', 'mint']);

    const replacement = change(NOTE, decided, 'A framed panel.');

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replacement), named: [decided] }]);
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(ids(read('record', UNIT, 'space-homing').other_topics), [reworked, replacement]);
  });

  it('shows a confirmation made where it is live alone: another unit\'s, cancelled with its unit, until the unit is reactivated', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', decided]);
    const replacement = change(NOTE, decided, 'A sheet.');
    const confirmed = write('hold', 'mint.discussion.mint', ['--entry', relying, '--after', replacement], MADE).id;
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);

    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying)]);

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);
  });

  it('stands another unit\'s replacement where it was made while the entry it replaced is set aside: its unit cancelled, then its topic, each until reactivated (5.6.1)', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    /** Where the replacement shows: the topic it replaced on, each unit's record, and the product record. */
    const shown = () => ({
      note: read('record', UNIT, 'note-window').decisions,
      fumi: ids(read('record', UNIT).decisions),
      mint: read('record', 'mint').decisions,
      product: ids(read('product').decisions),
    });
    const standing = { note: [current(minted, [decided])], fumi: [minted], mint: [], product: [minted] };
    const fallenBack = { note: [], fumi: [], mint: [current(minted)], product: [minted] };
    assert.deepStrictEqual(shown(), standing);

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(shown(), fallenBack);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    assert.deepStrictEqual(shown(), standing);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(shown(), fallenBack);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(shown(), standing);
  });

  it('stands a chain across three units where its earliest entry in a live place stands: the first unit cancelled, then the second', () => {
    mint();
    createManifest(dir, 'zeta', { work_type: 'feature', phases: { discussion: { items: { zeta: { status: 'in-progress' } } } } });
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const latest = change('zeta.discussion.zeta', minted, 'A card.');
    const shown = () => ({
      fumi: read('record', UNIT).decisions, mint: read('record', 'mint').decisions, zeta: read('record', 'zeta').decisions, product: ids(read('product').decisions),
    });
    assert.deepStrictEqual(shown(), { fumi: [current(latest, [minted, decided])], mint: [], zeta: [], product: [latest] });

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(shown(), { fumi: [], mint: [current(latest, [minted])], zeta: [], product: [latest] });

    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(shown(), { fumi: [], mint: [], zeta: [current(latest)], product: [latest] });
  });

  it('sets a merged duplicate aside only while the entry it went into has a current form: the owner\'s topic cancelled, the duplicate answers its question again, until the topic is reactivated (5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');
    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;
    const before = { record: read('record', UNIT, 'space-homing'), map: read('map', UNIT, 'space-homing') };
    assert.deepStrictEqual(answered('space-homing'), [[reached, 'merged', [owners]]]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    assert.deepStrictEqual(answered('space-homing'), [[reached, 'answered', [duplicate]]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[current(duplicate)], [shownMerge(merged, duplicate, false)], []]);
    assertAgree('space-homing');

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual({ record: read('record', UNIT, 'space-homing'), map: read('map', UNIT, 'space-homing') }, before);
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
    const affected = underHeap([ENGINE, 'ledger', 'affected', UNIT]);
    const since = underHeap([ENGINE, 'ledger', 'since', UNIT, 'note-window']);

    for (const [name, res] of Object.entries({ record, map, product, affected, since })) assert.strictEqual(res.status, 0, `${name} did not answer under ${HEAP_MB} MB: ${res.signal} ${res.err}`);
    assert.deepStrictEqual([ids(record.out.questions), ids(record.out.decisions)], [[question], [decided]]);
    assert.deepStrictEqual(ids(map.out.questions), [question]);
    assert.deepStrictEqual([ids(product.out.decisions), product.out.findings], [[decided], []]);
    assert.deepStrictEqual([affected.out.affected, ids(since.out.calls)], [[], [decided]]);
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
