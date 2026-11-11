'use strict';

// ---------------------------------------------------------------------------
// Blind questions (16.17; leeway-engine/scripts/domain/raise.cjs, its
// screen domain/projections/raise.cjs, the draw domain/decision-point.cjs):
// a call the ask rule lets proceed, drawn blind by its question's id — the
// root of the question's chain, or the decision a replacement would
// replace, so every raise of it draws alike — asked cold, its screen
// holding Claude's answer back while the seal keeps it, the draw logged
// once (16.S52, 16.S65); its answer revealed beside Claude's, with how often
// Claude picked as the person did on its kind, and a differing answer a
// departure waiting on its verdict (16.17.7, 16.S66); and mid-build, a call
// cheap to undo going ahead while its question waits, parking no task and
// counted among the questions waiting, the person's agreement keeping it
// and their disagreement replacing it, what relied on it affected (16.S53),
// where one hard to undo, or a replacement, parks its task as any question
// does.
//
// Layer: verb. World: an epic in discussion, a question asked at its
// topic; and an epic beside it in its build, in auto, questions asked there
// and a decision of Claude's — built once and copied for each test; each
// test keeps its conversation and the trust log in a config folder of its
// own, the log holding a quiet kind. The decision point is the rule, as
// switching it on makes it, drawing on an id that draws blind
// (trust-world.cjs). The world has no tracker, so the check that the
// tracker holds the task a raise parks is passed over here
// (test-engine-task-parks.cjs). The separate call is the stub binary,
// labelling the call's question, and reading no answer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, refusedPristine, fixtureFrom, cleanupFixture, statePath } = require('./engine-harness.cjs');
const { useTempFolder, createManifest, readManifest, withEnv } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, WHY, raiseHelpers } = require('./raise-world.cjs');
const { DRAWN } = require('./trust-world.cjs');
const { auditGate } = require('./gate-audit.cjs');
const { fixture } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));
const { waitsOf } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { TREE_WIDTH } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));
const { RAISE_SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

const BLIND = 'I\'m asking you this one cold, keeping my answer back until you\'ve given yours, to check my calls against yours.';
// An epic in its build, in auto, beside the epic in discussion.
const BUILT = 'mint';
const BUILD = `${BUILT}.implementation`;

const CURSOR = Object.freeze({ key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' });
const MAIN = Object.freeze({ key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });

/** Claude's call: where a new note opens, leaning to the cursor's screen. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [CURSOR, MAIN],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** Claude's call proposing a shadow in place of its decision on the note's shadow. */
const SHADOWED = Object.freeze({
  ...CALL,
  question: 'Should a note cast a soft shadow after all?',
  rows: [{ key: '1', name: 'Soft', text: 'A soft shadow', notice: 'notes lift off the desk' }, { key: '2', name: 'Line', text: 'A hairline edge', notice: 'notes sit flat with an edge' }],
});

/** What the world holds, by name: each question's and the decision's short id. */
const made = { note: '', where: '', size: '', mine: '' };

const world = fixtureFrom('raise-blind-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, BUILT, { work_type: 'epic', phases: PHASES, build: { position: 'auto' } });
  const { write } = ledgerHelpers(() => template);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }).id;
  made.note = ask(NOTE, 'Where does a new note open?');
  made.where = ask(BUILD, 'Where does a new note open on a second screen?');
  made.size = ask(BUILD, 'How big is a new note?');
  made.mine = write('decide', BUILD, ['--answers', ask(BUILD, 'Does a note cast a shadow?')], { ...MADE, text: 'No shadow.', why: 'Flat looks calmer.' }).id;
});

const config = useTempFolder('raise-blind-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, full, entries } = ledgerHelpers(() => dir);
const { conversation, inFolder, seals, logged, quietOn, labelledAs, raised } = raiseHelpers(() => dir, config, CALL);

/**
 * The decision point forced to the rule, as switching it on makes it, for
 * test `t`, on a question whose id draws blind: the questions it was given,
 * each by the id it would hash.
 * @param {import('node:test').TestContext} t
 */
function drawingBlind(t) {
  return t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => decisionPoint.ruled(call, { ...at, question: DRAWN }));
}

