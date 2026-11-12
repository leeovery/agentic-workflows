'use strict';

// ---------------------------------------------------------------------------
// Blind questions (16.17; leeway-engine/scripts/domain/raise.cjs, its
// screen domain/projections/raise.cjs, the draw domain/decision-point.cjs):
// a question's call the ask rule lets proceed, drawn blind by its
// question's id — the root of its chain, so every raise of it draws alike,
// and never a replacement's — asked cold, its rows in the order and the
// keys its question's id gives them, its screen holding Claude's answer
// back while the seal keeps it, the draw logged once (16.S52, 16.S65); its
// answer revealed beside Claude's, with how often Claude picked as the
// person did on its kind, its raise event marked blind, and a differing
// answer a departure waiting on its verdict (16.17.7, 16.S66), and the
// person's "don't care" the builder's, revealing no pick but naming
// Claude's answer, weighing nothing though it counts towards a care entry's
// drop, and on a call gone ahead keeping it handed over, so replacing it
// follows the counts (9.2.16, 16.5.4, 16.5.7);
// and mid-build, a call cheap to undo going ahead for its task while its
// question waits, naming the task and parking none, the call held back from
// every list of the build's calls, the person's agreement keeping it,
// theirs then, and the task standing as built — a later reversal of the
// call cancelling the agreement — their disagreement replacing it for the
// task, which is marked changed, and what relied on it affected (16.S53);
// where one hard to undo, or made for no task, parks as any question does.
//
// Layer: verb. World: an epic in discussion, questions asked at its topic;
// and an epic beside it in its build, in auto, questions asked there and a
// decision of Claude's — built once and copied for each test, the questions
// a blind draw orders rows by planted at ids chosen for the order they give
// (`ASKED`); each test keeps its conversation and the trust log in a config
// folder of its own, the log holding a quiet kind. The decision point is
// the rule, as switching it on makes it, drawing a question on an id that
// draws blind (trust-world.cjs). The world has no tracker, so the check
// that the tracker holds the task a raise parks is passed over here
// (test-engine-task-parks.cjs). The separate call is the stub binary,
// labelling the call's question, and reading no answer unless told.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, output, refusedPristine, fixtureFrom, cleanupFixture, statePath } = require('./engine-harness.cjs');
const { useTempFolder, createManifest, readManifest, withEnv } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, SESSION_ID, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, WHY, raiseHelpers } = require('./raise-world.cjs');
const { DRAWN, DAY, idOf, history, lines } = require('./trust-world.cjs');
const { labelAnswers } = require('./labels.cjs');
const { auditGate } = require('./gate-audit.cjs');
const { fixture } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));
const { alikeOn, countsOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { movedRefusal } = require(path.join(SCRIPTS, 'domain/ledger-verdicts.cjs'));
const { ID_FACTS, foldLedger, whoseDecision } = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { liveness } = require(path.join(SCRIPTS, 'domain/ledger-units.cjs'));
const { unitEntries } = require(path.join(SCRIPTS, 'domain/unit-entries.cjs'));
const { waitsOf } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { callsOf } = require(path.join(SCRIPTS, 'domain/build-screens.cjs'));
const { recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { TREE_WIDTH } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));
const { RAISE_SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

const BLIND = 'I\'m asking you this one cold, keeping my answer back until you\'ve given yours, to check my calls against yours.';
// An epic in its build, in auto, beside the epic in discussion.
const BUILT = 'mint';
const BUILD = `${BUILT}.implementation`;
// Task 2.3 of its build, as a round's report names it.
const TASK = Object.freeze({ unit: BUILT, phase: 2, n: 3 });

const CURSOR = Object.freeze({ key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' });
const MAIN = Object.freeze({ key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });

/** Claude's call: where a new note opens, leaning to the cursor's screen, its first row. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [CURSOR, MAIN],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** Claude's call as a blind draw of a question whose id puts the main screen first seals it: rekeyed by place, the lean with its row. */
const MAIN_FIRST = Object.freeze({ ...CALL, rows: [{ ...MAIN, key: '1' }, { ...CURSOR, key: '2' }], lean: '2' });

/** Claude's call proposing a shadow in place of its decision on the note's shadow. */
const SHADOWED = Object.freeze({
  ...CALL,
  question: 'Should a note cast a soft shadow after all?',
  rows: [{ key: '1', name: 'Soft', text: 'A soft shadow', notice: 'notes lift off the desk' }, { key: '2', name: 'Line', text: 'A hairline edge', notice: 'notes sit flat with an edge' }],
});

/** Claude's call proposing afresh where a note opens, in place of its call on it. */
const AFRESH = Object.freeze({
  ...CALL,
  question: 'Where should a new note open, now the second screen is in?',
  rows: [{ ...MAIN, key: '1' }, { key: '2', name: 'Last', text: 'On the screen last used', notice: 'the note follows your last screen' }],
  lean: '1',
});

// The questions a blind draw orders rows by, at ids chosen for the order
// they give Claude's two rows: the note's and where's draw the main screen
// first, the menu's the cursor's — so the rows' order is the id's, never
// the order Claude wrote them in.
const ASKED = Object.freeze({ note: idOf('Dock'), where: idOf('Tray'), menu: idOf('Menu') });

/** What the world holds besides, by name: each question's and the decision's short id. */
const made = { size: '', mine: '' };

const world = fixtureFrom('raise-blind-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, BUILT, { work_type: 'epic', phases: PHASES, build: { position: 'auto' } });
  /** @param {string} at @param {string} id @param {string} text */
  const plant = (at, id, text) => {
    const [unit, phase, topic = null] = at.split('.');
    appendEntry(statePath(template), { event: 'asked', unit, topic, phase, session: SESSION_ID, ...MADE, text, part_of: null, relies_on: [], cites: [], task: null }, [], id);
  };
  plant(NOTE, ASKED.note, 'Where does a new note open?');
  plant(BUILD, ASKED.where, 'Where does a new note open on a second screen?');
  plant(NOTE, ASKED.menu, 'Where does a note open from the menu bar?');
  const { write } = ledgerHelpers(() => template);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }).id;
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
const { conversation, inFolder, seals, logged, project, quietOn, labelledAs, raised } = raiseHelpers(() => dir, config, CALL);

/**
 * The decision point forced to the rule, as switching it on makes it, for
 * test `t`, a question drawn on an id that draws blind — a replacement,
 * which has none, left without: the questions it was given, each by the
 * id it would hash.
 * @param {import('node:test').TestContext} t
 */
function drawingBlind(t) {
  return t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => decisionPoint.ruled(call, { ...at, question: at.question === null ? null : DRAWN }));
}

/**
 * The person's answer to a blind raise, which must land, in the
 * conversation over `env`: its response and what it shows besides.
 * @param {string} id @param {string[]} how @param {Record<string, unknown>} [given] @param {Record<string, string>} [env]
 */
const answered = (id, how, given = { why: WHY }, env = {}) => okSections(dir, ['raise', 'answer', id, ...how], { env: conversation(env), stdin: JSON.stringify(given) });

/** The person's "don't care" on the raise `id`, which must land: its response and what it shows besides. @param {string} id */
const leftToMe = (id) => okSections(dir, ['raise', 'answer', id, '--dont-care'], { env: conversation() });

/** Whose the decision `id` is, as replacing it asks (16.5.7). @param {string} id */
const whoseIs = (id) => whoseDecision({ facts: foldLedger(statePath(dir), ID_FACTS, []), live: liveness(statePath(dir)) }, full(id));

/** The reader reading the person's own words as the row `key`. @param {string} key */
const readAs = (key) => ({ CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: key } }) });

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
 * The screen a blind raise of `CALL` draws, its id `id`, headed `header`,
 * its rows in the order `rows` gives, the mechanism shown with `technical`:
 * no lean, no row recommended and no reason it asks.
 * @param {string} id @param {{header?: string, technical?: boolean, rows?: readonly {text: string, name: string, notice: string}[]}} [opts]
 */
