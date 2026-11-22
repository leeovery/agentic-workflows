'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose worktree has one holder
// (19.5.23, R27): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn. The fix in flight
// whose turn it is holds the worktree, never one a question parks
// (task-verbs.cjs, `checkoutHold`): a parked fix's start, its builder's
// and fix round's briefs and its commit refused, naming its question,
// whether or not another holds the worktree, while its pair, which reads
// commits, is briefed — so a fix parked at its built report with a file
// left uncommitted never locks the quick-fix — and its close never refused
// over the holder's changes. The holder leaving the worktree clean:
// test-engine-landing-conformance-quick-fix-holder-clean.cjs; its start
// taking its own work, and what a park sets aside:
// test-engine-quick-fix-worktree.cjs. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world; this file names no
// driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixConformance`, built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  ok, refusedPristine, git, createFile,
} = require('./engine-harness.cjs');
const {
  UNIT, FLAG, HELP, createFix, parkedOn, fixTree, quickFixConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

/** Why fix 1.1 waits while Q1 parks it, as every refusal of it says. */
const PARKED = `task 1.1 of ${UNIT} waits on Q1, parked for the person — they answer it through its raise: raise draw ${UNIT} Q1`;

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixConformance(name, `engine-landing-quick-fix-holder-${name}-`);

  /** A call that must succeed. @param {string} at @param {string[]} args */
  const run = (at, args) => ok(at, args, as());

  /** A call's refusal, nothing written or committed. @param {string} at @param {string[]} args */
  const refused = (at, args) => refusedPristine(at, args, as()).error;

  /** `files` committed through the door for `task` from the quick-fix's worktree. @param {string} at @param {string} task @param {string[]} files @param {string} subject */
  const committed = (at, task, files, subject) => run(fixTree(at), ['commit', '--paths', ...files, '--task', UNIT, task, '-m', `fix(${UNIT}): ${subject}`]);

  /** Fix 1.1 started, its flag committed and opened, then parked on Q1: the raise's answer. @param {string} at @param {() => void} [leave] what its builder leaves before the park */
  async function parkedBuilt(at, leave = () => {}) {
    createFix(at, 1, FLAG, as());
    run(at, ['task', 'start', UNIT, '1.1']);
    createFile(fixTree(at), 'src/flag.js', 'const flag = \'colour\';\n');
    committed(at, '1.1', ['src/flag.js'], 'spell the flag --colour');
    run(at, ['land', 'open', UNIT, '1.1']);
    leave();
    return parkedOn(at, '1.1', as());
  }

  /** What the quick-fix's worktree holds not committed, as git lists it. @param {string} at */
  const status = (at) => git(fixTree(at), ['status', '--porcelain', '--untracked-files=all', '--', 'src']).trim();

  describe(`the ${name} landing driver's quick-fix, its worktree held by one fix (19.5.23, R27)`, () => {
    it('a fix parked at its built report with a file left uncommitted sets the file aside, its pair briefed while it waits; its start, its builder\'s and fix round\'s briefs and its commit refused, naming its question, no fix holding the worktree; the next fix starts on the clean worktree', async () => {
      const at = project();
      const raised = await parkedBuilt(at, () => createFile(fixTree(at), 'src/flag.test.js', 'test(\'--colour\');\n'));
      const pair = run(at, ['brief', 'reviewer', UNIT, '1.1', '--letter', 'a']);
      const waits = [
        refused(at, ['task', 'start', UNIT, '1.1']),
        refused(at, ['brief', 'builder', UNIT, '1.1']),
        refused(at, ['brief', 'fix', UNIT, '1.1']),
        refused(fixTree(at), ['commit', '--paths', 'src/flag.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): the flag again`]),
      ];
      createFix(at, 2, HELP, as());
      const next = run(at, ['task', 'start', UNIT, '1.2']);

      assert.deepStrictEqual([raised.set_aside, typeof pair.id, status(at)], [['src/flag.test.js'], 'string', '']);
      assert.match(raised.line, / What its worktree held not committed is set aside until it starts again: src\/flag\.test\.js\. The other tasks carry on\.$/);
      assert.deepStrictEqual(waits, [
        `task start: ${PARKED}`,
        `brief: ${PARKED}`,
        `brief: ${PARKED}`,
        `commit --task: a question parks task 1.1 of ${UNIT}, so it does not hold ${UNIT}'s worktree — no fix holds it now; task 1.1 of ${UNIT}'s change is committed once it holds the worktree again, started again with \`engine task start ${UNIT} 1.1\`, once the answer frees it`,
      ]);
      assert.strictEqual(next.task, '1.2');
    });

    it('a parked fix with nothing set aside, while the next fix holds the worktree: its start, its builder\'s and fix round\'s briefs refused, naming its question before the fix holding the worktree, and its close, not holding the worktree, never refused over the holder\'s change there', async () => {
      const at = project();
      createFix(at, 1, FLAG, as());
      run(at, ['task', 'start', UNIT, '1.1']);
      const raised = await parkedOn(at, '1.1', as());
      createFix(at, 2, HELP, as());
      run(at, ['task', 'start', UNIT, '1.2']);
      createFile(fixTree(at), 'src/help.js', 'const help = \'--colour\';\n');
      const builders = [refused(at, ['task', 'start', UNIT, '1.1']), refused(at, ['brief', 'builder', UNIT, '1.1']), refused(at, ['brief', 'fix', UNIT, '1.1'])];
      const closed = run(at, ['task', 'close', UNIT, '1.1', '--reason', 'The flag stays as it is.']);

      assert.deepStrictEqual([raised.set_aside, builders], [undefined, [`task start: ${PARKED}`, `brief: ${PARKED}`, `brief: ${PARKED}`]]);
      assert.deepStrictEqual([closed.task, status(at)], ['1.1', '?? src/help.js']);
    });
  });
}