/**
 * The person's answer to a blind raise, which must land: its response and
 * what it shows besides.
 * @param {string} id @param {string[]} how @param {Record<string, unknown>} [given]
 */
const answered = (id, how, given = { why: WHY }) => okSections(dir, ['raise', 'answer', id, ...how], { env: conversation(), stdin: JSON.stringify(given) });

const REVEALED = '=== DISPLAY: blind question revealed (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';

/**
 * A reveal as the person reads it: its marker, and its words, each line
 * within the screen's width, rejoined.
 * @param {string} sections
 */
function readReveal(sections) {
  const [marker, ...lines] = sections.trimEnd().split('\n');
  assert.ok(lines.every((line) => line.length <= TREE_WIDTH), sections);
  return [marker, lines.join(' ')];
}

/**
 * The screen a blind raise of `call` draws, its id `id`, headed `header`,
 * the mechanism shown with `technical`: no lean, no row recommended and
 * no reason it asks.
 * @param {string} id @param {{header?: string, technical?: boolean}} [opts]
 */
function blindScreen(id, { header = 'Fumi · Note Window', technical = false } = {}) {
  return [
    `=== MENU: raise — ${id} (emit verbatim as markdown (not a code block), then STOP for the user's response) ===`,
    '· · · · · · · · · · · ·',
    header,
    '',
    'When you make a new note, where should its window open?',
    '',
    'WHAT YOU\'D NOTICE',
    '',
    '- Cursor: the note opens where you are looking',
    '- Main: every note opens on the same screen',
    ...(technical ? ['', 'THE MECHANISM', '', 'The screen under the pointer when the note is made.'] : []),
    '',
    '**`◆ Which way?`**',
    '',
    '**`1`**           → On the screen the cursor is on',
    '**`2`**           → On the main screen',
    `**\`t/technical\`** → ${technical ? 'Hide' : 'Show'} the mechanism`,
    '**`e/explain`**   → I don\'t follow — explain it again',
    '**Comment**     → Ask about it, or tell me what I\'ve missed',
    '',
  ].join('\n');
}

/** The trust log's events of `type` logged in the conversation, the quiet kind's history passed over. @param {string} type */
const loggedOf = (type) => logged().filter((event) => event.type === type && event.session === SESSION);

/** The verdict queue's departures, by id. */
const queued = () => ok(dir, ['verdict', 'queue'], { env: conversation() }).departures.map((/** @type {{id: string}} */ d) => d.id);

