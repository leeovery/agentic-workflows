'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build with a task held open while its blind
// question waits (16.17.6), the decision point forced to draw blind: a
// builder's call cheap to undo going ahead for its task, its question
// parking none, the task held once its pair passes it. In auto: its account
// refused, the other task landing, the stop report putting the question,
// the board showing the task waiting on it, until the person answers as
// Claude did — the task building again as built, merging the chain's tip
// back, and landing. In step: the other task started while it is held keeps
// its turn — its briefs going on, the held task coming back behind it — once
// the person answers, and once a change to the held task lifts the hold.
//
// Layer: simulation. World: this file's own, built once on the named world
// `worlds.specToBuild`, itself built once per run (pipeline-world.cjs) — a
// feature through its spec to ready to build's pick in auto — its one phase
// written and started; a copy per scenario, which replays the engine calls
// the build's prose makes, in order, the oracle (pipeline-oracle.cjs)
// auditing the whole state after every mutation. A task parked by a
// question asked is test-pipeline-simulation-build-park.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, worlds, SPEC_TO_BUILD_UNIT, buildEntry, startPhase, writeTasks, briefOf, answerGate, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));
const decisionPoint = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/decision-point.cjs'));
const { RAISE_SHOWN } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/gate.cjs'));

const WU = SPEC_TO_BUILD_UNIT;
const QUESTION = 'Should a show print the entry\'s id?';
const LEAN = 'A show prints the id.';

/** A feature in auto, its one phase written and started. */
const showingWorld = worldFrom('pipeline-build-held-', (sim) => {
  buildEntry(sim, WU);
  sim.run(['task', 'phase', WU, '1', '--title', 'Showing']);
  sim.run(['brief', 'task-writer', WU, '1']);
  writeTasks(sim, WU, 1, [{ title: 'Show an entry', scenarios: ['1.S1'] }, { title: 'Check the hash on show' }]);
  startPhase(sim, WU, 1);
}, worlds.specToBuild);

