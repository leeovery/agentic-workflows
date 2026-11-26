'use strict';

// ---------------------------------------------------------------------------
// Departures and their verdicts (ledger-engine/scripts/domain/verdict.cjs,
// over the departure rule and the verdict owed in
// domain/ledger-verdicts.cjs, and the evidence this machine logged in
// domain/trust-evidence.cjs): the verb that records a departure answering
// `verdict_owed` — a raise the person answered against Claude's lean, or
// their reversal of an answer that held it, the ledger agreeing it stood
// over the lean — and who moved whom as the write verbs hold it: never over
// the lean on an entry Claude made, and on the person's replacement of a
// decision, what its reason and the entry it replaces allow, the engine
// setting it where that is one value and the writer leaves it out, the
// writer saying it where only the writer can tell; `engine verdict give`,
// a verdict logged in the trust log by its entry and how it was given —
// asked, or read from the person's words — each final, a skip among them,
// refusing an entry that is no departure, a departure this machine logged
// none for, and one given its verdict — a peer's among them, given while it
// waited on the writer lock, and one waiting in any conversation — and argv
// of another shape; an append that fails a warning, the verdict waiting in
// the conversation for its next record; and `engine render verdict`, the
// question on a departure owed one (domain/projections/verdict.cjs), its
// four rows each giving a verdict as asked. A second machine is a config
// folder of its own over the same state.
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
  NO_SPACE, ok, refuses, refusedPristine, output, sectionOf, statePath, holdLock, lockAttempts, failingTrustAppends, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, askedWorld, ledgerHelpers, leaningCall, answeredRaise } = require('./ledger-world.cjs');
const { trustLogHelpers } = require('./trust-world.cjs');
const { labelling } = require('./labels.cjs');
const { auditGate } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { TRUST_LOG, record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { WRITER_LOCK } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { gateShown } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { countsOf, stateOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { THRESHOLD } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));

/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** Claude's lean on the questions the person answers here, unless a test leans otherwise. */
const LEAN = 'A panel.';

/** Why a verdict is refused on a departure this machine logged none for. */
const ELSEWHERE = 'a departure\'s verdict is given on the machine where it was made, and the person\'s replacement of their own departure is owed none';

/** Why a verdict is refused on a departure given one. */
const GIVEN = 'a verdict is given once, at the departure, and a verdict given is corrected, never given again';

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
  pinned = process.env.LEDGER_CONFIG_DIR;
  process.env.LEDGER_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.LEDGER_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { full, entries } = ledgerHelpers(() => dir);

