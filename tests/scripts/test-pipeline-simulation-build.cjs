'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build, as its skill's prose runs it: an epic in
// auto, its cut two phases, built by one orchestrator in one conversation,
// its first phase from the build's entry to its close and on into the
// second with no handoff at the phase boundary (12.S1, 24.S6). The phase
// written into the tracker, its task writer briefed and its task recorded,
// its start checklist closed; a bug the person reports mid-build, for a
// phase not yet written, held for that phase's writer through one door,
// the concluded spec never corrected (12.S19). The task built in its
// builder's worktree, made at the default branch and laid out by `task
// worktree`, the verify setup among it; its pair failing round 1 and the
// fix round going back to the same builder, round 2 passing on a nit the
// orchestrator fixes and commits in the task's worktree, under the task
// (12.S22); the builder's brief again saying the task has landed, its
// account taken, the landing summary shown and no gate after it in auto;
// its chain, the last of the phase, naming the phase's mutation run, which
// lays the phase out at its tips wherever it is run. The phase's review,
// its stack merged with no gate, the scratch worktree a phase reviewer died
// in taken apart as it merges, its close; then the second phase written
// in the same conversation, the bug held for it reaching its writer.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs, `twoPhaseEpic`), a copy
// per scenario, which replays the engine calls the build's prose makes, in
// order, the oracle (pipeline-oracle.cjs) auditing the whole state after
// every mutation. Two tasks side by side are test-pipeline-simulation-build-park.cjs's;
// a feature built in step test-pipeline-simulation-build-step.cjs's; a task
// across /clears test-pipeline-simulation-build-clear.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, twoPhaseEpic, buildEntry, startPhase, writeTasks, briefOf, deadReader, landed, placeIn, carryOn, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const WU = 'ledgerly';
const BUG = '## Findings\n\n- bug: an empty ledger writes no header\n  Scenario: a first entry settled\n\nVerdict: fail\n';
const NIT = '## Findings\n\n- nit: a comment names the phase\n  Scenario: a reader of the code\n\nVerdict: pass\n';
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

const epicWorld = worldFrom('pipeline-build-', (sim) => twoPhaseEpic(sim, WU));

