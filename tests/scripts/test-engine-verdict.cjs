'use strict';

// ---------------------------------------------------------------------------
// Departures and their verdicts (workflow-engine/scripts/domain/verdict.cjs,
// over the departure rule and the queue's projection in
// domain/ledger-verdicts.cjs): `engine verdict queue`, every departure made
// in a live place that the trust log holds no verdict on — a decision the
// person made whose answer stood over Claude's lean, the lean beside it
// from the nearest entry down its chain that held it — and who moved whom
// as the write verbs hold it: never over the lean on an entry Claude made,
// and on the person's replacement of a decision, what its reason and the
// entry it replaces allow, the engine setting it where that is one value
// and the writer leaves it out, the writer saying it where only the writer
// can tell; and `engine verdict give`, a verdict logged in the trust log by
// its entry and the point it was given at, a skip leaving the departure
// waiting for the verdict that follows, refusing an entry that is no
// departure, a departure given its verdict — a peer's among them, given
// while it waited on the writer lock, and one waiting in any conversation,
// which the queue leaves out too — and what argv names outside §16.10's
// verdicts and points; an append that fails a warning, the verdict waiting
// in the conversation for its next record.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; each test keeps the
// trust log in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  NO_SPACE, ok, refuses, statePath, layout, head, holdLock, lockAttempts, failingTrustAppends, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, ledgerWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { trustLogPath, record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** The person's answer standing over Claude's lean, a panel. */
const DEPARTING = Object.freeze({ ...persons('person-moved-claude'), sealed: 'A panel.' });

const config = useTempFolder('verdict-config-');

/** @type {string} */
let dir;
/** The question each place's decisions answer, asked once a test. @type {Map<string, string>} */
let asked;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = ledgerWorld('verdict-', {
    discovery: { items: { 'note-window': row(1, 'The note window') } },
    discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
  });
  asked = new Map();
  pinned = process.env.WORKFLOWS_CONFIG_DIR;
  process.env.WORKFLOWS_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.WORKFLOWS_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { full } = ledgerHelpers(() => dir);

