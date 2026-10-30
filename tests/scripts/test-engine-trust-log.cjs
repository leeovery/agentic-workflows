'use strict';

// ---------------------------------------------------------------------------
// The trust log (leeway-engine/scripts/domain/trust-log.cjs, its events
// trust-events.cjs): `record`, the one door every event goes through — each
// event of 16.13.4 written whole as one line under the fields the engine
// sets, a bad one refused with nothing written, the project keyed by the
// project_id setup gave it and refused without one; the append, under a
// lock of its own, from two processes at once, a torn last line cut away
// first; no field carrying words, an answer's fields agreeing on how it
// came — a row's key or free text, pressed or typed — and the events whose
// fields contradict each other refused; the model by its id; an append
// that fails, a warning, the event waiting in the conversation — its
// folder made for it before the project has state, its file under a lock
// of its own, a torn last line cut away there too — for its next record or
// a boot, which land the waiting events as read, leave a newer release's
// waiting, drop any other line, and skip a folder another boot emptied; or
// lost with no session to keep it in; an event kept ahead of its entry,
// landed once its ledger holds the entry, let go where a landing holding
// that state's writer lock finds it never came, left waiting from another
// state, without the lock, or in a line of a version this engine does not
// write, and dropped where its line awaits no ledger and entry, no bad line
// stopping another; and the read, which skips and counts what it cannot
// read, reads an event once however often it landed, and never stops. What
// a project's read makes of its events is trust-evidence.cjs's
// (test-engine-trust-evidence.cjs).
//
// Layer: process — races between processes, on barriers: appends from two
// at once, and an event kept while a boot's pass or a record lands what
// waits. The rest runs in process beside them. World: a project is a plain
// folder whose state root is pinned, and each test keeps its log in a
// config folder of its own (trust-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { NO_SPACE, STATE_DIR_NAME, statePath, layout, contend, failingTrustAppends, lockAttempts } = require('./engine-harness.cjs');
const { idOf, PROJECT_ID, SESSION, lines, from, waitingPath, inConversation, useTrustWorld } = require('./trust-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const STATE_ROOT_MODULE = path.join(SCRIPTS, 'kernel/state-root.cjs');
const TRUST_LOG_MODULE = path.join(SCRIPTS, 'domain/trust-log.cjs');
const { pinStateRoot } = require(STATE_ROOT_MODULE);
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));
const { conversationDir, isMarked } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { isId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { SCHEMA } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));
const { newEvent, keepEvent, landKept, record, appendWaiting, readTrustLog, readProjectEvents } = require(TRUST_LOG_MODULE);
const { withWriterLock } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

const SENTENCE = 'rename the customers table to accounts';
const NOT_LABEL = 'a call event cannot be recorded: its label is not a label: the labeller\'s model id, and its 12 answers, true or false, or null';
const ENTRY = idOf('Entry');
const REVERSED = idOf('Reversed');
// A labeller's twelve answers (16.11.2).
const ANSWERS = Object.freeze([true, false, true, true, false, false, false, false, true, false, false, true]);

/** A well-formed event of every type, its own fields. */
const SAMPLES = Object.freeze({
  gate: { gate: 'state lost gate', recommended: 'y', picked: 'n', via: 'pressed', with_text: false, reading: null },
  raise: { entry: ENTRY, kind: 'behaviour', label: { labeller: 'claude-sonnet-5', answers: ANSWERS }, sort: null, sealed: '1', answer: '2', via: 'pressed', with_text: false, reading: null, didnt_follow: false, blocked_build: null },
  call: { entry: ENTRY, kind: null, label: null, sort: 'one' },
  verdict: { entry: ENTRY, verdict: 'skip', point: 'decided' },
  'blind-draw': { entry: ENTRY, kind: 'look' },
  reversal: { entry: ENTRY, reverses: REVERSED },
  'position-switch': { unit: 'fumi', to: 'step' },
  convergence: { unit: 'fumi', topic: 'note-window' },
  correction: { entry: ENTRY, kind: 'words', verdict: null },
});

const HEADER_FIELDS = ['v', 'id', 'at', 'type', 'project', 'project_name', 'model', 'session'];

const { folder, logPath, logText, project } = useTrustWorld('trust-log-');

/** Every event the log reads, and how many lines it could not. */
function readAll() {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  const { unread } = readTrustLog((event) => events.push(event));
  return { events, unread };
}

