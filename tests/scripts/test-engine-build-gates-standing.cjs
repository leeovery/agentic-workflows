'use strict';

// ---------------------------------------------------------------------------
// A task at its step gate as the build's standing gives it (leeway-engine/
// scripts/domain/build-entry.cjs): in step, in progress, parked by no
// question, its pair passed and its account taken (domain/task-account.cjs)
// with nothing added to it since — an addition after its account, the
// person's Comment there put onto the task (13.11.3), taking it off its gate
// until a new account counts it — and taken over after a /clear, its gate
// drawn again and its builder never sent afresh, in auto its way on its
// landing, or, mid-rework, its builder sent again (12.7.9, 12.14.3). The gates themselves are
// test-engine-build-gates.cjs's.
//
// Layer: verb. World: the build screens' world (build-screens-world.cjs),
// built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, statePath, writeState, layout, cleanupFixture, withEnv } = require('./engine-harness.cjs');
const { UNIT, reportOf, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');

const { buildStanding } = require('../../skills/leeway-engine/scripts/domain/build-entry.cjs');
const { recordReviewer } = require('../../skills/leeway-engine/scripts/domain/round-report.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-gates-standing-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, position, parkOn, takenOver } = buildScreenHelpers(() => dir, () => config);

/** Task 1.1 as the build's standing gives it. */
const standing11 = () => withEnv({ LEEWAY_CONFIG_DIR: config }, () => buildStanding(dir, UNIT, []).phases[0].tasks[0]);

/** An addition onto task 1.1, as `by` makes it: the person's Comment at its gate is put onto the task before its builder goes again (13.11.3). @param {string} by */
function added(by) {
  fs.writeFileSync(path.join(config, 'addition.md'), 'Mask the digits on the reprint too.\n');
  ok(dir, ['task', 'add', UNIT, '1.1', '--file', path.join(config, 'addition.md'), '--by', by], { env: env() });
}

describe('a task at its gate, met again after a /clear (12.7.9, 12.14.3)', () => {
  it('is taken over waiting on the person\'s go, the entry and its recovery note saying so, its gate drawn again and its builder never sent afresh; in auto it is in progress, its way on its landing', () => {
    const step = takenOver();
    position('auto');

    const atGate = 'in flight: task 1.1, at its gate — it waits on the person\'s go there, the gate drawn again with render step-gate pay 1.1, and its builder is never sent afresh';
    assert.deepStrictEqual(step, ['phase: phase 1 of 3, "Cards": running — tasks 1.1 at its gate, 1.2 not started, 1.3 not started', atGate, atGate]);
    assert.deepStrictEqual(takenOver().slice(0, 2), [
      'phase: phase 1 of 3, "Cards": running — tasks 1.1 in progress, 1.2 not started, 1.3 not started',
      'in flight: task 1.1, no builder dispatched here — round 2 of its review passed, its account taken — show its landing, render task-landed pay 1.1, then land it, engine land open pay 1.1',
    ]);
  });

  it('stands at its gate only in step, in progress, its pair passed, its account taken and no question parking it', async () => {
    const figures = statePath(dir, `${UNIT}/build/tasks/1.1/figures.json`);
    const failing = ['a', 'b'].map((letter) => layout.unit(UNIT, `build/tasks/1.1/round-3-${letter}.md`));
    const seen = [standing11().status];
    position('auto');
    seen.push(standing11().status);
    position('step');
    for (const file of failing) writeState(dir, file, reportOf([['bug', 'The digits show again.']]));
    seen.push(standing11().status);
    for (const file of failing) fs.rmSync(statePath(dir, file));
    fs.renameSync(figures, `${figures}.aside`);
    seen.push(standing11().status);
    fs.renameSync(`${figures}.aside`, figures);
    await parkOn(['1.1']);

    assert.deepStrictEqual([...seen, standing11()], [
      'at-gate', 'in-progress', 'in-progress', 'in-progress',
      { task: '1.1', title: 'Take a card', status: 'in-progress', parked: ['Q1'], after: [] },
    ]);
  });
});

describe('a task reworked after its account: the person\'s Comment at its gate (13.11.3)', () => {
  it('is taken off its gate by an addition after its account — the person\'s Comment there, put onto the task — in progress while it is reworked', () => {
    const before = standing11().status;
    added('person');

    assert.deepStrictEqual([before, standing11().status], ['at-gate', 'in-progress']);
  });

  it('is back at its gate once its pair passes the rework and a new account counts every addition, whoever made it', () => {
    added('orchestrator');
    for (const letter of ['a', 'b']) writeState(dir, layout.unit(UNIT, `build/tasks/1.1/round-3-${letter}.md`), reportOf([]));
    const passedOnly = standing11().status;
    fs.appendFileSync(statePath(dir, `${UNIT}/build/tasks/1.1.md`), '\n\n### Round 3\n\nThe reprint masks the digits too.\n');
    ok(dir, ['task', 'account', UNIT, '1.1'], { env: env() });

    assert.deepStrictEqual([passedOnly, standing11().status], ['in-progress', 'at-gate']);
  });

  it('is taken over after a /clear mid-rework with its builder sent again and no gate drawn', () => {
    for (const letter of ['a', 'b']) recordReviewer(dir, { unit: UNIT, phase: 1, n: 1 }, 2, letter, 'earlier');
    added('person');

    const afresh = 'in flight: task 1.1, no builder dispatched here — its builder and pair go afresh on its branch';
    assert.deepStrictEqual(takenOver(), ['phase: phase 1 of 3, "Cards": running — tasks 1.1 in progress, 1.2 not started, 1.3 not started', afresh, afresh]);
  });
});
