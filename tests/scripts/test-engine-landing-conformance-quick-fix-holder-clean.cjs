'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose one checkout's holder
// leaves it clean (19.5.23, R27): the contract every landing driver meets,
// run through the engine's verbs against each shipped driver in turn. The
// fix holding the checkout leaves it clean as it stops holding it
// (task-verbs.cjs, `checkoutHold`): its close refused while the checkout
// holds changes not committed, saying a close gives them up, and its done,
// saying to commit them, so a fix freed after it never takes them as its
// own; none holding it, a fix not started briefed to build only once its
// start makes it the holder; and the person's own changes never taken or
// lost — a start of a fix an answer freed since its last start refusing
// them, the park's line naming what it set aside, and a close keeping
// that, naming it on its answer and on the close's screen with the calls
// that show it and bring it into the checkout (R26), and only its own. A start that makes a fix the holder refusing the
// person's changes: test-engine-quick-fix.cjs. Who holds the checkout:
// test-engine-landing-conformance-quick-fix-holder.cjs. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world; this file names no
// driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixConformance`, built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, output, sectionOf, refusedPristine, createFile, git, accountTaken,
} = require('./engine-harness.cjs');
const {
  UNIT, FLAG, HELP, CALL, createFix, parkedOn, checklistClosed, quickFixConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixConformance(name, `engine-landing-quick-fix-holder-clean-${name}-`);

  /** A call that must succeed. @param {string} at @param {string[]} args */
  const run = (at, args) => ok(at, args, as());

  /** A call's refusal, nothing written or committed. @param {string} at @param {string[]} args */
  const refused = (at, args) => refusedPristine(at, args, as()).error;

  /** `files` committed through the door for `task`. @param {string} at @param {string} task @param {string[]} files @param {string} subject */
  const committed = (at, task, files, subject) => run(at, ['commit', '--paths', ...files, '--task', UNIT, task, '-m', `fix(${UNIT}): ${subject}`]);

  describe(`the ${name} landing driver's quick-fix, its checkout left clean by its holder (19.5.23, R27)`, () => {
    it('the fix holding the checkout leaves it clean: its close refused while the checkout holds what it left uncommitted, naming it, and saying a close gives it up; its done, saying to commit it through the door; then, none holding it, a fix not started is briefed to build only once started', async () => {
      const at = project();
      createFix(at, 1, FLAG, as());
      run(at, ['task', 'start', UNIT, '1.1']);
      await parkedOn(at, '1.1', as());
      createFix(at, 2, HELP, as());
      run(at, ['task', 'start', UNIT, '1.2']);
      createFile(at, 'src/debug.js', 'console.log(\'help\');\n');
      const close = refused(at, ['task', 'close', UNIT, '1.2', '--reason', 'Met already.']);
      createFile(at, 'src/help.js', 'const help = \'--colour\';\n');
      committed(at, '1.2', ['src/help.js'], 'spell the help --colour');
      run(at, ['land', 'open', UNIT, '1.2']);
      accountTaken(at, UNIT, '1.2');
      const done = refused(at, ['task', 'done', UNIT, '1.2']);
      fs.rmSync(path.join(at, 'src/debug.js'));
      run(at, ['task', 'done', UNIT, '1.2']);
      createFix(at, 3, 'Spell the docs --colour', as());
      const unstarted = refused(at, ['brief', 'builder', UNIT, '1.3']);

      const left = (verb, way) => `task ${verb}: task 1.2 of ${UNIT} holds ${UNIT}'s one checkout, which holds changes not committed — src/debug.js — and a fix leaves it clean as it stops holding it: ${way}`;
      assert.deepStrictEqual([close, done], [
        left('close', 'a fix closed gives its work up with it, so remove them, then run it again'),
        left('done', 'commit what is the fix\'s through the door, remove what is not, as a scenario\'s run leaves, then run it again'),
      ]);
      assert.strictEqual(unstarted, `brief: task 1.3 of ${UNIT} holds no part of ${UNIT}'s one checkout — start it first, engine task start ${UNIT} 1.3, which puts the checkout on it`);
    });

    it('a fix an answer freed since its last start refuses the person\'s change in the checkout at its start, made while it held none, its work set aside left there; closed, it keeps that work, never dropped, naming it with the calls that show it and bring it into the checkout — on its answer and on the close\'s screen, whose call brings it back — and another fix closed names none of it', async () => {
      const at = project();
      createFix(at, 1, FLAG, as());
      run(at, ['task', 'start', UNIT, '1.1']);
      createFile(at, 'src/alias.js', 'module.exports = \'color\';\n');
      const raised = await parkedOn(at, '1.1', as());
      createFile(at, 'notes/mine.md', 'the person\'s own notes\n');
      const { raise } = okSections(at, ['raise', 'draw', UNIT, 'Q1'], as()).res;
      ok(at, ['raise', 'answer', raise, '--pick', '1'], { ...as(), stdin: JSON.stringify({ why: 'Old scripts pass it.' }) });
      const start = refused(at, ['task', 'start', UNIT, '1.1']);
      fs.rmSync(path.join(at, 'notes'), { recursive: true });
      createFix(at, 2, HELP, as());
      const other = run(at, ['task', 'close', UNIT, '1.2', '--reason', 'Met already.']);
      const closed = run(at, ['task', 'close', UNIT, '1.1', '--reason', 'The flag stays as it is.']);
      checklistClosed(at, as());
      const screen = sectionOf(output(at, ['render', 'finish', UNIT], as()), 'DISPLAY: finish').replace(/\n +/g, ' ');
      const recover = /bring it into the checkout with (git [^,]+), settling/.exec(screen)?.[1] ?? '';
      git(at, recover.split(' ').slice(1));

      assert.strictEqual(raised.line, `Task 1.1 parks on Q1, waiting for you: ${CALL.question} What the checkout held not committed is set aside until it starts again: src/alias.js. The other tasks carry on.`);
      assert.strictEqual(start, `task start: task 1.1 of ${UNIT} is built in the project's own checkout, which holds changes not committed — notes/mine.md — so it was not put on ${UNIT}'s branch: commit them or set them aside, then start the task again`);
      assert.strictEqual(other.kept_aside, undefined);
      assert.deepStrictEqual(closed.kept_aside, [{ task: '1.1', repo: '.', ref: ASIDE, see: `git diff ${ASIDE}^ ${ASIDE}`, recover: `git cherry-pick --no-commit ${ASIDE}` }]);
      assert.ok(screen.includes(`⚑ Task 1.1's work, set aside when a question parked it, is kept in the project's repository at ${ASIDE} — see it with git diff ${ASIDE}^ ${ASIDE}; bring it into the checkout with git cherry-pick --no-commit ${ASIDE}, settling any conflict`), screen);
      assert.strictEqual(fs.readFileSync(path.join(at, 'src/alias.js'), 'utf8'), 'module.exports = \'color\';\n');
    });
  });
}
