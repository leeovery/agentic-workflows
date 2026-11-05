'use strict';

// ---------------------------------------------------------------------------
// The bug-proven suites' world and helpers (test-engine-verify-unfixed.cjs
// and test-engine-commit-task-bugfix.cjs): a bugfix, `crash`, its spec of
// one area with two scenarios, its cut one phase holding both, its build
// begun in auto and the phase started — its start's close written onto the
// manifest, as the verify suites' is — its two tasks in the tracker: 1.1,
// the reproducing task, of type `test` holding 1.S1, and 1.2, the fix,
// holding 1.S2. The code on main holds the bug; task 1.1's branch commits the
// test that reproduces it, which logs where it ran and at which commit to a
// file in the repository's git directory and passes once the bug is gone;
// task 1.2's branch starts at 1.1's tip, and the checkout has it out. Beside
// it a bugfix whose task 1.1 has no branch, `slow`; one whose phase 1 is not
// written in the tracker, `ghost`; and a feature, `pay`. `unproven` is that
// world; `proven`, the same with the test's series run on the unfixed code
// through `verify run … --unfixed`, five failures — each built once per
// process and copied for each test.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ok, git, commitAll, commitCode, fixtureFrom, layout, createFile, writeState, readManifest, FROZEN_AT } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const UNIT = 'crash';

const SPEC = [
  '# Crash', '',
  '## 1. The checkout', '', '### 1.1 Paying', '', '1.1.1 Paying never crashes the checkout. [builder]', '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a basket, when it is paid, then the checkout holds. (1.1.1)', '',
  '1.S2 Given an empty basket, when it is paid, then it is refused. (1.1.1)', '',
].join('\n');

const CUT = Object.freeze({ phases: [{ name: 'The fix', goal: 'Paying holds.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] }] });

/** A task file's text. @param {string} title @param {string} type @param {string} scenario */
const taskText = (title, type, scenario) => [
  `# ${title}`, '', '## Type', type, '', '## Problem', 'Paying crashes the checkout.', '', '## Solution', `${title}, run alone by sh test/crash.sh.`, '',
  '## Outcome', 'The checkout holds.', '', '## Acceptance scenarios', `- ${scenario}`, '', '## Spec reference', '§1',
].join('\n');

/** The reproducing task's and the fix's titles and types. */
const REPRODUCE = Object.freeze({ title: 'Reproduce the crash', type: 'test' });
const FIX = Object.freeze({ title: 'Fix the crash', type: 'fix' });

/** A task of a unit's branch, as the landing names it. @param {number} n @param {string} [unit] */
const branchOf = (n, unit = UNIT) => {
  const { title, type } = n === 1 ? REPRODUCE : FIX;
  return taskBranch({ unit, phase: 1, n }, type, title);
};

/** The test that reproduces the bug, run alone. */
const TEST = 'sh test/crash.sh';

/** The code with the bug, and fixed. */
const BUGGY = 'export const crashes = true;\n';
const FIXED = 'export const crashes = false;\n';

// The test logs the folder it runs in and the commit there, then fails
// while the code holds the bug.
const CRASH_TEST = `log="$(git rev-parse --path-format=absolute --git-common-dir)/unfixed.log"
echo "$(pwd -P) $(git rev-parse HEAD)" >> "$log"
echo "checking the checkout"
! grep -q 'crashes = true' src/app.js
`;

/** Where the test logs each run. @param {string} dir */
const logOf = (dir) => path.join(dir, '.git', 'unfixed.log');

/** A check that logs its name where the test logs its runs, so the order they ran in reads off one log. @param {string} name */
const logging = (name) => `echo ${name} >> "$(git rev-parse --path-format=absolute --git-common-dir)/unfixed.log"`;

/** Each run the test and each logging check logged, the test's `{folder} {commit}`; none where none ran. @param {string} dir @returns {string[]} */
const testRuns = (dir) => (fs.existsSync(logOf(dir)) ? fs.readFileSync(logOf(dir), 'utf8').trimEnd().split('\n') : []);

/** The commit a branch of the project's repository is at. @param {string} dir @param {string} branch */
const tipOf = (dir, branch) => git(dir, ['rev-parse', branch]).trim();

/** Where the engine lays the project out for a run on the unfixed code. @param {string} dir */
const scratchOf = (dir) => path.join(fs.realpathSync(dir), '.claude', 'worktrees', `leeway-unfixed-${UNIT}`);

/** `verify run … --unfixed`'s call for 1.S1, the command `test`. @param {string} [test] @param {string} [scenario] */
const unfixedArgs = (test = TEST, scenario = '1.S1') => ['verify', 'run', UNIT, scenario, '--unfixed', '--test', test];

/** A unit's phase 1 written in the tracker, its tasks each made from a file. @param {string} dir @param {string} unit @param {[string, string, string][]} tasks */
function phaseWritten(dir, unit, tasks) {
  ok(dir, ['task', 'phase', unit, '1', '--title', 'The fix']);
  for (const [title, type, scenario] of tasks) ok(dir, ['task', 'create', unit, '1', '--file', writeState(dir, layout.cache('task.md'), taskText(title, type, scenario))]);
}

/** A bugfix, its spec, its cut and its build begun, the cut's phase started. @param {string} dir @param {string} unit */
function bugfixBuilding(dir, unit) {
  createManifest(dir, unit, { work_type: 'bugfix', build: { position: 'auto' }, cut: CUT, checklists: { 'phase-1-start': { items: {}, closed: FROZEN_AT } } });
  writeState(dir, layout.unit(unit, 'spec.md'), SPEC);
}

/** The world before its series runs (the header's). @param {string} dir */
function build(dir) {
  for (const unit of [UNIT, 'slow', 'ghost']) bugfixBuilding(dir, unit);
  createManifest(dir, 'pay', {});
  createFile(dir, 'src/app.js', BUGGY);
  commitAll(dir, 'init');
  phaseWritten(dir, UNIT, [[REPRODUCE.title, REPRODUCE.type, '1.S1'], [FIX.title, FIX.type, '1.S2']]);
  phaseWritten(dir, 'slow', [[REPRODUCE.title, REPRODUCE.type, '1.S1']]);
  git(dir, ['checkout', '-q', '-b', branchOf(1)]);
  createFile(dir, 'test/crash.sh', CRASH_TEST);
  commitCode(dir, `test(${UNIT}): reproduce the crash\n\nLeeway-Task: ${UNIT}-1-1`);
  git(dir, ['checkout', '-q', '-b', branchOf(2)]);
}

const unproven = fixtureFrom('bug-proven-', build);
const proven = fixtureFrom('bug-proven-series-', (dir) => {
  build(dir);
  ok(dir, unfixedArgs());
  fs.rmSync(logOf(dir));
});

/** The unit's build finished: its one phase closed, so the review phase has begun. @param {string} dir */
function buildFinished(dir) {
  const manifest = readManifest(dir, UNIT);
  createManifest(dir, UNIT, { ...manifest, checklists: { ...manifest.checklists, 'phase-1-close': { items: {}, closed: FROZEN_AT } } });
}

module.exports = {
  UNIT, TEST, BUGGY, FIXED, branchOf, logging, testRuns, tipOf, scratchOf, unfixedArgs, buildFinished, unproven, proven,
};
