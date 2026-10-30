'use strict';

// ---------------------------------------------------------------------------
// A fact raised (leeway-engine/scripts/domain/raise.cjs, its screen
// domain/projections/raise.cjs): `engine raise <place> --answers <question>
// --fact`, a fact Claude cannot check and only the person holds, on stdin
// with no lean — asked whatever the decision point would answer, its rows
// none or any number, never judged by the one-decision check, sealed as a
// fact and drawn with no lean and no row recommended (16.S75, 16.3.8); its
// answer, a row or the person's own words, landing as the person's
// decision, sealing no lean and moving no one, and nothing it does reaching
// the trust log or the verdict queue (16.3.2); the redraw rule holding
// across a fact and a call; and its refusals.
//
// Layer: verb. World: the ledger suites' unit with two questions asked on
// the note window, built once and copied for each test; each test keeps its
// conversation and the trust log in a config folder of its own. The
// separate call is the stub binary, armed where the one-decision check is
// the subject.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSectionsAsync, output, refusesAsync, refusedPristine, stateGit, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, NOTE, PHASES, askedWorld, ledgerHelpers, leaningCall } = require('./ledger-world.cjs');
const { SESSION, WHY, raiseHelpers } = require('./raise-world.cjs');
const { auditGate } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));

const ONLY_YOU_KNOW = 'Only you know this: it\'s a fact I can\'t check.';

const MONDAY = Object.freeze({ key: '1', name: 'Monday', text: 'The beta ships on Monday', notice: 'the note window is in the first build' });
const LATER = Object.freeze({ key: '2', name: 'Later', text: 'The beta ships next month', notice: 'the note window can wait for the second build' });

/** A fact with rows: when the beta ships. */
const FACT = Object.freeze({
  question: 'When does the beta go out to testers?',
  rows: [MONDAY, LATER],
  mechanism: 'The release train cuts its branch on the ship date.',
  product_wide: true,
});

/** A fact with no rows: an account Claude cannot reach. */
const BARE = Object.freeze({
  question: 'Which Apple team ID signs the beta?',
  rows: [],
  mechanism: 'The team ID goes in the export options.',
  product_wide: false,
});

const { world, asked } = askedWorld('raise-fact-', PHASES, {
  ships: 'When does the beta ship?',
  team: 'Which team signs the beta?',
});