/** @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function args(verb, address, flags, content) {
  return /** @type {const} */ ([['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }]);
}

/** One write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ok(dir, ...args(verb, address, flags, content)).id;
}

/** The ledger as it stands, and the state branch's tip. */
function written() {
  return [fs.readFileSync(statePath(dir, layout.ledger), 'utf8'), head(dir)];
}

/** One write that must refuse, writing and committing nothing: its error. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function refused(verb, address, flags, content) {
  const before = written();
  const { error } = refuses(dir, ...args(verb, address, flags, content));
  assert.deepStrictEqual(written(), before, `ledger ${verb} refused, yet wrote or committed`);
  return error;
}

/** A decision answering the place's question, made and moved as `made` says. @param {string} text @param {Record<string, unknown>} made @param {string} [address] */
function decide(text, made, address = NOTE) {
  if (!asked.has(address)) asked.set(address, write('ask', address, [], { ...MADE, text: 'What is a note?' }));
  return write('decide', address, ['--answers', /** @type {string} */ (asked.get(address))], { ...made, text, why: `Why: ${text}` });
}

/** `old` replaced on the note window for `reason`, made and moved as `made` says. @param {string} old @param {string} reason @param {Record<string, unknown>} made @param {string[]} [flags] */
function replacing(old, reason, made, flags = []) {
  return /** @type {const} */ (['replace', NOTE, ['--replaces', old, '--reason', reason, ...flags], { ...made, drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.' }]);
}

/** The departures waiting on a verdict, each by id and with its lean. @param {Record<string, string>} [env] */
function waiting(env = {}) {
  return ok(dir, ['verdict', 'queue'], { env }).departures.map((/** @type {{id: string, lean: string}} */ d) => [d.id, d.lean]);
}

/** A verdict that must be given: its answer. @param {string} entry @param {string} verdict @param {string} point @param {Record<string, string>} [env] */
function give(entry, verdict, point, env = {}) {
  return ok(dir, ['verdict', 'give', entry, verdict, '--at', point], { env });
}

/** The trust log's text, '' where there is none. */
function logText() {
  return fs.existsSync(trustLogPath()) ? fs.readFileSync(trustLogPath(), 'utf8') : '';
}

/** The verdict lines the trust log holds, each by its entry, verdict and point. */
function verdicts() {
  return logText().split('\n').slice(0, -1).map((line) => JSON.parse(line)).filter((event) => event.type === 'verdict').map(({ entry, verdict, point }) => [entry, verdict, point]);
}

/** A verdict that must be refused, logging nothing: its error. @param {string[]} argv */
function refusedGive(...argv) {
  const before = logText();
  const { error } = refuses(dir, ['verdict', 'give', ...argv]);
  assert.strictEqual(logText(), before, `verdict give ${argv.join(' ')} refused, yet logged`);
  return error;
}

describe('the verdict queue (5.8.10, 16.10)', () => {
  it('waits on nothing where the person took Claude\'s lean or came round to it, and a departure is a decision: never Claude\'s own call, nor a finding', () => {
    decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });
    decide('Notes snap to the grid.', MADE);
    write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it' });

    assert.deepStrictEqual(ok(dir, ['verdict', 'queue']), { ok: true, departures: [] });
  });

  it('holds the person\'s answer that stood over Claude\'s lean — an amendment, an overrule, or a blind answer that differs from the sealed one — with the lean beside it, where it stands (16.10.1, 16.10.10)', () => {
    const departed = decide('A sheet.', DEPARTING);

    const [row] = ok(dir, ['verdict', 'queue']).departures;
    const shown = ok(dir, ['ledger', 'record', UNIT, 'note-window']).decisions.find((/** @type {{id: string}} */ d) => d.id === departed);
    const { holds: _holds, replaced: _replaced, ...line } = shown;
    assert.deepStrictEqual(row, { ...line, standing: { unit: UNIT, topic: 'note-window' }, lean: 'A panel.' });
  });

  it('holds the person\'s replacement of Claude\'s own call for a changed mind or a mistake — a call overruled when shown — the call it replaced as the lean, the engine setting who moved whom where the writer leaves it out and refusing any other', () => {
    const call = decide('A panel.', MADE);
    assert.strictEqual(refused(...replacing(call, 'was-wrong', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that held Claude\'s lean, for a changed mind or a mistake, stands over it: person-moved-claude');

    const overruled = write(...replacing(call, 'was-wrong', { by: 'person' }));

    const [row] = ok(dir, ['verdict', 'queue']).departures;
    assert.deepStrictEqual([row.id, row.who_moved_whom, row.lean], [overruled, 'person-moved-claude', 'A panel.']);
  });

  it('holds a later reversal: the person\'s replacement of their own answer that took Claude\'s lean, or came round to it (16.10.10)', () => {
    const agreed = decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    const cameRound = decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });

    const reversed = write(...replacing(agreed, 'changed-mind', persons('person-moved-claude')));
    const reversedToo = write(...replacing(cameRound, 'changed-mind', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [[reversed, 'A panel.'], [reversedToo, 'A frameless window.']]);
  });

  it('takes the person\'s replacement of their own departure at their word, a return to Claude\'s lean or a third answer still against it, never the lean from the start: the return leaves the departure waiting alone, and a third answer waits beside it, Claude\'s lean beside it still', () => {
    const returned = decide('A sheet.', DEPARTING);
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it or stands over it still: claude-moved-person or person-moved-claude');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', { by: 'person' })), 'ledger replace: the content needs who_moved_whom');
    write(...replacing(returned, 'changed-mind', persons('claude-moved-person')));
    assert.deepStrictEqual(waiting(), [[returned, 'A panel.']]);

    const departed = decide('A frameless window.', DEPARTING);
    const third = write(...replacing(departed, 'was-wrong', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [[returned, 'A panel.'], [departed, 'A panel.'], [third, 'A panel.']]);
  });

  it('never takes a replacement for a new fact or another topic\'s decision as a departure: new information, not disagreement', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike' });
    const theirs = decide('A note opens on the active Space.', MADE, SPACE);
    assert.strictEqual(refused(...replacing(call, 'new-fact', persons('person-moved-claude'), ['--cause', fact])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for a new fact brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');
    assert.strictEqual(refused(...replacing(call, 'other-topic', persons('person-moved-claude'), ['--cause', theirs])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for another topic\'s decision brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');

    const changed = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));
    write(...replacing(changed, 'other-topic', persons('claude-moved-person'), ['--cause', theirs]));

    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses an entry Claude made standing over its own lean', () => {
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });
    assert.strictEqual(refused('decide', NOTE, ['--answers', question], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');
  });

  it('measures the person\'s replacement carrying Claude\'s sealed answer against it, as any answer is: the writer\'s who moved whom stands, any of the three, whatever the reason, and a departure waits with its own sealed answer as the lean; Claude\'s still never stands over its own (5.3.10, 16.10.10)', () => {
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike' });
    const blind = (/** @type {string} */ moved) => ({ ...persons(moved), sealed: 'A sheet.' });
    const agreed = decide('A panel.', MADE);
    const departedFor = decide('A frameless window.', MADE);
    const returned = decide('A floating note.', DEPARTING);
    assert.strictEqual(refused(...replacing(agreed, 'was-wrong', { by: 'person', sealed: 'A sheet.' })), 'ledger replace: the content needs who_moved_whom');
    assert.strictEqual(refused(...replacing(agreed, 'was-wrong', { by: 'claude', who_moved_whom: 'person-moved-claude', sealed: 'A sheet.' })),
      'ledger replace: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');

    write(...replacing(agreed, 'was-wrong', blind('none')));
    const departed = write(...replacing(departedFor, 'new-fact', blind('person-moved-claude'), ['--cause', fact]));
    write(...replacing(returned, 'changed-mind', blind('none')));

    assert.deepStrictEqual(waiting(), [[returned, 'A panel.'], [departed, 'A sheet.']]);
  });

  it('leaves out a departure made where it is set aside, until it comes back, and a verdict on it is refused while it is out, logging nothing', () => {
    const departed = decide('A sheet.', DEPARTING);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(waiting(), []);
    assert.strictEqual(refusedGive(departed, 'loss', '--at', 'queue'), `verdict give: ${departed} is owed no verdict — its topic, note-window, is cancelled, so the departure is no longer live`);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(waiting(), [[departed, 'A panel.']]);
  });

  it('refuses a read naming a place', () => {
    assert.match(refuses(dir, ['verdict', 'queue', UNIT]).error, /^Usage: engine verdict queue$/);
  });
});

describe('giving a verdict (16.10.1, 16.10.9)', () => {
  it('logs the verdict on a departure in the trust log, by its entry and the point it was given at, answering the entry by its short id; the departure leaves the queue, the others waiting on', () => {
    const judged = decide('A sheet.', DEPARTING);
    const unjudged = decide('A frameless window.', DEPARTING);

    assert.deepStrictEqual(give(judged, 'loss', 'decided'), { ok: true, entry: judged, verdict: 'loss', point: 'decided' });

    assert.deepStrictEqual(verdicts(), [[full(judged), 'loss', 'decided']]);
    assert.deepStrictEqual(waiting(), [[unjudged, 'A panel.']]);
  });

  it('leaves a departure skipped waiting in the queue, and takes the verdict that follows the skip, at another point (16.10.1, 16.10.6)', () => {
    const departed = decide('A sheet.', DEPARTING);

    give(departed, 'skip', 'decided');
    assert.deepStrictEqual(waiting(), [[departed, 'A panel.']]);
    give(departed, 'fix', 'queue');

    assert.deepStrictEqual(verdicts(), [[full(departed), 'skip', 'decided'], [full(departed), 'fix', 'queue']]);
    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses a departure given its verdict, a skip given after it among them: a verdict given is corrected, never given again (16.15.4)', () => {
    const departed = decide('A sheet.', DEPARTING);
    give(departed, 'nothing', 'finish');

    for (const verdict of ['loss', 'skip']) {
      assert.strictEqual(refusedGive(departed, verdict, '--at', 'queue'), `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    }
  });

  it('refuses, logging nothing, an entry that is no departure — Claude\'s call, the person\'s answer that took Claude\'s lean, a finding — a prefix naming no entry, a verdict outside the four, a point where no verdict is given, and argv of another shape', () => {
    const call = decide('A panel.', MADE);
    const agreed = decide('A frameless window.', { ...persons('none'), sealed: 'A frameless window.' });
    const finding = write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it' });
    const departed = decide('A sheet.', DEPARTING);
    const usage = /^Usage: engine verdict give <entry> <nothing\|fix\|loss\|skip> --at <decided\|ready-to-build\|conclusion\|finish\|close\|queue>$/;

    for (const entry of [call, agreed, finding]) {
      assert.strictEqual(refusedGive(entry, 'loss', '--at', 'decided'), `verdict give: ${entry} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
    }
    assert.strictEqual(refusedGive('zzzzzz', 'loss', '--at', 'decided'), 'verdict give: no ledger entry\'s id begins "zzzzzz"');
    assert.strictEqual(refusedGive(departed, 'win', '--at', 'decided'), 'verdict give: "win" is no verdict — nothing, fix, loss, skip');
    assert.strictEqual(refusedGive(departed, 'loss', '--at', 'review'), 'verdict give: --at names "review", where no verdict is given — decided, ready-to-build, conclusion, finish, close, queue');
    for (const argv of [[departed, 'loss'], [departed, '--at', 'decided'], [departed, 'loss', 'decided', '--at', 'queue'], [departed, 'loss', '--at'], [departed, 'loss', '--at', 'decided', '--at', 'queue']]) {
      assert.match(refusedGive(...argv), usage, argv.join(' '));
    }
    assert.match(refuses(dir, ['verdict', 'judge']).error, /^Usage: engine verdict <queue\|give> …\nverdict queue\nverdict give /);
    assert.deepStrictEqual(waiting(), [[departed, 'A panel.']]);
  });

  it('holds the writer lock, so a peer\'s verdict on the departure, given while it waits, refuses its own', (t) => {
    const departed = decide('A sheet.', DEPARTING);
    const lock = holdLock(statePath(dir, WRITER_LOCK));
    // The peer gives its verdict and lets go at the give's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      if (taken < 2) return;
      record('verdict', { entry: full(departed), verdict: 'nothing', point: 'decided' }, { cwd: dir, warnings: [] });
      fs.unlinkSync(lock);
    });

    assert.strictEqual(refuses(dir, ['verdict', 'give', departed, 'loss', '--at', 'queue']).error, `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(verdicts(), [[full(departed), 'nothing', 'decided']]);
  });

  it('an append that fails is a warning, the verdict waiting in the conversation; the conversation\'s next record lands it, once (16.S74)', (t) => {
    const first = decide('A sheet.', DEPARTING);
    const second = decide('A frameless window.', DEPARTING);
    const waitingFile = path.join(conversationDir(SESSION.CLAUDE_CODE_SESSION_ID), 'trust-pending.jsonl');
    const failing = failingTrustAppends(t);

    const failed = give(first, 'loss', 'decided', SESSION);

    assert.deepStrictEqual(failed.warnings, [`the trust log was not written: ${NO_SPACE} — the event waits in the conversation, appended first by its next record`]);
    assert.deepStrictEqual(fs.readFileSync(waitingFile, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).entry), [full(first)]);
    assert.deepStrictEqual(verdicts(), []);
    failing.mock.restore();

    give(second, 'fix', 'queue', SESSION);

    assert.deepStrictEqual(verdicts(), [[full(first), 'loss', 'decided'], [full(second), 'fix', 'queue']]);
    assert.ok(!fs.existsSync(waitingFile), 'the verdict landed, yet waits on to land again');
    assert.deepStrictEqual(waiting(), []);
  });

  it('counts a verdict waiting in any conversation as given: while appends fail, one conversation\'s skip leaves the departure in the queue, and its loss after it, waiting in its folder, takes it out of every conversation\'s — another\'s verdict and skip alike refused', (t) => {
    const departed = decide('A sheet.', DEPARTING);
    const peer = { CLAUDE_CODE_SESSION_ID: 'session-2' };
    const waitsIn = (/** @type {Record<string, string>} */ env) => fs.existsSync(path.join(conversationDir(env.CLAUDE_CODE_SESSION_ID), 'trust-pending.jsonl'));
    failingTrustAppends(t);

    give(departed, 'skip', 'decided', SESSION);
    assert.deepStrictEqual(waiting(peer), [[departed, 'A panel.']]);
    give(departed, 'loss', 'queue', SESSION);

    for (const verdict of ['fix', 'skip']) {
      assert.strictEqual(refuses(dir, ['verdict', 'give', departed, verdict, '--at', 'queue'], { env: peer }).error, `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    }
    assert.deepStrictEqual([waiting(SESSION), waiting(peer), waitsIn(SESSION), waitsIn(peer), verdicts()], [[], [], true, false, []]);
  });
});
