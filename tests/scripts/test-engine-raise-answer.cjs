'use strict';

// ---------------------------------------------------------------------------
// The person's answer to a raise (workflow-engine/scripts/domain/raise.cjs,
// landed through domain/ledger-write.cjs, its press read as domain/gate.cjs
// reads a gate's): `engine raise answer <id> (--pick <key> | --own |
// --didnt-follow)` in the conversation that drew the raise — a row or the
// person's own words landing as their decision at the raise's id, unchecked,
// and its raise event in the trust log, one command writing both (16.S44);
// who moved whom the engine's alone; pressed or typed (6.6.4); "I don't
// follow" logged in the trust log alone, the raise left open (F1); every
// refusal writing nothing; an answer given again, after a kill at a step
// the raise adds or once it landed, landing nothing twice (E3); and a call
// the decision point lets proceed landed as Claude's (E7).
//
// Layer: verb, and beside it process — the answer killed in a child at a
// file call on its way. World: the ledger suites' unit with two
// questions asked on the note window, built once and copied for each test;
// each test keeps its conversation and the trust log in a config folder of
// its own. The separate call is the stub binary, unarmed: no login, so
// every row is drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSectionsAsync, output, refusedPristine, killedAt, stateGit, readState, layout, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, askedWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { TRUST_LOG, PENDING } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { RAISE_SHOWN, PRESSED } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));

// A Claude Code session's id.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';

