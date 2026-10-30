'use strict';

// ---------------------------------------------------------------------------
// The ledger's write verbs telling the trust log
// (leeway-engine/scripts/domain/ledger-write.cjs, the departure rule in
// domain/ledger-verdicts.cjs, the log in domain/trust-log.cjs): the event
// built and kept in the conversation before the ledger's append, so a
// project manifest holding no project_id refuses the write whole, and
// landed in the command that writes its entry, under the writer lock
// between the ledger's append and its commit — Claude's answer, by `ledger
// decide` or its replacement of a decision, a call naming the entry, the
// person's "your call" and "don't care" among them and none carried over, the
// person's replacement the departure rule holds standing over a lean the
// replaced entry held a reversal naming the entry it reverses, wherever that
// entry stands, and no other write anything; the person's entry carrying
// Claude's sealed answer refused, their answer to the lean a raise's (P4,
// test-engine-raise-answer.cjs); an append that fails a
// warning, the event waiting in the conversation for its next record, which
// lands it once; and a writer killed at any point on the way, its call
// landed by the next write or boot's pass where its entry was appended, let
// go where it never was, and counted once.
//
// Layer: verb, and beside it process — writers killed in a child at each
// point. World: a project with its state worktree from the fixture library,
// the work unit's manifest written there; each test keeps the trust log in
// a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { NO_SPACE, ok, head, stateGit, statePath, killedAt, failingTrustAppends, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { TRUST_LOG, PENDING, trustLogPath, appendWaiting, readTrustLog } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

const { SESSION_ID, SESSION, MADE, NOTE, WRITE_PHASES, ledgerWriteHelpers, ledgerWorld, answeredRaise } = require('./ledger-world.cjs');
const { trustLogHelpers } = require('./trust-world.cjs');

const config = useTempFolder('ledger-trust-config-');

/** @type {string} */
let dir;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = ledgerWorld('ledger-trust-', WRITE_PHASES);
  pinned = process.env.LEEWAY_CONFIG_DIR;
  process.env.LEEWAY_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.LEEWAY_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { write, ledgerText, entries, full, refused, ask, find, decide, change } = ledgerWriteHelpers(() => dir);

/** An event as these tests compare it: its type, the project it is keyed by and its own fields. @param {Record<string, unknown>} event */
function keyed({ v: _v, id: _id, at: _at, project_name: _name, model: _model, session: _session, ...own }) {
  return own;
}

const { logEvents, project } = trustLogHelpers(() => dir, config);

/** The trust log's lines, each keyed. */
const logged = () => logEvents().map(keyed);

/** The trust log's events as a read counts them, each once by its id, keyed. */
function counted() {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readTrustLog((event) => events.push(keyed(event)));
  return events;
}

/** The call naming Claude's decision `short`. @param {string} short */
function callOf(short) {
  return { type: 'call', project: project(), entry: full(short), kind: null, label: null, sort: null };
}

/** The reversal naming the replacement `short` and the entry it reverses. @param {string} short @param {string} reversed */
function reversalOf(short, reversed) {
  return { type: 'reversal', project: project(), entry: full(short), reverses: full(reversed) };
}

/** The person's replacement of `old` for a changed mind, carrying no sealed answer, who moved whom left to the engine: its response. @param {string} old @param {string} [address] */
function overrule(old, address = NOTE) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { by: 'person', drops: ['a floating note'], text: 'A document window.', why: 'Notes are documents.' });
}

