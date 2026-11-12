'use strict';

// ---------------------------------------------------------------------------
// Where a reviewer's report goes (leeway-engine/scripts/domain/
// brief-records.cjs, round-report.cjs; 13.5.9): a task's reviewer's file of
// the round under review, read from the reports on disk so it holds across
// a `/clear`, a report that does not read replaced, refused once written or
// once the review passed or was settled — a settled round followed by
// another only once something changed and its builder built it — naming
// the way on by how far the task stands towards landing: while the account
// is owed, the builder's brief laying out a worktree and the round's
// reports to read for their notes for later and nits; once written, its
// taking; once taken, its landing; the range from where the task was built
// on (12.7.10, 13.2.2); and a phase's reviewer's file beside its
// consolidation, each by the reviewer's letter.
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { accountTaken } = require('./engine-harness.cjs');
const {
  UNIT,
  branchOf,
  commitFile,
  tipOf,
  withoutMutationTool,
  useWorld,
  issued,
  refusedUnissued,
  pathDrawn,
  rangeDrawn,
  ok,
  writeState,
  git,
  conversationDir,
  REPORT,
  PASSED,
  reviewing,
  placeIn,
  reported,
  over,
  reviewerRefused,
  briefedFor,
  added,
} = require('./brief-build-world.cjs');

const { recordLaidOut } = require('../../skills/leeway-engine/scripts/domain/round-report.cjs');

/** @type {string} */
let dir;

/** Why a report holding neither its findings' heading nor a verdict does not read, as round-report.cjs says it. */
const NOT_READ = 'its last heading at level one or two is not `## Findings`; its last line is not `Verdict: pass` or `Verdict: fail`';

/** Task 1.2's account of its one round, as its builder writes it. */
const ACCOUNT = [
  '## What was done', 'A receipt follows every charge.', '## Where in the code', '- src/receipt.js', '## What the tests prove', '- A charge prints one receipt.',
  '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
].join('\n\n');

describe('where a reviewer\'s report goes (13.5.9)', () => {
  useWorld((at) => { dir = at; });

  it('each reviewer of a task\'s first round writes to its own file of round 1', () => {
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-1-a.md'));
    assert.strictEqual(placeIn(reviewing('b')), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
  });

  it('12.7.10, 13.2.2: with no base named, the task\'s range starts where it was built on — the tip of its unit\'s work not landed below it that its branch holds, task 1.1\'s chained under it — never the branch the project lands on', () => {
    const { brief } = issued(['reviewer', UNIT, '1.2', '--letter', 'a']);

    const range = rangeDrawn('the project\'s repository', branchOf(1, 2), ['src/receipt.js']).replace('`main...', `\`${branchOf(1, 1)}...`);
    assert.ok(brief.includes(`# The diff's range\n\n${range}\n\n# Laying out your scratch worktree\n\n`), brief);
  });

  it('12.7.10: the range starts at the commit the task was laid out at where the work below it moved on since — a nit fixed on 1.1\'s branch after 1.2 was laid out on it — never the branch the project lands on', () => {
    const laid = tipOf(dir, branchOf(1, 1));
    recordLaidOut(dir, { unit: UNIT, phase: 1, n: 2 }, { '': laid });
    git(dir, ['checkout', '-q', branchOf(1, 1)]);
    commitFile(dir, 'src/card-nit.js', `${UNIT}-1-1`);
    git(dir, ['checkout', '-q', 'main']);

    const { brief } = issued(['reviewer', UNIT, '1.2', '--letter', 'a']);

    const range = rangeDrawn('the project\'s repository', branchOf(1, 2), ['src/receipt.js']).replace('`main...', `\`${laid.slice(0, 7)}...`);
    assert.ok(brief.includes(`# The diff's range\n\n${range}\n\n# Laying out your scratch worktree\n\n`), brief);
  });

  it('the round is read from the reports on disk: the round one reviewer has reported holds for the other after a /clear, and a round both reported is followed by the next', () => {
    reported(1, 'a');
    const cleared = 'brief-build-after-clear';
    try {
      assert.strictEqual(placeIn(reviewing('b', cleared), cleared), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
    } finally {
      fs.rmSync(conversationDir(cleared), { recursive: true, force: true });
    }
    reported(1, 'b');
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
  });

  it('13.4.6, 13.4.8: a round the orchestrator settled ends the task\'s review as a pass does — a reviewer briefed after it refused with the review-over way; something added after it, built by its builder, and its pair is briefed for the round after', () => {
    briefedFor(1);
    reported(1, 'a');
    reported(1, 'b');
    writeState(dir, 'pay/build/tasks/1.2/round-1-settled.md', 'Settled.\n');
    reviewerRefused(over(1, 'was settled'));

    added('The receipt names the amount.');
    issued(['builder', UNIT, '1.2']);

    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
  });

  it('a report that does not read is replaced: its reviewer is briefed again for its round, the brief naming the file it replaces, and the other reviewer\'s round stands', () => {
    reported(1, 'a', 'Looks fine to me.\n');
    reported(1, 'b');

    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'b'], /^pay\/build\/tasks\/1\.2\/round-1-b\.md is written already — that reviewer's report of the round is in$/);
    assert.strictEqual(placeIn(reviewing('a')), `${pathDrawn('pay/build/tasks/1.2/round-1-a.md')} — the report there does not read as a reviewer's report — ${NOT_READ}; yours replaces it`);
  });

  it('refused: a letter none of the reviewers\', a report already written for its round that reads, and a task whose last round passed — naming the way on by how far it stands towards landing', () => {
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'c'], /^c is no reviewer's letter — the reviewers are a and b$/);
    reported(1, 'a');
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^pay\/build\/tasks\/1\.2\/round-1-a\.md is written already — that reviewer's report of the round is in$/);
    reported(1, 'b', PASSED);
    reported(1, 'a', PASSED);
    reviewerRefused(over(1));
    writeState(dir, 'pay/build/tasks/1.2.md', ACCOUNT);
    reviewerRefused('round 1 of task 1.2 of pay passed — its review is over: take it, engine task account pay 1.2');
    accountTaken(dir, UNIT, '1.2');
    reviewerRefused('round 1 of task 1.2 of pay passed — its review is over: show its landing, render task-landed pay 1.2, then land it, engine land open pay 1.2');
  });

  it('a phase\'s reviewer writes to its letter\'s file beside the consolidation, a report there that does not read named as the one it replaces, refused once one that reads is written', () => {
    withoutMutationTool();
    const phaseReview = ['phase-review', UNIT, '1', '--base', 'main', '--letter', 'b'];
    const first = 'brief-build-phase-review';
    const elsewhere = () => placeIn(ok(dir, ['brief', ...phaseReview], { env: { CLAUDE_CODE_SESSION_ID: first } }), first);
    try {
      assert.strictEqual(elsewhere(), pathDrawn('pay/build/phases/phase-1/review-b.md'));
      writeState(dir, 'pay/build/phases/phase-1/review-b.md', 'Half a report.\n');
      assert.strictEqual(elsewhere(), `${pathDrawn('pay/build/phases/phase-1/review-b.md')} — the report there does not read as a reviewer's report — ${NOT_READ}; yours replaces it`);
    } finally {
      fs.rmSync(conversationDir(first), { recursive: true, force: true });
    }
    writeState(dir, 'pay/build/phases/phase-1/review-b.md', REPORT);
    refusedUnissued(phaseReview, /^pay\/build\/phases\/phase-1\/review-b\.md is written already — that reviewer's report of the round is in$/);
  });
});
