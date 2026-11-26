'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build on a unit's own branch, as the build's and
// the review phase's skills run it: an epic in auto, its cut two phases,
// its first phase start's close making `feat/{unit}` (7.2.34); each phase
// built, reviewed, its stack merged onto that branch and closed, the
// default branch untouched by it — the default branch moving on between
// the phases, the second phase's start bringing it into the unit's branch
// by a merge commit (7.2.36); the review's readers briefed on the entry's
// base, the default branch, its round passing; and finish's yes landing
// the branch on the default branch by one merge commit described by its
// phases, the unit completed (7.2.38, 7.S33).
//
// Layer: simulation. World: the named world `worlds.twoPhaseEpic`, built
// once per run (pipeline-world.cjs, `twoPhaseEpic`), a copy per scenario,
// which replays the engine calls the build's and the review phase's prose
// make, in order, the oracle (pipeline-oracle.cjs) auditing the whole state
// after every mutation — among it, that the default branch holds none of
// the unit's work until it completes, and its merge at most once.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { git, createFile } = require('./engine-harness.cjs');
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, PASSED_REPORT, firstPhaseBuilt, writePhaseTasks, startPhase, builders, taskBuilt, landed, placeIn, sectionRead, testsRead, reviewNext,
  finishClosed, answerGate,
} = require('./pipeline-world.cjs');

const WU = SPEC_TO_BUILD_UNIT;
const BRANCH = `feat/${WU}`;

describe('pipeline simulation: the build on a unit\'s own branch', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.twoPhaseEpic);
  });
  afterEach(() => {
    sim.destroy();
  });

  /** Where the default branch stands. */
  const mainTip = () => git(sim.dir, ['rev-parse', 'main']).trim();

  it('7.2.34, 7.2.36, 7.2.38, 7.S33: the epic\'s first phase start makes its own branch, each phase\'s stack merges onto it, the default branch untouched, a later start bringing the default branch in; reviewed against the default branch, finish\'s yes lands it there by one merge commit described by its phases', () => {
    firstPhaseBuilt(sim, WU, 'Settling', 'Settle an entry', 'src/settle.js');
    createFile(sim.dir, 'NOTES.md', 'notes\n');
    git(sim.dir, ['add', 'NOTES.md']);
    git(sim.dir, ['commit', '-q', '-m', 'Write the notes']);
    const main = mainTip();
    writePhaseTasks(sim, WU, 2, 'Showing', [{ title: 'Show an entry', scenarios: ['1.S2'] }]);
    startPhase(sim, WU, 2);
    const tree = builders.make('agent-2');
    taskBuilt(sim, WU, '2.1', tree, { 'src/show.js': 'export const show = 1;\n' }, false, { accounted: () => sim.runIn(tree, ['verify', 'run', WU, '1.S2']) });
    builders.remove(sim, tree);
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', WU, '2', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
    sim.run(['land', 'phase', WU, '2']);
    sim.run(['checklist', 'close', 'phase-close', WU, '2']);
    const built = { branch: sim.manifest(WU).build.branch, main: mainTip() === main, landed: git(sim.dir, ['log', '--first-parent', '--format=%s', `main..${BRANCH}`]).trim().split('\n') };

    const { move, data } = reviewNext(sim, WU);
    const base = data.base[0].split(' ')[0];
    sectionRead(sim, WU, PASSED_REPORT, 1, base);
    testsRead(sim, WU, PASSED_REPORT, base);
    const round = sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, { can_now: ['Settle and show an entry.'], findings: [] })]).ends;
    const closing = reviewNext(sim, WU).move;
    finishClosed(sim, WU);
    sim.render(['finish', WU], { expect: 'content' });
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual({
      built, review: [move, base, round, closing], landed: yes.landed,
      line: git(sim.dir, ['log', '--first-parent', '--format=%B%x1e', `${main}..main`]).split('\x1e').map((message) => message.trim()).filter(Boolean),
      status: sim.manifest(WU).status,
    }, {
      built: { branch: BRANCH, main: true, landed: [`feat(${WU}): Show an entry`, `Merge main into ${BRANCH}`, `feat(${WU}): Settle an entry`] },
      review: ['round', 'main', true, 'closing'],
      landed: [{ repo: '.', into: 'main', landed: BRANCH, commit: mainTip() }],
      line: [`Merge ${BRANCH}\n\nPhase 1: Settling\nPhase 2: Showing`],
      status: 'completed',
    });
  });
});
