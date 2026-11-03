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
// (domain/landing.cjs, 7.2.6) — the layout that builds it there is
// test-engine-task-worktree.cjs's, its proof through round 3 the review's
// rounds' simulation's (14.S12). The fix phases in the build's standing and
// on its screens are test-engine-review-fix-phases.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { output, createFile } = require('./engine-harness.cjs');
const {
  UNIT, SESSION_ID, useWorld, env, enter, firstRoundFailed, taskMade, fixPhaseWritten, fixBranch, fixBuilt, commitFile, ok, okSections, refusedPristine, git, assert,
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
