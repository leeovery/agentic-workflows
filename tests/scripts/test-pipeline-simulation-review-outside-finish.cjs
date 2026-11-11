'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's finish held open over a task written beyond
// the review's findings, as the review phase's skill runs it: a feature
// whose build has closed its cut, in auto, round 1 passing on a nit, its
// fix task's builder finding a wrong result its task does not hold, which
// lands as a task of the fix phase through the first door outside the plan
// (outside-the-plan.md). Across a /clear the review still waits on it and
// finish's checklist holds open over it; once it is built, finish lands it
// (14.5, 24.2.2). The failing round's wait on it is
// test-pipeline-simulation-review-outside.cjs's.
//
// Layer: simulation. World: the named world `worlds.cutClosed`, built once
// per run (pipeline-world.cjs) — a feature through its spec to ready to
// build's pick, its cut one phase, built and closed — a copy per scenario,
// which replays the engine calls the review phase's skill makes, in order,
// the oracle (pipeline-oracle.cjs) auditing the whole state after every
// mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worlds, writePhaseTasks, writeTasks, builtAside, areaRead, testsRead, reviewNext, finished,
} = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNSALTED = '## Findings\n\n- nit: the hash is never salted\n  Scenario: an entry hashed\n\nVerdict: pass\n';

describe('pipeline simulation: finish held over a task beyond the review\'s findings', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  /** The wrong result a fix task's builder finds beyond its task, written as a task of the fix phase of `fix`: the task. @param {string} fix */
  const beyond = (fix) => writeTasks(sim, WU, Number(fix.split('.')[0]), [{ title: 'Check the hash on write', type: 'fix', scenarios: ['an entry written'], reference: '§1' }])[0];

  it('14.5, 24.2.2: round 1 passing on a nit, the task beyond its fix waits across a /clear and holds finish open; built, finish lands it', () => {
    const { fixPhase: phase } = reviewNext(sim, WU);
    areaRead(sim, WU, UNSALTED);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Salt the hash', type: 'fix', scenarios: ['an entry hashed'], reference: '§1' }]);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger.'],
      findings: [{ area: '1-the-work', scope: 'in', call: 'nit', text: 'The hash is never salted.', from: ['1-the-work-a#1'], fix: `${phase}.1` }],
    })]);
    const other = beyond(`${phase}.1`);
    builtAside(sim, WU, `${phase}.1`, 'src/salt.js');
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    sim.handOver();

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes', 'after the /clear the review still waits on it');
    sim.write(`.leeway/${WU}/build/log.md`, '# The build\n\nPhase 1 built; the review passed in round 1 on a nit.\n');
    sim.run(['checklist', 'done', 'finish', WU, 'build-log-closed']);
    sim.refuses(['checklist', 'close', 'finish', WU], null);

    builtAside(sim, WU, other, 'src/write.js');
    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    finished(sim, WU);
    assert.strictEqual(git(sim.dir, ['cat-file', '-t', 'main:src/write.js']).trim(), 'blob', 'finish lands the task beyond the findings');
  });
});
