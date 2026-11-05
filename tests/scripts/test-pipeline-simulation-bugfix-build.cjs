'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of a bugfix's build, its bug proven
// before it is fixed (15.5): a bugfix through its investigation and its
// spec to ready to build's pick; the build, its first phase opening on the
// test that reproduces the bug, task 1.1, the fix linked after it; that
// test's series run on the unfixed code, five failures, before the fix's
// commit, which the door takes, running the test as one of its checks; and
// the review phase, whose entry reads the series and whose round 1 waits on
// the test run on the unfixed code again, where it fails. The investigation
// and the spec are test-pipeline-simulation-bugfix.cjs's; what the door
// refuses, test-engine-commit-task-bugfix.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, startUnit, handoffEntry, handoff, startNew, specToBuild, buildEntry, writePhaseTasks, startPhase, builders, taskBuilt, briefOf,
  landed, placeIn, linearBuildPick, reviewNext, areaRead, testsRead, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const WU = 'crash-fix';

/** The test that reproduces the crash, run alone, failing until the fix lands its file. */
const TEST = 'sh test/crash.sh';
const CRASH_TEST = Object.freeze({ 'test/crash.sh': 'test -f src/fix.js\n' });

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

/** A task of the unit built in a worktree of its own, as the build's loop builds it, adding `files`. @param {Sim} sim @param {string} task @param {Record<string, string>} files @param {boolean} setup */
function builtAlone(sim, task, files, setup) {
  const tree = builders.make(`agent-${task}`);
  taskBuilt(sim, WU, task, tree, files, setup);
  builders.remove(sim, tree);
}

describe('pipeline simulation: a bugfix\'s build', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the bug proven, then fixed: task 1.1 the test that reproduces it, its series five failures on the unfixed code, the fix through the door running it → round 1 of the review on the test run on the unfixed code again', () => {
    investigated(sim);
    specToBuild(sim, WU, [WU], 'a');

    // The build: phase 1 opens on the test that reproduces the bug, task 1.1,
    // the fix linked after it (15.5.1).
    buildEntry(sim, WU);
    assert.match(briefOf(sim, sim.run(['brief', 'task-writer', WU, '1'])), /# The test that reproduces the bug\n\nThis phase opens on the test that reproduces the bug\. Record that task first, so it is task 1\.1\./);
    writePhaseTasks(sim, WU, 1, 'The work', [
      { title: 'Reproduce the crash', type: 'test', scenarios: ['1.S1'] },
      { title: 'Fix the crash', type: 'fix', after: ['1.1'], scenarios: ['The work holds once the crash is fixed.'] },
    ]);
    startPhase(sim, WU, 1);
    builtAlone(sim, '1.1', CRASH_TEST, false);

    // Its series on the unfixed code, five failures, before the fix lands;
    // the fix's commit then runs the test as one of the door's checks
    // (15.5.2–15.5.4).
    const series = sim.run(['verify', 'run', WU, '1.S1', '--unfixed', '--test', TEST]);
    assert.deepStrictEqual([series.runs.map(({ verdict }) => verdict), series.proven], [Array(5).fill('fail'), true]);
    builtAlone(sim, '1.2', { ...VERIFY_FILES, 'src/fix.js': 'export const fix = 1;\n' }, true);
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', WU, '1', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
    sim.run(['land', 'phase', WU, '1']);
    sim.run(['checklist', 'close', 'phase-close', WU, '1']);

    // The review phase reads the series, and round 1 waits on the test run on
    // the unfixed code again, where it fails (15.5.6).
    linearBuildPick(sim, WU, 'review');
    const { data } = reviewNext(sim, WU);
    assert.deepStrictEqual([data['unfixed run'].length, data.rerun], [5, [
      `not yet — round 1 is recorded once the test runs on the unfixed code again, where it must fail: \`node .claude/skills/leeway-engine/scripts/engine.cjs verify run ${WU} 1.S1 --unfixed --test '${TEST}'\``,
    ]]);
    areaRead(sim, WU);
    testsRead(sim, WU);
    const round = sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['The work holds.'], findings: [] });
    sim.refuses(['review', 'round', WU, '--file', round], /^review round: crash-fix is a bugfix, and round 1 is recorded once the test that reproduces its bug has run on the unfixed code again/);
    assert.strictEqual(sim.run(['verify', 'run', WU, '1.S1', '--unfixed', '--test', TEST]).proven, true);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', round]).passed, true);
    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
  });
});
