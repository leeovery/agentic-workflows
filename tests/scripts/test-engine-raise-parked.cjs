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
// person's answer carrying the task, its trust log event blocking the build,
// and the receipt of what it freed (12.S35, 20.S6); `raise aside`, several
// set aside with one receipt (12.13.17); a question waiting no longer
// refused (20.S7); `--task` on the ledger's writes in the build (12.12.5);
// and no questions page (27.S6). A parked task against the tracker is
// test-engine-task-parks.cjs's.
//
// Layer: verb. World: the ledger suites' unit with questions asked and a
// decision made in its build, and a feature beside it, built once and copied
// for each test; each test keeps its conversations and the trust log in a
// config folder of its own. The world has no tracker, so the check that the
// tracker holds the task a raise parks, test-engine-task-parks.cjs's, is
// passed over here. The separate call is the stub binary, unarmed: no
// login, so every row is drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, okSectionsAsync, refuses, refusesAsync, refusedPristine, treeSnapshot, head, stateGit, fixtureFrom, layout, statePath, writeState, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, WHY, raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { DISCUSSING } = require(path.join(SCRIPTS, 'domain/questions.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { SURFACES } = require(path.join(SCRIPTS, 'domain/render.cjs'));
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';
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

/** What the world holds, by name: each question's and the decision's short id. */
const made = { where: '', size: '', title: '', frame: '', frameless: '', minted: '' };

const world = fixtureFrom('raise-parked-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, MINT, { work_type: 'feature', phases: {} });
  const { write } = ledgerHelpers(() => template);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }).id;
  made.where = ask(BUILD, 'Where does a new note open?');
  made.size = ask(BUILD, 'How big is a new note?');
  made.title = ask(BUILD, 'What does a new note\'s title default to?');
  made.frame = ask(BUILD, 'Does a note have a frame?');
  made.frameless = write('decide', BUILD, ['--answers', made.frame], { ...MADE, text: 'A frameless note.', why: 'Lighter on the desk.' }).id;
  made.minted = ask(`${MINT}.implementation`, 'Which key mints a note?');
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

/** The parked line as the ledger holds it, but its id and time: `own` over Q1 parking 2.3 on where a note opens. @param {Record<string, unknown>} [own] */
function parkedLine(own = {}) {
  return {
    v: 1, event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    question: full(made.where), replaces: null, reason: null, cause: null, relies_on: [], task: '2.3', number: 1,
    call: CALL, rows_judged: [], why_asking: EVERY_CALL_ASKS, ...own,
  };
}

/**
 * A question parked as `Q{number}` with `task`, appended in process — as a
 * clone's merge lays it, or where the park is not the subject: its full id.
 * `own` over the question where a new note opens and Claude's call on it.
 * @param {number} number @param {string} task @param {Record<string, unknown>} [own]
 */
function parked(number, task, own = {}) {
  const { id } = appendEntry(statePath(dir), {
    event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    question: full(made.where), replaces: null, reason: null, cause: null, relies_on: [], task, number, call: CALL, rows_judged: [], why_asking: EVERY_CALL_ASKS, ...own,
  }, []);
  return /** @type {string} */ (id);
}

/** The frameless note's replacement proposed and parked as `Q{number}` with `task`, appended in process. */
const parkedReplacement = (number = 1, task = '2.4') => parked(number, task, { question: null, replaces: full(made.frameless), reason: 'was-wrong', call: FRAMED });

/** The refusal naming `name`'s raise, in the words of `said`, `tasks` the tasks it parks. @param {string} said @param {string} [tasks] @param {string} [name] */
function raiseNamed(said, tasks = 'task 2.3', name = 'Q1') {
  return `${said}: ${name} of fumi waits on the person about this, parking ${tasks} — the person answers it through the raise alone: raise draw fumi ${name}`;
}

/** A question asked on the note window's topic: its short id. */
const askedOnTopic = () => write('ask', TOPIC, [], { ...MADE, text: 'Is a note a window?' }).id;

