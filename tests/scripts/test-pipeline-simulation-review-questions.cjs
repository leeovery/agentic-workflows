'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase with a question waiting on the
// person, as its skill runs it: a feature whose build has closed its cut,
// in auto, round 1 failing on a bug its fix task builds. The fix task's
// builder meets a question only the person can answer, raised at the
// review's place, parking the task: nothing else can go on, so the build's
// stop is drawn, the person, ready, answers through its raise, and the
// receipt frees the task, which builds again and lands — the same across a
// /clear, the entry after it naming the question and the task parked
// (12.13.7). A question raised in round 2, parking nothing: the round
// passes, and finish's checklist holds the unit open, naming the question
// and the stop, until the person answers it; then finish goes through
// (12.13.22).
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase, built and closed — a
// copy per scenario, which replays the engine calls the review phase's
// skill makes, in order, the oracle (pipeline-oracle.cjs) auditing the
// whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  Sim, worldFrom, cutClosed, writePhaseTasks, builders, taskBuilt, areaRead, testsRead, reviewNext, buildLoop, carryOn, finished, handoff,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';
const ASKS = 'Should a read check its hash?';
const EXPORT = 'Should the export check hashes in this work?';

/** A feature through its spec to ready to build's pick, its cut's one phase built, reviewed, merged and closed. */
const questionsWorld = worldFrom('pipeline-review-questions-', (sim) => cutClosed(sim, WU));

