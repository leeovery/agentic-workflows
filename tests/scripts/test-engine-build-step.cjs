'use strict';

// ---------------------------------------------------------------------------
// Step's one task at a time (leeway-engine/scripts/domain/task-verbs.cjs,
// 12.7.9): task start refused beside the task in flight; and where more
// than one goes on — an answer freeing one while another went on, or two
// left running in auto — the one in flight the one that went back in flight
// first, by when each was last freed (task-parks.cjs): an answer to its
// question, a replacement or a keep of the decision it would replace, or a
// merge or a move of it in lines a clone's merge lays. The others are held behind it in the answer's receipt
// (questions.cjs), their gate (build-screens.cjs) and their briefs
// (brief.cjs), and after a /clear in the build's entry, its recovery note
// and its progress (build-entry.cjs); once its turn comes, `task ready`
// names it back, its builder sent in again. Which goes on first across
// answers is test-engine-build-step-order.cjs's; the gates themselves
// test-engine-build-gates.cjs's.
//
// Layer: verb. World: the build screens' world (build-screens-world.cjs),
// built once and copied; a test that needs a phase of the review's fixes
// writes phase 4 past the cut.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, refusedPristine, cleanupFixture, sectionOf, writeState, accountTaken } = require('./engine-harness.cjs');
const { UNIT, ACCOUNT_DRAWN, taskText, buildScreensWorld, buildScreenHelpers, stepHelpers } = require('./build-screens-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { recordReviewer, recordBuilder } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { freedAt } = require(path.join(SCRIPTS, 'domain/task-parks.cjs'));

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

const { env, screen, refused, position, parkOn, takenOver } = buildScreenHelpers(() => dir, () => config);
const { answered, startRefused, beside, behind, bothParked } = stepHelpers(() => dir, () => config);

describe('task start in step: one task at a time (12.7.9)', () => {
  it('refuses a task while another of the unit\'s is in flight or at its gate, writing nothing; in auto both start (12.S52)', () => {
    const error = startRefused('1.2');
    position('auto');

    assert.strictEqual(error, beside('1.1'));
    assert.strictEqual(ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).task, '1.2');
  });

  it('holds the next while a task of the review\'s fixes past the cut is in progress, started in another conversation, writing nothing', () => {
    accountTaken(dir, UNIT, '1.1');
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes'], { env: env() });
    for (const title of ['Mask the reprint', 'Mask the copy']) {
      fs.writeFileSync(path.join(config, 'fix.md'), taskText(title, [`${title} works.`]));
      ok(dir, ['task', 'create', UNIT, '4', '--file', path.join(config, 'fix.md')], { env: env() });
    }
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } });

    assert.strictEqual(startRefused('4.2'), beside('4.1'));
  });

  it('starts the next while a question parks the task in flight — a parked task holds nothing new to test — and starts the task in flight again; the next waits on the one then in flight', async () => {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });

    assert.strictEqual(startRefused('1.3'), beside('1.2'));
  });
});

