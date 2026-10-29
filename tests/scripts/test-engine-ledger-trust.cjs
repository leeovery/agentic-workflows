'use strict';

// ---------------------------------------------------------------------------
// The ledger's write verbs telling the trust log
// (workflow-engine/scripts/domain/ledger-write.cjs, the departure rule in
// domain/ledger-verdicts.cjs, the log in domain/trust-log.cjs): the event
// built and kept in the conversation before the ledger's append, so a
// project manifest holding no project_id refuses the write whole, and
// landed in the command that writes its entry, under the writer lock
// between the ledger's append and its commit — Claude's answer, by `ledger
// decide` or its replacement of a decision, a call naming the entry, the
// person's replacement the departure rule holds standing over a lean the
// replaced entry held a reversal naming the entry it reverses, wherever that
// entry stands, and no other write anything; an append that fails a
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
const { spawnSync } = require('child_process');
const { NO_SPACE, head, stateGit, statePath, failingTrustAppends, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { TRUST_LOG, PENDING, trustLogPath, appendWaiting, readTrustLog } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

const { SESSION_ID, MADE, NOTE, WRITE_PHASES, ledgerWriteHelpers, ledgerWorld } = require('./ledger-world.cjs');

const config = useTempFolder('ledger-trust-config-');

/** @type {string} */
let dir;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = ledgerWorld('ledger-trust-', WRITE_PHASES);
  pinned = process.env.WORKFLOWS_CONFIG_DIR;
  process.env.WORKFLOWS_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.WORKFLOWS_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { write, ledgerText, entries, full, refused, ask, find, decide, change } = ledgerWriteHelpers(() => dir);

/** An event as these tests compare it: its type, the project it is keyed by and its own fields. @param {Record<string, unknown>} event */
function keyed({ v: _v, id: _id, at: _at, project_name: _name, model: _model, session: _session, ...own }) {
  return own;
}

/** The trust log's lines, each keyed. */
function logged() {
  if (!fs.existsSync(trustLogPath())) return [];
  return fs.readFileSync(trustLogPath(), 'utf8').split('\n').slice(0, -1).map((line) => keyed(JSON.parse(line)));
}

/** The trust log's events as a read counts them, each once by its id, keyed. */
function counted() {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readTrustLog((event) => events.push(keyed(event)));
  return events;
}

/** The id setup minted the project. */
function project() {
  return JSON.parse(fs.readFileSync(statePath(dir, 'manifest.json'), 'utf8')).project_id;
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

  it('logs a call for Claude\'s replacement of a decision that held the lean, its own or the person\'s, and no reversal: Claude\'s answer is a call however it is written, and a reversal is the person\'s (5.8.19)', () => {
    const question = ask().id;
    const call = decide(question).id;
    const agreed = decide(question, { by: 'person', who_moved_whom: 'none', sealed: 'A near-frameless floating note.' }).id;

    const own = change(call).id;
    const persons = change(agreed, { text: 'A floating panel.', why: 'It follows the person.' }).id;

    assert.deepStrictEqual(logged(), [callOf(call), callOf(own), callOf(persons)]);
  });

  it('logs a reversal of the person\'s own answer that held Claude\'s lean, made from another unit, as of Claude\'s call', () => {
    const agreed = decide(ask().id, { by: 'person', who_moved_whom: 'none', sealed: 'A near-frameless floating note.' }).id;
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });

    const reversal = overrule(agreed, 'mint.discussion.mint').id;

    assert.deepStrictEqual(logged(), [reversalOf(reversal, agreed)]);
  });

  it('logs no call for the person\'s own decision', () => {
    decide(ask().id, { by: 'person', who_moved_whom: 'person-moved-claude', sealed: 'A floating panel.' });

    assert.deepStrictEqual(logged(), []);
  });

  it('logs nothing for a write that is neither Claude\'s answer nor a replacement the departure rule holds standing over a lean the entry it replaces held: Claude\'s question, its finding and its replacement of one, a replacement for a new fact, the person\'s third answer after their own departure, one carrying Claude\'s sealed answer, and the person\'s merge', () => {
    const question = ask().id;
    const fact = find().id;
    const [first, second] = [decide(question).id, decide(question, { text: 'A second note.' }).id];
    const departed = decide(question, { by: 'person', who_moved_whom: 'person-moved-claude', sealed: 'A floating panel.' }).id;
    const calls = logged();
    const persons = (/** @type {string} */ old, /** @type {string[]} */ flags, /** @type {Record<string, unknown>} */ made) => write('replace', NOTE, ['--replaces', old, ...flags], { by: 'person', drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.', ...made }).id;

    persons(first, ['--reason', 'new-fact', '--cause', fact], { who_moved_whom: 'none' });
    const third = persons(departed, ['--reason', 'changed-mind'], { who_moved_whom: 'person-moved-claude' });
    persons(second, ['--reason', 'was-wrong'], { who_moved_whom: 'person-moved-claude', sealed: 'A sheet.' });
    write('replace', NOTE, ['--replaces', fact, '--reason', 'was-wrong'], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike' });
    write('merge', NOTE, ['--question', ask('Does a note float?').id, '--into', third], { by: 'person', who_moved_whom: 'none' });

    assert.deepStrictEqual([calls.map((event) => event.type), logged()], [['call', 'call'], calls]);
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
  const KILLS = Object.freeze({
    'before it keeps its call': { dies: ['appendFileSync', PENDING, 'before'], left: [false, false, false] },
    'between keeping its call and the ledger\'s append': { dies: ['appendFileSync', PENDING, 'after'], left: [false, true, false] },
    'between the ledger\'s append and the landing': { dies: ['renameSync', LEDGER, 'after'], left: [true, true, false] },
    'in the landing, between its append and letting go of the waiting call': { dies: ['appendFileSync', TRUST_LOG, 'after'], left: [true, true, true] },
    'after the landing, before the commit': { dies: ['rmSync', PENDING, 'after'], left: [true, false, true] },
  });

  // The engine in a child, which exits at its file call.
  const KILLED = [
    'const [method, file, when, cwd, stdin, env, ...args] = process.argv.slice(1);',
    "const fs = require('fs');",
    'const real = fs[method];',
    "const hits = (a) => String(a[method === 'renameSync' ? 1 : 0]).endsWith(file);",
    "fs[method] = (...a) => { if (when === 'before' && hits(a)) process.exit(9); const done = real.apply(fs, a); if (when === 'after' && hits(a)) process.exit(9); return done; };",
    `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.join(SCRIPTS, 'engine.cjs'))}).run(args, { cwd, stdin, env: JSON.parse(env) })));`,
  ].join('\n');

  /** Claude's decision answering `question`, its writer killed at `point` in conversation `session`. @param {keyof typeof KILLS} point @param {string} question @param {string} [session] */
  function killedDecide(point, question, session = SESSION_ID) {
    const content = JSON.stringify({ ...MADE, text: 'A note killed on the way.', why: 'Killed.' });
    const argv = [...KILLS[point].dies, dir, content, JSON.stringify({ CLAUDE_CODE_SESSION_ID: session }), 'ledger', 'decide', NOTE, '--answers', question];
    const { status, stdout, stderr } = spawnSync(process.execPath, ['-e', KILLED, ...argv], { env: process.env, encoding: 'utf8' });
    assert.strictEqual(status, 9, `the writer was not killed ${point}\nstdout: ${stdout}\nstderr: ${stderr}`);
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