describe('the draw (16.17.1–16.17.5)', () => {
  it('16.S52, 16.S65: a call the rule lets proceed whose question\'s id draws blind is asked cold — answered blind, its screen holding Claude\'s answer back, no lean, no row recommended and no reason it asks, with the mechanism shown or not, its payload alike — Claude\'s answer sealed all the same, the draw logged once with the call\'s kind, naming the raise, and the same question raised again drawn as sealed (6.S24)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');

    const { res, sections } = await raised(NOTE, ['--answers', made.note], CALL, env);
    const again = await raised(NOTE, ['--answers', made.note], CALL, { ...env, LEEWAY_GATE_SURFACE: '1' });
    const technical = okSections(dir, ['raise', 'show', res.raise, '--technical'], { env: { ...env, LEEWAY_GATE_SURFACE: '1' } }).sections;

    assert.deepStrictEqual([res, sections], [{ ok: true, decision: 'blind', reason: BLIND, raise: res.raise, redrawn: false }, blindScreen(res.raise)]);
    assert.deepStrictEqual([again.res, again.sections.replace(/^=== GATE.*\n.*\n/, '')], [{ ok: true, decision: 'blind', reason: BLIND, raise: res.raise, redrawn: true }, blindScreen(res.raise)]);
    const drawn = auditGate(again.sections, 'raise, blind');
    const held = await fixture('raise-blind.mjs');
    assert.deepStrictEqual(drawn, { ...held, gate: `raise — ${res.raise}` }, 'the mod\'s blind question is not the payload the engine states (6.S19)');
    const gate = /** @type {Record<string, any>} */ (auditGate(technical, 'raise show --technical, blind'));
    assert.deepStrictEqual([technical.replace(/^=== GATE.*\n.*\n/, ''), gate.options.map((/** @type {{recommended: boolean}} */ o) => o.recommended)], [blindScreen(res.raise, { technical: true }), [false, false, false, false]]);
    const { call, blind, reason, answered: answer } = seals()?.[res.raise] ?? {};
    assert.deepStrictEqual([call, blind, reason, answer], [CALL, true, BLIND, null]);
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry, kind }) => [entry, kind]), [[res.raise, 'behaviour']]);
  });

  it('16.S52: the id a draw hashes is the question\'s, the same on every raise of it — its rewording raised drawing as the question did — and on a replacement the decision it would replace (16.17.4, E3)', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');

    await raised(NOTE, ['--answers', made.note], CALL, conversation());
    const reworded = write('replace', NOTE, ['--replaces', made.note, '--reason', 'changed-mind'], { ...MADE, drops: ['open'], text: 'Where does a new note open first?' }).id;
    await raised(NOTE, ['--answers', reworded], CALL, conversation());
    await raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', '2.3'], SHADOWED, conversation());

    assert.deepStrictEqual(decide.mock.calls.map(({ arguments: [, at] }) => at.question), [full(made.note), full(made.note), full(made.mine)]);
  });

  it('16.S52: a draw is logged only for a seal sealed blind by that raise — another raise of the question, sealed in the conversation while this one\'s call was decided, is drawn as it was sealed, no draw logged (16.17.5)', async (t) => {
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');
    const asked = (await raised(NOTE, ['--answers', made.note], CALL, env)).res;
    const sealedMeanwhile = fs.readFileSync(inFolder(RAISE_SHOWN));
    fs.rmSync(inFolder(RAISE_SHOWN));
    t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => {
      fs.writeFileSync(inFolder(RAISE_SHOWN), sealedMeanwhile);
      return decisionPoint.ruled(call, { ...at, question: DRAWN });
    });

    const raced = (await raised(NOTE, ['--answers', made.note], CALL, env)).res;

    assert.deepStrictEqual(raced, { ...asked, redrawn: true });
    assert.deepStrictEqual(loggedOf('blind-draw'), []);
  });
});

