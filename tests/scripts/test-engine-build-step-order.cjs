'use strict';

// ---------------------------------------------------------------------------
// Step's one task at a time where more than one is freed (leeway-engine/
// scripts/domain/task-verbs.cjs, task-parks.cjs; 12.7.9): the one in flight
// the one that went back in flight first, by when each was last freed — an
// answer to its question, a replacement or a keep of the decision it would
// replace, or a merge or a move of it in lines a clone's merge lays — never
// by when each parked, the others
// held behind it. Task start beside the task in flight, a freed task's
// turn, and two left running in auto, are test-engine-build-step.cjs's.
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
const { ok, cleanupFixture, sectionOf, accountTaken } = require('./engine-harness.cjs');
const { UNIT, buildScreensWorld, buildScreenHelpers, stepHelpers } = require('./build-screens-world.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-step-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, screen, refused, parkOn, proposeOn } = buildScreenHelpers(() => dir, () => config);
const { answered, parkedQuestion, decidedFor, written, UNANSWERED_ENDS, behind, bothParked } = stepHelpers(() => dir, () => config);

describe('which task goes on first where more than one is freed (12.7.9)', () => {
  it('reads the task in flight by when an answer freed each, not by when each parked: the questions answered newest first, the task parked last goes on first, its gate drawing and the other held behind it', async () => {
    await bothParked();
    const first = answered('Q2');
    const second = answered('Q1');

    assert.deepStrictEqual([first, second], [
      'Q2 answered · task 1.2 builds again · 1 waiting on you',
      'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you',
    ]);
    assert.match(sectionOf(screen(['step-gate', UNIT, '1.2']), 'DISPLAY: step gate'), /^▪ Show a receipt \(task 1\.2\)/);
    assert.strictEqual(refused(['step-gate', UNIT, '1.1']), behind('render step-gate', '1.2', '1.1'));
  });

  it('answered newest first after a third task ran and finished while both waited, the task parked last still goes on first', async () => {
    await bothParked();
    ok(dir, ['task', 'start', UNIT, '1.3'], { env: env() });
    accountTaken(dir, UNIT, '1.3');
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: env() });
    answered('Q2');

    assert.strictEqual(answered('Q1'), 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });

  for (const [pick, how] of [['keep', 'keep of the decision'], ['1', 'replacement of it']]) {
    it(`a task parked on a replacement proposed goes back in flight at the person's ${how}, as one parked on a question does at its answer`, async () => {
      await proposeOn('1.1');
      ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
      await parkOn(['1.2'], 1);
      answered('Q2');

      assert.strictEqual(answered('Q1', pick), 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
    });
  }

  for (const [how, end] of UNANSWERED_ENDS) {
    it(`a task whose question is ${how} goes back in flight there, behind the one an answer freed before`, async () => {
      await bothParked();
      answered('Q2');
      end(parkedQuestion(1));

      assert.strictEqual(refused(['step-gate', UNIT, '1.1']), behind('render step-gate', '1.2', '1.1'));
    });
  }

  it('a task whose answer is replaced later went back in flight at the answer, ahead of the one an answer freed after it', async () => {
    await bothParked();
    answered('Q1');
    answered('Q2');
    written('replace', ['--replaces', decidedFor('1.1'), '--reason', 'was-wrong'], { text: 'A refund prints a slip.', why: 'A slip is shorter.', drops: [] });

    assert.strictEqual(refused(['step-gate', UNIT, '1.2']), behind('render step-gate', '1.1', '1.2'));
  });

  it('a task parked again on a replacement of the decision it was freed by keeping goes back in flight at the second keep, not the first', async () => {
    await proposeOn('1.1');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    await parkOn(['1.2'], 1);
    answered('Q1', 'keep');
    await proposeOn('1.1');
    answered('Q2');

    assert.strictEqual(answered('Q3', 'keep'), 'Q3 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });
});