const CURSOR = Object.freeze({ key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' });
const MAIN = Object.freeze({ key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });
const LAST = Object.freeze({ key: '3', name: 'Last', text: 'Where the last note was', notice: 'notes gather on one screen until you move one' });

/** Claude's call: where a new note opens, leaning to the cursor's screen. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [CURSOR, MAIN, LAST],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** Claude's account of the person's reason. */
const WHY = 'They keep their notes together on the main screen.';

const { world, asked } = askedWorld('raise-answer-', PHASES, {
  where: 'Where does a new note open?',
  size: 'How big is a new note?',
});

const config = useTempFolder('raise-answer-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ledgerText, entries, full } = ledgerHelpers(() => dir);

/** The calling conversation's environment, over `env`. @param {Record<string, string|undefined>} [env] */
const conversation = (env = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, WORKFLOWS_CONFIG_DIR: config(), ...env });

/** A file in the conversation's folder. @param {string} name */
const inFolder = (name) => path.join(config(), 'conversations', SESSION, name);

/** The conversation's sealed raises. @returns {Record<string, any>} */
const seals = () => JSON.parse(fs.readFileSync(inFolder(RAISE_SHOWN), 'utf8'));

/** The trust log's text, '' where there is none. */
function logText() {
  const file = path.join(config(), TRUST_LOG);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The trust log's events, each but its id, its time and the project's name. */
function logged() {
  return logText().split('\n').slice(0, -1).map((line) => {
    const { id: _id, at: _at, project_name: _name, ...event } = JSON.parse(line);
    return event;
  });
}

/** What an answer writes beside the ledger, as it stands: the seals, the events waiting in the conversation, and the trust log. */
function conversationState() {
  const read = (/** @type {string} */ file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  return { seals: read(inFolder(RAISE_SHOWN)), waiting: read(inFolder(PENDING)), log: logText() };
}

/** The id setup minted the project. */
const project = () => JSON.parse(readState(dir, layout.projectManifest)).project_id;

/**
 * A raise of `call` drawn on `question`: its id.
 * @param {string} [question] @param {{call?: Record<string, unknown>, flags?: string[]}} [opts]
 */
async function draw(question = asked.where, { call = CALL, flags = [] } = {}) {
  const { res } = await okSectionsAsync(dir, ['raise', NOTE, '--answers', question, ...flags], { env: conversation(), stdin: JSON.stringify(call) });
  return /** @type {string} */ (res.raise);
}

/**
 * The person's answer, which must land: its response.
 * @param {string} id @param {string[]} how @param {Record<string, unknown>|null} [given] @param {Record<string, string|undefined>} [env]
 */
function answer(id, how, given = { why: WHY }, env = {}) {
  return ok(dir, ['raise', 'answer', id, ...how], { env: conversation(env), stdin: given === null ? '' : JSON.stringify(given) });
}

/**
 * An answer refused, leaving the state, the conversation's folder and the
 * trust log as they were: its error.
 * @param {string[]} args @param {unknown} [given] @param {Record<string, string|undefined>} [env]
 */
function refusedAnswer(args, given = { why: WHY }, env = {}) {
  const before = conversationState();
  const { error } = refusedPristine(dir, ['raise', 'answer', ...args], { env: conversation(env), stdin: typeof given === 'string' ? given : JSON.stringify(given) });
  assert.deepStrictEqual(conversationState(), before, `raise answer ${args.join(' ')} refused, yet wrote its seal or the trust log`);
  return error;
}

/**
 * The person's decision a raise answering `question` lands as, its line but
 * the time: `own` over the pick of the lean.
 * @param {string} id @param {string} question @param {Record<string, unknown>} [own]
 */
function entryOf(id, question, own = {}) {
  return {
    v: 1, id, event: 'decided', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION,
    by: 'person', who_moved_whom: 'none', answers: full(question), text: CURSOR.text, why: WHY, rules_out: [MAIN.text, LAST.text],
    relies_on: [], product_wide: false, sealed: CURSOR.text, alternatives: [], evidence: [], kind: null, unchecked: true, ...own,
  };
}

/** The ledger's last line but its time. */
function lastEntry() {
  const { at: _at, ...line } = /** @type {Record<string, unknown>} */ (entries().at(-1));
  return line;
}

/**
 * A raise event as the trust log holds it, but its id and time: `own` over
 * the pick of the lean, typed.
 * @param {string|null} entry @param {Record<string, unknown>} [own]
 */
function raiseEvent(entry, own = {}) {
  return {
    v: 1, type: 'raise', project: project(), model: null, session: SESSION,
    entry, kind: null, label: null, sort: 'several', sealed: '1', answer: '1', via: 'typed', with_text: false, reading: null, didnt_follow: false, blocked_build: null, ...own,
  };
}

/**
 * The mod's record of its last press: `answer` sent from the menu `gate` at
 * `at`, by default after every raise was drawn.
 * @param {string} gate @param {string} answer @param {string} [at]
 */
function pressed(gate, answer, at = new Date(Date.now() + 1000).toISOString()) {
  fs.writeFileSync(inFolder(PRESSED), JSON.stringify({ gate, answer, at }));
}

/** The answer of the row `key` of Claude's call. @param {string} key */
const rowText = (key) => /** @type {{text: string}} */ (CALL.rows.find((row) => row.key === key)).text;

// Where an answer is killed: between keeping its event and the ledger's
// append; between the append and the landing; and between the state commit
// and marking its seal.
const KEPT = Object.freeze({ method: 'appendFileSync', file: PENDING, when: 'after' });
const APPENDED = Object.freeze({ method: 'renameSync', file: LEDGER, when: 'after' });
const COMMITTED = Object.freeze({ method: 'renameSync', file: RAISE_SHOWN, when: 'before' });

/**
 * The person's pick of `key` on the raise `id`, its command killed at `point`.
 * @param {import('./engine-harness.cjs').KillPoint} point @param {string} id @param {string} key
 */
function killedPick(point, id, key) {
  killedAt(point, dir, ['raise', 'answer', id, '--pick', key], { env: conversation(), stdin: JSON.stringify({ why: WHY }) });
}

const ANNOUNCED = Object.freeze({ WORKFLOWS_GATE_SURFACE: '1' });

describe('the answer recorded (16.S44, 6.1.5)', () => {
  it('16.S44: a pick of the lean lands as the person\'s decision at the raise\'s id — the row\'s answer, the other rows what it rules out, the lean sealed, what it relies on and whether it is product-wide as sealed, unchecked — and the same command logs one raise event naming it, holding no word of the call or the why; the seal is marked answered', async () => {
    const id = await draw(asked.where, { call: { ...CALL, product_wide: true }, flags: ['--relies-on', asked.size] });
    assert.strictEqual(logText(), '');

    const res = answer(id, ['--pick', '1']);

    assert.deepStrictEqual(lastEntry(), entryOf(id, asked.where, { relies_on: [full(asked.size)], product_wide: true }));
    assert.deepStrictEqual(res, { ok: true, raise: id, id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(full(res.id), id);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), layout.ledger);
    assert.deepStrictEqual(logged(), [raiseEvent(id)]);
    const words = [CALL.question, CALL.why, CALL.mechanism, WHY, ...CALL.rows.flatMap((row) => [row.name, row.text, row.notice])];
    assert.deepStrictEqual(words.filter((said) => logText().includes(said)), [], 'the trust line holds the call\'s words');
    const { at, ...answered } = seals()[id].answered;
    assert.ok(!Number.isNaN(Date.parse(at)), `when it was answered is no time: ${at}`);
    assert.deepStrictEqual(answered, { answer: '1' });
  });

  it('the person\'s own words land with their text and why, and what they rule out where Claude gives it, none else; standing over the lean, logged as free text, typed, naming no row, its reading null', async () => {
    const plain = await draw(asked.where);
    const ruling = await draw(asked.size);

    answer(plain, ['--own'], { text: 'Beside the note it was made from', why: WHY });
    const first = lastEntry();
    answer(ruling, ['--own'], { text: 'Half the screen', why: WHY, rules_out: ['a fixed size'] });

    assert.deepStrictEqual([first, lastEntry()], [
      entryOf(plain, asked.where, { who_moved_whom: 'person-moved-claude', text: 'Beside the note it was made from', rules_out: [] }),
      entryOf(ruling, asked.size, { who_moved_whom: 'person-moved-claude', text: 'Half the screen', rules_out: ['a fixed size'] }),
    ]);
    const own = { answer: null, with_text: true };
    assert.deepStrictEqual(logged(), [raiseEvent(plain, own), raiseEvent(ruling, own)]);
    assert.deepStrictEqual(seals()[plain].answered.answer, null);
  });

  it('"I don\'t follow" logs a raise event in the trust log alone — no entry, no answer, no reading — and no ledger line; the seal counts it and the raise stays open, shown again and answered after (F1, 16.9.3)', async () => {
    const id = await draw();
    const [ledger, tip] = [ledgerText(), stateGit(dir, ['rev-parse', 'HEAD'])];

    assert.deepStrictEqual(answer(id, ['--didnt-follow'], null), { ok: true, raise: id, open: true });

    assert.deepStrictEqual([ledgerText(), stateGit(dir, ['rev-parse', 'HEAD'])], [ledger, tip]);
    assert.deepStrictEqual(logged(), [raiseEvent(null, { answer: null, didnt_follow: true })]);
    assert.deepStrictEqual([seals()[id].didnt_follow, seals()[id].answered], [1, null]);
    assert.match(output(dir, ['raise', 'show', id], { env: conversation() }), new RegExp(`^\\{"ok":true,"raise":"${id}"\\}\\n=== MENU: raise — ${id} `));
    answer(id, ['--pick', '2']);
    assert.deepStrictEqual(logged().map((event) => [event.entry, event.didnt_follow]), [[null, true], [id, false]]);
  });
});

describe('who moved whom, the engine\'s alone (5.3.10)', () => {
  it('a pick against the lean stands over it, its rows not picked what it rules out; stdin naming who moved whom is refused, whatever it says', async () => {
    const id = await draw();
    for (const moved of ['none', 'claude-moved-person', 'person-moved-claude']) {
      assert.strictEqual(refusedAnswer([id, '--pick', '2'], { why: WHY, who_moved_whom: moved }),
        'raise answer: who_moved_whom is the engine\'s — row 2 is not the lean, 1, so the person\'s answer stood over it: person-moved-claude');
    }

    answer(id, ['--pick', '2']);

    assert.deepStrictEqual(lastEntry(), entryOf(id, asked.where, { who_moved_whom: 'person-moved-claude', text: MAIN.text, rules_out: [CURSOR.text, LAST.text] }));
    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: '2' })]);
  });

  it('a pick of the lean is claude-moved-person where Claude says so on stdin; any other value it names is refused', async () => {
    const id = await draw();
    for (const moved of ['none', 'person-moved-claude', 'claude']) {
      assert.strictEqual(refusedAnswer([id, '--pick', '1'], { why: WHY, who_moved_whom: moved }),
        `raise answer: on a pick of the lean who_moved_whom is none, which the engine gives, or claude-moved-person where the person came round to it — not ${JSON.stringify(moved)}`);
    }

    answer(id, ['--pick', '1'], { why: WHY, who_moved_whom: 'claude-moved-person' });

    assert.deepStrictEqual(lastEntry(), entryOf(id, asked.where, { who_moved_whom: 'claude-moved-person' }));
  });
});