const config = useTempFolder('raise-fact-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { full, ledgerText } = ledgerHelpers(() => dir);
const { conversation, seals: sealed, logText, answer, lastEntry } = raiseHelpers(() => dir, config, { sort: 'several', lean: '1' });

/** The conversation's sealed raises, each test's drawn first. */
const seals = () => /** @type {Record<string, any>} */ (sealed());

/**
 * A fact raised: its response and its screen.
 * @param {Record<string, unknown>} [fact] @param {{answers?: string, flags?: string[], env?: Record<string, string|undefined>}} [opts]
 */
function raiseFact(fact = FACT, { answers = asked.ships, flags = [], env } = {}) {
  return okSectionsAsync(dir, ['raise', NOTE, '--answers', answers, ...flags, '--fact'], { env: conversation(env), stdin: JSON.stringify(fact) });
}

/**
 * A draw refused, sealing nothing and writing nothing: its error.
 * @param {string[]} args @param {unknown} stdin
 */
async function refusedDraw(args, stdin) {
  const before = ledgerText();
  const { error } = await refusesAsync(dir, ['raise', ...args], { env: conversation(), stdin: JSON.stringify(stdin) });
  assert.deepStrictEqual([sealed(), ledgerText()], [null, before], 'a refused fact sealed or wrote something');
  return error;
}

/** A refused raise of `fact`, at the note window. @param {unknown} fact */
const refusedFact = (fact) => refusedDraw([NOTE, '--answers', asked.ships, '--fact'], fact);

/**
 * The screen a fact draws, its id `id`, its rows and its question as given,
 * the mechanism shown with `technical`.
 * @param {string} id @param {Record<string, any>} fact @param {{technical?: boolean}} [opts]
 */
function screen(id, fact, { technical = false } = {}) {
  /** @type {{key: string, name: string, text: string, notice: string}[]} */
  const rows = fact.rows;
  return [
    `=== MENU: raise — ${id} (emit verbatim as markdown (not a code block), then STOP for the user's response) ===`,
    '· · · · · · · · · · · ·',
    'Fumi · Note Window',
    '',
    fact.question,
    '',
    ...(rows.length === 0 ? [] : ['WHAT YOU\'D NOTICE', '', ...rows.map((row) => `- ${row.name}: ${row.notice}`), '']),
    'WHY I\'M ASKING',
    '',
    ONLY_YOU_KNOW,
    ...(technical ? ['', 'THE MECHANISM', '', fact.mechanism] : []),
    '',
    '**`◆ What\'s the answer?`**',
    '',
    ...rows.map((row) => `**\`${row.key}\`**           → ${row.text}`),
    `**\`t/technical\`** → ${technical ? 'Hide' : 'Show'} the mechanism`,
    '**`e/explain`**   → I don\'t follow — explain it again',
    '**Comment**     → Tell me in your own words, or ask about it',
    '',
  ].join('\n');
}

/**
 * The person's decision a fact answering `question` lands as, its line but
 * the time: `own` over the pick of Monday.
 * @param {string} id @param {string} question @param {Record<string, unknown>} [own]
 */
function entryOf(id, question, own = {}) {
  return {
    v: 2, id, event: 'decided', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION,
    by: 'person', who_moved_whom: 'none', answers: full(question), text: MONDAY.text, why: WHY, rules_out: [LATER.text],
    relies_on: [], product_wide: true, sealed: null, alternatives: [], evidence: [], kind: null, unchecked: true, given: 'own', cites: [], ...own,
  };
}

describe('the draw (16.S75, 16.3.8)', () => {
  it('16.S75: a fact with rows and a fact with none are each asked though the decision point would let a call proceed — never consulted — the reason a fact\'s own; the screen draws no lean and recommends no row, what the person would notice only where it has rows', async (t) => {
    const point = t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason: 'My calls hold here.' }));

    const rowed = await raiseFact();
    const bare = await raiseFact(BARE, { answers: asked.team });

    assert.deepStrictEqual([rowed.res, bare.res], [
      { ok: true, decision: 'ask', reason: ONLY_YOU_KNOW, raise: rowed.res.raise, redrawn: false },
      { ok: true, decision: 'ask', reason: ONLY_YOU_KNOW, raise: bare.res.raise, redrawn: false },
    ]);
    assert.deepStrictEqual([rowed.sections, bare.sections], [screen(rowed.res.raise, FACT), screen(bare.res.raise, BARE)]);
    assert.strictEqual(point.mock.callCount(), 0, 'the decision point was consulted on a fact');
  });

  it('a single row is a fact\'s as well', async () => {
    const one = { ...FACT, rows: [MONDAY] };

    const { res, sections } = await raiseFact(one);

    assert.strictEqual(sections, screen(res.raise, one));
  });

  it('is sealed as a fact beside the call as given, no row judged, its reason its own; raise show draws it again, the mechanism behind its toggle', async () => {
    const { res } = await raiseFact(FACT, { flags: ['--relies-on', asked.team] });

    const seal = seals()[res.raise];
    assert.deepStrictEqual(seal, {
      v: 1, id: res.raise, menu: `raise — ${res.raise}`, place: { unit: UNIT, phase: 'discussion', topic: 'note-window' },
      answers: full(asked.ships), relies_on: [full(asked.team)], replaces: null,
      call: FACT, fact: true, rows_judged: [], reason: ONLY_YOU_KNOW, at: seal.at, answered: null, didnt_follow: 0,
    });
    assert.strictEqual(output(dir, ['raise', 'show', res.raise], { env: conversation() }), `{"ok":true,"raise":"${res.raise}"}\n${screen(res.raise, FACT)}`);
    assert.strictEqual(output(dir, ['raise', 'show', res.raise, '--technical'], { env: conversation() }), `{"ok":true,"raise":"${res.raise}"}\n${screen(res.raise, FACT, { technical: true })}`);
  });

  it('the gate audit holds a fact\'s screen to its payload with the mod announced, with rows and with none', async () => {
    const rowed = await raiseFact(FACT, { env: { LEEWAY_GATE_SURFACE: '1' } });
    const bare = await raiseFact(BARE, { answers: asked.team, env: { LEEWAY_GATE_SURFACE: '1' } });

    assert.strictEqual(auditGate(rowed.sections, 'a fact with rows')?.gate, `raise — ${rowed.res.raise}`);
    assert.strictEqual(auditGate(bare.sections, 'a fact with none')?.gate, `raise — ${bare.res.raise}`);
  });

  it('the one-decision check is never called: a row it would refuse as several rules is drawn, and the separate call is never made', async () => {
    const log = path.join(config(), 'calls.jsonl');
    const several = { CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { rules: ['Ship on Monday.', 'Freeze the window.'] } }), CLAUDE_STUB_LOG: log };
    await refusesAsync(dir, ['raise', NOTE, '--answers', asked.team], { env: conversation(several), stdin: JSON.stringify(leaningCall('Monday', 'Later')) });
    assert.ok(fs.existsSync(log), 'the armed stub was never called for Claude\'s call');
    fs.rmSync(log);

    const { res } = await raiseFact(FACT, { env: several });

    assert.deepStrictEqual([seals()[res.raise].rows_judged, fs.existsSync(log)], [[], false]);
  });
});