describe('record (16.13.4)', () => {
  it('records every event, a line each ended by LF, its own fields in the schema\'s order after the fields the engine sets', () => {
    assert.deepStrictEqual(Object.keys(SAMPLES), Object.keys(SCHEMA.events), 'a sample of every event the schema holds');
    const dir = project('fumi');

    const recorded = Object.entries(SAMPLES).map(([type, fields]) => record(type, fields, from(dir)));

    const lines = logText().split('\n');
    assert.strictEqual(lines.pop(), '');
    assert.deepStrictEqual(lines, recorded.map((event) => JSON.stringify(event)));
    for (const [i, [type, fields]] of Object.entries(SAMPLES).entries()) {
      const { id, at, ...rest } = recorded[i];
      assert.ok(isId(id), `${type}: ${id}`);
      assert.match(/** @type {string} */ (at), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, `${type}: to the millisecond`);
      assert.deepStrictEqual(rest, { v: 1, type, project: PROJECT_ID, project_name: 'fumi', model: null, session: null, ...fields }, type);
      assert.deepStrictEqual(Object.keys(recorded[i]), [...HEADER_FIELDS, ...Object.keys(fields)], `${type}: in the schema's order`);
    }
    assert.strictEqual(new Set(recorded.map((event) => event.id)).size, recorded.length, 'each its own id');
  });

  it('refuses a bad event, saying why, and writes nothing — a type the log does not hold, a field missing, one of the wrong type, a label not the labeller\'s twelve answers (16.11.5), one the type does not hold (no typed text: 16.13.3), and a field the engine sets', () => {
    const dir = project('fumi');
    /** @type {[string, Record<string, unknown>, string][]} */
    const refusals = [
      ['departure', { entry: ENTRY }, 'the trust log holds no departure event: gate, raise, call, verdict, blind-draw, reversal, position-switch, convergence, correction'],
      ['call', { entry: ENTRY, kind: null, label: null }, 'a call event cannot be recorded: the call event needs sort'],
      ['verdict', { ...SAMPLES.verdict, verdict: 'maybe' }, 'a verdict event cannot be recorded: its verdict is not one of nothing, fix, loss, skip'],
      ['raise', { ...SAMPLES.raise, blocked_build: 'yes' }, 'a raise event cannot be recorded: its blocked_build is not true or false, or null'],
      ...[
        { labeller: 'claude-sonnet-5', answers: ANSWERS.slice(1) },
        { labeller: 'claude-sonnet-5', answers: [...ANSWERS.slice(1), 'yes'] },
        { labeller: '', answers: ANSWERS },
        { labeller: 'claude-sonnet-5', answers: ANSWERS, kind: 'look' },
      ].map((label) => /** @type {[string, Record<string, unknown>, string]} */ (['call', { ...SAMPLES.call, label }, NOT_LABEL])),
      ['gate', { ...SAMPLES.gate, text: 'what the person typed' }, 'a gate event cannot be recorded: the gate event has no field text at version 1'],
      ['call', { ...SAMPLES.call, project: idOf('Another') }, 'a call event\'s own fields cannot set project: the engine sets it'],
    ];
    for (const [type, fields, message] of refusals) assert.throws(() => record(type, fields, from(dir)), { message });
    assert.ok(!fs.existsSync(logPath()));
  });

  it('no field carries words, so no decision\'s content reaches the log (16.13.3): a sentence where a row\'s key, a gate\'s name, a slug or a labeller\'s model id belongs is refused, and so is a name or an id past its shape', () => {
    const dir = project('fumi');
    const notKey = (/** @type {string} */ type, /** @type {string} */ name) => `a ${type} event cannot be recorded: its ${name} is not a key: letters, digits, - and _, up to 24 of them${name === 'sealed' ? '' : ', or null'}`;
    /** @type {[string, Record<string, unknown>, string][]} */
    const refusals = [
      ['gate', { ...SAMPLES.gate, picked: SENTENCE }, notKey('gate', 'picked')],
      ['gate', { ...SAMPLES.gate, recommended: 'keep-the-old-one-and-add-a-view' }, notKey('gate', 'recommended')],
      ['gate', { ...SAMPLES.gate, via: 'typed', picked: null, with_text: true, reading: 'the second' }, notKey('gate', 'reading')],
      ['raise', { ...SAMPLES.raise, answer: 'use the existing table, it is fine' }, notKey('raise', 'answer')],
      ['raise', { ...SAMPLES.raise, sealed: 'option one' }, notKey('raise', 'sealed')],
      ['raise', { ...SAMPLES.raise, answer: null, via: 'typed', with_text: true, reading: 'the first one' }, notKey('raise', 'reading')],
      ...[SENTENCE, 'yes, rename it', 'rename customers-table accounts-table right-away', 'State lost gate'].map((gate) => /** @type {[string, Record<string, unknown>, string]} */ (['gate', { ...SAMPLES.gate, gate }, 'a gate event cannot be recorded: its gate is not a gate\'s name: up to five lowercase words, 40 characters at most'])),
      ['position-switch', { ...SAMPLES['position-switch'], unit: SENTENCE }, 'a position-switch event cannot be recorded: its unit is not a slug'],
      ['convergence', { ...SAMPLES.convergence, unit: SENTENCE }, 'a convergence event cannot be recorded: its unit is not a slug'],
      ['convergence', { ...SAMPLES.convergence, topic: SENTENCE }, 'a convergence event cannot be recorded: its topic is not a slug'],
      ...[SENTENCE, `claude-${'x'.repeat(58)}`].map((labeller) => /** @type {[string, Record<string, unknown>, string]} */ (['call', { ...SAMPLES.call, label: { labeller, answers: ANSWERS } }, NOT_LABEL])),
    ];
    for (const [type, fields, message] of refusals) assert.throws(() => record(type, fields, from(dir)), { message });
    assert.ok(!fs.existsSync(logPath()));
  });

  it('records an answer as it came — a row\'s key pressed, or typed with the mod off (6.S18), or free text, typed, naming no row and read as one later — and refuses an event whose fields contradict each other', () => {
    const dir = project('fumi');
    const typedKey = { ...SAMPLES.gate, via: 'typed', picked: 'b' };
    const freeText = { ...SAMPLES.gate, via: 'typed', picked: null, with_text: true, reading: null };
    const freeRaise = { ...SAMPLES.raise, answer: null, via: 'typed', with_text: true, reading: null };
    const notFollowed = { ...SAMPLES.raise, entry: null, answer: null, didnt_follow: true };
    const recorded = [
      ['gate', typedKey], ['gate', freeText], ['gate', { ...freeText, reading: 'b' }],
      ['raise', { ...SAMPLES.raise, via: 'typed' }], ['raise', freeRaise], ['raise', { ...freeRaise, reading: '2' }],
      ['raise', notFollowed], ['raise', { ...notFollowed, via: 'typed', with_text: true }],
    ].map(([type, fields]) => record(/** @type {string} */ (type), /** @type {Record<string, unknown>} */ (fields), from(dir)));
    const disagree = (/** @type {string} */ type, /** @type {string} */ why) => `a ${type} event cannot be recorded: its fields disagree: ${why}`;
    /** @type {(type: string) => Record<string, string>} */
    const why = (type) => ({
      keyboard: disagree(type, 'free text comes only from the keyboard'),
      noRow: disagree(type, 'free text names no row: the separate call reads one from it'),
      unread: disagree(type, 'only free text is read as a row'),
      row: disagree(type, 'an answer that is no free text names its row'),
    });
    const [gate, raise] = [why('gate'), why('raise')];
    const unfollowed = disagree('raise', 'a raise not followed has no answer, no reading and no entry');
    const unlanded = disagree('raise', 'a raise answered has the ledger entry its answer landed as');
    /** @type {[string, Record<string, unknown>, string][]} */
    const refusals = [
      ['gate', { ...freeText, via: 'pressed' }, gate.keyboard],
      ['gate', { ...freeText, picked: 'b' }, gate.noRow],
      ['gate', { ...SAMPLES.gate, reading: 'b' }, gate.unread],
      ['gate', { ...typedKey, reading: 'b' }, gate.unread],
      ['gate', { ...SAMPLES.gate, picked: null }, gate.row],
      ['gate', { ...typedKey, picked: null }, gate.row],
      ['raise', { ...freeRaise, via: 'pressed' }, raise.keyboard],
      ['raise', { ...freeRaise, answer: '2' }, raise.noRow],
      ['raise', { ...SAMPLES.raise, reading: '2' }, raise.unread],
      ['raise', { ...SAMPLES.raise, answer: null }, raise.row],
      ['raise', { ...SAMPLES.raise, entry: null }, unlanded],
      ['raise', { ...freeRaise, entry: null }, unlanded],
      ['raise', { ...notFollowed, answer: '2' }, unfollowed],
      ['raise', { ...notFollowed, entry: ENTRY }, unfollowed],
      ['raise', { ...notFollowed, reading: '2' }, unfollowed],
      ['raise', { ...notFollowed, with_text: true }, raise.keyboard],
      ['reversal', { entry: ENTRY, reverses: ENTRY }, disagree('reversal', 'an entry cannot reverse itself')],
      ['correction', { entry: ENTRY, kind: null, verdict: null }, disagree('correction', 'a correction changes a kind or a verdict, one and not both')],
      ['correction', { entry: ENTRY, kind: 'look', verdict: 'loss' }, disagree('correction', 'a correction changes a kind or a verdict, one and not both')],
    ];
    for (const [type, fields, message] of refusals) assert.throws(() => record(type, fields, from(dir)), { message });
    assert.deepStrictEqual(readAll(), { events: recorded, unread: 0 });
  });

  it('an event recorded before the project has state carries no project', () => {
    const dir = path.join(folder(), 'setting-up');
    pinStateRoot(dir, path.join(dir, STATE_DIR_NAME));

    const event = record('gate', SAMPLES.gate, from(dir));

    assert.deepStrictEqual([event.project, event.project_name], [null, null]);
    assert.deepStrictEqual(readAll().events, [event]);
  });

  it('refuses a project whose manifest holds no project_id, never filling one in: nothing recorded, the manifest as it was, and its events unread (16.13.5)', () => {
    for (const [name, manifest] of /** @type {const} */ ([['before-ids', { work_units: {} }], ['no-manifest', null]])) {
      const dir = project(name, manifest);
      const file = statePath(dir, layout.projectManifest);
      const before = manifest === null ? null : fs.readFileSync(file, 'utf8');

      const message = `the project manifest at ${file} holds no project_id — setup gives the project one as it creates the state, and the trust log knows the project by it`;
      assert.throws(() => record('call', SAMPLES.call, from(dir)), { message });
      assert.throws(() => readProjectEvents(statePath(dir), () => {}), { message });
      assert.strictEqual(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null, before, name);
    }
    assert.ok(!fs.existsSync(logPath()));
  });

  it('carries the conversation\'s session and the model its transcript\'s last assistant message names, each by its id — none where what it is handed is no id: an alias, words or a name past its length for the model, words for the session (16.4.4, 16.13.7)', () => {
    const claude = path.join(folder(), 'claude');
    const dir = project('fumi');
    const pinnedClaude = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = claude;
    /** The session and the model an event records in conversation `session`, its transcript naming `model`. @param {string} session @param {string} model */
    const recorded = (session, model) => {
      const transcript = path.join(claude, 'projects', '-Users-me-fumi', `${session}.jsonl`);
      fs.mkdirSync(path.dirname(transcript), { recursive: true });
      fs.writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { model } })}\n`);
      process.env.CLAUDE_CODE_SESSION_ID = session;
      const event = record('call', SAMPLES.call, from(dir));
      return [event.session, event.model];
    };
    try {
      assert.deepStrictEqual(
        [recorded(SESSION, 'claude-opus-5-5'), recorded(SESSION, 'sonnet'), recorded(SESSION, SENTENCE), recorded(SESSION, `claude-${'x'.repeat(58)}`), recorded('rename-the-customers-table', 'claude-opus-5-5')],
        [[SESSION, 'claude-opus-5-5'], [SESSION, null], [SESSION, null], [SESSION, null], [null, 'claude-opus-5-5']],
      );
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CONFIG_DIR = pinnedClaude;
    }
  });
});

describe('appending', () => {
  it('two processes appending at once on a barrier: every line whole and read, each one\'s in the order it wrote them, and the lock found held', async () => {
    const dir = project('fumi');
    const lock = `${logPath()}.lock`;
    const met = path.join(folder(), 'met');
    const reports = await contend(2, [
      'const [cwd, root, lock, met] = process.argv.slice(1);',
      `require(${JSON.stringify(STATE_ROOT_MODULE)}).pinStateRoot(cwd, root);`,
      `const { record } = require(${JSON.stringify(TRUST_LOG_MODULE)});`,
      'const link = fs.linkSync;',
      'let taken = 0;',
      "fs.linkSync = (from, to) => { try { return link(from, to); } catch (err) { if (to === lock && err.code === 'EEXIST') { taken += 1; fs.writeFileSync(met, ''); } throw err; } };",
      'atBarrier();',
      // Each appends ten at least, and goes on until one of them has found the lock held.
      'const ids = [];',
      `while (ids.length < 10 || (!fs.existsSync(met) && ids.length < 1000)) ids.push(record('call', ${JSON.stringify(SAMPLES.call)}, { cwd, warnings: [] }).id);`,
      'report({ taken, ids });',
    ].join('\n'), [dir, statePath(dir), lock, met]);

    assert.ok(reports[0].taken + reports[1].taken > 0, 'neither found the lock held: the two never met');
    const { events, unread } = readAll();
    const read = events.map((event) => event.id);
    assert.strictEqual(unread, 0);
    assert.strictEqual(read.length, reports[0].ids.length + reports[1].ids.length);
    for (const { ids } of reports) assert.deepStrictEqual(read.filter((id) => ids.includes(id)), ids);
  });

  it('a last line a writer that died mid-append left unterminated is cut away, under the lock, before the next line', (t) => {
    const dir = project('fumi');
    const kept = record('call', SAMPLES.call, from(dir));
    fs.appendFileSync(logPath(), '{"v":1,"id":"Torn');
    const truncate = fs.ftruncateSync;
    /** @type {unknown[]} */
    const heldBy = [];
    t.mock.method(fs, 'ftruncateSync', (/** @type {number} */ fd, /** @type {number} */ len) => {
      heldBy.push(JSON.parse(fs.readFileSync(`${logPath()}.lock`, 'utf8')).pid);
      return truncate(fd, len);
    });

    const next = record('verdict', SAMPLES.verdict, from(dir));

    assert.strictEqual(logText(), `${JSON.stringify(kept)}\n${JSON.stringify(next)}\n`);
    assert.deepStrictEqual(heldBy, [process.pid]);
  });
});

describe('an append that fails (16.13.3, 16.S74)', () => {
  const WAITS = ' — the event waits in the conversation, appended first by its next record';

  it('is a warning, the events of two failures waiting in the conversation in order; its next record appends them first, and they wait no more (16.S74)', (t) => {
    const dir = project('fumi');
    inConversation(dir, () => {
      const failing = failingTrustAppends(t);
      /** @type {string[]} */
      const warnings = [];
      const waiting = [record('call', SAMPLES.call, from(dir, warnings)), record('verdict', SAMPLES.verdict, from(dir, warnings))];
      assert.deepStrictEqual(warnings, Array(2).fill(`the trust log was not written: ${NO_SPACE}${WAITS}`));
      assert.deepStrictEqual([logText(), fs.readFileSync(waitingPath(), 'utf8')], ['', lines(...waiting)]);

      failing.mock.restore();
      const next = record('gate', SAMPLES.gate, from(dir, warnings));

      assert.strictEqual(logText(), lines(...waiting, next));
      assert.strictEqual(warnings.length, 2);
      assert.ok(!fs.existsSync(waitingPath()));
    });
  });

  it('appended again after it landed but failed, is read once (16.S74)', (t) => {
    const dir = project('fumi');
    inConversation(dir, () => {
      const failing = failingTrustAppends(t, true);
      const landed = record('call', SAMPLES.call, from(dir));
      failing.mock.restore();
      const next = record('verdict', SAMPLES.verdict, from(dir));

      assert.strictEqual(logText(), lines(landed, landed, next));
      assert.deepStrictEqual(readAll(), { events: [landed, next], unread: 0 });
    });
  });

  it('lands the waiting events this engine reads as parsed, a duplicate key\'s first text gone; leaves a newer release\'s line waiting, never lost; and drops any other line with a warning saying why (16.13.2)', (t) => {
    const dir = project('fumi');
    inConversation(dir, () => {
      const failing = failingTrustAppends(t);
      const waiting = record('call', SAMPLES.call, from(dir));
      failing.mock.restore();
      const duplicate = { ...waiting, id: idOf('Duplicate') };
      const later = JSON.stringify({ ...waiting, v: 2, id: idOf('Later') });
      fs.appendFileSync(waitingPath(), [
        'not even JSON',
        JSON.stringify({ ...waiting, id: idOf('Misshapen'), sort: 'many' }),
        JSON.stringify(duplicate).replace('"sort":"one"', '"sort":"rename the customers table","sort":"one"'),
        later,
        '',
      ].join('\n'));
      /** @type {string[]} */
      const warnings = [];

      const next = record('verdict', SAMPLES.verdict, from(dir, warnings));

      assert.strictEqual(logText(), lines(waiting, duplicate, next));
      assert.deepStrictEqual(warnings, [
        `a line waiting for the trust log in ${waitingPath()} was dropped: it is not JSON`,
        `a line waiting for the trust log in ${waitingPath()} was dropped: its sort is not one of one, several, or null`,
      ]);
      assert.strictEqual(fs.readFileSync(waitingPath(), 'utf8'), `${later}\n`, 'the newer release\'s line waits on, and so its folder stays');
      assert.deepStrictEqual(fs.readdirSync(conversationDir(SESSION)).filter((name) => name.endsWith('.tmp')), []);
    });
  });

  it('before the project has state, waits in a folder made for the conversation, which the engine has not marked, and lands with its next record (16.13.5)', (t) => {
    const dir = path.join(folder(), 'setting-up');
    pinStateRoot(dir, path.join(dir, STATE_DIR_NAME));
    inConversation(dir, () => {
      const failing = failingTrustAppends(t);
      /** @type {string[]} */
      const warnings = [];
      const waiting = record('gate', SAMPLES.gate, from(dir, warnings));
      assert.deepStrictEqual(warnings, [`the trust log was not written: ${NO_SPACE}${WAITS}`]);
      assert.strictEqual(fs.readFileSync(waitingPath(), 'utf8'), lines(waiting));
      assert.ok(!isMarked(SESSION), 'the folder is the trust log\'s, the conversation unmarked');

      failing.mock.restore();
      const next = record('gate', SAMPLES.gate, from(dir));

      assert.strictEqual(logText(), lines(waiting, next));
    });
  });

  it('a line a keeper killed mid-append left unterminated in the conversation\'s file is cut away before the next event waits there, so it swallows none (16.S74)', (t) => {
    const dir = project('fumi');
    inConversation(dir, () => {
      const failing = failingTrustAppends(t);
      const first = record('call', SAMPLES.call, from(dir));
      fs.appendFileSync(waitingPath(), '{"v":1,"id":"Torn');
      const second = record('verdict', SAMPLES.verdict, from(dir));
      assert.strictEqual(fs.readFileSync(waitingPath(), 'utf8'), lines(first, second));

      failing.mock.restore();
      const next = record('gate', SAMPLES.gate, from(dir));

      assert.strictEqual(logText(), lines(first, second, next));
    });
  });

  /** Each that lands what waits in a conversation: by its role in the race. */
  const LANDERS = Object.freeze({ boot: 'a boot\'s pass', record: 'a record of another event, a subagent\'s say' });

  for (const [role, lander] of Object.entries(LANDERS)) {
    it(`the conversation's file holds a lock of its own: an event kept while ${lander} lands what waits there is never lost, the lock found held (16.S74)`, async (t) => {
      const dir = project('fumi');
      const [tried, kept] = ['tried', 'kept'].map((name) => path.join(folder(), name));
      const race = [
        'const [role, cwd, root, pending, tried, kept] = process.argv.slice(1);',
        `require(${JSON.stringify(STATE_ROOT_MODULE)}).pinStateRoot(cwd, root);`,
        `const { appendWaiting, record, trustLogPath } = require(${JSON.stringify(TRUST_LOG_MODULE)});`,
        "if (role !== 'keeper') {",
        // Holding both locks, the lander has read what waits; it lands it once the keeper has found the lock held.
        '  const read = fs.readFileSync;',
        '  fs.readFileSync = (file, ...rest) => {',
        '    const text = read(file, ...rest);',
        '    if (file !== pending) return text;',
        '    atBarrier();',
        '    const until = Date.now() + 10000;',
        '    while (!fs.existsSync(tried) && !fs.existsSync(kept) && Date.now() < until) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);',
        '    return text;',
        '  };',
        '  const warnings = [];',
        `  const id = role === 'boot' ? (appendWaiting(cwd, warnings), null) : record('call', ${JSON.stringify(SAMPLES.call)}, { cwd, warnings }).id;`,
        '  report({ id, warnings });',
        '} else {',
        // The keeper's log is out of reach, so its event goes straight to waiting.
        '  const mkdir = fs.mkdirSync;',
        "  fs.mkdirSync = (at, ...rest) => { if (at === require('path').dirname(trustLogPath())) throw new Error('EROFS: read-only file system'); return mkdir(at, ...rest); };",
        '  const link = fs.linkSync;',
        '  let taken = 0;',
        "  fs.linkSync = (from, to) => { try { return link(from, to); } catch (err) { if (to === `${pending}.lock` && err.code === 'EEXIST') { taken += 1; fs.writeFileSync(tried, ''); } throw err; } };",
        '  const append = fs.appendFileSync;',
        "  fs.appendFileSync = (file, ...rest) => { append(file, ...rest); if (file === pending) fs.writeFileSync(kept, ''); };",
        '  atBarrier();',
        '  const warnings = [];',
        `  report({ id: record('call', ${JSON.stringify(SAMPLES.call)}, { cwd, warnings }).id, taken, warnings });`,
        '}',
      ].join('\n');

      const failing = failingTrustAppends(t);
      const waited = inConversation(dir, () => record('call', SAMPLES.call, from(dir)));
      failing.mock.restore();
      process.env.CLAUDE_CODE_SESSION_ID = SESSION;
      /** @type {any[]} */
      let reports;
      try {
        reports = await contend(2, race, (i) => [i === 0 ? role : 'keeper', dir, statePath(dir), waitingPath(), tried, kept]);
      } finally {
        delete process.env.CLAUDE_CODE_SESSION_ID;
      }
      const [landed, keeper] = reports;

      assert.ok(keeper.taken > 0, 'the keeper never found the lock held: the two never met');
      assert.deepStrictEqual(landed.warnings, []);
      appendWaiting(dir, []);
      assert.deepStrictEqual(readAll().events.map((event) => event.id), [waited.id, ...(landed.id === null ? [] : [landed.id]), keeper.id]);
    });
  }

  it('a boot\'s pass skips a conversation whose waiting events another boot landed, its folder tidied away, while it waited for the lock — no warning — and lands the rest', (t) => {
    const dir = project('fumi');
    const failing = failingTrustAppends(t);
    const [, kept] = ['sess-gone', 'sess-kept'].map((session) => inConversation(dir, () => record('call', SAMPLES.call, from(dir)), session));
    failing.mock.restore();
    const link = fs.linkSync;
    t.mock.method(fs, 'linkSync', (/** @type {string} */ from, /** @type {string} */ to) => {
      if (to === `${logPath()}.lock`) fs.rmSync(conversationDir('sess-gone'), { recursive: true, force: true });
      return link(from, to);
    });
    /** @type {string[]} */
    const warnings = [];

    appendWaiting(dir, warnings);

    assert.deepStrictEqual(warnings, []);
    assert.strictEqual(logText(), lines(kept));
  });

  it('waiting past its bound on the lock another holds, names the trust log\'s lock, and the event waits', (t) => {
    const dir = project('fumi');
    const lock = `${logPath()}.lock`;
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    const now = Date.now;
    let late = 0;
    t.mock.method(Date, 'now', () => now() + late);
    lockAttempts(t, lock, () => { late = 60 * 60 * 1000; });
    /** @type {string[]} */
    const warnings = [];

    const waiting = inConversation(dir, () => record('call', SAMPLES.call, from(dir, warnings)));

    assert.deepStrictEqual(warnings, [`the trust log was not written: Timed out waiting for the trust log's lock (lock file: ${lock}) — process ${process.pid} holds it${WAITS}`]);
    assert.deepStrictEqual([logText(), fs.readFileSync(waitingPath(), 'utf8')], ['', lines(waiting)]);
  });

  it('with no session id, so no conversation to keep it in, is a warning that the event is lost', (t) => {
    const dir = project('fumi');
    failingTrustAppends(t);
    /** @type {string[]} */
    const warnings = [];

    record('call', SAMPLES.call, from(dir, warnings));

    assert.deepStrictEqual(warnings, [`the trust log was not written: ${NO_SPACE} — the event is lost, with no conversation to keep it in`]);
    assert.ok(!fs.existsSync(path.join(folder(), 'config', 'conversations')));
  });

  it('keeps an event ahead of its entry until a landing judges it by the ledger it waits on: one from another state leaves it, one from its own lands it once the entry is there, and one holding that state\'s writer lock lets go of it where the entry never came', () => {
    const dir = project('fumi');
    const elsewhere = project('aircon', { project_id: idOf('Aircon') });
    const [root, theirs] = [dir, elsewhere].map((at) => statePath(at));
    const [appended, never] = ['Appended', 'Never'].map(idOf);
    fs.writeFileSync(path.join(root, '.ledger.jsonl'), `${JSON.stringify({ id: appended })}\n`);
    /** @type {string[]} */
    const warnings = [];
    const kept = inConversation(dir, () => [appended, never].map((entry) => {
      const event = newEvent('call', { ...SAMPLES.call, entry }, dir);
      keepEvent(event, root, entry);
      return event;
    }));
    const waiting = () => fs.readFileSync(waitingPath(), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).event.entry);

    inConversation(elsewhere, () => withWriterLock(theirs, () => landKept(elsewhere, warnings)));
    assert.deepStrictEqual([logText(), waiting()], ['', [appended, never]]);
    inConversation(dir, () => landKept(dir, warnings));
    assert.deepStrictEqual([logText(), waiting()], [lines(kept[0]), [never]]);
    inConversation(dir, () => withWriterLock(root, () => landKept(dir, warnings)));

    assert.deepStrictEqual([logText(), fs.existsSync(waitingPath()), warnings], [lines(kept[0]), false, []]);
  });

  it('drops, with a warning, a kept line of its version whose awaits names no ledger and entry — null, none, a string — and lands the rest of its file and every conversation after it in boot\'s pass', () => {
    const dir = project('fumi');
    const [event, after, later] = ['gate', 'verdict', 'reversal'].map((type) => newEvent(type, SAMPLES[/** @type {keyof typeof SAMPLES} */ (type)], dir));
    const [bad, next] = ['session-a', 'session-b'].map((session) => waitingPath(session));
    const awaits = [null, {}, 'the note window'];
    for (const file of [bad, next]) fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(bad, lines(...awaits.map((awaited) => ({ v: 1, awaits: awaited, event })), after));
    fs.writeFileSync(next, lines(later));
    /** @type {string[]} */
    const warnings = [];

    appendWaiting(dir, warnings);

    assert.deepStrictEqual([logText(), [bad, next].map((file) => fs.existsSync(file))], [lines(after, later), [false, false]]);
    assert.deepStrictEqual(warnings, awaits.map((awaited) => `a line waiting for the trust log in ${bad} was dropped: what it awaits, ${JSON.stringify(awaited)}, is no ledger and entry`));
  });

  it('leaves waiting, never dropped, a kept line of a version it does not write — none, a later one — and one holding a newer release\'s event, though its entry is there and the writer lock held; a landing that changes nothing leaves the file as it was', () => {
    const dir = project('fumi');
    const root = statePath(dir);
    const entry = idOf('Appended');
    fs.writeFileSync(path.join(root, '.ledger.jsonl'), `${JSON.stringify({ id: entry })}\n`);
    const event = newEvent('call', { ...SAMPLES.call, entry }, dir);
    const awaits = { ledger: root, entry };
    const waiting = lines({ after: awaits, event }, { v: 2, awaits, event }, { v: 1, awaits, event: { ...event, v: 2 } });
    fs.mkdirSync(path.dirname(waitingPath()), { recursive: true });
    fs.writeFileSync(waitingPath(), waiting);
    const was = fs.statSync(waitingPath()).ino;
    /** @type {string[]} */
    const warnings = [];

    appendWaiting(dir, warnings);

    assert.deepStrictEqual([logText(), fs.readFileSync(waitingPath(), 'utf8'), fs.statSync(waitingPath()).ino, warnings], ['', waiting, was, []]);
  });
});

