'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix review: the close's review row asking
// for the review, its skill invoked in the same conversation, its one area
// the change, a round's fix task built on the quick-fix's one branch and
// passed by its pair, and the round passing handing back to the close,
// whose yes lands it all in one commit (19.S23).
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
  Sim, answerGate, startUnit, writeTasks, writePhaseTasks, finishClosed, fixBuilt, reviewNext, areaRead, testsRead,
} = require('./pipeline-world.cjs');
const { git } = require('./engine-harness.cjs');

describe('pipeline simulation: quick-fix review', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: the close\'s review row asks for the review, its skill invoked in the same conversation — its one area the change; a round\'s fix task built on the quick-fix\'s branch; the round passing hands back to the close, whose yes lands the fixes and the fix task in one commit (19.S23), no handoff on the way (24.S8)', () => {
    const wu = 'typo';
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    const handedOff = sim.handoffs.length;
    sim.run(['enter', 'implementation', wu]);
    const base = git(sim.dir, ['rev-parse', 'main']).trim();
    const [flag] = writeTasks(sim, wu, 1, [{ title: 'Spell the flag --colour', type: 'fix', reference: 'none', scenarios: ['1.S1 Given the flag, when it is passed, then it reads --colour.'] }]);
    sim.run(['task', 'start', wu, flag]);
    fixBuilt(sim, wu, flag, ['src/flag.js'], { record: 'The flag.' });
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const asked = sim.run(answerGate(sim, 'finish', '--pick', 'r').next.argv);
    assert.deepStrictEqual(asked.next, { kind: 'invoke', skill: 'leeway-review-process', args: ['quick-fix', wu] });
    sim.run(['enter', 'review', wu]);

    const first = reviewNext(sim, wu);
    areaRead(sim, wu, '## Findings\n\n- bug: the help still says --color\n  Scenario: the help read\n\nVerdict: fail\n');
    testsRead(sim, wu);
    const [fix] = writePhaseTasks(sim, wu, 2, 'The review\'s fixes', [{ title: 'Spell the help --colour', type: 'fix', reference: 'none', scenarios: ['Given the help, when it is read, then it names --colour.'] }]);
    const failed = sim.run(['review', 'round', wu, '--file', sim.write(`.leeway/.cache/${wu}/review/round.json`, {
      can_now: ['Pass --colour.'], findings: [{ area: '1-the-change', scope: 'in', call: 'bug', text: 'The help still says --color.', from: ['1-the-change-a#1'], fix }],
    })]);
    assert.strictEqual(reviewNext(sim, wu).move, 'fixes');
    sim.run(['task', 'start', wu, fix]);
    fixBuilt(sim, wu, fix, ['src/help.js']);
    sim.refuses(['render', 'finish', wu], /^render finish: typo finishes once its review phase is over — typo's review phase is in round 2 — enter review typo$/);
    assert.strictEqual(reviewNext(sim, wu).move, 'reads');
    sim.run(['review', 'reads', wu, '1-the-change', 'tests']);
    reviewNext(sim, wu);
    areaRead(sim, wu);
    testsRead(sim, wu);
    const passed = sim.run(['review', 'round', wu, '--file', sim.write(`.leeway/.cache/${wu}/review/round.json`, { can_now: ['Pass --colour, and read it in the help.'], findings: [] })]);
    sim.render(passed.next.argv.slice(1), { expect: 'content' });
    const unclosed = sim.handoffs.slice(handedOff);
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([first.data.area, first.fixPhase, fix, failed.fix_phase, passed.next], [
      [`1-the-change — the change: ${wu}'s record and its change-set from the base`], 2, '2.1', 2, { kind: 'engine', argv: ['render', 'finish', wu] },
    ]);
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), git(sim.dir, ['log', '--format=%s', `${base}..main`]).trim().split('\n')], [
      [['1.1', '2.1']], [`fix(${wu}): The --color flag is spelt --colour`],
    ]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.deepStrictEqual(unclosed, [], 'no handoff from the opener, through the review, to the close (24.S8)');
  });
});
