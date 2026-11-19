'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review by judgment in the build (13.3.4), as the
// task loop's prose runs it: each task's reviewers chosen with why before
// its first round, `task review`. A task read by one reviewer — its round
// one report, reviewer b refused, its account summarising that round; a
// task read by none — its builder's brief asking no account, every reviewer
// refused and the account with them, its landing summary saying why none
// read it; and a one-line task, the orchestrator's own work — created from
// its title and type, reviewed by none, no builder briefed for it, built in
// a worktree the orchestrator lays out and committed through the door —
// each landed into the phase's stack and done, the phase's close reading
// every task passed.
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
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, buildLoop, briefOf, placeIn, landed, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const WU = SPEC_TO_BUILD_UNIT;

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
    const tree = loop.isolated('1.1');
    loop.committed(tree, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(tree, builder, '1.S1');
    sim.refuses(['brief', 'reviewer', WU, '1.1', '--letter', 'b'], /task 1\.1 of ledgerly is read by reviewer a alone, as recorded — brief that one, never reviewer b/);
    landed(placeIn(sim, loop.brief(['reviewer', WU, '1.1', '--letter', 'a']), 'Where your report goes'), PASSED_REPORT);
    loop.accounted('1.1', ['Passed.']);
    loop.landedTask('1.1');

    reviewedBy('1.2', '0', 'A one-line check beside the code it guards.');
    sim.run(['task', 'start', WU, '1.2']);
    const unread = loop.brief(['builder', WU, '1.2']);
    assert.match(briefOf(sim, unread), /None: the orchestrator recorded that no reviewer reads the task — A one-line check beside the code it guards\. — and that record is its account\. Write no account; once the task is built, report \*\*built\*\*\./);
    loop.committed(loop.isolated('1.2'), '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
    sim.refuses(['brief', 'reviewer', WU, '1.2', '--letter', 'a'], /task 1\.2 of ledgerly is reviewed by none, as recorded — A one-line check beside the code it guards\.: no reviewer reads it/);
    sim.refuses(['task', 'account', WU, '1.2'], /^task account: task 1\.2 of ledgerly is reviewed by none, as recorded — .*: that record is its account, so it lands with none taken$/);
    assert.match(sim.render(['task-landed', WU, '1.2'], { expect: 'content' }), /✓ Landed — no reviewer read it, as recorded: A one-line check\n {2}beside the code it guards\./);
    loop.landedTask('1.2');

    assert.strictEqual(sim.run(['task', 'create', WU, '1', '--title', 'Bold the entry\'s title', '--type', 'chore']).task, '1.3');
    reviewedBy('1.3', '0', 'A word bolded.');
    sim.run(['task', 'start', WU, '1.3']);
    sim.refuses(['brief', 'builder', WU, '1.3'], /task 1\.3 of ledgerly is a one-line task, the orchestrator's own work with no builder/);
    loop.committed(loop.isolated('1.3', 'orchestrator-1.3'), '1.3', { 'src/show.css': '.title { font-weight: bold; }\n' }, `chore(${WU}): bold the entry's title`);
    loop.landedTask('1.3');

    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '1'])).items;
    assert.strictEqual(items.find((/** @type {{key: string}} */ item) => item.key === 'tasks-passed').state, 'done', 'every task passed its review, or was reviewed by none');
  });
});