function blindScreen(id, { header = 'Fumi · Note Window', technical = false, rows = [MAIN, CURSOR] } = {}) {
  return [
    `=== MENU: raise — ${id} (emit verbatim as markdown (not a code block), then STOP for the user's response) ===`,
    '· · · · · · · · · · · ·',
    header,
    '',
    'When you make a new note, where should its window open?',
    '',
    'WHAT YOU\'D NOTICE',
    '',
    ...rows.map((row) => `- ${row.name}: ${row.notice}`),
    ...(technical ? ['', 'THE MECHANISM', '', 'The screen under the pointer when the note is made.'] : []),
    '',
    '**`◆ Which way?`**',
    '',
    ...rows.map((row, i) => `**\`${i + 1}\`**           → ${row.text}`),
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
  it('16.S52, 16.S65: a call the rule lets proceed whose question\'s id draws blind is asked cold — answered blind, its screen holding Claude\'s answer back, no lean, no row recommended and no reason it asks, with the mechanism shown or not, its payload alike — Claude\'s answer sealed all the same, its rows, its lean and the rows judged rekeyed in the order the id gives, the draw logged once with the call\'s kind, naming the raise, and the same question raised again drawn as sealed (6.S24)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const env = conversation({ CLAUDE_STUB_ANSWERS: JSON.stringify({ [`The answer: ${MAIN.text}`]: { rules: ['One rule.'] }, [CALL.question]: labelAnswers('behaviour'), '': 'no-login' }) });

    const { res, sections } = await raised(NOTE, ['--answers', ASKED.note], CALL, env);
    const again = await raised(NOTE, ['--answers', ASKED.note], CALL, { ...env, LEEWAY_GATE_SURFACE: '1' });
    const technical = okSections(dir, ['raise', 'show', res.raise, '--technical'], { env: { ...env, LEEWAY_GATE_SURFACE: '1' } }).sections;

    assert.deepStrictEqual([res, sections], [{ ok: true, decision: 'blind', reason: BLIND, raise: res.raise, redrawn: false }, blindScreen(res.raise)]);
    assert.deepStrictEqual([again.res, again.sections.replace(/^=== GATE.*\n.*\n/, '')], [{ ok: true, decision: 'blind', reason: BLIND, raise: res.raise, redrawn: true }, blindScreen(res.raise)]);
    const drawn = auditGate(again.sections, 'raise, blind');
    const held = await fixture('raise-blind.mjs');
    assert.deepStrictEqual(drawn, { ...held, gate: `raise — ${res.raise}` }, 'the mod\'s blind question is not the payload the engine states (6.S19)');
    const gate = /** @type {Record<string, any>} */ (auditGate(technical, 'raise show --technical, blind'));
    assert.deepStrictEqual([technical.replace(/^=== GATE.*\n.*\n/, ''), gate.options.map((/** @type {{recommended: boolean}} */ o) => o.recommended)], [blindScreen(res.raise, { technical: true }), [false, false, false, false]]);
    const { call, rows_judged: judged, blind, reason, answered: answer } = seals()?.[res.raise] ?? {};
    assert.deepStrictEqual([call, judged, blind, reason, answer], [MAIN_FIRST, ['1'], true, BLIND, null]);
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry, kind }) => [entry, kind]), [[res.raise, 'behaviour']]);
  });

  it('16.17.2: a blind question\'s rows are drawn in the order its question\'s id gives them — two questions on which Claude leans to its first row as written each drawing it where its id puts it — and the same question draws them alike every time, a draw sealed again once its seal is gone the same', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');

    const note = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res.raise;
    const menu = (await raised(NOTE, ['--answers', ASKED.menu], CALL, env)).res.raise;
    const first = seals();
    fs.rmSync(inFolder(RAISE_SHOWN));
    const again = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res.raise;

    assert.deepStrictEqual([first?.[note].call, first?.[menu].call], [MAIN_FIRST, CALL]);
    assert.notStrictEqual(again, note);
    assert.deepStrictEqual(seals()?.[again].call, MAIN_FIRST);
  });

  it('16.S52: the id a draw hashes is the question\'s root, the same on every raise of it — its rewording raised drawing as the question did — and a replacement has none, so it is never drawn blind (16.17.4, E3)', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');

    await raised(NOTE, ['--answers', ASKED.note], CALL, conversation());
    const reworded = write('replace', NOTE, ['--replaces', ASKED.note, '--reason', 'changed-mind'], { ...MADE, drops: ['open'], text: 'Where does a new note open first?' }).id;
    await raised(NOTE, ['--answers', reworded], CALL, conversation());
    await raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', '2.3'], SHADOWED, conversation());

    assert.deepStrictEqual(decide.mock.calls.map(({ arguments: [, at] }) => at.question), [ASKED.note, ASKED.note, null]);
  });

  it('a replacement of Claude\'s call the rule lets proceed is never drawn blind: it proceeds, landing as Claude\'s, nothing parked and no draw logged — its rows Claude\'s proposals beside the decision as it stands, which would tell its lean', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', '2.5'], SHADOWED, labelledAs(SHADOWED, 'behaviour'));
    const landed = entries().at(-1);

    assert.deepStrictEqual([res.decision, landed.event, landed.by, landed.replaces, landed.task], ['proceed', 'replaced', 'claude', full(made.mine), '2.5']);
    assert.deepStrictEqual(loggedOf('blind-draw'), []);
  });

  it('16.S52: a draw is logged only for a seal sealed blind by that raise — another raise of the question, sealed in the conversation while this one\'s call was decided, is drawn as it was sealed, no draw logged (16.17.5)', async (t) => {
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');
    const asked = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res;
    const sealedMeanwhile = fs.readFileSync(inFolder(RAISE_SHOWN));
    fs.rmSync(inFolder(RAISE_SHOWN));
    t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => {
      fs.writeFileSync(inFolder(RAISE_SHOWN), sealedMeanwhile);
      return decisionPoint.ruled(call, { ...at, question: DRAWN });
    });

    const raced = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res;

    assert.deepStrictEqual(raced, { ...asked, redrawn: true });
    assert.deepStrictEqual(loggedOf('blind-draw'), []);
  });
});