describe('pipeline simulation: the build', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(epicWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  it('12.S1, 24.S6: an epic in auto, its first phase built by one orchestrator in one conversation — the fix round to the same builder, the nit committed under its task, the phase\'s mutation run named by its last task\'s chain — and on into its second phase with no handoff', () => {
    const handedOff = sim.handoffs.length;
    const entered = buildEntry(sim, WU);
    assert.deepStrictEqual(entered.filter((line) => line.startsWith('phase: ')), ['phase: phase 1 of 2, "Settling": not yet written', 'phase: phase 2 of 2, "Showing": not yet written']);
    for (const call of [['ledger', 'record', WU], ['ledger', 'affected', WU]]) sim.read(call);
    sim.write(`.leeway/${WU}/build/log.md`, '# The build\n\nPhase 1: its tasks are being written.\n');

    // Phase 1's start: written into the tracker, its tasks by the writer.
    sim.run(['task', 'phase', WU, '1', '--title', 'Settling']);
    loop.brief(['task-writer', WU, '1']);
    writeTasks(sim, WU, 1, [{ title: 'Settle an entry', scenarios: ['1.S1'] }]);
    startPhase(sim, WU, 1);

    // The person reports a bug mid-build, for the phase not yet written: one
    // door, its writer's, and the concluded spec is never corrected (12.S19).
    const spec = fs.readFileSync(path.join(sim.dir, `.leeway/${WU}/spec.md`), 'utf8');
    sim.run(['task', 'note', WU, '--phase', '2', '--file', sim.write(`.leeway/.cache/${WU}/build/note.md`, 'A shown entry never checks its hash.\n')]);
    sim.refuses(['spec', 'land', WU], /spec is concluded, and a concluded spec is never corrected/);

    // Task 1.1: its pair fails round 1, the fix round goes to the same
    // builder, and round 2 passes on a nit the orchestrator fixes and
    // commits in the task's worktree, under the task (12.S22).
    assert.deepStrictEqual(sim.run(['task', 'ready', WU]).tasks.map((/** @type {{task: string}} */ t) => t.task), ['1.1']);
    sim.run(['task', 'start', WU, '1.1']);
    sim.render(['build-headline', WU, '--file', sim.write(`.leeway/.cache/${WU}/build/headline.json`, { tasks: [{ task: '1.1', changes: 'An entry settles.', watch: 'The ledger.' }] })], { expect: 'content' });
    const builder = loop.brief(['builder', WU, '1.1']);
    const settling = loop.isolated('1.1');
    loop.committed(settling, '1.1', { ...VERIFY_FILES, 'src/settle.js': 'export const settle = 1;\n' }, 'feat(ledgerly): settle an entry');
    loop.setUp(settling, builder, '1.S1');
    loop.pairRound('1.1', BUG);
    loop.brief(['fix', WU, '1.1']);
    loop.committed(settling, '1.1', { 'src/settle.js': '// Phase 1 writes the header first.\nexport const settle = 2;\n' }, 'fix(ledgerly): an empty ledger writes its header');
    loop.pairRound('1.1', NIT);
    loop.committed(settling, '1.1', { 'src/settle.js': '// Writes the header first.\nexport const settle = 2;\n' }, 'fix(ledgerly): the comment says what the code does');
    assert.match(git(settling, ['log', '-1', '--format=%B']), /^Leeway-Task: ledgerly-1-1$/m, 'the nit lands in the task\'s commit, under the task');
    loop.accounted('1.1', ['An empty ledger wrote no header; the builder wrote it.', 'Passed, one nit fixed.']);
    sim.render(['task-landed', WU, '1.1'], { expect: 'content' });
    sim.refuses(['render', 'step-gate', WU, '1.1'], /builds in auto, where no gate follows a task/);
    assert.deepStrictEqual(loop.landedTask('1.1')?.argv, ['verify', 'mutants', WU, '1'], 'the phase\'s last task chained names its mutation run, which lays the phase out at its tips wherever it runs');

    // Phase 1's close: no note of its own to take, its review passing, its
    // stack merged with no gate in auto, the scratch worktree a dead phase
    // reviewer left taken apart as it merges (14.2.2).
    const notes = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '1'])).items.find((/** @type {{key: string}} */ item) => item.key === 'notes-consolidated');
    assert.strictEqual(notes.state, 'done', 'a note held for a later phase is not this phase\'s to take');
    const reviews = ['a', 'b'].map((letter) => loop.brief(['phase-review', WU, '1', '--letter', letter]));
    const deadReviewer = deadReader(sim, reviews[0]);
    for (const review of reviews) landed(placeIn(sim, review, 'Where your report goes'), PASSED);
    sim.refuses(['render', 'phase-merge-gate', WU, '1'], /a phase's stack merges with no gate/);
    sim.run(['land', 'phase', WU, '1']);
    assert.strictEqual(fs.existsSync(deadReviewer), false, 'the dead phase reviewer\'s scratch worktree taken apart as the phase merges');
    sim.run(['checklist', 'close', 'phase-close', WU, '1']);
    fs.appendFileSync(path.join(sim.dir, `.leeway/${WU}/build/log.md`), '\nPhase 1 closed.\n');

    // Phase 2 starts with no handoff: the same conversation, the same skill.
    assert.deepStrictEqual(sim.handoffs.slice(handedOff), [], 'no handoff at the phase boundary');
    assert.deepStrictEqual(carryOn(sim).position.phase, 'implementation');
    sim.run(['task', 'phase', WU, '2', '--title', 'Showing']);
    assert.ok(briefOf(sim, loop.brief(['task-writer', WU, '2'])).includes('A shown entry never checks its hash.'), 'the note held for the phase reaches its writer');
    assert.ok(fs.readFileSync(path.join(sim.dir, `.leeway/${WU}/spec.md`), 'utf8') === spec, 'the spec is as it concluded');
    assert.deepStrictEqual(Object.fromEntries([...loop.agents].map(([role, named]) => [role, [...named]])), {
      'task-writer': ['leeway-task-writer'], builder: ['leeway-builder'], reviewer: ['leeway-reviewer'], fix: ['leeway-builder'], 'phase-review': ['leeway-reviewer'],
    }, 'the agents run as defined');
  });
});
