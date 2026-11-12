'use strict';

// ---------------------------------------------------------------------------
// A parked task and the tracker agreeing (13.4.6;
// leeway-engine/scripts/domain/task-parks.cjs, the questions
// domain/questions.cjs): a raise parks only a task the tracker holds, not
// yet ended; a task a question waiting parks is never ready, nor done; and
// `task close` takes the task off the questions parking it — an `unparked`
// line naming the parks, tagged with the build's phase they were made in,
// refused with no session before anything moves — a question it leaves
// parking none still waiting, and the task reopened and parked again
// parking again; and a task parked, raised to the person, its builder's stop
// taken off it; and a blind question whose call went ahead for its task
// parking that task once its pair has passed it, never before, the
// person's answer freeing it — as built, on their answer, or waiting on
// another question still — a change to it lifting the hold, freeing it as
// of the change until a round briefed after the change passes it, a close
// taking it off the question for good, and the rule off changing nothing
// (16.17.6). The account's refusal is test-engine-task-account.cjs's.
//
// Layer: verb. Budget: 20 s — the hold's tests drive the task through its
// pair's rounds, its changes and the person's answers, each a state commit,
// once for every way the hold begins and ends.
// World: the ledger suites' unit with questions asked in its
// build and phase 2 written in the tracker — 2.1 closed, 2.2 to 2.4 open —
// built once and copied for each test; each test keeps its conversations
// and the trust log in a config folder of its own. The separate call is the
// stub binary, unarmed: no login, so every row is drawn unjudged, but
// labelling the call's question where a test arms it; the decision point
// forced to draw blind where a test says so.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { ok, okSections, okSectionsAsync, refusesAsync, refusedPristine, treeSnapshot, head, fixtureFrom, statePath, writeState, cleanupFixture, accountTaken } = require('./engine-harness.cjs');
const { useTempFolder, createManifest, copyWorld, templateFolder } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { labelling } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { recordReviewer, roundReportPath, settlementPath } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { freedAt } = require(path.join(SCRIPTS, 'domain/task-parks.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));

const BUILD = `${UNIT}.implementation`;
const REVIEW = `${UNIT}.review`;
// Task 2.3, as a round's report names it.
const TASK = Object.freeze({ unit: UNIT, phase: 2, n: 3 });

/** Claude's call: where a new note opens. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [
    { key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' },
    { key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' },
  ],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** What the world holds, by name: each question's short id. */
const made = { where: '', size: '' };

const world = fixtureFrom('task-parks-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  ok(template, ['task', 'phase', UNIT, '2', '--title', 'Notes']);
  const file = path.join(template, '..', `${path.basename(template)}-task.md`);
  for (const title of ['Open a note', 'Size a note', 'Place a note', 'Title a note']) {
    fs.writeFileSync(file, [
      `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
      '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a note, when ${title.toLowerCase()} runs, then it answers.`, '', '## Spec reference', '§12', '',
    ].join('\n'));
    ok(template, ['task', 'create', UNIT, '2', '--file', file]);
  }
  fs.rmSync(file);
  ok(template, ['task', 'close', UNIT, '2.1', '--reason', 'Folded into 2.3.']);
  const { write } = ledgerHelpers(() => template);
  made.where = write('ask', BUILD, [], { ...MADE, text: 'Where does a new note open?' }).id;
  made.size = write('ask', BUILD, [], { ...MADE, text: 'How big is a new note?' }).id;
});

const config = useTempFolder('task-parks-config-');

/** @type {string} */
let dir;

/** Each test of the describe calling it on a copy of the suite's world. */
const onTheWorld = () => beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { ledgerText, full, write: written } = ledgerHelpers(() => dir);
const { conversation, answer, lastEntry, seals, labelledAs } = raiseHelpers(() => dir, config, CALL);

/** A raise at `at` parking `task` on `question`: its response. @param {string} question @param {string} task @param {string} [at] */
async function park(question, task, at = BUILD) {
  return (await okSectionsAsync(dir, ['raise', at, '--answers', question, '--parks', task], { env: conversation(), stdin: JSON.stringify(CALL) })).res;
}

/** The question `name` drawn and its lean picked: the answer's response. @param {string} name */
function answered(name) {
  return answer(okSections(dir, ['raise', 'draw', UNIT, name], { env: conversation() }).res.raise, ['--pick', '1']);
}

/** The unit's questions waiting, each by its number with the tasks it parks. */
const waiting = () => ok(dir, ['raise', 'waiting', UNIT]).waiting.map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]);