describe('pipeline simulation: the build with a task held open on its blind question', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(showingWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /**
   * The decision point drawing blind for test `t`, the question labelled
   * behaviour, cheap to undo; `task` started and its builder's call on it
   * going ahead while its question, Q1, waits: the task's worktree and its
   * builder's brief.
   * @param {import('node:test').TestContext} t @param {string} task
   */
  async function wentAhead(t, task) {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'Asked cold.' }));
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [QUESTION]: labelAnswers('behaviour'), '': 'no-login' }) };
    sim.run(['task', 'start', WU, task]);
    const brief = loop.brief(['builder', WU, task]);
    const tree = loop.isolated(task);
    const asked = sim.run(['ledger', 'ask', `${WU}.implementation`, '--task', task], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: QUESTION })).id;
    const drawn = await sim.runAsync(['raise', `${WU}.implementation`, '--answers', asked, '--parks', task], null, JSON.stringify({ ...leaningCall(LEAN, 'A show hides the id.'), question: QUESTION }));
    assert.deepStrictEqual([drawn.decision, drawn.task], ['blind', null], 'the call goes ahead, its question parking no task');
    return { tree, brief };
  }

  /** The person's answer to Q1 that is Claude's, its row wherever its question's id put it: the receipt. */
  function answeredAsClaude() {
    const seals = () => JSON.parse(fs.readFileSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, RAISE_SHOWN), 'utf8'));
    const { raise } = sim.run(['raise', 'draw', WU, 'Q1']);
    const { key } = seals()[raise].call.rows.find((/** @type {{text: string}} */ row) => row.text === LEAN);
    return sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'The person said why.' })).receipt;
  }

  /**
   * In step: 1.1's call going ahead, its pair passing it, so it is held;
   * then 1.2 started while it is, its builder's work committed.
   * @param {import('node:test').TestContext} t
   */
  async function heldInStep(t) {
    sim.run(['workunit', 'position', WU, 'step']);
    const { tree } = await wentAhead(t, '1.1');
    loop.committed(tree, '1.1', { 'src/show.js': 'export const show = 1;\n' });
    loop.pairRound('1.1');
    sim.run(['task', 'start', WU, '1.2']);
    loop.brief(['builder', WU, '1.2']);
    loop.committed(loop.isolated('1.2'), '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
  }

  /** In step, 1.2 in flight with 1.1 freed behind it: 1.1's builder refused until 1.2 is done, 1.2's pair reading it and 1.2 landing through its gate, then 1.1 back in flight, its builder's brief issued. */
  function behindTheOther() {
    sim.refuses(['brief', 'builder', WU, '1.1'], /task 1\.2 is in flight, and task 1\.1 goes on once it is done$/);
    loop.pairRound('1.2');
    loop.accounted('1.2', ['Passed.']);
    sim.render(['task-landed', WU, '1.2'], { expect: 'content' });
    sim.render(['step-gate', WU, '1.2'], { expect: 'content' });
    answerGate(sim, 'step gate', '--pick', 'y');
    loop.landedTask('1.2');
    return briefOf(sim, loop.brief(['builder', WU, '1.1']));
  }

  it('16.17.6: in auto, a task whose builder\'s call went ahead while its blind question waits is held open once its pair passes it — its account refused, naming the question, the other task building and landing; nothing left, the stop report puts the question, the board showing the task waiting on it; the person answering as Claude did, the task builds again as built, its builder merging the chain\'s tip back and writing its account, and it lands', async (t) => {
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    sim.run(['task', 'start', WU, '1.1']);
    const showingBrief = loop.brief(['builder', WU, '1.1']);
    const showing = loop.isolated('1.1');
    const { tree: hashing } = await wentAhead(t, '1.2');
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
    loop.pairRound('1.2');

    // Held open at its done point: its account refused, naming the
    // question; 1.1 goes on and lands.
    sim.refuses(['task', 'account', WU, '1.2'], new RegExp(`task 1\\.2 of ${WU} waits on Q1, parked for the person`));
    loop.committed(showing, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(showing, showingBrief, '1.S1');
    loop.pairRound('1.1');
    loop.accounted('1.1', ['Passed.']);
    loop.landedTask('1.1');

    // Nothing left goes on: the stop report puts the question, and the
    // board shows 1.2 waiting on it, its phase not yet in review.
    assert.match(sim.render(['build-stop', WU], { expect: 'content' }), /Q1/);
    const [phase] = sim.run(['board', conversation]).view.phases;
    const held = phase.tasks.find((/** @type {{task: string}} */ line) => line.task === '1.2');
    assert.deepStrictEqual([held.state, held.on, phase.state === 'in-review'], ['waits', ['Q1'], false]);

    // The person answers as Claude did: the task builds again as built.
    assert.strictEqual(answeredAsClaude(), 'Q1 answered · task 1.2 builds again as built · nothing waiting on you');

    // Its builder merges the chain's tip back, then writes its account,
    // and the task lands.
    const tip = taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Show an entry');
    assert.match(briefOf(sim, loop.brief(['builder', WU, '1.2'])), /# Where your branch stands\n\nYour phase's chain has moved on past your branch\./);
    git(hashing, ['merge', '-q', '--no-ff', '--no-commit', tip]);
    sim.runIn(hashing, ['commit', '--paths', 'src/show.js', '--task', WU, '1.2', '-m', `merge(${WU}): the chain's tip back`]);
    loop.accounted('1.2', ['Passed.']);
    loop.landedTask('1.2');
    assert.strictEqual(sim.run(['task', 'show', WU, '1.2']).status, 'done');
  });

  it('16.17.6: in step, the person\'s answer frees the held task behind the one started while it was held — that task\'s briefs going on, the held task coming back once it is done', async (t) => {
    await heldInStep(t);

    assert.strictEqual(answeredAsClaude(), 'Q1 answered · task 1.1 builds again as built once task 1.2 is done · nothing waiting on you');
    assert.match(behindTheOther(), /Your reviewers passed the task in round 1: it has landed, so write its account now\./);
  });

  it('16.17.6: in step, something added to the held task lifts its hold, freeing it behind the one started while it was held — that task\'s briefs going on, the held task coming back once it is done, to build what changed', async (t) => {
    await heldInStep(t);

    sim.run(['task', 'add', WU, '1.1', '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, 'An entry is shown by its id.\n'), '--by', 'orchestrator']);

    assert.match(behindTheOther(), /The task changed after your reviewers passed it in round 1/);
  });
});