describe('pressed or typed (6.6.4)', () => {
  it('a pick is pressed where the mod announced itself and its last press sent this row from this raise\'s menu after the raise was drawn', async () => {
    const id = await draw();
    pressed(`raise — ${id}`, '2');

    answer(id, ['--pick', '2'], { why: WHY }, ANNOUNCED);

    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: '2', via: 'pressed' })]);
  });

  it('anything else is typed: a press from another raise\'s menu, a press of another row, a press with the mod not announced, and a press made before the raise was drawn', async () => {
    const id = await draw();
    const other = await draw(asked.size);
    const [after, before] = [1000, -1000].map((by) => new Date(Date.parse(seals()[id].at) + by).toISOString());
    /** @type {[string, string, Record<string, string>, string][]} */
    const presses = [
      [`raise — ${id}`, 'explain', ANNOUNCED, after],
      [`raise — ${other}`, 'explain', ANNOUNCED, after],
      [`raise — ${id}`, '1', ANNOUNCED, after],
      [`raise — ${id}`, 'explain', {}, after],
      [`raise — ${id}`, 'explain', ANNOUNCED, before],
    ];

    for (const [menu, sent, env, at] of presses) {
      pressed(menu, sent, at);
      answer(id, ['--didnt-follow'], null, env);
    }

    assert.deepStrictEqual(logged().map((event) => event.via), ['pressed', 'typed', 'typed', 'typed', 'typed']);
  });
});