/** The tasks of phase 2 task ready answers. */
const ready = () => ok(dir, ['task', 'ready', UNIT, '2']).tasks.map((/** @type {{task: string}} */ t) => t.task);

/** `task {verb}` of `task` in the conversation: its response. @param {string} verb @param {string} task @param {string[]} [more] */
const taskVerb = (verb, task, more = []) => ok(dir, ['task', verb, UNIT, task, ...more], { env: conversation() });

/** The task reopened in the tracker by the person, outside the workflows. @param {string} task */
function reopened(task) {
  const store = path.join(statePath(dir), '.tick', 'tasks.jsonl');
  const ref = `task:${UNIT}-${task.replace('.', '-')}`;
  const { id } = fs.readFileSync(store, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line)).find((line) => (line.refs ?? []).includes(ref));
  assert.strictEqual(spawnSync('tick', ['reopen', id], { cwd: statePath(dir), encoding: 'utf8' }).status, 0);
}

describe('a raise parks a task the tracker holds, not yet ended', () => {
  onTheWorld();

  it('refuses, writing and sealing nothing, a task the tracker lacks and one ended', async () => {
    const before = { tree: treeSnapshot(dir), head: head(dir) };
    const refused = async (/** @type {string} */ task) => (await refusesAsync(dir, ['raise', BUILD, '--answers', made.where, '--parks', task], { env: conversation(), stdin: JSON.stringify(CALL) })).error;

    assert.strictEqual(await refused('2.6'), 'raise: --parks names task 2.6 of fumi, which the tracker does not hold — a question parks a task the tracker holds');
    assert.strictEqual(await refused('2.1'), 'raise: --parks names task 2.1 of fumi, which is closed — a question parks only a task not yet ended');
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before);
  });
});

describe('a task a question waiting parks waits on it', () => {
  onTheWorld();

  it('task ready leaves it out, and answers it again once the question is answered', async () => {
    await park(made.where, '2.3');

    assert.deepStrictEqual(ready(), ['2.2', '2.4']);
    answered('Q1');
    assert.deepStrictEqual(ready(), ['2.2', '2.3', '2.4']);
  });

  it('task done refuses it, naming each question\'s raise, moving and writing nothing; answered, it is done', async () => {
    await park(made.where, '2.3');
    await park(made.size, '2.3');

    assert.strictEqual(refusedPristine(dir, ['task', 'done', UNIT, '2.3'], { env: conversation() }).error,
      'task done: task 2.3 of fumi waits on Q1, Q2, parked for the person — they answer each through its raise: raise draw fumi Q1, raise draw fumi Q2');
    answered('Q1');
    answered('Q2');
    accountTaken(dir, UNIT, '2.3');
    assert.strictEqual(taskVerb('done', '2.3').task, '2.3');
  });
});

describe('a task parked is raised to the person (20.4.9, P5)', () => {
  onTheWorld();

  it('a raise parking a task takes its builder\'s stop off it, in flight in the conversation, another task\'s stop standing', async () => {
    for (const task of ['2.2', '2.3']) {
      taskVerb('start', task);
      taskVerb('stopped', task);
    }
    await park(made.where, '2.2');
    const { tasks } = JSON.parse(fs.readFileSync(path.join(config(), 'conversations', SESSION, 'position.json'), 'utf8'));

    assert.deepStrictEqual(tasks.map((/** @type {{task: string, stopped?: string}} */ { task, stopped }) => [task, stopped !== undefined]), [['2.2', false], ['2.3', true]]);
  });
});