/** An event of Claude's made in the build, appended in process as a clone's merge lays it. @param {Record<string, unknown>} event */
function appended(event) {
  appendEntry(statePath(dir), { unit: UNIT, topic: null, phase: 'implementation', session: SESSION, ...MADE, ...event }, []);
}

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
    assert.deepStrictEqual(line, { ...parkedLine({ relies_on: [full(made.frameless)] }), id: full(res.id) });
    assert.strictEqual(stateGit(dir, ['log', '-1', '--format=%s']).trim(), `ledger(fumi): parked ${full(res.id)}`);
    const after = treeSnapshot(dir);
    const changed = Object.keys(after).filter((file) => !file.startsWith('.knowledge/') && after[file] !== before[file]);
    assert.deepStrictEqual(changed, [layout.ledger], 'a park changed more than the ledger');
    assert.strictEqual(seals(), null, 'a park sealed a raise in the conversation');
  });

  it('numbers each question in its unit, never reusing one: Q2 after Q1, Q3 once Q2, the highest, is answered while Q1 waits, Q4 once Q1 is answered too, and another unit\'s first Q1', async () => {
    assert.strictEqual((await park(made.where, '2.3')).res.parked, 'Q1');
    assert.strictEqual((await park(made.size, '2.4')).res.parked, 'Q2');
    drawnAndPicked('Q2');

    assert.strictEqual((await park(made.title, '2.5')).res.parked, 'Q3');
    drawnAndPicked('Q1');
    assert.strictEqual((await parkReplacement('2.2')).res.parked, 'Q4');
    assert.strictEqual((await park(made.minted, '1.1', { at: `${MINT}.implementation` })).res.parked, 'Q1');
    assert.deepStrictEqual(waitingNumbers(), ['Q3', 'Q4']);
  });

  it('raised again for its task while its question waits — a rerun after a kill among them — it parks nothing and answers that question', async () => {
    const first = (await park(made.where, '2.3')).res;
    const text = ledgerText();

    const again = (await park(made.where, '2.3')).res;
    assert.deepStrictEqual(again, { ...first, committed: null, already: true });
    assert.strictEqual(ledgerText(), text, 'a park raised again appended a line');
  });

  it('another task meeting a question waiting joins it, asking nothing: parked under its number, minting none, with the call as first sealed — one question waiting, parking both, headed "parks task 2.3 and 1 more", whose answer frees them both', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const first = (await park(made.where, '2.3')).res;

    const joined = (await park(made.where, '2.5', { call: { ...CALL, why: 'Its tests need the screen.' } })).res;

    assert.deepStrictEqual([joined.parked, joined.task, joined.line, decide.mock.callCount()], ['Q1', '2.5', 'Task 2.5 parks on Q1, waiting for you: When you make a new note, where should its window open? The other tasks carry on.', 1]);
    assert.deepStrictEqual(lastEntry(), { ...parkedLine({ task: '2.5' }), id: full(joined.id) });
    assert.deepStrictEqual(waiting().map((/** @type {{question: string, id: string, parks: string[]}} */ q) => [q.question, q.id, q.parks]), [['Q1', first.id, ['2.3', '2.5']]]);
    const { res, sections } = draw('Q1');
    assert.strictEqual(sections, screen(res.raise, 'Q1', 'task 2.3 and 1 more'));
    assert.deepStrictEqual(seals()?.[res.raise].parks, { park: full(first.id), number: 1, tasks: ['2.3', '2.5'] });
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

  it('12.S8: a call made outside any task asks, at the build\'s place or its review\'s — the task writer\'s, the consolidation agent\'s, the phase review\'s: its question waits in the build\'s queue parking none, listed with no task and its screen headed by its number alone; made again outside any task it parks nothing, and a task meeting it joins it', async () => {
    const { res, sections } = await outsideTask(made.where, REVIEW);

    assert.deepStrictEqual([res, sections], [{
      ok: true, decision: 'ask', reason: EVERY_CALL_ASKS, parked: 'Q1', task: null, id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      line: 'Q1 waits for you, parking no task: When you make a new note, where should its window open? The build carries on.',
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
      ok: true, decision: 'ask', reason: 'Only you know this: it\'s a fact I can\'t check.', parked: 'Q1', task: '2.3', id: res.id, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      line: 'Task 2.3 parks on Q1, waiting for you: Which iCloud account does a new note sync to? The other tasks carry on.',
    }, '']);
    assert.deepStrictEqual(lastEntry(), {
      ...parkedLine({ why_asking: 'Only you know this: it\'s a fact I can\'t check.' }),
      call: { question: FACT.question, rows: FACT.rows, lean: null, why: null, sort: null, mechanism: FACT.mechanism, product_wide: false }, id: full(res.id),
    });
    assert.strictEqual((await parkFact(made.size, null, REVIEW)).res.parked, 'Q2');
    assert.strictEqual(decide.mock.callCount(), 0, 'a fact met the decision point');
    assert.deepStrictEqual(waiting().map((/** @type {{question: string, asks: string, parks: string[]}} */ q) => [q.question, q.asks, q.parks]), [['Q1', FACT.question, ['2.3']], ['Q2', FACT.question, []]]);
    const drawn = draw('Q1');
    assert.strictEqual(seals()?.[drawn.res.raise].fact, true);
    assert.deepStrictEqual(seals()?.[drawn.res.raise].call, { ...FACT });
    assert.ok(drawn.sections.includes('Q1 · Fumi · parks task 2.3\n') && drawn.sections.includes('What\'s the answer?') && !drawn.sections.includes('I lean'), drawn.sections);
  });

  it('a replacement proposed in the build parks its task too, the decision it would replace, the reason and the cause on the line', async () => {
    const { res } = await parkReplacement('2.4');

    assert.deepStrictEqual(lastEntry(), {
      ...parkedLine({ question: null, replaces: full(made.frameless), reason: 'was-wrong', task: '2.4', call: FRAMED }), id: full(res.id),
    });
  });

  it('12.S11: a call that proceeds in the build lands Claude\'s decision for its task, and one made outside any task for none, parking nothing', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason: 'Your calls on this kind land.' }));

    const { res } = await park(made.where, '2.3');
    assert.deepStrictEqual([res.decision, lastEntry().event, lastEntry().task, lastEntry().by], ['proceed', 'decided', '2.3', 'claude']);
    const outside = (await outsideTask(made.size, REVIEW)).res;
    assert.deepStrictEqual([outside.decision, lastEntry().event, lastEntry().task], ['proceed', 'decided', null]);
    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses, writing and sealing nothing: a task named elsewhere, --task, a task not as screens show one, and --parks twice', async () => {
    const note = write('ask', `${UNIT}.discussion.note-window`, [], { ...MADE, text: 'Is a note a window?' }).id;
    assert.match(await refusedPark([`${UNIT}.discussion.note-window`, '--answers', note, '--parks', '2.3']), /^raise --parks parks a task in the build, and discussion is none of its phases — implementation or review$/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--task', '2.3']), /^raise takes no --task — a raise in the build names its task with --parks <phase>\.<n>/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--parks', 'task-3']), /^raise: --parks takes the task it parks, as screens show it, <phase>\.<n> — not "task-3"$/);
    assert.match(await refusedPark([BUILD, '--answers', made.where, '--parks', '2.3', '--parks', '2.4']), /^raise takes --parks once/);
  });
});