describe('the reveal (16.17.7, 16.10.10)', () => {
  it('the person\'s pick of Claude\'s answer, revealed as it lands: what they picked, that Claude would have picked the same, and of the kind\'s last 25 answers in the project how many Claude picked as they did — the quiet kind\'s 30 and this one; never said to have come round to Claude\'s answer, which they never saw; answered again, nothing revealed; shown again, the raise holds Claude\'s answer back no longer (16.17.2)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { raise } = (await raised(NOTE, ['--answers', made.note], CALL, labelledAs(CALL, 'behaviour'))).res;

    const cameRound = refusedPristine(dir, ['raise', 'answer', raise, '--pick', CURSOR.key], { env: conversation(), stdin: JSON.stringify({ why: WHY, who_moved_whom: 'claude-moved-person' }) }).error;
    const first = answered(raise, ['--pick', CURSOR.key]);
    const again = answered(raise, ['--pick', CURSOR.key]);
    const shown = okSections(dir, ['raise', 'show', raise], { env: conversation() }).sections.split('\n');

    assert.strictEqual(cameRound, 'raise answer: the answer has no field who_moved_whom — it holds why', 'the person never saw the lean, so never came round to it');
    assert.deepStrictEqual(readReveal(first.sections), [REVEALED, `You picked: on the screen the cursor is on. I'd have picked the same. On behaviour in ${projectName(dir)}, I've picked the same as you 25 of the last 25 times.`]);
    assert.deepStrictEqual([again.res.already, again.sections], [true, '']);
    assert.deepStrictEqual(loggedOf('raise').map(({ sealed, answer }) => [sealed, answer]), [['1', '1']]);
    assert.deepStrictEqual(shown.filter((line) => line.startsWith('I lean:') || line.endsWith('(recommended)')), ['I lean: On the screen the cursor is on', '**`1`**           → On the screen the cursor is on (recommended)']);
  });

  it('16.S66: a pick other than Claude\'s answer is revealed beside it, and is a departure waiting in the verdict queue; the person\'s own words, which the reader cannot read as a row, are revealed as said, a departure too (16.10.10)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');
    const picked = (await raised(NOTE, ['--answers', made.note], CALL, env)).res.raise;
    const elsewhere = write('ask', NOTE, [], { ...MADE, text: 'Where does a note open from the menu bar?' }).id;
    const said = (await raised(NOTE, ['--answers', elsewhere], CALL, env)).res.raise;

    const other = answered(picked, ['--pick', MAIN.key]);
    const own = answered(said, ['--own'], { text: 'Where I last left one', why: WHY });

    const project = projectName(dir);
    assert.deepStrictEqual([readReveal(other.sections), readReveal(own.sections)], [
      [REVEALED, `You picked: on the main screen. I'd have picked: on the screen the cursor is on. On behaviour in ${project}, I've picked the same as you 24 of the last 25 times.`],
      [REVEALED, `You said: where I last left one. I'd have picked: on the screen the cursor is on. On behaviour in ${project}, I've picked the same as you 23 of the last 25 times.`],
    ]);
    assert.deepStrictEqual(queued(), [other.res.id, own.res.id]);
  });
});