describe('pipeline simulation: a question waiting on the person in the review phase', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(questionsWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** Round 1 failing on the hash, its one fix task written: the fix task. */
  function failedRound() {
    const { fixPhase: phase } = reviewNext(sim, WU);
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Check the hash on read', type: 'fix', scenarios: ['an entry read back'], reference: '§1' }]);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger.'],
      findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], fix: `${phase}.1` }],
    })]);
    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    return `${phase}.1`;
  }

  /** A question only the person can answer, asked at the review's place and raised, parking `task` where one is given: what the raise answered. @param {string} asks @param {string} [task] */
  async function raised(asks, task) {
    const onTask = task === undefined ? [] : ['--task', task];
    const asked = sim.run(['ledger', 'ask', `${WU}.review`, ...onTask], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: asks })).id;
    const parks = task === undefined ? [] : ['--parks', task];
    return sim.runAsync(['raise', `${WU}.review`, '--answers', asked, ...parks], null, JSON.stringify({ ...leaningCall('Reads check the hash.', 'Reads trust the ledger.'), question: asks }));
  }

  /** The fix task started, its builder sent out and parked on the question: the builder's worktree. @param {string} task */
  async function parkedFix(task) {
    sim.run(['task', 'start', WU, task]);
    loop.brief(['builder', WU, task]);
    const tree = loop.isolated(task);
    const parked = await raised(ASKS, task);
    assert.deepStrictEqual([parked.decision, parked.parked, parked.task, parked.line], ['ask', 'Q1', task, `Task ${task} parks on Q1, waiting for you: ${ASKS} The other tasks carry on.`]);
    assert.deepStrictEqual(sim.run(['task', 'ready', WU]).tasks, [], 'the parked fix task is the only one, so nothing can go on');
    return tree;
  }

  /** Nothing can go on: the stop drawn; the person, ready, answers `asks` with the lean through its raise, the receipt freeing `task` where one waits on it. @param {string} asks @param {string} [task] */
  function answered(asks, task) {
    assert.match(sim.render(['build-stop', WU], { expect: 'content' }), new RegExp(`Q1 ${asks.replace('?', '\\?')}`), 'the stop puts the question to the person');
    const drawn = sim.run(['raise', 'draw', WU, 'Q1']);
    const { receipt } = sim.run(['raise', 'answer', drawn.raise, '--pick', '1'], null, JSON.stringify({ why: 'A read should not trust the disk.' }));
    assert.strictEqual(receipt, task === undefined ? 'Q1 answered · no task waited on it · nothing waiting on you' : `Q1 answered · task ${task} builds again · nothing waiting on you`);
    assert.deepStrictEqual(JSON.parse(sim.read(['raise', 'waiting', WU])).waiting, []);
  }

  /** The fix task built again from `tree`, its pair passing, accounted and landed; the next round's reads to name. @param {string} task @param {string} tree */
  function builtAgain(task, tree) {
    loop.committed(tree, task, { 'src/hash.js': 'export const hash = 1;\n' }, `fix(${WU}): a read checks its hash`);
    loop.pairRound(task);
    loop.accounted(task, ['Passed.']);
    loop.landedTask(task);
    assert.strictEqual(reviewNext(sim, WU).move, 'reads', 'the fix task done, the next round\'s reads are named');
  }

  it('12.13.7: a fix task parking on a question at the review\'s place: the entry names it waiting, the stop is drawn, the person answers through its raise, and the task builds again and lands', async () => {
    const task = failedRound();
    const tree = await parkedFix(task);
    const { data } = reviewNext(sim, WU);
    assert.deepStrictEqual([data.waiting, data['in flight']], [[`Q1 — ${ASKS} — parks task ${task}`], [`task ${task}, parked on Q1 — it waits on the person's answer, and no builder goes to it until then`]]);

    answered(ASKS, task);
    loop.brief(['builder', WU, task]);
    builtAgain(task, tree);
  });

  it('12.13.7, 24.2.2: across a /clear while the fix task is parked, the entry names the question and the task parked; the review phase carries on in its skill, the stop drawn, the answer freeing the task, and a new builder builds it', async () => {
    const task = failedRound();
    await parkedFix(task);
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    sim.handOver();

    const { move, data } = reviewNext(sim, WU);
    assert.deepStrictEqual([move, data.waiting, data['in flight']], ['fixes', [`Q1 — ${ASKS} — parks task ${task}`], [`task ${task}, parked on Q1 — it waits on the person's answer, and no builder goes to it until then`]]);
    assert.strictEqual(carryOn(sim).skill, path.join(sim.dir, '.claude/skills/leeway-review-process/SKILL.md'), 'a compaction there carries on in the review phase\'s skill');

    answered(ASKS, task);
    loop.brief(['builder', WU, task]);
    builtAgain(task, loop.isolated(task, `agent-${task}-second`));
  });

  it('12.13.22: a question raised in round 2, parking nothing, and the round passing: finish\'s checklist holds the unit open naming it and the stop, its close refused, until the person answers; then finish goes through', async () => {
    const task = failedRound();
    const tree = builders.make(`agent-${task}`);
    taskBuilt(sim, WU, task, tree, { 'src/hash.js': 'export const hash = 1;\n' }, false);
    builders.remove(sim, tree);
    sim.run(['review', 'reads', WU, '1-the-work']);
    areaRead(sim, WU);
    const export_ = await raised(EXPORT);
    assert.strictEqual(export_.line, `Q1 waits for you, parking no task: ${EXPORT} The build carries on.`);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]);

    const closing = reviewNext(sim, WU);
    assert.deepStrictEqual([closing.move, closing.data.waiting], ['closing', [`Q1 — ${EXPORT} — parks no task`]]);
    sim.write(`.leeway/${WU}/build/log.md`, '# The build\n\nPhase 1 built; the review fixed the hash on read in round 1 and passed in round 2.\n');
    for (const key of ['inbox-closed', 'build-log-closed']) sim.run(['checklist', 'done', 'finish', WU, key]);
    const held = JSON.parse(sim.read(['checklist', 'show', 'finish', WU])).items.find((/** @type {{key: string}} */ item) => item.key === 'questions-answered');
    assert.deepStrictEqual([held.state, held.way], ['open', `Q1, ${EXPORT} — the unit never finishes over a question waiting on the person: stop for them, render build-stop ${WU}, and take each once they are ready to discuss it`]);
    sim.refuses(['checklist', 'close', 'finish', WU], /questions-answered/);
    sim.refuses(['render', 'finish', WU], new RegExp(`finish is open — its items are worked, then it is closed: checklist close finish ${WU}$`));

    answered(EXPORT);
    assert.deepStrictEqual(finished(sim, WU).next, { kind: 'handoff', skill: 'leeway', args: [] });
    handoff(sim, '/leeway');
    assert.strictEqual(sim.manifest(WU).status, 'completed', 'the unit finishes once nothing waits on the person');
  });
});