describe('task close takes the task off its questions', () => {
  onTheWorld();

  it('whatever waits on it: one line naming the parks, tagged where they were made — off one question parking another task too, and one left parking none, which still waits — so raise waiting, a screen and a receipt never name it again', async () => {
    const q1 = (await park(made.where, '2.3', REVIEW)).id;
    await park(made.where, '2.4');
    const q2 = (await park(made.size, '2.3', REVIEW)).id;

    const closed = taskVerb('close', '2.3', ['--reason', 'Folded into 2.4.']);

    assert.deepStrictEqual([closed.task, closed.unparked], ['2.3', ['Q1', 'Q2']]);
    const { id: _id, ...line } = lastEntry();
    assert.deepStrictEqual(line, { v: 1, event: 'unparked', unit: UNIT, topic: null, phase: 'review', session: SESSION, task: '2.3', parks: [full(q1), full(q2)] });
    assert.deepStrictEqual(waiting(), [['Q1', ['2.4']], ['Q2', []]]);
    const { res, sections } = okSections(dir, ['raise', 'draw', UNIT, 'Q2'], { env: conversation() });
    assert.deepStrictEqual([res.parks, sections.split('\n')[2]], [[], 'Q2 · Fumi']);
    assert.strictEqual(answer(res.raise, ['--pick', '1']).receipt, 'Q2 answered · no task waited on it · 1 waiting on you');
    assert.strictEqual(answered('Q1').receipt, 'Q1 answered · task 2.4 builds again · nothing waiting on you');
  });

  it('refuses with no session, before anything moves, where a question parks it; a task no question parks closes writing nothing to the ledger', async () => {
    await park(made.where, '2.3');
    const text = ledgerText();

    assert.strictEqual(refusedPristine(dir, ['task', 'close', UNIT, '2.3', '--reason', 'Not needed.'], { env: conversation({ CLAUDE_CODE_SESSION_ID: undefined }) }).error,
      'task close: task 2.3 of fumi is parked on Q1, and taking it off is written to the ledger under the conversation\'s session — Claude Code hands every command it runs one, and this one has none');
    assert.strictEqual(taskVerb('close', '2.4', ['--reason', 'Not needed.']).unparked, undefined);
    assert.strictEqual(ledgerText(), text);
  });

  it('the task reopened and parked again parks again: the close took it off those parks alone', async () => {
    await park(made.where, '2.3');
    await park(made.where, '2.4');
    taskVerb('close', '2.3', ['--reason', 'Folded into 2.4.']);
    reopened('2.3');

    assert.strictEqual((await park(made.where, '2.3')).line, 'Task 2.3 parks on Q1, waiting for you: When you make a new note, where should its window open? The other tasks carry on.');

    assert.deepStrictEqual(waiting(), [['Q1', ['2.4', '2.3']]]);
    assert.deepStrictEqual(ready(), ['2.2']);
    assert.match(refusedPristine(dir, ['task', 'done', UNIT, '2.3'], { env: conversation() }).error, /^task done: task 2\.3 of fumi waits on Q1/);
  });
});

