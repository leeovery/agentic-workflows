'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review by judgment in the build (13.3.4), as the
// task loop's prose runs it: each builder's task read by the reviewers
// chosen for it with why before its builder is briefed, one or two, never
// none, `task review`. A task read by one reviewer — its round one report,
// reviewer b refused, its landing saying its reviewer passed it;
// and a one-line task, the orchestrator's own work, the person's addition
// to it unbuilt until a commit made since — created from its
// title and type, reviewed by none by its shape, no builder briefed for it
// and no question parking it, laid out by `task worktree` from the
// project's checkout in the engine's own layout, committed there through
// the door, its landing summary saying what changed by its files, and the
// layout taken apart as it is done — each landed into the phase's stack,
// the phase's close reading every task passed. And a task read by one
// reviewer whose builder's call went ahead on a blind question: held once
// its reviewer passes it, the person answering with the lean, it builds
// again as built and lands.
//
// Layer: simulation. World: the named world `worlds.buildBegun`, built once
// per run (pipeline-world.cjs) — a feature in auto, its one phase written
// and started — a copy per scenario, which replays the engine calls the
// build's prose makes, in order, the oracle (pipeline-oracle.cjs) auditing
// the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, buildLoop, briefOf, placeIn, landed, PASSED_REPORT, VERIFY_FILES, wentAheadBlind, pickedRow,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const WU = SPEC_TO_BUILD_UNIT;
const CALL = Object.freeze({ question: 'Should a show print the entry\'s id?', lean: 'A show prints the id.', other: 'A show hides the id.' });

describe('pipeline simulation: review by judgment in the build', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(worlds.buildBegun);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** Task `task`'s reviewers chosen, `count`, with why. @param {string} task @param {string} count @param {string} why */
  const reviewedBy = (task, count, why) => sim.run(['task', 'review', WU, task, '--reviewers', count, '--file', sim.write(`.ledger/.cache/${WU}/build/review.md`, `${why}\n`)]);

  /** Task 1.1 read by one reviewer, its builder's brief issued and its work laid out: the brief and the worktree. */
  function readByOne() {
    reviewedBy('1.1', '1', 'One reader covers a single screen.');
    sim.run(['task', 'start', WU, '1.1']);
    const brief = loop.brief(['builder', WU, '1.1']);
    return { brief, tree: loop.isolated('1.1') };
  }

  /** Task 1.1's round read by its one reviewer, passing. */
  const passedByOne = () => landed(placeIn(sim, loop.brief(['reviewer', WU, '1.1', '--letter', 'a']), 'Where your report goes'), PASSED_REPORT);

  it('13.3.4: a task read by one reviewer and a one-line task of the orchestrator\'s own, each landed and done, the phase\'s close reading every task passed', async () => {
    sim.refuses(['task', 'review', WU, '1.2', '--reviewers', '0', '--file', sim.write(`.ledger/.cache/${WU}/build/review.md`, 'Small.\n')], /0 is no count of reviewers — 1 to 2/);
    const { brief, tree } = readByOne();
    assert.match(briefOf(sim, brief), /\n# A failed review\n[\s\S]*\nWhere your reviewers disagree, or you reject a finding, decide against this brief and the design/);
    loop.committed(tree, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(tree, brief, '1.S1');
    sim.refuses(['brief', 'reviewer', WU, '1.1', '--letter', 'b'], /task 1\.1 of ledgerly is read by reviewer a alone, as recorded — brief that one, never reviewer b/);
    passedByOne();
    loop.accounted('1.1', ['Passed.']);
    assert.match(sim.render(['task-landed', WU, '1.1'], { expect: 'content' }), /✓ Landed — its reviewer passed it in round 1/);
    loop.landedTask('1.1');
    sim.run(['task', 'close', WU, '1.2', '--reason', 'Folded into 1.3.']);

    assert.strictEqual(sim.run(['task', 'create', WU, '1', '--title', 'Bold the entry\'s title', '--type', 'chore']).task, '1.3');
    sim.refuses(['task', 'review', WU, '1.3', '--reviewers', '1', '--file', sim.write(`.ledger/.cache/${WU}/build/review.md`, 'A word bolded.\n')], /a one-line task, reviewed by none by its shape/);
    sim.run(['task', 'start', WU, '1.3']);
    sim.refuses(['brief', 'builder', WU, '1.3'], /task 1\.3 of ledgerly is a one-line task, the orchestrator's own work with no builder/);
    const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, WU])).decisions;
    const proposal = JSON.stringify({ ...leaningCall('The title is bold.', 'The title is plain.'), question: 'Should the title be bold?' });
    await sim.refusesAsync(['raise', `${WU}.implementation`, '--replaces', decision.id, '--reason', 'was-wrong', '--parks', '1.3'], /--parks names task 1\.3 of ledgerly, a one-line task, your own work — raise it with no --parks, parking nothing/, null, proposal);
    const own = sim.run(['task', 'worktree', WU, '1.3']).worktree;
    assert.strictEqual(own, fs.realpathSync(`${sim.dir}/.claude/worktrees/ledger-${WU}-1.3`));
    loop.committed(own, '1.3', { 'src/show.css': '.title { font-weight: bold; }\n' }, `chore(${WU}): bold the entry's title`);
    sim.run(['task', 'add', WU, '1.3', '--file', sim.write(`.ledger/.cache/${WU}/build/addition.md`, 'Bold it in red.\n'), '--by', 'person']);
    sim.refuses(['land', 'open', WU, '1.3'], /task 1\.3 of ledgerly is not built — a one-line task goes on once its branch holds a commit of its own made through the door since anything added to it/);
    loop.committed(own, '1.3', { 'src/show.css': '.title { font-weight: bold; color: red; }\n' }, `chore(${WU}): bold the entry's title in red`);
    const summary = sim.render(['task-landed', WU, '1.3'], { expect: 'content' });
    assert.match(summary, /\n✓ Landed — no reviewer read it: a one-line task, the\n {2}orchestrator's own work · no calls went to the ledger\n\nWHAT CHANGED\n {2}1 file changed · \+1 −0\n/);
    assert.doesNotMatch(summary, /ITS TESTS PROVE|Bold the entry's title works/);
    loop.landedTask('1.3');
    assert.ok(!fs.existsSync(own), 'its layout taken apart as it is done');

    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '1'])).items;
    assert.strictEqual(items.find((/** @type {{key: string}} */ item) => item.key === 'tasks-passed').state, 'done', 'every task passed its reviewers, or was a one-line task built');
  });

  it('13.3.4, 16.17.6: a task read by one reviewer whose builder\'s call went ahead on a blind question is held once its reviewer passes it; answered with the lean, it builds again as built and lands', async (t) => {
    const { brief, tree } = readByOne();
    await wentAheadBlind(t, sim, WU, '1.1', CALL);
    loop.committed(tree, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(tree, brief, '1.S1');
    passedByOne();
    sim.refuses(['task', 'account', WU, '1.1'], new RegExp(`task 1\\.1 of ${WU} waits on Q1, parked for the person`));

    assert.strictEqual(pickedRow(sim, WU, 'Q1', CALL.lean), 'Q1 answered · task 1.1 builds again as built · nothing waiting on you');
    loop.brief(['builder', WU, '1.1']);
    loop.accounted('1.1', ['Passed.']);
    assert.match(sim.render(['task-landed', WU, '1.1'], { expect: 'content' }), /✓ Landed — its reviewer passed it in round 1/);
    loop.landedTask('1.1');
    assert.strictEqual(sim.run(['task', 'show', WU, '1.1']).status, 'done');
  });
});
