'use strict';

// ---------------------------------------------------------------------------
// The build's questions (leeway-engine/scripts/domain/raise.cjs, the
// projection domain/questions.cjs, the park's line domain/ledger-events.cjs,
// landed through domain/ledger-write.cjs): a raise at a build place,
// `--parks <phase>.<n>`, parking its task where it asks — one `parked` line,
// its number minted in its unit, the call sealed — drawing nothing and
// sealing nothing (12.S30); a task meeting a question waiting joining it;
// a call made outside any task — the task writer's, the consolidation
// agent's or the phase review's — waiting parking none (12.5.5, 12.S8); a
// call that proceeds landed for its task, or none (12.S11); a fact only the
// person holds parking as any question asking does, never proceeding, and
// answered as a fact (16.3.8); `raise waiting`, the
// projection every surface reads; what ends a wait, and its answer through
// its raise alone; `raise draw`, the question raised in full from its park
// in any conversation, as it is worded now (12.S33's code half, 12.S34); the
// person's answer carrying the task and the receipt of what it freed
// (12.S35, 20.S6), each as the question parks tasks when it is answered, not
// when it was drawn, and its trust log event blocking the build as the call
// was decided at its first park (16.4.7); `raise
// aside`, several set aside with one receipt (12.13.17); a question waiting
// no longer refused (20.S7); `--task` on the ledger's writes in the build (12.12.5);
// and no questions page (27.S6). A parked task against the tracker is
// test-engine-task-parks.cjs's.
//
// Layer: verb. World: the ledger suites' unit with questions asked and a
// decision made in its build, a roadmap item, and a feature beside it, built
// once and copied for each test; each test keeps its conversations and the
// trust log in a config folder of its own. A line that is not the test's
// subject is appended in process, as a clone's merge lays it. The world has
// no tracker, so the check that the tracker holds the task a raise parks,
// test-engine-task-parks.cjs's, is passed over here. The separate call is
// the stub binary, unarmed: no login, so every row is drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, okSectionsAsync, refuses, refusesAsync, refusedPristine, treeSnapshot, head, stateGit, commitOnState, fixtureFrom, layout, statePath, writeState, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION_ID, MADE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, WHY, raiseHelpers } = require('./raise-world.cjs');
const { labelAnswers } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { DISCUSSING } = require(path.join(SCRIPTS, 'domain/questions.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { SURFACES } = require(path.join(SCRIPTS, 'domain/render.cjs'));
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { ORDER } = require(path.join(SCRIPTS, 'domain/labeller.cjs'));
const { recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

const EVERY_CALL_ASKS = 'Every call comes to you for now: I don\'t decide on my own yet.';
const BUILD = `${UNIT}.implementation`;
const REVIEW = `${UNIT}.review`;
const TOPIC = `${UNIT}.discussion.note-window`;
const MINT = 'mint';
// Another conversation: the same person after a /clear.
const CLEARED = 'c0ffee00-1234-4abc-8def-0123456789ac';

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

/** Claude's call proposing a frame in place of the frameless note. */
const FRAMED = Object.freeze({
  ...CALL,
  question: 'Should a note have a thin frame after all?',
  rows: [{ key: '1', name: 'Thin', text: 'A thin frame', notice: 'notes stand out from the desk' }, { key: '2', name: 'Shadow', text: 'A shadow alone', notice: 'notes float with no edge' }],
});

/** A question's content beyond its text, asked for no task. */
const ASKED = Object.freeze({ part_of: null, relies_on: [], cites: [], task: null });

/** A decision's content beyond what it answers, its text and its why: Claude's own call, made for no task. */
const DECIDED = Object.freeze({
  rules_out: [], relies_on: [], product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null, hard_to_undo: null, unchecked: true, given: 'own', cites: [], task: null,
});

/**
 * A line of Claude's made in the build, in this conversation, appended in
 * process to the state at `folder` as a clone's merge lays it: its full id.
 * `own` over it.
 * @param {string} folder @param {Record<string, unknown>} own
 */
function appendedAt(folder, own) {
  return /** @type {string} */ (appendEntry(statePath(folder), { unit: UNIT, topic: null, phase: 'implementation', session: SESSION, ...MADE, ...own }, []).id);
}

/** What the world holds, by name: each question's and the decision's full id. */
const made = { where: '', size: '', title: '', frame: '', frameless: '', minted: '' };

const world = fixtureFrom('raise-parked-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, MINT, { work_type: 'feature', phases: {} });
  ok(template, ['roadmap', 'add', 'note-windows', '--horizon', 'v2', '--summary', 'Notes as windows']);
  /** @param {string} text @param {string} [unit] */
  const ask = (text, unit = UNIT) => appendedAt(template, { event: 'asked', unit, session: SESSION_ID, text, ...ASKED });
  made.where = ask('Where does a new note open?');
  made.size = ask('How big is a new note?');
  made.title = ask('What does a new note\'s title default to?');
  made.frame = ask('Does a note have a frame?');
  made.frameless = appendedAt(template, { event: 'decided', session: SESSION_ID, answers: made.frame, text: 'A frameless note.', why: 'Lighter on the desk.', ...DECIDED });
  made.minted = ask('Which key mints a note?', MINT);
  commitOnState(statePath(template), { [layout.ledger]: fs.readFileSync(statePath(template, layout.ledger), 'utf8') }, 'ledger: the world\'s questions and decision');
});

const config = useTempFolder('raise-parked-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ledgerText, entries, full, checkRuns } = ledgerHelpers(() => dir);
const { conversation, inFolder, seals, logged, answer, lastEntry, raiseEvent } = raiseHelpers(() => dir, config, CALL);

/** The cleared conversation's environment. */
const cleared = () => conversation({ CLAUDE_CODE_SESSION_ID: CLEARED });

/**
 * A raise in the build parking `task` on `question`: its response and
 * whatever it drew.
 * @param {string} question @param {string} task
 * @param {{at?: string, call?: Record<string, unknown>, flags?: string[], env?: Record<string, string|undefined>}} [opts]
 */
function park(question, task, { at = BUILD, call = CALL, flags = [], env = conversation() } = {}) {
  return okSectionsAsync(dir, ['raise', at, '--answers', question, '--parks', task, ...flags], { env, stdin: JSON.stringify(call) });
}

/** A fact only the person holds: which account a new note syncs to. */
const FACT = Object.freeze({
  question: 'Which iCloud account does a new note sync to?',
  rows: [{ key: '1', name: 'Personal', text: 'The personal account', notice: 'notes sync to your own devices' }],
  mechanism: 'The container the sync engine is given.',
  product_wide: false,
});

/** The fact's call as its park holds it: no lean, no why, no sort. */
const FACT_CALL = Object.freeze({ question: FACT.question, rows: FACT.rows, lean: null, why: null, sort: null, mechanism: FACT.mechanism, product_wide: false });

/** Why a fact asks. */
const ONLY_YOU_KNOW = 'Only you know this: it\'s a fact I can\'t check.';

/**
 * A fact raised in the build on `question`, for `task` where one is given:
 * its response and whatever it drew.
 * @param {string} question @param {string|null} task @param {string} [at]
 */
function parkFact(question, task, at = BUILD) {
  return okSectionsAsync(dir, ['raise', at, '--answers', question, '--fact', ...(task === null ? [] : ['--parks', task])], { env: conversation(), stdin: JSON.stringify(FACT) });
}

/**
 * A raise at the build place `at` made outside any task, on `question`: its
 * response and whatever it drew.
 * @param {string} question @param {string} [at]
 */
function outsideTask(question, at = BUILD) {
  return okSectionsAsync(dir, ['raise', at, '--answers', question], { env: conversation(), stdin: JSON.stringify(CALL) });
}

/** A replacement of the frameless note proposed in the build, parking `task`. @param {string} task */
function parkReplacement(task) {
  return okSectionsAsync(dir, ['raise', BUILD, '--replaces', made.frameless, '--reason', 'was-wrong', '--parks', task], { env: conversation(), stdin: JSON.stringify(FRAMED) });
}

/** The unit's questions waiting, as `raise waiting` answers them. @param {string} [unit] */
const waiting = (unit = UNIT) => ok(dir, ['raise', 'waiting', unit]).waiting;

/** The numbers of the unit's questions waiting. */
const waitingNumbers = () => waiting().map((/** @type {{question: string}} */ q) => q.question);

/** `raise draw` of `question` in the conversation `env` names: its response and screen. @param {string} question @param {Record<string, string|undefined>} [env] */
const draw = (question, env = conversation()) => okSections(dir, ['raise', 'draw', UNIT, question], { env });

/** The question drawn and the row `key` picked, in the conversation: the answer's response. @param {string} question @param {string} [key] */
function drawnAndPicked(question, key = '1') {
  return answer(draw(question).res.raise, ['--pick', key]);
}

/** The board's discussion queue in the conversation's folder. @param {unknown} queue */
function discussing(queue) {
  fs.mkdirSync(path.dirname(inFolder(DISCUSSING)), { recursive: true });
  fs.writeFileSync(inFolder(DISCUSSING), typeof queue === 'string' ? queue : JSON.stringify(queue));
}

/**
 * A refusal of a command that answers later, leaving the state and the
 * branch as they were and sealing nothing: its error.
 * @param {string[]} args @param {unknown} [call]
 */
async function refusedPark(args, call = CALL) {
  const before = { tree: treeSnapshot(dir), head: head(dir) };
  const { error } = await refusesAsync(dir, ['raise', ...args], { env: conversation(), stdin: JSON.stringify(call) });
  assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before, `raise ${args.join(' ')} wrote or committed on refusing`);
  assert.strictEqual(seals(), null, 'a refused raise sealed something');
  return error;
}

/**
 * The parked line as the ledger holds it, but its id and time: `own` over Q1
 * parking 2.3 on where a note opens, decided as blocking build work where it
 * parks a task.
 * @param {Record<string, unknown>} [own]
 */
function parkedLine(own = {}) {
  const task = Object.hasOwn(own, 'task') ? own.task : '2.3';
  return {
    v: 1, event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    question: made.where, replaces: null, reason: null, cause: null, relies_on: [], task, went_ahead: null, number: 1,
    call: CALL, rows_judged: [], why_asking: EVERY_CALL_ASKS, label: null, model: null, blocks_build: task !== null, replaced_by: null, always: null, blind: false, ...own,
  };
}

/**
 * A question parked as `Q{number}` with `task`, or none, appended in process
 * — as a clone's merge lays it, or where the park is not the subject: its
 * full id. `own` over the question where a new note opens and Claude's call
 * on it.
 * @param {number} number @param {string|null} task @param {Record<string, unknown>} [own]
 */
function parked(number, task, own = {}) {
  const { id } = appendEntry(statePath(dir), {
    event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    question: made.where, replaces: null, reason: null, cause: null, relies_on: [], task, went_ahead: null, number, call: CALL, rows_judged: [], why_asking: EVERY_CALL_ASKS, label: null, model: null,
    blocks_build: task !== null, replaced_by: null, always: null, blind: false, ...own,
  }, []);
  return /** @type {string} */ (id);
}

/** The frameless note's replacement proposed and parked as `Q{number}` with `task`, appended in process. */
const parkedReplacement = (number = 1, task = '2.4') => parked(number, task, { question: null, replaces: made.frameless, reason: 'was-wrong', call: FRAMED, replaced_by: 'claude' });

/** The fact parked on where a new note opens as `Q{number}` with `task`, appended in process. @param {number} number @param {string} task */
const parkedFact = (number, task) => parked(number, task, { call: FACT_CALL, why_asking: ONLY_YOU_KNOW });

/** The refusal naming `name`'s raise, in the words of `said`, `tasks` the tasks it parks. @param {string} said @param {string} [tasks] @param {string} [name] */
function raiseNamed(said, tasks = 'task 2.3', name = 'Q1') {
  return `${said}: ${name} of fumi waits on the person about this, parking ${tasks} — the person answers it through the raise alone: raise draw fumi ${name}`;
}

/**
 * A refused `ledger move` or `ledger merge` of `question`, from its topic or
 * the build as each is made, writing nothing: its error.
 * @param {string} question @param {'move'|'merge'} verb @param {string[]} flags
 */
function shifted(question, verb, flags) {
  return refusedPristine(dir, ['ledger', verb, verb === 'move' ? TOPIC : BUILD, '--question', question, ...flags], { env: conversation(), stdin: JSON.stringify(MADE) }).error;
}

/** A line of Claude's made in the build, appended in process to the test's world: its full id. @param {Record<string, unknown>} own */
const appended = (own) => appendedAt(dir, own);

/** A question asked on the note window's topic, appended in process: its full id. @param {string} [text] */
const askedOnTopic = (text = 'Is a note a window?') => appended({ event: 'asked', topic: 'note-window', phase: 'discussion', text, ...ASKED });

/**
 * A decision answering `question`, appended in process as a clone's merge
 * lays it: its full id. `own` over Claude's own call, made for no task.
 * @param {string} question @param {Record<string, unknown>} [own]
 */
function decidedOnAClone(question, own = {}) {
  return appended({ event: 'decided', answers: full(question), text: CURSOR.text, why: WHY, ...DECIDED, ...own });
}

/** The person's pick of the lean on `question` for `task`, the line its raise's answer lands, appended as a clone's merge lays it. @param {string} question @param {string} task */
const pickedOnAClone = (question, task) => decidedOnAClone(question, { by: 'person', rules_out: [MAIN.text], sealed: CURSOR.text, task });

/** The question where a new note opens reworded in the build, appended as a clone's merge lays it: its full id. */
const rewordedOnAClone = () => appended({
  event: 'replaced', replaces: made.where, reason: 'changed-mind', cause: null, drops: ['where it opens'], of: 'question',
  text: 'On which screen does a new note open?', ...ASKED,
});

/** The short id the engine shows for the full id `id`, among the ledger's. @param {string} id */
const short = (id) => /** @type {string} */ (shortIds(entries().map((e) => e.id)).get(id));

/**
 * The screen a parked question is drawn on: the raise's id, `Q{number}`,
 * the tasks it parks as the header says them, and what it asks.
 * @param {string} id @param {string} name @param {string} task @param {string} [asks]
 */
function screen(id, name, task, asks = CALL.question) {
  return [
    `=== MENU: raise — ${id} (emit verbatim as markdown (not a code block), then STOP for the user's response) ===`,
    '· · · · · · · · · · · ·',
    `${name} · Fumi · parks ${task}`,
    '',
    asks,
    '',
    'I lean: On the screen the cursor is on',
    '',
    'WHAT YOU\'D NOTICE',
    '',
    '- Cursor: the note opens where you are looking',
    '- Main: every note opens on the same screen',
    '',
    'WHY I\'M ASKING',
    '',
    EVERY_CALL_ASKS,
    '',
    '**`◆ Which way?`**',
    '',
    '**`1`**           → On the screen the cursor is on (recommended)',
    '**`2`**           → On the main screen',
    '**`t/technical`** → Show the mechanism',
    '**`e/explain`**   → I don\'t follow — explain it again',
    '**Comment**     → Ask about it, or tell me what I\'ve missed',
    '',
  ].join('\n');
}

describe('a question parked in the build (12.13.2–12.13.4, 12.13.9, 12.S28, 12.S30)', () => {
  it('12.S30, and 12.S39\'s code half: parks its task — one parked line holding the question, what its answer relies on, the task, Q1, and the call sealed with the rows judged and why it asks — committed alone, the ledger the one file it changes, drawing nothing and sealing nothing in the conversation; the line Claude says', async () => {
    const before = treeSnapshot(dir);

    const { res, sections } = await park(made.where, '2.3', { flags: ['--relies-on', made.frameless] });

    const line = lastEntry();
    assert.deepStrictEqual([res, sections], [{
      ok: true, decision: 'ask', reason: EVERY_CALL_ASKS, parked: 'Q1', task: '2.3', id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      line: 'Task 2.3 parks on Q1, waiting for you: When you make a new note, where should its window open? The other tasks carry on.',
    }, '']);
    assert.deepStrictEqual(line, { ...parkedLine({ relies_on: [made.frameless] }), id: full(res.id) });
    assert.strictEqual(stateGit(dir, ['log', '-1', '--format=%s']).trim(), `ledger(fumi): parked ${full(res.id)}`);
    const after = treeSnapshot(dir);
    const changed = Object.keys(after).filter((file) => !file.startsWith('.knowledge/') && after[file] !== before[file]);
    assert.deepStrictEqual(changed, [layout.ledger], 'a park changed more than the ledger');
    assert.strictEqual(seals(), null, 'a park sealed a raise in the conversation');
  });

  it('numbers each question in its unit, never reusing one: Q2 after Q1, Q3 once Q2, the highest, is answered while Q1 waits, Q4 once Q1 is answered too, and another unit\'s first Q1', async () => {
    parked(1, '2.3');
    assert.strictEqual((await park(made.size, '2.4')).res.parked, 'Q2');
    pickedOnAClone(made.size, '2.4');

    assert.strictEqual((await park(made.title, '2.5')).res.parked, 'Q3');
    pickedOnAClone(made.where, '2.3');
    assert.strictEqual((await parkReplacement('2.2')).res.parked, 'Q4');
    assert.strictEqual((await park(made.minted, '1.1', { at: `${MINT}.implementation` })).res.parked, 'Q1');
    assert.deepStrictEqual(waitingNumbers(), ['Q3', 'Q4']);
  });

  it('raised again for its task while its question waits — a rerun after a kill among them — it parks nothing and answers that question', async () => {
    const first = parked(1, '2.3');
    const text = ledgerText();

    const again = (await park(made.where, '2.3')).res;
    assert.deepStrictEqual(again, {
      ok: true, decision: 'ask', reason: EVERY_CALL_ASKS, parked: 'Q1', task: '2.3', id: short(first), committed: null, already: true,
      line: 'Task 2.3 parks on Q1, waiting for you: When you make a new note, where should its window open? The other tasks carry on.',
    });
    assert.strictEqual(ledgerText(), text, 'a park raised again appended a line');
  });

  it('another task meeting a question waiting joins it, asking nothing: parked under its number, minting none, with the call as first sealed — one question waiting, parking both, headed "parks task 2.3 and 1 more", whose answer frees them both', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const first = parked(1, '2.3');

    const joined = (await park(made.where, '2.5', { call: { ...CALL, why: 'Its tests need the screen.' } })).res;

    assert.deepStrictEqual([joined.parked, joined.task, joined.line, decide.mock.callCount()], ['Q1', '2.5', 'Task 2.5 parks on Q1, waiting for you: When you make a new note, where should its window open? The other tasks carry on.', 0]);
    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ task: '2.5' }), id: full(joined.id) });
    assert.deepStrictEqual(waiting().map((/** @type {{question: string, id: string, parks: string[]}} */ q) => [q.question, q.id, q.parks]), [['Q1', short(first), ['2.3', '2.5']]]);
    const { res, sections } = draw('Q1');
    assert.strictEqual(sections, screen(res.raise, 'Q1', 'task 2.3 and 1 more'));
    assert.deepStrictEqual(seals()?.[res.raise].parks, { park: first, number: 1, tasks: ['2.3', '2.5'], went_ahead: null });
    assert.strictEqual(answer(res.raise, ['--pick', '1']).receipt, 'Q1 answered · their tasks build again · nothing waiting on you');
    assert.strictEqual(lastEntry().task, '2.3');
  });

  it('a task whose question comes to wait while its rows are judged joins it under the lock, its line holding the first park\'s call as sealed', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => {
      parked(1, '2.3');
      return { decision: 'ask', reason: 'Its own reason.' };
    });

    const { res } = await park(made.where, '2.5', { call: { ...CALL, why: 'Its tests need the screen.' } });

    assert.deepStrictEqual([res.parked, lastEntry()], ['Q1', { ...parkedLine({ task: '2.5' }), id: full(res.id) }]);
  });

  it('12.S8: a call made outside any task asks, at the build\'s place or its review\'s — the task writer\'s, the consolidation agent\'s, the phase review\'s: its question waits in the build\'s queue parking none, listed with no task and its screen headed by its number alone, its line saying the build or the review carries on as its place is; made again outside any task it parks nothing, and a task meeting it joins it', async () => {
    const { res, sections } = await outsideTask(made.where, REVIEW);

    assert.deepStrictEqual([res, sections], [{
      ok: true, decision: 'ask', reason: EVERY_CALL_ASKS, parked: 'Q1', task: null, id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      line: 'Q1 waits for you, parking no task: When you make a new note, where should its window open? The review carries on.',
    }, '']);
    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ phase: 'review', task: null }), id: full(res.id) });
    assert.deepStrictEqual(waiting().map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]), [['Q1', []]]);
    assert.strictEqual(draw('Q1').sections.split('\n')[2], 'Q1 · Fumi');
    const text = ledgerText();
    const again = (await outsideTask(made.where)).res;
    assert.deepStrictEqual([again.parked, again.task, again.already, again.committed, ledgerText()], ['Q1', null, true, null, text]);
    assert.strictEqual((await park(made.where, '2.3')).res.parked, 'Q1');
    assert.deepStrictEqual(waiting().map((/** @type {{parks: string[]}} */ q) => q.parks), [['2.3']]);
    assert.strictEqual((await outsideTask(made.where)).res.line, 'Q1 waits for you, parking task 2.3: When you make a new note, where should its window open? The build carries on.');
  });

  it('16.3.8: a fact only the person holds parks in the build as any question asking does, with its task or with none — never meeting the decision point, sealed as the ledger holds a fact, with no lean — listed waiting, its screen a fact\'s', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason: 'Your calls on this kind land.' }));

    const { res, sections } = await parkFact(made.where, '2.3');

    assert.deepStrictEqual([res, sections], [{
      ok: true, decision: 'ask', reason: ONLY_YOU_KNOW, parked: 'Q1', task: '2.3', id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      line: 'Task 2.3 parks on Q1, waiting for you: Which iCloud account does a new note sync to? The other tasks carry on.',
    }, '']);
    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ why_asking: ONLY_YOU_KNOW, call: FACT_CALL }), id: full(res.id) });
    assert.strictEqual((await parkFact(made.size, null, REVIEW)).res.parked, 'Q2');
    assert.strictEqual(decide.mock.callCount(), 0, 'a fact met the decision point');
    assert.deepStrictEqual(waiting().map((/** @type {{question: string, asks: string, parks: string[]}} */ q) => [q.question, q.asks, q.parks]), [['Q1', FACT.question, ['2.3']], ['Q2', FACT.question, []]]);
    const drawn = draw('Q1');
    assert.strictEqual(seals()?.[drawn.res.raise].fact, true);
    assert.deepStrictEqual(seals()?.[drawn.res.raise].call, { ...FACT });
    assert.ok(drawn.sections.includes('Q1 · Fumi · parks task 2.3\n') && drawn.sections.includes('What\'s the answer?') && !drawn.sections.includes('I lean'), drawn.sections);
  });

  it('a replacement proposed in the build parks its task too, the decision it would replace, the reason, the cause and whose the decision is on the line; another task meeting it joins it with all of these copied', async () => {
    const { res } = await parkReplacement('2.4');
    const line = parkedLine({ question: null, replaces: made.frameless, reason: 'was-wrong', task: '2.4', call: FRAMED, replaced_by: 'claude' });

    assert.deepStrictEqual(lastEntry(), { ...line, id: full(res.id) });
    const joined = (await parkReplacement('2.5')).res;
    assert.deepStrictEqual(lastEntry(), { ...line, task: '2.5', id: full(joined.id) });
  });

  it('12.S11: a call that proceeds in the build lands Claude\'s decision for its task, and one made outside any task for none, parking nothing — each call event saying whether it blocked build work, as the replay reads it', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason: 'Your calls on this kind land.' }));

    const { res } = await park(made.where, '2.3');
    assert.deepStrictEqual([res.decision, lastEntry().event, lastEntry().task, lastEntry().by], ['proceed', 'decided', '2.3', 'claude']);
    const outside = (await outsideTask(made.size, REVIEW)).res;
    assert.deepStrictEqual([outside.decision, lastEntry().event, lastEntry().task], ['proceed', 'decided', null]);
    assert.deepStrictEqual(waiting(), []);
    assert.deepStrictEqual(logged().map(({ type, blocks_build: blocks }) => [type, blocks]), [['call', true], ['call', false]]);
  });

  it('refuses, writing and sealing nothing: a task named elsewhere, --task, a task not as screens show one, and --parks twice', async () => {
    assert.match(await refusedPark([TOPIC, '--answers', askedOnTopic(), '--parks', '2.3']), /^raise --parks parks a task in the build, and discussion is none of its phases — implementation or review$/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--task', '2.3']), /^raise takes no --task — a raise in the build names its task with --parks <phase>\.<n>/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--parks', 'task-3']), /^raise: --parks takes the task it parks, as screens show it, <phase>\.<n> — not "task-3"$/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--parks', '2.3', '--parks', '2.4']), /^raise takes --parks once/);
  });
});