/** @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function args(verb, address, flags, content) {
  return /** @type {const} */ ([['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }]);
}

/** One write that must succeed: its answer. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function landed(verb, address, flags, content) {
  return ok(dir, ...args(verb, address, flags, content));
}

/** One write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return landed(verb, address, flags, content).id;
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
 * conversation `env` names. `raise answer`'s answer.
 * @param {string} text @param {{lean?: string, moved?: string, at?: string, env?: Record<string, string>}} [opts]
 */
function answering(text, { lean = LEAN, moved, at = NOTE, env = SESSION } = {}) {
  const agrees = text === lean;
  const question = at === NOTE ? /** @type {string} */ (open.shift()) : write('ask', at, [], { ...MADE, text: 'Where does a note open?' });
  return answeredRaise(dir, at, question, { lean, other: agrees ? 'Something else.' : text, key: agrees ? '1' : '2', moved, env });
}

/** The person's answer to Claude's lean, as `answering` gives it: its short id. @param {string} text @param {Parameters<typeof answering>[1]} [opts] */
async function answered(text, opts) {
  return (await answering(text, opts)).id;
}

/** `old` replaced on the note window for `reason`, made and moved as `made` says. @param {string} old @param {string} reason @param {Record<string, unknown>} made @param {string[]} [flags] */
function replacing(old, reason, made, flags = []) {
  return /** @type {const} */ (['replace', NOTE, ['--replaces', old, '--reason', reason, ...flags], { ...made, drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.' }]);
}

/** The verdict owed on what a write answered, null where it owes none. @param {Record<string, unknown>} answer */
const owed = (answer) => answer.verdict_owed ?? null;

/** The departures this machine's trust log owes a verdict, each by its full id. @param {Record<string, string>} [env] */
function owing(env = {}) {
  const saved = process.env.LEDGER_CONFIG_DIR;
  if (env.LEDGER_CONFIG_DIR !== undefined) process.env.LEDGER_CONFIG_DIR = env.LEDGER_CONFIG_DIR;
  try {
    const { departures, verdicts } = evidenceOf(statePath(dir));
    return [...departures].filter((id) => !verdicts.has(id));
  } finally {
    process.env.LEDGER_CONFIG_DIR = saved;
  }
}

/** A verdict that must be given: its answer. @param {string} entry @param {string} verdict @param {{words?: boolean, env?: Record<string, string>}} [opts] */
function give(entry, verdict, { words = false, env = {} } = {}) {
  return ok(dir, ['verdict', 'give', entry, verdict, ...(words ? ['--from-words'] : [])], { env });
}

const { logText, logEvents } = trustLogHelpers(() => dir, config);

/** The trust log's events of `type`. @param {string} type */
const logged = (type) => logEvents().filter((event) => event.type === type);

/** The verdict lines the trust log holds, each by its entry, verdict and how it was given. */
function verdicts() {
  return logged('verdict').map(({ entry, verdict, given }) => [entry, verdict, given]);
}

/** A verdict that must be refused, logging nothing: its error. @param {string[]} argv */
function refusedGive(...argv) {
  const before = logText();
  const { error } = refuses(dir, ['verdict', 'give', ...argv]);
  assert.strictEqual(logText(), before, `verdict give ${argv.join(' ')} refused, yet logged`);
  return error;
}

describe('the verdict owed (5.8.10, 16.10)', () => {
  it('owes the person\'s answer that stood over Claude\'s lean its verdict, the raise\'s answer naming its entry (16.10.1)', async () => {
    const answer = await answering('A sheet.');

    assert.deepStrictEqual([owed(answer), owing()], [answer.id, [full(answer.id)]]);
  });

  it('owes the person\'s replacement of Claude\'s own call for a changed mind or a mistake — a call overruled when shown — its verdict, the engine setting who moved whom where the writer leaves it out and refusing any other', () => {
    const call = decide('A panel.', MADE);
    assert.strictEqual(refused(...replacing(call, 'was-wrong', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that held Claude\'s lean, for a changed mind or a mistake, stands over it: person-moved-claude');

    const overruled = landed(...replacing(call, 'was-wrong', { by: 'person' }));

    assert.deepStrictEqual([owed(overruled), entries().find((entry) => entry.id === full(overruled.id))?.who_moved_whom], [overruled.id, 'person-moved-claude']);
  });

  it('owes nothing where the person took Claude\'s lean or came round to it, nor on Claude\'s own call or a finding; their later reversal of either answer names it, cancels its agreement, and owes its verdict, the raise\'s line as it was (16.S41, 16.10.10)', async () => {
    const agreed = await answering(LEAN);
    const cameRound = await answering('A frameless window.', { lean: 'A frameless window.', moved: 'claude-moved-person' });
    const call = decide('Notes snap to the grid.', MADE);
    const finding = landed('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it', known: 'read' });
    assert.deepStrictEqual([agreed, cameRound, finding].map(owed), [null, null, null]);
    const raises = logText();

    const reversed = landed(...replacing(agreed.id, 'changed-mind', persons('person-moved-claude')));
    const reversedToo = landed(...replacing(cameRound.id, 'changed-mind', persons('person-moved-claude')));

    const reversals = logged('reversal');
    assert.deepStrictEqual(reversals.map(({ entry, reverses }) => [entry, reverses]), [[full(reversed.id), full(agreed.id)], [full(reversedToo.id), full(cameRound.id)]]);
    assert.deepStrictEqual(evidenceOf(statePath(dir)).answers.map(({ event, standing, cancelled_by: by }) => [event.entry, standing, by]), [
      [full(agreed.id), 'agreement', reversals[0].id], [full(cameRound.id), 'agreement', reversals[1].id], [full(call), 'call', null],
      [full(reversed.id), 'departure', null], [full(reversedToo.id), 'departure', null],
    ]);
    assert.deepStrictEqual([reversed, reversedToo].map(owed), [reversed.id, reversedToo.id]);
    assert.ok(logText().startsWith(raises), 'the raises\' lines were rewritten');
  });

  it('takes the person\'s replacement of their own departure at their word, a return to Claude\'s lean or a third answer still against it, never the lean from the start: neither is owed a verdict, the departure it replaced still owed its own (P4)', async () => {
    const returned = await answered('A sheet.');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it or stands over it still: claude-moved-person or person-moved-claude');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', { by: 'person' })), 'ledger replace: the content needs who_moved_whom');
    const back = landed(...replacing(returned, 'changed-mind', persons('claude-moved-person')));

    const departed = await answered('A frameless window.');
    const third = landed(...replacing(departed, 'was-wrong', persons('person-moved-claude')));

    assert.deepStrictEqual([owed(back), owed(third), owing()], [null, null, [full(returned), full(departed)]]);
    assert.strictEqual(refusedGive(third.id, 'loss'), `verdict give: ${third.id} is no departure this machine logged — ${ELSEWHERE}`);
  });

  it('never takes a replacement for a new fact or another topic\'s decision as a departure: new information, not disagreement', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike', known: 'spike' });
    const theirs = decide('A note opens on the active Space.', MADE, SPACE);
    assert.strictEqual(refused(...replacing(call, 'new-fact', persons('person-moved-claude'), ['--cause', fact])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for a new fact brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');
    assert.strictEqual(refused(...replacing(call, 'other-topic', persons('person-moved-claude'), ['--cause', theirs])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for another topic\'s decision brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');

    const changed = landed(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));
    const again = landed(...replacing(changed.id, 'other-topic', persons('claude-moved-person'), ['--cause', theirs]));

    assert.deepStrictEqual([owed(changed), owed(again), owing()], [null, null, []]);
  });

  it('never takes the person\'s replacement of their own decision, on a chain Claude never leaned on, as a departure, for a changed mind or a mistake: it moves no one — set where it is left out, any other value refused — owes no verdict and logs no reversal (16.10.1)', () => {
    const own = decide('A sheet.', { by: 'person' });
    const noLean = 'the person\'s decision holds no lean of Claude\'s to move, no entry down its chain being Claude\'s own or carrying its sealed answer; their answer to Claude\'s lean is recorded by raise answer: none';
    for (const reason of ['changed-mind', 'was-wrong']) {
      assert.strictEqual(refused(...replacing(own, reason, persons('person-moved-claude'))), `ledger replace: who_moved_whom is person-moved-claude — ${noLean}`);
    }

    const changed = landed(...replacing(own, 'changed-mind', { by: 'person' }));
    const corrected = landed(...replacing(changed.id, 'was-wrong', { by: 'person' }));

    assert.deepStrictEqual([own, changed.id, corrected.id].map((id) => entries().find((entry) => entry.id === full(id))?.who_moved_whom), ['none', 'none', 'none']);
    assert.deepStrictEqual([owed(changed), owed(corrected), logged('reversal')], [null, null, []]);
  });

  it('takes the person\'s replacement for a changed mind as a reversal where Claude leaned down its chain: Claude\'s call, replaced by the person for a new fact, then changed, the new fact\'s answer as the lean', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike', known: 'spike' });
    const updated = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));

    const reversed = landed(...replacing(updated, 'changed-mind', { by: 'person' }));

    assert.strictEqual(owed(reversed), reversed.id);
    assert.deepStrictEqual(logged('reversal').map(({ entry, reverses }) => [entry, reverses]), [[full(reversed.id), full(updated)]]);
    assert.match(sectionOf(output(dir, ['render', 'verdict', reversed.id], { env: SESSION }), 'DISPLAY: verdict'), new RegExp(`My answer: Not ${call}\\.`));
  });

  it('refuses an entry Claude made standing over its own lean', () => {
    assert.strictEqual(refused('decide', NOTE, ['--answers', questions.note], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');
  });

  it('takes a departure\'s verdict wherever it was made — its topic cancelled or postponed since — the count of its kind holding it a loss until then (16.10.12, 16.10.8)', async () => {
    const env = { ...SESSION, ...labelling(leaningCall(LEAN, '').question, 'behaviour') };
    const cancelled = await answered('A sheet.', { env });
    const postponed = await answered('A sheet.', { at: SPACE, env });
    const losses = () => stateOf(countsOf(statePath(dir), { model: null, now: Date.now() }).kinds.behaviour, THRESHOLD).losses;

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    ok(dir, ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later']);
    assert.strictEqual(losses(), 2);

    give(cancelled, 'nothing');
    assert.deepStrictEqual([owing(), losses()], [[full(postponed)], 1]);
  });
});

describe('giving a verdict (16.10.1, 16.10.9)', () => {
  it('logs the verdict on a departure in the trust log, by its entry, as asked, answering the entry by its short id; read from the person\'s words with --from-words; the others still owed', async () => {
    const asked = await answered('A sheet.');
    const said = await answered('A frameless window.');
    const unjudged = await answered('A floating card.');

    assert.deepStrictEqual(give(asked, 'loss'), { ok: true, entry: asked, verdict: 'loss', given: 'asked' });
    assert.deepStrictEqual(give(said, 'nothing', { words: true }), { ok: true, entry: said, verdict: 'nothing', given: 'words' });

    assert.deepStrictEqual(verdicts(), [[full(asked), 'loss', 'asked'], [full(said), 'nothing', 'words']]);
    assert.deepStrictEqual(owing(), [full(unjudged)]);
  });

  it('takes a skip — the person can\'t call it yet — as final: never another verdict after it, any more than after one given, a skip among them (16.15.4)', async () => {
    const skipped = await answered('A sheet.');
    const judged = await answered('A frameless window.');
    give(skipped, 'skip');
    give(judged, 'fix', { words: true });

    for (const [entry, verdict] of [[skipped, 'fix'], [skipped, 'skip'], [judged, 'loss']]) {
      assert.strictEqual(refusedGive(entry, verdict), `verdict give: ${entry} has its verdict — ${GIVEN}`);
    }
    assert.deepStrictEqual(owing(), []);
  });

  it('refuses, logging nothing, an entry that is no departure — Claude\'s call, the person\'s answer that took Claude\'s lean, a finding — a prefix naming no entry, a verdict outside the four, and argv of another shape', async () => {
    const call = decide('A panel.', MADE);
    const agreed = await answered(LEAN);
    const finding = write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it', known: 'read' });
    const departed = await answered('A sheet.');
    const usage = /^Usage: engine verdict give <entry> <nothing\|fix\|loss\|skip> \[--from-words\]$/;

    for (const entry of [call, agreed, finding]) {
      assert.strictEqual(refusedGive(entry, 'loss'), `verdict give: ${entry} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
    }
    assert.strictEqual(refusedGive('zzzzzz', 'loss'), 'verdict give: no ledger entry\'s id begins "zzzzzz"');
    assert.strictEqual(refusedGive(departed, 'win'), 'verdict give: "win" is no verdict — nothing, fix, loss, skip');
    for (const argv of [[departed], [departed, 'loss', 'fix'], [departed, 'loss', '--at', 'decided'], [departed, 'loss', '--from-words', '--from-words'], ['--from-words', 'loss']]) {
      assert.match(refusedGive(...argv), usage, argv.join(' '));
    }
    assert.match(refuses(dir, ['verdict', 'queue']).error, /^Usage: engine verdict <give> …\nverdict give /);
    assert.deepStrictEqual(owing(), [full(departed)]);
  });

  it('holds the writer lock, so a peer\'s verdict on the departure, given while it waits, refuses its own', async (t) => {
    const departed = await answered('A sheet.');
    const lock = holdLock(statePath(dir, WRITER_LOCK));
    // The peer gives its verdict and lets go at the give's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      if (taken < 2) return;
      record('verdict', { entry: full(departed), verdict: 'nothing', given: 'words' }, { cwd: dir, warnings: [] });
      fs.unlinkSync(lock);
    });

    assert.strictEqual(refuses(dir, ['verdict', 'give', departed, 'loss']).error, `verdict give: ${departed} has its verdict — ${GIVEN}`);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(verdicts(), [[full(departed), 'nothing', 'words']]);
  });

  it('an append that fails is a warning, the verdict waiting in the conversation and counting as given in every conversation; the conversation\'s next record lands it, once (16.S74)', async (t) => {
    const first = await answered('A sheet.');
    const second = await answered('A frameless window.');
    const peer = { CLAUDE_CODE_SESSION_ID: 'session-2' };
    const waitingFile = path.join(conversationDir(SESSION.CLAUDE_CODE_SESSION_ID), 'trust-pending.jsonl');
    const failing = failingTrustAppends(t);

    const failed = give(first, 'loss', { env: SESSION });

    assert.deepStrictEqual(failed.warnings, [`the trust log was not written: ${NO_SPACE} — the event waits in the conversation, appended first by its next record`]);
    assert.deepStrictEqual(fs.readFileSync(waitingFile, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).entry), [full(first)]);
    assert.strictEqual(refuses(dir, ['verdict', 'give', first, 'fix'], { env: peer }).error, `verdict give: ${first} has its verdict — ${GIVEN}`);
    assert.deepStrictEqual(verdicts(), []);
    failing.mock.restore();

    give(second, 'fix', { env: SESSION });

    assert.deepStrictEqual(verdicts(), [[full(first), 'loss', 'asked'], [full(second), 'fix', 'asked']]);
    assert.ok(!fs.existsSync(waitingFile), 'the verdict landed, yet waits on to land again');
    assert.deepStrictEqual(owing(), []);
  });
});

describe('the departures this machine logged (16.13.1, 16.13.5, 16.13.6)', () => {
  it('owes a departure whose raise event waits in the conversation ahead of its entry, the trust log\'s append failing after the ledger\'s, its verdict', async (t) => {
    failingTrustAppends(t);

    const answer = await answering('A sheet.');

    const kept = fs.readFileSync(path.join(conversationDir(SESSION.CLAUDE_CODE_SESSION_ID), 'trust-pending.jsonl'), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line));
    assert.deepStrictEqual(kept.map(({ awaits, event }) => [awaits.entry, event.type]), [[full(answer.id), 'raise']]);
    assert.deepStrictEqual([logText(), owed(answer)], ['', answer.id]);
  });

  it('on a second machine, a config folder of its own, the project\'s departures are in the ledger and none is owed there, and give refuses them; of the second\'s own log, an event under another project\'s id is none of this project\'s', async () => {
    const judged = await answered('A sheet.');
    const unjudged = await answered('A frameless window.');
    give(judged, 'loss');
    const second = { LEDGER_CONFIG_DIR: path.join(config(), 'second-machine') };
    const secondLog = path.join(second.LEDGER_CONFIG_DIR, TRUST_LOG);

    const { decisions } = ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: second });
    assert.deepStrictEqual(decisions.filter((/** @type {{who_moved_whom: string}} */ d) => d.who_moved_whom === 'person-moved-claude').map((/** @type {{id: string}} */ d) => d.id), [judged, unjudged]);
    assert.deepStrictEqual(owing(second), []);
    for (const entry of [judged, unjudged]) {
      assert.strictEqual(refuses(dir, ['verdict', 'give', entry, 'skip'], { env: second }).error, `verdict give: ${entry} is no departure this machine logged — ${ELSEWHERE}`);
    }
    assert.ok(!fs.existsSync(secondLog), 'the second machine logged a verdict it refused');
    assert.deepStrictEqual(owing(), [full(unjudged)]);

    const [raised] = logged('raise').filter(({ entry }) => entry === full(unjudged));
    fs.mkdirSync(path.dirname(secondLog), { recursive: true });
    fs.writeFileSync(secondLog, `${JSON.stringify({ ...raised, id: newId(), project: newId() })}\n`);
    assert.deepStrictEqual(owing(second), []);
    fs.appendFileSync(secondLog, `${JSON.stringify(raised)}\n`);
    assert.deepStrictEqual(owing(second), [full(unjudged)]);
  });
});

describe('the verdict question (16.10.2)', () => {
  /** The question as drawn in the conversation. @param {string} entry @param {Record<string, string>} [env] */
  const question = (entry, env = SESSION) => output(dir, ['render', 'verdict', entry], { env });

  /** The verdict a row of the question leads to, given: its answer. @param {string} key */
  const picked = (key) => ok(dir, /** @type {{argv: string[]}} */ (ok(dir, ['gate', 'verdict', '--pick', key], { env: SESSION }).next).argv, { env: SESSION });

  it('draws the departure — the question it answers, Claude\'s answer and the person\'s — then the four verdicts, each given as asked; the question keeps the design system', async () => {
    const departed = await answered('A sheet.');

    const out = question(departed);

    assert.strictEqual(sectionOf(out, 'DISPLAY: verdict'), 'YOUR VERDICT\n  └─ Is a note a panel?\n        My answer: A panel.\n        Yours: A sheet.\n');
    const verdict = (/** @type {string} */ word) => ({ kind: 'engine', argv: ['verdict', 'give', full(departed), word] });
    assert.deepStrictEqual(gateShown(), {
      gate: 'verdict',
      question: 'What would my answer have cost the product?',
      options: [
        { key: 'n', word: 'nothing', head: 'Nothing — mine would have served as well', tail: null, detail: null, recommended: false, next: verdict('nothing') },
        { key: 'f', word: 'fix', head: 'A fix later', tail: null, detail: null, recommended: false, next: verdict('fix') },
        { key: 'l', word: 'loss', head: 'A real loss', tail: null, detail: null, recommended: false, next: verdict('loss') },
        { key: 's', word: 'skip', head: 'I can\'t call it yet', tail: null, detail: null, recommended: false, next: verdict('skip') },
      ],
      typed: [],
      showing: null,
      hold: null,
    });
    auditGate(output(dir, ['render', 'verdict', departed], { env: { ...SESSION, LEDGER_GATE_SURFACE: '1' } }), 'render verdict');
  });

  it('gives the verdict its row picks, as asked, and draws the question no more once it has one', async () => {
    const departed = await answered('A sheet.');
    question(departed);

    assert.deepStrictEqual(picked('s'), { ok: true, entry: departed, verdict: 'skip', given: 'asked' });

    assert.strictEqual(refuses(dir, ['render', 'verdict', departed], { env: SESSION }).error, `render verdict: ${departed} has its verdict — ${GIVEN}`);
    assert.deepStrictEqual(verdicts(), [[full(departed), 'skip', 'asked']]);
  });

  it('refuses an entry that is no departure, and a departure another machine logged', async () => {
    const call = decide('A panel.', MADE);
    const departed = await answered('A sheet.');
    const second = { ...SESSION, LEDGER_CONFIG_DIR: path.join(config(), 'second-machine') };

    assert.strictEqual(refuses(dir, ['render', 'verdict', call], { env: SESSION }).error, `render verdict: ${call} is no departure — a verdict is given on the person's answer that stood over Claude's lean`);
    assert.strictEqual(refuses(dir, ['render', 'verdict', departed], { env: second }).error, `render verdict: ${departed} is no departure this machine logged — ${ELSEWHERE}`);
  });
});
