'use strict';

// ---------------------------------------------------------------------------
// Departures and their verdicts (leeway-engine/scripts/domain/verdict.cjs,
// over the departure rule and the queue's projection in
// domain/ledger-verdicts.cjs, and the evidence this machine logged in
// domain/trust-evidence.cjs): `engine verdict queue`, every departure this
// machine's trust log holds made in a live place that the trust log holds
// no verdict on — a raise the person answered against Claude's lean, or
// their reversal of an answer that held it, the ledger agreeing it stood
// over the lean, the lean beside it from the nearest entry down its chain
// that held it — and who moved whom as the write verbs hold it: never over
// the lean on an entry Claude made, and on the person's replacement of a
// decision, what its reason and the entry it replaces allow, the engine
// setting it where that is one value and the writer leaves it out, the
// writer saying it where only the writer can tell; and `engine verdict
// give`, a verdict logged in the trust log by its entry and the point it
// was given at, a skip leaving the departure waiting for the verdict that
// follows, refusing an entry that is no departure, a departure this machine
// logged none for, a departure given its verdict — a peer's among them,
// given while it waited on the writer lock, and one waiting in any
// conversation, which the queue leaves out too — and what argv names
// outside §16.10's verdicts and points; an append that fails a warning, the
// verdict waiting in the conversation for its next record. A second machine
// is a config folder of its own over the same state.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; each test keeps the
// trust log in a config folder of its own. The person's answers to Claude's
// lean are raises drawn and answered, each on a question of its own the
// world asked, built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  NO_SPACE, ok, refuses, refusedPristine, statePath, holdLock, lockAttempts, failingTrustAppends, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, askedWorld, ledgerHelpers, answeredRaise } = require('./ledger-world.cjs');
const { trustLogHelpers } = require('./trust-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { TRUST_LOG, record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** Claude's lean on the questions the person answers here, unless a test leans otherwise. */
const LEAN = 'A panel.';

/** Why `verdict give` refuses a departure this machine logged none for. */
const ELSEWHERE = 'a departure\'s verdict is given on the machine where it was made, and the person\'s replacement of their own departure is owed none';

const config = useTempFolder('verdict-config-');

// The world's questions, one for each answer of the person's to Claude's
// lean a test makes, three at most.
const { world, asked: raisable } = askedWorld('verdict-', {
  discovery: { items: { 'note-window': row(1, 'The note window') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
}, { panel: 'Is a note a panel?', float: 'Does a note float?', focus: 'Does a note take focus?' });

/** @type {string} */
let dir;
/** The question each place's decisions answer, asked once a test. @type {Map<string, string>} */
let asked;
/** The world's questions no raise has answered yet this test. @type {string[]} */
let open;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = world();
  asked = new Map();
  open = Object.values(raisable);
  pinned = process.env.LEEWAY_CONFIG_DIR;
  process.env.LEEWAY_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.LEEWAY_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { full, entries } = ledgerHelpers(() => dir);

/** @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function args(verb, address, flags, content) {
  return /** @type {const} */ ([['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }]);
}

/** One write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ok(dir, ...args(verb, address, flags, content)).id;
}

/** One write that must refuse, writing and committing nothing: its error. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function refused(verb, address, flags, content) {
  return refusedPristine(dir, ...args(verb, address, flags, content)).error;
}

/** A decision answering the place's question, made and moved as `made` says. @param {string} text @param {Record<string, unknown>} made @param {string} [address] */
function decide(text, made, address = NOTE) {
  if (!asked.has(address)) asked.set(address, write('ask', address, [], { ...MADE, text: 'What is a note?' }));
  return write('decide', address, ['--answers', /** @type {string} */ (asked.get(address))], { ...made, text, why: `Why: ${text}` });
}

/**
 * The person's answer to Claude's lean, `lean`, on one of the world's
 * questions no raise has answered yet, through a raise: `text`, standing
 * over the lean, or the lean itself, who moved whom on stdin where `moved`
 * gives it. Its short id.
 * @param {string} text @param {{lean?: string, moved?: string}} [opts]
 */
function answered(text, { lean = LEAN, moved } = {}) {
  const agrees = text === lean;
  return answeredRaise(dir, NOTE, /** @type {string} */ (open.shift()), { lean, other: agrees ? 'Something else.' : text, key: agrees ? '1' : '2', moved, env: SESSION });
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

const { logText, logEvents } = trustLogHelpers(() => dir, config);

/** The trust log's events of `type`. @param {string} type */
const logged = (type) => logEvents().filter((event) => event.type === type);

/** The verdict lines the trust log holds, each by its entry, verdict and point. */
function verdicts() {
  return logged('verdict').map(({ entry, verdict, point }) => [entry, verdict, point]);
}

/** A verdict that must be refused, logging nothing: its error. @param {string[]} argv */
function refusedGive(...argv) {
  const before = logText();
  const { error } = refuses(dir, ['verdict', 'give', ...argv]);
  assert.strictEqual(logText(), before, `verdict give ${argv.join(' ')} refused, yet logged`);
  return error;
}

describe('the verdict queue (5.8.10, 16.10)', () => {
  it('holds the person\'s answer that stood over Claude\'s lean — an amendment, an overrule, or a blind answer that differs from the sealed one — with the lean beside it, where it stands (16.10.1, 16.10.10)', async () => {
    const departed = await answered('A sheet.');

    const [row] = ok(dir, ['verdict', 'queue']).departures;
    const shown = ok(dir, ['ledger', 'record', UNIT, 'note-window']).decisions.find((/** @type {{id: string}} */ d) => d.id === departed);
    const { holds: _holds, kept: _kept, assets: _assets, replaced: _replaced, ...line } = shown;
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

  it('waits on nothing where the person took Claude\'s lean or came round to it, nor on Claude\'s own call or a finding; their later reversal of either answer names it, cancels its agreement, and waits with the lean beside it, the raise\'s line as it was (16.S41, 16.10.10)', async () => {
    const agreed = await answered(LEAN);
    const cameRound = await answered('A frameless window.', { lean: 'A frameless window.', moved: 'claude-moved-person' });
    const call = decide('Notes snap to the grid.', MADE);
    write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it', known: 'read' });
    assert.deepStrictEqual(ok(dir, ['verdict', 'queue']), { ok: true, departures: [] });
    const raises = logText();

    const reversed = write(...replacing(agreed, 'changed-mind', persons('person-moved-claude')));
    const reversedToo = write(...replacing(cameRound, 'changed-mind', persons('person-moved-claude')));

    const reversals = logged('reversal');
    assert.deepStrictEqual(reversals.map(({ entry, reverses }) => [entry, reverses]), [[full(reversed), full(agreed)], [full(reversedToo), full(cameRound)]]);
    assert.deepStrictEqual(evidenceOf(statePath(dir)).answers.map(({ event, standing, cancelled_by: by }) => [event.entry, standing, by]), [
      [full(agreed), 'agreement', reversals[0].id], [full(cameRound), 'agreement', reversals[1].id], [full(call), 'call', null],
      [full(reversed), 'departure', null], [full(reversedToo), 'departure', null],
    ]);
    assert.deepStrictEqual(waiting(), [[reversed, 'A panel.'], [reversedToo, 'A frameless window.']]);
    assert.ok(logText().startsWith(raises), 'the raises\' lines were rewritten');
  });

  it('takes the person\'s replacement of their own departure at their word, a return to Claude\'s lean or a third answer still against it, never the lean from the start: the return leaves the departure waiting alone, and a third answer, no new evidence, is owed no verdict (P4)', async () => {
    const returned = await answered('A sheet.');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it or stands over it still: claude-moved-person or person-moved-claude');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', { by: 'person' })), 'ledger replace: the content needs who_moved_whom');
    write(...replacing(returned, 'changed-mind', persons('claude-moved-person')));
    assert.deepStrictEqual(waiting(), [[returned, 'A panel.']]);

    const departed = await answered('A frameless window.');
    const third = write(...replacing(departed, 'was-wrong', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [[returned, 'A panel.'], [departed, 'A panel.']]);
    assert.strictEqual(refusedGive(third, 'loss', '--at', 'queue'), `verdict give: ${third} is no departure this machine logged — ${ELSEWHERE}`);
  });

  it('never takes a replacement for a new fact or another topic\'s decision as a departure: new information, not disagreement', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike', known: 'spike' });
    const theirs = decide('A note opens on the active Space.', MADE, SPACE);
    assert.strictEqual(refused(...replacing(call, 'new-fact', persons('person-moved-claude'), ['--cause', fact])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for a new fact brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');
    assert.strictEqual(refused(...replacing(call, 'other-topic', persons('person-moved-claude'), ['--cause', theirs])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for another topic\'s decision brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');

    const changed = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));
    write(...replacing(changed, 'other-topic', persons('claude-moved-person'), ['--cause', theirs]));

    assert.deepStrictEqual(waiting(), []);
  });

  it('never takes the person\'s replacement of their own decision, on a chain Claude never leaned on, as a departure, for a changed mind or a mistake: it moves no one — set where it is left out, any other value refused — waits on no verdict and logs no reversal (16.10.1)', () => {
    const own = decide('A sheet.', { by: 'person' });
    const noLean = 'the person\'s decision holds no lean of Claude\'s to move, no entry down its chain being Claude\'s own or carrying its sealed answer; their answer to Claude\'s lean is recorded by raise answer: none';
    for (const reason of ['changed-mind', 'was-wrong']) {
      assert.strictEqual(refused(...replacing(own, reason, persons('person-moved-claude'))), `ledger replace: who_moved_whom is person-moved-claude — ${noLean}`);
    }

    const changed = write(...replacing(own, 'changed-mind', { by: 'person' }));
    const corrected = write(...replacing(changed, 'was-wrong', { by: 'person' }));

    assert.deepStrictEqual([own, changed, corrected].map((id) => entries().find((entry) => entry.id === full(id))?.who_moved_whom), ['none', 'none', 'none']);
    assert.deepStrictEqual(waiting(), []);
    assert.deepStrictEqual(logged('reversal'), []);
  });

  it('takes the person\'s replacement for a changed mind as a reversal where Claude leaned down its chain: Claude\'s call, replaced by the person for a new fact, then changed, the new fact\'s answer as the lean', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike', known: 'spike' });
    const updated = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));

    const reversed = write(...replacing(updated, 'changed-mind', { by: 'person' }));

    assert.deepStrictEqual(waiting(), [[reversed, `Not ${call}.`]]);
    assert.deepStrictEqual(logged('reversal').map(({ entry, reverses }) => [entry, reverses]), [[full(reversed), full(updated)]]);
  });

  it('refuses an entry Claude made standing over its own lean', () => {
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });
    assert.strictEqual(refused('decide', NOTE, ['--answers', question], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');
  });

  it('leaves out a departure made where it is set aside, until it comes back, and a verdict on it is refused while it is out, logging nothing', async () => {
    const departed = await answered('A sheet.');

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
  it('logs the verdict on a departure in the trust log, by its entry and the point it was given at, answering the entry by its short id; the departure leaves the queue, the others waiting on', async () => {
    const judged = await answered('A sheet.');
    const unjudged = await answered('A frameless window.');

    assert.deepStrictEqual(give(judged, 'loss', 'decided'), { ok: true, entry: judged, verdict: 'loss', point: 'decided' });

    assert.deepStrictEqual(verdicts(), [[full(judged), 'loss', 'decided']]);
    assert.deepStrictEqual(waiting(), [[unjudged, 'A panel.']]);
  });

  it('leaves a departure skipped waiting in the queue, and takes the verdict that follows the skip, at another point (16.10.1, 16.10.6)', async () => {
    const departed = await answered('A sheet.');

    give(departed, 'skip', 'decided');
    assert.deepStrictEqual(waiting(), [[departed, 'A panel.']]);
    give(departed, 'fix', 'queue');

    assert.deepStrictEqual(verdicts(), [[full(departed), 'skip', 'decided'], [full(departed), 'fix', 'queue']]);
    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses a departure given its verdict, a skip given after it among them: a verdict given is corrected, never given again (16.15.4)', async () => {
    const departed = await answered('A sheet.');
    give(departed, 'nothing', 'finish');

    for (const verdict of ['loss', 'skip']) {
      assert.strictEqual(refusedGive(departed, verdict, '--at', 'queue'), `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    }
  });

  it('refuses, logging nothing, an entry that is no departure — Claude\'s call, the person\'s answer that took Claude\'s lean, a finding — a prefix naming no entry, a verdict outside the four, a point where no verdict is given, and argv of another shape', async () => {
    const call = decide('A panel.', MADE);
    const agreed = await answered(LEAN);
    const finding = write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it', known: 'read' });
    const departed = await answered('A sheet.');
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

  it('holds the writer lock, so a peer\'s verdict on the departure, given while it waits, refuses its own', async (t) => {
    const departed = await answered('A sheet.');
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

  it('an append that fails is a warning, the verdict waiting in the conversation; the conversation\'s next record lands it, once (16.S74)', async (t) => {
    const first = await answered('A sheet.');
    const second = await answered('A frameless window.');
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

  it('counts a verdict waiting in any conversation as given: while appends fail, one conversation\'s skip leaves the departure in the queue, and its loss after it, waiting in its folder, takes it out of every conversation\'s — another\'s verdict and skip alike refused', async (t) => {
    const departed = await answered('A sheet.');
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

describe('the departures this machine logged (16.13.1, 16.13.5, 16.13.6)', () => {
  it('holds a departure whose raise event waits in the conversation ahead of its entry, the trust log\'s append failing after the ledger\'s, as a waiting verdict counts', async (t) => {
    failingTrustAppends(t);

    const departed = await answered('A sheet.');

    const kept = fs.readFileSync(path.join(conversationDir(SESSION.CLAUDE_CODE_SESSION_ID), 'trust-pending.jsonl'), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line));
    assert.deepStrictEqual(kept.map(({ awaits, event }) => [awaits.entry, event.type]), [[full(departed), 'raise']]);
    assert.deepStrictEqual([logText(), waiting()], ['', [[departed, 'A panel.']]]);
  });

  it('on a second machine, a config folder of its own, the project\'s departures are in the ledger and none is in the queue, and give refuses them; one judged on the first is never asked again, and of the second\'s own log, an event under another project\'s id is none of this project\'s', async () => {
    const judged = await answered('A sheet.');
    const unjudged = await answered('A frameless window.');
    give(judged, 'loss', 'decided');
    const second = { LEEWAY_CONFIG_DIR: path.join(config(), 'second-machine') };
    const secondLog = path.join(second.LEEWAY_CONFIG_DIR, TRUST_LOG);

    const { decisions } = ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: second });
    assert.deepStrictEqual(decisions.filter((/** @type {{who_moved_whom: string}} */ d) => d.who_moved_whom === 'person-moved-claude').map((/** @type {{id: string}} */ d) => d.id), [judged, unjudged]);
    assert.deepStrictEqual(waiting(second), []);
    for (const entry of [judged, unjudged]) {
      assert.strictEqual(refuses(dir, ['verdict', 'give', entry, 'skip', '--at', 'queue'], { env: second }).error, `verdict give: ${entry} is no departure this machine logged — ${ELSEWHERE}`);
    }
    assert.ok(!fs.existsSync(secondLog), 'the second machine logged a verdict it refused');
    assert.deepStrictEqual(waiting(), [[unjudged, 'A panel.']]);

    const [raised] = logged('raise').filter(({ entry }) => entry === full(unjudged));
    fs.mkdirSync(path.dirname(secondLog), { recursive: true });
    fs.writeFileSync(secondLog, `${JSON.stringify({ ...raised, id: newId(), project: newId() })}\n`);
    assert.deepStrictEqual(waiting(second), []);
    fs.appendFileSync(secondLog, `${JSON.stringify(raised)}\n`);
    assert.deepStrictEqual(waiting(second), [[unjudged, 'A panel.']]);
  });
});
