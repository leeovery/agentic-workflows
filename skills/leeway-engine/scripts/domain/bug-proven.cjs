'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the bug-proven check (15.5) — a bugfix's bug proven by the
// test its first task writes before any other task's code lands, that test
// one of the build's gates once it does, and run once more on the unfixed
// code in the review phase.
//
// - The reproducing task is fixed by position: phase 1's lowest-numbered,
//   task 1.1, since a phase's tasks number from 1 and none is ever removed
//   (task-verbs.cjs). It writes the test and nothing else, of type `test`
//   (15.5.1, the task writer's brief), its scenario one of phase 1 of the
//   cut and of its own acceptance scenarios. A bugfix built under the old
//   plan never reaches it: it has no cut.
// - Its test runs on the unfixed code through `verify run … --unfixed`
//   (verify.cjs), each run recorded under its scenario (runs.cjs): in the
//   build, at task 1.1's tip, each run task 1.1's; in the review phase, once
//   every phase of the cut has closed, at the commits the build's series
//   ran at, each run the review's, no task's (15.5.6).
// - The build's series is the latest series of task 1.1's runs (runs.cjs,
//   `latestSeries`): consecutive runs at the same commits. Each call runs
//   the test five times or stops at its pass, so a series proves the bug
//   where no run in it passed: five failures at least (15.5.3).
// - The door (commit-task.cjs), for a bugfix's code commit: the reproducing
//   task's own commits run the project's tests allowed to fail, the linters
//   as ever (F1); any other task's is refused, before any check runs, until
//   the build's series proves the bug at task 1.1's tip — its branch, in
//   each repository holding it, at or behind the commit the series ran at
//   there — and the calling checkout is built on that tip; then the series'
//   command runs after the tests as one of the door's checks, and must pass
//   (15.5.4). Every refusal names the way on. What it reads: for a bugfix,
//   the runs of phase 1's scenarios and each repository's branches; for any
//   other unit, nothing beyond its manifest.
// - The review phase's round 1 is recorded once a re-run is (review-
//   round.cjs); a re-run that passed is an item of the round, `unfixed#1`,
//   serious, which a finding answers, and the round fails (15.5.6).
//
// Known edges: a reworked test's new series replaces the old one, and a
// task's branch built on the old tip is refused until it is rebased onto the
// new; a test reworked by a fix task of the review phase is held to passing
// alone, its series still the build's.
// ---------------------------------------------------------------------------

const { repoName } = require('../kernel/repos.cjs');
const { cutPhases } = require('./derivations.cjs');
const { unfixedRuns, latestSeries } = require('./runs.cjs');
const { shownTask, taskName } = require('./task-id.cjs');
const { taskOfBranch } = require('./landing-names.cjs');
const { branches, isAncestor, quoted } = require('./landing-git.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./runs.cjs').Series} Series */
/** @typedef {import('./runs.cjs').ReadRun} ReadRun */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** Where the reproducing task stands: phase 1's lowest-numbered. */
const REPRODUCING = Object.freeze({ phase: 1, n: 1 });

/** The reproducing task as a run names it. */
const REPRODUCING_SHOWN = shownTask(REPRODUCING);

/** How many failures on the unfixed code prove the bug. */
const SERIES_RUNS = 5;

/** The item a re-run that passed is among round 1's. */
const UNFIXED_ITEM = 'unfixed#1';

/** Whether the unit is a bugfix, whose bug is proven (15.5.5). @param {Record<string, any>} manifest */
const isBugfix = (manifest) => manifest.work_type === 'bugfix';

/** Whether a task is the reproducing one. @param {{phase: number, n: number}} ref */
const isReproducing = ({ phase, n }) => phase === REPRODUCING.phase && n === REPRODUCING.n;

/** The unit's reproducing task. @param {string} unit @returns {TaskRef} */
const reproducingRef = (unit) => ({ unit, ...REPRODUCING });

/** The scenarios of phase 1 of the cut, among which the reproducing task's lies. @param {Record<string, any>} manifest @returns {string[]} */
const firstScenarios = (manifest) => cutPhases(manifest)[0]?.scenarios ?? [];

/**
 * The unit's runs on the unfixed code, in one read: the build's series, null
 * where none ran, and the review phase's re-runs, in order.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 * @returns {{series: Series|null, reruns: ReadRun[]}}
 */
function bugRuns(cwd, unit, manifest) {
  const runs = unfixedRuns(cwd, unit, firstScenarios(manifest));
  return { series: latestSeries(runs.filter(({ task }) => task === REPRODUCING_SHOWN)), reruns: runs.filter(({ task }) => task === null) };
}

/** Whether a series proves the bug: no pass in it (the header's). @param {Series|null} series */
const proves = (series) => series !== null && !series.passed;

/** The verb that runs the test on the unfixed code, from `verify`. @param {string} unit @param {string} scenario @param {string} command */
const unfixedVerb = (unit, scenario, command) => `verify run ${unit} ${scenario} --unfixed --test ${quoted(command)}`;

/** The command a refusal names where the person writes it. */
const COMMAND_SLOT = '<the command that runs that test alone>';