describe('once (E3)', () => {
  it('killed between keeping its event and the ledger\'s append: the rerun lands one entry and one event, its own, whether it picks the row the killed run picked or another — the event the killed run kept let go', async () => {
    for (const [question, first, rerun] of [[asked.where, '2', '2'], [asked.size, '2', '1']]) {
      const id = await draw(question);
      killedPick(KEPT, id, first);
      assert.deepStrictEqual(entries().filter((entry) => entry.id === id), []);

      const res = answer(id, ['--pick', rerun]);

      assert.strictEqual(res.already, undefined);
      assert.deepStrictEqual(entries().filter((entry) => entry.id === id).map((entry) => entry.text), [rowText(rerun)]);
      assert.deepStrictEqual(logged().filter((event) => event.entry === id), [raiseEvent(id, { answer: rerun })]);
    }
    assert.ok(!fs.existsSync(inFolder(PENDING)), 'an event the killed runs kept still waits');
  });

  it('killed between the ledger\'s append and the landing: the rerun appends nothing, lands the event the killed run kept and commits the ledger, saying the raise was answered already, with the row the ledger holds — not the rerun\'s — and marks the seal with it', async () => {
    const id = await draw();
    killedPick(APPENDED, id, '2');
    const lines = entries().length;
    assert.deepStrictEqual(logged(), []);

    const res = answer(id, ['--pick', '1']);

    assert.deepStrictEqual(res, { ok: true, raise: id, id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), already: true, answer: '2' });
    assert.strictEqual(full(res.id), id);
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
    assert.deepStrictEqual([entries().length, logged()], [lines, [raiseEvent(id, { answer: '2' })]]);
    assert.strictEqual(seals()[id].answered.answer, '2');
  });

  it('killed between the state commit and marking its seal: the ledger says the raise is answered, and the rerun writes no second entry and no second event, saying the raise was answered already, with the row the ledger holds, and marks the seal with it', async () => {
    const id = await draw();

    killedPick(COMMITTED, id, '2');

    const lines = entries().length;
    assert.strictEqual(seals()[id].answered, null);
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
    const row = ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions.find((/** @type {{id: string}} */ q) => q.id === asked.where);
    assert.deepStrictEqual([row.stands, row.answers.map((/** @type {{id: string}} */ a) => full(a.id))], ['answered', [id]]);
    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: '2' })]);

    const res = answer(id, ['--pick', '1']);

    assert.deepStrictEqual(res, { ok: true, raise: id, id: row.answers[0].id, committed: null, already: true, answer: '2' });
    assert.deepStrictEqual([entries().length, logged()], [lines, [raiseEvent(id, { answer: '2' })]]);
    assert.strictEqual(seals()[id].answered.answer, '2');
  });

  it('answered again — after a compaction, say — writes no second entry and no second event, saying the raise was answered already, with the row the ledger holds, null for the person\'s own words; the seal keeps the first answer', async () => {
    const id = await draw();
    const own = await draw(asked.size);
    const first = answer(id, ['--pick', '2']);
    answer(own, ['--own'], { text: 'Half the screen', why: WHY });
    const [lines, events, sealed] = [entries().length, logged(), seals()];

    const again = answer(id, ['--pick', '1']);
    const ownAgain = answer(own, ['--pick', '1']);

    assert.deepStrictEqual(again, { ...first, committed: null, already: true, answer: '2' });
    assert.deepStrictEqual([ownAgain.already, ownAgain.answer], [true, null]);
    assert.deepStrictEqual([entries().length, logged(), seals()], [lines, events, sealed]);
  });
});

