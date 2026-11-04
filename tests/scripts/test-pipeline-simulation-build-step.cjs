'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build in step, as its skill's prose runs it: a
// feature whose one phase holds two ready tasks, run one at a time (12.S52)
// — the second refused its start while the first is in flight or at its
// gate. The first task's gate after its account: the person's Comment put
// onto the task as theirs before its builder goes back in, the task in
// progress again, its builder's brief saying it changed rather than that it
// landed, its account refused until its pair reads it again (12.1.4); a new
// account taken, and the gate again, answered yes. The second's builder
// made at the default branch, as Claude Code's isolation makes one, and
// laid out by `task worktree` on the first's work chained below it, so its
// branch opens on the chain with no merging back (12.7.10); its chain, the
// phase's last, naming the mutation run; then the phase's review, its stack
// merged at its gate in step, and the review phase entered.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick in step, its cut one phase — a copy per
// scenario, which replays the engine calls the build's prose makes, in
// order, the oracle (pipeline-oracle.cjs) auditing the whole state after
// every mutation. The build in auto is test-pipeline-simulation-build.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, startUnit, discussed, specToBuild, buildEntry, startPhase, writeTasks, briefOf, landed, placeIn, answerGate, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const WU = 'ledger';
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** A feature through its spec to ready to build's pick in step: its cut, one phase. */
const stepWorld = worldFrom('pipeline-build-step-', (sim) => {
  startUnit(sim, 'feature', WU, 'A ledger');
  discussed(sim, WU, WU);
  specToBuild(sim, WU, [WU], 's');
});

describe('pipeline simulation: the build in step', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(stepWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** The account of `rounds` taken, then the landing summary and the gate. @param {string} task @param {string[]} rounds */
  const atGate = (task, rounds) => {
    loop.accounted(task, rounds);
    sim.render(['task-landed', WU, task], { expect: 'content' });
    sim.render(['step-gate', WU, task], { expect: 'content' });
  };

  /** Yes at its gate, then into the phase's stack and done: the chain's `next`. @param {string} task */
  const approved = (task) => {
    assert.deepStrictEqual(answerGate(sim, 'step gate', '--pick', 'y').next, { kind: 'continue' });
    return loop.landedTask(task);
  };

  /** Where `task` stands, as the build's progress shows it when the person asks for the phases and tasks: its glyph. @param {string} task */
  const shown = (task) => new RegExp(`([○◐◌●✓⊘⚑]) ${task.replace('.', '\\.')} `).exec(sim.render(['build-progress', WU], { expect: 'content' }))?.[1];

  it('12.S52, 12.S27, 12.1.4: a feature in step — one task at a time, a Comment at the gate put onto the task before its builder goes back in, the task in progress and its account refused until its pair reads it again, the gate again; the next laid out on the chain; the phase merged at its gate', () => {
    buildEntry(sim, WU);
    sim.run(['task', 'phase', WU, '1', '--title', 'The work']);
    loop.brief(['task-writer', WU, '1']);
    writeTasks(sim, WU, 1, [{ title: 'Write the ledger', scenarios: ['1.S1'] }, { title: 'Read the ledger' }]);
    startPhase(sim, WU, 1);
    assert.deepStrictEqual(sim.run(['task', 'ready', WU]).tasks.map((/** @type {{task: string}} */ t) => t.task), ['1.1', '1.2']);
    sim.run(['task', 'start', WU, '1.1']);
    sim.refuses(['task', 'start', WU, '1.2'], /builds in step, one task at a time/);
    sim.render(['build-headline', WU, '--file', sim.write(`.leeway/.cache/${WU}/build/headline.json`, { tasks: [{ task: '1.1', changes: 'The ledger is written.', watch: 'An entry read back.' }] })], { expect: 'content' });

    const builder = loop.brief(['builder', WU, '1.1']);
    const writing = loop.isolated('1.1');
    loop.committed(writing, '1.1', { ...VERIFY_FILES, 'src/ledger.js': 'export const ledger = 1;\n' });
    loop.setUp(writing, builder, '1.S1');
    loop.pairRound('1.1');
    atGate('1.1', ['Passed.']);
    assert.strictEqual(shown('1.1'), '●', 'at its gate');

    // The person comments: their change goes onto the task as theirs, the
    // task stands in progress, and its account waits for its pair.
    answerGate(sim, 'step gate', '--typed', 'comment');
    sim.run(['task', 'add', WU, '1.1', '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, 'Entries keep the order they were written in.\n'), '--by', 'person']);
    assert.strictEqual(shown('1.1'), '◐', 'a change put onto the task after its account takes it off its gate, in progress');
    const back = briefOf(sim, loop.brief(['builder', WU, '1.1']));
    assert.ok(back.includes('## Added by the person\n\nEntries keep the order they were written in.'), 'the builder goes back in with the person\'s change on its task');
    assert.match(back, /The task changed after your reviewers passed it in round 1/);
    assert.doesNotMatch(back, /it has landed/);
    sim.refuses(['task', 'account', WU, '1.1'], /changed after round 1 passed/);
    loop.committed(writing, '1.1', { 'src/ledger.js': 'export const ledger = 2;\n' });
    loop.pairRound('1.1');
    atGate('1.1', ['Passed.', 'Passed, the order kept.']);
    assert.strictEqual(approved('1.1'), undefined, 'a chain with a task of its phase still to end names no mutation run');

    // The next task's builder starts at the default branch; its task is laid
    // out on 1.1's work chained below it, so it opens on the chain.
    assert.deepStrictEqual(sim.run(['task', 'ready', WU]).tasks.map((/** @type {{task: string}} */ t) => t.task), ['1.2']);
    sim.run(['task', 'start', WU, '1.2']);
    sim.render(['build-headline', WU, '--file', sim.write(`.leeway/.cache/${WU}/build/headline.json`, { tasks: [{ task: '1.2', changes: 'The ledger is read.', watch: 'An entry read back.' }] })], { expect: 'content' });
    loop.brief(['builder', WU, '1.2']);
    const reading = loop.isolated('1.2');
    assert.strictEqual(git(reading, ['rev-parse', 'HEAD']).trim(), git(sim.dir, ['rev-parse', taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Write the ledger')]).trim(), 'the task is laid out on the chain\'s tip');
    loop.committed(reading, '1.2', { 'src/read.js': 'export const read = 1;\n' });
    loop.pairRound('1.2');
    atGate('1.2', ['Passed.']);
    assert.deepStrictEqual(approved('1.2')?.argv, ['verify', 'mutants', WU, '1']);

    // The phase's review, then its stack merged at its gate in step.
    sim.read(['checklist', 'show', 'phase-close', WU, '1']);
    for (const letter of ['a', 'b']) landed(placeIn(sim, loop.brief(['phase-review', WU, '1', '--letter', letter]), 'Where your report goes'), PASSED);
    sim.render(['phase-merge-gate', WU, '1'], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
    sim.run(['checklist', 'close', 'phase-close', WU, '1']);
    assert.strictEqual(sim.run(['enter', 'review', WU]).entered, true, 'every phase merged, the review phase is entered');
  });
});