describe('the redraw rule across a fact and a call (P6)', () => {
  it('a fact raised on a question the conversation holds an open call\'s seal for draws that seal, and a call raised on one it holds an open fact\'s seal for draws the fact', async () => {
    const call = await okSectionsAsync(dir, ['raise', NOTE, '--answers', asked.ships], { env: conversation(), stdin: JSON.stringify(leaningCall('Monday', 'Later')) });
    const fact = await raiseFact(BARE, { answers: asked.team });

    const factOverCall = await raiseFact();
    const callOverFact = await okSectionsAsync(dir, ['raise', NOTE, '--answers', asked.team], { env: conversation(), stdin: JSON.stringify(leaningCall('Monday', 'Later')) });

    assert.deepStrictEqual([factOverCall.res, factOverCall.sections], [{ ...call.res, redrawn: true }, call.sections]);
    assert.deepStrictEqual([callOverFact.res, callOverFact.sections], [{ ...fact.res, redrawn: true }, fact.sections]);
    assert.deepStrictEqual(Object.keys(seals()).sort(), [call.res.raise, fact.res.raise].sort());
  });
});

describe('the answer (16.S75, 16.3.2)', () => {
  it('16.S75: a pick and the person\'s own words each land as the person\'s decision at the raise\'s id — sealing no lean, moving no one, given as their own, unchecked — and the seal is marked; neither writes to the trust log', async () => {
    const rowed = (await raiseFact()).res.raise;
    const bare = (await raiseFact(BARE, { answers: asked.team })).res.raise;

    const res = answer(rowed, ['--pick', '1']);
    const [picked, tip] = [lastEntry(), stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim()];
    answer(bare, ['--own'], { text: 'Team ABCDE12345', why: WHY });

    assert.deepStrictEqual(res, { ok: true, raise: rowed, id: res.id, committed: tip });
    assert.deepStrictEqual([picked, lastEntry()], [
      entryOf(rowed, asked.ships),
      entryOf(bare, asked.team, { text: 'Team ABCDE12345', rules_out: [], product_wide: false }),
    ]);
    assert.deepStrictEqual([seals()[rowed].answered.answer, seals()[bare].answered.answer], ['1', null]);
    assert.strictEqual(logText(), '');
  });

  it('no answer to a fact reads as Claude\'s call or waits on a verdict: ledger since shows none, and the verdict queue holds only the departure a call\'s answer in the person\'s own words made', async () => {
    const fact = (await raiseFact()).res.raise;
    const call = (await okSectionsAsync(dir, ['raise', NOTE, '--answers', asked.team], { env: conversation(), stdin: JSON.stringify(leaningCall('Monday', 'Later')) })).res.raise;

    answer(fact, ['--own'], { text: 'The beta ships on Friday', why: WHY });
    answer(call, ['--own'], { text: 'Team ABCDE12345', why: WHY });

    assert.deepStrictEqual(ok(dir, ['ledger', 'since', UNIT], { env: conversation() }).calls, []);
    assert.deepStrictEqual(ok(dir, ['verdict', 'queue'], { env: conversation() }).departures.map((/** @type {{id: string}} */ d) => full(d.id)), [call]);
  });

  it('"I don\'t follow" writes nothing to the trust log and no ledger line; the seal counts it and the fact stays open, answered after', async () => {
    const { res } = await raiseFact();
    const ledger = ledgerText();

    assert.deepStrictEqual(answer(res.raise, ['--didnt-follow'], null), { ok: true, raise: res.raise, open: true });

    assert.deepStrictEqual([ledgerText(), logText(), seals()[res.raise].didnt_follow, seals()[res.raise].answered], [ledger, '', 1, null]);
    answer(res.raise, ['--pick', '2']);
    assert.deepStrictEqual([lastEntry().text, logText()], [LATER.text, '']);
  });

  it('refuses, writing nothing, who moved whom on a pick — it moves no one — and a key that is no row, a fact with none saying so', async () => {
    const rowed = (await raiseFact()).res.raise;
    const bare = (await raiseFact(BARE, { answers: asked.team })).res.raise;
    /** @param {string[]} args @param {unknown} given */
    const refused = (args, given) => refusedPristine(dir, ['raise', 'answer', ...args], { env: conversation(), stdin: JSON.stringify(given) }).error;

    assert.strictEqual(refused([rowed, '--pick', '1'], { why: WHY, who_moved_whom: 'none' }), 'raise answer: the answer has no field who_moved_whom — it holds why');
    assert.strictEqual(refused([rowed, '--pick', 'keep'], { why: WHY }), 'raise answer: the raise has no row keep — its rows: 1, 2');
    assert.strictEqual(refused([bare, '--pick', '1'], { why: WHY }), 'raise answer: the raise has no row 1 — its rows: none');
    assert.deepStrictEqual([seals()[rowed].answered, seals()[bare].answered, logText()], [null, null, '']);
  });
});