describe('calls and reversals (16.13.3, 16.13.4, 16.12.1)', () => {
  it('16.S73: Claude\'s call, and the person\'s later replacement of it for a changed mind carrying no sealed answer, each land in the trust log in the command that writes the entry — a call naming the entry, then a reversal naming the entry it reverses', () => {
    const call = decide(ask().id).id;
    assert.deepStrictEqual(logged(), [callOf(call)]);

    const reversal = overrule(call).id;

    assert.deepStrictEqual(logged(), [callOf(call), reversalOf(reversal, call)]);
  });

  it('tells the trust log under the writer lock, after the ledger\'s append and before its commit', (t) => {
    const question = ask().id;
    const tip = head(dir);
    const append = fs.appendFileSync;
    /** @type {[boolean, number, string][]} */
    const told = [];
    t.mock.method(fs, 'appendFileSync', (/** @type {any} */ file, /** @type {any} */ data) => {
      if (file === trustLogPath()) told.push([fs.existsSync(statePath(dir, WRITER_LOCK)), entries().length, head(dir)]);
      return append(file, data);
    });

    decide(question);

    assert.deepStrictEqual(told, [[true, 2, tip]]);
    assert.notStrictEqual(head(dir), tip);
  });

  it('logs a call for Claude\'s replacement of a decision, its own or the person\'s, and no reversal: Claude\'s answer is a call however it is written, and a reversal is the person\'s (5.8.19)', () => {
    const question = ask().id;
    const call = decide(question).id;
    const agreed = decide(question, { by: 'person', who_moved_whom: 'none' }).id;

    const own = change(call).id;
    const persons = change(agreed, { text: 'A floating panel.', why: 'It follows the person.' }).id;

    assert.deepStrictEqual(logged(), [callOf(call), callOf(own), callOf(persons)]);
  });

  it('reads an answer the person handed over or left to the builder as Claude\'s call: each logs a call, and the person\'s change of mind over it a reversal, waiting on a verdict with it as the lean; one carried over logs none, and the person\'s replacement of it no reversal (9.2.14, 9.2.16, 21.6.5)', () => {
    const handed = decide(ask().id, { given: 'your-call' }).id;
    const builders = decide(ask('Does a note snap?').id, { text: 'Notes snap to the grid.', given: 'dont-care' }).id;
    const carried = decide(ask('Does a note dim?').id, { text: 'Notes dim after a minute.', given: 'carried' }).id;
    assert.deepStrictEqual(logged(), [callOf(handed), callOf(builders)]);

    const reversal = overrule(handed).id;
    overrule(carried);

    assert.deepStrictEqual(logged(), [callOf(handed), callOf(builders), reversalOf(reversal, handed)]);
    assert.deepStrictEqual(ok(dir, ['verdict', 'queue']).departures.map((/** @type {Record<string, unknown>} */ d) => [d.id, d.lean]), [[reversal, 'A near-frameless floating note.']]);
  });

  it('logs a reversal of the person\'s own answer that took Claude\'s lean, made from another unit, as of Claude\'s call', async () => {
    const agreed = await answeredRaise(dir, NOTE, ask().id, { lean: 'A near-frameless floating note.', other: 'A sheet.', key: '1', env: SESSION });
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const raised = logged();

    const reversal = overrule(agreed, 'mint.discussion.mint').id;

    assert.deepStrictEqual(logged(), [...raised, reversalOf(reversal, agreed)]);
  });

  it('logs no call for the person\'s own decision on a question Claude had no lean on', () => {
    decide(ask().id, { by: 'person', who_moved_whom: 'none' });

    assert.deepStrictEqual(logged(), []);
  });

  it('logs nothing for a write that is neither Claude\'s answer nor a replacement the departure rule holds standing over a lean the entry it replaces held: Claude\'s question, its finding and its replacement of one, a replacement for a new fact, the person\'s third answer after their own departure from Claude\'s lean, and the person\'s merge', async () => {
    const question = ask().id;
    const fact = find().id;
    const first = decide(question).id;
    const departed = await answeredRaise(dir, NOTE, ask('Is a note a panel?').id, { lean: 'A floating panel.', other: 'A sheet.', key: '2', env: SESSION });
    const calls = logged();
    const persons = (/** @type {string} */ old, /** @type {string[]} */ flags, /** @type {Record<string, unknown>} */ made) => write('replace', NOTE, ['--replaces', old, ...flags], { by: 'person', drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.', ...made }).id;

    persons(first, ['--reason', 'new-fact', '--cause', fact], { who_moved_whom: 'none' });
    const third = persons(departed, ['--reason', 'changed-mind'], { who_moved_whom: 'person-moved-claude' });
    write('replace', NOTE, ['--replaces', fact, '--reason', 'was-wrong'], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike', known: 'spike' });
    write('merge', NOTE, ['--question', ask('Does a note float?').id, '--into', third], { by: 'person', who_moved_whom: 'none' });

    assert.deepStrictEqual([calls.map((event) => event.type), logged()], [['call', 'raise'], calls]);
  });

  it('refuses, appending, committing and logging nothing, the person\'s decision or replacement carrying Claude\'s sealed answer, and the person\'s decision saying it moved anyone, each naming raise answer; the person\'s decision moves no one, the engine saying so where it is left out: the person\'s answer to Claude\'s lean goes through raise alone (P4)', () => {
    const question = ask().id;
    const call = decide(question).id;
    const before = logged();
    const sealed = /^ledger (decide|replace): the person's entry carries sealed, Claude's lean — the person's answer to Claude's lean is recorded by raise answer, against the lean its raise sealed$/;
    const person = { by: 'person', who_moved_whom: 'person-moved-claude', text: 'A sheet.', why: 'Sheets stay put.', sealed: 'A near-frameless floating note.' };

    refused('decide', NOTE, ['--answers', question], person, sealed);
    refused('replace', NOTE, ['--replaces', call, '--reason', 'changed-mind'], { ...person, drops: ['a floating note'] }, sealed);
    for (const moved of ['person-moved-claude', 'claude-moved-person']) {
      const { sealed: _sealed, ...unsealed } = person;
      refused('decide', NOTE, ['--answers', question], { ...unsealed, who_moved_whom: moved },
        new RegExp(`^ledger decide: who_moved_whom is ${moved} — the person's decision holds no lean of Claude's to move, no entry down its chain being Claude's own or carrying its sealed answer; their answer to Claude's lean is recorded by raise answer: none$`));
    }
    write('decide', NOTE, ['--answers', question], { by: 'person', text: 'A sheet.', why: 'Sheets stay put.' });

    assert.strictEqual(entries().at(-1)?.who_moved_whom, 'none');
    assert.deepStrictEqual(logged(), before);
  });

  it('refuses, appending and committing nothing, a write that tells the trust log in a project whose manifest holds no project_id: its event is built before the ledger\'s append (16.13.5)', () => {
    const question = ask().id;
    const manifest = statePath(dir, 'manifest.json');
    const { project_id: _id, ...unkeyed } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    fs.writeFileSync(manifest, JSON.stringify(unkeyed));

    refused('decide', NOTE, ['--answers', question], { ...MADE, text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.' }, /^the project manifest at \S+ holds no project_id — /);

    assert.deepStrictEqual(logged(), []);
  });

  it('refuses, appending and committing nothing, a write whose call cannot be kept in the conversation: it is kept before the ledger\'s append', (t) => {
    const question = ask().id;
    const append = fs.appendFileSync;
    t.mock.method(fs, 'appendFileSync', (/** @type {any} */ file, /** @type {any} */ data) => {
      if (String(file).endsWith(PENDING)) throw new Error(NO_SPACE);
      return append(file, data);
    });

    refused('decide', NOTE, ['--answers', question], { ...MADE, text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.' }, new RegExp(`^the trust log's event could not be kept in the conversation: ${NO_SPACE}$`));

    assert.deepStrictEqual(logged(), []);
  });

  it('16.S74: an append that fails is a warning, the call and the reversal waiting in the conversation, each entry and its commit standing; the conversation\'s next record lands them first, in order, once', (t) => {
    const question = ask().id;
    const waitingFile = path.join(conversationDir(SESSION_ID), 'trust-pending.jsonl');
    const failing = failingTrustAppends(t);

    const call = decide(question);
    const reversal = overrule(call.id);

    for (const res of [call, reversal]) {
      assert.deepStrictEqual(res.warnings, [`the trust log was not written: ${NO_SPACE} — the event waits in the conversation, appended first by its next record`]);
    }
    assert.strictEqual(reversal.committed, head(dir).slice(0, reversal.committed.length));
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${LEDGER}`]), ledgerText());
    assert.deepStrictEqual(fs.readFileSync(waitingFile, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).event.type), ['call', 'reversal']);
    assert.deepStrictEqual(logged(), []);
    failing.mock.restore();

    const next = decide(question, { text: 'A second note.' }).id;

    assert.deepStrictEqual(logged(), [callOf(call.id), reversalOf(reversal.id, call.id), callOf(next)]);
    assert.ok(!fs.existsSync(waitingFile), 'the events landed, yet wait on to land again');
  });
});

describe('a writer killed on the way (16.13.3)', () => {
  /** Each point a writer is killed at, by the file call it dies on and when; and what it leaves: its entry appended, its call waiting, its call landed. */
  /** @type {Readonly<Record<string, {dies: import('./engine-harness.cjs').KillPoint, left: boolean[]}>>} */
  const KILLS = Object.freeze({
    'before it keeps its call': { dies: { method: 'appendFileSync', file: PENDING, when: 'before' }, left: [false, false, false] },
    'between keeping its call and the ledger\'s append': { dies: { method: 'appendFileSync', file: PENDING, when: 'after' }, left: [false, true, false] },
    'between the ledger\'s append and the landing': { dies: { method: 'renameSync', file: LEDGER, when: 'after' }, left: [true, true, false] },
    'in the landing, between its append and letting go of the waiting call': { dies: { method: 'appendFileSync', file: TRUST_LOG, when: 'after' }, left: [true, true, true] },
    'after the landing, before the commit': { dies: { method: 'rmSync', file: PENDING, when: 'after' }, left: [true, false, true] },
  });

  /** Claude's decision answering `question`, its writer killed at `point` in conversation `session`. @param {keyof typeof KILLS} point @param {string} question @param {string} [session] */
  function killedDecide(point, question, session = SESSION_ID) {
    killedAt(KILLS[point].dies, dir, ['ledger', 'decide', NOTE, '--answers', question], {
      env: { CLAUDE_CODE_SESSION_ID: session }, stdin: JSON.stringify({ ...MADE, text: 'A note killed on the way.', why: 'Killed.' }),
    });
  }

  /** The conversation's file of waiting events. @param {string} [session] */
  const waitingFile = (session = SESSION_ID) => path.join(conversationDir(session), PENDING);

  /** The call of each of Claude's decisions the ledger holds, in its order. */
  const callsOfLedger = () => entries().filter((e) => e.event === 'decided' && e.by === 'claude').map((e) => callOf(/** @type {string} */ (e.id)));

  for (const [point, { left }] of Object.entries(KILLS)) {
    it(`killed ${point}: the next write lands the call where the entry was appended, and lets it go where it never was — the log counting each appended decision's call once`, () => {
      const question = ask().id;

      killedDecide(/** @type {keyof typeof KILLS} */ (point), question);
      assert.deepStrictEqual([entries().length === 2, fs.existsSync(waitingFile()), logged().length === 1], left);
      decide(question, { text: 'A second note.' });

      assert.deepStrictEqual(counted(), callsOfLedger());
      assert.strictEqual(entries().length, left[0] ? 3 : 2);
      assert.strictEqual(stateGit(dir, ['show', `HEAD:${LEDGER}`]), ledgerText());
      assert.ok(!fs.existsSync(waitingFile()), 'a call still waits after the next write');
    });
  }

  it('boot\'s pass, holding the writer lock, lands the call of a writer killed after the ledger\'s append, and lets go of one killed before it, each in a conversation of its own', () => {
    const question = ask().id;
    killedDecide('between keeping its call and the ledger\'s append', question, 'session-died');
    killedDecide('between the ledger\'s append and the landing', question, 'session-appended');
    /** @type {string[]} */
    const warnings = [];

    appendWaiting(dir, warnings);

    assert.deepStrictEqual([logged(), callsOfLedger().length, warnings], [callsOfLedger(), 1, []]);
    assert.deepStrictEqual(['session-died', 'session-appended'].map((session) => fs.existsSync(waitingFile(session))), [false, false]);
  });
});
