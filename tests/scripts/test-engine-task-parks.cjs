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
// parking again. The account's refusal is test-engine-task-account.cjs's.
//
// Layer: verb. World: the ledger suites' unit with questions asked in its
// build and phase 2 written in the tracker — 2.1 closed, 2.2 to 2.4 open —
// built once and copied for each test; each test keeps its conversations
// and the trust log in a config folder of its own. The separate call is the
// stub binary, unarmed: no login, so every row is drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ok, okSections, okSectionsAsync, refusesAsync, refusedPristine, treeSnapshot, head, fixtureFrom, statePath, cleanupFixture, accountTaken } = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');

const BUILD = `${UNIT}.implementation`;
const REVIEW = `${UNIT}.review`;

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

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { ledgerText, full } = ledgerHelpers(() => dir);
const { conversation, answer, lastEntry } = raiseHelpers(() => dir, config, CALL);

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
  it('refuses, writing and sealing nothing, a task the tracker lacks and one ended', async () => {
    const before = { tree: treeSnapshot(dir), head: head(dir) };
    const refused = async (/** @type {string} */ task) => (await refusesAsync(dir, ['raise', BUILD, '--answers', made.where, '--parks', task], { env: conversation(), stdin: JSON.stringify(CALL) })).error;

    assert.strictEqual(await refused('2.6'), 'raise: --parks names task 2.6 of fumi, which the tracker does not hold — a question parks a task the tracker holds');
    assert.strictEqual(await refused('2.1'), 'raise: --parks names task 2.1 of fumi, which is closed — a question parks only a task not yet ended');
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before);
  });
});

describe('a task a question waiting parks waits on it', () => {
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

describe('task close takes the task off its questions', () => {
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
