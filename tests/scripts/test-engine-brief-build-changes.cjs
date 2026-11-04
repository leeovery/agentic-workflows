'use strict';

// ---------------------------------------------------------------------------
// A change to a task under review (leeway-engine/scripts/domain/
// round-report.cjs, brief-records.cjs; 12.1.4, 13.11.3, 6.5.10): something
// added to the task, or a call of it decided against its lean, marks the
// round its pair was briefed for, never covered by it — a passed round read
// again in the round after, the builder told to build what changed, its
// account and its chaining refused until then — and a change made during a
// round the builder's last brief did not go past refuses the fix brief
// until that brief goes again, the fix brief then holding the reports
// alone, each change counted.
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { refuses } = require('./engine-harness.cjs');
const {
  UNIT,
  SESSION_ID,
  useWorld,
  issued,
  pathDrawn,
  ok,
  statePath,
  writeState,
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
  BUILDING,
  builderBrief,
  notWhole,
  stillReading,
  changedAfter,
  fixOfRound1,
  ADDED,
  fixRefused,
} = require('./brief-build-world.cjs');

/** @type {string} */
let dir;

describe('a change to a task under review (12.1.4)', () => {
  useWorld((at) => { dir = at; });

  it('12.1.4, 13.11.3: something added before its pair is briefed is read by the round to come, marking nothing; a task its pair passed, something added to it before any account, is read again by its pair in the round after — its builder told to build what changed, never that it landed, its account and its chaining refused until that round passes; once it is reported, its review is over again', () => {
    added('The receipt is printed.');
    briefedFor(1);
    reported(1, 'a', PASSED);
    reported(1, 'b', PASSED);
    reviewerRefused(over(1));
    assert.ok(issued(['builder', UNIT, '1.2']).brief.includes('Your reviewers passed the task in round 1: it has landed, so write its account now.'));

    writeState(dir, 'pay/build/tasks/1.2/addition.md', 'The person answered: the receipt names the amount.\n');
    ok(dir, ['task', 'add', UNIT, '1.2', '--file', statePath(dir, 'pay/build/tasks/1.2/addition.md'), '--by', 'orchestrator']);
    const changed = 'task 1.2 of pay changed after round 1 passed — something was added to it, or a call of it decided against its lean — so its pair reads it again first: engine brief reviewer pay 1.2 --letter <letter>, each reviewer of round 2';
    const back = issued(['builder', UNIT, '1.2']).brief;
    assert.ok(back.includes('The task changed after your reviewers passed it in round 1 — something was added to it, or one of its calls decided against its lean: build what changed, and your reviewers read the task again before its account is written.'), back);
    assert.ok(!back.includes('it has landed'), back);
    assert.deepStrictEqual([refuses(dir, ['task', 'account', UNIT, '1.2']).error, refuses(dir, ['land', 'chain', UNIT, '1.2']).error], [`task account: ${changed}`, `land: ${changed}`]);
    const reread = 'brief-build-reread';
    try {
      assert.strictEqual(placeIn(reviewing('a', reread), reread), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
      reported(2, 'a', PASSED);
      assert.strictEqual(placeIn(reviewing('b', reread), reread), pathDrawn('pay/build/tasks/1.2/round-2-b.md'), 'the round one reviewer has reported holds for the other');
    } finally {
      fs.rmSync(conversationDir(reread), { recursive: true, force: true });
    }
    reported(2, 'b', PASSED);
    reviewerRefused(over(2));
    assert.ok(issued(['builder', UNIT, '1.2']).brief.includes('Your reviewers passed the task in round 2: it has landed, so write its account now.'));
  });

  it('12.1.4: something added while the pair reads round 1, one report in, is never covered by it — its builder waits for the reviewer this conversation briefed to report, then builds what changed, and round 2 reads it before its account', () => {
    briefedFor(1, BUILDING);
    reported(1, 'a', PASSED);
    added('The receipt names the amount.');
    const reading = builderBrief();
    reported(1, 'b', PASSED);
    const back = issued(['builder', UNIT, '1.2']).brief;

    assert.strictEqual(reading, notWhole(1, [stillReading('b')]));
    assert.ok(back.includes('The task changed after your reviewers passed it in round 1'), back);
    assert.ok(!back.includes('it has landed'), back);
    assert.deepStrictEqual([refuses(dir, ['task', 'account', UNIT, '1.2']).error, refuses(dir, ['land', 'chain', UNIT, '1.2']).error], [`task account: ${changedAfter(1)}`, `land: ${changedAfter(1)}`]);
    briefedFor(2);
    reported(2, 'a', PASSED);
    reported(2, 'b', PASSED);
    assert.ok(issued(['builder', UNIT, '1.2']).brief.includes('Your reviewers passed the task in round 2: it has landed, so write its account now.'));
  });

  it('12.1.4: something added while the pair reads round 2, after round 1 failed and before any report of it, marks round 2, which it is never covered by', () => {
    briefedFor(1);
    reported(1, 'a');
    reported(1, 'b', PASSED);
    briefedFor(2);
    added('The receipt names the amount.');
    reported(2, 'a', PASSED);
    reported(2, 'b', PASSED);

    assert.ok(issued(['builder', UNIT, '1.2']).brief.includes('The task changed after your reviewers passed it in round 2'));
    assert.strictEqual(refuses(dir, ['task', 'account', UNIT, '1.2']).error, `task account: ${changedAfter(2)}`);
  });

  it('N2 (6.5.10, 12.1.4): a round that fails while something is added during it — the fix brief refused until the builder\'s brief goes again past the change, carrying the task as it stands, then holding nothing but the round\'s reports; a second change, while round 2 is read, refuses round 2\'s fix brief until the builder\'s brief goes again', () => {
    issued(['builder', UNIT, '1.2']);
    briefedFor(1);
    added('The receipt names the amount.');
    reported(1, 'a');
    reported(1, 'b', PASSED);
    const refusal = fixRefused();
    const builder = issued(['builder', UNIT, '1.2']).brief;
    const { res, brief } = issued(['fix', UNIT, '1.2']);

    assert.strictEqual(refusal, 'task 1.2 of pay changed since its builder\'s last brief — something was added to it, or one of its calls decided against its lean: send its builder its brief again first, engine brief builder pay 1.2, which carries the task and its calls as they stand, then this fix brief');
    assert.ok(builder.includes(ADDED), builder);
    assert.strictEqual(brief, fixOfRound1(res.id));

    briefedFor(2);
    added('The receipt names the tax.');
    reported(2, 'a');
    reported(2, 'b', PASSED);

    const refused = fixRefused();
    issued(['builder', UNIT, '1.2']);

    assert.match(refused, /^task 1\.2 of pay changed since its builder's last brief — /);
    assert.ok(issued(['fix', UNIT, '1.2']).brief.includes('# Reviewer A\'s report'));
  });
});