describe('the draw\'s refusals, drawing and sealing nothing', () => {
  it('a lean, a why or a sort — a fact carries none — and a field it lacks', async () => {
    const { mechanism: _mechanism, ...lacking } = FACT;
    for (const [fact, error] of /** @type {[unknown, string][]} */ ([
      [{ ...FACT, lean: '1' }, 'raise: the call has no field lean — it holds question, rows, mechanism, product_wide'],
      [{ ...FACT, why: 'It is soon.' }, 'raise: the call has no field why — it holds question, rows, mechanism, product_wide'],
      [{ ...FACT, sort: 'one' }, 'raise: the call has no field sort — it holds question, rows, mechanism, product_wide'],
      [lacking, 'raise: the call needs mechanism'],
    ])) {
      assert.strictEqual(await refusedFact(fact), error, JSON.stringify(fact));
    }
  });

  it('rows checked as a call\'s are: a row of another shape, a key two rows share, and the screen\'s own word', async () => {
    for (const [rows, error] of /** @type {[unknown[], string][]} */ ([
      [[MONDAY, 'Next month'], 'raise: the call\'s rows[1] is not a row — {key, name, text, notice}'],
      [[MONDAY, { ...LATER, key: '1' }], 'raise: the call\'s rows share the key 1 — each row\'s key is its own'],
      [[{ ...MONDAY, key: 'Keep' }], 'raise: the call\'s rows[0] takes the key Keep, which the screen keeps for itself — t, e, technical, explain, comment, keep are its own, in any case'],
    ])) {
      assert.strictEqual(await refusedFact({ ...FACT, rows }), error, JSON.stringify(rows));
    }
  });

  it('--fact with --replaces: a fact that changes is the person\'s to say; and --fact given twice', async () => {
    const usage = 'Usage: engine raise <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …] --fact   (the fact\'s question as JSON on stdin)';
    assert.strictEqual(await refusedDraw([NOTE, '--replaces', asked.ships, '--reason', 'new-fact', '--fact'], FACT),
      `raise --fact takes no --replaces: a fact that changes is the person's to say, and the decision it changes is replaced as any other — ${usage}`);
    assert.strictEqual(await refusedDraw([NOTE, '--answers', asked.ships, '--fact', '--fact'], FACT), `raise takes --fact once — ${usage}`);
    assert.strictEqual(await refusedDraw([NOTE, '--fact'], FACT), `raise needs --answers <id> — ${usage}`);
  });
});