describe('the label a park seals (16.11.5)', () => {
  /** The conversation, the stub labelling the call `danger`, hard to undo, and judging nothing. */
  const labelled = () => conversation({ CLAUDE_STUB_ANSWERS: JSON.stringify({ 'The answer: ': 'no-login', '': labelAnswers('danger', { hardToUndo: true }) }) });
  const LABEL = { labeller: 'claude-sonnet-stub', answers: ORDER.map((key) => key === 'danger' || key === 'hard_to_undo') };

  it('labels the call it parks beside its rows\' checks, sealing the label on the parked line; raise draw seals it from the park, and the answer lands its kind and hard-to-undo mark, its raise event the label and blocking build work, as the call was decided (16.4.7)', async () => {
    const { res } = await park(made.where, '2.3', { env: labelled() });

    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ label: LABEL }), id: full(res.id) });
    const drawn = draw('Q1').res.raise;
    assert.deepStrictEqual(seals()?.[drawn].label, LABEL);
    answer(drawn, ['--pick', '1']);
    assert.deepStrictEqual([lastEntry().kind, lastEntry().hard_to_undo, logged().at(-1)?.kind, logged().at(-1)?.label, logged().at(-1)?.blocks_build], ['danger', true, 'danger', LABEL, true]);
  });

  it('a task joining a question waiting copies its first park\'s label, labelling nothing', async () => {
    parked(1, '2.3', { label: LABEL });
    const log = path.join(config(), 'joined-calls.jsonl');

    const { res } = await park(made.where, '2.5', { env: conversation({ CLAUDE_STUB_ANSWERS: JSON.stringify({ '': labelAnswers('words') }), CLAUDE_STUB_LOG: log }) });

    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ task: '2.5', label: LABEL }), id: full(res.id) });
    assert.ok(!fs.existsSync(log), 'a task joining a question waiting put a call');
  });

  it('16.3.8: a fact parks unlabelled, its label never asked', async () => {
    const log = path.join(config(), 'fact-calls.jsonl');

    await okSectionsAsync(dir, ['raise', BUILD, '--answers', made.size, '--fact', '--parks', '2.3'], { env: conversation({ CLAUDE_STUB_ANSWERS: JSON.stringify({ '': labelAnswers('words') }), CLAUDE_STUB_LOG: log }), stdin: JSON.stringify(FACT) });

    assert.strictEqual(lastEntry().label, null);
    assert.ok(!fs.existsSync(log), 'a fact put a call');
  });
});