/** The verb that runs the series again, its scenario and command the series' own. @param {string} unit @param {Series} series */
const seriesVerb = (unit, { scenario, command }) => unfixedVerb(unit, scenario, command);

/** The call that runs the series again, as a refusal names it. @param {string} unit @param {Series} series */
const seriesCall = (unit, series) => `engine ${seriesVerb(unit, series)}`;

/** The verb that runs a first series, from `verify`. @param {string} unit */
const firstVerb = (unit) => unfixedVerb(unit, '<scenario>', COMMAND_SLOT);

/** The call that runs a first series, as a refusal names it. @param {string} unit */
const firstCall = (unit) => `engine ${firstVerb(unit)}, its scenario one of task 1.1's`;

/** The verb that runs the test on the unfixed code, from `verify`: the series again where there is one, else a first. @param {string} unit @param {Series|null} series */
const runVerb = (unit, series) => (series === null ? firstVerb(unit) : seriesVerb(unit, series));

/** Task 1.1's branch in a repository and its tip, null where it has none. @param {string} unit @param {Repo} repo */
function reproducingBranch(unit, repo) {
  for (const [branch, tip] of branches(repo.path)) {
    const task = taskOfBranch(unit, branch);
    if (task !== null && isReproducing(task)) return { branch, tip };
  }
  return null;
}

/**
 * Why the build's series does not yet prove the bug for a code commit from
 * the checkout whose repositories are `repos`, with the way on, or null
 * where it does (the header's).
 * @param {string} unit @param {Series|null} series @param {Repo[]} repos
 * @returns {string|null}
 */
function unprovenWhy(unit, series, repos) {
  if (series === null) return `no series of it has run on the unfixed code — run it there five times: ${firstCall(unit)}`;
  const held = repos.flatMap((repo) => {
    const branch = reproducingBranch(unit, repo);
    return branch === null ? [] : [{ repo, ...branch }];
  });
  const ranAt = (/** @type {Repo} */ repo) => series.commits.find(({ repo: name }) => name === repoName(repo))?.commit ?? null;
  const moved = held.find(({ repo, tip }) => {
    const ran = ranAt(repo);
    return ran === null || !isAncestor(repo.path, tip, ran);
  });
  if (moved !== undefined) return `task 1.1's branch ${moved.branch} has moved past the commits its series ran at, so the test as it stands is not proven — run a new series: ${seriesCall(unit, series)}`;
  if (series.passed) return `the test passed on the unfixed code in its series, so it proves nothing — rework the test, a new commit on task 1.1, then run a new series: ${seriesCall(unit, series)}`;
  const behind = held.find(({ repo, tip }) => !isAncestor(repo.path, tip, 'HEAD'));
  return behind === undefined ? null : `this checkout is not built on ${behind.branch}, task 1.1's branch, where the test was proven — rebase onto it, then commit again`;
}

/**
 * What the door does for a code commit of a bugfix's task `ref` from the
 * checkout whose repositories are `repos` (the header's): for the
 * reproducing task, its tests allowed to fail; for any other, the build's
 * series' command run after the tests, with its way on where it fails — or
 * why the commit waits, where the bug is not proven for it.
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {Repo[]} repos
 * @returns {{testsMayFail: true}|{test: string, way: string}|{unproven: string}}
 */
function doorGate(cwd, manifest, ref, repos) {
  if (isReproducing(ref)) return { testsMayFail: true };
  const { series } = bugRuns(cwd, ref.unit, manifest);
  const why = unprovenWhy(ref.unit, series, repos);
  if (why !== null) {
    return { unproven: `${ref.unit} is a bugfix, so ${taskName(ref)}'s code lands once its bug is proven by the test its reproducing task wrote — task 1.1, phase 1's lowest-numbered (15.5.3): ${why}` };
  }
  const proven = /** @type {Series} */ (series);
  return {
    test: proven.command,
    way: `the test task 1.1 wrote fails here, and passes once the bug is fixed (15.5.4) — fix what it reports and commit again; where its command fails for another reason, such as a wrong path, `
      + `run a new series with the right one: engine ${unfixedVerb(ref.unit, proven.scenario, COMMAND_SLOT)}`,
  };
}

/**
 * Why round 1 of a bugfix's review cannot be recorded yet, with the way on,
 * or null where a re-run is recorded since the review began (15.5.6).
 * @param {string} unit @param {{series: Series|null, reruns: ReadRun[]}} runs
 * @returns {string|null}
 */
function rerunRefusal(unit, { series, reruns }) {
  if (reruns.length > 0) return null;
  return `${unit} is a bugfix, and round 1 is recorded once the test that reproduces its bug has run on the unfixed code again since the review began, where it must fail (15.5.6): engine ${runVerb(unit, series)}`;
}

/** Whether a re-run since the review began passed on the unfixed code: a finding round 1 carries (15.5.6). @param {ReadRun[]} reruns */
const rerunPassed = (reruns) => reruns.some(({ verdict }) => verdict === 'pass');

module.exports = {
  REPRODUCING, REPRODUCING_SHOWN, SERIES_RUNS, UNFIXED_ITEM, isBugfix, isReproducing, reproducingRef, firstScenarios, bugRuns, proves, seriesCall, runVerb, doorGate, rerunRefusal, rerunPassed,
};