describe('what waits (12.13.6, 12.13.7)', () => {
  it('raise waiting lists the unit\'s questions waiting, oldest first: each by its number and its park\'s id, what it asks, the tasks it parks, when it parked and how many minutes it has waited', async (t) => {
    const q1 = (await park(made.where, '2.3')).res;
    const q2 = (await park(made.size, '2.4', { call: { ...CALL, question: 'How big should a new note be?' } })).res;
    const since = (/** @type {string} */ short) => /** @type {string} */ (entries().find((e) => e.id === full(short)).at);
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(since(q1.id)) + (90 * 60 + 30) * 1000 });

    assert.deepStrictEqual(ok(dir, ['raise', 'waiting', UNIT]), {
      ok: true,
      unit: UNIT,
      waiting: [
        { question: 'Q1', id: q1.id, asks: CALL.question, parks: ['2.3'], since: since(q1.id), waited_minutes: 90 },
        { question: 'Q2', id: q2.id, asks: 'How big should a new note be?', parks: ['2.4'], since: since(q2.id), waited_minutes: Math.floor((Date.parse(since(q1.id)) + 90.5 * 60000 - Date.parse(since(q2.id))) / 60000) },
      ],
    });
  });

  it('a question waits no longer once merged into another\'s answer or moved to the roadmap as later, a replacement proposed once its decision is no longer current — each as a clone\'s merge lays it — and nothing waits in a cancelled unit', () => {
    parked(1, '2.3');
    parked(2, '2.4', { question: full(made.size) });
    parkedReplacement(3, '2.5');
    parked(4, '2.6', { question: full(made.title) });

    appended({ event: 'merged', question: full(made.where), into: full(made.frameless), duplicate: null });
    assert.deepStrictEqual(waitingNumbers(), ['Q2', 'Q3', 'Q4']);
    appended({ event: 'moved', question: full(made.size), to: 'roadmap:note-sizes' });
    assert.deepStrictEqual(waitingNumbers(), ['Q3', 'Q4']);
    appended({
      event: 'replaced', replaces: full(made.frameless), reason: 'was-wrong', cause: null, drops: ['frameless'], of: 'decision',
      answers: full(made.frame), text: 'A thin frame.', why: 'It stands out.', rules_out: [], relies_on: [], product_wide: false, sealed: null,
      alternatives: [], evidence: [], kind: null, unchecked: true, given: 'own', cites: [], task: null,
    });
    assert.deepStrictEqual(waitingNumbers(), ['Q4']);

    createManifest(dir, UNIT, { work_type: 'epic', status: 'cancelled', phases: PHASES });
    assert.deepStrictEqual(waiting(), []);
  });

  it('a question set aside with its topic, postponed or cancelled, waits no longer — raise waiting, raise draw and raise aside answering for the rest — and waits again once the topic is back', () => {
    parked(1, '2.2', { question: full(made.size) });
    parked(2, '2.3', { question: full(askedOnTopic()) });
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
    const other = parked(1, '2.5', { question: full(made.size) });
    const short = (/** @type {string} */ id) => /** @type {string} */ (waiting().find((/** @type {{id: string}} */ q) => full(q.id) === id)).id;

    assert.deepStrictEqual(waiting().map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]), [['Q1', ['2.3']], ['Q1', ['2.5']]]);
    assert.strictEqual(refuses(dir, ['raise', 'draw', UNIT, 'Q1'], { env: conversation() }).error,
      `raise draw: Q1 names 2 questions of fumi — each clone parked one under it before the other pushed; name the one by its id: ${short(one)} (parks 2.3), ${short(other)} (parks 2.5)`);
    assert.deepStrictEqual(draw(short(other)).res.parks, ['2.5']);
  });
});