describe('what waits (12.13.6, 12.13.7)', () => {
  it('raise waiting lists the unit\'s questions waiting, oldest first: each by its number and its park\'s id, what it asks and the question it is about, the tasks it parks, when it parked and how many minutes it has waited', (t) => {
    const q1 = parked(1, '2.3');
    const q2 = parked(2, '2.4', { question: made.size, call: { ...CALL, question: 'How big should a new note be?' } });
    const since = (/** @type {string} */ id) => /** @type {string} */ (entries().find((e) => e.id === id).at);
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(since(q1)) + (90 * 60 + 30) * 1000 });

    assert.deepStrictEqual(ok(dir, ['raise', 'waiting', UNIT]), {
      ok: true,
      unit: UNIT,
      waiting: [
        { question: 'Q1', id: short(q1), asks: CALL.question, about: short(made.where), parks: ['2.3'], since: since(q1), waited_minutes: 90 },
        { question: 'Q2', id: short(q2), asks: 'How big should a new note be?', about: short(made.size), parks: ['2.4'], since: since(q2), waited_minutes: Math.floor((Date.parse(since(q1)) + 90.5 * 60000 - Date.parse(since(q2))) / 60000) },
      ],
    });
  });

  it('a question reworded while it waits is about its wording now, and a replacement proposed about the decision it would replace', () => {
    parked(1, '2.3');
    parkedReplacement(2);
    const reworded = rewordedOnAClone();

    assert.deepStrictEqual(waiting().map((/** @type {{about: string}} */ q) => full(q.about)), [reworded, made.frameless]);
  });

  it('a question waits no longer once merged into another\'s answer or moved to the roadmap as later, a replacement proposed once its decision is no longer current — each as a clone\'s merge lays it — and nothing waits in a cancelled unit', () => {
    parked(1, '2.3');
    parked(2, '2.4', { question: made.size });
    parkedReplacement(3, '2.5');
    parked(4, '2.6', { question: made.title });

    appended({ event: 'merged', question: made.where, into: made.frameless, duplicate: null });
    assert.deepStrictEqual(waitingNumbers(), ['Q2', 'Q3', 'Q4']);
    appended({ event: 'moved', question: made.size, to: 'roadmap:note-sizes' });
    assert.deepStrictEqual(waitingNumbers(), ['Q3', 'Q4']);
    appended({
      event: 'replaced', replaces: made.frameless, reason: 'was-wrong', cause: null, drops: ['frameless'], of: 'decision',
      answers: made.frame, text: 'A thin frame.', why: 'It stands out.', ...DECIDED,
    });
    assert.deepStrictEqual(waitingNumbers(), ['Q4']);

    createManifest(dir, UNIT, { work_type: 'epic', status: 'cancelled', phases: PHASES });
    assert.deepStrictEqual(waiting(), []);
  });

  it('a question set aside with its topic, postponed or cancelled, waits no longer — raise waiting, raise draw and raise aside answering for the rest — and waits again once the topic is back', () => {
    parked(1, '2.2', { question: made.size });
    parked(2, '2.3', { question: askedOnTopic() });
    /** The note window's map row, `item` over it. @param {Record<string, unknown>} item */
    const mapped = (item) => createManifest(dir, UNIT, { work_type: 'epic', phases: { ...PHASES, discovery: { items: { ...PHASES.discovery.items, 'note-window': { ...PHASES.discovery.items['note-window'], ...item } } } } });
    const refused = (/** @type {string} */ verb) => refusedPristine(dir, ['raise', verb, UNIT, 'Q2'], { env: conversation() }).error;

    for (const aside of ['postponed', 'cancelled']) {
      mapped({ [aside]: true });
      assert.deepStrictEqual(waitingNumbers(), ['Q1'], `a question on a topic ${aside} waits`);
      assert.strictEqual(refused('draw'), `raise draw: Q2 waits no longer — its question is set aside — its topic, note-window, is ${aside}`);
      assert.strictEqual(refused('aside'), `raise aside: Q2 waits no longer — its question is set aside — its topic, note-window, is ${aside}`);
      assert.strictEqual(ok(dir, ['raise', 'aside', UNIT, 'Q1'], { env: conversation() }).receipt, 'Q1 set aside · still waiting · 1 waiting on you');
      assert.deepStrictEqual(draw('Q1').res.parks, ['2.2']);
    }
    mapped({});
    assert.deepStrictEqual(waitingNumbers(), ['Q1', 'Q2']);
    assert.deepStrictEqual(draw('Q2').res.parks, ['2.3']);
  });

  it('two clones parking two questions under one number before either pushed: the merge keeps both, each waiting; the number naming both refuses, naming each by its id, and an id draws its own', () => {
    const one = parked(1, '2.3');
    const other = parked(1, '2.5', { question: made.size });
    const short = (/** @type {string} */ id) => /** @type {string} */ (waiting().find((/** @type {{id: string}} */ q) => full(q.id) === id)).id;

    assert.deepStrictEqual(waiting().map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]), [['Q1', ['2.3']], ['Q1', ['2.5']]]);
    assert.strictEqual(refuses(dir, ['raise', 'draw', UNIT, 'Q1'], { env: conversation() }).error,
      `raise draw: Q1 names 2 questions of fumi — each clone parked one under it before the other pushed; name the one by its id: ${short(one)} (parks 2.3), ${short(other)} (parks 2.5)`);
    assert.deepStrictEqual(draw(short(other)).res.parks, ['2.5']);
  });
});

