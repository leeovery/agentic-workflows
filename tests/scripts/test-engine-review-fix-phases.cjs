'use strict';

// ---------------------------------------------------------------------------
// The review's fix phases in the build (P14, 14.3.2): the build's standing
// (leeway-engine/scripts/domain/build-entry.cjs) lists each fix phase
// written past the cut as the review's fixes of its round — relying on
// nothing, owing no phase review, written, running, closed once every task
// not closed is done and merged once each landed — none not yet written,
// the build finished all along, its entry saying the review phase is next;
// the build's screens draw them (domain/projections/build.cjs); a fix task
// another conversation left in progress is taken over by either entry,
// `enter implementation` and `enter review`, at the place entered, its
// recovery note naming it (24.2.4); `task start` of a fix task keeps the
// review phase the conversation is at, or, with no build place held, puts
// it there, its tasks riding between the unit's implementation and its
// review phase (domain/position.cjs); and `land open` refuses a fix task
// whose branch does not descend from the unit's work not landed below it,
// which a fix phase is built on (domain/landing.cjs, 7.2.6) — the layout
// that builds it there is test-engine-task-worktree.cjs's, its proof
// through round 3 the review phase's simulation's (14.S12).
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { output, sectionOf, createFile } = require('./engine-harness.cjs');
const {
  UNIT, ENGINE, SESSION_ID, RECEIPT, useWorld, env, enter, recorded, firstRoundReady, fixPhaseWritten, fixBranch, fixBuilt, commitFile, data,
  ok, okSections, refusedPristine, statePath, git, assert,
} = require('./review-world.cjs');

const { buildStanding } = require('../../skills/leeway-engine/scripts/domain/build-entry.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** Round 1 recorded failing on area 1's receipt, its fix task 3.1 written and not started. */
function firstRoundFailed() {
  firstRoundReady();
  recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
}

/** A conversation's position as recorded, or null. @param {string} [session] */
function positionOf(session = SESSION_ID) {
  const file = path.join(/** @type {string} */ (env().LEEWAY_CONFIG_DIR), 'conversations', session, 'position.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

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
      'in flight: task 3.1, no builder dispatched — its builder and pair go afresh on its branch',
      `affected: \`${ENGINE} ledger affected ${UNIT}\``,
      `record: \`${ENGINE} ledger record ${UNIT}\``,
      `build log: ${statePath(dir, `${UNIT}/build/log.md`)}`,
    ]));
  });
});

describe('the build\'s screens: the review\'s fix phases (12.12.11, 3.3.10)', () => {
  it('the progress draws each fix phase after the cut by its number alone, its tasks counted, under the marker naming the fix phase the build is at', () => {
    firstRoundFailed();
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const out = output(dir, ['render', 'build-progress', UNIT], { env: env() });

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Build (the review\'s fixes, round 1) · auto`**\n');
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
});

describe('the takeover after a /clear: every phase written (12.13.2, 24.2.4)', () => {
  it('enter review takes a fix task another conversation left in progress onto this one\'s position at the review phase, with no builder and no pair, its answer and its recovery note naming it; enter implementation takes it over at the build', () => {
    firstRoundFailed();
    createFile(dir, '.claude/skills/leeway-review-process/SKILL.md', '# The review\n');
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env('earlier') });
    const { sections } = enter();
    const note = output(dir, ['conversation', 'position', SESSION_ID], { env: { ...env(), CLAUDE_CODE_SESSION_ID: '' } });
    okSections(dir, ['enter', 'implementation', UNIT], { env: env('third') });

    const taken = 'in flight: task 3.1, no builder dispatched — its builder and pair go afresh on its branch';
    assert.deepStrictEqual(positionOf(), { name: UNIT, phase: 'review', topic: UNIT, tasks: [{ task: '3.1', builder: null, reviewers: [] }] });
    assert.ok(sections.includes(`fix task waiting: 3.1 in progress\n${taken}\n`), sections);
    assert.ok(note.includes(`\n${taken}\n`), note);
    assert.deepStrictEqual(positionOf('third'), { name: UNIT, phase: 'implementation', topic: UNIT, tasks: [{ task: '3.1', builder: null, reviewers: [] }] });
  });
});

describe('the position: a fix task in flight at the review phase (14.3.2, 24.2.4)', () => {
  it('task start of a fix task keeps the place in the unit\'s build the conversation is at — the review phase, its worktree and its builder recorded there, or the build\'s entry — its tasks riding between them; and task close takes it off there', () => {
    enter();
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const started = positionOf();
    const tree = path.join(path.dirname(dir), 'agent-fix');
    git(dir, ['worktree', 'add', '-q', '-b', 'worktree-agent-fix', tree]);
    ok(tree, ['task', 'worktree', UNIT, '3.1'], { env: env() });
    const brief = ok(dir, ['brief', 'builder', UNIT, '3.1'], { env: env() }).id;
    ok(dir, ['conversation', 'builder', SESSION_ID, 'agent-fix', '--brief', brief], { env: env() });
    const built = positionOf();
    okSections(dir, ['enter', 'implementation', UNIT], { env: env() });
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const carried = positionOf();
    enter();
    const back = positionOf();
    ok(dir, ['task', 'close', UNIT, '3.1', '--reason', 'The receipt is sent by the gateway.'], { env: env() });

    const fix = { task: '3.1', builder: 'agent-fix', reviewers: [], worktree: tree };
    assert.deepStrictEqual([started, built, carried, back, positionOf()], [
      { name: UNIT, phase: 'review', topic: UNIT, tasks: [{ task: '3.1', builder: null, reviewers: [] }] },
      { name: UNIT, phase: 'review', topic: UNIT, tasks: [fix] },
      { name: UNIT, phase: 'implementation', topic: UNIT, tasks: [fix] },
      { name: UNIT, phase: 'review', topic: UNIT, tasks: [fix] },
      { name: UNIT, phase: 'review', topic: UNIT },
    ]);
  });

  it('task start puts a fix task at the review phase where the conversation holds no place in the unit\'s build', () => {
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env('fresh') });

    assert.deepStrictEqual(positionOf('fresh'), { name: UNIT, phase: 'review', topic: UNIT, tasks: [{ task: '3.1', builder: null, reviewers: [] }] });
  });
});

describe('land open: a fix phase built on the work below it (7.2.6)', () => {
  it('refuses a fix task whose branch does not descend from the tip of the unit\'s work not landed below its phase, naming it and opening nothing; opens it once built there', () => {
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    ok(dir, ['land', 'open', UNIT, '3.1'], { env: env() });
    fixPhaseWritten(4, [['Send it once', '§1.2']]);
    fixBuilt(4, 1, 'Send it once', 'main', 'src/once.js');
    const [below, branch] = [fixBranch(3, 1, 'Send the receipt'), fixBranch(4, 1, 'Send it once')];
    const off = refusedPristine(dir, ['land', 'open', UNIT, '4.1'], { env: env() }).error;
    git(dir, ['checkout', '-q', '-B', branch, below]);
    commitFile(dir, 'src/once.js', `${UNIT}-4-1`);
    git(dir, ['checkout', '-q', 'main']);

    assert.strictEqual(off, `land: task 4.1's branch ${branch} does not descend from ${below}, where ${UNIT}'s work not landed below phase 4 ends, which a fix phase is built on (7.2.6) — merge it back onto ${below} first, then open it again`);
    assert.strictEqual(ok(dir, ['land', 'open', UNIT, '4.1'], { env: env() }).task, '4.1');
  });
});