describe('raise draw (12.13.10, 12.13.18–12.13.20, 12.S33, 12.S34)', () => {
  it('12.S33, 12.S34: draws the question in full from its park — headed by its number and the task it parks, the lean recommended first, Comment beside — sealed with what it parks, the rows its check judged and what its answer relies on; after a /clear, a new conversation draws it as it was sealed', () => {
    const park = parked(1, '2.3', { rows_judged: ['1'], relies_on: [full(made.frameless)] });

    const { res, sections } = draw('Q1');
    assert.deepStrictEqual([res, sections], [{ ok: true, raise: res.raise, question: 'Q1', parks: ['2.3'], redrawn: false }, screen(res.raise, 'Q1', 'task 2.3')]);
    const { at, ...sealed } = seals()?.[res.raise];
    assert.deepStrictEqual(sealed, {
      v: 1, id: res.raise, menu: `raise — ${res.raise}`, place: { unit: UNIT, phase: 'implementation', topic: null },
      answers: full(made.where), relies_on: [full(made.frameless)], replaces: null, call: CALL, fact: false, rows_judged: ['1'], reason: EVERY_CALL_ASKS,
      answered: null, didnt_follow: 0, parks: { park, number: 1, tasks: ['2.3'] },
    });

    const afresh = okSections(dir, ['raise', 'draw', UNIT, park.slice(0, 8)], { env: cleared() });
    assert.strictEqual(afresh.sections, screen(afresh.res.raise, 'Q1', 'task 2.3'));
  });

  it('a question reworded while it waits is drawn as it is worded now — sealed on its new wording, which it shows — and answered; raised on it again, for its task or another joining it, its line says it as worded now', async () => {
    parked(1, '2.3');
    const reworded = write('replace', BUILD, ['--replaces', made.where, '--reason', 'changed-mind'], { ...MADE, drops: ['where it opens'], text: 'On which screen does a new note open?' }).id;
    const said = (/** @type {string} */ task) => `Task ${task} parks on Q1, waiting for you: On which screen does a new note open? The other tasks carry on.`;

    const { res, sections } = draw('Q1');

    assert.strictEqual(sections, screen(res.raise, 'Q1', 'task 2.3', 'On which screen does a new note open?'));
    assert.strictEqual(seals()?.[res.raise].answers, full(reworded));
    const again = (await park(reworded, '2.3')).res;
    const joined = (await park(reworded, '2.5')).res;
    assert.deepStrictEqual([again.already, again.line, joined.parked, joined.line], [true, said('2.3'), 'Q1', said('2.5')]);
    assert.strictEqual(answer(res.raise, ['--pick', '1']).receipt, 'Q1 answered · their tasks build again · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().answers], ['decided', full(reworded)]);
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
    parked(2, '2.4', { question: full(made.size) });
    discussing({ discussing: 'Q1', queue: ['Q2'] });

    const res = drawnAndPicked('Q1');

    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 builds again · 1 waiting on you · next: Q2');
    assert.deepStrictEqual([lastEntry().event, lastEntry().by, lastEntry().task, lastEntry().sealed], ['decided', 'person', '2.3', CURSOR.text]);
    assert.deepStrictEqual(logged(), [raiseEvent(full(res.id), { blocked_build: true })]);
    assert.deepStrictEqual(waitingNumbers(), ['Q2']);
  });

  /** The mark a change left on `task`, or null where it left none. @param {string} task */
  const marked = (task) => (fs.existsSync(statePath(dir, `${UNIT}/build/tasks/${task}/changed.json`)) ? JSON.parse(fs.readFileSync(statePath(dir, `${UNIT}/build/tasks/${task}/changed.json`), 'utf8')) : null);

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
    parked(2, '2.4', { question: full(made.size) });
    parked(3, '2.5', { question: full(made.title) });
    beingRead(['2.3', '2.4']);

    const receipts = [drawnAndPicked('Q1', CURSOR.key), drawnAndPicked('Q2', MAIN.key), drawnAndPicked('Q3', MAIN.key)].map((res) => res.receipt);

    assert.deepStrictEqual(['2.3', '2.4', '2.5'].map(marked), [null, { round: 1, n: 1 }, null]);
    assert.deepStrictEqual(receipts.slice(0, 2), [
      'Q1 answered · task 2.3 builds again once its pair has read round 1 · 2 waiting on you',
      'Q2 answered · task 2.4 builds again once its pair has read round 1 · 1 waiting on you',
    ]);
  });

  it('12.1.4: a keep of a decision a replacement proposed counts as against the lean and marks its task; a fact, which has no lean, marks none — each task\'s pair briefed and a report of its round written', async () => {
    parkedReplacement(1, '2.4');
    await parkFact(made.where, '2.3');
    beingRead(['2.3', '2.4'], ['a', 'b']);

    answer(draw('Q1').res.raise, ['--pick', 'keep']);
    answer(draw('Q2').res.raise, ['--own'], { text: 'The work account.', why: 'Notes are for work.' });

    assert.deepStrictEqual(['2.3', '2.4'].map(marked), [null, { round: 1, n: 1 }]);
  });

  it('12.1.4: an answer other than the lean, given while the pair reads round 2 after round 1 failed, marks the task against round 2, never the round last reported, and the receipt waits for round 2', () => {
    parked(1, '2.4');
    for (const letter of ['a', 'b']) writeState(dir, `${UNIT}/build/tasks/2.4/round-1-${letter}.md`, '## Findings\n\n- bug: The note is lost.\n  Scenario: A note is written and read back.\n\nVerdict: fail\n');
    briefedHere('2.4', 2);

    const { receipt } = drawnAndPicked('Q1', MAIN.key);

    assert.deepStrictEqual(marked('2.4'), { round: 2, n: 1 });
    assert.strictEqual(receipt, 'Q1 answered · task 2.4 builds again once its pair has read round 2 · nothing waiting on you');
  });

  it('with no discussion queue the receipt names no next, and with none left nothing waits', () => {
    parked(1, '2.3');

    assert.strictEqual(drawnAndPicked('Q1').receipt, 'Q1 answered · task 2.3 builds again · nothing waiting on you');
  });

  it('16.3.8: a fact parked is answered as a fact — the person\'s decision for its task, sealing no lean, nothing in the trust log, "I don\'t follow" counted on the seal alone — and answers the receipt', async () => {
    await parkFact(made.where, '2.3');
    const { raise } = draw('Q1').res;

    assert.strictEqual(answer(raise, ['--didnt-follow'], null).receipt, 'Q1 still open, explained again · still waiting · 1 waiting on you');
    const res = answer(raise, ['--own'], { text: 'The work account.', why: 'Notes are for work.' });

    assert.strictEqual(res.receipt, 'Q1 answered · task 2.3 builds again · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().by, lastEntry().task, lastEntry().sealed, lastEntry().who_moved_whom], ['decided', 'person', '2.3', null, 'none']);
    assert.deepStrictEqual([logged(), seals()?.[raise].didnt_follow], [[], 1]);
  });

  it('an answer to a question parking no task frees nothing, its receipt saying so, and lands for none', async () => {
    await outsideTask(made.where);

    assert.strictEqual(drawnAndPicked('Q1').receipt, 'Q1 answered · no task waited on it · nothing waiting on you');
    assert.deepStrictEqual([lastEntry().event, lastEntry().task], ['decided', null]);
  });

  it('an answer whose task another question still parks: the task waits on it', () => {
    parked(1, '2.6', { question: full(made.size) });
    parked(2, '2.6', { question: full(made.title) });

    assert.strictEqual(drawnAndPicked('Q1').receipt, 'Q1 answered · task 2.6 waits on Q2 · 1 waiting on you');
  });

  it('the receipt names only the tasks the answer freed: a replacement kept, then proposed again for another task and kept again, frees that task alone', () => {
    parkedReplacement(1, '2.4');
    answer(draw('Q1').res.raise, ['--pick', 'keep']);
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
    assert.deepStrictEqual(logged(), [raiseEvent(null, { answer: null, didnt_follow: true, blocked_build: true })]);
    assert.deepStrictEqual(waitingNumbers(), ['Q1']);
  });

  it('20.S7: a question answered is refused, recording nothing — by raise draw, by raise aside, and by an answer or "I don\'t follow" from a seal another conversation drew', () => {
    parked(1, '2.3');
    const elsewhere = okSections(dir, ['raise', 'draw', UNIT, 'Q1'], { env: cleared() }).res.raise;
    drawnAndPicked('Q1');
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
    const reworded = write('replace', BUILD, ['--replaces', made.where, '--reason', 'changed-mind'], { ...MADE, drops: ['where it opens'], text: 'On which screen does a new note open?' }).id;
    assert.strictEqual(decided(reworded, [], { ...MADE, text: 'On the main screen.', why: 'One place.' }), raiseNamed('ledger decide'));
  });

  it('while a replacement proposed waits, ledger replace of its decision is refused, naming its raise, writing nothing', () => {
    parkedReplacement(1, '2.4');

    assert.strictEqual(refusedPristine(dir, ['ledger', 'replace', BUILD, '--replaces', made.frameless, '--reason', 'was-wrong'], {
      env: conversation(), stdin: JSON.stringify({ ...MADE, drops: ['frameless'], text: 'A thin frame.', why: 'It stands out.' }),
    }).error, raiseNamed('ledger replace', 'task 2.4'));
  });

  it('while a question waits, any other raise on it is refused before a row is judged, naming its raise — asking on its question from its topic, on a fact, and on the decision a replacement waiting would replace — writing, sealing and judging nothing', async () => {
    const opened = askedOnTopic();
    parked(1, '2.3', { question: full(opened) });
    parked(1, '2.5', { question: full(opened) });
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
      parked(1, '2.3', { question: full(opened) });
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
    parked(1, '2.3', { question: full(opened) });
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
    const q2 = parked(2, '2.4', { question: full(made.size) });
    parked(3, '2.5', { question: full(made.title) });
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
  it('27.S6: the questions waiting are reached one at a time, never on a page of their own: no surface of the catalogue draws them, scoping\'s questions its only surface of questions', () => {
    assert.deepStrictEqual(Object.keys(SURFACES).filter((name) => /question/.test(name)), ['scoping-questions']);
  });
});
