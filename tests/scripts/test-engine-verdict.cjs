'use strict';

// ---------------------------------------------------------------------------
// Departures and their verdicts (leeway-engine/scripts/domain/verdict.cjs,
// over the departure rule and the queue's projection in
// domain/ledger-verdicts.cjs, and the evidence this machine logged in
// domain/trust-evidence.cjs): `engine verdict queue`, every departure this
// machine's trust log holds, wherever it was made — a topic or a unit set
// aside or cancelled since among them, the counts holding it a loss until it
// is judged — that the trust log holds no verdict on — a raise the person
// answered against Claude's lean, or
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
// verdict waiting in the conversation for its next record, and given at the
// queue, leading to the verdict page while a departure waits, else the start
// menu. `engine render verdicts`, the verdict page drawn in the menus' frame
// (domain/projections/verdict-page.cjs): the queue's first departure, where
// it stands and the latest skip it waits after, its rows giving each verdict
// at the queue; nothing where none waits, nor of another machine's or
// another project's. A second machine is a config folder of its own over the
// same state.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; each test keeps the
// trust log in a config folder of its own. The person's answers to Claude's
// lean are raises drawn and answered, each on a question of its own the
// world asked, and the note window's decisions answer another it asked,
// built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  NO_SPACE, ok, refuses, refusedPristine, output, sectionOf, statePath, holdLock, lockAttempts, failingTrustAppends, cleanupFixture, withFrozenClock,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, askedWorld, ledgerHelpers, leaningCall, answeredRaise } = require('./ledger-world.cjs');
const { trustLogHelpers } = require('./trust-world.cjs');
const { labelling } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { TRUST_LOG, record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { dayMonth } = require(path.join(SCRIPTS, 'domain/dates.cjs'));
const { gateShown } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { countsOf, stateOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { THRESHOLD } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));

/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** Claude's lean on the questions the person answers here, unless a test leans otherwise. */
const LEAN = 'A panel.';

/** Why `verdict give` refuses a departure this machine logged none for. */
const ELSEWHERE = 'a departure\'s verdict is given on the machine where it was made, and the person\'s replacement of their own departure is owed none';

const config = useTempFolder('verdict-config-');

