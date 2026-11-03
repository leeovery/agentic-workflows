'use strict';

// ---------------------------------------------------------------------------
// A build phase's start, as the engine checks it (leeway-engine/scripts/
// domain/phase-checks.cjs, through checklist.cjs): its tasks written — each
// phase scenario an acceptance scenario of exactly one task not closed
// (12.4.3, 12.S14); what it relies on done — an earlier phase closed and its
// stack merged, another unit completed (12.6.2, 12.6.3, 12.S13), a phase
// relying on nothing unfinished starting beside one in its review (12.7.5,
// 12.S17) — each worked out at each call (6.4.8). And `task start` refused
// before its phase's start checklist closes, a fix phase past the cut never
// (12.S7, P14). A phase's close is test-engine-build-checklists-close.cjs,
// its review's item and settlement -review.cjs.
//
// Layer: verb. World: the build checklists' world (build-checklists-world.cjs),
// built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refusedPristine, git, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, taskFile, world, checklistHelpers } = require('./build-checklists-world.cjs');

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

const { item, closed, landed } = checklistHelpers(() => dir);

describe('a phase\'s start: its tasks written, what it relies on done (6.4.8)', () => {
  it('reads its tasks written once each phase scenario is an acceptance scenario of exactly one task not closed — never for a phase the tracker lacks (12.4.3, 12.S14)', () => {
    const written = () => item('phase-start', 1, 'tasks-written');
    const seen = [written(), item('phase-start', 3, 'tasks-written')];
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Take a card again', ['1.S1'])]);
    seen.push(written());
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Folded into 1.1.']);
    seen.push(written());
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);

    assert.deepStrictEqual([...seen, written()], ['done', 'open', 'open', 'done', 'open']);
  });

  it('reads an earlier phase relied on as done once it is closed and its stack merged, another unit once completed — a phase relying on nothing done beside one in its review (12.6.3, 12.7.5, 12.S13, 12.S17)', () => {
    const relied = () => item('phase-start', 3, 'relies-on-done');
    const seen = [item('phase-start', 2, 'relies-on-done'), relied()];
    createManifest(dir, 'billing', { status: 'completed' });
    seen.push(relied());
    landed(['2.1']);
    seen.push(relied());
    closed(['phase-2-start', 'phase-2-close']);
    seen.push(relied());
    git(dir, ['reset', '-q', '--hard', 'HEAD~1']);
    seen.push(relied());
    landed(['2.1']);
    seen.push(relied());
    createManifest(dir, 'billing', { status: 'cancelled' });

    assert.deepStrictEqual([...seen, relied()], ['done', 'open', 'open', 'open', 'done', 'open', 'done', 'open']);
  });

  it('closes on the shared design settled once the engine\'s items hold, and a task of the phase starts only then (12.S7); a fix phase past the cut has no start to wait on (P14)', () => {
    const refusal = 'task start: phase 1 of pay has not started — its tasks start once its start checklist closes: checklist close phase-start pay 1';
    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION }).error, refusal);
    ok(dir, ['checklist', 'done', 'phase-start', UNIT, '1', 'design-settled'], { env: SESSION });
    ok(dir, ['checklist', 'close', 'phase-start', UNIT, '1'], { env: SESSION });
    ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes']);
    ok(dir, ['task', 'create', UNIT, '4', '--file', taskFile(dir, 'Fix the total', ['Given a total, when it is fixed, then it adds up.'])]);

    assert.deepStrictEqual([ok(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION }).task, ok(dir, ['task', 'start', UNIT, '4.1'], { env: SESSION }).task], ['1.1', '4.1']);
  });
});
