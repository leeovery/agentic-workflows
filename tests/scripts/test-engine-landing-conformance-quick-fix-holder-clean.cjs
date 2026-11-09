'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose one checkout's holder
// leaves it clean (19.5.23, R27): the contract every landing driver meets,
// run through the engine's verbs against each shipped driver in turn. The
// fix holding the checkout leaves it clean as it stops holding it
// (task-verbs.cjs, `checkoutHold`): its close and its done refused while
// the checkout holds changes not committed, so a fix freed after it never
// takes them as its own; and, none holding it, a fix not started briefed to
// build only once its start makes it the holder, and that start refusing
// the person's changes there. Who holds the checkout:
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
  ok, refusedPristine, createFile, accountTaken,
} = require('./engine-harness.cjs');
const {
  UNIT, FLAG, HELP, createFix, parkedOn, quickFixConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixConformance(name, `engine-landing-quick-fix-holder-clean-${name}-`);

  /** A call that must succeed. @param {string} at @param {string[]} args */
  const run = (at, args) => ok(at, args, as());

  /** A call's refusal, nothing written or committed. @param {string} at @param {string[]} args */
  const refused = (at, args) => refusedPristine(at, args, as()).error;

  /** `files` committed through the door for `task`. @param {string} at @param {string} task @param {string[]} files @param {string} subject */
  const committed = (at, task, files, subject) => run(at, ['commit', '--paths', ...files, '--task', UNIT, task, '-m', `fix(${UNIT}): ${subject}`]);

  describe(`the ${name} landing driver's quick-fix, its checkout left clean by its holder (19.5.23, R27)`, () => {
    it('the fix holding the checkout leaves it clean: its close and its done refused while the checkout holds what it left uncommitted, naming it; then, none holding it, a fix not started is briefed to build only once started, and a start that makes a fix the holder refuses the person\'s change there', async () => {
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
      createFile(at, 'src/mine.js', 'const mine = true;\n');
      const start = refused(at, ['task', 'start', UNIT, '1.3']);

      const left = (verb) => `task ${verb}: task 1.2 of ${UNIT} holds ${UNIT}'s one checkout, which holds changes not committed — src/debug.js — and a fix leaves it clean as it stops holding it: commit what is the fix's through the door, remove what is not, as a scenario's run leaves, then run it again`;
      assert.deepStrictEqual([close, done], [left('close'), left('done')]);
      assert.strictEqual(unstarted, `brief: task 1.3 of ${UNIT} holds no part of ${UNIT}'s one checkout — start it first, engine task start ${UNIT} 1.3, which puts the checkout on it`);
      assert.strictEqual(start, `task start: task 1.3 of ${UNIT} is built in the project's own checkout, which holds changes not committed — src/mine.js — so it was not put on ${UNIT}'s branch: commit them or set them aside, then start the task again`);
    });
  });
}
