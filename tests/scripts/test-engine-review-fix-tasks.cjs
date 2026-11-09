'use strict';

// ---------------------------------------------------------------------------
// A fix task of the review's in flight (P14, 14.3.2): one another
// conversation left in progress is taken over by either entry, `enter
// implementation` and `enter review`, at the place entered, its recovery
// note naming it (leeway-engine/scripts/domain/build-entry.cjs, 24.2.4);
// `task start` of a fix task keeps the review phase the conversation is at,
// or, with no build place held, puts it there — a task of a unit built
// under the old plan, with no cut and so no fix phase, at its
// implementation — its tasks riding between the unit's implementation and
// its review phase (domain/position.cjs); and
// `land open` refuses a fix task whose branch does not descend from the
// unit's work not landed below it, which a fix phase is built on
// (domain/landing.cjs, 7.2.6); `land phase` refuses a fix phase while a
// task of it is neither done nor closed (7.2.4), and `land finish` refuses
// as finish's yes refuses before it lands anything — a build not begun, a
// phase of the cut not closed or, in step, not merged, the review phase
// not over, its fix tasks waiting among it (domain/finish-checks.cjs) —
// each naming its way on — the layout that builds it there is
// test-engine-task-worktree.cjs's, its proof — round 2's fix built on
// round 1's, and both landed at finish — the review's rounds' simulation's.
// The fix phases in the build's standing and on its screens are
// test-engine-review-fix-phases.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { output, createFile } = require('./engine-harness.cjs');
const {
  UNIT, SESSION_ID, EVERY, useWorld, env, enter, reported, recorded, inStep, cutUnmerged, firstRoundFailed, taskMade, fixPhaseWritten, fixBranch, fixBuilt, commitFile, ok, okSections, refusedPristine, git, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A conversation's position as recorded, or null. @param {string} [session] */
function positionOf(session = SESSION_ID) {
  const file = path.join(/** @type {string} */ (env().LEEWAY_CONFIG_DIR), 'conversations', session, 'position.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

describe('the takeover after a /clear: every phase written (12.13.2, 24.2.4)', () => {
  it('enter review takes a fix task another conversation left in progress onto this one\'s position at the review phase, with no builder and no pair, its answer and its recovery note naming it; enter implementation takes it over at the build', () => {
    firstRoundFailed();
    createFile(dir, '.claude/skills/leeway-review-process/SKILL.md', '# The review\n');
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env('earlier') });
    const { sections } = enter();
    const note = output(dir, ['conversation', 'position', SESSION_ID], { env: { ...env(), CLAUDE_CODE_SESSION_ID: '' } });
    okSections(dir, ['enter', 'implementation', UNIT], { env: env('third') });

    const taken = 'in flight: task 3.1, no builder dispatched here — its builder and pair go afresh on its branch';
    assert.deepStrictEqual(positionOf(), { name: UNIT, phase: 'review', topic: UNIT, tasks: [{ task: '3.1', builder: null, reviewers: [] }] });
    assert.ok(sections.includes(`fix task waiting: 3.1 in progress\nbase: main — the branch the unit's work lands on, the --base of each reader's brief\n${taken}\n`), sections);
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

  it('task start, where the conversation holds no place in the unit\'s build, puts a fix task at the review phase, and a task of a unit built under the old plan — no cut, so none of its phases the review\'s fixes — at its implementation', () => {
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env('fresh') });
    ok(dir, ['task', 'phase', 'old', '1', '--title', 'The old work']);
    taskMade(1, 'Keep the old work', '§1', 'old');
    ok(dir, ['task', 'start', 'old', '1.1'], { env: env('old') });

    const started = (/** @type {string} */ task) => [{ task, builder: null, reviewers: [] }];
    assert.deepStrictEqual([positionOf('fresh'), positionOf('old')], [
      { name: UNIT, phase: 'review', topic: UNIT, tasks: started('3.1') },
      { name: 'old', phase: 'implementation', topic: 'old', tasks: started('1.1') },
    ]);
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

describe('land phase: one of the review\'s fix phases, past the cut (7.2.4, P14)', () => {
  it('is refused while a task of it is neither done nor closed, in flight among them, naming its done or its close and moving nothing; merges once each is done', () => {
    firstRoundFailed();
    const unstarted = refusedPristine(dir, ['land', 'phase', UNIT, '3'], { env: env() }).error;
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const inFlight = refusedPristine(dir, ['land', 'phase', UNIT, '3'], { env: env() }).error;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    ok(dir, ['land', 'open', UNIT, '3.1'], { env: env() });

    const way = `land: phase 3 of ${UNIT} merges once each of its tasks is done or closed — task 3.1 is neither: task done ${UNIT} 3.1, or task close ${UNIT} 3.1 --reason <why>`;
    assert.deepStrictEqual([unstarted, inFlight], [way, way]);
    assert.strictEqual(ok(dir, ['land', 'phase', UNIT, '3'], { env: env() }).phase, 3);
  });
});

describe('land finish: refused as finish\'s yes refuses before it lands anything (14.5, 6.4.10)', () => {
  /** `land finish` of `unit` refused, nothing moved: its error. @param {string} [unit] */
  const refusedFinish = (unit = UNIT) => refusedPristine(dir, ['land', 'finish', unit], { env: env() }).error;

  it('refuses a build not begun and one whose cut has a phase not closed, each naming its way on', () => {
    assert.deepStrictEqual([refusedFinish('fresh'), refusedFinish('half')], [
      'land: fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      'land: half finishes once its review phase is over — half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
    ]);
  });

  it('refuses, in step, while a phase of the cut waits at its merge gate, naming the gate', () => {
    inStep();
    cutUnmerged();
    assert.strictEqual(refusedFinish(), `land: ${UNIT} finishes once its review phase is over — ${UNIT} builds in step, and its review phase is entered once every phase of its cut has merged — phase 2 waits at its gate: render phase-merge-gate ${UNIT} 2`);
  });

  it('refuses while the review phase goes on, and while the round that ended it has a fix task unended, naming each', () => {
    const reviewing = refusedFinish();
    enter();
    reported(1, EVERY, { '1-cards-a': ['nit: The receipt says "reciept".'] });
    fixPhaseWritten(3, [['Spell the receipt', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'nit', text: 'The receipt says "reciept".', from: ['1-cards-a#1'], fix: '3.1' }] });

    assert.deepStrictEqual([reviewing, refusedFinish()], [
      `land: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`,
      `land: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.1 not started`,
    ]);
  });
});