describe('a blind question whose call went ahead holds its task open at its done point (16.17.6)', () => {
  /** The world with Claude's call on where a note opens gone ahead for 2.3 while its blind question, Q1, waits: made once from the suite's, then copied. */
  let ahead = '';

  /**
   * Claude's call on where a note opens raised for 2.3 in `target`, the
   * decision point drawing blind, the trust log in `configDir`, the raise
   * given `more`: it goes ahead while its blind question, Q1, waits.
   * @param {string} target @param {string} configDir @param {string[]} [more]
   */
  async function wentAhead(target, configDir, more = []) {
    const blind = mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'Asked cold.' }));
    try {
      const env = { CLAUDE_CODE_SESSION_ID: SESSION, LEEWAY_CONFIG_DIR: configDir, ...labelling(CALL.question, 'behaviour', { hardToUndo: false }) };
      const { res } = await okSectionsAsync(target, ['raise', BUILD, '--answers', made.where, ...more, '--parks', '2.3'], { env, stdin: JSON.stringify(CALL) });
      assert.deepStrictEqual([res.decision, res.task], ['blind', null], 'the call goes ahead, its question parking no task');
    } finally {
      blind.mock.restore();
    }
  }

  before(async () => {
    ahead = world(templateFolder('task-parks-ahead-'));
    await wentAhead(ahead, templateFolder('task-parks-ahead-config-'));
  });

  beforeEach(() => {
    dir = copyWorld(ahead, fs.mkdtempSync(path.join(os.tmpdir(), 'task-parks-ahead-')));
  });

  /** Task 2.3's pair briefed for round `round` in the conversation and reporting, each of `letters`, passing it: its done point once both have. @param {string[]} [letters] @param {number} [round] */
  function passed(letters = ['a', 'b'], round = 1) {
    for (const letter of letters) {
      recordReviewer(dir, TASK, round, letter, SESSION);
      writeState(dir, roundReportPath(TASK, round, letter), '## Findings\n\nNone.\n\nVerdict: pass\n');
    }
  }

  /** Q1 drawn and answered `how`, its rows keyed as its question's id drew them: the answer's response. @param {'lean'|'other'|'dont-care'} how */
  function answeredQ1(how) {
    const { raise } = okSections(dir, ['raise', 'draw', UNIT, 'Q1'], { env: conversation() }).res;
    if (how === 'dont-care') return answer(raise, ['--dont-care'], null);
    const { lean, rows } = seals()[raise].call;
    return answer(raise, ['--pick', how === 'lean' ? lean : rows.find((/** @type {{key: string}} */ row) => row.key !== lean).key]);
  }

  /** The ledger's lines, in order. */
  const lines = () => ledgerText().trim().split('\n').map((line) => JSON.parse(line));

  /** The ledger's parked lines. */
  const parks = () => lines().filter((line) => line.event === 'parked');

  /** The mark a change left on 2.3, or null where it left none. */
  const marked = () => {
    const file = statePath(dir, `.cache/${UNIT}/build/tasks/2.3/changed.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };

  /** Something added to 2.3 by the orchestrator. */
  const added = () => {
    const file = statePath(dir, '.cache', 'addition.md');
    fs.writeFileSync(file, 'A note opens where the pointer is.\n');
    taskVerb('add', '2.3', ['--file', file, '--by', 'orchestrator']);
  };

  /** The park holding 2.3 open written as the answer writes it, the answer then killed before its own line. */
  const holdLeft = () => {
    const { v: _v, id: _id, at: _at, ...wentAhead } = parks()[0];
    appendEntry(statePath(dir), { ...wentAhead, task: '2.3', went_ahead: null }, []);
  };

  const HELD = 'task 2.3 of fumi waits on Q1, parked for the person — they answer it through its raise: raise draw fumi Q1';

  it('blocks none of its rounds: until its pair passes the task, the question parks nothing and the task is ready', () => {
    assert.deepStrictEqual([waiting(), ready()], [[['Q1', []]], ['2.2', '2.3', '2.4']]);
  });

  it('a round reported by one reviewer of its pair is no pass: the questions read as before, raise waiting and task ready answering', () => {
    passed(['a']);

    assert.deepStrictEqual([waiting(), ready()], [[['Q1', []]], ['2.2', '2.3', '2.4']]);
  });

  it('a round its pair failed that the orchestrator settled is the task\'s done point, as a pass is: the question parks the task, its account refused naming the question\'s raise', () => {
    for (const letter of ['a', 'b']) {
      recordReviewer(dir, TASK, 1, letter, SESSION);
      writeState(dir, roundReportPath(TASK, 1, letter), '## Findings\n\n- bug: The note is lost.\n  Scenario: A note is written and read back.\n\nVerdict: fail\n');
    }
    writeState(dir, settlementPath(TASK, 1), 'The lost note is the next task\'s.\n');

    assert.deepStrictEqual(waiting(), [['Q1', ['2.3']]]);
    assert.strictEqual(refusedPristine(dir, ['task', 'account', UNIT, '2.3'], { env: conversation() }).error, `task account: ${HELD}`);
  });

  it('the person\'s answer lands though what the call relies on was replaced while the task was held: the park holding the task relies on nothing', async () => {
    cleanupFixture(dir);
    dir = world();
    await wentAhead(dir, config(), ['--relies-on', made.size]);
    passed();
    written('replace', BUILD, ['--replaces', made.size, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], text: 'How large is a new note?' });

    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 builds again as built · nothing waiting on you');
    assert.deepStrictEqual(parks().at(-1).relies_on, []);
  });

  it('once its pair has passed the task, parks it: never ready, its account and its done refused naming the question\'s raise, moving and writing nothing, the other tasks going on', () => {
    passed();

    assert.deepStrictEqual([waiting(), ready()], [[['Q1', ['2.3']]], ['2.2', '2.4']]);
    assert.strictEqual(refusedPristine(dir, ['task', 'account', UNIT, '2.3'], { env: conversation() }).error, `task account: ${HELD}`);
    assert.strictEqual(refusedPristine(dir, ['task', 'done', UNIT, '2.3'], { env: conversation() }).error, `task done: ${HELD}`);
  });

  it('the person\'s answer that is Claude\'s writes the park holding the task first, joining the question, so it frees the task as any park\'s answer does, at the answer\'s line: the task builds again as built, never marked changed, its done let through', () => {
    passed();

    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 builds again as built · nothing waiting on you');
    const [hold, keep] = lines().slice(-2);
    assert.deepStrictEqual([hold.event, hold.task, hold.went_ahead, hold.reason, hold.blind, hold.number, keep.event], ['parked', '2.3', null, 'asked-blind', true, 1, 'kept']);
    assert.deepStrictEqual([freedAt(dir, UNIT).get('2.3'), waiting(), ready(), marked()], [lines().length, [], ['2.2', '2.3', '2.4'], null]);
    accountTaken(dir, UNIT, '2.3');
    assert.strictEqual(taskVerb('done', '2.3').task, '2.3');
  });

  it('the person\'s answer that is not Claude\'s frees the task built again on their answer, marked changed under its passed round, so its pair reads it again', () => {
    passed();

    assert.strictEqual(answeredQ1('other').receipt, 'Q1 answered · task 2.3 builds again on your answer · nothing waiting on you');
    assert.deepStrictEqual([waiting(), freedAt(dir, UNIT).get('2.3'), marked()], [[], lines().length, { round: 1, n: 1, passed_until: lines().length }]);
    assert.match(refusedPristine(dir, ['task', 'account', UNIT, '2.3'], { env: conversation() }).error, /^task account: task 2\.3 of fumi changed after round 1 passed/);
  });

  it('the person\'s "don\'t care" frees the task as built, Claude\'s answer the builder\'s', () => {
    passed();

    assert.strictEqual(answeredQ1('dont-care').receipt, 'Q1 answered · my answer stands as the builder\'s: On the screen the cursor is on · task 2.3 builds again as built · nothing waiting on you');
    assert.deepStrictEqual([waiting(), ready(), marked()], [[], ['2.2', '2.3', '2.4'], null]);
  });

  it('an answer leaving the task parked by another question: it stands as built, waiting on that question', async () => {
    passed();
    await park(made.size, '2.3');

    assert.deepStrictEqual(waiting(), [['Q1', ['2.3']], ['Q2', ['2.3']]]);
    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 stands as built, waiting on Q2 · 1 waiting on you');
    assert.deepStrictEqual([waiting(), ready()], [[['Q2', ['2.3']]], ['2.2', '2.4']]);
  });

  it('a question answered before its task\'s done point never holds it: the task, passed after, is let through, never read as freed, so a turn takes it as a task never parked', () => {
    answeredQ1('lean');
    passed();

    assert.deepStrictEqual([waiting(), ready(), freedAt(dir, UNIT).has('2.3')], [[], ['2.2', '2.3', '2.4'], false]);
    accountTaken(dir, UNIT, '2.3');
    assert.strictEqual(taskVerb('done', '2.3').task, '2.3');
  });

  it('something added to the task after its pair passed it lifts the hold, moving its done point back, so its pair reads it again: the task freed just past the last ledger line before the change, a later change, past more of the ledger, leaving that freeing as it was', () => {
    passed();
    const before = lines().length;

    added();
    written('ask', BUILD, [], { ...MADE, text: 'How wide is a new note?' });
    added();

    assert.deepStrictEqual([waiting(), ready(), freedAt(dir, UNIT).get('2.3')], [[['Q1', []]], ['2.2', '2.3', '2.4'], before + 0.5]);
  });

  it('a change landing once the pair passed the task again after an earlier one lifts the hold anew: the task freed just past the last ledger line before that change', () => {
    passed();
    added();
    written('ask', BUILD, [], { ...MADE, text: 'How wide is a new note?' });
    passed(['a', 'b'], 2);
    const held = waiting();
    const before = lines().length;

    added();

    assert.deepStrictEqual([held, waiting(), freedAt(dir, UNIT).get('2.3')], [[['Q1', ['2.3']]], [['Q1', []]], before + 0.5]);
  });

  it('a second change, landing while the pair reads the round briefed for the first, one report of it in, is read only by a round briefed after it: the question holds the task through none of it, round 2 passing or not, until round 3 passes', () => {
    passed();
    added();
    passed(['a'], 2);

    added();
    const midRound = [waiting(), ready()];
    passed(['b'], 2);
    const roundTwo = waiting();
    passed(['a', 'b'], 3);

    assert.deepStrictEqual([midRound, roundTwo, waiting()], [[[['Q1', []]], ['2.2', '2.3', '2.4']], [['Q1', []]], [['Q1', ['2.3']]]]);
  });

  it('something added before its pair passed it lifts nothing: the task was never held, so never read as freed', () => {
    recordReviewer(dir, TASK, 1, 'a', SESSION);
    added();
    passed();

    assert.deepStrictEqual([waiting(), freedAt(dir, UNIT).has('2.3')], [[['Q1', []]], false]);
  });

  it('something added after its pair passed it, before the call went ahead, lifts nothing: the question never held the task, so never read as freed', async () => {
    cleanupFixture(dir);
    dir = world();
    passed();
    added();

    await wentAhead(dir, config());

    assert.deepStrictEqual([waiting(), freedAt(dir, UNIT).has('2.3')], [[['Q1', []]], false]);
  });

  it('something added once the person has answered lifts nothing: the question holds the task no longer, so it stays freed at the answer\'s line', () => {
    passed();
    answeredQ1('lean');
    const answeredAt = lines().length;

    added();

    assert.strictEqual(freedAt(dir, UNIT).get('2.3'), answeredAt);
  });

  it('the answer run again after a kill took it between the park holding the task and its own line: the question parks the task once, and no second park is written', () => {
    passed();
    holdLeft();

    assert.deepStrictEqual(waiting(), [['Q1', ['2.3']]]);
    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 builds again as built · nothing waiting on you');
    assert.strictEqual(parks().length, 2);
  });

  it('a close takes the task off the question before its done point, which still waits: the task never held once its pair passes it, the answer landing for it and reworking nothing, the receipt saying it is closed', () => {
    assert.deepStrictEqual(taskVerb('close', '2.3', ['--reason', 'Folded into 2.4.']).unparked, ['Q1']);
    assert.deepStrictEqual([lastEntry().parks, waiting()], [[parks()[0].id], [['Q1', []]]]);
    passed();

    assert.deepStrictEqual(waiting(), [['Q1', []]]);
    assert.strictEqual(answeredQ1('other').receipt, 'Q1 answered · task 2.3 is closed, so nothing builds again · nothing waiting on you');
    assert.deepStrictEqual([lines().at(-1).event, lines().at(-1).task, marked(), parks().length], ['replaced', '2.3', null, 1]);
  });

  it('a close takes the task off the question holding it, which still waits, and its answer then holds nothing: no park written, the receipt saying it is closed', () => {
    passed();

    assert.deepStrictEqual(taskVerb('close', '2.3', ['--reason', 'Folded into 2.4.']).unparked, ['Q1']);
    assert.deepStrictEqual([lastEntry().parks, waiting()], [[parks()[0].id], [['Q1', []]]]);
    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 is closed, so nothing builds again · nothing waiting on you');
    assert.strictEqual(parks().length, 1);
  });

  it('a close after a kill left the park holding the task takes the task off both, so the question never holds it again and its answer reworks nothing', () => {
    passed();
    holdLeft();

    assert.deepStrictEqual(taskVerb('close', '2.3', ['--reason', 'Folded into 2.4.']).unparked, ['Q1']);
    assert.deepStrictEqual([lastEntry().parks, waiting()], [parks().map(({ id }) => id), [['Q1', []]]]);
    assert.strictEqual(answeredQ1('lean').receipt, 'Q1 answered · task 2.3 is closed, so nothing builds again · nothing waiting on you');
    assert.strictEqual(parks().length, 2);
  });
});

describe('a call raised for a task with the rule off (16.17.6)', () => {
  onTheWorld();

  it('changes nothing: the call asks, parking its task outright, never going ahead, and its answer frees it as any question\'s does, writing no park besides', async () => {
    const res = (await okSectionsAsync(dir, ['raise', BUILD, '--answers', made.where, '--parks', '2.3'], { env: labelledAs(CALL, 'behaviour', { hardToUndo: false }), stdin: JSON.stringify(CALL) })).res;
    for (const letter of ['a', 'b']) {
      recordReviewer(dir, TASK, 1, letter, SESSION);
      writeState(dir, roundReportPath(TASK, 1, letter), '## Findings\n\nNone.\n\nVerdict: pass\n');
    }

    assert.deepStrictEqual([res.decision, res.task, res.landed], ['ask', '2.3', undefined]);
    assert.strictEqual(answered('Q1').receipt, 'Q1 answered · task 2.3 builds again · nothing waiting on you');
    assert.strictEqual(ledgerText().trim().split('\n').filter((line) => JSON.parse(line).event === 'parked').length, 1);
  });
});
