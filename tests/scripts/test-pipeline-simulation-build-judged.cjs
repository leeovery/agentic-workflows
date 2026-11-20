'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review by judgment in the build (13.3.4), as the
// task loop's prose runs it: each task's reviewers chosen with why before
// its first round, `task review`. A task read by one reviewer — its builder
// told to settle a finding it rejects with no second reviewer, its round
// one report, reviewer b refused, its landing saying its reviewer passed
// it; a task read by none — its builder's brief saying so in its task, with
// no account to write and no failed review to meet, every reviewer refused
// and the account with them, its landing summary saying why none read it;
// and a one-line task, the orchestrator's own work — created from its
// title and type, reviewed by none by its shape, no builder briefed for it,
// built in a worktree the orchestrator lays out off the project's checkout
// and committed through the door — each landed into the phase's stack and
// done, the phase's close reading every task passed. And a task no reviewer
// reads, built, then parked on a question while the task beside it lands
// past it: the answer sends its builder back in, its brief again going on
// with the task after the chain's merge, never straight to merged, and
// nothing lands or ends it until its branch holds work of its own since —
// the merge none of it.
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
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, buildLoop, briefOf, placeIn, landed, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/ledger-engine/scripts/domain/landing-names.cjs'));

const WU = SPEC_TO_BUILD_UNIT;
const UNREAD = 'No reviewer reads it, as the orchestrator recorded — A one-line check beside the code it guards. — so it owes no account: once it is built and committed through the door, report **built**.';

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

  it('13.3.4: a task read by one reviewer, one by none and a one-line task of the orchestrator\'s own, each landed and done, the phase\'s close reading every task passed', () => {
    reviewedBy('1.1', '1', 'One reader covers a single screen.');
    sim.run(['task', 'start', WU, '1.1']);
    const builder = loop.brief(['builder', WU, '1.1']);
    assert.match(briefOf(sim, builder), /\n# A failed review\n[\s\S]*\nWhere you reject a finding, decide against this brief and the design/);
    assert.doesNotMatch(briefOf(sim, builder), /two reviewers/);
    const tree = loop.isolated('1.1');
    loop.committed(tree, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(tree, builder, '1.S1');
    sim.refuses(['brief', 'reviewer', WU, '1.1', '--letter', 'b'], /task 1\.1 of ledgerly is read by reviewer a alone, as recorded — brief that one, never reviewer b/);
    landed(placeIn(sim, loop.brief(['reviewer', WU, '1.1', '--letter', 'a']), 'Where your report goes'), PASSED_REPORT);
    loop.accounted('1.1', ['Passed.']);
    assert.match(sim.render(['task-landed', WU, '1.1'], { expect: 'content' }), /✓ Landed — its reviewer passed it in round 1/);
    loop.landedTask('1.1');

    reviewedBy('1.2', '0', 'A one-line check beside the code it guards.');
    sim.run(['task', 'start', WU, '1.2']);
    const unread = briefOf(sim, loop.brief(['builder', WU, '1.2']));
    assert.ok(unread.includes(`\n## Its review\n\n${UNREAD}\n`), 'its task says no reviewer reads it');
    for (const left of ['# Where your account goes', '# A failed review', 'write its account']) assert.ok(!unread.includes(left), `${left}: left out`);
    const checking = loop.isolated('1.2');
    sim.refuses(['land', 'open', WU, '1.2'], /task 1\.2 of ledgerly is not built — no reviewer reads it/);
    loop.committed(checking, '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
    sim.refuses(['brief', 'reviewer', WU, '1.2', '--letter', 'a'], /task 1\.2 of ledgerly is reviewed by none, as recorded — A one-line check beside the code it guards\.: no reviewer reads it/);
    sim.refuses(['task', 'account', WU, '1.2'], /^task account: task 1\.2 of ledgerly is reviewed by none, as recorded — .*: that record is its account, so it lands with none taken$/);
    assert.match(sim.render(['task-landed', WU, '1.2'], { expect: 'content' }), /✓ Landed — no reviewer read it, as recorded: A one-line check\n {2}beside the code it guards\./);
    assert.match(sim.render(['task-account', WU, '1.2'], { expect: 'content' }), /\n {2}No reviewer read it, as recorded, and that record is its account: A one-line check beside the code it guards\.\n {2}1 file changed · \+1 −0\n/, 'its change shown as a reviewed task\'s is');
    sim.refuses(['task', 'done', WU, '1.2'], /^task done: task 1\.2 of ledgerly is not chained into its phase's stack — land it first/);
    loop.landedTask('1.2');

    assert.strictEqual(sim.run(['task', 'create', WU, '1', '--title', 'Bold the entry\'s title', '--type', 'chore']).task, '1.3');
    sim.refuses(['task', 'review', WU, '1.3', '--reviewers', '0', '--file', sim.write(`.ledger/.cache/${WU}/build/review.md`, 'A word bolded.\n')], /a one-line task, reviewed by none by its shape/);
    sim.run(['task', 'start', WU, '1.3']);
    sim.refuses(['brief', 'builder', WU, '1.3'], /task 1\.3 of ledgerly is a one-line task, the orchestrator's own work with no builder/);
    const own = path.join(sim.dir, `.claude/worktrees/ledger-${WU}-1.3`);
    git(sim.dir, ['worktree', 'add', '-q', '--detach', own]);
    sim.runIn(own, ['task', 'worktree', WU, '1.3']);
    loop.committed(own, '1.3', { 'src/show.css': '.title { font-weight: bold; }\n' }, `chore(${WU}): bold the entry's title`);
    assert.match(sim.render(['task-landed', WU, '1.3'], { expect: 'content' }), /\nWHAT CHANGED\n {2}Bold the entry's title\n/, 'a one-line task says what it does by its title');
    loop.landedTask('1.3');
    git(sim.dir, ['worktree', 'remove', own]);

    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '1'])).items;
    assert.strictEqual(items.find((/** @type {{key: string}} */ item) => item.key === 'tasks-passed').state, 'done', 'every task passed its review, or was recorded as reviewed by none');
  });

  it('13.3.4: a task no reviewer reads, built, parked on a question while the task beside it lands past it — the answer\'s brief goes on with the task after the merge, never straight to merged, and it lands only once its branch holds work of its own since', async () => {
    for (const task of ['1.1', '1.2']) sim.run(['task', 'start', WU, task]);
    reviewedBy('1.2', '0', 'A one-line check beside the code it guards.');
    const showingBrief = loop.brief(['builder', WU, '1.1']);
    const showing = loop.isolated('1.1');
    loop.brief(['builder', WU, '1.2']);
    const hashing = loop.isolated('1.2');
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 1;\n' });

    const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, WU])).decisions;
    const proposal = { ...leaningCall('A shown entry checks its hash.', 'A shown entry trusts the ledger.'), question: 'Should showing an entry check its hash?' };
    const parked = await sim.runAsync(['raise', `${WU}.implementation`, '--replaces', decision.id, '--reason', 'was-wrong', '--parks', '1.2'], null, JSON.stringify(proposal));
    assert.deepStrictEqual([parked.parked, parked.task], ['Q1', '1.2']);

    loop.committed(showing, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(showing, showingBrief, '1.S1');
    loop.pairRound('1.1');
    loop.accounted('1.1', ['Passed.']);
    loop.landedTask('1.1');

    const drawn = sim.run(['raise', 'draw', WU, 'Q1']);
    assert.strictEqual(sim.run(['raise', 'answer', drawn.raise, '--pick', '2'], null, JSON.stringify({ why: 'The ledger is trusted already.' })).receipt, 'Q1 answered · task 1.2 builds again · nothing waiting on you');
    sim.refuses(['land', 'open', WU, '1.2'], /task 1\.2 of ledgerly is not built — no reviewer reads it/);
    const again = briefOf(sim, loop.brief(['builder', WU, '1.2']));
    assert.match(again, /Your phase's chain has moved on past your branch\. Merge its tip back before anything else/);
    assert.match(again, /which finishes it\.\n\nThen go on with the task as the rest of this brief says\./, 'the merge, then the task built on the answer');
    assert.doesNotMatch(again, /report \*\*merged\*\*/);

    const tip = taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Show an entry');
    git(hashing, ['merge', '-q', '--no-ff', '--no-commit', tip]);
    sim.runIn(hashing, ['commit', '--paths', 'src/show.js', '--task', WU, '1.2', '-m', `merge(${WU}): the chain's tip back`]);
    sim.refuses(['land', 'open', WU, '1.2'], /task 1\.2 of ledgerly is not built/);
    sim.refuses(['task', 'done', WU, '1.2'], /task 1\.2 of ledgerly is not built/);
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 0;\n' });
    loop.landedTask('1.2');
  });
});
