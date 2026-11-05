'use strict';

// ---------------------------------------------------------------------------
// The review's fix phases in the build (P14, 14.3.2): the build's standing
// (leeway-engine/scripts/domain/build-entry.cjs) lists each fix phase
// written past the cut as the review's fixes of its round — relying on
// nothing, owing no phase review, written, running, closed once every task
// not closed is done and merged once each landed — none not yet written,
// the build finished all along, its entry saying the review phase is next —
// in step, once no stack of the cut waits at its merge gate, the gate named
// in its place (7.2.4); and the build's screens draw them (domain/projections/build.cjs), the stop
// refused in step while a fix task is ready beside one a question parks,
// which waits, once its answer frees it, behind the one that went on
// (domain/build-screens.cjs, 12.13.22, 12.7.9). A fix task in flight —
// taken over, on the position, opened to land — is
// test-engine-review-fix-tasks.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { output, sectionOf } = require('./engine-harness.cjs');
const {
  UNIT, inStep, ENGINE, ENGINE_LINE, RECEIPT, useWorld, fixParked, env, enter, recorded, firstRoundReady, firstRoundFailed, fixPhaseWritten, cutUnmerged, fixBuilt, data,
  ok, okSections, refusedPristine, statePath, readManifest, createManifest, git, assert,
} = require('./review-world.cjs');

const { buildStanding } = require('../../skills/leeway-engine/scripts/domain/build-entry.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A task landed on main, as its landing's commit names it. @param {string} task its internal id */
const landedOnMain = (task) => git(dir, ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed`, '-m', `Task: ${task}`]);

/** The round 1 fix phase as the standing gives it, its task 3.1 standing as `status`. @param {string} state @param {string} status */
const roundOneFixes = (state, status) => ({
  phase: 3, name: 'the review\'s fixes, round 1', round: 1, relies_on: [], state,
  tasks: [{ task: '3.1', title: 'Send the receipt', status, parked: [], after: [] }], fixes_owed: [],
});

describe('the build\'s standing: the review\'s fix phases past the cut (P14)', () => {
  it('lists each fix phase written as the review\'s fixes of its round — from before its round is recorded — relying on nothing and owing no phase review: written, running, closed once every task not closed is done, merged once each landed; none not yet written, the build finished all along (7.4.3)', () => {
    enter();
    const read = () => {
      const { phases, finished } = buildStanding(dir, UNIT, []);
      return { past: phases.slice(2), finished };
    };
    const seen = [read()];
    firstRoundReady();
    seen.push(read());
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    seen.push(read());
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    seen.push(read());
    landedOnMain(`${UNIT}-3-1`);
    seen.push(read());

    assert.deepStrictEqual(seen, [
      { past: [], finished: true },
      { past: [roundOneFixes('written', 'open')], finished: true },
      { past: [roundOneFixes('running', 'in-progress')], finished: true },
      { past: [roundOneFixes('closed', 'done')], finished: true },
      { past: [roundOneFixes('merged', 'done')], finished: true },
    ]);
  });

  it('enter implementation answers a fix phase by its number and its round\'s name, and once the cut is through, that the review phase is next', () => {
    firstRoundFailed();
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const { sections } = okSections(dir, ['enter', 'implementation', UNIT], { env: env() });

    assert.strictEqual(sections, data([
      'position: auto',
      'phase: phase 1 of 2, "Cards": merged — tasks 1.1 done, 1.2 done, 1.3 closed',
      'phase: phase 2 of 2, "Refunds": merged — tasks 2.1 done',
      'phase: phase 3, "the review\'s fixes, round 1": running — tasks 3.1 in progress',
      `finished: every phase of the cut has closed — the review phase is next: enter review ${UNIT}`,
      'in flight: task 3.1, no builder dispatched here — its builder and pair go afresh on its branch',
      `affected: \`${ENGINE} ledger affected ${UNIT}\``,
      `record: \`${ENGINE} ledger record ${UNIT}\``,
      `build log: ${statePath(dir, `${UNIT}/build/log.md`)}`,
      ENGINE_LINE,
    ]));
  });

  it('in step, puts the cut\'s stack waiting at its merge gate before the review phase — its gate in place of the finished line, none while its phase is open — the review phase next once it has merged; in auto the stacks wait for finish (7.2.4)', () => {
    cutUnmerged();
    const next = () => okSections(dir, ['enter', 'implementation', UNIT], { env: env() }).sections.split('\n').filter((line) => /^(finished|merge waiting): /.test(line));
    const auto = next();
    const closed = readManifest(dir, UNIT);
    const { 'phase-2-close': _close, ...open } = closed.checklists;
    createManifest(dir, UNIT, { ...closed, checklists: open, build: { position: 'step' } });
    const running = next();
    createManifest(dir, UNIT, { ...closed, build: { position: 'step' } });
    const step = next();
    landedOnMain(`${UNIT}-2-2`);

    const finished = `finished: every phase of the cut has closed — the review phase is next: enter review ${UNIT}`;
    assert.deepStrictEqual([auto, running, step, next()], [[finished], [], [`merge waiting: phase 2 waits at its gate: render phase-merge-gate ${UNIT} 2`], [finished]]);
  });
});

describe('the build\'s screens: the review\'s fix phases (12.12.11, 3.3.10)', () => {
  it('the progress draws each fix phase after the cut by its number alone, its tasks counted, under the review\'s marker naming the fix phase it is at', () => {
    firstRoundFailed();
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const out = output(dir, ['render', 'build-progress', UNIT], { env: env() });

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Review (the review\'s fixes, round 1) · auto`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build progress'), [
      '3 of 4 tasks done · 1 running',
      '',
      '  ├─ Phase 1 of 2 · Cards                     [merged]',
      '  │  ├─ ✓ 1.1 Take a card                     [done]',
      '  │  ├─ ✓ 1.2 Show a receipt                  [done]',
      '  │  └─ ⊘ 1.3 Store a card                    [closed]',
      '  │',
      '  ├─ Phase 2 of 2 · Refunds                   [merged]',
      '  │  └─ ✓ 2.1 Refund a charge                 [done]',
      '  │',
      '  └─ Phase 3 · the review\'s fixes, round 1    [running]',
      '     └─ ◐ 3.1 Send the receipt                [in progress]',
      '',
    ].join('\n'));
  });

  it('in step, the stop is refused while a fix task is ready beside the one a question parks — a fix phase has no start checklist, so its ready task goes on — and once the answer frees the parked one, it waits behind that task (12.13.22, 12.7.9)', async () => {
    inStep();
    fixPhaseWritten(3, [['Send the receipt', '§1.2'], ['Send it once', '§1.2']]);
    await fixParked();
    const stop = refusedPristine(dir, ['render', 'build-stop', UNIT], { env: env() }).error;
    ok(dir, ['task', 'start', UNIT, '3.2'], { env: env() });
    const drawn = okSections(dir, ['raise', 'draw', UNIT, 'Q1'], { env: env() }).res.raise;
    ok(dir, ['raise', 'answer', drawn, '--pick', '1'], { env: env(), stdin: JSON.stringify({ why: 'Customers keep it.' }) });

    assert.strictEqual(stop, `render build-stop: ${UNIT}'s build goes on with task 3.2, which no question parks — it stops only where nothing can go on without the person's answer (12.13.22)`);
    assert.deepStrictEqual(buildStanding(dir, UNIT, []).phases[2].tasks.map(({ task, status }) => [task, status]), [['3.1', 'behind'], ['3.2', 'in-progress']]);
  });
});