describe('proceed (E7, 16.3.7)', () => {
  it('where the decision point answers proceed, the draw lands Claude\'s call — the lean row\'s answer, the other rows what it rules out, its why, unchecked — logged as a call carrying the sort, drawing and sealing nothing', async (t) => {
    const reason = 'On words in Fumi my calls hold: 2% overruled, under your 20%.';
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason }));

    const { res, sections } = await okSectionsAsync(dir, ['raise', NOTE, '--answers', asked.where], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.deepStrictEqual([res, sections], [{ ok: true, decision: 'proceed', reason, id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() }, '']);
    const id = full(res.id);
    assert.deepStrictEqual(lastEntry(), entryOf(id, asked.where, { by: 'claude', why: CALL.why, sealed: null }));
    assert.deepStrictEqual(logged(), [{ v: 1, type: 'call', project: project(), model: null, session: SESSION, entry: id, kind: null, label: null, sort: 'several' }]);
    assert.ok(!fs.existsSync(inFolder(RAISE_SHOWN)), 'a call that proceeds was sealed');
  });
});

describe('the answer\'s refusals, writing nothing', () => {
  it('a raise this conversation never drew, by an id no raise of it begins or one several begin; no session; and argv of another shape', async () => {
    assert.strictEqual(refusedAnswer(['0000000000', '--pick', '1']), 'raise answer: this conversation has drawn no raise 0000000000');
    const id = await draw();
    const twin = `${id.slice(0, 20)}${id.endsWith('Z') ? 'Y' : 'Z'}`;
    fs.writeFileSync(inFolder(RAISE_SHOWN), JSON.stringify({ ...seals(), [twin]: { ...seals()[id], id: twin } }));
    assert.strictEqual(refusedAnswer([id.slice(0, 8), '--pick', '1']), `raise answer: "${id.slice(0, 8)}" begins the ids of 2 raises this conversation drew — give more of the id`);
    assert.match(refusedAnswer([id, '--pick', '1'], { why: WHY }, { CLAUDE_CODE_SESSION_ID: undefined }), /^raise answer: no conversation to raise it in/);
    const usage = 'Usage: engine raise answer <id> (--pick <key> | --own | --didnt-follow)   (a pick\'s or own words\' answer as JSON on stdin, none for keep)';
    for (const args of [[], [id], ['--pick', '1'], [id, '--pick'], [id, '--pick', '--own'], [id, '--pick', '1', '--own'], [id, '--own', '1'], [id, '--choose', '1']]) {
      assert.strictEqual(refusedAnswer(args), usage, args.join(' '));
    }
  });

  it('a key that is no row of the raise', async () => {
    const id = await draw();

    assert.strictEqual(refusedAnswer([id, '--pick', '4']), 'raise answer: the raise has no row 4 — its rows: 1, 2, 3');
  });

  it('stdin holding no JSON object, lacking what the answer needs, or holding a field it does not take — who moved whom among them for the person\'s own words', async () => {
    const id = await draw();
    /** @type {[string[], unknown, string|RegExp][]} */
    const refusals = [
      [['--pick', '2'], 'not json', /^raise answer: the answer comes on stdin as a JSON object, and stdin holds no JSON — /],
      [['--pick', '2'], [WHY], `raise answer: the answer comes on stdin as a JSON object, not ${JSON.stringify([WHY])}`],
      [['--pick', '2'], {}, 'raise answer: the answer needs why'],
      [['--pick', '2'], { why: '' }, 'raise answer: the answer\'s why is not non-empty text'],
      [['--pick', '2'], { why: WHY, text: 'On the main screen' }, 'raise answer: the answer has no field text — it holds why, who_moved_whom'],
      [['--own'], { why: WHY }, 'raise answer: the answer needs text'],
      [['--own'], { text: 'Half the screen', why: WHY, rules_out: 'a fixed size' }, 'raise answer: the answer\'s rules_out is not a list of non-empty text'],
      [['--own'], { text: 'Half the screen', why: WHY, who_moved_whom: 'person-moved-claude' }, 'raise answer: the answer has no field who_moved_whom — it holds text, why, rules_out'],
    ];
    for (const [how, given, error] of refusals) {
      const refused = refusedAnswer([id, ...how], given);
      if (typeof error === 'string') assert.strictEqual(refused, error, JSON.stringify(given));
      else assert.match(refused, error);
    }
  });

  it('a question no longer open under the lock — answered since the raise was drawn — records nothing, saying so: the person\'s answer stays in the conversation', async () => {
    const id = await draw();
    const decided = write('decide', NOTE, ['--answers', asked.where], { ...MADE, text: 'On the main screen', why: 'Notes gather.' }).id;

    assert.strictEqual(refusedAnswer([id, '--pick', '2']),
      `raise answer: the raise answers ${asked.where}, which is answered by ${decided} now — nothing recorded: a raise answers an open question, and the person's answer stays in the conversation`);
  });
});