describe('the task in flight where more than one goes on (12.7.9)', () => {
  it('holds a task an answer freed while another went on behind it: the receipt says it builds again once that one is done, its gate and its briefs refused until then and the next task\'s start naming the one in flight — whose gate draws — then the freed task\'s gate draws once it is done, and task ready names it back, its builder sent in again', async () => {
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    const receipt = answered('Q1');
    const held = [refused(['step-gate', UNIT, '1.1']), refusedPristine(dir, ['brief', 'reviewer', UNIT, '1.1', '--base', 'main', '--letter', 'a'], { env: env() }).error];
    const next = startRefused('1.3');
    const inFlight = sectionOf(screen(['step-gate', UNIT, '1.2']), 'DISPLAY: step gate');
    const ready = () => ok(dir, ['task', 'ready', UNIT], { env: env() }).back;
    const waiting = ready();
    accountTaken(dir, UNIT, '1.2');
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: env() });

    assert.deepStrictEqual([waiting, ready()], [undefined, '1.1'], 'task ready names the freed task back once its turn has come');
    recordBuilder(dir, { unit: UNIT, phase: 1, n: 1 }, /** @type {number} */ (freedAt(dir, UNIT).get('1.1')));
    assert.strictEqual(ready(), undefined, 'once its builder is briefed past the freeing, task ready names it back no longer');

    assert.strictEqual(receipt, 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
    assert.deepStrictEqual(held, [behind('render step-gate', '1.2', '1.1'), behind('brief', '1.2', '1.1')]);
    assert.strictEqual(next, beside('1.2'));
    assert.match(inFlight, /^▪ Show a receipt \(task 1\.2\)/);
    assert.strictEqual(sectionOf(screen(['step-gate', UNIT, '1.1']), 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
    position('auto');
    assert.strictEqual(ready(), undefined, 'in auto no task waits its turn');
  });

  it('S1: names a freed task back only while no reviewer this conversation briefed for a round of it is still to report — its builder goes back once the round\'s reports are in; a round an earlier conversation briefed holds nothing back', async () => {
    const ref = { unit: UNIT, phase: 1, n: 1 };
    await parkOn(['1.1']);
    recordReviewer(dir, ref, 3, 'a', 'an-earlier-conversation');
    answered('Q1');
    const ready = () => ok(dir, ['task', 'ready', UNIT], { env: env() }).back;
    const earlier = ready();
    for (const letter of ['a', 'b']) recordReviewer(dir, ref, 3, letter, env().CLAUDE_CODE_SESSION_ID);
    const reading = ready();
    for (const letter of ['a', 'b']) writeState(dir, `${UNIT}/build/tasks/1.1/round-3-${letter}.md`, '## Findings\n\nNone.\n\nVerdict: pass\n');

    assert.deepStrictEqual([earlier, reading, ready()], ['1.1', undefined, '1.1']);
  });

  it('ends a freed task\'s turn once a fix round\'s brief goes to its builder, as its own brief does', async () => {
    recordBuilder(dir, { unit: UNIT, phase: 1, n: 1 }, 0, env().CLAUDE_CODE_SESSION_ID);
    await parkOn(['1.1']);
    answered('Q1');
    const ready = () => ok(dir, ['task', 'ready', UNIT], { env: env() }).back;
    const freed = ready();
    for (const letter of ['a', 'b']) writeState(dir, `${UNIT}/build/tasks/1.1/round-3-${letter}.md`, `## Findings\n\n${letter === 'a' ? '- bug: The digits show whole.\n  Scenario: a card read back.' : 'None.'}\n\nVerdict: ${letter === 'a' ? 'fail' : 'pass'}\n`);
    ok(dir, ['brief', 'fix', UNIT, '1.1'], { env: env() });

    assert.deepStrictEqual([freed, ready()], ['1.1', undefined]);
  });

  it('a task freed, parked again and freed once more goes behind the one an answer freed meanwhile', async () => {
    await bothParked();
    answered('Q1');
    await parkOn(['1.1'], 2);
    answered('Q2');

    assert.strictEqual(answered('Q3'), 'Q3 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });

  it('frees the tasks one answer parked one at a time, in the tracker\'s order; in auto each builds again at once', async () => {
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    await parkOn(['1.2']);
    const receipt = answered('Q1');
    const held = refused(['step-gate', UNIT, '1.2']);
    position('auto');
    await parkOn(['1.1', '1.2'], 1);

    assert.strictEqual(receipt, 'Q1 answered · their tasks build again, task 1.1 first · nothing waiting on you');
    assert.strictEqual(held, behind('render step-gate', '1.1', '1.2'));
    assert.strictEqual(answered('Q2'), 'Q2 answered · their tasks build again · nothing waiting on you');
  });

  it('switched from auto to step with two tasks running, the first in the tracker\'s order goes on and the other is held behind it', () => {
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    position('step');

    assert.strictEqual(refused(['step-gate', UNIT, '1.2']), behind('render step-gate', '1.1', '1.2'));
    assert.strictEqual(sectionOf(screen(['step-gate', UNIT, '1.1']), 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
  });

  it('after a /clear, the entry and its recovery note take the one held behind over saying it goes on once the task in flight is done, no builder going to it until then, and the progress draws it behind, running no more (build-entry.cjs)', async () => {
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    answered('Q1');
    const lines = takenOver();
    const progress = sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build progress').split('\n');

    const held = 'in flight: task 1.1, behind the task in flight — it goes on once that task is done, and no builder goes to it until then';
    const atGate = 'in flight: task 1.2, at its gate — it waits on the person\'s go there, the gate drawn again with render step-gate pay 1.2, and its builder is never sent afresh';
    assert.deepStrictEqual(lines, ['phase: phase 1 of 3, "Cards": running — tasks 1.1 behind the task in flight, 1.2 at its gate, 1.3 not started', held, atGate, held, atGate]);
    assert.deepStrictEqual(progress.slice(0, 5), [
      '0 of 4 tasks done · 0 running',
      '',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  ├─ ◌ 1.1 Take a card         [behind the task in flight]',
      '  │  ├─ ● 1.2 Show a receipt      [at its gate]',
    ]);
  });
});