describe('mid-build (16.17.6, 12.13)', () => {
  /** A raise in the build on where a new note opens for task 2.3, labelled behaviour, hard to undo where `hardToUndo`. @param {boolean} [hardToUndo] */
  const raisedInBuild = (hardToUndo = false) => raised(BUILD, ['--answers', made.where, '--parks', '2.3'], CALL, labelledAs(CALL, 'behaviour', { hardToUndo }));

  it('16.S53: a blind question on a call cheap to undo lets Claude\'s call go ahead for its task while the question waits, parking no task — Claude\'s proposal to replace that call, its draw naming the call, which then counts for nothing — and every count of the questions waiting holds it; drawn, it shows no lean and no keep row, the call\'s own row keeping it', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raisedInBuild();
    const [decided, park] = entries().slice(-2);
    const drawn = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() });

    assert.deepStrictEqual(res, {
      ok: true, decision: 'blind', reason: BLIND, parked: 'Q1', task: null, id: res.id, committed: res.committed,
      line: `Q1 waits for you, parking no task: ${CALL.question} The build carries on.`,
      landed: { id: res.landed.id, committed: res.landed.committed },
    });
    assert.deepStrictEqual([decided.event, decided.by, decided.answers, decided.text, decided.task, full(res.landed.id)], ['decided', 'claude', full(made.where), CURSOR.text, '2.3', decided.id]);
    const { id: _id, at: _at, session: _session, label: _label, number: _number, ...parked } = park;
    assert.deepStrictEqual(parked, {
      v: 1, event: 'parked', unit: BUILT, topic: null, phase: 'implementation',
      question: null, replaces: decided.id, reason: 'was-wrong', cause: null, relies_on: [], task: null,
      call: CALL, rows_judged: [], why_asking: BLIND, model: null, blocks_build: true, replaced_by: null, always: null, blind: true,
    });
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry, kind }) => [entry, kind]), [[decided.id, 'behaviour']]);
    const ahead = withEnv({ LEEWAY_CONFIG_DIR: config() }, () => evidenceOf(statePath(dir))).answers.find(({ event }) => event.entry === decided.id);
    assert.strictEqual(ahead?.standing, 'no-weight');
    assert.deepStrictEqual(ok(dir, ['raise', 'waiting', BUILT]).waiting.map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]), [['Q1', []]]);
    const waits = waitsOf(dir, [readManifest(dir, BUILT)]).waits.get(BUILT) ?? [];
    assert.deepStrictEqual(waits.filter(({ kind }) => kind === 'question').map(({ id }) => id), ['Q1']);
    assert.strictEqual(drawn.sections, blindScreen(drawn.res.raise, { header: 'Q1 · Mint' }));
  });

  it('16.S53: the person\'s answer that is Claude\'s keeps its call, moving no one — an agreement, revealed so, no departure — and the call stands, the question no longer waiting', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;
    const { raise } = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() }).res;

    const { res, sections } = answered(raise, ['--pick', CURSOR.key]);

    const { id: _id, at: _at, session: _session, ...kept } = entries().at(-1);
    assert.deepStrictEqual(kept, {
      v: 1, event: 'kept', unit: BUILT, topic: null, phase: 'implementation',
      by: 'person', who_moved_whom: 'none', entry: full(landed.id), reason: 'was-wrong', cause: null, why: WHY, sealed: CURSOR.text,
    });
    assert.deepStrictEqual(loggedOf('raise').map(({ entry, sealed, answer }) => [entry, sealed, answer]), [[full(res.id), '1', '1']]);
    assert.match(sections, /^I'd have picked the same\. /m);
    assert.deepStrictEqual([queued(), ok(dir, ['raise', 'waiting', BUILT]).waiting], [[], []]);
  });

  it('16.S53: the person\'s answer that is not Claude\'s replaces its call, standing over it — a departure waiting on its verdict — and what relied on the call is affected, the build reworking it (P12)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;
    const relying = write('decide', BUILD, ['--answers', made.size, '--relies-on', landed.id, '--task', '2.4'], { ...MADE, text: 'Half the screen it opens on.', why: 'It fits the screen.' }).id;
    const { raise } = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() }).res;

    const { res } = answered(raise, ['--pick', MAIN.key]);

    const replaced = entries().at(-1);
    assert.deepStrictEqual([replaced.event, replaced.by, replaced.who_moved_whom, replaced.replaces, replaced.reason, replaced.text, replaced.sealed, replaced.drops], [
      'replaced', 'person', 'person-moved-claude', full(landed.id), 'was-wrong', MAIN.text, CURSOR.text, [CURSOR.text],
    ]);
    assert.deepStrictEqual(queued(), [res.id]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'affected', BUILT]).affected.map((/** @type {{id: string}} */ e) => e.id), [relying]);
  });

  it('a blind question on a call hard to undo parks its task as any question does, its draw naming the park, nothing landed; drawn, it shows no lean', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raisedInBuild(true);
    const park = entries().at(-1);
    const drawn = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() });

    assert.deepStrictEqual([res.decision, res.task, res.landed, park.event, park.question, park.task, park.blind], ['blind', '2.3', undefined, 'parked', full(made.where), '2.3', true]);
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry }) => entry), [park.id]);
    assert.strictEqual(drawn.sections, blindScreen(drawn.res.raise, { header: 'Q1 · Mint · parks task 2.3' }));
  });

  it('a blind replacement of Claude\'s call never goes ahead: it parks its task as any question does, the decision standing until the person answers', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', '2.5'], SHADOWED, labelledAs(SHADOWED, 'behaviour'));
    const park = entries().at(-1);

    assert.deepStrictEqual([res.decision, res.task, res.landed, park.replaces, park.task, park.blind], ['blind', '2.5', undefined, full(made.mine), '2.5', true]);
  });
});