describe('the reveal (16.17.7, 16.10.10)', () => {
  it('the person\'s pick of Claude\'s answer, revealed as it lands: what they picked, as written, that Claude would have picked the same, and of the kind\'s last 25 answers in the project how many Claude picked as they did — the quiet kind\'s 30 and this one; its raise event marked blind; never said to have come round to Claude\'s answer, which they never saw; answered again, nothing revealed; shown again, the raise holds Claude\'s answer back no longer (16.17.2)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { raise } = (await raised(NOTE, ['--answers', ASKED.note], CALL, labelledAs(CALL, 'behaviour'))).res;

    const cameRound = refusedPristine(dir, ['raise', 'answer', raise, '--pick', '2'], { env: conversation(), stdin: JSON.stringify({ why: WHY, who_moved_whom: 'claude-moved-person' }) }).error;
    const first = answered(raise, ['--pick', '2']);
    const again = answered(raise, ['--pick', '2']);
    const shown = okSections(dir, ['raise', 'show', raise], { env: conversation() }).sections.split('\n');

    assert.strictEqual(cameRound, 'raise answer: the answer has no field who_moved_whom — it holds why', 'the person never saw the lean, so never came round to it');
    assert.deepStrictEqual(readReveal(first.sections), [REVEALED, `You picked: On the screen the cursor is on. I'd have picked the same. On behaviour in ${projectName(dir)}, I've picked the same as you 25 of the last 25 times.`]);
    assert.deepStrictEqual([again.res.already, again.sections], [true, '']);
    assert.deepStrictEqual(loggedOf('raise').map(({ sealed, answer, blind }) => [sealed, answer, blind]), [['2', '2', true]]);
    assert.deepStrictEqual(shown.filter((line) => line.startsWith('I lean:') || line.endsWith('(recommended)')), ['I lean: On the screen the cursor is on', '**`2`**           → On the screen the cursor is on (recommended)']);
  });

  it('16.17.7: the person\'s own words the reader reads as Claude\'s answer are revealed as said, and as the same as Claude\'s', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { raise } = (await raised(NOTE, ['--answers', ASKED.note], CALL, labelledAs(CALL, 'behaviour'))).res;

    const { sections } = answered(raise, ['--own'], { text: 'Wherever my cursor is', why: WHY }, readAs('2'));

    assert.deepStrictEqual(readReveal(sections), [REVEALED, `You said: Wherever my cursor is. I'd have picked the same. On behaviour in ${projectName(dir)}, I've picked the same as you 25 of the last 25 times.`]);
  });

  it('16.17.2, 9.2.16: the person\'s "don\'t care" on a blind question outside the build names Claude\'s answer, which they never saw, as the builder\'s, in the reveal\'s display — no pick named; on a question asked with the lean shown, it shows nothing', async (t) => {
    t.mock.method(decisionPoint, 'decide', (/** @type {any} */ _call, /** @type {any} */ at) => (at.question === ASKED.note ? { decision: 'blind', reason: BLIND } : { decision: 'ask', reason: 'Ask.' }));
    const env = labelledAs(CALL, 'behaviour');
    const blind = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res.raise;
    const asked = (await raised(NOTE, ['--answers', ASKED.menu], CALL, env)).res.raise;

    const [left, ordinary] = [leftToMe(blind), leftToMe(asked)];

    assert.deepStrictEqual(readReveal(left.sections), [REVEALED, 'My answer stands as the builder\'s: On the screen the cursor is on.']);
    assert.deepStrictEqual([left.res.receipt, ordinary.sections], [undefined, '']);
  });

  it('16.17.7: the reveal of the first answer the project gives on the kind says it is the first', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: BLIND }));
    const { raise } = (await raised(NOTE, ['--answers', ASKED.note], CALL, labelledAs(CALL, 'behaviour'))).res;

    const { sections } = answered(raise, ['--pick', '1']);

    assert.deepStrictEqual(readReveal(sections), [REVEALED, `You picked: On the main screen. I'd have picked: On the screen the cursor is on. On behaviour in ${projectName(dir)}, that's the first answer you've given.`]);
  });

  it('16.S66: a pick other than Claude\'s answer is revealed beside it, and is a departure waiting in the verdict queue; the person\'s own words, which the reader cannot read as a row, are revealed as said, a departure too (16.10.10)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const env = labelledAs(CALL, 'behaviour');
    const picked = (await raised(NOTE, ['--answers', ASKED.note], CALL, env)).res.raise;
    const said = (await raised(NOTE, ['--answers', ASKED.menu], CALL, env)).res.raise;

    const other = answered(picked, ['--pick', '1']);
    const own = answered(said, ['--own'], { text: 'Where I last left one', why: WHY });

    const project = projectName(dir);
    assert.deepStrictEqual([readReveal(other.sections), readReveal(own.sections)], [
      [REVEALED, `You picked: On the main screen. I'd have picked: On the screen the cursor is on. On behaviour in ${project}, I've picked the same as you 24 of the last 25 times.`],
      [REVEALED, `You said: Where I last left one. I'd have picked: On the screen the cursor is on. On behaviour in ${project}, I've picked the same as you 23 of the last 25 times.`],
    ]);
    assert.deepStrictEqual(queued(), [other.res.id, own.res.id]);
  });
});

