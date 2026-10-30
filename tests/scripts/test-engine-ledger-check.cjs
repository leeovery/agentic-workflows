'use strict';

// ---------------------------------------------------------------------------
// The one-decision check (leeway-engine/scripts/domain/ledger-one-decision
// .cjs) and its late check (domain/ledger-late-check.cjs): every decision
// `ledger decide` writes, and every one `ledger replace` writes in place of
// a decision, judged by the separate Claude call before the writer lock,
// once its links pass — one rule lands checked, several are refused for the
// writer to split, and a call that cannot run, or fails in any way, lands
// the entry unchecked; then, at a later start,
// boot launches the late check, detached and one at a time, which records
// what it finds beside each unchecked decision and commits it, never
// touching the entry's line, a decision found holding several rules showing
// flagged wherever its record is read.
//
// Real repositories in temp folders, each with its state worktree, the work
// unit's manifest written there; the separate call is the suite's stub
// binary (claude-stub.cjs), armed per test with its answers, every call it
// takes recorded.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { holdLock, lockAttempts, ok, refuses, refusedPristine, head, stateGit, statePath, layout, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, SESSION_ID, MADE, NOTE, ledgerWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { PROMPT, SCHEMA, judgeDecision } = require(path.join(SCRIPTS, 'domain/ledger-one-decision.cjs'));
const { launchLateCheck } = require(path.join(SCRIPTS, 'domain/ledger-late-check.cjs'));
const { launcher } = require(path.join(SCRIPTS, 'kernel/call.cjs'));
const claudeCall = require(path.join(SCRIPTS, 'kernel/claude-call.cjs'));

const SPEC = `${UNIT}.specification`;
const DETACHED_MS = 20000;

const PHASES = Object.freeze({
  discovery: { items: { 'note-window': {} } },
  discussion: { items: { 'note-window': { status: 'in-progress' } } },
});

const PANEL = 'A near-frameless floating panel.';
const SYNC = 'Notes sync between Macs through CloudKit.';
const BOTH = `${PANEL} ${SYNC}`;

/** @type {string} */
let dir;
/** @type {string} */
let log;

beforeEach(() => {
  dir = ledgerWorld('ledger-check-', PHASES);
  log = path.join(dir, 'claude-calls.jsonl');
});

afterEach(() => {
  cleanupFixture(dir);
});

/**
 * A call's environment: this session, the stub armed with `answers` — by
 * what the input holds — or, given none, with no login; every call logged.
 * @param {Record<string, unknown>} [answers] @param {string} [session]
 * @returns {Record<string, string|undefined>}
 */
function armed(answers, session = SESSION_ID) {
  return { CLAUDE_CODE_SESSION_ID: session, CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: answers === undefined ? undefined : JSON.stringify(answers) };
}

/** The rules the stub answers. @param {...string} rules */
function rules(...rules) {
  return { rules };
}

const ledger = ledgerHelpers(() => dir);
const { ledgerText, entries, full } = ledger;

/**
 * One ledger write that must succeed: its response.
 * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
 * @param {Record<string, unknown>} [answers]
 */
function write(verb, address, flags, content, answers) {
  return ledger.write(verb, address, flags, content, armed(answers));
}

/** A question asked at `address`: its short id. @param {string} [address] @param {string} [text] */
function ask(address = NOTE, text = 'What is a note, at its most basic?') {
  return write('ask', address, [], { ...MADE, text }).id;
}

/**
 * A decision answering `question`: its short id.
 * @param {string} question @param {string} text @param {Record<string, unknown>} [answers]
 * @param {{address?: string, content?: Record<string, unknown>}} [opts]
 */
function decide(question, text, answers, { address = NOTE, content = {} } = {}) {
  return write('decide', address, ['--answers', question], { ...MADE, text, why: 'Notes are furniture on the desk.', ...content }, answers).id;
}

/** The event a short id names. @param {string} short */
function eventOf(short) {
  return /** @type {Record<string, any>} */ (entries().find((e) => e.id === full(short)));
}