// The world's questions: the one the note window's decisions answer, and
// one for each answer of the person's to Claude's lean a test makes, three
// at most.
const { world, asked: questions } = askedWorld('verdict-', {
  discovery: { items: { 'note-window': row(1, 'The note window'), [UNIT]: { ...row(2, 'The theme'), title: 'theme-switching' } } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' }, [UNIT]: { status: 'in-progress' } } },
}, { note: 'What is a note?', panel: 'Is a note a panel?', float: 'Does a note float?', focus: 'Does a note take focus?' });

/** @type {string} */
let dir;
/** The question each place's decisions answer: the world's at the note window, any other asked once a test. @type {Map<string, string>} */
let asked;
/** The world's questions no raise has answered yet this test. @type {string[]} */
let open;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = world();
  const { note, ...raisable } = questions;
  asked = new Map([[NOTE, note]]);
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
 * The person's answer to Claude's lean, `lean`, through a raise: on one of
 * the world's questions no raise has answered yet, or at `at`, on a
 * question asked there first; `text`, standing over the lean, or the lean
 * itself, who moved whom on stdin where `moved` gives it; in the
 * conversation `env` names. Its short id.
 * @param {string} text @param {{lean?: string, moved?: string, at?: string, env?: Record<string, string>}} [opts]
 */
function answered(text, { lean = LEAN, moved, at = NOTE, env = SESSION } = {}) {
  const agrees = text === lean;
  const question = at === NOTE ? /** @type {string} */ (open.shift()) : write('ask', at, [], { ...MADE, text: 'Where does a note open?' });
  return answeredRaise(dir, at, question, { lean, other: agrees ? 'Something else.' : text, key: agrees ? '1' : '2', moved, env });
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
    assert.strictEqual(refused('decide', NOTE, ['--answers', questions.note], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');
  });

  it('holds a departure wherever it was made — its topic cancelled or postponed since — and takes its verdict, the count of its kind holding it a loss until then (16.10.12, 16.10.8)', async () => {
    const env = { ...SESSION, ...labelling(leaningCall(LEAN, '').question, 'behaviour') };
    const cancelled = await answered('A sheet.', { env });
    const postponed = await answered('A sheet.', { at: SPACE, env });
    const losses = () => stateOf(countsOf(statePath(dir), { model: null, now: Date.now() }).kinds.behaviour, THRESHOLD).losses;

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    ok(dir, ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later']);
    assert.deepStrictEqual([waiting(), losses()], [[[cancelled, LEAN], [postponed, LEAN]], 2]);

    give(cancelled, 'nothing', 'queue');
    assert.deepStrictEqual([waiting(), losses()], [[[postponed, LEAN]], 1]);
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
      assert.strictEqual(refusedGive(departed, verdict, '--at', 'decided'), `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
    }
  });

  it('refuses, logging nothing, an entry that is no departure — Claude\'s call, the person\'s answer that took Claude\'s lean, a finding — a prefix naming no entry, a verdict outside the four, a point where no verdict is given, and argv of another shape', async () => {
    const call = decide('A panel.', MADE);
    const agreed = await answered(LEAN);
    const finding = write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it', known: 'read' });
    const departed = await answered('A sheet.');
    const usage = /^Usage: engine verdict give <entry> <nothing\|fix\|loss\|skip> --at <decided\|ready-to-build\|conclusion\|finish\|close\|queue> \[--unit <unit>\]$/;

    for (const entry of [call, agreed, finding]) {
      assert.strictEqual(refusedGive(entry, 'loss', '--at', 'decided'), `verdict give: ${entry} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
    }
    assert.strictEqual(refusedGive('zzzzzz', 'loss', '--at', 'decided'), 'verdict give: no ledger entry\'s id begins "zzzzzz"');
    assert.strictEqual(refusedGive(departed, 'win', '--at', 'decided'), 'verdict give: "win" is no verdict — nothing, fix, loss, skip');
    assert.strictEqual(refusedGive(departed, 'loss', '--at', 'review'), 'verdict give: --at names "review", where no verdict is given — decided, ready-to-build, conclusion, finish, close, queue');
    for (const argv of [[departed, 'loss'], [departed, '--at', 'decided'], [departed, 'loss', 'decided', '--at', 'queue'], [departed, 'loss', '--at'], [departed, 'loss', '--at', 'decided', '--at', 'queue'], [departed, 'loss', '--at', 'queue', '--unit'], [departed, 'loss', '--at', 'queue', '--topic', UNIT]]) {
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
      assert.strictEqual(refuses(dir, ['verdict', 'give', departed, verdict, '--at', 'decided'], { env: peer }).error, `verdict give: ${departed} has its verdict — only a skip waits for one, and a verdict given is corrected, never given again`);
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
      assert.strictEqual(refuses(dir, ['verdict', 'give', entry, 'skip', '--at', 'decided'], { env: second }).error, `verdict give: ${entry} is no departure this machine logged — ${ELSEWHERE}`);
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

describe('the verdict page (16.10.6, 16.10.7, 16.10.12, 18.4.2)', () => {
  const START_MENU = { kind: 'engine', argv: ['render', 'start-menu'] };
  const THE_PAGE = { kind: 'engine', argv: ['render', 'verdicts'] };
  const OTHER = 'atlas';

  /** The page as drawn in the conversation, for `unit` where it names one. @param {string} [unit] */
  const page = (unit) => output(dir, ['render', 'verdicts', ...(unit === undefined ? [] : ['--unit', unit])], { env: SESSION });

  /** The page's sections as the screen reads them, its emphasis dropped. @param {string} out */
  const read = (out) => ['TITLE', 'DISPLAY: verdicts'].map((name) => sectionOf(out, name).replace(/\*\*|`/g, ''));

  /** The page's heading line: where the departure it shows stands, and when. @param {string} out */
  const heading = (out) => sectionOf(out, 'DISPLAY: verdicts').split('\n')[0];

  /** The day an entry was made, as the page shows it. @param {string} id */
  const madeOn = (id) => dayMonth(/** @type {string} */ (entries().find((entry) => entry.id === full(id))?.at).slice(0, 10));

  /** The verdict a row of the page leads to, given: its answer. @param {string} key */
  const picked = (key) => ok(dir, /** @type {{argv: string[]}} */ (ok(dir, ['gate', 'verdicts', '--pick', key], { env: SESSION }).next).argv, { env: SESSION });

  /** The person's change of Claude's call on `question` at `address`: the departure's short id. @param {string} address @param {string} question */
  function reversedAt(address, question) {
    const asked = write('ask', address, [], { ...MADE, text: question });
    const call = write('decide', address, ['--answers', asked], { ...MADE, text: 'Claude\'s answer.', why: 'Because.' });
    return write('replace', address, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['the call'], text: 'The person\'s answer.', why: 'The person wants it so.' });
  }

  it('draws the queue\'s first departure in 16.10.7\'s shape: the count waiting, the project and topic with the point and day of its latest skip by time, the question, Claude\'s answer and the person\'s, then the three verdicts each given at the queue, help, and back to the start menu', async () => {
    const first = await answered('A sheet.');
    await answered('A frameless window.');
    withFrozenClock(() => record('verdict', { entry: full(first), verdict: 'skip', point: 'conclusion' }, { cwd: dir, warnings: [] }));
    const [skip] = logged('verdict');
    // Two more skips read after it, the latest by time read between them.
    const again = (/** @type {string} */ point, /** @type {string} */ at) => `${JSON.stringify({ ...skip, id: newId(), point, at })}\n`;
    fs.appendFileSync(path.join(config(), TRUST_LOG), again('ready-to-build', '2026-03-02T09:00:00.000Z') + again('finish', '2025-12-31T09:00:00.000Z'));

    const out = page();

    assert.deepStrictEqual(read(out), [
      '# ■ Verdicts · 1 of 2 waiting\n',
      `${projectName(dir)} · Note Window · skipped at ready to build, 2 Mar\n  └─ Is a note a panel?\n        My answer: A panel.\n        Yours: A sheet.\n`,
    ]);
    const give = (/** @type {string} */ verdict) => ({ kind: 'engine', argv: ['verdict', 'give', full(first), verdict, '--at', 'queue'] });
    assert.deepStrictEqual(gateShown(), {
      gate: 'verdicts',
      question: 'What would my answer have cost the product?',
      options: [
        { key: 'n', word: 'nothing', head: 'Nothing — mine would have served as well', tail: null, detail: null, recommended: false, next: give('nothing') },
        { key: 'f', word: 'fix', head: 'A fix later', tail: null, detail: null, recommended: false, next: give('fix') },
        { key: 'l', word: 'loss', head: 'A real loss', tail: null, detail: null, recommended: false, next: give('loss') },
        { key: 'h', word: 'help', head: 'What this screen is for, row by row', tail: null, detail: null, recommended: false, next: { kind: 'engine', argv: ['render', 'help', 'verdicts'] } },
        { key: 'b', word: 'back', head: 'Back to the start menu — the rest keep waiting', tail: null, detail: null, recommended: false, next: START_MENU },
      ],
      typed: [],
    });
  });

  it('each verdict given from it draws the next departure — one never asked shown by the day it was made, never with another\'s skip — and the last leads to the start menu, the page drawing nothing once none waits', async () => {
    const first = await answered('A sheet.');
    const second = await answered('A frameless window.');
    give(first, 'skip', 'decided');
    page();

    assert.deepStrictEqual(picked('n'), { ok: true, entry: first, verdict: 'nothing', point: 'queue', next: THE_PAGE });
    assert.deepStrictEqual(read(page()), ['# ■ Verdicts · 1 of 1 waiting\n', `${projectName(dir)} · Note Window · changed ${madeOn(second)}\n  └─ Does a note float?\n        My answer: A panel.\n        Yours: A frameless window.\n`]);
    assert.deepStrictEqual(picked('l'), { ok: true, entry: second, verdict: 'loss', point: 'queue', next: START_MENU });

    assert.deepStrictEqual([page(), verdicts()], ['', [[full(first), 'skip', 'decided'], [full(first), 'nothing', 'queue'], [full(second), 'loss', 'queue']]]);
  });

  it('the queue takes no skip — the page has no skip row, its back leaving the rest waiting (P7): refused, logging nothing, the departure waiting as it was', async () => {
    const departed = await answered('A sheet.');

    assert.strictEqual(refusedGive(departed, 'skip', '--at', 'queue'), 'verdict give: the queue takes no skip — it takes nothing, a fix later or a real loss; b/back leaves the departure waiting');
    assert.deepStrictEqual(waiting(), [[departed, 'A panel.']]);
  });

  it('names an entry of the epic\'s own by the epic, never by the title of its topic keyed by the epic\'s name, as a pivot leaves it renamed; that topic\'s own entry by its title', () => {
    const atTheSpec = reversedAt(`${UNIT}.specification`, 'Is a theme per window?');
    const onTheTopic = reversedAt(`${UNIT}.discussion.${UNIT}`, 'Does the theme follow the system?');

    assert.strictEqual(heading(page()), `${projectName(dir)} · Fumi · changed ${madeOn(atTheSpec)}`);
    give(atTheSpec, 'fix', 'queue');
    assert.strictEqual(heading(page()), `${projectName(dir)} · Theme Switching · changed ${madeOn(onTheTopic)}`);
  });

  it('18.4.2: drawn for a unit, the epic menu\'s door, it shows and counts that unit\'s departures alone, each row giving its verdict for the unit, its back and its last verdict leading to the epic\'s menu; the project\'s page keeps every unit\'s', async () => {
    createManifest(dir, OTHER, { work_type: 'epic', phases: {} });
    const theirs = reversedAt(`${OTHER}.specification`, 'Is an atlas printed?');
    const ours = await answered('A sheet.');
    const forFumi = (/** @type {string} */ verdict) => ({ kind: 'engine', argv: ['verdict', 'give', full(ours), verdict, '--at', 'queue', '--unit', UNIT] });
    const EPIC_MENU = { kind: 'engine', argv: ['render', 'epic-menu', UNIT] };

    assert.deepStrictEqual(read(page()).map((section) => section.split('\n')[0]), ['# ■ Verdicts · 1 of 2 waiting', `${projectName(dir)} · Atlas · changed ${madeOn(theirs)}`]);
    const out = page(UNIT);
    assert.deepStrictEqual([read(out)[0], sectionOf(out, 'DISPLAY: verdicts').split('\n')[1]], ['# ■ Verdicts · 1 of 1 waiting\n', '  └─ Is a note a panel?']);
    assert.deepStrictEqual(gateShown().options.map((/** @type {{key: string, head: string, next: unknown}} */ { key, head, next }) => [key, key === 'b' ? head : null, next]), [
      ['n', null, forFumi('nothing')], ['f', null, forFumi('fix')], ['l', null, forFumi('loss')],
      ['h', null, { kind: 'engine', argv: ['render', 'help', 'verdicts', '--unit', UNIT] }], ['b', 'Back to the epic menu — the rest keep waiting', EPIC_MENU],
    ]);
    assert.strictEqual(refusedGive(theirs, 'loss', '--at', 'queue', '--unit', UNIT), `verdict give: ${theirs} stands in ${OTHER}, not ${UNIT} — the page drawn for a unit gives its own departures' verdicts`);
    assert.strictEqual(refusedGive(ours, 'loss', '--at', 'decided', '--unit', UNIT), 'verdict give: --unit names the verdict page drawn for a unit, so is given at the queue alone, never at decided');

    assert.deepStrictEqual(picked('n'), { ok: true, entry: ours, verdict: 'nothing', point: 'queue', next: EPIC_MENU });
    assert.deepStrictEqual([page(UNIT), waiting().map(([id]) => id)], ['', [theirs]]);
  });

  it('drawn for a unit cancelled since, it shows its departure as any other, which takes its verdict for the unit (16.10.12, 18.4.2)', async () => {
    const departed = await answered('A sheet.');

    ok(dir, ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual(read(page(UNIT)), [
      '# ■ Verdicts · 1 of 1 waiting\n',
      `${projectName(dir)} · Note Window · changed ${madeOn(departed)}\n  └─ Is a note a panel?\n        My answer: A panel.\n        Yours: A sheet.\n`,
    ]);
    assert.deepStrictEqual(picked('l'), { ok: true, entry: departed, verdict: 'loss', point: 'queue', next: { kind: 'engine', argv: ['render', 'epic-menu', UNIT] } });
    assert.deepStrictEqual(verdicts(), [[full(departed), 'loss', 'queue']]);
  });

  it('draws only this machine\'s departures in this project: a second machine draws nothing of the first\'s, nor an event under another project\'s id, until its own log holds the departure', async () => {
    const departed = await answered('A sheet.');
    const second = { ...SESSION, LEEWAY_CONFIG_DIR: path.join(config(), 'second-machine') };
    const secondLog = path.join(second.LEEWAY_CONFIG_DIR, TRUST_LOG);
    const [raised] = logged('raise');

    fs.mkdirSync(path.dirname(secondLog), { recursive: true });
    fs.writeFileSync(secondLog, `${JSON.stringify({ ...raised, id: newId(), project: newId() })}\n`);
    assert.strictEqual(output(dir, ['render', 'verdicts'], { env: second }), '');
    fs.appendFileSync(secondLog, `${JSON.stringify(raised)}\n`);

    assert.match(sectionOf(output(dir, ['render', 'verdicts'], { env: second }), 'DISPLAY: verdicts'), /^ {2}└─ Is a note a panel\?$/m);
    assert.deepStrictEqual(waiting(second), [[departed, 'A panel.']]);
  });
});