describe('reading', () => {
  it('skips and counts each line it cannot read — a newer release\'s version, a type it does not know, a line no event, one of the wrong shape, a time that is none, a session that is no session id, one followed by words or one in capitals, words for a model, an unterminated last line — and never stops', () => {
    const dir = project('fumi');
    const first = record('call', SAMPLES.call, from(dir));
    const unreadable = [
      { ...first, v: 2 },
      { ...first, type: 'labelled' },
      'not an event',
      { ...first, sort: 'many' },
      { ...first, at: 'yesterday' },
      { ...first, session: 'sess-1' },
      { ...first, session: `${SESSION} ${SENTENCE}` },
      { ...first, session: SESSION.toUpperCase() },
      { ...first, model: 'rename the customers table to accounts' },
    ];
    fs.appendFileSync(logPath(), unreadable.map((line) => `${typeof line === 'string' ? line : JSON.stringify(line)}\n`).join(''));
    const last = record('verdict', SAMPLES.verdict, from(dir));
    fs.appendFileSync(logPath(), JSON.stringify({ ...last, id: idOf('Unended') }));

    assert.deepStrictEqual(readAll(), { events: [first, last], unread: 10 });
  });

  it('reads no log as empty', () => {
    assert.deepStrictEqual(readAll(), { events: [], unread: 0 });
  });
});
