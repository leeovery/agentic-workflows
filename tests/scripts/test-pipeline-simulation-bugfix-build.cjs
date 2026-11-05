'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of a bugfix's build, its bug proven
// before it is fixed (15.5): a bugfix through its investigation and its
// spec, cut into one phase, to ready to build's pick; the phase opening on
// the test that reproduces the bug, task 1.1, its series run on the unfixed
// code once its account is taken, before it lands, then the fix linked
// after it, which the door takes; the phase merged, every landing squashing
// it; and the review phase, whose round 1 is recorded once the test has run
// on the unfixed code again, failing on a finding, its fix task, laid out on
// the branch phase 1 landed on, committing through the door, built on task
// 1.1's work by its landing. The investigation and the spec are
// test-pipeline-simulation-bugfix.cjs's; a later phase's task after phase 1
// lands, and what each verb answers and refuses, the verbs' own suites'.
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

/** The bugfix investigated, its spec of one area and one scenario landed and reviewed, cut into one phase, and ready to build's yes in auto taken into the build. @param {Sim} sim */
function bugfixToBuild(sim) {
  investigated(sim);
  specEntry(sim, WU, [WU]);
  sim.run(['brief', 'spec-writer', WU]);
  const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, WU])).decisions;
  sim.write(`.leeway/${WU}/spec.md`, [
    `# ${WU}`, '', '## 1. The work', '', '### 1.1 As decided', '', `1.1.1 ${WU} holds as decided. [${decision.id}]`, '',
    '## 1-S. Scenarios for §1', '', '1.S1 Given an empty basket, when the checkout runs, then it holds. (1.1.1)', '',
  ].join('\n'));
  sim.run(['spec', 'land', WU]);
  specReviewed(sim, WU);
  cutTheSpec(sim, WU, [{ name: 'The work', goal: 'The work holds.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
  readyToBuild(sim, WU);
  intoTheBuild(sim, WU, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));
}

/**
 * A task of the unit built in a worktree of its own through the task loop,
 * adding `files`, `accounted` run once its account is taken where given.
 * @param {Sim} sim @param {string} task @param {Record<string, string>} files @param {boolean} setup @param {() => void} [accounted]
 */
function builtAlone(sim, task, files, setup, accounted) {
  const tree = builders.make(`agent-${task}`);
  taskBuilt(sim, WU, task, tree, files, setup, { accounted });
  builders.remove(sim, tree);
}

describe('pipeline simulation: a bugfix\'s build', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the bug proven, then fixed: task 1.1 the test that reproduces it, its series run on the unfixed code once its account is taken, the fix through the door; phase 1 merged by squash → round 1 of the review recorded once the test has run on the unfixed code again, failing on a finding, its fix task through the door, built on task 1.1\'s landing', () => {
    bugfixToBuild(sim);
    buildEntry(sim, WU);
    sim.run(['brief', 'task-writer', WU, '1']);
    writePhaseTasks(sim, WU, 1, 'The work', [
      { title: 'Reproduce the crash', type: 'test', scenarios: ['1.S1'] },
      { title: 'Fix the crash', type: 'fix', after: ['1.1'], scenarios: ['The work holds once the crash is fixed.'] },
    ]);
    startPhase(sim, WU, 1);
    builtAlone(sim, '1.1', { 'test/crash.sh': 'test -f src/fix.js\n' }, false, () => sim.run(['verify', 'run', WU, '1.S1', '--unfixed', '--test', TEST]));
    builtAlone(sim, '1.2', { ...VERIFY_FILES, 'src/fix.js': 'export const fix = 1;\n' }, true);
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', WU, '1', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
    sim.run(['land', 'phase', WU, '1']);
    sim.run(['checklist', 'close', 'phase-close', WU, '1']);

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