describe('mid-build (16.17.6, 12.13)', () => {
  /**
   * A raise in the build on where a new note opens, relying on Claude's
   * decision on the shadow, for task 2.3 — for none where `task` is null —
   * labelled behaviour, hard to undo where `hardToUndo`.
   * @param {{hardToUndo?: boolean, task?: string|null}} [opts]
   */
  const raisedInBuild = ({ hardToUndo = false, task = '2.3' } = {}) => raised(BUILD, ['--answers', ASKED.where, '--relies-on', made.mine, ...(task === null ? [] : ['--parks', task])], CALL, labelledAs(CALL, 'behaviour', { hardToUndo }));

  /** The went-ahead question drawn in the conversation: its raise's id. */
  const drawnQ1 = () => okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() }).res.raise;

  /** Task 2.3's pair briefed for round 1 in this conversation. */
  const beingRead = () => {
    for (const letter of ['a', 'b']) recordReviewer(dir, TASK, 1, letter, SESSION);
  };

  /** The mark a change left on task 2.3, or null where it left none. */
  const marked = () => {
    const file = statePath(dir, `.cache/${BUILT}/build/tasks/2.3/changed.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };

  /** Task 2.3's calls as its page lists them, by full id. */
  const callsOn = () => callsOf(dir, TASK).map(({ id }) => full(id));

  /** Claude's calls across the build the ledger's `verb` lists, by full id. @param {'since'|'shown'} verb */
  const sinceCalls = (verb) => ok(dir, ['ledger', verb, BUILT], { env: conversation() }).calls.map((/** @type {{id: string}} */ c) => full(c.id));

  /** Whether the review's calls decided for the person list the call answered `text`. @param {string} text */
  const reviewListed = (text) => output(dir, ['render', 'review-calls', BUILT], { env: conversation() }).includes(text);

  /** The decision `id` as `ledger record` shows it. @param {string} id */
  const recordOf = (id) => ok(dir, ['ledger', 'record', BUILT]).decisions.find((/** @type {{id: string}} */ d) => full(d.id) === full(id));

  /**
   * The kind's answers as the reveal and the ask rule read them: how often
   * Claude picked as the person did, and the project's own answers the
   * kind counts at the conversation's model.
   */
  const onTheKind = () => withEnv({ LEEWAY_CONFIG_DIR: config() }, () => {
    const model = logged().find((event) => event.session === SESSION)?.model ?? null;
    return [alikeOn(evidenceOf(statePath(dir)).answers, 'behaviour'), countsOf(statePath(dir), { model, now: Date.now() }).kinds.behaviour.own];
  });

  /**
   * Each answer the conversation logged: its event's type, where it
   * stands, and the entry of the reversal cancelling it, null for none.
   */
  const standings = () => {
    const answers = withEnv({ LEEWAY_CONFIG_DIR: config() }, () => evidenceOf(statePath(dir)).answers).filter(({ event }) => event.session === SESSION);
    const entryOf = new Map(answers.map(({ event }) => [event.id, event.entry]));
    return answers.map(({ event, standing, cancelled_by: by }) => [event.type, standing, by === null ? null : entryOf.get(by)]);
  };

  /**
   * This project's care entry on behaviour, and the person's "don't care"
   * on it twice before, as of a day ago: a third in a row cues the entry's
   * drop.
   */
  const caredForTwice = () => {
    fs.mkdirSync(config(), { recursive: true });
    fs.writeFileSync(path.join(config(), 'person.md'), `# The record of you\n\n## Care entries\n\n- Fumi: behaviour · ${project()} · 2025-12-01T00:00:00.000Z\n`);
    const before = history({ project: project(), start: Date.now() - DAY });
    before.dontCare(2, 'behaviour');
    fs.writeFileSync(path.join(config(), 'trust.jsonl'), lines(...before.events));
  };

  /**
   * The person's reversal of the decision `id` — their mind changed to the
   * main screen: its entry's full id.
   * @param {string} id
   */
  const reversing = (id) => full(write('replace', BUILD, ['--replaces', id, '--reason', 'changed-mind'], { by: 'person', drops: [CURSOR.text], text: MAIN.text, why: 'Changed my mind.' }, conversation()).id);

  it('16.S53: a blind question on a call cheap to undo lets Claude\'s call go ahead for its task while the question waits — on that call, asked-blind, naming the task it went ahead for and parking none, relying on what the call relies on, its draw naming the call, which then counts for nothing — every count of the questions waiting holding it, about the question the call answers; while it waits the call is off the task\'s calls; drawn, it shows no lean and no keep row, the call\'s own row keeping it', async (t) => {
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
    assert.deepStrictEqual([decided.event, decided.by, decided.answers, decided.text, decided.task, decided.relies_on, full(res.landed.id)], ['decided', 'claude', ASKED.where, CURSOR.text, '2.3', [full(made.mine)], decided.id]);
    const { id: _id, at: _at, session: _session, label: _label, number: _number, ...parked } = park;
    assert.deepStrictEqual(parked, {
      v: 1, event: 'parked', unit: BUILT, topic: null, phase: 'implementation',
      question: null, replaces: decided.id, reason: 'asked-blind', cause: null, relies_on: [full(made.mine)], task: null, went_ahead: '2.3',
      call: MAIN_FIRST, rows_judged: [], why_asking: BLIND, model: null, blocks_build: true, replaced_by: null, always: null, blind: true,
    });
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry, kind }) => [entry, kind]), [[decided.id, 'behaviour']]);
    const ahead = withEnv({ LEEWAY_CONFIG_DIR: config() }, () => evidenceOf(statePath(dir))).answers.find(({ event }) => event.entry === decided.id);
    assert.strictEqual(ahead?.standing, 'no-weight');
    const waiting = ok(dir, ['raise', 'waiting', BUILT]).waiting.map((/** @type {{question: string, parks: string[], about: string}} */ q) => [q.question, q.parks, full(q.about)]);
    assert.deepStrictEqual(waiting, [['Q1', [], ASKED.where]]);
    const waits = waitsOf(dir, [readManifest(dir, BUILT)]).waits.get(BUILT) ?? [];
    assert.deepStrictEqual(waits.filter(({ kind }) => kind === 'question').map(({ id }) => id), ['Q1']);
    assert.deepStrictEqual(callsOn(), []);
    assert.strictEqual(drawn.sections, blindScreen(drawn.res.raise, { header: 'Q1 · Mint' }));
  });

  it('16.S53: the person\'s answer that is Claude\'s keeps its call for the task, asked-blind, moving no one — an agreement, its raise event naming the call it agrees with, revealed so, no departure, the task standing as built and never marked changed though its pair reads it — and the call stands, the person\'s now, `by` person wherever it is shown and off every list of Claude\'s calls, the question no longer waiting; answered again, said answered already with the call\'s own row', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;
    const raise = drawnQ1();
    beingRead();

    const { res, sections } = answered(raise, ['--pick', '2']);
    const again = answered(raise, ['--pick', '2']).res;

    const { id: _id, at: _at, session: _session, ...kept } = entries().at(-1);
    assert.deepStrictEqual(kept, {
      v: 1, event: 'kept', unit: BUILT, topic: null, phase: 'implementation',
      by: 'person', who_moved_whom: 'none', entry: full(landed.id), reason: 'asked-blind', cause: null, why: WHY, sealed: CURSOR.text, given: 'own',
    });
    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 stands as built · nothing waiting on you');
    assert.deepStrictEqual(loggedOf('raise').map(({ entry, sealed, answer, blind }) => [entry, sealed, answer, blind]), [[full(landed.id), '2', '2', true]]);
    assert.match(sections, /^I'd have picked the same\. /m);
    assert.deepStrictEqual([queued(), ok(dir, ['raise', 'waiting', BUILT]).waiting, marked()], [[], [], null]);
    const { by, given } = recordOf(landed.id);
    assert.deepStrictEqual([by, given, callsOn(), sinceCalls('since').includes(full(landed.id)), reviewListed(CURSOR.text)], ['person', 'own', [], false, false]);
    assert.deepStrictEqual([again.already, again.answer], [true, '2']);
    assert.strictEqual(whoseIs(landed.id), 'person', 'the person\'s keep makes the call theirs, replacing it asking them');
  });

  it('16.S53: the person\'s own words the reader reads as the call\'s own row keep the call as that row does — revealed as said, the task standing as built and never marked changed though its pair reads it', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;
    const raise = drawnQ1();
    beingRead();

    const { res, sections } = answered(raise, ['--own'], { text: 'Where my cursor is, as you built it', why: WHY }, readAs('2'));

    const { event, entry, reason, given } = entries().at(-1);
    assert.deepStrictEqual([event, entry, reason, given], ['kept', full(landed.id), 'asked-blind', 'own']);
    assert.deepStrictEqual(loggedOf('raise').map((raised) => raised.entry), [full(landed.id)], 'its raise event names the call it agrees with');
    assert.strictEqual(whoseIs(landed.id), 'person');
    assert.deepStrictEqual([res.receipt, marked()], ['Q1 answered · task 2.3 stands as built · nothing waiting on you', null]);
    assert.match(readReveal(sections)[1], /^You said: Where my cursor is, as you built it\. I'd have picked the same\. /);
  });

  it('16.S53: the person\'s answer that is not Claude\'s replaces its call for the task, asked-blind, standing over it — a departure waiting on its verdict — the task, its pair reading round 1, marked changed against that round so the build reads it again, the receipt saying so, and what relied on the call affected (P12)', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;
    const relying = write('decide', BUILD, ['--answers', made.size, '--relies-on', landed.id, '--task', '2.4'], { ...MADE, text: 'Half the screen it opens on.', why: 'It fits the screen.' }).id;
    const raise = drawnQ1();
    beingRead();

    const { res } = answered(raise, ['--pick', '1']);

    const replaced = entries().at(-1);
    assert.deepStrictEqual([replaced.event, replaced.by, replaced.who_moved_whom, replaced.replaces, replaced.reason, replaced.text, replaced.sealed, replaced.drops, replaced.task], [
      'replaced', 'person', 'person-moved-claude', full(landed.id), 'asked-blind', MAIN.text, CURSOR.text, [CURSOR.text], '2.3',
    ]);
    assert.strictEqual(movedRefusal(replaced, 'decision', 'asked-blind', foldLedger(statePath(dir), ID_FACTS, []).get(full(landed.id))), null, 'the departure rule holds the replacement\'s line');
    assert.deepStrictEqual(marked(), { round: 1, n: 1, passed_until: null });
    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 is built again on your answer · nothing waiting on you');
    assert.deepStrictEqual(queued(), [res.id]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'affected', BUILT]).affected.map((/** @type {{id: string}} */ e) => e.id), [relying]);
  });

  it('16.12.2: the person\'s keep of Claude\'s call gone ahead, the call reversed by them later, is an agreement cancelled — the kind counting the reversal alone, and Claude\'s picks as the person\'s reading it so — as their agreement with any call is', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: BLIND }));
    const { landed } = (await raisedInBuild()).res;
    answered(drawnQ1(), ['--pick', '2']);

    const kept = onTheKind();
    const reversal = reversing(landed.id);

    assert.deepStrictEqual(kept, [{ alike: 1, of: 1 }, 1]);
    assert.deepStrictEqual(standings(), [['call', 'no-weight', reversal], ['raise', 'agreement', reversal], ['reversal', 'departure', null]]);
    assert.deepStrictEqual(onTheKind(), [{ alike: 0, of: 1 }, 1]);
  });

  it('16.12.2: the person\'s pick of Claude\'s answer to a question parking its task, reversed by them later, is an agreement cancelled, the kind counting the reversal alone', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'ask', reason: 'Ask.' }));
    await raisedInBuild();
    const { res } = answered(drawnQ1(), ['--pick', '1']);

    const kept = onTheKind();
    const reversal = reversing(res.id);

    assert.deepStrictEqual(kept, [{ alike: 1, of: 1 }, 1]);
    assert.deepStrictEqual(standings(), [['raise', 'agreement', reversal], ['reversal', 'departure', null]]);
    assert.deepStrictEqual(onTheKind(), [{ alike: 0, of: 1 }, 1]);
  });

  it('16.17.2: while its blind question waits, Claude\'s call gone ahead is held back from every list of the build\'s calls — the task\'s, the ledger\'s since, which never marks it seen, and the review\'s calls decided for the person — and listed on each once the person\'s "don\'t care" has left it Claude\'s, handed over', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    const { landed } = (await raisedInBuild()).res;

    const waiting = [callsOn(), sinceCalls('shown'), reviewListed(CURSOR.text)];
    leftToMe(drawnQ1());

    assert.deepStrictEqual(waiting, [[], [full(made.mine)], false]);
    assert.deepStrictEqual([callsOn(), sinceCalls('since'), reviewListed(CURSOR.text)], [[full(landed.id)], [full(landed.id)], true]);
  });

  it('a question proposing to replace Claude\'s call, parking its task, holds nothing back: the call stands on every list of the build\'s calls while it waits', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'ask', reason: 'Ask.' }));
    const call = full(write('decide', BUILD, ['--answers', made.size, '--task', '2.3'], { ...MADE, text: 'Half the screen it opens on.', why: 'It fits the screen.' }).id);

    const { res } = await raised(BUILD, ['--replaces', call, '--reason', 'was-wrong', '--parks', '2.3'], SHADOWED, conversation());

    assert.deepStrictEqual([res.decision, res.task], ['ask', '2.3']);
    assert.deepStrictEqual([callsOn(), sinceCalls('since'), reviewListed('Half the screen it opens on.')], [[call], [full(made.mine), call], true]);
  });

  it('a blind question whose call went ahead is about the question the call answers as worded now: reworded while it waits, the question waiting — and the entry its row opens — is its new wording', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    await raisedInBuild();

    const reworded = write('replace', BUILD, ['--replaces', ASKED.where, '--reason', 'changed-mind'], { ...MADE, drops: ['a second screen'], text: 'Where does a new note open on another screen?' }).id;

    assert.deepStrictEqual(ok(dir, ['raise', 'waiting', BUILT]).waiting.map((/** @type {{about: string}} */ q) => full(q.about)), [full(reworded)]);
  });

  it('9.2.16, 16.5.4: the person\'s "don\'t care" on a blind question whose call went ahead keeps the call as built, the builder\'s — kept, asked-blind, moving no one, the task never marked changed though its pair reads it — revealing nothing, the receipt naming Claude\'s answer; its raise event weighs nothing in the kind\'s counts or how often Claude picked as the person did, yet counts towards a care entry\'s drop', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: BLIND }));
    caredForTwice();
    const { landed } = (await raisedInBuild()).res;
    const raise = drawnQ1();
    beingRead();
    const before = onTheKind();

    const { res, sections } = leftToMe(raise);

    const { event, entry, reason, who_moved_whom: moved, why, given } = entries().at(-1);
    assert.deepStrictEqual([event, entry, reason, moved, why, given], ['kept', full(landed.id), 'asked-blind', 'none', 'They don\'t mind which: left to the builder.', 'dont-care']);
    assert.deepStrictEqual(loggedOf('raise').map((raised) => raised.entry), [full(landed.id)], 'its raise event names the call it keeps');
    const record = recordOf(landed.id);
    const line = /** @type {import('../../skills/leeway-engine/scripts/domain/unit-entries.cjs').UnitEntry} */ (unitEntries(dir, BUILT).get(full(landed.id))).line;
    assert.deepStrictEqual([whoseIs(landed.id), record.by, record.given, line.given, output(dir, ['render', 'review-calls', BUILT], { env: conversation() }).includes('[implementation · don\'t care]')], ['dont-care', 'claude', 'dont-care', 'dont-care', true]);
    assert.deepStrictEqual([res.receipt, sections, marked(), callsOn()], ['Q1 answered · my answer stands as the builder\'s: On the screen the cursor is on · task 2.3 stands as built · nothing waiting on you', '', null, [full(landed.id)]]);
    assert.deepStrictEqual(standings().filter(([type]) => type === 'raise'), [['raise', 'no-weight', null]]);
    assert.deepStrictEqual([onTheKind(), res.care_drop], [before, { care: `${projectName(dir)}: behaviour`, kind: 'behaviour', dont_cares: 3 }]);
  });

  it('9.2.16, 16.5.4: the person\'s "don\'t care" on a blind question parking its task lands Claude\'s sealed answer as the builder\'s, and the build goes on with it — the task never marked changed — revealing nothing, the receipt naming Claude\'s answer; its raise event weighs nothing in the kind\'s counts or how often Claude picked as the person did, yet counts towards a care entry\'s drop', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: BLIND }));
    caredForTwice();
    await raisedInBuild({ hardToUndo: true });
    const raise = drawnQ1();
    beingRead();
    const before = onTheKind();

    const { res, sections } = leftToMe(raise);

    const { event, by, given, answers, text, task } = entries().at(-1);
    assert.deepStrictEqual([event, by, given, answers, text, task], ['decided', 'claude', 'dont-care', ASKED.where, CURSOR.text, '2.3']);
    assert.deepStrictEqual([res.receipt, sections, marked()], ['Q1 answered · my answer stands as the builder\'s: On the screen the cursor is on · task 2.3 builds again once its pair has read round 1 · nothing waiting on you', '', null]);
    assert.deepStrictEqual(standings(), [['raise', 'no-weight', null]]);
    assert.deepStrictEqual([onTheKind(), res.care_drop], [before, { care: `${projectName(dir)}: behaviour`, kind: 'behaviour', dont_cares: 3 }]);
  });

  for (const [path, hardToUndo] of /** @type {const} */ ([['gone ahead', false], ['held for the question', true]])) {
    it(`16.5.7, 9.2.16: Claude's call on a blind question ${path}, left to Claude by the person's "don't care", is the builder's: replacing it later follows the counts, never asking for whose it is`, async (t) => {
      drawingBlind(t);
      quietOn('behaviour');
      const { landed } = (await raisedInBuild({ hardToUndo })).res;
      const { res } = leftToMe(drawnQ1());
      const call = landed?.id ?? res.id;

      const replacing = (await raised(BUILD, ['--replaces', call, '--reason', 'was-wrong', '--parks', '2.3'], AFRESH, labelledAs(AFRESH, 'behaviour'))).res;

      assert.deepStrictEqual([whoseIs(call), replacing.decision], ['dont-care', 'proceed']);
    });
  }

  it('the person\'s "don\'t care" on a question asked them with Claude\'s lean shown is an agreement, its receipt naming no answer, as any "don\'t care" is', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'ask', reason: 'Ask.' }));
    await raisedInBuild();

    const { res, sections } = leftToMe(drawnQ1());

    assert.deepStrictEqual([res.receipt, sections], ['Q1 answered · task 2.3 builds again · nothing waiting on you', '']);
    assert.deepStrictEqual(standings(), [['raise', 'agreement', null]]);
  });

  it('a blind question on a call hard to undo parks its task as any question does, its draw naming the park, nothing landed; drawn, it shows no lean', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raisedInBuild({ hardToUndo: true });
    const park = entries().at(-1);
    const drawn = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() });

    assert.deepStrictEqual([res.decision, res.task, res.landed, park.event, park.question, park.task, park.went_ahead, park.blind], ['blind', '2.3', undefined, 'parked', ASKED.where, '2.3', null, true]);
    assert.deepStrictEqual(loggedOf('blind-draw').map(({ entry }) => entry), [park.id]);
    assert.strictEqual(drawn.sections, blindScreen(drawn.res.raise, { header: 'Q1 · Mint · parks task 2.3' }));
  });

  it('a blind question on a call made for no task never goes ahead: it parks, parking none, nothing landed, as any question does', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');

    const { res } = await raisedInBuild({ task: null });
    const park = entries().at(-1);

    assert.deepStrictEqual([res.decision, res.task, res.landed, park.event, park.question, park.task, park.went_ahead, park.blind], ['blind', null, undefined, 'parked', ASKED.where, null, null, true]);
  });

  it('a task joining a blind question waiting parks on it blind as well, told so', async (t) => {
    drawingBlind(t);
    quietOn('behaviour');
    await raisedInBuild({ hardToUndo: true });

    const { res } = await raisedInBuild({ task: '2.4' });

    assert.deepStrictEqual([res.decision, res.reason, res.task, entries().at(-1).task], ['blind', BLIND, '2.4', '2.4']);
  });
});
