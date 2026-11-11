'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build across /clears, as its skill's prose runs
// it: one task of a feature's one phase in auto, the build entered afresh
// after each /clear, the task's line in flight naming where it goes. A
// /clear mid-fix: a new builder sent its brief, then the fix brief, round 2
// reading the fix. A /clear while the pair reads round 2: the pair briefed
// again for it and never the builder, a report that does not read going
// back to its reviewer; the round failing, the fix brief refused with no
// builder briefed in this conversation, so a new builder goes with its
// brief first, then the fix brief, and round 3 reads the fix. A /clear
// between round 3's pass and its account: the entry naming the round's
// reports, read for their notes for later and nits, and the worktree that
// has the task's branch out, the nit fixed and committed through the door
// there, then a new builder sent its brief for the account and the account
// taken. A /clear once it is taken: the entry, and the reviewer's refusal,
// naming its landing, and the task landed (24.2.4, 12.1.4, 13.4.5, 12.14).
//
// Layer: simulation. World: this file's own, built once on the named world
// `worlds.specToBuild`, itself built once per run (pipeline-world.cjs) — a
// feature through its spec to ready to build's pick in auto — its one phase
// written and started; a copy per scenario, which replays the engine calls
// the build's prose makes, in order, the oracle (pipeline-oracle.cjs)
// auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, worlds, SPEC_TO_BUILD_UNIT, buildEntry, startPhase, writeTasks, briefOf, landed, placeIn, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const WU = SPEC_TO_BUILD_UNIT;
const BUG = '## Findings\n\n- bug: an empty ledger writes no header\n  Scenario: a first entry settled\n\nVerdict: fail\n';
const NIT = '## Findings\n\n- nit: a comment names the phase\n  Scenario: a reader of the code\n\nVerdict: pass\n';
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** A feature in auto, its one phase written and started. */
const writingWorld = worldFrom('pipeline-build-clear-', (sim) => {
  buildEntry(sim, WU);
  sim.run(['task', 'phase', WU, '1', '--title', 'Writing']);
  sim.run(['brief', 'task-writer', WU, '1']);
  writeTasks(sim, WU, 1, [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
  startPhase(sim, WU, 1);
}, worlds.specToBuild);

describe('pipeline simulation: the build across /clears', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(writingWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** A /clear: the conversation ends, SessionEnd sweeping its presence, and the build is entered afresh in a new one — the task's line in flight. */
  const clearedAndEntered = () => {
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    sim.handOver();
    assert.strictEqual(sim.run(['enter', 'implementation', WU]).entered, true);
    return sim.sections.split('\n').find((line) => line.startsWith('in flight: task 1.1'));
  };

  /** Reviewer `letter`'s report of the round under review written. @param {string} letter @param {string} report */
  const reviewed = (letter, report) => landed(placeIn(sim, loop.brief(['reviewer', WU, '1.1', '--letter', letter]), 'Where your report goes'), report);

  /** The reports of round `round` of task 1.1, as a line names them. @param {number} round */
  const reportsOf = (round) => ['a', 'b'].map((letter) => `\`${path.join(sim.dir, `.leeway/${WU}/build/tasks/1.1/round-${round}-${letter}.md`)}\``).join(' and ');

  it('24.2.4, 12.1.4, 13.4.5, 12.14: a /clear mid-fix, while the pair reads, between a pass and its account, and once it is taken — each line in flight naming where the task goes, a new builder briefed before any fix brief, a report that does not read back to its reviewer, the pass\'s nit fixed in the worktree the line names before the account, and the task landed', () => {
    sim.run(['task', 'start', WU, '1.1']);
    const builder = loop.brief(['builder', WU, '1.1']);
    const first = loop.isolated('1.1');
    loop.committed(first, '1.1', { ...VERIFY_FILES, 'src/ledger.js': 'export const ledger = 1;\n' }, 'feat(ledgerly): write the ledger');
    loop.setUp(first, builder, '1.S1');
    loop.pairRound('1.1', BUG);
    loop.brief(['fix', WU, '1.1']);

    // A /clear mid-fix: a new builder, its brief and then the fix brief.
    assert.strictEqual(clearedAndEntered(), 'in flight: task 1.1, no builder dispatched here — round 1 of its review failed — a new builder goes with its brief, then its fix brief, engine brief fix ledgerly 1.1');
    loop.brief(['builder', WU, '1.1']);
    const second = loop.isolated('1.1', 'agent-1.1-second');
    loop.brief(['fix', WU, '1.1']);
    loop.committed(second, '1.1', { 'src/ledger.js': '// Writes the header first.\nexport const ledger = 2;\n' }, 'fix(ledgerly): an empty ledger writes its header');
    const [fixed, branch] = [['rev-parse', 'HEAD'], ['symbolic-ref', '--short', 'HEAD']].map((args) => git(second, args).trim());
    const reading = ['a', 'b'].map((letter) => briefOf(sim, loop.brief(['reviewer', WU, '1.1', '--letter', letter])));
    assert.ok(reading.every((brief, at) => brief.includes(`round-2-${'ab'[at]}.md`) && brief.includes(branch)), 'round 2 is read on the task\'s branch');
    assert.strictEqual(git(sim.dir, ['rev-parse', branch]).trim(), fixed, 'the fix at its tip');

    // A /clear while the pair reads round 2: the pair is briefed again for
    // it, never the builder; a's report does not read and goes back to it;
    // the round fails, and with no builder briefed here a new one goes with
    // its brief before the fix brief.
    assert.strictEqual(clearedAndEntered(), 'in flight: task 1.1, no builder dispatched here — round 2 of its review is not reported whole — reviewer a is briefed again for it, reviewer b is briefed again for it: engine brief reviewer ledgerly 1.1 --letter <letter>; its builder goes afresh once the round is read');
    reviewed('a', 'Half a report.\n');
    reviewed('b', BUG);
    sim.refuses(['brief', 'fix', WU, '1.1'], /round-2-a\.md/);
    reviewed('a', BUG);
    sim.refuses(['brief', 'fix', WU, '1.1'], /^task 1\.1 of ledgerly has no builder briefed in this conversation, so none to send the round back to: send a new builder its brief first, engine brief builder ledgerly 1\.1/);
    loop.brief(['builder', WU, '1.1']);
    const third = loop.isolated('1.1', 'agent-1.1-third');
    loop.brief(['fix', WU, '1.1']);
    loop.committed(third, '1.1', { 'src/ledger.js': '// Writes the header first, once.\nexport const ledger = 3;\n' }, 'fix(ledgerly): the header written once');
    loop.pairRound('1.1', NIT, PASSED);

    // A /clear between round 3's pass and its account: its reports name the
    // nit, fixed and committed through the door in the worktree the line
    // names before a new builder goes for the account.
    const passedLine = clearedAndEntered();
    const named = /, and fix those in (\S+), where its branch is checked out;/.exec(passedLine ?? '')?.[1];
    assert.strictEqual(passedLine, `in flight: task 1.1, no builder dispatched here — round 3 of its review passed, its account not taken — read its reports, ${reportsOf(3)}, for their notes for later and the nits the task's commits do not yet fix, and fix those in ${third}, where its branch is checked out; then send its builder its brief for its account, engine brief builder ledgerly 1.1`);
    loop.committed(/** @type {string} */ (named), '1.1', { 'src/ledger.js': 'export const ledger = 3;\n' }, 'style(ledgerly): no comment names the phase');
    loop.accounted('1.1', ['An empty ledger wrote no header; the builder wrote it.', 'The header was written twice; the builder wrote it once.', 'Passed, its nit fixed.'], 'agent-1.1-fourth');

    // A /clear once its account is taken: the line, and a reviewer's
    // refusal, name its landing summary, then its landing, which the sim
    // follows in that order.
    assert.strictEqual(clearedAndEntered(), 'in flight: task 1.1, no builder dispatched here — round 3 of its review passed, its account taken — show its landing, render task-landed ledgerly 1.1, then land it, engine land open ledgerly 1.1');
    sim.refuses(['brief', 'reviewer', WU, '1.1', '--letter', 'a'], /^round 3 of task 1\.1 of ledgerly passed — its review is over: show its landing, render task-landed ledgerly 1\.1, then land it, engine land open ledgerly 1\.1$/);
    sim.render(['task-landed', WU, '1.1'], { expect: 'content' });
    sim.refuses(['render', 'step-gate', WU, '1.1'], /builds in auto, where no gate follows a task/);
    assert.deepStrictEqual(loop.landedTask('1.1')?.argv, ['verify', 'mutants', WU, '1']);
  });
});
