'use strict';

// ---------------------------------------------------------------------------
// The build's gates in step (leeway-engine/scripts/domain/build-screens.cjs,
// drawn by domain/projections/build.cjs): the gate after a task and the gate
// before a phase's stack merges; and in step, every process gate of the
// build stopping whatever its count, a learned one among them
// (domain/decision-point.cjs `learned`). A task at its gate as the build's standing
// gives it, and as its entry takes it over after a /clear, is
// test-engine-build-gates-standing.cjs's; the screens that report,
// test-engine-build-screens.cjs's; step's one task at a time,
// test-engine-build-step.cjs's and test-engine-build-step-order.cjs's.
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
const { ok, git, writeState, layout, cleanupFixture, sectionOf, accountTaken, withFrozenClock } = require('./engine-harness.cjs');
const { withEnv } = require('./discovery-test-utils.cjs');
const { UNIT, ACCOUNT_DRAWN, taskText, reportOf, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');
const { lines, trustLogHelpers, history } = require('./trust-world.cjs');
const { learned } = require('../../skills/leeway-engine/scripts/domain/decision-point.cjs');
const { SHOWS } = require('../../skills/leeway-engine/scripts/domain/learned-gates.cjs');
const { TRUST_LOG } = require('../../skills/leeway-engine/scripts/domain/trust-log.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-gates-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, screen, refused, position } = buildScreenHelpers(() => dir, () => config);
const { logEvents, project } = trustLogHelpers(() => dir, () => config);

/** A phase of the review's fixes past the cut, phase 4, written with a task of each title given. @param {string[]} titles */
function fixPhase(titles) {
  ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes'], { env: env() });
  for (const title of titles) {
    fs.writeFileSync(path.join(config, 'fix.md'), taskText(title, [`${title} works.`]));
    ok(dir, ['task', 'create', UNIT, '4', '--file', path.join(config, 'fix.md')], { env: env() });
  }
}

describe('the gate after a task, in step (12.14.3, 12.12.7, 3.3.8, 13.4.7)', () => {
  it('carries the task\'s description, its account and diagrams, its verdict with the round it passed in after its rounds of fixes, and the engine\'s figures, then asks — no review report printed (3.S16, 12.S27, 12.S41, 13.S19)', () => {
    const out = screen(['step-gate', UNIT, '1.1']);

    assert.strictEqual(sectionOf(out, 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
    assert.strictEqual(sectionOf(out, 'MENU: step gate — 1.1'), [
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**       → Approve it and continue to the next task',
      '**`a/auto`**      → Approve it and run the rest of the build in auto',
      '**`t/technical`** → Retell the result from the code\'s perspective',
      '**`s/show`**      → Show the result as diagrams',
      '**Ask**         → Ask questions about the task (doesn\'t approve or',
      `${' '.repeat(14)}reject)`,
      '**Comment**     → Request changes',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /The digits show whole|Verdict:/, 'no review report is printed (12.12.6)');
  });

  it('a/auto runs the rest of the build in auto through the door verb; yes carries on as the workflow says; the technical retelling and the diagrams bring the gate back (3.S20, 3.3.6)', () => {
    const picked = Object.fromEntries(['y', 't', 's', 'a'].map((key) => {
      screen(['step-gate', UNIT, '1.1']);
      return [key, ok(dir, ['gate', 'step gate', '--pick', key], { env: env() }).next];
    }));
    ok(dir, picked.a.argv, { env: env() });

    assert.deepStrictEqual(picked, {
      y: { kind: 'continue' },
      t: { kind: 'engine', argv: ['render', 'step-gate', UNIT, '1.1'] },
      s: { kind: 'engine', argv: ['render', 'step-gate', UNIT, '1.1'] },
      a: { kind: 'engine', argv: ['workunit', 'position', UNIT, 'auto'] },
    });
    assert.match(refused(['step-gate', UNIT, '1.1']), /^render step-gate: pay builds in auto, where no gate follows a task — /, 'in auto no gate follows a task (3.S17)');
  });

  it('is refused before the task\'s account is taken, once the task is done, and in auto — writing nothing', () => {
    const seen = [refused(['step-gate', UNIT, '1.3'])];
    accountTaken(dir, UNIT, '1.1');
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    seen.push(refused(['step-gate', UNIT, '1.1']));
    position('auto');
    seen.push(refused(['step-gate', UNIT, '1.1']), refused(['step-gate', UNIT]));

    assert.deepStrictEqual(seen, [
      'render step-gate: task 1.3 of pay has no account taken — it lands once its account is: task account pay 1.3',
      'render step-gate: task 1.1 of pay is done — its gate comes as it lands, before task done',
      'render step-gate: pay builds in auto, where no gate follows a task — the person meets only danger, the authority gates and the questions parked',
      'render step-gate: Usage: engine render step-gate <work-unit> <task>',
    ]);
  });
});

describe('the gate before a phase\'s stack merges, in step (7.2.4)', () => {
  it('stops once the phase review passed, its yes merging the phase through land phase (7.S8)', () => {
    for (const letter of ['a', 'b']) writeState(dir, layout.unit(UNIT, `build/phases/phase-1/review-${letter}.md`), reportOf([]));
    const out = screen(['phase-merge-gate', UNIT, '1']);
    const next = ok(dir, ['gate', 'phase merge', '--pick', 'y'], { env: env() }).next;

    assert.strictEqual(sectionOf(out, 'MENU: phase merge — 1'), [
      '· · · · · · · · · · · ·',
      'Phase 1, "Cards", is ready to merge: its tasks land on the default branch as one stack.',
      '',
      '**`◆ Merge phase 1?`**',
      '',
      '**`y/yes`**   → Merge it and carry on with the build',
      '**Comment** → Tell me what to change before it merges',
      '',
    ].join('\n'));
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['land', 'phase', UNIT, '1'] });
  });

  it('a phase of the review\'s fixes, named for its round, stops once its tasks are done, and is refused before and once it has merged, writing nothing', () => {
    accountTaken(dir, UNIT, '1.1');
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    fixPhase(['Mask the reprint']);
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: env() });
    const before = refused(['phase-merge-gate', UNIT, '4']);
    accountTaken(dir, UNIT, '4.1');
    ok(dir, ['task', 'done', UNIT, '4.1'], { env: env() });
    const ready = screen(['phase-merge-gate', UNIT, '4']);
    git(dir, ['commit', '-q', '--allow-empty', '-m', `fix(${UNIT}): landed`, '-m', `Task: ${UNIT}-4-1`]);

    assert.deepStrictEqual([before, refused(['phase-merge-gate', UNIT, '4'])], [
      'render phase-merge-gate: phase 4 of pay merges once its tasks are done — task 4.1 is in progress',
      'render phase-merge-gate: phase 4 of pay is merged already — its tasks are on the default branch',
    ]);
    assert.match(ready, /Phase 4, "the review's fixes, round 1", is ready to merge/);
  });

  it('is refused for a phase the tracker lacks, before the phase review passed, in auto, and for no phase, writing nothing', () => {
    const before = [refused(['phase-merge-gate', UNIT, '9']), refused(['phase-merge-gate', UNIT, '1'])];
    position('auto');

    assert.deepStrictEqual([...before, refused(['phase-merge-gate', UNIT, '1']), refused(['phase-merge-gate', UNIT, 'one']), refused(['phase-merge-gate', UNIT])], [
      'render phase-merge-gate: phase 9 of pay is not written — no stack of its waits to merge',
      'render phase-merge-gate: phase 1 of pay merges once its phase review has passed and its fixes are done — phase 1 of pay has no phase review reported — its reviewers write their reports in pay/build/phases/phase-1/',
      'render phase-merge-gate: pay builds in auto, where a phase\'s stack merges with no gate — the person meets only danger, the authority gates and the questions parked',
      'render phase-merge-gate: task-id: "one" is not a phase — it is a whole number from 1',
      'render phase-merge-gate: Usage: engine render phase-merge-gate <work-unit> <N>',
    ]);
  });
});

describe('the build\'s position at its gates (3.3.3, 3.3.6, 3.3.7)', () => {
  it('3.S13, 3.S14: switched from auto to step through its door, the switch logged in the trust log, every process gate of the build stops at once whatever its count — a learned gate at the build\'s place, run as a step in auto, and the gate after a task, which never learns', () => {
    const h = history({ project: project() });
    for (const gate of ['plan gate', 'step gate']) for (let i = 0; i < 13; i += 1) h.gate(gate, { picked: 'y' });
    fs.writeFileSync(path.join(config, TRUST_LOG), lines(...h.events));
    const learnedHere = () => withEnv({ LEEWAY_CONFIG_DIR: config }, () => withFrozenClock(() => learned('plan gate', { cwd: dir, place: { unit: UNIT, phase: 'implementation', topic: null } })));
    position('auto');
    const inAuto = learnedHere();
    position('step');

    assert.deepStrictEqual([inAuto, learnedHere()], [{ step: 'automatic', row: 'y' }, SHOWS]);
    assert.deepStrictEqual(logEvents().filter(({ type }) => type === 'position-switch').map(({ unit, to }) => ({ unit, to })), [{ unit: UNIT, to: 'auto' }, { unit: UNIT, to: 'step' }]);
    assert.match(sectionOf(screen(['step-gate', UNIT, '1.1']), 'MENU: step gate — 1.1'), /^\*\*`◆ Approve this task\?`\*\*$/m);
  });
});