describe('raise draw (12.13.10, 12.13.18–12.13.20, 12.S33, 12.S34)', () => {
  it('12.S33, 12.S34: draws the question in full from its park — headed by its number and the task it parks, the lean recommended first, Comment beside — sealed with what it parks, the rows its check judged and what its answer relies on; after a /clear, a new conversation draws it as it was sealed', () => {
    const park = parked(1, '2.3', { rows_judged: ['1'], relies_on: [made.frameless] });

    const { res, sections } = draw('Q1');
    assert.deepStrictEqual([res, sections], [{ ok: true, raise: res.raise, question: 'Q1', parks: ['2.3'], redrawn: false }, screen(res.raise, 'Q1', 'task 2.3')]);
    const { at, ...sealed } = seals()?.[res.raise];
    assert.deepStrictEqual(sealed, {
      v: 1, id: res.raise, menu: `raise — ${res.raise}`, place: { unit: UNIT, phase: 'implementation', topic: null },
      answers: made.where, relies_on: [made.frameless], replaces: null, call: CALL, fact: false, rows_judged: ['1'], label: null, model: null, blocks_build: true, replaced_by: null, always: null, reason: EVERY_CALL_ASKS, blind: false,
      raised: entries().find((e) => e.id === park)?.at, answered: null, didnt_follow: 0, parks: { park, number: 1, tasks: ['2.3'], went_ahead: null },
    });

    const afresh = okSections(dir, ['raise', 'draw', UNIT, park.slice(0, 8)], { env: cleared() });
    assert.strictEqual(afresh.sections, screen(afresh.res.raise, 'Q1', 'task 2.3'));
  });

  it('a question reworded while it waits is drawn as it is worded now — sealed on its new wording, which it shows — and answered; raised on it again, for its task or another joining it, its line says it as worded now', async () => {
    parked(1, '2.3');
    const reworded = rewordedOnAClone();
    const said =(/** @type {string} */ task) => `Task ${task} parks on Q1, waiting for you: On which screen does a new note open? The other tasks carry on.`;

    const { res, sections } = draw('Q1');

    assert.strictEqual(sections, screen(res.raise, 'Q1', 'task 2.3', 'On which screen does a new note open?'));
    assert.strictEqual(seals()?.[res.raise].answers, reworded);
    const again = (await park(reworded, '2.3')).res;
    const joined = (await park(reworded, '2.5')).res;
    assert.deepStrictEqual([again.already, again.line, joined.parked, joined.line], [true, said('2.3'), 'Q1', said('2.5')]);
    assert.strictEqual(answer(res.raise, ['--pick', '1']).receipt, 'Q1 answered · their tasks build again · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().answers], ['decided', reworded]);
  });

  it('a seal is its question\'s by its park alone: one question two clones parked under two numbers draws a seal for each', () => {
    parked(1, '2.3');
    const other = parked(2, '2.5');
    const first = draw('Q1').res;

    const second = draw('Q2').res;

    assert.deepStrictEqual([second.question, second.redrawn, seals()?.[second.raise].parks.park], ['Q2', false, other]);
    assert.notStrictEqual(second.raise, first.raise);
  });

  it('drawn again in the conversation, its open seal is drawn again — after a task joined it, holding the tasks it parks now, its header saying so', () => {
    parked(1, '2.3');
    const first = draw('Q1').res;

    assert.deepStrictEqual(draw('Q1').res, { ...first, redrawn: true });
    parked(1, '2.4');
    const { res, sections } = draw('Q1');
    assert.deepStrictEqual(res, { ...first, parks: ['2.3', '2.4'], redrawn: true });
    assert.strictEqual(sections, screen(res.raise, 'Q1', 'task 2.3 and 1 more'));
    assert.deepStrictEqual([Object.keys(seals() ?? {}), seals()?.[res.raise].parks.tasks], [[first.raise], ['2.3', '2.4']]);
  });

  it('a replacement proposed draws Claude\'s proposals, then keep — the decision\'s answer as it stands', () => {
    parkedReplacement();

    const { sections } = draw('Q1');

    assert.ok(sections.includes('Q1 · Fumi · parks task 2.4\n'), sections);
    assert.ok(sections.includes('**`keep`**        → A frameless note'), sections);
  });

  it('refuses, sealing nothing: a unit that does not exist, a number its unit holds none of — naming those waiting — no session, and argv of another shape', () => {
    parked(1, '2.3');
    const refused = (/** @type {string[]} */ args, env = conversation()) => refusedPristine(dir, ['raise', 'draw', ...args], { env }).error;

    assert.strictEqual(refused(['ghost', 'Q1']), 'raise draw: there is no work unit "ghost"');
    assert.strictEqual(refused([UNIT, 'Q7']), 'raise draw: fumi has no question Q7 — those waiting: Q1');
    assert.strictEqual(refused([UNIT, 'Q1'], conversation({ CLAUDE_CODE_SESSION_ID: undefined })), 'raise draw: no conversation to raise it in — Claude Code hands every command it runs a session id, and this one has none');
    assert.strictEqual(refused([UNIT]), 'Usage: engine raise draw <work-unit> <question>   (by its number, Q{n}, or its park\'s id)');
    assert.strictEqual(seals(), null);
  });
});

describe('the answer and its receipt (12.13.15, 12.13.16, 20.6.9, 12.S35, 20.S6)', () => {
  it('12.S35: a pick lands the person\'s decision for the task its question parks, its raise event blocking the build, and answers the receipt — the task building again, how many still wait, and the next the discussion queue names; the board no longer lists it', () => {
    parked(1, '2.3');
    parked(2, '2.4', { question: made.size });
    discussing({ discussing: 'Q1', queue: ['Q2'] });

    const res = drawnAndPicked('Q1');

    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 builds again · 1 waiting on you · next: Q2');
    assert.deepStrictEqual([lastEntry().event, lastEntry().by, lastEntry().task, lastEntry().sealed], ['decided', 'person', '2.3', CURSOR.text]);
    assert.deepStrictEqual(logged(), [raiseEvent(full(res.id), { blocks_build: true })]);
    assert.deepStrictEqual(waitingNumbers(), ['Q2']);
  });

  /** The ledger's line count. */
  const ledgerLines = () => ledgerText().trim().split('\n').length;

  /** The mark a change left on `task`, or null where it left none. @param {string} task */
  const marked = (task) => (fs.existsSync(statePath(dir, `.cache/${UNIT}/build/tasks/${task}/changed.json`)) ? JSON.parse(fs.readFileSync(statePath(dir, `.cache/${UNIT}/build/tasks/${task}/changed.json`), 'utf8')) : null);

  /** `task`'s pair briefed for round `round` in this conversation. @param {string} task @param {number} round */
  const briefedHere = (task, round) => {
    for (const letter of ['a', 'b']) recordReviewer(dir, { unit: UNIT, phase: Number(task.split('.')[0]), n: Number(task.split('.')[1]) }, round, letter, SESSION);
  };

  /** Each of `tasks` with its pair briefed for round 1 in this conversation and reading it, `reports` of it written. @param {string[]} tasks @param {string[]} [reports] */
  function beingRead(tasks, reports = []) {
    for (const task of tasks) {
      briefedHere(task, 1);
      for (const letter of reports) writeState(dir, `${UNIT}/build/tasks/${task}/round-1-${letter}.md`, '## Findings\n\nNone.\n\nVerdict: pass\n');
    }
  }

  it('12.1.4: an answer other than the call\'s lean, given while the pair reads round 1 before either reports, marks each task its question parks changed against that round, so a round briefed after it reads it — the receipt saying the task builds again once its pair has read the round; the lean marks none, and a task no round is briefed for is read as it is', () => {
    parked(1, '2.3');
    parked(2, '2.4', { question: made.size });
    parked(3, '2.5', { question: made.title });
    beingRead(['2.3', '2.4']);

    const receipts = [drawnAndPicked('Q1', CURSOR.key), drawnAndPicked('Q2', MAIN.key), drawnAndPicked('Q3', MAIN.key)].map((res) => res.receipt);

    assert.deepStrictEqual(['2.3', '2.4', '2.5'].map(marked), [null, { round: 1, n: 1, passed_until: null }, null]);
    assert.deepStrictEqual(receipts.slice(0, 2), [
      'Q1 answered · task 2.3 builds again once its pair has read round 1 · 2 waiting on you',
      'Q2 answered · task 2.4 builds again once its pair has read round 1 · 1 waiting on you',
    ]);
  });

  it('12.1.4: a keep of a decision a replacement proposed counts as against the lean and marks its task; a fact, which has no lean, marks none — each task\'s pair briefed and a report of its round written', () => {
    parkedReplacement(1, '2.4');
    parkedFact(2, '2.3');
    beingRead(['2.3', '2.4'], ['a', 'b']);

    answer(draw('Q1').res.raise, ['--pick', 'keep']);
    const kept = ledgerLines();
    answer(draw('Q2').res.raise, ['--own'], { text: 'The work account.', why: 'Notes are for work.' });

    assert.deepStrictEqual(['2.3', '2.4'].map(marked), [null, { round: 1, n: 1, passed_until: kept }]);
  });

  it('12.1.4: the person\'s own words mark each task their question parks, read as the lean though they are: the decision they land is not the lean row\'s own text', () => {
    parked(1, '2.3');
    beingRead(['2.3'], ['a', 'b']);

    answer(draw('Q1').res.raise, ['--own'], { text: 'Where I am looking, as you lean', why: WHY }, { CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: CURSOR.key } }) });

    assert.deepStrictEqual([lastEntry().who_moved_whom, marked('2.3')], ['none', { round: 1, n: 1, passed_until: ledgerLines() }]);
  });

  it('12.1.4: an answer other than the lean, given while the pair reads round 2 after round 1 failed, marks the task against round 2, never the round last reported, and the receipt waits for round 2', () => {
    parked(1, '2.4');
    for (const letter of ['a', 'b']) writeState(dir, `${UNIT}/build/tasks/2.4/round-1-${letter}.md`, '## Findings\n\n- bug: The note is lost.\n  Scenario: A note is written and read back.\n\nVerdict: fail\n');
    briefedHere('2.4', 2);

    const { receipt } = drawnAndPicked('Q1', MAIN.key);

    assert.deepStrictEqual(marked('2.4'), { round: 2, n: 1, passed_until: null });
    assert.strictEqual(receipt, 'Q1 answered · task 2.4 builds again once its pair has read round 2 · nothing waiting on you');
  });

  it('with no discussion queue the receipt names no next, and with none left nothing waits', () => {
    parked(1, '2.3');

    assert.strictEqual(drawnAndPicked('Q1').receipt, 'Q1 answered · task 2.3 builds again · nothing waiting on you');
  });

  it('16.3.8: a fact parked is answered as a fact — the person\'s decision for its task, sealing no lean, nothing in the trust log, "I don\'t follow" counted on the seal alone — and answers the receipt', () => {
    parkedFact(1, '2.3');
    const { raise } = draw('Q1').res;

    assert.strictEqual(answer(raise, ['--didnt-follow'], null).receipt, 'Q1 still open, explained again · still waiting · 1 waiting on you');
    const res = answer(raise, ['--own'], { text: 'The work account.', why: 'Notes are for work.' });

    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 builds again · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().by, lastEntry().task, lastEntry().sealed, lastEntry().who_moved_whom], ['decided', 'person', '2.3', null, 'none']);
    assert.deepStrictEqual([logged(), seals()?.[raise].didnt_follow], [[], 1]);
  });

  it('an answer to a question parking no task frees nothing, its receipt saying so, lands for none, and its raise event blocks no build work — the build carried on (16.4.7)', () => {
    parked(1, null);

    const res = drawnAndPicked('Q1');

    assert.strictEqual(res.receipt, 'Q1 answered · no task waited on it · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().task], ['decided', null]);
    assert.deepStrictEqual(logged(), [raiseEvent(full(res.id), { blocks_build: false })]);
  });

  it('16.4.7: what an answer touches is read as it lands, what it logs as the call was decided — the only task closed off its question since the draw: the drawn screen\'s answer lands for no task, frees none and marks none, and its raise event blocks build work, as the call parking a task was decided', () => {
    const park = parked(1, '2.3');
    beingRead(['2.3']);
    const { raise } = draw('Q1').res;
    appendEntry(statePath(dir), { event: 'unparked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION, task: '2.3', parks: [park] }, []);

    const res = answer(raise, ['--pick', MAIN.key]);

    assert.deepStrictEqual([lastEntry().task, res.receipt, marked('2.3')], [null, 'Q1 answered · no task waited on it · nothing waiting on you', null]);
    assert.deepStrictEqual(logged(), [raiseEvent(full(res.id), { answer: MAIN.key, blocks_build: true })]);
  });

  it('16.4.7: what an answer touches is read as it lands, what it logs as the call was decided — a task joining a question parking none after it was drawn: its answer lands for the task, frees it and marks it, and its raise event, as "I don\'t follow"\'s on the drawn screen, blocks no build work, as the call parking none was decided', () => {
    parked(1, null);
    beingRead(['2.4']);
    const { raise } = draw('Q1').res;
    parked(1, '2.4', { blocks_build: false });

    answer(raise, ['--didnt-follow'], null);
    const res = answer(raise, ['--pick', MAIN.key]);

    assert.deepStrictEqual([lastEntry().task, res.receipt, marked('2.4')], ['2.4', 'Q1 answered · task 2.4 builds again once its pair has read round 1 · nothing waiting on you', { round: 1, n: 1, passed_until: null }]);
    assert.deepStrictEqual(logged(), [
      raiseEvent(null, { answer: null, didnt_follow: true, blocks_build: false }),
      raiseEvent(full(res.id), { answer: MAIN.key, blocks_build: false }),
    ]);
  });

  it('an answer whose task another question still parks: the task waits on it', () => {
    parked(1, '2.6', { question: made.size });
    parked(2, '2.6', { question: made.title });

    assert.strictEqual(drawnAndPicked('Q1').receipt, 'Q1 answered · task 2.6 waits on Q2 · 1 waiting on you');
  });

  it('the receipt names only the tasks the answer freed: a replacement kept, then proposed again for another task and kept again, frees that task alone', () => {
    parkedReplacement(1, '2.4');
    appended({ event: 'kept', by: 'person', who_moved_whom: 'person-moved-claude', entry: made.frameless, reason: 'was-wrong', cause: null, why: WHY, sealed: FRAMED.rows[0].text, given: 'own' });
    parkedReplacement(2, '3.1');

    const res = answer(draw('Q2').res.raise, ['--pick', 'keep']);

    assert.strictEqual(res.receipt, 'Q2 answered · task 3.1 builds again · nothing waiting on you');
  });

  it('a keep of the decision a replacement proposed answers it, the park waiting no longer', () => {
    parkedReplacement();

    const res = answer(draw('Q1').res.raise, ['--pick', 'keep']);

    assert.deepStrictEqual([lastEntry().event, res.receipt], ['kept', 'Q1 answered · task 2.4 builds again · nothing waiting on you']);
    assert.deepStrictEqual(waiting(), []);
  });

  it('"I don\'t follow" lands in the trust log alone, blocking the build, and its receipt reads still open, explained again, naming no next', () => {
    parked(1, '2.3');
    discussing({ discussing: 'Q1', queue: [] });
    const { raise } = draw('Q1').res;
    const text = ledgerText();

    const res = answer(raise, ['--didnt-follow'], null);

    assert.deepStrictEqual(res, { ok: true, raise, open: true, receipt: 'Q1 still open, explained again · still waiting · 1 waiting on you' });
    assert.strictEqual(ledgerText(), text);
    assert.deepStrictEqual(logged(), [raiseEvent(null, { answer: null, didnt_follow: true, blocks_build: true })]);
    assert.deepStrictEqual(waitingNumbers(), ['Q1']);
  });

  it('20.S7: a question answered is refused, recording nothing — by raise draw, by raise aside, and by an answer or "I don\'t follow" from a seal another conversation drew', () => {
    parked(1, '2.3');
    const elsewhere = okSections(dir, ['raise', 'draw', UNIT, 'Q1'], { env: cleared() }).res.raise;
    pickedOnAClone(made.where, '2.3');
    const gone = 'Q1 waits no longer — its question is answered';

    assert.strictEqual(refusedPristine(dir, ['raise', 'draw', UNIT, 'Q1'], { env: conversation() }).error, `raise draw: ${gone}`);
    assert.strictEqual(refusedPristine(dir, ['raise', 'aside', UNIT, 'Q1'], { env: conversation() }).error, `raise aside: ${gone}`);
    const logBefore = logged();
    assert.strictEqual(refusedPristine(dir, ['raise', 'answer', elsewhere, '--pick', '2'], { env: cleared(), stdin: JSON.stringify({ why: WHY }) }).error, `raise answer: ${gone}; nothing recorded`);
    assert.strictEqual(refusedPristine(dir, ['raise', 'answer', elsewhere, '--didnt-follow'], { env: cleared() }).error, `raise answer: ${gone}; nothing recorded`);
    assert.deepStrictEqual(logged(), logBefore, 'a refused answer wrote to the trust log');
  });
});

describe('its answer through its raise alone (12.13.5, 12.13.16, 16.4.7, 5.3.10)', () => {
  it('while a question waits, ledger decide on it is refused, naming its raise — Claude\'s for another task, the person\'s own, and on a new wording of it — writing nothing', () => {
    parked(1, '2.3');
    const decided = (/** @type {string} */ question, /** @type {string[]} */ flags, /** @type {Record<string, unknown>} */ content) => refusedPristine(dir, ['ledger', 'decide', BUILD, '--answers', question, ...flags], { env: conversation(), stdin: JSON.stringify(content) }).error;

    assert.strictEqual(decided(made.where, ['--task', '2.4'], { ...MADE, text: 'On the main screen.', why: 'One place.' }), raiseNamed('ledger decide'));
    assert.strictEqual(decided(made.where, [], { by: 'person', text: 'On the main screen.', why: 'They said so.' }), raiseNamed('ledger decide'));
    const reworded = rewordedOnAClone();
    assert.strictEqual(decided(reworded, [], { ...MADE, text: 'On the main screen.', why: 'One place.' }), raiseNamed('ledger decide'));
  });

  it('while a replacement proposed waits, ledger replace of its decision is refused, naming its raise, writing nothing', () => {
    parkedReplacement(1, '2.4');

    assert.strictEqual(refusedPristine(dir, ['ledger', 'replace', BUILD, '--replaces', made.frameless, '--reason', 'was-wrong'], {
      env: conversation(), stdin: JSON.stringify({ ...MADE, drops: ['frameless'], text: 'A thin frame.', why: 'It stands out.' }),
    }).error, raiseNamed('ledger replace', 'task 2.4'));
  });

  it('while a question waits, ledger move of it — to another topic, and to the roadmap as later — and ledger merge of it are refused, naming its raise, writing nothing', () => {
    const opened = askedOnTopic();
    parked(1, '2.3', { question: opened });

    assert.deepStrictEqual(
      [shifted(opened, 'move', ['--to', 'space-homing']), shifted(opened, 'move', ['--to', 'roadmap:note-windows']), shifted(opened, 'merge', ['--into', made.frameless])],
      [raiseNamed('ledger move'), raiseNamed('ledger move'), raiseNamed('ledger merge')],
    );
  });

  for (const unit of [UNIT, MINT]) {
    it(`while a replacement proposed in ${unit} waits on fumi's decision, ledger merge naming that decision its duplicate is refused, naming its raise, writing nothing`, () => {
      const small = decidedOnAClone(made.size, { text: 'A small note.', why: 'Light.' });
      parked(1, '2.4', { unit, question: null, replaces: made.frameless, reason: 'was-wrong', call: FRAMED, replaced_by: 'claude' });

      assert.strictEqual(
        shifted(made.frame, 'merge', ['--into', small, '--duplicate', made.frameless]),
        `ledger merge: Q1 of ${unit} waits on the person about this, parking task 2.4 — the person answers it through the raise alone: raise draw ${unit} Q1`,
      );
    });
  }

  it('a question that waits no longer, its raise\'s answer laid as a clone\'s merge lays it, moves to another topic and to the roadmap as later, and merges', () => {
    const [moved, later, merged] = ['Is a note a window?', 'Is a note a panel?', 'Is a note a sheet?'].map((text) => askedOnTopic(text));
    for (const [number, question] of [moved, later, merged].entries()) {
      parked(number + 1, `2.${number + 3}`, { question });
      pickedOnAClone(question, `2.${number + 3}`);
    }

    write('move', TOPIC, ['--question', moved, '--to', 'space-homing'], MADE);
    write('move', TOPIC, ['--question', later, '--to', 'roadmap:note-windows'], MADE);
    write('merge', BUILD, ['--question', merged, '--into', made.frameless], MADE);

    assert.deepStrictEqual(entries().slice(-3).map((e) => [e.event, e.question, e.to ?? e.into]), [
      ['moved', moved, 'space-homing'], ['moved', later, 'roadmap:note-windows'], ['merged', merged, made.frameless],
    ]);
  });

  it('while a question waits, any other raise on it is refused before a row is judged, naming its raise — asking on its question from its topic, on a fact, and on the decision a replacement waiting would replace — writing, sealing and judging nothing', async () => {
    const opened = askedOnTopic();
    parked(1, '2.3', { question: opened });
    parked(1, '2.5', { question: opened });
    parkedReplacement(2, '2.4');
    const fact = { question: 'Who signs the beta?', rows: [], mechanism: 'Outside the code.', product_wide: false };

    assert.strictEqual(await refusedPark([TOPIC, '--answers', opened]), raiseNamed('raise', 'task 2.3 and 1 more'));
    assert.strictEqual(await refusedPark([TOPIC, '--answers', opened, '--fact'], fact), raiseNamed('raise', 'task 2.3 and 1 more'));
    assert.strictEqual(await refusedPark([`${UNIT}.specification`, '--replaces', made.frameless, '--reason', 'was-wrong'], FRAMED), raiseNamed('raise', 'task 2.4', 'Q2'));
    assert.deepStrictEqual(checkRuns(config()), [], 'a refused raise judged a row');
  });

  it('a raise whose question comes to wait while its rows are judged is refused under the lock as its call proceeds, naming its raise, writing nothing', async (t) => {
    const opened = askedOnTopic();
    t.mock.method(decisionPoint, 'decide', () => {
      parked(1, '2.3', { question: opened });
      return { decision: 'proceed', reason: 'Your calls on this kind land.' };
    });
    const text = ledgerText();

    const { error } = await refusesAsync(dir, ['raise', TOPIC, '--answers', opened], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.strictEqual(error, raiseNamed('raise'));
    assert.deepStrictEqual(entries().slice(-1).map((e) => e.event), ['parked'], 'the refused call landed');
    assert.ok(ledgerText().startsWith(text));
  });

  it('a raise drawn before its question came to wait is refused at its answer, under the lock, and at "I don\'t follow", naming its raise, recording and counting nothing — a question\'s, and a replacement\'s keep among them', async () => {
    const opened = askedOnTopic();
    const asked = (await okSectionsAsync(dir, ['raise', TOPIC, '--answers', opened], { env: conversation(), stdin: JSON.stringify(CALL) })).res.raise;
    const proposed = (await okSectionsAsync(dir, ['raise', `${UNIT}.specification`, '--replaces', made.frameless, '--reason', 'was-wrong'], { env: conversation(), stdin: JSON.stringify(FRAMED) })).res.raise;
    parked(1, '2.3', { question: opened });
    parkedReplacement(2, '2.4');
    const answered = (/** @type {string} */ raise, /** @type {string[]} */ given) => refusedPristine(dir, ['raise', 'answer', raise, ...given], { env: conversation(), stdin: JSON.stringify({ why: WHY }) }).error;
    const opaque = (/** @type {string} */ raise) => refusedPristine(dir, ['raise', 'answer', raise, '--didnt-follow'], { env: conversation() }).error;
    const sealed = JSON.stringify(seals());

    assert.deepStrictEqual(
      [answered(asked, ['--pick', '1']), opaque(asked), answered(proposed, ['--pick', 'keep']), answered(proposed, ['--pick', '1']), opaque(proposed)],
      [raiseNamed('raise answer'), raiseNamed('raise answer'), ...Array(3).fill(raiseNamed('raise answer', 'task 2.4', 'Q2'))],
    );
    assert.deepStrictEqual([logged(), JSON.stringify(seals())], [[], sealed]);
  });
});

describe('raise aside (12.13.17)', () => {
  it('sets several aside in one call, by number or id, with one receipt naming each — still waiting, the next the queue names after them — writing nothing', () => {
    parked(1, '2.3');
    const q2 = parked(2, '2.4', { question: made.size });
    parked(3, '2.5', { question: made.title });
    discussing({ discussing: 'Q2', queue: ['Q1', 'Q3'] });
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    const res = ok(dir, ['raise', 'aside', UNIT, q2.slice(0, 8), 'Q1'], { env: conversation() });

    assert.deepStrictEqual(res, { ok: true, receipt: 'Q2, Q1 set aside · still waiting · 3 waiting on you · next: Q3' });
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before, 'raise aside wrote or committed');
    assert.deepStrictEqual(waitingNumbers(), ['Q1', 'Q2', 'Q3']);
  });

  it('a discussion queue that cannot be read names no next, and says so', () => {
    parked(1, '2.3');
    discussing('{"discussing":');

    const res = ok(dir, ['raise', 'aside', UNIT, 'Q1'], { env: conversation() });

    assert.strictEqual(res.receipt, 'Q1 set aside · still waiting · 1 waiting on you');
    assert.match(res.warnings[0], /^the discussion queue, .*discussing\.json, cannot be read, so the receipt names no next question: /);
  });

  it('refuses the whole call where any question named waits no longer, and argv of another shape', () => {
    parked(1, '2.3');

    assert.strictEqual(refusedPristine(dir, ['raise', 'aside', UNIT, 'Q1', 'Q2'], { env: conversation() }).error, 'raise aside: fumi has no question Q2 — those waiting: Q1');
    assert.strictEqual(refusedPristine(dir, ['raise', 'aside', UNIT], { env: conversation() }).error, 'Usage: engine raise aside <work-unit> <question> …   (each by its number, Q{n}, or its park\'s id)');
  });
});

describe('the discussion queue the gate mod keeps (P16, 20.6.9)', () => {
  /** A string constant as the gate mod's source spells it: a mod cannot import the engine. @param {string} name */
  const modLiteral = (name) => {
    const found = new RegExp(`const ${name} = '([^']*)'`).exec(fs.readFileSync(path.join(__dirname, '../../skills/leeway-gates/hooks/discuss.ts'), 'utf8'));
    assert.ok(found, `discuss.ts names ${name}`);
    return found[1];
  };

  it('the engine reads the queue by the name the mod writes it under, a queue emptied naming no next; its receipts open with the words the mod reads them by', () => {
    parked(1, '2.3');
    parked(2, '2.4', { question: made.size });
    assert.strictEqual(modLiteral('DISCUSSING'), DISCUSSING);

    discussing({ discussing: null, queue: [] });
    const aside = ok(dir, ['raise', 'aside', UNIT, 'Q1'], { env: conversation() });
    const { receipt: answered } = drawnAndPicked('Q2');

    assert.deepStrictEqual([aside, answered], [
      { ok: true, receipt: `Q1 ${modLiteral('SET_ASIDE')} · still waiting · 2 waiting on you` },
      `Q2 ${modLiteral('ANSWERED')} · task 2.4 builds again · 1 waiting on you`,
    ]);
  });
});

describe('calls carry their task (12.12.5, 20.5.4)', () => {
  it('ledger decide, find, replace and ask take --task in the build, kept on the entry; elsewhere an entry\'s task is null', () => {
    const decided = write('decide', BUILD, ['--answers', made.where, '--task', '2.3'], { ...MADE, text: 'On the cursor\'s screen.', why: 'It follows the person.' }).id;
    write('find', REVIEW, ['--task', '3.1'], { ...MADE, text: 'Spaces keep their ids.', how: 'read', known: 'read' });
    write('replace', BUILD, ['--replaces', decided, '--reason', 'was-wrong', '--task', '2.4'], { ...MADE, drops: ['the cursor\'s screen'], text: 'On the main screen.', why: 'One place.' });
    write('ask', BUILD, ['--task', '2.5'], { ...MADE, text: 'Does a note remember its size?' });
    write('ask', BUILD, [], { ...MADE, text: 'Does a note remember its place?' });

    assert.deepStrictEqual(entries().slice(-5).map((e) => [e.event, e.task]), [['decided', '2.3'], ['found', '3.1'], ['replaced', '2.4'], ['asked', '2.5'], ['asked', null]]);
  });

  it('refuses a task outside the build, and one not as screens show it, writing nothing', () => {
    const at = `${UNIT}.discussion.note-window`;
    const content = JSON.stringify({ ...MADE, text: 'Is a note a window?' });

    assert.strictEqual(refusedPristine(dir, ['ledger', 'ask', at, '--task', '2.3'], { env: conversation(), stdin: content }).error,
      'ledger ask: --task names the task an entry is made for in the build, and discussion is none of its phases — implementation or review');
    assert.strictEqual(refusedPristine(dir, ['ledger', 'ask', BUILD, '--task', '2'], { env: conversation(), stdin: content }).error,
      'ledger ask: --task is a task, as screens show it: {phase}.{n}, or null — not "2"');
  });
});

describe('no questions page (27.2.7)', () => {
  it('27.S6: the questions waiting are reached one at a time, never on a page of their own: no surface of the catalogue draws them', () => {
    assert.deepStrictEqual(Object.keys(SURFACES).filter((name) => /question/.test(name)), []);
  });
});
