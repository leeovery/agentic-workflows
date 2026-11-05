'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of a bugfix's build, its bug proven
// before it is fixed (15.5): a bugfix through its investigation and its
// spec, cut into two phases, to ready to build's pick; phase 1 opening on
// the test that reproduces the bug, task 1.1, its series run on the unfixed
// code before the task is done, then the fix linked after it, which the
// door takes; phase 1 merged, every landing squashing it, and phase 2's
// task, laid out on the branch it lands on, committing through the door,
// built on task 1.1's work by its landing; and the review phase, whose round
// 1 is recorded once the test has run on the unfixed code again, failing on
// a finding, its fix task, laid out there too, committing through the door.
// The investigation and the spec are test-pipeline-simulation-bugfix.cjs's;
// what each verb answers and refuses, its own suite's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle (pipeline-oracle.cjs)
// audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, startUnit, handoffEntry, handoff, startNew, specEntry, specReviewed, cutTheSpec, readyToBuild, answerGate, intoTheBuild, buildEntry, writePhaseTasks, startPhase,
  builders, taskBuilt, landed, placeIn, linearBuildPick, reviewNext, areaRead, testsRead, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');

/** @typedef {import('./pipeline-world.cjs').Sim} Sim */

const WU = 'crash-fix';

/** The test that reproduces the crash, run alone, failing until the fix lands its file. */
const TEST = 'sh test/crash.sh';

const SECOND_BASKET = '## Findings\n\n- bug: the crash returns on a second basket\n  Scenario: a second basket\n\nVerdict: fail\n';

/** A bugfix's investigation concluded on its root cause, the decision the spec cites written on its place (E9). @param {Sim} sim */
function investigated(sim) {
  startNew(sim, 'bugfix');
  startUnit(sim, 'bugfix', WU, 'Fix the crash');
  handoff(sim, `/leeway-investigation-process bugfix ${WU}`);
  handoffEntry(sim, WU, 'investigation', WU);
  sim.run(['topic', 'start', WU, 'investigation', WU]);
  sim.write(`.leeway/${WU}/investigation/${WU}.md`, `# Investigation — ${WU}\n`);
  const claude = { by: 'claude', who_moved_whom: 'none' };
  const asked = sim.run(['ledger', 'ask', `${WU}.investigation.${WU}`], null, JSON.stringify({ ...claude, text: 'What crashes the checkout?' }));
  sim.run(['ledger', 'decide', `${WU}.investigation.${WU}`, '--answers', asked.id], null, JSON.stringify({ ...claude, text: 'An empty basket crashes it.', why: 'The trace ends in its total.' }));
  sim.run(['commit', WU, '-m', `investigation(${WU}): root cause`, '--topic', `investigation/${WU}`]);
  sim.run(['topic', 'complete', WU, 'investigation', WU]);
}

/**
 * The bugfix investigated, its spec of one area with a scenario for each
 * phase landed and reviewed, cut into `phases` — the first holding 1.S1,
 * each later one 1.S{k} and relying on the one before — and ready to
 * build's yes in auto taken into the build.
 * @param {Sim} sim @param {string[]} phases each phase's name
 */
function bugfixToBuild(sim, phases) {
  investigated(sim);
  specEntry(sim, WU, [WU]);
  sim.run(['brief', 'spec-writer', WU]);
  const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, WU])).decisions;
  sim.write(`.leeway/${WU}/spec.md`, [
    `# ${WU}`, '', '## 1. The work', '', '### 1.1 As decided', '', `1.1.1 ${WU} holds as decided. [${decision.id}]`, '',
    '## 1-S. Scenarios for §1', '', ...phases.flatMap((name, at) => [`1.S${at + 1} Given the work, when ${name.toLowerCase()} runs, then it holds as decided. (1.1.1)`, '']),
  ].join('\n'));
  sim.run(['spec', 'land', WU]);
  specReviewed(sim, WU);
  cutTheSpec(sim, WU, phases.map((name, at) => ({ name, goal: `${name} holds.`, scenarios: [`1.S${at + 1}`], sections: ['1'], relies_on: at === 0 ? [] : [at] })));
  readyToBuild(sim, WU);
  intoTheBuild(sim, WU, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));
}

/**
 * A task of the unit built in a worktree of its own through the task loop,
 * adding `files`, `ending` run before its done where given.
 * @param {Sim} sim @param {string} task @param {Record<string, string>} files @param {boolean} setup @param {() => void} [ending]
 */
function builtAlone(sim, task, files, setup, ending) {
  const tree = builders.make(`agent-${task}`);
  taskBuilt(sim, WU, task, tree, files, setup, { ending });
  builders.remove(sim, tree);
}

/** A phase of the unit's reviewed, its pair passing, then merged and closed. @param {Sim} sim @param {number} phase */
function phaseMerged(sim, phase) {
  for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', WU, String(phase), '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
  sim.run(['land', 'phase', WU, String(phase)]);
  sim.run(['checklist', 'close', 'phase-close', WU, String(phase)]);
}

describe('pipeline simulation: a bugfix\'s build', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the bug proven, then fixed: task 1.1 the test that reproduces it, its series run on the unfixed code before it is done, the fix through the door; phase 1 merged by squash, phase 2\'s task through the door, built on task 1.1\'s landing → round 1 of the review recorded once the test has run on the unfixed code again, failing on a finding, its fix task through the door', () => {
    bugfixToBuild(sim, ['The work', 'The hardening']);
    buildEntry(sim, WU);
    sim.run(['brief', 'task-writer', WU, '1']);
    writePhaseTasks(sim, WU, 1, 'The work', [
      { title: 'Reproduce the crash', type: 'test', scenarios: ['1.S1'] },
      { title: 'Fix the crash', type: 'fix', after: ['1.1'], scenarios: ['The work holds once the crash is fixed.'] },
    ]);
    startPhase(sim, WU, 1);
    builtAlone(sim, '1.1', { 'test/crash.sh': 'test -f src/fix.js\n' }, false, () => sim.run(['verify', 'run', WU, '1.S1', '--unfixed', '--test', TEST]));
    builtAlone(sim, '1.2', { ...VERIFY_FILES, 'src/fix.js': 'export const fix = 1;\n' }, true);
    phaseMerged(sim, 1);

    sim.run(['brief', 'task-writer', WU, '2']);
    writePhaseTasks(sim, WU, 2, 'The hardening', [{ title: 'Harden the checkout', scenarios: ['1.S2'] }]);
    startPhase(sim, WU, 2);
    builtAlone(sim, '2.1', { 'src/hardened.js': 'export const hardened = 1;\n' }, false, () => sim.run(['verify', 'run', WU, '1.S2']));
    phaseMerged(sim, 2);

    linearBuildPick(sim, WU, 'review');
    const { move, fixPhase } = reviewNext(sim, WU);
    assert.strictEqual(move, 'round');
    areaRead(sim, WU, SECOND_BASKET);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, /** @type {number} */ (fixPhase), 'The review\'s fixes', [{ title: 'Hold a second basket', type: 'fix', scenarios: ['a second basket'] }]);
    const round = sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['The work holds.'],
      findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text: 'The crash returns on a second basket.', from: ['1-the-work-a#1'], fix: `${fixPhase}.1` }],
    });
    sim.refuses(['review', 'round', WU, '--file', round], null);
    sim.run(['verify', 'run', WU, '1.S1', '--unfixed', '--test', TEST]);
    sim.run(['review', 'round', WU, '--file', round]);
    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    builtAlone(sim, `${fixPhase}.1`, { 'src/second.js': 'export const second = 1;\n' }, false);
    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
  });
});