/** What each call handed the stub. @returns {{argv: string[], input: string}[]} */
function calls() {
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

/** `ledger late-check`, the stub armed with `answers`, run by `session`. @param {Record<string, unknown>} [answers] @param {string} [session] */
function lateCheck(answers, session = 'session-2') {
  return ok(dir, ['ledger', 'late-check'], { env: armed(answers, session) });
}

/** A read verb's answer. @param {...string} args */
function read(...args) {
  return ok(dir, ['ledger', ...args]);
}

/** The value of a flag the call was handed. @param {string[]} argv @param {string} flag */
function flagValue(argv, flag) {
  return argv[argv.indexOf(flag) + 1];
}

/**
 * The separate call answered in process, in turn, by `answers` — each a
 * call's answer, or an error it throws — for the length of the test; how
 * many times it was called.
 * @param {import('node:test').TestContext} t @param {(import('../../skills/leeway-engine/scripts/kernel/claude-call.cjs').Answer|Error)[]} answers
 * @returns {{count: number}}
 */
function callAnswering(t, answers) {
  const made = { count: 0 };
  t.mock.method(claudeCall, 'askClaude', () => {
    const answer = answers[made.count];
    made.count += 1;
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return made;
}

describe('the one-decision check, as a decision is written (5.5.2, 5.5.3, 16.19.6)', () => {
  it('lands a decision holding one rule checked: the call judged the entry\'s own content alone — its answer, why and what it rules out — on Opus, with the check\'s prompt and schema', () => {
    const question = ask();

    const id = decide(question, PANEL, { [PANEL]: rules(PANEL) }, { content: { rules_out: ['a standard titled window', 'a sheet'] } });

    assert.strictEqual(eventOf(id).unchecked, false);
    const [call] = calls();
    assert.strictEqual(call.input, `The answer: ${PANEL}\n\nWhy: Notes are furniture on the desk.\n\nWhat it rules out:\n- a standard titled window\n- a sheet`);
    assert.deepStrictEqual([flagValue(call.argv, '--model'), flagValue(call.argv, '--effort')], ['opus', 'high']);
    assert.strictEqual(flagValue(call.argv, '--system-prompt'), PROMPT);
    assert.deepStrictEqual(JSON.parse(flagValue(call.argv, '--json-schema')), SCHEMA);
  });

  it('says so where the entry rules nothing out', () => {
    decide(ask(), PANEL, { [PANEL]: rules(PANEL) });

    assert.strictEqual(calls()[0].input, `The answer: ${PANEL}\n\nWhy: Notes are furniture on the desk.\n\nWhat it rules out: nothing named`);
  });

  it('judges a replacement of a decision as it is written; a replacement of a question or a finding, and every write that makes no decision, makes no call', () => {
    const question = ask();
    const finding = write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike', known: 'spike' }).id;
    const decision = decide(question, PANEL, { '': rules(PANEL) });
    write('replace', NOTE, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: ['basic'], text: 'What is a note?' });
    write('replace', NOTE, ['--replaces', finding, '--reason', 'was-wrong'], { ...MADE, drops: ['every Space'], text: 'Panels float above the active Space.', how: 'a second spike', known: 'spike' });
    assert.strictEqual(calls().length, 1, 'a write that makes no decision made a call');

    const replacement = write('replace', NOTE, ['--replaces', decision, '--reason', 'changed-mind'], { ...MADE, drops: ['near-frameless'], text: 'A frameless panel.', why: 'Lighter.' }, { 'A frameless panel.': rules('A frameless panel.') }).id;

    assert.strictEqual(calls().length, 2);
    assert.strictEqual(calls()[1].input, 'The answer: A frameless panel.\n\nWhy: Lighter.\n\nWhat it rules out: nothing named');
    assert.deepStrictEqual([eventOf(replacement).of, eventOf(replacement).unchecked], ['decision', false]);
  });

  it('refuses a decision holding several rules, appending and committing nothing, naming the rules; split, each part answers the question the whole answered, and both land checked as its siblings (5.S4, 5.S31)', () => {
    const question = ask();
    const res = refusedPristine(dir, ['ledger', 'decide', NOTE, '--answers', question], { env: armed({ [BOTH]: rules(PANEL, SYNC) }), stdin: JSON.stringify({ ...MADE, text: BOTH, why: 'Two things at once.' }) });

    assert.strictEqual(res.error, `ledger decide: the decision holds 2 rules, and an entry holds one — nothing appended. Split it: decide each as its own entry answering ${question}:\n  1. ${PANEL}\n  2. ${SYNC}`);
    assert.deepStrictEqual(res.rules, [PANEL, SYNC]);

    const parts = [PANEL, SYNC].map((text) => decide(question, text, { [text]: rules(text) }));

    assert.deepStrictEqual(parts.map((part) => [eventOf(part).answers, eventOf(part).unchecked]), [[full(question), false], [full(question), false]]);
    const [row] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([row.stands, row.answers.map((/** @type {{id: string}} */ a) => a.id)], ['answered', parts]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions.map((/** @type {{id: string}} */ d) => d.id), parts);
  });

  it('refuses a replacement holding several rules the same way: one rule replaces the old, and each other is decided answering the question it answers', () => {
    const question = ask();
    const decision = decide(question, PANEL, { '': rules(PANEL) });
    const res = refusedPristine(dir, ['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind'], {
      env: armed({ [BOTH]: rules(PANEL, SYNC) }), stdin: JSON.stringify({ ...MADE, drops: [], text: BOTH, why: 'Two things at once.' }),
    });

    assert.strictEqual(res.error, `ledger replace: the decision holds 2 rules, and an entry holds one — nothing appended. Split it: replace ${decision} with one of them, and decide each other as its own entry answering ${question}:\n  1. ${PANEL}\n  2. ${SYNC}`);
  });

  it('spends no call on a decision its links refuse: an answer to no question, to a prefix naming nothing, a replacement caused by what it replaces — each refused as under the lock, no call made, nothing appended', () => {
    const question = ask();
    const finding = write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike', known: 'spike' }).id;
    const decision = decide(question, PANEL, { '': rules(PANEL) });
    const before = { ledger: ledgerText(), calls: calls().length };
    const content = JSON.stringify({ ...MADE, text: SYNC, why: 'Because.' });
    const env = armed({ '': rules(SYNC) });

    assert.match(refuses(dir, ['ledger', 'decide', NOTE, '--answers', finding], { env, stdin: content }).error, new RegExp(`^ledger decide --answers names ${finding}, .* — it must name a question$`));
    assert.match(refuses(dir, ['ledger', 'decide', NOTE, '--answers', 'fffffff'], { env, stdin: content }).error, /^ledger decide --answers: no ledger entry's id begins "fffffff"$/);
    assert.match(refuses(dir, ['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind', '--cause', decision], {
      env, stdin: JSON.stringify({ ...MADE, drops: [], text: SYNC, why: 'Because.' }),
    }).error, new RegExp(`^ledger replace --cause names ${decision}, the entry it replaces`));
    assert.deepStrictEqual({ ledger: ledgerText(), calls: calls().length }, before, 'a call was spent on a write its links refuse');
  });

  it('reads the ledger before the lock once for a replacement, as for a decision: the one reading gives the replacement its kind and checks its links before the call', (t) => {
    const question = ask();
    const decision = decide(question, PANEL, { '': rules(PANEL) });
    const open = fs.openSync;
    let reads = 0;
    t.mock.method(fs, 'openSync', (/** @type {fs.PathLike} */ file, /** @type {fs.OpenMode} */ flags, /** @type {any[]} */ ...rest) => {
      if (flags === 'r' && String(file).endsWith(layout.ledger)) reads += 1;
      return open(file, flags, ...rest);
    });
    /** The ledger's reads a write makes. @param {() => void} written */
    const readsOf = (written) => {
      const before = reads;
      written();
      return reads - before;
    };

    const deciding = readsOf(() => decide(question, SYNC, { '': rules(SYNC) }));
    const replacing = readsOf(() => write('replace', NOTE, ['--replaces', decision, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'A frameless panel.', why: 'Lighter.' }, { '': rules('A frameless panel.') }));

    assert.ok(deciding > 0, 'the write read no ledger');
    assert.strictEqual(replacing, deciding, 'a replacement read the ledger again before the lock');
  });

  it('lands the decision unchecked where the call cannot run — no login, a rate limit, an outage, an answer that does not fit, no temp folder to run it from — and the write answers as ever, recording never stopped for the call', () => {
    const question = ask();
    const nowhere = { TMPDIR: path.join(dir, 'nowhere') };

    for (const [i, [answer, overlay]] of /** @type {[unknown, Record<string, string>][]} */ ([
      [undefined, {}], ['rate-limit', {}], ['failed', {}], ['misfit', {}], [{ rules: [] }, {}], [{ rules: 'one' }, {}], [rules(PANEL), nowhere],
    ]).entries()) {
      const text = `Answer ${i}.`;
      const res = ok(dir, ['ledger', 'decide', NOTE, '--answers', question], {
        env: { ...armed(answer === undefined ? undefined : { '': answer }), ...overlay }, stdin: JSON.stringify({ ...MADE, text, why: 'Because.' }),
      });
      assert.deepStrictEqual(Object.keys(res), ['ok', 'id', 'committed'], JSON.stringify(answer));
      assert.strictEqual(eventOf(res.id).unchecked, true, JSON.stringify(answer));
      assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
    }
    assert.strictEqual(calls().length, 6, 'a call ran with no temp folder to run it from');
  });

  it('lands the decision unchecked where the call throws, whatever it throws — the call\'s failure is the check\'s, never the write\'s', (t) => {
    const question = ask();
    const made = callAnswering(t, [new Error('spawnSync claude EAGAIN'), new Error('spawnSync claude EAGAIN')]);

    assert.deepStrictEqual(judgeDecision({ text: PANEL, why: 'Because.', rules_out: [] }, { cwd: dir, unit: UNIT, verb: 'decide', warnings: [] }), { cannot: 'failed', detail: 'spawnSync claude EAGAIN' });
    const res = write('decide', NOTE, ['--answers', question], { ...MADE, text: PANEL, why: 'Because.' });

    assert.strictEqual(made.count, 2);
    assert.strictEqual(eventOf(res.id).unchecked, true);
  });

  it('runs before the writer lock: a peer holding the lock never holds the call up — a decision holding several rules is refused without trying the lock, and one holding one is judged before the write waits its turn', (t) => {
    const question = ask();
    const lock = holdLock(statePath(dir, layout.lock));
    const env = armed({ [BOTH]: rules(PANEL, SYNC), [PANEL]: rules(PANEL) });
    /** @type {{calls: number, entries: number}[]} */
    const whileHeld = [];
    // The lock is let go at the write's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      whileHeld.push({ calls: calls().length, entries: entries().length });
      if (taken === 2) fs.unlinkSync(lock);
    });

    const refused = refuses(dir, ['ledger', 'decide', NOTE, '--answers', question], { env, stdin: JSON.stringify({ ...MADE, text: BOTH, why: 'Two things.' }) });
    assert.match(refused.error, /the decision holds 2 rules/);
    assert.deepStrictEqual([attempts, calls().length], [[], 1], 'the refusal tried the lock');

    ok(dir, ['ledger', 'decide', NOTE, '--answers', question], { env, stdin: JSON.stringify({ ...MADE, text: PANEL, why: 'One thing.' }) });

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(whileHeld, [{ calls: 2, entries: 1 }, { calls: 2, entries: 1 }], 'the call waited on the lock');
    assert.deepStrictEqual([entries().length, entries()[1].text, entries()[1].unchecked], [2, PANEL, false]);
  });
});

describe('the late check (16.19.8, 5.S34)', () => {
  it('is launched by boot, detached, where a decision landed unchecked and nothing has checked it — and not where none is owed', (t) => {
    /** @type {string[]} */
    const launched = [];
    t.mock.method(launcher, 'launch', (/** @type {string} */ root, /** @type {string[]} */ argv) => {
      if (argv.join(' ') === 'ledger late-check') launched.push(root);
    });

    ok(dir, ['boot']);
    decide(ask(), PANEL, { '': rules(PANEL) });
    ok(dir, ['boot']);
    assert.deepStrictEqual(launched, [], 'launched with no decision owed a check');

    decide(ask(SPEC, 'Does the spec cover a second display?'), SYNC, undefined, { address: SPEC });
    ok(dir, ['boot']);
    assert.deepStrictEqual(launched, [fs.realpathSync(statePath(dir))]);

    lateCheck({ '': rules(SYNC) });
    ok(dir, ['boot']);
    assert.strictEqual(launched.length, 1, 'launched again once the decision was checked');
  });

  it('judges each decision owed a check and records the result beside it — a `checked` event tagged as the entry is, each committed — every line before it byte for byte as it was (5.S34)', () => {
    const onTopic = decide(ask(), PANEL);
    const atUnit = decide(ask(SPEC, 'Does the spec cover a second display?'), BOTH, undefined, { address: SPEC });
    const before = ledgerText();
    const tip = head(dir);

    const res = lateCheck({ [BOTH]: rules(PANEL, SYNC), [PANEL]: rules(PANEL) });

    assert.deepStrictEqual(res, { ok: true, ran: true, checked: 2, several: 1, owed: 0 });
    const after = ledgerText();
    assert.ok(after.startsWith(before), 'a line the ledger held changed');
    const added = after.slice(before.length).split('\n').slice(0, -1).map((line) => JSON.parse(line));
    assert.deepStrictEqual(added.map(({ event, unit, topic, phase, session, entry, rules: found }) => ({ event, unit, topic, phase, session, entry, rules: found })), [
      { event: 'checked', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION_ID, entry: full(onTopic), rules: 'one' },
      { event: 'checked', unit: UNIT, topic: null, phase: 'specification', session: SESSION_ID, entry: full(atUnit), rules: 'several' },
    ]);
    assert.deepStrictEqual([eventOf(onTopic).unchecked, eventOf(atUnit).unchecked], [true, true]);
    const commits = stateGit(dir, ['rev-list', `${tip}..HEAD`]).trim().split('\n');
    assert.strictEqual(commits.length, 2, 'each result is a commit of its own');
    for (const commit of commits) assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', commit]).trim(), layout.ledger);
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), after);

    assert.deepStrictEqual(lateCheck({ '': rules(PANEL) }), { ok: true, ran: true, checked: 0, several: 0, owed: 0 });
    assert.strictEqual(ledgerText(), after, 'a decision was checked twice');
  });

  it('flags a decision found holding several rules wherever its record is read — the record, the chain it is folded into, the product record, the map — and shows one found holding one', () => {
    const question = ask();
    const flagged = decide(question, BOTH, undefined, { content: { product_wide: true } });
    const single = decide(question, SYNC);
    const checkedAtWrite = decide(ask(NOTE, 'Does a note snap to a grid?'), PANEL, { '': rules(PANEL) });
    lateCheck({ [BOTH]: rules(PANEL, SYNC), [SYNC]: rules(SYNC) });

    /** @param {{id: string, late_check?: string}[]} shown */
    const lateChecks = (shown) => shown.map((e) => [e.id, e.late_check ?? null]);
    assert.deepStrictEqual(lateChecks(read('record', UNIT, 'note-window').decisions), [[flagged, 'several'], [single, 'one'], [checkedAtWrite, null]]);
    assert.deepStrictEqual(lateChecks(read('record', UNIT).decisions), [[flagged, 'several'], [single, 'one'], [checkedAtWrite, null]]);
    assert.deepStrictEqual(lateChecks(read('product').decisions), [[flagged, 'several']]);
    assert.deepStrictEqual(lateChecks(read('map', UNIT, 'note-window').questions[0].answers), [[flagged, 'several'], [single, 'one']]);

    const replacement = write('replace', NOTE, ['--replaces', flagged, '--reason', 'changed-mind'], { ...MADE, drops: [SYNC], text: PANEL, why: 'One rule.' }, { '': rules(PANEL) }).id;
    const current = read('record', UNIT, 'note-window').decisions.find((/** @type {{id: string}} */ d) => d.id === replacement);
    assert.deepStrictEqual([current.late_check ?? null, lateChecks(current.replaced)], [null, [[flagged, 'several']]]);
  });

  it('works one at a time: a second check finds the first\'s claim and ends at once, appending nothing; a claim whose owner is gone stands for no one', () => {
    const decision = decide(ask(), PANEL);
    const claim = holdLock(statePath(dir, layout.cache('.late-check')));
    const before = { ledger: ledgerText(), calls: calls().length };

    assert.deepStrictEqual(lateCheck({ '': rules(PANEL) }), { ok: true, ran: false });
    assert.deepStrictEqual({ ledger: ledgerText(), calls: calls().length }, before, 'a second check ran beside the first');
    assert.ok(fs.existsSync(claim), 'a check took a live owner\'s claim');

    fs.writeFileSync(claim, JSON.stringify({ pid: 2 ** 22 + 1, pid_start: 'gone' }));
    assert.deepStrictEqual(lateCheck({ '': rules(PANEL) }), { ok: true, ran: true, checked: 1, several: 0, owed: 0 });
    assert.strictEqual(entries().at(-1).entry, full(decision));
    assert.ok(!fs.existsSync(claim), 'the check left its claim behind');
  });

  for (const [what, written, refusal] of /** @type {[string, (line: string) => string, RegExp][]} */ ([
    ['repeating an id', (line) => line, /^line 3 of the ledger repeats the id \w+, which line 2 holds$/],
    ['that is no entry', () => 'not json\n', /^line 3 of the ledger is not JSON: not json$/],
  ])) {
    it(`commits no result over a line ${what} written outside the engine while the call judged: the ledger is read again under the lock before each append (5.4.4)`, (t) => {
      decide(ask(), PANEL);
      const [, decided] = ledgerText().split(/(?<=\n)/);
      const tip = head(dir);
      t.mock.method(claudeCall, 'askClaude', () => {
        fs.appendFileSync(statePath(dir, layout.ledger), written(decided));
        return { answer: rules(PANEL), cost: 0, model: 'claude-opus-5-5' };
      });

      assert.match(refuses(dir, ['ledger', 'late-check'], { env: armed() }).error, refusal);

      assert.strictEqual(head(dir), tip, 'the check committed over the line');
      assert.ok(!ledgerText().includes('"checked"'), 'the check appended its result');
    });
  }

  it('leaves a decision the call still cannot judge owed, for the next start: no login, a rate limit, an outage or a timeout leaves every decision after it owed too, an answer that does not fit only that one', (t) => {
    const first = decide(ask(), PANEL);
    const second = decide(ask(NOTE, 'How do notes reach a second Mac?'), SYNC);
    const written = calls().length;

    assert.deepStrictEqual(lateCheck(), { ok: true, ran: true, checked: 0, several: 0, owed: 2, cannot: { reason: 'no-login', detail: 'Not logged in · Please run /login' } });
    assert.strictEqual(lateCheck({ '': 'rate-limit' }).cannot.reason, 'rate-limit');
    assert.strictEqual(lateCheck({ '': 'failed' }).cannot.reason, 'failed');
    assert.strictEqual(calls().length - written, 3, 'a check went on past a call that would meet every decision after it');
    const timedOut = callAnswering(t, [{ cannot: 'timeout', detail: 'no answer within 60 s' }, { answer: rules(SYNC), cost: 0, model: 'claude-opus-5-5' }]);
    assert.deepStrictEqual(lateCheck(), { ok: true, ran: true, checked: 0, several: 0, owed: 2, cannot: { reason: 'timeout', detail: 'no answer within 60 s' } });
    assert.strictEqual(timedOut.count, 1, 'a check went on past a timeout');
    t.mock.restoreAll();
    assert.ok(!entries().some((e) => e.event === 'checked'), 'a check recorded a result it never had');

    const res = lateCheck({ [PANEL]: 'misfit', [SYNC]: rules(SYNC) });
    assert.deepStrictEqual([res.checked, res.owed, res.cannot.reason], [1, 1, 'misfit']);
    assert.deepStrictEqual(entries().filter((e) => e.event === 'checked').map((e) => e.entry), [full(second)]);

    assert.deepStrictEqual(lateCheck({ [PANEL]: rules(PANEL) }), { ok: true, ran: true, checked: 1, several: 0, owed: 0 });
    assert.deepStrictEqual(entries().filter((e) => e.event === 'checked').map((e) => e.entry), [full(second), full(first)]);
  });

  it('runs detached: the launch hands the check a process of its own, which records its result and lets its claim go after the launch has answered', async () => {
    const decision = decide(ask(), PANEL);
    // A peer holds the writer lock until the launch has answered: a check the launch waited on would wait on the lock with it, and never record.
    const lock = holdLock(statePath(dir, layout.lock));
    const saved = { ...process.env };
    Object.assign(process.env, armed({ '': rules(PANEL, SYNC) }));
    try {
      assert.strictEqual(launchLateCheck(fs.realpathSync(statePath(dir)), []), true);
    } finally {
      for (const key of Object.keys(process.env)) if (!Object.hasOwn(saved, key)) delete process.env[key];
      Object.assign(process.env, saved);
      fs.unlinkSync(lock);
    }

    const claim = statePath(dir, layout.cache('.late-check'));
    const deadline = Date.now() + DETACHED_MS;
    const done = () => entries().some((e) => e.event === 'checked') && !fs.existsSync(claim);
    while (!done() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(done(), 'the detached check recorded nothing');
    assert.deepStrictEqual([entries().at(-1).entry, entries().at(-1).rules], [full(decision), 'several']);
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
  });
});
