'use strict';

// ---------------------------------------------------------------------------
// The build's gates in step (leeway-engine/scripts/domain/build-screens.cjs,
// drawn by domain/projections/build.cjs) — the gate after a task and the gate
// before a phase's stack merges — and task start's refusal in step, one task
// at a time (domain/task-verbs.cjs). The screens that report are
// test-engine-build-screens.cjs.
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
const { ok, refusedPristine, git, writeState, layout, cleanupFixture, sectionOf } = require('./engine-harness.cjs');
const { UNIT, ACCOUNT_DRAWN, taskText, reportOf, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');

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

const { env, screen, refused, position, parkOn } = buildScreenHelpers(() => dir, () => config);

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

  it('a/auto runs the rest of the build in auto through the door verb; yes, the technical retelling and the diagrams carry on as the workflow says (3.S20, 3.3.6)', () => {
    const picked = Object.fromEntries(['y', 't', 's', 'a'].map((key) => {
      screen(['step-gate', UNIT, '1.1']);
      return [key, ok(dir, ['gate', 'step gate', '--pick', key], { env: env() }).next];
    }));
    ok(dir, picked.a.argv, { env: env() });

    assert.deepStrictEqual(picked, {
      y: { kind: 'continue' }, t: { kind: 'continue' }, s: { kind: 'continue' }, a: { kind: 'engine', argv: ['workunit', 'position', UNIT, 'auto'] },
    });
    assert.match(refused(['step-gate', UNIT, '1.1']), /^render step-gate: pay builds in auto, where no gate follows a task — /, 'in auto no gate follows a task (3.S17)');
  });

  it('is refused before the task\'s account is taken, once the task is done, and in auto — writing nothing', () => {
    const seen = [refused(['step-gate', UNIT, '1.3'])];
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
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    fixPhase(['Mask the reprint']);
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: env() });
    const before = refused(['phase-merge-gate', UNIT, '4']);
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

describe('task start in step: one task at a time (12.7.9)', () => {
  it('refuses a task while another of the unit\'s is in flight or at its gate, writing nothing; in auto both start (12.S52)', () => {
    const error = refusedPristine(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).error;
    position('auto');

    assert.strictEqual(error, 'task start: pay builds in step, one task at a time — task 1.1 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
    assert.strictEqual(ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).task, '1.2');
  });

  it('holds the next while a task of the review\'s fixes past the cut is in progress, started in another conversation, writing nothing', () => {
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    fixPhase(['Mask the reprint', 'Mask the copy']);
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } });

    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '4.2'], { env: env() }).error,
      'task start: pay builds in step, one task at a time — task 4.1 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
  });

  it('starts the next while a question parks the task in flight — a parked task holds nothing new to test — and starts the task in flight again; the next waits on the one then in flight', async () => {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });

    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '1.3'], { env: env() }).error,
      'task start: pay builds in step, one task at a time — task 1.2 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
  });
});
